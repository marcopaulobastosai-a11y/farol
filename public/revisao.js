'use strict';
/* Farol - a revisao da semana (fase 6 do menu novo, 24 out 2026).
 *
 * Dez minutos ao domingo. Cinco passos, cada um com os numeros de agora e o
 * caminho para tratar dele:
 *
 *   1. Esvaziar a caixa de entrada
 *   2. Acertar as contas correntes
 *   3. Tarefas em atraso: reagendar, delegar ou largar
 *   4. Programas sem avanco (nada fechado nos ultimos 14 dias)
 *   5. O que vem nos proximos 14 dias
 *
 * Cada passo marca-se como visto (fica neste browser, so para a semana).
 * «Fechar a semana» grava no servidor (/api/revisao/fechar) - e isso que faz
 * o aviso do Hoje desaparecer. O aviso aparece ao domingo, e a segunda se a
 * semana ficou por fechar. So com o menu novo ligado.
 */

var RV = { fechos: null, cc: null, aLer: false, vistos: {} };

var RV_CSS = [
  '#nav button[data-view="revisao"]{display:none}',
  'body.mn-on #nav button[data-view="revisao"]{display:flex}',
  '#view-revisao .rv-topo{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}',
  '#view-revisao .rv-prog{flex:1;min-width:180px;height:8px;border-radius:4px;background:var(--line-soft);overflow:hidden}',
  '#view-revisao .rv-prog i{display:block;height:100%;background:var(--accent);transition:width .2s}',
  '#view-revisao .rv-ult{color:var(--muted);font-size:.8125rem}',
  '#view-revisao .rv-passo{border:1px solid var(--line);border-radius:12px;background:var(--surface);margin-bottom:10px;overflow:hidden}',
  '#view-revisao .rv-passo.visto{opacity:.6}',
  '#view-revisao .rv-cab{display:flex;align-items:center;gap:12px;padding:14px}',
  '#view-revisao .rv-n{flex:none;width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--ink);color:var(--surface);font-weight:500;font-size:.8125rem}',
  '#view-revisao .rv-passo.visto .rv-n{background:var(--accent)}',
  '#view-revisao .rv-tt{flex:1;min-width:0}',
  '#view-revisao .rv-tt b{display:block;font-weight:500}',
  '#view-revisao .rv-tt small{color:var(--muted);font-size:.8125rem}',
  '#view-revisao .rv-acoes{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}',
  '#view-revisao .rv-acoes .btn{min-height:36px}',
  '#view-revisao .rv-lista{border-top:1px solid var(--line-soft)}',
  '#view-revisao .rv-it{font:inherit;width:100%;text-align:left;display:flex;align-items:center;gap:12px;padding:9px 14px 9px 56px;border:none;background:none;color:var(--ink);cursor:pointer;min-height:42px;font-size:.875rem}',
  '#view-revisao .rv-it:hover{background:var(--surface-2)}',
  '#view-revisao .rv-it span:first-child{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '#view-revisao .rv-it small{flex:none;color:var(--muted);font-size:.75rem;font-family:var(--mono)}',
  '#view-revisao .rv-it small.bad{color:var(--bad)}',
  '#view-revisao .rv-mais{padding:6px 14px 10px 56px;color:var(--muted);font-size:.75rem;margin:0}',
  '#view-revisao .rv-fim{display:flex;justify-content:flex-end;gap:10px;align-items:center;margin-top:16px}',
  '#view-revisao .rv-hist{margin-top:22px}',
  '#view-revisao .rv-hist h3{font-size:.875rem;font-weight:500;margin:0 0 8px}',
  '#view-revisao .rv-hist li{font-size:.8125rem;color:var(--muted);padding:3px 0}',
  '.rv-banner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;padding:12px 16px;border:1px solid var(--accent);border-radius:12px;background:var(--accent-soft)}',
  '.rv-banner b{font-weight:500;color:var(--accent-ink)}',
  '.rv-banner span{color:var(--ink-2);font-size:.8125rem}',
  '.rv-banner .btn{margin-left:auto}'
].join('\n');

function rvEstilo(){
  if (document.getElementById('rvCss')) return;
  var st = document.createElement('style'); st.id = 'rvCss'; st.textContent = RV_CSS;
  document.head.appendChild(st);
}

