'use strict';
/**
 * Farol - Financas e Patrimonio.
 *
 * Financas e o filme: o que entrou e saiu de cada conta (o extrato do banco),
 * em que categoria, contra que orcamento, e como evolui. Patrimonio e a
 * fotografia: quanto ha em cada conta, os bens, as dividas e o que os outros
 * devem.
 *
 * O movimento do banco e a fonte da verdade do dinheiro. As despesas que ja
 * existiam no Farol (recibos da caixa, pagamentos dados por pagos) ligam-se a
 * ele - a reconciliacao - e passam a ter prova; nao se somam duas vezes.
 *
 * Uma conta dividida (o jantar pago pelo Marco, os amigos devolvem a parte
 * deles) reparte o movimento: so a parte do Marco conta como despesa; a dos
 * outros e dinheiro adiantado, na conta corrente de cada um, e o reembolso que
 * chega depois tambem nao e receita. Um movimento ligado a uma conta corrente
 * e um acerto: nem gasto nem rendimento.
 *
 * A IA so sugere. Categorizar faz-se em tres passos: as regras (aplicam-se
 * sozinhas, foram escritas pelo Marco), o historico (o mesmo comerciante ja
 * teve categoria) e o Gemini (le a descricao, o valor e a conta). As duas
 * ultimas ficam como sugestao ate alguem aceitar.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { query } = require('./db');
const imp = require('./financas-import');
const cc = require('./financas-cc');

const all = async (sql, params) => (await query(sql, params)).rows;
const cent = (v) => Math.round(Number(v || 0) * 100) / 100;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const CHAVE = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const MODELO = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

function erro(codigo, msg) { const e = new Error(msg); e.status = codigo; return e; }
function falha(res, err, onde) {
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  console.error('[farol] financas ' + onde + ':', err && err.message);
  return res.status(500).json({ error: 'Não foi possível ' + (onde ? 'tratar ' + onde : 'fazer isto') + '.' });
}

/* ---------------- arranque ---------------- */
async function preparar() {
  try {
    await query(fs.readFileSync(path.join(__dirname, '..', 'db', 'financas.sql'), 'utf8'));
    await query('ALTER TABLE fin_movimentos ADD COLUMN IF NOT EXISTS categoria_em TIMESTAMPTZ');
    console.log('[farol] financas: tabelas prontas.');
    /* O dinheiro que uma pessoa manda nao e uma venda: as sugestoes do modelo
       para essas entradas saem (ficam para a sugestao de conta dividida). */
    const velhas = await all(`SELECT id, descricao FROM fin_movimentos WHERE categoria_id IS NULL AND ia_fonte = 'modelo' AND valor > 0 AND valor <= 300`);
    const limpar = velhas.filter((m) => cc.pagador(m.descricao)).map((m) => m.id);
    if (limpar.length) await query('UPDATE fin_movimentos SET ia_categoria_id = NULL, ia_confianca = NULL, ia_fonte = NULL WHERE id = ANY($1::int[])', [limpar]);
    cc.arrancar();
  } catch (e) {
    console.error('[farol] financas: as tabelas nao subiram:', e.message);
  }
}

/* ---------------- texto ---------------- */
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/\d{3,}/g, ' ').replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
/* A chave de um comerciante: a descricao sem numeros nem palavras de banco. */
const RUIDO = /\b(compra|pagamento|pag|trf|transf|transferencia|imediata|dd|debito|direto|mb|way|multibanco|cartao|pos|ref|lev|levantamento|em|de|da|do|a|o)\b/g;
function chave(s) {
  return norm(s).replace(RUIDO, ' ').replace(/\b\d+\b/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ');
}

/* ---------------- dados de base ---------------- */
async function base() {
  const [contas, cats, ctx] = await Promise.all([
    all('SELECT id, nome, tipo, instituicao, context_id, pessoal, saldo_inicial, saldo_inicial_em, ativo, sort, nota, (mapa IS NOT NULL) AS tem_mapa FROM fin_contas ORDER BY ativo DESC, sort, nome'),
    all('SELECT id, grupo, nome, natureza, fixa, context_id, ativo, sort FROM fin_categorias ORDER BY sort, grupo, nome'),
    all('SELECT id, name, parent_id FROM contexts')
  ]);
  const ctxPor = {}; ctx.forEach((c) => { ctxPor[c.id] = c; });
  const topo = (id) => { let c = ctxPor[id], n = 0; while (c && c.parent_id && n++ < 10) c = ctxPor[c.parent_id]; return c || null; };
  const catPor = {}; cats.forEach((c) => { catPor[c.id] = c; });
  const contaPor = {}; contas.forEach((c) => { contaPor[c.id] = c; });
  return { contas, cats, catPor, contaPor, ctx, ctxPor, topo };
}

/* Natureza de um movimento: a da categoria; sem categoria, o sinal decide.
   A parte de outra pessoa numa conta dividida e um acerto com uma conta
   corrente nao contam nem como gasto nem como rendimento. */
function natureza(m, B) {
  if (m._nat) return m._nat;
  if (m.cc_ligado) return 'acerto';
  const c = m.categoria_id ? B.catPor[m.categoria_id] : null;
  if (c) return c.natureza;
  return Number(m.valor) < 0 ? 'despesa' : 'receita';
}

/* Os movimentos de uma janela, com o filtro de ambito e de area. */
async function movimentosEntre(de, ate, f, B) {
  const ms = await all(
    `SELECT id, conta_id, to_char(data,'YYYY-MM-DD') AS data, descricao, valor, categoria_id, context_id, expense_id,
            EXISTS (SELECT 1 FROM fin_cc_mov c WHERE c.movimento_id = fin_movimentos.id) AS cc_ligado
       FROM fin_movimentos WHERE data BETWEEN $1 AND $2`, [de, ate]);
  const pts = await all(
    `SELECT p.movimento_id, p.valor, p.categoria_id, p.pessoa_id FROM fin_mov_partes p
       JOIN fin_movimentos m ON m.id = p.movimento_id WHERE m.data BETWEEN $1 AND $2 ORDER BY p.id`, [de, ate]);
  const partesDe = {};
  pts.forEach((p) => { (partesDe[p.movimento_id] = partesDe[p.movimento_id] || []).push(p); });
  const out = [];
  ms.filter((m) => passa(m, f, B)).forEach((m) => {
    m.valor = Number(m.valor);
    const ps = partesDe[m.id];
    if (!ps) { out.push(m); return; }
    /* Dividido: cada parte conta por si. */
    ps.forEach((p) => out.push(Object.assign({}, m, {
      valor: Number(p.valor), categoria_id: p.pessoa_id ? null : p.categoria_id,
      _nat: p.pessoa_id ? 'partilha' : null, cc_ligado: false
    })));
  });
  return out;
}
function passa(m, f, B) {
  const conta = B.contaPor[m.conta_id];
  if (!conta) return false;
  if (f.ambito === 'pessoal' && !conta.pessoal) return false;
  if (f.ambito === 'profissional' && conta.pessoal) return false;
  if (f.conta && f.conta.length && f.conta.indexOf(m.conta_id) < 0) return false;
  if (f.area) {
    const ctx = m.context_id || conta.context_id;
    if (!ctx) return false;
    let c = B.ctxPor[ctx], ok = false, n = 0;
    while (c && n++ < 10) { if (c.id === Number(f.area)) { ok = true; break; } c = B.ctxPor[c.parent_id]; }
    if (!ok) return false;
  }
  return true;
}

/* ---------------- datas ---------------- */
const hojeIso = () => new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 10);
function mesDe(iso) { return iso.slice(0, 7); }
function somaMes(ym, n) {
  const [a, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
function fimMes(ym) {
  const [a, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}
function mesesAte(ym, n) { const out = []; for (let i = n - 1; i >= 0; i--) out.push(somaMes(ym, -i)); return out; }

/* ---------------- saldos ---------------- */
/* As ancoras de uma conta: saldos escritos, o saldo inicial, e os saldos que
   vieram no proprio extrato. De um dia com varios movimentos com saldo, o
   saldo do fim do dia e aquele que fecha as contas: o primeiro movimento
   comecou no saldo da vespera e o ultimo acabou no do fim do dia. */
async function ancoras(contaId, conta) {
  const out = [];
  if (conta.saldo_inicial_em) out.push({ em: iso10(conta.saldo_inicial_em), saldo: Number(conta.saldo_inicial) });
  (await all("SELECT to_char(em,'YYYY-MM-DD') AS em, saldo FROM fin_saldos WHERE conta_id = $1", [contaId]))
    .forEach((s) => out.push({ em: s.em, saldo: Number(s.saldo) }));
  const ms = await all(
    `SELECT to_char(data,'YYYY-MM-DD') AS data, valor, saldo FROM fin_movimentos WHERE conta_id = $1 ORDER BY data`, [contaId]);
  const porDia = {};
  ms.forEach((m) => { (porDia[m.data] = porDia[m.data] || []).push({ v: Number(m.valor), s: m.saldo == null ? null : Number(m.saldo) }); });
  Object.keys(porDia).forEach((d) => {
    const l = porDia[d];
    const com = l.filter((x) => x.s !== null);
    if (!com.length || com.length !== l.length) return;
    const tot = l.reduce((s, x) => s + x.v, 0);
    for (const fim of com) {
      for (const ini of com) {
        if (Math.abs((fim.s) - (ini.s - ini.v) - tot) < 0.006) { out.push({ em: d, saldo: fim.s, extrato: true }); return; }
      }
    }
  });
  return { ancoras: out.sort((a, b) => a.em < b.em ? -1 : 1), movs: ms.map((m) => ({ data: m.data, valor: Number(m.valor) })) };
}
function iso10(d) { return d instanceof Date ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : String(d).slice(0, 10); }

function saldoEm(A, dia) {
  const ant = A.ancoras.filter((a) => a.em <= dia);
  if (ant.length) {
    const a = ant[ant.length - 1];
    return cent(a.saldo + A.movs.filter((m) => m.data > a.em && m.data <= dia).reduce((s, m) => s + m.valor, 0));
  }
  const dep = A.ancoras[0];
  if (dep) return cent(dep.saldo - A.movs.filter((m) => m.data > dia && m.data <= dep.em).reduce((s, m) => s + m.valor, 0));
  return cent(A.movs.filter((m) => m.data <= dia).reduce((s, m) => s + m.valor, 0));
}

async function saldosContas(B, dia) {
  const out = [];
  for (const c of B.contas) {
    const A = await ancoras(c.id, c);
    const ult = A.movs.length ? A.movs[A.movs.length - 1].data : null;
    const ultA = A.ancoras.length ? A.ancoras[A.ancoras.length - 1].em : null;
    const d30 = new Date(new Date(dia).getTime() - 30 * 86400000).toISOString().slice(0, 10);
    out.push(Object.assign({}, c, {
      saldo_inicial: Number(c.saldo_inicial),
      saldo: saldoEm(A, dia),
      var30: cent(A.movs.filter((m) => m.data > d30 && m.data <= dia).reduce((s, m) => s + m.valor, 0)),
      atualizado: [ult, ultA].filter(Boolean).sort().pop() || null,
      movimentos: A.movs.length,
      fonte: A.movs.length ? 'extrato' : 'à mão',
      _A: A
    }));
  }
  return out;
}

/* ---------------- categorizar ---------------- */
async function categorizar(ids, opcoes) {
  const o = opcoes || {};
  const B = await base();
  const filtro = ids && ids.length ? 'AND m.id = ANY($1::int[])' : '';
  const pend = await all(
    `SELECT m.id, m.conta_id, to_char(m.data,'YYYY-MM-DD') AS data, m.descricao, m.valor, m.ia_em,
            (m.ia_categoria_id IS NOT NULL) AS tem_sugestao
       FROM fin_movimentos m WHERE m.categoria_id IS NULL ${filtro}
      ORDER BY m.data DESC LIMIT 3000`, ids && ids.length ? [ids] : []);
  if (!pend.length) return { regra: 0, sugestoes: 0, modelo: 0 };

  /* 1. Regras: escritas pelo Marco, aplicam-se logo. */
  const regras = (await all('SELECT * FROM fin_regras WHERE ativo ORDER BY length(padrao) DESC')).map((r) => Object.assign(r, { n: norm(r.padrao) }));
  let nRegra = 0;
  const resto = [];
  for (const m of pend) {
    const d = norm(m.descricao), v = Math.abs(Number(m.valor));
    const r = regras.find((x) => x.n && d.indexOf(x.n) >= 0 &&
      (x.valor_min == null || v >= Number(x.valor_min) - 0.004) && (x.valor_max == null || v <= Number(x.valor_max) + 0.004) &&
      (!x.conta_id || x.conta_id === m.conta_id));
    if (r) {
      await query(`UPDATE fin_movimentos SET categoria_id = $1, categoria_fonte = 'regra', categoria_em = now(),
                     context_id = COALESCE($2, context_id) WHERE id = $3`, [r.categoria_id, r.context_id, m.id]);
      await query('UPDATE fin_regras SET usos = usos + 1 WHERE id = $1', [r.id]);
      nRegra++;
    } else if (o.refazer || !m.tem_sugestao) resto.push(m);
    /* As regras valem sempre (passam a frente de uma sugestao antiga); o
       resto so volta a ser sugerido quando ainda nao tinha sugestao ou
       quando se pede para refazer. */
  }

  /* 2a. Transferencias entre contas proprias: o mesmo valor ao contrario,
     noutra conta, ate tres dias de distancia. */
  const sug = {};
  const entreContas = B.cats.find((c) => c.natureza === 'transferencia' && /entre contas/i.test(c.nome));
  const pagCartao = B.cats.find((c) => c.natureza === 'transferencia' && /cart/i.test(c.nome));
  if (entreContas && resto.length) {
    const outros = await all(
      `SELECT id, conta_id, to_char(data,'YYYY-MM-DD') AS data, valor FROM fin_movimentos
        WHERE data BETWEEN $1::date - 4 AND $2::date + 4`,
      [resto.map((m) => m.data).sort()[0], resto.map((m) => m.data).sort().pop()]);
    for (const m of resto) {
      const par = outros.find((x) => x.conta_id !== m.conta_id && Math.abs(Number(x.valor) + Number(m.valor)) < 0.005 &&
        Math.abs(new Date(x.data) - new Date(m.data)) <= 3 * 86400000);
      if (par) {
        const cartao = [B.contaPor[m.conta_id], B.contaPor[par.conta_id]].some((c) => c && c.tipo === 'cartao');
        sug[m.id] = { cat: (cartao && pagCartao ? pagCartao : entreContas).id, conf: 0.9, fonte: 'transferencia' };
      }
    }
  }

  /* 2b. Historico: o mesmo comerciante, a mesma categoria (o sinal tambem
     conta: um reembolso da mesma loja nao e uma compra). */
  const hist = await all(
    `SELECT descricao, valor, categoria_id FROM fin_movimentos
      WHERE categoria_id IS NOT NULL AND categoria_fonte IS NOT NULL ORDER BY data DESC LIMIT 6000`);
  const porChave = {};
  hist.forEach((h) => {
    const k = chave(h.descricao) + (Number(h.valor) < 0 ? '|-' : '|+');
    if (!k || k.length < 4) return;
    const x = porChave[k] = porChave[k] || {};
    x[h.categoria_id] = (x[h.categoria_id] || 0) + 1;
  });
  for (const m of resto) {
    if (sug[m.id]) continue;
    const x = porChave[chave(m.descricao) + (Number(m.valor) < 0 ? '|-' : '|+')];
    if (!x) continue;
    const ord = Object.keys(x).sort((a, b) => x[b] - x[a]);
    const n = x[ord[0]], totalN = Object.values(x).reduce((s, v) => s + v, 0);
    sug[m.id] = { cat: Number(ord[0]), conf: Math.min(0.97, 0.7 + 0.06 * n) * (n / totalN), fonte: 'historico' };
  }

  /* 3. O modelo, para o que sobrou, aos lotes. */
  let nModelo = 0;
  /* Pequenas entradas de pessoas (MB Way, transferencias) nao vao ao modelo:
     sao quase sempre alguem a devolver dinheiro, e isso decide-se com a
     conta dividida, nao com uma categoria de receita. */
  const pessoalDe = (m) => !B.contaPor[m.conta_id] || B.contaPor[m.conta_id].pessoal;
  const paraModelo = resto.filter((m) => !sug[m.id] && !(pessoalDe(m) && Number(m.valor) > 0 && Number(m.valor) <= 300 && cc.pagador(m.descricao)));
  if (CHAVE && paraModelo.length && o.modelo !== false) {
    const lista = B.cats.filter((c) => c.ativo).map((c) => c.id + ': ' + c.grupo + ' › ' + c.nome + ' (' + c.natureza + ')').join('\n');
    for (let i = 0; i < paraModelo.length; i += 40) {
      const lote = paraModelo.slice(i, i + 40);
      try {
        const r = await perguntarModelo(lista, lote, B);
        r.forEach((x) => {
          const m = lote[x.n - 1];
          if (m && B.catPor[x.categoria_id]) { sug[m.id] = { cat: x.categoria_id, conf: Math.max(0, Math.min(1, Number(x.confianca) || 0.5)), fonte: 'modelo' }; nModelo++; }
        });
      } catch (e) {
        console.error('[farol] financas: o modelo nao categorizou:', e.message);
        break;
      }
    }
  }
  for (const id of Object.keys(sug)) {
    await query(`UPDATE fin_movimentos SET ia_categoria_id = $1, ia_confianca = $2, ia_fonte = $3, ia_em = now()
                  WHERE id = $4 AND categoria_id IS NULL`, [sug[id].cat, cent(sug[id].conf * 1000) / 1000, sug[id].fonte, Number(id)]);
  }
  return { regra: nRegra, sugestoes: Object.keys(sug).length, modelo: nModelo };
}

async function perguntarModelo(lista, lote, B) {
  const linhas = lote.map((m, i) => (i + 1) + ' | ' + m.data + ' | ' + m.descricao + ' | ' + Number(m.valor).toFixed(2) + ' € | conta: ' +
    ((B.contaPor[m.conta_id] || {}).nome || '') + ((B.contaPor[m.conta_id] || {}).tipo === 'cartao' ? ' (cartão de crédito)' : ''));
  const corpo = {
    model: MODELO, store: false,
    system_instruction: 'Categorizas movimentos bancarios de uma familia portuguesa. Para cada movimento escolhes UMA categoria da lista, pelo id. ' +
      'Valor negativo saiu da conta, positivo entrou. Uma compra num supermercado (Continente, Pingo Doce, Lidl, Auchan, Mercadona) e Supermercado; ' +
      'combustivel (Galp, BP, Repsol, Prio) e Combustivel; uma transferencia para a propria pessoa ou para poupanca e Transferencias. ' +
      'Se nao tens a certeza, escolhe a mais provavel e baixa a confianca (0 a 1). Nunca inventes ids.',
    input: [{ type: 'text', text: 'Categorias:\n' + lista + '\n\nMovimentos (n | data | descricao | valor | conta):\n' + linhas.join('\n') }],
    response_format: {
      type: 'text', mime_type: 'application/json',
      schema: { type: 'object', properties: { resultados: { type: 'array', items: { type: 'object',
        properties: { n: { type: 'integer' }, categoria_id: { type: 'integer' }, confianca: { type: 'number' } },
        required: ['n', 'categoria_id', 'confianca'] } } }, required: ['resultados'] }
    }
  };
  let ultimo;
  for (let t = 0; t < 3; t++) {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST', signal: AbortSignal.timeout(90000),
      headers: { 'content-type': 'application/json', 'x-goog-api-key': CHAVE }, body: JSON.stringify(corpo)
    });
    if (!r.ok) {
      ultimo = new Error('API ' + r.status);
      if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, 5000 * (t + 1))); continue; }
      throw ultimo;
    }
    const j = await r.json();
    let cru = '';
    (j.steps || []).forEach((p) => (p.content || []).forEach((c) => { if (c && c.type === 'text' && c.text) cru += c.text; }));
    if (!cru && typeof j.output_text === 'string') cru = j.output_text;
    return (JSON.parse(cru).resultados || []);
  }
  throw ultimo || new Error('sem resposta');
}

