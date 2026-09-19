'use strict';
const path = require('path');
const express = require('express');
const { query, ensureSchema, isEmpty, seed } = require('./db');
const auth = require('./auth');
const inbox = require('./inbox');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_ENV = process.env.APP_ENV || 'qualidade';

app.use(express.json());
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

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const settingsRows = await all('SELECT key, value FROM settings');
    const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));

    const [
      people, calendars, events, eventSources, attention, tasks, tiles,
      familyDates, support, maintenance, consumption, issues, assets,
      projects, budget, summary, alerts, subscriptions, credits, reserves,
      business, habits, habitLog, appointments, activity, documents, archive, notes
    ] = await Promise.all([
      all("SELECT id, code, name, role, initials, color, note FROM people WHERE active ORDER BY sort"),
      all('SELECT code, name, color FROM calendars ORDER BY sort'),
      all("SELECT id, to_char(day,'YYYY-MM-DD') AS day, at, title, calendar, detail FROM events ORDER BY day, at NULLS FIRST, id"),
      all('SELECT name, detail, status_label, status_level FROM event_sources ORDER BY sort'),
      all('SELECT level, title, detail, when_label, when_level FROM attention ORDER BY sort'),
      all("SELECT id, scope, title, tag, tag_level, done FROM tasks WHERE scope IS NOT NULL ORDER BY scope, sort"),
      all('SELECT label, value, note, goto FROM tiles ORDER BY sort'),
      all('SELECT title, when_label FROM family_dates ORDER BY sort'),
      all('SELECT title, detail, status_label, status_level FROM support_routines ORDER BY sort'),
      all('SELECT item, periodicity, last_label, next_label, status_label, status_level FROM maintenance ORDER BY sort'),
      all('SELECT utility, unit, month_label, value::float AS value, is_current, delta_label, delta_level FROM consumption ORDER BY utility, sort'),
      all('SELECT title, detail, status_label, status_level FROM issues ORDER BY sort'),
      all('SELECT name, bought_label, warranty_label, warranty_level FROM assets ORDER BY sort'),
      all("SELECT name, description, status_label, status_level, progress, milestone, hours_4w::float AS hours FROM projects ORDER BY sort"),
      all('SELECT name, spent::float AS spent, budget::float AS budget FROM budget_categories ORDER BY sort'),
      all('SELECT label, value, note FROM finance_summary ORDER BY sort'),
      all('SELECT level, badge, title, detail FROM finance_alerts ORDER BY sort'),
      all('SELECT name, amount_label, cycle, next_charge, note, note_level, yearly::float AS yearly, cuttable FROM subscriptions ORDER BY sort'),
      all('SELECT name, detail, amount_label, badge, badge_level FROM credits ORDER BY sort'),
      all('SELECT name, detail, status_label, status_level, pct FROM reserves ORDER BY sort'),
      all('SELECT name, detail, status_label, status_level FROM business_income ORDER BY sort'),
      all('SELECT id, name FROM habits ORDER BY sort'),
      all('SELECT habit_id, dow, level FROM habit_log ORDER BY habit_id, dow'),
      all('SELECT title, who, when_label, when_level FROM appointments ORDER BY sort'),
      all('SELECT week_index, minutes FROM activity ORDER BY week_index'),
      all('SELECT id, name, entity, valid_on, valid_until, person_id, status_label, status_level FROM documents ORDER BY sort, id DESC'),
      all('SELECT name, detail, status_label, status_level FROM archive_sources ORDER BY sort'),
      all('SELECT slug, body FROM notes')
    ]);

    const habitsOut = habits.map((h) => ({
      name: h.name,
      days: [0, 1, 2, 3, 4, 5, 6].map((d) => {
        const hit = habitLog.find((l) => l.habit_id === h.id && l.dow === d);
        return hit ? hit.level : 0;
      })
    }));

    res.json({
      meta: { env: APP_ENV, ...settings },
      people, calendars, events, eventSources, attention, tasks, tiles,
      familyDates, support, maintenance, consumption, issues, assets,
      projects, budget, summary, alerts, subscriptions, credits, reserves,
      business, habits: habitsOut, appointments, activity, documents, archive,
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
const STATUS = ['aberta', 'em_curso', 'concluida', 'cancelada'];
const PRIOS = ['baixa', 'normal', 'alta'];
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
  const [people, projects, members, tasks, subjects] = await Promise.all([
    all(`SELECT id, code, name, full_name, role, kind, initials, color, can_own_tasks, active, note
           FROM people WHERE origin = 'real' ORDER BY sort, id`),
    all(`SELECT id, name, description, area, status, to_char(started_on,'YYYY-MM-DD') AS started_on,
                to_char(target_on,'YYYY-MM-DD') AS target_on, sort
           FROM projects WHERE origin = 'real' ORDER BY sort, id`),
    all(`SELECT pm.project_id, pm.person_id, pm.member_role
           FROM project_members pm
           JOIN projects p ON p.id = pm.project_id
          WHERE p.origin = 'real'`),
    all(`SELECT id, title, notes, area, project_id, owner_id, status, priority,
                to_char(due_on,'YYYY-MM-DD') AS due_on, to_char(due_time,'HH24:MI') AS due_time,
                repeat_every, repeat_count, done
           FROM tasks WHERE origin = 'real'
          ORDER BY (due_on IS NULL), due_on, priority DESC, id`),
    all(`SELECT ts.task_id, ts.person_id FROM task_subjects ts
           JOIN tasks t ON t.id = ts.task_id WHERE t.origin = 'real'`)
  ]);
  tasks.forEach((t) => {
    t.subjects = subjects.filter((s) => s.task_id === t.id).map((s) => s.person_id);
  });
  projects.forEach((p) => {
    p.members = members.filter((m) => m.project_id === p.id)
      .map((m) => ({ person_id: m.person_id, member_role: m.member_role }));
  });
  return { people, projects, tasks };
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
      `INSERT INTO projects (name, description, area, status, started_on, target_on, sort, origin, progress)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'real',0)
       RETURNING id, name, description, area, status,
                 to_char(started_on,'YYYY-MM-DD') AS started_on, to_char(target_on,'YYYY-MM-DD') AS target_on`,
      [name, limpar(b.description), limpar(b.area), b.status || 'ativo',
       limpar(b.started_on), limpar(b.target_on), n + 1]);
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
  ['name', 'description', 'area', 'status', 'started_on', 'target_on', 'closed_on'].forEach((c) => {
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

async function gravarAssuntos(taskId, subjects) {
  await query('DELETE FROM task_subjects WHERE task_id = $1', [taskId]);
  for (const pid of subjects || []) {
    await query('INSERT INTO task_subjects (task_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [taskId, Number(pid)]);
  }
}

app.post('/api/gestao/tarefas', async (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim();
  if (!title) return res.status(400).json({ error: 'A tarefa precisa de um título.' });
  const status = STATUS.includes(b.status) ? b.status : 'aberta';
  const priority = PRIOS.includes(b.priority) ? b.priority : 'normal';
  try {
    const rows = await all(
      `INSERT INTO tasks (title, notes, area, project_id, owner_id, status, priority, due_on, due_time,
                          repeat_every, repeat_count, done, completed_at, origin, scope)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'real',NULL)
       RETURNING id`,
      [title, limpar(b.notes), limpar(b.area), limpar(b.project_id), limpar(b.owner_id), status, priority,
       limpar(b.due_on), limpar(b.due_time), limpar(b.repeat_every), b.repeat_count || 1,
       status === 'concluida', status === 'concluida' ? new Date() : null]);
    await gravarAssuntos(rows[0].id, b.subjects);
    res.status(201).json(await carregarGestao());
  } catch (err) {
    console.error('[farol] POST tarefa:', err.message);
    res.status(500).json({ error: 'Não foi possível gravar a tarefa.' });
  }
});

app.patch('/api/gestao/tarefas/:id', async (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const campos = [], valores = [];
  ['title', 'notes', 'area', 'project_id', 'owner_id', 'priority', 'due_on', 'due_time', 'repeat_every']
    .forEach((c) => {
      if (b[c] !== undefined) { campos.push(c + ' = $' + (campos.length + 1)); valores.push(limpar(b[c])); }
    });
  if (b.status !== undefined && STATUS.includes(b.status)) {
    campos.push('status = $' + (campos.length + 1)); valores.push(b.status);
    campos.push('done = $' + (campos.length + 1)); valores.push(b.status === 'concluida');
    campos.push('completed_at = $' + (campos.length + 1)); valores.push(b.status === 'concluida' ? new Date() : null);
  }
  campos.push('updated_at = now()');
  try {
    valores.push(id);
    const rows = await all(
      `UPDATE tasks SET ${campos.join(', ')} WHERE id = $${valores.length} AND origin = 'real' RETURNING id`, valores);
    if (!rows.length) return res.status(404).json({ error: 'Tarefa não encontrada.' });
    if (Array.isArray(b.subjects)) await gravarAssuntos(id, b.subjects);
    res.json(await carregarGestao());
  } catch (err) {
    console.error('[farol] PATCH tarefa:', err.message);
    res.status(500).json({ error: 'Não foi possível gravar.' });
  }
});

app.delete('/api/gestao/tarefas/:id', async (req, res) => {
  try {
    const rows = await all("DELETE FROM tasks WHERE id = $1 AND origin = 'real' RETURNING id", [Number(req.params.id)]);
    if (!rows.length) return res.status(404).json({ error: 'Tarefa não encontrada.' });
    res.json(await carregarGestao());
  } catch (err) {
    console.error('[farol] DELETE tarefa:', err.message);
    res.status(500).json({ error: 'Não foi possível apagar.' });
  }
});

inbox.instalar(app);

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

(async () => {
  try {
    await ensureSchema();
    /* Os dados de demonstração deixaram de entrar sozinhos: a app mostra o que
       lá está, e o que lá está é real. Para voltar a semear, npm run seed. */
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
