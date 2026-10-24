'use strict';
/**
 * Farol - a captura universal (fase 5 do menu novo, 24 out 2026).
 *
 * O + aceita uma frase como se diria a alguem - «consulta da mae no dentista
 * dia 12 as 15h, 60 €» - e o Gemini parte-a em cartoes: um evento, um
 * pagamento, uma tarefa. Aqui so se propoe; quem grava e a pessoa, cartao a
 * cartao, no ecra (public/captar.js), pelas rotas de sempre.
 *
 *   POST /api/captar/interpretar  { texto }   -> { resumo, pergunta, cartoes }
 *   POST /api/captar/tarefa       { ...tarefa } -> { id }
 *
 * A segunda existe porque o POST /api/gestao/tarefas devolve o painel inteiro
 * e nao o id da tarefa nova - e sem o id nao ha «desfazer».
 *
 * Os nomes (areas, pessoas, contas correntes) vao ao modelo como listas
 * fechadas e voltam traduzidos para ids aqui, para o ecra nao ter de
 * adivinhar.
 */
const { query } = require('./db');
const tarefas = require('./tarefas');

const CHAVE = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const MODELO = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const TEMPO_MAX = 45 * 1000;
const ESPERAS = [2500, 8000];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const all = async (sql, p) => (await query(sql, p)).rows;

const TIPOS = ['tarefa', 'pagamento', 'lembrete', 'evento', 'nota', 'conta_corrente'];
const s = (d) => ({ type: 'string', description: d });

const ESQUEMA = {
  type: 'object',
  properties: {
    resumo: s('Uma linha a dizer o que se percebeu.'),
    pergunta: s('So se faltar uma coisa essencial: UMA pergunta curta. Senao, vazio.'),
    cartoes: {
      type: 'array',
      description: 'De 1 a 4 cartoes. Cada coisa diferente que a frase pede e um cartao.',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: TIPOS },
          titulo: s('Curto, como se escreveria numa lista. Sem a data nem o valor.'),
          data: s('AAAA-MM-DD, ou vazio.'),
          hora: s('HH:MM, ou vazio.'),
          valor: { type: 'number', description: 'Em euros, positivo. 0 se nao houver.' },
          entidade: s('A quem se paga ou onde e (dentista, EDP, escola). Pode ficar vazio.'),
          area: s('Exactamente um nome da lista de areas, ou vazio.'),
          pessoas: { type: 'array', items: { type: 'string' }, description: 'Nomes da lista de pessoas: por causa de quem (numa tarefa) ou quem vai (num evento).' },
          responsavel: s('Nome da lista de pessoas que podem ter tarefas, ou vazio.'),
          conta_corrente: s('So em conta_corrente: o nome exacto da lista de contas correntes.'),
          sentido: { type: 'string', enum: ['deve_me', 'devo', ''], description: 'So em conta_corrente.' },
          repete: { type: 'string', enum: ['', 'semana', 'mes', 'ano'] },
          notas: s('O que nao coube nos outros campos. Curto.'),
          sugestao: { type: 'boolean', description: 'true se o cartao nao foi pedido na frase mas e uma consequencia provavel (ex.: a boleia).' }
        },
        required: ['tipo', 'titulo']
      }
    }
  },
  required: ['cartoes']
};

function hojeLisboa() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
}
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

async function contexto() {
  const [areas, pessoas, cc] = await Promise.all([
    all(`SELECT c.id, c.name, p.name AS pai FROM contexts c LEFT JOIN contexts p ON p.id = c.parent_id
          WHERE c.active ORDER BY COALESCE(p.sort, c.sort), c.parent_id NULLS FIRST, c.sort`),
    all("SELECT id, name, full_name, role, kind, can_own_tasks FROM people WHERE active ORDER BY sort, id"),
    all('SELECT id, nome, person_id FROM fin_cc_pessoas WHERE ativo ORDER BY nome').catch(() => [])
  ]);
  return {
    areas: areas.map((a) => ({ id: a.id, nome: a.pai ? a.pai + ' > ' + a.name : a.name })),
    pessoas, cc
  };
}

