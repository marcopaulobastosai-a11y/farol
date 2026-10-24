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

var AM = { dlg: null, estado: 'fechado', grupos: [], resto: null, erro: null, contagem: null, aContar: false, ultimo: null, depois: null, saltar: [] };

var AM_CSS = [
  '#amDlg .am{padding:22px 22px 26px;display:flex;flex-direction:column;gap:14px}',
  '#amDlg .am-h{display:flex;align-items:center;justify-content:space-between;gap:10px}',
  '#amDlg .am-h h2{font-family:var(--sans);font-size:1.375rem;font-weight:700;margin:0}',
  '#amDlg .am-fechar{min-width:44px;min-height:44px;border-radius:10px;color:var(--muted);font-size:1.25rem}',
  '#amDlg .am-sub{color:var(--muted);font-size:.875rem;margin:0}',
  '#amDlg .am-filtro{display:flex;gap:6px;flex-wrap:wrap}',
  '#amDlg .am-filtro button{font-size:.8125rem;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2)}',
  '#amDlg .am-lista{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px;overflow:hidden}',
  '#amDlg .am-g{display:grid;grid-template-columns:28px minmax(0,1fr) minmax(180px,240px);gap:10px;align-items:center;padding:10px 12px;border-top:1px solid var(--line-soft);background:var(--surface)}',
  '#amDlg .am-g:first-child{border-top:none}',
  '#amDlg .am-g.off{background:var(--surface-2)}',
  '#amDlg .am-g.off .am-t{opacity:.6}',
  '#amDlg .am-g input[type=checkbox]{width:20px;height:20px;margin:0;accent-color:var(--accent)}',
  '#amDlg .am-t b{display:block;font-size:.875rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '#amDlg .am-t small{color:var(--muted);font-size:.75rem}',
  '#amDlg .am-g select{font:inherit;font-size:.8125rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:6px 8px;min-height:36px;width:100%}',
  '#amDlg .am-conf{display:inline-block;font-size:.6875rem;font-weight:600;border-radius:4px;padding:1px 6px;margin-left:6px}',
  '#amDlg .am-conf.alta{background:var(--accent-soft);color:var(--accent-ink)}',
  '#amDlg .am-conf.media{background:var(--warn-soft);color:var(--warn)}',
  '#amDlg .am-conf.baixa{background:var(--surface-2);color:var(--muted)}',
  '#amDlg .am-acoes{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
  '#amDlg .am-acoes .btn{min-height:44px;padding:0 16px}',
  '#amDlg .am-acoes .am-n{color:var(--muted);font-size:.8125rem;margin-right:auto}',
  '#amDlg .am-a-ler{display:flex;align-items:center;gap:12px;color:var(--muted);padding:24px 4px}',
  '#amDlg .am-a-ler i{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--accent);animation:amRoda .8s linear infinite}',
  '@keyframes amRoda{to{transform:rotate(360deg)}}',
  '#amDlg .am-erro{color:var(--bad);font-size:.875rem}',
  '#amDlg .am-ok{background:var(--accent-soft);color:var(--accent-ink);border-radius:10px;padding:10px 12px;font-size:.875rem;display:flex;gap:10px;align-items:center}',
  '#amDlg .am-ok button{margin-left:auto;font-weight:600;text-decoration:underline}',
  '.am-aviso{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--warn-soft);color:var(--warn);border-radius:12px;padding:10px 14px;margin:0 0 12px;font-size:.875rem}',
  '.am-aviso .btn{margin-left:auto}',
  '@media (max-width:640px){ #amDlg .am-g{grid-template-columns:28px minmax(0,1fr)} #amDlg .am-g select{grid-column:2} }'
].join('\n');

function amEstilo(){
  if (document.getElementById('amCss')) return;
  var st = document.createElement('style'); st.id = 'amCss'; st.textContent = AM_CSS;
  document.head.appendChild(st);
}

function amEuros(v){
  var n = Number(v || 0);
  return (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
function amPost(url, corpo){
  return apiGestao(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) });
}
function amAreas(){ return typeof cpAreas === 'function' ? cpAreas() : []; }

/* ---------- o aviso no separador Movimentos ---------- */
function amContar(force){
  if (AM.aContar || (AM.contagem && !force)) return;
  AM.aContar = true;
  apiGestao('/api/captar/movimentos-sem-area')
    .then(function(d){ AM.contagem = d; })
    .catch(function(){ AM.contagem = { movimentos: 0, grupos: 0 }; })
    .then(function(){ AM.aContar = false; document.querySelectorAll('.am-aviso').forEach(amPreencherAviso); });
}
function amPreencherAviso(box){
  clear(box);
  var c = AM.contagem;
  if (!c || !c.movimentos){ box.hidden = true; return; }
  box.hidden = false;
  box.appendChild(el('span', null, c.movimentos + ' movimentos do banco ainda não têm área (' + c.grupos + ' comerciantes).'));
  var b = el('button', 'btn primary', 'Arrumar');
  b.type = 'button';
  b.addEventListener('click', function(){ amAbrir(box._depois); });
  box.appendChild(b);
}
/* depois: o que fazer quando se aplicam areas (ex.: redesenhar a area). */
function amAviso(depois){
  amEstilo();
  var box = el('div', 'am-aviso');
  box.hidden = true;
  box._depois = depois;
  if (AM.contagem) amPreencherAviso(box); else amContar();
  return box;
}

