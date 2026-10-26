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
'#view-mapa .mp-def + .mp-def{margin-top:10px}',
  '#view-mapa .mp-info{font-weight:400;color:var(--muted);font-size:.8125rem}',
  '#view-mapa .mp-erro{color:var(--bad);font-weight:500}',
  '#view-mapa .mp-form{display:flex;flex-direction:column;gap:8px}',
  '#view-mapa .mp-form input[type=password]{font:inherit;font-weight:400;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--ink)}',
  '#view-mapa .mp-chk{font-weight:500;font-size:.875rem;display:flex;align-items:center;gap:6px}',
  '#view-mapa .mp-acoes{display:flex;flex-wrap:wrap;gap:8px}',
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
    if (typeof bqEstado === 'function') def.appendChild(mpBloqueio());
    if (typeof tmPushEstado === 'function') def.appendChild(mpNotificacoes());
    sec.appendChild(def);
  }
}

/* Bloqueio da app neste aparelho (bloqueio.js): codigo e Face ID. */
function mpBloqueio(){
  var cx = el('div', 'mp-def');
  var est = bqEstado();
  cx.appendChild(el('span', null, 'Bloqueio da app'));
  var info = el('small', 'mp-info', est.ligado ? ('Ligado: código' + (est.bio ? ' e Face ID / impressão digital' : '') + '. Pede-se ao abrir e ao voltar depois de 1 minuto fora.')
    : 'Desligado. Com o bloqueio, o Farol pede o código ou o Face ID ao abrir.');
  cx.appendChild(info);
  var erro = el('small', 'mp-erro'); erro.hidden = true;
  var falha = function(e){ erro.textContent = (e && e.message) || 'Não deu.'; erro.hidden = false; };
  var acoes = el('div', 'mp-acoes');
  if (!est.ligado){
    var f = el('div', 'mp-form');
    var c1 = el('input'); c1.type = 'password'; c1.inputMode = 'numeric'; c1.autocomplete = 'new-password'; c1.placeholder = 'Código (4 a 8 algarismos)'; c1.maxLength = 8;
    var c2 = el('input'); c2.type = 'password'; c2.inputMode = 'numeric'; c2.autocomplete = 'new-password'; c2.placeholder = 'Repetir o código'; c2.maxLength = 8;
    var lb = el('label', 'mp-chk'); var ck = el('input'); ck.type = 'checkbox'; lb.appendChild(ck); lb.appendChild(document.createTextNode(' Também com Face ID / impressão digital'));
    lb.hidden = true;
    bqTemBiometria().then(function(sim){ if (sim){ lb.hidden = false; ck.checked = true; } });
    var ok = el('button', 'btn primary', 'Ligar o bloqueio'); ok.type = 'button';
    ok.addEventListener('click', function(){
      erro.hidden = true;
      if (c1.value !== c2.value) return falha(new Error('Os dois códigos não são iguais.'));
      ok.disabled = true;
      bqLigar(c1.value, ck.checked && !lb.hidden).then(function(){ mpRender(); if (typeof toast === 'function') toast('Bloqueio ligado neste aparelho.'); })
        .catch(function(e){ ok.disabled = false; falha(e); mpRender(); });
    });
    [c1, c2, lb, ok].forEach(function(x){ f.appendChild(x); });
    cx.appendChild(f);
  } else {
    if (!est.bio){
      var bb = el('button', 'btn', 'Juntar Face ID / impressão digital'); bb.type = 'button';
      bb.addEventListener('click', function(){ bqBio().then(function(){ mpRender(); }).catch(falha); });
      bqTemBiometria().then(function(sim){ if (!sim) bb.remove(); });
      acoes.appendChild(bb);
    }
    var ag = el('button', 'btn', 'Bloquear agora'); ag.type = 'button';
    ag.addEventListener('click', function(){ bqAgora(); });
    acoes.appendChild(ag);
    var de = el('button', 'btn', 'Desligar'); de.type = 'button';
    de.addEventListener('click', function(){
      var c = prompt('Para desligar, escreve o código:');
      if (c === null) return;
      bqDesligar(c).then(function(){ mpRender(); if (typeof toast === 'function') toast('Bloqueio desligado neste aparelho.'); }).catch(falha);
    });
    acoes.appendChild(de);
    cx.appendChild(acoes);
  }
  cx.appendChild(erro);
  return cx;
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


/* Notificacoes deste aparelho (telemovel.js + src/notificacoes.js). */
var MP_AVISOS = [['lembretes', 'Lembretes de tarefas e eventos'], ['manha', 'Resumo do dia, às 8h30'], ['revisao', 'Revisão da semana, ao domingo às 18h']];
function mpNotificacoes(){
  var cx = el('div', 'mp-def');
  cx.appendChild(el('span', null, 'Notificações'));
  var info = el('small', 'mp-info', 'A ver…');
  cx.appendChild(info);
  var corpo = el('div', 'mp-form');
  cx.appendChild(corpo);
  var erro = el('small', 'mp-erro'); erro.hidden = true;
  cx.appendChild(erro);
  var falha = function(e){ erro.textContent = (e && e.message) || 'Não deu.'; erro.hidden = false; };
  tmPushEstado().then(function(st){
    clear(corpo);
    if (!st.suportado){
      info.textContent = st.ios && !st.instalada
        ? 'No iPhone, as notificações só funcionam com o Farol no ecrã principal: no Safari, Partilhar › Adicionar ao ecrã principal, e abre-o por lá.'
        : 'Este browser não recebe notificações.';
      return;
    }
    if (st.ios && !st.instalada){
      info.textContent = 'No iPhone, as notificações só funcionam com o Farol no ecrã principal: no Safari, Partilhar › Adicionar ao ecrã principal, e abre-o por lá.';
      return;
    }
    if (st.permissao === 'denied'){
      info.textContent = 'As notificações do Farol estão bloqueadas. Liga-as em Definições do telemóvel › Notificações › Farol.';
      return;
    }
    if (!st.subscrito){
      info.textContent = 'Desligadas neste aparelho.';
      var prefs = {};
      MP_AVISOS.forEach(function(a){
        var lb = el('label', 'mp-chk'); var ck = el('input'); ck.type = 'checkbox'; ck.checked = true;
        ck.addEventListener('change', function(){ prefs[a[0]] = ck.checked; });
        prefs[a[0]] = true;
        lb.appendChild(ck); lb.appendChild(document.createTextNode(' ' + a[1])); corpo.appendChild(lb);
      });
      var ok = el('button', 'btn primary', 'Ligar as notificações'); ok.type = 'button';
      ok.addEventListener('click', function(){
        erro.hidden = true; ok.disabled = true; ok.textContent = 'A ligar…';
        tmPushLigar(prefs).then(function(){ if (typeof toast === 'function') toast('Notificações ligadas neste aparelho.'); mpRender(); })
          .catch(function(e){ ok.disabled = false; ok.textContent = 'Ligar as notificações'; falha(e); });
      });
      corpo.appendChild(ok);
      return;
    }
    info.textContent = 'Ligadas neste aparelho. Escolhe o que queres receber.';
    MP_AVISOS.forEach(function(a){
      var lb = el('label', 'mp-chk'); var ck = el('input'); ck.type = 'checkbox'; ck.checked = !st.prefs || st.prefs[a[0]] !== false;
      ck.addEventListener('change', function(){
        var p = {}; p[a[0]] = ck.checked;
        tmPushPrefs(st.endpoint, p).catch(function(e){ ck.checked = !ck.checked; falha(e); });
      });
      lb.appendChild(ck); lb.appendChild(document.createTextNode(' ' + a[1])); corpo.appendChild(lb);
    });
    var acoes = el('div', 'mp-acoes');
    var te = el('button', 'btn', 'Enviar uma de teste'); te.type = 'button';
    te.addEventListener('click', function(){ te.disabled = true; tmPushTeste(st.endpoint).then(function(){ te.disabled = false; if (typeof toast === 'function') toast('Enviada. Deve chegar daqui a uns segundos.'); }).catch(function(e){ te.disabled = false; falha(e); }); });
    var de = el('button', 'btn', 'Desligar'); de.type = 'button';
    de.addEventListener('click', function(){ tmPushDesligar().then(function(){ mpRender(); }).catch(falha); });
    acoes.appendChild(te); acoes.appendChild(de);
    corpo.appendChild(acoes);
  });
  return cx;
}