function norm(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
function acharArea(ctx, nome) {
  const n = norm(nome);
  if (!n) return null;
  const a = ctx.areas.find((x) => norm(x.nome) === n) ||
    ctx.areas.find((x) => norm(x.nome).endsWith('> ' + n)) ||
    ctx.areas.find((x) => norm(x.nome).indexOf(n) >= 0);
  return a ? a.id : null;
}
function acharPessoa(ctx, nome) {
  const n = norm(nome);
  if (!n) return null;
  const p = ctx.pessoas.find((x) => norm(x.name) === n || norm(x.full_name) === n) ||
    ctx.pessoas.find((x) => norm(x.name).split(' ')[0] === n.split(' ')[0]) ||
    ctx.pessoas.find((x) => norm(x.role) === n);
  return p ? p.id : null;
}
function acharCc(ctx, nome) {
  const n = norm(nome);
  if (!n) return null;
  const c = ctx.cc.find((x) => norm(x.nome) === n) || ctx.cc.find((x) => norm(x.nome).indexOf(n) >= 0 || n.indexOf(norm(x.nome)) >= 0);
  return c ? c.id : null;
}
const dataOk = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? d : null);
const horaOk = (h) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(h || '')) ? h : null);

function sistema(ctx, onde) {
  const hoje = hojeLisboa();
  const dow = DIAS[new Date(hoje + 'T12:00:00Z').getUTCDay()];
  return [
    'Es o assistente de captura do Farol, a app de gestao de uma casa em Portugal.',
    'Recebes uma frase escrita ou ditada e partes-a em cartoes para a pessoa confirmar.',
    'Escreve sempre em portugues de Portugal.',
    '',
    'Hoje e ' + dow + ', ' + hoje + '. Datas relativas (amanha, sexta, dia 12, para a semana) contam a partir de hoje;',
    '«dia 12» sem mes e o proximo dia 12 que ainda nao passou.',
    '',
    'Tipos de cartao:',
    '- evento: algo com dia (e muitas vezes hora) em que alguem tem de estar - consulta, reuniao, jantar, viagem.',
    '- tarefa: algo a fazer. Com prazo se a frase o der.',
    '- pagamento: dinheiro que ainda vai sair (conta, propina, consulta a pagar). Leva valor e entidade.',
    '- lembrete: uma data a nao esquecer que nao se «faz» (aniversario, fim de garantia).',
    '- nota: informacao para guardar, sem data nem acao.',
    '- conta_corrente: dinheiro que ja se adiantou por alguem ou que alguem ja adiantou por nos',
    '  («paguei 20 € do jantar da Ana», «o meu pai pagou-me o seguro»). Usa a lista de contas correntes;',
    '  sentido deve_me se a outra pessoa fica a dever, devo se e ao contrario.',
    '',
    'Regras:',
    '- Uma frase pode dar varios cartoes: «consulta da mae no dentista dia 12 as 15h, 60 €» da um evento',
    '  (com a mae em pessoas) e um pagamento de 60 € no mesmo dia. Nao repitas a mesma coisa em dois cartoes.',
    '- Se o evento for de alguem que nao faz tarefas (os pais, as criancas pequenas), podes juntar uma',
    '  tarefa de apoio (boleia, acompanhar) com sugestao=true e responsavel vazio. So uma, e so quando faz sentido.',
    '- area, pessoas, responsavel e conta_corrente so podem usar nomes das listas abaixo. Se nao houver um que',
    '  sirva, deixa vazio - nao inventes.',
    '- Nunca inventes valores, datas ou horas que a frase nao diga.',
    '- pergunta: so quando faltar algo sem o qual o cartao nao serve (ex.: um pagamento sem valor nenhum).',
    '',
    'Areas (Area > Sub-area):',
    ctx.areas.map((a) => '- ' + a.nome).join('\n'),
    '',
    'Pessoas da casa:',
    ctx.pessoas.map((p) => '- ' + p.name + (p.role ? ' (' + p.role + ')' : '') +
      (p.can_own_tasks ? '' : ' - nao faz tarefas')).join('\n'),
    '',
    'Contas correntes (quem nos deve ou a quem devemos):',
    (ctx.cc.length ? ctx.cc.map((c) => '- ' + c.nome).join('\n') : '- (nenhuma)')
  ].concat(onde ? ['', 'A pessoa esta a captar a partir de: ' + onde + '. Usa isto por omissao (area e/ou pessoa)',
    'em todos os cartoes, salvo se a frase disser claramente outra coisa.'] : []).join('\n');
}

