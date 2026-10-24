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

var AM = { dlg: null, estado: 'fechado', grupos: [], resto: null, erro: null, contagem: null, aContar: false, ultimo: null, depois: null, saltar: [],
  it: { estado: null, lista: [], total: 0, erro: null, ultimo: null } };

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
  '#amDlg .am-sec{font-size:1rem;font-weight:700;margin:6px 0 0;display:flex;align-items:center;gap:8px}',
  '#amDlg .am-sec small{font-weight:500;color:var(--muted);font-size:.8125rem}',
  '#amDlg .am-tipo{display:inline-block;font-size:.6875rem;font-weight:600;border-radius:4px;padding:1px 6px;margin-right:6px;background:var(--surface-2);color:var(--ink-2);border:1px solid var(--line-soft)}',
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
  Promise.all([
    apiGestao('/api/captar/movimentos-sem-area').catch(function(){ return { movimentos: 0, grupos: 0 }; }),
    apiGestao('/api/captar/itens-sem-area').catch(function(){ return { total: 0 }; })
  ]).then(function(r){ AM.contagem = Object.assign({}, r[0], { itens: r[1].total || 0 }); })
    .then(function(){ AM.aContar = false; document.querySelectorAll('.am-aviso').forEach(amPreencherAviso); });
}
function amPreencherAviso(box){
  clear(box);
  var c = AM.contagem;
  if (!c || !(c.movimentos || c.itens)){ box.hidden = true; return; }
  box.hidden = false;
  var partes = [];
  if (c.movimentos) partes.push(c.movimentos + ' movimentos do banco (' + c.grupos + ' comerciantes)');
  if (c.itens) partes.push(c.itens + (c.itens === 1 ? ' tarefa, evento ou documento' : ' tarefas, eventos e documentos'));
  box.appendChild(el('span', null, partes.join(' e ') + ' ainda sem área.'));
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
    AM.dlg.setAttribute('aria-label', 'Arrumar o que não tem área');
    document.body.appendChild(AM.dlg);
  }
  if (!AM.dlg.open) AM.dlg.showModal();
  amPedirItens();
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
  h.appendChild(el('h2', null, 'Arrumar o que não tem área'));
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
  amSecItens(c);
  if (AM.it.estado === 'lista' || AM.it.ultimo) c.appendChild(el('h3', 'am-sec', 'Movimentos do banco'));
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
    ' comerciantes. Aqui vão ' + AM.grupos.length + ', dos que têm mais movimentos. Vêm marcados os que o Gemini acha certos ou prováveis; corrige a área onde precisares e aplica.'));

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

/* ---------- tarefas, eventos e documentos sem area ---------- */
var AM_TIPO = { tarefa: 'Tarefa', evento: 'Evento', documento: 'Documento' };

function amPedirItens(){
  var it = AM.it;
  it.estado = 'a-ler'; it.erro = null; it.lista = [];
  amPost('/api/captar/itens-areas', {})
    .then(function(d){
      it.total = d.total || 0;
      it.lista = (d.itens || []).map(function(x){
        return Object.assign({}, x, { escolha: x.area_id ? String(x.area_id) : '', marcado: !!x.area_id && x.confianca !== 'baixa' });
      });
      it.estado = it.lista.length ? 'lista' : 'vazio';
    })
    .catch(function(e){ it.estado = 'erro'; it.erro = (e && e.message) || 'Não foi possível propor áreas.'; })
    .then(amDesenhar);
}

function amDataCurta(d){
  if (!d) return '';
  var p = String(d).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d;
}

