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
 * Tres niveis, e mais nenhum: PROGRAMA > PROJETO > TAREFA. Um programa e uma
 * linha de projects com tipo='programa'; nao tem trabalho proprio, guarda
 * projetos. As regras vivem no servidor (um programa nao pende de nada, um
 * projeto so pende de um programa, uma tarefa nunca pende de um programa) e
 * daí sai de graca a impossibilidade de um ciclo.
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
  arrasta: null,
  /* A arvore: um programa esta aberto salvo ordem em contrario (por isso o
     !== false), um projeto tem as tarefas recolhidas salvo ordem em contrario
     (por isso o === true). E o que se ve ao entrar: os projetos todos, e as
     tarefas so do projeto em que se esta a trabalhar. */
  progAbertos: {},
  projAbertos: {},
  sel: null           // { tipo: 'programa'|'projeto'|'tarefa', id: <n> }
};

var PJ_ESTADOS = [
  ['planeado',  'Planeado',  'warn'],
  ['ativo',     'A andar',   'accent'],
  ['suspenso',  'Suspenso',  ''],
  ['concluido', 'Concluído', 'good']
];
var PJ_PAPEIS = [['responsavel', 'Responsável'], ['participante', 'Participante'], ['informado', 'Informado']];
var PJ_TIPOS = [['programa', 'Programa'], ['projeto', 'Projeto']];

function pjEhPrograma(pr){ return pr && pr.tipo === 'programa'; }
function pjProgramas(){ return (G.projects || []).filter(pjEhPrograma); }
function pjFilhos(id){ return (G.projects || []).filter(function(p){ return p.parent_id === id; }); }
/* As tarefas que o cartao de um projeto conhece sem abrir nada. Num programa
   sao as dos projetos dele: ele proprio nao tem nenhuma. */
function pjAbertasDe(pr){
  var ids = pjEhPrograma(pr) ? pjFilhos(pr.id).map(function(f){ return f.id; }) : [pr.id];
  return (G.tasks || []).filter(function(t){
    return ids.indexOf(t.project_id) >= 0 && t.status !== 'concluida' && t.status !== 'cancelada';
  }).length;
}

