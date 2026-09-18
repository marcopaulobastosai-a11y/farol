'use strict';
/**
 * Farol - proposta automatica para a Caixa de entrada.
 *
 * O modelo le o ficheiro e propoe o que ele e. PROPOE: nunca grava nada nas
 * tabelas de tarefas, eventos, documentos ou despesas. A proposta fica em
 * inbox_items.ai_json e so se torna real quando alguem carrega em Catalogar.
 *
 * Corre no Gemini, do Google, porque tem escalao gratuito e chega de sobra
 * para o volume de uma casa. Sem GEMINI_API_KEY o modulo desliga-se sozinho e
 * a Caixa funciona na mesma, so sem sugestoes.
 */
const { query } = require('./db');

const CHAVE = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const MODELO = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ativa = () => Boolean(CHAVE);

const IMAGENS = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
// Limite pratico do corpo do pedido. Acima disto nem vale a pena tentar.
const MAX_BYTES = 6 * 1024 * 1024;

const texto = (d) => ({ type: 'STRING', description: d });

/**
 * Esquema fixo em vez de pedir JSON em texto: assim a resposta nao pode vir
 * malformada nem embrulhada em conversa.
 */
const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    resumo: texto('Uma linha a dizer o que e o ficheiro.'),
    destinos: {
      type: 'ARRAY',
      description: 'Um ou mais destinos. Vazio se nao for possivel perceber.',
      items: {
        type: 'OBJECT',
        properties: {
          tipo: { type: 'STRING', enum: ['tarefa', 'evento', 'documento', 'despesa'] },
          confianca: { type: 'STRING', enum: ['alta', 'media', 'baixa'] },
          dados: {
            type: 'OBJECT',
            properties: {
              title: texto('Titulo da tarefa ou do evento.'),
              name: texto('Nome do documento.'),
              description: texto('Descricao da despesa.'),
              amount: { type: 'NUMBER', description: 'Valor total em euros.' },
              spent_on: texto('Data da despesa, AAAA-MM-DD.'),
              merchant: texto('Estabelecimento ou entidade que cobrou.'),
              day: texto('Dia do evento, AAAA-MM-DD.'),
              at: texto('Hora do evento, HH:MM.'),
              due_on: texto('Prazo da tarefa, AAAA-MM-DD.'),
              entity: texto('Entidade emissora do documento.'),
              valid_on: texto('Data de validade, AAAA-MM-DD.'),
              pessoa: texto('Nome da pessoa da casa a quem o ficheiro diz respeito, se estiver escrito nele.'),
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
  '- Se o ficheiro nomear uma pessoa (o titular, o utente, o segurado), poe esse',
  '  nome em pessoa. E o que permite arrumar o documento a quem pertence.',
  '- Nao inventes. Se um campo nao esta legivel no ficheiro, deixa-o de fora.',
  '  Um campo em falta custa ao utilizador cinco segundos a escrever; um campo',
  '  inventado passa despercebido e fica errado para sempre.',
  '- Marca confianca baixa quando estiveres a deduzir em vez de a ler.',
  '- Se nao perceberes o que e, devolve destinos vazio. Nao e falha nenhuma.'
].join('\n');

function suportado(mime) {
  return mime === 'application/pdf' || mime === 'text/plain' || IMAGENS.indexOf(mime) >= 0;
}

async function perguntar(buffer, mime, nome) {
  if (!suportado(mime)) throw new Error('tipo de ficheiro nao suportado pela analise');

  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(MODELO) + ':generateContent',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': CHAVE },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SISTEMA }] },
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: mime, data: buffer.toString('base64') } },
            { text: 'Nome do ficheiro: ' + (nome || 'sem nome') }
          ]
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: ESQUEMA
        }
      })
    }
  );

  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error('API ' + r.status + ' ' + t.slice(0, 200));
  }

  const j = await r.json();
  const c = (j.candidates || [])[0];
  const partes = (c && c.content && c.content.parts) || [];
  const cru = partes.map((p) => p.text).filter(Boolean).join('');
  if (!cru) throw new Error('resposta sem proposta' + (c && c.finishReason ? ' (' + c.finishReason + ')' : ''));

  let proposta;
  try { proposta = JSON.parse(cru); }
  catch (e) { throw new Error('proposta ilegivel'); }

  const uso = j.usageMetadata || {};
  return Object.assign({}, proposta, {
    modelo: MODELO,
    tokens: { entrada: uso.promptTokenCount, saida: uso.candidatesTokenCount }
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

module.exports = { ativa, analisarItem, MODELO };
