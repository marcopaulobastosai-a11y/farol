'use strict';
const path = require('path');
const express = require('express');
const { query, ensureSchema, isEmpty, seed } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const APP_ENV = process.env.APP_ENV || 'qualidade';

app.use(express.json());
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
      all('SELECT code, name, role, initials, color, note FROM people ORDER BY sort'),
      all('SELECT code, name, color FROM calendars ORDER BY sort'),
      all("SELECT id, to_char(day,'YYYY-MM-DD') AS day, at, title, calendar, detail FROM events ORDER BY day, at NULLS FIRST, id"),
      all('SELECT name, detail, status_label, status_level FROM event_sources ORDER BY sort'),
      all('SELECT level, title, detail, when_label, when_level FROM attention ORDER BY sort'),
      all('SELECT id, scope, title, tag, tag_level, done FROM tasks ORDER BY scope, sort'),
      all('SELECT label, value, note, goto FROM tiles ORDER BY sort'),
      all('SELECT title, when_label FROM family_dates ORDER BY sort'),
      all('SELECT title, detail, status_label, status_level FROM support_routines ORDER BY sort'),
      all('SELECT item, periodicity, last_label, next_label, status_label, status_level FROM maintenance ORDER BY sort'),
      all('SELECT utility, unit, month_label, value::float AS value, is_current, delta_label, delta_level FROM consumption ORDER BY utility, sort'),
      all('SELECT title, detail, status_label, status_level FROM issues ORDER BY sort'),
      all('SELECT name, bought_label, warranty_label, warranty_level FROM assets ORDER BY sort'),
      all('SELECT name, description, status_label, status_level, progress, milestone, hours_4w::float AS hours FROM projects ORDER BY sort'),
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
      all('SELECT name, entity, valid_until, status_label, status_level FROM documents ORDER BY sort'),
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

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

(async () => {
  try {
    await ensureSchema();
    if (await isEmpty()) {
      console.log('[farol] base de dados vazia — a carregar os dados de qualidade.');
      await seed();
    }
    console.log('[farol] base de dados pronta.');
  } catch (err) {
    console.error('[farol] arranque sem base de dados:', err.message);
  }
  app.listen(PORT, () => console.log(`[farol] ambiente ${APP_ENV} a servir na porta ${PORT}`));
})();