var PJ_CSS = [
  "#view-projetos .pj-bar{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}",
  "#view-projetos .pj-bar .tabs{margin-bottom:0}",
  "#view-projetos .pj-bar .btn.small{margin-left:auto}",
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
  "#view-projetos .pj-lin .pj-m,#view-projetos .pj-mini .pj-m{display:flex;flex-wrap:wrap;gap:4px 8px;margin-top:3px;font-size:.72rem;color:var(--muted)}",
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
  "#view-projetos .pj-lista{display:grid;grid-template-columns:minmax(0,1fr) 23rem;gap:16px;align-items:start}",
  "#view-projetos .pj-arv{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:6px 8px;min-width:0}",
  "#view-projetos .pj-bloco{border:1px solid var(--line-soft);background:var(--surface-2);border-radius:10px;margin:6px 0;padding:4px 6px 2px}",
  "#view-projetos .pj-bloco.sel{border-color:var(--accent);background:var(--accent-soft)}",
  "#view-projetos .pj-bloco.arrastado{opacity:.4}",
  "#view-projetos .pj-bloco.alvo,#view-projetos .pj-no.alvo{box-shadow:0 0 0 2px var(--accent)}",
  "#view-projetos .pj-no{display:flex;align-items:center;gap:10px;padding:8px 8px;border-radius:8px}",
  "#view-projetos .pj-no.n2{padding:7px 8px}",
  "#view-projetos .pj-no.sel{background:var(--accent-soft);box-shadow:inset 2px 0 0 var(--accent)}",
  "#view-projetos .pj-no.arrastado{opacity:.4}",
  "#view-projetos .pj-filhos{padding:0 0 6px 11px;margin-left:11px;border-left:1px solid var(--line-soft)}",
  "#view-projetos .pj-seta{flex:none;width:22px;height:22px;border:0;background:none;color:var(--muted);border-radius:6px;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center}",
  "#view-projetos .pj-seta:hover{background:var(--surface);color:var(--ink)}",
  "#view-projetos .pj-seta svg{transition:transform .15s}",
  "#view-projetos .pj-seta.on svg{transform:rotate(90deg)}",
  "#view-projetos .pj-rot{flex:1 1 auto;min-width:5rem;text-align:left;border:0;background:none;padding:0;cursor:pointer;display:flex;align-items:center;gap:9px;font:inherit;color:var(--ink)}",
  "#view-projetos .pj-rot .t1{font-family:var(--serif);font-size:1.0625rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  "#view-projetos .pj-rot .t2{flex:0 1 auto;font-size:.875rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  "#view-projetos .pj-rot .onde{flex:0 60 auto;min-width:0;font-size:.72rem;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  "#view-projetos .pj-meta{flex:none;font-family:var(--mono);font-size:.6875rem;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  "#view-projetos .pj-meta.bad{color:var(--bad)} #view-projetos .pj-meta.warn{color:var(--warn)} #view-projetos .pj-meta.faint{color:var(--faint)}",
  "#view-projetos .pj-meta.data{width:6.5rem;text-align:right}",
  "#view-projetos .pj-meta.conta{width:5.5rem;text-align:right}",
  "#view-projetos .pj-tar{display:flex;align-items:center;gap:9px;width:100%;border:0;border-top:1px solid var(--line-soft);background:none;padding:6px 8px;border-radius:7px;cursor:pointer;font:inherit;text-align:left}",
  "#view-projetos .pj-tar:hover{background:var(--surface-2)}",
  "#view-projetos .pj-tar.sel{background:var(--accent-soft)}",
  "#view-projetos .pj-tar .cx{flex:none;width:14px;height:14px;border-radius:4px;border:1.5px solid var(--line-strong,#C3D0D1);background:var(--surface)}",
  "#view-projetos .pj-tar .cx.bad{border-color:var(--bad)} #view-projetos .pj-tar .cx.warn{border-color:var(--warn)}",
  "#view-projetos .pj-tar .tt{flex:1;min-width:0;font-size:.8125rem;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  "#view-projetos .pj-tar .quem{flex:none;display:flex;align-items:center;gap:5px;font-size:.72rem;color:var(--faint)}",
  "#view-projetos .pj-tar .quem i{width:7px;height:7px;border-radius:50%}",
  "#view-projetos .pj-tarefas{padding:2px 0 8px 33px}",
  "#view-projetos .pj-nada{padding:6px 4px;font-size:.75rem;color:var(--faint)}",
  "#view-projetos .pj-grip{flex:none;width:14px;color:var(--line);cursor:grab;line-height:0;padding:0;border:0;background:none;opacity:0}",
  "#view-projetos .pj-no:hover .pj-grip,#view-projetos .pj-grip:focus{opacity:1}",
  "#view-projetos .pj-painel{position:sticky;top:96px;max-height:calc(100vh - 116px);overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:16px 16px 18px;display:flex;flex-direction:column;gap:13px}",
  "#view-projetos .pj-painel > header{display:flex;align-items:center;gap:8px}",
  "#view-projetos .pj-painel > header .mono{flex:1}",
  "#view-projetos .pj-painel h2{font-family:var(--serif);font-size:1.3125rem;font-weight:600;line-height:1.25}",
  "#view-projetos .pj-painel .pj-desc{font-size:.8125rem;line-height:1.5;color:var(--ink-2);margin-top:5px}",
  "#view-projetos .pj-subir{display:inline-flex;align-items:center;gap:6px;border:0;background:none;font:inherit;font-size:.75rem;color:var(--muted);cursor:pointer;padding:0 0 4px}",
  "#view-projetos .pj-subir:hover{color:var(--accent-ink)}",
  "#view-projetos .pj-sec{border-top:1px solid var(--line-soft);padding-top:11px}",
  "#view-projetos .pj-sec > .mono{display:block;margin-bottom:7px}",
  "#view-projetos .pj-ficha > span.pj-v{font-family:var(--sans);font-size:.8125rem;letter-spacing:0;text-transform:none;color:var(--ink)}",
  /* No painel ve-se e mexe-se no mesmo sitio: o titulo e as notas sao campos
     que so se notam ao passar por cima. */
  "#view-projetos .pj-tit{width:100%;box-sizing:border-box;font:inherit;font-family:var(--serif);font-size:1.3125rem;font-weight:600;line-height:1.25;color:var(--ink);border:0;background:none;resize:none;padding:2px 4px;margin:0 -4px;overflow:hidden;border-radius:6px}",
  "#view-projetos .pj-notas{width:100%;box-sizing:border-box;font:inherit;font-size:.8125rem;line-height:1.5;color:var(--ink-2);border:0;background:none;resize:none;padding:4px;margin:3px -4px 0;overflow:hidden;border-radius:6px}",
  "#view-projetos .pj-tit:hover,#view-projetos .pj-notas:hover{background:var(--surface-2)}",
  "#view-projetos .pj-tit:focus,#view-projetos .pj-notas:focus{outline:0;background:var(--surface-2)}",
  "#view-projetos .pj-notas::placeholder{color:var(--faint)}",
  "#view-projetos .pj-passo{display:flex;align-items:center;gap:8px;padding:2px 0}",
  "#view-projetos .pj-passo input[type=text]{flex:1;min-width:0;width:auto;font:inherit;font-size:.8125rem;border:0;background:none;color:var(--ink);padding:3px 0;border-radius:0}",
  "#view-projetos .pj-passo input[type=text]:focus{outline:0;border-bottom:1px solid var(--accent)}",
  "#view-projetos .pj-passo.feito input[type=text]{color:var(--faint);text-decoration:line-through}",
  "#view-projetos .pj-cx{flex:none;width:15px;height:15px;border-radius:4px;border:1.5px solid var(--line);background:var(--surface);cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;line-height:1}",
  "#view-projetos .pj-cx.on{background:var(--accent);border-color:var(--accent)}",
  "#view-projetos .pj-passo .pj-x{flex:none;border:0;background:none;color:var(--faint);cursor:pointer;padding:2px 4px;border-radius:6px;font-size:.9rem;line-height:1;opacity:0}",
  "#view-projetos .pj-passo:hover .pj-x,#view-projetos .pj-passo .pj-x:focus{opacity:1}",
  "#view-projetos .pj-passo .pj-x:hover{background:var(--surface-2);color:var(--bad)}",
  "#view-projetos .pj-novo{width:100%;box-sizing:border-box;font:inherit;font-size:.8125rem;color:var(--ink);border:0;border-top:1px dashed var(--line-soft);background:none;padding:6px 0 2px;margin-top:2px}",
  "#view-projetos .pj-novo:focus{outline:0}",
  "@media (max-width:1100px){#view-projetos .pj-lista{grid-template-columns:minmax(0,1fr)}",
  "  #view-projetos .pj-painel{position:static;max-height:none}}",
  "#view-projetos .pj-etq{display:inline-block;font-family:var(--mono);font-size:.5625rem;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);border:1px solid var(--line);border-radius:99px;padding:1px 7px}",
  "#view-projetos .pj-pai{display:inline-flex;align-items:center;gap:6px;border:0;background:none;font:inherit;font-size:.8125rem;color:var(--muted);cursor:pointer;padding:2px 0;margin-bottom:2px}",
  "#view-projetos .pj-pai:hover{color:var(--accent-ink)}",
  "#view-projetos .pj-pai b{font-weight:500;color:var(--ink-2)}",
  "#view-projetos .pj-mini{display:flex;align-items:center;gap:10px;padding:9px 6px;border-top:1px solid var(--line-soft);border-radius:7px;cursor:pointer}",
  "#view-projetos .pj-mini:first-child{border-top-color:transparent}",
  "#view-projetos .pj-mini:hover{background:var(--surface-2)}",
  "#view-projetos .pj-mini .pj-corpo-lin{flex:1;min-width:0}",
  "#view-projetos .pj-mini .pj-barra{margin-top:5px;max-width:14rem}",
  "#view-projetos .pj-aviso{display:flex;gap:8px;align-items:flex-start;background:var(--warn-soft);color:var(--warn);border-radius:8px;padding:8px 10px;font-size:.8125rem;margin-top:10px}",
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

  /* Duas colunas: a arvore a esquerda, e o detalhe do que estiver escolhido
     sempre no mesmo sitio a direita. Nao ha salto de pagina para ver uma
     coisa: o contexto fica a vista enquanto se le o detalhe. */
  var corpo = el('div', 'pj-lista');
  var arv = el('div', 'pj-arv');
  arv.id = 'pjArvore';
  corpo.appendChild(arv);
  var painel = el('aside', 'pj-painel');
  painel.id = 'pjPainel';
  corpo.appendChild(painel);
  lista.appendChild(corpo);
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
  var tipo = el('select');
  PJ_TIPOS.forEach(function(x){ tipo.appendChild(new Option(x[1], x[0])); });
  tipo.value = 'projeto';
  var prog = el('select');
  prog.id = 'pjProgNovo';

  f.appendChild(campo('Nome', nome));
  f.appendChild(campo('Do que se trata', desc));
  var linha0 = el('div', 'field-row');
  linha0.appendChild(campo('O que é', tipo));
  var campoProg = campo('Dentro do programa', prog);
  linha0.appendChild(campoProg);
  f.appendChild(linha0);
  var linha = el('div', 'field-row');
  linha.appendChild(campo('Área', area));
  linha.appendChild(campo('Para quando', alvo));
  f.appendChild(linha);

  /* Um programa nao pende de nada: quando se escolhe programa, o campo do
     programa desaparece em vez de ficar la a oferecer o impossivel. */
  function acertarTipo(){
    campoProg.hidden = tipo.value === 'programa';
    if (tipo.value === 'programa') prog.value = '';
  }
  tipo.addEventListener('change', acertarTipo);
  acertarTipo();

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
        tipo: tipo.value,
        parent_id: tipo.value === 'programa' ? null : (prog.value || null),
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
   por defeito era a maneira mais facil de o esquecer.
   Um programa fica a vista enquanto tiver um projeto a vista: escondia-se a
   casa toda por causa do estado da porta. */
function pjCabe(pr){
  if (PJ.filtro === 'todos') return true;
  if (PJ.filtro === 'planeados') return pr.status === 'planeado';
  if (PJ.filtro === 'concluidos') return pr.status === 'concluido';
  return pr.status !== 'concluido';
}
function pjFiltrados(){
  return (G.projects || []).filter(function(pr){
    if (pr.parent_id) return false;   /* os filhos aparecem dentro do programa */
    if (pjCabe(pr)) return true;
    return pjEhPrograma(pr) && pjFilhos(pr.id).some(pjCabe);
  });
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
    var box = $('pjArvore');
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
 * a arvore: programa > projeto > tarefa
 * ------------------------------------------------------------------ */

/* Um programa esta aberto salvo ordem em contrario; um projeto tem as tarefas
   recolhidas salvo ordem em contrario. Ao entrar ve-se a estrutura toda e
   nenhuma tarefa: a lista nunca cresce para la do que se consegue ler. */
function pjProgAberto(id){ return PJ.progAbertos[id] !== false; }
function pjProjAberto(id){ return PJ.projAbertos[id] === true; }

function pjEscolher(tipo, id){
  PJ.sel = { tipo: tipo, id: id };
  pjRenderArvore();
  pjRenderPainel();
}
function pjEscolhido(tipo, id){
  return PJ.sel && PJ.sel.tipo === tipo && PJ.sel.id === id;
}

/* As tarefas por fazer de um projeto, na ordem em que o servidor as mandou
   (prazo primeiro). Os lembretes e as notas nao sao trabalho por fazer. */
function pjTarefasDe(id){
  return (G.tasks || []).filter(function(t){
    return t.project_id === id && t.status !== 'concluida' && t.status !== 'cancelada';
  });
}

function pjSeta(aberto, titulo, aoClicar){
  var b = el('button', 'pj-seta' + (aberto ? ' on' : ''));
  b.type = 'button';
  b.title = titulo;
  b.setAttribute('aria-expanded', aberto ? 'true' : 'false');
  b.setAttribute('aria-label', titulo);
  b.innerHTML = pjSvg('<path d="M9 6l6 6-6 6"/>', 13);
  b.addEventListener('click', function(e){ e.stopPropagation(); aoClicar(); });
  return b;
}

function pjGrip(){
  var g = el('button', 'pj-grip');
  g.type = 'button';
  g.title = 'Arrastar para reordenar';
  g.setAttribute('aria-label', 'Arrastar para reordenar');
  g.draggable = true;
  g.innerHTML = pjSvg('<path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01"/>', 14);
  return g;
}

function pjMeta(texto, nivel, classe){
  var n = el('span', 'pj-meta' + (nivel ? ' ' + nivel : '') + (classe ? ' ' + classe : ''), texto);
  return n;
}

/* A barra de progresso de um projeto, com as contagens que vem do servidor.
   Sem contagem nao se desenha barra nenhuma: melhor nada do que uma barra
   inventada. */
function pjBarrinha(c){
  if (!c || !c.total) return null;
  var pct = Math.round((c.feitas / c.total) * 100);
  var b = el('span', 'pj-barra' + (pct === 100 ? ' cheia' : ''));
  b.style.cssText = 'flex:none;width:6.5rem';
  var i = el('i');
  i.style.width = pct + '%';
  b.appendChild(i);
  return b;
}
function pjProgressoTexto(c){
  if (!c || !c.total) return 'sem tarefas';
  return c.feitas + '/' + c.total + ' · ' + Math.round((c.feitas / c.total) * 100) + '%';
}

function pjRenderArvore(){
  var box = $('pjArvore');
  if (!box) return;
  clear(box);
  var lista = pjFiltrados();
  if (!lista.length){
    box.appendChild(el('p', 'vazio', (G.projects || []).length
      ? 'Nenhum projeto neste filtro.'
      : 'Ainda sem programas nem projetos.'));
    return;
  }
  lista.forEach(function(pr){
    if (pjEhPrograma(pr)) box.appendChild(pjNoPrograma(pr));
    else box.appendChild(pjNoProjeto(pr, true));
  });
}

function pjNoPrograma(pr){
  var bloco = el('section', 'pj-bloco' + (pjEscolhido('programa', pr.id) ? ' sel' : ''));
  bloco.dataset.id = pr.id;

  var aberto = pjProgAberto(pr.id);
  var linha = el('div', 'pj-no n1');
  var grip = pjGrip();
  linha.appendChild(grip);
  linha.appendChild(pjSeta(aberto, 'Abrir ou fechar o programa', function(){
    PJ.progAbertos[pr.id] = !aberto;
    pjRenderArvore();
  }));

  var rot = el('button', 'pj-rot');
  rot.type = 'button';
  rot.appendChild(el('span', 'pj-etq', 'Programa'));
  rot.appendChild(el('span', 't1', pr.name));
  var est = pjEstado(pr.status);
  rot.appendChild(pill(est[1], est[2]));
  rot.addEventListener('click', function(){ pjEscolher('programa', pr.id); });
  linha.appendChild(rot);

  var filhos = pjFilhos(pr.id);
  var abertas = pjAbertasDe(pr);
  linha.appendChild(pjMeta(filhos.length + (filhos.length === 1 ? ' projeto' : ' projetos')
    + ' · ' + abertas + ' por fazer'));
  /* Na linha vai quanto falta, nao a data: «em 40 dias» decide-se de relance,
     «31 out» obriga a fazer a conta. A data exacta esta no painel e no title. */
  if (pr.target_on){
    var u = urgencia(diasAte(pr.target_on), 'tarefa');
    linha.appendChild(pjMeta('fim ' + (u.texto || dataCurta(pr.target_on)), u.nivel, 'data',
      'Fim em ' + dataCurta(pr.target_on)));
  } else {
    linha.appendChild(pjMeta('sem data de fim', 'faint', 'data'));
  }
  bloco.appendChild(linha);
  pjArrastavel(bloco, grip, pr.id);

  if (aberto){
    var dentro = el('div', 'pj-filhos');
    var visiveis = filhos.filter(pjCabe);
    if (!visiveis.length){
      dentro.appendChild(el('p', 'pj-nada', filhos.length
        ? 'Nenhum projeto deste programa neste filtro.'
        : 'Programa ainda sem projetos.'));
    } else {
      visiveis.forEach(function(f){ dentro.appendChild(pjNoProjeto(f, false)); });
    }
    bloco.appendChild(dentro);
  }
  return bloco;
}

function pjNoProjeto(pr, solto){
  var caixa = el('div');
  var aberto = pjProjAberto(pr.id);
  var tarefas = pjTarefasDe(pr.id);

  var linha = el('div', 'pj-no n2' + (pjEscolhido('projeto', pr.id) ? ' sel' : ''));
  linha.dataset.id = pr.id;
  var grip = pjGrip();
  if (solto) linha.appendChild(grip);
  linha.appendChild(pjSeta(aberto, 'Abrir ou fechar as tarefas', function(){
    PJ.projAbertos[pr.id] = !aberto;
    pjRenderArvore();
  }));

  var rot = el('button', 'pj-rot');
  rot.type = 'button';
  rot.appendChild(el('span', 't2', pr.name));
  rot.appendChild(el('span', 'onde', areaNome(pr.context_id)));
  rot.addEventListener('click', function(){ pjEscolher('projeto', pr.id); });
  linha.appendChild(rot);

  var est = pjEstado(pr.status);
  linha.appendChild(pill(est[1], est[2]));
  var barra = pjBarrinha(pr.contagem);
  if (barra) linha.appendChild(barra);
  linha.appendChild(pjMeta(pjProgressoTexto(pr.contagem), '', 'conta'));

  if (pr.status === 'planeado' && pr.depends_on_id){
    linha.appendChild(pjMeta('a aguardar', 'faint', 'data',
      'A aguardar ' + projetoNome(pr.depends_on_id)));
  } else if (pr.target_on){
    var u2 = urgencia(diasAte(pr.target_on), 'tarefa');
    linha.appendChild(pjMeta(u2.texto || dataCurta(pr.target_on), u2.nivel, 'data',
      'Para ' + dataCurta(pr.target_on)));
  } else {
    linha.appendChild(pjMeta('sem data', 'faint', 'data'));
  }
  caixa.appendChild(linha);
  if (solto) pjArrastavel(linha, grip, pr.id);

  if (aberto){
    var box = el('div', 'pj-tarefas');
    if (!tarefas.length){
      box.appendChild(el('p', 'pj-nada', 'Sem tarefas por fazer neste projeto.'));
    } else {
      tarefas.forEach(function(t){ box.appendChild(pjNoTarefa(t)); });
    }
    caixa.appendChild(box);
  }
  return caixa;
}

function pjNoTarefa(t){
  var b = el('button', 'pj-tar' + (pjEscolhido('tarefa', t.id) ? ' sel' : ''));
  b.type = 'button';
  var atraso = t.due_on && diasAte(t.due_on) < 0;
  var perto = t.due_on && !atraso && diasAte(t.due_on) <= 7;
  b.appendChild(el('span', 'cx' + (atraso ? ' bad' : perto ? ' warn' : '')));
  b.appendChild(el('span', 'tt', t.title));

  var dono = pessoa(t.owner_id);
  if (dono){
    var q = el('span', 'quem');
    var i = el('i');
    i.style.background = dono.color || 'var(--c1)';
    q.appendChild(i);
    q.appendChild(document.createTextNode(dono.name));
    b.appendChild(q);
  }
  if (t.due_on){
    var u = urgencia(diasAte(t.due_on), 'tarefa');
    b.appendChild(pjMeta(u.texto || dataCurta(t.due_on), u.nivel, 'data', 'Prazo ' + dataCurta(t.due_on)));
  } else {
    b.appendChild(pjMeta('sem prazo', 'faint', 'data'));
  }
  b.addEventListener('click', function(){ pjEscolher('tarefa', t.id); });
  return b;
}

/* ------------------------------------------------------------------ *
 * o painel da direita — sempre o mesmo sitio, seja o que for
 * ------------------------------------------------------------------ */

function pjRenderPainel(){
  var box = $('pjPainel');
  if (!box) return;
  var foco = pjFocoPainel();
  clear(box);
  setTimeout(function(){ pjDevolverFoco(foco); }, 0);
  if (!PJ.sel){
    box.appendChild(el('p', 'vazio', 'Escolhe um programa, um projeto ou uma tarefa para o veres aqui.'));
    return;
  }
  if (PJ.sel.tipo === 'tarefa') return pjPainelTarefa(box);
  var pr = projeto(PJ.sel.id);
  if (!pr){
    PJ.sel = null;
    return pjRenderPainel();
  }
  return pjEhPrograma(pr) ? pjPainelPrograma(box, pr) : pjPainelProjeto(box, pr);
}

function pjCabecaPainel(box, etiqueta, aoAbrir, rotuloBotao){
  var h = el('header');
  h.appendChild(el('span', 'mono', etiqueta));
  var b = el('button', 'btn small', rotuloBotao || 'Abrir');
  b.type = 'button';
  b.style.marginLeft = '0';
  b.addEventListener('click', aoAbrir);
  h.appendChild(b);
  box.appendChild(h);
}

function pjSubir(texto, aoClicar){
  var b = el('button', 'pj-subir');
  b.type = 'button';
  b.innerHTML = pjSvg('<path d="M12 19V5M5 12l7-7 7 7"/>', 12);
  b.appendChild(document.createTextNode(' ' + texto));
  b.addEventListener('click', aoClicar);
  return b;
}

function pjNumerosPainel(box, nums){
  var linha = el('div', 'pj-nums');
  linha.style.margin = '0';
  nums.forEach(function(n){
    if (n[0] === null) return;
    var d = el('div', 'pj-num' + (n[2] ? ' ' + n[2] : ''));
    d.appendChild(el('b', null, n[0]));
    d.appendChild(el('span', null, n[1]));
    linha.appendChild(d);
  });
  box.appendChild(linha);
}

function pjSeccao(box, titulo){
  var s = el('div', 'pj-sec');
  s.appendChild(el('span', 'mono', titulo));
  box.appendChild(s);
  return s;
}

/* ------------------------------------------------------------------ *
 * o painel edita
 *
 * Ver e mexer sao a mesma coisa: os valores do painel sao campos e gravam
 * quando se sai deles. Um botao «Editar» so adiava o que a pessoa ja tinha
 * decidido fazer, e um segundo formulario era mais um sitio onde a mesma
 * regra podia passar a divergir da pagina do projeto e da lista das tarefas.
 * ------------------------------------------------------------------ */

/* Gravar redesenha o painel inteiro. Sem isto, escrever o titulo e carregar
   em Tab dava um campo em branco e o cursor no principio. */
function pjFocoPainel(){
  var a = document.activeElement;
  var box = $('pjPainel');
  if (!a || !box || !box.contains(a) || !a.dataset.pjk) return null;
  var f = { k: a.dataset.pjk, ini: null, fim: null };
  try { f.ini = a.selectionStart; f.fim = a.selectionEnd; } catch (e) {}
  return f;
}
function pjDevolverFoco(f){
  if (!f) return;
  var n = document.querySelector('#pjPainel [data-pjk="' + f.k + '"]');
  if (!n) return;
  n.focus();
  if (f.ini != null && n.setSelectionRange){ try { n.setSelectionRange(f.ini, f.fim); } catch (e) {} }
}

function pjFichaEditavel(box){
  var g = el('div', 'pj-ficha');
  g.style.borderTop = '1px solid var(--line-soft)';
  g.style.paddingTop = '11px';
  box.appendChild(g);
  return g;
}
function pjCampo(g, rotulo, no, chave){
  if (chave) no.dataset.pjk = chave;
  g.appendChild(el('span', null, rotulo));
  g.appendChild(no);
  return no;
}
function pjEscolha(opcoes, valor, aoMudar){
  var s = el('select');
  opcoes.forEach(function(o){ s.appendChild(new Option(o[1], o[0])); });
  s.value = valor == null ? '' : String(valor);
  s.addEventListener('change', function(){ aoMudar(s.value); });
  return s;
}
function pjCampoData(valor, aoMudar){
  var i = el('input');
  i.type = 'date';
  i.value = valor || '';
  i.addEventListener('change', function(){ aoMudar(i.value || null); });
  return i;
}
function pjCampoTexto(valor, dica, aoMudar){
  var i = el('input');
  i.type = 'text';
  i.value = valor == null ? '' : String(valor);
  if (dica) i.placeholder = dica;
  i.addEventListener('change', function(){ aoMudar(i.value); });
  return i;
}
function pjCampoArea(valor, aoMudar){
  var s = el('select');
  pjEncherAreas(s, valor);
  s.addEventListener('change', function(){ aoMudar(s.value ? Number(s.value) : null); });
  return s;
}
/* Os projetos aparecem debaixo do programa a que pertencem, e um programa e
   so o cabecalho do grupo: uma tarefa nao pode pendurar-se num programa, e
   oferecer-lha para depois o servidor recusar era enganar duas vezes. */
function pjCampoProjeto(valor, aoMudar){
  var s = el('select');
  s.appendChild(new Option('\u2014 sem projeto \u2014', ''));
  var soltos = (G.projects || []).filter(function(x){ return !pjEhPrograma(x) && !x.parent_id; });
  soltos.forEach(function(x){ s.appendChild(new Option(x.name, x.id)); });
  pjProgramas().forEach(function(pg){
    var filhos = pjFilhos(pg.id).filter(function(x){ return !pjEhPrograma(x); });
    if (!filhos.length) return;
    var g = document.createElement('optgroup');
    g.label = pg.name;
    filhos.forEach(function(x){ g.appendChild(new Option(x.name, x.id)); });
    s.appendChild(g);
  });
  s.value = valor == null ? '' : String(valor);
  s.addEventListener('change', function(){ aoMudar(s.value ? Number(s.value) : null); });
  return s;
}
function pjTextoAuto(no, guardar){
  var v0 = no.value;
  var ajusta = function(){ no.style.height = 'auto'; no.style.height = no.scrollHeight + 'px'; };
  no.addEventListener('input', ajusta);
  setTimeout(ajusta, 0);
  no.addEventListener('blur', function(){ if (no.value !== v0){ v0 = no.value; guardar(no.value); } });
}
function pjTitulo(box, valor, chave, guardar){
  var t = el('textarea', 'pj-tit');
  t.rows = 1;
  t.value = valor || '';
  t.dataset.pjk = chave;
  t.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); t.blur(); } });
  /* Um nome em branco nao e uma correccao, e um engano: fica o que la estava. */
  pjTextoAuto(t, function(v){
    if (v.trim()) return guardar(v.trim());
    t.value = valor || '';
    toast('Um nome em branco não dá: fica o que lá estava.');
  });
  box.appendChild(t);
  return t;
}
function pjNotasCampo(box, valor, chave, dica, guardar){
  var n = el('textarea', 'pj-notas');
  n.rows = 1;
  n.value = valor || '';
  n.placeholder = dica;
  n.dataset.pjk = chave;
  pjTextoAuto(n, function(v){ guardar(v.trim() || null); });
  box.appendChild(n);
  return n;
}
/* Fechar poe a data de fecho e reabrir tira-a: sem isto ficava um projeto
   «a andar» com data de conclusao, que e a mesma mentira ao contrario. */
