'use strict';
/* Farol — Despesas.
 *
 * O dinheiro que já saiu, visto de cima: todas as despesas na mesma lista,
 * por mês, com o total de cada mês e do que está filtrado.
 *
 * Nas áreas, cada uma mostra as suas (area-tarefas.js). Aqui vêem-se todas —
 * incluindo as que ficaram sem área, que de outra maneira não apareciam em
 * lado nenhum.
 *
 * Uma despesa não se escreve à mão: nasce da caixa de entrada (um recibo
 * catalogado) ou de um pagamento dado por pago. O que aqui se faz é vê-las e
 * apagar as que nasceram de uma leitura errada.
 *
 * 27 set: passa a ser também a página de detalhe que o card «despesas» de
 * cada área abre (dpAbrir), já filtrada por essa área ou sub-área. Ganhou:
 *   - filtros em listas pendentes, como as áreas: Onde (áreas e sub-áreas),
 *     Quem, Período, e Agrupar por (entidade, categoria, área);
 *   - comparar com o período anterior (o mesmo intervalo, recuado tantos
 *     meses quantos o período tem);
 *   - números: total, média por mês, variação, nº de despesas, sem papel;
 *   - por mês: barras empilhadas pelos cinco maiores grupos (o resto em
 *     «Outros» - uma cor não se inventa para o sexto);
 *   - para quem foi: barras horizontais, com o valor do período anterior;
 *   - o quadro de resultados: mês × grupo, com o total e a variação face ao
 *     mês anterior;
 *   - e a lista por mês de sempre, no fim.
 * As cores são a paleta categórica de referência, validada para daltonismo
 * (claro e escuro); como três delas ficam abaixo de 3:1 no fundo claro, o
 * quadro e a legenda levam sempre os números e os nomes.
 */

var DP = { montado: false, soSemPapel: false, filtro: { onde: 'tudo', quem: 'todos', quando: 'ano', comparar: true, agrupar: 'entidade' } };
try {
  var dpG = JSON.parse(localStorage.getItem('dpFiltro') || 'null');
  if (dpG) Object.keys(dpG).forEach(function(k){ DP.filtro[k] = dpG[k]; });
} catch (e) {}
/* O «90 dias» antigo passou a «3 meses». */
if (DP.filtro.quando === 'd90') DP.filtro.quando = 'm3';
function dpGuardar(){ try { localStorage.setItem('dpFiltro', JSON.stringify(DP.filtro)); } catch (e) {} }

