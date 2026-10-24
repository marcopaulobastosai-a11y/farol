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
