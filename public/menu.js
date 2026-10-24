'use strict';
/* Farol - o menu novo (fase 1 do plano do novo menu, 24 out 2026).
 *
 * O menu de hoje e montado por uns dez modulos, cada um a pendurar o seu
 * botao onde lhe parece. Mexer em todos de uma vez era arriscado com a app
 * em producao e com dados reais. Por isso este ficheiro nao toca em nenhum
 * deles: deixa-os criar os botoes como sempre e depois arruma-os - por
 * grupos (Painel, Areas, Programas, Transversal, Administracao), pela
 * propriedade CSS «order», sem mudar ninguem de pai. Assim nenhum
 * «nav.insertBefore» dos outros modulos deixa de funcionar.
 *
 * O que traz:
 *  - os grupos do menu e o bloco Programas (cada programa leva aos Projetos);
 *  - o botao + Captar (tarefa, pagamento, lembrete, evento, papel para a caixa);
 *  - a Caixa de entrada sai do menu e passa a contador no Hoje;
 *  - o menu recolhido (so icones) no computador;
 *  - a barra de baixo no telemovel (Hoje, Agenda, +, Tarefas, Menu).
 *
 * Fase 7 (24 out 2026): o menu novo e o de todos. Ja nao ha interruptor.
 * Fica so uma saida de emergencia, sem botao: abrir o Farol com ?menu=antigo
 * volta ao menu de antes naquele browser (localStorage 'farolMenu'), e
 * ?menu=novo desfaz. A chave antiga ('farolMenuNovo') deixa de contar, para
 * ninguem ficar preso numa escolha de quando havia interruptor.
 */

var MN = { on: false, mini: false, admin: false, pendente: false, obs: null, progsChave: null };