function amSecItens(c){
  var it = AM.it;
  if (it.ultimo){
    var ok = el('div', 'am-ok');
    ok.appendChild(el('span', null, it.ultimo.n + (it.ultimo.n === 1 ? ' coisa arrumada' : ' coisas arrumadas') + (it.ultimo.fora ? ', ' + it.ultimo.fora + ' postas de parte' : '') + '.'));
    if (it.ultimo.itens.length){
      var u = el('button', null, 'Desfazer'); u.type = 'button';
      u.addEventListener('click', function(){
        u.disabled = true; u.textContent = 'A desfazer…';
        amPost('/api/captar/itens-area', { itens: it.ultimo.itens.map(function(x){ return { tipo: x.tipo, id: x.id, context_id: null }; }) })
          .then(function(){ it.ultimo = null; amDepois(); amPedirItens(); amDesenhar(); if (typeof toast === 'function') toast('Desfeito.'); })
          .catch(function(){ u.textContent = 'Não deu para desfazer'; });
      });
      ok.appendChild(u);
    }
    c.appendChild(ok);
  }
  if (it.estado === 'a-ler'){
    var l = el('div', 'am-a-ler'); l.appendChild(el('i'));
    l.appendChild(el('span', null, 'A ver as tarefas, eventos e documentos sem área…'));
    c.appendChild(l);
    return;
  }
  if (it.estado === 'erro'){
    c.appendChild(el('p', 'am-erro', it.erro));
    var t = el('button', 'btn', 'Tentar outra vez'); t.type = 'button'; t.addEventListener('click', function(){ amPedirItens(); amDesenhar(); });
    c.appendChild(t);
    return;
  }
  if (it.estado !== 'lista') return;
  var h = el('h3', 'am-sec', 'Tarefas, eventos e documentos');
  h.appendChild(el('small', null, it.total + ' sem área'));
  c.appendChild(h);
  var areas = amAreas();
  var lista = el('div', 'am-lista');
  it.lista.forEach(function(x){
    var r = el('div', 'am-g' + (x.marcado ? '' : ' off'));
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = x.marcado;
    cb.setAttribute('aria-label', 'Aplicar a ' + x.titulo);
    cb.addEventListener('change', function(){ x.marcado = cb.checked; amDesenhar(); });
    r.appendChild(cb);
    var t = el('div', 'am-t');
    var b = el('b', null, x.titulo || ''); b.title = x.titulo || '';
    t.appendChild(b);
    var s = el('small');
    s.appendChild(el('span', 'am-tipo', AM_TIPO[x.tipo] || x.tipo));
    s.appendChild(document.createTextNode([amDataCurta(x.data), x.pessoa].filter(Boolean).join(' · ')));
    if (x.confianca) s.appendChild(el('span', 'am-conf ' + x.confianca, x.confianca === 'alta' ? 'certo' : x.confianca === 'media' ? 'provável' : 'dúvida'));
    t.appendChild(s);
    r.appendChild(t);
    var sel = el('select');
    var o0 = el('option', null, 'Escolher área…'); o0.value = ''; sel.appendChild(o0);
    areas.forEach(function(a){ var o = el('option', null, a[1]); o.value = String(a[0]); sel.appendChild(o); });
    var of = el('option', null, 'Não tem área — não voltar a propor'); of.value = 'fora'; sel.appendChild(of);
    sel.value = x.escolha;
    sel.setAttribute('aria-label', 'Área de ' + x.titulo);
    sel.addEventListener('change', function(){ x.escolha = sel.value; x.marcado = !!sel.value; amDesenhar(); });
    r.appendChild(sel);
    lista.appendChild(r);
  });
  c.appendChild(lista);
  var n = 0, fora = 0;
  it.lista.forEach(function(x){ if (x.marcado && x.escolha) { if (x.escolha === 'fora') fora++; else n++; } });
  var ac = el('div', 'am-acoes');
  ac.appendChild(el('span', 'am-n', (n ? n + ' com área' : 'Nada marcado') + (fora ? ' · ' + fora + ' sem área' : '')));
  var ap = el('button', 'btn primary', 'Aplicar');
  ap.type = 'button';
  ap.disabled = !(n || fora);
  ap.addEventListener('click', function(){ ap.disabled = true; ap.textContent = 'A aplicar…'; amAplicarItens(); });
  ac.appendChild(ap);
  c.appendChild(ac);
}

function amAplicarItens(){
  var it = AM.it, gravar = [], fora = [];
  it.lista.forEach(function(x){
    if (!x.marcado || !x.escolha) return;
    if (x.escolha === 'fora') fora.push(x.tipo + ':' + x.id);
    else gravar.push({ tipo: x.tipo, id: x.id, context_id: Number(x.escolha) });
  });
  var pedidos = [];
  if (gravar.length) pedidos.push(amPost('/api/captar/itens-area', { itens: gravar }));
  if (fora.length) pedidos.push(amPost('/api/captar/itens-dispensar', { chaves: fora }));
  Promise.all(pedidos)
    .then(function(){
      it.ultimo = { n: gravar.length, fora: fora.length, itens: gravar };
      if (typeof cpRecarregar === 'function') cpRecarregar();
      amDepois();
      amPedirItens();
      amDesenhar();
    })
    .catch(function(e){ it.estado = 'erro'; it.erro = (e && e.message) || 'Não foi possível aplicar.'; amDesenhar(); });
}
