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
     As despesas sao o dinheiro que ja saiu - o primeiro cartao do ecra. */
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
  vista.insertBefore(pane, vista.firstChild);
}

/* O bloco da area (area-tarefas.js) mete-se sempre no topo do ecra, e os dois
   montam-se em alturas diferentes: quem chegar depois fica em cima. As
   despesas voltam ao primeiro lugar sempre que se desenham. */
function dpAoTopo() {
  var vista = document.getElementById('view-financas');
  var pane = document.querySelector('[data-pane="despesas"]');
  if (vista && pane && vista.firstChild !== pane) vista.insertBefore(pane, vista.firstChild);
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
  dpAoTopo();
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
    /* O papel que deu origem a despesa abre-se aqui: e a prova de que o
       dinheiro saiu, e ate agora nao havia maneira nenhuma de chegar a ele. */
    var tdd = el('td');
    if (x.inbox_id) {
      var a = el('a', null, x.description || 'ficheiro');
      a.href = '/api/inbox/' + x.inbox_id + '/ficheiro';
      a.target = '_blank'; a.rel = 'noopener';
      a.title = 'Abrir o ficheiro';
      tdd.appendChild(a);
    } else {
      tdd.appendChild(document.createTextNode(x.description || ''));
      var sem = el('span', null, 'sem ficheiro');
      sem.style.cssText = 'margin-left:.5rem;font-size:.6875rem;color:var(--warn)';
      tdd.appendChild(sem);
    }
    tr.appendChild(tdd);
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

/* Arranque preguiçoso: só lê as despesas quando alguém abre as Finanças.
   O clique sozinho não chegava — quem entrasse por outro caminho (um link do
   Hoje, um show('financas') de outro módulo) ficava com a tabela vazia e a
   despesa parecia não existir em lado nenhum. */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('button[data-view="financas"]');
  if (b && !DP.carregado) dpCarregar();
});

(function apanharShow() {
  if (typeof window.show !== 'function') { setTimeout(apanharShow, 300); return; }
  var antes = window.show;
  window.show = function (view) {
    var r = antes.apply(this, arguments);
    if (view === 'financas' && !DP.carregado) dpCarregar();
    return r;
  };
})();

(function esperarApp() {
  if (document.getElementById('view-financas')) { dpMontar(); return; }
  setTimeout(esperarApp, 400);
})();
