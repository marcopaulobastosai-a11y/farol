-- Familia: o cofre de cada pessoa e os sonhos da casa.
-- Corre em cada arranque: tudo idempotente.

-- O cofre guarda o que IDENTIFICA um cartao ou um documento, nunca o que
-- serve para pagar: de um cartao bancario so o banco, os ultimos 4 digitos e
-- a validade. O numero completo, o CVV e o PIN nao entram (o servidor corta).
CREATE TABLE IF NOT EXISTS fam_cofre (
  id          SERIAL PRIMARY KEY,
  person_id   INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL DEFAULT 'id',          -- 'banco' | 'id'
  nome        TEXT NOT NULL,                       -- Cartao de Cidadao, Classic Dual...
  entidade    TEXT,                                -- banco ou entidade emissora
  ultimos4    TEXT,                                -- so cartoes bancarios
  numero      TEXT,                                -- so documentos de identificacao
  validade    DATE,
  document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  nota        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fam_cofre_pessoa ON fam_cofre (person_id);

-- Os sonhos (e os pensamentos que ficam entre eles) da sub-area Sonhos.
CREATE TABLE IF NOT EXISTS fam_sonhos (
  id          SERIAL PRIMARY KEY,
  tipo        TEXT NOT NULL DEFAULT 'sonho',       -- 'sonho' | 'pensamento'
  titulo      TEXT,
  texto       TEXT,
  horizonte   TEXT NOT NULL DEFAULT 'cinco',       -- 'ano' | 'cinco' | 'vida'
  quem        TEXT,                                -- Familia, Ana Lucia e Marco Paulo...
  autor_id    INTEGER REFERENCES people(id) ON DELETE SET NULL,
  project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  conta_id    INTEGER,
  meta        NUMERIC(14,2),
  cor         TEXT,
  foto        BYTEA,
  foto_tipo   TEXT,
  ordem       INTEGER NOT NULL DEFAULT 0,
  cumprido    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fam_sonho_passos (
  id         SERIAL PRIMARY KEY,
  sonho_id   INTEGER NOT NULL REFERENCES fam_sonhos(id) ON DELETE CASCADE,
  texto      TEXT NOT NULL,
  quando     TEXT,
  feito      BOOLEAN NOT NULL DEFAULT FALSE,
  task_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  ordem      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS fam_sonho_passos_sonho ON fam_sonho_passos (sonho_id);
