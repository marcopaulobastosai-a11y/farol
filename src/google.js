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
 * Desde 4 out o Farol tambem ESCREVE (calendar.events), mas so o que e seu:
 * um evento marcado no Farol pode ter uma copia no calendario de cada pessoa
 * que vai (tabela event_google). Corrigir ou apagar no Farol corrige ou apaga
 * a copia; a leitura reconhece as copias e nao as traz de volta. Os eventos
 * que nasceram no Google continuam a corrigir-se no Google.
 *
 * Cada pessoa pode juntar outros calendarios da conta dela
 * (google_calendarios): completos, ou so como «Ocupado» - o do trabalho, em
 * que interessa saber que a hora esta tomada e nao o que e.
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
const ESCOPOS = 'openid email profile https://www.googleapis.com/auth/calendar.readonly'
  + ' https://www.googleapis.com/auth/calendar.events';
/* Quem ligou antes de 4 out so deu licenca para ler. */
const podeEscrever = (escopos) => /auth\/calendar\.events|auth\/calendar(\s|$)/.test(String(escopos || ''));
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
function paraFarol(ev, opts) {
  opts = opts || {};
  if (!ev || ev.status === 'cancelled') return null;
  /* Num calendario «so ocupado», o que esta livre nao conta. */
  if (opts.ocupado && ev.transparency === 'transparent') return null;
  const ini = ev.start || {}, fim = ev.end || {};
  let day = null, at = null, duration = null, endsOn = null;
  if (ini.date) {
    day = String(ini.date).slice(0, 10);
    /* No Google o fim de um dia inteiro e o dia a seguir ao ultimo. */
    if (fim.date) {
      const ult = iso(new Date(String(fim.date).slice(0, 10) + 'T00:00:00Z').getTime() - DIA);
      if (ult > day) endsOn = ult;
    }
  } else if (ini.dateTime) {
    const l = localDe(ini.dateTime);
    if (!l) return null;
    day = l.day; at = l.at;
    if (fim.dateTime) {
      const m = Math.round((new Date(fim.dateTime) - new Date(ini.dateTime)) / 60000);
      if (m > 0 && m <= 60 * 24 * 14) duration = m;
    }
  }
  if (!day) return null;
  const gid = (opts.prefixo || '') + String(ev.id);
  if (opts.ocupado) {
    return { google_id: gid, day, at, duration_min: duration, ends_on: endsOn, location: null,
             title: 'Ocupado', detail: null, ocupado: true };
  }
  const titulo = String(ev.summary || '').trim() || '(sem título)';
  const local = ev.location ? String(ev.location).replace(/\s+/g, ' ').trim().slice(0, 500) : null;
  const detalhe = ev.description ? String(ev.description).replace(/\s+/g, ' ').trim().slice(0, 300) : null;
  return { google_id: gid, day, at, duration_min: duration, ends_on: endsOn, location: local,
           title: titulo.slice(0, 200), detail: detalhe || null, ocupado: false };
}

async function pedirEventos(pessoaId, calendario, opts) {
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
    (j.items || []).forEach((ev) => { const x = paraFarol(ev, opts); if (x) fora.push(x); });
    pagina = j.nextPageToken;
    if (!pagina) break;
  }
  return fora;
}

/* Guarda o que se leu: cria ou actualiza cada evento, liga-o à pessoa e
   apaga, dentro da janela lida, o que já não existe do lado da Google. */
