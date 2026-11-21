'use strict';
/**
 * Farol - a Entrada do OneDrive (21 nov 2026).
 *
 * O Marco larga papeis na pasta OneDrive-Pessoal/00_Entrada. Uma rotina do
 * Claude, a correr no Mac dele duas vezes por dia (e quando ele carrega em
 * «Correr agora»), pega em cada ficheiro da raiz, manda-o para a Caixa de
 * entrada (POST /api/inbox, a mesma porta de sempre - a catalogacao e a
 * aprovacao continuam as da caixa), regista-o aqui, move o original para
 * 00_Entrada/OK e deixa uma copia na pasta do OneDrive que corresponde a area
 * onde o papel ficou arrumado.
 *
 * Este modulo guarda o rasto disso tudo e nao toca em ficheiros: quem mexe no
 * disco e a rotina. O Farol e o sitio onde se ve o que entrou, o que gerou,
 * para onde foi a copia, e onde se cria o follow-up de cada papel.
 *
 *   GET    /api/onedrive                    ficheiros, execucoes, agendamento, pastas
 *   POST   /api/onedrive/execucoes          { origem } - comeca uma execucao
 *   PATCH  /api/onedrive/execucoes/:id      { estado, resumo, n_* } - fecha-a
 *   POST   /api/onedrive/ficheiros          regista um ficheiro enviado
 *   PATCH  /api/onedrive/ficheiros/:id      { movido_para, copiado_para, erro }
 *   POST   /api/onedrive/ficheiros/:id/follow-up   cria a tarefa de seguimento
 *   PATCH  /api/onedrive/ficheiros/:id/nota { nota }
 *   PUT    /api/onedrive/agendamento        { horas: ['11:00','16:00'], ativo }
 *   PUT    /api/onedrive/pastas             { context_id, caminho }
 *   POST   /api/onedrive/correr             pede uma execucao ja
 *   POST   /api/onedrive/execucoes/:id/passos  { texto, tipo, ficheiro, atual, total }
 *   GET    /api/onedrive/agora?depois=N     a execucao em curso e os passos novos
 *
 * Os passos sao o que a janela de progresso mostra enquanto a rotina corre:
 * cada ficheiro enviado, movido e copiado, e os erros, a medida que acontecem.
 *
 * «Correr agora» dispara a rotina pela API das rotinas do Claude quando o
 * Marco tiver posto ROTINA_ENTRADA_URL e ROTINA_ENTRADA_TOKEN no Railway.
 * Sem isso, fica um pedido registado e a pagina diz como correr a rotina.
 * O token e dele e vive so nas Variables do Railway.
 */
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;

const AGENDA_CHAVE = 'onedrive_agendamento';
const AGENDA_OMISSAO = { horas: ['11:00', '16:00'], ativo: true, fuso: 'Europe/Lisbon' };

