'use strict';
/* Farol - o que cada area tem por fazer.
 *
 * A regra do farol-organizacao.md: a coisa fica na area, o trabalho sobre a
 * coisa fica no projeto. Faltava a outra metade - a area mostrar o que e
 * dela. As tarefas soltas (sem projeto) sao a operacao corrente: o ordenado
 * da loja, a renda da casa, o IUC. Viviam so na lista das Tarefas, e os ecras
 * das areas diziam «ainda nao ha nada aqui» por cima de dezenas delas.
 *
 * Cada ecra de area passa a ter:
 *   - no topo, um filtro por sub-area (Tudo, Cupula Arejada, Falua
 *     Vibrante...) e os numeros do que esta escolhido;
 *   - «Pagamentos» e «Tarefas»: as tarefas abertas que NAO pertencem a
 *     projeto nenhum, com os documentos agarrados a cada uma a vista. As de
 *     projeto vivem no projeto e nao se repetem aqui;
 *   - «Projetos»: uma linha por projeto aberto, que leva a ele;
 *   - «Documentos»: os papeis arrumados na area, por sub-area, e os que sao
 *     da area sem sub-area em «geral».
 * Na vista de tudo, cada cartao vem partido por sub-area.
 *
 * Pagar a partir daqui abre a janela do pagamento aqui mesmo (tfPopPagar),
 * sem saltar para as Tarefas.
 *
 * Profissional e Patrimonio eram areas sem ecra: nascem aqui, com botao no
 * menu. Como os outros modulos, nao toca no app.js.
 */

var AE_AREAS = [
  { view: 'familia', nome: 'familia' },
  { view: 'casa', nome: 'casa' },
  { view: 'financas', nome: 'financas' },
  { view: 'saude', nome: 'saude' },
  { view: 'profissional', nome: 'profissional', novo: true, titulo: 'Profissional',
    sub: 'Operação corrente das empresas, do trabalho e do MBA',
    icone: '<rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M3.5 12h17"/>' },
  { view: 'patrimonio', nome: 'patrimonio', novo: true, titulo: 'Património',
    sub: 'Bens que se gerem: imóveis, carro, terreno',
    icone: '<path d="M3 20h18"/><path d="M5 20V10l7-5 7 5v10"/><path d="M9 20v-5h6v5"/><path d="M12 9.5v.01"/>' }
];

var AE_CSS =
  '.ae{margin-bottom:14px}' +
  '.ae-top{display:flex;align-items:center;gap:12px 16px;flex-wrap:wrap}' +
  '.ae-top .tabs{margin-bottom:0;flex-wrap:wrap}' +
  '.ae-top .tabs button{display:inline-flex;align-items:center;gap:6px}' +
  '.ae-top .tabs button small{font-family:var(--mono);font-size:.68rem;color:var(--faint)}' +
  '.ae-top .tabs button small.bad{color:var(--bad)}' +
  '.ae-kpi{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:.78rem;color:var(--muted)}' +
  '.ae-kpi b{font-family:var(--mono);font-weight:500;color:var(--ink);font-variant-numeric:tabular-nums}' +
  '.ae-kpi b.bad{color:var(--bad)}' +
  '.ae-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}' +
  '@media (max-width:980px){.ae-cols{grid-template-columns:minmax(0,1fr)}}' +
  '.ae-grp{margin-top:6px}' +
  '.ae-grp + .ae-grp{margin-top:14px}' +
  '.ae-grp > h4{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted);padding:4px 2px;font-weight:500;display:flex;gap:8px}' +
  '.ae-grp > h4 span{color:var(--faint)}' +
  '.ae-vazio{color:var(--muted);font-size:.875rem;padding:.5rem 0}' +
  '.ae-nota{color:var(--muted);font-size:.78rem;margin-top:10px}' +
  '.ae-docs-t{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px;font-size:.72rem}' +
  '.ae-docs-t > a,.ae-docs-t > span{color:var(--accent-ink);text-decoration:none;display:inline-flex;align-items:center;gap:4px;max-width:100%}' +
  '.ae-docs-t a:hover{text-decoration:underline}' +
  '.ae-docs-t em{font-style:normal;color:var(--muted)}' +
  '.ae-docs-t > * span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}' +
  '.ae-pj,.ae-doc{display:flex;align-items:baseline;gap:10px;padding:8px;border-top:1px solid var(--line-soft);border-radius:8px}' +
  '.ae-pj{cursor:pointer}' +
  '.ae-pj:first-of-type,.ae-doc:first-of-type{border-top-color:transparent}' +
  '.ae-pj:hover,.ae-doc:hover{background:var(--surface-2)}' +
  '.ae-pj b,.ae-doc b{font-weight:500;font-size:.875rem;color:var(--ink)}' +
  '.ae-doc a{color:var(--ink);text-decoration:none}' +
  '.ae-doc a:hover{color:var(--accent-ink);text-decoration:underline}' +
  '.ae-pj small,.ae-doc small{color:var(--muted);font-size:.72rem}' +
  '.ae-doc small.uso{color:var(--accent-ink)}' +
  '.ae-pj .mono,.ae-doc .mono{margin-left:auto;white-space:nowrap}' +
  '.ae-mais{margin-top:8px}';

