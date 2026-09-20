'use strict';
const path = require('path');
const express = require('express');
const { query, ensureSchema } = require('./db');
const auth = require('./auth');
const inbox = require('./inbox');
const tarefas = require('./tarefas');
const acessos = require('./acessos');

/* Hoje e hoje. O seed deixou uma data fixa nas settings (28 de agosto) e a app
   inteira acreditava nela: o cabecalho mentia e a Agenda mostrava o dia errado.
   Estas quatro linhas passam a mandar sobre o que la estiver guardado. */
const MESES = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_PT = ['janeiro', 'fevereiro', 'mar\u00e7o', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIAS_PT = ['Domingo', 'Segunda-feira', 'Ter\u00e7a-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'S\u00e1bado'];

function doisDigitos(n) { return (n < 10 ? '0' : '') + n; }

function semanaDoAno(d) {
  const alvo = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dia = alvo.getUTCDay() || 7;
  alvo.setUTCDate(alvo.getUTCDate() + 4 - dia);
  const ano = new Date(Date.UTC(alvo.getUTCFullYear(), 0, 1));
  return Math.ceil(((alvo - ano) / 86400000 + 1) / 7);
}

function hojeMeta() {
  const d = new Date();
  const iso = d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1) + '-' + doisDigitos(d.getDate());
  const mes = MESES_PT[d.getMonth()];
  const seg = new Date(d); seg.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const dom = new Date(seg); dom.setDate(seg.getDate() + 6);
  const curto = (x) => x.getDate() + ' ' + MESES[x.getMonth()].slice(0, 3);
  return {
    today: iso,
    today_label: DIAS_PT[d.getDay()] + ', ' + d.getDate() + ' de ' + mes +
      ' de ' + d.getFullYear() + ' \u00b7 semana ' + semanaDoAno(d),
    month: iso.slice(0, 7),
    month_label: mes.charAt(0).toUpperCase() + mes.slice(1) + ' de ' + d.getFullYear(),
    week_label: curto(seg) + ' \u2013 ' + curto(dom)
  };
}

const app = express();
const PORT = process.env.PORT || 3000;
const APP_ENV = process.env.APP_ENV || 'qualidade';

/* 5 MB: a importacao do TickTick manda as tarefas aos lotes, com notas e
   passos; o limite por omissao (100 KB) cortava os lotes a meio. */
app.use(express.json({ limit: '5mb' }));
auth.instalar(app);
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));

const all = async (sql, params) => (await query(sql, params)).rows;

app.get('/api/health', async (_req, res) => {
  try {
    const [{ n: pessoas }] = await all('SELECT count(*)::int AS n FROM people');
    const [{ n: eventos }] = await all('SELECT count(*)::int AS n FROM events');
    res.json({ ok: true, env: APP_ENV, db: 'up', pessoas, eventos });
  } catch (err) {
    res.status(503).json({ ok: false, env: APP_ENV, db: 'down', error: err.message });
  }
});

