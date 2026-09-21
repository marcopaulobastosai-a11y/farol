'use strict';
/* Farol — Projetos.
 *
 * Um projeto deixou de ser um cartao que so se le. A lista continua a ser a
 * primeira coisa que aparece, mas agora cada projeto tem pagina propria: o
 * que lhe esta agarrado (tarefas, documentos, despesas), quem la anda, de que
 * e que esta a espera, e todos os campos editaveis no sitio.
 *
 * Porque uma pagina e nao um painel lateral: um projeto nao se le de relance
 * como uma tarefa — tem quatro listas dentro dele, e num painel de 400px
 * nenhuma delas cabe sem se tornar ilegivel.
 *
 * O progresso vem sempre do servidor (/api/gestao/projetos/:id), nunca do
 * G.tasks: o G.tasks so traz as tarefas abertas e as fechadas ha duas semanas,
 * e uma barra de progresso feita so com essas mentiria por defeito.
 *
 * Reaproveita os globais do app.js ($, el, clear, toast, pill, apiGestao, G,
 * loadGestao, pessoa, projeto, areaNome, projetoNome, dataCurta, diasAte,
 * show, TITLES) e, quando existe, o tfAbrir das Tarefas.
 */

var PJ = {
  filtro: 'abertos',  // abertos | planeados | concluidos | todos
  aberto: null,       // id do projeto com pagina aberta
  det: null,          // { projeto, tarefas, documentos, despesas, dependentes }
  aba: 'tarefas',     // tarefas | documentos | despesas
  montado: false,
  arrasta: null
};

var PJ_ESTADOS = [
  ['planeado',  'Planeado',  'warn'],
  ['ativo',     'A andar',   'accent'],
  ['suspenso',  'Suspenso',  ''],
  ['concluido', 'Concluído', 'good']
];
var PJ_PAPEIS = [['responsavel', 'Responsável'], ['participante', 'Participante'], ['informado', 'Informado']];

var PJ_CSS = [
  "#view-projetos .pj-bar{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}",
  "#view-projetos .pj-bar .tabs{margin-bottom:0}",
  "#view-projetos .pj-bar .btn.small{margin-left:auto}",
  "#view-projetos .pj-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(19rem,1fr));gap:12px}",
  "#view-projetos .pj-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:14px;cursor:pointer;display:flex;flex-direction:column;gap:8px;position:relative}",
  "#view-projetos .pj-card:hover{border-color:var(--accent)}",
  "#view-projetos .pj-card.arrastado{opacity:.4}",
  "#view-projetos .pj-card.alvo{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}",
  "#view-projetos .pj-card h4{font-family:var(--serif);font-size:1.0625rem;font-weight:600;line-height:1.25;padding-right:22px}",
  "#view-projetos .pj-card .pj-onde{font-size:.75rem;color:var(--muted)}",
  "#view-projetos .pj-card .pj-desc{font-size:.8125rem;color:var(--ink-2);line-height:1.45}",
  "#view-projetos .pj-card footer{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:4px}",
  "#view-projetos .pj-card footer .mono{margin-left:auto;color:var(--muted)}",
  "#view-projetos .pj-pega{position:absolute;top:10px;right:8px;color:var(--faint);cursor:grab;line-height:0;padding:2px}",
  "#view-projetos .pj-pega:active{cursor:grabbing}",
  "#view-projetos .pj-barra{height:5px;border-radius:99px;background:var(--surface-2);border:1px solid var(--line-soft);overflow:hidden}",
  "#view-projetos .pj-barra i{display:block;height:100%;background:var(--accent)}",
  "#view-projetos .pj-barra.cheia i{background:var(--good)}",
  "#view-projetos .pj-top{display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap}",
  "#view-projetos .pj-top .pj-sp{flex:1}",
  "#view-projetos .pj-voltar{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:var(--muted);font:inherit;font-size:.8125rem;cursor:pointer;padding:4px 6px;border-radius:7px}",
  "#view-projetos .pj-voltar:hover{background:var(--surface-2);color:var(--ink)}",
  "#view-projetos .pj-titulo{width:100%;font:inherit;font-family:var(--serif);font-size:1.6rem;font-weight:600;line-height:1.2;color:var(--ink);border:0;background:none;resize:none;overflow:hidden;padding:2px 0}",
  "#view-projetos .pj-notas{width:100%;font:inherit;font-size:.875rem;line-height:1.55;color:var(--ink-2);border:0;background:none;resize:none;padding:4px 0;min-height:2.2em}",
  "#view-projetos .pj-titulo:focus,#view-projetos .pj-notas:focus{outline:0;border-bottom:1px solid var(--accent)}",
  "#view-projetos .pj-nums{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end;margin:12px 0 4px}",
  "#view-projetos .pj-num b{display:block;font-family:var(--mono);font-size:1.25rem;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1.1}",
  "#view-projetos .pj-num span{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}",
  "#view-projetos .pj-num.bad b{color:var(--bad)} #view-projetos .pj-num.warn b{color:var(--warn)}",
  "#view-projetos .pj-corpo{display:grid;grid-template-columns:minmax(0,1fr) 20rem;gap:14px;align-items:start;margin-top:16px}",
  "#view-projetos .pj-lin{display:flex;align-items:flex-start;gap:10px;padding:8px 6px;border-top:1px solid var(--line-soft);border-radius:7px;cursor:pointer}",
  "#view-projetos .pj-lin:first-child{border-top-color:transparent}",
  "#view-projetos .pj-lin:hover{background:var(--surface-2)}",
  "#view-projetos .pj-lin .pj-corpo-lin{flex:1;min-width:0}",
  "#view-projetos .pj-lin .pj-t{display:block;font-size:.875rem;color:var(--ink);line-height:1.35;overflow-wrap:anywhere}",
  "#view-projetos .pj-lin.feita .pj-t{color:var(--faint);text-decoration:line-through}",
  "#view-projetos .pj-lin .pj-m{display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:3px;font-size:.72rem;color:var(--muted)}",
  "#view-projetos .pj-lin .pj-r{flex:none;font-family:var(--mono);font-size:.6875rem;color:var(--muted);white-space:nowrap;padding-top:2px}",
  "#view-projetos .pj-lin .pj-r.bad{color:var(--bad)} #view-projetos .pj-lin .pj-r.warn{color:var(--warn)}",
  "#view-projetos .pj-add{width:100%;font:inherit;font-size:.8125rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-top:10px}",
  "#view-projetos .pj-add:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);background:var(--surface)}",
  "#view-projetos .pj-ficha{display:grid;grid-template-columns:5.5rem minmax(0,1fr);gap:8px 10px;align-items:center;font-size:.8125rem}",
  "#view-projetos .pj-ficha > span{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}",
  "#view-projetos .pj-ficha select,#view-projetos .pj-ficha input{font:inherit;font-size:.8125rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:7px;padding:5px 8px;width:100%;min-width:0}",
  "#view-projetos .pj-ficha select:focus,#view-projetos .pj-ficha input:focus{outline:0;border-color:var(--accent)}",
  "#view-projetos .pj-eq{display:flex;flex-direction:column;gap:6px}",
  "#view-projetos .pj-eq label{display:flex;align-items:center;gap:8px;font-size:.8125rem}",
  "#view-projetos .pj-eq label i{width:8px;height:8px;border-radius:50%;flex:none}",
  "#view-projetos .pj-eq label span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
  "#view-projetos .pj-eq select{flex:none;width:8.5rem;font:inherit;font-size:.75rem;color:var(--ink-2);background:var(--surface-2);border:1px solid var(--line);border-radius:7px;padding:3px 5px}",
  "#view-projetos .pj-dep{font-size:.8125rem;color:var(--ink-2);padding:4px 0;border-top:1px solid var(--line-soft)}",
  "#view-projetos .pj-dep:first-of-type{border-top:0}",
  "#view-projetos .pj-dep b{font-weight:500;color:var(--ink);cursor:pointer}",
  "#view-projetos .pj-dep b:hover{color:var(--accent-ink);text-decoration:underline}",
  "@media (max-width:980px){#view-projetos .pj-corpo{grid-template-columns:minmax(0,1fr)}}"
].join('\n');