function mnLer(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
function mnGravar(k, v){
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
}

/* A ordem de cada ecra no menu novo. Os que nao estao aqui vao para o fim
   da Administracao, para nada desaparecer sem querer. */
var MN_ORDEM = {
  hoje: 10, agenda: 11, tarefas: 12,
  familia: 21, casa: 22, patrimonio: 23, financas: 24, profissional: 25, saude: 26, viagens: 27,
  gente: 41, projetos: 42, documentos: 43, revisao: 44,
  acessos: 51, areas: 52, pessoas: 53, destinatarios: 54, splitwise: 55, eventos: 56, despesas: 57
};
var MN_FORA = { inbox: true };
var MN_GRUPOS = [
  ['painel', 'Painel', 9],
  ['areas', 'Áreas', 20],
  ['transversal', 'Transversal', 40],
  ['admin', 'Administração', 50]
];
var MN_CAPTAR = [
  ['tarefa', 'Tarefa'],
  ['pagamento', 'Pagamento'],
  ['lembrete', 'Lembrete'],
  ['evento', 'Evento'],
  ['caixa', 'Papel para a caixa']
];

var MN_I = {
  mais: '<path d="M12 5v14M5 12h14"/>',
  recolher: '<path d="M15 6l-6 6 6 6"/>',
  hoje: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  tarefas: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  caixa: '<path d="M4 13l2.5-7h11L20 13v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>'
};
function mnSvg(d, w){
  return '<svg width="' + (w || 16) + '" height="' + (w || 16) + '" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
}

var MN_CSS = [
  /* o interruptor existe sempre (so para o administrador) */
  '#nav .mn-toggle{order:99;margin-top:10px;font-size:.75rem;color:var(--muted);border:1px dashed var(--line);justify-content:center}',
  '#nav .mn-toggle:hover{color:var(--accent-ink);border-color:var(--accent)}',
  /* tudo o resto so com o menu novo ligado */
  'body.mn-on #nav .nav-label{display:none}',
  'body.mn-on #nav .mn-fora{display:none!important}',
  '#nav .mn-label{display:none}',
  'body.mn-on #nav .mn-label{display:block;font-family:var(--mono);font-size:.625rem;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);padding:14px 8px 4px}',
  '#nav .mn-topo{display:none}',
  'body.mn-on #nav .mn-topo{display:flex;order:0;margin-bottom:8px}',
  'body.mn-on #nav .ps-caixa{order:1}',
  '#nav button.mn-captar{justify-content:center;gap:6px;min-height:40px;font-weight:500}',
  '#nav .mn-progs{display:none}',
  'body.mn-on #nav .mn-progs{display:flex;flex-direction:column;gap:1px;order:31}',
  '#nav button.mn-prog{font-size:.8125rem;padding:6px 8px 6px 34px;position:relative}',
  '#nav button.mn-prog::before{content:"";position:absolute;left:15px;top:50%;width:9px;height:1px;background:var(--line)}',
  '#nav button.mn-prog .mn-pn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '#nav button.mn-prog .badge{margin-left:auto}',
  '#nav .mn-vazio{font-size:.75rem;color:var(--muted);padding:4px 8px 4px 34px;margin:0}',
  '#nav .mn-ini{display:none}',
  '.brand .mn-recolher{display:none}',
  'body.mn-on .brand .mn-recolher{display:inline-flex;margin-left:auto;width:30px;height:30px;border-radius:7px;align-items:center;justify-content:center;color:var(--muted);border:1px solid var(--line-soft)}',
  'body.mn-on .brand .mn-recolher:hover{color:var(--ink);border-color:var(--line)}',
  /* o contador da caixa no Hoje */
  '#nav .mn-cx{margin-left:4px}',
  '.mn-banner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;padding:12px 16px;border:1px solid var(--line);border-radius:12px;background:var(--surface)}',
  '.mn-banner b{font-weight:500}',
  '.mn-banner .mn-bs{color:var(--muted);font-size:.8125rem}',
  '.mn-banner .btn{margin-left:auto}',
  /* + Captar: o menu que abre */
  '#mnPop{position:fixed;z-index:1200;min-width:220px;padding:6px;border-radius:12px;border:1px solid var(--line);background:var(--surface);box-shadow:0 10px 30px rgba(0,0,0,.14);display:flex;flex-direction:column;gap:2px}',
  '#mnPop button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:10px 12px;border-radius:8px;font:inherit;font-size:.875rem;color:var(--ink);min-height:44px}',
  '#mnPop button:hover,#mnPop button:focus-visible{background:var(--surface-2)}',
  /* a largura do menu: so no computador, com o menu aberto */
  '#mnPuxador{display:none}',
  '@media (min-width:901px){',
  '  body.mn-on:not(.mn-mini) .app{grid-template-columns:var(--mn-larg,248px) minmax(0,1fr)}',
  '  body.mn-on:not(.mn-mini) #mnPuxador{display:block;position:fixed;top:0;bottom:0;left:calc(var(--mn-larg,248px) - 4px);width:8px;z-index:40;cursor:col-resize;touch-action:none}',
  '  body.mn-on:not(.mn-mini) #mnPuxador:hover,body.mn-on:not(.mn-mini) #mnPuxador:focus-visible,body.mn-a-puxar #mnPuxador{background:linear-gradient(to right,transparent 3px,var(--accent) 3px,var(--accent) 5px,transparent 5px);outline:none}',
  '  body.mn-a-puxar{cursor:col-resize;user-select:none}',
  '}',
  /* menu recolhido, so no computador */
  '@media (min-width:901px){',
  '  body.mn-on.mn-mini .app{grid-template-columns:68px minmax(0,1fr)}',
  '  body.mn-on.mn-mini .rail{padding:18px 8px;gap:14px}',
  '  body.mn-on.mn-mini .brand{flex-direction:column;padding:0;gap:8px}',
  '  body.mn-on.mn-mini .brand > div:not(.beacon){display:none}',
  '  body.mn-on.mn-mini .brand .mn-recolher{margin-left:0;transform:rotate(180deg)}',
  '  body.mn-on.mn-mini #nav button{font-size:0;justify-content:center;gap:0;padding:10px 0;position:relative}',
  '  body.mn-on.mn-mini #nav button svg{width:18px;height:18px}',
  '  body.mn-on.mn-mini #nav button .badge{display:none}',
  '  body.mn-on.mn-mini #nav button.mn-tem::after{content:"";position:absolute;top:7px;right:12px;width:7px;height:7px;border-radius:50%;background:var(--accent)}',
  '  body.mn-on.mn-mini #nav .mn-ini{display:inline-flex;font-size:.8125rem;font-weight:500;width:18px;justify-content:center}',
  '  body.mn-on.mn-mini #nav .mn-label,body.mn-on.mn-mini #nav .ae-nsubs,body.mn-on.mn-mini #nav .mn-progs{display:none!important}',
  '  body.mn-on.mn-mini #nav .ps-caixa input,body.mn-on.mn-mini #nav .ps-caixa .ps-tecla{display:none}',
  '  body.mn-on.mn-mini #nav .ps-caixa{justify-content:center;cursor:pointer}',
  '  body.mn-on.mn-mini #nav .mn-toggle{display:none}',
  '  body.mn-on.mn-mini .rail-foot{justify-content:center}',
  '  body.mn-on.mn-mini .rail-foot > div,body.mn-on.mn-mini .rail-foot .btn{display:none}',
  '}',
  /* telemovel: barra de baixo e o menu inteiro numa gaveta */
  '#mnBarra{display:none}',
  '@media (max-width:900px){',
  '  body.mn-on .rail{display:none}',
  '  body.mn-on.mn-gaveta .rail{display:flex;position:fixed;inset:0;z-index:900;flex-direction:column;align-items:stretch;gap:16px;overflow-y:auto;height:auto;',
  '    padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(96px + env(safe-area-inset-bottom,0px));border:none;background:var(--ground)}',
  '  body.mn-on.mn-gaveta .rail .nav{flex-direction:column;gap:2px}',
  '  body.mn-on.mn-gaveta .rail .nav button{white-space:normal;padding:11px 8px}',
  '  body.mn-on.mn-gaveta .rail-foot{display:flex}',
  '  body.mn-on.mn-gaveta{overflow:hidden}',
  '  body.mn-on main{padding-bottom:calc(96px + env(safe-area-inset-bottom,0px))}',
  '  body.mn-on #mnBarra{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:950;justify-content:space-around;align-items:center;',
  '    padding:6px 6px calc(8px + env(safe-area-inset-bottom,0px));background:var(--surface);border-top:1px solid var(--line)}',
  '  #mnBarra button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-width:56px;min-height:48px;',
  '    font:inherit;font-size:.6875rem;color:var(--muted);background:none;border:none;position:relative}',
  '  #mnBarra button.is-active{color:var(--accent-ink);font-weight:500}',
  '  #mnBarra button.mn-mais{width:54px;height:54px;min-width:54px;border-radius:16px;background:var(--accent);color:#fff;margin-top:-20px}',
  '  :root[data-theme="dark"] #mnBarra button.mn-mais{color:#06181A}',
  '  #mnBarra .mn-pt{position:absolute;top:4px;right:12px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--accent);color:#fff;',
  '    font-family:var(--mono);font-size:.625rem;line-height:16px;text-align:center}',
  '  :root[data-theme="dark"] #mnBarra .mn-pt{color:#06181A}',
  '}'
].join('\n');

function mnEstilo(){
  if (document.getElementById('mnCss')) return;
  var st = document.createElement('style'); st.id = 'mnCss'; st.textContent = MN_CSS;
  document.head.appendChild(st);
}

/* O texto de um botao do menu, sem as bolhas. */
function mnTexto(b){
  var t = '';
  for (var i = 0; i < b.childNodes.length; i++){
    var n = b.childNodes[i];
    if (n.nodeType === 3) t += n.nodeValue;
    else if (n.nodeType === 1 && n.tagName === 'SPAN' && !/badge|mn-ini|ae-nseta/.test(n.className || '')) t += n.textContent;
  }
  return t.replace(/\s+/g, ' ').trim();
}
function mnOrdem(n, o){ o = String(o); if (n.style.order !== o) n.style.order = o; }

/* ------------------------------ o interruptor ------------------------------ */
function mnInterruptor(nav){
  /* Fase 7: ja nao ha interruptor. Tira-se o botao se tiver ficado. */
  var velho = nav.querySelector('.mn-toggle');
  if (velho) velho.remove();
  return;
  var t = nav.querySelector('.mn-toggle');
  var txt = MN.on ? 'Voltar ao menu antigo' : 'Experimentar o menu novo';
  if (!t){
    t = el('button', 'mn-toggle', txt);
    t.type = 'button';
    t.addEventListener('click', function(){
      mnGravar('farolMenuNovo', MN.on ? '0' : '1');
      location.reload();
    });
    nav.appendChild(t);
  } else if (t.textContent !== txt){
    t.textContent = txt;
  }
}

/* ------------------------------ arrumar o menu ----------------------------- */
function mnRotulos(nav){
  MN_GRUPOS.forEach(function(g){
    var r = nav.querySelector('.mn-label[data-g="' + g[0] + '"]');
    if (!r){
      r = el('div', 'mn-label', g[1]);
      r.dataset.g = g[0];
      nav.appendChild(r);
    }
    mnOrdem(r, g[2]);
  });
}

function mnTopo(nav){
  if (nav.querySelector('.mn-topo')) return;
  var topo = el('div', 'mn-topo');
  var b = el('button', 'btn primary mn-captar');
  b.type = 'button';
  b.setAttribute('aria-haspopup', 'menu');
  b.title = 'Captar';
  b.innerHTML = mnSvg(MN_I.mais, 16) + '<span>Captar</span>';
  b.addEventListener('click', function(e){ e.stopPropagation(); mnCaptar(b); });
  topo.appendChild(b);
  nav.insertBefore(topo, nav.firstChild);
}

function mnRecolher(){
  var brand = document.querySelector('.rail .brand');
  if (!brand || brand.querySelector('.mn-recolher')) return;
  var b = el('button', 'mn-recolher');
  b.type = 'button';
  b.setAttribute('aria-label', 'Recolher o menu');
  b.innerHTML = mnSvg(MN_I.recolher, 16);
  b.addEventListener('click', function(){ mnMini(!MN.mini); });
  brand.appendChild(b);
}
function mnMini(sim){
  MN.mini = !!sim;
  document.body.classList.toggle('mn-mini', MN.mini);
  mnGravar('farolMenuMini', MN.mini ? '1' : null);
  var b = document.querySelector('.rail .mn-recolher');
  if (b) b.setAttribute('aria-label', MN.mini ? 'Abrir o menu' : 'Recolher o menu');
}

/* Programas: um por linha, com as tarefas por fazer. Leva aos Projetos com
   o programa escolhido. */
function mnProgramas(nav){
  var progs = (window.G && G.projects ? G.projects : []).filter(function(p){
    return p.tipo === 'programa' && p.status !== 'concluido' && p.status !== 'arquivado';
  });
  var chave = progs.map(function(p){
    var n = typeof pjAbertasDe === 'function' ? pjAbertasDe(p) : '';
    return p.id + ':' + p.name + ':' + n;
  }).join('|');
  var caixa = nav.querySelector('.mn-progs');
  if (caixa && MN.progsChave === chave) return;
  MN.progsChave = chave;
  if (!caixa){ caixa = el('div', 'mn-progs'); nav.appendChild(caixa); }
  clear(caixa);
  if (!progs.length){
    caixa.appendChild(el('p', 'mn-vazio', window.G && G.projects && G.projects.length ? 'Sem programas ativos' : 'A carregar…'));
    return;
  }
  progs.forEach(function(p){
    var b = el('button', 'mn-prog');
    b.type = 'button';
    b.title = p.name;
    b.appendChild(el('span', 'mn-pn', p.name));
    var n = typeof pjAbertasDe === 'function' ? pjAbertasDe(p) : 0;
    if (n) b.appendChild(el('span', 'badge', String(n)));
    b.addEventListener('click', function(){
      show('projetos');
      if (typeof pjEscolher === 'function'){
        try { pjEscolher('programa', p.id); } catch (e) { console.error('[farol] menu: programa', e); }
      }
      mnGaveta(false);
    });
    caixa.appendChild(b);
  });
}

/* Quantos papeis esperam na caixa: por triar mais por aprovar. */
function mnNumCaixa(){
  var n = 0;
  ['badgeInbox', 'badgeInboxAprovar'].forEach(function(id){
    var b = document.getElementById(id);
    var v = b ? parseInt(b.textContent, 10) : 0;
    if (v > 0) n += v;
  });
  return n;
}
function mnAbrirCaixa(){
  if (window.IB && !IB.carregado && typeof ibCarregar === 'function') ibCarregar();
  show('inbox');
}

function mnHojeCaixa(nav){
  var n = mnNumCaixa();
  var hoje = nav.querySelector('button[data-view="hoje"]');
  if (hoje){
    var cx = hoje.querySelector('.mn-cx');
    if (n && !cx){ cx = el('span', 'badge aprovar mn-cx'); cx.title = 'Na caixa de entrada'; hoje.appendChild(cx); }
    if (cx){
      var t = n ? String(n) : '';
      if (cx.textContent !== t) cx.textContent = t;
      if (cx.hidden !== !n) cx.hidden = !n;
    }
    hoje.classList.toggle('mn-tem', n > 0);
  }
  var view = document.getElementById('view-hoje');
  if (view){
    var ban = view.querySelector('.mn-banner');
    if (n){
      if (!ban){
        ban = el('div', 'mn-banner');
        ban.appendChild(el('span', null, null)).innerHTML = mnSvg(MN_I.caixa, 20);
        var tx = el('div');
        tx.appendChild(el('b', 'mn-bt'));
        tx.appendChild(el('div', 'mn-bs', 'O que entrou e ainda falta decidir'));
        ban.appendChild(tx);
        var ir = el('button', 'btn primary', 'Triar');
        ir.type = 'button';
        ir.addEventListener('click', mnAbrirCaixa);
        ban.appendChild(ir);
        view.insertBefore(ban, view.firstChild);
      }
      var txt = n === 1 ? '1 papel na caixa de entrada' : n + ' papéis na caixa de entrada';
      var bt = ban.querySelector('.mn-bt');
      if (bt.textContent !== txt) bt.textContent = txt;
    } else if (ban){
      ban.remove();
    }
  }
  var pt = document.querySelector('#mnBarra .mn-pt');
  if (pt){
    var tt = n ? String(n) : '';
    if (pt.textContent !== tt) pt.textContent = tt;
    pt.hidden = !n;
  }
}

function mnAplicar(){
  MN.pendente = false;
  var nav = document.getElementById('nav');
  if (!nav) return;
  mnInterruptor(nav);
  if (!MN.on) return;
  mnRotulos(nav);
  mnTopo(nav);
  mnRecolher();
  /* 24 out: o bloco dos programas saiu do menu (repetia os Projetos e
     cortava os nomes). Os programas vivem nos Projetos e no topo de cada area. */
  var outros = 60;
  Array.prototype.forEach.call(nav.children, function(n){
    var c = n.classList;
    if (c.contains('mn-label') || c.contains('mn-topo') || c.contains('mn-progs') || c.contains('mn-toggle') || c.contains('nav-label')) return;
    if (c.contains('ps-caixa')){ mnOrdem(n, 1); return; }
    if (c.contains('ae-nsubs')){
      var p = n.previousElementSibling;
      mnOrdem(n, p && p.style.order ? p.style.order : 98);
      return;
    }
    var v = n.dataset ? n.dataset.view : null;
    if (!v){ mnOrdem(n, 98); return; }
    if (MN_FORA[v]){ if (!c.contains('mn-fora')) c.add('mn-fora'); return; }
    mnOrdem(n, MN_ORDEM[v] != null ? MN_ORDEM[v] : outros++);
    var nome = mnTexto(n);
    if (nome && n.title !== nome) n.title = nome;
    if (nome && !n.getAttribute('aria-label')) n.setAttribute('aria-label', nome);
    if (!n.querySelector('svg') && !n.querySelector('.mn-ini') && nome){
      var ini = el('span', 'mn-ini', nome.charAt(0));
      ini.setAttribute('aria-hidden', 'true');
      n.insertBefore(ini, n.firstChild);
    }
  });
  mnHojeCaixa(nav);
}

function mnAgendar(){
  if (MN.pendente) return;
  MN.pendente = true;
  setTimeout(mnAplicar, 60);
}

/* ------------------------------- + Captar -------------------------------- */
function mnFecharPop(){
  var p = document.getElementById('mnPop');
  if (p) p.remove();
  document.removeEventListener('click', mnForaPop, true);
  document.removeEventListener('keydown', mnTeclaPop, true);
}
function mnForaPop(e){
  var p = document.getElementById('mnPop');
  if (p && !p.contains(e.target)) mnFecharPop();
}
function mnTeclaPop(e){
  if (e.key === 'Escape'){ mnFecharPop(); }
}
function mnCaptar(ancora){
  if (document.getElementById('mnPop')){ mnFecharPop(); return; }
  var pop = el('div');
  pop.id = 'mnPop';
  pop.setAttribute('role', 'menu');
  pop.setAttribute('aria-label', 'Captar');
  MN_CAPTAR.forEach(function(c){
    var b = el('button', null, c[1]);
    b.type = 'button';
    b.setAttribute('role', 'menuitem');
    b.addEventListener('click', function(){
      mnFecharPop();
      mnGaveta(false);
      if (c[0] === 'caixa'){
        mnAbrirCaixa();
        var f = document.getElementById('ibFicheiro');
        if (f) f.click();
        return;
      }
      if (typeof nvJanela === 'function') nvJanela(c[0], null, {});
      else toast('Ainda a carregar. Tenta outra vez daqui a nada.');
    });
    pop.appendChild(b);
  });
  document.body.appendChild(pop);
  var r = ancora.getBoundingClientRect();
  var w = pop.offsetWidth, h = pop.offsetHeight;
  var x = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
  var y = r.bottom + 6;
  if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 6);
  pop.style.left = x + 'px';
  pop.style.top = y + 'px';
  var primeiro = pop.querySelector('button');
  if (primeiro) primeiro.focus();
  setTimeout(function(){
    document.addEventListener('click', mnForaPop, true);
    document.addEventListener('keydown', mnTeclaPop, true);
  }, 0);
}

