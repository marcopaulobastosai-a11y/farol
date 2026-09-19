'use strict';
/**
 * Farol - contextos: as areas e as sub-areas.
 *
 * Uma area e um contexto sem pai; uma sub-area e um contexto com pai. Nao ha
 * terceiro nivel, e isso e uma decisao e nao uma limitacao: quando existem
 * tres sitios defensaveis para o mesmo papel, ninguem arruma nada.
 *
 * O que nao esta aqui, de proposito:
 *  - Familia e Saude nao precisam de sub-areas: as pessoas ja sao um eixo.
 *  - Cartoes e Documentos nao sao sub-areas: sao tipos, e um tipo filtra-se.
 *  - Projetos nao e area nenhuma: e uma vista por cima das areas.
 */
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;
const limpar = (v) => (v === undefined || v === '' ? null : v);

/* Quem depende de um contexto. Vale para saber se ele pode desaparecer. */
const LIGACOES = [
  ['tarefas',   'SELECT count(*)::int AS n FROM tasks     WHERE context_id = $1'],
  ['documentos','SELECT count(*)::int AS n FROM documents WHERE context_id = $1'],
  ['despesas',  'SELECT count(*)::int AS n FROM expenses  WHERE context_id = $1'],
  ['projetos',  'SELECT count(*)::int AS n FROM projects  WHERE context_id = $1'],
  ['sub-areas', 'SELECT count(*)::int AS n FROM contexts  WHERE parent_id  = $1']
];

function slugificar(nome) {
  return String(nome || '')
    .normalize('NFD')
    .split('')
    .filter((c) => { const n = c.charCodeAt(0); return n < 768 || n > 879; })
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function slugLivre(nome, id) {
  const base = slugificar(nome) || 'area';
  for (let i = 0; i < 50; i++) {
    const tentativa = i ? base + '-' + (i + 1) : base;
    const ha = await all('SELECT id FROM contexts WHERE slug = $1', [tentativa]);
    if (!ha.length || (id && ha[0].id === Number(id))) return tentativa;
  }
  return base + '-' + Date.now();
}

async function arvore() {
  const linhas = await all(
    `SELECT c.id, c.slug, c.name, c.parent_id, c.note, c.owner_id, c.sort, c.active,
            p.name AS parent_name
       FROM contexts c LEFT JOIN contexts p ON p.id = c.parent_id
      ORDER BY COALESCE(p.sort, c.sort), COALESCE(p.id, c.id), c.parent_id NULLS FIRST, c.sort, c.id`);
  return linhas;
}

function instalar(app) {
  app.get('/api/contextos', async (req, res) => {
    try {
      res.json({ contextos: await arvore() });
    } catch (err) {
      console.error('[farol] GET contextos:', err.message);
      res.status(500).json({ error: 'Nao foi possivel ler as areas.' });
    }
  });

  app.post('/api/contextos', async (req, res) => {
    const b = req.body || {};
    const nome = String(b.name || '').trim();
    if (!nome) return res.status(400).json({ error: 'A area precisa de um nome.' });
    try {
      const pai = b.parent_id ? Number(b.parent_id) : null;
      if (pai) {
        const acima = await all('SELECT parent_id FROM contexts WHERE id = $1', [pai]);
        if (!acima.length) return res.status(404).json({ error: 'Essa area nao existe.' });
        if (acima[0].parent_id) {
          return res.status(400).json({
            error: 'So ha dois niveis: uma sub-area nao pode ter sub-areas.'
          });
        }
      }
      const slug = await slugLivre(nome, null);
      const rows = await all(
        `INSERT INTO contexts (slug, name, parent_id, note, owner_id, sort)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6, (SELECT COALESCE(max(sort),0)+1 FROM contexts WHERE parent_id IS NOT DISTINCT FROM $3)))
         RETURNING id`,
        [slug, nome, pai, limpar(b.note), limpar(b.owner_id), limpar(b.sort)]);
      console.log('[farol] area criada:', slug);
      res.status(201).json({ id: rows[0].id, contextos: await arvore() });
    } catch (err) {
      console.error('[farol] POST contextos:', err.message);
      res.status(400).json({ error: 'Nao foi possivel criar a area.' });
    }
  });

  app.patch('/api/contextos/:id', async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    const tem = (k) => Object.prototype.hasOwnProperty.call(b, k);
    try {
      const atual = await all('SELECT * FROM contexts WHERE id = $1', [id]);
      if (!atual.length) return res.status(404).json({ error: 'Area nao encontrada.' });

      await query(
        `UPDATE contexts SET
           name     = COALESCE($2, name),
           note     = CASE WHEN $3 THEN $4 ELSE note END,
           owner_id = CASE WHEN $5 THEN $6 ELSE owner_id END,
           active   = COALESCE($7, active),
           sort     = COALESCE($8, sort)
         WHERE id = $1`,
        [id, limpar(b.name), tem('note'), limpar(b.note),
         tem('owner_id'), limpar(b.owner_id),
         tem('active') ? Boolean(b.active) : null, limpar(b.sort)]);

      res.json({ contextos: await arvore() });
    } catch (err) {
      console.error('[farol] PATCH contextos:', err.message);
      res.status(400).json({ error: 'Nao foi possivel gravar a area.' });
    }
  });

  /* Tirar uma area do caminho so quando nao sobra nada agarrado a ela. Para
     as outras vezes existe o estado desactivada. */
  app.delete('/api/contextos/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      const presos = [];
      for (const [nome, sql] of LIGACOES) {
        const [{ n }] = await all(sql, [id]);
        if (n) presos.push(n + ' ' + nome);
      }
      if (presos.length) {
        return res.status(409).json({
          error: 'Ainda ha coisas nesta area: ' + presos.join(', ') + '.'
        });
      }
      await query('DELETE FROM contexts WHERE id = $1', [id]);
      res.json({ contextos: await arvore() });
    } catch (err) {
      console.error('[farol] DELETE contextos:', err.message);
      res.status(400).json({ error: 'Nao foi possivel remover a area.' });
    }
  });
}

async function arrancar() {
  const [{ n }] = await all('SELECT count(*)::int AS n FROM contexts');
  console.log('[farol] areas na base de dados:', n);
}

module.exports = { instalar, arrancar };
