'use strict';
/**
 * Farol — Inbox (caixa de entrada)
 *
 * Captura sem decidir: entra um ficheiro ou uma nota, fica «por triar» até
 * alguém dizer o que é. A triagem transforma o item em tarefa, evento,
 * documento ou despesa — podendo ser mais do que um ao mesmo tempo.
 *
 * Dois buckets:
 *   farol-inbox    — o que ainda não foi triado. Volátil por natureza.
 *   farol-arquivo  — o que já foi catalogado e passou a valer alguma coisa.
 * A coluna inbox_items.store diz onde está o objecto neste momento.
 *
 * Tudo vive debaixo de /api, que é onde o auth.js instala o guarda da sessão.
 * Um endpoint de ficheiro fora de /api ficaria aberto ao mundo.
 */
const crypto = require('crypto');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { query } = require('./db');
const ia = require('./ia');
const pdf = require('./pdf');
const { PAPEIS, pagar } = require('./tarefas');

const all = async (sql, params) => (await query(sql, params)).rows;
const limpar = (v) => (v === undefined || v === '' ? null : v);

const MAX_BYTES = 25 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });

/* comprovativo (26 set): a prova de que um pagamento ja foi feito - uma
   transferencia, um talao de multibanco, um MB Way. Nao cria dinheiro novo:
   agarra-se ao pagamento (ou pagamentos) que prova. */
const TIPOS = ['tarefa', 'pagamento', 'evento', 'documento', 'despesa', 'comprovativo'];

/* ------------------------------------------------------------------ *
 * Buckets
 * ------------------------------------------------------------------ */
function config(prefixo) {
  return {
    bucket: process.env[prefixo + '_BUCKET_NAME'],
    endpoint: process.env[prefixo + '_BUCKET_ENDPOINT'],
    region: process.env[prefixo + '_BUCKET_REGION'] || 'auto',
    keyId: process.env[prefixo + '_BUCKET_KEY_ID'],
    secret: process.env[prefixo + '_BUCKET_SECRET']
  };
}

const CFG = { inbox: config('INBOX'), arquivo: config('ARQUIVO') };
const clientes = {};

const pronto = (qual) => {
  const c = CFG[qual];
  return Boolean(c && c.bucket && c.endpoint && c.keyId && c.secret);
};
const bucketPronto = () => pronto('inbox');

function cliente(qual) {
  if (!clientes[qual]) {
    const c = CFG[qual];
    clientes[qual] = new S3Client({
      region: c.region,
      endpoint: c.endpoint,
      // Os buckets do Railway usam URLs virtual-hosted (o nome do bucket vai
      // no subdomínio). Forçar path-style aqui partia todos os pedidos.
      credentials: { accessKeyId: c.keyId, secretAccessKey: c.secret }
    });
  }
  return clientes[qual];
}

// Nunca usar o nome original no caminho: evita colisões e evita ter dados
// pessoais escritos na chave do objecto.
function caminho(nomeOriginal) {
  const d = new Date();
  const ext = (nomeOriginal || '').includes('.')
    ? '.' + nomeOriginal.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    : '';
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'),
    crypto.randomUUID() + ext].join('/');
}

async function guardar(qual, chave, buffer, mime) {
  await cliente(qual).send(new PutObjectCommand({
    Bucket: CFG[qual].bucket, Key: chave, Body: buffer, ContentType: mime || 'application/octet-stream'
  }));
}

async function ler(qual, chave) {
  return cliente(qual).send(new GetObjectCommand({ Bucket: CFG[qual].bucket, Key: chave }));
}

async function apagar(qual, chave) {
  await cliente(qual).send(new DeleteObjectCommand({ Bucket: CFG[qual].bucket, Key: chave }));
}

const bytes = async (stream) => {
  const partes = [];
  for await (const p of stream) partes.push(p);
  return Buffer.concat(partes);
};

/**
 * Passa o objecto do bucket temporário para o de arquivo.
 *
 * Não uso CopyObject: cada bucket tem credenciais próprias e a cópia
 * servidor-a-servidor precisaria que uma delas visse os dois. Lê e volta a
 * escrever, que com ficheiros até 25 MB é irrelevante.
 */
async function arquivar(chave, mime) {
  if (!pronto('arquivo')) return false;
  const obj = await ler('inbox', chave);
  await guardar('arquivo', chave, await bytes(obj.Body), mime);
  await apagar('inbox', chave).catch((e) => console.warn('[farol] temporário não limpo:', e.message));
  return true;
}

/* ------------------------------------------------------------------ *
 * Triagem — cada destino sabe criar-se a si próprio
 * ------------------------------------------------------------------ */
/* O modelo devolve datas com cauda: «2031-08-03Portal do Cidadao / Cartao...».
   Uma coluna DATE rejeita isso e a catalogacao morre calada. Fica so a data
   se ela estiver la ao principio; se nao estiver, fica vazio. */
function soData(v) {
  const m = /^\s*(\d{4}-\d{2}-\d{2})/.exec(String(v == null ? '' : v));
  return m ? m[1] : null;
}

/* As notas de uma tarefa ou de um pagamento sao o que se le quando se vai
   tratar do assunto, sem o papel a frente. O que a leitura escreveu fica como
   esta; a seguir juntam-se as linhas que faltem com o que ficou nos campos -
   entidade, referencia, montante, prazo - para nunca ser preciso abrir o PDF
   so para saber o IBAN. */
function euros(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2).replace('.', ',') + ' \u20ac' : null;
}
function dataPt(v) {
  const d = soData(v);
  return d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : null;
}
function notasCompletas(d, tipo) {
  const base = String(d.notes || '').trim();
  const tem = (x) => x && semAcentos(base).indexOf(semAcentos(String(x))) >= 0;
  const quanto = d.amount === undefined || d.amount === null || d.amount === '' ? null : euros(d.amount);
  const quem = d.payee || d.merchant || d.entity || null;
  const ref = d.payment_ref || null;
  const prazo = dataPt(d.due_on);
  const linhas = [];
  let prazoDito = false;
  if (!base && tipo === 'pagamento') {
    linhas.push('O que fazer: pagar' + (prazo ? ' at\u00e9 ' + prazo : '') + '.');
    prazoDito = Boolean(prazo);
  }
  if (quem && !tem(quem)) linhas.push('Entidade: ' + quem);
  if (ref && !tem(ref)) linhas.push('Refer\u00eancia: ' + ref);
  if (quanto && !tem(quanto) && !tem(String(d.amount))) linhas.push('Montante: ' + quanto);
  if (prazo && !prazoDito && !tem(prazo) && !tem(soData(d.due_on))) linhas.push('Prazo: ' + prazo);
  const tudo = [base].concat(linhas).filter(Boolean).join('\n').trim();
  return tudo || null;
}

/* ---------------- o pagamento que ja existe ---------------- */
/* Palavras que aparecem em todas as faturas e nao dizem de quem sao. */
const PALAVRAS_VAZIAS = ['fatura', 'factura', 'recibo', 'pagamento', 'pagamentos', 'aviso', 'servicos',
  'servico', 'comunicacoes', 'multimedia', 'portugal', 'lda', 'unipessoal', 'sociedade', 'empresa',
  'referente', 'mensalidade', 'prestacao', 'the', 'de', 'da', 'do', 'das', 'dos', 'para', 'com', 'sem',
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro',
  'novembro', 'dezembro', 'mes', 'ano', 'comercial', 'geral', 'nacional', 'grupo', 'companhia',
  'pagar', 'valor', 'total', 'conta', 'numero', 'referencia', 'entidade', 'iva', 'euros', 'eur'];

function palavrasDe(txt) {
  return semAcentos(txt).split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w) && PALAVRAS_VAZIAS.indexOf(w) < 0);
}

/* Raiz de uma palavra, para «contabilidade» e «contabilista» contarem como a
   mesma coisa: as primeiras seis letras chegam para o portugues de uma fatura. */
function raiz(w) { return w.length > 6 ? w.slice(0, 6) : w; }

/* Palavras do nome que dizem do que se trata (quatro letras ou mais, sem as
   vazias), ja reduzidas a raiz. */
function raizesDe(txt) {
  const vistas = {};
  return palavrasDe(txt).filter((w) => w.length >= 4).map(raiz)
    .filter((r) => (vistas[r] ? false : (vistas[r] = true)));
}

/* O valor de um pagamento: o do campo, ou o que estiver escrito no titulo
   («Avenca de Contabilista — 321,03€»), que e como vinham do TickTick. */
function valorDe(t) {
  if (t.amount !== null && t.amount !== undefined) return Number(t.amount);
  const m = /(\d{1,6}(?:[.\s]\d{3})*[.,]\d{2})\s*(?:€|eur)/i.exec(String(t.title || ''));
  return m ? Number(m[1].replace(/[.\s](?=\d{3}\b)/g, '').replace(',', '.')) : null;
}

/* Procura um pagamento por pagar que seja desta mesma coisa. Cada pista vale
   pontos e e preciso somar pelo menos 5, com pelo menos uma pista de nome:
   - a mesma entidade de multibanco ............................ 4
   - o nome de quem cobra aparece no pagamento ................. 3
   - cada raiz do titulo em comum («avenca», «contab») ......... 2 (ate 6)
   - o mesmo valor (do campo ou escrito no titulo) ............. 3
   - prazo a 35 dias ou menos do da fatura ..................... 2
   Um prazo a mais de 35 dias exclui (e outra ocorrencia). Sem prazo num dos
   lados, so conta se o valor for o mesmo. Um pagamento que ja tem a sua
   fatura e de outro mes: fica de fora. Ganha quem somar mais; em empate, o
   de prazo mais proximo. Caso real (26 set): «Avenca contabilidade agosto
   2026 - Cesto de Numeros» contra «Pagamento Avenca de Contabilista —
   321,03€»: duas raizes (4) + valor (3) + prazo a 24 dias (2) = 9. */
async function pontuarPagamentos(d) {
  const quem = d.payee || d.merchant || d.entity || '';
  const nomes = palavrasDe(quem);
  const raizes = raizesDe(d.title || d.description || '');
  const ent = (/entidade\D{0,6}(\d{5})/i.exec(String(d.payment_ref || '')) || [])[1] || null;
  const valor = d.amount === undefined || d.amount === null || d.amount === '' ? null : Number(d.amount);
  const prazo = soData(d.due_on);
  const linhas = await all(
    `SELECT t.id, t.title, t.payee, t.payment_ref, t.amount::float AS amount,
            to_char(t.due_on, 'YYYY-MM-DD') AS due_on
       FROM tasks t
      WHERE t.tipo = 'pagamento' AND t.origin = 'real' AND NOT t.done
        AND t.status NOT IN ('concluida', 'cancelada')
        AND NOT EXISTS (SELECT 1 FROM task_documents td
                         WHERE td.task_id = t.id AND td.papel = 'fatura')`);
  const todos = linhas.map((t) => {
    const texto = semAcentos([t.title, t.payee, t.payment_ref].filter(Boolean).join(' '));
    const delas = raizesDe([t.title, t.payee].filter(Boolean).join(' '));
    let pontos = 0, nome = false;
    if (ent && texto.indexOf(ent) >= 0) { pontos += 4; nome = true; }
    if (nomes.some((k) => new RegExp('(^|[^a-z0-9])' + k + '([^a-z0-9]|$)').test(texto))) { pontos += 3; nome = true; }
    const comuns = raizes.filter((x) => delas.indexOf(x) >= 0).length;
    if (comuns) { pontos += Math.min(comuns, 3) * 2; nome = true; }
    const dele = valorDe(t);
    const mesmoValor = valor !== null && dele !== null && Math.abs(valor - dele) < 0.01;
    if (mesmoValor) pontos += 3;
    let distancia = 999, datasOk = true;
    if (prazo && t.due_on) {
      distancia = Math.abs((new Date(prazo) - new Date(t.due_on)) / 86400000);
      if (distancia > 35) datasOk = false; else pontos += 2;
    } else if (!mesmoValor) {
      datasOk = false;
    }
    return { id: t.id, title: t.title, amount: dele, due_on: t.due_on, pontos, distancia,
             serve: nome && datasOk && pontos >= 5 };
  });
  todos.sort((a, b) => (b.pontos - a.pontos) || (a.distancia - b.distancia) || (a.id - b.id));
  return todos;
}

async function pagamentoExistente(d) {
  const quem = d.payee || d.merchant || d.entity || '';
  if (!palavrasDe(quem).length && !raizesDe(d.title || d.description || '').length &&
      !/entidade\D{0,6}\d{5}/i.test(String(d.payment_ref || ''))) return null;
  return (await pontuarPagamentos(d)).filter((t) => t.serve)[0] || null;
}

