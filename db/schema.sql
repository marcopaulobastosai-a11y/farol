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

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  scope TEXT NOT NULL,           -- hoje | familia | projetos
  title TEXT NOT NULL,
  tag TEXT, tag_level TEXT,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  sort INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, description TEXT,
  status_label TEXT, status_level TEXT, progress INT NOT NULL DEFAULT 0,
  milestone TEXT, hours_4w NUMERIC, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY, name TEXT NOT NULL, entity TEXT,
  valid_until TEXT, status_label TEXT, status_level TEXT, sort INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, body TEXT NOT NULL
);

-- ===========================================================================
-- GESTÃO DE TAREFAS — pessoas, projetos e tarefas reais
-- ===========================================================================
-- origin marcava de onde vinha cada linha enquanto houve maqueta. A maqueta
-- acabou e o seed foi apagado: hoje tudo o que está na base é real, e é esse
-- o valor por omissão. A coluna fica porque as consultas filtram por ela.

ALTER TABLE people ADD COLUMN IF NOT EXISTS full_name     TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS kind          TEXT NOT NULL DEFAULT 'adulto';
ALTER TABLE people ADD COLUMN IF NOT EXISTS can_own_tasks BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS active        BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS origin        TEXT NOT NULL DEFAULT 'real';
-- kind: 'adulto' | 'crianca' | 'familiar' | 'animal'

ALTER TABLE projects ADD COLUMN IF NOT EXISTS area       TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status     TEXT NOT NULL DEFAULT 'ativo';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS started_on DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS target_on  DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS closed_on  DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS origin     TEXT NOT NULL DEFAULT 'real';
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
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS origin       TEXT NOT NULL DEFAULT 'real';
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
  origin      TEXT NOT NULL DEFAULT 'real',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expenses_spent_idx  ON expenses (spent_on DESC);
CREATE INDEX IF NOT EXISTS expenses_origin_idx ON expenses (origin);


-- ---------------------------------------------------------------------------
-- 4. origin TAMBÉM EM events E documents
-- ---------------------------------------------------------------------------
-- Nasceu para o seed não apagar o que a triagem produzia. O seed já não
-- existe; a coluna fica porque as consultas filtram por ela.

ALTER TABLE events    ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'real';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'real';

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

-- ---------------------------------------------------------------------------
-- Catalogar deixou de ser o mesmo que arrumar. A leitura automatica propoe,
-- o Marco aprova, e so entao o documento (ou a despesa) aparece nos ecras.
-- O que ja la estava antes desta mudanca conta como aprovado: ninguem vai
-- reaprovar o que ja tinha decidido.
-- ---------------------------------------------------------------------------
ALTER TABLE documents   ADD COLUMN IF NOT EXISTS aprovado BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE expenses    ADD COLUMN IF NOT EXISTS aprovado BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE inbox_items ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM settings WHERE key = 'aprovacao_em_vigor') THEN
    RETURN;
  END IF;

  UPDATE inbox_items
     SET approved_at = COALESCE(resolved_at, now())
   WHERE status = 'catalogado' AND approved_at IS NULL;

  INSERT INTO settings (key, value)
  VALUES ('aprovacao_em_vigor', now()::text)
  ON CONFLICT (key) DO NOTHING;

  RAISE NOTICE '[farol] aprovacao de documentos em vigor.';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[farol] nao foi possivel preparar a aprovacao: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- As vinte e uma tabelas da maqueta ficaram vazias em 19 set 2026 e nenhuma
-- linha de codigo as volta a ler. Uma tabela vazia que ninguem le nao custa
-- nada a correr, mas custa a quem vier a seguir: parece que alguma coisa a
-- devia estar a encher. Saem.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM settings WHERE key = 'maqueta_sem_tabelas') THEN
    RETURN;
  END IF;

  DROP TABLE IF EXISTS
    attention, tiles, maintenance, consumption, issues, assets,
    budget_categories, finance_summary, finance_alerts, subscriptions,
    credits, reserves, business_income, habit_log, habits,
    appointments, activity, archive_sources, support_routines,
    family_dates, event_sources;

  INSERT INTO settings (key, value)
  VALUES ('maqueta_sem_tabelas', now()::text)
  ON CONFLICT (key) DO NOTHING;

  RAISE NOTICE '[farol] tabelas da maqueta removidas.';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[farol] nao foi possivel remover as tabelas: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Compromissos de cada pessoa
--
-- Um evento nao dizia de quem era: o calendario 'farol' e um so para a casa
-- inteira. Para a ficha de uma pessoa poder mostrar os seus compromissos, o
-- evento passa a apontar para as pessoas envolvidas - pode ser mais do que
-- uma (a consulta do pai e tambem a boleia de quem o leva).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_people (
  event_id  INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, person_id)
);
CREATE INDEX IF NOT EXISTS event_people_person_idx ON event_people (person_id);

