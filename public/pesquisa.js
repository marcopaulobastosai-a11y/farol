/* ------------------------------------------------------------------ *
 * Pesquisa global (16 out 2026)
 *
 * Uma caixa no topo do menu, por baixo de «Painel» (⌘K / Ctrl+K). Ao
 * escrever abre uma lista agrupada por tipo, ate 3 de cada; setas e Enter
 * escolhem, Esc fecha. «Ver todos os resultados» abre a pagina «Pesquisa»,
 * com todos, filtrados por tipo. Carregar num resultado abre o detalhe do
 * proprio item (a tarefa, o evento, o documento, o movimento, a pessoa...).
 * ------------------------------------------------------------------ */

var PS = { q: '', pedido: 0, res: null, sel: -1, lista: [], aberta: false, tempo: null,
           pag: { q: '', tipo: '', pedido: 0, res: null } };

var PS_TIPOS = {
  tarefas:    { nome: 'Pagamentos e tarefas', curto: 'Tarefas', sigla: '✓', cl: 'ps-t-tar' },
  eventos:    { nome: 'Eventos', curto: 'Eventos', sigla: 'EV', cl: 'ps-t-ev' },
  documentos: { nome: 'Documentos', curto: 'Documentos', sigla: 'DOC', cl: 'ps-t-doc' },
  movimentos: { nome: 'Movimentos', curto: 'Movimentos', sigla: '€', cl: 'ps-t-mov' },
  pessoas:    { nome: 'Pessoas', curto: 'Pessoas', sigla: 'P', cl: 'ps-t-pes' },
  projetos:   { nome: 'Projetos', curto: 'Projetos', sigla: 'PR', cl: 'ps-t-prj' },
  areas:      { nome: 'Áreas', curto: 'Áreas', sigla: 'A', cl: 'ps-t-prj' },
  bens:       { nome: 'Bens e dívidas', curto: 'Bens', sigla: 'B', cl: 'ps-t-mov' }
};
var PS_ORDEM = ['tarefas', 'eventos', 'documentos', 'movimentos', 'pessoas', 'projetos', 'areas', 'bens'];

