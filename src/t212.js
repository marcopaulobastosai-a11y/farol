'use strict';
/**
 * Farol - Trading 212 (API publica, conta Invest).
 *
 * A Trading 212 nao esta no Open Banking. Tem API propria com chave e segredo
 * criados pelo Marco na app (so leitura: sem «Orders - Execute» nem «Pies -
 * Write»), colados nas Variables do Railway: T212_API_KEY e T212_API_SECRET.
 * Nunca no codigo. O Farol so le; nao ha nenhuma chamada que compre ou venda.
 *
 * O que entra na conta «Trading 212» do Farol (tipo investimento):
 *  - movimentos de dinheiro (/equity/history/transactions): depositos,
 *    levantamentos, comissoes, juros do dinheiro parado; impressao t212:<ref>.
 *  - dividendos (/equity/history/dividends): impressao t212d:<ref>.
 *  - um acerto de valorizacao por mes (t212:aval:AAAA-MM), para o saldo da
 *    conta no Farol ficar igual ao valor total da conta na Trading 212
 *    (dinheiro + carteira a precos de mercado). Categoria «Transferências ›
 *    Valorização de investimentos», que nao conta como receita nem despesa.
 * Le de manha (8h10) e a noite (21h10), hora de Lisboa.
 */
const { query } = require('./db');

const API = 'https://live.trading212.com/api/v0';
const all = async (sql, params) => (await query(sql, params)).rows;
const cent = (v) => Math.round(Number(v || 0) * 100) / 100;
let financas = null;

function configurado() { return Boolean(String(process.env.T212_API_KEY || '').trim() && String(process.env.T212_API_SECRET || '').trim()); }
function auth() {
  const k = String(process.env.T212_API_KEY || '').trim(), s = String(process.env.T212_API_SECRET || '').trim();
  return 'Basic ' + Buffer.from(k + ':' + s).toString('base64');
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
async function t212(caminho, tentativas = 3) {
  const url = caminho.startsWith('http') ? caminho : (caminho.startsWith('/api/') ? 'https://live.trading212.com' + caminho : API + caminho);
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { Authorization: auth(), Accept: 'application/json' } });
    if (r.status === 429 && i < tentativas) { await espera(Number(r.headers.get('x-ratelimit-reset')) ? Math.max(1000, Number(r.headers.get('x-ratelimit-reset')) * 1000 - Date.now()) : 15000); continue; }
    const txt = await r.text();
    if (!r.ok) {
      const e = new Error('Trading 212 (' + r.status + '): ' + (r.status === 401 ? 'chave ou segredo errados' : r.status === 403 ? 'a chave não tem esta permissão' : txt.slice(0, 200)));
      e.status = r.status === 401 || r.status === 403 ? 502 : 502;
      throw e;
    }
    return txt ? JSON.parse(txt) : null;
  }
}
/* Lista paginada (cursor): segue nextPagePath ate ao fim, ou ate encontrar uma ref ja vista. */
async function paginas(inicio, parar) {
  const itens = [];
  let prox = inicio;
  for (let n = 0; prox && n < 200; n++) {
    const p = await t212(prox);
    const lote = (p && p.items) || [];
    let chega = false;
    for (const it of lote) { if (parar && await parar(it)) { chega = true; break; } itens.push(it); }
    if (chega) break;
    prox = p && p.nextPagePath;
    if (prox) await espera(3100); // 20 pedidos por minuto
  }
  return itens;
}