/* ------------------------- telemovel: barra e gaveta ------------------------ */
function mnGaveta(sim){
  document.body.classList.toggle('mn-gaveta', !!sim);
  var b = document.querySelector('#mnBarra [data-mn="menu"]');
  if (b) b.setAttribute('aria-expanded', sim ? 'true' : 'false');
}
function mnBarra(){
  if (document.getElementById('mnBarra')) return;
  var barra = el('nav');
  barra.id = 'mnBarra';
  barra.setAttribute('aria-label', 'Menu');
  [['hoje', 'Hoje'], ['agenda', 'Agenda'], ['+', 'Captar'], ['tarefas', 'Tarefas'], ['menu', 'Menu']].forEach(function(i){
    var b = el('button');
    b.type = 'button';
    b.dataset.mn = i[0];
    if (i[0] === '+'){
      b.className = 'mn-mais';
      b.setAttribute('aria-label', 'Captar');
      b.setAttribute('aria-haspopup', 'menu');
      b.innerHTML = mnSvg(MN_I.mais, 24);
      b.addEventListener('click', function(e){ e.stopPropagation(); mnCaptar(b); });
    } else {
      b.innerHTML = mnSvg(MN_I[i[0]], 20) + '<span>' + i[1] + '</span>';
      if (i[0] === 'hoje'){ var pt = el('span', 'mn-pt'); pt.hidden = true; b.appendChild(pt); }
      if (i[0] === 'menu'){
        b.setAttribute('aria-expanded', 'false');
        b.addEventListener('click', function(){ mnGaveta(!document.body.classList.contains('mn-gaveta')); });
      } else {
        b.addEventListener('click', function(){ show(i[0]); });
      }
    }
    barra.appendChild(b);
  });
  document.body.appendChild(barra);
}
function mnMarcarBarra(view){
  var bs = document.querySelectorAll('#mnBarra button[data-mn]');
  for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('is-active', bs[i].dataset.mn === view);
}

