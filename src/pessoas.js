'use strict';
/**
 * Farol — as pessoas do agregado.
 *
 * A tabela `people` já existia (é dela que vivem as tarefas, a agenda e os
 * documentos). Aqui junta-se-lhe o retrato: uma fotografia guardada na própria
 * base de dados, pequena, com a data em que foi posta para o browser saber
 * quando a recarregar.
 *
 * Regra que importa: uma pessoa só desaparece quando não sobra nada agarrado a
 * ela. Enquanto houver uma tarefa, um projeto, uma despesa ou um documento,
 * a remoção é recusada e diz-se porquê. Para tirar alguém da frente sem perder
 * o histórico existe o estado — desactivada continua lá, deixa de aparecer.
 */
const { pool } = require('./db');

const MAX_AVATAR = 600 * 1024;           // bytes, depois de descodificado
const TIPOS = ['adulto', 'crianca', 'familiar', 'animal'];

const MIGRACAO = `
ALTER TABLE people ADD COLUMN IF NOT EXISTS avatar      BYTEA;
ALTER TABLE people ADD COLUMN IF NOT EXISTS avatar_mime TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS avatar_em   TIMESTAMPTZ;
`;

/* Tudo o que pode estar agarrado a uma pessoa. Se um dia houver mais uma
   tabela com person_id, acrescenta-se aqui — é esta lista que protege. */
/* O que fica agarrado a uma pessoa e impede que ela seja removida. A tabela
   e a coluna chegam para contar tudo de uma vez. */
const LIGACOES = [
  { chave: 'tarefas',    nome: 'tarefa',    plural: 'tarefas',    tabela: 'tasks',           coluna: 'owner_id' },
  { chave: 'assunto',    nome: 'tarefa onde é o assunto', plural: 'tarefas onde é o assunto', tabela: 'task_subjects', coluna: 'person_id' },
  { chave: 'projetos',   nome: 'projeto',   plural: 'projetos',   tabela: 'project_members', coluna: 'person_id' },
  { chave: 'despesas',   nome: 'despesa',   plural: 'despesas',   tabela: 'expenses',        coluna: 'person_id' },
  { chave: 'documentos', nome: 'documento', plural: 'documentos', tabela: 'documents',       coluna: 'person_id' },
  { chave: 'compromissos', nome: 'compromisso na agenda', plural: 'compromissos na agenda', tabela: 'event_people', coluna: 'person_id' },
  { chave: 'inbox',      nome: 'item na caixa de entrada', plural: 'itens na caixa de entrada', tabela: 'inbox_items', coluna: 'captured_by' }
];

const COLUNAS = `id, code, name, full_name, role, kind, can_own_tasks, color, initials, note,
                 in_household, active, sort, origin,
                 (avatar IS NOT NULL) AS tem_avatar, avatar_em`;

function limpar(v) { return typeof v === 'string' ? v.trim() : v; }