function pjEstilo(){
  if (document.getElementById('pjCss')) return;
  var s = document.createElement('style');
  s.id = 'pjCss';
  s.textContent = PJ_CSS;
  document.head.appendChild(s);
}

function pjSvg(d, w){
  return '<svg width="' + (w || 14) + '" height="' + (w || 14) + '" viewBox="0 0 24 24" fill="none"'
    + ' stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
}
function pjIco(d, titulo, w){
  var b = el('button', 'btn');
  b.type = 'button';
  b.innerHTML = pjSvg(d, w);
  if (titulo) b.title = titulo;
  return b;
}
function pjEstado(v){
  for (var i = 0; i < PJ_ESTADOS.length; i++) if (PJ_ESTADOS[i][0] === v) return PJ_ESTADOS[i];
  return PJ_ESTADOS[1];
}
function pjEuros(v){
  if (v === null || v === undefined || v === '') return '';
  return Number(v).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}
/* Um campo que cresce com o texto em vez de ganhar barra de deslocamento. */
function pjCrescer(t){ t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; }

/* ------------------------------------------------------------------ *
 * montagem
 * ------------------------------------------------------------------ */

function pjMontar(){
  var sec = $('view-projetos');
  if (!sec || PJ.montado) return;
  pjEstilo();
  clear(sec);

  var lista = el('div');
  lista.id = 'pjLista';

  var bar = el('div', 'pj-bar');
  var tabs = el('div', 'tabs');
  tabs.id = 'pjFiltros';
  bar.appendChild(tabs);
  var novo = el('button', 'btn small', '+ Projeto');
  novo.type = 'button';
  novo.id = 'pjNovo';
  bar.appendChild(novo);
  lista.appendChild(bar);

  lista.appendChild(pjFormNovo());

  var cards = el('div', 'pj-cards');
  cards.id = 'pjCards';
  lista.appendChild(cards);
  sec.appendChild(lista);

  var pag = el('div');
  pag.id = 'pjPagina';
  pag.hidden = true;
  sec.appendChild(pag);

  novo.addEventListener('click', function(){
    var f = $('pjForm');
    f.hidden = !f.hidden;
    if (!f.hidden) f.name.focus();
  });

  PJ.montado = true;
  pjRender();
}