let pronto = null;
function preparar() {
  if (!pronto) {
    pronto = query(`
      CREATE TABLE IF NOT EXISTS onedrive_execucoes (
        id           SERIAL PRIMARY KEY,
        origem       TEXT NOT NULL DEFAULT 'agendada',
        estado       TEXT NOT NULL DEFAULT 'a_correr',
        pedida_em    TIMESTAMPTZ NOT NULL DEFAULT now(),
        iniciada_em  TIMESTAMPTZ,
        terminada_em TIMESTAMPTZ,
        n_ficheiros  INTEGER NOT NULL DEFAULT 0,
        n_erros      INTEGER NOT NULL DEFAULT 0,
        n_copias     INTEGER NOT NULL DEFAULT 0,
        resumo       TEXT
      );
      CREATE TABLE IF NOT EXISTS onedrive_ficheiros (
        id            SERIAL PRIMARY KEY,
        execucao_id   INTEGER REFERENCES onedrive_execucoes(id) ON DELETE SET NULL,
        nome          TEXT NOT NULL,
        tamanho       BIGINT,
        modificado_em TIMESTAMPTZ,
        inbox_id      INTEGER REFERENCES inbox_items(id) ON DELETE SET NULL,
        estado        TEXT NOT NULL DEFAULT 'enviado',
        erro          TEXT,
        movido_para   TEXT,
        copiado_para  TEXT,
        copiado_em    TIMESTAMPTZ,
        nota          TEXT,
        criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS onedrive_ficheiros_inbox_idx ON onedrive_ficheiros (inbox_id);
      CREATE TABLE IF NOT EXISTS onedrive_follow_ups (
        ficheiro_id INTEGER NOT NULL REFERENCES onedrive_ficheiros(id) ON DELETE CASCADE,
        task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (ficheiro_id, task_id)
      );
      ALTER TABLE onedrive_execucoes ADD COLUMN IF NOT EXISTS total INTEGER;
      ALTER TABLE onedrive_execucoes ADD COLUMN IF NOT EXISTS feitos INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE onedrive_execucoes ADD COLUMN IF NOT EXISTS passo TEXT;
      ALTER TABLE onedrive_execucoes ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ;
      CREATE TABLE IF NOT EXISTS onedrive_passos (
        id          SERIAL PRIMARY KEY,
        execucao_id INTEGER NOT NULL REFERENCES onedrive_execucoes(id) ON DELETE CASCADE,
        em          TIMESTAMPTZ NOT NULL DEFAULT now(),
        tipo        TEXT NOT NULL DEFAULT 'info',
        texto       TEXT NOT NULL,
        ficheiro    TEXT
      );
      CREATE INDEX IF NOT EXISTS onedrive_passos_exec_idx ON onedrive_passos (execucao_id, id);
      CREATE TABLE IF NOT EXISTS onedrive_pastas (
        context_id INTEGER PRIMARY KEY REFERENCES contexts(id) ON DELETE CASCADE,
        caminho    TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `).catch((err) => { pronto = null; throw err; });
  }
  return pronto;
}

function erro(status, msg) { const e = new Error(msg); e.status = status; return e; }
function texto(v, max) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max || 2000) : null;
}
function semAcentos(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/* Um caminho de pasta tem de ficar dentro do OneDrive e nao pode subir. */
function caminhoLimpo(v) {
  const s = texto(v, 400);
  if (!s) return null;
  const c = s.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
  if (c.split('/').some((p) => p === '..' || p === '.')) throw erro(400, 'O caminho não pode ter «..».');
  if (/^00_Entrada(\/|$)/i.test(c)) throw erro(400, 'A pasta de destino não pode ser a própria 00_Entrada.');
  return c;
}

async function agendamento() {
  const r = await all('SELECT value FROM settings WHERE key = $1', [AGENDA_CHAVE]);
  if (!r.length) return Object.assign({}, AGENDA_OMISSAO);
  try { return Object.assign({}, AGENDA_OMISSAO, JSON.parse(r[0].value)); }
  catch (e) { return Object.assign({}, AGENDA_OMISSAO); }
}

function horasValidas(lista) {
  const out = [];
  for (const h of Array.isArray(lista) ? lista : []) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(h).trim());
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) throw erro(400, 'Hora inválida: ' + h);
    const hh = String(Number(m[1])).padStart(2, '0') + ':' + m[2];
    if (!out.includes(hh)) out.push(hh);
  }
  if (!out.length) throw erro(400, 'Indica pelo menos uma hora.');
  if (out.length > 6) throw erro(400, 'No máximo seis horas por dia.');
  return out.sort();
}

/* As areas com a pasta de cada uma. Uma sub-area sem pasta usa a da area. */
async function pastas() {
  const linhas = await all(
    `SELECT c.id, c.name, c.parent_id, p.name AS pai, op.caminho
       FROM contexts c
       LEFT JOIN contexts p ON p.id = c.parent_id
       LEFT JOIN onedrive_pastas op ON op.context_id = c.id
      WHERE c.active
      ORDER BY COALESCE(p.sort, c.sort), COALESCE(p.id, c.id), c.parent_id NULLS FIRST, c.sort`);
  const porId = new Map(linhas.map((l) => [l.id, l]));
  return linhas.map((l) => {
    const pai = l.parent_id ? porId.get(l.parent_id) : null;
    return {
      context_id: l.id,
      nome: l.pai ? l.pai + ' › ' + l.name : l.name,
      sub: Boolean(l.parent_id),
      caminho: l.caminho || null,
      efetivo: l.caminho || (pai && pai.caminho) || null,
      herdado: !l.caminho && Boolean(pai && pai.caminho)
    };
  });
}

/* Onde o papel ficou: primeiro o que a triagem criou (documento, tarefa,
   pagamento, evento, despesa); se ainda esta por triar, a area que a leitura
   propos. Devolve o context_id e de onde veio. */
