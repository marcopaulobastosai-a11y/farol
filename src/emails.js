'use strict';
/**
 * Farol — mandar os papeis de um pagamento a quem se paga, pelo Gmail.
 *
 * O email sai sempre da mesma conta (GMAIL_REMETENTE, por omissao
 * marcopaulobastos@gmail.com), ligada uma vez na Administracao. O Farol so
 * pede a Google licenca para ENVIAR (gmail.send): nao le a caixa de correio.
 * O acesso que a Google devolve guarda-se cifrado em settings ('gmail'), com
 * uma chave tirada do SESSION_SECRET.
 *
 * Os destinatarios (o senhorio, o British, o contabilista) configuram-se na
 * Administracao, cada um com o seu texto. Um pagamento encontra o seu pelo
 * campo destinatario_id (dele ou da rotina de onde veio) ou pelos «termos»
 * do destinatario no nome de quem recebe e no titulo.
 *
 * Credenciais: GOOGLE_CLIENT_ID ja existe (o login); GOOGLE_CLIENT_SECRET
 * cola-o o Marco nas Variables do Railway. Nada disto se escreve no codigo.
 */
const crypto = require('crypto');
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;
const limpar = (v) => (v === undefined || v === '' ? null : v);

const REMETENTE = (process.env.GMAIL_REMETENTE || 'marcopaulobastos@gmail.com').trim().toLowerCase();
const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const SEGREDO = process.env.SESSION_SECRET || '';
const ESCOPOS = 'openid email profile https://www.googleapis.com/auth/gmail.send';
const COOKIE_ESTADO = 'farol_gmail_estado';
const MAX_BYTES = 24 * 1024 * 1024;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const QUANDO = ['manual', 'rever', 'auto'];

const configurado = () => Boolean(CLIENT_ID && CLIENT_SECRET && SEGREDO);

/* ---------------- cifra do acesso ---------------- */
function chave() { return crypto.createHash('sha256').update(SEGREDO + ':gmail').digest(); }
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

