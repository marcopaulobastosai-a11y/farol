-- Farol — esquema da base de dados (PostgreSQL)
-- Todo o conteúdo da aplicação vive aqui; o frontend não tem dados embebidos.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  id     SERIAL PRIMARY KEY,
  code   TEXT UNIQUE NOT NULL,
  name   TEXT NOT NULL,
  role   TEXT,
  initials TEXT,
  color  TEXT NOT NULL DEFAULT 'var(--c1)',
  note   TEXT,
  in_household BOOLEAN NOT NULL DEFAULT TRUE,
  sort   INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS calendars (
  id    SERIAL PRIMARY KEY,
  code  TEXT UNIQUE NOT NULL,
  name  TEXT NOT NULL,
  color TEXT NOT NULL,
  sort  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id        SERIAL PRIMARY KEY,
  day       DATE NOT NULL,
  at        TEXT,
  title     TEXT NOT NULL,
  calendar  TEXT NOT NULL REFERENCES calendars(code) ON DELETE CASCADE,
  detail    TEXT,
  sort      INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS events_day_idx ON events(day);

CREATE TABLE IF NOT EXISTS event_sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL, detail TEXT,
  status_label TEXT, status_level TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS attention (
  id SERIAL PRIMARY KEY,
  level TEXT NOT NULL,           -- crit | due | info
  title TEXT NOT NULL, detail TEXT,
  when_label TEXT, when_level TEXT,
  sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  scope TEXT NOT NULL,           -- hoje | familia | projetos
  title TEXT NOT NULL,
  tag TEXT, tag_level TEXT,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  sort INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tiles (
  id SERIAL PRIMARY KEY,
  label TEXT NOT NULL, value TEXT NOT NULL, note TEXT,
  goto TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS family_dates (
  id SERIAL PRIMARY KEY, title TEXT NOT NULL, when_label TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS support_routines (
  id SERIAL PRIMARY KEY, title TEXT NOT NULL, detail TEXT,
  status_label TEXT, status_level TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS maintenance (
  id SERIAL PRIMARY KEY, item TEXT NOT NULL, periodicity TEXT,
  last_label TEXT, next_label TEXT,
  status_label TEXT, status_level TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS consumption (
  id SERIAL PRIMARY KEY, utility TEXT NOT NULL, unit TEXT,
  month_label TEXT NOT NULL, value NUMERIC NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  delta_label TEXT, delta_level TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS issues (
  id SERIAL PRIMARY KEY, title TEXT NOT NULL, detail TEXT,
  status_label TEXT, status_level TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS assets (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, bought_label TEXT,
  warranty_label TEXT, warranty_level TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT,
  status_label TEXT, status_level TEXT, progress INT NOT NULL DEFAULT 0,
  milestone TEXT, hours_4w NUMERIC, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS budget_categories (
  id SERIAL PRIMARY KEY, month_label TEXT NOT NULL, name TEXT NOT NULL,
  spent NUMERIC NOT NULL, budget NUMERIC NOT NULL, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS finance_summary (
  id SERIAL PRIMARY KEY, label TEXT NOT NULL, value TEXT NOT NULL, note TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS finance_alerts (
  id SERIAL PRIMARY KEY, level TEXT NOT NULL, badge TEXT, title TEXT NOT NULL, detail TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, amount_label TEXT NOT NULL,
  cycle TEXT, next_charge TEXT, note TEXT, note_level TEXT,
  yearly NUMERIC, cuttable BOOLEAN NOT NULL DEFAULT FALSE, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS credits (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, detail TEXT,
  amount_label TEXT, badge TEXT, badge_level TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reserves (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, detail TEXT,
  status_label TEXT, status_level TEXT, pct INT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS business_income (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, detail TEXT,
  status_label TEXT, status_level TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS habits (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS habit_log (
  id SERIAL PRIMARY KEY,
  habit_id INT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  dow INT NOT NULL CHECK (dow BETWEEN 0 AND 6),
  level INT NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 2),
  UNIQUE (habit_id, dow)
);

CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY, title TEXT NOT NULL, who TEXT,
  when_label TEXT, when_level TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS activity (
  id SERIAL PRIMARY KEY, week_index INT NOT NULL, minutes INT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, entity TEXT,
  valid_until TEXT, status_label TEXT, status_level TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS archive_sources (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, detail TEXT,
  status_label TEXT, status_level TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, body TEXT NOT NULL
);

-- Texto da barra de ambiente: garantido em cada arranque, sem apagar nada.
INSERT INTO settings (key, value) VALUES
  ('env_nota','Os dados não são reais — nenhum cliente, valor ou compromisso aqui existe.')
ON CONFLICT (key) DO NOTHING;


-- ===========================================================================
-- GESTÃO DE TAREFAS — pessoas, projetos e tarefas reais
-- ===========================================================================
-- origin separa os dois mundos: 'qualidade' (dados fictícios do seed, que
-- alimentam os ecrãs de demonstração) e 'real' (o que o Marco escreve na app).
-- O seed só apaga o que é seu; os dados reais nunca passam pelo repositório.

ALTER TABLE people ADD COLUMN IF NOT EXISTS full_name     TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS kind          TEXT NOT NULL DEFAULT 'adulto';
ALTER TABLE people ADD COLUMN IF NOT EXISTS can_own_tasks BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS active        BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS origin        TEXT NOT NULL DEFAULT 'qualidade';
-- kind: 'adulto' | 'crianca' | 'familiar' | 'animal'

ALTER TABLE projects ADD COLUMN IF NOT EXISTS area       TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'ativo';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS started_on DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_on  DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS closed_on  DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS origin     TEXT NOT NULL DEFAULT 'qualidade';
-- status: 'ativo' | 'pausado' | 'concluido' | 'arquivado'

CREATE TABLE IF NOT EXISTS project_members (
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  person_id   INTEGER NOT NULL REFERENCES people(id)   ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'participante',
  PRIMARY KEY (project_id, person_id)
);
-- member_role: 'responsavel' | 'participante' | 'informado'

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes        TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS area         TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id   INTEGER REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_id     INTEGER REFERENCES people(id)   ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status       TEXT NOT NULL DEFAULT 'aberta';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority     TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_on       DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time     TIME;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS repeat_every TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS repeat_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS origin       TEXT NOT NULL DEFAULT 'qualidade';
ALTER TABLE tasks ALTER COLUMN scope DROP NOT NULL;
-- status:   'aberta' | 'em_curso' | 'concluida' | 'cancelada'
-- priority: 'baixa' | 'normal' | 'alta'

CREATE TABLE IF NOT EXISTS task_subjects (
  task_id   INTEGER NOT NULL REFERENCES tasks(id)  ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, person_id)
);

CREATE INDEX IF NOT EXISTS tasks_due_idx     ON tasks (due_on) WHERE status IN ('aberta','em_curso');
CREATE INDEX IF NOT EXISTS tasks_owner_idx   ON tasks (owner_id);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks (project_id);
CREATE INDEX IF NOT EXISTS tasks_origin_idx  ON tasks (origin);
CREATE INDEX IF NOT EXISTS people_origin_idx ON people (origin);

-- As linhas antigas usavam só o booleano done; alinhar o status com ele.
UPDATE tasks SET status = 'concluida' WHERE done AND status = 'aberta';