async function guardar(pessoa, eventos) {
  const codigo = 'google-' + pessoa.id;
  /* As copias que o proprio Farol pos neste calendario nao voltam como
     eventos novos: ja estao na Agenda, como eventos do Farol. */
  const copias = new Set((await all('SELECT google_id FROM event_google WHERE person_id = $1', [pessoa.id]))
    .map((r) => r.google_id));
  eventos = eventos.filter((e) => !copias.has(e.google_id));
  await query(
    `INSERT INTO calendars (code, name, color, sort) VALUES ($1, $2, $3, 60)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, color = EXCLUDED.color`,
    [codigo, pessoa.name, pessoa.color || 'var(--c1)']);

  for (const e of eventos) {
    const rows = await all(
      `INSERT INTO events (day, at, title, calendar, detail, origin, google_id, google_pessoa, sort,
                           duration_min, ends_on, location, ocupado, google_cal)
       VALUES ($1,$2,$3,$4,$5,'google',$6,$7,0,$8,$9,$10,$11,$12)
       ON CONFLICT (google_pessoa, google_id) WHERE google_id IS NOT NULL DO UPDATE
         SET day = EXCLUDED.day, at = EXCLUDED.at, title = EXCLUDED.title,
             detail = EXCLUDED.detail, calendar = EXCLUDED.calendar,
             duration_min = EXCLUDED.duration_min, ends_on = EXCLUDED.ends_on,
             location = EXCLUDED.location, ocupado = EXCLUDED.ocupado, google_cal = EXCLUDED.google_cal
       RETURNING id`,
      [e.day, e.at, e.title, codigo, e.detail, e.google_id, pessoa.id,
       e.duration_min || null, e.ends_on || null, e.location || null, Boolean(e.ocupado), e.cal || 'primary']);
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
    const principal = p.calendario || 'primary';
    const eventos = (await pedirEventos(p.id, principal)).map((e) => Object.assign(e, { cal: principal }));
    /* Os outros calendarios escolhidos na ficha. Um que falhe (deixou de
       estar partilhado, por exemplo) nao impede a leitura dos outros: fica
       escrito no erro da ficha. */
    const extra = await all(
      `SELECT cal_id, nome, modo FROM google_calendarios
        WHERE person_id = $1 AND modo IN ('completo','ocupado') AND cal_id <> $2`, [p.id, principal]);
    const avisos = [];
    for (const c of extra) {
      try {
        const lidos = await pedirEventos(p.id, c.cal_id, { ocupado: c.modo === 'ocupado', prefixo: c.cal_id + '|' });
        lidos.forEach((e) => { e.cal = c.cal_id; eventos.push(e); });
      } catch (err) {
        avisos.push((c.nome || c.cal_id) + ': ' + err.message);
      }
    }
    const r = await guardar(p, eventos);
    await query('UPDATE google_contas SET lido_em = now(), erro = $2 WHERE person_id = $1',
      [p.id, avisos.length ? avisos.join(' · ').slice(0, 300) : null]);
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
            (SELECT count(*)::int FROM google_calendarios c
              WHERE c.person_id = g.person_id AND c.modo IN ('completo','ocupado')) AS extra,
            to_char(g.ligado_em, 'YYYY-MM-DD"T"HH24:MI') AS ligado_em,
            (extract(epoch from g.lido_em) * 1000)::bigint::text AS lido_ms,
            (SELECT count(*)::int FROM events e
              WHERE e.google_pessoa = g.person_id AND e.day >= CURRENT_DATE) AS proximos
       FROM google_contas g WHERE g.person_id = $1`, [pessoaId]))[0];
  if (r) r.escrever = podeEscrever(r.escopos);
  return { configurado: configurado(), ligado: Boolean(r), conta: r || null };
}

/* ---------------- os calendarios de cada conta ---------------- */
async function calendariosDe(pessoaId) {
  const token = await acessoDe(pessoaId);
  const r = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250',
    { headers: { Authorization: 'Bearer ' + token } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j.error && (j.error.message || j.error.status)) || ('erro ' + r.status);
    throw new Error('A Google não deixou ver os calendários: ' + msg);
  }
  const modos = new Map((await all('SELECT cal_id, modo FROM google_calendarios WHERE person_id = $1', [pessoaId]))
    .map((x) => [x.cal_id, x.modo]));
  return (j.items || []).map((c) => ({
    id: String(c.id), nome: String(c.summaryOverride || c.summary || c.id), cor: c.backgroundColor || null,
    principal: Boolean(c.primary), acesso: c.accessRole || null,
    modo: c.primary ? 'completo' : (modos.get(String(c.id)) || 'fora')
  })).sort((a, b) => (b.principal - a.principal) || a.nome.localeCompare(b.nome, 'pt'));
}

/* ---------------- escrever: as copias dos eventos do Farol ---------------- */
const pad2 = (n) => String(n).padStart(2, '0');
/* Dia e hora de Lisboa mais uns minutos, sem passar por fusos: a Google
   recebe a hora local com o timeZone ao lado e faz ela a conta. */
function maisMinutos(day, at, min) {
  const [a, m, d] = day.split('-').map(Number);
  const [h, mi] = at.split(':').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d, h, mi) + min * 60000);
  return t.getUTCFullYear() + '-' + pad2(t.getUTCMonth() + 1) + '-' + pad2(t.getUTCDate())
    + 'T' + pad2(t.getUTCHours()) + ':' + pad2(t.getUTCMinutes()) + ':00';
}
function corpoGoogle(ev) {
  const c = {
    summary: ev.title,
    location: ev.location || undefined,
    description: [ev.detail, 'Marcado no Farol — corrige-se lá.'].filter(Boolean).join('\n\n'),
    extendedProperties: { private: { farol: String(ev.id) } }
  };
  if (ev.at && /^\d{2}:\d{2}$/.test(ev.at)) {
    c.start = { dateTime: ev.day + 'T' + ev.at + ':00', timeZone: TZ };
    c.end = { dateTime: maisMinutos(ev.day, ev.at, Number(ev.duration_min) || 60), timeZone: TZ };
  } else {
    const ult = ev.ends_on && ev.ends_on > ev.day ? ev.ends_on : ev.day;
    c.start = { date: ev.day };
    c.end = { date: iso(new Date(ult + 'T00:00:00Z').getTime() + DIA) };
  }
  return c;
}
async function pedidoGoogle(pessoaId, metodo, caminho, corpo) {
  const token = await acessoDe(pessoaId);
  const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events' + caminho, {
    method: metodo,
    headers: Object.assign({ Authorization: 'Bearer ' + token }, corpo ? { 'Content-Type': 'application/json' } : {}),
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  if (metodo === 'DELETE' && (r.ok || r.status === 404 || r.status === 410)) return {};
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error((j.error && (j.error.message || j.error.status)) || ('erro ' + r.status));
    e.status = r.status;
    throw e;
  }
  return j;
}

/* Poe o Google de cada pessoa que vai igual ao evento do Farol: cria a copia
   que falta, corrige a que existe, tira a de quem deixou de ir (ou de todos,
   se o evento deixou de ir para o Google). Devolve o que fez, para a janela
   o dizer. Nunca rebenta: um Google em baixo nao impede gravar no Farol. */
async function espelhar(eventId) {
  const fora = { copiados: [], sem_licenca: [], falhas: [] };
  if (!configurado()) return fora;
  const ev = (await all(
    `SELECT id, to_char(day,'YYYY-MM-DD') AS day, at, title, detail, duration_min,
            to_char(ends_on,'YYYY-MM-DD') AS ends_on, location, no_google, origin
       FROM events WHERE id = $1`, [eventId]))[0];
  if (!ev || ev.origin !== 'real') return fora;
  const quem = ev.no_google ? await all(
    `SELECT p.id, p.name, g.escopos FROM event_people ep
       JOIN people p ON p.id = ep.person_id
       LEFT JOIN google_contas g ON g.person_id = p.id
      WHERE ep.event_id = $1 ORDER BY p.sort, p.id`, [eventId]) : [];
  const alvo = quem.filter((p) => p.escopos && podeEscrever(p.escopos));
  quem.filter((p) => !(p.escopos && podeEscrever(p.escopos))).forEach((p) => fora.sem_licenca.push(p.name));
  const ja = new Map((await all('SELECT person_id, google_id FROM event_google WHERE event_id = $1', [eventId]))
    .map((x) => [x.person_id, x.google_id]));
  const corpo = corpoGoogle(ev);

  for (const p of alvo) {
    try {
      const gid = ja.get(p.id);
      let feito = null;
      if (gid) {
        try { feito = await pedidoGoogle(p.id, 'PATCH', '/' + encodeURIComponent(gid), corpo); }
        catch (err) { if (err.status !== 404 && err.status !== 410) throw err; }   /* apagada la: volta a criar-se */
      }
      if (!feito) {
        feito = await pedidoGoogle(p.id, 'POST', '', corpo);
        await query(
          `INSERT INTO event_google (event_id, person_id, google_id) VALUES ($1,$2,$3)
           ON CONFLICT (event_id, person_id) DO UPDATE SET google_id = EXCLUDED.google_id`,
          [eventId, p.id, String(feito.id)]);
      }
      fora.copiados.push(p.name);
    } catch (err) {
      fora.falhas.push(p.name + ': ' + err.message);
    }
    ja.delete(p.id);
  }
  /* Quem ficou em `ja` ja nao devia ter copia. */
  for (const [pid, gid] of ja) {
    try {
      await pedidoGoogle(pid, 'DELETE', '/' + encodeURIComponent(gid));
      await query('DELETE FROM event_google WHERE event_id = $1 AND person_id = $2', [eventId, pid]);
    } catch (err) { fora.falhas.push('tirar a cópia: ' + err.message); }
  }
  return fora;
}

/* Antes de apagar um evento do Farol, apagar as copias dele no Google. */
async function apagarCopias(eventId) {
  if (!configurado()) return;
  const copias = await all('SELECT person_id, google_id FROM event_google WHERE event_id = $1', [eventId]);
  for (const c of copias) {
    try { await pedidoGoogle(c.person_id, 'DELETE', '/' + encodeURIComponent(c.google_id)); }
    catch (err) { console.warn('[farol] apagar cópia no Google:', err.message); }
  }
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
        `SELECT g.person_id, p.name, g.email, g.erro, g.escopos,
                to_char(g.lido_em, 'YYYY-MM-DD"T"HH24:MI') AS lido_em,
                (extract(epoch from g.lido_em) * 1000)::bigint::text AS lido_ms
           FROM google_contas g JOIN people p ON p.id = g.person_id ORDER BY p.sort, p.id`);
      contas.forEach((c) => { c.escrever = podeEscrever(c.escopos); delete c.escopos; });
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

  /* Os calendarios da conta de uma pessoa e como cada um entra na Agenda. */
  app.get('/api/google/calendarios', async (req, res) => {
    try {
      const pessoa = Number(req.query.pessoa);
      if (!Number.isInteger(pessoa)) return res.status(400).json({ error: 'Falta a pessoa.' });
      res.json({ calendarios: await calendariosDe(pessoa) });
    } catch (err) { falha(res, err, 'GET google/calendarios'); }
  });

  app.post('/api/google/calendarios', async (req, res) => {
    try {
      const b = req.body || {};
      const pessoa = Number(b.pessoa);
      const cal = String(b.cal_id || '').trim();
      const modo = ['completo', 'ocupado', 'fora'].includes(b.modo) ? b.modo : null;
      if (!Number.isInteger(pessoa) || !cal || !modo) return res.status(400).json({ error: 'Pedido incompleto.' });
      await query(
        `INSERT INTO google_calendarios (person_id, cal_id, nome, modo) VALUES ($1,$2,$3,$4)
         ON CONFLICT (person_id, cal_id) DO UPDATE SET nome = EXCLUDED.nome, modo = EXCLUDED.modo`,
        [pessoa, cal.slice(0, 300), String(b.nome || '').slice(0, 200) || null, modo]);
      /* Um calendario que sai leva os eventos que tinham vindo dele. */
      if (modo === 'fora') {
        await query("DELETE FROM events WHERE google_pessoa = $1 AND origin = 'google' AND google_cal = $2",
          [pessoa, cal]);
      }
      const r = await sincronizar(pessoa);
      res.json(Object.assign({ ok: true }, r, await estadoDe(pessoa)));
    } catch (err) { falha(res, err, 'POST google/calendarios'); }
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
      /* As copias que o Farol la tinha posto ficam no Google (sem acesso nao
         ha como as tirar); o Farol esquece-as. */
      await query('DELETE FROM event_google WHERE person_id = $1', [pessoa]);
      await query('DELETE FROM google_calendarios WHERE person_id = $1', [pessoa]);
      await query('DELETE FROM calendars WHERE code = $1', ['google-' + pessoa]);
      await query('DELETE FROM google_contas WHERE person_id = $1', [pessoa]);
      CACHE.delete(pessoa);
      res.json({ ok: true, ligado: false });
    } catch (err) { falha(res, err, 'POST google/desligar'); }
  });
}

module.exports = { instalar, arrancar, estadoDe, sincronizar, sincronizarTodas, paraFarol, configurado,
  espelhar, apagarCopias, corpoGoogle, podeEscrever };
