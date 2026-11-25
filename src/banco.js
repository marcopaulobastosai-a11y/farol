'use strict';
/**
 * Farol - ligacao ao banco por Open Banking (Enable Banking, PSD2).
 *
 * Em vez de entrar no homebanking e exportar extratos, o Farol pede ao banco,
 * pela API da Enable Banking, os movimentos das contas que o Marco autorizou.
 * A autorizacao faz-se uma vez, no ecra do proprio banco (com a Chave
 * Multicanal), e dura ate ao prazo que o banco aceitar (ate 180 dias). Depois
 * disso o Farol le sozinho, de manha e a noite.
 *
 * Credenciais: EB_APP_ID (o id da aplicacao «Farol» no painel da Enable
 * Banking) e EB_PRIVATE_KEY (a chave privada PEM, colada pelo Marco nas
 * Variables do Railway). Nunca no codigo.
 *
 * Repetidos: os movimentos que ja estao no Farol vieram de extratos (PDF, OFX,
 * CSV do homebanking) com texto diferente do da API. Por isso cada movimento da
 * API procura primeiro um movimento da mesma conta com o mesmo valor e data a
 * menos de 3 dias que ainda nao esteja ligado a nenhum da API: se existir,
 * fica so ligado (fin_banco_vistos), nao se cria outro. So o que nao tem par
 * entra como movimento novo.
 */
const crypto = require('crypto');
const { query } = require('./db');

const API = 'https://api.enablebanking.com';
const all = async (sql, params) => (await query(sql, params)).rows;
const cent = (v) => Math.round(Number(v || 0) * 100) / 100;
function erro(codigo, msg) { const e = new Error(msg); e.status = codigo; return e; }
function falha(res, err, onde) {
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  console.error('[farol] banco ' + onde + ':', err && err.message);
  return res.status(500).json({ error: 'Não foi possível ' + onde + '.' });
}

let financas = null; // injectado no instalar (categorizar, base, ligarIdentificadores)

/* ---------------- credenciais e JWT ---------------- */
function appId() { return String(process.env.EB_APP_ID || '').trim(); }
function chavePrivada() {
  let k = String(process.env.EB_PRIVATE_KEY || '').trim();
  if (!k) return '';
  if (k.includes('\\n')) k = k.replace(/\\n/g, '\n');
  if (!k.includes('\n')) {
    /* Colada numa linha so: refazer as linhas do PEM. */
    const m = k.match(/-----BEGIN ([A-Z ]+)-----(.+)-----END \1-----/);
    if (m) k = '-----BEGIN ' + m[1] + '-----\n' + m[2].replace(/\s+/g, '').match(/.{1,64}/g).join('\n') + '\n-----END ' + m[1] + '-----\n';
  }
  return k;
}
function configurado() { return Boolean(appId() && chavePrivada()); }
const b64u = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
function jwt() {
  if (!configurado()) throw erro(503, 'Falta configurar EB_APP_ID e EB_PRIVATE_KEY no Railway.');
  const iat = Math.floor(Date.now() / 1000);
  const cab = b64u(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId() }));
  const corpo = b64u(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat, exp: iat + 3600 }));
  const s = crypto.createSign('RSA-SHA256');
  s.update(cab + '.' + corpo);
  return cab + '.' + corpo + '.' + b64u(s.sign(chavePrivada()));
}
async function eb(metodo, caminho, corpo) {
  const r = await fetch(API + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = { texto: txt }; }
  if (!r.ok) {
    const msg = (j && (j.message || j.error || j.detail || j.texto)) || ('HTTP ' + r.status);
    throw erro(r.status === 401 || r.status === 403 ? 502 : 502, 'Banco (Enable Banking): ' + String(typeof msg === 'string' ? msg : JSON.stringify(msg)).slice(0, 300));
  }
  return j;
}

