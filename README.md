# Farol — ambiente de QUALIDADE

Painel de gestão pessoal e familiar: Hoje, Agenda, Família, Casa, Projetos, Finanças, Saúde e Documentos.

Este repositório é o **ambiente de qualidade**: os dados são fictícios e servem para testar o
comportamento da aplicação. Nada aqui é real. O ambiente com dados reais será outro, à parte —
outro projeto, outra base de dados, outro endereço.

## Como está feito

- **Node 20 + Express** a servir a API e os ficheiros estáticos.
- **PostgreSQL** — toda a informação da aplicação vive na base de dados (`db/schema.sql`).
  O frontend não tem dados embebidos: arranca vazio e preenche-se a partir de `/api/bootstrap`.
- **Frontend** em HTML/CSS/JS simples, sem framework nem build.

## Arranque

Na primeira ligação a aplicação cria o esquema e, se a base de dados estiver vazia,
carrega os dados de qualidade (`db/seed.sql`).

```bash
npm install
DATABASE_URL=postgres://... npm start       # http://localhost:3000
DATABASE_URL=postgres://... npm run seed    # repõe os dados (apaga o que lá estiver)
```

## Variáveis de ambiente

| Variável | Para que serve |
| --- | --- |
| `DATABASE_URL` | ligação ao PostgreSQL (no Railway: `${{Postgres.DATABASE_URL}}`) |
| `APP_ENV` | nome do ambiente, mostrado na barra do topo e no menu (aqui: `qualidade`) |
| `PORT` | porta HTTP (o Railway define-a automaticamente) |

## API

| Método | Rota | O que faz |
| --- | --- | --- |
| `GET` | `/api/health` | estado da app e da base de dados |
| `GET` | `/api/bootstrap` | todo o conteúdo do painel, numa chamada |
| `PATCH` | `/api/tasks/:id` | marca/desmarca uma tarefa (`{"done": true}`) — grava mesmo |

As tarefas são o exemplo de escrita: marcar uma no ecrã grava na base de dados e sobrevive ao *refresh*.

## Estrutura

```
db/schema.sql      esquema (25 tabelas)
db/seed.sql        dados fictícios do ambiente de qualidade
src/server.js      API + servidor estático
src/db.js          ligação e arranque da base de dados
src/seed.js        `npm run seed`
public/            index.html, app.js, styles.css
```

## Barra de ambiente

Enquanto `APP_ENV` estiver definido, a app mostra uma barra fixa no topo com o nome do ambiente e
o aviso de que os dados não são reais, mais uma etiqueta no menu lateral. O texto do aviso está na
tabela `settings` (`env_nota`). Num ambiente com dados reais, basta `APP_ENV=real` para a barra
desaparecer.