async function perguntar(texto, ctx, onde) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    signal: AbortSignal.timeout(TEMPO_MAX),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': CHAVE },
    body: JSON.stringify({
      model: MODELO,
      system_instruction: sistema(ctx, onde),
      store: false,
      input: [{ type: 'text', text: texto }],
      response_format: { type: 'text', mime_type: 'application/json', schema: ESQUEMA }
    })
  });
  if (!r.ok) {
    const t = (await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
    const porDia = r.status === 429 && /per day|por dia/i.test(t);
    const e = new Error(porDia ? 'O Gemini esgotou os pedidos gratuitos de hoje.' : 'O Gemini respondeu ' + r.status + '.');
    e.transitorio = !porDia && (r.status === 429 || r.status >= 500);
    throw e;
  }
  const j = await r.json();
  let cru = '';
  (j.steps || []).forEach((p) => (p.content || []).forEach((c) => { if (c && c.type === 'text' && c.text) cru += c.text; }));
  if (!cru && typeof j.output_text === 'string') cru = j.output_text;
  if (!cru) throw new Error('O Gemini não devolveu nada.');
  return JSON.parse(cru);
}

async function interpretar(texto, pista) {
  const ctx = await contexto();
  const ondeA = pista && pista.area_id ? ctx.areas.find((a) => a.id === Number(pista.area_id)) : null;
  const ondeP = pista && pista.pessoa_id ? ctx.pessoas.find((x) => x.id === Number(pista.pessoa_id)) : null;
  const onde = [ondeA ? 'a area ' + ondeA.nome : '', ondeP ? 'a ficha de ' + ondeP.name : ''].filter(Boolean).join(' e ');
  let ultimo = null, bruto = null;
  for (let i = 0; i <= ESPERAS.length; i++) {
    try { bruto = await perguntar(texto, ctx, onde); break; }
    catch (e) {
      ultimo = e;
      const tempo = /Timeout|Abort/.test(String(e.name) + String(e.message));
      if (!(e.transitorio || tempo) || i === ESPERAS.length) throw e;
      await dormir(ESPERAS[i]);
    }
  }
  if (!bruto) throw ultimo || new Error('Sem resposta do Gemini.');
  const cartoes = (Array.isArray(bruto.cartoes) ? bruto.cartoes : []).slice(0, 4)
    .filter((c) => c && TIPOS.indexOf(c.tipo) >= 0 && String(c.titulo || '').trim())
    .map((c) => {
      const pessoas = (Array.isArray(c.pessoas) ? c.pessoas : []).map((n) => acharPessoa(ctx, n)).filter(Boolean);
      const resp = acharPessoa(ctx, c.responsavel);
      return {
        tipo: c.tipo,
        titulo: String(c.titulo).trim().slice(0, 200),
        data: dataOk(c.data),
        hora: horaOk(c.hora),
        valor: Number(c.valor) > 0 ? Math.round(Number(c.valor) * 100) / 100 : null,
        entidade: String(c.entidade || '').trim().slice(0, 120) || null,
        context_id: acharArea(ctx, c.area),
        pessoas: pessoas.filter((v, i, a) => a.indexOf(v) === i),
        responsavel_id: resp && ctx.pessoas.find((p) => p.id === resp && p.can_own_tasks) ? resp : null,
        cc_id: c.tipo === 'conta_corrente' ? acharCc(ctx, c.conta_corrente) : null,
        sentido: c.sentido === 'devo' ? 'devo' : 'deve_me',
        repete: ['semana', 'mes', 'ano'].indexOf(c.repete) >= 0 ? c.repete : null,
        notas: String(c.notas || '').trim().slice(0, 1000) || null,
        sugestao: c.sugestao === true
      };
    });
  return {
    resumo: String(bruto.resumo || '').trim(),
    pergunta: String(bruto.pergunta || '').trim(),
    cartoes,
    hoje: hojeLisboa()
  };
}

/* ------------------------------------------------------------------ *
 * Arrumar os movimentos sem area (24 out 2026)
 *
 * A maior parte dos movimentos do banco nao tem area: nem marcada, nem por
 * uma despesa, um projeto ou a categoria. Juntam-se pela entidade (ou pela
 * descricao sem numeros) - o mesmo supermercado, a mesma renda - e o Gemini
 * propoe uma area por grupo. A pessoa confirma em bloco no ecra; quem grava
 * e a rota de sempre (/api/financas/movimentos/lote). Os grupos que a pessoa
 * diz que nao tem area ficam em settings ('mov_area_dispensados') para nao
 * voltarem.
 * ------------------------------------------------------------------ */