function iniciais(nome) {
  const p = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function codigo(nome) {
  const base = String(nome || 'pessoa')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base || 'pessoa';
}

async function codigoLivre(nome) {
  const base = codigo(nome);
  for (let i = 0; i < 50; i++) {
    const tentativa = i ? base + '-' + (i + 1) : base;
    const { rows } = await pool.query('SELECT 1 FROM people WHERE code = $1', [tentativa]);
    if (!rows.length) return tentativa;
  }
  return base + '-' + Date.now();
}

async function ligacoesDe(id) {
  return (await ligacoesDeTodas([id]))[id] || {};
}

/* Eram seis consultas por pessoa: oito pessoas custavam quarenta e nove idas
   a base de dados so para dizer quantas coisas tem agarradas. Agora e uma:
   cada ligacao conta-se de uma vez, agrupada por pessoa. */
async function ligacoesDeTodas(ids) {
  const fora = {};
  ids.forEach((id) => { fora[id] = {}; });
  if (!ids.length) return fora;

  const partes = LIGACOES.map((l) =>
    `SELECT '${l.chave}' AS chave, ${l.coluna} AS pid, count(*)::int AS n
       FROM ${l.tabela} WHERE ${l.coluna} = ANY($1) GROUP BY ${l.coluna}`);

  const { rows } = await pool.query(partes.join(' UNION ALL '), [ids]);
  rows.forEach((r) => {
    if (r.n && fora[r.pid]) fora[r.pid][r.chave] = r.n;
  });
  return fora;
}

async function lista() {
  const { rows } = await pool.query('SELECT ' + COLUNAS + ' FROM people ORDER BY active DESC, sort, name');
  const ligacoes = await ligacoesDeTodas(rows.map((p) => p.id));
  rows.forEach((p) => { p.ligacoes = ligacoes[p.id] || {}; });
  return rows;
}

const responder = (res) => lista().then((pessoas) => res.json({ pessoas }));

/* O browser manda a fotografia já encolhida, como data URL. */
function lerDataUrl(s) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));
  if (!m) throw new Error('Isso não é uma imagem que eu saiba ler.');
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > MAX_AVATAR) throw new Error('A fotografia é grande de mais.');
  return { mime: m[1], bytes };
}

async function arrancar() {
  await pool.query(MIGRACAO);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM people');
  console.log('[farol] pessoas: ' + rows[0].n + ' na base de dados');
}

/* ------------------------------------------------------------------ *
 * A ficha de uma pessoa
 *
 * O ecra da Familia mostrava oito cartoes que nao abriam para lado nenhum.
 * Tudo o que a app sabe de alguem ja esta na base de dados - so estava
 * espalhado por seis tabelas. Isto junta: o que tem para fazer, os papeis
 * que sao seus, o que gastou, em que projectos anda e o que ainda esta na
 * caixa de entrada a espera de decisao.
 * ------------------------------------------------------------------ */