function aniversarios(pessoas) {
  const hoje = new Date();
  const fora = [];
  pessoas.forEach((p) => {
    const [a, m, d] = p.birth_on.split('-').map(Number);
    [hoje.getFullYear(), hoje.getFullYear() + 1].forEach((ano) => {
      /* Quem nasceu a 29 de fevereiro faz anos a 28 nos anos comuns. */
      const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
      const dia = (m === 2 && d === 29 && !bissexto) ? 28 : d;
      const idade = ano - a;
      if (idade < 1) return;
      fora.push({
        id: 'nasc-' + p.id + '-' + ano,
        day: ano + '-' + String(m).padStart(2, '0') + '-' + String(dia).padStart(2, '0'),
        at: null,
        title: 'Aniversário · ' + p.name,
        calendar: 'aniversarios',
        detail: 'faz ' + idade + (idade === 1 ? ' ano' : ' anos')
      });
    });
  });
  return fora;
}

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const settingsRows = await all('SELECT key, value FROM settings');
    const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));

    /* O arranque lia vinte e nove tabelas; vinte e uma delas eram da maqueta e
       vinham sempre vazias - o ecra pagava-as a cada carregamento. Ficam as
       que tem dados a serio, mais as duas que sao contas feitas na hora. */
    const [people, calendars, events, attention, tiles, documents, notes, nascimentos] =
      await Promise.all([
      all(`SELECT id, code, name, role, initials, color, note,
                  (avatar IS NOT NULL) AS tem_avatar
             FROM people WHERE active ORDER BY sort`),
      all('SELECT code, name, color FROM calendars ORDER BY sort'),
      all("SELECT id, to_char(day,'YYYY-MM-DD') AS day, at, title, calendar, detail FROM events ORDER BY day, at NULLS FIRST, id"),
      all(`SELECT * FROM (
             SELECT 'tarefa' AS origem, t.id,
                    t.title AS title,
                    COALESCE(c.name, '') AS detail,
                    to_char(t.due_on,'YYYY-MM-DD') AS quando
               FROM tasks t LEFT JOIN contexts c ON c.id = t.context_id
              WHERE t.origin = 'real' AND NOT t.done AND t.status <> 'cancelada'
                AND t.due_on IS NOT NULL
                AND t.due_on <= CURRENT_DATE + INTERVAL '30 days'
             UNION ALL
             SELECT 'pessoa', p.id,
                    CASE p.id_doc_tipo WHEN 'tr' THEN 'Título de residência'
                                       ELSE 'Cartão de Cidadão' END || ' · ' || p.name,
                    'documento de identificação',
                    to_char(p.id_doc_validade,'YYYY-MM-DD')
               FROM people p
              WHERE p.active AND p.id_doc_validade IS NOT NULL
                AND p.id_doc_validade <= CURRENT_DATE + INTERVAL '60 days'
             UNION ALL
             SELECT 'documento', d.id,
                    d.name,
                    COALESCE(d.entity, ''),
                    to_char(d.valid_on,'YYYY-MM-DD')
               FROM documents d
              WHERE d.aprovado AND d.valid_on IS NOT NULL
                AND d.valid_on <= CURRENT_DATE + INTERVAL '60 days'
           ) x ORDER BY quando, title`),
      all(`SELECT 'Por fazer' AS label,
                  (SELECT count(*) FROM tasks
                    WHERE origin = 'real' AND NOT done AND status <> 'cancelada')::text AS value,
                  'tarefas abertas' AS note, 'tarefas' AS goto
           UNION ALL
           SELECT 'Com prazo a 7 dias',
                  (SELECT count(*) FROM tasks
                    WHERE origin = 'real' AND NOT done AND status <> 'cancelada'
                      AND due_on IS NOT NULL
                      AND due_on <= CURRENT_DATE + INTERVAL '7 days')::text,
                  'incluindo o que ja passou', 'tarefas'
           UNION ALL
           SELECT 'Projetos a andar',
                  (SELECT count(*) FROM projects
                    WHERE origin = 'real' AND status = 'ativo')::text,
                  'sem contar os planeados', 'projetos'
           UNION ALL
           SELECT 'Na caixa por triar',
                  (SELECT count(*) FROM inbox_items WHERE status = 'por_triar')::text,
                  'ficheiros a espera de decisao', 'inbox'`),
      all(`SELECT d.id, d.name, d.entity, d.person_id, d.kind, d.context_id,
                  d.status_label, d.status_level,
                  to_char(d.issued_on, 'YYYY-MM-DD') AS issued_on,
                  to_char(d.valid_on,  'YYYY-MM-DD') AS valid_on,
                  d.valid_until, (d.read_at IS NOT NULL) AS lido,
                  (SELECT l.inbox_id FROM inbox_links l
                    WHERE l.target_type = 'documento' AND l.target_id = d.id
                    ORDER BY l.inbox_id DESC LIMIT 1) AS inbox_id,
                  ARRAY(SELECT l.inbox_id FROM inbox_links l
                         WHERE l.target_type = 'documento' AND l.target_id = d.id
                         ORDER BY l.inbox_id) AS ficheiros
             FROM documents d
            WHERE d.aprovado
            ORDER BY d.sort, d.id DESC`),
      all('SELECT slug, body FROM notes'),
      all(`SELECT id, name, to_char(birth_on,'YYYY-MM-DD') AS birth_on
             FROM people WHERE active AND birth_on IS NOT NULL`)
    ]);

    /* Os aniversarios nao se escrevem na Agenda: saem da data de nascimento,
       este ano e o proximo, para a Agenda de dezembro ja ver janeiro. */
    const anos = aniversarios(nascimentos);
    if (anos.length) {
      calendars.push({ code: 'aniversarios', name: 'Aniversários', color: 'var(--c4)' });
      events.push(...anos);
      events.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    }

    res.json({
      meta: { env: APP_ENV, ...settings, ...hojeMeta() },
      people, calendars, events, attention, tiles, documents,
      notes: Object.fromEntries(notes.map((n) => [n.slug, n.body]))
    });
  } catch (err) {
    console.error('[farol] /api/bootstrap:', err.message);
    res.status(500).json({ error: 'Não foi possível ler a base de dados.' });
  }
});

