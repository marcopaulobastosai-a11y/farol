'use strict';
/**
 * Farol — a papelada de uma empresa.
 *
 * Uma sub-área do Profissional pode ser uma empresa dele (a Cúpula Arejada,
 * a Falua Vibrante) ou o sítio onde trabalha (o Crédito Agrícola). Não se
 * espera a mesma papelada de uma e de outra: de uma empresa sua espera-se a
 * certidão, o RCBE, as licenças, os seguros obrigatórios e as contas; de um
 * empregador espera-se o contrato, os recibos, o carro e as apólices de que
 * ele é beneficiário. Daí dois modelos.
 *
 * O modelo é só o ponto de partida. Mal se escolhe o papel da sub-área, as
 * linhas são copiadas para `context_papelada` e passam a ser dela: ele tira o
 * que não se aplica, marca como dispensado o que não tem de ter, e acrescenta
 * o que o modelo não previu. Mudar o modelo depois não lhe mexe no que já
 * arrumou — o que é o ponto.
 *
 * Uma linha dá-se por cumprida com um documento da sub-área. Encontra-se
 * sozinho (pelo tipo e pelas palavras) ou escolhe-se à mão; a escolha à mão
 * ganha sempre. O que tem validade a acabar, ou o que renova todos os anos e
 * já tem mais de um ano, aparece a avisar — mas não nasce tarefa nenhuma sem
 * ele mandar: a secção mostra, ele decide.
 */
const { query } = require('./db');
const all = async (sql, params) => (await query(sql, params)).rows;

/* Quantos dias antes do fim e que um papel comeca a avisar. */
const AVISO_DIAS = 60;

/* ---------------- os dois modelos ---------------- */
/* kind: o tipo de papel esperado (os tipos do Farol).
   procura: palavras que o encontram no arquivo, separadas por |.
   renova: 'anual' ou 'mensal' - um papel que se repete e nao se guarda uma
           vez para sempre.
   obrigatorio: a lei pede, nao e so arrumacao. */
