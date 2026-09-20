'use strict';
/**
 * Farol - proposta automatica para a Caixa de entrada.
 *
 * O modelo le o ficheiro e propoe o que ele e. Aqui so se propoe: a proposta
 * fica em inbox_items.ai_json e e devolvida a quem chamou. Quem decide se ela
 * se torna real e o inbox.js - e so o faz quando o modelo diz que leu com
 * confianca alta. Tudo o resto fica por triar, a espera de uma pessoa.
 *
 * Corre no Gemini, do Google (API de interactions), porque tem escalao
 * gratuito e chega de sobra para o volume de uma casa. Sem GEMINI_API_KEY o
 * modulo desliga-se sozinho e a Caixa funciona na mesma, so sem sugestoes.
 */
const { query } = require('./db');

const CHAVE = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const MODELO = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

/* O escalao gratuito responde 503 quando o modelo esta com muita procura.
   Nao e falha do ficheiro nem do pedido: e so esperar. Tenta-se tres vezes,
   com pausas maiores de cada vez, e so depois se pede a outro modelo. */
const MODELOS = [MODELO]
  .concat((process.env.GEMINI_MODELOS || 'gemini-3.6-flash')
    .split(',').map((m) => m.trim()).filter(Boolean))
  .filter((m, i, todos) => todos.indexOf(m) === i);
const ESPERAS = [3000, 12000, 25000];
const TEMPO_MAX = 90 * 1000;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const ativa = () => Boolean(CHAVE);

const IMAGENS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
// Limite pratico do corpo do pedido. Acima disto nem vale a pena tentar.
const MAX_BYTES = 6 * 1024 * 1024;

const texto = (d) => ({ type: 'string', description: d });

/**
 * Esquema fixo em vez de pedir JSON em texto: assim a resposta nao pode vir
 * malformada nem embrulhada em conversa.
 */
const ESQUEMA = {
  type: 'object',
  properties: {
    resumo: texto('Uma linha a dizer o que e o ficheiro.'),
    destinos: {
      type: 'array',
      description: 'Um ou mais destinos. Vazio se nao for possivel perceber.',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['tarefa', 'pagamento', 'evento', 'documento', 'despesa'] },
          confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
          dados: {
            type: 'object',
            properties: {
              title: texto('Titulo da tarefa ou do evento.'),
              name: texto('Nome do documento.'),
              description: texto('Descricao da despesa.'),
              amount: { type: 'number', description: 'Valor total em euros.' },
              spent_on: texto('Data da despesa, AAAA-MM-DD.'),
              merchant: texto('Estabelecimento ou entidade que cobrou.'),
              day: texto('Dia do evento, AAAA-MM-DD.'),
              at: texto('Hora do evento, HH:MM.'),
              due_on: texto('Prazo da tarefa ou do pagamento, AAAA-MM-DD.'),
              payee: texto('A quem se paga: a entidade que emitiu a fatura ou o aviso.'),
              payment_ref: texto('Como se paga: IBAN, ou entidade e referencia de multibanco, tal como vem no papel.'),
              entity: texto('Quem emitiu o documento: empresa, banco, seguradora, escola, servico do Estado. Tal como vem escrito no papel.'),
              issued_on: texto('Data do proprio documento - quando foi emitido, assinado ou passado. AAAA-MM-DD.'),
              valid_on: texto('Data em que o documento deixa de valer, se o disser. AAAA-MM-DD.'),
              pessoa: texto('Pessoa da casa a quem o ficheiro diz respeito, escrita tal como vem na lista de pessoas desta casa.'),
              area: texto('Area ou sub-area onde isto se arruma, escrita tal como vem na lista de areas.'),
              kind: texto('Que tipo de papel e: cartao, contrato, apolice, declaracao, certidao, fatura, recibo, exame.'),
              notes: texto('Qualquer coisa util que nao caiba nos outros campos.')
            }
          }
        },
        required: ['tipo', 'dados']
      }
    }
  },
  required: ['destinos']
};