-- Os eventos que ja nasceram da caixa de entrada herdam a pessoa do ficheiro
-- de onde vieram. Corre uma vez: depois disso, quem manda e a triagem.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM settings WHERE key = 'eventos_com_pessoa') THEN
    RETURN;
  END IF;

  INSERT INTO event_people (event_id, person_id)
  SELECT l.target_id, i.person_id
    FROM inbox_links l
    JOIN inbox_items i ON i.id = l.inbox_id
    JOIN events e      ON e.id = l.target_id
   WHERE l.target_type = 'evento' AND i.person_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO settings (key, value)
  VALUES ('eventos_com_pessoa', now()::text)
  ON CONFLICT (key) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[farol] nao foi possivel ligar eventos a pessoas: %', SQLERRM;
END $$;

-- ---------------------------------------------------------------------------
-- Dados de cada pessoa
--
-- Ate aqui uma pessoa era um nome, uma cor e uma fotografia. Passa a guardar o
-- que a casa precisa de ter a mao: quando faz anos, como se fala com ela, os
-- numeros que se pedem em qualquer balcao (NIF, utente, documento de
-- identificacao) e a quem ligar numa aflicao.
--
-- O que so faz sentido para um tipo de pessoa (escola, microchip...) vive em
-- `detalhes`; o servidor so aceita as chaves do tipo dela.
-- `responsavel_id` e o encarregado de educacao de uma crianca ou quem
-- acompanha um familiar - a mesma relacao, com nomes diferentes.
-- ---------------------------------------------------------------------------
ALTER TABLE people ADD COLUMN IF NOT EXISTS birth_on        DATE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS phone           TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS email           TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS address         TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS nif             TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS sns             TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS id_doc_tipo     TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS id_doc_numero   TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS id_doc_validade DATE;
ALTER TABLE people ADD COLUMN IF NOT EXISTS emerg_nome      TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS emerg_tel       TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS conta_email     TEXT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS responsavel_id  INTEGER REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE people ADD COLUMN IF NOT EXISTS detalhes        JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Uma conta de acesso pertence a uma pessoa so.
CREATE UNIQUE INDEX IF NOT EXISTS people_conta_email_uidx ON people (conta_email)
  WHERE conta_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS people_responsavel_idx ON people (responsavel_id);