function pjFormNovo(){
  var f = el('form', 'form card');
  f.id = 'pjForm';
  f.hidden = true;
  f.autocomplete = 'off';
  f.style.maxWidth = '40rem';
  f.style.marginBottom = '14px';

  function campo(rotulo, node){
    var l = el('label', 'field');
    l.appendChild(el('span', null, rotulo));
    l.appendChild(node);
    return l;
  }
  var nome = el('input');
  nome.type = 'text'; nome.name = 'name'; nome.required = true;
  nome.placeholder = 'Ex.: Mudança de casa';
  var desc = el('input');
  desc.type = 'text'; desc.name = 'description';
  desc.placeholder = 'Uma linha chega';
  var area = el('select');
  area.name = 'context_id'; area.id = 'pjArea';
  var alvo = el('input');
  alvo.type = 'date'; alvo.name = 'target_on';

  f.appendChild(campo('Nome', nome));
  f.appendChild(campo('Do que se trata', desc));
  var linha = el('div', 'field-row');
  linha.appendChild(campo('Área', area));
  linha.appendChild(campo('Para quando', alvo));
  f.appendChild(linha);

  var eq = el('div', 'field');
  eq.appendChild(el('span', null, 'Quem entra'));
  var chips = el('div', 'chips');
  chips.id = 'pjMembros';
  eq.appendChild(chips);
  f.appendChild(eq);

  var acts = el('div', 'form-actions');
  var ok = el('button', 'btn primary', 'Criar projeto');
  ok.type = 'submit';
  var cancelar = el('button', 'btn', 'Cancelar');
  cancelar.type = 'button';
  cancelar.addEventListener('click', function(){ f.hidden = true; });
  acts.appendChild(ok); acts.appendChild(cancelar);
  f.appendChild(acts);

  f.addEventListener('submit', function(e){
    e.preventDefault();
    apiGestao('/api/gestao/projetos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nome.value.trim(),
        description: desc.value.trim() || null,
        context_id: area.value || null,
        target_on: alvo.value || null,
        members: chipsSelecionados('pjMembros').map(function(id){
          return { person_id: id, member_role: 'participante' };
        })
      })
    }).then(function(){
      f.reset(); f.hidden = true;
      return loadGestao();
    }).then(function(){ toast('Projeto criado.'); })
      .catch(function(){ toast('Não deu para criar o projeto.'); });
  });
  return f;
}

/* ------------------------------------------------------------------ *
 * lista
 * ------------------------------------------------------------------ */

/* O filtro de entrada mostra tudo o que ainda nao fechou, planeados inclusive:
   um projeto a espera de outro continua a ser trabalho por fazer, e esconde-lo
   por defeito era a maneira mais facil de o esquecer. */
function pjFiltrados(){
  var todos = G.projects || [];
  if (PJ.filtro === 'todos') return todos.slice();
  if (PJ.filtro === 'planeados') return todos.filter(function(p){ return p.status === 'planeado'; });
  if (PJ.filtro === 'concluidos') return todos.filter(function(p){ return p.status === 'concluido'; });
  return todos.filter(function(p){ return p.status !== 'concluido'; });
}

function pjRenderFiltros(){
  var box = $('pjFiltros');
  if (!box) return;
  clear(box);
  var todos = G.projects || [];
  var conta = {
    abertos: todos.filter(function(p){ return p.status !== 'concluido'; }).length,
    planeados: todos.filter(function(p){ return p.status === 'planeado'; }).length,
    concluidos: todos.filter(function(p){ return p.status === 'concluido'; }).length,
    todos: todos.length
  };
  [['abertos', 'Por fechar'], ['planeados', 'Planeados'], ['concluidos', 'Concluídos'], ['todos', 'Todos']]
    .forEach(function(x){
      var b = el('button', PJ.filtro === x[0] ? 'is-active' : '', x[1] + (conta[x[0]] ? ' · ' + conta[x[0]] : ''));
      b.type = 'button';
      b.addEventListener('click', function(){ PJ.filtro = x[0]; pjRender(); });
      box.appendChild(b);
    });
}

function pjRenderCards(){
  var box = $('pjCards');
  if (!box) return;
  clear(box);
  var lista = pjFiltrados();
  if (!lista.length){
    box.appendChild(el('p', 'vazio', G.projects && G.projects.length
      ? 'Nenhum projeto neste filtro.'
      : 'Ainda sem projetos. A mudança de casa e a sociedade nova entram aqui.'));
    return;
  }
  lista.forEach(function(pr){ box.appendChild(pjCard(pr)); });
}

