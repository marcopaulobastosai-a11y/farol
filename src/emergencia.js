'use strict';
/**
 * Farol - o stock de emergencia (19 nov 2026).
 *
 * Casa > Emergencia: 72 horas de autonomia para o agregado, como pedem a
 * Comissao Europeia (Estrategia de Preparacao, 2025) e a ANEPC: 3 litros de
 * agua por pessoa por dia, comida que se come sem cozinhar, luz, radio,
 * primeiros socorros, documentos, dinheiro e uma mochila para sair depressa.
 *
 * A sub-area e uma sub-area como as outras (contexts), marcada com o papel
 * 'emergencia'. Vive ao lado das casas e nao dentro de uma: muda-se com a
 * familia sem se mexer em nada.
 *
 *   GET    /api/emergencia              artigos, metas, resumo e plano
 *   POST   /api/emergencia/preparar     cria a sub-area, a lista recomendada e a rotina
 *   POST   /api/emergencia/itens        artigo novo
 *   PATCH  /api/emergencia/itens/:id    tenho, validade, onde, meta...
 *   DELETE /api/emergencia/itens/:id
 *   POST   /api/emergencia/comprei      { item_id, qtd, validade } - soma ao stock
 *   POST   /api/emergencia/compra       cria a tarefa de compra, um passo por artigo
 *   PUT    /api/emergencia/definicoes   { pessoas, plano }
 */
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;
const CHAVE = 'emergencia';
const AVISO_DIAS = 60;

function hojeLisboa() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
}
function maisDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

const CATEGORIAS = [
  ['agua', 'Água e bebidas'],
  ['alim', 'Alimentação'],
  ['luz', 'Luz, energia e comunicação'],
  ['saude', 'Saúde e primeiros socorros'],
  ['hig', 'Higiene e saneamento'],
  ['abrigo', 'Abrigo e ferramentas'],
  ['docs', 'Documentos e dinheiro'],
  ['animal', 'Animais'],
  ['conf', 'Conforto']
];
const ONDE = ['despensa', 'mochila', 'entrada'];

/* A lista recomendada. Por pessoa = para os 3 dias.
   [categoria, nome, unidade, por_pessoa, quantidade, onde, loja, nota, opcional] */
