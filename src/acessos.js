'use strict';
/**
 * Farol — quem pode entrar.
 *
 * A lista de quem tem acesso vive na base de dados, não numa variável de
 * ambiente: assim muda-se pela app, sem deploy. Há um administrador protegido
 * (ADMIN_EMAIL) que não pode ser removido nem despromovido — nem pela página
 * de Acessos, nem por uma chamada directa à API. É a garantia de que ninguém
 * fecha a porta por dentro.
 *
 * O ALLOWED_EMAILS continua a servir para duas coisas, e só para essas:
 * semear a tabela na primeira arrancada e ser a rede de segurança se a base
 * de dados não responder.
 */
const { pool } = require('./db');

const ADMIN = (process.env.ADMIN_EMAIL || 'marcopaulobastosai@gmail.com').trim().toLowerCase();
const DO_AMBIENTE = (process.env.ALLOWED_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PAPEIS = ['admin', 'membro'];

const TABELA = `
CREATE TABLE IF NOT EXISTS access_emails (
  id         SERIAL PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  nome       TEXT,
  papel      TEXT NOT NULL DEFAULT 'membro',
  protegido  BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_por TEXT,
  visto_em   TIMESTAMPTZ
)`;

/* Cache em memória: é o que decide cada pedido, para não ir à base de dados
   a toda a hora. Recarrega sempre que a lista muda. */
let cache = [];
let pronto = false;

const normalizar = (email) => String(email || '').trim().toLowerCase();

function daRede(email) {
  /* Sem base de dados, vale o que estiver no ambiente — mais o administrador,
     que nunca fica de fora. */
  return email === ADMIN || DO_AMBIENTE.indexOf(email) >= 0;
}

function podeEntrar(email) {
  const e = normalizar(email);
  if (!e) return false;
  if (!pronto) return daRede(e);
  return cache.some((c) => c.email === e);
}

function ehAdmin(email) {
  const e = normalizar(email);
  if (!e) return false;
  if (e === ADMIN) return true;
  if (!pronto) return false;
  return cache.some((c) => c.email === e && c.papel === 'admin');
}

/* O arranque do servidor escreve quantas contas estão autorizadas. */
function emails() {
  return pronto ? cache.map((c) => c.email) : (DO_AMBIENTE.indexOf(ADMIN) >= 0 ? DO_AMBIENTE : [ADMIN].concat(DO_AMBIENTE));
}

async function recarregar() {
  const { rows } = await pool.query(
    'SELECT id, email, nome, papel, protegido, criado_em, criado_por, visto_em FROM access_emails ORDER BY protegido DESC, papel, email'
  );
  cache = rows;
  pronto = true;
  return rows;
}

async function arrancar() {
  await pool.query(TABELA);

  /* O administrador existe sempre, e sempre protegido. */
  await pool.query(
    `INSERT INTO access_emails (email, nome, papel, protegido, criado_por)
          VALUES ($1, $2, 'admin', TRUE, 'sistema')
     ON CONFLICT (email) DO UPDATE SET papel = 'admin', protegido = TRUE`,
    [ADMIN, 'Marco']
  );

  /* Só na primeira arrancada: traz o que estiver no ALLOWED_EMAILS. Depois
     disso a tabela manda, senão uma conta removida voltava a cada deploy. */
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM access_emails');
  if (rows[0].n <= 1) {
    for (const e of DO_AMBIENTE) {
      if (e === ADMIN) continue;
      await pool.query(
        "INSERT INTO access_emails (email, papel, criado_por) VALUES ($1, 'membro', 'ALLOWED_EMAILS') ON CONFLICT (email) DO NOTHING",
        [e]
      );
    }
  }

  await recarregar();
  console.log('[farol] acessos na base de dados: ' + cache.length + ' conta(s), administrador ' + ADMIN);
  return cache;
}

/* Guarda o nome que o Google devolve e a última entrada. Falha em silêncio:
   nunca deve ser motivo para um login não acontecer. */
async function registarEntrada(email, nome) {
  try {
    await pool.query(
      'UPDATE access_emails SET visto_em = now(), nome = COALESCE(NULLIF($2, \'\'), nome) WHERE email = $1',
      [normalizar(email), nome || '']
    );
    await recarregar();
  } catch (err) {
    console.warn('[farol] não foi possível registar a entrada:', err.message);
  }
}

/* ---------------- ligação ao Express ---------------- */
function instalar(app, sessao, ativa) {
  /* Só admins. Se a autenticação estiver desligada (ambiente sem Google),
     a app está aberta de qualquer maneira e não faz sentido trancar isto. */
  function soAdmin(req, res, next) {
    if (!ativa()) { req.quem = 'sem-autenticacao'; return next(); }
    const s = sessao(req);
    if (!s || !s.email) return res.status(401).json({ error: 'Sessão terminada. Entra outra vez.' });
    if (!ehAdmin(s.email)) return res.status(403).json({ error: 'Só os administradores gerem os acessos.' });
    req.quem = normalizar(s.email);
    next();
  }

  function responder(res) {
    return recarregar().then((contas) => res.json({
      administrador: ADMIN,
      contas: contas.map((c) => ({
        id: c.id,
        email: c.email,
        nome: c.nome,
        papel: c.papel,
        protegido: c.protegido,
        criado_em: c.criado_em,
        criado_por: c.criado_por,
        visto_em: c.visto_em
      }))
    }));
  }

  app.get('/api/acessos', soAdmin, async (req, res) => {
    try { await responder(res); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/acessos', soAdmin, async (req, res) => {
    const corpo = req.body || {};
    const email = normalizar(corpo.email);
    const papel = PAPEIS.indexOf(corpo.papel) >= 0 ? corpo.papel : 'membro';
    const nome = (corpo.nome || '').trim() || null;
    if (!EMAIL_OK.test(email)) return res.status(400).json({ error: 'Isso não parece um email.' });
    try {
      const { rowCount } = await pool.query(
        'INSERT INTO access_emails (email, nome, papel, criado_por) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
        [email, nome, papel, req.quem]
      );
      if (!rowCount) return res.status(409).json({ error: 'Essa conta já tem acesso.' });
      console.log('[farol] acesso dado a ' + email + ' por ' + req.quem);
      await responder(res);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.patch('/api/acessos/:id', soAdmin, async (req, res) => {
    const corpo = req.body || {};
    try {
      const { rows } = await pool.query('SELECT email, protegido FROM access_emails WHERE id = $1', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Conta não encontrada.' });
      if (rows[0].protegido && corpo.papel && corpo.papel !== 'admin') {
        return res.status(403).json({ error: 'O administrador do Farol não pode deixar de o ser.' });
      }
      if (corpo.papel && PAPEIS.indexOf(corpo.papel) < 0) {
        return res.status(400).json({ error: 'Papel desconhecido.' });
      }
      await pool.query(
        'UPDATE access_emails SET papel = COALESCE($2, papel), nome = COALESCE($3, nome) WHERE id = $1',
        [req.params.id, corpo.papel || null, (corpo.nome || '').trim() || null]
      );
      console.log('[farol] acesso alterado: ' + rows[0].email + ' por ' + req.quem);
      await responder(res);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/acessos/:id', soAdmin, async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT email, protegido FROM access_emails WHERE id = $1', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Conta não encontrada.' });
      if (rows[0].protegido) {
        return res.status(403).json({ error: 'Esta conta é o administrador do Farol e não pode ser removida.' });
      }
      await pool.query('DELETE FROM access_emails WHERE id = $1', [req.params.id]);
      console.log('[farol] acesso retirado a ' + rows[0].email + ' por ' + req.quem);
      await responder(res);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
}

module.exports = { arrancar, instalar, podeEntrar, ehAdmin, emails, registarEntrada, ADMIN };