function pjCard(pr){
  var c = el('article', 'pj-card');
  c.dataset.id = pr.id;

  var pega = el('span', 'pj-pega');
  pega.innerHTML = pjSvg('<path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01"/>', 15);
  pega.title = 'Arrastar para reordenar';
  pega.draggable = true;
  c.appendChild(pega);

  c.appendChild(el('h4', null, pr.name));
  var onde = [areaNome(pr.context_id),
    pr.status === 'planeado' && pr.depends_on_id ? 'a aguardar ' + projetoNome(pr.depends_on_id) : ''
  ].filter(Boolean).join(' · ');
  if (onde) c.appendChild(el('div', 'pj-onde', onde));
  if (pr.description) c.appendChild(el('p', 'pj-desc', pr.description));

  /* Sem abrir o projeto so se sabe das tarefas que o /api/gestao trouxe: as
     abertas. E esse o numero que o cartao mostra, e e isso que ele diz. */
  var abertas = (G.tasks || []).filter(function(t){
    return t.project_id === pr.id && t.status !== 'concluida' && t.status !== 'cancelada';
  }).length;
  var nomes = (pr.members || []).map(function(m){
    var p = pessoa(m.person_id);
    return p ? (m.member_role === 'responsavel' ? p.name + ' (resp.)' : p.name) : null;
  }).filter(Boolean).join(', ');
  if (nomes) c.appendChild(el('div', 'pj-onde', nomes));

  var f = el('footer');
  var est = pjEstado(pr.status);
  f.appendChild(pill(est[1], est[2]));
  if (pr.status !== 'concluido'){
    f.appendChild(pill(abertas + (abertas === 1 ? ' tarefa aberta' : ' tarefas abertas'), abertas ? 'accent' : ''));
  }
  var quando = pr.status === 'concluido' ? pr.closed_on : pr.target_on;
  if (quando){
    var n = diasAte(quando);
    var u = urgencia(n, 'tarefa');
    var d = el('span', 'mono num',
      (pr.status === 'concluido' ? 'fechado ' : '') + dataCurta(quando)
      + (pr.status !== 'concluido' && u.texto ? ' · ' + u.texto : ''));
    if (pr.status !== 'concluido' && u.nivel) d.style.color = 'var(--' + u.nivel + ')';
    f.appendChild(d);
  }
  c.appendChild(f);

  c.addEventListener('click', function(e){
    if (e.target.closest('.pj-pega')) return;
    pjAbrir(pr.id);
  });
  pjArrastavel(c, pega, pr.id);
  return c;
}

/* Arrastar para reordenar. A ordem que se grava e sempre a lista inteira,
   mesmo com um filtro ligado: mexer numa linha muda a posicao das outras, e
   gravar so as visiveis deixaria as escondidas com numeros repetidos. */
function pjArrastavel(card, pega, id){
  pega.addEventListener('dragstart', function(e){
    PJ.arrasta = id;
    card.classList.add('arrastado');
    try { e.dataTransfer.setData('text/plain', String(id)); } catch (err) { /* IE antigo */ }
    e.dataTransfer.effectAllowed = 'move';
  });
  pega.addEventListener('dragend', function(){
    PJ.arrasta = null;
    card.classList.remove('arrastado');
    var box = $('pjCards');
    if (box) box.querySelectorAll('.alvo').forEach(function(x){ x.classList.remove('alvo'); });
  });
  card.addEventListener('dragover', function(e){
    if (PJ.arrasta === null || PJ.arrasta === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    card.classList.add('alvo');
  });
  card.addEventListener('dragleave', function(){ card.classList.remove('alvo'); });
  card.addEventListener('drop', function(e){
    e.preventDefault();
    card.classList.remove('alvo');
    if (PJ.arrasta === null || PJ.arrasta === id) return;
    pjReordenar(PJ.arrasta, id);
  });
}

function pjReordenar(origem, destino){
  var ids = (G.projects || []).map(function(p){ return p.id; });
  var de = ids.indexOf(origem), para = ids.indexOf(destino);
  if (de < 0 || para < 0) return;
  ids.splice(de, 1);
  ids.splice(ids.indexOf(destino) + (de < para ? 1 : 0), 0, origem);
  apiGestao('/api/gestao/projetos/ordem', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: ids })
  }).then(function(){ return loadGestao(); })
    .catch(function(){ toast('Não deu para gravar a ordem.'); });
}

/* ------------------------------------------------------------------ *
 * pagina de um projeto
 * ------------------------------------------------------------------ */

function pjAbrir(id){
  /* Vir de outro ecra (de um aviso, de uma ficha) tem de trazer o ecra dos
     Projetos com ele: o show() poe o titulo do ecra, e o da pagina do projeto
     e escrito a seguir, no pjRenderPagina. */
  if (typeof show === 'function') show('projetos');
  PJ.aberto = id;
  PJ.aba = 'tarefas';
  PJ.det = null;
  pjTrocar();
  pjCarregarDetalhe();
}

function pjFechar(){
  PJ.aberto = null;
  PJ.det = null;
  pjTrocar();
  if (TITLES && TITLES.projetos){
    $('pageTitle').textContent = TITLES.projetos[0];
    $('pageSub').textContent = TITLES.projetos[1];
  }
}

function pjTrocar(){
  var l = $('pjLista'), p = $('pjPagina');
  if (!l || !p) return;
  l.hidden = PJ.aberto !== null;
  p.hidden = PJ.aberto === null;
  if (PJ.aberto === null) pjRender();
}

