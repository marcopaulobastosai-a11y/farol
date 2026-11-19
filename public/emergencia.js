'use strict';
/* Farol - o stock de emergencia (19 nov 2026).
 *
 * Casa > Emergencia ganha tres separadores proprios, a seguir a Visao geral:
 *
 *   Stock · Lista de compras · Plano
 *
 * Stock: cada artigo com o que ha, a meta (por pessoa ou fixa), a validade e
 * onde esta. Lista de compras: o que falta e o que esta a caducar, por
 * categoria, com «Comprei» e a tarefa de compra (um passo por artigo; riscar
 * o passo soma ao stock). Plano: pontos de encontro, contactos em papel,
 * mochilas e a folha para imprimir.
 *
 * Fora da sub-area: um aviso no Hoje quando alguma coisa caduca nos proximos
 * 60 dias, e um passo na revisao de domingo quando ha algo a tratar.
 *
 * Embrulha o aeRenderArea depois do molde (areas-molde.js) e nao mexe nele.
 * Dados em /api/emergencia (src/emergencia.js).
 */

var EM = { d: null, aLer: false, pag: {}, ult: {}, cat: 'todas', soFalta: false };
var EM_TABS = [['stock', 'Stock'], ['compras', 'Lista de compras'], ['plano', 'Plano']];
var EM_ONDE = { despensa: 'Despensa', mochila: 'Mochila', entrada: 'Entrada' };
var EM_EST = {
  completo: ['Completo', 'ok'], incompleto: ['Incompleto', 'meio'], falta: ['Em falta', 'mau'],
  caducar: ['A caducar', 'cad'], caducado: ['Caducado', 'mau'], opcional: ['Opcional', 'neutro']
};
var EM_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

var EM_CSS = [
  '.em-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 14px}',
  '.em-kpi{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;min-width:0}',
  '.em-kpi span{font-size:.75rem;color:var(--muted);font-weight:600}',
  '.em-kpi b{font-size:1.5rem;font-weight:700;color:var(--ink);line-height:1.1}',
  '.em-kpi b i{font-style:normal;font-size:.85rem;color:var(--muted);font-weight:600}',
  '.em-kpi small{font-size:.72rem;color:var(--muted)}',
  '.em-kpi.cad b{color:var(--warn)}',
  '.em-kpi button{align-self:flex-start;font:inherit;font-size:.75rem;padding:2px 0;background:none;border:0;color:var(--accent-ink);text-decoration:underline;cursor:pointer}',
  '.em-bar{height:5px;border-radius:3px;background:var(--line-soft);overflow:hidden}',
  '.em-bar i{display:block;height:100%;border-radius:3px;background:var(--ink)}',
  '.em-bar i.cheio{background:#2F7D4F}',
  '.em-filtros{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 14px}',
  '.em-filtros button{font:inherit;font-size:.8rem;font-weight:600;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}',
  '.em-filtros button.on{background:var(--navy,#14213D);border-color:var(--navy,#14213D);color:#fff}',
  '.em-filtros .em-esp{flex:1 1 auto}',
  '.em-grupo{background:var(--surface);border:1px solid var(--line);border-radius:12px;margin:0 0 12px;overflow:hidden}',
  '.em-grupo > header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line-soft)}',
  '.em-grupo > header h4{margin:0;font-size:.95rem;font-weight:700}',
  '.em-grupo > header small{color:var(--muted);font-size:.75rem}',
  '.em-l{display:grid;grid-template-columns:minmax(0,3fr) minmax(150px,1.6fr) 90px 110px 104px 36px;gap:10px;align-items:center;padding:9px 14px;border-top:1px solid var(--line-soft);font-size:.85rem}',
  '.em-l:first-of-type{border-top:0}',
  '.em-l.cab{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;padding-top:8px;padding-bottom:4px}',
  '.em-nome b{display:block;font-weight:600}',
  '.em-nome small{display:block;color:var(--muted);font-size:.74rem}',
  '.em-q{display:flex;flex-direction:column;gap:5px}',
  '.em-q > div{display:flex;align-items:center;gap:6px}',
  '.em-q button{font:inherit;width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer;line-height:1;flex:none}',
  '.em-q span{font-weight:600;white-space:nowrap}',
  '.em-q span i{font-style:normal;color:var(--muted);font-weight:500}',
  '.em-pill{display:inline-block;font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap}',
  '.em-pill.ok{background:#DDF1E5;color:#1F6440}.em-pill.meio{background:#FBEFD9;color:#7A5A1E}',
  '.em-pill.mau{background:#FBE1E1;color:#9B1C1C}.em-pill.cad{background:#FCE6D4;color:#8A3A06}',
  '.em-pill.neutro{background:var(--line-soft);color:var(--muted)}',
  '.em-mais{font:inherit;width:32px;height:32px;border-radius:8px;border:1px solid transparent;background:none;color:var(--muted);cursor:pointer;font-size:1.1rem}',
  '.em-mais:hover{border-color:var(--line);color:var(--ink)}',
  '.em-val{font-size:.8rem;color:var(--muted)}',
  '.em-val.cad{color:var(--warn);font-weight:600}',
  '.em-topo{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:0 0 12px}',
  '.em-topo p{margin:0;color:var(--muted);font-size:.82rem;max-width:62ch}',
  '.em-topo > div{display:flex;gap:8px;flex-wrap:wrap}',
  '.em-comecar{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:10px;max-width:640px}',
  '.em-comecar p{margin:0;color:var(--muted);font-size:.875rem;line-height:1.5}',
  '.em-cg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}',
  '.em-c{display:flex;gap:10px;align-items:flex-start;padding:10px 14px;border-top:1px solid var(--line-soft)}',
  '.em-c:first-of-type{border-top:0}',
  '.em-c .t{flex:1 1 auto;min-width:0}',
  '.em-c .t b{display:block;font-size:.85rem;font-weight:600}',
  '.em-c .t small{display:block;font-size:.74rem;color:var(--muted)}',
  '.em-c .t small.cad{color:var(--warn)}',
  '.em-loja{font-size:.68rem;font-weight:700;color:var(--muted);background:var(--line-soft);padding:2px 7px;border-radius:6px;white-space:nowrap;align-self:center}',
  '.em-c .btn{flex:none;align-self:center}',
  '.em-nota{background:var(--navy,#14213D);color:#E6EBF5;border-radius:12px;padding:12px 16px;font-size:.82rem;line-height:1.5;margin:0 0 12px}',
  '.em-nota b{color:var(--ambar,#F3C27A)}',
  '.em-plano{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
  '.em-p{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:8px;min-width:0}',
  '.em-p h4{margin:0;font-size:.95rem;font-weight:700;display:flex;justify-content:space-between;align-items:center;gap:8px}',
  '.em-p .lin{display:flex;justify-content:space-between;gap:10px;font-size:.84rem;border-top:1px solid var(--line-soft);padding-top:7px}',
  '.em-p .lin:first-of-type{border-top:0;padding-top:0}',
  '.em-p .lin span{color:var(--muted)}',
  '.em-p .lin b{font-weight:600;text-align:right;overflow-wrap:anywhere}',
  '.em-p .lin b.vz{color:var(--faint);font-style:italic;font-weight:500}',
  '.em-p p{margin:0;font-size:.78rem;color:var(--muted);line-height:1.5}',
  '.em-moch{display:flex;flex-wrap:wrap;gap:6px}',
  '.em-moch button{font:inherit;font-size:.78rem;font-weight:700;padding:6px 11px;border-radius:999px;border:0;cursor:pointer}',
  '.em-moch .pronta{background:#DDF1E5;color:#1F6440}.em-moch .incompleta{background:#FBEFD9;color:#7A5A1E}.em-moch .por-fazer{background:#FBE1E1;color:#9B1C1C}',
  '.em-p.larga{grid-column:1 / -1}',
  '.em-dlg{border:none;border-radius:14px;padding:0;width:min(30rem,calc(100vw - 16px));box-shadow:0 18px 48px rgba(15,23,32,.25)}',
  '.em-dlg::backdrop{background:rgba(15,23,32,.4)}',
  '.em-dlg form{background:var(--surface);color:var(--ink);padding:18px;display:flex;flex-direction:column;gap:10px}',
  '.em-dlg h3{margin:0;font-size:1.05rem}',
  '.em-dlg p{margin:0;font-size:.78rem;color:var(--muted)}',
  '.em-dlg label{display:flex;flex-direction:column;gap:4px;font-size:.75rem;color:var(--muted);font-weight:600}',
  '.em-dlg input,.em-dlg select,.em-dlg textarea{font:inherit;font-size:.9rem;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--ground);color:var(--ink);min-height:38px;box-sizing:border-box;width:100%}',
  '.em-dlg .dois{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
  '.em-dlg .acoes{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:4px}',
  '.em-dlg .acoes .apagar{margin-right:auto;color:#9B1C1C}',
  '.em-lotes{display:flex;flex-direction:column;gap:6px}',
  '.em-lotes > b{font-size:.75rem;color:var(--muted);font-weight:600}',
  '.em-lote{display:grid;grid-template-columns:minmax(0,1fr) 72px 138px 36px;gap:6px;align-items:center}',
  '.em-lote input{min-height:36px !important;padding:6px 8px !important;font-size:.85rem !important}',
  '.em-lote button{font:inherit;width:36px;height:36px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer}',
  '.em-lotes .mais{align-self:flex-start}',
  '@media (max-width:560px){.em-lote{grid-template-columns:minmax(0,1fr) 64px 36px}.em-lote input[type=date]{grid-column:1 / 3}}',
  '.em-banner{display:flex;align-items:center;gap:14px;justify-content:space-between;background:var(--surface);border:1px solid #F1C9A6;border-radius:12px;padding:12px 16px;margin:0 0 14px}',
  '.em-banner b{display:block;font-size:.9rem}',
  '.em-banner span{font-size:.82rem;color:var(--muted)}',
  '@media (max-width:900px){',
  '  .em-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}',
  '  .em-plano{grid-template-columns:1fr}',
  '}',
  '@media (max-width:1180px){',
  '  .em-cg{grid-template-columns:1fr}',
  '  .em-l{grid-template-columns:minmax(0,1fr) auto;gap:6px 10px}',
  '  .em-l.cab{display:none}',
  '  .em-l .em-q{grid-column:1 / -1;grid-row:2}',
  '  .em-l .em-onde{display:none}',
  '  .em-l .em-val{grid-row:3;grid-column:1}',
  '  .em-l .em-est{grid-row:1;grid-column:2;justify-self:end}',
  '  .em-l .em-mais{grid-row:3;grid-column:2;justify-self:end}',
  '}'
].join('\n');