/* Ao mudar de ecra: realcar na barra e fechar a gaveta. */
function mnEmbrulharShow(){
  if (typeof window.show !== 'function' || window.show.mnEmbrulhado) return;
  var antes = window.show;
  var novo = function(view){
    var r = antes.apply(this, arguments);
    try { mnMarcarBarra(view); mnGaveta(false); } catch (e) {}
    return r;
  };
  novo.mnEmbrulhado = true;
  window.show = novo;
}

/* ----------------------- a largura do menu (24 out) ----------------------- */
/* Arrasta-se a borda direita do menu; duplo clique volta ao normal. Fica
   guardada neste browser. So no computador e com o menu aberto. */
var MN_LARG = { min: 200, max: 380, normal: 248 };
function mnLarguraPor(px, guardar){
  var w = Math.round(Math.min(MN_LARG.max, Math.max(MN_LARG.min, px)));
  document.body.style.setProperty('--mn-larg', w + 'px');
  if (guardar) mnGravar('farolMenuLargura', String(w));
}
function mnLarguraLigar(){
  if (document.getElementById('mnPuxador')) return;
  var guardada = Number(mnLer('farolMenuLargura'));
  mnLarguraPor(guardada || MN_LARG.normal, false);
  var p = el('div');
  p.id = 'mnPuxador';
  p.setAttribute('role', 'separator');
  p.setAttribute('aria-orientation', 'vertical');
  p.setAttribute('aria-label', 'Largura do menu');
  p.title = 'Arrastar para mudar a largura do menu · duplo clique para voltar ao normal';
  p.tabIndex = 0;
  document.body.appendChild(p);
  var aArrastar = false;
  p.addEventListener('pointerdown', function(e){
    aArrastar = true;
    p.setPointerCapture(e.pointerId);
    document.body.classList.add('mn-a-puxar');
    e.preventDefault();
  });
  p.addEventListener('pointermove', function(e){ if (aArrastar) mnLarguraPor(e.clientX, false); });
  function acabar(e){
    if (!aArrastar) return;
    aArrastar = false;
    document.body.classList.remove('mn-a-puxar');
    mnLarguraPor(e.clientX, true);
  }
  p.addEventListener('pointerup', acabar);
  p.addEventListener('pointercancel', acabar);
  p.addEventListener('dblclick', function(){ mnLarguraPor(MN_LARG.normal, true); });
  p.addEventListener('keydown', function(e){
    var atual = parseInt(getComputedStyle(document.body).getPropertyValue('--mn-larg'), 10) || MN_LARG.normal;
    if (e.key === 'ArrowLeft'){ mnLarguraPor(atual - 16, true); e.preventDefault(); }
    if (e.key === 'ArrowRight'){ mnLarguraPor(atual + 16, true); e.preventDefault(); }
  });
}