function pjCarregarDetalhe(){
  var pedido = PJ.aberto;
  var p = $('pjPagina');
  if (p && !PJ.det){ clear(p); p.appendChild(el('p', 'vazio', 'A ler o projeto…')); }
  return apiGestao('/api/gestao/projetos/' + pedido).then(function(d){
    if (PJ.aberto !== pedido) return;
    PJ.det = d;
    pjRenderPagina();
  }).catch(function(){
    if (PJ.aberto !== pedido) return;
    clear(p);
    p.appendChild(el('p', 'vazio', 'Não foi possível ler este projeto.'));
    var v = el('button', 'btn', '‹ Projetos');
    v.type = 'button';
    v.addEventListener('click', pjFechar);
    p.appendChild(v);
  });
}

function pjGuardar(campos){
  var id = PJ.aberto;
  return apiGestao('/api/gestao/projetos/' + id, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(campos)
  }).then(function(){
    return loadGestao();
  }).then(function(){
    if (PJ.aberto === id) return pjCarregarDetalhe();
  }).catch(function(){ toast('Não deu para gravar.'); });
}

function pjRenderPagina(){
  var box = $('pjPagina');
  if (!box || !PJ.det) return;
  var pr = PJ.det.projeto;
  clear(box);

  /* O nome do projeto vive uma vez so, no campo que se edita. A barra de cima
     continua a dizer em que ecra se esta e acrescenta onde e que o projeto
     mora — repetir o nome nos dois sitios so enchia o ecra. */
  $('pageTitle').textContent = 'Projetos';
  $('pageSub').textContent = [areaNome(pr.context_id), pjEstado(pr.status)[1]].filter(Boolean).join(' · ')
    || 'Uma frente de trabalho por dentro';

  /* ---- barra de topo ---- */
  var top = el('div', 'pj-top');
  var voltar = el('button', 'pj-voltar');
  voltar.type = 'button';
  voltar.innerHTML = pjSvg('<path d="M15 6l-6 6 6 6"/>') + ' Projetos';
  voltar.addEventListener('click', pjFechar);
  top.appendChild(voltar);
  top.appendChild(el('div', 'pj-sp'));

  var fechado = pr.status === 'concluido';
  var alternar = el('button', 'btn', fechado ? 'Reabrir' : 'Marcar como concluído');
  alternar.type = 'button';
  alternar.addEventListener('click', function(){
    pjGuardar(fechado
      ? { status: 'ativo', closed_on: null }
      : { status: 'concluido', closed_on: new Date().toISOString().slice(0, 10) });
  });
  top.appendChild(alternar);

  var apagar = el('button', 'btn danger', 'Apagar');
  apagar.type = 'button';
  apagar.addEventListener('click', function(){ pjApagar(pr); });
  top.appendChild(apagar);
  box.appendChild(top);

  /* ---- nome e descricao, editaveis no sitio ---- */
  var titulo = el('textarea', 'pj-titulo');
  titulo.rows = 1;
  titulo.value = pr.name;
  titulo.addEventListener('input', function(){ pjCrescer(titulo); });
  titulo.addEventListener('blur', function(){
    var v = titulo.value.trim();
    if (!v){ titulo.value = pr.name; pjCrescer(titulo); return; }
    if (v !== pr.name) pjGuardar({ name: v });
  });
  box.appendChild(titulo);

  var notas = el('textarea', 'pj-notas');
  notas.rows = 1;
  notas.placeholder = 'Do que se trata…';
  notas.value = pr.description || '';
  notas.addEventListener('input', function(){ pjCrescer(notas); });
  notas.addEventListener('blur', function(){
    var v = notas.value.trim();
    if (v !== (pr.description || '')) pjGuardar({ description: v || null });
  });
  box.appendChild(notas);
  setTimeout(function(){ pjCrescer(titulo); pjCrescer(notas); }, 0);

  box.appendChild(pjNumeros());

  /* ---- corpo: separadores + ficha ---- */
  var corpo = el('div', 'pj-corpo');
  var main = el('div');
  main.appendChild(pjAbas());
  var conteudo = el('div', 'card');
  conteudo.id = 'pjConteudo';
  main.appendChild(conteudo);
  corpo.appendChild(main);
  corpo.appendChild(pjFicha());
  box.appendChild(corpo);

  pjRenderAba();
}

/* As contas do projeto. Sao as tarefas todas, vindas do servidor — o que nao
   houver diz-se a zero, nao se esconde. */
function pjNumeros(){
  var d = PJ.det;
  var pr = d.projeto;
  var uteis = d.tarefas.filter(function(t){ return t.status !== 'cancelada'; });
  var feitas = uteis.filter(function(t){ return t.status === 'concluida'; }).length;
  var pct = uteis.length ? Math.round((feitas / uteis.length) * 100) : 0;
  var atrasadas = uteis.filter(function(t){
    return t.status !== 'concluida' && t.due_on && diasAte(t.due_on) < 0;
  }).length;
  var gasto = d.despesas.reduce(function(s, x){ return s + (Number(x.amount) || 0); }, 0);

  var wrap = el('div');
  var barra = el('div', 'pj-barra' + (pct === 100 ? ' cheia' : ''));
  var i = el('i');
  i.style.width = pct + '%';
  barra.appendChild(i);
  wrap.appendChild(barra);

  var nums = el('div', 'pj-nums');
  function num(valor, rotulo, nivel){
    var n = el('div', 'pj-num' + (nivel ? ' ' + nivel : ''));
    n.appendChild(el('b', null, valor));
    n.appendChild(el('span', null, rotulo));
    nums.appendChild(n);
  }
  num(pct + '%', feitas + ' de ' + uteis.length + ' tarefas');
  num(String(uteis.length - feitas), 'por fazer');
  if (atrasadas) num(String(atrasadas), 'em atraso', 'bad');
  if (d.documentos.length) num(String(d.documentos.length), 'documentos');
  if (d.despesas.length) num(pjEuros(gasto), 'gasto em ' + d.despesas.length);
  if (pr.target_on && pr.status !== 'concluido'){
    var dias = diasAte(pr.target_on);
    num(dataCurta(pr.target_on), urgencia(dias, 'tarefa').texto || 'data-alvo',
      dias < 0 ? 'bad' : dias <= 14 ? 'warn' : '');
  }
  if (pr.closed_on) num(dataCurta(pr.closed_on), 'fechado em');
  wrap.appendChild(nums);
  return wrap;
}