function emEstilo(){
  if (document.getElementById('emCss')) return;
  var st = document.createElement('style'); st.id = 'emCss'; st.textContent = EM_CSS;
  document.head.appendChild(st);
}
function emN(v){ var n = Number(v || 0); return (Math.round(n * 100) / 100).toString().replace('.', ','); }
function emData(iso){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? Number(m[3]) + ' ' + EM_MESES[Number(m[2]) - 1] + ' ' + m[1] : '';
}
function emPost(url, corpo, metodo){
  return apiGestao(url, { method: metodo || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) });
}

/* ------------------------------ os dados ------------------------------ */
function emCarregar(forcar){
  if (EM.aLer || typeof apiGestao !== 'function') return;
  if (EM.d && !forcar) return;
  EM.aLer = true;
  apiGestao('/api/emergencia').then(function(d){ EM.d = d; })
    .catch(function(e){ console.error('[farol] emergencia', e); if (!EM.d) EM.d = { erro: true, itens: [], resumo: {} }; })
    .then(function(){ EM.aLer = false; emDepois(); });
}
function emAceitar(d){ EM.d = d; emDepois(); }
function emDepois(){
  emBanner();
  if (EM.a && emDentro(EM.a) && typeof aeRenderArea === 'function') aeRenderArea(EM.a);
  var rv = document.getElementById('view-revisao');
  if (rv && rv.classList.contains('is-active') && typeof rvRender === 'function') { try { rvRender(); } catch (e) {} }
}

/* A sub-area: pela API, ou (antes de a API responder) pelo nome. */
function emCtxId(){
  if (EM.d && EM.d.ctx) return EM.d.ctx.id;
  var cs = (window.G && G.contextos) || [];
  for (var i = 0; i < cs.length; i++){
    if (cs[i].parent_id && typeof aeNorm === 'function' && aeNorm(cs[i].name).indexOf('emergencia') === 0) return cs[i].id;
  }
  return null;
}
function emAreaCasa(){ return (window.AE_AREAS || []).filter(function(a){ return a.view === 'casa'; })[0] || { view: 'casa', nome: 'casa' }; }
function emDentro(a){
  if (!a || a.view !== 'casa' || typeof moAlvo !== 'function' || !document.body.classList.contains('mn-on')) return false;
  var id = emCtxId();
  var alvo = moAlvo(a);
  return Boolean(id && alvo && alvo.alvoId === id);
}