const SEM_AREA_SQL = `
  WITH sem AS (
    SELECT m.id, m.valor, m.data,
           lower(trim(COALESCE(NULLIF(m.entidade,''),
             regexp_replace(regexp_replace(COALESCE(NULLIF(m.titulo,''), m.descricao), '[0-9]+', '', 'g'), '\\s+', ' ', 'g')))) AS chave,
           COALESCE(NULLIF(m.titulo,''), m.descricao) AS texto, m.entidade, cat.nome AS categoria, c.nome AS conta
      FROM fin_movimentos m
      JOIN fin_contas c ON c.id = m.conta_id
      LEFT JOIN fin_categorias cat ON cat.id = m.categoria_id
      LEFT JOIN expenses e ON e.id = m.expense_id
      LEFT JOIN projects p ON p.id = m.project_id
     WHERE m.context_id IS NULL AND m.par_id IS NULL AND m.par_grupo IS NULL
       AND m.para_conta_id IS NULL AND c.tipo <> 'splitwise'
       AND e.context_id IS NULL AND p.context_id IS NULL AND cat.context_id IS NULL
  )`;

async function dispensados() {
  const r = await all("SELECT value FROM settings WHERE key = 'mov_area_dispensados'");
  try { const v = r.length ? JSON.parse(r[0].value) : []; return Array.isArray(v) ? v : []; } catch (e) { return []; }
}

async function gruposSemArea(limite, saltar) {
  const fora = await dispensados();
  const passar = new Set((saltar || []).map(String).slice(0, 3000));
  const rows = await all(SEM_AREA_SQL + `
    SELECT chave, count(*)::int AS n, sum(valor)::float AS total, to_char(max(data),'YYYY-MM-DD') AS ultimo,
           array_agg(id ORDER BY data DESC) AS ids, (array_agg(texto ORDER BY data DESC))[1] AS exemplo,
           max(entidade) AS entidade, max(categoria) AS categoria, max(conta) AS conta
      FROM sem WHERE chave <> '' AND NOT (chave = ANY($1::text[]))
     GROUP BY chave ORDER BY count(*) DESC, sum(abs(valor)) DESC`, [fora]);
  const total = rows.reduce((s2, g) => s2 + g.n, 0);
  return { grupos: rows.filter((g) => !passar.has(g.chave)).slice(0, limite), restantes_grupos: rows.length, restantes_mov: total };
}

const ESQUEMA_AREAS = {
  type: 'object',
  properties: {
    propostas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer', description: 'O numero do grupo.' },
          area: { type: 'string', description: 'Exactamente um nome da lista de areas, ou vazio se nao der para saber.' },
          confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] }
        },
        required: ['i', 'area', 'confianca']
      }
    }
  },
  required: ['propostas']
};

async function chamarGemini(sist, texto, esquema) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    signal: AbortSignal.timeout(TEMPO_MAX * 2),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': CHAVE },
    body: JSON.stringify({
      model: MODELO, system_instruction: sist, store: false,
      input: [{ type: 'text', text: texto }],
      response_format: { type: 'text', mime_type: 'application/json', schema: esquema }
    })
  });
  if (!r.ok) {
    const t = (await r.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
    const porDia = r.status === 429 && /per day|por dia/i.test(t);
    const e = new Error(porDia ? 'O Gemini esgotou os pedidos gratuitos de hoje.' : 'O Gemini respondeu ' + r.status + '.');
    e.transitorio = !porDia && (r.status === 429 || r.status >= 500);
    throw e;
  }
  const j = await r.json();
  let cru = '';
  (j.steps || []).forEach((p) => (p.content || []).forEach((c) => { if (c && c.type === 'text' && c.text) cru += c.text; }));
  if (!cru && typeof j.output_text === 'string') cru = j.output_text;
  if (!cru) throw new Error('O Gemini não devolveu nada.');
  return JSON.parse(cru);
}