const SQL_FICHEIROS = `
  SELECT f.id, f.execucao_id, f.nome, f.tamanho, f.modificado_em, f.inbox_id, f.estado, f.erro,
         f.movido_para, f.copiado_para, f.copiado_em, f.nota, f.criado_em,
         i.status AS caixa_estado, i.ai_status, i.title AS caixa_titulo, i.file_name,
         i.ai_json->'destinos'->0->>'tipo' AS proposta_tipo,
         i.ai_json->'destinos'->0->'dados'->>'area' AS proposta_area,
         i.ai_json->>'resumo' AS proposta_resumo,
         COALESCE((
           SELECT json_agg(x ORDER BY x.tipo, x.id) FROM (
             SELECT l.target_type AS tipo, l.target_id AS id,
                    COALESCE(d.name, t.title, e.title, ex.description) AS nome,
                    COALESCE(d.context_id, t.context_id, e.context_id, ex.context_id) AS context_id,
                    COALESCE(d.aprovado, t.aprovado, e.aprovado, TRUE) AS aprovado
               FROM inbox_links l
               LEFT JOIN documents d ON l.target_type = 'documento' AND d.id = l.target_id
               LEFT JOIN tasks     t ON l.target_type IN ('tarefa','pagamento') AND t.id = l.target_id
               LEFT JOIN events    e ON l.target_type = 'evento' AND e.id = l.target_id
               LEFT JOIN expenses ex ON l.target_type = 'despesa' AND ex.id = l.target_id
              WHERE l.inbox_id = f.inbox_id) x), '[]'::json) AS criados,
         COALESCE((
           SELECT json_agg(json_build_object('id', t.id, 'titulo', t.title, 'prazo', to_char(t.due_on, 'YYYY-MM-DD'),
                                             'feito', t.done, 'estado', t.status) ORDER BY t.id)
             FROM onedrive_follow_ups fu JOIN tasks t ON t.id = fu.task_id
            WHERE fu.ficheiro_id = f.id), '[]'::json) AS follow_ups
    FROM onedrive_ficheiros f
    LEFT JOIN inbox_items i ON i.id = f.inbox_id`;

async function colunasOpcionais() {
  /* events.aprovado e expenses.description podem nao existir numa base antiga;
     a consulta acima assume que existem. Confirma-se uma vez. */
  const r = await all(
    `SELECT table_name, column_name FROM information_schema.columns
      WHERE (table_name = 'events' AND column_name = 'aprovado')
         OR (table_name = 'expenses' AND column_name = 'description')
         OR (table_name = 'documents' AND column_name = 'aprovado')
         OR (table_name = 'events' AND column_name = 'title')`);
  return new Set(r.map((x) => x.table_name + '.' + x.column_name));
}

let sqlFicheiros = null;
async function consultaFicheiros() {
  if (sqlFicheiros) return sqlFicheiros;
  const tem = await colunasOpcionais();
  let s = SQL_FICHEIROS;
  if (!tem.has('events.aprovado')) s = s.replace('e.aprovado,', '');
  if (!tem.has('documents.aprovado')) s = s.replace('d.aprovado,', '');
  if (!tem.has('expenses.description')) s = s.replace(', ex.description)', ')');
  if (!tem.has('events.title')) s = s.replace(' e.title,', '');
  sqlFicheiros = s;
  return s;
}

function resolverArea(f, contextos) {
  const criados = Array.isArray(f.criados) ? f.criados : [];
  const comArea = criados.find((c) => c.tipo === 'documento' && c.context_id) || criados.find((c) => c.context_id);
  if (comArea) return { context_id: comArea.context_id, de: 'arrumado' };
  if (f.proposta_area) {
    const alvo = semAcentos(f.proposta_area).replace(/\s*[>›]\s*/g, ' > ');
    const c = contextos.find((x) => semAcentos(x.nome).replace(/\s*[>›]\s*/g, ' > ') === alvo);
    if (c) return { context_id: c.context_id, de: 'proposta' };
  }
  return { context_id: null, de: null };
}