const MODELO = [
  ['agua', 'Água potável (garrafas 1,5 L)', 'garrafas', 6, null, 'despensa', 'Supermercado', '3 L por pessoa por dia (ANEPC)'],
  ['agua', 'Água para higiene (garrafões 5 L)', 'garrafões', 1.2, null, 'despensa', 'Supermercado', 'mãos, loiça, sanita'],
  ['agua', 'Leite UHT 1 L', 'pacotes', 1, null, 'despensa', 'Supermercado', ''],
  ['agua', 'Sumos em pacote 200 ml', 'pacotes', 3, null, 'despensa', 'Supermercado', ''],
  ['alim', 'Conservas de peixe (atum, sardinha)', 'latas', 3, null, 'despensa', 'Supermercado', 'de abertura fácil'],
  ['alim', 'Grão e feijão cozidos', 'frascos', 1.5, null, 'despensa', 'Supermercado', ''],
  ['alim', 'Refeições prontas em lata', 'latas', 1.5, null, 'despensa', 'Supermercado', 'comem-se frias'],
  ['alim', 'Tostas / bolachas de água e sal', 'pacotes', 1, null, 'despensa', 'Supermercado', ''],
  ['alim', 'Barras de cereais', 'barras', 6, null, 'mochila', 'Supermercado', ''],
  ['alim', 'Frutos secos (saquetas 100 g)', 'saquetas', 3, null, 'mochila', 'Supermercado', ''],
  ['alim', 'Fruta em lata / puré de fruta', 'unid.', 1, null, 'despensa', 'Supermercado', ''],
  ['alim', 'Chocolate', 'tabletes', 1, null, 'despensa', 'Supermercado', ''],
  ['alim', 'Abre-latas manual', 'unid.', null, 1, 'despensa', 'Supermercado', ''],
  ['alim', 'Pratos, copos e talheres descartáveis', 'packs', null, 1, 'despensa', 'Supermercado', ''],
  ['alim', 'Fogareiro de campismo + 2 cartuchos de gás', 'kit', null, 1, 'despensa', 'Desporto', 'usar só ao ar livre — nunca dentro de casa'],
  ['luz', 'Rádio FM a pilhas ou a manivela', 'unid.', null, 1, 'mochila', 'Desporto', 'para ouvir as indicações oficiais'],
  ['luz', 'Lanternas LED', 'unid.', 0.5, null, 'mochila', 'Desporto', 'uma por cada duas pessoas'],
  ['luz', 'Pilhas AA (pack de 8)', 'packs', null, 2, 'despensa', 'Supermercado', ''],
  ['luz', 'Pilhas AAA (pack de 8)', 'packs', null, 1, 'despensa', 'Supermercado', ''],
  ['luz', 'Powerbank 20 000 mAh', 'unid.', null, 2, 'mochila', 'Eletrónica', 'carregar em cada revisão'],
  ['luz', 'Velas, isqueiro e fósforos', 'kit', null, 1, 'despensa', 'Supermercado', ''],
  ['luz', 'Apito', 'unid.', 1, null, 'mochila', 'Desporto', 'recomendação da ANEPC'],
  ['saude', 'Estojo de primeiros socorros', 'unid.', null, 1, 'mochila', 'Farmácia', 'pensos, ligaduras, desinfetante, tesoura'],
  ['saude', 'Medicação habitual — reserva de 7 dias', 'reservas', 1, null, 'mochila', 'Farmácia', 'uma por pessoa que tome medicação'],
  ['saude', 'Analgésico / antipirético', 'caixas', null, 2, 'mochila', 'Farmácia', ''],
  ['saude', 'Termómetro', 'unid.', null, 1, 'mochila', 'Farmácia', ''],
  ['saude', 'Máscaras FFP2', 'unid.', 2, null, 'mochila', 'Farmácia', ''],
  ['saude', 'Pastilhas purificadoras de água', 'caixas', null, 1, 'mochila', 'Farmácia', ''],
  ['hig', 'Toalhitas', 'pacotes', 1, null, 'mochila', 'Supermercado', ''],
  ['hig', 'Gel desinfetante', 'frascos', null, 2, 'mochila', 'Supermercado', ''],
  ['hig', 'Papel higiénico', 'rolos', 2, null, 'despensa', 'Supermercado', ''],
  ['hig', 'Sacos do lixo resistentes', 'rolos', null, 1, 'despensa', 'Supermercado', ''],
  ['hig', 'Higiene íntima', 'packs', null, 1, 'mochila', 'Supermercado', ''],
  ['abrigo', 'Mantas térmicas', 'unid.', 1, null, 'mochila', 'Desporto', ''],
  ['abrigo', 'Capas de chuva', 'unid.', 1, null, 'mochila', 'Desporto', 'recomendação da ANEPC'],
  ['abrigo', 'Canivete multiusos', 'unid.', null, 1, 'mochila', 'Desporto', ''],
  ['abrigo', 'Fita adesiva larga', 'rolos', null, 1, 'despensa', 'Bricolage', ''],
  ['abrigo', 'Mochila de saída rápida', 'mochilas', 1, null, 'entrada', 'Desporto', 'uma por pessoa, leve'],
  ['docs', 'Dinheiro em notas pequenas e moedas', 'envelope', null, 1, 'mochila', 'Banco', 'valor no Plano'],
  ['docs', 'Bolsa impermeável para documentos', 'bolsa', null, 1, 'mochila', 'Bricolage', 'com as cópias dos documentos'],
  ['docs', 'Contactos de emergência em papel', 'folhas', 1, null, 'mochila', '', 'imprime-se no Plano'],
  ['docs', 'Chaves suplentes', 'molho', null, 1, 'mochila', '', ''],
  ['animal', 'Ração do Brownie (5 dias)', 'sacos', null, 1, 'despensa', 'Loja de animais', ''],
  ['animal', 'Água para o Brownie (garrafas 1,5 L)', 'garrafas', null, 2, 'despensa', 'Supermercado', ''],
  ['animal', 'Tigela dobrável', 'unid.', null, 1, 'mochila', 'Loja de animais', ''],
  ['animal', 'Trela suplente + cópia do boletim de vacinas', 'kit', null, 1, 'mochila', 'Loja de animais', ''],
  ['conf', 'Baralho de cartas / jogos', 'unid.', null, 1, 'mochila', '', 'passar o tempo sem ecrãs']
];

