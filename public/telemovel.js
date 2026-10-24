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
var TM_FILTROS = ['.fn-presa', '.ae-filtros'];

function tmMovel(){ return window.matchMedia && window.matchMedia('(max-width:900px)').matches; }

function tmContar(box){
  var n = 0;
  box.querySelectorAll('.fn-seg, .ae-chips').forEach(function(g){
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
  box.querySelectorAll('.fn-acoes').forEach(function(pa, i){
    var c = pa.cloneNode(true);
    c.classList.add('tm-esp');
    c.querySelectorAll('button').forEach(function(b, j){
      b.addEventListener('click', function(){
        var o = box.querySelectorAll('.fn-acoes')[i];
        var ob = o && o.querySelectorAll('button')[j];
        if (ob) ob.click();
      });
    });
    acoes.appendChild(c);
  });
  box.querySelectorAll('.fn-barra > button.btn').forEach(function(ob, i){
    var b = el('button', ob.className, ob.textContent);
    b.type = 'button';
    b.addEventListener('click', function(){
      var o = box.querySelectorAll('.fn-barra > button.btn')[i];
      if (o) o.click();
    });
    acoes.appendChild(b);
  });
  var n = tmContar(box);
  var conta = linha.querySelector('.tm-fl-n');
  conta.textContent = n ? String(n) : '';
  conta.hidden = !n;
}

function tmPrepararFiltros(box){
  if (box.dataset.tm) return;
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
      if (!box.closest('.tm-folha') || !box.dataset.tm) tmPrepararFiltros(box);
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
 * No iPhone usa o -webkit-text-size-adjust, que muda so a letra e deixa o
 * resto da pagina como esta. Por omissao, um pouco mais pequena.
 * ------------------------------------------------------------------ */
var TM_LETRAS = [['80', 'Mais pequena'], ['88', 'Pequena'], ['100', 'Normal'], ['112', 'Grande']];
function tmLetraAtual(){ try { return localStorage.getItem('farolLetra') || '88'; } catch (e) { return '88'; } }
function tmLetra(v){
  try { localStorage.setItem('farolLetra', v); } catch (e) {}
  document.documentElement.style.setProperty('--tm-letra', v + '%');
}
tmLetra(tmLetraAtual());