async function lerLigacao() {
  const r = (await all("SELECT value FROM settings WHERE key = 'gmail'"))[0];
  if (!r) return null;
  try { return JSON.parse(r.value); } catch (e) { return null; }
}
async function gravarLigacao(v) {
  await query(
    `INSERT INTO settings (key, value) VALUES ('gmail', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(v)]);
}

/* ---------------- Google ---------------- */
function redirecionamento(req) {
  if (process.env.GMAIL_REDIRECT) return process.env.GMAIL_REDIRECT.trim();
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return 'https://' + host + '/api/gmail/callback';
}

async function pedirToken(campos) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(Object.assign({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET }, campos))
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Google recusou o acesso: ' + (j.error_description || j.error || r.status));
  return j;
}

let CACHE = null; // { token, ate }
async function acesso() {
  if (CACHE && CACHE.ate > Date.now() + 60000) return CACHE.token;
  const l = await lerLigacao();
  if (!l || !l.token) throw new Error('O Gmail não está ligado. Liga-o na Administração › Destinatários.');
  const j = await pedirToken({ grant_type: 'refresh_token', refresh_token: decifrar(l.token) });
  CACHE = { token: j.access_token, ate: Date.now() + (Number(j.expires_in) || 3000) * 1000 };
  return CACHE.token;
}

function payloadDo(idToken) {
  try {
    const p = String(idToken || '').split('.')[1];
    return JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch (e) { return {}; }
}

/* ---------------- o email ---------------- */
const semLinhas = (s) => String(s || '').replace(/[\r\n]+/g, ' ').trim();
function cabecalho(s) {
  s = semLinhas(s);
  return /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?=';
}
function b64Linhas(buf) {
  return buf.toString('base64').replace(/.{1,76}/g, '$&\r\n');
}
function enderecos(txt) {
  return String(txt || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
}
const valido = (e) => /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(e);

function mime({ nome, de, para, cc, assunto, corpo, anexos }) {
  const limite = 'farol_' + crypto.randomBytes(12).toString('hex');
  const linhas = [
    'From: ' + (nome ? cabecalho(nome) + ' ' : '') + '<' + de + '>',
    'To: ' + para.join(', ')
  ];
  if (cc.length) linhas.push('Cc: ' + cc.join(', '));
  linhas.push('Subject: ' + cabecalho(assunto), 'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' + limite + '"', '',
    '--' + limite,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64', '',
    b64Linhas(Buffer.from(String(corpo || ''), 'utf8')));
  anexos.forEach((a) => {
    const fn = semLinhas(a.nome).replace(/"/g, '');
    linhas.push('--' + limite,
      'Content-Type: ' + (a.mime || 'application/octet-stream') + '; name="' + cabecalho(fn) + '"',
      "Content-Disposition: attachment; filename*=UTF-8''" + encodeURIComponent(fn),
      'Content-Transfer-Encoding: base64', '',
      b64Linhas(a.buffer));
  });
  linhas.push('--' + limite + '--', '');
  return linhas.join('\r\n');
}

async function enviarGmail(raw) {
  const r = await fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + (await acesso()), 'Content-Type': 'message/rfc822' },
    body: raw
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('O Gmail não enviou: ' + ((j.error && j.error.message) || r.status));
  return j;
}

/* ---------------- o pagamento e o seu destinatario ---------------- */
function semAcentos(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

async function pagamento(id) {
  return (await all(
    `SELECT t.id, t.title, t.tipo, t.payee, t.payment_ref, t.amount::float AS amount,
            t.paid_amount::float AS paid_amount, t.done, t.series_id, t.destinatario_id, t.notes,
            to_char(t.due_on,'YYYY-MM-DD') AS due_on, to_char(t.paid_on,'YYYY-MM-DD') AS paid_on,
            (SELECT r.destinatario_id FROM tasks r WHERE r.id = t.series_id) AS destinatario_rotina,
            (SELECT string_agg(p.name, ', ' ORDER BY p.name) FROM task_subjects s JOIN people p ON p.id = s.person_id
              WHERE s.task_id = t.id) AS pessoas
       FROM tasks t WHERE t.id = $1 AND t.origin = 'real'`, [id]))[0] || null;
}

async function destinatarioDe(t) {
  const lista = await all('SELECT * FROM destinatarios WHERE ativo ORDER BY id');
  const escolhido = t.destinatario_id || t.destinatario_rotina;
  if (escolhido) {
    const d = lista.find((x) => x.id === escolhido);
    if (d) return { d, como: 'escolhido' };
  }
  const texto = semAcentos([t.payee, t.title].filter(Boolean).join(' '));
  const cabe = (w) => new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(texto);
  for (const d of lista) {
    const termos = String(d.termos || '').split(/[,;\n]+/).map(semAcentos).map((x) => x.trim()).filter(Boolean);
    if (termos.some((tm) => { const ws = tm.split(/[^a-z0-9]+/).filter((w) => w.length >= 2); return ws.length && ws.every(cabe); })) {
      return { d, como: 'termos' };
    }
  }
  return null;
}

async function papeisDe(taskId) {
  return all(
    `SELECT td.document_id AS id, td.papel, td.valor::float AS valor, d.name, d.entity,
            to_char(COALESCE(d.issued_on, d.valid_on),'YYYY-MM-DD') AS data,
            i.file_path, i.file_name, i.mime_type, i.store
       FROM task_documents td
       JOIN documents d ON d.id = td.document_id
       LEFT JOIN LATERAL (
         SELECT ii.file_path, ii.file_name, ii.mime_type, ii.store
           FROM inbox_links l JOIN inbox_items ii ON ii.id = l.inbox_id
          WHERE l.target_type = 'documento' AND l.target_id = d.id AND ii.file_path IS NOT NULL
          ORDER BY l.inbox_id DESC LIMIT 1) i ON TRUE
      WHERE td.task_id = $1 AND td.papel IN ('fatura','comprovativo','recibo')
      ORDER BY CASE td.papel WHEN 'fatura' THEN 0 ELSE 1 END, d.issued_on NULLS LAST, td.document_id`, [taskId]);
}

const euros = (v) => v === null || v === undefined ? '' :
  Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
function dataLonga(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return d + ' de ' + MESES[m - 1] + (a !== new Date().getFullYear() ? ' de ' + a : '');
}
function juntar(l) { return l.length <= 1 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' e ' + l[l.length - 1]; }

const TEXTO_BASE = 'Olá {nome},\n\nSegue o comprovativo do pagamento de {titulo}, no valor de {total}, feito a {data do pagamento}.\n\n{lista das faturas}\n\nObrigado,\nMarco';
const ASSUNTO_BASE = '{titulo} — {total}';

function preencher(modelo, v) {
  return String(modelo || '').replace(/\{([^{}]{1,40})\}/g, (m, k) => {
    const c = semAcentos(k).trim();
    return Object.prototype.hasOwnProperty.call(v, c) ? v[c] : m;
  }).replace(/[ \t]+([,.;:])/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
}

async function preparar(taskId) {
  const t = await pagamento(taskId);
  if (!t || t.tipo !== 'pagamento') return null;
  const achado = await destinatarioDe(t);
  const d = achado && achado.d;
  const papeis = await papeisDe(taskId);
  const faturas = papeis.filter((p) => p.papel === 'fatura');
  const meses = [];
  faturas.forEach((f) => { if (f.data) { const k = f.data.slice(0, 7); if (meses.indexOf(k) < 0) meses.push(k); } });
  if (!meses.length && t.due_on) meses.push(t.due_on.slice(0, 7));
  meses.sort();
  const lista = faturas.map((f) => '- ' + (f.name || 'Fatura') + (f.valor !== null ? ' — ' + euros(f.valor) : '')).join('\n');
  const v = {
    nome: d ? String(d.nome).split(' ')[0] : '',
    titulo: t.title,
    total: euros(t.paid_amount !== null ? t.paid_amount : t.amount),
    'data do pagamento': dataLonga(t.paid_on),
    prazo: dataLonga(t.due_on),
    meses: juntar(meses.map((k) => MESES[Number(k.slice(5, 7)) - 1])),
    'lista das faturas': lista,
    referencia: t.payment_ref || '',
    pessoa: t.pessoas || ''
  };
  const anexos = papeis.filter((p) => (p.papel === 'fatura' ? (!d || d.anexar_faturas) : (!d || d.anexar_comprovativo)))
    .map((p) => ({ id: p.id, nome: p.file_name || p.name, papel: p.papel, ficheiro: Boolean(p.file_path) }));
  return {
    pagamento: { id: t.id, titulo: t.title, pago: t.paid_on, total: v.total },
    destinatario: d ? { id: d.id, nome: d.nome, email: d.email, quando: d.quando, como: achado.como } : null,
    de: REMETENTE,
    para: d ? d.email : '',
    cc: d ? (d.cc || '') : '',
    assunto: preencher((d && d.assunto) || ASSUNTO_BASE, v),
    corpo: preencher((d && d.texto) || TEXTO_BASE, v),
    anexos
  };
}

async function enviar(taskId, b, automatico) {
  const t = await pagamento(taskId);
  if (!t) throw new Error('Pagamento não encontrado.');
  const para = enderecos(b.para), cc = enderecos(b.cc);
  if (!para.length) throw new Error('Falta o email de quem recebe.');
  const maus = para.concat(cc).filter((e) => !valido(e));
  if (maus.length) throw new Error('Email inválido: ' + maus.join(', '));
  const assunto = semLinhas(b.assunto);
  if (!assunto) throw new Error('Falta o assunto.');
  const pedidos = (b.anexos || []).map(Number).filter(Number.isInteger);
  const papeis = (await papeisDe(taskId)).filter((p) => pedidos.indexOf(p.id) >= 0);
  const inbox = require('./inbox');
  const anexos = [];
  let total = 0;
  for (const p of papeis) {
    if (!p.file_path) throw new Error('«' + p.name + '» não tem ficheiro para anexar.');
    const buffer = await inbox.lerFicheiro(p.store, p.file_path);
    total += buffer.length;
    anexos.push({ nome: p.file_name || (p.name + '.pdf'), mime: p.mime_type, buffer, id: p.id });
  }
  if (total > MAX_BYTES) throw new Error('Os anexos passam dos 24 MB que o Gmail aceita.');
  const l = await lerLigacao();
  const achado = await destinatarioDe(t);
  const registo = {
    task: t.id, dest: achado ? achado.d.id : null, para: para.join(', '), cc: cc.join(', ') || null,
    assunto, corpo: String(b.corpo || ''), anexos: JSON.stringify(anexos.map((a) => ({ id: a.id, nome: a.nome })))
  };
  try {
    const r = await enviarGmail(mime({ nome: l && l.nome, de: REMETENTE, para, cc, assunto, corpo: b.corpo, anexos }));
    const row = (await all(
      `INSERT INTO email_envios (task_id, destinatario_id, estado, automatico, de, para, cc, assunto, corpo, anexos, gmail_id)
       VALUES ($1,$2,'enviado',$3,$4,$5,$6,$7,$8,$9::jsonb,$10) RETURNING id`,
      [registo.task, registo.dest, Boolean(automatico), REMETENTE, registo.para, registo.cc,
       registo.assunto, registo.corpo, registo.anexos, r.id || null]))[0];
    console.log('[farol] email do pagamento', t.id, 'enviado para', registo.para, automatico ? '(sozinho)' : '');
    return { id: row.id, gmail_id: r.id };
  } catch (err) {
    await query(
      `INSERT INTO email_envios (task_id, destinatario_id, estado, automatico, de, para, cc, assunto, corpo, anexos, erro)
       VALUES ($1,$2,'erro',$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
      [registo.task, registo.dest, Boolean(automatico), REMETENTE, registo.para, registo.cc,
       registo.assunto, registo.corpo, registo.anexos, err.message]).catch(() => {});
    throw err;
  }
}