async function ficha(id) {
  const uma = async (sql, params) => (await pool.query(sql, params || [id])).rows;

  const pessoa = (await uma('SELECT ' + COLUNAS + ' FROM people WHERE id = $1'))[0];
  if (!pessoa) return null;

  const tarefas = await uma(
    `SELECT t.id, t.title, t.done, t.status, t.priority, t.notes,
            to_char(t.due_on,    'YYYY-MM-DD') AS due_on,
            to_char(t.starts_on, 'YYYY-MM-DD') AS starts_on,
            c.name AS area, pai.name AS area_pai, pr.name AS projeto,
            (t.owner_id = $1) AS dono
       FROM tasks t
       LEFT JOIN contexts c   ON c.id = t.context_id
       LEFT JOIN contexts pai ON pai.id = c.parent_id
       LEFT JOIN projects pr  ON pr.id = t.project_id
      WHERE t.origin = 'real'
        AND (t.owner_id = $1
             OR EXISTS (SELECT 1 FROM task_subjects s
                         WHERE s.task_id = t.id AND s.person_id = $1))
      ORDER BY t.done, t.due_on NULLS LAST, t.id
      LIMIT 200`);

  const documentos = await uma(
    `SELECT d.id, d.name, d.entity, d.kind, (d.read_at IS NOT NULL) AS lido,
            to_char(d.issued_on, 'YYYY-MM-DD') AS issued_on,
            to_char(d.valid_on,  'YYYY-MM-DD') AS valid_on,
            c.name AS area, pai.name AS area_pai,
            (SELECT l.inbox_id FROM inbox_links l
              WHERE l.target_type = 'documento' AND l.target_id = d.id
              ORDER BY l.inbox_id DESC LIMIT 1) AS inbox_id
       FROM documents d
       LEFT JOIN contexts c   ON c.id = d.context_id
       LEFT JOIN contexts pai ON pai.id = c.parent_id
      WHERE d.person_id = $1 AND d.aprovado
      ORDER BY d.valid_on NULLS LAST, d.id DESC`);

  const despesas = await uma(
    `SELECT e.id, e.description, e.amount::float AS amount, e.merchant,
            to_char(e.spent_on, 'YYYY-MM-DD') AS spent_on,
            c.name AS area, pai.name AS area_pai
       FROM expenses e
       LEFT JOIN contexts c   ON c.id = e.context_id
       LEFT JOIN contexts pai ON pai.id = c.parent_id
      WHERE e.person_id = $1 AND e.aprovado
      ORDER BY e.spent_on DESC, e.id DESC
      LIMIT 50`);

  const projetos = await uma(
    `SELECT pr.id, pr.name, pr.status, pr.progress, m.member_role,
            to_char(pr.target_on, 'YYYY-MM-DD') AS target_on
       FROM project_members m
       JOIN projects pr ON pr.id = m.project_id
      WHERE m.person_id = $1
      ORDER BY pr.sort, pr.id`);

  const caixa = await uma(
    `SELECT i.id, i.title, i.file_name, i.status, i.ai_status,
            to_char(i.captured_at, 'YYYY-MM-DD') AS captured_at
       FROM inbox_items i
      WHERE i.person_id = $1 AND i.status <> 'descartado'
      ORDER BY i.captured_at DESC, i.id DESC
      LIMIT 30`);

  /* Os compromissos: o que esta na Agenda com o nome desta pessoa, de hoje
     para a frente. Os que ja passaram so interessam como contagem. */
  const compromissos = await uma(
    `SELECT e.id, e.title, e.at, e.detail, e.calendar,
            to_char(e.day, 'YYYY-MM-DD') AS day,
            (SELECT string_agg(o.name, ', ' ORDER BY o.sort, o.name)
               FROM event_people x JOIN people o ON o.id = x.person_id
              WHERE x.event_id = e.id AND x.person_id <> $1) AS com
       FROM events e
       JOIN event_people ep ON ep.event_id = e.id AND ep.person_id = $1
      WHERE e.day >= CURRENT_DATE
      ORDER BY e.day, e.at NULLS FIRST, e.id
      LIMIT 50`);

  const [{ n: compromissosPassados }] = await uma(
    `SELECT count(*)::int AS n
       FROM event_people ep JOIN events e ON e.id = ep.event_id
      WHERE ep.person_id = $1 AND e.day < CURRENT_DATE`);

  return { pessoa, tarefas, documentos, despesas, projetos, caixa, compromissos, compromissosPassados };
}

