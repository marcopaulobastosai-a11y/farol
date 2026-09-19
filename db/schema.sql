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


-- Farol — Inbox (caixa de entrada) e destinos da triagem
-- Para acrescentar ao fim de db/schema.sql.
-- Só estrutura: nenhum dado pessoal, pode ir para o repositório público.


-- ---------------------------------------------------------------------------
-- 1. INBOX
-- ---------------------------------------------------------------------------
-- Captura sem decidir. Um item entra por triar e fica assim até alguém dizer
-- o que é. O ficheiro vive no volume do Railway; aqui guarda-se só o caminho.
--
-- origin = 'real' por omissão: a Inbox nunca é alimentada pelo seed.

CREATE TABLE IF NOT EXISTS inbox_items (
  id           SERIAL PRIMARY KEY,
  kind         TEXT NOT NULL DEFAULT 'ficheiro',
  title        TEXT,
  note         TEXT,

  -- ficheiro no volume
  file_path    TEXT,
  file_name    TEXT,
  mime_type    TEXT,
  byte_size    BIGINT,
  checksum     TEXT,

  captured_by  INTEGER REFERENCES people(id) ON DELETE SET NULL,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  status       TEXT NOT NULL DEFAULT 'por_triar',
  resolved_at  TIMESTAMPTZ,

  store        TEXT NOT NULL DEFAULT 'inbox',
  origin       TEXT NOT NULL DEFAULT 'real'
);

ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS store TEXT NOT NULL DEFAULT 'inbox';

-- store: 'inbox' (bucket temporário, por triar) | 'arquivo' (já catalogado)
--   Depois da triagem o objecto muda de bucket e esta coluna acompanha.
--   Se a mudança falhar, o item fica catalogado com store='inbox' — visível,
--   e recuperável, em vez de silenciosamente perdido.

-- kind:   'ficheiro' | 'nota'   (uma nota rápida sem anexo também é captura)
-- status: 'por_triar' | 'catalogado' | 'descartado'
--
-- file_path: caminho relativo dentro do volume, no formato AAAA/MM/uuid.ext
--   O nome original fica em file_name. Nunca usar o nome original no disco:
--   evita colisões e nomes com dados pessoais no caminho.
-- checksum: sha256 do ficheiro, para apanhar a mesma foto enviada duas vezes.

CREATE INDEX IF NOT EXISTS inbox_por_triar_idx
  ON inbox_items (captured_at DESC) WHERE status = 'por_triar';

CREATE INDEX IF NOT EXISTS inbox_checksum_idx ON inbox_items (checksum);


-- ---------------------------------------------------------------------------
-- 2. LIGAÇÕES DA TRIAGEM
-- ---------------------------------------------------------------------------
-- Um item pode dar origem a mais do que uma coisa. O talão da máquina de lavar
-- é despesa, é garantia e é documento — os três ao mesmo tempo. Por isso uma
-- tabela de ligação em vez de um par resolved_as/resolved_id no item.