/* ---------- a folha ---------- */
function amAbrir(depois){
  amEstilo();
  AM.depois = depois || null;
  if (!AM.dlg){
    AM.dlg = el('dialog', 'folha larga');
    AM.dlg.id = 'amDlg';
    AM.dlg.setAttribute('aria-label', 'Arrumar movimentos sem área');
    document.body.appendChild(AM.dlg);
  }
  if (!AM.dlg.open) AM.dlg.showModal();
  amPedir();
}
function amFechar(){ if (AM.dlg && AM.dlg.open) AM.dlg.close(); }

function amPedir(){
  AM.estado = 'a-ler'; AM.erro = null; AM.grupos = [];
  amDesenhar();
  amPost('/api/captar/movimentos-areas', { limite: 40, saltar: AM.saltar })
    .then(function(d){
      AM.resto = { movimentos: d.restantes_mov, grupos: d.restantes_grupos };
      AM.contagem = AM.resto;
      AM.grupos = (d.grupos || []).map(function(g){
        return Object.assign({}, g, { escolha: g.area_id ? String(g.area_id) : '', marcado: !!g.area_id && g.confianca !== 'baixa' });
      });
      AM.estado = AM.grupos.length ? 'lista' : 'vazio';
    })
    .catch(function(e){ AM.estado = 'erro'; AM.erro = (e && e.message) || 'Não foi possível propor áreas.'; })
    .then(amDesenhar);
}

function amCabeca(c){
  var h = el('div', 'am-h');
  h.appendChild(el('h2', null, 'Arrumar movimentos sem área'));
  var x = el('button', 'am-fechar', '×');
  x.type = 'button'; x.setAttribute('aria-label', 'Fechar');
  x.addEventListener('click', amFechar);
  h.appendChild(x);
  c.appendChild(h);
}

function amContas(){
  var mov = 0, grp = 0, fora = 0;
  AM.grupos.forEach(function(g){
    if (!g.marcado) return;
    if (g.escolha === 'fora') fora++;
    else if (g.escolha){ grp++; mov += g.n; }
  });
  return { mov: mov, grp: grp, fora: fora };
}