function pjCampoEstado(pr){
  return pjEscolha(PJ_ESTADOS.map(function(x){ return [x[0], x[1]]; }), pr.status || 'ativo', function(v){
    pjGuardarProjeto(pr.id, v === 'concluido'
      ? { status: v, closed_on: pr.closed_on || new Date().toISOString().slice(0, 10) }
      : { status: v, closed_on: null });
  });
}

function pjPainelPrograma(box, pr){
  pjCabecaPainel(box, 'Programa', function(){ pjAbrir(pr.id); });
  var t = el('div');
  pjTitulo(t, pr.name, 'nome', function(v){ pjGuardarProjeto(pr.id, { name: v }); });
  pjNotasCampo(t, pr.description, 'desc', 'Para que serve este programa\u2026',
    function(v){ pjGuardarProjeto(pr.id, { description: v }); });
  box.appendChild(t);

  var filhos = pjFilhos(pr.id);
  var soma = filhos.reduce(function(a, f){
    var c = f.contagem || { total: 0, feitas: 0, atrasadas: 0 };
    return { total: a.total + c.total, feitas: a.feitas + c.feitas, atrasadas: a.atrasadas + c.atrasadas };
  }, { total: 0, feitas: 0, atrasadas: 0 });
  var pct = soma.total ? Math.round((soma.feitas / soma.total) * 100) : 0;

  var barra = el('div', 'pj-barra' + (pct === 100 ? ' cheia' : ''));
  var i = el('i');
  i.style.width = pct + '%';
  barra.appendChild(i);
  box.appendChild(barra);

  pjNumerosPainel(box, [
    [pct + '%', soma.feitas + ' de ' + soma.total],
    [String(soma.total - soma.feitas), 'por fazer'],
    [soma.atrasadas ? String(soma.atrasadas) : null, 'em atraso', 'bad'],
    [String(filhos.length), filhos.length === 1 ? 'projeto' : 'projetos']
  ]);

  var gp = pjFichaEditavel(box);
  pjCampo(gp, 'Área', pjCampoArea(pr.context_id, function(v){ pjGuardarProjeto(pr.id, { context_id: v }); }), 'area');
  pjCampo(gp, 'Estado', pjCampoEstado(pr), 'estado');
  pjCampo(gp, 'Início', pjCampoData(pr.started_on, function(v){ pjGuardarProjeto(pr.id, { started_on: v }); }), 'inicio');
  pjCampo(gp, 'Fim', pjCampoData(pr.target_on, function(v){ pjGuardarProjeto(pr.id, { target_on: v }); }), 'fim');

  var eq = (pr.members || []).map(function(m){
    var p = pessoa(m.person_id);
    return p ? [p, m.member_role] : null;
  }).filter(Boolean);
  if (eq.length){
    var s = pjSeccao(box, 'Quem anda nisto');
    eq.forEach(function(x){
      var l = el('div');
      l.style.cssText = 'display:flex;align-items:center;gap:8px;padding:3px 0;font-size:.8125rem';
      var d = el('i');
      d.style.cssText = 'width:8px;height:8px;border-radius:50%;flex:none;background:' + (x[0].color || 'var(--c1)');
      l.appendChild(d);
      l.appendChild(el('span', null, x[0].name));
      var papel = el('span', null, x[1] === 'responsavel' ? 'Responsável'
        : x[1] === 'informado' ? 'Informado' : 'Participante');
      papel.style.cssText = 'margin-left:auto;font-size:.72rem;color:var(--muted)';
      l.appendChild(papel);
      s.appendChild(l);
    });
  }

  if (filhos.length){
    var sp = pjSeccao(box, 'Projetos deste programa');
    filhos.forEach(function(f){
      var l = el('button');
      l.type = 'button';
      l.style.cssText = 'display:flex;align-items:baseline;gap:10px;width:100%;border:0;border-top:1px solid var(--line-soft);background:none;padding:6px 0;font:inherit;font-size:.8125rem;text-align:left;cursor:pointer;color:var(--ink-2)';
      var n = el('span', null, f.name);
      n.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      l.appendChild(n);
      l.appendChild(pjMeta(pjProgressoTexto(f.contagem)));
      l.addEventListener('click', function(){ pjEscolher('projeto', f.id); });
      sp.appendChild(l);
    });
  }
}