var DP_CSS =
  '#view-despesas{--dp-s1:#2a78d6;--dp-s2:#eb6834;--dp-s3:#1baf7a;--dp-s4:#eda100;--dp-s5:#e87ba4;--dp-s0:#9AA6A7}' +
  '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) #view-despesas{--dp-s1:#3987e5;--dp-s2:#d95926;--dp-s3:#199e70;--dp-s4:#c98500;--dp-s5:#d55181;--dp-s0:#6E7B7C}}' +
  ':root[data-theme="dark"] #view-despesas{--dp-s1:#3987e5;--dp-s2:#d95926;--dp-s3:#199e70;--dp-s4:#c98500;--dp-s5:#d55181;--dp-s0:#6E7B7C}' +
  '#view-despesas .dp-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}' +
  '#view-despesas .dp-kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px;display:flex;flex-direction:column;gap:2px;text-align:left;font:inherit;color:inherit}' +
  '#view-despesas button.dp-kpi{cursor:pointer}' +
  '#view-despesas button.dp-kpi:hover,#view-despesas button.dp-kpi.on{border-color:var(--accent)}' +
  '#view-despesas .dp-kpi b{font-family:var(--mono);font-size:1.2rem;font-weight:500;font-variant-numeric:tabular-nums;color:var(--ink)}' +
  '#view-despesas .dp-kpi b.warn{color:var(--warn)}' +
  '#view-despesas .dp-kpi span{font-size:.75rem;color:var(--muted)}' +
  '#view-despesas .dp-kpi small{font-size:.7rem;color:var(--faint)}' +
  '#view-despesas .dp-duo{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:14px;align-items:stretch}' +
  '@media (max-width:1100px){#view-despesas .dp-duo,#view-despesas .dp-kpis{grid-template-columns:minmax(0,1fr)}}' +
  '#view-despesas .dp-sub{font-size:.75rem;color:var(--muted);margin-left:8px;font-family:var(--sans);text-transform:none;letter-spacing:0}' +
  '#view-despesas .dp-graf{display:flex;align-items:flex-end;gap:10px;height:220px;padding:18px 4px 0;border-bottom:1px solid var(--line)}' +
  '#view-despesas .dp-col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px}' +
  '#view-despesas .dp-col > span{font-family:var(--mono);font-size:.625rem;color:var(--muted);white-space:nowrap}' +
  '#view-despesas .dp-pilha{width:100%;max-width:42px;display:flex;flex-direction:column-reverse;gap:2px}' +
  '#view-despesas .dp-pilha i{display:block;min-height:2px}' +
  '#view-despesas .dp-pilha i:last-child{border-radius:4px 4px 0 0}' +
  '#view-despesas .dp-eixo{display:flex;gap:10px;padding:6px 4px 0}' +
  '#view-despesas .dp-eixo span{flex:1;min-width:0;text-align:center;font-family:var(--mono);font-size:.625rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}' +
  '#view-despesas .dp-eixo span.agora{color:var(--accent-ink)}' +
  '#view-despesas .dp-leg{display:flex;flex-wrap:wrap;gap:6px 16px;padding:12px 4px 2px;font-size:.75rem;color:var(--ink-2)}' +
  '#view-despesas .dp-leg span{display:inline-flex;align-items:center;gap:6px}' +
  '#view-despesas .dp-leg i,#view-despesas .dp-sw{width:10px;height:10px;border-radius:3px;display:inline-block;flex:none}' +
  '#view-despesas .dp-hb{display:flex;flex-direction:column;gap:4px;padding:6px 0}' +
  '#view-despesas .dp-hb div{display:flex;justify-content:space-between;gap:10px;font-size:.8125rem}' +
  '#view-despesas .dp-hb div b{font-family:var(--mono);font-weight:500;font-size:.78rem;font-variant-numeric:tabular-nums;white-space:nowrap}' +
  '#view-despesas .dp-hb .trilho{height:8px;border-radius:99px;background:var(--line-soft);overflow:hidden}' +
  '#view-despesas .dp-hb .trilho i{display:block;height:8px;border-radius:0 4px 4px 0}' +
  '#view-despesas .dp-hb small{font-family:var(--mono);font-size:.625rem;color:var(--muted)}' +
  '#view-despesas .dp-tab{width:100%;border-collapse:collapse;font-size:.8rem}' +
  '#view-despesas .dp-tab th{font-family:var(--mono);font-size:.625rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:500;padding:8px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}' +
  '#view-despesas .dp-tab th:first-child,#view-despesas .dp-tab td:first-child{text-align:left}' +
  '#view-despesas .dp-tab td{padding:7px 6px;border-bottom:1px solid var(--line-soft);text-align:right;font-family:var(--mono);font-size:.75rem;color:var(--ink-2);font-variant-numeric:tabular-nums;white-space:nowrap}' +
  '#view-despesas .dp-tab td:first-child{font-family:var(--sans);font-size:.8rem;color:var(--ink)}' +
  '#view-despesas .dp-tab td.tot{color:var(--ink);font-weight:500}' +
  '#view-despesas .dp-tab td.mais{color:var(--bad)} #view-despesas .dp-tab td.menos{color:var(--good)}' +
  '#view-despesas .dp-tab tr.fim td{font-weight:600;color:var(--ink);border-bottom:0}' +
  '#view-despesas .dp-tabw{overflow-x:auto}' +
  '#view-despesas .card > header{margin-bottom:6px}' +
  '#view-despesas .dp-mes{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;' +
  'text-transform:uppercase;color:var(--muted);padding:14px 16px 4px;display:flex;gap:8px;font-weight:500}' +
  '#view-despesas .dp-mes b{margin-left:auto;font-weight:500;color:var(--ink-2);font-variant-numeric:tabular-nums}' +
  '#view-despesas .dp-mes.agora{color:var(--accent-ink)}' +
  '#view-despesas .tf-rows{padding:0 10px}';