function amDesenhar(){
  if (!AM.dlg) return;
  clear(AM.dlg);
  var c = el('div', 'am');
  AM.dlg.appendChild(c);
  amCabeca(c);
  if (AM.ultimo) c.appendChild(amUltimo());
  if (AM.estado === 'a-ler'){
    var l = el('div', 'am-a-ler'); l.appendChild(el('i'));
    l.appendChild(el('span', null, 'O Gemini está a ver os comerciantes com mais movimentos…'));
    c.appendChild(l);
    return;
  }
  if (AM.estado === 'erro'){
    c.appendChild(el('p', 'am-erro', AM.erro));
    var t = el('button', 'btn', 'Tentar outra vez'); t.type = 'button'; t.addEventListener('click', amPedir);
    c.appendChild(t);
    return;
  }
  if (AM.estado === 'vazio'){
    c.appendChild(el('p', 'am-sub', 'Já não há movimentos sem área. Bom trabalho.'));
    return;
  }
  c.appendChild(el('p', 'am-sub', 'Faltam ' + AM.resto.movimentos + ' movimentos em ' + AM.resto.grupos +
    ' comerciantes. Estes são os ' + AM.grupos.length + ' com mais movimentos. Vêm marcados os que o Gemini tem a certeza; corrige a área onde precisares e aplica.'));

  var f = el('div', 'am-filtro');
  [['Marcar todas com área', function(){ AM.grupos.forEach(function(g){ g.marcado = !!g.escolha; }); }],
   ['Desmarcar todas', function(){ AM.grupos.forEach(function(g){ g.marcado = false; }); }]].forEach(function(x){
    var b = el('button', null, x[0]); b.type = 'button';
    b.addEventListener('click', function(){ x[1](); amDesenhar(); });
    f.appendChild(b);
  });
  c.appendChild(f);

  var areas = amAreas();
  var lista = el('div', 'am-lista');
  AM.grupos.forEach(function(g){
    var r = el('div', 'am-g' + (g.marcado ? '' : ' off'));
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = g.marcado;
    cb.setAttribute('aria-label', 'Aplicar a ' + (g.exemplo || g.chave));
    cb.addEventListener('change', function(){ g.marcado = cb.checked; amDesenhar(); });
    r.appendChild(cb);
    var t = el('div', 'am-t');
    var b = el('b', null, g.entidade || g.exemplo || g.chave);
    b.title = g.exemplo || '';
    t.appendChild(b);
    var s = el('small', null, g.n + (g.n === 1 ? ' movimento' : ' movimentos') + ' · ' + amEuros(g.total) + ' · ' + (g.conta || ''));
    if (g.confianca){ s.appendChild(el('span', 'am-conf ' + g.confianca, g.confianca === 'alta' ? 'certo' : g.confianca === 'media' ? 'provável' : 'dúvida')); }
    t.appendChild(s);
    r.appendChild(t);
    var sel = el('select');
    var o0 = el('option', null, 'Escolher área…'); o0.value = ''; sel.appendChild(o0);
    areas.forEach(function(a){ var o = el('option', null, a[1]); o.value = String(a[0]); sel.appendChild(o); });
    var of = el('option', null, 'Não tem área — não voltar a propor'); of.value = 'fora'; sel.appendChild(of);
    sel.value = g.escolha;
    sel.setAttribute('aria-label', 'Área de ' + (g.exemplo || g.chave));
    sel.addEventListener('change', function(){ g.escolha = sel.value; g.marcado = !!sel.value; amDesenhar(); });
    r.appendChild(sel);
    lista.appendChild(r);
  });
  c.appendChild(lista);

  var n = amContas();
  var ac = el('div', 'am-acoes');
  var txt = n.mov ? n.mov + ' movimentos de ' + n.grp + ' comerciantes' : 'Nada marcado';
  if (n.fora) txt += ' · ' + n.fora + ' sem área';
  ac.appendChild(el('span', 'am-n', txt));
  var seg = el('button', 'btn', 'Saltar para os seguintes');
  seg.type = 'button';
  seg.title = 'Deixa estes como estão e propõe os próximos';
  seg.addEventListener('click', function(){
    AM.grupos.forEach(function(g){ if (!(g.marcado && g.escolha)) AM.saltar.push(g.chave); });
    amPedir();
  });
  var ap = el('button', 'btn primary', 'Aplicar');
  ap.type = 'button';
  ap.disabled = !(n.mov || n.fora);
  ap.addEventListener('click', function(){ ap.disabled = true; ap.textContent = 'A aplicar…'; amAplicar(); });
  ac.appendChild(seg); ac.appendChild(ap);
  c.appendChild(ac);
}

function amUltimo(){
  var u = AM.ultimo;
  var d = el('div', 'am-ok');
  d.appendChild(el('span', null, u.mov + ' movimentos arrumados' + (u.fora ? ', ' + u.fora + ' comerciantes postos de parte' : '') + '.'));
  if (u.porArea.length){
    var b = el('button', null, 'Desfazer');
    b.type = 'button';
    b.addEventListener('click', function(){
      b.disabled = true; b.textContent = 'A desfazer…';
      var ids = [];
      u.porArea.forEach(function(x){ ids = ids.concat(x.ids); });
      amPost('/api/financas/movimentos/lote', { ids: ids, context_id: null })
        .then(function(){ AM.ultimo = null; amDepois(); amPedir(); if (typeof toast === 'function') toast('Desfeito.'); })
        .catch(function(){ b.textContent = 'Não deu para desfazer'; });
    });
    d.appendChild(b);
  }
  return d;
}

function amAplicar(){
  var porArea = {}, fora = [];
  AM.grupos.forEach(function(g){
    if (!g.marcado || !g.escolha) return;
    if (g.escolha === 'fora') { fora.push(g.chave); return; }
    porArea[g.escolha] = (porArea[g.escolha] || []).concat(g.ids);
  });
  AM.grupos.forEach(function(g){ if (!(g.marcado && g.escolha)) AM.saltar.push(g.chave); });
  var lista = Object.keys(porArea).map(function(k){ return { context_id: Number(k), ids: porArea[k] }; });
  var pedidos = lista.map(function(x){ return amPost('/api/financas/movimentos/lote', { ids: x.ids, context_id: x.context_id }); });
  if (fora.length) pedidos.push(amPost('/api/captar/movimentos-dispensar', { chaves: fora }));
  Promise.all(pedidos)
    .then(function(){
      var mov = 0; lista.forEach(function(x){ mov += x.ids.length; });
      AM.ultimo = { mov: mov, fora: fora.length, porArea: lista };
      amDepois();
      amPedir();
    })
    .catch(function(e){ AM.estado = 'erro'; AM.erro = (e && e.message) || 'Não foi possível aplicar.'; amDesenhar(); });
}

function amDepois(){
  AM.contagem = null;
  if (typeof AM.depois === 'function') { try { AM.depois(); } catch (e) { console.error(e); } }
  amContar(true);
}