/* ------------------------------ datas ------------------------------ */
function rvIso(d){ return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function rvHoje(){ var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
/* A semana e de segunda a domingo e chama-se pelo domingo dela. A segunda
   ainda conta como a semana que acabou: e o dia de fechar o que ficou. */
function rvSemana(){
  var h = rvHoje();
  var dow = h.getDay(); // 0 = domingo
  var ate = dow === 0 ? 0 : (dow === 1 ? -1 : 7 - dow);
  return rvIso(new Date(h.getFullYear(), h.getMonth(), h.getDate() + ate));
}
function rvMais(n){ var h = rvHoje(); return rvIso(new Date(h.getFullYear(), h.getMonth(), h.getDate() + n)); }
function rvCurta(iso){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  var ms = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return m ? Number(m[3]) + ' ' + ms[Number(m[2]) - 1] : '';
}
function rvFechada(){ return (RV.fechos || []).some(function(f){ return f.semana === rvSemana(); }); }

function rvLerVistos(){
  try { var v = JSON.parse(localStorage.getItem('rvVistos') || '{}'); RV.vistos = v && v.semana === rvSemana() ? v : { semana: rvSemana() }; }
  catch (e) { RV.vistos = { semana: rvSemana() }; }
}
function rvGuardarVistos(){ try { localStorage.setItem('rvVistos', JSON.stringify(RV.vistos)); } catch (e) {} }

/* ------------------------------ os numeros ------------------------------ */
function rvCaixa(){
  var n = 0;
  ['badgeInbox', 'badgeInboxAprovar'].forEach(function(id){
    var b = document.getElementById(id); var v = b ? parseInt(b.textContent, 10) : 0; if (v > 0) n += v;
  });
  return n;
}
function rvTipo(t){ return typeof tfTipo === 'function' ? tfTipo(t) : (t.tipo || 'tarefa'); }
function rvAberta(t){ return t.status !== 'concluida' && t.status !== 'cancelada' && !t.done; }
function rvAtrasadas(){
  var hoje = rvIso(rvHoje());
  return ((window.G && G.tasks) || []).filter(function(t){
    var tp = rvTipo(t);
    return !t.parent_id && rvAberta(t) && t.due_on && t.due_on < hoje && (tp === 'tarefa' || tp === 'pagamento');
  }).sort(function(a, b){ return a.due_on < b.due_on ? -1 : 1; });
}
function rvParados(){
  var ps = (window.G && G.projects) || [];
  var desde = rvMais(-14);
  return ps.filter(function(p){ return p.tipo === 'programa' && p.status !== 'concluido' && p.status !== 'arquivado'; })
    .map(function(p){
      var filhos = ps.filter(function(f){ return f.parent_id === p.id; }).map(function(f){ return f.id; }).concat([p.id]);
      var tarefas = ((window.G && G.tasks) || []).filter(function(t){ return filhos.indexOf(t.project_id) >= 0; });
      var feitas = tarefas.filter(function(t){ return t.completed_at && String(t.completed_at).slice(0, 10) >= desde; }).length;
      var abertas = tarefas.filter(rvAberta).length;
      return { p: p, feitas: feitas, abertas: abertas };
    }).filter(function(x){ return !x.feitas; });
}
function rvProximos(){
  var de = rvIso(rvHoje()), ate = rvMais(14);
  var out = [];
  ((window.D && D.attention) || []).forEach(function(a){
    if (!a.quando || a.quando < de || a.quando > ate) return;
    out.push({ dia: a.quando, titulo: a.title, a: a, tipo: a.origem === 'documento' || a.origem === 'pessoa' ? 'validade' : a.origem });
  });
  ((window.D && D.events) || []).forEach(function(e){
    if (e.ocupado || e.day < de || e.day > ate) return;
    if (out.some(function(x){ return x.a && x.a.origem === 'evento' && x.a.id === e.id; })) return;
    out.push({ dia: e.day, titulo: e.title, e: e, tipo: 'evento' });
  });
  return out.sort(function(a, b){ return a.dia < b.dia ? -1 : (a.dia > b.dia ? 1 : 0); });
}
function rvCcPendentes(){
  return (RV.cc || []).filter(function(p){ return p.ativo !== false && Math.abs(Number(p.saldo || 0)) >= 0.01; });
}
function rvEuros(v){ return typeof tfEuros === 'function' ? tfEuros(Math.abs(Number(v || 0))) : Math.abs(Number(v || 0)).toFixed(2) + ' €'; }

function rvCarregar(){
  if (RV.aLer || typeof apiGestao !== 'function') return;
  RV.aLer = true;
  Promise.all([
    apiGestao('/api/revisao').then(function(d){ RV.fechos = d.fechos || []; }).catch(function(){ if (!RV.fechos) RV.fechos = []; }),
    apiGestao('/api/financas/cc').then(function(d){ RV.cc = d.pessoas || []; }).catch(function(){ if (!RV.cc) RV.cc = []; })
  ]).then(function(){ RV.aLer = false; rvRender(); rvBanner(); });
}

/* ------------------------------ o desenho ------------------------------ */
function rvPasso(box, n, chave, titulo, resumo, acoes, itens, mais){
  var visto = !!RV.vistos[chave];
  var p = el('div', 'rv-passo' + (visto ? ' visto' : ''));
  var cab = el('div', 'rv-cab');
  cab.appendChild(el('span', 'rv-n', visto ? '✓' : String(n)));
  var tt = el('div', 'rv-tt');
  tt.appendChild(el('b', null, titulo));
  tt.appendChild(el('small', null, resumo));
  cab.appendChild(tt);
  var ac = el('div', 'rv-acoes');
  (acoes || []).forEach(function(a){
    var b = el('button', 'btn', a[0]); b.type = 'button'; b.addEventListener('click', a[1]); ac.appendChild(b);
  });
  var bv = el('button', 'btn' + (visto ? '' : ' primary'), visto ? 'Desmarcar' : 'Visto');
  bv.type = 'button';
  bv.addEventListener('click', function(){ RV.vistos[chave] = !visto; rvGuardarVistos(); rvRender(); });
  ac.appendChild(bv);
  cab.appendChild(ac);
  p.appendChild(cab);
  if (itens && itens.length && !visto){
    var l = el('div', 'rv-lista');
    itens.forEach(function(it){ l.appendChild(it); });
    if (mais) l.appendChild(el('p', 'rv-mais', mais));
    p.appendChild(l);
  }
  box.appendChild(p);
}
function rvItem(texto, lado, cls, fn){
  var b = el('button', 'rv-it');
  b.type = 'button';
  b.appendChild(el('span', null, texto));
  if (lado) b.appendChild(el('small', cls || '', lado));
  if (fn) b.addEventListener('click', fn);
  return b;
}

function rvRender(){
  var sec = document.getElementById('view-revisao');
  if (!sec) return;
  if (RV.fechos === null) rvCarregar();
  rvLerVistos();
  clear(sec);

  var caixa = rvCaixa();
  var atrasadas = rvAtrasadas();
  var parados = rvParados();
  var prox = rvProximos();
  var cc = rvCcPendentes();
  var passos = ['caixa', 'contas', 'atraso', 'programas', 'proximos'];
  var vistos = passos.filter(function(k){ return RV.vistos[k]; }).length;

  var topo = el('div', 'rv-topo');
  var prog = el('div', 'rv-prog'); var i = el('i'); i.style.width = Math.round(vistos / passos.length * 100) + '%'; prog.appendChild(i);
  topo.appendChild(el('b', null, vistos + ' de ' + passos.length));
  topo.appendChild(prog);
  var ult = (RV.fechos || [])[0];
  topo.appendChild(el('span', 'rv-ult', rvFechada() ? 'Esta semana já está fechada' : (ult ? 'Última fechada: semana de ' + rvCurta(ult.semana) : 'Ainda nenhuma semana fechada')));
  sec.appendChild(topo);

  rvPasso(sec, 1, 'caixa', 'Esvaziar a caixa de entrada',
    caixa ? caixa + (caixa === 1 ? ' papel à espera de decisão' : ' papéis à espera de decisão') : 'Está vazia',
    caixa ? [['Abrir a caixa', function(){ if (window.IB && !IB.carregado && typeof ibCarregar === 'function') ibCarregar(); show('inbox'); }]] : []);

  var ccItens = cc.slice(0, 8).map(function(p){
    var s = Number(p.saldo || 0);
    return rvItem(p.nome, (s > 0 ? 'deve-te ' : 'deves ') + rvEuros(s), null, function(){ show('financas'); });
  });
  rvPasso(sec, 2, 'contas', 'Acertar as contas correntes',
    RV.cc === null ? 'A ler…' : (cc.length ? cc.length + (cc.length === 1 ? ' conta por acertar' : ' contas por acertar') : 'Tudo acertado'),
    cc.length ? [['Abrir as Finanças', function(){ show('financas'); }]] : [], ccItens, cc.length > 8 ? 'e mais ' + (cc.length - 8) + '.' : '');

  var atItens = atrasadas.slice(0, 8).map(function(t){
    return rvItem(t.title, rvCurta(t.due_on), 'bad', function(){
      if (typeof avAbrir === 'function') avAbrir({ origem: 'tarefa', id: t.id, quando: t.due_on, title: t.title, detail: '' });
    });
  });
  rvPasso(sec, 3, 'atraso', 'Tarefas em atraso',
    atrasadas.length ? atrasadas.length + ' — reagendar, delegar ou largar' : 'Nenhuma em atraso',
    atrasadas.length ? [['Abrir as Tarefas', function(){ show('tarefas'); }]] : [], atItens,
    atrasadas.length > 8 ? 'e mais ' + (atrasadas.length - 8) + ' nas Tarefas.' : '');

  var pgItens = parados.map(function(x){
    return rvItem(x.p.name, x.abertas + (x.abertas === 1 ? ' por fazer' : ' por fazer'), null, function(){
      show('projetos'); if (typeof pjEscolher === 'function') { try { pjEscolher('programa', x.p.id); } catch (e) {} }
    });
  });
  rvPasso(sec, 4, 'programas', 'Programas sem avanço',
    parados.length ? parados.length + (parados.length === 1 ? ' programa' : ' programas') + ' sem nada fechado nos últimos 14 dias' : 'Todos andaram nas últimas duas semanas',
    [], pgItens);

  var pxItens = prox.slice(0, 10).map(function(x){
    var nome = { validade: 'validade', evento: 'evento', tarefa: 'prazo' }[x.tipo] || x.tipo;
    return rvItem(x.titulo, rvCurta(x.dia) + ' · ' + nome, null, function(){
      if (x.a && typeof avAbrir === 'function') avAbrir(x.a);
      else if (x.e && typeof evAbrirId === 'function' && typeof x.e.id === 'number') evAbrirId(x.e.id);
    });
  });
  rvPasso(sec, 5, 'proximos', 'Os próximos 14 dias',
    prox.length ? prox.length + ' coisas com data: prazos, validades e eventos' : 'Nada com data',
    [['Abrir a Agenda', function(){ show('agenda'); }]], pxItens, prox.length > 10 ? 'e mais ' + (prox.length - 10) + ' na Agenda.' : '');

  var fim = el('div', 'rv-fim');
  if (rvFechada()) fim.appendChild(el('span', 'rv-ult', 'Fechada. Até ao próximo domingo.'));
  else {
    if (vistos < passos.length) fim.appendChild(el('span', 'rv-ult', 'Podes fechar mesmo com passos por ver.'));
    var bf = el('button', 'btn primary', 'Fechar a semana');
    bf.type = 'button';
    bf.addEventListener('click', function(){
      bf.disabled = true;
      apiGestao('/api/revisao/fechar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semana: rvSemana(), numeros: {
          caixa: caixa, contas: cc.length, atraso: atrasadas.length, parados: parados.length, proximos: prox.length, vistos: vistos } })
      }).then(function(d){
        RV.fechos = d.fechos || RV.fechos;
        if (typeof toast === 'function') toast('Semana fechada.');
        rvRender(); rvBanner();
      }).catch(function(e){ bf.disabled = false; if (typeof toast === 'function') toast(e.message || 'Não foi possível fechar a semana.'); });
    });
    fim.appendChild(bf);
  }
  sec.appendChild(fim);

  if ((RV.fechos || []).length){
    var h = el('div', 'rv-hist');
    h.appendChild(el('h3', null, 'Semanas fechadas'));
    var ul = el('ul');
    RV.fechos.slice(0, 6).forEach(function(f){
      var n = f.numeros || {};
      ul.appendChild(el('li', null, 'Semana de ' + rvCurta(f.semana) + ' — ' + [
        (n.atraso || 0) + ' em atraso', (n.contas || 0) + ' contas por acertar', (n.caixa || 0) + ' na caixa'].join(' · ')));
    });
    h.appendChild(ul);
    sec.appendChild(h);
  }
}

