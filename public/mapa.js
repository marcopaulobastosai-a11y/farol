'use strict';
/* Farol - a pagina das Areas (24 out 2026).
 *
 * O botao «Areas» da barra de baixo do telemovel abria a gaveta com o menu
 * inteiro, que nao era o que se esperava. Passa a abrir esta pagina: um
 * cartao por area, com as sub-areas por baixo, cada uma a um toque. No fim,
 * o resto do Farol (Tarefas, Projetos, Documentos, Revisao, Caixa) e o menu
 * completo, onde esta a Administracao.
 *
 * Nao aparece no menu lateral (la ja estao as areas uma a uma).
 */

var MP_CSS = [
  '#nav button[data-view="mapa"]{display:none !important}',
  '#view-mapa .mp-grelha{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}',
  '#view-mapa .mp-area{background:var(--surface);border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}',
  '#view-mapa .mp-topo{font:inherit;color:var(--ink);background:none;border:0;text-align:left;display:flex;align-items:center;gap:12px;padding:14px;min-height:64px;cursor:pointer;width:100%}',
  '#view-mapa .mp-topo:hover{background:var(--surface-2)}',
  '#view-mapa .mp-ic{width:40px;height:40px;border-radius:12px;background:var(--accent-soft);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;flex:none}',
  '#view-mapa .mp-ic svg{width:20px;height:20px}',
  '#view-mapa .mp-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
  '#view-mapa .mp-t b{font-size:1rem;font-weight:700}',
  '#view-mapa .mp-t small{font-size:.75rem;color:var(--muted)}',
  '#view-mapa .mp-seta{color:var(--muted);font-size:1.25rem;flex:none}',
  '#view-mapa .mp-subs{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 14px}',
  '#view-mapa .mp-subs button{font:inherit;font-size:.8125rem;font-weight:600;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);color:var(--ink);cursor:pointer}',
  '#view-mapa .mp-subs button:hover{border-color:var(--accent)}',
  '#view-mapa .mp-h{font-size:.75rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:22px 2px 10px}',
  '#view-mapa .mp-mais{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}',
  '#view-mapa .mp-mais button{font:inherit;font-size:.875rem;font-weight:600;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:12px;min-height:52px;padding:0 14px;display:flex;align-items:center;gap:10px;cursor:pointer;text-align:left}',
  '#view-mapa .mp-mais button svg{width:18px;height:18px;flex:none;color:var(--muted)}',
  '#view-mapa .mp-mais button .badge{margin-left:auto}',
  '#view-mapa .mp-def{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;font-weight:600}',
  '#view-mapa .mp-letra{display:flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:12px;background:var(--surface-2);border:1px solid var(--line)}',
  '#view-mapa .mp-letra button{flex:1 1 auto;min-height:40px;border-radius:9px;border:0;background:none;font:inherit;font-size:.8125rem;font-weight:600;color:var(--ink-2);padding:0 10px}',
  '#view-mapa .mp-letra button.on{background:var(--surface);color:var(--ink);box-shadow:0 1px 3px rgba(0,0,0,.08)}'
].join('\n');

function mpEstilo(){
  if (document.getElementById('mpCss')) return;
  var st = document.createElement('style'); st.id = 'mpCss'; st.textContent = MP_CSS;
  document.head.appendChild(st);
}

function mpMontar(){
  if (document.getElementById('view-mapa')) return;
  mpEstilo();
  if (window.TITLES) TITLES.mapa = ['Áreas', 'A vida da casa, área a área'];
  var nav = document.getElementById('nav');
  if (nav && !nav.querySelector('[data-view="mapa"]')){
    var b = el('button'); b.dataset.view = 'mapa'; b.textContent = 'Áreas'; nav.appendChild(b);
  }
  var sec = el('section', 'view');
  sec.id = 'view-mapa';
  var irmao = document.querySelector('.view');
  (irmao ? irmao.parentNode : document.body).appendChild(sec);
}

function mpIcone(view){
  var b = document.querySelector('#nav button[data-view="' + view + '"] svg');
  return b ? b.cloneNode(true) : null;
}

function mpAbertas(ids){
  return ((window.G && G.tasks) || []).filter(function(t){
    return !t.parent_id && !t.done && t.status !== 'concluida' && t.status !== 'cancelada' && ids.indexOf(t.context_id) >= 0;
  }).length;
}