/* ---------------- tabelas ---------------- */
async function preparar() {
  await query(`
    CREATE TABLE IF NOT EXISTS fin_banco_ligacoes (
      id          SERIAL PRIMARY KEY,
      aspsp       TEXT NOT NULL,
      pais        TEXT NOT NULL DEFAULT 'PT',
      session_id  TEXT,
      valido_ate  TIMESTAMPTZ,
      estado      TEXT NOT NULL DEFAULT 'ativa',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS fin_banco_contas (
      uid             TEXT PRIMARY KEY,
      ligacao_id      INTEGER REFERENCES fin_banco_ligacoes(id) ON DELETE CASCADE,
      conta_id        INTEGER REFERENCES fin_contas(id) ON DELETE SET NULL,
      identificacao   TEXT,
      nome            TEXT,
      saldo_banco     NUMERIC(14,2),
      saldo_em        TIMESTAMPTZ,
      sincronizado_em TIMESTAMPTZ,
      ultimo_erro     TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    -- conta = identificacao da conta no banco (IBAN/cartao), que se mantem
    -- quando a autorizacao e renovada (o uid da Enable Banking muda).
    CREATE TABLE IF NOT EXISTS fin_banco_vistos (
      conta        TEXT NOT NULL,
      ref          TEXT NOT NULL,
      movimento_id INTEGER REFERENCES fin_movimentos(id) ON DELETE SET NULL,
      criado       BOOLEAN NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (conta, ref)
    );
    CREATE INDEX IF NOT EXISTS fin_banco_vistos_mov_idx ON fin_banco_vistos (movimento_id);
  `);
}

/* ---------------- autorizar ---------------- */
const estadosPendentes = new Map(); // state -> {aspsp, pais, criado}
function urlRetorno(req) {
  const base = process.env.EB_REDIRECT_URL || ('https://' + req.get('host') + '/api/financas/banco/retorno');
  return base;
}
async function validadeMaxima(aspsp, pais) {
  try {
    const r = await eb('GET', '/aspsps?country=' + encodeURIComponent(pais));
    const a = (r.aspsps || []).find((x) => x.name === aspsp);
    if (a && a.maximum_consent_validity) return Number(a.maximum_consent_validity);
  } catch (e) { console.warn('[farol] banco: validade maxima:', e.message); }
  return 90 * 24 * 3600;
}
function identificacaoDe(a) {
  const id = a.account_id || {};
  if (id.iban) return 'IBAN ' + id.iban;
  if (id.other && id.other.identification) return (id.other.scheme_name || 'ID') + ' ' + id.other.identification;
  if (a.identification_hash) return 'hash ' + String(a.identification_hash).slice(0, 12);
  return a.uid;
}
/* Sugestao de conta do Farol: pelo numero da conta (IBAN) ou pelos ultimos 4
   algarismos do cartao, procurados no nome, nota e identificadores. */
async function sugerirConta(ident) {
  const contas = await all("SELECT id, nome, tipo, COALESCE(nota,'') AS nota, COALESCE(identificadores,'') AS ids FROM fin_contas WHERE tipo <> 'splitwise'");
  const digitos = String(ident).replace(/\D/g, '');
  const candidatos = [];
  if (/^IBAN/.test(ident) && digitos.length >= 21) candidatos.push(digitos.slice(-13, -2)); // numero de conta CA (11 algarismos)
  if (/CPAN|PAN/i.test(ident)) candidatos.push(digitos.slice(-4));
  for (const c of contas) {
    const t = (c.nome + ' ' + c.nota + ' ' + c.ids).replace(/\s/g, '');
    if (candidatos.some((x) => x && t.includes(x))) return c.id;
  }
  return null;
}