CREATE TABLE IF NOT EXISTS inbox_links (
  inbox_id    INTEGER NOT NULL REFERENCES inbox_items(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id   INTEGER NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (inbox_id, target_type, target_id)
);

-- target_type: 'tarefa' | 'evento' | 'documento' | 'despesa'
--
-- Sem chave estrangeira, porque aponta para quatro tabelas diferentes.
-- A aplicação é responsável por manter isto coerente; em troca, ver o
-- ficheiro de uma tarefa é uma consulta directa:
--
--   SELECT i.* FROM inbox_items i
--     JOIN inbox_links l ON l.inbox_id = i.id
--    WHERE l.target_type = 'tarefa' AND l.target_id = $1;

CREATE INDEX IF NOT EXISTS inbox_links_target_idx
  ON inbox_links (target_type, target_id);


-- ---------------------------------------------------------------------------
-- 3. DESPESAS (tabela nova)
-- ---------------------------------------------------------------------------
-- As tabelas de Finanças que existem são agregados de demonstração
-- (budget_categories, finance_summary). Falta o movimento individual.

CREATE TABLE IF NOT EXISTS expenses (
  id          SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  spent_on    DATE NOT NULL,
  merchant    TEXT,
  category    TEXT,
  person_id   INTEGER REFERENCES people(id)   ON DELETE SET NULL,
  project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  note        TEXT,
  origin      TEXT NOT NULL DEFAULT 'qualidade',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_spent_idx  ON expenses (spent_on DESC);
CREATE INDEX IF NOT EXISTS expenses_origin_idx ON expenses (origin);


-- ---------------------------------------------------------------------------
-- 4. PROTEGER OS OUTROS DESTINOS DO SEED
-- ---------------------------------------------------------------------------
-- events e documents ainda não distinguem dados reais dos fictícios.
-- Sem isto, um `npm run seed` apaga o que a triagem produziu.

ALTER TABLE events    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'qualidade';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'qualidade';

CREATE INDEX IF NOT EXISTS events_origin_idx    ON events (origin);
CREATE INDEX IF NOT EXISTS documents_origin_idx ON documents (origin);


-- ---------------------------------------------------------------------------
-- 5. VALIDADE A SÉRIO NOS DOCUMENTOS
-- ---------------------------------------------------------------------------
-- documents.valid_until é TEXT: serve para escrever «até 2027» num cartão,
-- não para calcular que o passaporte caduca daqui a três semanas.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS valid_on  DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS person_id INTEGER REFERENCES people(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS documents_valid_idx ON documents (valid_on);

-- ATENÇÃO — isto repete o problema que já existe em tasks (done + status):
-- ficam duas colunas a dizer a mesma coisa e o frontend continua a ler a
-- antiga. É aceitável como passo intermédio, mas a dívida fica registada:
-- quando o ecrã de Documentos for refeito, passa a ler valid_on e
-- valid_until desaparece. O mesmo vale para tasks.done.


-- ---------------------------------------------------------------------------
-- 6. NOTA PARA O db/seed.sql
-- ---------------------------------------------------------------------------
-- Acrescentar às linhas de limpeza já existentes:
--
--   DELETE FROM events    WHERE origin = 'qualidade';
--   DELETE FROM documents WHERE origin = 'qualidade';
--   DELETE FROM expenses  WHERE origin = 'qualidade';
--
-- inbox_items e inbox_links NÃO entram no seed: não há inbox de demonstração.

-- ---------------------------------------------------------------------------
-- 7. SUGESTAO AUTOMATICA NA INBOX
-- ---------------------------------------------------------------------------
-- O modelo le o ficheiro e propoe o que ele e. A proposta fica guardada no
-- item e so se torna real quando alguem carrega em Catalogar: nada entra nas
-- tabelas de tarefas, eventos, documentos ou despesas sem confirmacao.

ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS ai_status TEXT NOT NULL DEFAULT 'nenhum';
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS ai_json   JSONB;
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS ai_at     TIMESTAMPTZ;
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS ai_erro   TEXT;

-- ai_status: 'nenhum'    - nao foi analisado (nota sem ficheiro, ou sem chave)
--            'pendente'  - a analisar neste momento
--            'feito'     - ha proposta em ai_json
--            'falhou'    - tentou e correu mal; ai_erro diz porque
--
-- ai_json guarda a proposta tal como veio, incluindo a confianca por campo.
-- Fica no item mesmo depois de catalogado: serve para perceber, mais tarde,
-- se o modelo costuma acertar ou se ha campos que falha sempre.

CREATE INDEX IF NOT EXISTS inbox_ai_idx ON inbox_items (ai_status) WHERE ai_status = 'pendente';

-- ---------------------------------------------------------------------------
-- Limpeza unica dos dados de demonstracao
--
-- A app deixou de filtrar por origin: mostra o que esta mesmo na base. As
-- linhas que sobraram da maqueta (origin = 'qualidade') sao apagadas uma vez
-- so, pela ordem que respeita as chaves estrangeiras. Se alguma coisa real
-- ainda depender de uma linha de demonstracao o bloco desiste sem estragar
-- nada e a app arranca na mesma; o aviso fica no log.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t     record;
  ordem text[] := ARRAY['inbox_links','inbox_items','expenses','documents','events',
                        'task_subjects','project_members','tasks','projects',
                        'calendars','people'];
BEGIN
  IF EXISTS (SELECT 1 FROM settings WHERE key = 'demo_removida') THEN
    RETURN;
  END IF;

  FOR t IN
    SELECT c.table_name AS nome,
           COALESCE(array_position(ordem, c.table_name), 99) AS pos
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.column_name = 'origin'
     ORDER BY pos
  LOOP
    EXECUTE format('DELETE FROM %I WHERE origin = %L', t.nome, 'qualidade');
  END LOOP;

  INSERT INTO settings (key, value)
  VALUES ('demo_removida', now()::text)
  ON CONFLICT (key) DO NOTHING;

  RAISE NOTICE '[farol] dados de demonstracao removidos.';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[farol] nao foi possivel remover a demonstracao: %', SQLERRM;
END $$;

-- A caixa de entrada tambem guarda de quem e o ficheiro. A catalogacao
-- automatica escreve aqui o que leu; o botao Pessoa, na caixa, corrige.
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS person_id INTEGER REFERENCES people(id) ON DELETE SET NULL;

-- Um documento tem duas datas que nao se confundem: a do papel (issued_on)
-- e aquela em que deixa de valer (valid_on). A catalogacao automatica le as
-- duas em separado; antes metia a mesma nas duas.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS issued_on DATE;

-- Por ler ou lido. Enquanto read_at for NULL, o documento conta para o numero
-- que aparece ao lado de Documentos no menu.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Contextos: as areas e as sub-areas, na mesma tabela
--
-- Uma area e um contexto sem pai; uma sub-area e um contexto com pai. So se
-- admitem dois niveis - a regra vive no src/contextos.js, porque uma arvore
-- funda transforma arrumar num exercicio de adivinhacao: se ha tres sitios
-- defensaveis para o mesmo papel, as onze da noite nao se arruma nada.
--
-- Os nomes reais (empresas, a casa, o carro) NAO entram aqui: este
-- repositorio e publico. Entram pela app, como as pessoas.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contexts (
  id         SERIAL PRIMARY KEY,
  slug       TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  parent_id  INTEGER REFERENCES contexts(id) ON DELETE RESTRICT,
  note       TEXT,
  owner_id   INTEGER REFERENCES people(id) ON DELETE SET NULL,
  sort       INT NOT NULL DEFAULT 0,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contexts_parent_idx ON contexts (parent_id);

-- Tudo o que se arruma aponta para um contexto.
ALTER TABLE tasks     ADD COLUMN IF NOT EXISTS context_id INTEGER REFERENCES contexts(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS context_id INTEGER REFERENCES contexts(id) ON DELETE SET NULL;
ALTER TABLE expenses  ADD COLUMN IF NOT EXISTS context_id INTEGER REFERENCES contexts(id) ON DELETE SET NULL;
ALTER TABLE projects  ADD COLUMN IF NOT EXISTS context_id INTEGER REFERENCES contexts(id) ON DELETE SET NULL;

-- Uma tarefa tem inicio e tem fim. O inicio nasce igual ao dia em que se
-- escreve a tarefa, mas muda-se: ha coisas que so comecam depois de outra.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS starts_on DATE;

-- Um projeto pode estar so planeado e a espera de outro. As obras da casa nao
-- podem chatear ninguem antes da escritura.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS depends_on_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;

-- Que tipo de papel e: cartao, contrato, apolice, declaracao, fatura. E um
-- filtro, nao uma pasta - assim <<cartoes a expirar>> e uma pergunta.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;

-- Documentos agarrados a uma tarefa.
CREATE TABLE IF NOT EXISTS task_documents (
  task_id     INTEGER NOT NULL REFERENCES tasks(id)     ON DELETE CASCADE,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, document_id)
);

-- A coluna area era texto solto. Sempre que o texto bater certo com o slug de
-- um contexto, a linha passa a apontar para ele. Corre a cada arranque, nao
-- estraga nada e nao precisa de saber nomes nenhuns.
UPDATE tasks t SET context_id = c.id FROM contexts c
 WHERE t.context_id IS NULL AND lower(trim(t.area)) = c.slug;
UPDATE projects p SET context_id = c.id FROM contexts c
 WHERE p.context_id IS NULL AND lower(trim(p.area)) = c.slug;

-- ---------------------------------------------------------------------------
-- Segunda limpeza: o que sobrou da maqueta nas tabelas sem coluna origin
--
-- A primeira limpeza so alcancou o que tinha origin. Ficaram 67 linhas
-- inventadas em Casa, Financas e Saude & rotinas: consumos de agua que
-- ninguem gastou, um orcamento de agosto, subscricoes que nao existem,
-- calendarios de pessoas que nao ha. Os ecras ficam - o desenho presta e um
-- dia enchem-se com o que e verdade. O que sai e a mentira.
--
-- attention e tiles saem tambem: o painel Hoje passou a calcular os dois a
-- partir de tarefas e documentos, e as tabelas deixaram de ser lidas.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t    text;
  alvo text[] := ARRAY['attention','tiles','maintenance','consumption','issues',
                       'assets','budget_categories','finance_summary','finance_alerts',
                       'subscriptions','credits','reserves','business_income',
                       'habits','habit_log','appointments','activity',
                       'archive_sources','support_routines','family_dates',
                       'event_sources','calendars'];
BEGIN
  IF EXISTS (SELECT 1 FROM settings WHERE key = 'maqueta_removida') THEN
    RETURN;
  END IF;

  FOREACH t IN ARRAY alvo LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DELETE FROM %I', t);
    END IF;
  END LOOP;

  -- O texto dos avisos descrevia um comportamento que nao existe (30, 15 e 5
  -- dias); o Hoje avisa a 7 e a 30. Sai com o resto.
  DELETE FROM notes WHERE slug = 'docs_avisos';

  INSERT INTO settings (key, value)
  VALUES ('maqueta_removida', now()::text)
  ON CONFLICT (key) DO NOTHING;

  RAISE NOTICE '[farol] maqueta removida.';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[farol] nao foi possivel remover a maqueta: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- As notas que sobraram falavam de numeros que ja nao existem: o tempo por
-- projecto, os 598 euros das subscricoes, a media de atividade, o sabado
-- vazio. Sai o que era descricao da maqueta; fica a nota que ensina a usar
-- a agenda, essa continua verdadeira.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM settings WHERE key = 'notas_maqueta_removidas') THEN
    RETURN;
  END IF;

  DELETE FROM notes WHERE slug IN ('projetos_tempo', 'subs_nota', 'saude_nota', 'agenda_carga');

  INSERT INTO settings (key, value)
  VALUES ('notas_maqueta_removidas', now()::text)
  ON CONFLICT (key) DO NOTHING;

  RAISE NOTICE '[farol] notas da maqueta removidas.';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[farol] nao foi possivel remover as notas: %', SQLERRM;
END $$;