async function estado() {
  await preparar();
  const [ag, execs, pastasLista] = await Promise.all([
    agendamento(),
    all(`SELECT id, origem, estado, pedida_em, iniciada_em, terminada_em, n_ficheiros, n_erros, n_copias, resumo
           FROM onedrive_execucoes ORDER BY id DESC LIMIT 30`),
    pastas()
  ]);
  const fich = await all((await consultaFicheiros()) + ' ORDER BY f.id DESC LIMIT 1000');
  const porCtx = new Map(pastasLista.map((p) => [p.context_id, p]));
  const ficheiros = fich.map((f) => {
    const a = resolverArea(f, pastasLista);
    const p = a.context_id ? porCtx.get(a.context_id) : null;
    return Object.assign(f, {
      area_id: a.context_id,
      area: p ? p.nome : (f.proposta_area || null),
      area_de: a.de,
      pasta_destino: p ? p.efetivo : null
    });
  });
  return {
    agendamento: ag,
    disparo_direto: Boolean(process.env.ROTINA_ENTRADA_URL && process.env.ROTINA_ENTRADA_TOKEN),
    execucoes: execs,
    pedido_pendente: execs.find((e) => e.estado === 'pedida') || null,
    pastas: pastasLista,
    ficheiros
  };
}

/* O que falta copiar: ficheiros ja movidos para OK, com area conhecida e
   pasta definida, e ainda sem copia. A rotina pede isto a cada passagem. */
async function porCopiar() {
  const e = await estado();
  return e.ficheiros.filter((f) => f.movido_para && !f.copiado_para && f.pasta_destino && f.estado !== 'erro')
    .map((f) => ({ id: f.id, nome: f.nome, movido_para: f.movido_para, area: f.area, pasta_destino: f.pasta_destino }));
}

async function dispararRotina(execId) {
  const url = process.env.ROTINA_ENTRADA_URL, token = process.env.ROTINA_ENTRADA_TOKEN;
  if (!url || !token) return { disparada: false, motivo: 'sem_token' };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'experimental-cc-routine-2026-04-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: 'Execução pedida no Farol («Correr agora»), pedido n.º ' + execId + '. Usa este número como execucao_id.' })
    });
    if (!r.ok) {
      const corpo = await r.text().catch(() => '');
      console.warn('[farol] onedrive: a rotina respondeu', r.status, corpo.slice(0, 200));
      return { disparada: false, motivo: 'http_' + r.status };
    }
    return { disparada: true };
  } catch (err) {
    console.warn('[farol] onedrive: não deu para disparar a rotina:', err.message);
    return { disparada: false, motivo: 'rede' };
  }
}

const TIPOS_PASSO = ['info', 'ok', 'erro', 'aviso', 'fase'];

/* Um passo da execucao: fica na lista e passa a ser o «a fazer agora». */
async function registarPasso(execId, b) {
  const texto = texto_(b.texto, 500);
  if (!texto) throw erro(400, 'Falta o texto do passo.');
  const tipo = TIPOS_PASSO.includes(b.tipo) ? b.tipo : 'info';
  const n = (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 && v !== null && v !== '' ? Number(v) : null);
  const r = await all(
    `UPDATE onedrive_execucoes SET passo = $2, atualizado_em = now(),
            feitos = COALESCE($3, feitos), total = COALESCE($4, total),
            estado = CASE WHEN estado = 'pedida' THEN 'a_correr' ELSE estado END,
            iniciada_em = COALESCE(iniciada_em, now())
      WHERE id = $1 RETURNING id`, [execId, texto, n(b.atual), n(b.total)]);
  if (!r.length) throw erro(404, 'Execução não encontrada.');
  const p = await all(
    `INSERT INTO onedrive_passos (execucao_id, tipo, texto, ficheiro) VALUES ($1,$2,$3,$4) RETURNING id`,
    [execId, tipo, texto, texto_(b.ficheiro, 400)]);
  return p[0].id;
}
const texto_ = (v, m) => texto(v, m);