function pjAbas(){
  var d = PJ.det;
  var tabs = el('div', 'tabs');
  [['tarefas', 'Tarefas', d.tarefas.length],
   ['documentos', 'Documentos', d.documentos.length],
   ['despesas', 'Despesas', d.despesas.length]].forEach(function(x){
    var b = el('button', PJ.aba === x[0] ? 'is-active' : '', x[1] + (x[2] ? ' · ' + x[2] : ''));
    b.type = 'button';
    b.addEventListener('click', function(){
      PJ.aba = x[0];
      tabs.querySelectorAll('button').forEach(function(o){ o.classList.remove('is-active'); });
      b.classList.add('is-active');
      pjRenderAba();
    });
    tabs.appendChild(b);
  });
  return tabs;
}

function pjRenderAba(){
  var box = $('pjConteudo');
  if (!box || !PJ.det) return;
  clear(box);
  if (PJ.aba === 'tarefas') return pjAbaTarefas(box);
  if (PJ.aba === 'documentos') return pjAbaDocumentos(box);
  return pjAbaDespesas(box);
}

function pjAbaTarefas(box){
  var tarefas = PJ.det.tarefas;
  if (!tarefas.length){
    box.appendChild(el('p', 'vazio', 'Sem tarefas ligadas a este projeto.'));
  } else {
    var abertas = tarefas.filter(function(t){ return t.status !== 'concluida' && t.status !== 'cancelada'; });
    var fechadas = tarefas.filter(function(t){ return t.status === 'concluida' || t.status === 'cancelada'; });
    abertas.forEach(function(t){ box.appendChild(pjLinhaTarefa(t)); });
    if (fechadas.length){
      var h = el('div', 'mono');
      h.style.margin = '14px 0 2px';
      h.textContent = fechadas.length + (fechadas.length === 1 ? ' fechada' : ' fechadas');
      box.appendChild(h);
      fechadas.forEach(function(t){ box.appendChild(pjLinhaTarefa(t)); });
    }
  }
  /* Criar aqui ja liga a tarefa ao projeto: e o unico sitio onde isso e
     obvio sem se ter de escolher o projeto numa lista. */
  var add = el('input', 'pj-add');
  add.type = 'text';
  add.placeholder = '+ Nova tarefa neste projeto';
  add.addEventListener('keydown', function(e){
    if (e.key !== 'Enter') return;
    var titulo = add.value.trim();
    if (!titulo) return;
    add.value = '';
    apiGestao('/api/gestao/tarefas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: titulo,
        project_id: PJ.aberto,
        context_id: PJ.det.projeto.context_id || null
      })
    }).then(function(d){
      if (d && d.people) { G = d; if (typeof renderGestao === 'function') renderGestao(); }
      return pjCarregarDetalhe();
    }).then(function(){ toast('Tarefa criada.'); })
      .catch(function(){ toast('Não deu para criar a tarefa.'); });
  });
  box.appendChild(add);
}

function pjLinhaTarefa(t){
  var fechada = t.status === 'concluida' || t.status === 'cancelada';
  var li = el('div', 'pj-lin' + (fechada ? ' feita' : ''));
  var corpo = el('div', 'pj-corpo-lin');
  corpo.appendChild(el('span', 'pj-t', t.title));

  var m = el('div', 'pj-m');
  var dono = pessoa(t.owner_id);
  if (dono){
    var d = el('span');
    var dot = el('i');
    dot.style.cssText = 'width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:4px;background:'
      + (dono.color || 'var(--c1)');
    d.appendChild(dot);
    d.appendChild(document.createTextNode(dono.name));
    m.appendChild(d);
  }
  if (t.tipo && t.tipo !== 'tarefa') m.appendChild(el('span', null, t.tipo));
  if (t.priority === 'alta') m.appendChild(el('span', null, 'prioridade alta'));
  if (t.status === 'a_espera') m.appendChild(el('span', null, 'à espera'));
  if (t.status === 'cancelada') m.appendChild(el('span', null, 'não farei'));
  if (m.childNodes.length) corpo.appendChild(m);
  li.appendChild(corpo);

  var quando = t.status === 'concluida' ? t.completed_on : t.due_on;
  if (quando){
    var n = diasAte(quando);
    var u = t.status === 'concluida' ? { texto: dataCurta(quando), nivel: '' } : urgencia(n, 'tarefa');
    li.appendChild(el('div', 'pj-r' + (u.nivel ? ' ' + u.nivel : ''), u.texto || dataCurta(quando)));
  }

  /* O detalhe de uma tarefa ja existe e vive nas Tarefas: daqui salta-se para
     la em vez de se desenhar um segundo, que depressa ficaria diferente. */
  li.addEventListener('click', function(){
    show('tarefas');
    if (typeof tfAbrir === 'function') setTimeout(function(){ tfAbrir(t.id); }, 0);
  });
  return li;
}

