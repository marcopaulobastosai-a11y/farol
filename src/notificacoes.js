'use strict';
/**
 * Farol - notificacoes push (26 out 2026).
 *
 * O telemovel (a app instalada no ecra principal) subscreve em Areas ›
 * Definicoes; o servidor guarda a subscricao e, de minuto a minuto, ve se
 * ha alguma coisa a avisar:
 *
 *   lembretes  - os lembretes das tarefas (reminders, em minutos antes do
 *                prazo) e dos eventos (remind_min). Uma tarefa vai para o
 *                responsavel (sem responsavel, para todos); um evento para
 *                as pessoas marcadas nele (sem ninguem, para todos).
 *   manha      - as 8h30, um resumo do dia: o que vence hoje, o que esta em
 *                atraso, eventos de hoje e documentos a caducar em 7 dias.
 *   revisao    - ao domingo as 18h, se a semana ainda nao foi fechada
 *                (so para o administrador).
 *
 * Cada aviso so sai uma vez (push_enviados). As chaves VAPID vivem nas
 * variaveis do Railway (VAPID_PUBLIC, VAPID_PRIVATE): o repositorio e
 * publico. Sem elas, as rotas respondem que as notificacoes estao
 * desligadas e nada corre.
 */
const webpush = require('web-push');
const { query } = require('./db');
const auth = require('./auth');
const acessos = require('./acessos');

const all = async (sql, p) => (await query(sql, p)).rows;
const PUB = process.env.VAPID_PUBLIC || '';
const PRIV = process.env.VAPID_PRIVATE || '';
const SUJ = process.env.VAPID_SUBJECT || 'https://farol-casa.up.railway.app';
const ligado = () => Boolean(PUB && PRIV);
if (ligado()) webpush.setVapidDetails(SUJ, PUB, PRIV);

const PREFS = { lembretes: true, manha: true, revisao: true };

async function preparar() {
  await query(`CREATE TABLE IF NOT EXISTS push_subs (
      id SERIAL PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      email TEXT,
      pessoa_id INTEGER REFERENCES people(id) ON DELETE SET NULL,
      prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
      aparelho TEXT,
      criado TIMESTAMPTZ NOT NULL DEFAULT now(),
      ultimo_ok TIMESTAMPTZ,
      falhas INTEGER NOT NULL DEFAULT 0)`);
  await query(`CREATE TABLE IF NOT EXISTS push_enviados (
      chave TEXT PRIMARY KEY,
      em TIMESTAMPTZ NOT NULL DEFAULT now())`);
}

/* ---------------- quem e quem ---------------- */
async function pessoaDe(email) {
  if (!email) return null;
  const r = await all("SELECT id FROM people WHERE active AND lower(conta_email) = lower($1) LIMIT 1", [email]);
  if (r.length) return r[0].id;
  if (acessos.ehAdmin(email)) {
    const a = await all("SELECT id FROM people WHERE active AND kind = 'adulto' ORDER BY sort, id LIMIT 1");
    return a.length ? a[0].id : null;
  }
  return null;
}
const prefsDe = (s) => Object.assign({}, PREFS, s.prefs || {});

/* ---------------- enviar ---------------- */
async function enviar(sub, msg) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(msg), { TTL: 6 * 3600, urgency: msg.urgente ? 'high' : 'normal' });
    await query('UPDATE push_subs SET ultimo_ok = now(), falhas = 0 WHERE id = $1', [sub.id]);
    return true;
  } catch (e) {
    /* 404/410: o aparelho deixou de aceitar (desinstalou, tirou a licenca). */
    if (e.statusCode === 404 || e.statusCode === 410) {
      await query('DELETE FROM push_subs WHERE id = $1', [sub.id]);
    } else {
      await query('UPDATE push_subs SET falhas = falhas + 1 WHERE id = $1', [sub.id]);
      console.error('[farol] push falhou:', e.statusCode || '', e.message);
    }
    return false;
  }
}
/* Uma vez so: grava a chave antes de enviar; se ja la estava, nao envia. */
async function umaVez(chave) {
  const r = await all('INSERT INTO push_enviados (chave) VALUES ($1) ON CONFLICT DO NOTHING RETURNING chave', [chave]);
  return r.length > 0;
}