/* O que esta a correr agora (ou acabou ha pouco), com os passos depois de N. */
async function agora(depois, execPedida) {
  await preparar();
  let ex = null;
  if (execPedida) {
    ex = (await all(`SELECT * FROM onedrive_execucoes WHERE id = $1`, [execPedida]))[0] || null;
  }
  if (!ex) {
    ex = (await all(
      `SELECT * FROM onedrive_execucoes
        WHERE (estado IN ('pedida','a_correr')
               AND COALESCE(atualizado_em, iniciada_em, pedida_em) > now() - interval '45 minutes')
           OR (estado NOT IN ('pedida','a_correr') AND terminada_em > now() - interval '10 minutes')
        ORDER BY (estado IN ('pedida','a_correr')) DESC, id DESC LIMIT 1`))[0] || null;
  }
  if (!ex) return { execucao: null, passos: [] };
  /* Uma execucao que deixou de dar sinal ha mais de 45 minutos morreu pelo
     caminho (Mac a dormir, Chrome fechado): deixa de se mostrar a correr. */
  const sinal = ex.atualizado_em || ex.iniciada_em || ex.pedida_em;
  if ((ex.estado === 'a_correr' || ex.estado === 'pedida') && sinal &&
      Date.now() - new Date(sinal).getTime() > 45 * 60000) ex.parada = true;
  const passos = await all(
    `SELECT id, em, tipo, texto, ficheiro FROM onedrive_passos
      WHERE execucao_id = $1 AND id > $2 ORDER BY id LIMIT 300`, [ex.id, Number(depois) || 0]);
  return { execucao: ex, passos };
}

function falha(res, err, onde) {
  if (!err.status) console.error('[farol] onedrive ' + onde + ':', err.message);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Não foi possível tratar da Entrada do OneDrive.' });
}