/* ---------------- importar ---------------- */
async function gravarLinhas(contaId, linhas, origem) {
  const vistas = {};
  const ids = [];
  let repetidos = 0;
  for (const l of linhas) {
    let impressao;
    if (l.fitid) impressao = 'ofx:' + l.fitid;
    else {
      const k = l.data + '|' + cent(l.valor).toFixed(2) + '|' + norm(l.descricao);
      vistas[k] = (vistas[k] || 0) + 1;
      impressao = crypto.createHash('sha1').update(k).digest('hex').slice(0, 20) + '#' + vistas[k];
    }
    const r = await all(
      `INSERT INTO fin_movimentos (conta_id, data, descricao, valor, saldo, impressao, origem)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (conta_id, impressao) DO NOTHING RETURNING id`,
      [contaId, l.data, l.descricao.slice(0, 500), cent(l.valor), l.saldo == null ? null : cent(l.saldo), impressao, origem]);
    if (r.length) ids.push(r[0].id); else repetidos++;
  }
  return { ids, repetidos };
}

/* ---------------- reconciliar ---------------- */
async function candidatos(m) {
  const v = Math.abs(Number(m.valor));
  const rs = await all(
    `SELECT e.id, e.description, e.amount, to_char(e.spent_on,'YYYY-MM-DD') AS spent_on, e.merchant, e.context_id,
            (e.spent_on - $2::date) AS dias,
            EXISTS (SELECT 1 FROM tasks t WHERE t.expense_id = e.id) AS de_pagamento,
            (e.document_id IS NOT NULL) AS tem_papel
       FROM expenses e
      WHERE abs(e.amount - $1) < 0.006 AND e.spent_on BETWEEN $2::date - 12 AND $2::date + 6
        AND NOT EXISTS (SELECT 1 FROM fin_movimentos x WHERE x.expense_id = e.id AND x.id <> $3)
      ORDER BY abs(e.spent_on - $2::date) LIMIT 5`, [v, m.data, m.id]);
  return rs.map((e) => Object.assign(e, { amount: Number(e.amount), confianca: cent(Math.max(0.4, 0.99 - 0.04 * Math.abs(e.dias))) }));
}

/* ---------------- tendencias ---------------- */
async function alertasConfig() {
  const r = (await all("SELECT value FROM settings WHERE key = 'fin_alertas'"))[0];
  const def = { limiar: 25, subscricoes: true, duplicados: true, orcamento: 90, saldo: true, ativo: true };
  try { return Object.assign(def, r ? JSON.parse(r.value) : {}); } catch (e) { return def; }
}

/* Debitos que se repetem todos os meses com o mesmo valor (mais ou menos
   10%): subscricoes e contas fixas. */
function recorrentes(ms, ymFim) {
  const meses = mesesAte(ymFim, 6);
  const grupos = {};
  ms.filter((m) => m.valor < 0).forEach((m) => {
    const k = chave(m.descricao);
    if (!k || k.length < 3) return;
    (grupos[k] = grupos[k] || []).push(m);
  });
  const out = [];
  Object.keys(grupos).forEach((k) => {
    const l = grupos[k];
    const porMes = {};
    l.forEach((m) => { const ym = mesDe(m.data); if (meses.indexOf(ym) >= 0) porMes[ym] = (porMes[ym] || 0) + (-m.valor); });
    const ms2 = Object.keys(porMes).sort();
    if (ms2.length < 3) return;
    const ult = ms2.slice(-3).map((x) => porMes[x]);
    const media = ult.reduce((s, v) => s + v, 0) / ult.length;
    if (!ult.every((v) => Math.abs(v - media) <= Math.max(1, media * 0.1))) return;
    const consecutivos = ms2.slice(-3).every((x, i, a) => i === 0 || somaMes(a[i - 1], 1) === x);
    if (!consecutivos) return;
    const primeiro = l.map((m) => m.data).sort()[0];
    out.push({ chave: k, descricao: l[l.length - 1].descricao, mensal: cent(media), desde: primeiro,
      nova: primeiro >= somaMes(ymFim, -3) + '-01', categoria_id: l[l.length - 1].categoria_id || null });
  });
  return out.sort((a, b) => b.mensal - a.mensal);
}