/* ---------------- relogio de Lisboa ---------------- */
function lisboa(d) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false })
    .formatToParts(d || new Date()).forEach((x) => { p[x.type] = x.value; });
  return { dia: p.year + '-' + p.month + '-' + p.day, hm: (p.hour === '24' ? '00' : p.hour) + ':' + p.minute, sem: p.weekday };
}
/* Minutos desde a meia-noite UTC de um dia de Lisboa a uma hora de Lisboa:
   comparam-se como «AAAA-MM-DD HH:MM» de Lisboa, que ordenam bem. */
function maisMinutos(dia, hm, min) {
  const [y, m, d] = dia.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h, mi) + min * 60000);
  const z = (n) => String(n).padStart(2, '0');
  return t.getUTCFullYear() + '-' + z(t.getUTCMonth() + 1) + '-' + z(t.getUTCDate()) + ' ' + z(t.getUTCHours()) + ':' + z(t.getUTCMinutes());
}

/* ---------------- os avisos ---------------- */
async function lembretes(subs, agora) {
  const ag = agora.dia + ' ' + agora.hm;
  const limite = maisMinutos(agora.dia, agora.hm, -120); // nao mandar o que ja passou ha mais de 2h
  const msgs = [];
  const ts = await all(
    `SELECT id, title, tipo, owner_id, to_char(due_on,'YYYY-MM-DD') AS dia, to_char(due_time,'HH24:MI') AS hora, reminders
       FROM tasks
      WHERE origin = 'real' AND aprovado AND NOT done AND status = 'aberta' AND due_on IS NOT NULL
        AND jsonb_array_length(COALESCE(reminders,'[]'::jsonb)) > 0
        AND due_on BETWEEN CURRENT_DATE - 1 AND CURRENT_DATE + 31`);
  ts.forEach((t) => {
    (t.reminders || []).forEach((r) => {
      const quando = maisMinutos(t.dia, t.hora || '09:00', Number(r.min) || 0);
      if (quando <= ag && quando > limite) {
        msgs.push({ chave: 'tarefa:' + t.id + ':' + t.dia + ':' + r.min, pessoas: t.owner_id ? [t.owner_id] : null,
          msg: { title: (t.tipo === 'pagamento' ? 'Pagamento: ' : '') + t.title,
                 body: (t.hora ? 'Hoje às ' + t.hora : t.dia === agora.dia ? 'Hoje' : 'Prazo ' + t.dia.split('-').reverse().join('/')),
                 url: '/?tarefa=' + t.id, tag: 'tarefa-' + t.id } });
      }
    });
  });
  const evs = await all(
    `SELECT e.id, e.title, e.at, e.location, to_char(e.day,'YYYY-MM-DD') AS dia, e.remind_min,
            (SELECT array_agg(person_id) FROM event_people ep WHERE ep.event_id = e.id) AS pessoas
       FROM events e
      WHERE e.origin = 'real' AND e.remind_min IS NOT NULL
        AND e.day BETWEEN CURRENT_DATE - 1 AND CURRENT_DATE + 31`);
  evs.forEach((e) => {
    const hm = /^[0-2][0-9]:[0-5][0-9]$/.test(e.at || '') ? e.at : '09:00';
    const quando = maisMinutos(e.dia, hm, -Number(e.remind_min));
    if (quando <= ag && quando > limite) {
      msgs.push({ chave: 'evento:' + e.id + ':' + e.dia + ':' + e.remind_min, pessoas: e.pessoas && e.pessoas.length ? e.pessoas : null,
        msg: { title: e.title, body: [e.at && hm === e.at ? 'Às ' + e.at : 'Hoje', e.location].filter(Boolean).join(' · '),
               url: '/?evento=' + e.id, tag: 'evento-' + e.id } });
    }
  });
  for (const m of msgs) {
    const para = subs.filter((s) => prefsDe(s).lembretes && (!m.pessoas || !s.pessoa_id || m.pessoas.indexOf(s.pessoa_id) >= 0));
    for (const s of para) {
      if (await umaVez(m.chave + ':s' + s.id)) await enviar(s, m.msg);
    }
  }
}

