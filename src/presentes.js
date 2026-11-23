'use strict';
/**
 * Farol - os presentes (23 nov 2026). Substitui a app Gift List do Mac.
 *
 * Transversal > Presentes. Uma ocasiao de cada vez (o Natal de cada ano, um
 * aniversario, outra qualquer), as pessoas a quem se oferece e o caminho de
 * cada presente: ideia > comprado (ou feito por nos) > enviado > chegou >
 * embrulhado > entregue. Um presente sem ocasiao e uma ideia na lista de
 * desejos da pessoa, a espera da altura certa.
 *
 * As pessoas a quem se oferece podem ser pessoas do Farol (person_id) ou so
 * um nome - os amigos e os filhos dos amigos nao precisam de ficha.
 *
 *   GET    /api/presentes?ocasiao=ID            tudo o que o ecra precisa
 *   POST   /api/presentes                        presente novo
 *   PATCH  /api/presentes/:id                    muda campos (estado com data)
 *   DELETE /api/presentes/:id
 *   POST   /api/presentes/:id/copiar             { destinatario_id, ocasiao_id }
 *   GET    /api/presentes/:id/movimentos         compras no banco com o mesmo valor
 *   POST   /api/presentes/ocasioes               { nome, tipo, data, orcamento }
 *   PATCH  /api/presentes/ocasioes/:id
 *   DELETE /api/presentes/ocasioes/:id
 *   POST   /api/presentes/destinatarios          { nome, person_id, grupo, gostos, tamanhos }
 *   PATCH  /api/presentes/destinatarios/:id
 *   DELETE /api/presentes/destinatarios/:id
 *   PUT    /api/presentes/orcamentos             { ocasiao_id, destinatario_id, valor }
 *   POST   /api/presentes/embrulhar              { ocasiao_id } - tarefa, um passo por presente
 *   POST   /api/presentes/importar               a lista da Gift List, de uma vez
 *   GET    /api/presentes/pessoa/:id             para a ficha da pessoa
 */
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;

const ESTADOS = ['ideia', 'comprado', 'feito', 'enviado', 'chegou', 'embrulhado', 'entregue'];
const TIPOS_OC = ['natal', 'aniversario', 'outra'];

