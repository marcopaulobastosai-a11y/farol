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

function sistema(ctx) {
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
  ].join('\n');
}

async function perguntar(texto, ctx) {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    signal: AbortSignal.timeout(TEMPO_MAX),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': CHAVE },
    body: JSON.stringify({
      model: MODELO,
      system_instruction: sistema(ctx),
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

async function interpretar(texto) {
  const ctx = await contexto();
  let ultimo = null, bruto = null;
  for (let i = 0; i <= ESPERAS.length; i++) {
    try { bruto = await perguntar(texto, ctx); break; }
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

function instalar(app) {
  app.post('/api/captar/interpretar', async (req, res) => {
    const texto = String((req.body && req.body.texto) || '').trim();
    if (!texto) return res.status(400).json({ error: 'Escreve ou dita o que queres captar.' });
    if (texto.length > 2000) return res.status(400).json({ error: 'Texto demasiado longo: no máximo 2000 caracteres.' });
    if (!CHAVE) return res.status(503).json({ error: 'A leitura automática não está ligada (falta a chave do Gemini).' });
    try { res.json(await interpretar(texto)); }
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
