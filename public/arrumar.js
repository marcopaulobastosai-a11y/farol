'use strict';
/* Farol - arrumar os movimentos sem area (24 out 2026).
 *
 * A maior parte dos movimentos do banco nao tem area e por isso nao aparece
 * em nenhum separador «Movimentos». O servidor junta-os por comerciante
 * (src/captar.js), o Gemini propoe uma area por grupo e a pessoa confirma em
 * bloco: marca, corrige a area onde quiser e aplica. Grava pela rota de
 * sempre (/api/financas/movimentos/lote) e da para desfazer o ultimo bloco.
 * «Nao tem area» guarda o grupo como dispensado para nao voltar a aparecer.
 *
 * Abre-se do separador Movimentos de qualquer area (areas-molde.js).
 */

var AR = { dlg: null, estado: 'fechado', grupos: [], resto: null, erro: null, contagem: null, aContar: false, ultimo: null, depois: null, saltar: [] };

var AR_CSS = [
  '#arDlg .ar{padding:22px 22px 26px;display:flex;flex-direction:column;gap:14px}',
  '#arDlg .ar-h{display:flex;align-items:center;justify-content:space-between;gap:10px}',
  '#arDlg .ar-h h2{font-family:var(--sans);font-size:1.375rem;font-weight:700;margin:0}',
  '#arDlg .ar-fechar{min-width:44px;min-height:44px;border-radius:10px;color:var(--muted);font-size:1.25rem}',
  '#arDlg .ar-sub{color:var(--muted);font-size:.875rem;margin:0}',
  '#arDlg .ar-filtro{display:flex;gap:6px;flex-wrap:wrap}',
  '#arDlg .ar-filtro button{font-size:.8125rem;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2)}',
  '#arDlg .ar-lista{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px;overflow:hidden}',
  '#arDlg .ar-g{display:grid;grid-template-columns:28px minmax(0,1fr) minmax(180px,240px);gap:10px;align-items:center;padding:10px 12px;border-top:1px solid var(--line-soft);background:var(--surface)}',
  '#arDlg .ar-g:first-child{border-top:none}',
  '#arDlg .ar-g.off{background:var(--surface-2)}',
  '#arDlg .ar-g.off .ar-t{opacity:.6}',
  '#arDlg .ar-g input[type=checkbox]{width:20px;height:20px;margin:0;accent-color:var(--accent)}',
  '#arDlg .ar-t b{display:block;font-size:.875rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '#arDlg .ar-t small{color:var(--muted);font-size:.75rem}',
  '#arDlg .ar-g select{font:inherit;font-size:.8125rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:6px 8px;min-height:36px;width:100%}',
  '#arDlg .ar-conf{display:inline-block;font-size:.6875rem;font-weight:600;border-radius:4px;padding:1px 6px;margin-left:6px}',
  '#arDlg .ar-conf.alta{background:var(--accent-soft);color:var(--accent-ink)}',
  '#arDlg .ar-conf.media{background:var(--warn-soft);color:var(--warn)}',
  '#arDlg .ar-conf.baixa{background:var(--surface-2);color:var(--muted)}',
  '#arDlg .ar-acoes{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
  '#arDlg .ar-acoes .btn{min-height:44px;padding:0 16px}',
  '#arDlg .ar-acoes .ar-n{color:var(--muted);font-size:.8125rem;margin-right:auto}',
  '#arDlg .ar-a-ler{display:flex;align-items:center;gap:12px;color:var(--muted);padding:24px 4px}',
  '#arDlg .ar-a-ler i{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--accent);animation:arRoda .8s linear infinite}',
  '@keyframes arRoda{to{transform:rotate(360deg)}}',
  '#arDlg .ar-erro{color:var(--bad);font-size:.875rem}',
  '#arDlg .ar-ok{background:var(--accent-soft);color:var(--accent-ink);border-radius:10px;padding:10px 12px;font-size:.875rem;display:flex;gap:10px;align-items:center}',
  '#arDlg .ar-ok button{margin-left:auto;font-weight:600;text-decoration:underline}',
  '.ar-aviso{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--warn-soft);color:var(--warn);border-radius:12px;padding:10px 14px;margin:0 0 12px;font-size:.875rem}',
  '.ar-aviso .btn{margin-left:auto}',
  '@media (max-width:640px){ #arDlg .ar-g{grid-template-columns:28px minmax(0,1fr)} #arDlg .ar-g select{grid-column:2} }'
].join('\n');

function arEstilo(){
  if (document.getElementById('arCss')) return;
  var st = document.createElement('style'); st.id = 'arCss'; st.textContent = AR_CSS;
  document.head.appendChild(st);
}

function arEuros(v){
  var n = Number(v || 0);
  return (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function arPost(url, corpo){
  return apiGestao(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) });
}
function arAreas(){ return typeof cpAreas === 'function' ? cpAreas() : []; }