const SISTEMA = [
  'Es o classificador da caixa de entrada do Farol, um gestor pessoal e familiar portugues.',
  'Recebes um ficheiro que alguem guardou sem decidir o que era. Diz o que e.',
  '',
  'Destinos possiveis:',
  '- despesa: talao, fatura, recibo, extrato. Preenche description, amount, spent_on, merchant.',
  '- documento: contrato, apolice, cartao, certidao, exame, declaracao. Preenche',
  '  name, entity, kind, issued_on e, se existir, valid_on.',
  '- evento: convocatoria, marcacao, convite com data. Preenche title, day, at.',
  '- tarefa: algo que obriga a agir, como um pedido ou uma renovacao.',
  '- pagamento: dinheiro que ainda tem de sair - fatura por pagar, aviso de',
  '  pagamento, prestacao, mensalidade. Preenche title, amount, due_on, payee e,',
  '  se o papel os trouxer, payment_ref (IBAN ou entidade e referencia).',
  '',
  'Um ficheiro pode ser mais do que um destino ao mesmo tempo. O talao de uma',
  'maquina de lavar e despesa e e documento de garantia.',
  '',
  'Despesa ou pagamento, a diferenca e o tempo: um talao ou um recibo e dinheiro',
  'que ja saiu - despesa. Uma fatura por pagar ou um aviso com prazo e dinheiro',
  'que ainda tem de sair - pagamento. Um recibo de algo que ja se pagou nao e',
  'pagamento; uma fatura por pagar nao e despesa.',
  '',
  'Regras:',
  '- Datas sempre AAAA-MM-DD. Valores em euros, como numero, com ponto decimal.',
  '- Num documento, as duas datas nao sao a mesma coisa e nao podem ser copiadas',
  '  uma para a outra: issued_on e o dia em que o documento foi feito (emitido,',
  '  assinado, passado); valid_on so existe se o papel disser ate quando vale.',
  '  Muitos documentos tem a primeira e nao tem a segunda - e normal.',
  '- A entidade e obrigatoria num documento: quem o emitiu, tal como vem escrito.',
  '  Sem entidade o documento fica por triar em vez de ser arrumado sozinho.',
  '- Portugues de Portugal, sem gerundio.',
  '- Recebes a lista de quem mora nesta casa. Se o ficheiro nomear uma pessoa',
  '  (o titular, o utente, o segurado, o destinatario) e ela estiver na lista,',
  '  poe em pessoa o nome tal como aparece na lista, nem mais nem menos.',
  '  E o que permite arrumar o ficheiro a quem pertence.',
  '- Se o nome que vem no ficheiro nao for de ninguem da lista, deixa pessoa de fora.',
  '- Nao inventes. Se um campo nao esta legivel no ficheiro, deixa-o de fora.',
  '  Um campo em falta custa ao utilizador cinco segundos a escrever; um campo',
  '  inventado passa despercebido e fica errado para sempre.',
  '- Marca confianca baixa quando estiveres a deduzir em vez de a ler.',
  '- Se nao perceberes o que e, devolve destinos vazio. Nao e falha nenhuma.'
].join('\n');

function suportado(mime) {
  return mime === 'application/pdf' || mime === 'text/plain' || IMAGENS.indexOf(mime) >= 0;
}

/**
 * Quem mora nesta casa. O modelo acerta muito mais quando escolhe de uma
 * lista do que quando copia o nome tal como vem escrito no papel: no papel
 * vem Ana Lucia Garcia, aqui dentro a pessoa chama-se Ana Lucia.
 */
/* As areas onde se arruma. Mesma logica dos nomes: escolher de uma lista
   curta acerta muito mais do que inventar um rotulo novo de cada vez. */
async function areasDaCasa() {
  try {
    const r = await query(
      `SELECT c.name, p.name AS pai FROM contexts c
         LEFT JOIN contexts p ON p.id = c.parent_id
        WHERE c.active ORDER BY COALESCE(p.sort, c.sort), c.sort`);
    return r.rows.map((c) => (c.pai ? c.pai + ' > ' + c.name : c.name));
  } catch (err) {
    console.warn('[farol] nao deu para ler as areas:', err.message);
    return [];
  }
}