function hojeLisboa() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
}
function maisDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function numero(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/\s|€/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
function data(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null; }
function texto(v, max) { const s = String(v == null ? '' : v).trim(); return s ? s.slice(0, max || 200) : null; }
function inteiro(v) { const n = parseInt(v, 10); return n > 0 ? n : null; }
function erro(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }
function semAcentos(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/* ---------------- leitura ---------------- */
async function ocasioes() {
  return all(
    `SELECT o.id, o.nome, o.tipo, to_char(o.data, 'YYYY-MM-DD') AS data, o.orcamento::float AS orcamento, o.arquivada,
            (SELECT count(*)::int FROM presentes p WHERE p.ocasiao_id = o.id) AS n,
            (SELECT COALESCE(sum(p.preco),0)::float FROM presentes p WHERE p.ocasiao_id = o.id AND p.estado <> 'ideia') AS gasto
       FROM presentes_ocasioes o
      ORDER BY o.arquivada, o.data DESC NULLS LAST, o.id DESC`);
}
/* A ocasiao que se abre: a pedida; senao a proxima que ainda nao passou;
   senao a mais recente. */
function escolher(lista, pedida, hoje) {
  if (pedida) { const o = lista.find((x) => x.id === pedida); if (o) return o; }
  const abertas = lista.filter((o) => !o.arquivada);
  const futuras = abertas.filter((o) => o.data && o.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  return futuras[0] || abertas[0] || lista[0] || null;
}

async function estado(pedida) {
  const hoje = hojeLisboa();
  const lista = await ocasioes();
  const oc = escolher(lista, pedida, hoje);
  const destinatarios = await all(
    `SELECT d.id, d.nome, d.person_id, d.grupo, d.gostos, d.tamanhos, d.ativo, d.sort, p.name AS pessoa
       FROM presentes_destinatarios d LEFT JOIN people p ON p.id = d.person_id
      ORDER BY lower(d.nome)`);
  const presentes = await all(
    `SELECT p.id, p.ocasiao_id, p.destinatario_id, p.titulo, p.estado, p.tipo, p.preco::float AS preco, p.de_quem,
            p.loja, p.tamanho, p.transportadora, p.seguimento, to_char(p.chega_ate, 'YYYY-MM-DD') AS chega_ate,
            p.guardado, p.notas, p.movimento_id, p.task_id, p.estados, p.sort,
            m.data AS mov_data, m.descricao AS mov_descricao, m.valor::float AS mov_valor
       FROM presentes p
       LEFT JOIN fin_movimentos m ON m.id = p.movimento_id
      WHERE p.ocasiao_id = $1 OR p.ocasiao_id IS NULL
      ORDER BY p.sort, p.id`, [oc ? oc.id : 0]).catch(async () => all(
    /* Sem as Financas (base nova): o mesmo, sem o movimento. */
    `SELECT p.id, p.ocasiao_id, p.destinatario_id, p.titulo, p.estado, p.tipo, p.preco::float AS preco, p.de_quem,
            p.loja, p.tamanho, p.transportadora, p.seguimento, to_char(p.chega_ate, 'YYYY-MM-DD') AS chega_ate,
            p.guardado, p.notas, p.movimento_id, p.task_id, p.estados, p.sort
       FROM presentes p WHERE p.ocasiao_id = $1 OR p.ocasiao_id IS NULL ORDER BY p.sort, p.id`, [oc ? oc.id : 0]));
  presentes.forEach((p) => { if (p.mov_data instanceof Date) p.mov_data = p.mov_data.toISOString().slice(0, 10); });
  const orc = {};
  if (oc) (await all('SELECT destinatario_id, valor::float AS valor FROM presentes_orcamentos WHERE ocasiao_id = $1', [oc.id]))
    .forEach((r) => { orc[r.destinatario_id] = r.valor; });

  const daOc = presentes.filter((p) => oc && p.ocasiao_id === oc.id);
  const porEstado = {};
  ESTADOS.forEach((e) => { porEstado[e] = 0; });
  daOc.forEach((p) => { porEstado[p.estado] = (porEstado[p.estado] || 0) + 1; });
  const gasto = daOc.filter((p) => p.estado !== 'ideia').reduce((s, p) => s + (p.preco || 0), 0);
  const ideias = daOc.filter((p) => p.estado === 'ideia').reduce((s, p) => s + (p.preco || 0), 0);
  const comPresente = new Set(daOc.map((p) => p.destinatario_id));
  const ativos = destinatarios.filter((d) => d.ativo);
  const resumo = {
    total: daOc.length,
    gasto: Math.round(gasto * 100) / 100,
    ideias_valor: Math.round(ideias * 100) / 100,
    por_estado: porEstado,
    sem_preco: daOc.filter((p) => p.estado !== 'ideia' && !p.preco).length,
    sem_presente: ativos.filter((d) => !comPresente.has(d.id)).map((d) => d.nome),
    atrasados: daOc.filter((p) => p.estado === 'enviado' && p.chega_ate && p.chega_ate < hoje).length,
    por_ligar: daOc.filter((p) => p.estado !== 'ideia' && p.preco && !p.movimento_id).length,
    dias: oc && oc.data ? Math.round((Date.parse(oc.data) - Date.parse(hoje)) / 86400000) : null
  };

  /* Aniversarios das pessoas do Farol nos proximos 60 dias sem ocasiao. */
  const pessoas = await all(
    `SELECT id, name, to_char(birth_on, 'MM-DD') AS md FROM people
      WHERE active AND origin = 'real' AND kind <> 'animal' ORDER BY sort, id`);
  const ano = Number(hoje.slice(0, 4));
  const aniversarios = [];
  pessoas.forEach((p) => {
    if (!p.md) return;
    let d = ano + '-' + p.md;
    if (d < hoje) d = (ano + 1) + '-' + p.md;
    if (d > maisDias(hoje, 60)) return;
    const ja = lista.some((o) => o.tipo === 'aniversario' && o.data === d && semAcentos(o.nome).includes(semAcentos(p.name)));
    if (!ja) aniversarios.push({ person_id: p.id, nome: p.name, data: d });
  });

  return {
    hoje, ocasioes: lista, ocasiao: oc, destinatarios, presentes, orcamentos: orc, resumo, aniversarios,
    pessoas: pessoas.map((p) => ({ id: p.id, name: p.name })),
    estados: ESTADOS
  };
}

/* ---------------- escrita ---------------- */
function camposPresente(b, tem) {
  const c = {};
  if (tem('titulo') && texto(b.titulo, 160)) c.titulo = texto(b.titulo, 160);
  if (tem('estado') && ESTADOS.includes(b.estado)) c.estado = b.estado;
  if (tem('tipo')) c.tipo = b.tipo === 'lembranca' ? 'lembranca' : 'presente';
  if (tem('preco')) c.preco = numero(b.preco);
  ['de_quem', 'loja', 'tamanho', 'transportadora', 'seguimento', 'guardado'].forEach((k) => { if (tem(k)) c[k] = texto(b[k], 200); });
  if (tem('notas')) c.notas = texto(b.notas, 2000);
  if (tem('chega_ate')) c.chega_ate = data(b.chega_ate);
  if (tem('movimento_id')) c.movimento_id = inteiro(b.movimento_id);
  if (tem('ocasiao_id')) c.ocasiao_id = inteiro(b.ocasiao_id);
  if (tem('destinatario_id') && inteiro(b.destinatario_id)) c.destinatario_id = inteiro(b.destinatario_id);
  return c;
}

async function criarPresente(b) {
  const tem = (k) => Object.prototype.hasOwnProperty.call(b, k);
  const c = camposPresente(b, tem);
  if (!c.titulo) throw erro('O presente precisa de um nome.');
  if (!c.destinatario_id) throw erro('Falta para quem é.');
  const est = c.estado || 'ideia';
  const estados = {};
  if (est !== 'ideia' && !b.sem_datas) estados[est] = hojeLisboa();
  const r = await all(
    `INSERT INTO presentes (ocasiao_id, destinatario_id, titulo, estado, tipo, preco, de_quem, loja, tamanho,
                            transportadora, seguimento, chega_ate, guardado, notas, movimento_id, estados, sort)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,
             (SELECT COALESCE(max(sort),0)+10 FROM presentes WHERE destinatario_id = $2))
     RETURNING id`,
    [c.ocasiao_id || null, c.destinatario_id, c.titulo, est, c.tipo || 'presente', c.preco != null ? c.preco : null,
     c.de_quem || null, c.loja || null, c.tamanho || null, c.transportadora || null, c.seguimento || null,
     c.chega_ate || null, c.guardado || null, c.notas || null, c.movimento_id || null, JSON.stringify(estados)]);
  return r[0].id;
}

/* A pessoa a quem se oferece, pelo nome. Liga-se a uma pessoa do Farol
   quando o nome bate certo com o nome curto dela. */
async function destinatarioPorNome(nome, grupo) {
  const n = texto(nome, 120);
  if (!n) throw erro('Falta o nome da pessoa.');
  const ja = (await all('SELECT id FROM presentes_destinatarios WHERE lower(nome) = lower($1) LIMIT 1', [n]))[0];
  if (ja) return ja.id;
  const pessoas = await all(`SELECT id, name FROM people WHERE active AND origin = 'real' AND kind <> 'animal'`);
  const alvo = semAcentos(n);
  const p = pessoas.find((x) => semAcentos(x.name) === alvo);
  const r = await all(
    `INSERT INTO presentes_destinatarios (nome, person_id, grupo, sort)
     VALUES ($1, $2, $3, (SELECT COALESCE(max(sort),0)+10 FROM presentes_destinatarios)) RETURNING id`,
    [n, p ? p.id : null, texto(grupo, 60)]);
  return r[0].id;
}

function falha(res, err, onde) {
  console.error('[farol] presentes ' + onde + ':', err.message);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Não foi possível tratar dos presentes.' });
}

function instalar(app, opcoes) {
  const tarefas = opcoes && opcoes.tarefas;
  const id = (req) => Number(req.params.id);

  app.get('/api/presentes', async (req, res) => {
    try { res.json(await estado(inteiro(req.query.ocasiao))); } catch (err) { falha(res, err, 'GET'); }
  });

  /* ---- ocasioes ---- */
  app.post('/api/presentes/ocasioes', async (req, res) => {
    const b = req.body || {};
    const nome = texto(b.nome, 120);
    if (!nome) return res.status(400).json({ error: 'A ocasião precisa de um nome.' });
    try {
      const r = await all(
        `INSERT INTO presentes_ocasioes (nome, tipo, data, orcamento) VALUES ($1,$2,$3,$4) RETURNING id`,
        [nome, TIPOS_OC.includes(b.tipo) ? b.tipo : 'outra', data(b.data), numero(b.orcamento)]);
      res.status(201).json(await estado(r[0].id));
    } catch (err) { falha(res, err, 'POST ocasiao'); }
  });
  app.patch('/api/presentes/ocasioes/:id(\\d+)', async (req, res) => {
    const b = req.body || {};
    const tem = (k) => Object.prototype.hasOwnProperty.call(b, k);
    const campos = [], v = [id(req)];
    const por = (c, x) => { v.push(x); campos.push(c + ' = $' + v.length); };
    if (tem('nome') && texto(b.nome, 120)) por('nome', texto(b.nome, 120));
    if (tem('tipo') && TIPOS_OC.includes(b.tipo)) por('tipo', b.tipo);
    if (tem('data')) por('data', data(b.data));
    if (tem('orcamento')) por('orcamento', numero(b.orcamento));
    if (tem('arquivada')) por('arquivada', Boolean(b.arquivada));
    if (!campos.length) return res.status(400).json({ error: 'Nada para mudar.' });
    try {
      const r = await all(`UPDATE presentes_ocasioes SET ${campos.join(', ')} WHERE id = $1 RETURNING id`, v);
      if (!r.length) return res.status(404).json({ error: 'Ocasião não encontrada.' });
      res.json(await estado(id(req)));
    } catch (err) { falha(res, err, 'PATCH ocasiao'); }
  });
  app.delete('/api/presentes/ocasioes/:id(\\d+)', async (req, res) => {
    try {
      const r = await all('DELETE FROM presentes_ocasioes WHERE id = $1 RETURNING id', [id(req)]);
      if (!r.length) return res.status(404).json({ error: 'Ocasião não encontrada.' });
      res.json(await estado(null));
    } catch (err) { falha(res, err, 'DELETE ocasiao'); }
  });

  /* ---- pessoas a quem se oferece ---- */
  app.post('/api/presentes/destinatarios', async (req, res) => {
    const b = req.body || {};
    const nome = texto(b.nome, 120);
    if (!nome) return res.status(400).json({ error: 'Falta o nome.' });
    try {
      if ((await all('SELECT 1 FROM presentes_destinatarios WHERE lower(nome) = lower($1)', [nome])).length) {
        return res.status(400).json({ error: nome + ' já está na lista.' });
      }
      await query(
        `INSERT INTO presentes_destinatarios (nome, person_id, grupo, gostos, tamanhos, sort)
         VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(max(sort),0)+10 FROM presentes_destinatarios))`,
        [nome, inteiro(b.person_id), texto(b.grupo, 60), texto(b.gostos, 1000), texto(b.tamanhos, 400)]);
      res.status(201).json(await estado(inteiro(b.ocasiao_id)));
    } catch (err) { falha(res, err, 'POST destinatario'); }
  });
  app.patch('/api/presentes/destinatarios/:id(\\d+)', async (req, res) => {
    const b = req.body || {};
    const tem = (k) => Object.prototype.hasOwnProperty.call(b, k);
    const campos = [], v = [id(req)];
    const por = (c, x) => { v.push(x); campos.push(c + ' = $' + v.length); };
    if (tem('nome') && texto(b.nome, 120)) por('nome', texto(b.nome, 120));
    if (tem('person_id')) por('person_id', inteiro(b.person_id));
    if (tem('grupo')) por('grupo', texto(b.grupo, 60));
    if (tem('gostos')) por('gostos', texto(b.gostos, 1000));
    if (tem('tamanhos')) por('tamanhos', texto(b.tamanhos, 400));
    if (tem('ativo')) por('ativo', Boolean(b.ativo));
    if (!campos.length) return res.status(400).json({ error: 'Nada para mudar.' });
    try {
      const r = await all(`UPDATE presentes_destinatarios SET ${campos.join(', ')} WHERE id = $1 RETURNING id`, v);
      if (!r.length) return res.status(404).json({ error: 'Pessoa não encontrada.' });
      res.json(await estado(inteiro(b.ocasiao_id)));
    } catch (err) { falha(res, err, 'PATCH destinatario'); }
  });
  app.delete('/api/presentes/destinatarios/:id(\\d+)', async (req, res) => {
    try {
      const r = await all('DELETE FROM presentes_destinatarios WHERE id = $1 RETURNING id', [id(req)]);
      if (!r.length) return res.status(404).json({ error: 'Pessoa não encontrada.' });
      res.json(await estado(inteiro(req.query.ocasiao)));
    } catch (err) { falha(res, err, 'DELETE destinatario'); }
  });

  app.put('/api/presentes/orcamentos', async (req, res) => {
    const b = req.body || {};
    const oc = inteiro(b.ocasiao_id), d = inteiro(b.destinatario_id), v = numero(b.valor);
    if (!oc || !d) return res.status(400).json({ error: 'Falta a ocasião ou a pessoa.' });
    try {
      if (v == null) await query('DELETE FROM presentes_orcamentos WHERE ocasiao_id = $1 AND destinatario_id = $2', [oc, d]);
      else await query(
        `INSERT INTO presentes_orcamentos (ocasiao_id, destinatario_id, valor) VALUES ($1,$2,$3)
         ON CONFLICT (ocasiao_id, destinatario_id) DO UPDATE SET valor = EXCLUDED.valor`, [oc, d, v]);
      res.json(await estado(oc));
    } catch (err) { falha(res, err, 'orcamento'); }
  });

  /* ---- presentes ---- */
  app.post('/api/presentes', async (req, res) => {
    const b = req.body || {};
    try {
      if (!inteiro(b.destinatario_id) && texto(b.destinatario_nome, 120)) b.destinatario_id = await destinatarioPorNome(b.destinatario_nome, b.grupo);
      const novo = await criarPresente(b);
      res.status(201).json(Object.assign(await estado(inteiro(b.ocasiao_id)), { id: novo }));
    } catch (err) { falha(res, err, 'POST'); }
  });

  app.patch('/api/presentes/:id(\\d+)', async (req, res) => {
    const b = req.body || {};
    const tem = (k) => Object.prototype.hasOwnProperty.call(b, k);
    const c = camposPresente(b, tem);
    if (tem('ocasiao_id') && b.ocasiao_id === null) c.ocasiao_id = null;
    if (!Object.keys(c).length) return res.status(400).json({ error: 'Nada para mudar.' });
    try {
      const atual = (await all('SELECT id, estado, ocasiao_id FROM presentes WHERE id = $1', [id(req)]))[0];
      if (!atual) return res.status(404).json({ error: 'Presente não encontrado.' });
      const campos = [], v = [id(req)];
      Object.keys(c).forEach((k) => { v.push(c[k]); campos.push(k + ' = $' + v.length); });
      if (c.estado && c.estado !== atual.estado) {
        v.push(c.estado); v.push(hojeLisboa());
        campos.push(`estados = estados || jsonb_build_object($${v.length - 1}::text, $${v.length}::text)`);
      }
      await query(`UPDATE presentes SET ${campos.join(', ')}, updated_at = now() WHERE id = $1`, v);
      res.json(await estado(inteiro(b.ver) || (c.ocasiao_id !== undefined ? atual.ocasiao_id : null) || atual.ocasiao_id));
    } catch (err) { falha(res, err, 'PATCH'); }
  });

  app.delete('/api/presentes/:id(\\d+)', async (req, res) => {
    try {
      const r = await all('DELETE FROM presentes WHERE id = $1 RETURNING ocasiao_id', [id(req)]);
      if (!r.length) return res.status(404).json({ error: 'Presente não encontrado.' });
      res.json(await estado(r[0].ocasiao_id));
    } catch (err) { falha(res, err, 'DELETE'); }
  });

  /* Copiar para outra pessoa (os bilhetes do Cirque du Soleil eram para tres). */
  app.post('/api/presentes/:id(\\d+)/copiar', async (req, res) => {
    const b = req.body || {};
    try {
      const p = (await all('SELECT * FROM presentes WHERE id = $1', [id(req)]))[0];
      if (!p) return res.status(404).json({ error: 'Presente não encontrado.' });
      const dest = inteiro(b.destinatario_id) || p.destinatario_id;
      const oc = Object.prototype.hasOwnProperty.call(b, 'ocasiao_id') ? inteiro(b.ocasiao_id) : p.ocasiao_id;
      const novo = await criarPresente({
        destinatario_id: dest, ocasiao_id: oc, titulo: p.titulo, estado: 'ideia', tipo: p.tipo,
        preco: p.preco, de_quem: p.de_quem, loja: p.loja, notas: p.notas
      });
      res.status(201).json(Object.assign(await estado(oc), { id: novo }));
    } catch (err) { falha(res, err, 'copiar'); }
  });

  /* A compra no banco: saidas com o mesmo valor nos ultimos 120 dias que
     ainda nao estao ligadas a outro presente. */
  app.get('/api/presentes/:id(\\d+)/movimentos', async (req, res) => {
    try {
      const p = (await all('SELECT id, preco::float AS preco, titulo FROM presentes WHERE id = $1', [id(req)]))[0];
      if (!p) return res.status(404).json({ error: 'Presente não encontrado.' });
      const procura = texto(req.query.q, 60);
      let linhas = [];
      try {
        linhas = await all(
          `SELECT m.id, to_char(m.data, 'YYYY-MM-DD') AS data, COALESCE(m.titulo, m.descricao) AS descricao,
                  m.valor::float AS valor, c.nome AS conta
             FROM fin_movimentos m JOIN fin_contas c ON c.id = m.conta_id
            WHERE m.valor < 0 AND m.data >= CURRENT_DATE - 120
              AND NOT EXISTS (SELECT 1 FROM presentes x WHERE x.movimento_id = m.id AND x.id <> $1)
              AND ( ($2::numeric IS NOT NULL AND abs(m.valor + $2::numeric) < 0.01)
                 OR ($3::text IS NOT NULL AND (m.descricao ILIKE '%' || $3 || '%' OR m.titulo ILIKE '%' || $3 || '%' OR m.entidade ILIKE '%' || $3 || '%')) )
            ORDER BY m.data DESC LIMIT 25`, [p.id, p.preco || null, procura]);
      } catch (e) { linhas = []; }
      res.json({ movimentos: linhas });
    } catch (err) { falha(res, err, 'movimentos'); }
  });

  /* A tarefa de embrulhar: o que ja chegou (ou foi feito em casa) e falta
     embrulhar, um passo por presente. Riscar o passo passa-o a embrulhado. */
  app.post('/api/presentes/embrulhar', async (req, res) => {
    const b = req.body || {};
    try {
      if (!tarefas) throw new Error('sem modulo de tarefas');
      const e = await estado(inteiro(b.ocasiao_id));
      if (!e.ocasiao) throw erro('Falta a ocasião.');
      const nomes = {};
      e.destinatarios.forEach((d) => { nomes[d.id] = d.nome; });
      const lista = e.presentes.filter((p) => p.ocasiao_id === e.ocasiao.id && ['chegou', 'feito'].includes(p.estado) && !p.task_id);
      if (!lista.length) throw erro('Não há presentes à espera de embrulho.');
      const hoje = hojeLisboa();
      let prazo = maisDias(hoje, 3);
      if (e.ocasiao.data && maisDias(e.ocasiao.data, -2) > hoje && maisDias(e.ocasiao.data, -2) < prazo) prazo = maisDias(e.ocasiao.data, -2);
      if (e.ocasiao.data && maisDias(e.ocasiao.data, -2) <= hoje) prazo = hoje;
      const passos = lista.map((p) => ({ title: nomes[p.destinatario_id] + ' — ' + p.titulo }));
      const tid = await tarefas.criar({
        title: 'Embrulhar presentes — ' + e.ocasiao.nome,
        notes: 'Ao riscar um passo, o presente passa a «Embrulhado» em Presentes.',
        due_on: prazo,
        items: passos
      });
      for (let k = 0; k < lista.length; k++) {
        await query('UPDATE presentes SET task_id = $2, updated_at = now() WHERE id = $1', [lista[k].id, tid]);
      }
      res.status(201).json(Object.assign(await estado(e.ocasiao.id), { task_id: tid, passos: passos.length }));
    } catch (err) { falha(res, err, 'embrulhar'); }
  });

  /* A lista inteira da Gift List, de uma vez. Corre as vezes que se quiser:
     o presente que ja existe (mesma pessoa, mesma ocasiao, mesmo nome) fica.
     { ocasiao: {nome,tipo,data,orcamento}, linhas: [{pessoa,grupo,titulo,estado,preco,de_quem}],
       pessoas: [{nome,grupo}] } */
  app.post('/api/presentes/importar', async (req, res) => {
    const b = req.body || {};
    try {
      const o = b.ocasiao || {};
      const nomeOc = texto(o.nome, 120);
      if (!nomeOc) throw erro('Falta o nome da ocasião.');
      let oc = (await all('SELECT id FROM presentes_ocasioes WHERE lower(nome) = lower($1) LIMIT 1', [nomeOc]))[0];
      if (!oc) {
        oc = (await all('INSERT INTO presentes_ocasioes (nome, tipo, data, orcamento) VALUES ($1,$2,$3,$4) RETURNING id',
          [nomeOc, TIPOS_OC.includes(o.tipo) ? o.tipo : 'outra', data(o.data), numero(o.orcamento)]))[0];
      }
      let novos = 0, ja = 0, pessoasNovas = 0;
      const antes = (await all('SELECT count(*)::int AS n FROM presentes_destinatarios'))[0].n;
      for (const p of (Array.isArray(b.pessoas) ? b.pessoas : []).slice(0, 300)) {
        await destinatarioPorNome(p.nome, p.grupo);
      }
      for (const l of (Array.isArray(b.linhas) ? b.linhas : []).slice(0, 1000)) {
        const did = await destinatarioPorNome(l.pessoa, l.grupo);
        const titulo = texto(l.titulo, 160);
        if (!titulo) continue;
        const existe = (await all(
          'SELECT 1 FROM presentes WHERE ocasiao_id = $1 AND destinatario_id = $2 AND lower(titulo) = lower($3)', [oc.id, did, titulo])).length;
        if (existe) { ja += 1; continue; }
        await criarPresente({
          ocasiao_id: oc.id, destinatario_id: did, titulo, estado: ESTADOS.includes(l.estado) ? l.estado : 'ideia',
          preco: numero(l.preco) || null, de_quem: l.de_quem, tipo: l.tipo, notas: l.notas, sem_datas: true
        });
        novos += 1;
      }
      pessoasNovas = (await all('SELECT count(*)::int AS n FROM presentes_destinatarios'))[0].n - antes;
      res.status(201).json(Object.assign(await estado(oc.id), { importados: novos, ja_existiam: ja, pessoas_novas: pessoasNovas }));
    } catch (err) { falha(res, err, 'importar'); }
  });

  /* Para a ficha da pessoa: o que lhe demos e o que ela quer. */
  app.get('/api/presentes/pessoa/:id(\\d+)', async (req, res) => {
    try {
      const dest = await all('SELECT id, nome, grupo, gostos, tamanhos FROM presentes_destinatarios WHERE person_id = $1', [id(req)]);
      if (!dest.length) return res.json({ destinatarios: [], presentes: [] });
      const lista = await all(
        `SELECT p.id, p.titulo, p.estado, p.preco::float AS preco, p.de_quem, p.ocasiao_id, p.destinatario_id,
                o.nome AS ocasiao, to_char(o.data, 'YYYY-MM-DD') AS data
           FROM presentes p LEFT JOIN presentes_ocasioes o ON o.id = p.ocasiao_id
          WHERE p.destinatario_id = ANY($1::int[])
          ORDER BY o.data DESC NULLS FIRST, p.sort, p.id`, [dest.map((d) => d.id)]);
      res.json({ destinatarios: dest, presentes: lista });
    } catch (err) { falha(res, err, 'pessoa'); }
  });
}

/* O passo riscado na tarefa de embrulhar passa o presente a embrulhado.
   Chamado pelo modulo de tarefas? Nao: faz-se por gatilho na base de dados
   (db/schema.sql, presentes_passo). */

module.exports = { instalar, estado };