var PS_CSS =
  '.ps-caixa{display:flex;align-items:center;gap:8px;margin:0 2px 10px;padding:0 10px;height:36px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);color:var(--muted);cursor:text}' +
  '.ps-caixa:focus-within{border-color:var(--accent);background:var(--surface);box-shadow:0 0 0 3px var(--accent-soft)}' +
  '.ps-caixa input{flex:1;min-width:0;border:0;outline:none;background:transparent;font:inherit;font-size:.875rem;color:var(--ink)}' +
  '.ps-caixa input::placeholder{color:var(--faint)}' +
  '.ps-tecla{font-family:var(--mono);font-size:.625rem;color:var(--muted);border:1px solid var(--line);border-radius:5px;padding:1px 5px;white-space:nowrap}' +
  '.ps-lista{position:fixed;z-index:300;width:min(520px,calc(100vw - 24px));max-height:min(640px,calc(100vh - 40px));display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow),0 18px 40px -16px rgba(15,40,40,.35);overflow:hidden}' +
  '.ps-topo{display:flex;justify-content:space-between;gap:10px;padding:9px 14px;border-bottom:1px solid var(--line-soft);font-size:.75rem;color:var(--muted)}' +
  '.ps-corpo{flex:1;overflow-y:auto;padding:4px 0}' +
  '.ps-grupo{display:flex;justify-content:space-between;padding:8px 14px 3px;font-family:var(--mono);font-size:.625rem;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}' +
  '.ps-it{display:flex;align-items:center;gap:12px;width:100%;border:0;background:transparent;padding:7px 14px;min-height:46px;cursor:pointer;font:inherit;color:var(--ink);text-align:left}' +
  '.ps-it:hover,.ps-it.sel{background:var(--accent-soft)}' +
  '.ps-ic{width:28px;height:28px;flex:none;border-radius:7px;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:.625rem;font-weight:500}' +
  '.ps-t-tar{background:var(--warn-soft);color:var(--warn)}.ps-t-ev{background:var(--accent-soft);color:var(--accent-ink)}' +
  '.ps-t-doc{background:var(--line-soft);color:var(--ink-2)}.ps-t-mov{background:var(--good-soft);color:var(--good)}' +
  '.ps-t-pes{background:var(--bad-soft);color:var(--bad)}.ps-t-prj{background:var(--accent-soft);color:var(--accent)}' +
  '.ps-tx{display:flex;flex-direction:column;min-width:0;flex:1}' +
  '.ps-tit{font-size:.875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.ps-tit mark{background:var(--warn-soft);color:inherit;border-radius:3px;padding:0 1px}' +
  '.ps-meta{font-size:.75rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.ps-dir{flex:none;font-size:.75rem;color:var(--ink-2);text-align:right;white-space:nowrap}' +
  '.ps-pe{border-top:1px solid var(--line-soft);display:flex;justify-content:space-between;align-items:center}' +
  '.ps-todos{border:0;background:transparent;font:inherit;font-size:.8125rem;font-weight:500;color:var(--accent);padding:11px 14px;cursor:pointer;text-align:left;flex:1}' +
  '.ps-todos:hover,.ps-todos.sel{background:var(--accent-soft)}' +
  '.ps-nada{padding:22px 16px;font-size:.875rem;color:var(--muted)}' +
  /* A pagina */
  '.ps-pag{display:flex;flex-direction:column;gap:14px}' +
  '.ps-pag .ps-caixa{height:46px;margin:0;background:var(--surface)}.ps-pag .ps-caixa input{font-size:1rem}' +
  '.ps-chips{display:flex;flex-wrap:wrap;gap:8px}' +
  '.ps-chip{height:32px;padding:0 12px;border-radius:16px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2);font:inherit;font-size:.8125rem;cursor:pointer}' +
  '.ps-chip.on{background:var(--accent);border-color:var(--accent);color:#fff}' +
  '.ps-sec{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}' +
  '.ps-sec-h{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;border-bottom:1px solid var(--line-soft);font-family:var(--mono);font-size:.625rem;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}' +
  '.ps-sec-h button{border:0;background:none;font-family:var(--sans);font-size:.8125rem;letter-spacing:0;text-transform:none;color:var(--accent);cursor:pointer}' +
  '.ps-sec .ps-it{border-bottom:1px solid var(--line-soft);min-height:52px}.ps-sec .ps-it:last-child{border-bottom:0}' +
  '@media (max-width:900px){.ps-caixa{min-width:170px;margin:0}.ps-tecla{display:none}}';

function psEstilo(){
  if (document.getElementById('psCss')) return;
  var st = document.createElement('style'); st.id = 'psCss'; st.textContent = PS_CSS;
  document.head.appendChild(st);
}

