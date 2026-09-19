/* Farol — Despesas.
 *
 * A catalogação automática criava despesas e ninguém as voltava a ver: não
 * havia ecrã nenhum que as mostrasse. Este separador mostra-as e deixa
 * apagar as que nasceram de uma leitura errada.
 *
 * Como os outros módulos, não toca no app.js: cria o seu separador dentro
 * das Finanças e reaproveita os globais ($, el, clear, toast, apiGestao).
 * O mecanismo de separadores do app.js é genérico — basta um botão com
 * data-tab e um painel com o data-pane do mesmo nome.
 */
'use strict';

var DP = { linhas: [], carregado: false };

var DP_CSS =
  '[data-pane="despesas"] .dp-vazio{padding:1.25rem 0;color:var(--muted);font-size:.875rem}' +
  '[data-pane="despesas"] td.dp-val{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}' +
  '[data-pane="despesas"] td.dp-quem{white-space:nowrap}' +
  '[data-pane="despesas"] .dp-apagar{padding:.18rem .5rem;font-size:.75rem}';

function dpEuros(v) {
  var n = Number(v || 0);
  return n.toFixed(2).replace('.', ',') + ' \u20ac';
}

function dpDia(s) {
  if (!s) return '';
  var p = String(s).slice(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] : s;
}

function dpMontar() {
  var vista = document.getElementById('view-financas');
  if (!vista || document.querySelector('[data-pane="despesas"]')) return;

  var estilo = document.createElement('style');
  estilo.id = 'dpCss';
  estilo.textContent = DP_CSS;
  document.head.appendChild(estilo);

  /* As Financas deixaram de ter separadores: o que restava neles era maqueta.
     As despesas passam a ser o conteudo do ecra, acima da nota do que ainda
     nao existe. */
  var pane = el('div');
  pane.dataset.pane = 'despesas';

  var card = el('div', 'card');
  var h = el('header');
  h.appendChild(el('h3', null, 'Despesas'));
  var resumo = el('span', 'mono', '');
  resumo.id = 'dpResumo';
  h.appendChild(resumo);
  card.appendChild(h);

  var scroll = el('div', 'scroll');
  var tab = el('table');
  var thead = el('thead');
  var tr = el('tr');
  ['Dia', 'O que foi', 'Pessoa', 'Onde', 'Valor', ''].forEach(function (t) {
    tr.appendChild(el('th', null, t));
  });
  thead.appendChild(tr);
  tab.appendChild(thead);
  var tbody = el('tbody');
  tbody.id = 'dpLinhas';
  tab.appendChild(tbody);
  scroll.appendChild(tab);
  card.appendChild(scroll);
  pane.appendChild(card);
  var nota = document.getElementById('finVazio');
  if (nota) vista.insertBefore(pane, nota);
  else vista.appendChild(pane);
}

function dpCarregar() {
  return apiGestao('/api/despesas').then(function (d) {
    DP.linhas = d.despesas || [];
    DP.carregado = true;
    dpRender();
  }).catch(function () { /* sem sessão ainda */ });
}

function dpRender() {
  var tb = document.getElementById('dpLinhas');
  if (!tb) return;
  clear(tb);

  var total = 0;
  DP.linhas.forEach(function (x) { total += Number(x.amount || 0); });
  var resumo = document.getElementById('dpResumo');
  if (resumo) {
    resumo.textContent = DP.linhas.length
      ? DP.linhas.length + (DP.linhas.length === 1 ? ' despesa' : ' despesas') + ' \u00b7 ' + dpEuros(total)
      : '';
  }

  if (!DP.linhas.length) {
    var vz = el('tr');
    var c = el('td', 'dp-vazio', 'Ainda n\u00e3o h\u00e1 despesas. As que a caixa de entrada catalogar aparecem aqui.');
    c.colSpan = 6;
    vz.appendChild(c);
    tb.appendChild(vz);
    return;
  }

  DP.linhas.forEach(function (x) {
    var tr = el('tr');
    tr.appendChild(el('td', 'n', dpDia(x.spent_on)));
    tr.appendChild(el('td', null, x.description || ''));
    tr.appendChild(el('td', 'dp-quem', x.pessoa || ''));
    tr.appendChild(el('td', null, x.merchant || ''));
    tr.appendChild(el('td', 'dp-val', dpEuros(x.amount)));
    var tdx = el('td');
    var bx = el('button', 'btn danger dp-apagar', 'Apagar');
    bx.type = 'button';
    bx.addEventListener('click', function () { dpApagar(x); });
    tdx.appendChild(bx);
    tr.appendChild(tdx);
    tb.appendChild(tr);
  });
}

/* Apagar a despesa, não o ficheiro: se ela tinha vindo da caixa de entrada,
   o ficheiro fica lá, outra vez por triar. */
function dpApagar(x) {
  var nome = x.description || 'esta despesa';
  if (!window.confirm('Apagar \u00ab' + nome + '\u00bb\u003f\n\nSe tiver vindo da caixa de entrada, o ficheiro volta a ficar por triar.')) return;
  apiGestao('/api/despesas/' + x.id, { method: 'DELETE' }).then(function (r) {
    toast(r.caixa && r.caixa.length
      ? 'Despesa apagada. O ficheiro voltou \u00e0 caixa, por triar.'
      : 'Despesa apagada.');
  }).catch(function (e) {
    toast(e.message || 'N\u00e3o foi poss\u00edvel apagar a despesa.');
  /* Correndo bem ou mal, a lista volta a ser o que a base de dados diz. */
  }).then(function () {
    dpCarregar();
    if (typeof ibCarregar === 'function') ibCarregar();
  });
}

/* Arranque preguiçoso: só lê as despesas quando alguém abre o separador. */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('button[data-view="financas"]');
  if (b && !DP.carregado) dpCarregar();
});

(function esperarApp() {
  if (document.getElementById('view-financas')) { dpMontar(); return; }
  setTimeout(esperarApp, 400);
})();
