'use strict';
/* Relatorios das financas (17 out 2026).
 *
 * Tres vistas para avaliar a vida pessoal e cada empresa por si:
 *   - entradas e saidas: o mapa por rubrica e mes, com custos fixos e
 *     variaveis e o resultado;
 *   - saldo e movimentos: o saldo no fim de cada mes e o que entrou e saiu
 *     das contas, com um aviso quando o extrato e os movimentos nao batem;
 *   - despesas: para onde vai o dinheiro, por categoria.
 *
 * Ambitos: «pessoal» (as contas pessoais) e «empresa:<id>» (as contas de
 * empresa dessa entidade - so as contas de empresa, nao os cartoes que a
 * empresa da a quem la trabalha). O dinheiro que passa das contas pessoais
 * para a empresa aparece como «Para a empresa» de um lado e «Entradas de
 * socio» do outro; as transferencias entre contas do mesmo ambito nao
 * contam.
 *
 * GET /api/financas/relatorios?ambito=pessoal|empresa:<id>&ano=2026|12m
 */
const { query } = require('./db');
const fin = require('./financas');
const all = async (sql, p) => (await query(sql, p)).rows;
const cent = (v) => Math.round(Number(v || 0) * 100) / 100;

const SOCIO = ['suprimentos', 'capitais próprios', 'capitais proprios'];
const LIQUIDAS = ['ordem', 'dinheiro', 'poupanca'];