async function nomesDaCasa() {
  try {
    const r = await query('SELECT name, full_name FROM people WHERE active ORDER BY sort');
    return r.rows.map((p) => (p.full_name && p.full_name !== p.name
      ? p.name + ' (tambem ' + p.full_name + ')'
      : p.name));
  } catch (err) {
    console.warn('[farol] nao deu para ler os nomes da casa:', err.message);
    return [];
  }
}

async function perguntar(buffer, mime, nome, modelo) {
  if (!suportado(mime)) throw new Error('tipo de ficheiro nao suportado pela analise');

  const parte = mime === 'application/pdf'
    ? { type: 'document', data: buffer.toString('base64'), mime_type: mime }
    : mime === 'text/plain'
      ? { type: 'text', text: buffer.toString('utf8').slice(0, 20000) }
      : { type: 'image', data: buffer.toString('base64'), mime_type: mime };

  const casa = await nomesDaCasa();
  const areas = await areasDaCasa();
  /* A regra vai tambem aqui, coladinha ao ficheiro: no prompt de sistema o
     modelo cumpre-a menos vezes do que quando a le logo antes de responder. */
  const contexto = ['Nome do ficheiro: ' + (nome || 'sem nome')]
    .concat(casa.length
      ? ['', 'Pessoas desta casa: ' + casa.join('; ') + '.',
         'Se o ficheiro for de uma delas, escreve em pessoa o nome curto tal como esta nesta lista.']
      : [])
    .concat(areas.length
      ? ['', 'Areas onde isto se pode arrumar: ' + areas.join('; ') + '.',
         'Escolhe uma e escreve-a em area tal como esta na lista. Prefere a',
         'mais precisa: se o papel e do carro, e Patrimonio > Carro, nao Patrimonio.']
      : [])
    .concat(['',
      'Antes de responder, se isto for um documento, confere quatro coisas:',
      '1. entity - quem o emitiu. Esta quase sempre no topo ou no rodape, no',
      '   cabecalho, no carimbo ou na assinatura. Procura antes de desistir.',
      '   Num documento de identificacao (cartao de cidadao, passaporte, carta',
      '   de conducao, cartao de utente) quem emite e o Estado ou o servico',
      '   impresso no proprio cartao - vem escrito la, muitas vezes so no',
      '   cabecalho, ao lado do brasao.',
      '2. issued_on - a data do proprio documento (emitido em, passado em,',
      '   Lisboa, 12 de marco de 2026, a data ao lado da assinatura). Ha',
      '   documentos que nao a tem - o cartao de cidadao portugues so traz a',
      '   validade. Nesse caso deixa issued_on de fora, sem inventar.',
      '3. valid_on - so se o papel disser ate quando vale (data de validade,',
      '   valido ate, expiry date). Se nao disser, deixa de fora; nao ponhas',
      '   aqui a data em que foi emitido.',
      '4. area - onde isto se arruma, escolhida da lista acima.',
      '',
      'Duas regras sobre o que escreves nos campos:',
      '- Um campo de data leva exactamente dez caracteres, AAAA-MM-DD, e mais',
      '  nada. Nunca lhe cole o nome do documento, a fonte, ou uma explicacao.',
      '  Se tiveres algo a dizer sobre a data, poe em notes.',
      '- O nome do ficheiro e uma pista fraca e mente muitas vezes. A pessoa, a',
      '  entidade e as datas saem do que esta escrito no documento. Se o nome',
      '  do ficheiro disser uma coisa e o documento outra, vale o documento; se',
      '  o documento nao nomear ninguem, deixa pessoa de fora em vez de a',
      '  adivinhar pelo nome do ficheiro.'])
    .join('\n');

  let r;
  try {
    r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    signal: AbortSignal.timeout(TEMPO_MAX),
    headers: { 'content-type': 'application/json', 'x-goog-api-key': CHAVE },
    body: JSON.stringify({
      model: modelo || MODELO,
      system_instruction: SISTEMA,
      store: false,
      input: [parte, { type: 'text', text: contexto }],
      response_format: { type: 'text', mime_type: 'application/json', schema: ESQUEMA }
    })
    });
  } catch (err) {
    /* Tempo esgotado conta como ocupado, nao como ficheiro ilegivel. */
    if (err && /Timeout|Abort/.test(String(err.name) + String(err.message))) {
      const e = new Error('o modelo demorou demasiado a responder');
      e.transitorio = true;
      throw e;
    }
    throw err;
  }

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    const bruto = t.replace(/\s+/g, ' ').slice(0, 220);
    /* Ha dois 429 diferentes e so um deles vale a pena insistir: o limite por
       minuto passa, o limite do dia so passa amanha. */
    const porDia = r.status === 429 && /per day|por dia/i.test(bruto);
    const e = new Error(porDia
      ? 'o plano gratuito do Gemini esgotou os pedidos de hoje'
      : 'API ' + r.status + ' ' + bruto);
    e.transitorio = !porDia && (r.status === 429 || r.status >= 500);
    throw e;
  }

  const j = await r.json();

  /* A resposta vem em passos; o texto e o que interessa. */
  let cru = '';
  (j.steps || []).forEach((passo) => {
    (passo.content || []).forEach((c) => {
      if (c && c.type === 'text' && c.text) cru += c.text;
    });
  });
  if (!cru && typeof j.output_text === 'string') cru = j.output_text;
  if (!cru) throw new Error('resposta sem proposta');

  let proposta;
  try { proposta = JSON.parse(cru); }
  catch (e) { throw new Error('proposta ilegivel'); }

  const uso = j.usage || j.usageMetadata || {};
  return Object.assign({}, proposta, {
    modelo: modelo || MODELO,
    tokens: {
      entrada: uso.input_tokens || uso.promptTokenCount,
      saida: uso.output_tokens || uso.candidatesTokenCount
    }
  });
}