/* ----------------------------- texto ------------------------------ */
function psSem(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

/* O titulo com a primeira palavra procurada realcada (sem innerHTML). */
function psRealce(titulo, q){
  var span = el('span', 'ps-tit');
  span.title = titulo;
  var t = String(titulo || ''), base = psSem(t);
  var ps = psSem(q).split(/\s+/).filter(Boolean);
  var melhor = -1, tam = 0;
  ps.forEach(function(p){ var i = base.indexOf(p); if (i >= 0 && (melhor < 0 || i < melhor)){ melhor = i; tam = p.length; } });
  if (melhor < 0 || base.length !== t.length){ span.textContent = t; return span; }
  span.appendChild(document.createTextNode(t.slice(0, melhor)));
  span.appendChild(el('mark', null, t.slice(melhor, melhor + tam)));
  span.appendChild(document.createTextNode(t.slice(melhor + tam)));
  return span;
}

var PS_MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function psData(iso){
  if (!iso) return '';
  var p = String(iso).slice(0, 10).split('-');
  if (p.length < 3) return '';
  var ano = Number(p[0]) === new Date().getFullYear() ? '' : ' ' + p[0];
  return Number(p[2]) + ' ' + PS_MESES[Number(p[1]) - 1] + ano;
}
function psEur(v, sinal){
  if (v == null || isNaN(v)) return '';
  var s = Math.abs(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  return sinal ? (v < 0 ? '−' : '+') + s : s;
}
function psArea(x){ return x.area ? (x.area_pai ? x.area_pai + ' › ' + x.area : x.area) : ''; }

/* A linha de baixo e a coluna da direita de cada tipo. */
function psDetalhe(tipo, x){
  var meta = [], dir = '';
  if (tipo === 'tarefas'){
    meta.push(x.tipo === 'pagamento' ? 'Pagamento' : x.tipo === 'nota' ? 'Nota' : 'Tarefa');
    if (x.done || x.status === 'concluida') meta.push('feita');
    else if (x.status === 'cancelada') meta.push('não se faz');
    if (psArea(x)) meta.push(psArea(x));
    if (x.payee) meta.push(x.payee);
    dir = [x.valor != null ? psEur(x.valor) : '', x.data ? psData(x.data) : ''].filter(Boolean).join(' · ');
  } else if (tipo === 'eventos'){
    meta.push('Evento');
    if (psArea(x)) meta.push(psArea(x));
    if (x.location) meta.push(x.location);
    dir = psData(x.data) + (x.hora ? ' · ' + x.hora : '');
  } else if (tipo === 'documentos'){
    meta.push(x.kind ? x.kind.charAt(0).toUpperCase() + x.kind.slice(1) : 'Documento');
    if (x.entity) meta.push(x.entity);
    if (psArea(x)) meta.push(psArea(x));
    if (x.aprovado === false) meta.push('por aprovar');
    dir = psData(x.data);
  } else if (tipo === 'movimentos'){
    meta.push(x.conta);
    if (x.categoria) meta.push(x.categoria);
    if (x.descricao && x.descricao !== x.titulo) meta.push(x.descricao);
    dir = psEur(x.valor, true) + ' · ' + psData(x.data);
  } else if (tipo === 'pessoas'){
    meta.push('Pessoa');
    if (x.role) meta.push(x.role);
  } else if (tipo === 'projetos'){
    meta.push(x.tipo === 'programa' ? 'Programa' : 'Projeto');
    if (x.status && x.status !== 'ativo') meta.push(x.status);
    if (psArea(x)) meta.push(psArea(x));
  } else if (tipo === 'areas'){
    meta.push(x.parent_id ? 'Sub-área de ' + (x.area_pai || '') : 'Área');
  } else if (tipo === 'bens'){
    meta.push(x.lado === 'passivo' ? 'Dívida' : 'Bem');
    if (psArea(x)) meta.push(psArea(x));
    dir = x.valor != null ? psEur(x.valor) : '';
  }
  return { meta: meta.filter(Boolean).join(' · '), dir: dir };
}

function psLinha(tipo, x, q, ao){
  var T = PS_TIPOS[tipo];
  var d = psDetalhe(tipo, x);
  var b = el('button', 'ps-it');
  b.type = 'button';
  b.appendChild(el('span', 'ps-ic ' + T.cl, T.sigla));
  var tx = el('span', 'ps-tx');
  tx.appendChild(psRealce(x.titulo, q));
  if (d.meta) tx.appendChild(el('span', 'ps-meta', d.meta));
  b.appendChild(tx);
  if (d.dir) b.appendChild(el('span', 'ps-dir', d.dir));
  b.addEventListener('mousedown', function(e){ e.preventDefault(); });
  b.addEventListener('click', function(){ ao(); });
  return b;
}

/* --------------------------- abrir um item ------------------------- */
function psFecharJanelas(){
  if (typeof avFecharFolha === 'function') try { avFecharFolha(); } catch (e) {}
}

function psAbrir(tipo, x){
  psFechar();
  try {
    if (tipo === 'tarefas') return psAbrirTarefa(x.id);
    if (tipo === 'eventos'){
      if (typeof evAbrirId === 'function') return evAbrirId(x.id);
      return show('agenda');
    }
    if (tipo === 'documentos'){
      var d = ((window.D && D.documents) || []).filter(function(y){ return y.id === x.id; })[0];
      if (d && typeof editarDocumento === 'function') return editarDocumento(d);
      show('documentos');
      return toast('O documento ainda não foi aprovado: está na lista dos Documentos.');
    }
    if (tipo === 'movimentos') return psAbrirMov(x.id);
    if (tipo === 'pessoas'){
      if (typeof fiAbrir === 'function') return fiAbrir(x.id);
      return show('familia');
    }
    if (tipo === 'projetos'){
      show('projetos');
      if (typeof pjEscolher === 'function') setTimeout(function(){ try { pjEscolher(x.tipo === 'programa' ? 'programa' : 'projeto', x.id); } catch (e) {} }, 0);
      return;
    }
    if (tipo === 'areas') return psAbrirArea(x.id);
    if (tipo === 'bens'){
      if (window.FN){ FN.aba.patrimonio = 'bens'; }
      show('patrimonio');
      if (typeof fnRender === 'function') try { fnRender('patrimonio'); } catch (e) {}
      return;
    }
  } catch (e) {
    console.error('[farol] pesquisa abrir', tipo, e);
    toast('Não consegui abrir este item.');
  }
}

function psAbrirTarefa(id){
  var ir = function(){
    if (typeof avTarefaId === 'function' && avTarefaId(id)) return true;
    return false;
  };
  var depois = function(){
    if (ir()) return;
    /* Uma tarefa ja fechada nao vem na lista de abertas: le-se sozinha e
       entra no historico das Tarefas, onde o detalhe a vai buscar. */
    apiGestao('/api/tarefas/' + id).then(function(t){
      if (window.TF){ TF.historico = (TF.historico || []).filter(function(x){ return x.id !== t.id; }); TF.historico.push(t); }
      if (!ir()){
        if (typeof tfIrPara === 'function' && tfIrPara(id)) return;
        show('tarefas');
      }
    }).catch(function(){ toast('Não encontrei a tarefa.'); });
  };
  if (window.G && G.tasks) return depois();
  apiGestao('/api/gestao').then(function(g){ window.G = g; depois(); }).catch(function(){ show('tarefas'); });
}

function psAbrirMov(id){
  if (typeof fnMovJanela !== 'function' || typeof fnBase !== 'function'){ show('financas'); return; }
  if (!document.getElementById('fnCss') && typeof FN_CSS === 'string'){
    var st = document.createElement('style'); st.id = 'fnCss'; st.textContent = FN_CSS; document.head.appendChild(st);
  }
  Promise.all([fnBase(), apiGestao('/api/financas/movimentos/' + id)]).then(function(r){
    if (r[1] && r[1].movimento) fnMovJanela(r[1].movimento);
    else toast('Não encontrei o movimento.');
  }).catch(function(){ toast('Não encontrei o movimento.'); });
}

function psAbrirArea(id){
  if (!(window.G && G.contextos)){
    apiGestao('/api/gestao').then(function(g){ window.G = g; if (g.contextos) psAbrirArea(id); else show('hoje'); }).catch(function(){ show('hoje'); });
    return;
  }
  var cs = G.contextos;
  var c = cs.filter(function(x){ return x.id === id; })[0];
  if (!c || typeof AE_AREAS === 'undefined' || typeof aeArea !== 'function'){ show('hoje'); return; }
  var topo = c.parent_id ? cs.filter(function(x){ return x.id === c.parent_id; })[0] || c : c;
  var a = AE_AREAS.filter(function(x){ var ar = aeArea(x); return ar && ar.id === topo.id; })[0];
  if (!a){ toast('Esta área não tem ecrã próprio.'); return; }
  show(a.view);
  if (typeof aeNavFiltrar === 'function') aeNavFiltrar(a, c.parent_id ? String(c.id) : null);
}

/* ------------------------- a lista do menu ------------------------- */
function psMontar(){
  var nav = document.getElementById('nav');
  if (!nav || document.getElementById('psInput')) return;
  psEstilo();
  var rot = nav.querySelector('.nav-label');
  var caixa = el('label', 'ps-caixa');
  caixa.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
  var inp = el('input');
  inp.id = 'psInput';
  inp.type = 'search';
  inp.autocomplete = 'off';
  inp.placeholder = 'Procurar no Farol';
  inp.setAttribute('aria-label', 'Procurar no Farol');
  caixa.appendChild(inp);
  var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  caixa.appendChild(el('span', 'ps-tecla', mac ? '⌘K' : 'Ctrl K'));
  if (rot && rot.nextSibling) nav.insertBefore(caixa, rot.nextSibling); else nav.insertBefore(caixa, nav.firstChild);

  inp.addEventListener('input', function(){ psEscrever(inp.value); });
  inp.addEventListener('focus', function(){ if (inp.value.trim()) { PS.aberta = true; psDesenhar(); } });
  inp.addEventListener('blur', function(){ setTimeout(function(){ if (document.activeElement !== inp) psFechar(); }, 120); });
  inp.addEventListener('keydown', psTeclas);

  document.addEventListener('keydown', function(e){
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'k' || e.key === 'K')){
      e.preventDefault();
      inp.focus(); inp.select();
      if (inp.value.trim()){ PS.aberta = true; psDesenhar(); }
    }
  });
  window.addEventListener('resize', function(){ if (PS.aberta) psPosicionar(); });
}