var DP_QUANDO = [
  ['mes', 'Este mês'],
  ['m3', '3 meses'],
  ['ano', 'Este ano'],
  ['d365', '12 meses'],
  ['passado', 'Ano passado'],
  ['tudo', 'Tudo']
];
var DP_AGRUPAR = [['entidade', 'Entidade'], ['categoria', 'Categoria'], ['area', 'Área']];

/* Abrir a pagina ja filtrada por uma area ou sub-area: e o que o card
   «despesas» de cada area faz. */
function dpAbrir(id){
  DP.filtro.onde = id ? String(id) : 'tudo';
  DP.soSemPapel = false;
  dpGuardar();
  show('despesas');
  dpRender();
}

/* Um dia recuado n meses (o dia fica no ultimo do mes quando nao existe). */
function dpRecuar(iso, n){
  var p = iso.split('-').map(Number);
  var d = new Date(p[0], p[1] - 1 - n, 1);
  var ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(p[2], ultimo));
  return tfISO(d);
}
/* O periodo escolhido e quantos meses tem (para recuar o anterior). */
function dpJanela(q, primeira){
  var h = tfHoje(), hoje = tfISO(h), ano = h.getFullYear();
  if (q === 'mes') return { de: tfISO(new Date(ano, h.getMonth(), 1)), ate: hoje, meses: 1 };
  if (q === 'm3') return { de: tfISO(new Date(ano, h.getMonth() - 2, 1)), ate: hoje, meses: 3 };
  if (q === 'ano') return { de: ano + '-01-01', ate: hoje, meses: 12 };
  if (q === 'd365') return { de: tfISO(new Date(ano, h.getMonth() - 11, 1)), ate: hoje, meses: 12 };
  if (q === 'passado') return { de: (ano - 1) + '-01-01', ate: (ano - 1) + '-12-31', meses: 12 };
  return { de: primeira || hoje, ate: hoje, meses: 0 };
}
function dpMesesEntre(de, ate){
  var out = [], d = new Date(Number(de.slice(0, 4)), Number(de.slice(5, 7)) - 1, 1);
  var fim = ate.slice(0, 7);
  while (tfISO(d).slice(0, 7) <= fim && out.length < 60){ out.push(tfISO(d).slice(0, 7)); d.setMonth(d.getMonth() + 1); }
  return out;
}
function dpGrupoDe(x, como){
  if (como === 'categoria') return x.category || 'sem categoria';
  if (como === 'area') return x.context_id && typeof areaNome === 'function' ? (areaNome(x.context_id) || 'sem área') : 'sem área';
  return x.merchant || x.description || 'sem entidade';
}
function dpTemPapel(x){ return !!(x.inbox_id || x.document_id || (x.papeis || []).length); }

function dpMontar(){
  if (DP.montado) return;
  DP.montado = true;

  var st = document.createElement('style'); st.id = 'dpCss'; st.textContent = DP_CSS;
  document.head.appendChild(st);

  if (window.TITLES) TITLES.despesas = ['Despesas', 'O dinheiro que já saiu'];

  var nav = document.getElementById('nav');
  if (nav && !nav.querySelector('[data-view="despesas"]')){
    var b = el('button', null, ' Despesas');
    b.dataset.view = 'despesas';
    b.insertBefore(dpIcone(), b.firstChild);
    var pj = nav.querySelector('[data-view="projetos"]');
    if (pj) nav.insertBefore(b, pj.nextSibling); else nav.appendChild(b);
  }

  var sec = el('section', 'view'); sec.id = 'view-despesas';
  var caixa = el('div', 'stack'); caixa.id = 'dpCaixa';
  sec.appendChild(caixa);
  var docs = document.getElementById('view-documentos');
  if (docs) docs.parentNode.insertBefore(sec, docs);
  else document.querySelector('main').appendChild(sec);
}

function dpIcone(){
  var s = document.createElement('span');
  s.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' +
    '<path d="M4 18V9"/><path d="M10 18V5"/><path d="M16 18v-6"/><path d="M3 21h18"/></svg>';
  return s.firstChild;
}

