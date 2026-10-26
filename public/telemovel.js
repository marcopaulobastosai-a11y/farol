'use strict';
/* Farol - o telemovel como no mockup (24 out 2026).
 *
 * Quase tudo e CSS (tema.css, bloco «Telemovel»). Aqui so a lupa no
 * cabecalho: no telemovel o campo de procurar vive na gaveta do menu, por
 * isso a lupa abre a pagina de Pesquisa com o cursor no campo. So aparece
 * abaixo de 900 px (tema.css).
 */
function tmLupa(){
  var dir = document.querySelector('.topbar .right');
  if (!dir || dir.querySelector('.tm-procurar')) return;
  var b = el('button', 'tm-procurar');
  b.type = 'button';
  b.setAttribute('aria-label', 'Procurar no Farol');
  b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  b.addEventListener('click', function(){
    if (typeof psPagina !== 'function') return;
    psPagina('');
    var i = document.getElementById('psPagInput');
    if (i) setTimeout(function(){ i.focus(); }, 30);
  });
  dir.appendChild(b);
}

(function tmEsperar(n){
  if (typeof el === 'function' && document.querySelector('.topbar .right')){
    try { tmLupa(); } catch (e) { console.error('[farol] telemovel', e); }
    return;
  }
  if (n < 60) setTimeout(function(){ tmEsperar(n + 1); }, 250);
})(0);

/* ------------------------------------------------------------------ *
 * Filtros numa folha que vem da direita (24 out 2026)
 *
 * No telemovel, os filtros das Financas (Movimentos e outros ecras) e das
 * areas ocupavam o ecra inteiro. Passam para uma folha que abre da direita
 * com o botao «Filtros» (com quantos estao ativos). Na pagina fica so uma
 * linha: Filtros, o mes (‹ ›) e os botoes de acao (Importar, + Movimento),
 * que sao espelhos dos originais - carregar neles carrega nos verdadeiros,
 * que continuam la dentro e sao redesenhados pelos ecras como sempre.
 * ------------------------------------------------------------------ */
var TM = { aberta: null, quando: 0 };
var TM_FILTROS = ['.fn-presa', '.ae-filtros', '#ibFiltros', '#docsAreas', '.fn-corpo > .fn-barra', '.rl-barra', '.fm-filtros'];

/* Os Documentos tem os filtros em tres blocos seguidos (areas, pessoas e o
   «Limpar filtros»): juntam-se numa caixa so antes de irem para a folha. */
function tmJuntar(box){
  if (box.id !== 'docsAreas') return box;
  var g = el('div', 'tm-grupo');
  box.parentNode.insertBefore(g, box);
  g.appendChild(box);
  var pes = document.getElementById('docsFiltro');
  if (pes) g.appendChild(pes);
  var nx = g.nextElementSibling;
  if (nx && /Limpar filtros/.test(nx.textContent || '') && !nx.querySelector('table')) g.appendChild(nx);
  return g;
}

function tmMovel(){ return window.matchMedia && window.matchMedia('(max-width:900px)').matches; }

function tmContar(box){
  var n = 0;
  box.querySelectorAll('.fn-seg, .ae-chips, .who-filter, .ag-seg').forEach(function(g){
    var bs = g.querySelectorAll('button');
    var on = g.querySelector('button.on');
    if (on && bs.length && on !== bs[0]) n++;
  });
  box.querySelectorAll('select').forEach(function(s){
    if (s.getAttribute('aria-label') === 'Período') { if (s.value && s.value !== 'mes') n++; return; }
    if (s.options.length && s.selectedIndex > 0) n++;
  });
  box.querySelectorAll('input[type=search], input[type=text], input:not([type])').forEach(function(i){ if (i.value.trim()) n++; });
  return n;
}