function psEscrever(v){
  PS.q = v;
  PS.sel = -1;
  clearTimeout(PS.tempo);
  if (v.trim().length < 2){ PS.res = null; psFechar(); return; }
  PS.aberta = true;
  PS.tempo = setTimeout(function(){
    var n = ++PS.pedido;
    apiGestao('/api/pesquisa?limite=3&q=' + encodeURIComponent(v.trim())).then(function(r){
      if (n !== PS.pedido) return;
      PS.res = r;
      psDesenhar();
    }).catch(function(){ if (n === PS.pedido){ PS.res = { erro: true, tipos: [], total: 0 }; psDesenhar(); } });
  }, 180);
  if (!PS.res) psDesenhar();
}

function psPosicionar(){
  var box = document.getElementById('psLista'), inp = document.getElementById('psInput');
  if (!box || !inp) return;
  var r = inp.parentNode.getBoundingClientRect();
  var largo = Math.min(520, window.innerWidth - 24);
  var esq = Math.max(12, Math.min(r.left, window.innerWidth - largo - 12));
  box.style.left = esq + 'px';
  box.style.top = (r.bottom + 6) + 'px';
}

function psDesenhar(){
  var box = document.getElementById('psLista');
  if (!PS.aberta){ if (box) box.remove(); return; }
  if (!box){
    box = el('div', 'ps-lista'); box.id = 'psLista';
    box.setAttribute('role', 'listbox');
    document.body.appendChild(box);
  }
  clear(box);
  psPosicionar();
  var q = PS.q.trim(), r = PS.res;
  var topo = el('div', 'ps-topo');
  topo.appendChild(el('span', null, !r ? 'A procurar…' : r.erro ? 'Não foi possível procurar.' :
    r.total + (r.total === 1 ? ' resultado' : ' resultados') + (r.total > 3 ? ' · até 3 por tipo' : '')));
  topo.appendChild(el('span', 'ps-tecla', '↑↓ ↵ Esc'));
  box.appendChild(topo);
  var corpo = el('div', 'ps-corpo');
  box.appendChild(corpo);
  PS.lista = [];
  if (r && !r.erro && !r.total) corpo.appendChild(el('div', 'ps-nada', 'Nada no Farol com «' + q + '».'));
  (r && r.tipos || []).forEach(function(g){
    var T = PS_TIPOS[g.tipo];
    if (!T || !g.itens.length) return;
    var gr = el('div', 'ps-grupo');
    gr.appendChild(el('span', null, T.nome));
    gr.appendChild(el('span', null, String(g.n)));
    corpo.appendChild(gr);
    g.itens.forEach(function(x){
      var i = PS.lista.length;
      var b = psLinha(g.tipo, x, q, function(){ psAbrir(g.tipo, x); });
      b.setAttribute('role', 'option');
      b.addEventListener('mouseenter', function(){ psMarcar(i); });
      PS.lista.push({ no: b, abrir: function(){ psAbrir(g.tipo, x); } });
      corpo.appendChild(b);
    });
  });
  if (r && r.total){
    var pe = el('div', 'ps-pe');
    var todos = el('button', 'ps-todos', 'Ver todos os resultados (' + r.total + ')');
    todos.type = 'button';
    todos.addEventListener('mousedown', function(e){ e.preventDefault(); });
    todos.addEventListener('click', function(){ psPagina(q); });
    var i = PS.lista.length;
    todos.addEventListener('mouseenter', function(){ psMarcar(i); });
    PS.lista.push({ no: todos, abrir: function(){ psPagina(q); } });
    pe.appendChild(todos);
    box.appendChild(pe);
  }
  psMarcar(PS.sel);
}

