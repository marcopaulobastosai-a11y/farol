'use strict';
/**
 * Farol — mandar os papeis de um pagamento a quem se paga, pelo Gmail.
 *
 * Ha mais do que uma caixa de correio (tabela gmail_caixas): a pessoal e a
 * da loja, por exemplo. Quem decide por qual sai o email e o DESTINATARIO -
 * cada um aponta para a sua caixa. Um destinatario sem caixa escolhida nao
 * envia: o Farol recusa e pede que se escolha, porque mandar o correio de uma
 * empresa pela conta de casa so se percebe do outro lado, tarde.
 *
 * O Farol so pede a Google licenca para ENVIAR (gmail.send): nao le a caixa
 * de correio. O acesso de cada caixa guarda-se cifrado na coluna `token`, com
 * uma chave tirada do SESSION_SECRET. A conta unica que existia antes
 * (settings 'gmail') passa sozinha para a primeira caixa, na primeira vez que
 * se olha para a lista.
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

/* ---------------- as caixas ---------------- */
/* A ligacao antiga, de quando so havia uma conta. So serve para a mudanca. */
async function ligacaoAntiga() {
  const r = (await all("SELECT value FROM settings WHERE key = 'gmail'"))[0];
  if (!r) return null;
  try { return JSON.parse(r.value); } catch (e) { return null; }
}

/* A conta unica que ja estava ligada vira a primeira caixa, uma so vez. Sem
   isto, o envio parava no dia em que isto subisse. */