function pjPainelProjeto(box, pr){
  pjCabecaPainel(box, 'Projeto', function(){ pjAbrir(pr.id); });
  var t = el('div');
  if (pr.parent_id){
    t.appendChild(pjSubir(projetoNome(pr.parent_id), function(){ pjEscolher('programa', pr.parent_id); }));
  }
  pjTitulo(t, pr.name, 'nome', function(v){ pjGuardarProjeto(pr.id, { name: v }); });
  pjNotasCampo(t, pr.description, 'desc', 'O que e este projeto\u2026',
    function(v){ pjGuardarProjeto(pr.id, { description: v }); });
  box.appendChild(t);

  var c = pr.contagem || { total: 0, feitas: 0, atrasadas: 0 };
  var pct = c.total ? Math.round((c.feitas / c.total) * 100) : 0;
  var barra = el('div', 'pj-barra' + (pct === 100 ? ' cheia' : ''));
  var i = el('i');
  i.style.width = pct + '%';
  barra.appendChild(i);
  box.appendChild(barra);

  pjNumerosPainel(box, [
    [pct + '%', c.feitas + ' de ' + c.total],
    [String(c.total - c.feitas), 'por fazer'],
    [c.atrasadas ? String(c.atrasadas) : null, 'em atraso', 'bad']
  ]);

  var gj = pjFichaEditavel(box);
  var progs = [['', '\u2014 fora de programa \u2014']].concat(
    pjProgramas().map(function(x){ return [String(x.id), x.name]; }));
  pjCampo(gj, 'Programa', pjEscolha(progs, pr.parent_id || '', function(v){
    pjGuardarProjeto(pr.id, { parent_id: v ? Number(v) : null });
  }), 'pai');
  pjCampo(gj, 'Área', pjCampoArea(pr.context_id, function(v){ pjGuardarProjeto(pr.id, { context_id: v }); }), 'area');
  pjCampo(gj, 'Estado', pjCampoEstado(pr), 'estado');
  pjCampo(gj, 'Início', pjCampoData(pr.started_on, function(v){ pjGuardarProjeto(pr.id, { started_on: v }); }), 'inicio');
  pjCampo(gj, 'Para quando', pjCampoData(pr.target_on, function(v){ pjGuardarProjeto(pr.id, { target_on: v }); }), 'fim');
  var deps = [['', '\u2014 de nenhum \u2014']].concat(
    (G.projects || []).filter(function(x){ return x.id !== pr.id && !pjEhPrograma(x); })
      .map(function(x){ return [String(x.id), x.name]; }));
  pjCampo(gj, 'À espera de', pjEscolha(deps, pr.depends_on_id || '', function(v){
    pjGuardarProjeto(pr.id, { depends_on_id: v ? Number(v) : null });
  }), 'dep');

  var tarefas = pjTarefasDe(pr.id);
  var s = pjSeccao(box, 'Tarefas por fazer');
  if (!tarefas.length){
    s.appendChild(el('p', 'pj-nada', 'Nenhuma.'));
    return;
  }
  tarefas.slice(0, 8).forEach(function(x){
    var l = el('button');
    l.type = 'button';
    l.style.cssText = 'display:flex;align-items:baseline;gap:10px;width:100%;border:0;border-top:1px solid var(--line-soft);background:none;padding:6px 0;font:inherit;font-size:.8125rem;text-align:left;cursor:pointer;color:var(--ink-2)';
    var n = el('span', null, x.title);
    n.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    l.appendChild(n);
    var u = x.due_on ? urgencia(diasAte(x.due_on), 'tarefa') : { texto: 'sem prazo', nivel: 'faint' };
    l.appendChild(pjMeta(u.texto, u.nivel));
    l.addEventListener('click', function(){
      PJ.projAbertos[pr.id] = true;
      pjEscolher('tarefa', x.id);
    });
    s.appendChild(l);
  });
  if (tarefas.length > 8){
    s.appendChild(el('p', 'pj-nada', 'e mais ' + (tarefas.length - 8) + '.'));
  }
}