async function proporAreas(limite, saltar) {
  const [g, ctx] = await Promise.all([gruposSemArea(limite, saltar), contexto()]);
  if (!g.grupos.length) return Object.assign(g, { grupos: [] });
  const sist = [
    'Es o assistente das financas do Farol, a app de gestao de uma casa em Portugal.',
    'Recebes grupos de movimentos bancarios (o mesmo comerciante ou descricao) e dizes a que area da casa',
    'pertence cada grupo, escolhendo exactamente um nome da lista. Se o grupo nao pertencer claramente a',
    'nenhuma (transferencias, levantamentos, coisas ambiguas), deixa a area vazia - nao adivinhes.',
    'confianca alta so quando o comerciante deixa pouca duvida (ex.: farmacia -> Saude; renda -> Casa).',
    'Supermercados, padarias e entregas de comida sao as compras do dia a dia da casa: propoe a area Casa com confianca media.',
    'Uber, Bolt e taxis: Viagens e lazer com confianca baixa, a nao ser que a descricao diga mais.',
    '',
    'Areas (Area > Sub-area). Prefere a sub-area quando for clara; senao a area de topo:',
    ctx.areas.map((a) => '- ' + a.nome).join('\n'),
    '',
    'Pessoas da casa (para perceber descricoes com nomes):',
    ctx.pessoas.map((p) => '- ' + p.name + (p.role ? ' (' + p.role + ')' : '')).join('\n')
  ].join('\n');
  const texto = g.grupos.map((x, i) => [i, x.exemplo, x.entidade ? 'entidade: ' + x.entidade : '',
    x.categoria ? 'categoria: ' + x.categoria : '', 'conta: ' + x.conta, x.n + ' movimentos',
    'total ' + Math.round(x.total) + ' EUR'].filter(Boolean).join(' | ')).join('\n');
  let resp = null, ultimo = null;
  for (let i = 0; i <= ESPERAS.length; i++) {
    try { resp = await chamarGemini(sist, texto, ESQUEMA_AREAS); break; }
    catch (e) {
      ultimo = e;
      const tempo = /Timeout|Abort/.test(String(e.name) + String(e.message));
      if (!(e.transitorio || tempo) || i === ESPERAS.length) throw e;
      await dormir(ESPERAS[i]);
    }
  }
  if (!resp) throw ultimo || new Error('Sem resposta do Gemini.');
  const porI = {};
  (resp.propostas || []).forEach((p) => { porI[p.i] = p; });
  g.grupos = g.grupos.map((x, i) => {
    const p = porI[i] || {};
    const area = acharArea(ctx, p.area);
    return Object.assign({}, x, { area_id: area, confianca: area ? (p.confianca || 'baixa') : null });
  });
  return g;
}

function instalar(app) {
  app.get('/api/captar/movimentos-sem-area', async (_req, res) => {
    try { const g = await gruposSemArea(0); res.json({ movimentos: g.restantes_mov, grupos: g.restantes_grupos }); }
    catch (err) { console.error('[farol] movimentos sem area:', err.message); res.status(500).json({ error: 'Não foi possível contar os movimentos.' }); }
  });

  app.post('/api/captar/movimentos-areas', async (req, res) => {
    if (!CHAVE) return res.status(503).json({ error: 'A leitura automática não está ligada (falta a chave do Gemini).' });
    const limite = Math.min(Math.max(Number((req.body || {}).limite) || 40, 5), 80);
    try { res.json(await proporAreas(limite, (req.body || {}).saltar)); }
    catch (err) { console.error('[farol] propor areas:', err.message); res.status(502).json({ error: err.message || 'Não foi possível propor áreas.' }); }
  });

  app.post('/api/captar/movimentos-dispensar', async (req, res) => {
    try {
      const novas = ((req.body || {}).chaves || []).map((c) => String(c).slice(0, 200)).filter(Boolean);
      const todas = [...new Set((await dispensados()).concat(novas))].slice(-3000);
      await query(`INSERT INTO settings (key, value) VALUES ('mov_area_dispensados', $1)
                   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(todas)]);
      res.json({ dispensados: todas.length });
    } catch (err) { console.error('[farol] dispensar:', err.message); res.status(500).json({ error: 'Não foi possível guardar.' }); }
  });


  app.post('/api/captar/interpretar', async (req, res) => {
    const texto = String((req.body && req.body.texto) || '').trim();
    if (!texto) return res.status(400).json({ error: 'Escreve ou dita o que queres captar.' });
    if (texto.length > 2000) return res.status(400).json({ error: 'Texto demasiado longo: no máximo 2000 caracteres.' });
    if (!CHAVE) return res.status(503).json({ error: 'A leitura automática não está ligada (falta a chave do Gemini).' });
    try { res.json(await interpretar(texto, { area_id: req.body.area_id, pessoa_id: req.body.pessoa_id })); }
    catch (err) {
      console.error('[farol] captar:', err.message);
      res.status(502).json({ error: err.message || 'Não foi possível interpretar.' });
    }
  });

  /* Criar uma tarefa e devolver o id - para o «desfazer». Passa pela mesma
     funcao do POST /api/gestao/tarefas, com as mesmas regras. */
  app.post('/api/captar/tarefa', async (req, res) => {
    try {
      const id = await tarefas.criar(req.body || {});
      res.status(201).json({ id });
    } catch (err) {
      console.error('[farol] captar tarefa:', err.message);
      res.status(err.status || 500).json({ error: err.message || 'Não foi possível criar a tarefa.' });
    }
  });
}

module.exports = { instalar };