let MUDOU = false;
async function mudarDeSitio() {
  if (MUDOU) return;
  MUDOU = true;
  const l = await ligacaoAntiga();
  if (!l || !l.token) return;
  const ha = (await all('SELECT id FROM gmail_caixas WHERE email = $1', [REMETENTE]))[0];
  if (ha) return;
  const nova = (await all(
    `INSERT INTO gmail_caixas (email, nome, token, ligado_em)
     VALUES ($1,$2,$3, COALESCE($4::timestamptz, now()))
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [REMETENTE, limpar(l.nome), l.token, l.desde || null]))[0];
  if (!nova) return;
  /* Os destinatarios que ja existiam saiam todos desta conta, porque so havia
     esta. Ficam a aponta-la, senao no dia em que isto subisse nenhum email
     saia e ninguem percebia porque. O que for de outra caixa muda-se depois,
     um a um. */
  const r = await all(
    'UPDATE destinatarios SET caixa_id = $1 WHERE caixa_id IS NULL RETURNING id', [nova.id]);
  console.log('[farol] gmail: a conta que estava ligada passou a caixa', REMETENTE,
    '-', r.length, 'destinatario(s) ficaram a sair por ela');
}

async function caixas() {
  await mudarDeSitio();
  return all(
    `SELECT id, email, nome, (token IS NOT NULL) AS ligada, erro,
            to_char(ligado_em AT TIME ZONE 'Europe/Lisbon','YYYY-MM-DD HH24:MI') AS ligado_em
       FROM gmail_caixas ORDER BY id`);
}

async function caixaPorId(id) {
  if (!id) return null;
  return (await all('SELECT * FROM gmail_caixas WHERE id = $1', [id]))[0] || null;
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

/* Um acesso curto por caixa, guardado enquanto dura. */
const CACHE = new Map(); // id -> { token, ate }
async function acesso(caixa) {
  if (!caixa || !caixa.token) {
    throw new Error('A caixa «' + ((caixa && caixa.email) || '?') + '» não está ligada. Liga-a na Administração › Destinatários.');
  }
  const guardado = CACHE.get(caixa.id);
  if (guardado && guardado.ate > Date.now() + 60000) return guardado.token;
  const j = await pedirToken({ grant_type: 'refresh_token', refresh_token: decifrar(caixa.token) });
  CACHE.set(caixa.id, { token: j.access_token, ate: Date.now() + (Number(j.expires_in) || 3000) * 1000 });
  return j.access_token;
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

async function enviarGmail(raw, caixa) {
  const r = await fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + (await acesso(caixa)), 'Content-Type': 'message/rfc822' },
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

/* Os papeis que a janela de «dar por pago» acabou de escolher ainda nao estao
   agarrados a tarefa - e so depois de fechar e que ficam. Para o email poder
   sair antes disso, vao-se buscar pelo proprio id. */
async function papeisSoltos(ids) {
  if (!ids || !ids.length) return [];
  return all(
    `SELECT d.id, 'anexo'::text AS papel, NULL::float AS valor, d.name, d.entity,
            to_char(COALESCE(d.issued_on, d.valid_on),'YYYY-MM-DD') AS data,
            i.file_path, i.file_name, i.mime_type, i.store
       FROM documents d
       LEFT JOIN LATERAL (
         SELECT ii.file_path, ii.file_name, ii.mime_type, ii.store
           FROM inbox_links l JOIN inbox_items ii ON ii.id = l.inbox_id
          WHERE l.target_type = 'documento' AND l.target_id = d.id AND ii.file_path IS NOT NULL
          ORDER BY l.inbox_id DESC LIMIT 1) i ON TRUE
      WHERE d.id = ANY($1)`, [ids]);
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

/* `porGravar` e o que a janela de «dar por pago» tem no ecra e ainda nao
   gravou: a data, o valor e os papeis escolhidos. Com isso o email pode ser
   revisto antes de o pagamento fechar, ja com todos os dados. */
async function preparar(taskId, porGravar) {
  const x = porGravar || {};
  const t = await pagamento(taskId);
  if (!t || t.tipo !== 'pagamento') return null;
  if (x.paid_on) t.paid_on = String(x.paid_on).slice(0, 10);
  if (x.paid_amount !== undefined && x.paid_amount !== null && x.paid_amount !== '') {
    t.paid_amount = Number(String(x.paid_amount).replace(',', '.'));
  }
  const achado = await destinatarioDe(t);
  const d = achado && achado.d;
  let papeis = await papeisDe(taskId);
  const escolhidos = (x.documentos || []).map((y) => ({ id: Number(y && y.id !== undefined ? y.id : y), papel: (y && y.papel) || 'anexo' }))
    .filter((y) => Number.isInteger(y.id) && !papeis.some((p) => p.id === y.id));
  if (escolhidos.length) {
    const soltos = await papeisSoltos(escolhidos.map((y) => y.id));
    const qual = {};
    escolhidos.forEach((y) => { qual[y.id] = y.papel; });
    papeis = papeis.concat(soltos.map((p) => Object.assign(p, { papel: qual[p.id] || 'anexo' })));
    papeis.sort((a, b) => (a.papel === 'fatura' ? 0 : 1) - (b.papel === 'fatura' ? 0 : 1) ||
      String(a.data || '9999').localeCompare(String(b.data || '9999')) || a.id - b.id);
  }
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
  await mudarDeSitio();
  const caixa = d ? await caixaPorId(d.caixa_id) : null;
  return {
    pagamento: { id: t.id, titulo: t.title, pago: t.paid_on, total: v.total },
    destinatario: d ? { id: d.id, nome: d.nome, email: d.email, quando: d.quando, como: achado.como } : null,
    /* De que caixa sai. Sem destinatario, ou com um destinatario que ainda
       nao escolheu caixa, fica por decidir - e o ecra diz porque. */
    caixa: caixa ? { id: caixa.id, email: caixa.email, nome: caixa.nome, ligada: Boolean(caixa.token) } : null,
    de: caixa ? caixa.email : '',
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
  let papeis = (await papeisDe(taskId)).filter((p) => pedidos.indexOf(p.id) >= 0);
  /* O comprovativo escolhido na janela de pagar ainda pode nao estar agarrado
     ao pagamento: anexa-se na mesma, que e o papel que esta a ser enviado. */
  const faltam = pedidos.filter((id) => !papeis.some((p) => p.id === id));
  if (faltam.length) papeis = papeis.concat(await papeisSoltos(faltam));
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
  await mudarDeSitio();
  const achado = await destinatarioDe(t);
  /* Por que caixa sai. Quem manda e o destinatario; sem caixa escolhida nao
     se envia, para o correio de uma empresa nao sair da conta de casa. */
  const caixa = await caixaPorId(achado && achado.d && achado.d.caixa_id);
  if (!caixa) {
    throw new Error(achado && achado.d
      ? 'O destinatário «' + achado.d.nome + '» ainda não diz por que caixa sai. Escolhe-a na Administração › Destinatários.'
      : 'Este pagamento não tem destinatário, por isso não há caixa de onde enviar. Escolhe um destinatário.');
  }
  if (!caixa.token) throw new Error('A caixa ' + caixa.email + ' não está ligada à Google. Liga-a na Administração › Destinatários.');
  const registo = {
    task: t.id, dest: achado ? achado.d.id : null, para: para.join(', '), cc: cc.join(', ') || null,
    assunto, corpo: String(b.corpo || ''), anexos: JSON.stringify(anexos.map((a) => ({ id: a.id, nome: a.nome })))
  };
  try {
    const r = await enviarGmail(mime({ nome: caixa.nome, de: caixa.email, para, cc, assunto, corpo: b.corpo, anexos }), caixa);
    const row = (await all(
      `INSERT INTO email_envios (task_id, destinatario_id, estado, automatico, de, para, cc, assunto, corpo, anexos, gmail_id, caixa_id)
       VALUES ($1,$2,'enviado',$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11) RETURNING id`,
      [registo.task, registo.dest, Boolean(automatico), caixa.email, registo.para, registo.cc,
       registo.assunto, registo.corpo, registo.anexos, r.id || null, caixa.id]))[0];
    console.log('[farol] email do pagamento', t.id, 'enviado para', registo.para, automatico ? '(sozinho)' : '');
    return { id: row.id, gmail_id: r.id };
  } catch (err) {
    await query(
      `INSERT INTO email_envios (task_id, destinatario_id, estado, automatico, de, para, cc, assunto, corpo, anexos, erro, caixa_id)
       VALUES ($1,$2,'erro',$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
      [registo.task, registo.dest, Boolean(automatico), caixa.email, registo.para, registo.cc,
       registo.assunto, registo.corpo, registo.anexos, err.message, caixa.id]).catch(() => {});
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
  /* Sem caixa ligada no destinatario nao se envia sozinho - e o enviar()
     diria o mesmo, mas aqui poupa-se um registo de erro a cada pagamento. */
  if (!p.caixa || !p.caixa.ligada) {
    console.warn('[farol] email automatico do pagamento', t.id, 'parado: a caixa do destinatário não está pronta');
    return;
  }
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
      res.json({ configurado: configurado(), caixas: await caixas(), redirect: redirecionamento(req) });
    } catch (err) { falha(res, err, 'GET gmail'); }
  });

  /* Uma caixa nova nasce aqui, so com o endereco; a ligacao a Google vem a
     seguir, e e la que se confirma que foi mesmo esta conta que autorizou. */
  app.post('/api/gmail/caixas', soAdmin, async (req, res) => {
    const email = String((req.body || {}).email || '').trim().toLowerCase();
    const nome = limpar(String((req.body || {}).nome || '').trim());
    if (!valido(email)) return res.status(400).json({ error: 'Email inválido.' });
    try {
      await mudarDeSitio();
      await query(
        `INSERT INTO gmail_caixas (email, nome) VALUES ($1,$2)
         ON CONFLICT (email) DO UPDATE SET nome = COALESCE(EXCLUDED.nome, gmail_caixas.nome)`, [email, nome]);
      res.status(201).json({ ok: true, caixas: await caixas() });
    } catch (err) { falha(res, err, 'POST caixa gmail'); }
  });

  app.delete('/api/gmail/caixas/:id(\\d+)', soAdmin, async (req, res) => {
    const id = Number(req.params.id);
    try {
      const c = await caixaPorId(id);
      if (!c) return res.status(404).json({ error: 'Caixa não encontrada.' });
      const [{ n }] = await all('SELECT count(*)::int AS n FROM destinatarios WHERE caixa_id = $1 AND ativo', [id]);
      if (n) return res.status(409).json({ error: 'Há ' + n + (n === 1 ? ' destinatário que sai' : ' destinatários que saem') + ' por esta caixa. Muda-os primeiro.' });
      if (c.token) {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: decifrar(c.token) })
        }).catch(() => {});
      }
      await query('DELETE FROM gmail_caixas WHERE id = $1', [id]);
      CACHE.delete(id);
      res.json({ ok: true, caixas: await caixas() });
    } catch (err) { falha(res, err, 'DELETE caixa gmail'); }
  });

  app.get('/api/gmail/ligar', soAdmin, async (req, res) => {
    if (!configurado()) return res.status(400).send('Falta o GOOGLE_CLIENT_SECRET nas Variables do Railway.');
    const c = await caixaPorId(Number(req.query.caixa));
    if (!c) return res.status(400).send('Escolhe primeiro a caixa a ligar.');
    const estado = crypto.randomBytes(18).toString('hex');
    /* O id da caixa viaja no cookie, nao no `state` que a Google devolve: o
       que volta de fora nao manda em quem recebe o acesso. */
    res.setHeader('Set-Cookie', COOKIE_ESTADO + '=' + estado + '.' + c.id + '; Path=/api/gmail; HttpOnly; Secure; SameSite=Lax; Max-Age=600');
    const q = new URLSearchParams({
      client_id: CLIENT_ID, redirect_uri: redirecionamento(req), response_type: 'code', scope: ESCOPOS,
      access_type: 'offline', prompt: 'consent', login_hint: c.email, state: estado
    });
    res.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + q.toString());
  });

  app.get('/api/gmail/callback', soAdmin, async (req, res) => {
    const volta = (msg) => res.redirect('/?gmail=' + encodeURIComponent(msg));
    try {
      const galletas = {};
      (req.headers.cookie || '').split(';').forEach((p) => { const i = p.indexOf('='); if (i > 0) galletas[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
      const guardado = String(galletas[COOKIE_ESTADO] || '');
      const ponto = guardado.indexOf('.');
      const segredo = ponto > 0 ? guardado.slice(0, ponto) : guardado;
      const caixaId = ponto > 0 ? Number(guardado.slice(ponto + 1)) : 0;
      if (!req.query.state || !segredo || req.query.state !== segredo) return volta('estado');
      if (req.query.error) return volta('recusado');
      const c = await caixaPorId(caixaId);
      if (!c) return volta('estado');
      const j = await pedirToken({ grant_type: 'authorization_code', code: String(req.query.code || ''), redirect_uri: redirecionamento(req) });
      const quem = payloadDo(j.id_token);
      const email = String(quem.email || '').toLowerCase();
      /* Autorizou outra conta que nao a que se pediu: nao se grava. Senao a
         caixa dizia uma coisa e o email saia de outra. */
      if (email !== String(c.email || '').toLowerCase()) {
        console.warn('[farol] Gmail: pediu-se', c.email, 'e autorizou', email);
        return volta('conta');
      }
      if (!j.refresh_token) return volta('sem-acesso');
      if (!String(j.scope || '').includes('gmail.send')) return volta('sem-envio');
      await query(
        `UPDATE gmail_caixas SET token = $2, nome = COALESCE(nome, $3), ligado_em = now(), erro = NULL
          WHERE id = $1`, [c.id, cifrar(j.refresh_token), quem.name || null]);
      CACHE.set(c.id, { token: j.access_token, ate: Date.now() + (Number(j.expires_in) || 3000) * 1000 });
      res.setHeader('Set-Cookie', COOKIE_ESTADO + '=; Path=/api/gmail; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      console.log('[farol] Gmail ligado:', email);
      volta('ligado');
    } catch (err) {
      console.error('[farol] gmail callback:', err.message);
      volta('erro');
    }
  });

  /* Desligar e so tirar o acesso: a caixa fica na lista, e os destinatarios
     que saem por ela continuam a aponta-la, a espera de se ligar outra vez. */
  app.post('/api/gmail/desligar', soAdmin, async (req, res) => {
    try {
      const c = await caixaPorId(Number((req.body || {}).caixa));
      if (!c) return res.status(400).json({ error: 'Escolhe a caixa a desligar.' });
      if (c.token) {
        await fetch('https://oauth2.googleapis.com/revoke', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: decifrar(c.token) })
        }).catch(() => {});
      }
      await query('UPDATE gmail_caixas SET token = NULL, ligado_em = NULL WHERE id = $1', [c.id]);
      CACHE.delete(c.id);
      res.json({ ok: true, caixas: await caixas() });
    } catch (err) { falha(res, err, 'POST gmail desligar'); }
  });

  /* Destinatarios */
  const CAMPOS = ['nome', 'email', 'cc', 'termos', 'quando', 'assunto', 'texto', 'anexar_faturas', 'anexar_comprovativo', 'ativo', 'caixa_id'];
  function valores(b) {
    const out = {};
    CAMPOS.forEach((c) => { if (b[c] !== undefined) out[c] = b[c]; });
    if (out.quando !== undefined && QUANDO.indexOf(out.quando) < 0) out.quando = 'manual';
    ['anexar_faturas', 'anexar_comprovativo', 'ativo'].forEach((c) => { if (out[c] !== undefined) out[c] = Boolean(out[c]); });
    ['nome', 'email', 'cc', 'termos', 'assunto', 'texto'].forEach((c) => { if (out[c] !== undefined) out[c] = limpar(typeof out[c] === 'string' ? out[c].trim() : out[c]); });
    if (out.email !== undefined && (!out.email || enderecos(out.email).some((e) => !valido(e)))) throw new Error('Email inválido.');
    if (out.cc && enderecos(out.cc).some((e) => !valido(e))) throw new Error('Email em Cc inválido.');
    if (out.caixa_id !== undefined) {
      const n = Number(out.caixa_id);
      out.caixa_id = Number.isInteger(n) && n > 0 ? n : null;
    }
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
  const responder = async (req, res, porGravar) => {
    const id = Number(req.params.id);
    const p = await preparar(id, porGravar);
    if (!p) return res.status(404).json({ error: 'Pagamento não encontrado.' });
    p.gmail = { ligado: Boolean(p.caixa && p.caixa.ligada), configurado: configurado() };
    p.envios = await all(
      `SELECT id, estado, automatico, para, cc, assunto, anexos, gmail_id, erro,
              to_char(created_at AT TIME ZONE 'Europe/Lisbon','YYYY-MM-DD HH24:MI') AS quando
         FROM email_envios WHERE task_id = $1 ORDER BY created_at DESC LIMIT 20`, [id]);
    res.json(p);
  };

  app.get('/api/emails/pagamento/:id(\\d+)', async (req, res) => {
    try { await responder(req, res, null); }
    catch (err) { falha(res, err, 'GET email pagamento'); }
  });

  /* O mesmo, mas com o que a janela de «dar por pago» ainda nao gravou - para
     se rever o email antes de o pagamento fechar. */
  app.post('/api/emails/pagamento/:id(\\d+)/preparar', async (req, res) => {
    try { await responder(req, res, req.body || {}); }
    catch (err) { falha(res, err, 'POST preparar email'); }
  });

  app.post('/api/emails/pagamento/:id(\\d+)/enviar', async (req, res) => {
    try {
      const r = await enviar(Number(req.params.id), req.body || {}, false);
      res.json({ ok: true, ...r });
    } catch (err) { falha(res, err, 'POST enviar email'); }
  });
}

module.exports = { instalar, aoPagar, preparar, preencher, mime, destinatarioDe };