/* ---------- o aviso no separador Movimentos ---------- */
function arContar(force){
  if (AR.aContar || (AR.contagem && !force)) return;
  AR.aContar = true;
  apiGestao('/api/captar/movimentos-sem-area')
    .then(function(d){ AR.contagem = d; })
    .catch(function(){ AR.contagem = { movimentos: 0, grupos: 0 }; })
    .then(function(){ AR.aContar = false; document.querySelectorAll('.ar-aviso').forEach(arPreencherAviso); });
}
function arPreencherAviso(box){
  clear(box);
  var c = AR.contagem;
  if (!c || !c.movimentos){ box.hidden = true; return; }
  box.hidden = false;
  box.appendChild(el('span', null, c.movimentos + ' movimentos do banco ainda não têm área (' + c.grupos + ' comerciantes).'));
  var b = el('button', 'btn primary', 'Arrumar');
  b.type = 'button';
  b.addEventListener('click', function(){ arAbrir(box._depois); });
  box.appendChild(b);
}
/* depois: o que fazer quando se aplicam areas (ex.: redesenhar a area). */
function arAviso(depois){
  arEstilo();
  var box = el('div', 'ar-aviso');
  box.hidden = true;
  box._depois = depois;
  if (AR.contagem) arPreencherAviso(box); else arContar();
  return box;
}

/* ---------- a folha ---------- */
function arAbrir(depois){
  arEstilo();
  AR.depois = depois || null;
  if (!AR.dlg){
    AR.dlg = el('dialog', 'folha larga');
    AR.dlg.id = 'arDlg';
    AR.dlg.setAttribute('aria-label', 'Arrumar movimentos sem área');
    document.body.appendChild(AR.dlg);
  }
  if (!AR.dlg.open) AR.dlg.showModal();
  arPedir();
}
function arFechar(){ if (AR.dlg && AR.dlg.open) AR.dlg.close(); }

function arPedir(){
  AR.estado = 'a-ler'; AR.erro = null; AR.grupos = [];
  arDesenhar();
  arPost('/api/captar/movimentos-areas', { limite: 40, saltar: AR.saltar })
    .then(function(d){
      AR.resto = { movimentos: d.restantes_mov, grupos: d.restantes_grupos };
      AR.contagem = AR.resto;
      AR.grupos = (d.grupos || []).map(function(g){
        return Object.assign({}, g, { escolha: g.area_id ? String(g.area_id) : '', marcado: !!g.area_id && g.confianca !== 'baixa' });
      });
      AR.estado = AR.grupos.length ? 'lista' : 'vazio';
    })
    .catch(function(e){ AR.estado = 'erro'; AR.erro = (e && e.message) || 'Não foi possível propor áreas.'; })
    .then(arDesenhar);
}

function arCabeca(c){
  var h = el('div', 'ar-h');
  h.appendChild(el('h2', null, 'Arrumar movimentos sem área'));
  var x = el('button', 'ar-fechar', '×');
  x.type = 'button'; x.setAttribute('aria-label', 'Fechar');
  x.addEventListener('click', arFechar);
  h.appendChild(x);
  c.appendChild(h);
}

function arContas(){
  var mov = 0, grp = 0, fora = 0;
  AR.grupos.forEach(function(g){
    if (!g.marcado) return;
    if (g.escolha === 'fora') fora++;
    else if (g.escolha){ grp++; mov += g.n; }
  });
  return { mov: mov, grp: grp, fora: fora };
}