function pjAbaDocumentos(box){
  var docs = PJ.det.documentos;
  if (!docs.length){
    box.appendChild(el('p', 'vazio',
      'Sem documentos ligados. Um documento liga-se ao projeto no ecrã dos Documentos.'));
    return;
  }
  docs.forEach(function(x){
    var li = el('div', 'pj-lin');
    var corpo = el('div', 'pj-corpo-lin');
    corpo.appendChild(el('span', 'pj-t', x.name));
    var m = el('div', 'pj-m');
    [x.entity, x.kind, x.aprovado ? '' : 'por aprovar'].filter(Boolean)
      .forEach(function(s){ m.appendChild(el('span', null, s)); });
    if (m.childNodes.length) corpo.appendChild(m);
    li.appendChild(corpo);
    if (x.valid_on){
      var u = urgencia(diasAte(x.valid_on), 'documento');
      li.appendChild(el('div', 'pj-r' + (u.nivel ? ' ' + u.nivel : ''), 'válido até ' + dataCurta(x.valid_on)));
    }
    li.addEventListener('click', function(){ show('documentos'); });
    box.appendChild(li);
  });
}

function pjAbaDespesas(box){
  var ds = PJ.det.despesas;
  if (!ds.length){
    box.appendChild(el('p', 'vazio',
      'Sem despesas ligadas. Uma despesa liga-se ao projeto nas Finanças.'));
    return;
  }
  ds.forEach(function(x){
    var li = el('div', 'pj-lin');
    li.style.cursor = 'default';
    var corpo = el('div', 'pj-corpo-lin');
    corpo.appendChild(el('span', 'pj-t', x.description));
    var quem = pessoa(x.person_id);
    var m = el('div', 'pj-m');
    [x.merchant, x.category, quem ? quem.name : '', dataCurta(x.spent_on)].filter(Boolean)
      .forEach(function(s){ m.appendChild(el('span', null, s)); });
    corpo.appendChild(m);
    li.appendChild(corpo);
    li.appendChild(el('div', 'pj-r', pjEuros(x.amount)));
    box.appendChild(li);
  });
}

/* ---- a ficha ao lado: tudo o que se edita num sitio so ---- */
function pjFicha(){
  var pr = PJ.det.projeto;
  var lado = el('div', 'stack');

  var c = el('div', 'card');
  var h = el('header');
  h.appendChild(el('h3', null, 'Ficha'));
  c.appendChild(h);

  var g = el('div', 'pj-ficha');
  function linha(rotulo, node){
    g.appendChild(el('span', null, rotulo));
    g.appendChild(node);
  }

  var area = el('select');
  pjEncherAreas(area, pr.context_id);
  area.addEventListener('change', function(){ pjGuardar({ context_id: area.value || null }); });
  linha('Área', area);

  var estado = el('select');
  PJ_ESTADOS.forEach(function(x){ estado.appendChild(new Option(x[1], x[0])); });
  estado.value = pr.status || 'ativo';
  estado.addEventListener('change', function(){
    var v = estado.value;
    pjGuardar(v === 'concluido'
      ? { status: v, closed_on: pr.closed_on || new Date().toISOString().slice(0, 10) }
      : { status: v, closed_on: null });
  });
  linha('Estado', estado);

  var inicio = el('input');
  inicio.type = 'date';
  inicio.value = pr.started_on || '';
  inicio.addEventListener('change', function(){ pjGuardar({ started_on: inicio.value || null }); });
  linha('Início', inicio);

  var alvo = el('input');
  alvo.type = 'date';
  alvo.value = pr.target_on || '';
  alvo.addEventListener('change', function(){ pjGuardar({ target_on: alvo.value || null }); });
  linha('Para quando', alvo);

  var dep = el('select');
  dep.appendChild(new Option('— de nenhum —', ''));
  (G.projects || []).filter(function(p){ return p.id !== pr.id; })
    .forEach(function(p){ dep.appendChild(new Option(p.name, p.id)); });
  dep.value = pr.depends_on_id || '';
  dep.addEventListener('change', function(){ pjGuardar({ depends_on_id: dep.value || null }); });
  linha('Depende de', dep);

  c.appendChild(g);
  lado.appendChild(c);

  /* ---- equipa ---- */
  var ce = el('div', 'card');
  var he = el('header');
  he.appendChild(el('h3', null, 'Quem anda nisto'));
  ce.appendChild(he);
  var eq = el('div', 'pj-eq');
  var atuais = {};
  (pr.members || []).forEach(function(m){ atuais[m.person_id] = m.member_role; });
  (G.people || []).filter(function(p){ return p.active !== false; }).forEach(function(p){
    var l = el('label');
    var i = el('i');
    i.style.background = p.color || 'var(--c1)';
    l.appendChild(i);
    l.appendChild(el('span', null, p.name));
    var s = el('select');
    s.appendChild(new Option('—', ''));
    PJ_PAPEIS.forEach(function(x){ s.appendChild(new Option(x[1], x[0])); });
    s.value = atuais[p.id] || '';
    s.addEventListener('change', function(){
      var membros = [];
      eq.querySelectorAll('select').forEach(function(o){
        if (o.value) membros.push({ person_id: Number(o.dataset.pessoa), member_role: o.value });
      });
      pjGuardar({ members: membros });
    });
    s.dataset.pessoa = p.id;
    l.appendChild(s);
    eq.appendChild(l);
  });
  if (!eq.childNodes.length) eq.appendChild(el('p', 'vazio', 'Ainda sem pessoas.'));
  ce.appendChild(eq);
  lado.appendChild(ce);

  /* ---- ligacoes ---- */
  var dependentes = PJ.det.dependentes || [];
  if (pr.depends_on_id || dependentes.length){
    var cl = el('div', 'card');
    var hl = el('header');
    hl.appendChild(el('h3', null, 'Ligações'));
    cl.appendChild(hl);
    if (pr.depends_on_id){
      var d1 = el('div', 'pj-dep');
      d1.appendChild(document.createTextNode('Está à espera de '));
      var b1 = el('b', null, projetoNome(pr.depends_on_id));
      b1.addEventListener('click', function(){ pjAbrir(pr.depends_on_id); });
      d1.appendChild(b1);
      cl.appendChild(d1);
    }
    dependentes.forEach(function(x){
      var d2 = el('div', 'pj-dep');
      var b2 = el('b', null, x.name);
      b2.addEventListener('click', function(){ pjAbrir(x.id); });
      d2.appendChild(b2);
      d2.appendChild(document.createTextNode(' está à espera deste'));
      cl.appendChild(d2);
    });
    lado.appendChild(cl);
  }
  return lado;
}

