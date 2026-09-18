'use strict';
/**
 * Autenticação com conta Google, sem segredos guardados na app.
 *
 * O browser faz o login com o Google (Google Identity Services) e devolve um
 * id_token assinado. O servidor verifica a assinatura contra as chaves públicas
 * do Google, confirma que o email está na lista de quem pode entrar, e emite um
 * cookie de sessão assinado por nós. Não há client_secret: o cliente é público
 * e o que vale é a assinatura do Google.
 *
 * Quem pode entrar está na base de dados (ver src/acessos.js), não no
 * ALLOWED_EMAILS: a lista muda-se pela página de Acessos, sem deploy. E é
 * confirmada a cada pedido, para que retirar o acesso a alguém tenha efeito
 * imediato, mesmo que essa pessoa já tivesse cookie válido.
 */
const crypto = require('crypto');
const acessos = require('./acessos');
const pessoas = require('./pessoas');

const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const DIAS = 30;
const COOKIE = 'farol_sessao';

const ativa = () => Boolean(CLIENT_ID && SESSION_SECRET);

/* ---------------- chaves públicas do Google ---------------- */
let chaves = { quando: 0, porKid: {} };

async function chavesGoogle() {
  if (Date.now() - chaves.quando < 60 * 60 * 1000 && Object.keys(chaves.porKid).length) return chaves.porKid;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!r.ok) throw new Error('não foi possível ler as chaves do Google');
  const { keys } = await r.json();
  const porKid = {};
  keys.forEach((k) => { porKid[k.kid] = crypto.createPublicKey({ key: k, format: 'jwk' }); });
  chaves = { quando: Date.now(), porKid };
  return porKid;
}

const b64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

async function verificarIdToken(token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) throw new Error('token inválido');
  const cabecalho = JSON.parse(b64url(partes[0]).toString('utf8'));
  const corpo = JSON.parse(b64url(partes[1]).toString('utf8'));
  if (cabecalho.alg !== 'RS256') throw new Error('algoritmo inesperado');

  const chave = (await chavesGoogle())[cabecalho.kid];
  if (!chave) throw new Error('chave desconhecida');

  const assinado = Buffer.from(partes[0] + '.' + partes[1]);
  if (!crypto.verify('RSA-SHA256', assinado, chave, b64url(partes[2]))) throw new Error('assinatura inválida');

  const agora = Math.floor(Date.now() / 1000);
  if (corpo.exp < agora - 60) throw new Error('token expirado');
  if (corpo.aud !== CLIENT_ID) throw new Error('token de outra aplicação');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(corpo.iss)) throw new Error('emissor inesperado');
  if (!corpo.email || corpo.email_verified === false) throw new Error('email não verificado');
  return corpo;
}

/* ---------------- cookie de sessão ---------------- */
function assinar(dados) {
  const corpo = Buffer.from(JSON.stringify(dados)).toString('base64url');
  const mac = crypto.createHmac('sha256', SESSION_SECRET).update(corpo).digest('base64url');
  return corpo + '.' + mac;
}
function ler(valor) {
  if (!valor || valor.indexOf('.') < 0) return null;
  const [corpo, mac] = valor.split('.');
  const esperado = crypto.createHmac('sha256', SESSION_SECRET).update(corpo).digest('base64url');
  const a = Buffer.from(mac || ''), b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8'));
    if (!dados.exp || dados.exp < Math.floor(Date.now() / 1000)) return null;
    return dados;
  } catch (e) { return null; }
}
function cookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function sessao(req) {
  if (!ativa()) return { email: null, aberto: true };
  const dados = ler(cookies(req)[COOKIE]);
  return dados ? { email: dados.email, nome: dados.nome } : null;
}

function podeEntrar(email) {
  return acessos.podeEntrar(email);
}

/* ---------------- ligação ao Express ---------------- */
function instalar(app) {
  app.get('/api/config', (req, res) => {
    const s = ativa() ? sessao(req) : null;
    res.json({
      authEnabled: ativa(),
      googleClientId: CLIENT_ID || null,
      sessao: s || null,
      admin: ativa() ? Boolean(s && acessos.ehAdmin(s.email)) : true
    });
  });

  app.get('/api/me', (req, res) => {
    if (!ativa()) return res.json({ email: null, aberto: true });
    const s = sessao(req);
    if (!s) return res.status(401).json({ error: 'Entra com a tua conta Google.' });
    res.json(Object.assign({}, s, { admin: acessos.ehAdmin(s.email) }));
  });

  app.post('/auth/google', async (req, res) => {
    if (!ativa()) return res.status(400).json({ error: 'Autenticação não configurada.' });
    try {
      const info = await verificarIdToken((req.body || {}).credential);
      if (!podeEntrar(info.email)) {
        console.warn('[farol] entrada recusada:', info.email);
        return res.status(403).json({ error: 'Esta conta não tem acesso ao Farol.' });
      }
      const nome = info.given_name || info.name || null;
      const exp = Math.floor(Date.now() / 1000) + DIAS * 24 * 3600;
      const valor = assinar({ email: info.email, nome, exp });
      res.setHeader('Set-Cookie',
        COOKIE + '=' + encodeURIComponent(valor) +
        '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + DIAS * 24 * 3600);
      acessos.registarEntrada(info.email, nome);
      res.json({ email: info.email, nome });
    } catch (err) {
      console.warn('[farol] login falhou:', err.message);
      res.status(401).json({ error: 'Não foi possível confirmar o login.' });
    }
  });

  app.post('/auth/logout', (_req, res) => {
    res.setHeader('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    res.json({ ok: true });
  });

  // Tudo o que é dados fica atrás do login. O /api/health e o /api/config ficam
  // de fora para o Railway poder verificar o serviço e o ecrã de entrada carregar.
  app.use('/api', (req, res, next) => {
    if (!ativa()) return next();
    if (req.path === '/health' || req.path === '/config' || req.path === '/me') return next();
    const s = sessao(req);
    if (!s) return res.status(401).json({ error: 'Sessão terminada. Entra outra vez.' });
    // A lista pode ter mudado desde que o cookie foi emitido: quem deixou de
    // ter acesso perde-o já, sem esperar pelos 30 dias do cookie.
    if (!podeEntrar(s.email)) {
      console.warn('[farol] cookie válido mas sem acesso:', s.email);
      return res.status(403).json({ error: 'Esta conta já não tem acesso ao Farol.' });
    }
    next();
  });

  // A gestão de acessos entra depois da barreira: já só passa por aqui quem
  // tem sessão, e lá dentro ainda se confirma que é administrador.
  acessos.instalar(app, sessao, ativa);
  acessos.arrancar().catch((err) => console.error('[farol] acessos: arranque falhou —', err.message));

  // As pessoas do agregado. Mesmo sítio, pela mesma razão: já passou a barreira.
  pessoas.instalar(app);
  pessoas.arrancar().catch((err) => console.error('[farol] pessoas: arranque falhou —', err.message));
}

module.exports = {
  instalar,
  ativa,
  get permitidos() { return acessos.emails(); }
};