/* ------------------------------- arranque -------------------------------- */
/* Quem e o utilizador: antes de entrar com a conta Google a resposta e 401,
   por isso tenta-se outra vez de tempos a tempos, poucas vezes. */
function mnQuemSou(n){
  fetch('/api/me', { credentials: 'same-origin' })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(me){
      if (!me){ if (n < 20) setTimeout(function(){ mnQuemSou(n + 1); }, 3000); return; }
      MN.admin = !!(me.admin || me.aberto);
      if (typeof rvBanner === 'function') { try { rvBanner(); } catch (e) {} }
      mnAgendar();
    })
    .catch(function(){ if (n < 20) setTimeout(function(){ mnQuemSou(n + 1); }, 3000); });
}

function mnArrancar(){
  var q = /[?&]menu=(novo|antigo)\b/.exec(location.search);
  if (q) mnGravar('farolMenu', q[1] === 'antigo' ? 'antigo' : null);
  mnGravar('farolMenuNovo', null);
  MN.mini = mnLer('farolMenuMini') === '1';
  mnEstilo();

  if (mnLer('farolMenu') !== 'antigo') mnLigar();
  mnQuemSou(0);

  var nav = document.getElementById('nav');
  if (nav && window.MutationObserver){
    MN.obs = new MutationObserver(mnAgendar);
    MN.obs.observe(nav, { childList: true, subtree: true, characterData: true });
  }
  mnAgendar();
}