/* ---------------- ligação ao Express ---------------- */
function instalar(app) {
  app.get('/api/pessoas/:id/ficha', async (req, res) => {
    try {
      const f = await ficha(Number(req.params.id));
      if (!f) return res.status(404).json({ error: 'Pessoa nao encontrada.' });
      res.json(f);
    } catch (err) {
      console.error('[farol] ficha da pessoa:', err.message);
      res.status(500).json({ error: 'Nao foi possivel ler a ficha.' });
    }
  });

  app.get('/api/pessoas', async (_req, res) => {
    try { await responder(res); }
    catch (err) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/pessoas', async (req, res) => {
    const c = req.body || {};
    const nome = limpar(c.name);
    if (!nome) return res.status(400).json({ error: 'Falta o nome.' });
    const kind = TIPOS.indexOf(c.kind) >= 0 ? c.kind : 'adulto';
    try {
      const code = await codigoLivre(nome);
      const { rows } = await pool.query(
        `INSERT INTO people (code, name, full_name, role, kind, can_own_tasks, color, initials,
                             in_household, active, sort, origin)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE,$9,
                 (SELECT COALESCE(max(sort),0)+1 FROM people), 'real')
         RETURNING id`,
        [code, nome, limpar(c.full_name) || null, limpar(c.role) || null, kind,
         c.can_own_tasks !== false, limpar(c.color) || 'var(--c1)',
         limpar(c.initials) || iniciais(nome), c.active !== false]
      );
      const id = rows[0].id;
      if (c.avatar) {
        const a = lerDataUrl(c.avatar);
        await pool.query('UPDATE people SET avatar = $2, avatar_mime = $3, avatar_em = now() WHERE id = $1',
          [id, a.bytes, a.mime]);
      }
      console.log('[farol] pessoa criada: ' + nome);
      await responder(res);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.patch('/api/pessoas/:id', async (req, res) => {
    const c = req.body || {};
    const campos = [];
    const vals = [req.params.id];
    const por = (coluna, valor) => { vals.push(valor); campos.push(coluna + ' = $' + vals.length); };

    if (c.name !== undefined) {
      if (!limpar(c.name)) return res.status(400).json({ error: 'A pessoa tem de ter um nome.' });
      por('name', limpar(c.name));
    }
    if (c.full_name !== undefined) por('full_name', limpar(c.full_name) || null);
    if (c.role !== undefined) por('role', limpar(c.role) || null);
    if (c.kind !== undefined) {
      if (TIPOS.indexOf(c.kind) < 0) return res.status(400).json({ error: 'Tipo desconhecido.' });
      por('kind', c.kind);
    }
    if (c.can_own_tasks !== undefined) por('can_own_tasks', Boolean(c.can_own_tasks));
    if (c.active !== undefined) por('active', Boolean(c.active));
    if (c.color !== undefined) por('color', limpar(c.color) || 'var(--c1)');
    if (c.initials !== undefined) por('initials', limpar(c.initials) || null);
    if (c.note !== undefined) por('note', limpar(c.note) || null);
    if (!campos.length) return res.status(400).json({ error: 'Nada para mudar.' });

    try {
      const { rowCount } = await pool.query(
        'UPDATE people SET ' + campos.join(', ') + ' WHERE id = $1', vals);
      if (!rowCount) return res.status(404).json({ error: 'Pessoa não encontrada.' });
      await responder(res);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.delete('/api/pessoas/:id', async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT id, name FROM people WHERE id = $1', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Pessoa não encontrada.' });

      const presas = await ligacoesDe(rows[0].id);
      const chaves = Object.keys(presas);
      if (chaves.length) {
        const texto = chaves.map((k) => {
          const l = LIGACOES.find((x) => x.chave === k);
          return presas[k] + ' ' + (presas[k] === 1 ? l.nome : l.plural);
        }).join(', ');
        return res.status(409).json({
          error: rows[0].name + ' ainda tem ' + texto + '. Desactiva em vez de remover.',
          ligacoes: presas
        });
      }
      await pool.query('DELETE FROM people WHERE id = $1', [rows[0].id]);
      console.log('[farol] pessoa removida: ' + rows[0].name);
      await responder(res);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.post('/api/pessoas/:id/avatar', async (req, res) => {
    try {
      const a = lerDataUrl((req.body || {}).avatar);
      const { rowCount } = await pool.query(
        'UPDATE people SET avatar = $2, avatar_mime = $3, avatar_em = now() WHERE id = $1',
        [req.params.id, a.bytes, a.mime]);
      if (!rowCount) return res.status(404).json({ error: 'Pessoa não encontrada.' });
      await responder(res);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.delete('/api/pessoas/:id/avatar', async (req, res) => {
    try {
      await pool.query(
        'UPDATE people SET avatar = NULL, avatar_mime = NULL, avatar_em = NULL WHERE id = $1',
        [req.params.id]);
      await responder(res);
    } catch (err) { res.status(400).json({ error: err.message }); }
  });

  app.get('/api/pessoas/:id/avatar', async (req, res) => {
    try {
      const { rows } = await pool.query(
        'SELECT avatar, avatar_mime FROM people WHERE id = $1', [req.params.id]);
      if (!rows.length || !rows[0].avatar) return res.status(404).end();
      res.setHeader('Content-Type', rows[0].avatar_mime || 'image/jpeg');
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.end(rows[0].avatar);
    } catch (err) { res.status(500).end(); }
  });
}

module.exports = { arrancar, instalar, iniciais };