/* ---------------- orcamentos ---------------- */
async function orcamentos(ym, f, B, msPre) {
  const os = await all(
    `SELECT o.id, o.categoria_id, o.mensal, o.acumula, to_char(o.desde,'YYYY-MM') AS desde, o.ativo
       FROM fin_orcamentos o WHERE o.ativo`);
  const ini = somaMes(ym, -23) + '-01';
  const ms = msPre || await movimentosEntre(ini, fimMes(ym), f, B);
  const gastoPor = {};
  ms.forEach((m) => {
    if (!m.categoria_id) return;
    const k = m.categoria_id + '|' + mesDe(m.data);
    gastoPor[k] = (gastoPor[k] || 0) - m.valor;
  });
  const g = (cat, mes) => cent(gastoPor[cat + '|' + mes] || 0);
  const ano = ym.slice(0, 4);
  const linhas = os.map((o) => {
    const c = B.catPor[o.categoria_id] || {};
    const mensal = Number(o.mensal);
    let acumulado = 0;
    if (o.acumula) {
      for (let x = o.desde; x < ym; x = somaMes(x, 1)) acumulado += mensal - g(o.categoria_id, x);
    }
    const gasto = g(o.categoria_id, ym);
    const mesesAno = [];
    for (let x = (o.desde > ano + '-01' ? o.desde : ano + '-01'); x <= ym; x = somaMes(x, 1)) mesesAno.push(x);
    const serie = mesesAte(ym, 12).map((x) => g(o.categoria_id, x));
    const media6 = cent(mesesAte(somaMes(ym, -1), 6).reduce((s, x) => s + g(o.categoria_id, x), 0) / 6);
    return {
      id: o.id, categoria_id: o.categoria_id, grupo: c.grupo, nome: c.nome, natureza: c.natureza, fixa: c.fixa,
      mensal, acumula: o.acumula, gasto, acumulado: cent(acumulado), disponivel: cent(mensal + acumulado - gasto),
      pct: mensal ? Math.round(gasto / mensal * 100) : 0,
      ano_gasto: cent(mesesAno.reduce((s, x) => s + g(o.categoria_id, x), 0)), ano_orcado: cent(mensal * mesesAno.length),
      serie, media6
    };
  });
  const comOrc = {}; os.forEach((o) => { comOrc[o.categoria_id] = true; });
  const semOrc = {};
  ms.filter((m) => mesDe(m.data) === ym && m.valor < 0 && natureza(m, B) === 'despesa' && !comOrc[m.categoria_id])
    .forEach((m) => { const k = m.categoria_id || 0; semOrc[k] = (semOrc[k] || 0) - m.valor; });
  const sem = Object.keys(semOrc).map((k) => {
    const c = B.catPor[k];
    const media6 = c ? cent(mesesAte(somaMes(ym, -1), 6).reduce((s, x) => s + g(c.id, x), 0) / 6) : 0;
    return { categoria_id: c ? c.id : null, nome: c ? c.grupo + ' › ' + c.nome : 'Sem categoria', gasto: cent(semOrc[k]), media6 };
  }).sort((a, b) => b.gasto - a.gasto);
  return { linhas, sem };
}