function dpAreas(){
  return ((window.G && G.contextos) || []).filter(function(c){ return !c.parent_id; });
}
function dpIdsDaArea(id){
  var ids = [id];
  ((window.G && G.contextos) || []).forEach(function(c){ if (c.parent_id === id) ids.push(c.id); });
  return ids;
}

/* As despesas da area e da pessoa escolhidas, sem o periodo (o periodo e
   o anterior cortam-se depois, sobre esta lista). */
function dpBase(){
  var f = DP.filtro;
  var linhas = (typeof aeDespesas === 'function' ? aeDespesas() : null);
  if (!linhas) return null;
  var ids = (f.onde !== 'tudo' && f.onde !== 'sem') ? dpIdsDaArea(Number(f.onde)) : null;
  return linhas.filter(function(x){
    if (f.onde === 'sem'){ if (x.context_id) return false; }
    else if (ids && ids.indexOf(x.context_id) < 0) return false;
    if (f.quem !== 'todos' && x.person_id !== Number(f.quem)) return false;
    return true;
  });
}
function dpNaJanela(lista, j){
  return lista.filter(function(x){ var d = String(x.spent_on || ''); return d >= j.de && d <= j.ate; });
}
function dpLista(){
  var base = dpBase();
  if (!base) return null;
  var primeira = base.reduce(function(m, x){ return !m || x.spent_on < m ? x.spent_on : m; }, null);
  return dpNaJanela(base, dpJanela(DP.filtro.quando, primeira));
}
function dpSoma(l){ return l.reduce(function(s, x){ return s + Number(x.amount || 0); }, 0); }

function dpNomeOnde(v){
  if (v === 'tudo') return 'Tudo';
  if (v === 'sem') return 'Sem área';
  return (typeof areaNome === 'function' && areaNome(Number(v))) || 'Tudo';
}