const MODELOS = {
  empresa: [
    ['Identidade', 'Certidão permanente do registo comercial', { kind: 'certidao', procura: 'certid|registo comercial|permanente', renova: 'anual', obrigatorio: true, nota: 'O código de acesso renova todos os anos.' }],
    ['Identidade', 'Pacto social / estatutos', { kind: 'contrato', procura: 'pacto social|estatutos|constitui' }],
    ['Identidade', 'Cartão de pessoa coletiva (NIPC)', { kind: 'cartao', procura: 'pessoa colectiva|pessoa coletiva|nipc' }],
    ['Identidade', 'Declaração de início de atividade', { kind: 'declaracao', procura: 'in[ií]cio de atividade|in[ií]cio de actividade' }],
    ['Identidade', 'RCBE — beneficiário efetivo', { kind: 'declaracao', procura: 'rcbe|benefici[áa]rio efetivo|benefici[áa]rio efectivo', renova: 'anual', obrigatorio: true, nota: 'Confirma-se todos os anos, mesmo que nada mude.' }],

    ['Licenças', 'Licença de utilização do espaço', { kind: 'licenca', procura: 'licen[çc]a de utiliza' }],
    ['Licenças', 'Licenciamento da atividade', { kind: 'licenca', procura: 'licenciamento|comunica[çc][ãa]o pr[ée]via|asae', obrigatorio: true }],
    ['Licenças', 'Livro de reclamações (físico e digital)', { kind: 'licenca', procura: 'livro de reclama', obrigatorio: true }],
    ['Licenças', 'Política de privacidade / RGPD', { kind: 'declaracao', procura: 'rgpd|privacidade|prote[çc][ãa]o de dados' }],

    ['Espaço', 'Contrato de arrendamento (e adendas)', { kind: 'contrato', procura: 'arrendamento|renda' }],
    ['Espaço', 'Caderneta predial do locado', { kind: 'caderneta', procura: 'caderneta' }],
    ['Espaço', 'Contratos de eletricidade, água e comunicações', { kind: 'contrato', procura: 'eletricidade|electricidade|[áa]gua|comunica|meo|nos|vodafone|energy' }],

    ['Exploração', 'Contrato de franchising (e adendas)', { kind: 'contrato', procura: 'franch|franquia' }],
    ['Exploração', 'Avença da contabilidade', { kind: 'contrato', procura: 'aven[çc]a|contabilidade|contabilista' }],
    ['Exploração', 'Contratos de fornecedores recorrentes', { kind: 'contrato', procura: 'fornecedor|royalt' }],

    ['Seguros', 'Multirriscos empresas', { kind: 'seguro', procura: 'multirrisco|mr empresas' }],
    ['Seguros', 'Acidentes de trabalho', { kind: 'seguro', procura: 'acidentes de trabalho', obrigatorio: true, nota: 'Obrigatório desde o primeiro trabalhador.' }],
    ['Seguros', 'Responsabilidade civil', { kind: 'seguro', procura: 'responsabilidade civil', nota: 'Só é preciso em separado se não vier no multirriscos.' }],

    ['Pessoas', 'Contratos de trabalho', { kind: 'contrato', procura: 'contrato de trabalho', obrigatorio: true }],
    ['Pessoas', 'Comunicações de admissão à Segurança Social', { kind: 'declaracao', procura: 'admiss[ãa]o|seguran[çc]a social', obrigatorio: true }],
    ['Pessoas', 'Declarações de remunerações', { kind: 'declaracao', procura: 'remunera', renova: 'mensal', obrigatorio: true }],
    ['Pessoas', 'Mapa de férias e registo de horários', { kind: 'declaracao', procura: 'f[ée]rias|hor[áa]rio', renova: 'anual', obrigatorio: true }],
    ['Pessoas', 'Medicina no trabalho — contrato e fichas de aptidão', { kind: 'contrato', procura: 'medicina no trabalho|aptid[ãa]o', obrigatorio: true }],

    ['Fiscal', 'IES / prestação de contas', { kind: 'declaracao', procura: '\\bies\\b|presta[çc][ãa]o de contas', renova: 'anual', obrigatorio: true }],
    ['Fiscal', 'Modelo 22 (IRC)', { kind: 'declaracao', procura: 'modelo 22|irc', renova: 'anual', obrigatorio: true }],
    ['Fiscal', 'Declarações de IVA', { kind: 'declaracao', procura: 'iva', renova: 'mensal', obrigatorio: true }],
    ['Fiscal', 'Retenções na fonte', { kind: 'declaracao', procura: 'reten[çc]', renova: 'mensal' }],
    ['Fiscal', 'Balancetes e balanço do exercício', { kind: 'declaracao', procura: 'balancete|balan[çc]o', renova: 'anual' }],
    ['Fiscal', 'Ata de aprovação de contas', { kind: 'declaracao', procura: '\\bata\\b|aprova[çc][ãa]o de contas', renova: 'anual', obrigatorio: true }],

    ['Banca e faturação', 'Abertura de conta e autorizações', { kind: 'contrato', procura: 'abertura de conta|ficha de assinatura' }],
    ['Banca e faturação', 'Contrato do TPA', { kind: 'contrato', procura: '\\btpa\\b|terminal de pagamento' }],
    ['Banca e faturação', 'Autorizações de débito direto em vigor', { kind: 'declaracao', procura: 'd[ée]bito direto|d[ée]bito directo|autoriza' }],
    ['Banca e faturação', 'Certificação do software de faturação', { kind: 'declaracao', procura: 'certifica|software|fatura[çc][ãa]o', obrigatorio: true }],
    ['Banca e faturação', 'SAFT mensais', { kind: 'declaracao', procura: 'saft|saf-t', renova: 'mensal', obrigatorio: true }],

    ['Equipamento', 'Faturas do equipamento (são a garantia)', { kind: 'fatura', procura: 'equipamento|m[áa]quina' }],
    ['Equipamento', 'Manuais e contratos de manutenção', { kind: 'contrato', procura: 'manuten[çc][ãa]o|manual' }]
  ],

  empregador: [
    ['Vínculo', 'Contrato de trabalho (e adendas)', { kind: 'contrato', procura: 'contrato de trabalho|adenda' }],
    ['Vínculo', 'Cartão de empresa / crachá', { kind: 'cartao', procura: 'cart[ãa]o|crach' }],
    ['Vínculo', 'Declaração da entidade patronal', { kind: 'declaracao', procura: 'entidade patronal|declara[çc][ãa]o de rendimentos', renova: 'anual' }],

    ['Dinheiro', 'Recibos de vencimento', { kind: 'recibo', procura: 'vencimento|ordenado|sal[áa]rio', renova: 'mensal' }],
    ['Dinheiro', 'Objetivos e prémios do ano', { kind: 'declaracao', procura: 'objetivo|objectivo|pr[ée]mio' }],
    ['Dinheiro', 'Despesas de representação', { kind: 'declaracao', procura: 'representa[çc][ãa]o', nota: 'O controlo do dinheiro está nas Finanças; aqui ficam as regras e os mapas.' }],

    ['Carro e cartões', 'Atribuição da viatura', { kind: 'contrato', procura: 'viatura|autom[óo]vel|\\bx3\\b|renting' }],
    ['Carro e cartões', 'Seguro e documentos da viatura', { kind: 'seguro', procura: 'seguro|ap[óo]lice' }],
    ['Carro e cartões', 'Cartão de combustível', { kind: 'cartao', procura: 'combust[íi]vel|galp|bp\\b|via verde' }],

    ['Seguros e benefícios', 'Seguro de saúde', { kind: 'seguro', procura: 'sa[úu]de|sams|m[ée]dic' }],
    ['Seguros e benefícios', 'Acidentes de trabalho', { kind: 'seguro', procura: 'acidentes de trabalho' }],
    ['Seguros e benefícios', 'Seguro de vida / fundo de pensões', { kind: 'seguro', procura: 'vida|pens[õo]es|poupan' }],
    ['Seguros e benefícios', 'Protocolos e benefícios', { kind: 'outro', procura: 'protocolo|benef[íi]cio' }],

    ['Regras e formação', 'Regulamento interno e código de conduta', { kind: 'declaracao', procura: 'regulamento|c[óo]digo de conduta|[ée]tica' }],
    ['Regras e formação', 'Políticas assinadas (RGPD, segurança)', { kind: 'declaracao', procura: 'rgpd|pol[íi]tica|seguran[çc]a da informa' }],
    ['Regras e formação', 'Formações e certificações', { kind: 'certidao', procura: 'forma[çc][ãa]o|certifica|curso' }],

    ['Desempenho', 'Avaliações de desempenho', { kind: 'declaracao', procura: 'avalia[çc][ãa]o|desempenho', renova: 'anual' }],
    ['Desempenho', 'Descrição de funções', { kind: 'declaracao', procura: 'fun[çc][õo]es|descritivo|job description' }]
  ]
};