/* ---------------- resumo ---------------- */
async function resumo(ym, f) {
  const B = await base();
  const cfg = await alertasConfig();
  const ini = somaMes(ym, -23) + '-01';
  const ms = await movimentosEntre(ini, fimMes(ym), f, B);
  const porMes = {};
  ms.forEach((m) => {
    const k = mesDe(m.data); const x = porMes[k] = porMes[k] || { entradas: 0, despesas: 0 };
    const nat = natureza(m, B);
    if (nat === 'receita') x.entradas += m.valor;
    else if (nat === 'despesa') x.despesas += -m.valor;
  });
  const mesV = (k) => porMes[k] || { entradas: 0, despesas: 0 };
  const serie = mesesAte(ym, 12).map((k) => ({ mes: k, entradas: cent(mesV(k).entradas), despesas: cent(mesV(k).despesas) }));
  const ant12 = mesesAte(somaMes(ym, -1), 12).filter((k) => porMes[k]);
  const media = (campo) => ant12.length ? cent(ant12.reduce((s, k) => s + mesV(k)[campo], 0) / ant12.length) : null;
  const cur = mesV(ym);

  const doMes = ms.filter((m) => mesDe(m.data) === ym);
  const grupos = {};
  doMes.forEach((m) => {
    if (natureza(m, B) !== 'despesa') return;
    const c = B.catPor[m.categoria_id];
    const g = c ? c.grupo : 'Por categorizar';
    grupos[g] = (grupos[g] || 0) - m.valor;
  });
  const media6Grupo = (g) => cent(mesesAte(somaMes(ym, -1), 6).reduce((s, k) => s + ms.filter((m) => mesDe(m.data) === k && natureza(m, B) === 'despesa' &&
    ((B.catPor[m.categoria_id] || {}).grupo || 'Por categorizar') === g).reduce((t, m) => t - m.valor, 0), 0) / 6);
  const categorias = Object.keys(grupos).map((g) => ({ grupo: g, valor: cent(grupos[g]), media6: media6Grupo(g) })).sort((a, b) => b.valor - a.valor);

  const O = await orcamentos(ym, f, B, ms);
  const orcDesp = O.linhas.filter((l) => l.natureza === 'despesa');
  const orcado = cent(orcDesp.reduce((s, l) => s + l.mensal, 0)), gastoOrc = cent(orcDesp.reduce((s, l) => s + Math.max(0, l.gasto), 0));

  /* Tendencias. */
  const tend = [];
  if (cfg.ativo) {
    const porCat = {};
    ms.forEach((m) => { if (m.categoria_id && natureza(m, B) === 'despesa') { const k = m.categoria_id + '|' + mesDe(m.data); porCat[k] = (porCat[k] || 0) - m.valor; } });
    B.cats.filter((c) => c.natureza === 'despesa').forEach((c) => {
      const agora = porCat[c.id + '|' + ym] || 0;
      const ant = mesesAte(somaMes(ym, -1), 6).map((k) => porCat[c.id + '|' + k] || 0);
      const comDados = ant.filter((v) => v > 0).length;
      const med = ant.reduce((s, v) => s + v, 0) / 6;
      if (comDados >= 3 && med >= 25 && agora > med * (1 + cfg.limiar / 100)) {
        tend.push({ tipo: 'sobe', nivel: 'warn', titulo: c.nome + ' +' + Math.round((agora / med - 1) * 100) + '%',
          texto: fmt(agora) + ' este mês contra ' + fmt(med) + ' de média nos últimos 6 meses.', categoria_id: c.id });
      }
    });
    O.linhas.filter((l) => l.natureza === 'despesa').forEach((l) => {
      /* Uma renda a 100% esta certa; passar e que e noticia. Os custos fixos
         nao avisam a meio caminho: chegam todos de uma vez. */
      if (l.gasto > l.mensal + 0.005) tend.push({ tipo: 'orcamento', nivel: 'bad', titulo: l.nome + ' passou o orçamento', texto: fmt(l.gasto) + ' de ' + fmt(l.mensal) + ' (' + l.pct + '%).', categoria_id: l.categoria_id });
      else if (!l.fixa && l.pct >= cfg.orcamento && l.pct < 100) tend.push({ tipo: 'orcamento', nivel: 'warn', titulo: l.nome + ' a ' + l.pct + '%', texto: 'Ficam ' + fmt(l.disponivel) + ' para o resto do mês.', categoria_id: l.categoria_id });
      if (l.media6 > 0 && l.media6 < l.mensal * 0.7 && l.mensal - l.media6 >= 20) {
        const sug = Math.ceil(l.media6 * 1.1 / 5) * 5;
        tend.push({ tipo: 'orcado_a_mais', nivel: 'info', titulo: l.nome + ' orçado a mais', texto: 'Gasto real ' + fmt(l.media6) + '/mês; orçado ' + fmt(l.mensal) + '. Sugestão: ' + fmt(sug) + '.', orcamento_id: l.id, sugerido: sug });
      }
    });
    if (cfg.subscricoes) {
      recorrentes(ms, ym).filter((r) => r.nova).slice(0, 4).forEach((r) => tend.push({ tipo: 'subscricao', nivel: 'info',
        titulo: 'Débito novo todos os meses', texto: '«' + r.descricao + '» ' + fmt(r.mensal) + ' por mês desde ' + r.desde.slice(0, 7) + '.' }));
    }
  }

  const contagens = (await all(
    `SELECT COUNT(*) FILTER (WHERE categoria_id IS NULL) AS por_cat,
            COUNT(*) FILTER (WHERE categoria_id IS NULL AND ia_categoria_id IS NOT NULL) AS sugestoes
       FROM fin_movimentos`))[0];
  const primeiroMov = (await all("SELECT to_char(MIN(data),'YYYY-MM-DD') AS d FROM fin_movimentos"))[0].d;
  const semBanco = primeiroMov ? Number((await all(
    `SELECT COUNT(*) AS n FROM expenses e WHERE e.spent_on >= GREATEST($1::date, CURRENT_DATE - 90) AND e.aprovado
        AND NOT EXISTS (SELECT 1 FROM fin_movimentos m WHERE m.expense_id = e.id)`, [primeiroMov]))[0].n) : 0;
  const porReconciliar = Number((await all(
    `SELECT COUNT(DISTINCT m.id) AS n FROM fin_movimentos m JOIN expenses e
        ON abs(e.amount - abs(m.valor)) < 0.006 AND e.spent_on BETWEEN m.data - 12 AND m.data + 6
     WHERE m.expense_id IS NULL AND m.valor < 0 AND m.data >= CURRENT_DATE - 120
       AND NOT EXISTS (SELECT 1 FROM fin_movimentos x WHERE x.expense_id = e.id)`))[0].n);

  const saldos = await saldosContas(B, hojeIso());
  const liquidez = cent(saldos.filter((c) => c.ativo && c.pessoal && (c.tipo === 'ordem' || c.tipo === 'dinheiro')).reduce((s, c) => s + c.saldo, 0));

  const ano = ym.slice(0, 4);
  const ytd = Object.keys(porMes).filter((k) => k.startsWith(ano) && k <= ym).reduce((s, k) => s + porMes[k].despesas, 0);
  const nMeses = Number(ym.slice(5, 7));
  const poup12 = mesesAte(ym, 12).reduce((s, k) => s + mesV(k).entradas - mesV(k).despesas, 0);

  return {
    mes: ym, vazio: !B.contas.length, sem_movimentos: !ms.length && !primeiroMov,
    kpi: {
      entradas: cent(cur.entradas), despesas: cent(cur.despesas), poupado: cent(cur.entradas - cur.despesas),
      taxa: cur.entradas > 0 ? Math.round((cur.entradas - cur.despesas) / cur.entradas * 1000) / 10 : null,
      entradas_media: media('entradas'), despesas_media: media('despesas'),
      orcado, gasto_orcado: gastoOrc, orcamento_pct: orcado ? Math.round(gastoOrc / orcado * 100) : null,
      por_categorizar: Number(contagens.por_cat), sugestoes: Number(contagens.sugestoes),
      por_reconciliar: porReconciliar, despesas_sem_banco: semBanco
    },
    serie, ano: { despesas_ytd: cent(ytd), projecao: nMeses ? cent(ytd / nMeses * 12) : null, media: media('despesas'), poupanca12: cent(poup12) },
    categorias, orcamento: O.linhas.filter((l) => l.natureza === 'despesa').sort((a, b) => b.pct - a.pct).slice(0, 6),
    tendencias: tend.slice(0, 8), liquidez
  };
}
function fmt(v) { return Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

/* ---------------- analise ---------------- */
async function analise(ym, f) {
  const B = await base();
  const ini = somaMes(ym, -23) + '-01';
  const ms = await movimentosEntre(ini, fimMes(ym), f, B);
  const nat = (m) => natureza(m, B);
  const meses12 = mesesAte(ym, 12);
  const desp = (filtro) => ms.filter((m) => nat(m) === 'despesa' && filtro(m)).reduce((s, m) => s - m.valor, 0);
  const entr = (filtro) => ms.filter((m) => nat(m) === 'receita' && filtro(m)).reduce((s, m) => s + m.valor, 0);
  const em = (k) => (m) => mesDe(m.data) === k;
  const nos = (ks) => (m) => ks.indexOf(mesDe(m.data)) >= 0;
  const comDados = meses12.filter((k) => ms.some(em(k)));
  const n12 = Math.max(1, comDados.length);

  const despesa12 = desp(nos(meses12)), entradas12 = entr(nos(meses12));
  const ult3 = mesesAte(somaMes(ym, -1), 3).filter((k) => ms.some(em(k)));
  const fixo = ult3.length ? desp((m) => ult3.indexOf(mesDe(m.data)) >= 0 && (B.catPor[m.categoria_id] || {}).fixa) / ult3.length : 0;
  const despMedia = despesa12 / n12;

  const saldos = await saldosContas(B, hojeIso());
  const liquidez = saldos.filter((c) => c.ativo && c.pessoal && ['ordem', 'dinheiro', 'poupanca'].indexOf(c.tipo) >= 0).reduce((s, c) => s + c.saldo, 0);
  const bens = await all('SELECT * FROM fin_bens WHERE ativo AND pessoal');
  const prestacoes = bens.filter((b) => b.lado === 'passivo').reduce((s, b) => s + Number(b.prestacao || 0), 0);

  /* Por grupo, mes a mes: os quatro maiores e o resto. */
  const totGrupo = {};
  ms.filter((m) => nat(m) === 'despesa' && meses12.indexOf(mesDe(m.data)) >= 0).forEach((m) => {
    const g = (B.catPor[m.categoria_id] || {}).grupo || 'Por categorizar';
    totGrupo[g] = (totGrupo[g] || 0) - m.valor;
  });
  const top = Object.keys(totGrupo).sort((a, b) => totGrupo[b] - totGrupo[a]).slice(0, 4);
  const mensal = meses12.map((k) => {
    const x = { mes: k, grupos: {} };
    ms.filter((m) => em(k)(m) && nat(m) === 'despesa').forEach((m) => {
      let g = (B.catPor[m.categoria_id] || {}).grupo || 'Por categorizar';
      if (top.indexOf(g) < 0) g = 'Restantes';
      x.grupos[g] = cent((x.grupos[g] || 0) - m.valor);
    });
    return x;
  });

  /* Ano contra ano, acumulado. */
  const ano = Number(ym.slice(0, 4));
  const acumulado = (a) => {
    let s = 0; const out = [];
    for (let i = 1; i <= 12; i++) {
      const k = a + '-' + String(i).padStart(2, '0');
      if (a === ano && k > ym) break;
      s += desp(em(k)); out.push(cent(s));
    }
    return out;
  };
  const anterior = await movimentosEntre((ano - 1) + '-01-01', (ano - 1) + '-12-31', f, B);
  const acumAnt = []; { let s = 0; for (let i = 1; i <= 12; i++) { const k = (ano - 1) + '-' + String(i).padStart(2, '0'); s += anterior.filter((m) => mesDe(m.data) === k && nat(m) === 'despesa').reduce((t, m) => t - m.valor, 0); acumAnt.push(cent(s)); } }

  /* Tabela por grupo. */
  const gruposTodos = Object.keys(totGrupo);
  const ytdMeses = []; for (let i = 1; i <= Number(ym.slice(5, 7)); i++) ytdMeses.push(ano + '-' + String(i).padStart(2, '0'));
  const ytdAnt = ytdMeses.map((k) => (ano - 1) + k.slice(4));
  const tabela = gruposTodos.map((g) => {
    const deG = (m) => ((B.catPor[m.categoria_id] || {}).grupo || 'Por categorizar') === g;
    const porM = meses12.map((k) => desp((m) => em(k)(m) && deG(m)));
    const media12 = porM.reduce((s, v) => s + v, 0) / n12;
    const ytd = desp((m) => nos(ytdMeses)(m) && deG(m));
    const ytdA = anterior.filter((m) => nat(m) === 'despesa' && ytdAnt.indexOf(mesDe(m.data)) >= 0 && deG(m)).reduce((s, m) => s - m.valor, 0);
    /* Tendencia: declive da recta pelos ultimos 12 meses, em % da media. */
    const xs = porM.map((v, i) => i), mx = 5.5, my = porM.reduce((s, v) => s + v, 0) / 12;
    const decl = xs.reduce((s, x, i) => s + (x - mx) * (porM[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) * (x - mx), 0);
    const rel = my > 0 ? decl * 12 / my : 0;
    return { grupo: g, media12: cent(media12), mes: cent(porM[11]), ytd: cent(ytd), ytd_anterior: cent(ytdA),
      projecao: cent(ytd / ytdMeses.length * 12), tendencia: rel > 0.2 ? 'sobe' : rel < -0.2 ? 'desce' : 'estavel', serie: porM.map(cent) };
  }).sort((a, b) => b.media12 - a.media12);

  /* Por area de topo. */
  const areas = {};
  ms.filter((m) => nos(ytdMeses)(m)).forEach((m) => {
    const conta = B.contaPor[m.conta_id];
    const t = B.topo(m.context_id || conta.context_id);
    const k = t ? t.name : (conta.pessoal ? 'Pessoal sem área' : 'Empresas sem área');
    const x = areas[k] = areas[k] || { area: k, entradas: 0, saidas: 0, financiamento: 0 };
    const n = nat(m);
    if (n === 'receita') x.entradas += m.valor; else if (n === 'despesa') x.saidas += -m.valor; else if (n === 'financiamento') x.financiamento += m.valor;
  });

  const rec = recorrentes(ms, ym);
  return {
    mes: ym,
    kpi: {
      custo_fixo: cent(fixo), custo_variavel: cent(Math.max(0, despMedia - fixo)), fixo_pct: despMedia ? Math.round(fixo / despMedia * 100) : null,
      taxa_poupanca: entradas12 > 0 ? Math.round((entradas12 - despesa12) / entradas12 * 1000) / 10 : null,
      reserva_meses: despMedia > 0 ? Math.round(liquidez / despMedia * 10) / 10 : null,
      divida_rendimento: entradas12 > 0 ? Math.round(prestacoes / (entradas12 / n12) * 1000) / 10 : null,
      despesa_dia: cent(despesa12 / (n12 * 30.4)), despesa_media: cent(despMedia)
    },
    grupos: top.concat(Object.keys(totGrupo).length > 4 ? ['Restantes'] : []), mensal,
    anual: { atual: acumulado(ano), anterior: acumAnt, ano },
    tabela,
    areas: Object.values(areas).map((x) => ({ area: x.area, entradas: cent(x.entradas), saidas: cent(x.saidas), financiamento: cent(x.financiamento), resultado: cent(x.entradas - x.saidas) })).sort((a, b) => (b.entradas + b.saidas) - (a.entradas + a.saidas)),
    recorrentes: rec, recorrentes_ano: cent(rec.reduce((s, r) => s + r.mensal, 0) * 12)
  };
}

/* ---------------- patrimonio ---------------- */
async function patrimonio(empresas) {
  const B = await base();
  const hoje = hojeIso();
  const contas = (await saldosContas(B, hoje)).filter((c) => c.ativo);
  const bens = (await all('SELECT id, nome, lado, classe, valor, to_char(valor_em,\'YYYY-MM-DD\') AS valor_em, prestacao, to_char(termina,\'YYYY-MM-DD\') AS termina, context_id, pessoal, nota FROM fin_bens WHERE ativo ORDER BY lado, nome'))
    .map((b) => Object.assign(b, { valor: b.valor == null ? null : cent(b.valor), prestacao: b.prestacao == null ? null : cent(b.prestacao) }));
  const C = await cc.resumo();
  const conta = (c) => empresas || c.pessoal;
  const classe = (t) => ({ ordem: 'liquidez', dinheiro: 'liquidez', poupanca: 'investimentos', investimento: 'investimentos', cartao: 'cartoes', empresa: 'empresas', outra: 'outras' })[t] || 'outras';

  const comp = { liquidez: 0, investimentos: 0, bens: 0, a_receber: 0 };
  const passivo = { cartoes: 0, dividas: 0, a_pagar: 0 };
  contas.filter(conta).forEach((c) => {
    const k = classe(c.tipo);
    if (k === 'cartoes') { if (c.saldo < 0) passivo.cartoes += c.saldo; else comp.liquidez += c.saldo; }
    else if (k === 'investimentos') comp.investimentos += c.saldo;
    else if (c.saldo < 0) passivo.dividas += c.saldo;
    else comp.liquidez += c.saldo;
  });
  bens.filter((b) => (empresas || b.pessoal) && b.valor != null).forEach((b) => {
    if (b.lado === 'passivo') passivo.dividas -= Math.abs(b.valor); else comp.bens += b.valor;
  });
  comp.a_receber = C.a_receber; passivo.a_pagar = C.a_pagar;
  const ativo = cent(comp.liquidez + comp.investimentos + comp.bens + comp.a_receber);
  const pass = cent(passivo.cartoes + passivo.dividas + passivo.a_pagar);

  /* A evolucao: o saldo de cada conta no fim de cada mes, os bens desde que
     tem valor, e as contas correntes. */
  const ym = mesDe(hoje);
  const meses = mesesAte(ym, 24);
  const serie = [];
  for (const k of meses) {
    const dia = k === ym ? hoje : fimMes(k);
    let v = 0;
    contas.filter(conta).forEach((c) => { v += saldoEm(c._A, dia); });
    bens.filter((b) => (empresas || b.pessoal) && b.valor != null && (!b.valor_em || b.valor_em <= dia || b.lado === 'passivo'))
      .forEach((b) => {
        if (b.lado !== 'passivo') { v += b.valor; return; }
        /* Uma divida com prestacao era maior para tras: uma prestacao por
           cada mes antes do dia em que se escreveu o valor. */
        const ref = b.valor_em || hoje;
        const meses = dia < ref ? Math.max(0, (Number(ref.slice(0, 4)) - Number(dia.slice(0, 4))) * 12 + Number(ref.slice(5, 7)) - Number(dia.slice(5, 7))) : 0;
        v -= Math.abs(b.valor) + (b.prestacao ? Math.abs(b.prestacao) * meses : 0);
      });
    v += await cc.saldoTotalEm(dia);
    serie.push({ mes: k, valor: cent(v) });
  }
  const ante = serie.length > 1 ? serie[serie.length - 2].valor : null;
  const ha12 = serie.length > 12 ? serie[serie.length - 13].valor : null;
  const temHistoria = serie.filter((s) => s.valor !== 0).length;
  const poupMedia = temHistoria >= 4 ? (serie[serie.length - 1].valor - serie[Math.max(0, serie.length - 13)].valor) / Math.min(12, serie.length - 1) : null;

  return {
    liquido: cent(ativo + pass), ativo, passivo: pass,
    composicao: { liquidez: cent(comp.liquidez), investimentos: cent(comp.investimentos), bens: cent(comp.bens), a_receber: cent(comp.a_receber) },
    passivos: { cartoes: cent(passivo.cartoes), dividas: cent(passivo.dividas), a_pagar: cent(passivo.a_pagar) },
    var_mes: ante == null ? null : cent(serie[serie.length - 1].valor - ante),
    var_12m_pct: ha12 ? Math.round((serie[serie.length - 1].valor / ha12 - 1) * 1000) / 10 : null,
    serie, projecao: poupMedia == null ? null : [1, 2, 3, 4, 5, 6].map((i) => ({ mes: somaMes(ym, i), valor: cent(serie[serie.length - 1].valor + poupMedia * i) })),
    contas: contas.map((c) => { const x = Object.assign({}, c); delete x._A; return x; }),
    bens, cc: C
  };
}

/* ---------------- repartir por varios pagamentos ---------------- */
/* Um valor repartido por varios pesos, ao centimo: os centimos que sobram vao
   para quem tem a maior fracao. A soma bate sempre. */
function alocar(valor, pesos) {
  const cents = Math.round(valor * 100), soma = pesos.reduce((t, p) => t + p, 0);
  if (!soma) return pesos.map(() => 0);
  const brutos = pesos.map((p) => cents * p / soma);
  const out = brutos.map(Math.floor);
  let falta = cents - out.reduce((t, x) => t + x, 0);
  brutos.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (falta > 0) { out[i]++; falta--; } });
  return out.map((x) => x / 100);
}