function pjEncherAreas(s, valor){
  clear(s);
  s.appendChild(new Option('— sem área —', ''));
  var cx = G.contextos || [];
  cx.filter(function(c){ return !c.parent_id && c.active; }).forEach(function(area){
    var g = document.createElement('optgroup');
    g.label = area.name;
    g.appendChild(new Option(area.name, area.id));
    cx.filter(function(c){ return c.parent_id === area.id && c.active; })
      .forEach(function(sub){ g.appendChild(new Option('   ' + sub.name, sub.id)); });
    s.appendChild(g);
  });
  if (valor) s.value = valor;
}

/* Apagar um projeto nao apaga o que estava agarrado a ele, e quem apaga tem
   de saber isso antes de carregar no botao. */
function pjApagar(pr){
  var d = PJ.det;
  var presos = [];
  if (d.tarefas.length) presos.push(d.tarefas.length + (d.tarefas.length === 1 ? ' tarefa' : ' tarefas'));
  if (d.documentos.length) presos.push(d.documentos.length + (d.documentos.length === 1 ? ' documento' : ' documentos'));
  if (d.despesas.length) presos.push(d.despesas.length + (d.despesas.length === 1 ? ' despesa' : ' despesas'));
  var aviso = 'Apagar «' + pr.name + '»?'
    + (presos.length
      ? '\n\n' + presos.join(', ') + ' ficam na app, mas deixam de ter projeto.'
      : '');
  if (!window.confirm(aviso)) return;
  apiGestao('/api/gestao/projetos/' + pr.id, { method: 'DELETE' })
    .then(function(){
      PJ.aberto = null; PJ.det = null;
      return loadGestao();
    }).then(function(){
      pjTrocar();
      if (TITLES && TITLES.projetos){
        $('pageTitle').textContent = TITLES.projetos[0];
        $('pageSub').textContent = TITLES.projetos[1];
      }
      toast('Projeto apagado.');
    }).catch(function(){ toast('Não deu para apagar o projeto.'); });
}

/* ------------------------------------------------------------------ *
 * entrada — chamado pelo renderGestao do app.js a cada recarga
 * ------------------------------------------------------------------ */

function pjRender(){
  if (!PJ.montado){ pjMontar(); return; }
  var b = $('badgeProjetos');
  if (b) b.textContent = (G.projects || []).filter(function(p){ return p.status !== 'concluido'; }).length || '';
  if (PJ.aberto !== null){
    /* A pagina aberta desenha-se do detalhe, que vem do servidor; aqui so se
       garante que os dados de apoio (pessoas, areas) estao frescos. */
    if (PJ.det) pjRenderPagina();
    return;
  }
  pjRenderFiltros();
  pjRenderCards();
  if ($('pjArea')) pjEncherAreas($('pjArea'), $('pjArea').value);
  if ($('pjMembros') && typeof construirChips === 'function') construirChips('pjMembros', G.people || []);
}

(function esperarApp(tentativa){
  tentativa = tentativa || 0;
  if ($('view-projetos') && window.G){ pjMontar(); return; }
  if (tentativa < 40) setTimeout(function(){ esperarApp(tentativa + 1); }, 250);
})();
