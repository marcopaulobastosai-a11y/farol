'use strict';
/**
 * Farol — o calendário Google de cada pessoa da casa.
 *
 * Isto não é o Gmail dos pagamentos (src/emails.js), que é uma conta só, a da
 * casa, e que apenas ENVIA. Aqui cada pessoa liga a SUA conta Google e o Farol
 * pede licença para LER o calendário dela (calendar.readonly). Quem liga
 * autoriza na própria conta e pode desligar quando quiser.
 *
 * O que fica guardado é o acesso que a Google devolve, cifrado com uma chave
 * tirada do SESSION_SECRET — nunca uma palavra-passe.
 *
 * Os eventos entram na tabela `events` com origin = 'google' e um calendário
 * próprio por pessoa (código google-<id>, com o nome e a cor dela). Como as
 * rotas de corrigir e apagar eventos só mexem no que tem origin 'real', um
 * evento do Google não se edita no Farol: corrige-se no Google e a leitura
 * seguinte traz a correcção. Cada leitura também apaga o que já lá não está —
 * mas só dentro da janela lida e só o que veio daquela conta.
 *
 * Credenciais: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET, os mesmos do login e
 * do envio de email. No Google Cloud é preciso ativar a Calendar API, juntar
 * o âmbito ao ecrã de consentimento e acrescentar o redirecionamento
 * /api/google/callback ao cliente OAuth.
 */
const crypto = require('crypto');
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;

const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const SEGREDO = process.env.SESSION_SECRET || '';
const TZ = (process.env.FAROL_TZ || 'Europe/Lisbon').trim();
const ESCOPOS = 'openid email profile https://www.googleapis.com/auth/calendar.readonly';
const COOKIE_ESTADO = 'farol_google_estado';
/* A janela que se lê: dois meses para trás (para a Agenda ter passado) e
   pouco mais de um ano para a frente. Fora dela o Farol não mexe. */
const DIAS_ATRAS = 60;
const DIAS_FRENTE = 400;
const CADA = 15 * 60 * 1000;   // de quanto em quanto tempo se relê

const configurado = () => Boolean(CLIENT_ID && CLIENT_SECRET && SEGREDO);