function arDesenhar(){
  if (!AR.dlg) return;
  clear(AR.dlg);
  var c = el('div', 'ar');
  AR.dlg.appendChild(c);
  arCabeca(c);
  if (AR.ultimo) c.appendChild(arUltimo());
  if (AR.estado === 'a-ler'){
    var l = el('div', 'ar-a-ler'); l.appendChild(el('i'));
    l.appendChild(el('span', null, 'O Gemini está a ver os comerciantes com mais movimentos…'));
    c.appendChild(l);
    return;
  }
  if (AR.estado === 'erro'){
    c.appendChild(el('p', 'ar-erro', AR.erro));
    var t = el('button', 'btn', 'Tentar outra vez'); t.type = 'button'; t.addEventListener('click', arPedir);
    c.appendChild(t);
    return;
  }
  if (AR.estado === 'vazio'){
    c.appendChild(el('p', 'ar-sub', 'Já não há movimentos sem área. Bom trabalho.'));
    return;
  }
  c.appendChild(el('p', 'ar-sub', 'Faltam ' + AR.resto.movimentos + ' movimentos em ' + AR.resto.grupos +
    ' comerciantes. Estes são os ' + AR.grupos.length + ' com mais movimentos. Vêm marcados os que o Gemini tem a certeza; corrige a área onde precisares e aplica.'));

  var f = el('div', 'ar-filtro');
  [['Marcar todas com área', function(){ AR.grupos.forEach(function(g){ g.marcado = !!g.escolha; }); }],
   ['Desmarcar todas', function(){ AR.grupos.forEach(function(g){ g.marcado = false; }); }]].forEach(function(x){
    var b = el('button', null, x[0]); b.type = 'button';
    b.addEventListener('click', function(){ x[1](); arDesenhar(); });
    f.appendChild(b);
  });
  c.appendChild(f);

  var areas = arAreas();
  var lista = el('div', 'ar-lista');
  AR.grupos.forEach(function(g){
    var r = el('div', 'ar-g' + (g.marcado ? '' : ' off'));
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = g.marcado;
    cb.setAttribute('aria-label', 'Aplicar a ' + (g.exemplo || g.chave));
    cb.addEventListener('change', function(){ g.marcado = cb.checked; arDesenhar(); });
    r.appendChild(cb);
    var t = el('div', 'ar-t');
    var b = el('b', null, g.entidade || g.exemplo || g.chave);
    b.title = g.exemplo || '';
    t.appendChild(b);
    var s = el('small', null, g.n + (g.n === 1 ? ' movimento' : ' movimentos') + ' · ' + arEuros(g.total) + ' · ' + (g.conta || ''));
    if (g.confianca){ s.appendChild(el('span', 'ar-conf ' + g.confianca, g.confianca === 'alta' ? 'certo' : g.confianca === 'media' ? 'provável' : 'dúvida')); }
    t.appendChild(s);
    r.appendChild(t);
    var sel = el('select');
    var o0 = el('option', null, 'Escolher área…'); o0.value = ''; sel.appendChild(o0);
    areas.forEach(function(a){ var o = el('option', null, a[1]); o.value = String(a[0]); sel.appendChild(o); });
    var of = el('option', null, 'Não tem área — não voltar a propor'); of.value = 'fora'; sel.appendChild(of);
    sel.value = g.escolha;
    sel.setAttribute('aria-label', 'Área de ' + (g.exemplo || g.chave));
    sel.addEventListener('change', function(){ g.escolha = sel.value; g.marcado = !!sel.value; arDesenhar(); });
    r.appendChild(sel);
    lista.appendChild(r);
  });
  c.appendChild(lista);

  var n = arContas();
  var ac = el('div', 'ar-acoes');
  var txt = n.mov ? n.mov + ' movimentos em ' + n.grp + ' áreas' : 'Nada marcado';
  if (n.fora) txt += ' · ' + n.fora + ' sem área';
  ac.appendChild(el('span', 'ar-n', txt));
  var seg = el('button', 'btn', 'Saltar para os seguintes');
  seg.type = 'button';
  seg.title = 'Deixa estes como estão e propõe os próximos';
  seg.addEventListener('click', function(){
    AR.grupos.forEach(function(g){ if (!(g.marcado && g.escolha)) AR.saltar.push(g.chave); });
    arPedir();
  });
  var ap = el('button', 'btn primary', 'Aplicar');
  ap.type = 'button';
  ap.disabled = !(n.mov || n.fora);
  ap.addEventListener('click', function(){ ap.disabled = true; ap.textContent = 'A aplicar…'; arAplicar(); });
  ac.appendChild(seg); ac.appendChild(ap);
  c.appendChild(ac);
}

function arUltimo(){
  var u = AR.ultimo;
  var d = el('div', 'ar-ok');
  d.appendChild(el('span', null, u.mov + ' movimentos arrumados' + (u.fora ? ', ' + u.fora + ' comerciantes postos de parte' : '') + '.'));
  if (u.porArea.length){
    var b = el('button', null, 'Desfazer');
    b.type = 'button';
    b.addEventListener('click', function(){
      b.disabled = true; b.textContent = 'A desfazer…';
      var ids = [];
      u.porArea.forEach(function(x){ ids = ids.concat(x.ids); });
      arPost('/api/financas/movimentos/lote', { ids: ids, context_id: null })
        .then(function(){ AR.ultimo = null; arDepois(); arPedir(); if (typeof toast === 'function') toast('Desfeito.'); })
        .catch(function(){ b.textContent = 'Não deu para desfazer'; });
    });
    d.appendChild(b);
  }
  return d;
}

function arAplicar(){
  var porArea = {}, fora = [];
  AR.grupos.forEach(function(g){
    if (!g.marcado || !g.escolha) return;
    if (g.escolha === 'fora') { fora.push(g.chave); return; }
    porArea[g.escolha] = (porArea[g.escolha] || []).concat(g.ids);
  });
  AR.grupos.forEach(function(g){ if (!(g.marcado && g.escolha)) AR.saltar.push(g.chave); });
  var lista = Object.keys(porArea).map(function(k){ return { context_id: Number(k), ids: porArea[k] }; });
  var pedidos = lista.map(function(x){ return arPost('/api/financas/movimentos/lote', { ids: x.ids, context_id: x.context_id }); });
  if (fora.length) pedidos.push(arPost('/api/captar/movimentos-dispensar', { chaves: fora }));
  Promise.all(pedidos)
    .then(function(){
      var mov = 0; lista.forEach(function(x){ mov += x.ids.length; });
      AR.ultimo = { mov: mov, fora: fora.length, porArea: lista };
      arDepois();
      arPedir();
    })
    .catch(function(e){ AR.estado = 'erro'; AR.erro = (e && e.message) || 'Não foi possível aplicar.'; arDesenhar(); });
}

function arDepois(){
  AR.contagem = null;
  if (typeof AR.depois === 'function') { try { AR.depois(); } catch (e) { console.error(e); } }
  arContar(true);
}