app.patch('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'id inválido' });
  if (typeof req.body.done !== 'boolean') return res.status(400).json({ error: 'done tem de ser booleano' });
  try {
    const rows = await all(
      'UPDATE tasks SET done = $1, updated_at = now() WHERE id = $2 RETURNING id, scope, title, tag, tag_level, done',
      [req.body.done, id]
    );
    if (!rows.length) return res.status(404).json({ error: 'tarefa não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[farol] PATCH /api/tasks:', err.message);
    res.status(500).json({ error: 'Não foi possível gravar.' });
  }
});


/* ------------------------------------------------------------------ *
 * Gestão de tarefas — pessoas, projetos e tarefas reais (origin='real')
 * ------------------------------------------------------------------ */

const CORES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
const KINDS = ['adulto', 'crianca', 'familiar', 'animal'];
const PAPEIS = ['responsavel', 'participante', 'informado'];

function slug(text) {
  return String(text || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'pessoa';
}
function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '—';
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}
const limpar = (v) => (v === undefined || v === '' ? null : v);

async function codigoLivre(base) {
  let code = base, n = 1;
  /* eslint-disable no-await-in-loop */
  while ((await all('SELECT 1 FROM people WHERE code = $1', [code])).length) {
    n += 1; code = base + '-' + n;
  }
  return code;
}

async function carregarGestao() {
  const [people, projects, members, tasks, contextos] = await Promise.all([
    all(`SELECT id, code, name, full_name, role, kind, initials, color, can_own_tasks, active, note
           FROM people WHERE origin = 'real' ORDER BY sort, id`),
    all(`SELECT id, name, description, area, context_id, depends_on_id, status,
                to_char(started_on,'YYYY-MM-DD') AS started_on,
                to_char(target_on,'YYYY-MM-DD') AS target_on, sort
           FROM projects WHERE origin = 'real' ORDER BY sort, id`),
    all(`SELECT pm.project_id, pm.person_id, pm.member_role
           FROM project_members pm
           JOIN projects p ON p.id = pm.project_id
          WHERE p.origin = 'real'`),
    /* As tarefas vem do modulo proprio: abertas mais as fechadas ha pouco,
       com passos, etiquetas e repeticao. */
    tarefas.tarefasParaGestao(),
    /* As areas vao junto: e delas que os ecras de gestao precisam para
       mostrar onde cada coisa vive, e poupa-se um pedido. */
    all(`SELECT c.id, c.slug, c.name, c.parent_id, c.active, p.name AS parent_name
           FROM contexts c LEFT JOIN contexts p ON p.id = c.parent_id
          ORDER BY COALESCE(p.sort, c.sort), COALESCE(p.id, c.id), c.parent_id NULLS FIRST, c.sort, c.id`)
  ]);
  projects.forEach((p) => {
    p.members = members.filter((m) => m.project_id === p.id)
      .map((m) => ({ person_id: m.person_id, member_role: m.member_role }));
  });
  return { people, projects, tasks, contextos };
}

app.get('/api/gestao', async (_req, res) => {
  try {
    res.json(await carregarGestao());
  } catch (err) {
    console.error('[farol] GET /api/gestao:', err.message);
    res.status(500).json({ error: 'Não foi possível ler a base de dados.' });
  }
});

app.post('/api/gestao/pessoas', async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'O nome é obrigatório.' });
  const kind = KINDS.includes(b.kind) ? b.kind : 'adulto';
  try {
    const code = await codigoLivre(slug(name));
    const n = (await all("SELECT count(*)::int AS n FROM people WHERE origin = 'real'"))[0].n;
    const rows = await all(
      `INSERT INTO people (code, name, full_name, role, kind, initials, color, can_own_tasks, note, sort, origin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'real')
       RETURNING id, code, name, full_name, role, kind, initials, color, can_own_tasks, active, note`,
      [code, name, limpar(b.full_name), limpar(b.role), kind,
       b.initials || iniciais(b.full_name || name), b.color || CORES[n % CORES.length],
       b.can_own_tasks !== false && kind !== 'animal', limpar(b.note), n + 1]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[farol] POST /api/gestao/pessoas:', err.message);
    res.status(500).json({ error: 'Não foi possível gravar a pessoa.' });
  }
});