/* ---------------- cifra do acesso ---------------- */
function chave() { return crypto.createHash('sha256').update(SEGREDO + ':google').digest(); }
function cifrar(txt) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave(), iv);
  const dados = Buffer.concat([c.update(String(txt), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), dados]).toString('base64');
}
function decifrar(b64) {
  const b = Buffer.from(String(b64), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', chave(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

/* ---------------- Google ---------------- */
function redirecionamento(req) {
  if (process.env.GOOGLE_REDIRECT) return process.env.GOOGLE_REDIRECT.trim();
  const host = (req && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
  return 'https://' + host + '/api/google/callback';
}

async function pedirToken(campos) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(Object.assign({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }, campos))
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('A Google recusou o acesso: ' + (j.error_description || j.error || r.status));
  return j;
}

function payloadDo(idToken) {
  try {
    const p = String(idToken || '').split('.')[1];
    return JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch (e) { return {}; }
}

/* Um acesso curto por pessoa, guardado em memória enquanto dura. */
const CACHE = new Map();
async function acessoDe(pessoaId) {
  const c = CACHE.get(pessoaId);
  if (c && c.ate > Date.now() + 60000) return c.token;
  const l = (await all('SELECT token FROM google_contas WHERE person_id = $1', [pessoaId]))[0];
  if (!l) throw new Error('Esta pessoa não tem o Google ligado.');
  const j = await pedirToken({ grant_type: 'refresh_token', refresh_token: decifrar(l.token) });
  CACHE.set(pessoaId, { token: j.access_token, ate: Date.now() + (Number(j.expires_in) || 3000) * 1000 });
  return j.access_token;
}

/* ---------------- ler o calendário ---------------- */
const DIA = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);

/* A Google manda a hora com o fuso dela; a Agenda do Farol trabalha em dia e
   hora local. O Intl faz a conversão sem trazer uma biblioteca. */
function localDe(dateTime) {
  const d = new Date(dateTime);
  if (isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  const s = f.format(d).replace('T', ' ');
  return { day: s.slice(0, 10), at: s.slice(11, 16) };
}

/* Um evento da Google como o Farol o guarda. Devolve null ao que não serve:
   o que foi cancelado, o que não tem data, o que não tem nome. */
function paraFarol(ev) {
  if (!ev || ev.status === 'cancelled') return null;
  const ini = ev.start || {};
  let day = null, at = null;
  if (ini.date) {
    day = String(ini.date).slice(0, 10);
  } else if (ini.dateTime) {
    const l = localDe(ini.dateTime);
    if (!l) return null;
    day = l.day; at = l.at;
  }
  if (!day) return null;
  const titulo = String(ev.summary || '').trim() || '(sem título)';
  const partes = [];
  if (ev.location) partes.push(String(ev.location).replace(/\s+/g, ' ').trim());
  if (ev.description) partes.push(String(ev.description).replace(/\s+/g, ' ').trim());
  const detalhe = partes.join('  ·  ').slice(0, 300) || null;
  return { google_id: String(ev.id), day, at, title: titulo.slice(0, 200), detail: detalhe };
}

async function pedirEventos(pessoaId, calendario) {
  const token = await acessoDe(pessoaId);
  const agora = Date.now();
  const base = 'https://www.googleapis.com/calendar/v3/calendars/'
    + encodeURIComponent(calendario || 'primary') + '/events';
  const comuns = {
    singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', showDeleted: 'false',
    timeMin: new Date(agora - DIAS_ATRAS * DIA).toISOString(),
    timeMax: new Date(agora + DIAS_FRENTE * DIA).toISOString()
  };
  const fora = [];
  let pagina = null;
  for (let i = 0; i < 6; i++) {
    const p = new URLSearchParams(comuns);
    if (pagina) p.set('pageToken', pagina);
    const r = await fetch(base + '?' + p.toString(), { headers: { Authorization: 'Bearer ' + token } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (j.error && (j.error.message || j.error.status)) || ('erro ' + r.status);
      throw new Error('A Google não deixou ler o calendário: ' + msg);
    }
    (j.items || []).forEach((ev) => { const x = paraFarol(ev); if (x) fora.push(x); });
    pagina = j.nextPageToken;
    if (!pagina) break;
  }
  return fora;
}

/* Guarda o que se leu: cria ou actualiza cada evento, liga-o à pessoa e
   apaga, dentro da janela lida, o que já não existe do lado da Google. */
async function guardar(pessoa, eventos) {
  const codigo = 'google-' + pessoa.id;
  await query(
    `INSERT INTO calendars (code, name, color, sort) VALUES ($1, $2, $3, 60)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color`,
    [codigo, pessoa.name, pessoa.color || 'var(--c1)']);

  for (const e of eventos) {
    const rows = await all(
      `INSERT INTO events (day, at, title, calendar, detail, origin, google_id, google_pessoa, sort)
       VALUES ($1,$2,$3,$4,$5,'google',$6,$7,0)
       ON CONFLICT (google_pessoa, google_id) WHERE google_id IS NOT NULL DO UPDATE
         SET day = EXCLUDED.day, at = EXCLUDED.at, title = EXCLUDED.title,
             detail = EXCLUDED.detail, calendar = EXCLUDED.calendar
       RETURNING id`,
      [e.day, e.at, e.title, codigo, e.detail, e.google_id, pessoa.id]);
    await query('INSERT INTO event_people (event_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [rows[0].id, pessoa.id]);
  }

  const agora = Date.now();
  const apagados = await all(
    `DELETE FROM events
      WHERE google_pessoa = $1 AND origin = 'google'
        AND day BETWEEN $2 AND $3
        AND NOT (google_id = ANY($4))
      RETURNING id`,
    [pessoa.id, iso(agora - DIAS_ATRAS * DIA), iso(agora + DIAS_FRENTE * DIA),
     eventos.map((e) => e.google_id)]);
  return { guardados: eventos.length, apagados: apagados.length };
}

async function sincronizar(pessoaId) {
  const p = (await all(
    `SELECT p.id, p.name, p.color, g.calendario
       FROM people p JOIN google_contas g ON g.person_id = p.id
      WHERE p.id = $1`, [pessoaId]))[0];
  if (!p) throw new Error('Esta pessoa não tem o Google ligado.');
  try {
    const eventos = await pedirEventos(p.id, p.calendario);
    const r = await guardar(p, eventos);
    await query('UPDATE google_contas SET lido_em = now(), erro = NULL WHERE person_id = $1', [p.id]);
    console.log('[farol] calendário de ' + p.name + ': ' + r.guardados + ' eventos, ' + r.apagados + ' fora');
    return r;
  } catch (err) {
    /* O erro fica à vista na ficha em vez de morrer na consola: um acesso
       retirado do lado da Google só se percebe assim. */
    await query('UPDATE google_contas SET erro = $2 WHERE person_id = $1', [p.id, err.message.slice(0, 300)]);
    CACHE.delete(p.id);
    throw err;
  }
}

async function sincronizarTodas() {
  if (!configurado()) return;
  let contas = [];
  try { contas = await all('SELECT person_id FROM google_contas'); }
  catch (err) { return; }   /* base ainda sem a tabela: o arranque trata disso */
  for (const c of contas) {
    try { await sincronizar(c.person_id); }
    catch (err) { console.warn('[farol] calendário Google:', err.message); }
  }
}

async function arrancar() {
  if (!configurado()) return;
  setTimeout(() => { sincronizarTodas().catch(() => {}); }, 8000);
  setInterval(() => { sincronizarTodas().catch(() => {}); }, CADA);
}

/* O estado que a ficha de cada pessoa mostra. */
async function estadoDe(pessoaId) {
  const r = (await all(
    `SELECT g.email, g.escopos, g.erro, g.calendario,
            to_char(g.ligado_em, 'YYYY-MM-DD"T"HH24:MI') AS ligado_em,
            (extract(epoch from g.lido_em) * 1000)::bigint::text AS lido_ms,
            (SELECT count(*)::int FROM events e
              WHERE e.google_pessoa = g.person_id AND e.day >= CURRENT_DATE) AS proximos
       FROM google_contas g WHERE g.person_id = $1`, [pessoaId]))[0];
  return { configurado: configurado(), ligado: Boolean(r), conta: r || null };
}

/* ---------------- ligação ao Express ---------------- */
function instalar(app) {
  const falha = (res, err, onde) => {
    console.error('[farol] ' + onde + ':', err.message);
    res.status(400).json({ error: err.message || 'Não foi possível.' });
  };

  app.get('/api/google/estado', async (req, res) => {
    try {
      if (req.query.pessoa) return res.json(await estadoDe(Number(req.query.pessoa)));
      const contas = await all(
        `SELECT g.person_id, p.name, g.email, g.erro,
                to_char(g.lido_em, 'YYYY-MM-DD"T"HH24:MI') AS lido_em
           FROM google_contas g JOIN people p ON p.id = g.person_id ORDER BY p.sort, p.id`);
      res.json({ configurado: configurado(), contas });
    } catch (err) { falha(res, err, 'GET google/estado'); }
  });

  /* Começar a ligação de uma pessoa. O estado leva o id dela e vai também
     num cookie: sem os dois iguais, o callback não faz nada. */
  app.get('/api/google/ligar', (req, res) => {
    const pessoa = Number(req.query.pessoa);
    if (!Number.isInteger(pessoa)) return res.status(400).send('Falta a pessoa.');
    if (!configurado()) return res.status(400).send('Faltam as credenciais da Google no servidor.');
    const estado = pessoa + '.' + crypto.randomBytes(16).toString('hex');
    res.setHeader('Set-Cookie', COOKIE_ESTADO + '=' + estado
      + '; Path=/api/google; HttpOnly; Secure; SameSite=Lax; Max-Age=600');
    const p = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: redirecionamento(req), response_type: 'code',
      scope: ESCOPOS, access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
      state: estado
    });
    res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + p.toString());
  });

  app.get('/api/google/callback', async (req, res) => {
    const volta = (msg) => res.redirect('/?google=' + encodeURIComponent(msg));
    try {
      const estado = String(req.query.state || '');
      const cookie = String(req.headers.cookie || '')
        .split(';').map((s) => s.trim()).find((s) => s.startsWith(COOKIE_ESTADO + '='));
      if (!estado || !cookie || cookie.slice(COOKIE_ESTADO.length + 1) !== estado) return volta('estado');
      const pessoa = Number(estado.split('.')[0]);
      if (!Number.isInteger(pessoa)) return volta('estado');
      if (req.query.error) return volta('recusado');

      const j = await pedirToken({
        grant_type: 'authorization_code', code: String(req.query.code || ''),
        redirect_uri: redirecionamento(req)
      });
      if (!j.refresh_token) return volta('sem-acesso');
      if (!String(j.scope || '').includes('calendar')) return volta('sem-calendario');
      const quem = payloadDo(j.id_token);
      await query(
        `INSERT INTO google_contas (person_id, email, escopos, token, ligado_em, erro)
         VALUES ($1,$2,$3,$4, now(), NULL)
         ON CONFLICT (person_id) DO UPDATE
           SET email = EXCLUDED.email, escopos = EXCLUDED.escopos, token = EXCLUDED.token,
               ligado_em = now(), erro = NULL`,
        [pessoa, String(quem.email || '').toLowerCase(), String(j.scope || ''), cifrar(j.refresh_token)]);
      CACHE.delete(pessoa);
      res.setHeader('Set-Cookie', COOKIE_ESTADO + '=; Path=/api/google; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      /* Ler já, para quem ligou ver o calendário na Agenda sem esperar. */
      try { await sincronizar(pessoa); } catch (err) { console.warn('[farol] primeira leitura:', err.message); }
      volta('ok');
    } catch (err) {
      console.error('[farol] google callback:', err.message);
      volta('erro');
    }
  });

  app.post('/api/google/sincronizar', async (req, res) => {
    try {
      const pessoa = Number((req.body || {}).pessoa);
      if (Number.isInteger(pessoa)) {
        const r = await sincronizar(pessoa);
        return res.json(Object.assign({ ok: true }, r, await estadoDe(pessoa)));
      }
      await sincronizarTodas();
      res.json({ ok: true });
    } catch (err) { falha(res, err, 'POST google/sincronizar'); }
  });

  /* Desligar leva os eventos daquela conta: o que estava no Farol por causa
     do Google deixa de fazer sentido sem ele. O calendário da pessoa fica
     vazio e sai da lista. */
  app.post('/api/google/desligar', async (req, res) => {
    try {
      const pessoa = Number((req.body || {}).pessoa);
      if (!Number.isInteger(pessoa)) return res.status(400).json({ error: 'Falta a pessoa.' });
      const l = (await all('SELECT token FROM google_contas WHERE person_id = $1', [pessoa]))[0];
      if (l) {
        /* Dizer à Google que não se quer mais; se falhar, segue-se na mesma. */
        try {
          await fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(decifrar(l.token)),
            { method: 'POST' });
        } catch (err) { /* o acesso pode já ter sido retirado do outro lado */ }
      }
      await query("DELETE FROM events WHERE google_pessoa = $1 AND origin = 'google'", [pessoa]);
      await query('DELETE FROM calendars WHERE code = $1', ['google-' + pessoa]);
      await query('DELETE FROM google_contas WHERE person_id = $1', [pessoa]);
      CACHE.delete(pessoa);
      res.json({ ok: true, ligado: false });
    } catch (err) { falha(res, err, 'POST google/desligar'); }
  });
}

module.exports = { instalar, arrancar, estadoDe, sincronizar, sincronizarTodas, paraFarol, configurado };