/* O aviso no Hoje: ao domingo, e a segunda se a semana ficou por fechar. */
function rvBanner(){
  var view = document.getElementById('view-hoje');
  if (!view) return;
  var ban = view.querySelector('.rv-banner');
  var dow = new Date().getDay();
  /* A revisao de domingo e do administrador: os outros veem a pagina, nao o aviso. */
  var admin = !!(window.MN && MN.admin);
  var mostrar = admin && document.body.classList.contains('mn-on') && RV.fechos !== null && (dow === 0 || dow === 1) && !rvFechada();
  var btn = document.querySelector('#nav button[data-view="revisao"]');
  if (btn) btn.classList.toggle('mn-tem', mostrar);
  if (!mostrar){ if (ban) ban.remove(); return; }
  if (ban) return;
  ban = el('div', 'rv-banner');
  var t = el('div');
  t.appendChild(el('b', null, dow === 0 ? 'Revisão da semana' : 'A semana ficou por fechar'));
  t.appendChild(document.createElement('br'));
  t.appendChild(el('span', null, 'Dez minutos: caixa, contas, atrasos, programas e o que vem aí.'));
  ban.appendChild(t);
  var b = el('button', 'btn primary', 'Começar');
  b.type = 'button';
  b.addEventListener('click', function(){ show('revisao'); });
  ban.appendChild(b);
  view.insertBefore(ban, view.firstChild);
}