function tmEspelho(box, linha){
  var acoes = linha.querySelector('.tm-fl-acoes');
  clear(acoes);
  var passos = function(){ return Array.prototype.filter.call(box.querySelectorAll('.fn-acoes'), function(x){ return x.querySelector('button[aria-label="Mês anterior"]'); }); };
  passos().forEach(function(pa, i){
    var c = pa.cloneNode(true);
    c.classList.add('tm-esp');
    c.querySelectorAll('button').forEach(function(b, j){
      b.addEventListener('click', function(){
        var o = passos()[i];
        var ob = o && o.querySelectorAll('button')[j];
        if (ob) ob.click();
      });
    });
    acoes.appendChild(c);
  });
  /* Os botoes de acao (Importar extrato, + Movimento, Actualizar...) vao
     para um menu «⋯» que abre e fecha, para a linha caber numa so. */
  var BOT = ':scope > button.btn, :scope > .fn-barra > button.btn';
  var obs = box.querySelectorAll(BOT);
  if (obs.length){
    var wrap = el('div', 'tm-mais');
    var mb = el('button', 'btn tm-mais-btn');
    mb.type = 'button';
    mb.setAttribute('aria-label', 'Mais ações');
    mb.setAttribute('aria-expanded', 'false');
    mb.textContent = '⋯';
    var menu = el('div', 'tm-mais-menu');
    menu.hidden = true;
    obs.forEach(function(ob, i){
      var b = el('button', null, ob.textContent);
      b.type = 'button';
      b.addEventListener('click', function(){
        menu.hidden = true; mb.setAttribute('aria-expanded', 'false');
        var o = box.querySelectorAll(BOT)[i];
        if (o) o.click();
      });
      menu.appendChild(b);
    });
    mb.addEventListener('click', function(e){
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      mb.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
    });
    document.addEventListener('click', function(){ menu.hidden = true; mb.setAttribute('aria-expanded', 'false'); });
    wrap.appendChild(mb); wrap.appendChild(menu);
    acoes.appendChild(wrap);
  }
  var n = tmContar(box);
  var conta = linha.querySelector('.tm-fl-n');
  conta.textContent = n ? String(n) : '';
  conta.hidden = !n;
}

function tmPrepararFiltros(box){
  if (box.dataset.tm) return;
  box.dataset.tm = '1';
  box = tmJuntar(box);
  box.dataset.tm = '1';
  var linha = el('div', 'tm-fl');
  var b = el('button', 'btn tm-fl-btn');
  b.type = 'button';
  b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>';
  b.appendChild(el('span', null, 'Filtros'));
  var n = el('span', 'tm-fl-n'); n.hidden = true; b.appendChild(n);
  linha.appendChild(b);
  linha.appendChild(el('div', 'tm-fl-acoes'));
  var dlg = el('dialog', 'folha tm-folha');
  var cab = el('div', 'tm-folha-h');
  cab.appendChild(el('h2', null, 'Filtros'));
  var x = el('button', 'tm-folha-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar');
  cab.appendChild(x);
  dlg.appendChild(cab);
  var corpo = el('div', 'tm-folha-c');
  dlg.appendChild(corpo);
  var pe = el('div', 'tm-folha-p');
  var ver = el('button', 'btn primary', 'Ver resultados'); ver.type = 'button';
  pe.appendChild(ver);
  dlg.appendChild(pe);
  box.parentNode.insertBefore(linha, box);
  linha.appendChild(dlg);
  corpo.appendChild(box);
  var fechar = function(){ TM.aberta = null; if (dlg.open) dlg.close(); tmEspelho(box, linha); };
  x.addEventListener('click', fechar);
  ver.addEventListener('click', fechar);
  dlg.addEventListener('cancel', function(){ TM.aberta = null; });
  b.addEventListener('click', function(){ TM.aberta = true; dlg.showModal(); });
  tmEspelho(box, linha);
  var t = null;
  new MutationObserver(function(){ clearTimeout(t); t = setTimeout(function(){ if (linha.isConnected) tmEspelho(box, linha); }, 60); })
    .observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  box.addEventListener('change', function(){ tmEspelho(box, linha); });
  box.addEventListener('input', function(){ tmEspelho(box, linha); });
  /* O ecra foi redesenhado com a folha aberta (mudar o periodo redesenha
     tudo): volta a abrir a nova. */
  if (TM.aberta && Date.now() - TM.quando < 1500) { dlg.showModal(); }
}

function tmVerFiltros(){
  if (!tmMovel()) return;
  TM_FILTROS.forEach(function(sel){
    document.querySelectorAll('main ' + sel).forEach(function(box){
      if (box.dataset.tm || box.closest('.tm-folha')) return;
      /* Nas Financas, so a barra que tem filtros (ambito, area...), nao as
         barras de numeros. */
      if (sel === '.fn-corpo > .fn-barra' && !box.querySelector('.fn-seg, select')) return;
      tmPrepararFiltros(box);
    });
  });
}

