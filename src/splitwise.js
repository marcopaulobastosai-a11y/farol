'use strict';
/**
 * Farol - a despesa que se divide, no Splitwise.
 *
 * Um pagamento ja escreve a despesa nas Financas. Quando o dinheiro e de dois
 * - a renda, as contas da casa, a escola dos miudos - a mesma despesa tem de
 * ir tambem para o Splitwise. Copiar a mao e o que se fazia; e e a copiar a
 * mao que se perde metade.
 *
 * A ligacao e uma chave pessoal do Splitwise (secure.splitwise.com/apps, na
 * pagina da aplicacao: «generate API key»). Cola-se em Administracao ›
 * Splitwise e vai cifrada na settings, como o acesso ao Gmail: nunca sai
 * daqui para o ecra - o ecra so sabe se esta ligada e a quem. Tambem serve
 * colada nas Variables do Railway (SPLITWISE_API_KEY), e ai manda essa.
 *
 * Os grupos leem-se de la (`get_groups`) e ficam guardados com os membros:
 * assim escolhe-se quem paga e como se divide sem voltar a bater a API a cada
 * janela. `ativo` e o que aparece para escolher num pagamento; `omissao` e o
 * que vem proposto.
 *
 * Nada sobe sozinho: quem paga e que marca a caixa na janela de dar por pago.
 * E a despesa que ficar criada la guarda o id na despesa do Farol, para a
 * mesma coisa nao ir duas vezes.
 */
const crypto = require('crypto');
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;
const limpar = (v) => (v === undefined || v === '' ? null : v);

const BASE = 'https://secure.splitwise.com/api/v3.0';
const SEGREDO = process.env.SESSION_SECRET || '';

function erro(codigo, msg) { const e = new Error(msg); e.status = codigo; return e; }