-- ---------------------------------------------------------------------------
-- Tarefas, segunda versao: o que se aprendeu com o TickTick
--
-- Uma tarefa passa a ter lista de verificacao (os passos de um pagamento:
-- transferir, mandar o comprovativo, acertar as contas partilhadas),
-- subtarefas, uma regra de repeticao a serio, lembretes, etiquetas livres,
-- comentarios que servem de registo e o estado «a espera».
--
-- Uma rotina que se conclui deixa uma copia concluida (o historico) e anda
-- para a proxima data. A copia aponta para a rotina por series_id.
--
-- external_id guarda a origem de quem veio de fora (ex.: 'ticktick:<id>'):
-- importar duas vezes nao duplica nada.
-- ---------------------------------------------------------------------------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id    INTEGER REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS series_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS repeat_rule  TEXT;      -- FREQ=MONTHLY;BYMONTHDAY=25 (RFC 5545, sem o prefixo RRULE:)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS repeat_from  TEXT NOT NULL DEFAULT 'prazo';  -- prazo | conclusao
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS repeat_until DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminders    JSONB NOT NULL DEFAULT '[]'::jsonb; -- [{"min":-900}] minutos em relacao ao prazo
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags         TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS section      TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order   DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS external_id  TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS tasks_external_idx ON tasks (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_parent_idx ON tasks (parent_id);
CREATE INDEX IF NOT EXISTS tasks_series_idx ON tasks (series_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks (status, completed_at DESC);
-- status passa a admitir 'a_espera'; prioridade passa a admitir 'media'.

CREATE TABLE IF NOT EXISTS task_items (
  id           SERIAL PRIMARY KEY,
  task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  done         BOOLEAN NOT NULL DEFAULT FALSE,
  sort         DOUBLE PRECISION NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS task_items_task_idx ON task_items (task_id, sort);

CREATE TABLE IF NOT EXISTS task_comments (
  id         SERIAL PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  author     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  external_id TEXT
);
CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments (task_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS task_comments_external_idx ON task_comments (external_id) WHERE external_id IS NOT NULL;

-- Projetos importados e documentos que vieram de notas tambem sabem de onde vieram.
ALTER TABLE projects  ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS projects_external_idx ON projects (external_id) WHERE external_id IS NOT NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS note        TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS documents_external_idx ON documents (external_id) WHERE external_id IS NOT NULL;

-- As rotinas antigas so tinham repeat_every em texto. Passam a regra.
UPDATE tasks SET repeat_rule = CASE repeat_every
    WHEN 'dia' THEN 'FREQ=DAILY' WHEN 'semana' THEN 'FREQ=WEEKLY'
    WHEN 'mes' THEN 'FREQ=MONTHLY' WHEN 'ano' THEN 'FREQ=YEARLY' END
 WHERE repeat_rule IS NULL AND repeat_every IN ('dia','semana','mes','ano');

-- ---------------------------------------------------------------------------
-- Tipos de linha: nem tudo o que esta na lista e uma tarefa
--
-- Havia tres coisas diferentes a viver na mesma lista e a pesar o mesmo:
--   tarefa   - pede uma acao nossa e tem ciclo de vida (por iniciar, em
--              execucao, concluida);
--   lembrete - so precisa de aparecer no dia certo (aniversarios, validades,
--              debitos que ja acontecem sozinhos). Nao se atrasa nem conta
--              para o que ha por fazer;
--   nota     - e memoria, nao trabalho (dados de uma empresa, atas, listas de
--              restaurantes). Em vez de prazo tem, quando faz sentido, uma
--              data de revisao - a mesma coluna due_on, lida de outra maneira.
-- ---------------------------------------------------------------------------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'tarefa';
CREATE INDEX IF NOT EXISTS tasks_tipo_idx ON tasks (tipo) WHERE tipo <> 'tarefa';

-- ---------------------------------------------------------------------------
-- Pagamentos: a tarefa que mexe em dinheiro
--
-- Um pagamento e uma tarefa com mais tres perguntas - quanto, a quem e com que
-- referencia - e com uma prova no fim: o comprovativo de quem pagou e o recibo
-- de quem recebeu. Pode ser pontual ou rotina (a renda, as mensalidades), pode
-- nascer de um documento que chega a caixa de entrada, e quando fica pago
-- escreve-se uma vez so: a despesa sai dali.
-- ---------------------------------------------------------------------------
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS amount         NUMERIC(10,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payee          TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_ref    TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS paid_on        DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS paid_amount    NUMERIC(10,2);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS expense_id     INTEGER REFERENCES expenses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tasks_pagamentos_idx ON tasks (due_on) WHERE tipo = 'pagamento';

-- Um papel nao e uma pasta: a mesma tarefa pode levar a fatura, o comprovativo
-- e o recibo, e so quem os ve sabe qual e qual.
ALTER TABLE task_documents ADD COLUMN IF NOT EXISTS papel TEXT NOT NULL DEFAULT 'anexo';
-- papel: 'anexo' | 'fatura' | 'comprovativo' | 'recibo'

-- ---------------------------------------------------------------------------
-- O valor por omissao de origin passa a 'real'
--
-- Um ALTER TABLE ... ADD COLUMN IF NOT EXISTS nao mexe numa coluna que ja
-- existe: as colunas criadas antes continuavam a nascer com 'qualidade', uma
-- palavra que aqui ja nao quer dizer nada. Isto corrige-as na base que esta
-- no ar. Nao apaga nem reescreve uma unica linha.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t record;
BEGIN
  IF EXISTS (SELECT 1 FROM settings WHERE key = 'origin_por_omissao_real') THEN
    RETURN;
  END IF;

  FOR t IN
    SELECT table_name AS nome
      FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'origin'
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN origin SET DEFAULT %L', t.nome, 'real');
  END LOOP;

  DELETE FROM settings WHERE key = 'env_nota';

  INSERT INTO settings (key, value)
  VALUES ('origin_por_omissao_real', now()::text)
  ON CONFLICT (key) DO NOTHING;

  RAISE NOTICE '[farol] origin passa a nascer real.';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[farol] nao foi possivel mudar o valor por omissao de origin: %', SQLERRM;
END $$;


-- ---------------------------------------------------------------------------
-- 15. PROGRAMAS — tres niveis: programa > projeto > tarefa
-- ---------------------------------------------------------------------------
-- Um lancamento de marca nao e uma tarefa grande nem uma area: e um conjunto
-- de projetos com fim. Faltava o nivel de cima, e sem ele tres projetos irmaos
-- nao sabiam que eram a mesma coisa.
--
-- Nao ha tabela nova: um programa e uma linha de projects com tipo='programa'.
-- As regras (um programa nao tem pai; um projeto so pende de um programa; uma
-- tarefa nunca pende de um programa) vivem no servidor, porque sao elas que
-- garantem que os niveis sao exactamente tres e que nao ha ciclos possiveis.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS tipo      TEXT NOT NULL DEFAULT 'projeto';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS projects_parent_idx ON projects (parent_id);
