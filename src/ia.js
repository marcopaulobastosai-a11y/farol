'use strict';
/**
 * Farol - proposta automatica para a Caixa de entrada.
 *
 * O modelo le o ficheiro e propoe o que ele e. PROPOE: nunca grava nada nas
 * tabelas de tarefas, eventos, documentos ou despesas. A proposta fica em
 * inbox_items.ai_json e so se torna real quando alguem carrega em Catalogar.
 *
 * Sem ANTHROPIC_API_KEY o modulo desliga-se sozinho e a Inbox funciona na
 * mesma, so sem sugestoes.
 */
const { query } = require('./db');

const CHAVE = process.env.ANTHROPIC_API_KEY;
const MODELO = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const ativa = () => Boolean(CHAVE);

const IMAGENS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// Limite pratico do corpo do pedido. Acima disto nem vale a pena tentar.
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Uma ferramenta com esquema fixo em vez de pedir JSON em texto: assim a
 * resposta nao pode vir malformada nem embrulhada em conversa.
 */
const FERRAMENTA = {
  name: 'catalogar',
  description: 'Classifica um ficheiro da caixa de entrada de um gestor pessoal e familiar.',
  input_schema: {
    type: 'object',
    properties: {
      resumo: { type: 'string', description: 'Uma linha a dizer o que e o ficheiro.' },
      destinos: {
        type: 'array',
        description: 'Um ou mais destinos. Vazio se nao for possivel perceber.',
        items: {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: ['tarefa', 'evento', 'documento', 'despesa'] },
            confianca: { type: 'string', enum: ['alta', 'media', 'baixa'] },
            dados: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Titulo da tarefa ou do evento.' },
                name: { type: 'string', description: 'Nome do documento.' },
                description: { type: 'string', description: 'Descricao da despesa.' },
                amount: { type: 'number', description: 'Valor total em euros.' },
                spent_on: { type: 'string', description: 'Data da despesa, AAAA-MM-DD.' },
                merchant: { type: 'string', description: 'Estabelecimento ou entidade que cobrou.' },
                day: { type: 'string', description: 'Dia do evento, AAAA-MM-DD.' },
                at: { type: 'string', description: 'Hora do evento, HH:MM.' },
                due_on: { type: 'string', description: 'Prazo da tarefa, AAAA-MM-DD.' },
                entity: { type: 'string', description: 'Entidade emissora do documento.' },
                valid_on: { type: 'string', description: 'Data de validade, AAAA-MM-DD.' },
                notes: { type: 'string' }
              }
            }
          },
          required: ['tipo', 'dados']
        }
      }
    },
    required: ['destinos']
  }
};

const SISTEMA = [
  'Es o classificador da caixa de entrada do Farol, um gestor pessoal e familiar portugues.',
  'Recebes um ficheiro que alguem guardou sem decidir o que era. Diz o que e.',
  '',
  'Destinos possiveis:',
  '- despesa: talao, fatura, recibo, extrato. Preenche description, amount, spent_on, merchant.',
  '- documento: contrato, apolice, cartao, certidao, exame. Preenche name, entity, valid_on.',
  '- evento: convocatoria, marcacao, convite com data. Preenche title, day, at.',
  '- tarefa: algo que obriga a agir, como um aviso de pagamento ou de renovacao.',
  '',
  'Um ficheiro pode ser mais do que um destino ao mesmo tempo. O talao de uma',
  'maquina de lavar e despesa e e documento de garantia; um aviso de pagamento',
  'e despesa e e tarefa com prazo.',
  '',
  'Regras:',
  '- Datas sempre AAAA-MM-DD. Valores em euros, como numero, com ponto decimal.',
  '- Portugues de Portugal, sem gerundio.',
  '- Nao inventes. Se um campo nao esta legivel no ficheiro, deixa-o de fora.',
  '  Um campo em falta custa ao utilizador cinco segundos a escrever; um campo',
  '  inventado passa despercebido e fica errado para sempre.',
  '- Marca confianca baixa quando estiveres a deduzir em vez de a ler.',
  '- Se nao perceberes o que e, devolve destinos vazio. Nao e falha nenhuma.'
].join('\n');

function bloco(buffer, mime) {
  const dados = buffer.toString('base64');
  if (mime === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: dados } };
  }
  if (IMAGENS.indexOf(mime) >= 0) {
    return { type: 'image', source: { type: 'base64', media_type: mime, data: dados } };
  }
  return null;
}

async function perguntar(buffer, mime, nome) {
  const conteudo = bloco(buffer, mime);
  if (!conteudo) throw new Error('tipo de ficheiro nao suportado pela analise');

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': CHAVE,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODELO,
      max_tokens: 1024,
      system: SISTEMA,
      tools: [FERRAMENTA],
      tool_choice: { type: 'tool', name: 'catalogar' },
      messages: [{
        role: 'user',
        content: [conteudo, { type: 'text', text: 'Nome do ficheiro: ' + (nome || 'sem nome') }]
      }]
    })
  });

  if (!r.ok) {
    const texto = await r.text().catch(() => '');
    throw new Error('API ' + r.status + ' ' + texto.slice(0, 200));
  }
  const j = await r.json();
  const uso = j.usage || {};
  const bloco_tool = (j.content || []).filter((c) => c.type === 'tool_use')[0];
  if (!bloco_tool) throw new Error('resposta sem proposta');
  return Object.assign({}, bloco_tool.input, {
    modelo: MODELO,
    tokens: { entrada: uso.input_tokens, saida: uso.output_tokens }
  });
}

/**
 * Analisa e guarda a proposta. Nunca lanca: a analise e um extra, e falhar
 * nao pode estragar um upload que ja correu bem.
 */
async function analisarItem(id, buffer, mime, nome) {
  if (!ativa() || !buffer) return;
  if (buffer.length > MAX_BYTES) {
    await query("UPDATE inbox_items SET ai_status = 'falhou', ai_erro = $2, ai_at = now() WHERE id = $1",
      [id, 'ficheiro grande demais para analisar']).catch(() => {});
    return;
  }
  try {
    const proposta = await perguntar(buffer, mime, nome);
    await query(
      "UPDATE inbox_items SET ai_status = 'feito', ai_json = $2, ai_erro = NULL, ai_at = now() WHERE id = $1",
      [id, JSON.stringify(proposta)]);
    console.log('[farol] item', id, 'analisado:', (proposta.destinos || []).map((d) => d.tipo).join(', ') || 'nada');
  } catch (err) {
    console.warn('[farol] analise do item', id, 'falhou:', err.message);
    await query("UPDATE inbox_items SET ai_status = 'falhou', ai_erro = $2, ai_at = now() WHERE id = $1",
      [id, String(err.message).slice(0, 300)]).catch(() => {});
  }
}

module.exports = { ativa, analisarItem };