/* Junta pessoas (cada uma com o seu valor) a um ou mais pagamentos. Cada
   pessoa fica com a sua parte repartida pelos pagamentos na proporcao do
   valor de cada um; o que la estivesse dividido mantem-se (a mesma pessoa e
   substituida). Confere tudo antes de mexer em nada. */
async function repartir(debIds, pessoas, opcoes) {
  const o = opcoes || {};
  const debs = await all('SELECT id, descricao, valor, categoria_id, ia_categoria_id FROM fin_movimentos WHERE id = ANY($1::int[]) AND valor < 0 ORDER BY data, id', [debIds]);
  if (!debs.length) throw erro(400, 'Escolhe pagamentos que saíram da conta.');
  const pesos = debs.map((d) => -Number(d.valor));
  const planos = debs.map(() => ({}));
  pessoas.forEach((p) => { alocar(p.valor, pesos).forEach((v, i) => { if (v > 0) planos[i][p.pessoa_id] = v; }); });
  const atuais = await all('SELECT movimento_id, pessoa_id, valor, categoria_id FROM fin_mov_partes WHERE movimento_id = ANY($1::int[])', [debs.map((d) => d.id)]);
  const feitos = debs.map((d, i) => {
    const deste = atuais.filter((p) => p.movimento_id === d.id);
    const outros = deste.filter((p) => p.pessoa_id && planos[i][p.pessoa_id] === undefined)
      .map((p) => ({ pessoa_id: p.pessoa_id, valor: -Number(p.valor) }))
      .concat(Object.keys(planos[i]).map((k) => ({ pessoa_id: Number(k), valor: planos[i][k] })));
    const soma = cent(outros.reduce((t, x) => t + x.valor, 0));
    if (soma > pesos[i] + 0.005) throw erro(400, 'Em «' + d.descricao + '» a parte dos outros passaria o valor do pagamento.');
    const minhaCat = o.categoria_id || (deste.find((p) => !p.pessoa_id) || {}).categoria_id || d.categoria_id || d.ia_categoria_id || null;
    return { d, outros, minhaCat };
  });
  let minha = 0, outrosT = 0;
  for (const f of feitos) {
    const r = await cc.dividir(f.d.id, { outros: f.outros, categoria_id: f.minhaCat,
      descricao: o.descricao ? String(o.descricao).trim() + ' · ' + f.d.descricao : undefined });
    minha += r.minha; outrosT += r.outros;
  }
  return { minha: cent(minha), outros: cent(outrosT), pagamentos: feitos.length, pessoas: pessoas.length };
}

/* As sugestoes de reembolso e de conta dividida para as entradas de uma
   lista (so contas pessoais: numa empresa, quem manda dinheiro e cliente). */
async function sugestoesDeEntradas(lista, B) {
  const out = {};
  const entradas = lista.filter((m) => m.valor > 0 && !m.cc_pessoa_id && (!m.categoria_id || natureza(m, B) === 'receita') &&
    B.contaPor[m.conta_id] && B.contaPor[m.conta_id].pessoal);
  if (!entradas.length) return out;
  entradas.forEach((m) => { out[m.id] = { pagador: cc.pagador(m.descricao) }; });
  const ab = await cc.abertos();
  if (ab.length) entradas.forEach((m) => { const r = cc.reembolsoDe(m, ab); if (r.length) out[m.id].reembolso = r[0]; });
  /* Sem nada registado: pode ser a parte de uma conta que o Marco pagou. */
  const semDono = entradas.filter((m) => !out[m.id].reembolso);
  if (semDono.length) {
    const sd = await cc.sugerirDivisoes(semDono);
    semDono.forEach((m) => { if (sd[m.id]) out[m.id].divisao = sd[m.id]; });
  }
  return out;
}

/* O detalhe completo de uns movimentos, pela ordem dos ids. */
async function detalharMovimentos(ids, B, sug) {
  if (!ids.length) return [];
  const rows = await all(
    `SELECT m.id, m.conta_id, to_char(m.data,'YYYY-MM-DD') AS data, m.descricao, m.valor, m.saldo, m.categoria_id, m.categoria_fonte,
            m.context_id, m.person_id, m.expense_id, m.ia_categoria_id, m.ia_confianca, m.ia_fonte, m.nota, m.origem,
            e.description AS despesa, (e.document_id IS NOT NULL) AS despesa_papel, e.splitwise_id::text AS despesa_splitwise,
            ccm.pessoa_id AS cc_pessoa_id, ccp.nome AS cc_pessoa, ccm.origem AS cc_origem,
            (SELECT json_agg(json_build_object('id', pt.id, 'valor', pt.valor, 'categoria_id', pt.categoria_id,
                                               'pessoa_id', pt.pessoa_id, 'pessoa', cp2.nome) ORDER BY pt.id)
               FROM fin_mov_partes pt LEFT JOIN fin_cc_pessoas cp2 ON cp2.id = pt.pessoa_id
              WHERE pt.movimento_id = m.id) AS partes
       FROM fin_movimentos m
       LEFT JOIN expenses e ON e.id = m.expense_id
       LEFT JOIN fin_cc_mov ccm ON ccm.movimento_id = m.id
       LEFT JOIN fin_cc_pessoas ccp ON ccp.id = ccm.pessoa_id
      WHERE m.id = ANY($1::int[])`, [ids]);
  const por = {};
  rows.forEach((m) => {
    Object.assign(m, {
      valor: Number(m.valor), saldo: m.saldo == null ? null : Number(m.saldo), ia_confianca: m.ia_confianca == null ? null : Number(m.ia_confianca),
      cc_ligado: Boolean(m.cc_pessoa_id),
      partes: m.partes ? m.partes.map((p) => Object.assign(p, { valor: Number(p.valor) })) : null
    });
    m.natureza = natureza(m, B);
    const s = sug && sug[m.id];
    if (s) { if (s.reembolso) m.reembolso = s.reembolso; if (s.divisao) m.divisao = s.divisao; if (s.pagador !== undefined) m.pagador = s.pagador; }
    por[m.id] = m;
  });
  return ids.map((id) => por[id]).filter(Boolean);
}

