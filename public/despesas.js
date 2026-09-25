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
 */

var DP = { montado: false, filtro: { onde: 'tudo', quem: 'todos', quando: 'ano' } };
try { DP.filtro = JSON.parse(localStorage.getItem('dpFiltro') || 'null') || DP.filtro; } catch (e) {}
function dpGuardar(){ try { localStorage.setItem('dpFiltro', JSON.stringify(DP.filtro)); } catch (e) {} }

var DP_CSS =
  '#view-despesas .dp-mes{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;' +
  'text-transform:uppercase;color:var(--muted);padding:14px 16px 4px;display:flex;gap:8px;font-weight:500}' +
  '#view-despesas .dp-mes b{margin-left:auto;font-weight:500;color:var(--ink-2);font-variant-numeric:tabular-nums}' +
  '#view-despesas .dp-mes.agora{color:var(--accent-ink)}' +
  '#view-despesas .tf-rows{padding:0 10px}';

var DP_QUANDO = [
  ['mes', 'Este mês'],
  ['d90', '90 dias'],
  ['ano', 'Este ano'],
  ['tudo', 'Tudo']
];

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

function dpLista(){
  var f = DP.filtro;
  var linhas = (typeof aeDespesas === 'function' ? aeDespesas() : null);
  if (!linhas) return null;
  var ids = (f.onde !== 'tudo' && f.onde !== 'sem') ? dpIdsDaArea(Number(f.onde)) : null;
  var h = tfHoje();
  var de = null;
  if (f.quando === 'mes') de = tfISO(new Date(h.getFullYear(), h.getMonth(), 1));
  else if (f.quando === 'd90') de = tfISO(tfMais(h, -90));
  else if (f.quando === 'ano') de = h.getFullYear() + '-01-01';

  return linhas.filter(function(x){
    if (f.onde === 'sem'){ if (x.context_id) return false; }
    else if (ids && ids.indexOf(x.context_id) < 0) return false;
    if (f.quem !== 'todos' && x.person_id !== Number(f.quem)) return false;
    if (de && x.spent_on < de) return false;
    return true;
  });
}

function dpRender(){
  if (!document.getElementById('view-despesas')) return;
  var box = document.getElementById('dpCaixa');
  if (!box || typeof aeLinhaDespesa !== 'function') return;
  clear(box);
  var f = DP.filtro;

  function chip(caixa, nome, ligado, fn, cor){
    var b = el('button', 'ae-chip' + (ligado ? ' on' : ''));
    b.type = 'button';
    if (cor){ var d = el('i', 'dot'); d.style.background = cor; b.appendChild(d); }
    b.appendChild(document.createTextNode(nome));
    b.addEventListener('click', fn);
    caixa.appendChild(b);
  }
  function fila(rotulo){
    var l = el('div', 'ae-fl');
    l.appendChild(el('span', 'ae-lbl', rotulo));
    var c = el('div', 'ae-chips');
    l.appendChild(c);
    l.chips = c;
    return l;
  }

  var barra = el('div', 'card ae-filtros');
  var f1 = fila('Onde');
  chip(f1.chips, 'Tudo', f.onde === 'tudo', function(){ DP.filtro.onde = 'tudo'; dpGuardar(); dpRender(); });
  dpAreas().forEach(function(c){
    chip(f1.chips, c.name, f.onde === String(c.id), function(){ DP.filtro.onde = String(c.id); dpGuardar(); dpRender(); });
  });
  chip(f1.chips, 'Sem área', f.onde === 'sem', function(){ DP.filtro.onde = 'sem'; dpGuardar(); dpRender(); });
  barra.appendChild(f1);

  var f2 = fila('Quem');
  chip(f2.chips, 'Agregado todo', f.quem === 'todos', function(){ DP.filtro.quem = 'todos'; dpGuardar(); dpRender(); }, 'var(--faint)');
  ((window.G && G.people) || []).filter(function(p){ return p.active !== false; }).forEach(function(p){
    chip(f2.chips, p.name, f.quem === String(p.id), function(){ DP.filtro.quem = String(p.id); dpGuardar(); dpRender(); }, p.color || 'var(--c1)');
  });
  barra.appendChild(f2);

  var f3 = fila('Quando');
  DP_QUANDO.forEach(function(q){
    chip(f3.chips, q[1], f.quando === q[0], function(){ DP.filtro.quando = q[0]; dpGuardar(); dpRender(); });
  });
  barra.appendChild(f3);
  box.appendChild(barra);

  var lista = dpLista();
  var card = el('div', 'card');
  var h = el('header');
  h.appendChild(el('h3', null, 'Despesas'));
  var total = lista ? lista.reduce(function(s, x){ return s + Number(x.amount || 0); }, 0) : 0;
  h.appendChild(el('span', 'mono', lista && lista.length
    ? lista.length + (lista.length === 1 ? ' despesa · ' : ' despesas · ') + tfEuros(total) : ''));
  card.appendChild(h);

  if (!lista){
    card.appendChild(el('p', 'ae-vazio', 'A ler as despesas…'));
  } else if (!lista.length){
    card.appendChild(el('p', 'ae-vazio', 'Nenhuma despesa no que está filtrado. As despesas nascem da caixa de entrada ou de um pagamento dado por pago.'));
  } else {
    var mesAgora = tfISO(tfHoje()).slice(0, 7);
    var mes = null, rows = null;
    lista.forEach(function(x){
      var m = String(x.spent_on).slice(0, 7);
      if (m !== mes){
        mes = m;
        var p = m.split('-');
        var t = el('h4', 'dp-mes' + (m === mesAgora ? ' agora' : ''), MESES[Number(p[1]) - 1] + ' ' + p[0]);
        var doMes = lista.filter(function(y){ return String(y.spent_on).slice(0, 7) === m; });
        t.appendChild(el('b', null, tfEuros(doMes.reduce(function(s, y){ return s + Number(y.amount || 0); }, 0))));
        card.appendChild(t);
        rows = el('div', 'tf-rows');
        card.appendChild(rows);
      }
      rows.appendChild(aeLinhaDespesa(x, true));
    });
  }
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
