'use strict';
/* Farol - o que cada area tem por fazer.
 *
 * A regra do farol-organizacao.md: a coisa fica na area, o trabalho sobre a
 * coisa fica no projeto. Faltava a outra metade - a area mostrar o que e
 * dela. As tarefas soltas (sem projeto) sao a operacao corrente: o ordenado
 * da loja, a renda da casa, o IUC. Viviam so na lista das Tarefas, e os ecras
 * das areas diziam «ainda nao ha nada aqui» por cima de dezenas delas.
 *
 * Cada ecra de area passa a ter:
 *   - «Por fazer nesta area»: as tarefas abertas da area e das sub-areas que
 *     NAO pertencem a projeto nenhum, agrupadas por sub-area. As de projeto
 *     vivem no projeto e nao se repetem aqui - por isso as da Falua, que sao
 *     o programa de implementacao da marca, nao aparecem no Profissional ate
 *     haver operacao da empresa.
 *   - «Projetos nesta area»: uma linha por projeto aberto, que leva a ele.
 *
 * Profissional e Patrimonio eram areas sem ecra: nascem aqui, com botao no
 * menu. Como os outros modulos, nao toca no app.js.
 */

var AE_AREAS = [
  { view: 'familia', nome: 'familia' },
  { view: 'casa', nome: 'casa' },
  { view: 'financas', nome: 'financas' },
  { view: 'saude', nome: 'saude' },
  { view: 'profissional', nome: 'profissional', novo: true, titulo: 'Profissional',
    sub: 'Operação corrente das empresas, do trabalho e do MBA',
    icone: '<rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M3.5 12h17"/>' },
  { view: 'patrimonio', nome: 'patrimonio', novo: true, titulo: 'Património',
    sub: 'Bens que se gerem: imóveis, carro, terreno',
    icone: '<path d="M3 20h18"/><path d="M5 20V10l7-5 7 5v10"/><path d="M9 20v-5h6v5"/><path d="M12 9.5v.01"/>' }
];

var AE_CSS =
  '.ae{margin-bottom:14px}' +
  '.ae-grp{margin-top:6px}' +
  '.ae-grp + .ae-grp{margin-top:14px}' +
  '.ae-grp > h4{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted);padding:4px 2px;font-weight:500;display:flex;gap:8px}' +
  '.ae-grp > h4 span{color:var(--faint)}' +
  '.ae-vazio{color:var(--muted);font-size:.875rem;padding:.5rem 0}' +
  '.ae-nota{color:var(--muted);font-size:.78rem;margin-top:10px}' +
  '.ae-pj{display:flex;align-items:baseline;gap:10px;padding:8px;border-top:1px solid var(--line-soft);cursor:pointer;border-radius:8px}' +
  '.ae-pj:first-of-type{border-top-color:transparent}' +
  '.ae-pj:hover{background:var(--surface-2)}' +
  '.ae-pj b{font-weight:500;font-size:.875rem;color:var(--ink)}' +
  '.ae-pj small{color:var(--muted);font-size:.72rem}' +
  '.ae-pj .mono{margin-left:auto;white-space:nowrap}';

