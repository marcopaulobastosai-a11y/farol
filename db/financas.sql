-- ===========================================================================
-- Farol - Financas e Patrimonio (3 out 2026)
--
-- Corre a seguir ao schema.sql, em cada arranque (src/financas.js). Tem de ser
-- idempotente: so CREATE ... IF NOT EXISTS e ADD COLUMN IF NOT EXISTS.
-- Nada de dados reais aqui: o repositorio e publico. As contas, os saldos, os
-- orcamentos e as regras entram pela app.
-- ===========================================================================

-- Contas: a ordem, cartoes, poupanca, investimentos, dinheiro e as das
-- empresas. «pessoal» separa o patrimonio da casa do das empresas.
CREATE TABLE IF NOT EXISTS fin_contas (
  id               SERIAL PRIMARY KEY,
  nome             TEXT NOT NULL,
  tipo             TEXT NOT NULL DEFAULT 'ordem',
  instituicao      TEXT,
  context_id       INTEGER REFERENCES contexts(id) ON DELETE SET NULL,
  pessoal          BOOLEAN NOT NULL DEFAULT TRUE,
  saldo_inicial    NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_inicial_em DATE,
  mapa             JSONB,
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  sort             INT NOT NULL DEFAULT 0,
  nota             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- O saldo que se viu num dia (escrito a mao, ou o do extrato). Serve de ancora:
-- o saldo de hoje e a ultima ancora mais os movimentos que vieram depois.
CREATE TABLE IF NOT EXISTS fin_saldos (
  conta_id INTEGER NOT NULL REFERENCES fin_contas(id) ON DELETE CASCADE,
  em       DATE NOT NULL,
  saldo    NUMERIC(14,2) NOT NULL,
  PRIMARY KEY (conta_id, em)
);

-- Categorias em dois niveis (grupo › nome). A natureza decide se conta como
-- despesa ou receita: transferencias entre contas e financiamento (suprimentos,
-- emprestimos) nao sao gasto nem rendimento.
CREATE TABLE IF NOT EXISTS fin_categorias (
  id         SERIAL PRIMARY KEY,
  grupo      TEXT NOT NULL,
  nome       TEXT NOT NULL,
  natureza   TEXT NOT NULL DEFAULT 'despesa',
  fixa       BOOLEAN NOT NULL DEFAULT FALSE,
  context_id INTEGER REFERENCES contexts(id) ON DELETE SET NULL,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  sort       INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fin_categorias_uidx ON fin_categorias (lower(grupo), lower(nome));

-- O movimento do banco, tal como veio do extrato. valor com sinal: negativo
-- saiu, positivo entrou. «impressao» impede que o mesmo extrato importado duas
-- vezes duplique as linhas.
CREATE TABLE IF NOT EXISTS fin_movimentos (
  id               SERIAL PRIMARY KEY,
  conta_id         INTEGER NOT NULL REFERENCES fin_contas(id) ON DELETE CASCADE,
  data             DATE NOT NULL,
  descricao        TEXT NOT NULL,
  valor            NUMERIC(14,2) NOT NULL,
  saldo            NUMERIC(14,2),
  categoria_id     INTEGER REFERENCES fin_categorias(id) ON DELETE SET NULL,
  categoria_fonte  TEXT,
  context_id       INTEGER REFERENCES contexts(id) ON DELETE SET NULL,
  person_id        INTEGER REFERENCES people(id) ON DELETE SET NULL,
  expense_id       INTEGER REFERENCES expenses(id) ON DELETE SET NULL,
  ia_categoria_id  INTEGER REFERENCES fin_categorias(id) ON DELETE SET NULL,
  ia_confianca     NUMERIC(4,3),
  ia_fonte         TEXT,
  ia_em            TIMESTAMPTZ,
  impressao        TEXT NOT NULL,
  origem           TEXT NOT NULL DEFAULT 'import',
  nota             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fin_mov_impressao_uidx ON fin_movimentos (conta_id, impressao);
CREATE INDEX IF NOT EXISTS fin_mov_data_idx ON fin_movimentos (data DESC);
CREATE INDEX IF NOT EXISTS fin_mov_cat_idx ON fin_movimentos (categoria_id);
CREATE INDEX IF NOT EXISTS fin_mov_exp_idx ON fin_movimentos (expense_id) WHERE expense_id IS NOT NULL;
-- Um movimento pode pertencer a um projeto (o casamento, a casa nova): aparece
-- na pagina do projeto, com as entradas e as saidas.
ALTER TABLE fin_movimentos ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS fin_mov_proj_idx ON fin_movimentos (project_id) WHERE project_id IS NOT NULL;
-- Transferencia entre contas proprias: a saida numa conta e a entrada na outra
-- apontam uma para a outra (par_id dos dois lados). Assim sabe-se a conta de
-- origem e a de destino, e o dinheiro nao conta duas vezes.
ALTER TABLE fin_movimentos ADD COLUMN IF NOT EXISTS par_id INTEGER REFERENCES fin_movimentos(id) ON DELETE SET NULL;
-- O nome que o Marco da ao movimento. A descricao do extrato fica como esta
-- (e por ela que se reconhece a linha no banco); o titulo e o que se le.
ALTER TABLE fin_movimentos ADD COLUMN IF NOT EXISTS titulo TEXT;
-- De onde e o movimento: o restaurante, a empresa, o servico.
ALTER TABLE fin_movimentos ADD COLUMN IF NOT EXISTS entidade TEXT;
CREATE INDEX IF NOT EXISTS fin_mov_entidade ON fin_movimentos (entidade);

-- Contas correntes com empresas: as despesas de representacao que o Marco
-- adianta e depois apresenta (Credito Agricola, Cupula Arejada, Falua).
ALTER TABLE fin_cc_pessoas ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'pessoa';
-- Em que pe esta cada despesa adiantada: adiantado | apresentado | reembolsado.
ALTER TABLE fin_cc_mov ADD COLUMN IF NOT EXISTS estado TEXT;
CREATE INDEX IF NOT EXISTS fin_cc_mov_estado ON fin_cc_mov (estado) WHERE estado IS NOT NULL;
CREATE INDEX IF NOT EXISTS fin_mov_par_idx ON fin_movimentos (par_id) WHERE par_id IS NOT NULL;
-- Transferencia para (ou de) uma conta cujo outro lado nao esta no Farol (o
-- cartao cujo extrato ainda nao veio, o cartao da Sofia, as poupancas das
-- meninas): fica a conta, sem o movimento.
ALTER TABLE fin_movimentos ADD COLUMN IF NOT EXISTS para_conta_id INTEGER REFERENCES fin_contas(id) ON DELETE SET NULL;
-- O texto que, nos movimentos das outras contas, quer dizer «para esta conta»
-- (um por linha: o numero do contrato do cartao, a referencia da poupanca).
ALTER TABLE fin_contas ADD COLUMN IF NOT EXISTS identificadores TEXT;
-- De quem e o movimento: uma ou varias pessoas do agregado (person_id fica
-- com a primeira, para o que ainda so conhece uma).
ALTER TABLE fin_movimentos ADD COLUMN IF NOT EXISTS person_ids INTEGER[];
UPDATE fin_movimentos SET person_ids = ARRAY[person_id] WHERE person_id IS NOT NULL AND person_ids IS NULL;
CREATE INDEX IF NOT EXISTS fin_mov_pessoas_idx ON fin_movimentos USING GIN (person_ids);
-- A tarefa do movimento: o pagamento que ele pagou (tarefa -> despesa ->
-- movimento) ou uma tarefa qualquer a que diz respeito.
ALTER TABLE fin_movimentos ADD COLUMN IF NOT EXISTS task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS fin_mov_task_idx ON fin_movimentos (task_id) WHERE task_id IS NOT NULL;

-- Regras: «se a descricao contem X (e o valor esta entre A e B, e a conta e
-- C) entao categoria Y». Aplicam-se antes da IA e sem perguntar.
CREATE TABLE IF NOT EXISTS fin_regras (
  id           SERIAL PRIMARY KEY,
  padrao       TEXT NOT NULL,
  valor_min    NUMERIC(14,2),
  valor_max    NUMERIC(14,2),
  conta_id     INTEGER REFERENCES fin_contas(id) ON DELETE CASCADE,
  categoria_id INTEGER NOT NULL REFERENCES fin_categorias(id) ON DELETE CASCADE,
  context_id   INTEGER REFERENCES contexts(id) ON DELETE SET NULL,
  origem       TEXT NOT NULL DEFAULT 'tu',
  usos         INTEGER NOT NULL DEFAULT 0,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Orcamento mensal por categoria. «acumula»: o que sobra de um mes passa para
-- o seguinte (e o que falta tambem).
CREATE TABLE IF NOT EXISTS fin_orcamentos (
  id           SERIAL PRIMARY KEY,
  categoria_id INTEGER NOT NULL UNIQUE REFERENCES fin_categorias(id) ON DELETE CASCADE,
  mensal       NUMERIC(12,2) NOT NULL,
  acumula      BOOLEAN NOT NULL DEFAULT FALSE,
  desde        DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  ativo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bens e dividas que nao sao contas: casa, carro, credito automovel.
CREATE TABLE IF NOT EXISTS fin_bens (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL,
  lado       TEXT NOT NULL DEFAULT 'ativo',
  classe     TEXT NOT NULL DEFAULT 'outro',
  valor      NUMERIC(14,2),
  valor_em   DATE,
  prestacao  NUMERIC(12,2),
  termina    DATE,
  context_id INTEGER REFERENCES contexts(id) ON DELETE SET NULL,
  pessoal    BOOLEAN NOT NULL DEFAULT TRUE,
  nota       TEXT,
  ativo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A ficha de um bem: o que o identifica (artigo matricial, registo, area,
-- matricula, compra) e a sub-area da Casa onde se vive nele. Tudo opcional.
ALTER TABLE fin_bens ADD COLUMN IF NOT EXISTS dados JSONB;

-- Contas correntes: com quem se divide dinheiro. Quem esta no Splitwise
-- (splitwise_id) acerta-se sozinho ao fim do dia; os outros a mao.
CREATE TABLE IF NOT EXISTS fin_cc_pessoas (
  id               SERIAL PRIMARY KEY,
  nome             TEXT NOT NULL,
  person_id        INTEGER REFERENCES people(id) ON DELETE SET NULL,
  splitwise_id     BIGINT UNIQUE,
  saldo_splitwise  NUMERIC(14,2),
  por_grupo        JSONB,
  lido_em          TIMESTAMPTZ,
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  nota             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- valor com sinal, visto do lado do Marco: positivo = a pessoa deve-lhe,
-- negativo = ele deve a pessoa.
CREATE TABLE IF NOT EXISTS fin_cc_mov (
  id                   SERIAL PRIMARY KEY,
  pessoa_id            INTEGER NOT NULL REFERENCES fin_cc_pessoas(id) ON DELETE CASCADE,
  data                 DATE NOT NULL,
  descricao            TEXT NOT NULL,
  valor                NUMERIC(14,2) NOT NULL,
  origem               TEXT NOT NULL DEFAULT 'tu',
  splitwise_expense_id BIGINT,
  grupo                TEXT,
  grupo_id             BIGINT,
  total                NUMERIC(14,2),
  pagamento            BOOLEAN NOT NULL DEFAULT FALSE,
  apagado              BOOLEAN NOT NULL DEFAULT FALSE,
  movimento_id         INTEGER REFERENCES fin_movimentos(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS fin_cc_sw_uidx ON fin_cc_mov (pessoa_id, splitwise_expense_id) WHERE splitwise_expense_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS fin_cc_mov_uidx ON fin_cc_mov (movimento_id) WHERE movimento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fin_cc_pessoa_idx ON fin_cc_mov (pessoa_id, data);

-- Contas divididas: o Marco paga o jantar inteiro e os amigos devolvem a parte
-- deles. O movimento do banco reparte-se em partes: a do Marco (com categoria,
-- e a unica que conta como despesa) e a de cada pessoa (sem categoria: e
-- dinheiro adiantado, fica na conta corrente dela ate devolver). As partes
-- tem o sinal do movimento e somam o valor dele.
CREATE TABLE IF NOT EXISTS fin_mov_partes (
  id           SERIAL PRIMARY KEY,
  movimento_id INTEGER NOT NULL REFERENCES fin_movimentos(id) ON DELETE CASCADE,
  valor        NUMERIC(14,2) NOT NULL,
  categoria_id INTEGER REFERENCES fin_categorias(id) ON DELETE SET NULL,
  pessoa_id    INTEGER REFERENCES fin_cc_pessoas(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_partes_mov_idx ON fin_mov_partes (movimento_id);
-- A parte de uma pessoa entra na conta corrente dela (origem 'partilha').
ALTER TABLE fin_cc_mov ADD COLUMN IF NOT EXISTS parte_id INTEGER REFERENCES fin_mov_partes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS fin_cc_parte_idx ON fin_cc_mov (parte_id) WHERE parte_id IS NOT NULL;

-- Contas correntes: cada grupo do Splitwise e uma conta corrente com os seus
-- membros (uma pessoa pode estar em varias). O que nao e de nenhum grupo fica
-- na conta direta com essa pessoa (pessoa_direta_id). Tambem se criam contas
-- so do Farol, com quem se quiser.
CREATE TABLE IF NOT EXISTS fin_cc_contas (
  id                 SERIAL PRIMARY KEY,
  nome               TEXT NOT NULL,
  splitwise_grupo_id BIGINT UNIQUE,
  pessoa_direta_id   INTEGER UNIQUE REFERENCES fin_cc_pessoas(id) ON DELETE CASCADE,
  ativo              BOOLEAN NOT NULL DEFAULT TRUE,
  nota               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fin_cc_membros (
  conta_id  INTEGER NOT NULL REFERENCES fin_cc_contas(id) ON DELETE CASCADE,
  pessoa_id INTEGER NOT NULL REFERENCES fin_cc_pessoas(id) ON DELETE CASCADE,
  PRIMARY KEY (conta_id, pessoa_id)
);
ALTER TABLE fin_cc_mov ADD COLUMN IF NOT EXISTS conta_id INTEGER REFERENCES fin_cc_contas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS fin_cc_mov_conta_idx ON fin_cc_mov (conta_id) WHERE conta_id IS NOT NULL;

-- Contas partilhadas: um ou mais pagamentos do banco divididos com outros.
-- Quanto paga o Marco (minha, pode ser zero) e as linhas de cada pessoa, que
-- sao as partes (fin_mov_partes) com a conta corrente onde ficam. Quando a
-- conta corrente e do Splitwise, a despesa vai para la (splitwise guarda, por
-- conta corrente, o id da despesa e se foi o Farol que a criou).
CREATE TABLE IF NOT EXISTS fin_partilhas (
  id           SERIAL PRIMARY KEY,
  movimento_id INTEGER REFERENCES fin_movimentos(id) ON DELETE CASCADE,
  descricao    TEXT NOT NULL,
  data         DATE NOT NULL,
  total        NUMERIC(14,2) NOT NULL,
  minha        NUMERIC(14,2) NOT NULL DEFAULT 0,
  iguais       BOOLEAN NOT NULL DEFAULT FALSE,
  categoria_id INTEGER REFERENCES fin_categorias(id) ON DELETE SET NULL,
  splitwise    JSONB,
  nota         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_partilhas_mov_idx ON fin_partilhas (movimento_id);
ALTER TABLE fin_mov_partes ADD COLUMN IF NOT EXISTS partilha_id INTEGER REFERENCES fin_partilhas(id) ON DELETE CASCADE;
ALTER TABLE fin_mov_partes ADD COLUMN IF NOT EXISTS cc_conta_id INTEGER REFERENCES fin_cc_contas(id) ON DELETE SET NULL;
-- A linha vai para o Splitwise (na conta corrente dela) ou fica so no Farol.
ALTER TABLE fin_mov_partes ADD COLUMN IF NOT EXISTS sw BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS fin_partes_partilha_idx ON fin_mov_partes (partilha_id) WHERE partilha_id IS NOT NULL;
-- Como se dividiu (como no Splitwise: partes iguais, valores, percentagens,
-- porcoes, ajustes; ou paguei por um amigo) e o que se escreveu em cada linha,
-- para a janela voltar a abrir igual.
ALTER TABLE fin_partilhas ADD COLUMN IF NOT EXISTS metodo TEXT;
ALTER TABLE fin_partilhas ADD COLUMN IF NOT EXISTS entradas JSONB;
-- Um acerto (alguem paga o que devia) ou um emprestimo devolvido pode ir
-- tambem para o Splitwise como pagamento: o id dessa despesa de pagamento e
-- se foi o Farol que a criou (so essa se apaga ao desligar).
ALTER TABLE fin_cc_mov ADD COLUMN IF NOT EXISTS sw_pagamento_id BIGINT;
ALTER TABLE fin_cc_mov ADD COLUMN IF NOT EXISTS sw_criado BOOLEAN NOT NULL DEFAULT FALSE;

-- Categorias de partida, genericas, uma vez so. Depois disso a lista e do
-- Marco: o que ele apagar nao volta.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM settings WHERE key = 'fin_categorias_iniciais') THEN
    INSERT INTO fin_categorias (grupo, nome, natureza, fixa, sort) VALUES
      ('Casa & Utilidades','Renda','despesa',TRUE,10),
      ('Casa & Utilidades','Electricidade & Gás','despesa',FALSE,11),
      ('Casa & Utilidades','Água','despesa',FALSE,12),
      ('Casa & Utilidades','Supermercado','despesa',FALSE,13),
      ('Casa & Utilidades','Manutenção da casa','despesa',FALSE,14),
      ('Transportes','Combustível','despesa',FALSE,20),
      ('Transportes','Crédito automóvel','despesa',TRUE,21),
      ('Transportes','Seguro automóvel','despesa',TRUE,22),
      ('Transportes','Estacionamento','despesa',FALSE,23),
      ('Transportes','Portagens','despesa',FALSE,24),
      ('Transportes','Manutenção automóvel','despesa',FALSE,25),
      ('Comidas & Bebidas','Restaurantes','despesa',FALSE,30),
      ('Comidas & Bebidas','Take-away','despesa',FALSE,31),
      ('Comidas & Bebidas','Café & snacks','despesa',FALSE,32),
      ('Educação','Ativ. extracurriculares','despesa',FALSE,40),
      ('Educação','Alimentação (escola)','despesa',FALSE,41),
      ('Educação','Material escolar','despesa',FALSE,42),
      ('Educação','Propinas & formação','despesa',FALSE,43),
      ('Contas & subscrições','TV, Internet & Telefone','despesa',TRUE,50),
      ('Contas & subscrições','Telemóveis','despesa',TRUE,51),
      ('Contas & subscrições','Séries & Filmes','despesa',TRUE,52),
      ('Contas & subscrições','Música','despesa',TRUE,53),
      ('Contas & subscrições','Cloud & software','despesa',TRUE,54),
      ('Desporto','Ginásio','despesa',TRUE,60),
      ('Desporto','Desporto','despesa',FALSE,61),
      ('Saúde','Farmácia','despesa',FALSE,70),
      ('Saúde','Consultas & exames','despesa',FALSE,71),
      ('Saúde','Seguro de saúde','despesa',TRUE,72),
      ('Vestuário & Calçado','Roupa & calçado','despesa',FALSE,80),
      ('Vestuário & Calçado','Lavandaria','despesa',FALSE,81),
      ('Lazer','Viagens','despesa',FALSE,90),
      ('Lazer','Lazer & cultura','despesa',FALSE,91),
      ('Pessoais','Cuidados pessoais','despesa',FALSE,100),
      ('Pessoais','Presentes','despesa',FALSE,101),
      ('Pessoais','Semanadas','despesa',FALSE,102),
      ('Impostos & Contribuições','IRS','despesa',FALSE,110),
      ('Impostos & Contribuições','Segurança Social','despesa',FALSE,111),
      ('Impostos & Contribuições','IUC & IMI','despesa',FALSE,112),
      ('Financeiras','Comissões bancárias','despesa',FALSE,120),
      ('Financeiras','Juros','despesa',FALSE,121),
      ('Outras','Outras despesas','despesa',FALSE,130),
      ('Receitas','Salário','receita',TRUE,200),
      ('Receitas','Subsídios','receita',FALSE,201),
      ('Receitas','Reembolsos','receita',FALSE,202),
      ('Receitas','Vendas & serviços','receita',FALSE,203),
      ('Receitas','Rendimentos de investimento','receita',FALSE,204),
      ('Receitas','Outras receitas','receita',FALSE,205),
      ('Transferências','Entre contas','transferencia',FALSE,300),
      ('Transferências','Pagamento do cartão','transferencia',FALSE,301),
      ('Transferências','Poupança','transferencia',FALSE,302),
      ('Transferências','PPR','transferencia',FALSE,303),
      ('Transferências','Ações & ETF','transferencia',FALSE,304),
      ('Transferências','Acertos de contas correntes','transferencia',FALSE,305),
      ('Financiamento','Suprimentos','financiamento',FALSE,400),
      ('Financiamento','Empréstimos','financiamento',FALSE,401)
    ON CONFLICT DO NOTHING;
    INSERT INTO settings (key, value) VALUES ('fin_categorias_iniciais', 'feito');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fin_categorias_iniciais: %', SQLERRM;
END $$;