async function resumoDaManha(subs, agora) {
  if (agora.hm < '08:30' || agora.hm > '10:00') return;
  for (const s of subs.filter((x) => prefsDe(x).manha)) {
    if (!(await umaVez('manha:' + agora.dia + ':s' + s.id))) continue;
    const meu = s.pessoa_id ? ' AND (owner_id IS NULL OR owner_id = ' + Number(s.pessoa_id) + ')' : '';
    const [c] = await all(
      `SELECT count(*) FILTER (WHERE due_on = CURRENT_DATE AND tipo <> 'pagamento')::int AS hoje,
              count(*) FILTER (WHERE due_on = CURRENT_DATE AND tipo = 'pagamento')::int AS pagar,
              count(*) FILTER (WHERE due_on < CURRENT_DATE)::int AS atraso
         FROM tasks
        WHERE origin = 'real' AND aprovado AND NOT done AND status = 'aberta' AND tipo <> 'nota' AND parent_id IS NULL` + meu);
    const [e] = await all("SELECT count(*)::int AS n FROM events WHERE origin = 'real' AND day = CURRENT_DATE AND NOT ocupado");
    const [d] = await all(
      `SELECT count(*)::int AS n FROM documents
        WHERE aprovado AND archived_at IS NULL AND valid_on BETWEEN CURRENT_DATE AND CURRENT_DATE + 7`).catch(() => [{ n: 0 }]);
    const partes = [];
    if (c.hoje) partes.push(c.hoje + (c.hoje === 1 ? ' tarefa' : ' tarefas') + ' para hoje');
    if (c.pagar) partes.push(c.pagar + (c.pagar === 1 ? ' pagamento' : ' pagamentos'));
    if (e.n) partes.push(e.n + (e.n === 1 ? ' evento' : ' eventos'));
    if (c.atraso) partes.push(c.atraso + ' em atraso');
    if (d.n) partes.push(d.n + (d.n === 1 ? ' documento a caducar' : ' documentos a caducar'));
    if (!partes.length) continue;
    await enviar(s, { title: 'Bom dia · o teu dia no Farol', body: partes.join(' · '), url: '/', tag: 'manha' });
  }
}

async function revisaoDeDomingo(subs, agora) {
  if (agora.sem !== 'Sun' || agora.hm < '18:00' || agora.hm > '21:00') return;
  const r = await all("SELECT value FROM settings WHERE key = 'revisao_fechos'");
  let fechos = [];
  try { fechos = r.length ? JSON.parse(r[0].value) : []; } catch (e) { fechos = []; }
  if (fechos.some((f) => f.semana === agora.dia)) return;
  for (const s of subs.filter((x) => prefsDe(x).revisao && acessos.ehAdmin(x.email))) {
    if (await umaVez('revisao:' + agora.dia + ':s' + s.id)) {
      await enviar(s, { title: 'Revisão da semana', body: 'Dez minutos para fechar a semana: caixa, contas, atrasos e o que vem aí.', url: '/?ver=revisao', tag: 'revisao' });
    }
  }
}

let aCorrer = false;
async function ronda() {
  if (!ligado() || aCorrer) return;
  aCorrer = true;
  try {
    const subs = await all('SELECT * FROM push_subs');
    if (subs.length) {
      const agora = lisboa();
      await lembretes(subs, agora);
      await resumoDaManha(subs, agora);
      await revisaoDeDomingo(subs, agora);
    }
    await query("DELETE FROM push_enviados WHERE em < now() - INTERVAL '40 days'");
  } catch (e) {
    console.error('[farol] notificacoes:', e.message);
  } finally { aCorrer = false; }
}