/* ---------------- sincronizar ---------------- */
function dataDe(t) { return String(t.booking_date || t.value_date || t.transaction_date || '').slice(0, 10); }
function valorDe(t) {
  const a = Number((t.transaction_amount && t.transaction_amount.amount) || 0);
  const ind = String(t.credit_debit_indicator || '').toUpperCase();
  if (ind === 'DBIT') return -Math.abs(a);
  if (ind === 'CRDT') return Math.abs(a);
  return a;
}
function textoDe(t) {
  const partes = [];
  const ri = t.remittance_information;
  if (Array.isArray(ri)) partes.push(...ri); else if (ri) partes.push(ri);
  const ind = String(t.credit_debit_indicator || '').toUpperCase();
  const outro = ind === 'DBIT' ? t.creditor : t.debtor;
  if (outro && outro.name && !partes.join(' ').includes(outro.name)) partes.push(outro.name);
  if (!partes.length && t.bank_transaction_code && t.bank_transaction_code.description) partes.push(t.bank_transaction_code.description);
  return partes.map((x) => String(x).trim()).filter(Boolean).join(' · ').replace(/\s+/g, ' ').slice(0, 500) || 'Movimento';
}
function refDe(t) {
  return String(t.entry_reference || t.transaction_id || '') ||
    'h' + crypto.createHash('sha1').update(dataDe(t) + '|' + valorDe(t).toFixed(2) + '|' + textoDe(t)).digest('hex').slice(0, 20);
}
async function lerTransacoes(uid, desde) {
  const out = [];
  let chave = null, voltas = 0;
  do {
    const q = '?date_from=' + desde + (chave ? '&continuation_key=' + encodeURIComponent(chave) : '');
    const r = await eb('GET', '/accounts/' + encodeURIComponent(uid) + '/transactions' + q);
    (r.transactions || []).forEach((t) => out.push(t));
    chave = r.continuation_key || null;
  } while (chave && ++voltas < 30);
  return out;
}
function menosDias(iso, n) { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); }