function pjPainelTarefa(box){
  var t = (G.tasks || []).filter(function(x){ return x.id === PJ.sel.id; })[0];
  if (!t){
    PJ.sel = null;
    return pjRenderPainel();
  }
  var pr = projeto(t.project_id);
  var tipo = (t.tipo || 'tarefa');
  pjCabecaPainel(box, 'Tarefa', function(){
    show('tarefas');
    if (typeof tfAbrir === 'function') setTimeout(function(){ tfAbrir(t.id); }, 0);
  }, 'Abrir nas Tarefas');

  var topo = el('div');
  if (pr){
    var caminho = (pr.parent_id ? projetoNome(pr.parent_id) + ' › ' : '') + pr.name;
    topo.appendChild(pjSubir(caminho, function(){ pjEscolher('projeto', pr.id); }));
  }
  pjTitulo(topo, t.title, 'titulo', function(v){ tfGravar(t.id, { title: v }); });
  pjNotasCampo(topo, t.notes, 'notas', 'Notas…', function(v){ tfGravar(t.id, { notes: v }); });
  box.appendChild(topo);

  var g = pjFichaEditavel(box);

  /* Concluir e reabrir passam pelo mesmo caminho da lista das Tarefas: uma
     rotina tem de andar para a data seguinte, venha a ordem de onde vier. */
  var estados = TF_ESTADOS.concat(TF_ESTADOS_FIM).map(function(e){ return [e[0], e[1]]; });
  pjCampo(g, 'Estado', pjEscolha(estados, t.status || 'aberta', function(v){
    if (v !== t.status) tfMudarEstado(t, v);
  }), 'estado');

  pjCampo(g, 'De quem', pjEscolha(
    [['', '— de ninguém —']].concat((G.people || [])
      .filter(function(x){ return x.can_own_tasks && x.active !== false; })
      .map(function(x){ return [String(x.id), x.name]; })),
    t.owner_id || '', function(v){ tfGravar(t.id, { owner_id: v ? Number(v) : null }); }), 'quem');

  pjCampo(g, 'Prazo', pjCampoData(t.due_on, function(v){ tfGravar(t.id, { due_on: v }); }), 'prazo');
  if (t.due_on){
    var u = urgencia(diasAte(t.due_on), 'tarefa');
    var quando = el('span', 'pj-v', u.texto);
    if (u.nivel) quando.style.color = 'var(--' + u.nivel + ')';
    g.appendChild(el('span', null, ''));
    g.appendChild(quando);
  }

  pjCampo(g, 'Prioridade', pjEscolha(TF_PRIO, t.priority || 'normal',
    function(v){ tfGravar(t.id, { priority: v }); }), 'prio');

  pjCampo(g, 'Tipo', pjEscolha(TF_TIPOS.map(function(x){ return [x[0], x[1].replace(/s$/, '')]; }),
    tipo, function(v){ tfGravar(t.id, { tipo: v }); }), 'tipo');

  pjCampo(g, 'Projeto', pjCampoProjeto(t.project_id, function(v){
    var novo = projeto(v);
    var dados = { project_id: v };
    /* Uma tarefa que chega a um projeto sem area sua herda a dele: e quase
       sempre a certa, e uma tarefa sem area nao aparece em lado nenhum. */
    if (novo && novo.context_id && !t.context_id) dados.context_id = novo.context_id;
    tfGravar(t.id, dados);
  }), 'projeto');

  pjCampo(g, 'Área', pjCampoArea(t.context_id, function(v){ tfGravar(t.id, { context_id: v }); }), 'area');

  if (tipo === 'pagamento'){
    pjCampo(g, 'Valor', pjCampoTexto(t.amount != null ? String(t.amount).replace('.', ',') : '', '0,00',
      function(v){ tfGravar(t.id, { amount: v }); }), 'valor');
    pjCampo(g, 'A quem', pjCampoTexto(t.payee, 'a quem se paga',
      function(v){ tfGravar(t.id, { payee: v.trim() || null }); }), 'aquem');
    if (t.paid_on){
      var pago = el('div');
      pago.appendChild(pill('pago a ' + dataCurta(t.paid_on), 'good'));
      if (typeof tfSemProva === 'function' && tfSemProva(t)) pago.appendChild(pill('falta comprovativo', 'warn'));
      pjCampo(g, 'Pagamento', pago);
    }
  }

  /* Passos: riscam-se aqui em vez de obrigar a saltar para as Tarefas so para
     marcar uma linha. */
  var itens = t.items || [];
  var feitos = itens.filter(function(x){ return x.done; }).length;
  var sp = pjSeccao(box, 'Passos' + (itens.length ? ' · ' + feitos + ' de ' + itens.length : ''));
  itens.forEach(function(x){
    var l = el('div', 'pj-passo' + (x.done ? ' feito' : ''));
    var cx = el('button', 'pj-cx' + (x.done ? ' on' : ''));
    cx.type = 'button';
    cx.title = x.done ? 'Desmarcar' : 'Marcar como feito';
    if (x.done) cx.textContent = '✓';
    cx.addEventListener('click', function(){ tfItem('PATCH', x.id, { done: !x.done }); });
    l.appendChild(cx);
    var i = el('input');
    i.type = 'text';
    i.value = x.title;
    i.dataset.pjk = 'passo' + x.id;
    i.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); i.blur(); } });
    i.addEventListener('blur', function(){
      if (i.value.trim() && i.value !== x.title) tfItem('PATCH', x.id, { title: i.value.trim() });
    });
    l.appendChild(i);
    var xx = el('button', 'pj-x', '×');
    xx.type = 'button';
    xx.title = 'Tirar passo';
    xx.addEventListener('click', function(){ tfItem('DELETE', x.id); });
    l.appendChild(xx);
    sp.appendChild(l);
  });
  var ni = el('input', 'pj-novo');
  ni.type = 'text';
  ni.placeholder = '+ passo';
  ni.dataset.pjk = 'novopasso';
  ni.addEventListener('keydown', function(e){
    if (e.key === 'Enter' && ni.value.trim()){ e.preventDefault(); tfItemNovo(t.id, ni.value.trim()); }
  });
  sp.appendChild(ni);

  /* Os documentos de uma tarefa sao os mesmos vistos de qualquer lado: o
     bloco vem do anexos.js, com o mesmo enviar e o mesmo ligar ao arquivo. */
  pjSeccao(box, 'Documentos').appendChild(axBloco(t));

  /* Apagar sem ter de ir as Tarefas: a mesma pergunta e o mesmo caminho. */
  if (typeof tfApagarJa === 'function'){
    var bx = el('button', 'btn danger', tipo === 'pagamento' ? 'Apagar pagamento' : 'Apagar tarefa');
    bx.type = 'button';
    bx.style.marginTop = '14px';
    bx.addEventListener('click', function(){
      tfApagarJa(t, function(){
        PJ.sel = pr ? { tipo: 'projeto', id: pr.id } : null;
        if (PJ.aberto) pjCarregarDetalhe();
      });
    });
    box.appendChild(bx);
  }
}