/* Liga o menu novo nesta pagina (uma vez so). */
function mnLigar(){
  if (MN.on) return;
  MN.on = true;
  {
    document.body.classList.add('mn-on');
    if (MN.mini) document.body.classList.add('mn-mini');
    mnBarra();
    mnEmbrulharShow();
    mnMarcarBarra('hoje');
    var ps = null;
    document.addEventListener('click', function(e){
      /* No menu recolhido a pesquisa e so a lupa: abre o menu e poe o cursor la. */
      ps = e.target.closest && e.target.closest('#nav .ps-caixa');
      if (ps && MN.mini){
        mnMini(false);
        var inp = document.getElementById('psInput');
        if (inp) setTimeout(function(){ inp.focus(); }, 30);
      }
    });
    mnLarguraLigar();
  }
  /* O Hoje tem coisas que so aparecem com o menu novo («So eu / Agregado»). */
  if (typeof hjRender === 'function' && window.D && D.attention){
    try { hjRender(); if (typeof hjAgenda === 'function') hjAgenda(); } catch (e) { console.error('[farol] menu: hoje', e); }
  }
  mnAgendar();
}

(function esperar(n){
  if (document.getElementById('nav') && typeof el === 'function' && typeof show === 'function'){
    try { mnArrancar(); } catch (e) { console.error('[farol] menu novo', e); }
    return;
  }
  if (n < 50) setTimeout(function(){ esperar(n + 1); }, 200);
})(0);