(function tmVigiar(){
  var main = document.querySelector('main');
  if (!main) return setTimeout(tmVigiar, 300);
  var t = null;
  new MutationObserver(function(){
    if (TM.aberta) TM.quando = Date.now();
    clearTimeout(t); t = setTimeout(tmVerFiltros, 50);
  }).observe(main, { childList: true, subtree: true });
  tmVerFiltros();
})();

/* ------------------------------------------------------------------ *
 * Tamanho da letra no telemovel (24 out 2026). Guardado neste aparelho.
 * Encolhe o <main> com zoom. Por omissao, um pouco mais pequena.
 * ------------------------------------------------------------------ */
var TM_LETRAS = [['80', 'Mais pequena'], ['88', 'Pequena'], ['100', 'Normal'], ['112', 'Grande']];
function tmLetraAtual(){ try { return localStorage.getItem('farolLetra') || '88'; } catch (e) { return '88'; } }
function tmLetra(v){
  try { localStorage.setItem('farolLetra', v); } catch (e) {}
  /* zoom no <main>: encolhe a letra e o resto na mesma proporcao (o
     text-size-adjust nao fazia nada na app instalada). A barra de baixo
     fica como esta. */
  document.documentElement.style.setProperty('--tm-z', String(Number(v) / 100));
}
tmLetra(tmLetraAtual());

/* ------------------------------------------------------------------ *
 * Ver um ficheiro sem sair do Farol (24 out 2026)
 *
 * Os ficheiros abriam com target=_blank. Na app instalada no iPhone isso
 * abre o ficheiro por cima de tudo, sem barra nem botao de voltar - ficava-
 * -se preso no documento. No telemovel (ou na app instalada) passam a
 * abrir num visor por cima da pagina, com «Fechar» (e o gesto de voltar)
 * que deixa tudo onde estava, e «Guardar» para partilhar/guardar.
 * ------------------------------------------------------------------ */
function tmVisorUsar(){
  var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
  return standalone || tmMovel();
}
function tmVisorFechar(deHistoria){
  var v = document.getElementById('tmVisor');
  if (!v) return;
  v.remove();
  document.documentElement.classList.remove('tm-visor-on');
  if (!deHistoria && history.state && history.state.tmVisor) history.back();
}
function tmVisorAbrir(url, titulo){
  tmVisorFechar(true);
  var v = el('div');
  v.id = 'tmVisor';
  v.setAttribute('role', 'dialog');
  v.setAttribute('aria-label', titulo || 'Ficheiro');
  var barra = el('div', 'tm-v-barra');
  var fechar = el('button', 'tm-v-fechar');
  fechar.type = 'button';
  fechar.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  fechar.appendChild(el('span', null, 'Fechar'));
  fechar.addEventListener('click', function(){ tmVisorFechar(false); });
  barra.appendChild(fechar);
  barra.appendChild(el('span', 'tm-v-tit', titulo || ''));
  /* Na app instalada, abrir noutra janela voltava a prender: «Guardar»
     descarrega, e o iPhone mostra a folha de partilhar/guardar. */
  var fora = el('a', 'tm-v-fora', 'Guardar');
  fora.href = url; fora.setAttribute('download', '');
  fora.dataset.tmFora = '1';
  barra.appendChild(fora);
  v.appendChild(barra);
  var corpo = el('div', 'tm-v-corpo');
  var img = el('img');
  img.alt = titulo || '';
  img.addEventListener('error', function(){
    img.remove();
    var f = el('iframe');
    f.src = url;
    f.title = titulo || 'Ficheiro';
    corpo.appendChild(f);
  });
  img.src = url;
  corpo.appendChild(img);
  v.appendChild(corpo);
  document.body.appendChild(v);
  document.documentElement.classList.add('tm-visor-on');
  try { history.pushState({ tmVisor: true }, ''); } catch (e) {}
}
window.addEventListener('popstate', function(){ if (document.getElementById('tmVisor')) tmVisorFechar(true); });
document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && document.getElementById('tmVisor')) tmVisorFechar(false); });
document.addEventListener('click', function(e){
  var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a || a.dataset.tmFora || e.metaKey || e.ctrlKey || e.shiftKey) return;
  var href = a.getAttribute('href') || '';
  if (!/^\/api\/.+\/ficheiro(\?|$)/.test(href)) return;
  if (!tmVisorUsar()) return;
  e.preventDefault();
  e.stopPropagation();
  tmVisorAbrir(href, (a.textContent || '').trim().slice(0, 80) || a.title || 'Ficheiro');
}, true);