function hojeIso() { return new Date(Date.now() + 3600 * 1000).toISOString().slice(0, 10); }
function somaMes(ym, n) {
  const [a, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 + n, 1)).toISOString().slice(0, 7);
}
function fimMes(ym) {
  const [a, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/* Os meses do periodo: um ano (ate ao mes corrente, se for este) ou os
   ultimos doze. */
function mesesDe(ano) {
  const agora = hojeIso().slice(0, 7);
  const out = [];
  if (ano === '12m') { for (let i = 11; i >= 0; i--) out.push(somaMes(agora, -i)); return out; }
  const a = /^\d{4}$/.test(String(ano)) ? String(ano) : agora.slice(0, 4);
  for (let m = 1; m <= 12; m++) {
    const k = a + '-' + String(m).padStart(2, '0');
    if (k > agora) break;
    out.push(k);
  }
  return out.length ? out : [agora];
}

async function ambitos(B) {
  const ids = [...new Set(B.contas.filter((c) => c.ativo && c.tipo === 'empresa' && c.empresa_id).map((c) => c.empresa_id))];
  const nomes = ids.length ? await all('SELECT id, nome FROM fin_cc_pessoas WHERE id = ANY($1::int[])', [ids]) : [];
  return [{ id: 'pessoal', nome: 'Pessoal' }].concat(nomes.map((e) => ({ id: 'empresa:' + e.id, nome: e.nome })));
}

async function relatorio(q) {
  const B = await fin.base();
  const lista = await ambitos(B);
  const ambito = lista.some((a) => a.id === q.ambito) ? q.ambito : 'pessoal';
  const empresa = ambito.startsWith('empresa:') ? Number(ambito.slice(8)) : null;
  const eEmpresa = (c) => c && c.tipo === 'empresa' && c.empresa_id;
  /* As contas do fluxo (gastos e rendimentos) e as do saldo. */
  const fluxo = B.contas.filter((c) => (empresa ? c.empresa_id === empresa && c.tipo === 'empresa' : c.pessoal));
  const doSaldo = empresa ? fluxo : fluxo.filter((c) => c.ativo && LIQUIDAS.indexOf(c.tipo) >= 0);
  const idsFluxo = fluxo.map((c) => c.id);
  const noFluxo = new Set(idsFluxo);
  const noSaldo = new Set(doSaldo.map((c) => c.id));

  const meses = mesesDe(q.ano);
  const de = meses[0] + '-01', ate = fimMes(meses[meses.length - 1]);
  const anos = (await all(
    `SELECT DISTINCT to_char(data,'YYYY') AS a FROM fin_movimentos WHERE conta_id = ANY($1::int[]) ORDER BY 1`, [idsFluxo]))
    .map((r) => r.a);

  const ms = idsFluxo.length ? await fin.movimentosEntre(de, ate, { ambito: 'tudo', conta: idsFluxo }, B) : [];
  const ids = [...new Set(ms.map((m) => m.id))];
  const pares = ids.length ? await all(
    `SELECT m.id, pm.conta_id AS par_conta FROM fin_movimentos m JOIN fin_movimentos pm ON pm.id = m.par_id
      WHERE m.id = ANY($1::int[])`, [ids]) : [];
  const parDe = {}; pares.forEach((p) => { parDe[p.id] = p.par_conta; });

  /* ---- o mapa ---- */
  const idx = {}; meses.forEach((k, i) => { idx[k] = i; });
  const secs = { entradas: {}, fixos: {}, variaveis: {}, empresa: {} };
  const somar = (sec, nome, i, v, extra) => {
    const r = secs[sec][nome] || (secs[sec][nome] = Object.assign({ nome, v: meses.map(() => 0) }, extra || {}));
    r.v[i] = cent(r.v[i] + v);
  };
  const porCat = {};
  let fora = 0;
  ms.forEach((m) => {
    const i = idx[m.data.slice(0, 7)];
    if (i === undefined) return;
    const pc = parDe[m.id];
    if (pc && noFluxo.has(pc)) return;                          /* entre contas do mesmo ambito */
    const nat = fin.natureza(m, B);
    const cat = m.categoria_id ? B.catPor[m.categoria_id] : null;
    const nomeCat = cat ? cat.nome : 'Por categorizar';
    const socio = (cat && SOCIO.indexOf(String(cat.nome).toLowerCase()) >= 0) ||
      (pc && (empresa ? !!(B.contaPor[pc] || {}).pessoal : eEmpresa(B.contaPor[pc])));
    if (socio && (nat === 'financiamento' || nat === 'transferencia')) {
      if (empresa) {
        if (m.valor > 0) somar('entradas', 'Entradas de sócio', i, m.valor);
        else somar('empresa', 'Devoluções ao sócio', i, -m.valor);
      } else if (m.valor < 0) somar('empresa', 'Para a empresa', i, -m.valor);
      else somar('entradas', 'Da empresa', i, m.valor);
      return;
    }
    if (nat === 'receita' || (nat === 'financiamento' && m.valor > 0)) { somar('entradas', nomeCat, i, m.valor, { categoria_id: m.categoria_id || null }); return; }
    if (nat === 'despesa' || nat === 'financiamento') {
      const fixa = !!(cat && cat.fixa);
      const nome = fixa || empresa ? nomeCat : (cat ? cat.grupo : 'Por categorizar');
      somar(fixa ? 'fixos' : 'variaveis', nome, i, -m.valor, fixa || empresa ? { categoria_id: m.categoria_id || null } : { grupo: true });
      const k = m.categoria_id || 0;
      const pcat = porCat[k] || (porCat[k] = { id: m.categoria_id || null, nome: nomeCat, grupo: cat ? cat.grupo : '', fixa, n: 0, total: 0 });
      pcat.n++; pcat.total = cent(pcat.total - m.valor);
      return;
    }
    if (nat === 'transferencia') fora++;
  });
  const linhas = (o) => Object.values(o).map((r) => Object.assign(r, { total: cent(r.v.reduce((a, b) => a + b, 0)) }))
    .filter((r) => Math.abs(r.total) >= 0.005 || r.v.some((x) => Math.abs(x) >= 0.005))
    .sort((a, b) => b.total - a.total);
  const mapa = { entradas: linhas(secs.entradas), fixos: linhas(secs.fixos), variaveis: linhas(secs.variaveis), empresa: linhas(secs.empresa) };
  const tot = (l) => cent(l.reduce((a, r) => a + r.total, 0));
  const kpi = { entradas: tot(mapa.entradas), fixos: tot(mapa.fixos), variaveis: tot(mapa.variaveis), empresa: tot(mapa.empresa) };
  kpi.resultado = cent(kpi.entradas - kpi.fixos - kpi.variaveis - kpi.empresa);

  /* ---- o saldo ---- */
  const hoje = hojeIso();
  const As = [];
  for (const c of doSaldo) As.push(await fin.ancoras(c.id, c));
  const saldoEm = (dia) => cent(As.reduce((s, A) => s + fin.saldoEm(A, dia), 0));
  const inicio = somaMes(meses[0], -1);
  const pontos = [inicio].concat(meses).map((k) => {
    const dia = fimMes(k) > hoje ? hoje : fimMes(k);
    return { mes: k, dia, saldo: saldoEm(dia) };
  });
  const brutos = noSaldo.size ? await all(
    `SELECT m.id, m.conta_id, to_char(m.data,'YYYY-MM-DD') AS data, m.descricao, m.titulo, m.valor, m.categoria_id,
            pm.conta_id AS par_conta
       FROM fin_movimentos m LEFT JOIN fin_movimentos pm ON pm.id = m.par_id
      WHERE m.conta_id = ANY($1::int[]) AND m.data BETWEEN $2 AND $3
      ORDER BY m.data DESC, m.id DESC`, [[...noSaldo], de, ate > hoje ? hoje : ate]) : [];
  const deFora = brutos.filter((m) => !(m.par_conta && noSaldo.has(m.par_conta)));
  const ent = deFora.filter((m) => Number(m.valor) > 0), sai = deFora.filter((m) => Number(m.valor) < 0);
  const vEnt = cent(ent.reduce((a, m) => a + Number(m.valor), 0)), vSai = cent(-sai.reduce((a, m) => a + Number(m.valor), 0));
  const ini = pontos[0].saldo, fim = pontos[pontos.length - 1].saldo;
  const diferenca = cent((fim - ini) - (vEnt - vSai));
  const saldo = {
    contas: doSaldo.map((c) => c.nome), conta_ids: doSaldo.map((c) => c.id),
    pontos: pontos.slice(1), inicio: { dia: pontos[0].dia, saldo: ini }, fim: { dia: pontos[pontos.length - 1].dia, saldo: fim },
    entradas: { n: ent.length, v: vEnt }, saidas: { n: sai.length, v: vSai }, resultado: cent(vEnt - vSai),
    diferenca: Math.abs(diferenca) >= 1 ? diferenca : 0
  };
  const recentes = brutos.slice(0, 10).map((m) => ({ id: m.id, data: m.data, nome: (m.titulo || '').trim() || m.descricao,
    categoria: m.categoria_id && B.catPor[m.categoria_id] ? B.catPor[m.categoria_id].nome : null, valor: Number(m.valor), conta_id: m.conta_id }));

  /* ---- as despesas ---- */
  const categorias = Object.values(porCat).sort((a, b) => b.total - a.total);
  const dFix = cent(categorias.filter((c) => c.fixa).reduce((a, c) => a + c.total, 0));
  const dTot = cent(categorias.reduce((a, c) => a + c.total, 0));
  const [{ n: semCat }] = await all(
    `SELECT count(*)::int AS n FROM fin_movimentos m
      WHERE m.conta_id = ANY($1::int[]) AND m.data BETWEEN $2 AND $3 AND m.categoria_id IS NULL AND m.par_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM fin_cc_mov c WHERE c.movimento_id = m.id)`, [idsFluxo, de, ate]);

  return {
    ambitos: lista, ambito, ano: q.ano === '12m' ? '12m' : meses[0].slice(0, 4), anos, meses, de, ate,
    contas_fluxo: idsFluxo, mapa, kpi, fora, saldo, recentes,
    despesas: { categorias, fixos: dFix, variaveis: cent(dTot - dFix), total: dTot, meses: meses.length, por_classificar: semCat }
  };
}

function instalar(app) {
  app.get('/api/financas/relatorios', async (req, res) => {
    try {
      res.json(await relatorio({ ambito: String(req.query.ambito || 'pessoal'), ano: String(req.query.ano || '') }));
    } catch (e) {
      console.error('[farol] GET /api/financas/relatorios:', e.message);
      res.status(500).json({ error: 'Não foi possível montar o relatório.' });
    }
  });
}

module.exports = { instalar, relatorio, mesesDe };