const PAPEIS = Object.keys(MODELOS);

/* ---------------- semear e ler ---------------- */

/* Copia o modelo para a sub-area. So acrescenta o que falta, para nao
   duplicar nem apagar o que ele ja mexeu. */
async function semear(contextId, papel) {
  const modelo = MODELOS[papel];
  if (!modelo) return 0;
  const ja = new Set((await all('SELECT titulo FROM context_papelada WHERE context_id = $1', [contextId]))
    .map((r) => r.titulo));
  let n = 0;
  for (let i = 0; i < modelo.length; i += 1) {
    const [bloco, titulo, o] = modelo[i];
    if (ja.has(titulo)) continue;
    await query(
      `INSERT INTO context_papelada (context_id, bloco, titulo, nota, kind, procura, renova, obrigatorio, sort)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [contextId, bloco, titulo, o.nota || null, o.kind || null, o.procura || null,
       o.renova || null, Boolean(o.obrigatorio), i]);
    n += 1;
  }
  return n;
}

function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
}
function maisDias(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  return new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
}

/* Os documentos da sub-area que servem uma linha. O tipo filtra; as palavras
   filtram; nenhum dos dois posto significa «qualquer um», que nao ajuda - por
   isso uma linha sem tipo nem palavras so conta com o documento escolhido a
   mao. */
function serve(linha, doc) {
  if (!linha.kind && !linha.procura) return false;
  if (linha.kind && doc.kind !== linha.kind) return false;
  if (linha.procura) {
    let re;
    try { re = new RegExp(linha.procura, 'i'); } catch (e) { return false; }
    if (!re.test((doc.name || '') + ' ' + (doc.entity || ''))) return false;
  }
  return true;
}

/* Em que pe esta cada linha. */
function estadoDa(linha, docs, hoje) {
  if (linha.dispensado) return { estado: 'dispensado', docs: [] };
  const escolhido = linha.document_id ? docs.filter((d) => d.id === linha.document_id) : [];
  const achados = escolhido.length ? escolhido : docs.filter((d) => serve(linha, d));
  if (!achados.length) return { estado: 'falta', docs: [] };
  /* O mais recente manda: e esse que diz se ainda esta bom. */
  const ordenados = achados.slice().sort((a, b) =>
    String(b.issued_on || '').localeCompare(String(a.issued_on || '')));
  const topo = ordenados[0];
  const fim = topo.valid_on || null;
  if (fim && fim < hoje) return { estado: 'caducado', docs: ordenados, ate: fim };
  if (fim && fim <= maisDias(hoje, AVISO_DIAS)) return { estado: 'caduca', docs: ordenados, ate: fim };
  /* Sem validade escrita, um papel que renova todos os anos vale um ano. */
  if (!fim && linha.renova === 'anual' && topo.issued_on && topo.issued_on < maisDias(hoje, -365)) {
    return { estado: 'caduca', docs: ordenados, desde: topo.issued_on };
  }
  return { estado: 'tem', docs: ordenados, ate: fim };
}

async function ler(contextId) {
  const ctx = (await all('SELECT id, name, papel FROM contexts WHERE id = $1', [contextId]))[0];
  if (!ctx) { const e = new Error('Sub-área não encontrada.'); e.status = 404; throw e; }
  const linhas = await all(
    `SELECT id, bloco, titulo, nota, kind, procura, renova, obrigatorio, dispensado, document_id, sort
       FROM context_papelada WHERE context_id = $1 ORDER BY sort, id`, [contextId]);
  const docs = await all(
    /* A validade a serio e o valid_on (data); o valid_until e um rotulo de
       texto, do tempo em que se escrevia «ate 2027» a mao. */
    /* O inbox_id e o ficheiro em si: o documento e a ficha, o papel digitalizado
       esta na caixa que o trouxe. Sem isto o nome nao abria nada. */
    `SELECT d.id, d.name, d.entity, d.kind, to_char(d.issued_on,'YYYY-MM-DD') AS issued_on,
            to_char(d.valid_on,'YYYY-MM-DD') AS valid_on, d.valid_until,
            (d.read_at IS NOT NULL) AS lido,
            (SELECT l.inbox_id FROM inbox_links l
              WHERE l.target_type = 'documento' AND l.target_id = d.id
              ORDER BY l.inbox_id DESC LIMIT 1) AS inbox_id
       FROM documents d WHERE d.context_id = $1 AND d.aprovado
      ORDER BY d.issued_on DESC NULLS LAST, d.id DESC`,
    [contextId]);
  const hoje = hojeISO();
  const comEstado = linhas.map((l) => Object.assign({}, l, estadoDa(l, docs, hoje)));
  /* Os papeis que estao la mas nao pertencem a nenhuma linha: nao sao um
     problema, mas e bom ve-los - e deles que saem as linhas que faltavam. */
  const usados = new Set();
  comEstado.forEach((l) => (l.docs || []).forEach((d) => usados.add(d.id)));
  const resumo = { tem: 0, falta: 0, caduca: 0, caducado: 0, dispensado: 0, faltaObrig: 0 };
  comEstado.forEach((l) => {
    resumo[l.estado] = (resumo[l.estado] || 0) + 1;
    if (l.obrigatorio && (l.estado === 'falta' || l.estado === 'caducado')) resumo.faltaObrig += 1;
  });
  return {
    contexto: { id: ctx.id, nome: ctx.name, papel: ctx.papel || null },
    papeis: PAPEIS,
    linhas: comEstado,
    soltos: docs.filter((d) => !usados.has(d.id)),
    resumo
  };
}

/* ---------------- rotas ---------------- */
function instalar(app) {
  const falha = (res, err, onde) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[farol] papelada ' + onde + ':', err.message);
    return res.status(500).json({ error: 'Não foi possível tratar a papelada.' });
  };

  app.get('/api/papelada/:id(\\d+)', async (req, res) => {
    try { res.json(await ler(Number(req.params.id))); }
    catch (err) { falha(res, err, 'GET'); }
  });

  /* Dizer o que a sub-area e. Mudar para «empresa» ou «empregador» semeia o
     modelo; voltar a vazio nao apaga o que ja la esta. */
  app.patch('/api/papelada/:id(\\d+)/papel', async (req, res) => {
    const id = Number(req.params.id);
    const papel = PAPEIS.includes((req.body || {}).papel) ? req.body.papel : null;
    try {
      await query('UPDATE contexts SET papel = $1 WHERE id = $2', [papel, id]);
      const semeadas = papel ? await semear(id, papel) : 0;
      res.json(Object.assign({ semeadas }, await ler(id)));
    } catch (err) { falha(res, err, 'PATCH papel'); }
  });

  /* Uma linha a mais, das dele. */
  app.post('/api/papelada/:id(\\d+)', async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    const titulo = String(b.titulo || '').trim();
    if (!titulo) return res.status(400).json({ error: 'Falta o nome do papel.' });
    try {
      const [{ s }] = await all('SELECT COALESCE(max(sort),0) + 1 AS s FROM context_papelada WHERE context_id = $1', [id]);
      await query(
        `INSERT INTO context_papelada (context_id, bloco, titulo, nota, kind, procura, renova, obrigatorio, sort)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, String(b.bloco || 'Outros').trim() || 'Outros', titulo.slice(0, 160),
         (b.nota || null), (b.kind || null), (b.procura || null), (b.renova || null),
         Boolean(b.obrigatorio), s]);
      res.json(await ler(id));
    } catch (err) { falha(res, err, 'POST linha'); }
  });

  app.patch('/api/papelada/linha/:id(\\d+)', async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    const sets = [], vals = [id];
    ['bloco', 'titulo', 'nota', 'kind', 'procura', 'renova'].forEach((c) => {
      if (b[c] !== undefined) { vals.push(b[c] === '' ? null : b[c]); sets.push(c + ' = $' + vals.length); }
    });
    ['obrigatorio', 'dispensado'].forEach((c) => {
      if (b[c] !== undefined) { vals.push(Boolean(b[c])); sets.push(c + ' = $' + vals.length); }
    });
    if (b.document_id !== undefined) { vals.push(b.document_id || null); sets.push('document_id = $' + vals.length); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para mudar.' });
    try {
      const r = await all('UPDATE context_papelada SET ' + sets.join(', ') + ' WHERE id = $1 RETURNING context_id', vals);
      if (!r.length) return res.status(404).json({ error: 'Linha não encontrada.' });
      res.json(await ler(r[0].context_id));
    } catch (err) { falha(res, err, 'PATCH linha'); }
  });

  app.delete('/api/papelada/linha/:id(\\d+)', async (req, res) => {
    try {
      const r = await all('DELETE FROM context_papelada WHERE id = $1 RETURNING context_id', [Number(req.params.id)]);
      if (!r.length) return res.status(404).json({ error: 'Linha não encontrada.' });
      res.json(await ler(r[0].context_id));
    } catch (err) { falha(res, err, 'DELETE linha'); }
  });

  console.log('[farol] papelada: rotas prontas.');
}

module.exports = { instalar, MODELOS, PAPEIS, ler, semear };
