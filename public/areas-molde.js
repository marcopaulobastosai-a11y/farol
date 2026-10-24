'use strict';
/* Farol - o molde comum das areas (fase 3 do menu novo, 24 out 2026).
 *
 * Os ecras das areas ja tinham quase tudo: filtros, numeros, tarefas,
 * projetos e as paginas da Agenda, das Despesas e dos Documentos. Faltava o
 * mesmo caminho em todas, e tres coisas que nao tinham sitio: os movimentos
 * do banco, as pessoas envolvidas e as notas. Isto poe, por cima de cada
 * area, a mesma fila de separadores:
 *
 *   Visao geral · Agenda · Despesas · Movimentos · Documentos · Pessoas · Notas
 *
 * e, na visao geral, os programas que tem projetos naquela area.
 *
 * Nao mexe no area-tarefas.js: embrulha o aeRenderArea. Agenda, Despesas e
 * Documentos continuam a ser as paginas de la (aeAbrirPagina); Movimentos,
 * Pessoas e Notas sao desenhadas aqui. So com o menu novo ligado.
 */

var MO = { pag: {}, movs: {} };

var MO_TABS = [
  ['geral', 'Visão geral'],
  ['agenda', 'Agenda'],
  ['despesas', 'Despesas'],
  ['movimentos', 'Movimentos'],
  ['documentos', 'Documentos'],
  ['pessoas', 'Pessoas'],
  ['notas', 'Notas']
];
var MO_DELA = { agenda: true, despesas: true, documentos: true };
var MO_PROPRIAS = { movimentos: true, pessoas: true, notas: true };
var MO_VIA = { movimento: 'marcado', despesa: 'pela despesa', projeto: 'pelo projeto', categoria: 'pela categoria', conta: 'pela conta' };

var MO_CSS = [
  '.mo-tabs{display:flex;gap:2px;overflow-x:auto;border-bottom:1px solid var(--line);margin:0 0 14px;scrollbar-width:none}',
  '.mo-tabs::-webkit-scrollbar{display:none}',
  '.mo-tabs button[role=tab]{font:inherit;font-size:.875rem;white-space:nowrap;padding:0 14px;min-height:42px;background:none;border:none;border-bottom:2px solid transparent;color:var(--muted);cursor:pointer}',
  '.mo-tabs button[role=tab]:hover{color:var(--ink)}',
  '.mo-tabs .mo-captar{margin:4px 0 6px auto;flex:none;min-height:36px;padding:0 14px;border-bottom:none;border-radius:10px}',
  '.mo-tabs button.on{color:var(--ink);font-weight:500;border-bottom-color:var(--accent)}',
  '.mo-progs{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 14px}',
  '.mo-progs .mo-l{font-family:var(--mono);font-size:.625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-right:2px}',
  '.mo-progs button{font:inherit;font-size:.8125rem;display:inline-flex;align-items:center;gap:8px;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}',
  '.mo-progs button:hover{border-color:var(--accent)}',
  '.mo-progs button b{font-family:var(--mono);font-size:.6875rem;font-weight:500;color:var(--muted)}',
  '.mo-pag header{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}',
  '.mo-pag .mo-sub{color:var(--muted);font-size:.8125rem;margin:2px 0 12px}',
  '.mo-tot{display:flex;gap:18px;flex-wrap:wrap;margin:0 0 12px;font-size:.8125rem;color:var(--muted)}',
  '.mo-tot b{display:block;font-family:var(--mono);font-size:1rem;font-weight:500;color:var(--ink)}',
  '.mo-tab{overflow-x:auto}',
  '.mo-tab table{width:100%;border-collapse:collapse;font-size:.8125rem;min-width:560px}',
  '.mo-tab th{text-align:left;font-weight:500;color:var(--muted);font-size:.75rem;padding:6px 8px;border-bottom:1px solid var(--line)}',
  '.mo-tab td{padding:8px;border-bottom:1px solid var(--line-soft);vertical-align:top}',
  '.mo-tab td.v{text-align:right;font-family:var(--mono);white-space:nowrap}',
  '.mo-tab td.v.ent{color:var(--good,#2f7d4f)}',
  '.mo-tab td small{display:block;color:var(--muted);font-size:.75rem}',
  '.mo-via{display:inline-block;font-size:.6875rem;padding:1px 7px;border-radius:999px;background:var(--line-soft);color:var(--muted);white-space:nowrap}',
  '.mo-pes{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}',
  '.mo-pes button{font:inherit;text-align:left;display:flex;gap:12px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);cursor:pointer;min-height:56px}',
  '.mo-pes button:hover{border-color:var(--accent)}',
  '.mo-av{width:36px;height:36px;border-radius:50%;flex:none;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-family:var(--mono);font-size:.75rem;overflow:hidden}',
  '.mo-av img{width:100%;height:100%;object-fit:cover}',
  '.mo-pes span.t{display:flex;flex-direction:column;gap:2px;min-width:0}',
  '.mo-pes span.t small{color:var(--muted);font-size:.75rem}',
  '.mo-notas{display:flex;flex-direction:column;gap:8px}',
  '.mo-notas button{font:inherit;text-align:left;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);cursor:pointer}',
  '.mo-notas button:hover{border-color:var(--accent)}',
  '.mo-notas small{display:block;color:var(--muted);font-size:.75rem;margin-top:4px;white-space:pre-line;max-height:3.2em;overflow:hidden}',
  '.mo-vazio{color:var(--muted);font-size:.875rem;margin:4px 0}'
].join('\n');