function rvMontar(){
  if (document.getElementById('view-revisao')) return;
  rvEstilo();
  if (window.TITLES) TITLES.revisao = ['Revisão da semana', 'Dez minutos ao domingo'];
  var nav = document.getElementById('nav');
  if (nav && !nav.querySelector('[data-view="revisao"]')){
    var b = el('button');
    b.dataset.view = 'revisao';
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.6"/><path d="M4 4v4h4M12 8v4l3 2"/></svg>';
    b.appendChild(document.createTextNode(' Revisão'));
    nav.appendChild(b);
  }
  var sec = el('section', 'view');
  sec.id = 'view-revisao';
  var docs = document.getElementById('view-documentos');
  if (docs) docs.parentNode.insertBefore(sec, docs); else document.querySelector('main').appendChild(sec);
}

function rvLigar(){
  rvMontar();
  if (typeof window.show === 'function' && !window.show.rvEmbrulhado){
    var antes = window.show;
    var novo = function(v){
      var r = antes.apply(this, arguments);
      if (v === 'revisao'){ try { rvRender(); } catch (e) { console.error('[farol] revisao', e); } }
      return r;
    };
    for (var k in antes) if (Object.prototype.hasOwnProperty.call(antes, k)) novo[k] = antes[k];
    novo.rvEmbrulhado = true;
    window.show = novo;
  }
  ['renderAll', 'renderGestao'].forEach(function(nome){
    var f = window[nome];
    if (typeof f !== 'function' || f.rvEmbrulhado) return;
    var n = function(){
      var r = f.apply(this, arguments);
      try { rvBanner(); var s = document.getElementById('view-revisao'); if (s && s.classList.contains('is-active')) rvRender(); } catch (e) { console.error('[farol] revisao', e); }
      return r;
    };
    n.rvEmbrulhado = true;
    window[nome] = n;
  });
  /* O menu novo pode ligar-se depois: o aviso tem de esperar por ele. */
  if (window.MutationObserver){
    new MutationObserver(function(){ try { rvBanner(); } catch (e) {} })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  rvCarregar();
}

(function rvEsperar(n){
  if (document.getElementById('nav') && typeof el === 'function' && typeof show === 'function'){
    try { rvLigar(); } catch (e) { console.error('[farol] revisao', e); }
    return;
  }
  if (n < 60) setTimeout(function(){ rvEsperar(n + 1); }, 250);
})(0);