function dpRender(){
  if (!document.getElementById('view-despesas')) return;
  var box = document.getElementById('dpCaixa');
  if (!box || typeof aeLinhaDespesa !== 'function' || typeof aeDropdown !== 'function') return;
  clear(box);
  var f = DP.filtro;
  function muda(campo, v){ DP.filtro[campo] = v; dpGuardar(); dpRender(); }

  /* ---- filtros: uma linha, listas pendentes (as mesmas das areas) ---- */
  var barra = el('div', 'card ae-filtros');
  var dds = el('div', 'ae-dds');
  barra.appendChild(dds);
  dds.appendChild(aeDropdown('Onde', dpNomeOnde(f.onde), f.onde !== 'tudo', 0, function(pop){
    pop.appendChild(aeOpcao('Tudo', f.onde === 'tudo', function(){ muda('onde', 'tudo'); }, { radio: true }));
    pop.appendChild(el('hr'));
    var cs = (window.G && G.contextos) || [];
    dpAreas().forEach(function(c){
      pop.appendChild(aeOpcao(c.name, f.onde === String(c.id), function(){ muda('onde', String(c.id)); }, { radio: true }));
      cs.filter(function(x){ return x.parent_id === c.id && x.active !== false; }).forEach(function(sb){
        var o = aeOpcao('› ' + sb.name, f.onde === String(sb.id), function(){ muda('onde', String(sb.id)); }, { radio: true });
        o.style.paddingLeft = '24px';
        pop.appendChild(o);
      });
    });
    pop.appendChild(el('hr'));
    pop.appendChild(aeOpcao('Sem área', f.onde === 'sem', function(){ muda('onde', 'sem'); }, { radio: true }));
  }));
  var quemP = f.quem !== 'todos' ? pessoa(Number(f.quem)) : null;
  dds.appendChild(aeDropdown('Quem', quemP ? quemP.name : 'Agregado todo', !!quemP, 0, function(pop){
    pop.appendChild(aeOpcao('Agregado todo', f.quem === 'todos', function(){ muda('quem', 'todos'); }, { radio: true, cor: 'var(--faint)' }));
    ((window.G && G.people) || []).filter(function(p){ return p.active !== false; }).forEach(function(p){
      pop.appendChild(aeOpcao(p.name, f.quem === String(p.id), function(){ muda('quem', String(p.id)); }, { radio: true, cor: p.color || 'var(--c1)' }));
    });
  }));
  var nomeQ = (DP_QUANDO.filter(function(q){ return q[0] === f.quando; })[0] || DP_QUANDO[2])[1];
  dds.appendChild(aeDropdown('Período', nomeQ, f.quando !== 'tudo', 0, function(pop){
    DP_QUANDO.forEach(function(q){
      pop.appendChild(aeOpcao(q[1], f.quando === q[0], function(){ muda('quando', q[0]); }, { radio: true }));
    });
  }));
  var nomeA = (DP_AGRUPAR.filter(function(g){ return g[0] === f.agrupar; })[0] || DP_AGRUPAR[0])[1];
  dds.appendChild(aeDropdown('Agrupar', nomeA, false, 0, function(pop){
    DP_AGRUPAR.forEach(function(g){
      pop.appendChild(aeOpcao(g[1], f.agrupar === g[0], function(){ muda('agrupar', g[0]); }, { radio: true }));
    });
  }));
  if (f.quando !== 'tudo'){
    var lc = el('label', 'ae-op');
    lc.style.cssText = 'display:inline-flex;gap:7px;align-items:center;font-size:.8rem;color:var(--ink-2);cursor:pointer;margin-left:4px';
    var cc = el('input'); cc.type = 'checkbox'; cc.checked = f.comparar !== false;
    cc.style.cssText = 'width:15px;height:15px;accent-color:var(--accent);margin:0';
    cc.addEventListener('change', function(){ muda('comparar', cc.checked); });
    lc.appendChild(cc);
    lc.appendChild(document.createTextNode('Comparar com o período anterior'));
    dds.appendChild(lc);
  }
  box.appendChild(barra);

  var base = dpBase();
  if (!base){ var ca = el('div', 'card'); ca.appendChild(el('p', 'ae-vazio', 'A ler as despesas…')); box.appendChild(ca); return; }
  var primeira = base.reduce(function(m, x){ return !m || x.spent_on < m ? x.spent_on : m; }, null);
  var J = dpJanela(f.quando, primeira);
  var lista = dpNaJanela(base, J);
  var compara = f.comparar !== false && J.meses > 0;
  var JA = compara ? { de: dpRecuar(J.de, J.meses), ate: dpRecuar(J.ate, J.meses) } : null;
  var antes = compara ? dpNaJanela(base, JA) : [];
  var total = dpSoma(lista), totalAntes = dpSoma(antes);
  var meses = dpMesesEntre(J.de, J.ate);
  if (meses.length > 24) meses = meses.slice(-24);

  /* ---- os numeros ---- */
  var semPapel = lista.filter(function(x){ return !dpTemPapel(x); });
  var entidades = {};
  lista.forEach(function(x){ entidades[dpGrupoDe(x, 'entidade')] = 1; });
  var kp = el('div', 'dp-kpis');
  function kpi(v, nome, sub, cls, fn, on){
    var k = el(fn ? 'button' : 'div', 'dp-kpi' + (on ? ' on' : ''));
    if (fn){ k.type = 'button'; k.addEventListener('click', fn); }
    k.appendChild(el('b', cls || '', v));
    k.appendChild(el('span', null, nome));
    if (sub) k.appendChild(el('small', null, sub));
    kp.appendChild(k);
  }
  function dataCurta(iso){ return typeof tfDataCurta === 'function' ? tfDataCurta(iso) : iso; }
  kpi(tfEuros(total), 'total no período', dataCurta(J.de) + ' – ' + dataCurta(J.ate));
  var nMeses = Math.max(1, meses.length);
  kpi(tfEuros(total / nMeses), 'média por mês', nMeses + (nMeses === 1 ? ' mês' : ' meses'));
  if (compara){
    var dlt = total - totalAntes;
    var pct = totalAntes ? Math.round(dlt / totalAntes * 100) : null;
    kpi(totalAntes ? (dlt >= 0 ? '+' : '−') + Math.abs(pct) + '%' : '—', 'vs período anterior',
      totalAntes ? tfEuros(totalAntes) + ' de ' + dataCurta(JA.de) + ' a ' + dataCurta(JA.ate) : 'sem despesas no período anterior');
  } else {
    kpi('—', 'vs período anterior', J.meses ? 'comparação desligada' : 'escolhe um período');
  }
  kpi(String(lista.length), lista.length === 1 ? 'despesa' : 'despesas', Object.keys(entidades).length + ' entidades');
  kpi(String(semPapel.length), 'sem papel', DP.soSemPapel ? 'a mostrar só estas, em baixo' : 'sem fatura nem talão agarrado',
    semPapel.length ? 'warn' : '', function(){ DP.soSemPapel = !DP.soSemPapel; dpRender(); }, DP.soSemPapel);
  box.appendChild(kp);

  if (!lista.length){
    var cv = el('div', 'card');
    cv.appendChild(el('p', 'ae-vazio', base.length
      ? 'Nenhuma despesa neste período. Experimenta um período maior.'
      : 'Nenhuma despesa aqui. As despesas nascem da caixa de entrada ou de um pagamento dado por pago.'));
    box.appendChild(cv);
    return;
  }

  /* ---- os grupos: os cinco maiores com cor propria, o resto em Outros ---- */
  var somaG = {};
  lista.forEach(function(x){ var g = dpGrupoDe(x, f.agrupar); somaG[g] = (somaG[g] || 0) + Number(x.amount || 0); });
  var ordem = Object.keys(somaG).sort(function(a, b){ return somaG[b] - somaG[a]; });
  var top = ordem.slice(0, 5);
  var temOutros = ordem.length > 5;
  var series = top.map(function(g, i){ return { nome: g, cor: 'var(--dp-s' + (i + 1) + ')' }; });
  if (temOutros) series.push({ nome: 'Outros', cor: 'var(--dp-s0)', outros: true });
  function serieDe(x){
    var g = dpGrupoDe(x, f.agrupar);
    var i = top.indexOf(g);
    return i >= 0 ? i : series.length - 1;
  }
  var porMes = {};
  meses.forEach(function(m){ porMes[m] = series.map(function(){ return 0; }); });
  lista.forEach(function(x){
    var m = String(x.spent_on).slice(0, 7);
    if (porMes[m]) porMes[m][serieDe(x)] += Number(x.amount || 0);
  });
  function somaArr(a){ return a.reduce(function(s, v){ return s + v; }, 0); }
  var maxMes = Math.max.apply(null, meses.map(function(m){ return somaArr(porMes[m]); }).concat([1]));
  var mesAgora = tfISO(tfHoje()).slice(0, 7);
  function nomeMes(m, longo){ var p = m.split('-'); var n = MESES[Number(p[1]) - 1]; return longo ? n.charAt(0).toUpperCase() + n.slice(1) + ' ' + p[0] : n.slice(0, 3) + (meses.length > 12 || p[0] !== String(tfHoje().getFullYear()) ? ' ' + p[0].slice(2) : ''); }

  var duo = el('div', 'dp-duo');
  var cg = el('div', 'card');
  var hg = el('header');
  var tg = el('h3', null, 'Por mês');
  tg.appendChild(el('span', 'dp-sub', 'barras empilhadas por ' + nomeA.toLowerCase()));
  hg.appendChild(tg);
  cg.appendChild(hg);
  var graf = el('div', 'dp-graf');
  meses.forEach(function(m){
    var col = el('div', 'dp-col');
    var tot = somaArr(porMes[m]);
    col.appendChild(el('span', null, tot ? Math.round(tot) + ' €' : ''));
    var pilha = el('div', 'dp-pilha');
    porMes[m].forEach(function(v, i){
      if (!v) return;
      var seg = el('i');
      seg.style.height = Math.max(2, Math.round(v / maxMes * 180)) + 'px';
      seg.style.background = series[i].cor;
      seg.title = nomeMes(m, true) + ' · ' + series[i].nome + ': ' + tfEuros(v);
      pilha.appendChild(seg);
    });
    col.appendChild(pilha);
    col.title = nomeMes(m, true) + ': ' + tfEuros(tot);
    graf.appendChild(col);
  });
  cg.appendChild(graf);
  var eixo = el('div', 'dp-eixo');
  meses.forEach(function(m){ eixo.appendChild(el('span', m === mesAgora ? 'agora' : '', nomeMes(m))); });
  cg.appendChild(eixo);
  var leg = el('div', 'dp-leg');
  series.forEach(function(sr){ var sp = el('span'); var i = el('i'); i.style.background = sr.cor; sp.appendChild(i); sp.appendChild(document.createTextNode(sr.nome)); leg.appendChild(sp); });
  cg.appendChild(leg);
  duo.appendChild(cg);

  /* Para quem foi: todos os grupos (nao so os cinco), do maior para o menor. */
  var ch = el('div', 'card');
  var hh = el('header');
  var th = el('h3', null, 'Para quem foi');
  th.appendChild(el('span', 'dp-sub', 'por ' + nomeA.toLowerCase()));
  hh.appendChild(th);
  ch.appendChild(hh);
  var somaAntesG = {};
  antes.forEach(function(x){ var g = dpGrupoDe(x, f.agrupar); somaAntesG[g] = (somaAntesG[g] || 0) + Number(x.amount || 0); });
  ordem.slice(0, 10).forEach(function(g){
    var i = top.indexOf(g);
    var cor = i >= 0 ? 'var(--dp-s' + (i + 1) + ')' : 'var(--dp-s0)';
    var hb = el('div', 'dp-hb');
    var l1 = el('div');
    var nm = el('span');
    var sw = el('i', 'dp-sw'); sw.style.background = cor; sw.style.marginRight = '6px';
    nm.appendChild(sw); nm.appendChild(document.createTextNode(g));
    l1.appendChild(nm);
    l1.appendChild(el('b', null, tfEuros(somaG[g])));
    hb.appendChild(l1);
    var tr = el('span', 'trilho'); var bi = el('i'); bi.style.width = Math.max(1, somaG[g] / total * 100) + '%'; bi.style.background = cor;
    tr.appendChild(bi); hb.appendChild(tr);
    var pctG = Math.round(somaG[g] / total * 1000) / 10;
    hb.appendChild(el('small', null, String(pctG).replace('.', ',') + '% do total' +
      (compara ? ' · antes ' + tfEuros(somaAntesG[g] || 0) : '')));
    ch.appendChild(hb);
  });
  if (ordem.length > 10) ch.appendChild(el('p', 'ae-nota', 'e mais ' + (ordem.length - 10) + ', no quadro em baixo.'));
  duo.appendChild(ch);
  box.appendChild(duo);

  /* ---- o quadro de resultados: mes x grupo ---- */
  var cq = el('div', 'card');
  var hq = el('header');
  var tq = el('h3', null, 'Quadro de resultados');
  tq.appendChild(el('span', 'dp-sub', 'mês × ' + nomeA.toLowerCase() + ', com a variação face ao mês anterior'));
  hq.appendChild(tq);
  cq.appendChild(hq);
  var tw = el('div', 'dp-tabw');
  var tab = el('table', 'dp-tab');
  var thead = el('thead'); var trh = el('tr');
  trh.appendChild(el('th', null, 'Mês'));
  series.forEach(function(sr){ var t = el('th'); var sw = el('i', 'dp-sw'); sw.style.background = sr.cor; sw.style.marginRight = '5px'; t.appendChild(sw); t.appendChild(document.createTextNode(sr.nome)); t.title = sr.nome; trh.appendChild(t); });
  trh.appendChild(el('th', null, 'Total'));
  trh.appendChild(el('th', null, 'vs mês anterior'));
  thead.appendChild(trh); tab.appendChild(thead);
  var tb = el('tbody');
  meses.slice().reverse().forEach(function(m, k, arr){
    var tr = el('tr');
    tr.appendChild(el('td', null, nomeMes(m, true)));
    porMes[m].forEach(function(v){ tr.appendChild(el('td', null, v ? tfEuros(v) : '—')); });
    var tot = somaArr(porMes[m]);
    tr.appendChild(el('td', 'tot', tfEuros(tot)));
    var ant = arr[k + 1] ? somaArr(porMes[arr[k + 1]]) : null;
    var d = ant === null ? null : tot - ant;
    tr.appendChild(el('td', d > 0.004 ? 'mais' : d < -0.004 ? 'menos' : '',
      d === null ? '—' : (Math.abs(d) < 0.005 ? '=' : (d > 0 ? '+' : '−') + tfEuros(Math.abs(d)))));
    tb.appendChild(tr);
  });
  var trf = el('tr', 'fim');
  trf.appendChild(el('td', null, 'Total do período'));
  series.forEach(function(sr, i){ trf.appendChild(el('td', null, tfEuros(meses.reduce(function(s, m){ return s + porMes[m][i]; }, 0)))); });
  trf.appendChild(el('td', 'tot', tfEuros(total)));
  trf.appendChild(el('td', null, compara && totalAntes ? 'antes ' + tfEuros(totalAntes) : ''));
  tb.appendChild(trf);
  tab.appendChild(tb); tw.appendChild(tab); cq.appendChild(tw);
  box.appendChild(cq);

  /* ---- a lista, por mes (a de sempre) ---- */
  var mostrar = DP.soSemPapel ? semPapel : lista;
  var card = el('div', 'card');
  var h = el('header');
  h.appendChild(el('h3', null, DP.soSemPapel ? 'Despesas sem papel' : 'Todas as despesas'));
  h.appendChild(el('span', 'mono', mostrar.length + (mostrar.length === 1 ? ' despesa · ' : ' despesas · ') + tfEuros(dpSoma(mostrar))));
  card.appendChild(h);
  /* Os graficos e o quadro ja dizem o essencial: a lista linha a linha abre-se
     quando se quer (e sempre, quando se pede so as que nao tem papel). */
  var abrir = DP.soSemPapel || DP.listaAberta;
  var bl = el('button', 'btn small', abrir ? 'Recolher a lista' : 'Mostrar as ' + mostrar.length + ' despesas');
  bl.type = 'button';
  bl.style.margin = '0 0 6px';
  bl.addEventListener('click', function(){ DP.listaAberta = !abrir; if (DP.soSemPapel && abrir) DP.soSemPapel = false; dpRender(); });
  card.appendChild(bl);
  if (!abrir){ box.appendChild(card); return; }
  var mes = null, rows = null;
  mostrar.slice().sort(function(a, b){ return a.spent_on < b.spent_on ? 1 : a.spent_on > b.spent_on ? -1 : 0; }).forEach(function(x){
    var m = String(x.spent_on).slice(0, 7);
    if (m !== mes){
      mes = m;
      var p = m.split('-');
      var t = el('h4', 'dp-mes' + (m === mesAgora ? ' agora' : ''), MESES[Number(p[1]) - 1] + ' ' + p[0]);
      t.appendChild(el('b', null, tfEuros(dpSoma(mostrar.filter(function(y){ return String(y.spent_on).slice(0, 7) === m; })))));
      card.appendChild(t);
      rows = el('div', 'tf-rows');
      card.appendChild(rows);
    }
    rows.appendChild(aeLinhaDespesa(x, true));
  });
  if (!mostrar.length) card.appendChild(el('p', 'ae-vazio', 'Todas as despesas do período têm papel.'));
  box.appendChild(card);
}

/* Apagar a despesa, não o ficheiro: se ela tinha vindo da caixa de entrada,
   o ficheiro fica lá, outra vez por triar. */
function dpApagar(x, depois) {
  var nome = x.description || 'esta despesa';
  if (!window.confirm('Apagar «' + nome + '»?\n\nSe tiver vindo da caixa de entrada, o ficheiro volta a ficar por triar.')) return;
  apiGestao('/api/despesas/' + x.id, { method: 'DELETE' }).then(function (r) {
    toast(r.caixa && r.caixa.length
      ? 'Despesa apagada. O ficheiro voltou à caixa, por triar.'
      : 'Despesa apagada.');
  }).catch(function (e) {
    toast(e.message || 'Não foi possível apagar a despesa.');
  /* Correndo bem ou mal, a lista volta a ser o que a base de dados diz. */
  }).then(function () {
    if (typeof depois === 'function') depois();
    else if (typeof aeRecarregarDespesas === 'function') aeRecarregarDespesas();
    if (typeof ibCarregar === 'function') ibCarregar();
  });
}

(function dpEsperar(){
  if (document.getElementById('nav') && typeof el === 'function'){ dpMontar(); dpRender(); return; }
  setTimeout(dpEsperar, 300);
})();
