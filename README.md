# Farol

Painel de gestão pessoal e familiar: Hoje, Agenda, Tarefas, Caixa de entrada, Família,
Casa, Projetos, Finanças, Saúde e Documentos.

Isto é a aplicação a sério. Os dados na base de dados são reais e são de quem a usa —
**nada de real entra neste repositório**: aqui vive a estrutura (`db/schema.sql`), e os
nomes, as moradas, os valores e os ficheiros entram pela aplicação.

## Como está feito

- **Node 20 + Express** a servir a API e os ficheiros estáticos.
- **PostgreSQL** — toda a informação da aplicação vive na base de dados (`db/schema.sql`).
  O frontend não tem dados embebidos: arranca vazio e preenche-se a partir de `/api/bootstrap`.
- **Frontend** em HTML/CSS/JS simples, sem framework nem passo de build.

## Arranque

Em cada arranque a aplicação corre o `db/schema.sql` inteiro: é aí que entram as tabelas,
as colunas novas e as migrações. Nada é semeado — a base começa vazia e enche-se com o que
alguém lá puser.

```bash
npm install
DATABASE_URL=postgres://... npm start       # http://localhost:3000
```

## Variáveis de ambiente

| Variável | Para que serve |
| --- | --- |
| `DATABASE_URL` | ligação ao PostgreSQL (no Railway: `${{Postgres.DATABASE_URL}}`) |
| `PORT` | porta HTTP (o Railway define-a automaticamente) |
| `GOOGLE_CLIENT_ID` | ID do cliente OAuth (Web) do Google — público, não é segredo |
| `SESSION_SECRET` | chave para assinar o cookie de sessão (valor aleatório longo) |
| `ALLOWED_EMAILS` | emails que podem entrar, separados por vírgula |
| `GEMINI_API_KEY` | chave do Gemini, para a leitura automática dos ficheiros da caixa de entrada |
| `INBOX_BUCKET_*`, `ARQUIVO_BUCKET_*` | onde ficam os ficheiros: um bucket para a caixa, outro para o arquivo |

## API

| Método | Rota | O que faz |
| --- | --- | --- |
| `GET` | `/api/health` | estado da app e da base de dados |
| `GET` | `/api/bootstrap` | o conteúdo do painel, numa chamada |
| `GET` | `/api/gestao` | pessoas, projetos, tarefas e áreas |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/tarefas`, `/api/pessoas`, `/api/documentos`, `/api/despesas`, `/api/inbox`, `/api/contextos`, `/api/acessos` | os módulos, cada um no seu ficheiro em `src/` |

## Estrutura

```
db/schema.sql      esquema e migrações — corre a cada arranque
src/server.js      arranque, bootstrap e servidor estático
src/auth.js        entrada com conta Google e barreira /api
src/db.js          ligação à base de dados
src/inbox.js       caixa de entrada, buckets e triagem
src/ia.js          leitura automática dos ficheiros (Gemini)
src/tarefas.js     tarefas, projetos e importação
src/pessoas.js     pessoas e ficha de cada uma
src/catalogo.js    corrigir e apagar documentos e despesas
src/contextos.js   áreas e sub-áreas
src/pdf.js         PDF de uma nota, sem dependências
public/            index.html, styles.css e um ficheiro por ecrã
```

## Entrada com conta Google

Enquanto `GOOGLE_CLIENT_ID` e `SESSION_SECRET` estiverem definidos, o painel só abre
depois de entrar com uma conta Google que esteja em `ALLOWED_EMAILS`. Sem essas
variáveis a app arranca aberta e diz isso no arranque (`SEM autenticação`).

Como funciona, sem segredos guardados na app:

1. O browser faz o login com o Google e recebe um `id_token` assinado.
2. O servidor verifica a assinatura contra as chaves públicas do Google
   (`https://www.googleapis.com/oauth2/v3/certs`), confirma `aud`, `iss` e validade,
   e vê se o email está na lista.
3. Emite um cookie `HttpOnly` assinado (HMAC-SHA256) válido 30 dias.

Não há `client_secret`: o cliente OAuth é público e o que vale é a assinatura do Google.
Todas as rotas `/api/*` ficam fechadas, excepto `/api/health` (para o Railway verificar
o serviço) e `/api/config` (para o ecrã de entrada saber qual é o client id).

Para criar o cliente OAuth: Google Cloud → APIs e Serviços → Credenciais →
*Criar credenciais* → *ID de cliente OAuth* → *Aplicação Web*, com o endereço público da
aplicação nas **origens JavaScript autorizadas**. Se o endereço mudar, o novo tem de ser
acrescentado aí **antes** da mudança — senão o login deixa de funcionar.