var AE = { filtro: {} };
try { AE.filtro = JSON.parse(localStorage.getItem('aeFiltro') || '{}') || {}; } catch (e) { AE.filtro = {}; }
function aeGuardarFiltro(){ try { localStorage.setItem('aeFiltro', JSON.stringify(AE.filtro)); } catch (e) {} }

var AE_CLIPE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>';

function aeNorm(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

/* A area de topo de um ecra, encontrada pelo nome e nao pelo id: os ids sao
   da base de producao e o repositorio e publico. */
function aeArea(a){
  var cs = (window.G && G.contextos) || [];
  for (var i = 0; i < cs.length; i++){
    if (!cs[i].parent_id && aeNorm(cs[i].name).indexOf(a.nome) === 0) return cs[i];
  }
  return null;
}
function aeSubs(area){
  return ((G && G.contextos) || []).filter(function(c){ return c.parent_id === area.id; });
}
function aeAberta(t){ return t.status !== 'concluida' && t.status !== 'cancelada'; }

function aeMontar(){
  if (document.getElementById('aeCss')) return;
  var st = document.createElement('style'); st.id = 'aeCss'; st.textContent = AE_CSS;
  document.head.appendChild(st);

  var nav = document.getElementById('nav');
  var docsBtn = nav && nav.querySelector('button[data-view="documentos"]');
  var docsView = document.getElementById('view-documentos');
  AE_AREAS.forEach(function(a){
    if (!a.novo || document.getElementById('view-' + a.view)) return;
    TITLES[a.view] = [a.titulo, a.sub];
    var b = document.createElement('button');
    b.dataset.view = a.view;
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' + a.icone + '</svg>';
    b.appendChild(document.createTextNode(' ' + a.titulo));
    if (nav) nav.insertBefore(b, docsBtn || null);
    var sec = el('section', 'view'); sec.id = 'view-' + a.view;
    if (docsView) docsView.parentNode.insertBefore(sec, docsView);
    else document.querySelector('main').appendChild(sec);
  });

  /* A Familia tinha um cartao a prometer que isto ainda nao existia. */
  var fam = document.getElementById('view-familia');
  if (fam){
    fam.querySelectorAll('.card').forEach(function(c){
      var h = c.querySelector('header h3');
      if (h && /Tarefas, apoio e datas/.test(h.textContent)) c.remove();
    });
  }
}

/* Onde o bloco vai morar em cada ecra. Na Familia fica na coluna da direita,
   no sitio do cartao que dizia «ainda nao ha nada aqui»; nos outros, no topo. */
function aeCaixa(a){
  var id = 'ae-' + a.view;
  var box = document.getElementById(id);
  if (box) return box;
  var sec = document.getElementById('view-' + a.view);
  if (!sec) return null;
  box = el('div', 'stack ae'); box.id = id;
  var alvo = sec;
  if (a.view === 'familia'){
    var cols = sec.querySelectorAll('.grid.split > .stack');
    if (cols[1]) alvo = cols[1];
  }
  alvo.insertBefore(box, alvo.firstChild);
  return box;
}

function aeDoc(id){
  var ds = (window.D && D.documents) || [];
  for (var i = 0; i < ds.length; i++) if (ds[i].id === id) return ds[i];
  return null;
}
function aeFicheiro(d){
  var f = (d.ficheiros && d.ficheiros.length) ? d.ficheiros[0] : d.inbox_id;
  return f ? '/api/inbox/' + f + '/ficheiro' : null;
}

/* Os papeis agarrados a tarefa, a vista na linha: fatura, comprovativo,
   recibo. Abrem o ficheiro sem abrir a tarefa. */
function aeDocsDaTarefa(t){
  var ps = t.papeis || [];
  if (!ps.length) return null;
  var box = el('div', 'ae-docs-t');
  ps.forEach(function(pp){
    var d = aeDoc(pp.id);
    var nome = d ? d.name : 'documento';
    var url = d ? aeFicheiro(d) : null;
    var a = el(url ? 'a' : 'span');
    if (url){ a.href = url; a.target = '_blank'; a.rel = 'noopener'; }
    a.innerHTML = AE_CLIPE;
    if (pp.papel && pp.papel !== 'anexo') a.appendChild(el('em', null, pp.papel));
    a.appendChild(el('span', null, nome));
    a.title = (pp.papel && pp.papel !== 'anexo' ? pp.papel + ': ' : '') + nome;
    a.addEventListener('click', function(e){ e.stopPropagation(); });
    box.appendChild(a);
  });
  return box;
}

function aeLinha(t){
  var li = el('div', 'tf-row');
  var caixa = tfCaixa(t, function(){
    /* Um pagamento fecha-se com valor e prova, e a janela abre aqui mesmo,
       por cima da area: ir para as Tarefas fazia perder o sitio. */
    if (tfTipo(t) === 'pagamento' && !tfFechada(t)){
      caixa.dataset.tfpop = '1';
      return tfPopPagar(tfPorId(t.id) || t, caixa);
    }
    tfAlternar(t);
  });
  li.appendChild(caixa);
  var corpo = el('div', 'tf-body');
  corpo.appendChild(el('span', 'tf-t', t.title));
  var m = el('div', 'tf-m');
  var dono = pessoa(t.owner_id);
  if (dono){
    var d = el('span'); var dot = el('i', 'dot'); dot.style.background = dono.color || 'var(--c1)';
    d.appendChild(dot); d.appendChild(document.createTextNode(dono.name)); m.appendChild(d);
  }
  (t.subjects || []).forEach(function(pid){ var p = pessoa(pid); if (p) m.appendChild(el('span', null, '→ ' + p.name)); });
  if (tfTipo(t) === 'pagamento' && t.payee) m.appendChild(el('span', null, t.payee));
  if (tfTipo(t) === 'lembrete') m.appendChild(el('span', null, 'lembrete'));
  if (t.repeat_rule){
    var r = el('span'); r.innerHTML = tfSvg(TF_I.rep, 11);
    r.appendChild(document.createTextNode(t.repeat_label || 'repete'));
    m.appendChild(r);
  }
  if (tfSemProva(t)) m.appendChild(pill('falta comprovativo', 'warn'));
  if (m.childNodes.length) corpo.appendChild(m);
  var dt = aeDocsDaTarefa(t);
  if (dt) corpo.appendChild(dt);
  li.appendChild(corpo);
  if (tfTipo(t) === 'pagamento' && t.amount) li.appendChild(el('div', 'tf-val', tfEuros(t.amount)));
  li.appendChild(el('div', 'tf-r ' + tfNivelData(t), tfDataTxt(t.due_on, t.due_time)));
  li.addEventListener('click', function(){
    if (typeof avAbrir === 'function') avAbrir({ origem: 'tarefa', id: t.id, quando: t.due_on || null, detail: areaNome(t.context_id) });
    else { show('tarefas'); tfAbrir(t.id); }
  });
  return li;
}

function aeOrdem(a, b){
  if (a.due_on && b.due_on && a.due_on !== b.due_on) return a.due_on < b.due_on ? -1 : 1;
  if (!!a.due_on !== !!b.due_on) return a.due_on ? -1 : 1;
  return String(a.title).localeCompare(String(b.title), 'pt');
}

/* Uma lista de tarefas num cartao. Com o filtro em «Tudo» vem partida por
   sub-area; com uma sub-area escolhida, os cabecalhos so repetiam o filtro. */
function aeCartaoTarefas(titulo, lista, grupos, area, vazio){
  var card = el('div', 'card');
  var h = el('header');
  h.appendChild(el('h3', null, titulo));
  var atr = lista.filter(function(t){ return tfNivelData(t) === 'bad'; }).length;
  h.appendChild(el('span', 'mono', lista.length ? lista.length + (atr ? ' · ' + atr + ' em atraso' : '') : ''));
  card.appendChild(h);
  if (!lista.length){ card.appendChild(el('p', 'ae-vazio', vazio)); return card; }
  /* As sub-areas primeiro; o que e da area sem sub-area fica no fim. */
  var ordem = grupos.filter(function(c){ return c.id !== area.id; })
    .concat(grupos.filter(function(c){ return c.id === area.id; }));
  var gs = ordem.map(function(g){ return { c: g, lista: lista.filter(function(t){ return t.context_id === g.id; }) }; })
    .filter(function(g){ return g.lista.length; });
  var cabecas = grupos.length > 1;
  gs.forEach(function(g){
    var gr = el('div', 'ae-grp');
    if (cabecas){
      var h4 = el('h4', null, g.c.id === area.id ? area.name + ' · geral' : g.c.name);
      h4.appendChild(el('span', null, String(g.lista.length)));
      gr.appendChild(h4);
    }
    var rows = el('div', 'tf-rows');
    g.lista.sort(aeOrdem).forEach(function(t){ rows.appendChild(aeLinha(t)); });
    gr.appendChild(rows);
    card.appendChild(gr);
  });
  return card;
}

function aeLinhaDoc(d, filhos){
  var r = el('div', 'ae-doc');
  var g = el('div');
  var url = aeFicheiro(d);
  var nome = el(url ? 'a' : 'b', null, d.name);
  if (url){ nome.href = url; nome.target = '_blank'; nome.rel = 'noopener'; nome.style.fontWeight = '500'; nome.style.fontSize = '.875rem'; }
  g.appendChild(nome);
  var sub = [d.kind, d.entity].filter(Boolean).join(' · ');
  if (!url) sub = (sub ? sub + ' · ' : '') + 'sem ficheiro';
  if (sub){ g.appendChild(document.createElement('br')); g.appendChild(el('small', null, sub)); }
  var usos = typeof tfUsosDoc === 'function' ? tfUsosDoc(d) : (d.tarefas || []);
  if (usos.length){
    g.appendChild(document.createElement('br'));
    g.appendChild(el('small', 'uso', '↳ ' + (usos[0].papel && usos[0].papel !== 'anexo' ? usos[0].papel + ' de ' : '') +
      '«' + usos[0].title + '»' + (usos.length > 1 ? ' e mais ' + (usos.length - 1) : '')));
  }
  /* Comprovativo e recibo do mesmo pagamento, pendurados na fatura. */
  (filhos || []).forEach(function(f){
    g.appendChild(document.createElement('br'));
    var url2 = aeFicheiro(f.d);
    var sm = el('small', null, '↳ ' + f.papel + ': ');
    var n2 = el(url2 ? 'a' : 'span', null, f.d.name);
    if (url2){ n2.href = url2; n2.target = '_blank'; n2.rel = 'noopener'; n2.style.color = 'var(--accent-ink)'; }
    sm.appendChild(n2);
    g.appendChild(sm);
  });
  r.appendChild(g);
  var dt = d.valid_on || d.issued_on;
  if (dt) r.appendChild(el('span', 'mono', (d.valid_on ? 'até ' : '') + (typeof tfDataCurta === 'function' ? tfDataCurta(dt) : dt)));
  return r;
}

/* Os documentos da area. Na vista de tudo vem arrumados por sub-area, e os
   que sao da area sem sub-area nenhuma ficam no fim, em «geral». */
function aeCartaoDocs(docs, area, grupos){
  var card = el('div', 'card');
  var h = el('header');
  h.appendChild(el('h3', null, 'Documentos'));
  h.appendChild(el('span', 'mono', docs.length ? String(docs.length) : ''));
  card.appendChild(h);
  if (!window.D || !D.documents){ card.appendChild(el('p', 'ae-vazio', 'A ler os documentos…')); return card; }
  if (!docs.length){ card.appendChild(el('p', 'ae-vazio', 'Nenhum documento arrumado aqui.')); return card; }
  /* Os papeis de um pagamento contam como um: o comprovativo e o recibo vao
     dentro da fatura (docsConjuntos, no app.js). */
  var CJ = typeof docsConjuntos === 'function' ? docsConjuntos() : { filhos: {}, pendurado: {} };
  var aqui = {};
  docs.forEach(function(d){ aqui[d.id] = true; });
  docs = docs.filter(function(d){
    var cabs = CJ.pendurado[d.id];
    return !(cabs && cabs.some(function(c){ return aqui[c]; }));
  });
  var ordem = grupos.filter(function(c){ return c.id !== area.id; })
    .concat(grupos.filter(function(c){ return c.id === area.id; }));
  var gs = ordem.map(function(c){ return { c: c, lista: docs.filter(function(d){ return d.context_id === c.id; }) }; })
    .filter(function(g){ return g.lista.length; });
  var cabecas = grupos.length > 1;
  var MAX = cabecas ? 5 : 10, cortados = 0;
  gs.forEach(function(g){
    var gr = el('div', 'ae-grp');
    if (cabecas){
      var h4 = el('h4', null, g.c.id === area.id ? area.name + ' · geral' : g.c.name);
      h4.appendChild(el('span', null, String(g.lista.length)));
      gr.appendChild(h4);
    }
    g.lista.slice(0, MAX).forEach(function(d){ gr.appendChild(aeLinhaDoc(d, CJ.filhos[d.id])); });
    if (g.lista.length > MAX){
      cortados += g.lista.length - MAX;
      gr.appendChild(el('p', 'ae-nota', 'e mais ' + (g.lista.length - MAX) + '.'));
    }
    card.appendChild(gr);
  });
  var b = el('button', 'btn small ae-mais', cortados ? 'Ver todos nos Documentos' : 'Abrir os Documentos');
  b.type = 'button';
  b.addEventListener('click', function(){ show('documentos'); });
  card.appendChild(b);
  return card;
}

function aeCtx(id){
  var cs = (window.G && G.contextos) || [];
  for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
  return null;
}

function aeRenderArea(a){
  var box = aeCaixa(a);
  if (!box) return;
  clear(box);
  var area = aeArea(a);
  if (!area) return;
  var subs = aeSubs(area);
  var todos = [area].concat(subs);
  var idsTodos = todos.map(function(c){ return c.id; });

  var abertas = (G.tasks || []).filter(function(t){
    return aeAberta(t) && !t.parent_id && !t.project_id && idsTodos.indexOf(t.context_id) >= 0;
  });
  var pjsTodos = (G.projects || []).filter(function(p){
    return p.tipo !== 'programa' && p.status !== 'concluido' && idsTodos.indexOf(p.context_id) >= 0;
  });

  /* O filtro: Tudo, cada sub-area, e «Geral» so quando a area tem coisas
     suas. Um filtro guardado que deixou de existir volta a Tudo. */
  var f = AE.filtro[a.view] || 'tudo';
  var opcoes = [];
  if (subs.length){
    opcoes.push({ k: 'tudo', nome: 'Tudo', ids: idsTodos });
    subs.forEach(function(s){ opcoes.push({ k: String(s.id), nome: s.name, ids: [s.id] }); });
    var temGeral = abertas.some(function(t){ return t.context_id === area.id; }) ||
      pjsTodos.some(function(p){ return p.context_id === area.id; }) ||
      ((window.D && D.documents) || []).some(function(d){ return d.context_id === area.id; });
    if (temGeral) opcoes.push({ k: 'geral', nome: 'Geral', ids: [area.id] });
  }
  var sel = opcoes.filter(function(o){ return o.k === f; })[0] || opcoes[0] || { k: 'tudo', ids: idsTodos };
  var ids = sel.ids, tudo = sel.k === 'tudo';
  var grupos = todos.filter(function(c){ return ids.indexOf(c.id) >= 0; });

  var soltas = abertas.filter(function(t){ return ids.indexOf(t.context_id) >= 0; });
  var notas = soltas.filter(function(t){ return tfTipo(t) === 'nota'; }).length;
  soltas = soltas.filter(function(t){ return tfTipo(t) !== 'nota'; });
  var pags = soltas.filter(function(t){ return tfTipo(t) === 'pagamento'; });
  var outras = soltas.filter(function(t){ return tfTipo(t) !== 'pagamento'; });
  var pjs = pjsTodos.filter(function(p){ return ids.indexOf(p.context_id) >= 0; });
  var docs = ((window.D && D.documents) || []).filter(function(d){ return ids.indexOf(d.context_id) >= 0; });

  /* Topo: o filtro e os numeros do que esta escolhido. */
  var top = el('div', 'ae-top');
  if (opcoes.length){
    var tabs = el('div', 'tabs');
    opcoes.forEach(function(o){
      var b = el('button', o.k === sel.k ? 'is-active' : '');
      b.type = 'button';
      b.appendChild(document.createTextNode(o.nome));
      var n = abertas.filter(function(t){ return tfTipo(t) !== 'nota' && o.ids.indexOf(t.context_id) >= 0; });
      var atr = n.filter(function(t){ return tfNivelData(t) === 'bad'; }).length;
      if (n.length){
        var sm = el('small', atr ? 'bad' : '', String(n.length));
        if (atr) sm.title = atr + ' em atraso';
        b.appendChild(sm);
      }
      /* Desenhar so depois: o app.js tem um ouvinte geral para os .tabs que
         ainda vai olhar para este botao, e ele tem de continuar na pagina. */
      b.addEventListener('click', function(){ AE.filtro[a.view] = o.k; aeGuardarFiltro(); setTimeout(function(){ aeRenderArea(a); }, 0); });
      tabs.appendChild(b);
    });
    top.appendChild(tabs);
  }
  var kpi = el('div', 'ae-kpi');
  function num(v, txt, cls){ var s = el('span'); s.appendChild(el('b', cls || '', v)); s.appendChild(document.createTextNode(' ' + txt)); kpi.appendChild(s); }
  var atrasadas = soltas.filter(function(t){ return tfNivelData(t) === 'bad'; }).length;
  var h = tfHoje(), fimMes = tfISO(new Date(h.getFullYear(), h.getMonth() + 1, 0));
  var aPagar = pags.filter(function(t){ return t.amount && t.due_on && t.due_on <= fimMes; })
    .reduce(function(s, t){ return s + Number(t.amount); }, 0);
  num(String(soltas.length), 'por fazer');
  if (atrasadas) num(String(atrasadas), 'em atraso', 'bad');
  if (aPagar) num(tfEuros(aPagar), 'a pagar até ao fim do mês');
  num(String(pjs.length), pjs.length === 1 ? 'projeto' : 'projetos');
  num(String(docs.length), docs.length === 1 ? 'documento' : 'documentos');
  top.appendChild(kpi);
  box.appendChild(top);

  var cols = el('div', 'ae-cols');
  cols.appendChild(aeCartaoTarefas('Pagamentos', pags, grupos, area, 'Nenhum pagamento por fazer.'));
  var ct = aeCartaoTarefas('Tarefas', outras, grupos, area, 'Nada por fazer fora dos projetos.');
  if (notas) ct.appendChild(el('p', 'ae-nota', notas + (notas === 1 ? ' nota' : ' notas') + ' nas Tarefas › Notas.'));
  cols.appendChild(ct);
  box.appendChild(cols);

  var cols2 = el('div', 'ae-cols');
  /* Os projetos: so a linha, o trabalho vive la. */
  var cp = el('div', 'card');
  var hp = el('header');
  hp.appendChild(el('h3', null, 'Projetos'));
  hp.appendChild(el('span', 'mono', pjs.length ? String(pjs.length) : ''));
  cp.appendChild(hp);
  if (!pjs.length) cp.appendChild(el('p', 'ae-vazio', 'Nenhum projeto aberto aqui.'));
  pjs.forEach(function(p){
    var r = el('div', 'ae-pj');
    var g = el('div');
    g.appendChild(el('b', null, p.name));
    var pai = p.parent_id ? projeto(p.parent_id) : null;
    var sub = [pai ? pai.name : null, tudo ? areaNome(p.context_id) : null, p.status === 'planeado' ? 'planeado' : null]
      .filter(Boolean).join(' · ');
    if (sub){ g.appendChild(document.createElement('br')); g.appendChild(el('small', null, sub)); }
    r.appendChild(g);
    var c = p.contagem || {};
    r.appendChild(el('span', 'mono', (c.abertas || 0) + ' por fazer' + (c.atrasadas ? ' · ' + c.atrasadas + ' em atraso' : '')));
    r.addEventListener('click', function(){ if (typeof pjAbrir === 'function') pjAbrir(p.id); else show('projetos'); });
    cp.appendChild(r);
  });
  cols2.appendChild(cp);
  cols2.appendChild(aeCartaoDocs(docs, area, grupos));
  box.appendChild(cols2);
}

function aeRender(){
  if (!window.G || !G.contextos || typeof tfCaixa !== 'function') return;
  aeMontar();
  AE_AREAS.forEach(function(a){
    /* Um ecra que rebenta nao cala os outros. */
    try { aeRenderArea(a); } catch (e) { console.error('[farol] area ' + a.view, e); }
  });
}

var _aeRenderGestao = renderGestao;
renderGestao = function(){
  _aeRenderGestao();
  aeRender();
};
/* Os documentos vem do /api/bootstrap, que pode chegar depois das tarefas. */
var _aeRenderAll = renderAll;
renderAll = function(){
  _aeRenderAll();
  aeRender();
};

aeMontar();
if (window.G && G.contextos) aeRender();