function moEstilo(){
  if (document.getElementById('moCss')) return;
  var st = document.createElement('style'); st.id = 'moCss'; st.textContent = MO_CSS;
  document.head.appendChild(st);
}
function moLigado(){ return document.body.classList.contains('mn-on'); }

/* As areas que o filtro «Onde» deixa ver, e a sub-area unica (se houver)
   para as paginas da area abrirem ja filtradas. */
function moAlvo(a){
  var area = aeArea(a);
  if (!area) return null;
  var subs = aeSubs(area);
  var f = aeF(a.view);
  var sel = (f.subs || []).filter(function(k){ return /^\d+$/.test(k) && subs.some(function(s){ return String(s.id) === k; }); }).map(Number);
  var geral = (f.subs || []).indexOf('geral') >= 0;
  var ids = sel.length || geral ? sel.concat(geral ? [area.id] : []) : [area.id].concat(subs.map(function(s){ return s.id; }));
  var um = sel.length === 1 && !geral ? sel[0] : null;
  var nome = um ? (subs.filter(function(s){ return s.id === um; })[0] || area).name : area.name;
  return { area: area, subs: subs, ids: ids, alvoId: um || area.id, nome: nome };
}

function moTabs(a, ativo){
  var bar = el('div', 'mo-tabs');
  bar.setAttribute('role', 'tablist');
  MO_TABS.forEach(function(t){
    var b = el('button', t[0] === ativo ? 'on' : '', t[1]);
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', t[0] === ativo ? 'true' : 'false');
    b.addEventListener('click', function(){ moIr(a, t[0]); });
    bar.appendChild(b);
  });
  /* + Captar aqui: a captura abre ja com esta area (ou a sub-area escolhida). */
  var alvo = moAlvo(a);
  if (alvo && typeof cpAbrir === 'function'){
    var c = el('button', 'btn primary mo-captar', '+ Captar aqui');
    c.type = 'button';
    c.title = 'Captar alguma coisa para ' + alvo.nome;
    c.dataset.ctx = alvo.alvoId; c.dataset.nome = alvo.nome;
    c.addEventListener('click', function(){ cpAbrir({ context_id: alvo.alvoId, nome: alvo.nome }); });
    bar.appendChild(c);
  }
  return bar;
}