/* ---------------- definicoes ---------------- */
async function lerDef() {
  const r = await all('SELECT value FROM settings WHERE key = $1', [CHAVE]);
  let v = {};
  try { v = r.length ? JSON.parse(r[0].value) || {} : {}; } catch (e) { v = {}; }
  if (!v.plano || typeof v.plano !== 'object') v.plano = {};
  return v;
}
async function gravarDef(v) {
  await query(`INSERT INTO settings (key, value) VALUES ($1, $2)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [CHAVE, JSON.stringify(v)]);
}
/* Quantas pessoas, se ainda ninguem disse: as do agregado e da familia
   alargada que nao sao animais. */
async function pessoasPorOmissao() {
  const r = await all(
    `SELECT count(*)::int AS n FROM people
      WHERE active AND origin = 'real' AND kind <> 'animal'
        AND COALESCE(circulo, CASE WHEN kind = 'familiar' THEN 'alargada' ELSE 'agregado' END) IN ('agregado', 'alargada')`);
  return Math.max(1, r[0].n || 1);
}

async function contexto() {
  const r = await all(
    `SELECT c.id, c.name, c.parent_id, p.name AS pai FROM contexts c LEFT JOIN contexts p ON p.id = c.parent_id
      WHERE c.papel = 'emergencia' ORDER BY c.id LIMIT 1`);
  return r[0] || null;
}

function meta(it, pessoas) {
  if (it.por_pessoa != null) return Math.ceil(Number(it.por_pessoa) * pessoas - 1e-9);
  return Number(it.quantidade || 0);
}

async function estado() {
  const def = await lerDef();
  const pessoas = Number(def.pessoas) > 0 ? Number(def.pessoas) : await pessoasPorOmissao();
  const ctx = await contexto();
  const hoje = hojeLisboa();
  const limite = maisDias(hoje, AVISO_DIAS);
  const linhas = await all(
    `SELECT id, categoria, nome, unidade, por_pessoa::float AS por_pessoa, quantidade::float AS quantidade,
            tenho::float AS tenho, to_char(validade, 'YYYY-MM-DD') AS validade, onde, loja, nota, opcional, sort
       FROM emergencia_itens ORDER BY sort, id`);
  const lotesPor = {};
  (await all(
    `SELECT id, item_id, descricao, qtd::float AS qtd, to_char(validade, 'YYYY-MM-DD') AS validade
       FROM emergencia_lotes ORDER BY validade NULLS LAST, id`))
    .forEach((l) => { (lotesPor[l.item_id] = lotesPor[l.item_id] || []).push(l); });
  /* Pendentes na tarefa de compra aberta: para a lista saber o que ja la esta. */
  const compra = (await all(
    `SELECT t.id FROM tasks t
      WHERE t.origin = 'real' AND NOT t.done AND t.status NOT IN ('concluida','cancelada')
        AND EXISTS (SELECT 1 FROM emergencia_compras c WHERE c.task_id = t.id)
      ORDER BY t.id DESC LIMIT 1`))[0] || null;
  const naCompra = {};
  if (compra) {
    (await all('SELECT item_id, qtd::float AS qtd FROM emergencia_compras WHERE task_id = $1 AND NOT aplicado', [compra.id]))
      .forEach((c) => { naCompra[c.item_id] = (naCompra[c.item_id] || 0) + c.qtd; });
  }
  let obrig = 0, completos = 0, caducar = 0, emFalta = 0, caducados = 0;
  let aguaTem = 0, aguaMeta = 0;
  const itens = linhas.map((it) => {
    const m = meta(it, pessoas);
    const aCaducar = Boolean(it.validade && it.tenho > 0 && it.validade <= limite);
    const caducou = Boolean(it.validade && it.tenho > 0 && it.validade < hoje);
    let est;
    if (caducou) est = 'caducado';
    else if (aCaducar) est = 'caducar';
    else if (it.tenho >= m) est = 'completo';
    else if (it.tenho <= 0) est = it.opcional ? 'opcional' : 'falta';
    else est = 'incompleto';
    if (!it.opcional) { obrig += 1; if (it.tenho >= m) completos += 1; if (it.tenho <= 0) emFalta += 1; }
    if (aCaducar) caducar += 1;
    if (caducou) caducados += 1;
    if (/^Água potável/.test(it.nome)) { aguaTem = it.tenho * 1.5; aguaMeta = m * 1.5; }
    const falta = Math.max(0, m - it.tenho);
    const repor = (lotesPor[it.id] || []).filter((l) => l.validade && l.qtd > 0 && l.validade <= limite)
      .reduce((a, l) => a + l.qtd, 0);
    return Object.assign(it, {
      meta: m, estado: est, falta,
      dias: it.validade ? Math.round((Date.parse(it.validade) - Date.parse(hoje)) / 86400000) : null,
      na_compra: naCompra[it.id] || 0,
      repor: Math.round(repor * 100) / 100,
      comprar: Math.round((falta + repor) * 100) / 100,
      lotes: lotesPor[it.id] || []
    });
  });
  const gente = await all(
    `SELECT id, name, phone, kind FROM people
      WHERE active AND origin = 'real'
        AND COALESCE(circulo, CASE WHEN kind = 'familiar' THEN 'alargada' ELSE 'agregado' END) IN ('agregado', 'alargada')
      ORDER BY sort, id`);
  return {
    ctx, pessoas, plano: def.plano, gente, categorias: CATEGORIAS, aviso_dias: AVISO_DIAS, hoje,
    compra_id: compra ? compra.id : null,
    itens,
    resumo: {
      artigos: itens.length, obrigatorios: obrig, completos, caducar, caducados, em_falta: emFalta,
      prontidao: obrig ? Math.round(completos / obrig * 100) : 0,
      agua_tem: aguaTem, agua_meta: aguaMeta,
      por_comprar: itens.filter((i) => i.falta > 0 || i.estado === 'caducar' || i.estado === 'caducado').length
    }
  };
}

function numero(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}
function data(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null; }
function texto(v, max) { const s = String(v == null ? '' : v).trim(); return s ? s.slice(0, max || 200) : null; }

/* Os lotes de um artigo, trocados de uma vez (a janela do artigo manda a
   lista inteira). Lotes sem quantidade nao ficam. */
async function gravarLotes(itemId, lotes) {
  await query('DELETE FROM emergencia_lotes WHERE item_id = $1 AND compra_id IS NULL', [itemId]);
  for (const l of (Array.isArray(lotes) ? lotes : []).slice(0, 60)) {
    const q = numero(l.qtd);
    if (!q) continue;
    if (l.id && Number(l.id) > 0) {
      const ja = await all('UPDATE emergencia_lotes SET descricao = $3, qtd = $4, validade = $5 WHERE id = $1 AND item_id = $2 RETURNING id',
        [Number(l.id), itemId, texto(l.descricao, 160), q, data(l.validade)]);
      if (ja.length) continue;
    }
    await query('INSERT INTO emergencia_lotes (item_id, descricao, qtd, validade) VALUES ($1,$2,$3,$4)',
      [itemId, texto(l.descricao, 160), q, data(l.validade)]);
  }
  /* Os lotes de compras (da tarefa) que nao vieram na lista sairam do stock. */
  const ids = (Array.isArray(lotes) ? lotes : []).map((l) => Number(l.id)).filter((n) => n > 0);
  await query('DELETE FROM emergencia_lotes WHERE item_id = $1 AND compra_id IS NOT NULL AND NOT (id = ANY($2::int[]))', [itemId, ids]);
  await query('SELECT emergencia_sync($1)', [itemId]);
}
/* Acertar o total com − / +: o que se tira sai dos lotes que caducam
   primeiro; o que se poe vai para um lote sem validade. */
async function acertarTotal(itemId, alvo) {
  const atual = (await all('SELECT COALESCE(sum(qtd),0)::float AS n FROM emergencia_lotes WHERE item_id = $1', [itemId]))[0].n;
  let delta = Math.round((alvo - atual) * 100) / 100;
  if (delta > 0) {
    const solto = (await all('SELECT id FROM emergencia_lotes WHERE item_id = $1 AND validade IS NULL AND descricao IS NULL ORDER BY id LIMIT 1', [itemId]))[0];
    if (solto) await query('UPDATE emergencia_lotes SET qtd = qtd + $2 WHERE id = $1', [solto.id, delta]);
    else await query('INSERT INTO emergencia_lotes (item_id, qtd) VALUES ($1,$2)', [itemId, delta]);
  } else if (delta < 0) {
    const lotes = await all('SELECT id, qtd::float AS qtd FROM emergencia_lotes WHERE item_id = $1 ORDER BY validade NULLS LAST, id', [itemId]);
    for (const l of lotes) {
      if (delta >= 0) break;
      const tira = Math.min(l.qtd, -delta);
      if (tira >= l.qtd) await query('DELETE FROM emergencia_lotes WHERE id = $1', [l.id]);
      else await query('UPDATE emergencia_lotes SET qtd = qtd - $2 WHERE id = $1', [l.id, tira]);
      delta += tira;
    }
  }
  await query('SELECT emergencia_sync($1)', [itemId]);
}

/* A primeira revisao: o proximo 15 de maio ou de novembro que ainda nao passou. */
function proximaRevisao(hoje) {
  const [y, m, d] = hoje.split('-').map(Number);
  if (m < 5 || (m === 5 && d < 15)) return y + '-05-15';
  if (m < 11 || (m === 11 && d < 15)) return y + '-11-15';
  return (y + 1) + '-05-15';
}

function falha(res, err, onde) {
  console.error('[farol] emergencia ' + onde + ':', err.message);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Não foi possível tratar do stock de emergência.' });
}

function instalar(app, opcoes) {
  const tarefas = opcoes && opcoes.tarefas;

  app.get('/api/emergencia', async (_req, res) => {
    try { res.json(await estado()); } catch (err) { falha(res, err, 'GET'); }
  });

  /* Comecar: a sub-area dentro de Casa, a lista recomendada e a rotina de
     revisao (maio e novembro). Corre as vezes que se quiser: o que ja existe
     fica como esta. */
  app.post('/api/emergencia/preparar', async (_req, res) => {
    try {
      let ctx = await contexto();
      if (!ctx) {
        const casa = (await all(
          `SELECT id FROM contexts WHERE parent_id IS NULL
             AND translate(lower(name), 'áàâãéêíóôõúç', 'aaaaeeiooouc') LIKE 'casa%' ORDER BY id LIMIT 1`))[0];
        if (!casa) { const e = new Error('Não encontrei a área Casa.'); e.status = 400; throw e; }
        let slug = 'emergencia';
        if ((await all('SELECT 1 FROM contexts WHERE slug = $1', [slug])).length) slug = 'casa-emergencia';
        await query(
          `INSERT INTO contexts (slug, name, parent_id, note, papel, sort)
           VALUES ($1, 'Emergência', $2, 'Stock para 72 horas de autonomia e plano da família',
                   'emergencia', (SELECT COALESCE(max(sort),0)+1 FROM contexts WHERE parent_id = $2))`,
          [slug, casa.id]);
        ctx = await contexto();
        console.log('[farol] emergencia: sub-area criada', ctx.id);
      }
      const ha = (await all('SELECT count(*)::int AS n FROM emergencia_itens'))[0].n;
      if (!ha) {
        let s = 0;
        for (const r of MODELO) {
          s += 10;
          await query(
            `INSERT INTO emergencia_itens (categoria, nome, unidade, por_pessoa, quantidade, onde, loja, nota, opcional, sort)
             VALUES ($1,$2,$3,$4,COALESCE($5,1),$6,$7,$8,$9,$10)`,
            [r[0], r[1], r[2], r[3], r[4], r[5], r[6] || null, r[7] || null, Boolean(r[8]), s]);
        }
      }
      const def = await lerDef();
      if (!(Number(def.pessoas) > 0)) { def.pessoas = await pessoasPorOmissao(); await gravarDef(def); }
      /* A rotina semestral. */
      const rot = await all(
        `SELECT id FROM tasks WHERE origin = 'real' AND context_id = $1 AND repeat_rule IS NOT NULL
            AND title = 'Rever o stock de emergência' LIMIT 1`, [ctx.id]);
      if (!rot.length && tarefas) {
        await tarefas.criar({
          title: 'Rever o stock de emergência',
          notes: 'Duas vezes por ano (maio e novembro). O que caduca nos próximos meses passa para o consumo da casa e entra na lista de compras.',
          context_id: ctx.id,
          due_on: proximaRevisao(hojeLisboa()),
          repeat_rule: 'FREQ=MONTHLY;INTERVAL=6',
          items: [
            { title: 'Ver as validades no separador Stock' },
            { title: 'Testar lanternas e rádio; trocar pilhas fracas' },
            { title: 'Carregar os powerbanks' },
            { title: 'Rever as mochilas de saída rápida' },
            { title: 'Atualizar contactos e plano; reimprimir a folha' }
          ]
        });
      }
      res.json(await estado());
    } catch (err) { falha(res, err, 'preparar'); }
  });

  app.post('/api/emergencia/itens', async (req, res) => {
    const b = req.body || {};
    const nome = texto(b.nome, 120);
    if (!nome) return res.status(400).json({ error: 'O artigo precisa de um nome.' });
    const cat = CATEGORIAS.some((c) => c[0] === b.categoria) ? b.categoria : 'conf';
    try {
      await query(
        `INSERT INTO emergencia_itens (categoria, nome, unidade, por_pessoa, quantidade, onde, loja, nota, opcional, sort)
         VALUES ($1,$2,$3,$4,COALESCE($5,1),$6,$7,$8,$9,
                 (SELECT COALESCE(max(sort),0)+10 FROM emergencia_itens WHERE categoria = $1))
         RETURNING id`,
        [cat, nome, texto(b.unidade, 30), numero(b.por_pessoa), numero(b.quantidade),
         ONDE.includes(b.onde) ? b.onde : 'despensa', texto(b.loja, 60), texto(b.nota, 200), Boolean(b.opcional)])
        .then(async (r) => {
          const id = r.rows[0].id;
          if (Array.isArray(b.lotes)) await gravarLotes(id, b.lotes);
          else if (numero(b.tenho)) await gravarLotes(id, [{ qtd: b.tenho, validade: b.validade }]);
        });
      res.status(201).json(await estado());
    } catch (err) { falha(res, err, 'POST item'); }
  });

  app.patch('/api/emergencia/itens/:id(\\d+)', async (req, res) => {
    const b = req.body || {};
    const tem = (k) => Object.prototype.hasOwnProperty.call(b, k);
    const campos = [], valores = [Number(req.params.id)];
    const por = (c, v) => { valores.push(v); campos.push(c + ' = $' + valores.length); };
    if (tem('nome') && texto(b.nome, 120)) por('nome', texto(b.nome, 120));
    if (tem('categoria') && CATEGORIAS.some((c) => c[0] === b.categoria)) por('categoria', b.categoria);
    if (tem('unidade')) por('unidade', texto(b.unidade, 30));
    if (tem('por_pessoa')) por('por_pessoa', numero(b.por_pessoa));
    if (tem('quantidade') && numero(b.quantidade) != null) por('quantidade', numero(b.quantidade));
    if (tem('onde') && ONDE.includes(b.onde)) por('onde', b.onde);
    if (tem('loja')) por('loja', texto(b.loja, 60));
    if (tem('nota')) por('nota', texto(b.nota, 200));
    if (tem('opcional')) por('opcional', Boolean(b.opcional));
    const lotes = tem('lotes') && Array.isArray(b.lotes);
    const total = !lotes && tem('tenho') && numero(b.tenho) != null;
    if (!campos.length && !lotes && !total) return res.status(400).json({ error: 'Nada para mudar.' });
    try {
      const id = Number(req.params.id);
      const ha = await all('SELECT id FROM emergencia_itens WHERE id = $1', [id]);
      if (!ha.length) return res.status(404).json({ error: 'Artigo não encontrado.' });
      if (campos.length) await query(`UPDATE emergencia_itens SET ${campos.join(', ')}, updated_at = now() WHERE id = $1`, valores);
      if (lotes) await gravarLotes(id, b.lotes);
      else if (total) await acertarTotal(id, numero(b.tenho));
      res.json(await estado());
    } catch (err) { falha(res, err, 'PATCH item'); }
  });

  app.delete('/api/emergencia/itens/:id(\\d+)', async (req, res) => {
    try {
      const r = await all('DELETE FROM emergencia_itens WHERE id = $1 RETURNING id', [Number(req.params.id)]);
      if (!r.length) return res.status(404).json({ error: 'Artigo não encontrado.' });
      res.json(await estado());
    } catch (err) { falha(res, err, 'DELETE item'); }
  });

  /* Comprei: soma ao stock. Se o artigo estiver na tarefa de compra aberta,
     risca-se o passo (e o gatilho soma) - assim nunca conta duas vezes.
     A validade fica a mais proxima das duas, se ja havia stock. */
  app.post('/api/emergencia/comprei', async (req, res) => {
    const b = req.body || {};
    const id = Number(b.item_id);
    const qtd = numero(b.qtd);
    const val = data(b.validade);
    if (!id || !qtd) return res.status(400).json({ error: 'Falta o artigo ou a quantidade.' });
    try {
      const it = (await all('SELECT id FROM emergencia_itens WHERE id = $1', [id]))[0];
      if (!it) return res.status(404).json({ error: 'Artigo não encontrado.' });
      /* Repor o que caducava: os lotes que caducam nos proximos 60 dias
         passam para o consumo da casa. */
      if (b.substituir) {
        await query(`DELETE FROM emergencia_lotes WHERE item_id = $1 AND validade IS NOT NULL
                       AND validade <= CURRENT_DATE + ${AVISO_DIAS}`, [id]);
      }
      const pend = (await all(
        `SELECT c.id, c.task_id, c.titulo FROM emergencia_compras c JOIN tasks t ON t.id = c.task_id
          WHERE c.item_id = $1 AND NOT c.aplicado AND NOT t.done AND t.status NOT IN ('concluida','cancelada')
          ORDER BY c.id DESC LIMIT 1`, [id]))[0];
      let feito = false;
      if (pend) {
        await query('UPDATE emergencia_compras SET qtd = $2 WHERE id = $1', [pend.id, qtd]);
        await query('UPDATE task_items SET done = TRUE, completed_at = now() WHERE task_id = $1 AND title = $2 AND NOT done',
          [pend.task_id, pend.titulo]);
        const l = await all('UPDATE emergencia_lotes SET validade = $2, descricao = COALESCE($3, descricao) WHERE compra_id = $1 RETURNING id',
          [pend.id, val, texto(b.descricao, 160)]);
        feito = l.length > 0;
      }
      if (!feito) {
        await query('INSERT INTO emergencia_lotes (item_id, descricao, qtd, validade) VALUES ($1,$2,$3,$4)',
          [id, texto(b.descricao, 160) || 'Compra', qtd, val]);
      }
      res.json(await estado());
    } catch (err) { falha(res, err, 'comprei'); }
  });

  /* A tarefa de compra: o que falta e o que esta a caducar, um passo por
     artigo, arrumada em Casa > Emergencia, para daqui a uma semana. */
  app.post('/api/emergencia/compra', async (_req, res) => {
    try {
      if (!tarefas) throw new Error('sem modulo de tarefas');
      const e = await estado();
      if (!e.ctx) { const x = new Error('Falta começar o stock de emergência.'); x.status = 400; throw x; }
      if (e.compra_id) return res.json(Object.assign(e, { task_id: e.compra_id, ja_havia: true }));
      const lista = e.itens.filter((i) => i.falta > 0 || i.estado === 'caducar' || i.estado === 'caducado')
        .map((i) => ({ i, qtd: i.comprar || i.falta }));
      if (!lista.length) { const x = new Error('Não falta nada.'); x.status = 400; throw x; }
      const ordemLoja = (l) => l || 'zz';
      lista.sort((a, b) => ordemLoja(a.i.loja).localeCompare(ordemLoja(b.i.loja)) || a.i.sort - b.i.sort);
      const passos = lista.map((x) => ({
        title: (x.i.loja ? x.i.loja + ' · ' : '') + String(x.qtd).replace('.', ',') + ' ' + (x.i.unidade || '') + ' — ' + x.i.nome
      }));
      const id = await tarefas.criar({
        title: 'Compras do stock de emergência',
        notes: 'Ao riscar um passo, a quantidade entra no stock. A validade escreve-se depois em Casa › Emergência › Stock.',
        context_id: e.ctx.id,
        due_on: maisDias(hojeLisboa(), 7),
        items: passos
      });
      for (let k = 0; k < lista.length; k++) {
        await query('INSERT INTO emergencia_compras (task_id, titulo, item_id, qtd) VALUES ($1,$2,$3,$4)',
          [id, passos[k].title, lista[k].i.id, lista[k].qtd]);
      }
      res.status(201).json(Object.assign(await estado(), { task_id: id }));
    } catch (err) { falha(res, err, 'compra'); }
  });

  app.put('/api/emergencia/definicoes', async (req, res) => {
    const b = req.body || {};
    try {
      const def = await lerDef();
      if (b.pessoas !== undefined) {
        const n = parseInt(b.pessoas, 10);
        if (!(n >= 1 && n <= 30)) return res.status(400).json({ error: 'Número de pessoas entre 1 e 30.' });
        def.pessoas = n;
      }
      if (b.plano && typeof b.plano === 'object') {
        const p = {};
        ['encontro_perto', 'encontro_fora', 'protecao_civil', 'dinheiro', 'responsavel', 'notas'].forEach((k) => {
          if (b.plano[k] !== undefined) p[k] = texto(b.plano[k], k === 'notas' ? 2000 : 200);
        });
        if (b.plano.mochilas && typeof b.plano.mochilas === 'object') {
          p.mochilas = {};
          Object.keys(b.plano.mochilas).slice(0, 40).forEach((k) => {
            const v = b.plano.mochilas[k];
            if (/^\d+$/.test(k) && ['pronta', 'incompleta', 'por fazer'].includes(v)) p.mochilas[k] = v;
          });
        }
        def.plano = Object.assign({}, def.plano, p);
      }
      await gravarDef(def);
      res.json(await estado());
    } catch (err) { falha(res, err, 'definicoes'); }
  });
}

module.exports = { instalar, estado };