/* ------------------------------------------------------------------ *
 * pagina de um projeto
 * ------------------------------------------------------------------ */

function pjAbrir(id){
  PJ.aba = null;
  /* Vir de outro ecra (de um aviso, de uma ficha) tem de trazer o ecra dos
     Projetos com ele: o show() poe o titulo do ecra, e o da pagina do projeto
     e escrito a seguir, no pjRenderPagina. */
  if (typeof show === 'function') show('projetos');
  PJ.aberto = id;
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
  /* O tratamento do erro esta no segundo argumento do .then, e nao num .catch
     a seguir: assim so apanha a leitura. Um erro a desenhar seguia para o
     mesmo sitio e aparecia como «nao foi possivel ler este projeto», que manda
     procurar a avaria no servidor quando ela esta aqui. */
  return apiGestao('/api/gestao/projetos/' + pedido).then(function(d){
    return PJ.aberto === pedido ? d : null;
  }, function(e){
    if (PJ.aberto !== pedido) return null;
    clear(p);
    p.appendChild(el('p', 'vazio', (e && e.message) || 'Não foi possível ler este projeto.'));
    var v = el('button', 'btn', '‹ Projetos');
    v.type = 'button';
    v.addEventListener('click', pjFechar);
    p.appendChild(v);
    return null;
  }).then(function(d){
    if (!d) return;
    PJ.det = d;
    /* Um programa abre pelos projetos; um projeto abre pelas tarefas. E a aba
       so se corrige quando nao existe no que se abriu. */
    var validas = pjEhPrograma(d.projeto)
      ? ['projetos', 'tarefas', 'documentos', 'despesas']
      : ['tarefas', 'documentos', 'despesas'];
    if (validas.indexOf(PJ.aba) < 0) PJ.aba = validas[0];
    pjRenderPagina();
  });
}