function mpRender(){
  var sec = document.getElementById('view-mapa');
  if (!sec || !window.G || !G.contextos || typeof aeArea !== 'function') return;
  clear(sec);
  var grelha = el('div', 'mp-grelha');
  (window.AE_AREAS || []).forEach(function(a){
    var area = aeArea(a);
    if (!area) return;
    var subs = G.contextos.filter(function(c){ return c.parent_id === area.id && c.active !== false; });
    var ids = [area.id].concat(subs.map(function(s){ return s.id; }));
    var n = mpAbertas(ids);
    var card = el('div', 'mp-area');
    var topo = el('button', 'mp-topo');
    topo.type = 'button';
    var ic = el('span', 'mp-ic'); var svg = mpIcone(a.view); if (svg) ic.appendChild(svg);
    topo.appendChild(ic);
    var t = el('span', 'mp-t');
    t.appendChild(el('b', null, area.name));
    var linha = [];
    if (subs.length) linha.push(subs.length + (subs.length === 1 ? ' sub-área' : ' sub-áreas'));
    linha.push(n ? n + (n === 1 ? ' tarefa por fazer' : ' tarefas por fazer') : 'nada por fazer');
    t.appendChild(el('small', null, linha.join(' · ')));
    topo.appendChild(t);
    topo.appendChild(el('span', 'mp-seta', '›'));
    topo.addEventListener('click', function(){
      if (typeof aeNavFiltrar === 'function' && a.view !== 'financas') aeNavFiltrar(a, '');
      show(a.view);
    });
    card.appendChild(topo);
    if (subs.length){
      var sb = el('div', 'mp-subs');
      subs.forEach(function(s){
        var b = el('button', null, s.name);
        b.type = 'button';
        b.addEventListener('click', function(){
          if (typeof aeNavFiltrar === 'function') aeNavFiltrar(a, String(s.id));
          show(a.view);
        });
        sb.appendChild(b);
      });
      card.appendChild(sb);
    }
    grelha.appendChild(card);
  });
  sec.appendChild(grelha);

  sec.appendChild(el('div', 'mp-h', 'Mais'));
  var mais = el('div', 'mp-mais');
  [['tarefas', 'Tarefas'], ['projetos', 'Projetos'], ['documentos', 'Documentos'], ['revisao', 'Revisão'], ['inbox', 'Caixa de entrada'], ['menu', 'Menu completo']].forEach(function(x){
    var nb = document.querySelector('#nav button[data-view="' + x[0] + '"]');
    if (x[0] !== 'menu' && !nb) return;
    var b = el('button');
    b.type = 'button';
    var svg = nb ? nb.querySelector('svg') : null;
    if (svg) b.appendChild(svg.cloneNode(true));
    else if (typeof mnSvg === 'function' && window.MN_I) b.insertAdjacentHTML('beforeend', mnSvg(MN_I.menu, 18));
    b.appendChild(el('span', null, x[1]));
    var badge = nb ? nb.querySelector('.badge') : null;
    if (badge && badge.textContent.trim() && !badge.hidden) b.appendChild(el('span', 'badge', badge.textContent.trim()));
    b.addEventListener('click', function(){
      if (x[0] === 'menu'){ if (typeof mnGaveta === 'function') mnGaveta(true); return; }
      show(x[0]);
    });
    mais.appendChild(b);
  });
  sec.appendChild(mais);

  /* Definicoes deste aparelho: o tamanho da letra (telemovel). */
  if (typeof TM_LETRAS !== 'undefined'){
    var def = el('div', 'tm-so-movel');
    def.appendChild(el('div', 'mp-h', 'Definições deste telemóvel'));
    var cx = el('div', 'mp-def');
    cx.appendChild(el('span', null, 'Tamanho da letra'));
    var seg = el('div', 'fn-seg mp-letra');
    var atual = tmLetraAtual();
    TM_LETRAS.forEach(function(o){
      var b = el('button', o[0] === atual ? 'on' : '', o[1]);
      b.type = 'button';
      b.addEventListener('click', function(){ tmLetra(o[0]); mpRender(); });
      seg.appendChild(b);
    });
    cx.appendChild(seg);
    def.appendChild(cx);
    sec.appendChild(def);
  }
}

function mpLigar(){
  mpMontar();
  if (typeof window.show === 'function' && !window.show.mpEmbrulhado){
    var antes = window.show;
    var novo = function(v){ var r = antes.apply(this, arguments); if (v === 'mapa') { try { mpRender(); } catch (e) { console.error('[farol] areas', e); } } return r; };
    for (var k in antes) if (Object.prototype.hasOwnProperty.call(antes, k)) novo[k] = antes[k];
    novo.mpEmbrulhado = true;
    window.show = novo;
  }
  ['renderGestao', 'renderAll'].forEach(function(nome){
    var f = window[nome];
    if (typeof f !== 'function' || f.mpEmbrulhado) return;
    var n = function(){ var r = f.apply(this, arguments); try { var s = document.getElementById('view-mapa'); if (s && s.classList.contains('is-active')) mpRender(); } catch (e) {} return r; };
    n.mpEmbrulhado = true;
    window[nome] = n;
  });
}

(function mpEsperar(n){
  if (document.getElementById('nav') && typeof el === 'function' && typeof show === 'function' && window.G){
    try { mpLigar(); } catch (e) { console.error('[farol] areas', e); }
    return;
  }
  if (n < 60) setTimeout(function(){ mpEsperar(n + 1); }, 250);
})(0);