function psMarcar(i){
  PS.sel = i;
  PS.lista.forEach(function(x, j){ x.no.classList.toggle('sel', j === i); });
  var s = PS.lista[i];
  if (s && s.no.scrollIntoView) s.no.scrollIntoView({ block: 'nearest' });
}

function psTeclas(e){
  if (e.key === 'Escape'){ e.preventDefault(); if (PS.aberta) psFechar(); else e.target.blur(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    if (!PS.aberta && PS.q.trim()){ PS.aberta = true; psDesenhar(); }
    if (!PS.lista.length) return;
    e.preventDefault();
    var n = PS.lista.length;
    psMarcar(e.key === 'ArrowDown' ? (PS.sel + 1) % n : (PS.sel <= 0 ? n - 1 : PS.sel - 1));
    return;
  }
  if (e.key === 'Enter'){
    e.preventDefault();
    var s = PS.lista[PS.sel];
    if (s) s.abrir();
    else if (PS.q.trim()) psPagina(PS.q.trim());
  }
}

function psFechar(){
  PS.aberta = false;
  var box = document.getElementById('psLista');
  if (box) box.remove();
}

/* ---------------------------- a pagina ----------------------------- */
function psMontarPagina(){
  if (document.getElementById('view-pesquisa')) return;
  psEstilo();
  if (window.TITLES) TITLES.pesquisa = ['Pesquisa', 'Tarefas, pagamentos, eventos, documentos, movimentos, pessoas, projetos, áreas e bens'];
  var sec = el('section', 'view');
  sec.id = 'view-pesquisa';
  var pag = el('div', 'ps-pag');
  pag.id = 'psPag';
  sec.appendChild(pag);
  var irmao = document.querySelector('.view');
  (irmao ? irmao.parentNode : document.body).appendChild(sec);

  var caixa = el('label', 'ps-caixa');
  caixa.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
  var inp = el('input');
  inp.id = 'psPagInput';
  inp.type = 'search';
  inp.autocomplete = 'off';
  inp.placeholder = 'Uma palavra, um nome ou um valor';
  inp.setAttribute('aria-label', 'Procurar no Farol');
  caixa.appendChild(inp);
  var conta = el('span', 'ps-meta');
  conta.id = 'psPagConta';
  caixa.appendChild(conta);
  pag.appendChild(caixa);
  var chips = el('div', 'ps-chips'); chips.id = 'psPagChips';
  pag.appendChild(chips);
  var res = el('div', 'ps-pag'); res.id = 'psPagRes';
  pag.appendChild(res);

  var tempo = null;
  inp.addEventListener('input', function(){
    clearTimeout(tempo);
    tempo = setTimeout(function(){ psProcurarPagina(inp.value.trim(), PS.pag.tipo); }, 200);
  });
  inp.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); clearTimeout(tempo); psProcurarPagina(inp.value.trim(), PS.pag.tipo); } });
}