/* Caixa de entrada: no telemovel o «Guardar qualquer coisa» vem recolhido
   (o + da barra ja tem Fotografar e Ficheiro); toca-se no titulo para abrir. */
function tmRecolherCaixa(){
  if (!tmMovel()) return;
  var f = document.getElementById('ibFicheiro');
  var c = f && f.closest('.card');
  if (!c || c.dataset.tmRec) return;
  c.dataset.tmRec = '1';
  c.classList.add('tm-rec');
  var h = c.querySelector(':scope > header');
  if (!h) return;
  h.setAttribute('role', 'button');
  h.setAttribute('tabindex', '0');
  h.setAttribute('aria-expanded', 'false');
  var abre = function(){ var a = c.classList.toggle('aberto'); h.setAttribute('aria-expanded', a ? 'true' : 'false'); };
  h.addEventListener('click', abre);
  h.addEventListener('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abre(); } });
}
(function tmEsperarCaixa(n){
  if (document.getElementById('ibFicheiro')) { try { tmRecolherCaixa(); } catch (e) {} return; }
  if (n < 120) setTimeout(function(){ tmEsperarCaixa(n + 1); }, 500);
})(0);


/* ------------------------------------------------------------------ *
 * Paineis de filtros que ja existiam e abriam no meio da pagina (a
 * Agenda: pessoas, areas, o que mostrar, por agendar). No telemovel
 * passam a abrir da direita, por cima, com fundo escuro e «×».
 * ------------------------------------------------------------------ */
var TM_PAINEIS = ['#agSide'];
function tmPainel(p){
  if (p.dataset.tmPainel) return;
  p.dataset.tmPainel = '1';
  var cab = el('div', 'tm-painel-h');
  cab.appendChild(el('h2', null, 'Filtros'));
  var x = el('button', 'tm-folha-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar');
  x.addEventListener('click', function(){ p.classList.remove('aberto'); });
  cab.appendChild(x);
  p.insertBefore(cab, p.firstChild);
  var fundo = el('div', 'tm-fundo');
  fundo.addEventListener('click', function(){ p.classList.remove('aberto'); });
  p.parentNode.insertBefore(fundo, p);
  var marcar = function(){
    var a = p.classList.contains('aberto');
    fundo.classList.toggle('on', a);
    document.documentElement.classList.toggle('tm-painel-on', a && tmMovel());
  };
  new MutationObserver(marcar).observe(p, { attributes: true, attributeFilter: ['class'] });
  marcar();
}
(function tmPaineis(n){
  TM_PAINEIS.forEach(function(sel){ var p = document.querySelector(sel); if (p) tmPainel(p); });
  if (n < 120) setTimeout(function(){ tmPaineis(n + 1); }, 1000);
})(0);

/* ------------------------------------------------------------------ *
 * Notificacoes push (26 out 2026)
 *
 * O service worker (sw.js) recebe os avisos do servidor (src/
 * notificacoes.js). Liga-se em Areas › Definicoes; no iPhone so funciona
 * com o Farol instalado no ecra principal (iOS 16.4 ou mais recente).
 * Tocar num aviso abre o Farol no sitio certo: ?tarefa=, ?evento=, ?ver=.
 * ------------------------------------------------------------------ */
var TM_PUSH = { reg: null };
function tmPushSuportado(){ return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; }
function tmInstalada(){ return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
function tmIOS(){ return /iPhone|iPad|iPod/.test(navigator.userAgent); }
function tmPushRegisto(){
  if (TM_PUSH.reg) return Promise.resolve(TM_PUSH.reg);
  return navigator.serviceWorker.register('/sw.js').then(function(r){ TM_PUSH.reg = r; return navigator.serviceWorker.ready; });
}
function tmB64Url(s){
  var p = '='.repeat((4 - s.length % 4) % 4);
  var b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
  var a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a;
}
function tmPushJson(url, corpo){
  return fetch(url, { method: corpo ? 'POST' : 'GET', credentials: 'same-origin', headers: corpo ? { 'Content-Type': 'application/json' } : {}, body: corpo ? JSON.stringify(corpo) : undefined })
    .then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || 'Erro'); return j; }); });
}
/* Estado deste aparelho: { suportado, instalada, permissao, subscrito, prefs, servidor } */
window.tmPushEstado = function(){
  var base = { suportado: tmPushSuportado(), instalada: tmInstalada(), ios: tmIOS(), permissao: 'Notification' in window ? Notification.permission : 'nada' };
  if (!base.suportado) return Promise.resolve(base);
  return tmPushRegisto().then(function(reg){ return reg.pushManager.getSubscription(); }).then(function(sub){
    return tmPushJson('/api/push/estado', { endpoint: sub ? sub.endpoint : '' }).then(function(e){
      return Object.assign(base, { subscrito: !!(sub && e.subscrito), prefs: e.prefs, servidor: e.ligado, endpoint: sub ? sub.endpoint : null });
    });
  }).catch(function(){ return base; });
};
/* Ligar: tem de vir de um toque (o iPhone so pede licenca assim). */
window.tmPushLigar = function(prefs){
  return tmPushJson('/api/push/chave').then(function(c){
    if (!c.ligado) throw new Error('As notificações ainda não estão ligadas no servidor.');
    return Notification.requestPermission().then(function(p){
      if (p !== 'granted') throw new Error(p === 'denied' ? 'As notificações estão bloqueadas para o Farol nas definições do telemóvel.' : 'Sem licença para notificações.');
      return tmPushRegisto();
    }).then(function(reg){
      return reg.pushManager.getSubscription().then(function(s){
        return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: tmB64Url(c.chave) });
      });
    }).then(function(sub){
      var aparelho = (tmIOS() ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android' : 'Browser') + (tmInstalada() ? ' · app' : '');
      return tmPushJson('/api/push/subscrever', { sub: sub.toJSON(), prefs: prefs || {}, aparelho: aparelho });
    });
  });
};
window.tmPushDesligar = function(){
  return tmPushRegisto().then(function(reg){ return reg.pushManager.getSubscription(); }).then(function(sub){
    if (!sub) return null;
    var ep = sub.endpoint;
    return sub.unsubscribe().then(function(){ return tmPushJson('/api/push/sair', { endpoint: ep }); });
  });
};
window.tmPushPrefs = function(endpoint, prefs){ return tmPushJson('/api/push/prefs', { endpoint: endpoint, prefs: prefs }); };
window.tmPushTeste = function(endpoint){ return tmPushJson('/api/push/teste', { endpoint: endpoint }); };