/* Gravar um projeto nao depende de estar aberto em pagina inteira: o painel
   da direita edita o mesmo projeto e grava pelo mesmo caminho. */
function pjGuardarProjeto(id, campos){
  return apiGestao('/api/gestao/projetos/' + id, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(campos)
  }).then(function(){
    return loadGestao();
  }).then(function(){
    if (PJ.aberto === id) return pjCarregarDetalhe();
  }).catch(function(){ toast('Não deu para gravar.'); });
}

function pjGuardar(campos){ return pjGuardarProjeto(PJ.aberto, campos); }

function pjRenderPagina(){
  var box = $('pjPagina');
  if (!box || !PJ.det) return;
  var pr = PJ.det.projeto;
  clear(box);

  /* O nome do projeto vive uma vez so, no campo que se edita. A barra de cima
     continua a dizer em que ecra se esta e acrescenta onde e que o projeto
     mora — repetir o nome nos dois sitios so enchia o ecra. */
  var programa = pjEhPrograma(pr);
  $('pageTitle').textContent = 'Projetos';
  $('pageSub').textContent = [programa ? 'Programa' : null, areaNome(pr.context_id),
    pjEstado(pr.status)[1]].filter(Boolean).join(' · ') || 'Uma frente de trabalho por dentro';

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
    if (fechado) return pjGuardar({ status: 'ativo', closed_on: null });
    /* Fechar um programa com projetos por fechar e quase sempre engano, mas a
       app nao decide por ele: pergunta, com o numero a vista. */
    var porFechar = (PJ.det.filhos || []).filter(function(f){ return f.status !== 'concluido'; });
    if (porFechar.length && !window.confirm(
      'Este programa tem ' + porFechar.length
      + (porFechar.length === 1 ? ' projeto por fechar' : ' projetos por fechar')
      + ':\n\n' + porFechar.map(function(f){ return '· ' + f.name; }).join('\n')
      + '\n\nFechar o programa na mesma?')) return;
    pjGuardar({ status: 'concluido', closed_on: new Date().toISOString().slice(0, 10) });
  });
  top.appendChild(alternar);

  var apagar = el('button', 'btn danger', 'Apagar');
  apagar.type = 'button';
  apagar.addEventListener('click', function(){ pjApagar(pr); });
  top.appendChild(apagar);
  box.appendChild(top);

  /* Um projeto dentro de um programa diz de quem e logo acima do nome, e o
     nome do programa leva la. */
  if (PJ.det.pai){
    var sobe = el('button', 'pj-pai');
    sobe.type = 'button';
    sobe.innerHTML = pjSvg('<path d="M4 6h16M4 12h10M4 18h6"/>', 13);
    sobe.appendChild(document.createTextNode(' Faz parte do programa '));
    sobe.appendChild(el('b', null, PJ.det.pai.name));
    sobe.addEventListener('click', function(){ pjAbrir(PJ.det.pai.id); });
    box.appendChild(sobe);
  }
  if (programa) box.appendChild(el('div', 'pj-etq', 'Programa'));

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
  var filhos = d.filhos || [];
  if (filhos.length) num(String(filhos.length), filhos.length === 1 ? 'projeto' : 'projetos');
  num(pct + '%', feitas + ' de ' + uteis.length + ' tarefas'
    + (pjEhPrograma(pr) ? ' nos projetos' : ''));
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

  /* Um programa que acaba antes de um dos projetos dele e uma contradicao, e
     a app nao guarda contradicoes caladas. */
  if (pr.target_on){
    var tarde = (d.filhos || []).filter(function(f){
      return f.status !== 'concluido' && f.target_on && f.target_on > pr.target_on;
    });
    if (tarde.length){
      var av = el('div', 'pj-aviso');
      av.innerHTML = pjSvg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>', 16);
      av.appendChild(el('span', null,
        (tarde.length === 1 ? 'O projeto ' : 'Os projetos ')
        + tarde.map(function(f){ return '«' + f.name + '»'; }).join(', ')
        + (tarde.length === 1 ? ' aponta' : ' apontam')
        + ' para depois do fim do programa (' + dataCurta(pr.target_on) + ').'));
      wrap.appendChild(av);
    }
  }
  return wrap;
}