function aeNorm(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

/* A area de topo de um ecra, encontrada pelo nome e nao pelo id: os ids sao
   da base de producao e o repositorio e publico. */
function aeArea(a){
  var cs = (window.G && G.contextos) || [];
  for (var i = 0; i < cs.length; i++){
    if (!cs[i].parent_id && aeNorm(cs[i].name).indexOf(a.nome) === 0) return cs[i];
  }
  return null;
}
function aeSubs(area){
  return ((G && G.contextos) || []).filter(function(c){ return c.parent_id === area.id; });
}
function aeAberta(t){ return t.status !== 'concluida' && t.status !== 'cancelada'; }

function aeMontar(){
  if (document.getElementById('aeCss')) return;
  var st = document.createElement('style'); st.id = 'aeCss'; st.textContent = AE_CSS;
  document.head.appendChild(st);

  var nav = document.getElementById('nav');
  var docsBtn = nav && nav.querySelector('button[data-view="documentos"]');
  var docsView = document.getElementById('view-documentos');
  AE_AREAS.forEach(function(a){
    if (!a.novo || document.getElementById('view-' + a.view)) return;
    TITLES[a.view] = [a.titulo, a.sub];
    var b = document.createElement('button');
    b.dataset.view = a.view;
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' + a.icone + '</svg>';
    b.appendChild(document.createTextNode(' ' + a.titulo));
    if (nav) nav.insertBefore(b, docsBtn || null);
    var sec = el('section', 'view'); sec.id = 'view-' + a.view;
    if (docsView) docsView.parentNode.insertBefore(sec, docsView);
    else document.querySelector('main').appendChild(sec);
  });

  /* A Familia tinha um cartao a prometer que isto ainda nao existia. */
  var fam = document.getElementById('view-familia');
  if (fam){
    fam.querySelectorAll('.card').forEach(function(c){
      var h = c.querySelector('header h3');
      if (h && /Tarefas, apoio e datas/.test(h.textContent)) c.remove();
    });
  }
}

/* Onde o bloco vai morar em cada ecra. Na Familia fica na coluna da direita,
   no sitio do cartao que dizia «ainda nao ha nada aqui»; nos outros, no topo. */
function aeCaixa(a){
  var id = 'ae-' + a.view;
  var box = document.getElementById(id);
  if (box) return box;
  var sec = document.getElementById('view-' + a.view);
  if (!sec) return null;
  box = el('div', 'stack ae'); box.id = id;
  var alvo = sec;
  if (a.view === 'familia'){
    var cols = sec.querySelectorAll('.grid.split > .stack');
    if (cols[1]) alvo = cols[1];
  }
  alvo.insertBefore(box, alvo.firstChild);
  return box;
}

function aeLinha(t){
  var li = el('div', 'tf-row');
  li.appendChild(tfCaixa(t, function(){
    /* Um pagamento fecha-se com valor e prova, na janela das Tarefas. */
    if (tfTipo(t) === 'pagamento'){ show('tarefas'); setTimeout(function(){ tfAlternar(t); }, 0); return; }
    tfAlternar(t);
  }));
  var corpo = el('div', 'tf-body');
  corpo.appendChild(el('span', 'tf-t', t.title));
  var m = el('div', 'tf-m');
  var dono = pessoa(t.owner_id);
  if (dono){
    var d = el('span'); var dot = el('i', 'dot'); dot.style.background = dono.color || 'var(--c1)';
    d.appendChild(dot); d.appendChild(document.createTextNode(dono.name)); m.appendChild(d);
  }
  (t.subjects || []).forEach(function(pid){ var p = pessoa(pid); if (p) m.appendChild(el('span', null, '→ ' + p.name)); });
  if (tfTipo(t) === 'pagamento') m.appendChild(el('span', null, 'pagamento'));
  if (tfTipo(t) === 'lembrete') m.appendChild(el('span', null, 'lembrete'));
  if (t.repeat_rule){
    var r = el('span'); r.innerHTML = tfSvg(TF_I.rep, 11);
    r.appendChild(document.createTextNode(t.repeat_label || 'repete'));
    m.appendChild(r);
  }
  if (tfSemProva(t)) m.appendChild(pill('falta comprovativo', 'warn'));
  if (m.childNodes.length) corpo.appendChild(m);
  li.appendChild(corpo);
  if (tfTipo(t) === 'pagamento' && t.amount) li.appendChild(el('div', 'tf-val', tfEuros(t.amount)));
  li.appendChild(el('div', 'tf-r ' + tfNivelData(t), tfDataTxt(t.due_on, t.due_time)));
  li.addEventListener('click', function(){
    if (typeof avAbrir === 'function') avAbrir({ origem: 'tarefa', id: t.id, quando: t.due_on || null, detail: areaNome(t.context_id) });
    else { show('tarefas'); tfAbrir(t.id); }
  });
  return li;
}

function aeOrdem(a, b){
  if (a.due_on && b.due_on && a.due_on !== b.due_on) return a.due_on < b.due_on ? -1 : 1;
  if (!!a.due_on !== !!b.due_on) return a.due_on ? -1 : 1;
  return String(a.title).localeCompare(String(b.title), 'pt');
}

function aeRenderArea(a){
  var box = aeCaixa(a);
  if (!box) return;
  clear(box);
  var area = aeArea(a);
  if (!area) return;
  var subs = aeSubs(area);
  var ids = [area.id].concat(subs.map(function(s){ return s.id; }));

  var soltas = (G.tasks || []).filter(function(t){
    return aeAberta(t) && !t.parent_id && !t.project_id && ids.indexOf(t.context_id) >= 0;
  });
  var notas = soltas.filter(function(t){ return tfTipo(t) === 'nota'; }).length;
  soltas = soltas.filter(function(t){ return tfTipo(t) !== 'nota'; });
  var atrasadas = soltas.filter(function(t){ return tfNivelData(t) === 'bad'; }).length;

  var card = el('div', 'card');
  var h = el('header');
  h.appendChild(el('h3', null, 'Por fazer nesta área'));
  h.appendChild(el('span', 'mono', soltas.length
    ? soltas.length + (soltas.length === 1 ? ' tarefa' : ' tarefas') + (atrasadas ? ' · ' + atrasadas + ' em atraso' : '')
    : ''));
  card.appendChild(h);

  if (!soltas.length){
    card.appendChild(el('p', 'ae-vazio', 'Nada por fazer fora dos projetos.'));
  } else {
    var grupos = [{ c: area, lista: [] }].concat(subs.map(function(s){ return { c: s, lista: [] }; }));
    soltas.forEach(function(t){
      grupos.forEach(function(g){ if (g.c.id === t.context_id) g.lista.push(t); });
    });
    grupos = grupos.filter(function(g){ return g.lista.length; });
    var cabecas = grupos.length > 1 || grupos[0].c.id !== area.id;
    grupos.forEach(function(g){
      var gr = el('div', 'ae-grp');
      if (cabecas){
        var h4 = el('h4', null, g.c.id === area.id ? area.name + ' · geral' : g.c.name);
        h4.appendChild(el('span', null, String(g.lista.length)));
        gr.appendChild(h4);
      }
      var rows = el('div', 'tf-rows');
      g.lista.sort(aeOrdem).forEach(function(t){ rows.appendChild(aeLinha(t)); });
      gr.appendChild(rows);
      card.appendChild(gr);
    });
  }
  if (notas) card.appendChild(el('p', 'ae-nota', notas + (notas === 1 ? ' nota' : ' notas') + ' desta área nas Tarefas › Notas.'));
  box.appendChild(card);

  /* Os projetos da area: so a linha, o trabalho vive la. */
  var pjs = (G.projects || []).filter(function(p){
    return p.tipo !== 'programa' && p.status !== 'concluido' && ids.indexOf(p.context_id) >= 0;
  });
  if (pjs.length){
    var cp = el('div', 'card');
    var hp = el('header');
    hp.appendChild(el('h3', null, 'Projetos nesta área'));
    hp.appendChild(el('span', 'mono', String(pjs.length)));
    cp.appendChild(hp);
    pjs.forEach(function(p){
      var r = el('div', 'ae-pj');
      var g = el('div');
      g.appendChild(el('b', null, p.name));
      var pai = p.parent_id ? projeto(p.parent_id) : null;
      var sub = [pai ? pai.name : null, areaNome(p.context_id), p.status === 'planeado' ? 'planeado' : null]
        .filter(Boolean).join(' · ');
      if (sub){ g.appendChild(document.createElement('br')); g.appendChild(el('small', null, sub)); }
      r.appendChild(g);
      var c = p.contagem || {};
      r.appendChild(el('span', 'mono', (c.abertas || 0) + ' por fazer' + (c.atrasadas ? ' · ' + c.atrasadas + ' em atraso' : '')));
      r.addEventListener('click', function(){ if (typeof pjAbrir === 'function') pjAbrir(p.id); else show('projetos'); });
      cp.appendChild(r);
    });
    box.appendChild(cp);
  }
}

function aeRender(){
  if (!window.G || !G.contextos || typeof tfCaixa !== 'function') return;
  aeMontar();
  AE_AREAS.forEach(function(a){
    /* Um ecra que rebenta nao cala os outros. */
    try { aeRenderArea(a); } catch (e) { console.error('[farol] area ' + a.view, e); }
  });
}

var _aeRenderGestao = renderGestao;
renderGestao = function(){
  _aeRenderGestao();
  aeRender();
};

aeMontar();
if (window.G && G.contextos) aeRender();