async function setting(k) { const r = (await all('SELECT value FROM settings WHERE key = $1', [k]))[0]; return r ? r.value : null; }
async function setSetting(k, v) { await query('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, v]); }

async function categoria(grupo, nome, natureza) {
  const r = (await all('SELECT id FROM fin_categorias WHERE lower(grupo) = lower($1) AND lower(nome) = lower($2)', [grupo, nome]))[0];
  if (r) return r.id;
  return (await all('INSERT INTO fin_categorias (grupo, nome, natureza) VALUES ($1,$2,$3) RETURNING id', [grupo, nome, natureza]))[0].id;
}

async function conta() {
  const id = Number(await setting('t212_conta_id'));
  if (id && (await all('SELECT 1 FROM fin_contas WHERE id = $1', [id])).length) return id;
  const nova = (await all(
    `INSERT INTO fin_contas (nome, tipo, instituicao, pessoal, saldo_inicial, nota, ativo)
     VALUES ('Trading 212 - Marco', 'investimento', 'Trading 212', TRUE, 0,
             'Trading 212 · conta Invest · lida pela API da Trading 212 (só leitura). Saldo = dinheiro + carteira a preços de mercado.', TRUE)
     RETURNING id`))[0].id;
  await setSetting('t212_conta_id', String(nova));
  return nova;
}

const TIPO_TX = {
  DEPOSIT: 'Depósito na Trading 212', WITHDRAW: 'Levantamento da Trading 212', FEE: 'Comissão Trading 212',
  TRANSFER: 'Transferência Trading 212', INTEREST_ON_FREE_CASH: 'Juros do dinheiro não investido', LENDING_INTEREST: 'Juros de empréstimo de ações',
};
function valorTx(t) {
  const v = Math.abs(Number(t.amount || 0));
  if (t.type === 'WITHDRAW' || t.type === 'FEE') return -v;
  if (t.type === 'TRANSFER') return Number(t.amount || 0);
  return v;
}
const dia = (s) => String(s || '').slice(0, 10);

async function inserir(contaId, data, descricao, valor, impressao, categoriaId) {
  const r = await all(
    `INSERT INTO fin_movimentos (conta_id, data, descricao, valor, impressao, origem, categoria_id, categoria_fonte)
     VALUES ($1,$2,$3,$4,$5,'import',$6, CASE WHEN $6::int IS NULL THEN NULL ELSE 'regra' END)
     ON CONFLICT (conta_id, impressao) DO NOTHING RETURNING id`,
    [contaId, data, descricao.slice(0, 500), cent(valor), impressao, categoriaId || null]);
  return r.length ? r[0].id : null;
}

let aCorrer = null;
async function sincronizar(origem) {
  if (aCorrer) return aCorrer;
  aCorrer = (async () => {
    const res = { origem: origem || 'manual', inicio: new Date().toISOString() };
    if (!configurado()) { res.erro = 'sem credenciais (T212_API_KEY / T212_API_SECRET)'; return res; }
    try {
      const contaId = await conta();
      res.conta_id = contaId;
      const catRend = await categoria('Receitas', 'Rendimentos de investimento', 'receita');
      const catAcoes = await categoria('Transferências', 'Ações & ETF', 'transferencia');
      const catVal = await categoria('Transferências', 'Valorização de investimentos', 'transferencia');
      const catCom = await categoria('Financeiras', 'Comissões bancárias', 'despesa');
      const ja = async (imp) => (await all('SELECT 1 FROM fin_movimentos WHERE conta_id = $1 AND impressao = $2', [contaId, imp])).length > 0;

      /* Movimentos de dinheiro: do mais recente para tras, ate encontrar um ja visto. */
      const txs = await paginas('/equity/history/transactions?limit=50', async (t) => ja('t212:' + t.reference));
      const novos = [];
      for (const t of txs.reverse()) {
        const v = valorTx(t);
        if (Math.abs(v) < 0.005) continue;
        const cat = /INTEREST/.test(t.type) ? catRend : (t.type === 'FEE' ? catCom : catAcoes);
        const id = await inserir(contaId, dia(t.dateTime), TIPO_TX[t.type] || ('Trading 212 · ' + t.type), v, 't212:' + t.reference, null);
        if (id) { novos.push(id); if (cat) await query("UPDATE fin_movimentos SET categoria_id = $2, categoria_fonte = 'regra' WHERE id = $1 AND categoria_id IS NULL", [id, cat]); }
      }
      res.movimentos = novos.length;

      await espera(1000);
      const divs = await paginas('/equity/history/dividends?limit=50', async (d) => ja('t212d:' + d.reference));
      let nDiv = 0;
      for (const d of divs.reverse()) {
        const v = Number(d.amountInEuro != null ? d.amountInEuro : d.amount);
        if (Math.abs(v) < 0.005) continue;
        const nome = (d.instrument && d.instrument.name) || d.ticker || '';
        const id = await inserir(contaId, dia(d.paidOn), 'Dividendo ' + nome + (d.quantity ? ' (' + Number(d.quantity) + ' un.)' : ''), v, 't212d:' + d.reference, catRend);
        if (id) { nDiv++; novos.push(id); }
      }
      res.dividendos = nDiv;

      /* Valor total da conta e acerto de valorizacao do mes. */
      await espera(1000);
      const s = await t212('/equity/account/summary');
      const c = (s && s.cash) || {}, inv = (s && s.investments) || {};
      const dinheiro = cent(Number(c.availableToTrade || 0) + Number(c.inPies || 0) + Number(c.reservedForOrders || 0));
      const carteira = cent(inv.currentValue || 0);
      const total = cent(dinheiro + carteira);
      res.resumo = { moeda: s && s.currency, dinheiro, carteira, total, investido: cent(inv.totalCost), mais_valia_latente: cent(inv.unrealizedProfitLoss), mais_valia_realizada: cent(inv.realizedProfitLoss), total_api: s && s.totalValue };
      const hoje = new Date().toISOString().slice(0, 10), mes = hoje.slice(0, 7);
      const imp = 't212:aval:' + mes;
      const semAval = cent((await all(
        `SELECT COALESCE((SELECT saldo_inicial FROM fin_contas WHERE id = $1),0) + COALESCE(SUM(valor),0) AS s
           FROM fin_movimentos WHERE conta_id = $1 AND impressao <> $2`, [contaId, imp]))[0].s);
      const acerto = cent(total - semAval);
      const existe = (await all('SELECT id FROM fin_movimentos WHERE conta_id = $1 AND impressao = $2', [contaId, imp]))[0];
      const desc = 'Valorização da carteira (' + mes + ')';
      if (existe) await query('UPDATE fin_movimentos SET valor = $2, data = $3, descricao = $4 WHERE id = $1', [existe.id, acerto, hoje, desc]);
      else if (Math.abs(acerto) >= 0.005) await inserir(contaId, hoje, desc, acerto, imp, catVal);
      res.acerto_mes = acerto;

      if (novos.length && financas && financas.ligarIdentificadores) {
        financas.base().then((B) => financas.ligarIdentificadores(B)).catch((e) => console.error('[farol] t212: ligar:', e.message));
      }
    } catch (e) {
      res.erro = e.message;
      console.error('[farol] t212:', e.message);
    }
    res.fim = new Date().toISOString();
    await setSetting('t212_ultima', JSON.stringify(res));
    return res;
  })();
  try { return await aCorrer; } finally { aCorrer = null; }
}

/* ---------------- agenda: 8h10 e 21h10 em Lisboa ---------------- */
const HORAS = [[8, 10], [21, 10]];
function msAteProxima() {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(new Date()).reduce((o, x) => { o[x.type] = x.value; return o; }, {});
  const agora = (+p.hour % 24) * 3600 + (+p.minute) * 60 + (+p.second);
  let melhor = Infinity;
  HORAS.forEach(([h, m]) => { let f = h * 3600 + m * 60 - agora; if (f <= 30) f += 24 * 3600; melhor = Math.min(melhor, f); });
  return melhor * 1000;
}
function agendar() {
  setTimeout(async () => {
    try { if (configurado()) await sincronizar('agendada'); } catch (e) { console.error('[farol] t212 (agendada):', e.message); }
    agendar();
  }, msAteProxima());
}
async function arrancar() {
  agendar();
  setTimeout(async () => {
    try {
      const u = await setting('t212_ultima');
      const fim = u ? new Date(JSON.parse(u).fim || 0).getTime() : 0;
      if (configurado() && Date.now() - fim > 14 * 3600 * 1000) await sincronizar('arranque');
    } catch (e) { console.error('[farol] t212 (arranque):', e.message); }
  }, 3 * 60 * 1000);
}

function instalar(app, deps) {
  financas = (deps && deps.financas) || null;
  app.get('/api/financas/t212', async (_req, res) => {
    try {
      const u = await setting('t212_ultima');
      res.json({ configurado: configurado(), conta_id: Number(await setting('t212_conta_id')) || null, ultima: u ? JSON.parse(u) : null });
    } catch (e) { res.status(500).json({ error: 'Não foi possível ler o estado da Trading 212.' }); }
  });
  app.post('/api/financas/t212/sincronizar', async (_req, res) => {
    try { res.json(await sincronizar('manual')); } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/financas/t212/posicoes', async (_req, res) => {
    if (!configurado()) return res.status(400).json({ error: 'Falta a chave da Trading 212.' });
    try {
      const p = await t212('/equity/positions');
      res.json((p || []).map((x) => ({
        ticker: x.instrument && x.instrument.ticker, nome: x.instrument && x.instrument.name, isin: x.instrument && x.instrument.isin,
        quantidade: x.quantity, preco_medio: x.averagePricePaid, preco: x.currentPrice, moeda_instrumento: x.instrument && x.instrument.currency,
        valor: x.walletImpact && cent(x.walletImpact.currentValue), custo: x.walletImpact && cent(x.walletImpact.totalCost),
        mais_valia: x.walletImpact && cent(x.walletImpact.unrealizedProfitLoss), moeda: x.walletImpact && x.walletImpact.currency,
      })));
    } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
  });
}

module.exports = { instalar, arrancar, sincronizar, configurado };