app.patch('/api/gestao/pessoas/:id', async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const campos = [], valores = [];
  ['name', 'full_name', 'role', 'kind', 'initials', 'color', 'note'].forEach((c) => {
    if (b[c] !== undefined) { campos.push(c + ' = $' + (campos.length + 1)); valores.push(limpar(b[c])); }
  });
  ['can_own_tasks', 'active'].forEach((c) => {
    if (typeof b[c] === 'boolean') { campos.push(c + ' = $' + (campos.length + 1)); valores.push(b[c]); }
  });
  if (!campos.length) return res.status(400).json({ error: 'Nada para alterar.' });
  try {
    valores.push(id);
    const rows = await all(
      `UPDATE people SET ${campos.join(', ')} WHERE id = $${valores.length} AND origin = 'real'
       RETURNING id, code, name, full_name, role, kind, initials, color, can_own_tasks, active, note`, valores);
    if (!rows.length) return res.status(404).json({ error: 'Pessoa não encontrada.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[farol] PATCH pessoa:', err.message);
    res.status(500).json({ error: 'Não foi possível gravar.' });
  }
});

async function gravarMembros(projectId, members) {
  await query('DELETE FROM project_members WHERE project_id = $1', [projectId]);
  for (const m of members || []) {
    const papel = PAPEIS.includes(m.member_role) ? m.member_role : 'participante';
    await query(
      `INSERT INTO project_members (project_id, person_id, member_role) VALUES ($1,$2,$3)
       ON CONFLICT (project_id, person_id) DO UPDATE SET member_role = EXCLUDED.member_role`,
      [projectId, Number(m.person_id), papel]);
  }
}

app.post('/api/gestao/projetos', async (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'O nome do projeto é obrigatório.' });
  try {
    const n = (await all("SELECT count(*)::int AS n FROM projects WHERE origin = 'real'"))[0].n;
    const rows = await all(
      `INSERT INTO projects (name, description, area, context_id, depends_on_id, status,
                             started_on, target_on, sort, origin, progress)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'real',0)
       RETURNING id, name, description, area, context_id, depends_on_id, status,
                 to_char(started_on,'YYYY-MM-DD') AS started_on, to_char(target_on,'YYYY-MM-DD') AS target_on`,
      [name, limpar(b.description), limpar(b.area), limpar(b.context_id), limpar(b.depends_on_id),
       b.status || 'ativo', limpar(b.started_on), limpar(b.target_on), n + 1]);
    await gravarMembros(rows[0].id, b.members);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('[farol] POST projeto:', err.message);
    res.status(500).json({ error: 'Não foi possível gravar o projeto.' });
  }
});

app.patch('/api/gestao/projetos/:id', async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const campos = [], valores = [];
  ['name', 'description', 'area', 'context_id', 'depends_on_id', 'status',
   'started_on', 'target_on', 'closed_on'].forEach((c) => {
    if (b[c] !== undefined) { campos.push(c + ' = $' + (campos.length + 1)); valores.push(limpar(b[c])); }
  });
  try {
    if (campos.length) {
      valores.push(id);
      const rows = await all(
        `UPDATE projects SET ${campos.join(', ')} WHERE id = $${valores.length} AND origin = 'real' RETURNING id`, valores);
      if (!rows.length) return res.status(404).json({ error: 'Projeto não encontrado.' });
    }
    if (Array.isArray(b.members)) await gravarMembros(id, b.members);
    res.json({ ok: true });
  } catch (err) {
    console.error('[farol] PATCH projeto:', err.message);
    res.status(500).json({ error: 'Não foi possível gravar.' });
  }
});

tarefas.instalar(app, {
  carregarGestao,
  quem: (req) => { const x = auth.sessao(req); return x ? (x.nome || x.email) : null; },
  ehAdmin: (req) => { if (!auth.ativa()) return true; const x = auth.sessao(req); return Boolean(x && acessos.ehAdmin(x.email)); }
});

inbox.instalar(app);

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

(async () => {
  try {
    await ensureSchema();
    /* Nada entra sozinho na base de dados: a app mostra o que la esta, e o
       que la esta foi alguem que o poe. */
    console.log('[farol] base de dados pronta.');
  } catch (err) {
    console.error('[farol] arranque sem base de dados:', err.message);
  }
  app.listen(PORT, () => console.log(
    `[farol] ambiente ${APP_ENV} a servir na porta ${PORT}` +
    (auth.ativa()
      ? ` · login Google activo (${auth.permitidos.length} conta(s) autorizada(s))`
      : ' · SEM autenticação — falta GOOGLE_CLIENT_ID ou SESSION_SECRET') +
  (inbox.bucketPronto() ? ' \u00b7 inbox com bucket' : ' \u00b7 inbox SEM bucket')));
})();