/* ---------------- a chave, cifrada ---------------- */
function chaveCifra() { return crypto.createHash('sha256').update(SEGREDO + ':splitwise').digest(); }
function cifrar(txt) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chaveCifra(), iv);
  const dados = Buffer.concat([c.update(String(txt), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), dados]).toString('base64');
}
function decifrar(b64) {
  const b = Buffer.from(String(b64), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', chaveCifra(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

async function lerLigacao() {
  const r = (await all("SELECT value FROM settings WHERE key = 'splitwise'"))[0];
  if (!r) return null;
  try { return JSON.parse(r.value); } catch (e) { return null; }
}
async function gravarLigacao(v) {
  await query(
    `INSERT INTO settings (key, value) VALUES ('splitwise', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(v)]);
}

/* A chave pode estar colada nas Variables do Railway (SPLITWISE_API_KEY) em
   vez de ligada no ecra. Vale como ligacao, so nao se apaga daqui. */
const chaveDaVariavel = () => (process.env.SPLITWISE_API_KEY || '').trim() || null;

async function chave() {
  const l = await lerLigacao();
  if (l && l.chave) { try { return decifrar(l.chave); } catch (e) { /* segue para a variavel */ } }
  return chaveDaVariavel();
}

/* ---------------- falar com o Splitwise ---------------- */
/* A chave pode vir de fora (para se experimentar antes de gravar). */
async function pedir(caminho, opcoes) {
  const o = opcoes || {};
  const k = o.chave || await chave();
  if (!k) throw erro(409, 'O Splitwise ainda não está ligado.');
  let r;
  try {
    r = await fetch(BASE + caminho, {
      method: o.metodo || 'GET',
      headers: Object.assign({ Authorization: 'Bearer ' + k },
        o.corpo ? { 'Content-Type': 'application/json' } : {}),
      body: o.corpo ? JSON.stringify(o.corpo) : undefined,
      signal: AbortSignal.timeout(20000)
    });
  } catch (e) {
    throw erro(502, 'Não foi possível falar com o Splitwise: ' + e.message);
  }
  if (r.status === 401 || r.status === 403) throw erro(401, 'O Splitwise recusou a chave. Gera outra e liga de novo.');
  const txt = await r.text();
  let j = null;
  try { j = txt ? JSON.parse(txt) : null; } catch (e) { j = null; }
  if (!r.ok) {
    const m = j && (j.error || (j.errors && JSON.stringify(j.errors))) || ('erro ' + r.status);
    throw erro(502, 'O Splitwise respondeu: ' + m);
  }
  /* O create_expense responde 200 com a lista de erros la dentro. */
  if (j && j.errors && Object.keys(j.errors).length) {
    const m = Object.keys(j.errors).map((k2) => k2 + ': ' + [].concat(j.errors[k2]).join(', ')).join('; ');
    throw erro(400, 'O Splitwise não aceitou: ' + m);
  }
  return j;
}

const nomeDe = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || ('#' + u.id);

async function quemSou(k) {
  const j = await pedir('/get_current_user', { chave: k });
  const u = (j && j.user) || {};
  return { id: u.id, nome: nomeDe(u), email: u.email };
}

/* Os grupos como o Splitwise os tem. O grupo 0 e «sem grupo» e nao entra. */
async function lerGrupos(k) {
  const j = await pedir('/get_groups', { chave: k });
  return (j && j.groups || []).filter((g) => Number(g.id) !== 0).map((g) => ({
    id: Number(g.id),
    nome: g.name,
    moeda: g.simplify_by_default !== undefined && g.original_debts && g.original_debts[0]
      ? g.original_debts[0].currency_code : null,
    membros: (g.members || []).map((m) => ({ id: Number(m.id), nome: nomeDe(m), email: m.email || null }))
  }));
}

/* Guarda o que veio de la sem apagar as escolhas que ja estavam feitas (o
   que esta disponivel para escolher, e o que vem proposto). */
async function sincronizar(k) {
  const grupos = await lerGrupos(k);
  for (const g of grupos) {
    await query(
      `INSERT INTO splitwise_grupos (id, nome, moeda, membros, lido_em)
       VALUES ($1,$2,$3,$4::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, moeda = COALESCE(EXCLUDED.moeda, splitwise_grupos.moeda),
                                      membros = EXCLUDED.membros, lido_em = now()`,
      [g.id, g.nome, g.moeda, JSON.stringify(g.membros)]);
  }
  return grupos.length;
}

/* O id do grupo e um BIGINT, e o Postgres devolve BIGINT como texto. Os ids
   do Splitwise cabem num numero de JavaScript, e o ecra compara-os com ===,
   por isso voltam daqui como numeros. */
const gruposGuardados = async () => (await all(
  `SELECT id, nome, moeda, membros, ativo, omissao,
          to_char(lido_em AT TIME ZONE 'Europe/Lisbon','YYYY-MM-DD HH24:MI') AS lido_em
     FROM splitwise_grupos ORDER BY ativo DESC, nome`)).map((g) => Object.assign({}, g, { id: Number(g.id) }));

/* ---------------- lancar a despesa ---------------- */
const cent = (v) => Math.round(Number(v) * 100) / 100;
const euros = (v) => cent(v).toFixed(2);

/* As partes tem de somar ao total, ao centimo: o Splitwise recusa se nao
   somarem, e o arredondamento da divisao por tres deixa sempre um cent a
   mais ou a menos. A diferenca fica com quem pagou. */
function fecharContas(total, partes, quemPaga) {
  const t = cent(total);
  const l = partes.map((p) => ({ user_id: Number(p.user_id), owed: cent(p.owed || 0) }));
  const soma = cent(l.reduce((s, p) => s + p.owed, 0));
  const falta = cent(t - soma);
  if (Math.abs(falta) >= 0.01) {
    const alvo = l.filter((p) => p.user_id === Number(quemPaga))[0] || l[0];
    if (alvo) alvo.owed = cent(alvo.owed + falta);
  }
  return l;
}

async function lancar(d) {
  const grupo = Number(d.grupo);
  if (!grupo) throw erro(400, 'Falta dizer o grupo do Splitwise.');
  const g = (await all('SELECT id, nome, membros FROM splitwise_grupos WHERE id = $1', [grupo]))[0];
  if (!g) throw erro(404, 'Esse grupo não está na lista. Lê os grupos outra vez.');
  const total = cent(d.valor);
  if (!(total > 0)) throw erro(400, 'A despesa precisa de um valor.');
  const eu = await quemSou();
  const paga = Number(d.pago_por) || eu.id;

  let partes = Array.isArray(d.partes) && d.partes.length ? d.partes : null;
  if (!partes) {
    /* Sem divisao dita, parte igual por todos os membros do grupo. */
    const m = g.membros || [];
    const cada = cent(total / (m.length || 1));
    partes = m.map((x) => ({ user_id: x.id, owed: cada }));
  }
  partes = fecharContas(total, partes, paga);

  const corpo = {
    cost: euros(total),
    description: String(d.descricao || 'Despesa').slice(0, 120),
    group_id: grupo,
    date: (d.data ? String(d.data).slice(0, 10) : new Date().toISOString().slice(0, 10)) + 'T12:00:00Z',
    currency_code: d.moeda || 'EUR'
  };
  if (d.detalhe) corpo.details = String(d.detalhe).slice(0, 500);
  partes.forEach((p, i) => {
    corpo['users__' + i + '__user_id'] = p.user_id;
    corpo['users__' + i + '__paid_share'] = euros(p.user_id === paga ? total : 0);
    corpo['users__' + i + '__owed_share'] = euros(p.owed);
  });
  /* Quem paga pode nao estar na lista das partes (pagou e nao deve nada). */
  if (!partes.some((p) => p.user_id === paga)) {
    const i = partes.length;
    corpo['users__' + i + '__user_id'] = paga;
    corpo['users__' + i + '__paid_share'] = euros(total);
    corpo['users__' + i + '__owed_share'] = euros(0);
  }

  const j = await pedir('/create_expense', { metodo: 'POST', corpo });
  const feita = (j && j.expenses && j.expenses[0]) || null;
  if (!feita) throw erro(502, 'O Splitwise não devolveu a despesa criada.');
  console.log('[farol] splitwise: despesa', feita.id, '-', corpo.description, euros(total), 'no grupo', g.nome);
  return { id: Number(feita.id), grupo: g.nome, total: euros(total), partes };
}

/* ---------------- rotas ---------------- */
function instalar(app, opcoes) {
  /* Sem quem administre, vale o login: todo o /api ja esta atras dele. */
  const ehAdmin = (opcoes && opcoes.ehAdmin) || (() => true);
  const falha = (res, err, onde) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[farol] ' + onde + ':', err.message);
    return res.status(500).json({ error: 'Não foi possível falar com o Splitwise.' });
  };
  const soAdmin = (req, res, next) => (ehAdmin(req) ? next()
    : res.status(403).json({ error: 'Só quem administra pode mexer aqui.' }));

  app.get('/api/splitwise', async (req, res) => {
    try {
      const l = await lerLigacao();
      const porVariavel = !(l && l.chave) && Boolean(chaveDaVariavel());
      res.json({
        ligado: Boolean(l && l.chave) || porVariavel,
        por_variavel: porVariavel,
        segredo: Boolean(SEGREDO),
        utilizador: (l && l.utilizador) || null,
        grupos: await gruposGuardados()
      });
    } catch (err) { falha(res, err, 'GET splitwise'); }
  });

  /* Ligar: experimenta-se a chave antes de a guardar, e leem-se os grupos. */
  app.post('/api/splitwise/chave', soAdmin, async (req, res) => {
    const k = String((req.body || {}).chave || '').trim();
    if (!k) return res.status(400).json({ error: 'Falta a chave.' });
    if (!SEGREDO) return res.status(503).json({ error: 'Falta a variável SESSION_SECRET para guardar a chave em segurança.' });
    try {
      const eu = await quemSou(k);
      await gravarLigacao({ chave: cifrar(k), utilizador: eu, desde: new Date().toISOString() });
      const n = await sincronizar(k);
      console.log('[farol] splitwise ligado a', eu.email, '-', n, 'grupos');
      res.json({ ok: true, utilizador: eu, grupos: await gruposGuardados() });
    } catch (err) { falha(res, err, 'POST chave splitwise'); }
  });

  app.delete('/api/splitwise/chave', soAdmin, async (req, res) => {
    try {
      await query("DELETE FROM settings WHERE key = 'splitwise'");
      res.json({ ok: true });
    } catch (err) { falha(res, err, 'DELETE chave splitwise'); }
  });

  /* Os grupos como estao la agora, sem mexer no que esta guardado: serve para
     confirmar que a chave funciona. */
  app.get('/api/splitwise/grupos', async (req, res) => {
    try {
      const k = await chave();
      if (!k) return res.status(503).json({ error: 'O Splitwise ainda nao esta ligado.' });
      const eu = await quemSou(k);
      const grupos = await lerGrupos(k);
      res.json({ ligado_como: eu.nome || eu.email, total: grupos.length, grupos });
    } catch (err) { falha(res, err, 'GET grupos splitwise'); }
  });

  /* Ler os grupos outra vez: entrou gente nova, mudou o nome. */
  app.post('/api/splitwise/grupos', soAdmin, async (req, res) => {
    try {
      const n = await sincronizar();
      res.json({ ok: true, lidos: n, grupos: await gruposGuardados() });
    } catch (err) { falha(res, err, 'POST grupos splitwise'); }
  });

  /* O que fica disponivel para escolher num pagamento, e o que vem proposto. */
  app.patch('/api/splitwise/grupos/:id(\\d+)', soAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    try {
      if (b.ativo !== undefined) {
        await query('UPDATE splitwise_grupos SET ativo = $2 WHERE id = $1', [id, Boolean(b.ativo)]);
        if (!b.ativo) await query('UPDATE splitwise_grupos SET omissao = FALSE WHERE id = $1', [id]);
      }
      if (b.omissao !== undefined) {
        if (b.omissao) await query('UPDATE splitwise_grupos SET omissao = FALSE');
        await query('UPDATE splitwise_grupos SET omissao = $2, ativo = ativo OR $2 WHERE id = $1', [id, Boolean(b.omissao)]);
      }
      res.json({ ok: true, grupos: await gruposGuardados() });
    } catch (err) { falha(res, err, 'PATCH grupo splitwise'); }
  });

  /* Lancar a despesa de um pagamento. Vem depois de o pagamento ficar pago:
     se o Splitwise falhar, o pagamento fica na mesma - so nao subiu. */
  app.post('/api/splitwise/despesa', async (req, res) => {
    const b = req.body || {};
    try {
      const t = Number(b.task_id) || null;
      let despesa = null;
      if (t) {
        const linha = (await all(
          `SELECT e.id, e.splitwise_id FROM tasks t JOIN expenses e ON e.id = t.expense_id
            WHERE t.id = $1`, [t]))[0];
        if (linha && linha.splitwise_id) {
          return res.status(409).json({ error: 'Esta despesa já foi para o Splitwise.' });
        }
        despesa = linha ? linha.id : null;
      } else if (Number(b.expense_id)) {
        /* Uma despesa que entrou pela caixa (um talao, uma fatura ja paga):
           sobe ao aprovar, ligada a despesa do Farol como a de um pagamento. */
        const linha = (await all('SELECT id, splitwise_id FROM expenses WHERE id = $1', [Number(b.expense_id)]))[0];
        if (!linha) return res.status(404).json({ error: 'Essa despesa já não existe.' });
        if (linha.splitwise_id) return res.status(409).json({ error: 'Esta despesa já foi para o Splitwise.' });
        despesa = linha.id;
      }
      const feita = await lancar(b);
      if (despesa) await query('UPDATE expenses SET splitwise_id = $2 WHERE id = $1', [despesa, feita.id]);
      res.status(201).json({ ok: true, despesa: feita });
    } catch (err) { falha(res, err, 'POST despesa splitwise'); }
  });
}

module.exports = { instalar, lancar, lerGrupos, quemSou, fecharContas, pedir, ativo: async () => Boolean(await chave()) };