function psPagina(q){
  psFechar();
  var mi = document.getElementById('psInput');
  if (mi) mi.blur();
  psMontarPagina();
  show('pesquisa');
  document.getElementById('psPagInput').value = q || '';
  PS.pag.tipo = '';
  psProcurarPagina(q || '', '');
}

function psProcurarPagina(q, tipo){
  PS.pag.q = q; PS.pag.tipo = tipo || '';
  var res = document.getElementById('psPagRes');
  if (!res) return;
  if (!q){ clear(res); clear(document.getElementById('psPagChips')); document.getElementById('psPagConta').textContent = ''; return; }
  var n = ++PS.pag.pedido;
  res.style.opacity = '.55';
  /* As contagens de todos os tipos vêm sempre; os itens, de todos (20 de
     cada) ou so do tipo escolhido (todos, ate 200). */
  var pedidos = [apiGestao('/api/pesquisa?limite=20&q=' + encodeURIComponent(q))];
  if (tipo) pedidos.push(apiGestao('/api/pesquisa?limite=200&tipo=' + tipo + '&q=' + encodeURIComponent(q)));
  Promise.all(pedidos).then(function(rs){
    if (n !== PS.pag.pedido) return;
    res.style.opacity = '';
    psDesenharPagina(rs[0], rs[1] || null);
  }).catch(function(){
    if (n !== PS.pag.pedido) return;
    res.style.opacity = '';
    clear(res);
    res.appendChild(el('div', 'ps-sec ps-nada', 'Não foi possível procurar.'));
  });
}