/**
 * Insiste. O 503 do escalao gratuito e passageiro, por isso nao pode ser
 * tratado como ficheiro ilegivel: tres tentativas ao mesmo modelo, com
 * pausas maiores de cada vez, e so depois o modelo seguinte da lista.
 */
async function insistir(buffer, mime, nome) {
  let ultimo = new Error('nao houve resposta do modelo');
  for (const modelo of MODELOS) {
    for (let i = 0; i < ESPERAS.length; i++) {
      try {
        return await perguntar(buffer, mime, nome, modelo);
      } catch (err) {
        ultimo = err;
        if (!err.transitorio) break;
        console.warn('[farol]', modelo, 'ocupado:', err.message);
        if (i < ESPERAS.length - 1) await dormir(ESPERAS[i]);
      }
    }
  }
  throw ultimo;
}

/**
 * Analisa e guarda a proposta. Nunca lanca: a analise e um extra, e falhar
 * nao pode estragar um upload que ja correu bem.
 */
async function analisarItem(id, buffer, mime, nome) {
  if (!ativa() || !buffer) return null;
  if (buffer.length > MAX_BYTES) {
    await query("UPDATE inbox_items SET ai_status = 'falhou', ai_erro = $2, ai_at = now() WHERE id = $1",
      [id, 'ficheiro grande demais para analisar']).catch(() => {});
    return null;
  }
  try {
    const proposta = await insistir(buffer, mime, nome);
    await query(
      "UPDATE inbox_items SET ai_status = 'feito', ai_json = $2, ai_erro = NULL, ai_at = now() WHERE id = $1",
      [id, JSON.stringify(proposta)]);
    console.log('[farol] item', id, 'analisado:', (proposta.destinos || []).map((d) => d.tipo).join(', ') || 'nada');
    return proposta;
  } catch (err) {
    console.warn('[farol] analise do item', id, 'falhou:', err.message);
    await query("UPDATE inbox_items SET ai_status = 'falhou', ai_erro = $2, ai_at = now() WHERE id = $1",
      [id, String(err.message).slice(0, 300)]).catch(() => {});
    return null;
  }
}

module.exports = { ativa, analisarItem, MODELO };