/* A fatura manda sobre o que ja la estava: valor, referencia e prazo desta
   ocorrencia sao os que vem nela. O que o pagamento ja tinha e a fatura nao
   diz, fica. As notas ganham um bloco com o que veio na fatura. */
/* ---------------- o comprovativo ---------------- */
/* Numeros de fatura, de recibo ou de documento: tres algarismos ou mais, sem
   os montantes («321,03») e sem os anos. «FT CN_603» e «FT CN603» dao os dois
   603, que e o que se compara. */
function numerosDe(txt) {
  const s = semAcentos(txt).replace(/\d+[.,]\d{2}(?!\d)/g, ' ');
  const out = [];
  (s.match(/\d{3,}/g) || []).forEach((n) => {
    const m = n.replace(/^0+/, '');
    if (m.length < 3 || /^(19|20)\d\d$/.test(m) || out.indexOf(m) >= 0) return;
    out.push(m);
  });
  return out;
}

function numero(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/* Os pagamentos que um comprovativo pode provar: os que estao por pagar e os
   que ja foram pagos sem prova nenhuma agarrada (a lista «pagos sem prova»).
   Pistas e pontos, como na fatura, mais a mais forte de todas:
   - o numero de uma fatura do comprovativo aparece no pagamento, no nome de
     um papel dele ou no ficheiro que lhe deu a fatura ................ 6
   - o nome de quem recebeu aparece no pagamento ...................... 3
   - cada raiz do titulo em comum ..................................... 2 (ate 6)
   - o mesmo valor .................................................... 3
   - prazo (ou data em que se pagou) a 45 dias ou menos ................ 2
   A mais de 60 dias so passa com o numero da fatura. */
/* ignorar: o proprio comprovativo ({ doc, item }), para ele nao contar como
   pista nem tirar da lista os pagamentos a que ja esta agarrado. */
async function pontuarComprovativo(d, ignorar) {
  const fora = ignorar || {};
  const nums = numerosDe([d.faturas, d.title, d.description].filter(Boolean).join(' '));
  const nomes = palavrasDe(d.payee || d.merchant || d.entity || '');
  const raizes = raizesDe([d.title, d.description, d.faturas].filter(Boolean).join(' '));
  const valor = numero(d.amount);
  const quando = soData(d.paid_on) || soData(d.spent_on) || soData(d.issued_on);
  const linhas = await all(
    `SELECT t.id, t.title, t.payee, t.notes, t.amount::float AS amount,
            to_char(t.due_on, 'YYYY-MM-DD') AS due_on, to_char(t.paid_on, 'YYYY-MM-DD') AS paid_on,
            (SELECT string_agg(x.txt, ' ') FROM (
                SELECT dc.name AS txt FROM task_documents td JOIN documents dc ON dc.id = td.document_id
                 WHERE td.task_id = t.id AND td.document_id <> $1
                UNION ALL
                SELECT concat_ws(' ', i.title, i.file_name) FROM inbox_links l JOIN inbox_items i ON i.id = l.inbox_id
                 WHERE l.target_type = 'pagamento' AND l.target_id = t.id AND l.inbox_id <> $2) x) AS papeis
       FROM tasks t
      WHERE t.tipo = 'pagamento' AND t.origin = 'real' AND t.status <> 'cancelada'
        AND ((NOT t.done AND t.paid_on IS NULL) OR t.paid_on >= CURRENT_DATE - INTERVAL '18 months')
        AND NOT EXISTS (SELECT 1 FROM task_documents td
                         WHERE td.task_id = t.id AND td.papel IN ('comprovativo', 'recibo')
                           AND td.document_id <> $1)`, [Number(fora.doc) || 0, Number(fora.item) || 0]);
  const todos = linhas.map((t) => {
    const texto = semAcentos([t.title, t.payee].filter(Boolean).join(' '));
    /* O numero no papel da fatura (o ficheiro, o documento) vale mais do que
       o numero nas notas: as notas de um recorrente guardam o numero de uma
       fatura antiga (a avenca tinha «FT CN/537» nas notas e a fatura de
       agosto e a CN603). */
    const dosPapeis = numerosDe(t.papeis || '');
    const dasNotas = numerosDe([t.title, t.notes].filter(Boolean).join(' '));
    const fortes = nums.filter((n) => dosPapeis.indexOf(n) >= 0);
    const faturas = nums.filter((n) => fortes.indexOf(n) >= 0 || dasNotas.indexOf(n) >= 0);
    let pontos = 0, nome = false;
    if (faturas.length) pontos += 6;
    if (nomes.some((k) => new RegExp('(^|[^a-z0-9])' + k + '([^a-z0-9]|$)').test(texto))) { pontos += 3; nome = true; }
    const delas = raizesDe([t.title, t.payee].filter(Boolean).join(' '));
    const comuns = raizes.filter((x) => delas.indexOf(x) >= 0).length;
    if (comuns) { pontos += Math.min(comuns, 3) * 2; nome = true; }
    const dele = valorDe(t);
    if (valor !== null && dele !== null && Math.abs(valor - dele) < 0.01) pontos += 3;
    const ref = t.paid_on || t.due_on;
    let distancia = 999, datasOk = true;
    if (quando && ref) {
      distancia = Math.abs((new Date(quando) - new Date(ref)) / 86400000);
      if (distancia > 60) datasOk = false; else if (distancia <= 45) pontos += 2;
    }
    return { id: t.id, title: t.title, amount: dele, due_on: t.due_on, paid_on: t.paid_on,
             pago: Boolean(t.paid_on), faturas, fortes, pontos, distancia,
             serve: faturas.length > 0 || (nome && datasOk && pontos >= 5) };
  });
  todos.sort((a, b) => (b.pontos - a.pontos) || (a.distancia - b.distancia) || (a.id - b.id));
  return { todos, nums, valor };
}

/* Quais sao, de facto. Um comprovativo pode pagar varias faturas de uma vez
   (caso real, 26 set: 642,06 EUR = FT CN537 + FT CN603, duas avencas de
   321,03). Por ordem:
   1. um pagamento por cada numero de fatura que se encontre;
   2. um so pagamento com o mesmo valor;
   3. dois a quatro que somem exactamente o valor;
   4. sem valor lido, o melhor que sirva.
   O que ficar por encontrar (faturas e dinheiro) vai com a leitura, para o
   cartao o dizer e para se poder criar o pagamento que falta. */
/* Cada numero de fatura vai para um pagamento, e cada pagamento fica com um
   numero so: primeiro os que o tem no proprio papel, depois os que o tem so
   nas notas. */
function atribuirFaturas(nums, candidatos) {
  const porNumero = {};
  const usados = [];
  ['fortes', 'faturas'].forEach((campo) => {
    nums.forEach((n) => {
      if (porNumero[n]) return;
      const c = candidatos.find((t) => (t[campo] || []).indexOf(n) >= 0 && usados.indexOf(t) < 0);
      if (c) { porNumero[n] = c; usados.push(c); }
    });
  });
  return porNumero;
}

async function pagamentosDoComprovativo(d, ignorar) {
  const { todos, nums, valor } = await pontuarComprovativo(d, ignorar);
  const porNumero = atribuirFaturas(nums, todos);
  let escolhidos = [];
  Object.keys(porNumero).forEach((n) => {
    if (escolhidos.indexOf(porNumero[n]) < 0) escolhidos.push(porNumero[n]);
  });
  const bons = todos.filter((t) => t.serve);
  if (!escolhidos.length && valor !== null) {
    const igual = bons.find((t) => t.amount !== null && Math.abs(t.amount - valor) < 0.01);
    if (igual) escolhidos = [igual];
  }
  if (!escolhidos.length && valor !== null) {
    const pool = bons.filter((t) => t.amount !== null && t.amount > 0).slice(0, 12);
    const procura = (desde, falta, junto) => {
      if (Math.abs(falta) < 0.01 && junto.length >= 2) return junto;
      if (junto.length >= 4 || falta < 0) return null;
      for (let i = desde; i < pool.length; i++) {
        const r = procura(i + 1, falta - pool[i].amount, junto.concat([pool[i]]));
        if (r) return r;
      }
      return null;
    };
    escolhidos = procura(0, valor, []) || [];
  }
  if (!escolhidos.length && valor === null && bons[0]) escolhidos = [bons[0]];

  const faltam = nums.filter((n) => !porNumero[n]);
  const coberto = escolhidos.reduce((s, t) => s + (t.amount || 0), 0);
  const resto = valor !== null && escolhidos.length && valor - coberto > 0.01
    ? Math.round((valor - coberto) * 100) / 100 : null;
  return { escolhidos, faltam, resto, todos, valor };
}

/* O papel do comprovativo agarrado a um pagamento, e a ligacao da caixa a
   dizer que foi isso: e o que a aprovacao usa para o dar como pago. */
async function ligarComprovativo(inboxId, taskId, docId, d, parte) {
  const dados = { papel: 'comprovativo', paid_on: soData(d.paid_on) || soData(d.spent_on) || null,
    amount: parte, payment_method: metodoDe(d.payment_method) };
  await query(
    `INSERT INTO inbox_links (inbox_id, target_type, target_id, criado, dados)
     VALUES ($1,'pagamento',$2,FALSE,$3)
     ON CONFLICT (inbox_id, target_type, target_id) DO UPDATE SET dados = EXCLUDED.dados`,
    [inboxId, taskId, JSON.stringify(dados)]);
  if (docId) {
    await query(
      `INSERT INTO task_documents (task_id, document_id, papel) VALUES ($1,$2,'comprovativo')
       ON CONFLICT (task_id, document_id) DO UPDATE SET papel = 'comprovativo'`, [taskId, docId]);
  }
}

/* O metodo escreve-se como nas Tarefas, senao o filtro por metodo perde-o. */
function metodoDe(v) {
  const m = semAcentos(v);
  if (/mb ?way/.test(m)) return 'mb way';
  if (/debito direto|debito directo/.test(m)) return 'd\u00e9bito direto';
  if (/multibanco|\bmb\b|\batm\b/.test(m)) return 'multibanco';
  if (/cartao|card/.test(m)) return 'cart\u00e3o';
  if (/numerario|dinheiro/.test(m)) return 'numer\u00e1rio';
  if (/cheque/.test(m)) return 'cheque';
  return 'transfer\u00eancia';
}

/* Quanto deste comprovativo vai para cada pagamento: um so leva tudo; varios
   levam cada um o seu valor. */
function parteDe(escolhidos, t, valor, faltam) {
  if (escolhidos.length === 1 && valor !== null && !(faltam || []).length) return valor;
  return t.amount !== null && t.amount !== undefined ? t.amount : null;
}

async function juntarAoPagamento(taskId, d) {
  /* Como estava antes: e o que se repoe se a fatura sair daqui. */
  const antes = (await all(
    `SELECT amount::float AS amount, payment_ref, to_char(due_on, 'YYYY-MM-DD') AS due_on,
            payee, context_id, notes
       FROM tasks WHERE id = $1`, [taskId]))[0] || null;
  const valor = d.amount === undefined || d.amount === null || d.amount === '' ? null : Number(d.amount);
  const bloco = notasCompletas(d, 'pagamento');
  const hoje = new Date().toISOString().slice(0, 10);
  await query(
    `UPDATE tasks
        SET amount = COALESCE($2, amount),
            payment_ref = COALESCE($3, payment_ref),
            due_on = COALESCE($4::date, due_on),
            payee = COALESCE(payee, $5),
            context_id = COALESCE(context_id, $6),
            notes = NULLIF(btrim(COALESCE(notes, '') || CASE WHEN $7::text IS NULL THEN ''
                      ELSE E'\n\n' || $7::text END, E' \n'), ''),
            updated_at = now()
      WHERE id = $1`,
    [taskId, Number.isFinite(valor) ? valor : null, limpar(d.payment_ref), soData(d.due_on),
     limpar(d.payee || d.merchant || d.entity), limpar(d.context_id),
     bloco ? 'Fatura recebida a ' + dataPt(hoje) + ':\n' + bloco : null]);
  return antes;
}

/* Desfaz o que a fatura escreveu num pagamento que ja existia. */
async function reporPagamento(taskId, antes) {
  if (!antes) return;
  await query(
    `UPDATE tasks SET amount = $2, payment_ref = $3, due_on = $4::date, payee = $5,
                      context_id = $6, notes = $7, updated_at = now()
      WHERE id = $1`,
    [taskId, antes.amount, antes.payment_ref, antes.due_on, antes.payee, antes.context_id, antes.notes]);
}

const CRIAR = {
  async tarefa(d) {
    const title = String(d.title || '').trim();
    if (!title) throw new Error('A tarefa precisa de um título.');
    const rows = await all(
      `INSERT INTO tasks (title, notes, context_id, project_id, owner_id, status, priority,
                          starts_on, due_on, due_time, done, origin, scope)
       VALUES ($1,$2,$3,$4,$5,'aberta',$6,CURRENT_DATE,$7,$8,FALSE,'real',NULL) RETURNING id`,
      [title, notasCompletas(d, 'tarefa'), limpar(d.context_id), limpar(d.project_id), limpar(d.owner_id),
       d.priority || 'normal', limpar(d.due_on), limpar(d.due_time)]);
    for (const pid of d.subjects || []) {
      await query('INSERT INTO task_subjects (task_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [rows[0].id, Number(pid)]);
    }
    return rows[0].id;
  },

  /* Uma fatura por pagar nao e so uma despesa: e dinheiro que ainda tem de
     sair, com prazo e com prova no fim. Nasce aqui como pagamento, e o
     documento que lhe deu origem fica agarrado como fatura. */
  async pagamento(d) {
    const title = String(d.title || d.description || '').trim();
    if (!title) throw new Error('O pagamento precisa de um título.');
    const rows = await all(
      `INSERT INTO tasks (tipo, title, notes, context_id, project_id, owner_id, status, priority,
                          starts_on, due_on, amount, payee, payment_ref, done, origin, scope, aprovado)
       VALUES ('pagamento',$1,$2,$3,$4,$5,'aberta','normal',CURRENT_DATE,$6,$7,$8,$9,FALSE,'real',NULL,FALSE)
       RETURNING id`,
      [title, notasCompletas(d, 'pagamento'), limpar(d.context_id), limpar(d.project_id), limpar(d.owner_id),
       limpar(soData(d.due_on)), d.amount === undefined || d.amount === null || d.amount === '' ? null : Number(d.amount),
       limpar(d.payee || d.merchant || d.entity), limpar(d.payment_ref)]);
    for (const pid of d.subjects || []) {
      await query('INSERT INTO task_subjects (task_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [rows[0].id, Number(pid)]);
    }
    return rows[0].id;
  },

  async evento(d) {
    const title = String(d.title || '').trim();
    if (!title) throw new Error('O evento precisa de um título.');
    if (!d.day) throw new Error('O evento precisa de uma data.');
    // events.calendar é NOT NULL e aponta para calendars(code). Garantimos um
    // calendário próprio para o que é real, sem depender dos do seed.
    await query(
      `INSERT INTO calendars (code, name, color, sort) VALUES ('farol','Farol','var(--c1)',99)
       ON CONFLICT (code) DO NOTHING`);
    const rows = await all(
      `INSERT INTO events (day, at, title, calendar, detail, origin)
       VALUES ($1,$2,$3,$4,$5,'real') RETURNING id`,
      [d.day, limpar(d.at), title, d.calendar || 'farol', limpar(d.detail)]);
    /* De quem e o compromisso: e isto que o leva a ficha da pessoa. */
    const quem = [].concat(d.people || [], d.person_id ? [d.person_id] : []);
    for (const pid of quem) {
      await query('INSERT INTO event_people (event_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [rows[0].id, Number(pid)]);
    }
    return rows[0].id;
  },

  async documento(d) {
    const name = String(d.name || '').trim();
    if (!name) throw new Error('O documento precisa de um nome.');
    /* valid_until era o rotulo antigo, texto solto; fica igual ao valid_on para
       os ecras que ainda o leem. A data do documento tem coluna propria. */
    const rows = await all(
      `INSERT INTO documents (name, entity, kind, context_id, issued_on, valid_on,
                              valid_until, person_id, origin, aprovado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'real',FALSE) RETURNING id`,
      [name, limpar(d.entity), limpar(d.kind), limpar(d.context_id),
       soData(d.issued_on), soData(d.valid_on), soData(d.valid_on), limpar(d.person_id)]);
    return rows[0].id;
  },

  async despesa(d) {
    const description = String(d.description || '').trim();
    if (!description) throw new Error('A despesa precisa de uma descrição.');
    if (d.amount === undefined || d.amount === null || d.amount === '') {
      throw new Error('A despesa precisa de um valor.');
    }
    const rows = await all(
      `INSERT INTO expenses (description, amount, spent_on, merchant, category,
                             context_id, person_id, project_id, note, origin, aprovado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'real',FALSE) RETURNING id`,
      [description, Number(d.amount), soData(d.spent_on) || new Date(), limpar(d.merchant),
       limpar(d.category), limpar(d.context_id), limpar(d.person_id),
       limpar(d.project_id), limpar(d.note)]);
    return rows[0].id;
  }
};

/* O que precisa de uma aprovacao antes de aparecer nos ecras, e onde mora. */
/* O pagamento juntou-se a 26 set: dinheiro que vai sair tambem merece um
   segundo olhar antes de entrar nas Tarefas. */
const APROVAVEIS = { documento: 'documents', despesa: 'expenses', pagamento: 'tasks' };

/* O conteudo das linhas que nasceram destes ficheiros, para o cartao da caixa
   poder mostrar - e deixar corrigir - o que esta gravado. */
async function conteudoDosAlvos(ligacoes) {
  const fora = { documento: {}, despesa: {}, pagamento: {}, tarefa: {}, evento: {} };
  const ids = (tipo) => ligacoes.filter((l) => l.target_type === tipo).map((l) => l.target_id);

  const docs = ids('documento');
  if (docs.length) {
    const linhas = await all(
      `SELECT id, name, entity, kind, context_id, person_id, aprovado,
              to_char(issued_on, 'YYYY-MM-DD') AS issued_on,
              to_char(valid_on,  'YYYY-MM-DD') AS valid_on
         FROM documents WHERE id = ANY($1)`, [docs]);
    linhas.forEach((d) => { fora.documento[d.id] = d; });
  }

  const desp = ids('despesa');
  if (desp.length) {
    const linhas = await all(
      `SELECT id, description, amount::float AS amount, merchant, category,
              context_id, person_id, note, aprovado,
              to_char(spent_on, 'YYYY-MM-DD') AS spent_on
         FROM expenses WHERE id = ANY($1)`, [desp]);
    linhas.forEach((e) => { fora.despesa[e.id] = e; });
  }

  /* Pagamentos e tarefas vivem na mesma tabela. Sem isto o separador dos
     arrumados dizia «pagamento» e mais nada: nem quanto, nem ate quando. */
  const tar = ids('pagamento').concat(ids('tarefa'));
  if (tar.length) {
    const linhas = await all(
      `SELECT id, tipo, title, notes, amount::float AS amount, payee, payment_ref,
              context_id, owner_id, project_id, status, done,
              to_char(due_on, 'YYYY-MM-DD') AS due_on, to_char(paid_on, 'YYYY-MM-DD') AS paid_on
         FROM tasks WHERE id = ANY($1)`, [tar]);
    linhas.forEach((t) => { fora.pagamento[t.id] = t; fora.tarefa[t.id] = t; });
  }

  const evs = ids('evento');
  if (evs.length) {
    const linhas = await all(
      `SELECT e.id, e.title, e.at, e.context_id, to_char(e.day, 'YYYY-MM-DD') AS day,
              (SELECT p.person_id FROM event_people p WHERE p.event_id = e.id
                ORDER BY p.person_id LIMIT 1) AS person_id
         FROM events e WHERE e.id = ANY($1)`, [evs]);
    linhas.forEach((e) => { fora.evento[e.id] = e; });
  }
  return fora;
}

/* Desfazer uma catalogacao para a fazer outra vez. O ficheiro fica onde esta
   (no arquivo); o que se apaga e o que nasceu dele. Uma linha que tambem
   esteja agarrada a outro ficheiro da caixa nao se apaga - so se solta esta
   ligacao, porque o outro ficheiro continua a precisar dela. */
const TABELA_DO_ALVO = {
  documento: 'documents', despesa: 'expenses', pagamento: 'tasks', tarefa: 'tasks', evento: 'events'
};

async function descatalogar(id) {
  await query('BEGIN');
  try {
    const item = await all('SELECT id, status FROM inbox_items WHERE id = $1 FOR UPDATE', [id]);
    if (!item.length) throw new Error('Item não encontrado.');
    if (item[0].status !== 'catalogado') throw new Error('Este ficheiro ainda não foi catalogado.');
    const ligados = await all(
      'SELECT target_type, target_id, criado, antes FROM inbox_links WHERE inbox_id = $1', [id]);
    /* Um pagamento ja pago ou uma tarefa ja feita tem historia (a despesa que
       o pagamento escreveu, a data em que se fechou). Desfazer isso por aqui
       apagava-a em silencio: corrige-se nas Tarefas. */
    const tarefas = ligados.filter((l) => l.criado !== false &&
      (l.target_type === 'pagamento' || l.target_type === 'tarefa')).map((l) => l.target_id);
    if (tarefas.length) {
      const feitas = await all('SELECT 1 FROM tasks WHERE id = ANY($1) AND done LIMIT 1', [tarefas]);
      if (feitas.length) {
        throw new Error('Isto já foi pago ou feito. Corrige-o nas Tarefas, para não perder o que ficou registado.');
      }
    }
    const apagados = await apagarOQueNasceu(id, ligados);
    await query(
      "UPDATE inbox_items SET status = 'por_triar', resolved_at = NULL, approved_at = NULL WHERE id = $1",
      [id]);
    await query('COMMIT');
    console.log('[farol] item', id, 'volta a por triar; apagado:', apagados.join(', ') || 'nada');
    return apagados;
  } catch (err) {
    await query('ROLLBACK').catch(() => {});
    throw err;
  }
}

/* Apaga o que nasceu de um ficheiro, e so isso. O que ja existia e so lhe foi
   associado (criado = FALSE) perde a ligacao e fica. Uma linha agarrada tambem
   a outro ficheiro da caixa tambem fica, porque o outro ainda precisa dela. */
async function apagarOQueNasceu(id, ligados) {
    await query('DELETE FROM inbox_links WHERE inbox_id = $1', [id]);
    const apagados = [];
    for (const l of ligados) {
      const tabela = TABELA_DO_ALVO[l.target_type];
      /* Um pagamento que ja existia volta a ser como era antes da fatura. */
      if (l.criado === false && l.target_type === 'pagamento' && l.antes) {
        await reporPagamento(l.target_id, l.antes);
      }
      if (!tabela || l.criado === false) continue;
      const outros = await all(
        'SELECT 1 FROM inbox_links WHERE target_type = $1 AND target_id = $2 LIMIT 1',
        [l.target_type, l.target_id]);
      if (outros.length) continue;
      /* item_documents nao tem chave estrangeira para o item (serve despesas e
         eventos): as linhas dele saem a mao, senao ficavam a apontar para nada. */
      if (l.target_type === 'despesa' || l.target_type === 'evento') {
        await query('DELETE FROM item_documents WHERE tipo = $1 AND item_id = $2',
          [l.target_type, l.target_id]);
      }
      await query('DELETE FROM ' + tabela + ' WHERE id = $1', [l.target_id]);
      apagados.push(l.target_type + ' ' + l.target_id);
    }
    return apagados;
}

async function pagarComComprovativo(id) {
  const ligs = await all(
    `SELECT target_id, dados FROM inbox_links
      WHERE inbox_id = $1 AND target_type = 'pagamento' AND dados->>'papel' = 'comprovativo'`, [id]);
  const pagos = [];
  /* Um comprovativo que nao prova pagamento nenhum do Farol continua a ser
     dinheiro que saiu: fica como despesa, com o papel agarrado, como era
     antes de haver comprovativos. */
  if (!ligs.length) {
    const cp = (await all(
      `SELECT target_id, dados FROM inbox_links
        WHERE inbox_id = $1 AND target_type = 'documento' AND dados->>'papel' = 'comprovativo' LIMIT 1`, [id]))[0];
    const x = (cp && cp.dados) || {};
    if (cp && numero(x.amount) !== null) {
      const dp = await CRIAR.despesa({
        description: x.title || x.description || 'Pagamento', amount: numero(x.amount),
        spent_on: x.paid_on || x.spent_on, merchant: x.payee || x.merchant,
        context_id: x.context_id, person_id: x.person_id, note: x.notes
      });
      await query('UPDATE expenses SET aprovado = TRUE, document_id = $2 WHERE id = $1', [dp, cp.target_id]);
      await query(
        `INSERT INTO inbox_links (inbox_id, target_type, target_id) VALUES ($1,'despesa',$2)
         ON CONFLICT DO NOTHING`, [id, dp]);
      pagos.push('despesa ' + dp);
    }
    return pagos;
  }
  for (const l of ligs) {
    const t = (await all(
      'SELECT id, done, paid_on, repeat_rule FROM tasks WHERE id = $1', [l.target_id]))[0];
    if (!t || t.done || t.paid_on) continue;
    const d = l.dados || {};
    await query('UPDATE tasks SET aprovado = TRUE WHERE id = $1', [t.id]);
    await pagar(t.id, {
      paid_on: d.paid_on || null,
      paid_amount: d.amount === undefined ? null : d.amount,
      payment_method: d.payment_method || 'transfer\u00eancia'
    });
    /* Num recorrente, a vez paga e uma linha nova (series_id) e a fatura e o
       comprovativo foram com ela: as ligacoes da caixa vao atras. */
    if (t.repeat_rule) {
      const vez = (await all(
        'SELECT id FROM tasks WHERE series_id = $1 ORDER BY id DESC LIMIT 1', [t.id]))[0];
      if (vez) {
        await query(
          `UPDATE inbox_links SET target_id = $2 WHERE target_type = 'pagamento' AND target_id = $1`,
          [t.id, vez.id]);
      }
    }
    pagos.push(t.id);
  }
  return pagos;
}

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */
const SELECT_ITEM = `
  SELECT i.id, i.kind, i.title, i.note, i.file_name, i.mime_type, i.byte_size, i.store, i.ai_status, i.ai_json, i.ai_erro,
         i.person_id, i.captured_by, to_char(i.captured_at,'YYYY-MM-DD"T"HH24:MI') AS captured_at,
         i.status, to_char(i.resolved_at,'YYYY-MM-DD"T"HH24:MI') AS resolved_at,
         to_char(i.approved_at,'YYYY-MM-DD"T"HH24:MI') AS approved_at
    FROM inbox_items i`;

/* A caixa de entrada e uma fila de trabalho, nao um arquivo: mostra o que
   ainda precisa de alguem. Depois de aprovado, o papel vive nos Documentos,
   nas Despesas, nas Tarefas e na Agenda - e sai daqui.
   Excepcao honesta: se o ficheiro ficou por arquivar (a passagem de bucket
   falhou), o item continua a aparecer, porque isso e uma falha por resolver
   e nao arrumacao feita. */
function filtroDoEstado(estado) {
  /* Arrumados: o que ja saiu da caixa. A caixa continua a ser uma fila de
     trabalho, mas sem este separador nao havia como saber para onde tinha
     ido um ficheiro que se catalogou sozinho (a fatura da MEO, 26 set). */
  if (estado === 'arrumado') {
    return "i.status = 'catalogado' AND i.approved_at IS NOT NULL";
  }
  if (estado === 'catalogado') {
    return pronto('arquivo')
      ? "i.status = 'catalogado' AND (i.approved_at IS NULL" +
        " OR (i.file_path IS NOT NULL AND i.store <> 'arquivo'))"
      : "i.status = 'catalogado' AND i.approved_at IS NULL";
  }
  return 'i.status = $1';
}

async function carregar(estado) {
  const filtra = estado && estado !== 'todos';
  const where = filtra ? 'WHERE ' + filtroDoEstado(estado) : '';
  const itens = await all(`${SELECT_ITEM} ${where} ORDER BY i.captured_at DESC, i.id DESC`,
    filtra && estado !== 'catalogado' && estado !== 'arrumado' ? [estado] : []);
  const [{ n }] = await all("SELECT count(*)::int AS n FROM inbox_items WHERE status = 'por_triar'");
  /* Duas filas, dois numeros: o que ainda ninguem leu e o que ja esta lido a
     espera de uma decisao. */
  const [{ a }] = await all(
    "SELECT count(*)::int AS a FROM inbox_items WHERE status = 'catalogado' AND approved_at IS NULL");
  if (!itens.length) return { itens: [], porTriar: n, porAprovar: a };
  const ligacoes = await all(
    'SELECT inbox_id, target_type, target_id, criado, dados AS leitura FROM inbox_links WHERE inbox_id = ANY($1)',
    [itens.map((i) => i.id)]);
  /* O cartao mostrava o que a IA tinha proposto, nao o que ficou gravado: um
     documento com a entidade corrigida a mao continuava marcado como estando
     sem entidade. Aqui vai o que a linha tem mesmo. */
  const dados = await conteudoDosAlvos(ligacoes);
  itens.forEach((i) => {
    i.links = ligacoes.filter((l) => l.inbox_id === i.id)
      .map((l) => ({
        tipo: l.target_type,
        id: l.target_id,
        criado: l.criado !== false,
        dados: (dados[l.target_type] || {})[l.target_id] || null,
        /* Comprovativo: o documento traz o que ficou por encontrar (faturas e
           dinheiro); cada pagamento diz que foi provado por este papel. */
        papel: (l.leitura && l.leitura.papel) || null,
        faltam: l.target_type === 'documento' && l.leitura ? l.leitura.faltam || null : undefined,
        resto: l.target_type === 'documento' && l.leitura ? l.leitura.resto || null : undefined
      }));
  });
  return { itens, porTriar: n, porAprovar: a };
}

/* ------------------------------------------------------------------ *
 * Rotas
 * ------------------------------------------------------------------ */
/* O mesmo caminho serve a triagem à mão e a automática: há uma só maneira de
   um item da caixa se transformar em coisas. */
/* Um comprovativo passa a ser um documento (o papel) e agarra-se aos
   pagamentos que prova. Nada fica pago aqui: isso acontece na aprovacao, que
   e quando alguem confirmou que a ligacao esta certa. */
async function catalogarComprovativo(id, x) {
  const docId = await CRIAR.documento({
    name: x.title || x.description || 'Comprovativo de pagamento',
    entity: x.payee || x.merchant || x.entity, kind: 'comprovativo',
    context_id: x.context_id, person_id: x.person_id,
    issued_on: x.paid_on || x.spent_on || x.issued_on
  });
  const r = await pagamentosDoComprovativo(x, { doc: docId, item: id });
  const leitura = Object.assign({}, x, { papel: 'comprovativo', faltam: r.faltam, resto: r.resto });
  await query(
    `INSERT INTO inbox_links (inbox_id, target_type, target_id, criado, dados)
     VALUES ($1,'documento',$2,TRUE,$3) ON CONFLICT DO NOTHING`, [id, docId, JSON.stringify(leitura)]);
  const out = [{ tipo: 'documento', id: docId, comprovativo: true }];
  for (const t of r.escolhidos) {
    await ligarComprovativo(id, t.id, docId, x, parteDe(r.escolhidos, t, r.valor, r.faltam));
    out.push({ tipo: 'pagamento', id: t.id, reutilizado: true, titulo: t.title, comprovativo: true });
  }
  console.log('[farol] item', id, 'comprovativo de', r.escolhidos.map((t) => t.id).join(', ') || 'nada',
    r.faltam.length ? '(faltam faturas: ' + r.faltam.length + ')' : '');
  return out;
}

async function executarTriagem(id, destinos) {
  for (const d of destinos) {
    if (!TIPOS.includes(d.tipo)) throw new Error('Destino desconhecido: ' + d.tipo);
  }
  await query('BEGIN');
  try {
    const linhas = await all(
      'SELECT id, file_path, mime_type, store FROM inbox_items WHERE id = $1 FOR UPDATE', [id]);
    if (!linhas.length) throw new Error('Item não encontrado.');
    const item = linhas[0];

    const criados = [];
    for (const d of destinos) {
      if (d.tipo === 'comprovativo') {
        criados.push(...await catalogarComprovativo(id, d.dados || {}));
        continue;
      }
      /* Uma fatura de algo que ja esta a ser pago (a mensalidade, a prestacao,
         a proxima ocorrencia de um pagamento recorrente) nao cria outro
         pagamento: junta-se ao que ja existe. */
      const existente = d.tipo === 'pagamento' ? await pagamentoExistente(d.dados || {}) : null;
      if (existente) {
        const antes = await juntarAoPagamento(existente.id, d.dados || {});
        await query(
          `INSERT INTO inbox_links (inbox_id, target_type, target_id, criado, dados, antes)
           VALUES ($1,'pagamento',$2,FALSE,$3,$4) ON CONFLICT DO NOTHING`,
          [id, existente.id, JSON.stringify(d.dados || {}), antes ? JSON.stringify(antes) : null]);
        criados.push({ tipo: 'pagamento', id: existente.id, reutilizado: true, titulo: existente.title });
        continue;
      }
      const novoId = await CRIAR[d.tipo](d.dados || {});
      await query(
        `INSERT INTO inbox_links (inbox_id, target_type, target_id) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`, [id, d.tipo, novoId]);
      criados.push({ tipo: d.tipo, id: novoId });
    }
    /* Uma despesa tambem e um papel. Sem isto, o comprovativo catalogado como
       despesa so aparecia na linha do dinheiro: quem o procurasse pelo nome
       nos Documentos nao o encontrava. O ficheiro e um so, ligado aos dois. */
    const despesas = criados.filter((c) => c.tipo === 'despesa');
    if (despesas.length && item.file_path) {
      for (const dp of despesas) {
        const linha = (await all(
          `SELECT description, merchant, context_id, person_id,
                  to_char(spent_on,'YYYY-MM-DD') AS spent_on
             FROM expenses WHERE id = $1`, [dp.id]))[0];
        let docId = criados.filter((c) => c.tipo === 'documento').map((c) => c.id)[0];
        if (!docId) {
          docId = await CRIAR.documento({
            name: linha.description, entity: linha.merchant, kind: 'comprovativo',
            context_id: linha.context_id, person_id: linha.person_id, issued_on: linha.spent_on
          });
          await query(
            `INSERT INTO inbox_links (inbox_id, target_type, target_id) VALUES ($1,'documento',$2)
             ON CONFLICT DO NOTHING`, [id, docId]);
          criados.push({ tipo: 'documento', id: docId });
        }
        await query('UPDATE expenses SET document_id = $2 WHERE id = $1', [dp.id, docId]);
      }
    }

    /* Um pagamento que nasce de um ficheiro traz o papel com ele: o ficheiro
       passa a ser tambem um documento (a fatura), como ja acontecia com as
       despesas. Sem isto a fatura da MEO ficou nas Tarefas sem papel nenhum. */
    const pagamentos = criados.filter((c) => c.tipo === 'pagamento' && !c.comprovativo);
    if (pagamentos.length && item.file_path && !criados.some((c) => c.tipo === 'documento')) {
      const t = (await all(
        `SELECT title, payee, context_id, owner_id FROM tasks WHERE id = $1`, [pagamentos[0].id]))[0];
      const docId = await CRIAR.documento({
        name: t.title, entity: t.payee, kind: 'fatura',
        context_id: t.context_id, person_id: t.owner_id
      });
      await query(
        `INSERT INTO inbox_links (inbox_id, target_type, target_id) VALUES ($1,'documento',$2)
         ON CONFLICT DO NOTHING`, [id, docId]);
      criados.push({ tipo: 'documento', id: docId });
    }

    /* Se o mesmo ficheiro deu um pagamento e um documento, o documento e a
       fatura desse pagamento: fica agarrado, sem ninguem ter de o ir buscar. */
    const pag = criados.filter((c) => c.tipo === 'pagamento' && !c.comprovativo);
    const doc = criados.filter((c) => c.tipo === 'documento' && !c.comprovativo);
    for (const p of pag) {
      for (const dc of doc) {
        await query(
          `INSERT INTO task_documents (task_id, document_id, papel) VALUES ($1,$2,'fatura')
           ON CONFLICT (task_id, document_id) DO UPDATE SET papel = 'fatura'`, [p.id, dc.id]);
      }
    }

    await query("UPDATE inbox_items SET status = 'catalogado', resolved_at = now() WHERE id = $1", [id]);
    /* So documentos e despesas esperam por uma aprovacao. Uma tarefa ou um
       evento sao para agir agora: ficam aprovados a nascenca, senao o numero
       no menu passava a vida a pedir uma decisao que nao existe. */
    if (!criados.some((c) => APROVAVEIS[c.tipo])) {
      await query('UPDATE inbox_items SET approved_at = now() WHERE id = $1', [id]);
    }
    await query('COMMIT');

    if (item.file_path && item.store === 'inbox') {
      try {
        if (await arquivar(item.file_path, item.mime_type)) {
          await query("UPDATE inbox_items SET store = 'arquivo' WHERE id = $1", [id]);
        }
      } catch (e) {
        console.warn('[farol] item', id, 'catalogado mas não arquivado:', e.message);
      }
    }
    return criados;
  } catch (err) {
    await query('ROLLBACK').catch(() => {});
    throw err;
  }
}

/* ---------------- catalogação automática ---------------- */
/* Só avança sozinho quando o modelo diz que leu, não quando deduziu. Um
   destino de confiança média, ou a que falte o essencial, fica por triar:
   mais vale dar trabalho a alguém do que escrever uma despesa errada em
   silêncio. */
const CAMPOS_MINIMOS = {
  tarefa: (x) => Boolean(x.title),
  /* Um pagamento sem valor e sem prazo nao serve para nada: fica por triar. */
  pagamento: (x) => Boolean(x.title || x.description) && x.amount !== undefined && x.amount !== null && x.amount !== '',
  evento: (x) => Boolean(x.title && x.day),
  /* A entidade continua a ser metade do que se procura num papel velho, mas
     deixou de travar a catalogacao: agora ha um passo de aprovacao, e um
     documento sem entidade chega la marcado como incompleto em vez de ficar
     preso na caixa sem ninguem perceber porque. */
  documento: (x) => Boolean(x.name),
  despesa: (x) => Boolean(x.description) && x.amount !== undefined && x.amount !== null && x.amount !== '',
  /* Um comprovativo sem montante nao prova nada que se possa conferir. */
  comprovativo: (x) => x.amount !== undefined && x.amount !== null && x.amount !== ''
};

/* Acentos e maiusculas nao podem decidir de quem e um papel. */
function semAcentos(s) {
  return String(s || '').normalize('NFD').split('')
    .filter((c) => { const n = c.charCodeAt(0); return n < 768 || n > 879; })
    .join('').toLowerCase().trim();
}

/* O papel diz «Ana Lúcia Garcia»; aqui dentro a pessoa chama-se «Ana Lúcia».
   Por isso compara-se nos dois sentidos, e ganha o encontro mais longo: assim
   «Maria» nunca rouba o lugar a quem tenha Maria no meio do nome. */
async function pessoaPorNome(nome) {
  const alvo = semAcentos(nome);
  if (alvo.length < 3) return null;
  const pessoas = await all('SELECT id, name, full_name FROM people WHERE active');
  let melhor = null;
  for (const p of pessoas) {
    for (const cru of [p.name, p.full_name]) {
      const c = semAcentos(cru);
      if (c.length < 3) continue;
      if (c === alvo || alvo.indexOf(c) >= 0 || c.indexOf(alvo) >= 0) {
        if (!melhor || c.length > melhor.tamanho) melhor = { id: p.id, tamanho: c.length };
      }
    }
  }
  return melhor ? melhor.id : null;
}

/* A area vem como texto, as vezes com o pai a frente («Patrimonio > Carro»).
   Compara-se so a ultima parte, sem acentos, contra os nomes que existem. */
async function contextoPorNome(nome) {
  const cru = String(nome || '').split('>').pop();
  const alvo = semAcentos(cru);
  if (alvo.length < 3) return null;
  const areas = await all('SELECT id, name FROM contexts WHERE active');
  let melhor = null;
  for (const c of areas) {
    const n = semAcentos(c.name);
    if (n.length < 3) continue;
    if (n === alvo || alvo.indexOf(n) >= 0 || n.indexOf(alvo) >= 0) {
      if (!melhor || n.length > melhor.tamanho) melhor = { id: c.id, tamanho: n.length };
    }
  }
  return melhor ? melhor.id : null;
}

async function nomeDaPessoa(pid) {
  if (!pid) return null;
  const rows = await all('SELECT name FROM people WHERE id = $1', [pid]);
  return rows.length ? rows[0].name : null;
}

/* O nome de quem e faz parte do titulo: e assim que se encontra um papel seis
   meses depois, sem abrir nada. So se junta se ainda la nao estiver. */
function comPessoa(titulo, pessoa) {
  const t = String(titulo || '').trim();
  if (!t || !pessoa) return t;
  if (semAcentos(t).indexOf(semAcentos(pessoa)) >= 0) return t;
  return (t + ' \u2014 ' + pessoa).slice(0, 160);
}

/* O modelo devolve um nome de pessoa e notas; as tabelas querem ids e outros
   nomes de campo. É aqui que se faz a tradução. */
async function podeTerTarefas(pid) {
  if (!pid) return false;
  const r = await all('SELECT 1 FROM people WHERE id = $1 AND can_own_tasks', [pid]);
  return r.length > 0;
}

async function paraDestino(d) {
  const dados = Object.assign({}, d.dados || {});
  const cid = await contextoPorNome(dados.area);
  if (cid) dados.context_id = cid;
  delete dados.area;
  const pid = await pessoaPorNome(dados.pessoa);
  if (pid) {
    if (d.tipo === 'documento' || d.tipo === 'despesa' || d.tipo === 'evento' ||
        d.tipo === 'comprovativo') dados.person_id = pid;
    /* A pessoa do papel e tambem quem paga (ou quem faz), desde que possa ter
       tarefas: a fatura em nome do Marco e o Marco que a paga. Fica tambem
       como «por causa de quem». */
    if (d.tipo === 'pagamento' || d.tipo === 'tarefa') {
      dados.subjects = [pid];
      if (!dados.owner_id && await podeTerTarefas(pid)) dados.owner_id = pid;
    }
  }
  if (d.tipo === 'despesa' && dados.notes && !dados.note) dados.note = dados.notes;
  if (d.tipo === 'evento' && dados.notes && !dados.detail) dados.detail = dados.notes;
  delete dados.pessoa;
  return { tipo: d.tipo, dados: dados };
}

function tituloDaProposta(proposta) {
  const d = (proposta.destinos || [])[0];
  const x = (d && d.dados) || {};
  const t = x.name || x.title || x.description || proposta.resumo || '';
  return String(t).trim().slice(0, 120) || null;
}

async function autoCatalogar(id, proposta) {
  if (!proposta || !Array.isArray(proposta.destinos) || !proposta.destinos.length) return null;

  /* Ler outra vez um item ja catalogado serve para melhorar a proposta, nao
     para arrumar tudo de novo: sem esta guarda nascia um documento duplicado
     a cada leitura. */
  const estado = await all('SELECT status FROM inbox_items WHERE id = $1', [id]);
  if (!estado.length || estado[0].status !== 'por_triar') {
    console.log('[farol] item', id, 'ja estava triado: a proposta fica guardada, mais nada');
    return null;
  }

  /* O nome do ficheiro em bruto deixa de ser o título, mesmo que o item fique
     por triar. Só se escreve se ninguém tiver escrito um. */
  /* De quem e o ficheiro. O modelo escreve um nome; aqui vira uma pessoa da
     casa, fica agarrada ao item e entra no titulo. */
  const nomeLido = proposta.destinos
    .map((d) => (d && d.dados && d.dados.pessoa) || '')
    .filter(Boolean)[0] || null;
  const pid = await pessoaPorNome(nomeLido);
  const pessoa = await nomeDaPessoa(pid);
  if (pid) {
    await query('UPDATE inbox_items SET person_id = COALESCE(person_id, $2) WHERE id = $1',
      [id, pid]).catch(() => {});
  }

  const titulo = comPessoa(tituloDaProposta(proposta), pessoa);
  if (titulo) {
    await query("UPDATE inbox_items SET title = COALESCE(NULLIF(title, ''), $2) WHERE id = $1",
      [id, titulo]).catch(() => {});
  }

  const bons = proposta.destinos.filter((d) =>
    d && d.confianca === 'alta' && TIPOS.includes(d.tipo) && CAMPOS_MINIMOS[d.tipo](d.dados || {}));
  if (!bons.length || bons.length !== proposta.destinos.length) {
    console.log('[farol] item', id, 'fica por triar: confiança ou campos em falta');
    return null;
  }

  try {
    const destinos = [];
    for (const d of bons) destinos.push(await paraDestino(d));
    const criados = await executarTriagem(id, destinos);
    console.log('[farol] item', id, 'catalogado sozinho:', criados.map((c) => c.tipo).join(', '));
    return criados;
  } catch (err) {
    console.warn('[farol] item', id, 'não deu para catalogar sozinho:', err.message);
    return null;
  }
}

function instalar(app) {
  app.get('/api/inbox', async (req, res) => {
    try {
      res.json(await carregar(req.query.estado || 'por_triar'));
    } catch (err) {
      console.error('[farol] GET /api/inbox:', err.message);
      res.status(500).json({ error: 'Não foi possível ler a caixa de entrada.' });
    }
  });

  app.post('/api/inbox', upload.single('ficheiro'), async (req, res) => {
    const b = req.body || {};
    const f = req.file;
    if (!f && !String(b.note || '').trim() && !String(b.title || '').trim()) {
      return res.status(400).json({ error: 'Envia um ficheiro ou escreve alguma coisa.' });
    }
    if (f && !bucketPronto()) {
      return res.status(503).json({ error: 'O armazenamento de ficheiros ainda não está configurado.' });
    }
    try {
      let chave = null, checksum = null;
      if (f) {
        checksum = crypto.createHash('sha256').update(f.buffer).digest('hex');
        const repetido = await all(
          "SELECT id FROM inbox_items WHERE checksum = $1 AND status <> 'descartado' LIMIT 1", [checksum]);
        if (repetido.length) {
          return res.status(409).json({ error: 'Este ficheiro já está na caixa de entrada.', id: repetido[0].id });
        }
        chave = caminho(f.originalname);
        await guardar('inbox', chave, f.buffer, f.mimetype);
      }
      const rows = await all(
        `INSERT INTO inbox_items (kind, title, note, file_path, file_name, mime_type,
                                  byte_size, checksum, captured_by, store, ai_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'inbox',$10) RETURNING id`,
        [f ? 'ficheiro' : 'nota', limpar(b.title), limpar(b.note), chave,
         f ? f.originalname : null, f ? f.mimetype : null, f ? f.size : null,
         checksum, limpar(b.captured_by), (f && ia.ativa()) ? 'pendente' : 'nenhum']);
      // A analise corre a seguir a resposta, nao antes: quem envia uma foto
      // nao deve esperar pelo modelo. O ecra mostra 'a analisar' e actualiza.
      if (f) {
        ia.analisarItem(rows[0].id, f.buffer, f.mimetype, f.originalname)
          .then((proposta) => autoCatalogar(rows[0].id, proposta))
          .catch((e) => console.warn('[farol] análise e catalogação:', e.message));
      }

      const { itens } = await carregar('todos');
      res.status(201).json(itens.find((i) => i.id === rows[0].id));
    } catch (err) {
      console.error('[farol] POST /api/inbox:', err.message);
      res.status(500).json({ error: 'Não foi possível guardar.' });
    }
  });

  // Debaixo de /api de propósito: herda o guarda da sessão do auth.js.
  app.get('/api/inbox/:id/ficheiro', async (req, res) => {
    try {
      const rows = await all(
        'SELECT file_path, file_name, mime_type, store FROM inbox_items WHERE id = $1',
        [Number(req.params.id)]);
      if (!rows.length || !rows[0].file_path) return res.status(404).json({ error: 'Sem ficheiro.' });
      const obj = await ler(rows[0].store || 'inbox', rows[0].file_path);
      res.setHeader('Content-Type', rows[0].mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition',
        'inline; filename="' + encodeURIComponent(rows[0].file_name || 'ficheiro') + '"');
      res.setHeader('Cache-Control', 'private, max-age=0, no-store');
      obj.Body.pipe(res);
    } catch (err) {
      console.error('[farol] GET ficheiro:', err.message);
      res.status(500).json({ error: 'Não foi possível ler o ficheiro.' });
    }
  });

  app.patch('/api/inbox/:id', async (req, res) => {
    const b = req.body || {};
    const campos = [], valores = [];
    ['title', 'note'].forEach((c) => {
      if (b[c] !== undefined) { campos.push(c + ' = $' + (campos.length + 1)); valores.push(limpar(b[c])); }
    });
    if (b.status === 'descartado' || b.status === 'por_triar') {
      campos.push('status = $' + (campos.length + 1)); valores.push(b.status);
    }
    if (!campos.length) return res.status(400).json({ error: 'Nada para alterar.' });
    try {
      valores.push(Number(req.params.id));
      const rows = await all(
        `UPDATE inbox_items SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING id`, valores);
      if (!rows.length) return res.status(404).json({ error: 'Item não encontrado.' });
      res.json(await carregar(req.query.estado || 'por_triar'));
    } catch (err) {
      console.error('[farol] PATCH /api/inbox:', err.message);
      res.status(500).json({ error: 'Não foi possível gravar.' });
    }
  });

  /**
   * Triagem. Corpo:
   *   { destinos: [ { tipo: 'despesa',   dados: { description, amount, spent_on } },
   *                 { tipo: 'documento', dados: { name, valid_on } } ] }
   *
   * A parte da base de dados é uma transacção: ou o item fica catalogado com
   * todos os destinos criados, ou não muda nada. Meia triagem seria pior do
   * que nenhuma.
   *
   * A mudança de bucket fica FORA da transacção, e de propósito. Se falhar, o
   * ficheiro continua no bucket temporário e o store diz isso — é recuperável.
   * Se estivesse dentro, uma falha do S3 desfazia uma triagem já correcta.
   */
  /* A análise pode falhar por carga do modelo, e nesse caso não é preciso
     voltar a carregar o ficheiro: ele continua no balde. */
  app.post('/api/inbox/:id/analisar', async (req, res) => {
    const id = Number(req.params.id);
    try {
      if (!ia.ativa()) return res.status(400).json({ error: 'A leitura automática está desligada.' });
      const linhas = await all(
        'SELECT id, file_path, file_name, mime_type, store FROM inbox_items WHERE id = $1', [id]);
      if (!linhas.length) return res.status(404).json({ error: 'Item não encontrado.' });
      const it = linhas[0];
      if (!it.file_path) return res.status(400).json({ error: 'Este item não tem ficheiro para ler.' });

      await query("UPDATE inbox_items SET ai_status = 'pendente', ai_erro = NULL WHERE id = $1", [id]);
      const obj = await ler(it.store || 'inbox', it.file_path);
      const buffer = await bytes(obj.Body);
      ia.analisarItem(id, buffer, it.mime_type, it.file_name)
        .then((proposta) => autoCatalogar(id, proposta))
        .catch((e) => console.warn('[farol] nova análise:', e.message));

      res.json(await carregar(req.query.estado || 'por_triar'));
    } catch (err) {
      console.error('[farol] POST analisar:', err.message);
      res.status(400).json({ error: err.message || 'Não foi possível tentar outra vez.' });
    }
  });

  /* Relacionar o ficheiro com uma pessoa a mao, quando a leitura automatica
     nao chegou la. Arruma o item, o titulo e o que ja nasceu dele: sem esta
     ultima parte o documento ficava orfao no ecra dos Documentos. */
  app.patch('/api/inbox/:id/pessoa', async (req, res) => {
    const id = Number(req.params.id);
    const corpo = req.body || {};
    const pid = corpo.person_id ? Number(corpo.person_id) : null;
    try {
      const item = await all('SELECT id, title FROM inbox_items WHERE id = $1', [id]);
      if (!item.length) return res.status(404).json({ error: 'Item nao encontrado.' });
      const pessoa = await nomeDaPessoa(pid);
      if (pid && !pessoa) return res.status(404).json({ error: 'Essa pessoa nao existe.' });

      await query('UPDATE inbox_items SET person_id = $2 WHERE id = $1', [id, pid]);
      if (pessoa && item[0].title) {
        await query('UPDATE inbox_items SET title = $2 WHERE id = $1',
          [id, comPessoa(item[0].title, pessoa)]);
      }

      const links = await all(
        'SELECT target_type, target_id, criado, antes FROM inbox_links WHERE inbox_id = $1', [id]);
      const dono = await podeTerTarefas(pid);
      for (const l of links) {
        if (l.target_type === 'documento') {
          await query('UPDATE documents SET person_id = $2 WHERE id = $1', [l.target_id, pid]);
        } else if (l.target_type === 'despesa') {
          await query('UPDATE expenses SET person_id = $2 WHERE id = $1', [l.target_id, pid]);
        } else if (l.target_type === 'evento') {
          await query('DELETE FROM event_people WHERE event_id = $1', [l.target_id]);
          if (pid) {
            await query('INSERT INTO event_people (event_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
              [l.target_id, pid]);
          }
        } else if ((l.target_type === 'tarefa' || l.target_type === 'pagamento') && pid) {
          await query('INSERT INTO task_subjects (task_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [l.target_id, pid]);
          /* Quem paga / quem faz passa a ser a pessoa escolhida. Num pagamento
             que ja existia e so recebeu a fatura, so se preenche se estiver
             vazio: quem la estava foi escolhido por alguem. */
          if (dono) {
            await query(
              `UPDATE tasks SET owner_id = CASE WHEN $3 THEN $2 ELSE COALESCE(owner_id, $2) END,
                                updated_at = now()
                WHERE id = $1`, [l.target_id, pid, l.criado !== false]);
          }
        }
      }

      res.json(await carregar(req.query.estado || 'por_triar'));
    } catch (err) {
      console.error('[farol] PATCH pessoa:', err.message);
      res.status(400).json({ error: 'Nao foi possivel relacionar a pessoa.' });
    }
  });

  /* ---------------- o pagamento da fatura ---------------- */
  /* O que a fatura diz: guardado na ligacao quando se juntou a um pagamento
     que ja existia, ou lido do pagamento que nasceu dela. */
  async function faturaDoItem(id) {
    const lp = (await all(
      `SELECT target_id, criado, dados, antes FROM inbox_links
        WHERE inbox_id = $1 AND target_type = 'pagamento' LIMIT 1`, [id]))[0];
    if (!lp) return null;
    let fatura = lp.dados || {};
    if (!lp.criado && !Object.keys(fatura).length) {
      /* Ligacoes de antes de se guardar o que a fatura dizia: vai-se a leitura. */
      const ai = ((await all('SELECT ai_json FROM inbox_items WHERE id = $1', [id]))[0] || {}).ai_json || {};
      const d = (ai.destinos || []).filter((x) => x && x.tipo === 'pagamento')[0];
      fatura = (d && d.dados) || {};
    }
    if (lp.criado) {
      fatura = (await all(
        `SELECT title, amount::float AS amount, to_char(due_on, 'YYYY-MM-DD') AS due_on, payee,
                payment_ref, context_id, owner_id, project_id, notes, done
           FROM tasks WHERE id = $1`, [lp.target_id]))[0] || {};
    }
    return { lp, fatura };
  }

  /* Os pagamentos por pagar, do mais parecido para o menos, para escolher a
     mao quando a escolha automatica errou. */
  /* O comprovativo do item, se o item for um: o documento e a leitura. */
  async function comprovativoDoItem(id) {
    return (await all(
      `SELECT target_id AS doc, dados FROM inbox_links
        WHERE inbox_id = $1 AND target_type = 'documento' AND dados->>'papel' = 'comprovativo' LIMIT 1`,
      [id]))[0] || null;
  }

  app.get('/api/inbox/:id/pagamentos', async (req, res) => {
    const id = Number(req.params.id);
    try {
      const cp = await comprovativoDoItem(id);
      if (cp) {
        /* Um comprovativo pode provar varios pagamentos: a lista leva
           caixas, e os que estao ligados vem marcados. */
        const atuais = await all(
          `SELECT t.id, t.title, t.amount::float AS amount, to_char(t.due_on, 'YYYY-MM-DD') AS due_on,
                  to_char(t.paid_on, 'YYYY-MM-DD') AS paid_on, l.criado
             FROM inbox_links l JOIN tasks t ON t.id = l.target_id
            WHERE l.inbox_id = $1 AND l.target_type = 'pagamento' ORDER BY t.id`, [id]);
        const r = await pontuarComprovativo(cp.dados || {}, { doc: cp.doc, item: id });
        const candidatos = r.todos.filter((t) => !atuais.some((a) => a.id === t.id)).slice(0, 60);
        return res.json({ modo: 'comprovativo', atuais, candidatos,
          valor: r.valor, faltam: (cp.dados || {}).faltam || [], resto: (cp.dados || {}).resto || null });
      }
      const f = await faturaDoItem(id);
      if (!f) return res.status(404).json({ error: 'Este ficheiro nao tem pagamento.' });
      const atual = (await all(
        `SELECT id, title, amount::float AS amount, to_char(due_on, 'YYYY-MM-DD') AS due_on
           FROM tasks WHERE id = $1`, [f.lp.target_id]))[0] || null;
      const candidatos = (await pontuarPagamentos(f.fatura))
        .filter((t) => t.id !== f.lp.target_id).slice(0, 60);
      res.json({ atual: atual && Object.assign(atual, { criado: f.lp.criado }), candidatos });
    } catch (err) {
      console.error('[farol] GET pagamentos:', err.message);
      res.status(500).json({ error: 'Nao foi possivel ler os pagamentos.' });
    }
  });

  /* Trocar: { para: <id de um pagamento por pagar> } ou { para: 'novo' }.
     O pagamento de onde a fatura sai volta ao que era (se ja existia) ou e
     apagado (se tinha nascido dela). A fatura (documento) vai com ela. */
  /* Comprovativo: { paras: [ids], novo: true|false }. Solta os que estavam,
     liga os escolhidos, e com novo cria um pagamento para o dinheiro que
     sobra (o de uma fatura que ainda nao estava no Farol). So antes de
     aprovar: depois de aprovado os pagamentos ja estao pagos, e isso
     corrige-se nas Tarefas. */
  async function trocarComprovativo(id, cp, b) {
    const item = (await all('SELECT approved_at FROM inbox_items WHERE id = $1', [id]))[0];
    if (item && item.approved_at) {
      throw new Error('Este comprovativo ja foi aprovado e os pagamentos ficaram pagos: corrige-os nas Tarefas.');
    }
    const x = cp.dados || {};
    const pistas = await pontuarComprovativo(x, { doc: cp.doc, item: id });
    const paras = (Array.isArray(b.paras) ? b.paras : []).map(Number).filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);
    const velhos = await all(
      `SELECT target_id, criado FROM inbox_links WHERE inbox_id = $1 AND target_type = 'pagamento'`, [id]);
    for (const v of velhos) {
      if (paras.indexOf(v.target_id) >= 0) continue;
      await query("DELETE FROM inbox_links WHERE inbox_id = $1 AND target_type = 'pagamento' AND target_id = $2",
        [id, v.target_id]);
      if (v.criado) await query('DELETE FROM tasks WHERE id = $1 AND NOT done', [v.target_id]);
      else await query('DELETE FROM task_documents WHERE task_id = $1 AND document_id = $2', [v.target_id, cp.doc]);
    }
    const escolhidos = [];
    for (const pid of paras) {
      const t = (await all(
        `SELECT id, title, amount::float AS amount FROM tasks
          WHERE id = $1 AND tipo = 'pagamento' AND origin = 'real'`, [pid]))[0];
      if (!t) throw new Error('Um dos pagamentos escolhidos ja nao existe.');
      t.amount = valorDe(t);
      escolhidos.push(t);
    }
    const valor = numero(x.amount);
    const coberto = escolhidos.reduce((s, t) => s + (t.amount || 0), 0);
    /* O que ficou por encontrar muda com a escolha: o cartao diz a verdade. */
    const deles = pistas.todos.filter((c) => escolhidos.some((t) => t.id === c.id));
    const cobertos = atribuirFaturas(pistas.nums, deles);
    const faltam = b.novo ? [] : pistas.nums.filter((n) => !cobertos[n]);
    /* Um so pagamento leva a transferencia toda, a menos que haja faturas
       por encontrar ou um pagamento novo para o resto. */
    const tudoNumSo = escolhidos.length === 1 && !b.novo && !faltam.length;
    for (const t of escolhidos) {
      const ja = velhos.find((v) => v.target_id === t.id);
      if (ja && ja.criado) continue;
      await ligarComprovativo(id, t.id, cp.doc, x, tudoNumSo ? valor : t.amount);
    }
    let resto = valor !== null && valor - coberto > 0.01 ? Math.round((valor - coberto) * 100) / 100 : null;
    if (b.novo) {
      const porPagar = pistas.nums.filter((n) => !cobertos[n]);
      const titulo = String(b.titulo || '').trim() || (x.title || 'Pagamento') +
        (porPagar.length ? ' \u2014 fatura ' + porPagar.join(', ') : '');
      const novo = await CRIAR.pagamento({
        title: titulo, amount: resto !== null ? resto : valor, due_on: x.paid_on,
        payee: x.payee || x.merchant, context_id: x.context_id, owner_id: x.person_id,
        notes: [x.notes, 'Pago por transfer\u00eancia' + (x.paid_on ? ' a ' + dataPt(x.paid_on) : '') + '.']
          .filter(Boolean).join('\n')
      });
      await query(
        `INSERT INTO inbox_links (inbox_id, target_type, target_id, criado, dados)
         VALUES ($1,'pagamento',$2,TRUE,$3)`,
        [id, novo, JSON.stringify({ papel: 'comprovativo', paid_on: soData(x.paid_on),
          amount: resto !== null ? resto : valor, payment_method: metodoDe(x.payment_method) })]);
      await query(
        `INSERT INTO task_documents (task_id, document_id, papel) VALUES ($1,$2,'comprovativo')
         ON CONFLICT (task_id, document_id) DO UPDATE SET papel = 'comprovativo'`, [novo, cp.doc]);
      resto = null;
    }
    await query(
      `UPDATE inbox_links SET dados = dados || $2::jsonb
        WHERE inbox_id = $1 AND target_type = 'documento' AND target_id = $3`,
      [id, JSON.stringify({ resto, faltam }), cp.doc]);
    return escolhidos.map((t) => t.id);
  }

  app.post('/api/inbox/:id/pagamento', async (req, res) => {
    const id = Number(req.params.id);
    const para = (req.body || {}).para;
    const cp = await comprovativoDoItem(id).catch(() => null);
    if (cp) {
      await query('BEGIN');
      try {
        const ids = await trocarComprovativo(id, cp, req.body || {});
        await query('COMMIT');
        console.log('[farol] item', id, 'comprovativo agora de', ids.join(', ') || 'nada',
          (req.body || {}).novo ? '+ novo' : '');
        return res.json({ ok: true, ...(await carregar(req.query.estado || 'catalogado')) });
      } catch (err) {
        await query('ROLLBACK').catch(() => {});
        console.error('[farol] POST comprovativo:', err.message);
        return res.status(400).json({ error: err.message || 'Nao foi possivel mudar os pagamentos.' });
      }
    }
    await query('BEGIN');
    try {
      const f = await faturaDoItem(id);
      if (!f) throw new Error('Este ficheiro nao tem pagamento.');
      const { lp, fatura } = f;
      if (String(para) === String(lp.target_id)) { await query('ROLLBACK'); return res.json(await carregar(req.query.estado || 'catalogado')); }
      if (lp.criado && fatura.done) throw new Error('Este pagamento ja foi pago: corrige-o nas Tarefas.');
      const item = (await all('SELECT approved_at FROM inbox_items WHERE id = $1', [id]))[0];
      const doc = (await all(
        `SELECT target_id FROM inbox_links WHERE inbox_id = $1 AND target_type = 'documento' AND criado
          ORDER BY target_id LIMIT 1`, [id]))[0];

      /* Sair de onde esta. */
      if (lp.criado) {
        await query('DELETE FROM tasks WHERE id = $1', [lp.target_id]);
      } else {
        await reporPagamento(lp.target_id, lp.antes);
        if (doc) await query('DELETE FROM task_documents WHERE task_id = $1 AND document_id = $2',
          [lp.target_id, doc.target_id]);
      }
      await query("DELETE FROM inbox_links WHERE inbox_id = $1 AND target_type = 'pagamento'", [id]);

      /* Entrar no novo sitio. */
      const dados = Object.assign({}, fatura);
      delete dados.done;
      let alvo;
      if (para === 'novo') {
        alvo = await CRIAR.pagamento(dados);
        if (item && item.approved_at) await query('UPDATE tasks SET aprovado = TRUE WHERE id = $1', [alvo]);
        await query(
          `INSERT INTO inbox_links (inbox_id, target_type, target_id, criado) VALUES ($1,'pagamento',$2,TRUE)`,
          [id, alvo]);
      } else {
        alvo = Number(para);
        const ok = await all(
          "SELECT 1 FROM tasks WHERE id = $1 AND tipo = 'pagamento' AND NOT done AND origin = 'real'", [alvo]);
        if (!ok.length) throw new Error('Esse pagamento ja nao esta por pagar.');
        const antes = await juntarAoPagamento(alvo, dados);
        await query(
          `INSERT INTO inbox_links (inbox_id, target_type, target_id, criado, dados, antes)
           VALUES ($1,'pagamento',$2,FALSE,$3,$4)`,
          [id, alvo, JSON.stringify(dados), antes ? JSON.stringify(antes) : null]);
      }
      if (doc) {
        await query(
          `INSERT INTO task_documents (task_id, document_id, papel) VALUES ($1,$2,'fatura')
           ON CONFLICT (task_id, document_id) DO UPDATE SET papel = 'fatura'`, [alvo, doc.target_id]);
      }
      await query('COMMIT');
      console.log('[farol] item', id, 'pagamento', lp.target_id, '->', alvo);
      res.json({ ok: true, pagamento: alvo, ...(await carregar(req.query.estado || 'catalogado')) });
    } catch (err) {
      await query('ROLLBACK').catch(() => {});
      console.error('[farol] POST trocar pagamento:', err.message);
      res.status(400).json({ error: err.message || 'Nao foi possivel trocar o pagamento.' });
    }
  });

  app.post('/api/inbox/:id/recatalogar', async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Falta dizer o que recatalogar.' });
    try {
      const apagados = await descatalogar(id);
      res.json({ ok: true, id, apagados, ...(await carregar(req.query.estado || 'por_triar')) });
    } catch (err) {
      console.error('[farol] POST recatalogar:', err.message);
      res.status(400).json({ error: err.message || 'Não foi possível desfazer a catalogação.' });
    }
  });

  app.post('/api/inbox/:id/triagem', async (req, res) => {
    const id = Number(req.params.id);
    const destinos = (req.body || {}).destinos;
    if (!Array.isArray(destinos) || !destinos.length) {
      return res.status(400).json({ error: 'Diz pelo menos no que se transforma.' });
    }
    try {
      const criados = await executarTriagem(id, destinos);
      res.json({ criados, ...(await carregar(req.query.estado || 'por_triar')) });
    } catch (err) {
      console.error('[farol] POST triagem:', err.message);
      res.status(400).json({ error: err.message || 'Não foi possível catalogar.' });
    }
  });
  /* Catalogar e um palpite da maquina; aprovar e uma decisao de quem manda.
     So aqui e que o documento passa a existir para o resto da app. */
  app.post('/api/inbox/:id/aprovar', async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Falta dizer o que aprovar.' });
    try {
      const item = await all(
        "SELECT status, approved_at FROM inbox_items WHERE id = $1", [id]);
      if (!item.length) return res.status(404).json({ error: 'Item nao encontrado.' });
      if (item[0].status !== 'catalogado') {
        return res.status(400).json({ error: 'So se aprova o que ja foi catalogado.' });
      }

      const ligados = await all(
        'SELECT target_type, target_id FROM inbox_links WHERE inbox_id = $1', [id]);
      for (const l of ligados) {
        const tabela = APROVAVEIS[l.target_type];
        if (tabela) {
          await query('UPDATE ' + tabela + ' SET aprovado = TRUE WHERE id = $1', [l.target_id]);
        }
      }
      /* Um comprovativo aprovado e um pagamento feito: fica pago com a data e
         o valor da transferencia, a despesa escreve-se sozinha, e um pagamento
         recorrente passa a vez seguinte (o que se pagou fica no historico com
         a fatura e o comprovativo). */
      const pagos = await pagarComComprovativo(id);
      await query('UPDATE inbox_items SET approved_at = now() WHERE id = $1', [id]);
      console.log('[farol] item', id, 'aprovado:', ligados.map((l) => l.target_type).join(', '),
        pagos.length ? '; pagos: ' + pagos.join(', ') : '');
      res.json({ ok: true, id, ...(await carregar(req.query.estado || 'catalogado')) });
    } catch (err) {
      console.error('[farol] POST aprovar:', err.message);
      res.status(500).json({ error: 'Nao foi possivel aprovar.' });
    }
  });

  /* Apagar um ficheiro da caixa apaga tudo o que nasceu dele - tarefa,
     pagamento, despesa, documento, evento - numa transaccao so. O que ja
     existia e so lhe foi associado fica, sem a ligacao. O ficheiro no balde sai
     no fim, fora da transaccao: se falhar, fica um objecto orfao, nao dados
     meio apagados. */
  app.delete('/api/inbox/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      let rows, apagados = [];
      await query('BEGIN');
      try {
        const ligados = await all(
          'SELECT target_type, target_id, criado, antes FROM inbox_links WHERE inbox_id = $1', [id]);
        apagados = await apagarOQueNasceu(id, ligados);
        rows = await all('DELETE FROM inbox_items WHERE id = $1 RETURNING file_path, store', [id]);
        await query('COMMIT');
      } catch (e) {
        await query('ROLLBACK').catch(() => {});
        throw e;
      }
      if (!rows.length) return res.status(404).json({ error: 'Item não encontrado.' });
      console.log('[farol] item', id, 'apagado; com ele:', apagados.join(', ') || 'nada');
      const { file_path: chave, store } = rows[0];
      if (chave && pronto(store || 'inbox')) {
        await apagar(store || 'inbox', chave).catch((e) => console.warn('[farol] objecto não apagado:', e.message));
      }
      res.json(await carregar(req.query.estado || 'por_triar'));
    } catch (err) {
      console.error('[farol] DELETE /api/inbox:', err.message);
      res.status(500).json({ error: 'Não foi possível apagar.' });
    }
  });

  /* ---------------------------------------------------------------- *
   * O ficheiro de um documento que ja existe
   *
   * Regra: cada documento tem um anexo digital. Os que nasceram da caixa ja
   * o traziam; os que vieram das notas do TickTick nasceram sem papel. Estas
   * rotas pendurem-lhe um ficheiro sem passar pela triagem: o item nasce ja
   * catalogado, aprovado e no arquivo, porque o documento ja foi decidido.
   * ---------------------------------------------------------------- */
  async function anexarAoDocumento(docId, buffer, nome, mime) {
    const doc = await all('SELECT id, name FROM documents WHERE id = $1', [docId]);
    if (!doc.length) { const e = new Error('Documento não encontrado.'); e.status = 404; throw e; }

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const igual = await all(
      "SELECT id FROM inbox_items WHERE checksum = $1 AND status <> 'descartado' ORDER BY id LIMIT 1", [checksum]);
    let itemId;
    if (igual.length) {
      itemId = igual[0].id;              // o mesmo papel duas vezes: liga-se, nao se duplica
    } else {
      const store = pronto('arquivo') ? 'arquivo' : 'inbox';
      const chave = caminho(nome);
      await guardar(store, chave, buffer, mime);
      itemId = (await all(
        `INSERT INTO inbox_items (kind, title, file_path, file_name, mime_type, byte_size, checksum,
                                  store, status, resolved_at, approved_at, ai_status)
         VALUES ('ficheiro',$1,$2,$3,$4,$5,$6,$7,'catalogado',now(),now(),'nenhum') RETURNING id`,
        [doc[0].name, chave, nome, mime || 'application/octet-stream', buffer.length, checksum, store]))[0].id;
    }
    /* O documento ja existia: o ficheiro so lhe foi pendurado. Apagar o ficheiro
       da caixa solta-o, nao apaga o documento. */
    await query(
      `INSERT INTO inbox_links (inbox_id, target_type, target_id, criado) VALUES ($1,'documento',$2,FALSE)
       ON CONFLICT DO NOTHING`, [itemId, docId]);
    return { ok: true, documento: docId, inbox_id: itemId, repetido: igual.length > 0 };
  }

  /* A linha completa de um documento, com as mesmas colunas do /api/bootstrap:
     o ecra junta-a a lista que ja tem em memoria, e meia linha com ar de linha
     inteira e a maneira mais silenciosa de mentir. */
  const linhaDocumento = async (docId) => (await all(
    `SELECT d.id, d.name, d.entity, d.person_id, d.kind, d.context_id,
            d.status_label, d.status_level,
            to_char(d.issued_on,'YYYY-MM-DD') AS issued_on,
            to_char(d.valid_on,'YYYY-MM-DD')  AS valid_on,
            d.valid_until, (d.read_at IS NOT NULL) AS lido,
            (SELECT l.inbox_id FROM inbox_links l
              WHERE l.target_type = 'documento' AND l.target_id = d.id
              ORDER BY l.inbox_id DESC LIMIT 1) AS inbox_id,
            ARRAY(SELECT l.inbox_id FROM inbox_links l
                   WHERE l.target_type = 'documento' AND l.target_id = d.id
                   ORDER BY l.inbox_id) AS ficheiros,
            COALESCE((SELECT json_agg(json_build_object(
                               'task_id', t.id, 'title', t.title, 'tipo', t.tipo,
                               'papel', td.papel,
                               'paid_on', to_char(t.paid_on, 'YYYY-MM-DD'))
                             ORDER BY t.paid_on DESC NULLS LAST, t.id DESC)
                        FROM task_documents td JOIN tasks t ON t.id = td.task_id
                       WHERE td.document_id = d.id), '[]'::json) AS tarefas
       FROM documents d WHERE d.id = $1`, [docId]))[0];

  const falhaDoc = (res, err, onde) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[farol] ' + onde + ':', err.message);
    res.status(500).json({ error: 'Não foi possível guardar o ficheiro.' });
  };

  /* Os documentos que ainda nao tem papel - com a nota, para quem os vai
     completar saber de que se trata. */
  app.get('/api/documentos/sem-ficheiro', async (req, res) => {
    try {
      res.json({ documentos: await all(
        `SELECT d.id, d.name, d.kind, d.entity, d.note, d.external_id, d.person_id,
                to_char(d.issued_on,'YYYY-MM-DD') AS issued_on, to_char(d.valid_on,'YYYY-MM-DD') AS valid_on
           FROM documents d
          WHERE NOT EXISTS (SELECT 1 FROM inbox_links l
                             WHERE l.target_type = 'documento' AND l.target_id = d.id)
          ORDER BY d.id`) });
    } catch (err) { falhaDoc(res, err, 'GET sem-ficheiro'); }
  });

  /* ---------------------------------------------------------------- *
   * Anexar um ficheiro a partir de uma tarefa
   *
   * O ficheiro nao fica a viver dentro da tarefa: nasce documento, no
   * arquivo, ja aprovado, porque a decisao foi de quem carregou. Um segundo
   * sitio para guardar papeis era um arquivo invisivel ao lado dos
   * Documentos, e ninguem o iria procurar quando a tarefa fechasse.
   *
   * A area e a pessoa herdam-se da tarefa: sao quase sempre as certas, e
   * corrigem-se no ecra dos Documentos como qualquer outro campo.
   * ---------------------------------------------------------------- */

  app.post('/api/tarefas/:id(\\d+)/anexo', upload.single('ficheiro'), async (req, res) => {
    const f = req.file;
    const taskId = Number(req.params.id);
    if (!f) return res.status(400).json({ error: 'Escolhe um ficheiro.' });
    if (!bucketPronto()) return res.status(503).json({ error: 'O armazenamento de ficheiros ainda não está configurado.' });
    const papel = PAPEIS.includes(req.body && req.body.papel) ? req.body.papel : 'anexo';
    try {
      const t = (await all(
        "SELECT id, title, context_id, owner_id FROM tasks WHERE id = $1 AND origin = 'real'", [taskId]))[0];
      if (!t) return res.status(404).json({ error: 'Tarefa não encontrada.' });

      /* O mesmo papel duas vezes nao vira dois documentos: se o ficheiro ja
         esta no arquivo, liga-se a tarefa ao documento que ja havia. */
      const checksum = crypto.createHash('sha256').update(f.buffer).digest('hex');
      const jaHa = (await all(
        `SELECT l.target_id AS documento
           FROM inbox_items i
           JOIN inbox_links l ON l.inbox_id = i.id AND l.target_type = 'documento'
          WHERE i.checksum = $1 AND i.status <> 'descartado'
          ORDER BY i.id LIMIT 1`, [checksum]))[0];

      let docId, repetido = false;
      if (jaHa) {
        docId = jaHa.documento;
        repetido = true;
      } else {
        const nome = String((req.body && req.body.nome) || '').trim()
          || f.originalname.replace(/\.[^.]+$/, '')
          || t.title;
        docId = (await all(
          `INSERT INTO documents (name, person_id, context_id, aprovado, origin, sort)
           VALUES ($1,$2,$3,TRUE,'real',
                   COALESCE((SELECT max(sort) + 1 FROM documents), 1))
           RETURNING id`,
          [nome, t.owner_id, t.context_id]))[0].id;
        await anexarAoDocumento(docId, f.buffer, f.originalname, f.mimetype);
      }

      await query(
        `INSERT INTO task_documents (task_id, document_id, papel) VALUES ($1,$2,$3)
         ON CONFLICT (task_id, document_id) DO UPDATE SET papel = EXCLUDED.papel`,
        [taskId, docId, papel]);

      const doc = await linhaDocumento(docId);
      res.status(201).json({ ok: true, documento: doc, papel, repetido });
    } catch (err) { falhaDoc(res, err, 'POST anexo da tarefa'); }
  });

  /* ---------------------------------------------------------------- *
   * Anexar ficheiros a outras coisas: um evento, uma despesa
   *
   * A mesma ideia da tarefa - o ficheiro nasce documento no arquivo - mas a
   * ligacao vive na item_documents, com o tipo a dizer de quem e. A area e a
   * pessoa herdam-se do item, como na tarefa.
   * ---------------------------------------------------------------- */

  const ITENS = {
    evento: { tabela: 'events', pessoa: 'NULL::int AS person_id', titulo: 'title' },
    despesa: { tabela: 'expenses', pessoa: 'person_id', titulo: 'description AS title' }
  };

  const lerItem = async (tipo, id) => {
    const cfg = ITENS[tipo];
    if (!cfg) return null;
    return (await all(
      `SELECT id, ${cfg.titulo}, context_id, ${cfg.pessoa} FROM ${cfg.tabela} WHERE id = $1`, [id]))[0] || null;
  };

  const papeisDoItem = async (tipo, id) => all(
    `SELECT document_id AS id, papel FROM item_documents
      WHERE tipo = $1 AND item_id = $2 ORDER BY document_id`, [tipo, id]);

  app.post('/api/anexos/:tipo/:id(\\d+)/ficheiro', upload.single('ficheiro'), async (req, res) => {
    const tipo = String(req.params.tipo);
    const id = Number(req.params.id);
    const f = req.file;
    if (!ITENS[tipo]) return res.status(400).json({ error: 'Tipo desconhecido.' });
    if (!f) return res.status(400).json({ error: 'Escolhe um ficheiro.' });
    if (!bucketPronto()) return res.status(503).json({ error: 'O armazenamento de ficheiros ainda não está configurado.' });
    const papel = PAPEIS.includes(req.body && req.body.papel) ? req.body.papel : 'anexo';
    try {
      const item = await lerItem(tipo, id);
      if (!item) return res.status(404).json({ error: 'Não encontrei a que agarrar o ficheiro.' });

      const checksum = crypto.createHash('sha256').update(f.buffer).digest('hex');
      const jaHa = (await all(
        `SELECT l.target_id AS documento
           FROM inbox_items i
           JOIN inbox_links l ON l.inbox_id = i.id AND l.target_type = 'documento'
          WHERE i.checksum = $1 AND i.status <> 'descartado'
          ORDER BY i.id LIMIT 1`, [checksum]))[0];

      let docId, repetido = false;
      if (jaHa) {
        docId = jaHa.documento;
        repetido = true;
      } else {
        const nome = String((req.body && req.body.nome) || '').trim()
          || f.originalname.replace(/\.[^.]+$/, '')
          || item.title;
        docId = (await all(
          `INSERT INTO documents (name, person_id, context_id, aprovado, origin, sort)
           VALUES ($1,$2,$3,TRUE,'real',
                   COALESCE((SELECT max(sort) + 1 FROM documents), 1))
           RETURNING id`,
          [nome, item.person_id, item.context_id]))[0].id;
        await anexarAoDocumento(docId, f.buffer, f.originalname, f.mimetype);
      }

      await query(
        `INSERT INTO item_documents (tipo, item_id, document_id, papel) VALUES ($1,$2,$3,$4)
         ON CONFLICT (tipo, item_id, document_id) DO UPDATE SET papel = EXCLUDED.papel`,
        [tipo, id, docId, papel]);

      res.status(201).json({
        ok: true, papel, repetido,
        documento: await linhaDocumento(docId),
        papeis: await papeisDoItem(tipo, id)
      });
    } catch (err) { falhaDoc(res, err, 'POST anexo de ' + tipo); }
  });

  /* Gravar e sempre a lista inteira, como nas tarefas: o que vier substitui
     o que la estava. */
  app.patch('/api/anexos/:tipo/:id(\\d+)', async (req, res) => {
    const tipo = String(req.params.tipo);
    const id = Number(req.params.id);
    if (!ITENS[tipo]) return res.status(400).json({ error: 'Tipo desconhecido.' });
    const lista = Array.isArray(req.body && req.body.documents) ? req.body.documents : null;
    if (!lista) return res.status(400).json({ error: 'Faltam os documentos.' });
    try {
      if (!(await lerItem(tipo, id))) return res.status(404).json({ error: 'Não encontrei o item.' });
      const refs = lista.map((x) => ({
        id: Number(x && x.id !== undefined ? x.id : x),
        papel: PAPEIS.includes(x && x.papel) ? x.papel : 'anexo'
      })).filter((x) => Number.isInteger(x.id));
      await query('DELETE FROM item_documents WHERE tipo = $1 AND item_id = $2', [tipo, id]);
      for (const r of refs) {
        await query(
          `INSERT INTO item_documents (tipo, item_id, document_id, papel) VALUES ($1,$2,$3,$4)
           ON CONFLICT (tipo, item_id, document_id) DO UPDATE SET papel = EXCLUDED.papel`,
          [tipo, id, r.id, r.papel]);
      }
      res.json({ ok: true, papeis: await papeisDoItem(tipo, id) });
    } catch (err) { falhaDoc(res, err, 'PATCH anexos de ' + tipo); }
  });

  app.post('/api/documentos/:id/ficheiro', upload.single('ficheiro'), async (req, res) => {
    const f = req.file;
    if (!f) return res.status(400).json({ error: 'Escolhe um ficheiro.' });
    if (!bucketPronto()) return res.status(503).json({ error: 'O armazenamento de ficheiros ainda não está configurado.' });
    try {
      res.status(201).json(await anexarAoDocumento(Number(req.params.id), f.buffer, f.originalname, f.mimetype));
    } catch (err) { falhaDoc(res, err, 'POST ficheiro do documento'); }
  });

  /* Quando o documento e so texto (um numero, uma morada, uma apolice
     anotada), o ficheiro e a propria nota, em PDF. */
  app.post('/api/documentos/:id/ficheiro-da-nota', async (req, res) => {
    if (!bucketPronto()) return res.status(503).json({ error: 'O armazenamento de ficheiros ainda não está configurado.' });
    try {
      const r = await all(
        `SELECT d.id, d.name, d.kind, d.entity, d.note, p.name AS pessoa, c.name AS area,
                to_char(d.issued_on,'YYYY-MM-DD') AS issued_on, to_char(d.valid_on,'YYYY-MM-DD') AS valid_on
           FROM documents d
           LEFT JOIN people p ON p.id = d.person_id
           LEFT JOIN contexts c ON c.id = d.context_id
          WHERE d.id = $1`, [Number(req.params.id)]);
      if (!r.length) return res.status(404).json({ error: 'Documento não encontrado.' });
      const d = r[0];
      if (!String(d.note || '').trim()) return res.status(400).json({ error: 'Este documento não tem nota para passar a PDF.' });
      const meta = [
        d.kind && 'Tipo: ' + d.kind, d.pessoa && 'Pessoa: ' + d.pessoa, d.area && 'Área: ' + d.area,
        d.entity && 'Entidade: ' + d.entity, d.issued_on && 'Emitido: ' + d.issued_on,
        d.valid_on && 'Válido até: ' + d.valid_on
      ].filter(Boolean).join('  ·  ');
      const buffer = pdf.gerar([
        { texto: d.name, corpo: 16, negrito: true },
        { texto: meta, corpo: 9, cor: 0.4, antes: 4 },
        { texto: d.note, corpo: 11, antes: 14 },
        { texto: 'Gerado pelo Farol a partir da nota do documento, a ' + new Date().toISOString().slice(0, 10) + '.',
          corpo: 8, cor: 0.55, antes: 18 }
      ], { titulo: d.name });
      const nome = d.name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) + '.pdf';
      res.status(201).json(await anexarAoDocumento(d.id, buffer, nome, 'application/pdf'));
    } catch (err) { falhaDoc(res, err, 'POST ficheiro da nota'); }
  });
}

module.exports = { instalar, bucketPronto, arquivoPronto: () => pronto('arquivo') };