function psDesenharPagina(tudo, so){
  var q = PS.pag.q, tipo = PS.pag.tipo;
  document.getElementById('psPagConta').textContent = tudo.total + (tudo.total === 1 ? ' resultado' : ' resultados');
  var chips = document.getElementById('psPagChips');
  clear(chips);
  var chip = function(id, nome, n){
    var b = el('button', 'ps-chip' + (tipo === id ? ' on' : ''), nome + ' · ' + n);
    b.type = 'button';
    b.addEventListener('click', function(){ psProcurarPagina(q, id); });
    chips.appendChild(b);
  };
  chip('', 'Tudo', tudo.total);
  PS_ORDEM.forEach(function(t){
    var g = tudo.tipos.filter(function(x){ return x.tipo === t; })[0];
    if (g && g.n) chip(t, PS_TIPOS[t].curto, g.n);
  });

  var res = document.getElementById('psPagRes');
  clear(res);
  if (!tudo.total){ res.appendChild(el('div', 'ps-sec ps-nada', 'Nada no Farol com «' + q + '».')); return; }
  var grupos = so ? so.tipos : tudo.tipos;
  PS_ORDEM.forEach(function(t){
    var g = grupos.filter(function(x){ return x.tipo === t; })[0];
    if (!g || !g.itens.length) return;
    var sec = el('section', 'ps-sec');
    var cab = el('div', 'ps-sec-h');
    cab.appendChild(el('span', null, PS_TIPOS[t].nome + ' · ' + g.n));
    if (!so && g.n > g.itens.length){
      var mais = el('button', null, 'Ver os ' + g.n + ' →');
      mais.type = 'button';
      mais.addEventListener('click', function(){ psProcurarPagina(q, t); window.scrollTo({ top: 0, behavior: 'smooth' }); });
      cab.appendChild(mais);
    } else if (so && g.n > g.itens.length){
      cab.appendChild(el('span', null, 'os primeiros ' + g.itens.length));
    }
    sec.appendChild(cab);
    g.itens.forEach(function(x){ sec.appendChild(psLinha(t, x, q, function(){ psAbrir(t, x); })); });
    res.appendChild(sec);
  });
}

(function psEsperar(){
  if (document.getElementById('nav') && typeof el === 'function' && typeof show === 'function'){
    psMontar();
    return;
  }
  setTimeout(psEsperar, 120);
})();