function instalar(app, opcoes) {
  const tarefas = opcoes && opcoes.tarefas;
  preparar().catch((err) => console.warn('[farol] onedrive: tabelas por criar:', err.message));

  app.get('/api/onedrive', async (_req, res) => {
    try { res.json(await estado()); } catch (err) { falha(res, err, 'GET'); }
  });

  app.get('/api/onedrive/agora', async (req, res) => {
    try { res.json(await agora(req.query.depois, Number(req.query.execucao) || null)); }
    catch (err) { falha(res, err, 'agora'); }
  });

  app.post('/api/onedrive/execucoes/:id/passos', async (req, res) => {
    try {
      await preparar();
      res.status(201).json({ id: await registarPasso(Number(req.params.id), req.body || {}) });
    } catch (err) { falha(res, err, 'passos'); }
  });

  app.get('/api/onedrive/por-copiar', async (_req, res) => {
    try { res.json(await porCopiar()); } catch (err) { falha(res, err, 'por-copiar'); }
  });

  /* Comeca uma execucao. Se houver um pedido manual por servir, e ele que
     arranca (assim o «Correr agora» fica ligado ao que de facto correu). */
  app.post('/api/onedrive/execucoes', async (req, res) => {
    try {
      await preparar();
      const b = req.body || {};
      const pedido = Number(b.execucao_id);
      let row = null;
      if (Number.isInteger(pedido) && pedido > 0) {
        row = (await all(
          `UPDATE onedrive_execucoes SET estado = 'a_correr', iniciada_em = now()
            WHERE id = $1 AND estado = 'pedida' RETURNING *`, [pedido]))[0] || null;
      }
      if (!row) {
        row = (await all(
          `UPDATE onedrive_execucoes SET estado = 'a_correr', iniciada_em = now()
            WHERE id = (SELECT id FROM onedrive_execucoes WHERE estado = 'pedida' ORDER BY id LIMIT 1)
            RETURNING *`))[0] || null;
      }
      if (!row) {
        row = (await all(
          `INSERT INTO onedrive_execucoes (origem, estado, iniciada_em) VALUES ($1, 'a_correr', now()) RETURNING *`,
          [b.origem === 'manual' ? 'manual' : 'agendada']))[0];
      }
      await registarPasso(row.id, { tipo: 'fase', texto: 'Execução iniciada no Mac' });
      res.status(201).json(Object.assign({}, row, { agendamento: await agendamento(), pastas: await pastas() }));
    } catch (err) { falha(res, err, 'POST execucoes'); }
  });

  app.patch('/api/onedrive/execucoes/:id', async (req, res) => {
    try {
      await preparar();
      const b = req.body || {};
      const est = ['concluida', 'com_erros', 'falhou', 'a_correr'].includes(b.estado) ? b.estado : 'concluida';
      const n = (v) => (Number.isInteger(Number(v)) && Number(v) >= 0 ? Number(v) : null);
      const r = await all(
        `UPDATE onedrive_execucoes SET estado = $2,
                terminada_em = CASE WHEN $2 = 'a_correr' THEN NULL ELSE now() END,
                n_ficheiros = COALESCE($3, n_ficheiros), n_erros = COALESCE($4, n_erros),
                n_copias = COALESCE($5, n_copias), resumo = COALESCE($6, resumo)
          WHERE id = $1 RETURNING *`,
        [Number(req.params.id), est, n(b.n_ficheiros), n(b.n_erros), n(b.n_copias), texto(b.resumo, 4000)]);
      if (!r.length) throw erro(404, 'Execução não encontrada.');
      if (est !== 'a_correr') {
        const fim = { concluida: 'Concluída', com_erros: 'Concluída com erros', falhou: 'Falhou' }[est];
        await query(`INSERT INTO onedrive_passos (execucao_id, tipo, texto) VALUES ($1,$2,$3)`,
          [r[0].id, est === 'concluida' ? 'fase' : 'erro', fim + (r[0].resumo ? ': ' + r[0].resumo : '')]);
        await query(`UPDATE onedrive_execucoes SET passo = $2, atualizado_em = now() WHERE id = $1`, [r[0].id, fim]);
      }
      res.json(r[0]);
    } catch (err) { falha(res, err, 'PATCH execucoes'); }
  });

  app.post('/api/onedrive/ficheiros', async (req, res) => {
    try {
      await preparar();
      const b = req.body || {};
      const nome = texto(b.nome, 400);
      if (!nome) throw erro(400, 'Falta o nome do ficheiro.');
      const est = ['enviado', 'repetido', 'erro'].includes(b.estado) ? b.estado : 'enviado';
      const inbox = Number.isInteger(Number(b.inbox_id)) && Number(b.inbox_id) > 0 ? Number(b.inbox_id) : null;
      if (inbox && !(await all('SELECT 1 FROM inbox_items WHERE id = $1', [inbox])).length) {
        throw erro(400, 'Esse item da caixa não existe.');
      }
      const r = await all(
        `INSERT INTO onedrive_ficheiros (execucao_id, nome, tamanho, modificado_em, inbox_id, estado, erro)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [Number(b.execucao_id) || null, nome, Number(b.tamanho) || null, texto(b.modificado_em, 40),
         inbox, est, texto(b.erro, 1000)]);
      res.status(201).json({ id: r[0].id });
    } catch (err) { falha(res, err, 'POST ficheiros'); }
  });

  app.patch('/api/onedrive/ficheiros/:id', async (req, res) => {
    try {
      await preparar();
      const b = req.body || {};
      const campos = [], valores = [Number(req.params.id)];
      const por = (c, v) => { valores.push(v); campos.push(c + ' = $' + valores.length); };
      if (b.movido_para !== undefined) por('movido_para', texto(b.movido_para, 600));
      if (b.copiado_para !== undefined) { por('copiado_para', texto(b.copiado_para, 600)); campos.push('copiado_em = now()'); }
      if (b.erro !== undefined) por('erro', texto(b.erro, 1000));
      if (b.estado !== undefined && ['enviado', 'repetido', 'erro'].includes(b.estado)) por('estado', b.estado);
      if (!campos.length) throw erro(400, 'Nada para mudar.');
      const r = await all(`UPDATE onedrive_ficheiros SET ${campos.join(', ')} WHERE id = $1 RETURNING id`, valores);
      if (!r.length) throw erro(404, 'Ficheiro não encontrado.');
      res.json({ ok: true });
    } catch (err) { falha(res, err, 'PATCH ficheiros'); }
  });

  app.patch('/api/onedrive/ficheiros/:id/nota', async (req, res) => {
    try {
      await preparar();
      const r = await all('UPDATE onedrive_ficheiros SET nota = $2 WHERE id = $1 RETURNING id',
        [Number(req.params.id), texto((req.body || {}).nota, 4000)]);
      if (!r.length) throw erro(404, 'Ficheiro não encontrado.');
      res.json({ ok: true });
    } catch (err) { falha(res, err, 'nota'); }
  });

  /* O follow-up e uma tarefa a serio (aparece nas Tarefas e no Hoje), na area
     onde o papel ficou e com o documento agarrado. Criada por uma pessoa, por
     isso nasce aprovada. */
  app.post('/api/onedrive/ficheiros/:id/follow-up', async (req, res) => {
    try {
      await preparar();
      if (!tarefas) throw erro(500, 'Tarefas indisponíveis.');
      const b = req.body || {};
      const titulo = texto(b.titulo, 300);
      if (!titulo) throw erro(400, 'Escreve o que é preciso fazer.');
      const e = await estado();
      const f = e.ficheiros.find((x) => x.id === Number(req.params.id));
      if (!f) throw erro(404, 'Ficheiro não encontrado.');
      const doc = (f.criados || []).find((c) => c.tipo === 'documento');
      const ctx = Number(b.context_id) || f.area_id || null;
      const notas = [texto(b.notas, 4000), 'Follow-up do ficheiro «' + f.nome + '» (Entrada do OneDrive).']
        .filter(Boolean).join('\n\n');
      const id = await tarefas.criar({
        title: titulo,
        notes: notas,
        context_id: ctx,
        owner_id: Number(b.owner_id) || null,
        due_on: texto(b.due_on, 10),
        priority: b.priority,
        documents: doc ? [{ id: doc.id, papel: 'anexo' }] : []
      });
      await query('INSERT INTO onedrive_follow_ups (ficheiro_id, task_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [f.id, id]);
      res.status(201).json({ task_id: id });
    } catch (err) { falha(res, err, 'follow-up'); }
  });

  app.put('/api/onedrive/agendamento', async (req, res) => {
    try {
      await preparar();
      const b = req.body || {};
      const atual = await agendamento();
      const novo = {
        horas: b.horas !== undefined ? horasValidas(b.horas) : atual.horas,
        ativo: b.ativo !== undefined ? Boolean(b.ativo) : atual.ativo,
        fuso: 'Europe/Lisbon',
        alterado_em: new Date().toISOString()
      };
      await query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [AGENDA_CHAVE, JSON.stringify(novo)]);
      res.json(novo);
    } catch (err) { falha(res, err, 'agendamento'); }
  });

  app.put('/api/onedrive/pastas', async (req, res) => {
    try {
      await preparar();
      const b = req.body || {};
      const ctx = Number(b.context_id);
      if (!Number.isInteger(ctx) || !(await all('SELECT 1 FROM contexts WHERE id = $1', [ctx])).length) {
        throw erro(400, 'Área desconhecida.');
      }
      const c = caminhoLimpo(b.caminho);
      if (!c) await query('DELETE FROM onedrive_pastas WHERE context_id = $1', [ctx]);
      else await query(
        `INSERT INTO onedrive_pastas (context_id, caminho) VALUES ($1,$2)
         ON CONFLICT (context_id) DO UPDATE SET caminho = EXCLUDED.caminho, updated_at = now()`, [ctx, c]);
      res.json(await pastas());
    } catch (err) { falha(res, err, 'pastas'); }
  });

  app.post('/api/onedrive/correr', async (_req, res) => {
    try {
      await preparar();
      const aberto = (await all(
        `SELECT id FROM onedrive_execucoes WHERE estado IN ('pedida','a_correr')
            AND COALESCE(atualizado_em, iniciada_em, pedida_em) > now() - interval '30 minutes' ORDER BY id DESC LIMIT 1`))[0];
      if (aberto) return res.status(409).json({ error: 'Já há uma execução pedida ou a correr.', id: aberto.id });
      const row = (await all(
        `INSERT INTO onedrive_execucoes (origem, estado, passo, atualizado_em)
         VALUES ('manual', 'pedida', 'À espera que a rotina arranque no Mac', now()) RETURNING *`))[0];
      await query(`INSERT INTO onedrive_passos (execucao_id, tipo, texto) VALUES ($1,'fase','Pedido «Correr agora» registado')`, [row.id]);
      const d = await dispararRotina(row.id);
      if (!d.disparada) {
        await query(`UPDATE onedrive_execucoes SET resumo = $2 WHERE id = $1`,
          [row.id, d.motivo === 'sem_token'
            ? 'Pedido registado. Falta o disparo direto (ROTINA_ENTRADA_URL e ROTINA_ENTRADA_TOKEN no Railway): a próxima passagem apanha-o.'
            : 'A rotina não respondeu (' + d.motivo + '). A próxima passagem apanha o pedido.']);
      }
      res.status(201).json(Object.assign({ id: row.id }, d));
    } catch (err) { falha(res, err, 'correr'); }
  });
}

module.exports = { instalar, estado, porCopiar, agora, horasValidas, caminhoLimpo };