/* Depois de um comprovativo fechar um pagamento. Numa rotina, o que ficou
   pago e a vez (a copia com series_id); a rotina ja seguiu para a proxima. */
async function aoPagar(taskId) {
  let t = await pagamento(taskId);
  if (!t) return;
  if (!t.paid_on) {
    const vez = (await all(
      `SELECT id FROM tasks WHERE series_id = $1 AND paid_on IS NOT NULL ORDER BY completed_at DESC NULLS LAST, id DESC LIMIT 1`,
      [taskId]))[0];
    if (!vez) return;
    t = await pagamento(vez.id);
  }
  const p = await preparar(t.id);
  if (!p || !p.destinatario || p.destinatario.quando !== 'auto') return;
  const ja = await all("SELECT 1 FROM email_envios WHERE task_id = $1 AND estado = 'enviado' LIMIT 1", [t.id]);
  if (ja.length) return;
  if (!(await lerLigacao())) return;
  await enviar(t.id, { para: p.para, cc: p.cc, assunto: p.assunto, corpo: p.corpo, anexos: p.anexos.filter((a) => a.ficheiro).map((a) => a.id) }, true);
}

/* ---------------- rotas ---------------- */
function instalar(app, { ehAdmin }) {
  const soAdmin = (req, res, next) => (ehAdmin(req) ? next()
    : res.status(403).json({ error: 'Só os administradores mexem nisto.' }));
  const falha = (res, err, onde) => {
    console.error('[farol] ' + onde + ':', err.message);
    res.status(400).json({ error: err.message || 'Não foi possível.' });
  };

  app.get('/api/gmail/estado', async (req, res) => {
    try {
      const l = await lerLigacao();
      res.json({ configurado: configurado(), remetente: REMETENTE, ligado: Boolean(l && l.token),
        email: l ? l.email : null, ligado_em: l ? l.em : null, redirect: redirecionamento(req) });
    } catch (err) { falha(res, err, 'GET gmail'); }
  });

  app.get('/api/gmail/ligar', soAdmin, (req, res) => {
    if (!configurado()) return res.status(400).send('Falta o GOOGLE_CLIENT_SECRET nas Variables do Railway.');
    const estado = crypto.randomBytes(18).toString('hex');
    res.setHeader('Set-Cookie', COOKIE_ESTADO + '=' + estado + '; Path=/api/gmail; HttpOnly; Secure; SameSite=Lax; Max-Age=600');
    const q = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: redirecionamento(req), response_type: 'code', scope: ESCOPOS,
      access_type: 'offline', prompt: 'consent', login_hint: REMETENTE, state: estado
    });
    res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + q.toString());
  });

  app.get('/api/gmail/callback', soAdmin, async (req, res) => {
    const volta = (msg) => res.redirect('/?gmail=' + encodeURIComponent(msg));
    try {
      const galletas = {};
      (req.headers.cookie || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) galletas[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
      if (!req.query.state || req.query.state !== galletas[COOKIE_ESTADO]) return volta('estado');
      if (req.query.error) return volta('recusado');
      const j = await pedirToken({ grant_type: 'authorization_code', code: String(req.query.code || ''), redirect_uri: redirecionamento(req) });
      const quem = payloadDo(j.id_token);
      const email = String(quem.email || '').toLowerCase();
      if (email !== REMETENTE) { console.warn('[farol] Gmail: autorizou outra conta'); return volta('conta'); }
      if (!j.refresh_token) return volta('sem-acesso');
      if (!String(j.scope || '').includes('gmail.send')) return volta('sem-envio');
      await gravarLigacao({ email, nome: quem.name || null, token: cifrar(j.refresh_token), em: new Date().toISOString() });
      CACHE = { token: j.access_token, ate: Date.now() + (Number(j.expires_in) || 3000) * 1000 };
      res.setHeader('Set-Cookie', COOKIE_ESTADO + '=; Path=/api/gmail; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      console.log('[farol] Gmail ligado:', email);
      volta('ligado');
    } catch (err) {
      console.error('[farol] gmail callback:', err.message);
      volta('erro');
    }
  });

  app.post('/api/gmail/desligar', soAdmin, async (req, res) => {
    try {
      const l = await lerLigacao();
      if (l && l.token) {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: decifrar(l.token) })
        }).catch(() => {});
      }
      await query("DELETE FROM settings WHERE key = 'gmail'");
      CACHE = null;
      res.json({ ok: true });
    } catch (err) { falha(res, err, 'POST gmail desligar'); }
  });

  /* Destinatarios */
  const CAMPOS = ['nome', 'email', 'cc', 'termos', 'quando', 'assunto', 'texto', 'anexar_faturas', 'anexar_comprovativo', 'ativo'];
  function valores(b) {
    const out = {};
    CAMPOS.forEach((c) => { if (b[c] !== undefined) out[c] = b[c]; });
    if (out.quando !== undefined && QUANDO.indexOf(out.quando) < 0) out.quando = 'manual';
    ['anexar_faturas', 'anexar_comprovativo', 'ativo'].forEach((c) => { if (out[c] !== undefined) out[c] = Boolean(out[c]); });
    ['nome', 'email', 'cc', 'termos', 'assunto', 'texto'].forEach((c) => { if (out[c] !== undefined) out[c] = limpar(typeof out[c] === 'string' ? out[c].trim() : out[c]); });
    if (out.email !== undefined && (!out.email || enderecos(out.email).some((e) => !valido(e)))) throw new Error('Email inválido.');
    if (out.cc && enderecos(out.cc).some((e) => !valido(e))) throw new Error('Email em Cc inválido.');
    return out;
  }
  const lista = () => all('SELECT * FROM destinatarios ORDER BY ativo DESC, nome, id');

  app.get('/api/destinatarios', async (req, res) => {
    try { res.json({ destinatarios: await lista() }); } catch (err) { falha(res, err, 'GET destinatarios'); }
  });
  app.post('/api/destinatarios', soAdmin, async (req, res) => {
    try {
      const v = valores(req.body || {});
      if (!v.nome || !v.email) throw new Error('O destinatário precisa de nome e email.');
      const cs = Object.keys(v);
      await query(`INSERT INTO destinatarios (${cs.join(',')}) VALUES (${cs.map((_, i) => '$' + (i + 1)).join(',')})`, cs.map((c) => v[c]));
      res.status(201).json({ destinatarios: await lista() });
    } catch (err) { falha(res, err, 'POST destinatario'); }
  });
  app.patch('/api/destinatarios/:id(\\d+)', soAdmin, async (req, res) => {
    try {
      const v = valores(req.body || {});
      const cs = Object.keys(v);
      if (cs.length) {
        await query(`UPDATE destinatarios SET ${cs.map((c, i) => c + ' = $' + (i + 1)).join(', ')} WHERE id = $${cs.length + 1}`,
          cs.map((c) => v[c]).concat([Number(req.params.id)]));
      }
      res.json({ destinatarios: await lista() });
    } catch (err) { falha(res, err, 'PATCH destinatario'); }
  });
  app.delete('/api/destinatarios/:id(\\d+)', soAdmin, async (req, res) => {
    try {
      await query('DELETE FROM destinatarios WHERE id = $1', [Number(req.params.id)]);
      res.json({ destinatarios: await lista() });
    } catch (err) { falha(res, err, 'DELETE destinatario'); }
  });

  /* O email de um pagamento: o que se enviaria, e o que ja se enviou. */
  app.get('/api/emails/pagamento/:id(\\d+)', async (req, res) => {
    try {
      const p = await preparar(Number(req.params.id));
      if (!p) return res.status(404).json({ error: 'Pagamento não encontrado.' });
      const l = await lerLigacao();
      p.gmail = { ligado: Boolean(l && l.token), configurado: configurado() };
      p.envios = await all(
        `SELECT id, estado, automatico, para, cc, assunto, anexos, gmail_id, erro,
                to_char(created_at AT TIME ZONE 'Europe/Lisbon','YYYY-MM-DD HH24:MI') AS quando
           FROM email_envios WHERE task_id = $1 ORDER BY created_at DESC LIMIT 20`, [Number(req.params.id)]);
      res.json(p);
    } catch (err) { falha(res, err, 'GET email pagamento'); }
  });

  app.post('/api/emails/pagamento/:id(\\d+)/enviar', async (req, res) => {
    try {
      const r = await enviar(Number(req.params.id), req.body || {}, false);
      res.json({ ok: true, ...r });
    } catch (err) { falha(res, err, 'POST enviar email'); }
  });
}

module.exports = { instalar, aoPagar, preparar, preencher, mime, destinatarioDe };