/* ---------------- rotas ---------------- */
function instalar(app) {
  const sessao = (req) => auth.sessao(req) || {};

  app.get('/api/push/chave', (_req, res) => res.json({ ligado: ligado(), chave: PUB || null }));

  app.post('/api/push/subscrever', async (req, res) => {
    if (!ligado()) return res.status(503).json({ error: 'As notificações ainda não estão ligadas no servidor.' });
    try {
      const b = req.body || {};
      const s = b.sub || {};
      if (!s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth || !/^https:\/\//.test(s.endpoint)) {
        return res.status(400).json({ error: 'Subscrição inválida.' });
      }
      const email = sessao(req).email || null;
      const prefs = Object.assign({}, PREFS, b.prefs || {});
      const r = await all(
        `INSERT INTO push_subs (endpoint, p256dh, auth, email, pessoa_id, prefs, aparelho)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, email = EXCLUDED.email,
           pessoa_id = EXCLUDED.pessoa_id, prefs = EXCLUDED.prefs, aparelho = EXCLUDED.aparelho, falhas = 0
         RETURNING id, prefs`,
        [s.endpoint, s.keys.p256dh, s.keys.auth, email, await pessoaDe(email), JSON.stringify(prefs), String(b.aparelho || '').slice(0, 120)]);
      res.json({ ok: true, id: r[0].id, prefs: r[0].prefs });
    } catch (e) {
      console.error('[farol] push subscrever:', e.message);
      res.status(500).json({ error: 'Não foi possível ligar as notificações.' });
    }
  });

  app.post('/api/push/estado', async (req, res) => {
    try {
      const ep = String((req.body || {}).endpoint || '');
      const r = ep ? await all('SELECT prefs FROM push_subs WHERE endpoint = $1', [ep]) : [];
      res.json({ ligado: ligado(), subscrito: r.length > 0, prefs: r.length ? Object.assign({}, PREFS, r[0].prefs) : PREFS });
    } catch (e) { res.status(500).json({ error: 'Não foi possível ler.' }); }
  });

  app.post('/api/push/prefs', async (req, res) => {
    try {
      const b = req.body || {};
      const p = {};
      Object.keys(PREFS).forEach((k) => { if (b.prefs && b.prefs[k] !== undefined) p[k] = Boolean(b.prefs[k]); });
      const r = await all("UPDATE push_subs SET prefs = prefs || $2::jsonb WHERE endpoint = $1 RETURNING prefs", [String(b.endpoint || ''), JSON.stringify(p)]);
      if (!r.length) return res.status(404).json({ error: 'Este aparelho não está subscrito.' });
      res.json({ prefs: Object.assign({}, PREFS, r[0].prefs) });
    } catch (e) { res.status(500).json({ error: 'Não foi possível gravar.' }); }
  });

  app.post('/api/push/sair', async (req, res) => {
    try {
      await query('DELETE FROM push_subs WHERE endpoint = $1', [String((req.body || {}).endpoint || '')]);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Não foi possível desligar.' }); }
  });

  app.post('/api/push/teste', async (req, res) => {
    if (!ligado()) return res.status(503).json({ error: 'As notificações ainda não estão ligadas no servidor.' });
    try {
      const r = await all('SELECT * FROM push_subs WHERE endpoint = $1', [String((req.body || {}).endpoint || '')]);
      if (!r.length) return res.status(404).json({ error: 'Este aparelho não está subscrito.' });
      const ok = await enviar(r[0], { title: 'Farol', body: 'As notificações estão a funcionar neste aparelho.', url: '/', tag: 'teste' });
      res.json({ ok });
    } catch (e) { res.status(500).json({ error: 'Não foi possível enviar.' }); }
  });
}

function arrancar() {
  preparar().then(() => {
    console.log('[farol] notificacoes:', ligado() ? 'ligadas' : 'desligadas (faltam VAPID_PUBLIC/VAPID_PRIVATE)');
    setInterval(ronda, 60 * 1000);
    setTimeout(ronda, 15 * 1000);
  }).catch((e) => console.error('[farol] notificacoes (tabelas):', e.message));
}

module.exports = { instalar, arrancar, ronda };