/* Abrir o que a notificacao avisou. */
function tmAbrirDestino(url){
  var q;
  try { q = new URL(url, location.origin).searchParams; } catch (e) { return; }
  var tarefa = q.get('tarefa'), evento = q.get('evento'), ver = q.get('ver');
  var tentar = function(n){
    var pronto = typeof show === 'function' && window.G && G.tasks;
    if (!pronto) { if (n < 40) setTimeout(function(){ tentar(n + 1); }, 250); return; }
    try {
      if (ver) show(ver);
      if (tarefa && typeof avAbrir === 'function') {
        var t = G.tasks.filter(function(x){ return String(x.id) === tarefa; })[0];
        avAbrir({ origem: 'tarefa', id: Number(tarefa), quando: t ? t.due_on : null, title: t ? t.title : '', detail: '' });
      }
      if (evento && typeof evAbrirId === 'function') evAbrirId(Number(evento));
    } catch (e) { console.error('[farol] abrir aviso', e); }
  };
  tentar(0);
}
if (tmPushSuportado()) {
  navigator.serviceWorker.addEventListener('message', function(e){ if (e.data && e.data.farolAbrir) tmAbrirDestino(e.data.farolAbrir); });
  /* Registar logo, para o sw ficar pronto (nao pede licenca nenhuma). */
  tmPushRegisto().catch(function(){});
}
if (/[?&](tarefa|evento|ver)=/.test(location.search)) {
  tmAbrirDestino(location.href);
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
}