/* ---------------- rotas ---------------- */
function instalar(app) {
  const f = (q) => ({ ambito: q.ambito || 'tudo', area: q.area ? Number(q.area) : null, conta: q.conta ? String(q.conta).split(',').map(Number).filter(Boolean) : null });
  const mesQ = (q) => (/^\d{4}-\d{2}$/.test(q.mes || '') ? q.mes : mesDe(hojeIso()));

  app.get('/api/financas/base', async (req, res) => {
    try {
      const B = await base();
      const cfg = await alertasConfig();
      const contas = (await saldosContas(B, hojeIso())).map((c) => { const x = Object.assign({}, c); delete x._A; return x; });
      const contagem = await all('SELECT categoria_id, COUNT(*) AS n FROM fin_movimentos WHERE categoria_id IS NOT NULL GROUP BY categoria_id');
      const n = {}; contagem.forEach((r) => { n[r.categoria_id] = Number(r.n); });
      res.json({ contas, categorias: B.cats.map((c) => Object.assign({}, c, { n: n[c.id] || 0 })), alertas: cfg, ia: Boolean(CHAVE) });
    } catch (e) { falha(res, e, 'as finanças'); }
  });

  app.get('/api/financas/resumo', async (req, res) => {
    try { res.json(await resumo(mesQ(req.query), f(req.query))); } catch (e) { falha(res, e, 'o resumo'); }
  });
  app.get('/api/financas/analise', async (req, res) => {
    try { res.json(await analise(mesQ(req.query), f(req.query))); } catch (e) { falha(res, e, 'a análise'); }
  });
  app.get('/api/financas/orcamentos', async (req, res) => {
    try { const B = await base(); res.json(await orcamentos(mesQ(req.query), f(req.query), B)); } catch (e) { falha(res, e, 'os orçamentos'); }
  });
  app.get('/api/financas/patrimonio', async (req, res) => {
    try { res.json(await patrimonio(req.query.empresas === '1')); } catch (e) { falha(res, e, 'o património'); }
  });

  /* ---- contas ---- */
  const CAMPOS_CONTA = ['nome', 'tipo', 'instituicao', 'context_id', 'pessoal', 'saldo_inicial', 'saldo_inicial_em', 'ativo', 'sort', 'nota'];
  app.post('/api/financas/contas', async (req, res) => {
    try {
      const b = req.body || {};
      if (!String(b.nome || '').trim()) throw erro(400, 'Falta o nome da conta.');
      const r = (await all(
        `INSERT INTO fin_contas (nome, tipo, instituicao, context_id, pessoal, saldo_inicial, saldo_inicial_em, nota)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [b.nome.trim(), b.tipo || 'ordem', b.instituicao || null, b.context_id || null, b.pessoal !== false,
          cent(b.saldo_inicial || 0), b.saldo_inicial_em || null, b.nota || null]))[0];
      res.json({ id: r.id });
    } catch (e) { falha(res, e, 'a conta'); }
  });
  app.patch('/api/financas/contas/:id(\\d+)', async (req, res) => {
    try {
      const b = req.body || {}; const sets = [], vals = [];
      CAMPOS_CONTA.forEach((k) => { if (b[k] !== undefined) { vals.push(b[k] === '' ? null : b[k]); sets.push(k + ' = $' + vals.length); } });
      if (b.mapa === null) sets.push('mapa = NULL');
      if (sets.length) { vals.push(req.params.id); await query('UPDATE fin_contas SET ' + sets.join(', ') + ' WHERE id = $' + vals.length, vals); }
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'a conta'); }
  });
  app.delete('/api/financas/contas/:id(\\d+)', async (req, res) => {
    try {
      const n = Number((await all('SELECT COUNT(*) AS n FROM fin_movimentos WHERE conta_id = $1', [req.params.id]))[0].n);
      if (n && req.query.apagar_movimentos !== '1') throw erro(409, 'A conta tem ' + n + ' movimentos. Desativa-a, ou confirma que os apagas também.');
      await query('DELETE FROM fin_contas WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'a conta'); }
  });
  app.post('/api/financas/contas/:id(\\d+)/saldo', async (req, res) => {
    try {
      const b = req.body || {};
      const saldo = cent(String(b.saldo).replace(/\s/g, '').replace(',', '.'));
      if (!isFinite(saldo)) throw erro(400, 'Saldo inválido.');
      await query(`INSERT INTO fin_saldos (conta_id, em, saldo) VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3)
                   ON CONFLICT (conta_id, em) DO UPDATE SET saldo = EXCLUDED.saldo`, [req.params.id, b.em || null, saldo]);
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'o saldo'); }
  });

  /* ---- importar ---- */
  app.post('/api/financas/contas/:id(\\d+)/importar', upload.single('ficheiro'), async (req, res) => {
    try {
      const conta = (await all('SELECT id, nome, mapa FROM fin_contas WHERE id = $1', [req.params.id]))[0];
      if (!conta) throw erro(404, 'Conta não encontrada.');
      if (!req.file) throw erro(400, 'Falta o ficheiro.');
      const buf = req.file.buffer;
      const tipo = imp.tipoDe(req.file.originalname, req.file.mimetype, buf);
      let linhas;
      if (tipo === 'xls') throw erro(415, 'Este ficheiro é Excel. No Excel, guarda-o como CSV e importa o CSV.');
      if (tipo === 'ofx') linhas = imp.lerOfx(imp.decodificar(buf));
      else if (tipo === 'pdf') linhas = await imp.lerPdf(buf);
      else {
        const texto = imp.decodificar(buf);
        let mapa = null;
        if (req.body && req.body.mapa) { try { mapa = JSON.parse(req.body.mapa); } catch (e) { throw erro(400, 'Mapa inválido.'); } }
        const det = imp.detetar(texto);
        if (!mapa && conta.mapa && det.mapa && conta.mapa.data != null) {
          mapa = Object.assign({}, conta.mapa, { primeira: det.mapa.primeira, cabecalho: det.mapa.cabecalho });
        }
        if (!mapa) {
          return res.json({ precisa_mapa: true, colunas: det.colunas, amostra: det.amostra, mapa: det.mapa });
        }
        linhas = imp.aplicarMapa(texto, mapa);
        await query('UPDATE fin_contas SET mapa = $1::jsonb WHERE id = $2', [JSON.stringify(Object.assign({}, mapa, { primeira: null })), conta.id]);
      }
      if (!linhas.length) throw erro(422, 'Não encontrei movimentos neste ficheiro.');
      const r = await gravarLinhas(conta.id, linhas, tipo === 'pdf' ? 'pdf' : 'import');
      const datas = linhas.map((l) => l.data).sort();
      res.json({ lidos: linhas.length, novos: r.ids.length, repetidos: r.repetidos, de: datas[0], ate: datas[datas.length - 1], tipo });
      /* Categorizar depois de responder: o modelo pode demorar. */
      if (r.ids.length) categorizar(r.ids).catch((e) => console.error('[farol] financas categorizar:', e.message));
    } catch (e) { falha(res, e, 'o extrato'); }
  });

  /* ---- movimentos ---- */
  /* A lista de movimentos, aos bocados. Primeiro uma leitura leve de todos os
     que passam os filtros (para os totais, os avisos e o «escolher todos»);
     depois o detalhe completo so da pagina pedida (desde, limite). */
  app.get('/api/financas/movimentos', async (req, res) => {
    try {
      const B = await base();
      const q = req.query;
      const w = [], v = [];
      const add = (sql, val) => { v.push(val); w.push(sql.replace('?', '$' + v.length)); };
      if (q.de) add('m.data >= ?', q.de);
      if (q.ate) add('m.data <= ?', q.ate);
      if (q.conta) {
        /* Uma conta ou varias, separadas por virgulas. */
        const cs = String(q.conta).split(',').map(Number).filter(Boolean);
        if (cs.length) { v.push(cs); w.push('m.conta_id = ANY($' + v.length + '::int[])'); }
      }
      if (q.categoria === 'nenhuma') w.push('m.categoria_id IS NULL');
      else if (q.categoria) add('m.categoria_id = ?', Number(q.categoria));
      if (q.q) {
        /* Procura no descritivo e, se o texto parecer um valor, no montante. */
        const num = String(q.q).replace(/\s/g, '').replace(',', '.');
        if (/^\d+(\.\d+)?$/.test(num)) {
          v.push('%' + q.q + '%'); v.push(num);
          w.push('(m.descricao ILIKE $' + (v.length - 1) + " OR to_char(abs(m.valor),'FM999999990.00') LIKE $" + v.length + " || '%')");
        } else add('m.descricao ILIKE ?', '%' + q.q + '%');
      }
      if (q.estado === 'categorizar') w.push('m.categoria_id IS NULL');
      if (q.estado === 'sugestoes') w.push('m.categoria_id IS NULL AND m.ia_categoria_id IS NOT NULL');
      if (q.estado === 'semdespesa') w.push('m.valor < 0 AND m.expense_id IS NULL');
      if (q.estado === 'reconciliar') w.push(`m.expense_id IS NULL AND m.valor < 0 AND EXISTS (SELECT 1 FROM expenses e
          WHERE abs(e.amount - abs(m.valor)) < 0.006 AND e.spent_on BETWEEN m.data - 12 AND m.data + 6
            AND NOT EXISTS (SELECT 1 FROM fin_movimentos x WHERE x.expense_id = e.id))`);
      if (q.estado === 'divididos') w.push('EXISTS (SELECT 1 FROM fin_mov_partes pt WHERE pt.movimento_id = m.id)');
      if (q.estado === 'reembolsos') w.push('m.valor > 0 AND NOT EXISTS (SELECT 1 FROM fin_cc_mov c WHERE c.movimento_id = m.id)');
      if (q.estado === 'repetidos') w.push(`EXISTS (SELECT 1 FROM fin_movimentos y WHERE y.id <> m.id AND y.conta_id = m.conta_id
          AND y.data = m.data AND y.valor = m.valor AND lower(y.descricao) = lower(m.descricao))`);
      /* A leitura leve: so o que serve para filtrar, somar e sugerir. */
      const leves = await all(
        `SELECT m.id, m.conta_id, m.context_id, to_char(m.data,'YYYY-MM-DD') AS data, m.descricao, m.valor, m.categoria_id,
                m.ia_categoria_id, m.ia_confianca, (ccm.movimento_id IS NOT NULL) AS cc_ligado, ccm.pessoa_id AS cc_pessoa_id
           FROM fin_movimentos m LEFT JOIN fin_cc_mov ccm ON ccm.movimento_id = m.id
          ${w.length ? 'WHERE ' + w.join(' AND ') : ''}
          ORDER BY m.data DESC, m.id DESC LIMIT 20000`, v);
      const fl = f(q);
      let todos = leves.filter((m) => passa(m, fl, B)).map((m) => Object.assign(m, { valor: Number(m.valor) }));
      /* Entradas que podem ser alguem a devolver uma conta dividida: contam
         para o aviso de cima, por isso veem-se em todas, nao so na pagina. */
      const sug = await sugestoesDeEntradas(todos, B);
      if (q.estado === 'reembolsos') todos = todos.filter((m) => sug[m.id] && (sug[m.id].reembolso || sug[m.id].divisao));
      const limite = Math.max(1, Math.min(3000, Number(q.limite) || 600));
      const desde = Math.max(0, Number(q.desde) || 0);
      const pagina = await detalharMovimentos(todos.slice(desde, desde + limite).map((m) => m.id), B, sug);
      const comSug = todos.filter((m) => !m.categoria_id && m.ia_categoria_id && !(sug[m.id] && (sug[m.id].reembolso || sug[m.id].divisao)));
      const entradas = todos.filter((m) => m.valor > 0).reduce((t, m) => t + m.valor, 0);
      const saidas = todos.filter((m) => m.valor < 0).reduce((t, m) => t - m.valor, 0);
      res.json({
        movimentos: pagina, total: todos.length, desde, limite,
        resumo: {
          entradas: cent(entradas), saidas: cent(saidas), saldo: cent(entradas - saidas),
          sugestoes: comSug.map((m) => m.id),
          confianca: comSug.length ? cent(comSug.reduce((t, m) => t + Number(m.ia_confianca || 0), 0) / comSug.length) : null,
          reembolsos: Object.keys(sug).filter((k) => sug[k].reembolso || sug[k].divisao).length
        },
        /* Para «escolher todos» e para o lote saber quais sao saidas. */
        todos: todos.map((m) => [m.id, m.valor])
      });
    } catch (e) { falha(res, e, 'os movimentos'); }
  });

  /* Um movimento so, com o mesmo detalhe da lista: para atualizar uma linha
     depois de a gravar, sem voltar a ler tudo. */
  app.get('/api/financas/movimentos/:id(\\d+)', async (req, res) => {
    try {
      const B = await base();
      const leve = (await all(
        `SELECT m.id, m.conta_id, to_char(m.data,'YYYY-MM-DD') AS data, m.descricao, m.valor, m.categoria_id,
                (ccm.movimento_id IS NOT NULL) AS cc_ligado, ccm.pessoa_id AS cc_pessoa_id
           FROM fin_movimentos m LEFT JOIN fin_cc_mov ccm ON ccm.movimento_id = m.id WHERE m.id = $1`, [req.params.id]))
        .map((m) => Object.assign(m, { valor: Number(m.valor) }));
      if (!leve.length) throw erro(404, 'Movimento não encontrado.');
      const sug = await sugestoesDeEntradas(leve, B);
      const r = await detalharMovimentos([leve[0].id], B, sug);
      res.json({ movimento: r[0] });
    } catch (e) { falha(res, e, 'o movimento'); }
  });

  app.post('/api/financas/movimentos', async (req, res) => {
    try {
      const b = req.body || {};
      const valor = cent(String(b.valor).replace(/\s/g, '').replace(',', '.'));
      if (!b.conta_id || !valor || !b.data) throw erro(400, 'Faltam a conta, a data ou o valor.');
      const r = (await all(
        `INSERT INTO fin_movimentos (conta_id, data, descricao, valor, categoria_id, categoria_fonte, categoria_em, context_id, impressao, origem, nota)
         VALUES ($1,$2,$3,$4,$5, CASE WHEN $5::int IS NULL THEN NULL ELSE 'tu' END, CASE WHEN $5::int IS NULL THEN NULL ELSE now() END, $6, $7, 'manual', $8) RETURNING id`,
        [b.conta_id, b.data, String(b.descricao || 'Movimento').trim(), valor, b.categoria_id || null, b.context_id || null,
          'manual:' + crypto.randomBytes(8).toString('hex'), b.nota || null]))[0];
      if (!b.categoria_id) categorizar([r.id]).catch(() => {});
      res.json({ id: r.id });
    } catch (e) { falha(res, e, 'o movimento'); }
  });

  app.patch('/api/financas/movimentos/:id(\\d+)', async (req, res) => {
    try {
      const b = req.body || {};
      const m = (await all('SELECT id, categoria_id, ia_categoria_id, descricao, valor, conta_id FROM fin_movimentos WHERE id = $1', [req.params.id]))[0];
      if (!m) throw erro(404, 'Movimento não encontrado.');
      const sets = [], vals = [];
      const set = (k, v) => { vals.push(v); sets.push(k + ' = $' + vals.length); };
      if (b.categoria_id !== undefined) {
        const cat = b.categoria_id || null;
        set('categoria_id', cat);
        set('categoria_fonte', !cat ? null : (b.aceite ? 'ia-aceite' : (m.ia_categoria_id && m.ia_categoria_id !== Number(cat) ? 'tu-corrigiu' : 'tu')));
        sets.push('categoria_em = now()');
      }
      ['context_id', 'person_id', 'nota', 'expense_id', 'data', 'descricao'].forEach((k) => { if (b[k] !== undefined) set(k, b[k] === '' ? null : b[k]); });
      if (sets.length) { vals.push(m.id); await query('UPDATE fin_movimentos SET ' + sets.join(', ') + ' WHERE id = $' + vals.length, vals); }
      if (b.categoria_id !== undefined) await cc.categoriaDaMinhaParte(m.id, b.categoria_id || null);
      if (b.cc_pessoa_id !== undefined) {
        await cc.ligarMovimento(m.id, b.cc_pessoa_id || null);
        /* Um acerto sem categoria fica em «Acertos de contas correntes», para
           nao aparecer por categorizar. */
        if (b.cc_pessoa_id) {
          await query(`UPDATE fin_movimentos SET categoria_id = (SELECT id FROM fin_categorias WHERE natureza = 'transferencia' AND nome ILIKE '%acerto%' ORDER BY id LIMIT 1),
                         categoria_fonte = 'tu', categoria_em = now() WHERE id = $1 AND categoria_id IS NULL`, [m.id]);
        }
      }
      if (b.criar_regra && b.categoria_id) {
        const padrao = String(b.regra_padrao || chave(m.descricao)).trim();
        if (padrao.length >= 3) {
          await query('INSERT INTO fin_regras (padrao, categoria_id, context_id, origem) VALUES ($1,$2,$3,$4)',
            [padrao, b.categoria_id, b.context_id || null, 'tu']);
        }
      }
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'o movimento'); }
  });

  app.post('/api/financas/movimentos/lote', async (req, res) => {
    try {
      const b = req.body || {};
      const ids = (b.ids || []).map(Number).filter(Boolean);
      if (!ids.length) throw erro(400, 'Nenhum movimento escolhido.');
      if (b.aceitar) {
        const r = await all(`UPDATE fin_movimentos SET categoria_id = ia_categoria_id, categoria_fonte = 'ia-aceite', categoria_em = now()
                              WHERE id = ANY($1::int[]) AND categoria_id IS NULL AND ia_categoria_id IS NOT NULL RETURNING id`, [ids]);
        return res.json({ feitos: r.length });
      }
      if (b.apagar) {
        const r = await all('DELETE FROM fin_movimentos WHERE id = ANY($1::int[]) RETURNING id', [ids]);
        return res.json({ feitos: r.length });
      }
      const sets = [], vals = [ids];
      if (b.categoria_id !== undefined) { vals.push(b.categoria_id || null); sets.push('categoria_id = $' + vals.length, "categoria_fonte = 'tu'", 'categoria_em = now()'); }
      if (b.context_id !== undefined) { vals.push(b.context_id || null); sets.push('context_id = $' + vals.length); }
      if (!sets.length) return res.json({ feitos: 0 });
      const r = await all('UPDATE fin_movimentos SET ' + sets.join(', ') + ' WHERE id = ANY($1::int[]) RETURNING id', vals);
      res.json({ feitos: r.length });
    } catch (e) { falha(res, e, 'os movimentos'); }
  });

  app.delete('/api/financas/movimentos/:id(\\d+)', async (req, res) => {
    try { await query('DELETE FROM fin_movimentos WHERE id = $1', [req.params.id]); res.json({ ok: true }); }
    catch (e) { falha(res, e, 'o movimento'); }
  });

  app.get('/api/financas/movimentos/:id(\\d+)/candidatos', async (req, res) => {
    try {
      const m = (await all(`SELECT m.id, to_char(m.data,'YYYY-MM-DD') AS data, m.descricao, m.valor, c.pessoal
                                FROM fin_movimentos m JOIN fin_contas c ON c.id = m.conta_id WHERE m.id = $1`, [req.params.id]))[0];
      if (!m) throw erro(404, 'Movimento não encontrado.');
      /* Numa conta de empresa, uma entrada e de um cliente: nada de reembolsos. */
      if (Number(m.valor) > 0 && !m.pessoal) return res.json({ candidatos: [], pessoas: [], empresa: true });
      if (Number(m.valor) > 0) {
        /* Uma entrada: quem pode estar a devolver, a conta de que pode ser a
           parte, e os pagamentos dos dias antes para escolher a mao. */
        const sd = await cc.sugerirDivisoes([m]);
        const r = await cc.resumo();
        /* As contas correntes em aberto (Splitwise e do Farol), para ligar a
           entrada a uma que ja existe; e as contas divididas por pagar. */
        const devedores = r.pessoas.filter((p) => p.ativo && p.saldo > 0.005)
          .map((p) => ({ pessoa_id: p.id, nome: p.nome, saldo: p.saldo, tipo: p.tipo }));
        return res.json({ candidatos: [], pessoas: cc.reembolsoDe(m, await cc.abertos()), pagador: cc.pagador(m.descricao),
          divisao: sd[m.id] || null, contas: await cc.contasEmAberto(), devedores,
          todas: r.pessoas.filter((p) => p.ativo).map((p) => ({ pessoa_id: p.id, nome: p.nome, saldo: p.saldo, tipo: p.tipo })) });
      }
      res.json({ candidatos: await candidatos(m), pessoas: [] });
    } catch (e) { falha(res, e, 'a reconciliação'); }
  });

  /* Os pagamentos de que uma entrada pode ser a parte: das contas pessoais,
     por texto e por periodo. Primeiro os que dao conta certa (o valor e um
     multiplo exato do que entrou: 38,70 = 3 x 12,90), depois por data. */
  app.get('/api/financas/movimentos/:id(\\d+)/pagamentos', async (req, res) => {
    try {
      const m = (await all("SELECT id, to_char(data,'YYYY-MM-DD') AS data, valor FROM fin_movimentos WHERE id = $1", [req.params.id]))[0];
      if (!m) throw erro(404, 'Movimento não encontrado.');
      const v = cent(Math.abs(Number(m.valor)));
      const dias = Math.min(400, Math.max(3, Number(req.query.dias) || 45));
      const texto = String(req.query.q || '').trim().slice(0, 60);
      const ps = [m.data, dias];
      let extra = '';
      if (texto) { ps.push('%' + texto.replace(/[%_]/g, ' ') + '%'); extra += ' AND (d.descricao ILIKE $' + ps.length + ' OR d.nota ILIKE $' + ps.length + ')'; }
      const debs = (await all(
        `SELECT d.id, to_char(d.data,'YYYY-MM-DD') AS data, d.descricao, d.valor, c.nome AS conta,
                COALESCE(k.nome, ki.nome) AS categoria,
                EXISTS (SELECT 1 FROM fin_mov_partes p WHERE p.movimento_id = d.id) AS dividido
           FROM fin_movimentos d JOIN fin_contas c ON c.id = d.conta_id AND c.pessoal
           LEFT JOIN fin_categorias k ON k.id = d.categoria_id LEFT JOIN fin_categorias ki ON ki.id = d.ia_categoria_id
          WHERE d.valor < 0 AND d.data BETWEEN $1::date - $2::int AND $1::date + 10` + extra + `
            AND NOT EXISTS (SELECT 1 FROM fin_cc_mov x WHERE x.movimento_id = d.id)
          ORDER BY d.data DESC, d.id DESC LIMIT 400`, ps)).map((d) => {
        const t = cent(-Number(d.valor));
        const k = v > 0 ? Math.round(t / v) : 0;
        const vezes = k >= 2 && k <= 12 && Math.abs(t - k * v) <= 0.011 * k ? k : null;
        const dd = Math.round((new Date(d.data) - new Date(m.data)) / 86400000);
        return { id: d.id, data: d.data, descricao: d.descricao, valor: -t, conta: d.conta, categoria: d.categoria, dividido: d.dividido, vezes, dias: dd };
      });
      const so = req.query.so === 'certos';
      const lista = debs.filter((d) => !so || d.vezes || d.dividido)
        .sort((a, b) => (b.vezes ? 1 : 0) - (a.vezes ? 1 : 0) || Math.abs(a.dias) - Math.abs(b.dias) || (a.data < b.data ? 1 : -1))
        .slice(0, 120);
      res.json({ pagamentos: lista, total: debs.length, dias });
    } catch (e) { falha(res, e, 'os pagamentos'); }
  });

  /* Uma entrada de alguem sem conta corrente: cria-a a partir da entrada. */
  app.post('/api/financas/movimentos/:id(\\d+)/nova-cc', async (req, res) => {
    try {
      const r = await cc.novaComEntrada(Number(req.params.id), req.body || {});
      await query(`UPDATE fin_movimentos SET categoria_id = (SELECT id FROM fin_categorias WHERE natureza = 'transferencia' AND nome ILIKE '%acerto%' ORDER BY id LIMIT 1),
                     categoria_fonte = 'tu', categoria_em = now(), ia_categoria_id = NULL WHERE id = $1`, [Number(req.params.id)]);
      res.json(r);
    } catch (e) { falha(res, e, 'a conta corrente nova'); }
  });

  /* Uma ou mais entradas sao a parte de pessoas numa conta que o Marco pagou:
     divide-se o pagamento (juntando-as as partes que ja la estivessem) e cada
     entrada liga-se como reembolso. Tudo de uma vez, sem nada registado antes. */
  /* Uma ou mais entradas sao a parte de pessoas numa conta (ou em varias) que
     o Marco pagou: divide-se o pagamento - ou os pagamentos, na proporcao do
     valor de cada um - e cada entrada liga-se como reembolso. Tudo de uma
     vez, sem nada registado antes. */
  app.post('/api/financas/movimentos/:id(\\d+)/devolucao', async (req, res) => {
    try {
      const b = req.body || {};
      const debIds = (b.debito_ids && b.debito_ids.length ? b.debito_ids : [b.debito_id]).map(Number).filter(Boolean);
      if (!debIds.length) throw erro(400, 'Escolhe o pagamento que foi dividido.');
      const pedidos = (b.creditos && b.creditos.length ? b.creditos : [{ id: Number(req.params.id) }]);
      const ids = pedidos.map((x) => Number(x.id)).filter(Boolean);
      const cs = await all('SELECT id, descricao, valor FROM fin_movimentos WHERE id = ANY($1::int[]) AND valor > 0', [ids]);
      if (!cs.length) throw erro(400, 'Nenhuma entrada para ligar.');
      const novos = [];
      for (const c of cs) {
        const pedido = pedidos.find((x) => Number(x.id) === c.id) || {};
        const nome = String(pedido.nome || cc.pagador(c.descricao) || '').trim();
        if (!nome) throw erro(400, 'Falta o nome de quem mandou «' + c.descricao + '».');
        novos.push({ credito: c.id, pessoa_id: await cc.resolverPessoa(nome), valor: cent(c.valor) });
      }
      /* A mesma pessoa com duas entradas conta uma vez, somada. */
      const porPessoa = {};
      novos.forEach((n) => { porPessoa[n.pessoa_id] = cent((porPessoa[n.pessoa_id] || 0) + n.valor); });
      const r = await repartir(debIds, Object.keys(porPessoa).map((k) => ({ pessoa_id: Number(k), valor: porPessoa[k] })), { categoria_id: b.categoria_id });
      for (const n of novos) {
        await cc.ligarMovimento(n.credito, n.pessoa_id);
        await query(`UPDATE fin_movimentos SET categoria_id = (SELECT id FROM fin_categorias WHERE natureza = 'transferencia' AND nome ILIKE '%acerto%' ORDER BY id LIMIT 1),
                       categoria_fonte = 'tu', categoria_em = now(), ia_categoria_id = NULL WHERE id = $1`, [n.credito]);
      }
      res.json(Object.assign(r, { ligados: novos.length }));
    } catch (e) { falha(res, e, 'a devolução'); }
  });

  /* Varios pagamentos (as viagens de Uber de um fim de semana) divididos pelo
     grupo de uma vez: cada pessoa fica com a sua parte do total, repartida
     pelos pagamentos na proporcao do valor de cada um. */
  app.post('/api/financas/movimentos/dividir-grupo', async (req, res) => {
    try {
      const b = req.body || {};
      const ids = (b.ids || []).map(Number).filter(Boolean);
      if (!ids.length) throw erro(400, 'Escolhe os pagamentos.');
      const lidos = (b.outros || []).map((o) => ({ pessoa_id: o.pessoa_id ? Number(o.pessoa_id) : null, nome: String(o.nome || '').trim(),
        valor: cent(String(o.valor == null ? '' : o.valor).replace(/\s/g, '').replace(',', '.')) })).filter((o) => o.valor > 0 && (o.pessoa_id || o.nome));
      if (!lidos.length) throw erro(400, 'Falta com quem dividir e quanto.');
      const debs = await all('SELECT id, valor FROM fin_movimentos WHERE id = ANY($1::int[]) AND valor < 0', [ids]);
      const total = cent(debs.reduce((t, d) => t - Number(d.valor), 0));
      if (cent(lidos.reduce((t, o) => t + o.valor, 0)) > total + 0.005) throw erro(400, 'A parte dos outros passa o total dos pagamentos (' + total.toFixed(2).replace('.', ',') + ' €).');
      const porPessoa = {};
      for (const o of lidos) {
        const pid = o.pessoa_id || await cc.resolverPessoa(o.nome);
        porPessoa[pid] = cent((porPessoa[pid] || 0) + o.valor);
      }
      const r = await repartir(debs.map((d) => d.id), Object.keys(porPessoa).map((k) => ({ pessoa_id: Number(k), valor: porPessoa[k] })),
        { categoria_id: b.categoria_id, descricao: b.descricao });
      res.json(r);
    } catch (e) { falha(res, e, 'a divisão'); }
  });

  /* Dividir a conta: a parte do Marco e a de cada pessoa. */
  app.put('/api/financas/movimentos/:id(\\d+)/partes', async (req, res) => {
    try { res.json(await cc.dividir(Number(req.params.id), req.body || {})); }
    catch (e) { falha(res, e, 'a divisão'); }
  });
  app.delete('/api/financas/movimentos/:id(\\d+)/partes', async (req, res) => {
    try { await cc.desfazerDivisao(Number(req.params.id)); res.json({ ok: true }); }
    catch (e) { falha(res, e, 'a divisão'); }
  });

  /* Um movimento sem despesa no Farol: cria-se a despesa a partir dele. */
  app.post('/api/financas/movimentos/:id(\\d+)/despesa', async (req, res) => {
    try {
      const m = (await all(
        `SELECT m.*, c.nome AS cat_nome, ct.context_id AS conta_ctx FROM fin_movimentos m
           LEFT JOIN fin_categorias c ON c.id = m.categoria_id JOIN fin_contas ct ON ct.id = m.conta_id WHERE m.id = $1`, [req.params.id]))[0];
      if (!m) throw erro(404, 'Movimento não encontrado.');
      if (Number(m.valor) >= 0) throw erro(400, 'Só se cria despesa de um movimento que saiu da conta.');
      const e = (await all(
        `INSERT INTO expenses (description, amount, spent_on, merchant, category, person_id, context_id, origin)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'real') RETURNING id`,
        [(req.body && req.body.descricao) || m.descricao, Math.abs(Number(m.valor)), m.data, null, m.cat_nome || null, m.person_id || null,
          m.context_id || m.conta_ctx || null]))[0];
      await query('UPDATE fin_movimentos SET expense_id = $1 WHERE id = $2', [e.id, m.id]);
      res.json({ expense_id: e.id });
    } catch (e) { falha(res, e, 'a despesa'); }
  });

  /* ---- IA ---- */
  app.post('/api/financas/ia/categorizar', async (req, res) => {
    try { res.json(await categorizar(null, { refazer: Boolean(req.body && req.body.refazer) })); }
    catch (e) { falha(res, e, 'a categorização'); }
  });
  app.get('/api/financas/ia', async (req, res) => {
    try {
      const s = (await all(
        `SELECT COUNT(*) FILTER (WHERE categoria_fonte = 'ia-aceite' AND categoria_em > now() - interval '30 days') AS aceites30,
                COUNT(*) FILTER (WHERE categoria_fonte = 'tu-corrigiu' AND categoria_em > now() - interval '30 days') AS corrigidas30,
                COUNT(*) FILTER (WHERE categoria_fonte = 'ia-aceite') AS aceites,
                COUNT(*) FILTER (WHERE categoria_fonte = 'tu-corrigiu') AS corrigidas,
                COUNT(*) FILTER (WHERE categoria_fonte = 'regra') AS por_regra,
                COUNT(*) FILTER (WHERE categoria_id IS NULL AND ia_categoria_id IS NOT NULL) AS por_rever,
                COUNT(*) FILTER (WHERE categoria_id IS NULL) AS sem_categoria
           FROM fin_movimentos`))[0];
      const a = Number(s.aceites30), c = Number(s.corrigidas30);
      const B = await base();
      /* Regras propostas: o mesmo comerciante, posto a mao tres vezes na
         mesma categoria, sem regra que o apanhe. */
      const regras = (await all('SELECT padrao FROM fin_regras WHERE ativo')).map((r) => norm(r.padrao));
      const hist = await all(
        `SELECT descricao, categoria_id FROM fin_movimentos
          WHERE categoria_fonte IN ('tu','tu-corrigiu','ia-aceite') AND categoria_id IS NOT NULL ORDER BY data DESC LIMIT 3000`);
      const g = {};
      hist.forEach((h) => { const k = chave(h.descricao); if (!k || k.length < 4) return; const x = g[k] = g[k] || {}; x[h.categoria_id] = (x[h.categoria_id] || 0) + 1; });
      const propostas = Object.keys(g).map((k) => {
        const ord = Object.keys(g[k]).sort((p, q) => g[k][q] - g[k][p]);
        return { padrao: k, categoria_id: Number(ord[0]), n: g[k][ord[0]], unanime: ord.length === 1 };
      }).filter((p) => p.n >= 3 && p.unanime && !regras.some((r) => r && (p.padrao.indexOf(r) >= 0 || r.indexOf(p.padrao) >= 0)))
        .sort((p, q) => q.n - p.n).slice(0, 8)
        .map((p) => Object.assign(p, { categoria: B.catPor[p.categoria_id] ? B.catPor[p.categoria_id].grupo + ' › ' + B.catPor[p.categoria_id].nome : '' }));
      res.json({
        ativa: Boolean(CHAVE), acerto: a + c ? Math.round(a / (a + c) * 100) : null,
        aceites: Number(s.aceites), corrigidas: Number(s.corrigidas), por_regra: Number(s.por_regra),
        por_rever: Number(s.por_rever), sem_categoria: Number(s.sem_categoria), propostas
      });
    } catch (e) { falha(res, e, 'a IA'); }
  });

  /* ---- categorias ---- */
  app.post('/api/financas/categorias', async (req, res) => {
    try {
      const b = req.body || {};
      if (!String(b.grupo || '').trim() || !String(b.nome || '').trim()) throw erro(400, 'Faltam o grupo e o nome.');
      const r = (await all(
        `INSERT INTO fin_categorias (grupo, nome, natureza, fixa, context_id, sort)
         VALUES ($1,$2,$3,$4,$5, COALESCE((SELECT MAX(sort) + 1 FROM fin_categorias WHERE lower(grupo) = lower($1)), 999)) RETURNING id`,
        [b.grupo.trim(), b.nome.trim(), b.natureza || 'despesa', Boolean(b.fixa), b.context_id || null]))[0];
      res.json({ id: r.id });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Já existe essa categoria.' });
      falha(res, e, 'a categoria');
    }
  });
  app.patch('/api/financas/categorias/:id(\\d+)', async (req, res) => {
    try {
      const b = req.body || {}; const sets = [], vals = [];
      ['grupo', 'nome', 'natureza', 'fixa', 'context_id', 'ativo', 'sort'].forEach((k) => { if (b[k] !== undefined) { vals.push(b[k] === '' ? null : b[k]); sets.push(k + ' = $' + vals.length); } });
      if (sets.length) { vals.push(req.params.id); await query('UPDATE fin_categorias SET ' + sets.join(', ') + ' WHERE id = $' + vals.length, vals); }
      res.json({ ok: true });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Já existe essa categoria.' });
      falha(res, e, 'a categoria');
    }
  });
  app.delete('/api/financas/categorias/:id(\\d+)', async (req, res) => {
    try {
      const para = req.query.para ? Number(req.query.para) : null;
      if (para) await query('UPDATE fin_movimentos SET categoria_id = $1 WHERE categoria_id = $2', [para, req.params.id]);
      await query('DELETE FROM fin_categorias WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'a categoria'); }
  });

  /* ---- regras ---- */
  app.get('/api/financas/regras', async (req, res) => {
    try {
      res.json({ regras: (await all(
        `SELECT r.id, r.padrao, r.valor_min, r.valor_max, r.conta_id, r.categoria_id, r.context_id, r.origem, r.usos, r.ativo,
                c.grupo || ' › ' || c.nome AS categoria, ct.nome AS conta
           FROM fin_regras r JOIN fin_categorias c ON c.id = r.categoria_id LEFT JOIN fin_contas ct ON ct.id = r.conta_id
          ORDER BY r.usos DESC, r.padrao`)) });
    } catch (e) { falha(res, e, 'as regras'); }
  });
  app.post('/api/financas/regras', async (req, res) => {
    try {
      const b = req.body || {};
      if (String(b.padrao || '').trim().length < 2 || !b.categoria_id) throw erro(400, 'Faltam o texto e a categoria.');
      const num = (x) => (x === '' || x == null ? null : cent(String(x).replace(',', '.')));
      const r = (await all(
        `INSERT INTO fin_regras (padrao, valor_min, valor_max, conta_id, categoria_id, context_id, origem)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [b.padrao.trim(), num(b.valor_min), num(b.valor_max), b.conta_id || null, b.categoria_id, b.context_id || null, b.origem || 'tu']))[0];
      const ap = await categorizar(null, { modelo: false });
      res.json({ id: r.id, aplicada: ap.regra });
    } catch (e) { falha(res, e, 'a regra'); }
  });
  app.patch('/api/financas/regras/:id(\\d+)', async (req, res) => {
    try {
      const b = req.body || {}; const sets = [], vals = [];
      ['padrao', 'valor_min', 'valor_max', 'conta_id', 'categoria_id', 'context_id', 'ativo'].forEach((k) => { if (b[k] !== undefined) { vals.push(b[k] === '' ? null : b[k]); sets.push(k + ' = $' + vals.length); } });
      if (sets.length) { vals.push(req.params.id); await query('UPDATE fin_regras SET ' + sets.join(', ') + ' WHERE id = $' + vals.length, vals); }
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'a regra'); }
  });
  app.delete('/api/financas/regras/:id(\\d+)', async (req, res) => {
    try { await query('DELETE FROM fin_regras WHERE id = $1', [req.params.id]); res.json({ ok: true }); }
    catch (e) { falha(res, e, 'a regra'); }
  });

  /* ---- orcamentos ---- */
  app.post('/api/financas/orcamentos', async (req, res) => {
    try {
      const b = req.body || {};
      const mensal = cent(String(b.mensal).replace(',', '.'));
      if (!b.categoria_id || !(mensal > 0)) throw erro(400, 'Faltam a categoria e o valor.');
      await query(
        `INSERT INTO fin_orcamentos (categoria_id, mensal, acumula, desde) VALUES ($1,$2,$3, COALESCE($4::date, date_trunc('month', now())::date))
         ON CONFLICT (categoria_id) DO UPDATE SET mensal = EXCLUDED.mensal, acumula = EXCLUDED.acumula, ativo = TRUE`,
        [b.categoria_id, mensal, Boolean(b.acumula), b.desde ? b.desde + (b.desde.length === 7 ? '-01' : '') : null]);
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'o orçamento'); }
  });
  app.patch('/api/financas/orcamentos/:id(\\d+)', async (req, res) => {
    try {
      const b = req.body || {}; const sets = [], vals = [];
      if (b.mensal !== undefined) { vals.push(cent(String(b.mensal).replace(',', '.'))); sets.push('mensal = $' + vals.length); }
      ['acumula', 'ativo'].forEach((k) => { if (b[k] !== undefined) { vals.push(Boolean(b[k])); sets.push(k + ' = $' + vals.length); } });
      if (b.desde) { vals.push(b.desde + (b.desde.length === 7 ? '-01' : '')); sets.push('desde = $' + vals.length); }
      if (sets.length) { vals.push(req.params.id); await query('UPDATE fin_orcamentos SET ' + sets.join(', ') + ' WHERE id = $' + vals.length, vals); }
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'o orçamento'); }
  });
  app.delete('/api/financas/orcamentos/:id(\\d+)', async (req, res) => {
    try { await query('DELETE FROM fin_orcamentos WHERE id = $1', [req.params.id]); res.json({ ok: true }); }
    catch (e) { falha(res, e, 'o orçamento'); }
  });

  /* ---- bens ---- */
  app.post('/api/financas/bens', async (req, res) => {
    try {
      const b = req.body || {};
      if (!String(b.nome || '').trim()) throw erro(400, 'Falta o nome.');
      const num = (x) => (x === '' || x == null ? null : cent(String(x).replace(/\s/g, '').replace(',', '.')));
      const r = (await all(
        `INSERT INTO fin_bens (nome, lado, classe, valor, valor_em, prestacao, termina, context_id, pessoal, nota)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [b.nome.trim(), b.lado === 'passivo' ? 'passivo' : 'ativo', b.classe || 'outro', num(b.valor), b.valor_em || null,
          num(b.prestacao), b.termina || null, b.context_id || null, b.pessoal !== false, b.nota || null]))[0];
      res.json({ id: r.id });
    } catch (e) { falha(res, e, 'o bem'); }
  });
  app.patch('/api/financas/bens/:id(\\d+)', async (req, res) => {
    try {
      const b = req.body || {}; const sets = [], vals = [];
      const num = (x) => (x === '' || x == null ? null : cent(String(x).replace(/\s/g, '').replace(',', '.')));
      ['nome', 'lado', 'classe', 'valor_em', 'termina', 'context_id', 'pessoal', 'nota', 'ativo'].forEach((k) => { if (b[k] !== undefined) { vals.push(b[k] === '' ? null : b[k]); sets.push(k + ' = $' + vals.length); } });
      ['valor', 'prestacao'].forEach((k) => { if (b[k] !== undefined) { vals.push(num(b[k])); sets.push(k + ' = $' + vals.length); } });
      if (sets.length) { vals.push(req.params.id); await query('UPDATE fin_bens SET ' + sets.join(', ') + ' WHERE id = $' + vals.length, vals); }
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'o bem'); }
  });
  app.delete('/api/financas/bens/:id(\\d+)', async (req, res) => {
    try { await query('DELETE FROM fin_bens WHERE id = $1', [req.params.id]); res.json({ ok: true }); }
    catch (e) { falha(res, e, 'o bem'); }
  });

  /* ---- alertas ---- */
  app.put('/api/financas/alertas', async (req, res) => {
    try {
      const cfg = Object.assign(await alertasConfig(), req.body || {});
      await query(`INSERT INTO settings (key, value) VALUES ('fin_alertas', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(cfg)]);
      res.json(cfg);
    } catch (e) { falha(res, e, 'os alertas'); }
  });

  cc.instalar(app, falha);
}

module.exports = { instalar, preparar, categorizar, _teste: { chave, norm, recorrentes, saldoEm, somaMes, mesesAte } };