/* Abrir Casa > Emergencia num separador, de qualquer sitio. */
function emAbrir(tab){
  var a = emAreaCasa();
  var id = emCtxId();
  if (!id) { if (typeof show === 'function') show('casa'); return; }
  var f = aeF('casa');
  f.subs = [String(id)];
  AE.filtro.casa = f;
  if (typeof aeGuardar === 'function') aeGuardar('aeFiltro', AE.filtro);
  EM.pag.casa = tab || 'stock';
  EM.ult.casa = id;
  if (window.MO) MO.pag.casa = null;
  if (AE.pagina && AE.pagina.casa) { AE.pagina.casa = null; if (typeof aeDevolverTudo === 'function') aeDevolverTudo(); }
  if (typeof show === 'function') show('casa');
  aeRenderArea(a);
  if (typeof aeNavMarcar === 'function') { try { aeNavMarcar(); } catch (e) {} }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.emAbrir = emAbrir;

/* ------------------------------ os separadores ------------------------------ */
function emPorTabs(bar, a, ativo){
  if (!bar || bar.querySelector('[data-em]')) return;
  var geral = bar.querySelector('button[role=tab]');
  var depois = geral ? geral.nextSibling : bar.firstChild;
  if (ativo){ [].forEach.call(bar.querySelectorAll('button[role=tab]'), function(b){ b.classList.remove('on'); b.setAttribute('aria-selected', 'false'); }); }
  EM_TABS.forEach(function(t){
    var b = el('button', t[0] === ativo ? 'on' : '', t[1]);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', t[0] === ativo ? 'true' : 'false');
    b.dataset.em = t[0];
    b.addEventListener('click', function(e){
      e.stopPropagation();
      EM.pag[a.view] = t[0];
      if (window.MO) MO.pag[a.view] = null;
      if (AE.pagina[a.view]) { AE.pagina[a.view] = null; if (typeof aeDevolverTudo === 'function') aeDevolverTudo(); }
      aeRenderArea(a);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    bar.insertBefore(b, depois);
  });
  /* Os separadores do molde (Visao geral, Agenda...) tiram o nosso. */
  bar.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('button[role=tab]');
    if (b && !b.dataset.em) EM.pag[a.view] = 'nenhum';
  }, true);
}

function emPagina(a, box, k){
  clear(box);
  var bar = typeof moTabs === 'function' ? moTabs(a, 'x') : el('div', 'mo-tabs');
  emPorTabs(bar, a, k);
  box.appendChild(bar);
  var card = el('div', 'em-pag');
  box.appendChild(card);
  if (!EM.d) { emCarregar(); card.appendChild(el('p', 'mo-vazio', 'A ler o stock…')); return; }
  if (EM.d.erro) { card.appendChild(el('p', 'mo-vazio', 'Não foi possível ler o stock de emergência.')); return; }
  if (!EM.d.itens.length) { emComecar(card); return; }
  if (k === 'stock') emPagStock(a, card);
  else if (k === 'compras') emPagCompras(a, card);
  else emPagPlano(a, card);
}

function emComecar(card){
  var c = el('div', 'em-comecar');
  c.appendChild(el('h3', null, 'Stock de emergência'));
  c.appendChild(el('p', null, 'A recomendação da Comissão Europeia e da Proteção Civil é que cada casa aguente 72 horas sem ajuda: 3 litros de água por pessoa por dia, comida que se come sem cozinhar, luz, rádio, primeiros socorros, documentos, dinheiro e uma mochila para sair depressa.'));
  c.appendChild(el('p', null, 'Começa com a lista recomendada, calculada para o agregado e para os avós, e com a rotina de revisão em maio e em novembro.'));
  var b = el('button', 'btn primary', 'Começar com a lista recomendada');
  b.type = 'button';
  b.addEventListener('click', function(){
    b.disabled = true;
    emPost('/api/emergencia/preparar').then(function(d){ emAceitar(d); toast('Lista recomendada criada.'); })
      .catch(function(e){ b.disabled = false; toast(e.message || 'Não foi possível começar.'); });
  });
  c.appendChild(b);
  card.appendChild(c);
}

/* ------------------------------ Stock ------------------------------ */
function emKpi(rot, valor, sub, cls, extra){
  var k = el('div', 'em-kpi' + (cls ? ' ' + cls : ''));
  k.appendChild(el('span', null, rot));
  var b = el('b'); b.innerHTML = valor; k.appendChild(b);
  if (extra) k.appendChild(extra);
  if (sub) k.appendChild(el('small', null, sub));
  return k;
}
function emBarra(pct){
  var b = el('div', 'em-bar'); var i = el('i', pct >= 100 ? 'cheio' : '');
  i.style.width = Math.max(0, Math.min(100, pct)) + '%'; b.appendChild(i); return b;
}
function emEsc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function emPagStock(a, card){
  var d = EM.d, r = d.resumo || {};
  var topo = el('div', 'em-topo');
  topo.appendChild(el('p', null, '72 horas de autonomia para ' + d.pessoas + (d.pessoas === 1 ? ' pessoa' : ' pessoas') + ' e o Brownie — referência da Comissão Europeia e da ANEPC. Toca em − / + para acertar o que há; ⋯ para validade, meta e onde está.'));
  var acoes = el('div');
  var bn = el('button', 'btn', '+ Artigo'); bn.type = 'button';
  bn.addEventListener('click', function(){ emEditar(null); });
  acoes.appendChild(bn);
  topo.appendChild(acoes);
  card.appendChild(topo);

  var kp = el('div', 'em-kpis');
  var k1 = emKpi('Prontidão', r.prontidao + '%', r.completos + ' de ' + r.obrigatorios + ' artigos completos', '', emBarra(r.prontidao));
  kp.appendChild(k1);
  kp.appendChild(emKpi('Água para beber', emN(r.agua_tem) + ' <i>/ ' + emN(r.agua_meta) + ' L</i>', '3 L por pessoa por dia × 3 dias', '',
    emBarra(r.agua_meta ? r.agua_tem / r.agua_meta * 100 : 0)));
  kp.appendChild(emKpi('A caducar em ' + d.aviso_dias + ' dias', String((r.caducar || 0)), r.caducados ? r.caducados + ' já caducado(s) — repor' : 'Passa para o consumo da casa e repõe-se', r.caducar ? 'cad' : ''));
  var mudar = el('button', null, 'Mudar'); mudar.type = 'button';
  mudar.addEventListener('click', emPessoas);
  kp.appendChild(emKpi('Para quantas pessoas', String(d.pessoas), 'As metas por pessoa recalculam-se', '', mudar));
  card.appendChild(kp);

  var fl = el('div', 'em-filtros');
  [['todas', 'Tudo']].concat(d.categorias).forEach(function(c){
    if (c[0] !== 'todas' && !d.itens.some(function(i){ return i.categoria === c[0]; })) return;
    var b = el('button', EM.cat === c[0] ? 'on' : '', c[1]); b.type = 'button';
    b.setAttribute('aria-pressed', EM.cat === c[0] ? 'true' : 'false');
    b.addEventListener('click', function(){ EM.cat = c[0]; aeRenderArea(a); });
    fl.appendChild(b);
  });
  fl.appendChild(el('span', 'em-esp'));
  var sf = el('button', EM.soFalta ? 'on' : '', 'Só o que falta'); sf.type = 'button';
  sf.setAttribute('aria-pressed', EM.soFalta ? 'true' : 'false');
  sf.addEventListener('click', function(){ EM.soFalta = !EM.soFalta; aeRenderArea(a); });
  fl.appendChild(sf);
  card.appendChild(fl);

  var algum = false;
  d.categorias.forEach(function(c){
    if (EM.cat !== 'todas' && EM.cat !== c[0]) return;
    var todos = d.itens.filter(function(i){ return i.categoria === c[0]; });
    var its = todos.filter(function(i){ return !EM.soFalta || i.estado !== 'completo'; });
    if (!its.length) return;
    algum = true;
    var g = el('section', 'em-grupo');
    var h = el('header');
    h.appendChild(el('h4', null, c[1]));
    h.appendChild(el('small', null, todos.filter(function(i){ return i.estado === 'completo'; }).length + ' de ' + todos.length + ' completos'));
    g.appendChild(h);
    var cab = el('div', 'em-l cab');
    ['Artigo', 'Tenho / meta', 'Onde', 'Validade', 'Estado', ''].forEach(function(t){ cab.appendChild(el('div', null, t)); });
    g.appendChild(cab);
    its.forEach(function(it){ g.appendChild(emLinha(it)); });
    card.appendChild(g);
  });
  if (!algum) card.appendChild(el('p', 'mo-vazio', EM.soFalta ? 'Não falta nada aqui.' : 'Nenhum artigo.'));
}

function emLinha(it){
  var l = el('div', 'em-l');
  var n = el('div', 'em-nome');
  n.appendChild(el('b', null, it.nome));
  if (it.nota) n.appendChild(el('small', null, it.nota));
  if (it.lotes && it.lotes.length > 1) n.appendChild(el('small', null, it.lotes.length + ' lotes — ⋯ para ver as validades de cada'));
  else if (it.lotes && it.lotes.length === 1 && it.lotes[0].descricao) n.appendChild(el('small', null, it.lotes[0].descricao));
  l.appendChild(n);
  var q = el('div', 'em-q');
  var linha = el('div');
  var menos = el('button', null, '−'); menos.type = 'button'; menos.setAttribute('aria-label', 'Menos um: ' + it.nome);
  var mais = el('button', null, '+'); mais.type = 'button'; mais.setAttribute('aria-label', 'Mais um: ' + it.nome);
  var txt = el('span'); txt.innerHTML = emN(it.tenho) + ' / ' + emN(it.meta) + ' <i>' + emEsc(it.unidade || '') + '</i>';
  menos.disabled = it.tenho <= 0;
  menos.addEventListener('click', function(){ emMudar(it, { tenho: Math.max(0, it.tenho - 1) }); });
  mais.addEventListener('click', function(){ emMudar(it, { tenho: it.tenho + 1 }); });
  linha.appendChild(menos); linha.appendChild(txt); linha.appendChild(mais);
  q.appendChild(linha);
  q.appendChild(emBarra(it.meta ? it.tenho / it.meta * 100 : 0));
  l.appendChild(q);
  l.appendChild(el('div', 'em-onde', EM_ONDE[it.onde] || ''));
  var cad = it.estado === 'caducar' || it.estado === 'caducado';
  l.appendChild(el('div', 'em-val' + (cad ? ' cad' : ''), it.validade ? emData(it.validade) : '—'));
  var est = EM_EST[it.estado] || ['', 'neutro'];
  var p = el('div', 'em-est'); p.appendChild(el('span', 'em-pill ' + est[1], est[0])); l.appendChild(p);
  var ed = el('button', 'em-mais', '⋯'); ed.type = 'button'; ed.setAttribute('aria-label', 'Editar ' + it.nome);
  ed.addEventListener('click', function(){ emEditar(it); });
  l.appendChild(ed);
  return l;
}

function emMudar(it, corpo){
  emPost('/api/emergencia/itens/' + it.id, corpo, 'PATCH').then(emAceitar)
    .catch(function(e){ toast(e.message || 'Não foi possível gravar.'); });
}

/* ------------------------------ janelas ------------------------------ */
function emJanela(titulo, nota, campos, botoes){
  var dlg = el('dialog', 'em-dlg');
  var f = el('form'); f.method = 'dialog';
  f.appendChild(el('h3', null, titulo));
  if (nota) f.appendChild(el('p', null, nota));
  campos.forEach(function(c){ f.appendChild(c); });
  var bar = el('div', 'acoes');
  botoes.forEach(function(b){ bar.appendChild(b); });
  f.appendChild(bar);
  dlg.appendChild(f);
  dlg.addEventListener('close', function(){ if (dlg.parentNode) dlg.parentNode.removeChild(dlg); });
  document.body.appendChild(dlg);
  dlg.showModal();
  return dlg;
}
function emCampo(rot, tipo, valor, opcoes){
  var l = el('label', null, rot);
  var i;
  if (tipo === 'select'){
    i = el('select');
    opcoes.forEach(function(o){ var op = el('option', null, o[1]); op.value = o[0]; if (String(o[0]) === String(valor == null ? '' : valor)) op.selected = true; i.appendChild(op); });
  } else if (tipo === 'textarea'){
    i = el('textarea'); i.value = valor == null ? '' : valor; i.rows = 4;
  } else {
    i = el('input'); i.type = tipo; i.value = valor == null ? '' : String(valor);
    if (tipo === 'number') { i.step = 'any'; i.min = '0'; i.inputMode = 'decimal'; }
  }
  l.appendChild(i);
  l.input = i;
  return l;
}
function emBotao(txt, cls, fn){ var b = el('button', 'btn' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; b.addEventListener('click', fn); return b; }

function emEditar(it){
  var novo = !it;
  it = it || { categoria: EM.cat !== 'todas' ? EM.cat : 'conf', onde: 'despensa', quantidade: 1, tenho: 0 };
  var fNome = emCampo('Artigo', 'text', it.nome);
  var fCat = emCampo('Categoria', 'select', it.categoria, EM.d.categorias);
  var lotes = (it.lotes || []).map(function(x){ return { id: x.id, descricao: x.descricao || '', qtd: x.qtd, validade: x.validade || '' }; });
  if (novo && !lotes.length) lotes.push({ descricao: '', qtd: '', validade: '' });
  var boxL = el('div', 'em-lotes');
  function desenharLotes(){
    clear(boxL);
    boxL.appendChild(el('b', null, 'O que há — um lote por produto ou validade'));
    lotes.forEach(function(x, i){
      var r = el('div', 'em-lote');
      var d = el('input'); d.type = 'text'; d.placeholder = 'Produto / marca'; d.value = x.descricao; d.setAttribute('aria-label', 'Produto');
      d.addEventListener('input', function(){ x.descricao = d.value; });
      var q = el('input'); q.type = 'number'; q.step = 'any'; q.min = '0'; q.inputMode = 'decimal'; q.placeholder = 'Qtd'; q.value = x.qtd; q.setAttribute('aria-label', 'Quantidade');
      q.addEventListener('input', function(){ x.qtd = q.value; });
      var v = el('input'); v.type = 'date'; v.value = x.validade; v.setAttribute('aria-label', 'Validade');
      v.addEventListener('input', function(){ x.validade = v.value; });
      var t = el('button', null, '×'); t.type = 'button'; t.setAttribute('aria-label', 'Tirar este lote');
      t.addEventListener('click', function(){ lotes.splice(i, 1); desenharLotes(); });
      r.appendChild(d); r.appendChild(q); r.appendChild(v); r.appendChild(t);
      boxL.appendChild(r);
    });
    var m = emBotao('+ Lote', 'small mais', function(){ lotes.push({ descricao: '', qtd: '', validade: '' }); desenharLotes(); });
    boxL.appendChild(m);
  }
  desenharLotes();
  var fModo = emCampo('Meta', 'select', it.por_pessoa != null ? 'pessoa' : 'fixa', [['pessoa', 'Por pessoa (3 dias)'], ['fixa', 'Quantidade fixa']]);
  var fQ = emCampo('Quantidade', 'number', it.por_pessoa != null ? it.por_pessoa : it.quantidade);
  var fUn = emCampo('Unidade', 'text', it.unidade);
  var fOnde = emCampo('Onde está', 'select', it.onde, [['despensa', 'Despensa'], ['mochila', 'Mochila'], ['entrada', 'Entrada']]);
  var fLoja = emCampo('Onde se compra', 'text', it.loja);
  var fNota = emCampo('Nota', 'text', it.nota);
  var dois = function(x, y){ var d = el('div', 'dois'); d.appendChild(x); d.appendChild(y); return d; };
  var dlg;
  var gravar = emBotao('Gravar', 'primary', function(){
    var q = fQ.input.value;
    var corpo = {
      nome: fNome.input.value, categoria: fCat.input.value,
      lotes: lotes.filter(function(x){ return Number(String(x.qtd).replace(',', '.')) > 0; }),
      unidade: fUn.input.value, onde: fOnde.input.value,
      loja: fLoja.input.value, nota: fNota.input.value,
      por_pessoa: fModo.input.value === 'pessoa' ? q : null,
      quantidade: fModo.input.value === 'fixa' ? q : (it.quantidade || 1)
    };
    if (!String(corpo.nome || '').trim()) { toast('O artigo precisa de um nome.'); return; }
    gravar.disabled = true;
    (novo ? emPost('/api/emergencia/itens', corpo) : emPost('/api/emergencia/itens/' + it.id, corpo, 'PATCH'))
      .then(function(d){ dlg.close(); emAceitar(d); toast('Gravado.'); })
      .catch(function(e){ gravar.disabled = false; toast(e.message || 'Não foi possível gravar.'); });
  });
  var botoes = [];
  if (!novo) botoes.push(emBotao('Apagar', 'apagar', function(){
    if (!confirm('Apagar «' + it.nome + '» do stock?')) return;
    emPost('/api/emergencia/itens/' + it.id, {}, 'DELETE').then(function(d){ dlg.close(); emAceitar(d); toast('Apagado.'); })
      .catch(function(e){ toast(e.message || 'Não foi possível apagar.'); });
  }));
  botoes.push(emBotao('Cancelar', '', function(){ dlg.close(); }));
  botoes.push(gravar);
  dlg = emJanela(novo ? 'Artigo novo' : it.nome, novo ? null : 'Meta para ' + EM.d.pessoas + ' pessoas: ' + emN(it.meta) + ' ' + (it.unidade || ''),
    [fNome, dois(fCat, fOnde), boxL, dois(fModo, fQ), dois(fUn, fLoja), fNota], botoes);
  fNome.input.focus();
}

function emPessoas(){
  var f = emCampo('Pessoas', 'number', EM.d.pessoas);
  f.input.step = '1'; f.input.min = '1';
  var dlg;
  var ok = emBotao('Gravar', 'primary', function(){
    ok.disabled = true;
    emPost('/api/emergencia/definicoes', { pessoas: f.input.value }, 'PUT')
      .then(function(d){ dlg.close(); emAceitar(d); toast('As metas foram recalculadas.'); })
      .catch(function(e){ ok.disabled = false; toast(e.message || 'Não foi possível gravar.'); });
  });
  dlg = emJanela('Para quantas pessoas?', 'Quem conta para a água, a comida e as mochilas. O Brownie tem os artigos dele à parte.', [f],
    [emBotao('Cancelar', '', function(){ dlg.close(); }), ok]);
  f.input.focus();
}

/* ------------------------------ Lista de compras ------------------------------ */
function emPorComprar(){
  return (EM.d.itens || []).filter(function(i){ return i.falta > 0 || i.estado === 'caducar' || i.estado === 'caducado'; })
    .map(function(i){
      var cad = i.estado === 'caducar' || i.estado === 'caducado';
      return { it: i, qtd: i.comprar || i.falta, cad: cad };
    });
}
function emPagCompras(a, card){
  var d = EM.d;
  var lista = emPorComprar();
  var topo = el('div', 'em-topo');
  topo.appendChild(el('p', null, lista.length
    ? lista.length + (lista.length === 1 ? ' artigo' : ' artigos') + ' por comprar: o que falta para a meta e o que está a caducar.'
    : 'Não falta nada. Quando alguma coisa estiver a caducar, aparece aqui.'));
  var ac = el('div');
  if (lista.length){
    ac.appendChild(emBotao('Copiar lista', '', function(){
      var txt = d.categorias.map(function(c){
        var its = lista.filter(function(x){ return x.it.categoria === c[0]; });
        if (!its.length) return '';
        return c[1] + '\n' + its.map(function(x){ return '- ' + emN(x.qtd) + ' ' + (x.it.unidade || '') + ' ' + x.it.nome + (x.it.loja ? ' (' + x.it.loja + ')' : ''); }).join('\n');
      }).filter(Boolean).join('\n\n');
      if (navigator.clipboard) navigator.clipboard.writeText('Stock de emergência — compras\n\n' + txt).then(function(){ toast('Lista copiada.'); });
    }));
    if (d.compra_id){
      ac.appendChild(emBotao('Abrir a tarefa de compra', 'primary', function(){ emAbrirTarefa(d.compra_id); }));
    } else {
      var bt = emBotao('Criar tarefa de compra', 'primary', function(){
        bt.disabled = true;
        emPost('/api/emergencia/compra').then(function(r){
          emAceitar(r);
          toast('Tarefa criada em Casa › Emergência, um passo por artigo.');
          if (typeof loadGestao === 'function') { try { loadGestao(); } catch (e) {} }
        }).catch(function(e){ bt.disabled = false; toast(e.message || 'Não foi possível criar a tarefa.'); });
      });
      ac.appendChild(bt);
    }
  }
  topo.appendChild(ac);
  card.appendChild(topo);
  if (!lista.length) return;
  var nota = el('div', 'em-nota');
  nota.innerHTML = '<b>Como funciona:</b> «Comprei» soma ao stock e pede a validade. Se preferires levar a lista no telemóvel, a tarefa de compra tem um passo por artigo e riscar o passo também soma — nunca conta duas vezes.';
  card.appendChild(nota);
  var grid = el('div', 'em-cg');
  d.categorias.forEach(function(c){
    var its = lista.filter(function(x){ return x.it.categoria === c[0]; });
    if (!its.length) return;
    var g = el('section', 'em-grupo');
    var h = el('header'); h.appendChild(el('h4', null, c[1])); h.appendChild(el('small', null, its.length + (its.length === 1 ? ' artigo' : ' artigos')));
    g.appendChild(h);
    its.forEach(function(x){
      var r = el('div', 'em-c');
      var t = el('div', 't');
      t.appendChild(el('b', null, emN(x.qtd) + ' ' + (x.it.unidade || '') + ' · ' + x.it.nome));
      var det = x.cad ? (x.it.estado === 'caducado' ? 'repor ' + emN(x.it.repor) + ': caducou a ' : 'repor ' + emN(x.it.repor) + ': caduca a ') + emData(x.it.validade)
        : (x.it.tenho > 0 ? 'tenho ' + emN(x.it.tenho) + ' de ' + emN(x.it.meta) : 'meta ' + emN(x.it.meta));
      if (x.it.na_compra) det += ' · na tarefa de compra';
      t.appendChild(el('small', x.cad ? 'cad' : '', det));
      r.appendChild(t);
      if (x.it.loja) r.appendChild(el('span', 'em-loja', x.it.loja));
      r.appendChild(emBotao('Comprei', 'small', function(){ emComprei(x); }));
      g.appendChild(r);
    });
    grid.appendChild(g);
  });
  card.appendChild(grid);
}
function emComprei(x){
  var fQ = emCampo('Quantidade comprada', 'number', x.qtd);
  var fV = emCampo('Validade (se tiver)', 'date', '');
  var dlg;
  var ok = emBotao('Somar ao stock', 'primary', function(){
    ok.disabled = true;
    emPost('/api/emergencia/comprei', { item_id: x.it.id, qtd: fQ.input.value, validade: fV.input.value || null, substituir: !!(fS && fS.input.value === 'sim') })
      .then(function(d){ dlg.close(); emAceitar(d); toast('Somado ao stock.'); })
      .catch(function(e){ ok.disabled = false; toast(e.message || 'Não foi possível gravar.'); });
  });
  var campos = [fQ, fV];
  var fS = null;
  if (x.cad){
    fS = emCampo('O que caducava', 'select', 'sim', [['sim', 'Passa para o consumo da casa — fica só o que comprei'], ['nao', 'Fica no stock — somar ao que há']]);
    campos.push(fS);
  }
  dlg = emJanela(x.it.nome, null, campos, [emBotao('Cancelar', '', function(){ dlg.close(); }), ok]);
  fQ.input.focus();
}
function emAbrirTarefa(id){
  var t = ((window.G && G.tasks) || []).filter(function(x){ return x.id === id; })[0];
  if (typeof avAbrir === 'function') avAbrir({ origem: 'tarefa', id: id, quando: t ? t.due_on : null, title: t ? t.title : 'Compras do stock de emergência', detail: '' });
  else if (typeof show === 'function') show('tarefas');
}

/* ------------------------------ Plano ------------------------------ */
function emGente(){ return (EM.d && EM.d.gente) || []; }
function emLin(box, rot, val){
  var l = el('div', 'lin'); l.appendChild(el('span', null, rot));
  l.appendChild(el('b', val ? '' : 'vz', val || 'por definir')); box.appendChild(l);
}
function emPagPlano(a, card){
  var d = EM.d, p = d.plano || {};
  var topo = el('div', 'em-topo');
  topo.appendChild(el('p', null, 'O que todos têm de saber sem rede nem telemóvel. Imprime-se uma folha para cada mochila.'));
  var ac = el('div');
  ac.appendChild(emBotao('Editar o plano', '', emEditarPlano));
  ac.appendChild(emBotao('Imprimir a folha', 'primary', emImprimir));
  topo.appendChild(ac);
  card.appendChild(topo);

  var g = el('div', 'em-plano');
  var c1 = el('section', 'em-p'); c1.appendChild(el('h4', null, 'Pontos de encontro'));
  emLin(c1, 'Perto de casa', p.encontro_perto);
  emLin(c1, 'Fora do bairro', p.encontro_fora);
  c1.appendChild(el('p', null, 'Se não der para voltar a casa ou não houver rede, cada um vai para aqui.'));
  g.appendChild(c1);

  var c2 = el('section', 'em-p'); c2.appendChild(el('h4', null, 'Contactos'));
  emLin(c2, 'Emergência', '112');
  emLin(c2, 'SNS 24', '808 24 24 24');
  emLin(c2, 'Proteção Civil do concelho', p.protecao_civil);
  emGente().forEach(function(x){ if (x.phone) emLin(c2, x.name, x.phone); });
  c2.appendChild(el('p', null, 'Os telefones das pessoas vêm das fichas em Pessoas.'));
  g.appendChild(c2);

  var c3 = el('section', 'em-p');
  c3.appendChild(el('h4', null, 'Mochilas de saída rápida'));
  var mo = el('div', 'em-moch');
  var est = p.mochilas || {};
  var ordem = ['por fazer', 'incompleta', 'pronta'];
  emGente().forEach(function(x){
    var e = est[x.id] || 'por fazer';
    var b = el('button', e.replace(' ', '-'), x.name + ' · ' + e);
    b.type = 'button';
    b.title = 'Tocar para mudar';
    b.addEventListener('click', function(){
      var prox = ordem[(ordem.indexOf(e) + 1) % ordem.length];
      var m = Object.assign({}, est); m[x.id] = prox;
      emPost('/api/emergencia/definicoes', { plano: { mochilas: m } }, 'PUT').then(emAceitar)
        .catch(function(er){ toast(er.message || 'Não foi possível gravar.'); });
    });
    mo.appendChild(b);
  });
  c3.appendChild(mo);
  c3.appendChild(el('p', null, 'Leves: água e barras para um dia, lanterna, apito, manta térmica, capa de chuva, medicação, cópia dos documentos, contactos e dinheiro. Ficam juntas à entrada. Toca num nome para mudar o estado.'));
  g.appendChild(c3);

  var c4 = el('section', 'em-p'); c4.appendChild(el('h4', null, 'Dinheiro e revisão'));
  emLin(c4, 'Numerário na mochila', p.dinheiro);
  emLin(c4, 'Quem faz a revisão', p.responsavel);
  var rot = ((window.G && G.tasks) || []).filter(function(t){
    return t.title === 'Rever o stock de emergência' && t.repeat_rule && t.status !== 'concluida' && t.status !== 'cancelada';
  })[0];
  emLin(c4, 'Próxima revisão', rot && rot.due_on ? emData(rot.due_on) : '');
  c4.appendChild(el('p', null, 'Rotina em maio e em novembro: validades, pilhas, powerbanks carregados, mochilas e esta folha.'));
  g.appendChild(c4);

  var c5 = el('section', 'em-p larga'); c5.appendChild(el('h4', null, 'Documentos para a bolsa impermeável'));
  var docs = ((window.D && D.documents) || []).filter(function(x){ return x.context_id === d.ctx.id; });
  if (docs.length) docs.forEach(function(x){ emLin(c5, x.name, x.entity || ''); });
  else c5.appendChild(el('p', null, 'Ainda nenhum documento arrumado em Casa › Emergência. Arruma aqui as cópias (identificação de cada um, seguro da casa, contrato da casa, boletim do Brownie) para imprimir e pôr na bolsa.'));
  if (p.notas) { var pn = el('p', null, p.notas); pn.style.whiteSpace = 'pre-line'; c5.appendChild(pn); }
  g.appendChild(c5);
  card.appendChild(g);
}
function emEditarPlano(){
  var p = EM.d.plano || {};
  var c = {
    encontro_perto: emCampo('Ponto de encontro perto de casa', 'text', p.encontro_perto),
    encontro_fora: emCampo('Ponto de encontro fora do bairro', 'text', p.encontro_fora),
    protecao_civil: emCampo('Proteção Civil do concelho (telefone)', 'text', p.protecao_civil),
    dinheiro: emCampo('Numerário na mochila', 'text', p.dinheiro),
    responsavel: emCampo('Quem faz a revisão', 'text', p.responsavel),
    notas: emCampo('Notas', 'textarea', p.notas)
  };
  var dlg;
  var ok = emBotao('Gravar', 'primary', function(){
    var plano = {};
    Object.keys(c).forEach(function(k){ plano[k] = c[k].input.value; });
    ok.disabled = true;
    emPost('/api/emergencia/definicoes', { plano: plano }, 'PUT').then(function(d){ dlg.close(); emAceitar(d); toast('Plano gravado.'); })
      .catch(function(e){ ok.disabled = false; toast(e.message || 'Não foi possível gravar.'); });
  });
  dlg = emJanela('Plano da família', null, Object.keys(c).map(function(k){ return c[k]; }), [emBotao('Cancelar', '', function(){ dlg.close(); }), ok]);
  c.encontro_perto.input.focus();
}
function emImprimir(){
  var p = EM.d.plano || {};
  var gente = emGente();
  var linhas = [['Emergência', '112'], ['SNS 24', '808 24 24 24'], ['Proteção Civil do concelho', p.protecao_civil || '']]
    .concat(gente.filter(function(x){ return x.phone; }).map(function(x){ return [x.name, x.phone]; }));
  var moch = (EM.d.itens || []).filter(function(i){ return i.onde === 'mochila'; }).map(function(i){ return i.nome; });
  var h = '<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><title>Plano de emergência</title>' +
    '<style>body{font-family:Arial,sans-serif;font-size:12pt;margin:18mm;color:#000}h1{font-size:18pt;margin:0 0 4mm}h2{font-size:13pt;margin:7mm 0 2mm;border-bottom:1px solid #000}' +
    'table{border-collapse:collapse;width:100%}td{padding:1.5mm 0;border-bottom:1px solid #bbb}td:last-child{text-align:right;font-weight:bold}ul{columns:2;margin:0;padding-left:5mm}li{margin:0 0 1mm}</style></head><body>' +
    '<h1>Plano de emergência da família</h1>' +
    '<h2>Pontos de encontro</h2><table><tr><td>Perto de casa</td><td>' + emEsc(p.encontro_perto || '') + '</td></tr><tr><td>Fora do bairro</td><td>' + emEsc(p.encontro_fora || '') + '</td></tr></table>' +
    '<h2>Contactos</h2><table>' + linhas.map(function(l){ return '<tr><td>' + emEsc(l[0]) + '</td><td>' + emEsc(l[1]) + '</td></tr>'; }).join('') + '</table>' +
    '<h2>Na mochila</h2><ul>' + moch.map(function(n){ return '<li>☐ ' + emEsc(n) + '</li>'; }).join('') + '</ul>' +
    (p.notas ? '<h2>Notas</h2><p style="white-space:pre-line">' + emEsc(p.notas) + '</p>' : '') +
    '<p style="margin-top:8mm;font-size:9pt">Ouvir as indicações oficiais no rádio. Atualizado a ' + emData(EM.d.hoje) + '.</p></body></html>';
  var w = window.open('', '_blank');
  if (!w) { toast('O browser bloqueou a janela de impressão.'); return; }
  w.document.open(); w.document.write(h); w.document.close();
  setTimeout(function(){ try { w.focus(); w.print(); } catch (e) {} }, 300);
}

/* ------------------------------ fora da sub-area ------------------------------ */
/* O aviso no Hoje: so quando alguma coisa caduca nos proximos 60 dias. */
function emBanner(){
  var view = document.getElementById('view-hoje');
  if (!view) return;
  var ban = view.querySelector('.em-banner');
  var r = EM.d && EM.d.resumo;
  var n = r ? (r.caducar || 0) : 0;
  if (!n || !document.body.classList.contains('mn-on')) { if (ban) ban.remove(); return; }
  emEstilo();
  if (!ban) {
    ban = el('div', 'em-banner');
    view.insertBefore(ban, view.firstChild);
  }
  clear(ban);
  var t = el('div');
  t.appendChild(el('b', null, 'Stock de emergência'));
  t.appendChild(el('span', null, n + (n === 1 ? ' artigo caduca' : ' artigos caducam') + ' nos próximos ' + EM.d.aviso_dias + ' dias' +
    (r.em_falta ? ' e ' + r.em_falta + (r.em_falta === 1 ? ' está' : ' estão') + ' em falta' : '') + '.'));
  ban.appendChild(t);
  ban.appendChild(emBotao('Ver a lista de compras', 'primary', function(){ emAbrir('compras'); }));
}

/* Para a revisao de domingo: um passo so quando ha algo a tratar. */
window.emParaRevisao = function(){
  if (!EM.d) { emCarregar(); return null; }
  var r = EM.d.resumo || {};
  if (!EM.d.itens || !EM.d.itens.length || (!r.caducar && !r.em_falta)) return null;
  var partes = [];
  if (r.caducar) partes.push(r.caducar + ' a caducar');
  if (r.em_falta) partes.push(r.em_falta + ' em falta');
  var itens = EM.d.itens.filter(function(i){ return i.estado === 'caducar' || i.estado === 'caducado'; }).slice(0, 6)
    .map(function(i){ return { texto: i.nome, lado: 'caduca ' + emData(i.validade) }; });
  return { resumo: partes.join(' · ') + ' — prontidão ' + (r.prontidao || 0) + '%', itens: itens, abrir: function(){ emAbrir('compras'); } };
};

/* ------------------------------ o embrulho ------------------------------ */
function emSub(){
  var ts = document.getElementById('pageSub');
  var sec = document.getElementById('view-casa');
  if (ts && sec && sec.classList.contains('is-active')) ts.textContent = 'Casa · stock para 72 horas e plano da família';
}
function emEmbrulhar(){
  var atual = window.aeRenderArea;
  if (typeof atual !== 'function' || !atual.moEmbrulhado || atual.emEmbrulhado) return false;
  var novo = function(a){
    if (!emDentro(a)) return atual.apply(this, arguments);
    EM.a = a;
    emEstilo();
    var id = emCtxId();
    if (EM.ult[a.view] !== id) { EM.ult[a.view] = id; EM.pag[a.view] = undefined; }
    var k = EM.pag[a.view];
    if (k === undefined) k = 'stock';
    var box = typeof aeCaixa === 'function' ? aeCaixa(a) : null;
    var livre = !(window.MO && MO.pag[a.view]) && !(AE.pagina && AE.pagina[a.view]);
    if (box && livre && k !== 'nenhum'){
      try { emPagina(a, box, k); if (typeof moTitulo === 'function') moTitulo(a); emSub(); }
      catch (e) { console.error('[farol] emergencia', e); }
      return;
    }
    var r = atual.apply(this, arguments);
    try { if (box) emPorTabs(box.querySelector('.mo-tabs'), a, null); emSub(); } catch (e) { console.error('[farol] emergencia tabs', e); }
    return r;
  };
  novo.moEmbrulhado = true;
  novo.emEmbrulhado = true;
  window.aeRenderArea = novo;
  return true;
}

/* ?ver=emergencia (o aviso no telemovel) abre o stock. */
(function(){
  var antes = window.show;
  if (typeof antes !== 'function' || antes.emEmbrulhado) return;
  var s = function(v){
    if (v === 'emergencia') { emAbrir('compras'); return; }
    return antes.apply(this, arguments);
  };
  s.emEmbrulhado = true;
  window.show = s;
})();

/* O Hoje e redesenhado pelos outros modulos: o aviso volta a por-se. */
document.addEventListener('click', function(e){
  var b = e.target.closest && e.target.closest('#nav button[data-view], .tm-barra button, nav button');
  if (b) setTimeout(emBanner, 50);
}, true);

(function emEsperar(n){
  if (typeof aeRenderArea === 'function' && aeRenderArea.moEmbrulhado && typeof el === 'function' && typeof apiGestao === 'function' && window.G && G.contextos && G.contextos.length){
    if (emEmbrulhar() && typeof aeRender === 'function'){ try { aeRender(); } catch (e) { console.error('[farol] emergencia: redesenhar', e); } }
    emCarregar();
    setInterval(function(){ if (document.visibilityState === 'visible') emCarregar(true); }, 10 * 60000);
    return;
  }
  if (n < 120) setTimeout(function(){ emEsperar(n + 1); }, 250);
})(0);