function pjAbas(){
  var d = PJ.det;
  var tabs = el('div', 'tabs');
  var abas = pjEhPrograma(d.projeto)
    ? [['projetos', 'Projetos', (d.filhos || []).length],
       ['tarefas', 'Tarefas', d.tarefas.length],
       ['documentos', 'Documentos', d.documentos.length],
       ['despesas', 'Despesas', d.despesas.length]]
    : [['tarefas', 'Tarefas', d.tarefas.length],
       ['documentos', 'Documentos', d.documentos.length],
       ['despesas', 'Despesas', d.despesas.length]];
  abas.forEach(function(x){
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
  if (pjEhPrograma(PJ.det.projeto) && PJ.aba === 'projetos') return pjAbaProjetos(box);
  if (PJ.aba === 'tarefas') return pjAbaTarefas(box);
  if (PJ.aba === 'documentos') return pjAbaDocumentos(box);
  return pjAbaDespesas(box);
}

/* Os projetos de um programa, cada um com a sua barra e o seu prazo. E aqui
   que se cria um projeto novo dentro dele — o unico sitio onde escolher o
   programa e desnecessario porque ja se esta dentro dele. */
function pjAbaProjetos(box){
  var filhos = PJ.det.filhos || [];
  if (!filhos.length){
    box.appendChild(el('p', 'vazio', 'Programa ainda sem projetos.'));
  }
  filhos.forEach(function(f){
    var li = el('div', 'pj-mini');
    var corpo = el('div', 'pj-corpo-lin');
    corpo.appendChild(el('span', 'pj-t', f.name));
    var m = el('div', 'pj-m');
    [areaNome(f.context_id), f.description].filter(Boolean)
      .forEach(function(x){ m.appendChild(el('span', null, x)); });
    if (m.childNodes.length) corpo.appendChild(m);
    var pct = f.tarefas ? Math.round((f.feitas / f.tarefas) * 100) : 0;
    var barra = el('div', 'pj-barra' + (pct === 100 ? ' cheia' : ''));
    var i = el('i');
    i.style.width = pct + '%';
    barra.appendChild(i);
    corpo.appendChild(barra);
    li.appendChild(corpo);

    var dir = el('div');
    dir.style.textAlign = 'right';
    var est = pjEstado(f.status);
    dir.appendChild(pill(est[1], est[2]));
    var nota = el('div', 'pj-r');
    nota.style.marginTop = '4px';
    nota.textContent = f.tarefas
      ? f.feitas + '/' + f.tarefas + ' · ' + pct + '%'
      : 'sem tarefas';
    dir.appendChild(nota);
    if (f.target_on && f.status !== 'concluido'){
      var u = urgencia(diasAte(f.target_on), 'tarefa');
      var q = el('div', 'pj-r' + (u.nivel ? ' ' + u.nivel : ''));
      q.textContent = dataCurta(f.target_on) + (u.texto ? ' · ' + u.texto : '');
      dir.appendChild(q);
    }
    li.appendChild(dir);
    li.addEventListener('click', function(){ pjAbrir(f.id); });
    box.appendChild(li);
  });

  var add = el('input', 'pj-add');
  add.type = 'text';
  add.placeholder = '+ Novo projeto neste programa';
  add.addEventListener('keydown', function(e){
    if (e.key !== 'Enter') return;
    var nome = add.value.trim();
    if (!nome) return;
    add.value = '';
    apiGestao('/api/gestao/projetos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: nome,
        tipo: 'projeto',
        parent_id: PJ.aberto,
        context_id: PJ.det.projeto.context_id || null
      })
    }).then(function(){ return loadGestao(); })
      .then(function(){ return pjCarregarDetalhe(); })
      .then(function(){ toast('Projeto criado no programa.'); })
      .catch(function(e2){ toast((e2 && e2.message) || 'Não deu para criar o projeto.'); });
  });
  box.appendChild(add);
}

function pjAbaTarefas(box){
  var tarefas = PJ.det.tarefas;
  /* Num programa as tarefas sao as dos projetos dele, e mostram-se agrupadas
     por projeto: uma lista corrida de quarenta linhas nao diz de quem sao. */
  if (pjEhPrograma(PJ.det.projeto)){
    if (!tarefas.length){
      box.appendChild(el('p', 'vazio', 'Os projetos deste programa ainda não têm tarefas.'));
      return;
    }
    (PJ.det.filhos || []).forEach(function(f){
      var suas = tarefas.filter(function(t){ return t.project_id === f.id; });
      if (!suas.length) return;
      var h = el('div', 'mono');
      h.style.cssText = 'margin:14px 0 2px;cursor:pointer';
      h.textContent = f.name + ' · ' + suas.length;
      h.addEventListener('click', function(){ pjAbrir(f.id); });
      box.appendChild(h);
      suas.forEach(function(t){ box.appendChild(pjLinhaTarefa(t)); });
    });
    var nota = el('p', 'vazio');
    nota.textContent = 'Uma tarefa entra num projeto, não no programa.';
    box.appendChild(nota);
    return;
  }
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

  var tipo = el('select');
  PJ_TIPOS.forEach(function(x){ tipo.appendChild(new Option(x[1], x[0])); });
  tipo.value = pr.tipo || 'projeto';
  tipo.addEventListener('change', function(){
    pjGuardar(tipo.value === 'programa' ? { tipo: 'programa', parent_id: null } : { tipo: 'projeto' });
  });
  linha('O que é', tipo);

  /* Um programa nao pende de nada, por isso nem oferece o campo. */
  if (!pjEhPrograma(pr)){
    var prog = el('select');
    prog.appendChild(new Option('— fora de programa —', ''));
    pjProgramas().forEach(function(x){ prog.appendChild(new Option(x.name, x.id)); });
    prog.value = pr.parent_id || '';
    prog.addEventListener('change', function(){ pjGuardar({ parent_id: prog.value || null }); });
    linha('Programa', prog);
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
  (G.projects || []).filter(function(p){ return p.id !== pr.id && !pjEhPrograma(p); })
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
  var filhos = (d.filhos || []).length;
  var aviso = 'Apagar «' + pr.name + '»?'
    + (filhos
      ? '\n\n' + filhos + (filhos === 1 ? ' projeto fica' : ' projetos ficam')
        + ' na app, fora de qualquer programa.'
      : '')
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
  /* Se o que estava escolhido desapareceu (apagado noutro separador, ou fora
     do filtro), escolhe-se o primeiro da lista em vez de deixar o painel a
     falar de uma coisa que ja nao existe. */
  if (PJ.sel && PJ.sel.tipo !== 'tarefa' && !projeto(PJ.sel.id)) PJ.sel = null;
  if (PJ.sel && PJ.sel.tipo === 'tarefa'
      && !(G.tasks || []).some(function(t){ return t.id === PJ.sel.id; })) PJ.sel = null;
  if (!PJ.sel){
    var primeiro = pjFiltrados()[0];
    if (primeiro) PJ.sel = { tipo: pjEhPrograma(primeiro) ? 'programa' : 'projeto', id: primeiro.id };
  }
  pjRenderArvore();
  pjRenderPainel();
  if ($('pjArea')) pjEncherAreas($('pjArea'), $('pjArea').value);
  var sp = $('pjProgNovo');
  if (sp){
    var antes = sp.value;
    clear(sp);
    sp.appendChild(new Option('— fora de programa —', ''));
    pjProgramas().forEach(function(x){ sp.appendChild(new Option(x.name, x.id)); });
    sp.value = antes;
  }
  if ($('pjMembros') && typeof construirChips === 'function') construirChips('pjMembros', G.people || []);
}

(function esperarApp(tentativa){
  tentativa = tentativa || 0;
  if ($('view-projetos') && window.G){ pjMontar(); return; }
  if (tentativa < 40) setTimeout(function(){ esperarApp(tentativa + 1); }, 250);
})();