async function sincronizarConta(bc) {
  const ultimo = (await all("SELECT to_char(max(data),'YYYY-MM-DD') AS d FROM fin_movimentos WHERE conta_id = $1", [bc.conta_id]))[0].d;
  const hoje = new Date().toISOString().slice(0, 10);
  const desde = ultimo ? menosDias(ultimo, 7) : menosDias(hoje, 30);
  const txs = (await lerTransacoes(bc.uid, desde))
    .filter((t) => !t.status || String(t.status).toUpperCase() === 'BOOK')
    .filter((t) => dataDe(t));
  txs.sort((a, b) => dataDe(a).localeCompare(dataDe(b)));
  const novos = [], ligados = [];
  for (const t of txs) {
    const ref = refDe(t);
    const ja = await all('SELECT 1 FROM fin_banco_vistos WHERE conta = $1 AND ref = $2', [bc.identificacao, ref]);
    if (ja.length) continue;
    const data = dataDe(t), valor = cent(valorDe(t));
    /* Ja esta no Farol (de um extrato)? Mesmo valor, data a menos de 3 dias,
       ainda sem par da API. O mais proximo na data ganha. */
    const par = (await all(
      `SELECT m.id FROM fin_movimentos m
        WHERE m.conta_id = $1 AND m.valor = $2 AND m.data BETWEEN $3::date - 3 AND $3::date + 3
          AND NOT EXISTS (SELECT 1 FROM fin_banco_vistos v WHERE v.movimento_id = m.id)
        ORDER BY abs(m.data - $3::date), m.id LIMIT 1`, [bc.conta_id, valor, data]))[0];
    if (par) {
      await query('INSERT INTO fin_banco_vistos (conta, ref, movimento_id, criado) VALUES ($1,$2,$3,FALSE) ON CONFLICT DO NOTHING', [bc.identificacao, ref, par.id]);
      ligados.push(par.id);
      continue;
    }
    const saldo = t.balance_after_transaction && t.balance_after_transaction.amount != null ? cent(t.balance_after_transaction.amount) : null;
    const r = await all(
      `INSERT INTO fin_movimentos (conta_id, data, descricao, valor, saldo, impressao, origem)
       VALUES ($1,$2,$3,$4,$5,$6,'import') ON CONFLICT (conta_id, impressao) DO NOTHING RETURNING id`,
      [bc.conta_id, data, textoDe(t), valor, saldo, 'eb:' + ref]);
    const id = r.length ? r[0].id : null;
    await query('INSERT INTO fin_banco_vistos (conta, ref, movimento_id, criado) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [bc.identificacao, ref, id, Boolean(id)]);
    if (id) novos.push(id);
  }
  /* Saldo do banco, para comparar com o do Farol. */
  let saldoBanco = null;
  try {
    const b = await eb('GET', '/accounts/' + encodeURIComponent(bc.uid) + '/balances');
    const lista = b.balances || [];
    const pref = ['CLBD', 'ITAV', 'XPCD', 'ITBD', 'CLAV', 'OPBD'];
    lista.sort((x, y) => (pref.indexOf(x.balance_type) + 99) % 99 - (pref.indexOf(y.balance_type) + 99) % 99);
    if (lista[0] && lista[0].balance_amount) saldoBanco = cent(lista[0].balance_amount.amount);
  } catch (e) { console.warn('[farol] banco: saldo', bc.uid, e.message); }
  await query('UPDATE fin_banco_contas SET sincronizado_em = now(), ultimo_erro = NULL, saldo_banco = COALESCE($2, saldo_banco), saldo_em = CASE WHEN $2::numeric IS NULL THEN saldo_em ELSE now() END WHERE uid = $1', [bc.uid, saldoBanco]);
  return { lidos: txs.length, novos: novos.length, ligados: ligados.length, ids: novos, desde, saldo_banco: saldoBanco };
}

let aCorrer = null;
async function sincronizar(origem) {
  if (aCorrer) return aCorrer;
  aCorrer = (async () => {
    const res = { origem: origem || 'manual', inicio: new Date().toISOString(), contas: [] };
    if (!configurado()) { res.erro = 'sem credenciais'; return res; }
    const contas = await all(
      `SELECT c.uid, c.conta_id, c.identificacao, f.nome AS conta_nome, l.valido_ate, l.estado
         FROM fin_banco_contas c JOIN fin_banco_ligacoes l ON l.id = c.ligacao_id
         LEFT JOIN fin_contas f ON f.id = c.conta_id
        WHERE c.conta_id IS NOT NULL AND l.estado = 'ativa'`);
    const todos = [];
    for (const bc of contas) {
      if (bc.valido_ate && new Date(bc.valido_ate) < new Date()) {
        res.contas.push({ conta: bc.conta_nome, erro: 'autorização expirada' });
        continue;
      }
      try {
        const r = await sincronizarConta(bc);
        todos.push(...r.ids);
        res.contas.push({ conta: bc.conta_nome, conta_id: bc.conta_id, lidos: r.lidos, novos: r.novos, ligados: r.ligados, saldo_banco: r.saldo_banco });
      } catch (e) {
        await query('UPDATE fin_banco_contas SET ultimo_erro = $2 WHERE uid = $1', [bc.uid, String(e.message).slice(0, 500)]);
        res.contas.push({ conta: bc.conta_nome, erro: e.message });
      }
    }
    res.novos = todos.length;
    if (todos.length && financas) {
      financas.categorizar(todos)
        .then(async () => { if (financas.ligarIdentificadores) await financas.ligarIdentificadores(await financas.base()); })
        .catch((e) => console.error('[farol] banco: categorizar:', e.message));
    }
    res.fim = new Date().toISOString();
    await query(`INSERT INTO settings (key, value) VALUES ('fin_banco_ultima', $1)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(res)]);
    console.log('[farol] banco: sincronizado (' + res.origem + '):', res.novos, 'novo(s)');
    return res;
  })();
  try { return await aCorrer; } finally { aCorrer = null; }
}

/* De manha (8h05) e a noite (21h05), hora de Lisboa. */
const HORAS = [[8, 5], [21, 5]];
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
    try { await sincronizar('agendada'); } catch (e) { console.error('[farol] banco (agendada):', e.message); }
    agendar();
  }, msAteProxima());
}
async function arrancar() {
  try { await preparar(); } catch (e) { console.error('[farol] banco: tabelas:', e.message); return; }
  agendar();
  /* Se o servidor esteve parado na hora marcada, apanha-se no arranque. */
  setTimeout(async () => {
    try {
      const u = (await all("SELECT value FROM settings WHERE key = 'fin_banco_ultima'"))[0];
      const fim = u ? new Date(JSON.parse(u.value).fim || 0).getTime() : 0;
      if (configurado() && Date.now() - fim > 14 * 3600 * 1000) await sincronizar('arranque');
    } catch (e) { console.error('[farol] banco (arranque):', e.message); }
  }, 2 * 60 * 1000);
}

/* ---------------- estado ---------------- */
async function estado() {
  const ligacoes = await all("SELECT id, aspsp, pais, valido_ate, estado, created_at FROM fin_banco_ligacoes ORDER BY id DESC");
  const contas = await all(
    `SELECT c.uid, c.ligacao_id, c.conta_id, c.identificacao, c.nome, c.saldo_banco, c.saldo_em, c.sincronizado_em, c.ultimo_erro, f.nome AS conta_nome
       FROM fin_banco_contas c LEFT JOIN fin_contas f ON f.id = c.conta_id ORDER BY c.ligacao_id DESC, c.identificacao`);
  let saldos = {};
  if (financas) {
    try { (await financas.base()).contas.forEach((c) => { saldos[c.id] = c.saldo; }); } catch (e) { saldos = {}; }
  }
  contas.forEach((c) => { c.saldo_farol = c.conta_id != null && saldos[c.conta_id] != null ? cent(saldos[c.conta_id]) : null; });
  const u = (await all("SELECT value FROM settings WHERE key = 'fin_banco_ultima'"))[0];
  const farolContas = await all("SELECT id, nome, tipo FROM fin_contas WHERE tipo <> 'splitwise' ORDER BY ativo DESC, sort, nome");
  return { configurado: configurado(), app_id: appId() ? appId().slice(0, 8) + '…' : null, ligacoes, contas, ultima: u ? JSON.parse(u.value) : null, farol_contas: farolContas };
}

/* ---------------- rotas ---------------- */
function instalar(app, deps) {
  financas = (deps && deps.financas) || null;

  app.get('/api/financas/banco', async (_req, res) => {
    try { res.json(await estado()); } catch (e) { falha(res, e, 'ler a ligação ao banco'); }
  });

  /* Lista de bancos de um pais (para escolher qual ligar). */
  app.get('/api/financas/banco/bancos', async (req, res) => {
    try {
      const r = await eb('GET', '/aspsps?country=' + encodeURIComponent(String(req.query.pais || 'PT')));
      res.json((r.aspsps || []).map((a) => ({ nome: a.name, pais: a.country, validade_dias: a.maximum_consent_validity ? Math.round(a.maximum_consent_validity / 86400) : null, tipos: a.psu_types })));
    } catch (e) { falha(res, e, 'ler os bancos'); }
  });

  app.post('/api/financas/banco/ligar', async (req, res) => {
    try {
      const b = req.body || {};
      const aspsp = String(b.banco || 'Crédito Agrícola'), pais = String(b.pais || 'PT');
      const segs = await validadeMaxima(aspsp, pais);
      const ate = new Date(Date.now() + Math.max(3600, segs - 3600) * 1000).toISOString();
      const state = crypto.randomUUID();
      estadosPendentes.set(state, { aspsp, pais, criado: Date.now() });
      const r = await eb('POST', '/auth', {
        access: { valid_until: ate },
        aspsp: { name: aspsp, country: pais },
        state, redirect_url: urlRetorno(req), psu_type: 'personal'
      });
      res.json({ url: r.url, valido_ate: ate });
    } catch (e) { falha(res, e, 'começar a ligação ao banco'); }
  });

  app.get('/api/financas/banco/retorno', async (req, res) => {
    const volta = (q) => res.redirect('/banco.html?' + q);
    try {
      if (req.query.error) return volta('erro=' + encodeURIComponent(String(req.query.error_description || req.query.error)));
      const code = String(req.query.code || '');
      const pend = estadosPendentes.get(String(req.query.state || ''));
      if (!code) return volta('erro=' + encodeURIComponent('O banco não devolveu o código de autorização.'));
      estadosPendentes.delete(String(req.query.state || ''));
      const s = await eb('POST', '/sessions', { code });
      const ate = (s.access && s.access.valid_until) || null;
      const lig = (await all('INSERT INTO fin_banco_ligacoes (aspsp, pais, session_id, valido_ate) VALUES ($1,$2,$3,$4) RETURNING id',
        [(s.aspsp && s.aspsp.name) || (pend && pend.aspsp) || 'Banco', (s.aspsp && s.aspsp.country) || (pend && pend.pais) || 'PT', s.session_id || null, ate]))[0];
      for (const a of (s.accounts || [])) {
        const uid = a.uid || a;
        const ident = identificacaoDe(a);
        /* Uma conta que ja estava ligada (de uma autorizacao anterior) mantem
           a conta do Farol; so muda a ligacao, que e a nova. */
        const antes = (await all('SELECT conta_id FROM fin_banco_contas WHERE identificacao = $1 AND conta_id IS NOT NULL ORDER BY created_at DESC LIMIT 1', [ident]))[0];
        const conta = antes ? antes.conta_id : await sugerirConta(ident);
        await query(
          `INSERT INTO fin_banco_contas (uid, ligacao_id, conta_id, identificacao, nome) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (uid) DO UPDATE SET ligacao_id = EXCLUDED.ligacao_id, identificacao = EXCLUDED.identificacao, nome = EXCLUDED.nome`,
          [uid, lig.id, conta, ident, a.name || a.product || (a.details || null)]);
      }
      /* Ligacoes anteriores ao mesmo banco ficam substituidas: os uids
         antigos deixam de servir. */
      await query("UPDATE fin_banco_ligacoes SET estado = 'substituida' WHERE id <> $1 AND aspsp = (SELECT aspsp FROM fin_banco_ligacoes WHERE id = $1) AND estado = 'ativa'", [lig.id]);
      volta('ok=' + (s.accounts || []).length);
    } catch (e) {
      console.error('[farol] banco retorno:', e.message);
      volta('erro=' + encodeURIComponent(e.message));
    }
  });

  app.patch('/api/financas/banco/contas/:uid', async (req, res) => {
    try {
      const b = req.body || {};
      const conta = b.conta_id === '' || b.conta_id == null ? null : Number(b.conta_id);
      const r = await all('UPDATE fin_banco_contas SET conta_id = $2 WHERE uid = $1 RETURNING uid', [req.params.uid, conta]);
      if (!r.length) throw erro(404, 'Conta do banco não encontrada.');
      res.json(await estado());
    } catch (e) { falha(res, e, 'gravar a conta'); }
  });

  /* O que a API devolve, tal e qual (para conferir datas e textos). */
  app.get('/api/financas/banco/contas/:uid/bruto', async (req, res) => {
    try {
      const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.desde || '')) ? String(req.query.desde) : menosDias(new Date().toISOString().slice(0, 10), 30);
      res.json({ transacoes: await lerTransacoes(req.params.uid, desde) });
    } catch (e) { falha(res, e, 'ler as transações do banco'); }
  });

  app.post('/api/financas/banco/sincronizar', async (_req, res) => {
    try { res.json(await sincronizar('manual')); } catch (e) { falha(res, e, 'ler o banco'); }
  });
}

module.exports = { instalar, arrancar, sincronizar, configurado, _teste: { jwt, valorDe, textoDe, refDe, dataDe, identificacaoDe, chavePrivada } };