function moIr(a, k){
  var alvo = moAlvo(a);
  if (MO_PROPRIAS[k]){
    MO.pag[a.view] = k;
    if (AE.pagina[a.view]){ AE.pagina[a.view] = null; if (typeof aeDevolverTudo === 'function') aeDevolverTudo(); }
    aeRenderArea(a);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  MO.pag[a.view] = null;
  if (MO_DELA[k]){ aeAbrirPagina(a, k, alvo ? alvo.alvoId : null); return; }
  if (AE.pagina[a.view]) aeSairPagina(a);
  else { aeRenderArea(a); window.scrollTo({ top: 0, behavior: 'smooth' }); }
}

/* Os programas com trabalho nesta area: o proprio programa arrumado aqui, ou
   um projeto dele que o esteja. */
function moProgramas(ids){
  var ps = (window.G && G.projects) || [];
  return ps.filter(function(p){
    if (p.tipo !== 'programa' || p.status === 'concluido' || p.status === 'arquivado') return false;
    if (ids.indexOf(p.context_id) >= 0) return true;
    return ps.some(function(f){ return f.parent_id === p.id && ids.indexOf(f.context_id) >= 0; });
  });
}
function moFaixaProgramas(ids){
  var progs = moProgramas(ids);
  if (!progs.length) return null;
  var row = el('div', 'mo-progs');
  row.appendChild(el('span', 'mo-l', 'Programas'));
  progs.forEach(function(p){
    var b = el('button');
    b.type = 'button';
    b.title = 'Abrir o programa nos Projetos';
    b.appendChild(el('span', null, p.name));
    var n = typeof pjAbertasDe === 'function' ? pjAbertasDe(p) : 0;
    if (n) b.appendChild(el('b', null, String(n)));
    b.addEventListener('click', function(){
      show('projetos');
      if (typeof pjEscolher === 'function') { try { pjEscolher('programa', p.id); } catch (e) {} }
    });
    row.appendChild(b);
  });
  return row;
}

/* ------------------------------- Movimentos ------------------------------- */
function moEuros(v){
  var n = Number(v || 0);
  return (typeof tfEuros === 'function') ? tfEuros(n) : n.toFixed(2).replace('.', ',') + ' €';
}
function moDataCurta(iso){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1].slice(2) : '';
}
function moPagMovimentos(a, card, alvo){
  var chave = alvo.ids.slice().sort(function(x, y){ return x - y; }).join(',');
  var c = MO.movs[chave];
  var velho = !c || (!c.aLer && Date.now() - c.em > 60000);
  if (velho){
    MO.movs[chave] = { em: c ? c.em : 0, aLer: true, lista: c ? c.lista : null };
    apiGestao('/api/financas/movimentos-area?ids=' + chave + '&limite=300')
      .then(function(d){ MO.movs[chave] = { em: Date.now(), lista: d.movimentos || [] }; })
      .catch(function(){ MO.movs[chave] = { em: Date.now(), lista: [], erro: true }; })
      .then(function(){ if (MO.pag[a.view] === 'movimentos' && moLigado()) aeRenderArea(a); });
  }
  c = MO.movs[chave];
  if (!c.lista){ card.appendChild(el('p', 'mo-vazio', 'A ler os movimentos…')); return; }
  var lista = c.lista || [];
  if (c.erro){ card.appendChild(el('p', 'mo-vazio', 'Não foi possível ler os movimentos.')); return; }
  card.appendChild(el('p', 'mo-sub', 'Os movimentos do banco que pertencem a esta área — marcados nela, ou ligados por uma despesa, um projeto ou a categoria. Os 300 mais recentes.'));
  if (typeof amAviso === 'function') card.appendChild(amAviso(function(){ MO.movs = {}; if (MO.pag[a.view] === 'movimentos' && moLigado()) aeRenderArea(a); }));
  if (!lista.length){ card.appendChild(el('p', 'mo-vazio', 'Nenhum movimento ligado a esta área.')); }
  else {
    var ent = 0, sai = 0;
    lista.forEach(function(m){ var v = Number(m.valor || 0); if (v > 0) ent += v; else sai += v; });
    var tot = el('div', 'mo-tot');
    [['Movimentos', String(lista.length)], ['Entradas', moEuros(ent)], ['Saídas', moEuros(-sai)]].forEach(function(x){
      var d = el('div'); d.appendChild(el('b', null, x[1])); d.appendChild(document.createTextNode(x[0])); tot.appendChild(d);
    });
    card.appendChild(tot);
    var wrap = el('div', 'mo-tab');
    var t = el('table');
    var th = el('thead'); var tr = el('tr');
    ['Data', 'Movimento', 'Categoria', 'Conta', 'Porquê', 'Valor'].forEach(function(h){ tr.appendChild(el('th', null, h)); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el('tbody');
    lista.forEach(function(m){
      var r = el('tr');
      r.appendChild(el('td', null, moDataCurta(m.data)));
      var td = el('td', null, m.titulo || m.descricao || '');
      if (m.entidade) td.appendChild(el('small', null, m.entidade));
      r.appendChild(td);
      r.appendChild(el('td', null, m.categoria || '—'));
      r.appendChild(el('td', null, m.conta || ''));
      var tv = el('td'); tv.appendChild(el('span', 'mo-via', MO_VIA[m.via] || m.via || '')); r.appendChild(tv);
      r.appendChild(el('td', 'v' + (Number(m.valor) > 0 ? ' ent' : ''), moEuros(m.valor)));
      tb.appendChild(r);
    });
    t.appendChild(tb); wrap.appendChild(t); card.appendChild(wrap);
  }
}

/* ------------------------------- Pessoas ------------------------------- */
function moPessoa(id){ return ((window.G && G.people) || []).filter(function(p){ return p.id === id; })[0] || null; }
function moPagPessoas(a, card, alvo){
  var ids = alvo.ids;
  var conta = {};
  function soma(pid, k){
    if (pid == null) return;
    if (!conta[pid]) conta[pid] = { tarefas: 0, eventos: 0, docs: 0, projetos: 0 };
    conta[pid][k]++;
  }
  ((window.G && G.tasks) || []).forEach(function(t){
    if (t.parent_id || !aeAberta(t) || ids.indexOf(aeCtxT(t)) < 0) return;
    soma(t.owner_id, 'tarefas');
    (t.subjects || []).forEach(function(s){ if (s !== t.owner_id) soma(s, 'tarefas'); });
  });
  var hoje = typeof tfISO === 'function' ? tfISO(tfHoje()) : '';
  ((window.D && D.events) || []).forEach(function(e){
    if (ids.indexOf(e.context_id) < 0 || (hoje && e.day < hoje)) return;
    (e.pessoas || []).forEach(function(p){ soma(p, 'eventos'); });
  });
  ((window.D && D.documents) || []).forEach(function(d){ if (ids.indexOf(d.context_id) >= 0) soma(d.person_id, 'docs'); });
  ((window.G && G.projects) || []).forEach(function(p){
    if (p.status === 'concluido' || ids.indexOf(p.context_id) < 0) return;
    (p.members || []).forEach(function(m){ soma(m.person_id, 'projetos'); });
  });
  card.appendChild(el('p', 'mo-sub', 'Quem tem alguma coisa nesta área: tarefas (como responsável ou por causa de quem), eventos que vêm aí, documentos e projetos. Abre a ficha da pessoa.'));
  var lista = Object.keys(conta).map(Number).map(function(id){ return { p: moPessoa(id), n: conta[id] }; })
    .filter(function(x){ return x.p; })
    .sort(function(x, y){ return (x.p.sort || 0) - (y.p.sort || 0); });
  if (!lista.length){ card.appendChild(el('p', 'mo-vazio', 'Ninguém marcado em nada desta área.')); return; }
  var g = el('div', 'mo-pes');
  lista.forEach(function(x){
    var b = el('button');
    b.type = 'button';
    b.dataset.ficha = x.p.id;
    var av = el('span', 'mo-av');
    av.style.background = x.p.color || 'var(--c1)';
    if (typeof aeTemFoto === 'function' && aeTemFoto(x.p.id)){
      var img = el('img'); img.alt = ''; img.src = '/api/pessoas/' + x.p.id + '/avatar'; av.appendChild(img);
    } else av.textContent = x.p.initials || (x.p.name || '?').slice(0, 2).toUpperCase();
    b.appendChild(av);
    var t = el('span', 't');
    t.appendChild(el('b', null, x.p.name));
    var partes = [];
    if (x.n.tarefas) partes.push(x.n.tarefas + (x.n.tarefas === 1 ? ' tarefa' : ' tarefas'));
    if (x.n.eventos) partes.push(x.n.eventos + (x.n.eventos === 1 ? ' evento' : ' eventos'));
    if (x.n.docs) partes.push(x.n.docs + (x.n.docs === 1 ? ' documento' : ' documentos'));
    if (x.n.projetos) partes.push(x.n.projetos + (x.n.projetos === 1 ? ' projeto' : ' projetos'));
    t.appendChild(el('small', null, partes.join(' · ')));
    b.appendChild(t);
    g.appendChild(b);
  });
  card.appendChild(g);
}

/* ------------------------------- Notas ------------------------------- */
function moPagNotas(a, card, alvo){
  var notas = ((window.G && G.tasks) || []).filter(function(t){
    return !t.parent_id && t.status !== 'cancelada' && tfTipo(t) === 'nota' && alvo.ids.indexOf(aeCtxT(t)) >= 0;
  }).sort(function(x, y){ return String(y.updated_at || y.created_at || '').localeCompare(String(x.updated_at || x.created_at || '')); });
  card.appendChild(el('p', 'mo-sub', 'As notas arrumadas nesta área. Escrevem-se com o + Captar ou nas Tarefas › Notas.'));
  if (!notas.length){ card.appendChild(el('p', 'mo-vazio', 'Nenhuma nota nesta área.')); return; }
  var box = el('div', 'mo-notas');
  notas.forEach(function(t){
    var b = el('button');
    b.type = 'button';
    b.appendChild(el('b', null, t.title));
    if (t.notes) b.appendChild(el('small', null, String(t.notes).slice(0, 240)));
    b.addEventListener('click', function(){ aeAbrirTarefa(t); });
    box.appendChild(b);
  });
  card.appendChild(box);
}

function moCabeca(titulo, nome){
  var h = el('header');
  h.appendChild(el('h3', null, titulo));
  h.appendChild(el('span', 'mono', nome));
  return h;
}

function moPagina(a, box, k){
  var alvo = moAlvo(a);
  clear(box);
  box.appendChild(moTabs(a, k));
  if (!alvo) return;
  var card = el('div', 'card mo-pag');
  var titulo = MO_TABS.filter(function(t){ return t[0] === k; })[0][1];
  card.appendChild(moCabeca(titulo, alvo.nome));
  box.appendChild(card);
  if (k === 'movimentos') moPagMovimentos(a, card, alvo);
  else if (k === 'pessoas') moPagPessoas(a, card, alvo);
  else if (k === 'notas') moPagNotas(a, card, alvo);
}

/* --------------------------- o embrulho --------------------------- */
function moEmbrulhar(){
  if (typeof window.aeRenderArea !== 'function' || window.aeRenderArea.moEmbrulhado) return false;
  var antes = window.aeRenderArea;
  var novo = function(a){
    if (!moLigado()) return antes.apply(this, arguments);
    moEstilo();
    var k = MO.pag[a.view];
    var box = typeof aeCaixa === 'function' ? aeCaixa(a) : null;
    if (k && MO_PROPRIAS[k] && box && aeArea(a)){
      try { moPagina(a, box, k); } catch (e) { console.error('[farol] molde ' + a.view, e); }
      return;
    }
    var r = antes.apply(this, arguments);
    try {
      if (box && aeArea(a)){
        var ativo = AE.pagina[a.view] || 'geral';
        box.insertBefore(moTabs(a, ativo), box.firstChild);
        if (ativo === 'geral'){
          var alvo = moAlvo(a);
          var fx = alvo ? moFaixaProgramas(alvo.ids) : null;
          if (fx) box.insertBefore(fx, box.children[1] || null);
        }
      }
    } catch (e) { console.error('[farol] molde ' + a.view, e); }
    return r;
  };
  novo.moEmbrulhado = true;
  window.aeRenderArea = novo;
  return true;
}

/* O menu novo pode ligar-se depois de as areas estarem desenhadas (so se
   sabe quem e o administrador depois do /api/me): redesenha-se entao. */
var MO_ON = null;
if (window.MutationObserver){
  new MutationObserver(function(){
    var on = moLigado();
    if (on === MO_ON) return;
    MO_ON = on;
    if (window.aeRenderArea && window.aeRenderArea.moEmbrulhado && typeof aeRender === 'function'){
      try { aeRender(); } catch (e) { console.error('[farol] molde: redesenhar', e); }
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

/* Quando se muda de area pelo menu, comeca-se pela visao geral. */
document.addEventListener('click', function(e){
  var b = e.target.closest && e.target.closest('#nav button[data-view]');
  if (b && MO.pag[b.dataset.view]) MO.pag[b.dataset.view] = null;
}, true);

(function moEsperar(n){
  if (typeof aeRenderArea === 'function' && typeof aeArea === 'function' && typeof el === 'function'){
    if (moEmbrulhar() && typeof aeRender === 'function'){
      try { aeRender(); } catch (e) { console.error('[farol] molde: redesenhar', e); }
    }
    return;
  }
  if (n < 60) setTimeout(function(){ moEsperar(n + 1); }, 250);
})(0);
