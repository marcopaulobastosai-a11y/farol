'use strict';
/* Farol - o que cada area tem por fazer.
 *
 * A regra do farol-organizacao.md: a coisa fica na area, o trabalho sobre a
 * coisa fica no projeto. Faltava a outra metade - a area mostrar o que e
 * dela. As tarefas soltas (sem projeto) sao a operacao corrente: o ordenado
 * da loja, a renda da casa, o IUC.
 *
 * Todos os ecras das areas sao iguais (desenho de 27 set, aprovado pelo
 * Marco num mockup):
 *
 *   numeros: por fazer · em atraso · a pagar · na agenda · Despesas (abre a
 *            pagina das Despesas ja filtrada) · Documentos (abre os
 *            Documentos ja filtrados)
 *   3/4 a esquerda: Tarefas - tarefas e pagamentos numa lista so, por prazo
 *            (em atraso, proximos 14 dias, mais tarde, sem prazo), com um
 *            seletor Todas · Tarefas · Pagamentos
 *   1/4 a direita: Agenda (eventos e lembretes da area ou sub-area) e, por
 *            baixo, Projetos - ambos abertos
 *
 * As Despesas e os Documentos deixaram de ser widgets: vivem nas suas
 * paginas, e aqui ficam os cards que la levam.
 *
 * A Agenda e o que a area tem marcado no calendario - e um aniversario e
 * um evento, nao uma tarefa: os lembretes aparecem aqui, nao nas Tarefas.
 *
 * Cada widget recolhe-se pelo cabecalho e, recolhido, continua a dizer o
 * essencial - a contagem e o dinheiro. E o que faz valer a pena recolher:
 * perde-se o detalhe, nao se perde a informacao.
 *
 * Os filtros mandam no ecra inteiro - nos widgets e nos numeros do topo ao
 * mesmo tempo - e vivem numa linha so, cada um numa lista pendente com
 * escolha multipla (pedido do Marco, 26 set: as filas de botoes ocupavam
 * meio ecra):
 *   - Onde:     uma ou mais sub-areas (nenhuma escolhida = tudo);
 *   - Quando:   em atraso, 7/30/90 dias, 12 meses, e meses ou anos
 *               escolhidos a mao - varios somam-se (nenhum = tudo);
 *   - Fechados: tarefas feitas, pagamentos pagos, eventos que passaram;
 *   - Quem:     uma pessoa, e se conta como dono, por causa de quem, ou
 *               ambos. Nao existe no Profissional (semQuem): o trabalho das
 *               empresas e do Marco, e o filtro so ocupava espaco.
 * A escolha fica guardada por area.
 *
 * O que o periodo faz a cada widget:
 *   - tarefas e pagamentos: a data de entrega; o que nao tem data aparece
 *     sempre, porque nao tem data para cair fora;
 *   - despesas: o dia em que o dinheiro saiu;
 *   - documentos: a data do papel OU a validade - basta uma das duas;
 *   - projetos: nao sao cortados pelo periodo (duram meses); so o «em
 *     atraso» os filtra.
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
  { view: 'profissional', nome: 'profissional', novo: true, titulo: 'Profissional', semQuem: true,
    sub: 'Operação corrente das empresas, do trabalho e do MBA',
    icone: '<rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M3.5 12h17"/>' },
  { view: 'patrimonio', nome: 'patrimonio', novo: true, titulo: 'Património',
    sub: 'Bens que se gerem: imóveis, carro, terreno',
    icone: '<path d="M3 20h18"/><path d="M5 20V10l7-5 7 5v10"/><path d="M9 20v-5h6v5"/><path d="M12 9.5v.01"/>' }
];

var AE_CSS =
  '.ae{margin-bottom:14px}' +
  '.ae-filtros{padding:10px 14px;display:flex;flex-direction:column;gap:8px}' +
  '.ae-fl{display:flex;align-items:flex-start;gap:10px}' +
  '.ae-fl > .ae-lbl{flex:none;width:58px;padding-top:7px}' +
  '.ae-lbl{font-family:var(--mono);font-size:.625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}' +
  '.ae-chips{display:flex;flex-wrap:wrap;gap:6px;flex:1;min-width:0}' +
  '.ae-chip{border:1px solid var(--line);background:var(--surface);color:var(--ink-2);border-radius:99px;padding:4px 11px;font:inherit;font-size:.78rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;min-height:30px}' +
  '.ae-chip:hover{border-color:var(--accent);color:var(--accent-ink)}' +
  '.ae-chip.on{background:var(--accent);border-color:var(--accent);color:#fff}' +
  ':root[data-theme="dark"] .ae-chip.on,:root:not([data-theme="light"]) .ae-chip.on{color:#06181A}' +
  '.ae-chip i.dot{width:7px;height:7px;border-radius:50%;flex:none}' +
  '.ae-chip small{font-family:var(--mono);font-size:.68rem;opacity:.75}' +
  '.ae-chip small.bad{color:var(--bad);opacity:1}' +
  '.ae-chip.on small.bad{color:inherit}' +
  '.ae-seg{display:flex;gap:2px;background:var(--surface-2);border:1px solid var(--line);border-radius:99px;padding:2px;margin-right:4px}' +
  '.ae-seg button{border:0;background:none;font:inherit;font-size:.72rem;color:var(--muted);padding:3px 10px;border-radius:99px;cursor:pointer}' +
  '.ae-seg button.on{background:var(--surface);color:var(--ink);box-shadow:var(--shadow)}' +
  '.ae-seg.ae-off{opacity:.55}' +
  '.ae-dds{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
  '.ae-dd{border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:8px;padding:5px 10px;font:inherit;font-size:.8rem;cursor:pointer;display:inline-flex;align-items:center;gap:7px;min-height:32px;max-width:100%}' +
  '.ae-dd:hover{border-color:var(--accent)}' +
  '.ae-dd.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-ink)}' +
  '.ae-dd .ae-lbl{padding:0}' +
  '.ae-dd b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}' +
  '.ae-dd svg{flex:none;opacity:.6}' +
  '.ae-dd small{font-family:var(--mono);font-size:.68rem;color:var(--bad)}' +
  '.ae-limpar{border:0;background:none;font:inherit;font-size:.75rem;color:var(--muted);cursor:pointer;padding:4px}' +
  '.ae-limpar:hover{color:var(--accent-ink);text-decoration:underline}' +
  '.tf-pop.ae-ddp{width:310px;padding:8px}' +
  '.ae-ddp .ae-op{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:7px;cursor:pointer;font-size:.8125rem;color:var(--ink);margin:0}' +
  '.ae-ddp .ae-op:hover{background:var(--surface-2)}' +
  '.ae-ddp .ae-op input{width:15px;height:15px;accent-color:var(--accent);flex:none;margin:0}' +
  '.ae-ddp .ae-op i.dot{width:8px;height:8px;border-radius:50%;flex:none}' +
  '.ae-ddp .ae-op span{flex:1;min-width:0}' +
  '.ae-ddp .ae-op small{font-family:var(--mono);font-size:.68rem;color:var(--muted)}' +
  '.ae-ddp .ae-op small.bad{color:var(--bad)}' +
  '.ae-ddp hr{border:0;border-top:1px solid var(--line-soft);margin:6px 2px}' +
  '.ae-ddp .ae-ddt{font-family:var(--mono);font-size:.625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:4px 8px 2px}' +
  '.ae-ddp .ae-mes{display:flex;gap:6px;padding:4px 8px}' +
  '.ae-ddp .ae-mes select{flex:1}' +
  '.ae-ddp .ae-seg{margin:4px 8px 6px}' +
  '.ae-kpis{display:flex;gap:10px;flex-wrap:wrap}' +
  '.ae-kpi{flex:1;min-width:150px;display:flex;flex-direction:column;gap:1px;align-items:flex-start;text-align:left;padding:10px 14px;border:1px solid var(--line);background:var(--surface);border-radius:var(--radius);cursor:pointer;font:inherit}' +
  '.ae-kpi:hover{border-color:var(--accent)}' +
  '.ae-kpi b{font-family:var(--mono);font-size:1.25rem;font-weight:500;line-height:1.15;font-variant-numeric:tabular-nums;color:var(--ink)}' +
  '.ae-kpi b.bad{color:var(--bad)}' +
  '.ae-kpi span{font-size:.75rem;color:var(--muted)}' +
  '.ae-w{overflow:hidden}' +
  '.ae-wh{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:none;padding:13px 16px;cursor:pointer;font:inherit;border-radius:var(--radius)}' +
  '.ae-wh:hover{background:var(--surface-2)}' +
  '.ae-wi{flex:none;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--surface-2);color:var(--ink-2)}' +
  '.ae-wi.tarefas,.ae-wi.projetos{background:var(--accent-soft);color:var(--accent-ink)}' +
  '.ae-wi.pagamentos{background:var(--warn-soft);color:var(--warn)}' +
  '.ae-wi.despesas{background:var(--good-soft);color:var(--good)}' +
  '.ae-wi.eventos{background:var(--c4-soft,var(--surface-2));color:var(--ink-2)}' +
  '.ae-wt{font-size:.9375rem;font-weight:600;color:var(--ink);letter-spacing:-.01em}' +
  '.ae-wn{font-family:var(--mono);font-size:.6875rem;color:var(--muted);background:var(--surface-2);border:1px solid var(--line-soft);border-radius:99px;padding:1px 7px}' +
  '.ae-ws{margin-left:auto;display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:.75rem;color:var(--ink-2);font-variant-numeric:tabular-nums}' +
  '.ae-ws .bad{color:var(--bad)}' +
  '.ae-seta{display:flex;color:var(--muted);transition:transform .15s}' +
  '.ae-fechado .ae-seta{transform:rotate(-90deg)}' +
  '.ae-w .tf-rows{padding:0 10px}' +
  '.ae-w .tf-row{padding:8px 6px}' +
  '.ae-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}' +
  '@media (max-width:980px){.ae-cols{grid-template-columns:minmax(0,1fr)}}' +
  '.ae{container-type:inline-size}' +
  '@container (max-width:860px){.ae-cols{grid-template-columns:minmax(0,1fr)}}' +
  '.ae-grp{margin-top:6px}' +
  '.ae-grp + .ae-grp{margin-top:14px}' +
  '.ae-grp > h4{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted);padding:4px 16px;font-weight:500;display:flex;gap:8px}' +
  '.ae-grp > h4 span{color:var(--faint)}' +
  '.ae-vazio{color:var(--muted);font-size:.85rem;padding:2px 22px 16px;margin:0}' +
  '.ae-nota{color:var(--muted);font-size:.78rem;padding:0 22px 12px;margin:0}' +
  '.ae-docs-t{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px;font-size:.72rem}' +
  '.ae-docs-t > a,.ae-docs-t > span{color:var(--accent-ink);text-decoration:none;display:inline-flex;align-items:center;gap:4px;max-width:100%}' +
  '.ae-docs-t a:hover{text-decoration:underline}' +
  '.ae-docs-t em{font-style:normal;color:var(--muted)}' +
  '.ae-docs-t > * span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}' +
  '.ae-pj,.ae-doc{display:flex;align-items:baseline;gap:10px;padding:8px 16px;border-top:1px solid var(--line-soft)}' +
  '.ae-pj{cursor:pointer;align-items:center}' +
  '.ae-pj:first-of-type,.ae-doc:first-of-type{border-top-color:transparent}' +
  '.ae-pj:hover,.ae-doc:hover{background:var(--surface-2)}' +
  '.ae-pj b,.ae-doc b{font-weight:500;font-size:.875rem;color:var(--ink)}' +
  '.ae-doc a{color:var(--ink);text-decoration:none}' +
  '.ae-doc a:hover{color:var(--accent-ink);text-decoration:underline}' +
  '.ae-pj small,.ae-doc small{color:var(--muted);font-size:.72rem}' +
  '.ae-doc small.uso{color:var(--accent-ink)}' +
  '.ae-pj .mono,.ae-doc .mono{white-space:nowrap}' +
  '.ae-barra{flex:none;width:150px;height:6px;border-radius:99px;background:var(--line-soft);overflow:hidden}' +
  '.ae-barra i{display:block;height:6px;background:var(--accent)}' +
  '.ae-barra i.bad{background:var(--bad)}' +
  '.ae-dic{flex:none;width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:var(--surface-2);color:var(--muted);margin-top:1px}' +
  '.ae-mais{margin:2px 16px 14px}' +
  '.ae-apagar{flex:none;border:0;background:none;color:var(--faint);cursor:pointer;padding:2px;border-radius:6px;opacity:0;display:flex}' +
  '.tf-row:hover .ae-apagar{opacity:1}' +
  '.ae-apagar:hover{color:var(--bad);background:var(--bad-soft)}' +
  '.ae-ficha{border-style:dashed;color:var(--accent-ink)}' +
  '.ae-fim{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;background:none;cursor:pointer;font:inherit;padding:8px 16px;margin-top:4px;border-top:1px solid var(--line-soft);font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}' +
  '.ae-fim:hover{background:var(--surface-2);color:var(--ink-2)}' +
  '.ae-fim .n{color:var(--faint)}' +
  '.ae-fim svg{transition:transform .15s;color:var(--faint)}' +
  '.ae-fim.rec svg{transform:rotate(-90deg)}' +
  '.ae-w .tf-row.done .tf-t{color:var(--faint);text-decoration:line-through}' +
  '.ae-ev-dia{flex:none;width:46px;text-align:center;font-family:var(--mono);line-height:1.1;padding-top:1px}' +
  '.ae-ev-dia b{display:block;font-size:1rem;font-weight:500;color:var(--ink)}' +
  '.ae-ev-dia span{display:block;font-size:.625rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}' +
  '.ae-ev-dia.hoje b,.ae-ev-dia.hoje span{color:var(--accent-ink)}' +
  '.ae-ev-dia.passou b,.ae-ev-dia.passou span{color:var(--faint)}' +
  '.ae-topo{display:flex;justify-content:flex-end;margin-bottom:8px}' +
  /* 27 set: a lista unica a 3/4 e a coluna da direita (Agenda, Projetos) */
  '.ae-main{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,1fr);gap:14px;align-items:start}' +
  '.ae-dir{display:flex;flex-direction:column;gap:14px;min-width:0}' +
  '@container (max-width:980px){.ae-main{grid-template-columns:minmax(0,1fr)}}' +
  '.ae-tipo{flex:none;width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;margin-top:-1px}' +
  '.ae-tipo.pag{background:var(--warn-soft);color:var(--warn)}' +
  '.ae-tipo.tar{background:var(--accent-soft);color:var(--accent-ink)}' +
  '.ae-sub{color:var(--accent-ink)}' +
  '.ae-lseg{display:flex;align-items:center;gap:10px;padding:0 16px 6px}' +
  '.ae-lseg .ae-seg{margin:0}' +
  '.ae-grp > h4.bad{color:var(--bad)}' +
  '.ae-grp > h4.acc{color:var(--accent-ink)}' +
  '.ae-kpi.ae-link{border-color:var(--accent);box-shadow:var(--shadow)}' +
  '.ae-kpi.ae-link b{display:flex;gap:8px;align-items:baseline;width:100%}' +
  '.ae-kpi.ae-link b i{margin-left:auto;font-style:normal;font-family:var(--sans);font-size:.8rem;color:var(--accent-ink)}' +
  '.ae-kpi small{font-size:.7rem;color:var(--warn)}' +
  '.ae-spark{display:flex;align-items:flex-end;gap:3px;height:16px;margin-top:3px}' +
  '.ae-spark i{width:8px;border-radius:2px 2px 0 0;background:var(--line);min-height:2px}' +
  '.ae-spark i.agora{background:var(--accent)}';

var AE = { filtro: {}, fechados: {}, despesas: null, aLerDespesas: false, tipo: {} };
function aeLerGuardado(chave){
  try { return JSON.parse(localStorage.getItem(chave) || '{}') || {}; } catch (e) { return {}; }
}
function aeGuardar(chave, v){ try { localStorage.setItem(chave, JSON.stringify(v)); } catch (e) {} }
AE.filtro = aeLerGuardado('aeFiltro');
AE.fechados = aeLerGuardado('aeFechados');

/* O que a area tem por fazer e o que tem marcado ficam a vista; o dinheiro ja
   gasto e os projetos abrem-se quando se quiserem. */
var AE_INICIO_FECHADO = { despesas: true,
  /* O que ja esta fechado nao tem de estar aberto: mostra-se a contagem e
     estende-se quem quiser ver. */
  'fim:tarefas': true, 'fim:pagamentos': true, 'fim:eventos': true };

function aeF(view){
  var f = AE.filtro[view];
  /* O filtro antigo era so o nome da sub-area, guardado como texto. */
  if (typeof f === 'string') f = { sub: f };
  if (!f || typeof f !== 'object') f = {};
  /* Os filtros antigos eram de escolha unica (sub, periodo, fechados
     sim/nao): passam a listas sem se perder o que estava escolhido. */
  var subs = Array.isArray(f.subs) ? f.subs.slice() : (f.sub && f.sub !== 'tudo' ? [f.sub] : []);
  var periodos = Array.isArray(f.periodos) ? f.periodos.slice() : (f.periodo && f.periodo !== 'tudo' ? [f.periodo] : []);
  var fechados = Array.isArray(f.fechados) ? f.fechados.slice() : (f.fechados === 'sim' ? AE_FECHADOS.map(function(x){ return x[0]; }) : []);
  return {
    subs: subs,
    /* Para quem so precisa de uma (a area proposta ao criar): a unica escolhida. */
    sub: subs.length === 1 ? subs[0] : 'tudo',
    quem: f.quem || 'todos',
    papel: f.papel || 'ambos',
    periodos: periodos,
    fechados: fechados
  };
}
var AE_FECHADOS = [['tarefas', 'Tarefas feitas'], ['pagamentos', 'Pagamentos pagos'], ['eventos', 'Eventos que passaram']];
/* Liga ou desliga um valor numa lista do filtro. */
function aeAlternar(a, campo, valor){
  var f = aeF(a.view);
  var l = f[campo] || [];
  var i = l.indexOf(valor);
  if (i >= 0) l.splice(i, 1); else l.push(valor);
  aePor(a, campo, l);
}
function aePor(a, campo, valor){
  var f = aeF(a.view);
  f[campo] = valor;
  AE.filtro[a.view] = f;
  aeGuardar('aeFiltro', AE.filtro);
  aeRenderArea(a);
  if (typeof aeNavMarcar === 'function') aeNavMarcar();
}
function aeAbertoW(view, chave){
  var m = AE.fechados[view] || {};
  if (m[chave] === undefined) return !AE_INICIO_FECHADO[chave];
  return !m[chave];
}
function aeFecharW(a, chave, fechado){
  var m = AE.fechados[a.view] || {};
  m[chave] = fechado;
  AE.fechados[a.view] = m;
  aeGuardar('aeFechados', AE.fechados);
  aeRenderArea(a);
}

var AE_CLIPE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>';

var AE_I = {
  tarefas: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/>',
  pagamentos: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  despesas: '<path d="M4 18V9"/><path d="M10 18V5"/><path d="M16 18v-6"/><path d="M3 21h18"/>',
  documentos: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  projetos: '<path d="M4 6h10"/><path d="M4 12h16"/><path d="M4 18h7"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="18" r="2"/>',
  eventos: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  seta: '<path d="M6 9l6 6 6-6"/>',
  ficheiro: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/>',
  dobrar: '<path d="M5 9l7-5 7 5"/><path d="M5 15l7 5 7-5"/>'
};
function aeIcone(d, w){
  return '<svg width="' + w + '" height="' + w + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
}

/* Os Documentos nao sao uma area, sao o arquivo de todas elas: vao para a
   Administracao. O rotulo e posto pelos modulos da administracao, que podem
   chegar depois - por isso isto tenta outra vez a cada desenho. */
var AE_NAV = { tentativas: 0 };
function aeArrumarNav(){
  var nav = document.getElementById('nav');
  if (!nav) return;
  var b = nav.querySelector('button[data-view="documentos"]');
  if (!b) return;
  var admin = null;
  nav.querySelectorAll('.nav-label').forEach(function(l){ if (/Administra/.test(l.textContent)) admin = l; });
  if (!admin){
    /* O rotulo e posto pelos modulos da administracao, que podem chegar
       depois de nos. Espera-se por ele, sem insistir para sempre. */
    if (AE_NAV.tentativas++ < 25) setTimeout(aeArrumarNav, 300);
    return;
  }
  if (b.previousElementSibling === admin) return;
  admin.parentNode.insertBefore(b, admin.nextSibling);
}

function aeCtxDe(id){
  var cs = (window.G && G.contextos) || [];
  for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i];
  return null;
}
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

  /* Os cartoes da maqueta prometiam que isto ainda nao existia. Agora existe:
     saem todos, de todas as areas. */
  AE_AREAS.forEach(function(a){
    var sec = document.getElementById('view-' + a.view);
    if (!sec) return;
    sec.querySelectorAll('.card').forEach(function(c){
      var v = c.querySelector('p.vazio');
      if (v && /Ainda n\u00e3o h\u00e1 nada aqui/.test(v.textContent)) c.remove();
    });
    /* Uma coluna que ficou vazia nao tem de roubar metade do ecra. */
    var g = sec.querySelector('.grid.split');
    if (g){
      var cols = g.querySelectorAll(':scope > .stack');
      if (cols.length === 2 && !cols[1].children.length){ cols[1].remove(); g.classList.remove('split'); }
    }
  });
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
  sec.insertBefore(box, sec.firstChild);
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

/* ------------------------------------------------------------------ *
 * o periodo
 * ------------------------------------------------------------------ */

var AE_PERIODOS = [
  ['atraso', 'Em atraso'],
  ['d7', '7 dias'],
  ['d30', '30 dias'],
  ['d90', '90 dias'],
  ['d365', '12 meses'],
  ['tudo', 'Tudo']
];

/* Uma janela de datas, ou «atraso», ou nada quando e «tudo». Os dias contam
   para os dois lados: o que ja passou e esta por fazer conta tanto como o
   que vem ai. */
function aeJanela(p){
  if (!p || p === 'tudo') return null;
  if (p === 'atraso') return 'atraso';
  if (p.slice(0, 2) === 'm:'){
    var pa = p.slice(2).split('-'), ano = Number(pa[0]), mes = Number(pa[1]);
    return { de: tfISO(new Date(ano, mes - 1, 1)), ate: tfISO(new Date(ano, mes, 0)) };
  }
  if (p.slice(0, 2) === 'a:'){
    var an = Number(p.slice(2));
    return { de: an + '-01-01', ate: an + '-12-31' };
  }
  var n = Number(p.slice(1)) || 30;
  var h = tfHoje();
  return { de: tfISO(tfMais(h, -n)), ate: tfISO(tfMais(h, n)) };
}
function aeNaJanela(j, iso){ return !!iso && iso >= j.de && iso <= j.ate; }

function aeNomePeriodo(p){
  for (var i = 0; i < AE_PERIODOS.length; i++) if (AE_PERIODOS[i][0] === p) return AE_PERIODOS[i][1];
  if (p.slice(0, 2) === 'm:'){
    var pa = p.slice(2).split('-');
    return MESES[Number(pa[1]) - 1].slice(0, 3).toLowerCase() + ' ' + pa[0];
  }
  if (p.slice(0, 2) === 'a:') return p.slice(2);
  return 'Tudo';
}
function aePeriodoAMao(p){ return p.slice(0, 2) === 'm:' || p.slice(0, 2) === 'a:'; }

/* Escolher um mes e um ano a mao: o «90 dias» serve para o que vem ai, isto
   serve para ir buscar o que ja foi. */
function aePopPeriodo(a, ancora){
  tfFecharPop();
  var f = aeF(a.view);
  var hoje = tfHoje();
  var ano = hoje.getFullYear(), mes = hoje.getMonth() + 1;
  var aMao = f.periodos.filter(aePeriodoAMao);
  if (aMao.length){
    var pa = aMao[aMao.length - 1].slice(2).split('-');
    ano = Number(pa[0]);
    mes = pa.length > 1 ? Number(pa[1]) : 0;
  }
  var p = el('div', 'tf-pop');
  p.style.width = '240px';

  p.appendChild(el('label', null, 'Mês'));
  var sM = el('select');
  var o0 = el('option', null, '— o ano inteiro —'); o0.value = '0'; sM.appendChild(o0);
  MESES.forEach(function(nome, i){
    var o = el('option', null, nome); o.value = String(i + 1);
    sM.appendChild(o);
  });
  sM.value = String(mes || 0);
  p.appendChild(sM);

  p.appendChild(el('label', null, 'Ano'));
  var sA = el('select');
  for (var y = hoje.getFullYear() + 1; y >= hoje.getFullYear() - 5; y--){
    var oa = el('option', null, String(y)); oa.value = String(y);
    sA.appendChild(oa);
  }
  sA.value = String(ano);
  p.appendChild(sA);

  var ac = el('div', 'tf-acoes');
  var bC = el('button', 'btn small', 'Cancelar'); bC.type = 'button';
  bC.addEventListener('click', tfFecharPop);
  var bOk = el('button', 'btn small primary', 'Ver'); bOk.type = 'button';
  bOk.addEventListener('click', function(){
    var m = Number(sM.value);
    tfFecharPop();
    var k = m ? 'm:' + sA.value + '-' + String(m).padStart(2, '0') : 'a:' + sA.value;
    var l = aeF(a.view).periodos;
    if (l.indexOf(k) < 0) l.push(k);
    aePor(a, 'periodos', l);
  });
  ac.appendChild(bC); ac.appendChild(bOk);
  p.appendChild(ac);
  tfPosicionar(p, ancora);
}

/* ------------------------------------------------------------------ *
 * quem
 * ------------------------------------------------------------------ */

var AE_PAPEIS = [['dono', 'Dono'], ['assunto', 'Por causa de'], ['ambos', 'Ambos']];

/* Uma tarefa tem duas pessoas: quem a faz e por causa de quem se faz. O
   filtro deixa escolher qual das duas conta. */
function aePassaPessoa(f, dono, assuntos){
  if (f.quem === 'todos') return true;
  var id = Number(f.quem);
  var ehDono = dono === id;
  var ehAssunto = (assuntos || []).indexOf(id) >= 0;
  if (f.papel === 'dono') return ehDono;
  if (f.papel === 'assunto') return ehAssunto;
  return ehDono || ehAssunto;
}
/* Uma despesa, um papel ou um projeto so tem uma pessoa: o «dono / por causa
   de» nao se lhes aplica. */
function aePassaPessoaSo(f, ids){
  if (f.quem === 'todos') return true;
  return (ids || []).indexOf(Number(f.quem)) >= 0;
}

/* ------------------------------------------------------------------ *
 * as linhas
 * ------------------------------------------------------------------ */

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

function aeLinha(t, comSub){
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
  if (comSub !== undefined){
    var tp = el('span', 'ae-tipo ' + (tfTipo(t) === 'pagamento' ? 'pag' : 'tar'));
    tp.innerHTML = tfTipo(t) === 'pagamento' ? aeIcone(AE_I.pagamentos, 12) : aeIcone(AE_I.tarefas, 12);
    tp.title = tfTipo(t) === 'pagamento' ? 'Pagamento' : 'Tarefa';
    li.appendChild(tp);
  }
  var corpo = el('div', 'tf-body');
  corpo.appendChild(el('span', 'tf-t', t.title));
  var m = el('div', 'tf-m');
  var dono = pessoa(t.owner_id);
  if (dono){
    var d = el('span'); var dot = el('i', 'dot'); dot.style.background = dono.color || 'var(--c1)';
    d.appendChild(dot); d.appendChild(document.createTextNode(dono.name)); m.appendChild(d);
  }
  (t.subjects || []).forEach(function(pid){ var p = pessoa(pid); if (p) m.appendChild(el('span', null, '→ ' + p.name)); });
  /* O estado ve-se e muda-se aqui, sem sair da area: e a mesma etiqueta da
     pagina das Tarefas, e num pagamento «Pago» abre a janela do dinheiro. */
  if (tfTipo(t) === 'tarefa' || tfTipo(t) === 'pagamento') m.appendChild(tfEtiquetaEstado(t));
  if (comSub && t.context_id){
    var cx = aeCtxDe(t.context_id);
    if (cx) m.appendChild(el('span', 'ae-sub', cx.name));
  }
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
    else if (typeof tfIrPara === 'function') tfIrPara(t.id);
  });
  return li;
}

function aeLinhaDespesa(x, comArea){
  var r = el('div', 'tf-row');
  var ic = el('span', 'ae-dic'); ic.innerHTML = aeIcone(AE_I.ficheiro, 12);
  r.appendChild(ic);
  var corpo = el('div', 'tf-body');
  var nome = x.description || 'despesa';
  var url = x.inbox_id ? '/api/inbox/' + x.inbox_id + '/ficheiro' : null;
  if (url){
    var a = el('a', 'tf-t', nome);
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    a.style.color = 'var(--ink)'; a.style.textDecoration = 'none';
    a.title = 'Abrir o ficheiro';
    corpo.appendChild(a);
  } else {
    corpo.appendChild(el('span', 'tf-t', nome));
  }
  var m = el('div', 'tf-m');
  var p = x.person_id ? pessoa(x.person_id) : null;
  if (p){
    var s = el('span'); var dot = el('i', 'dot'); dot.style.background = p.color || 'var(--c1)';
    s.appendChild(dot); s.appendChild(document.createTextNode(p.name)); m.appendChild(s);
  }
  if (x.merchant) m.appendChild(el('span', null, x.merchant));
  if (comArea) m.appendChild(el('span', null, x.context_id ? areaNome(x.context_id) : 'sem área'));
  if (x.category) m.appendChild(el('span', null, x.category));
  if (!url) m.appendChild(el('span', null, 'sem ficheiro'));
  if (m.childNodes.length) corpo.appendChild(m);
  r.appendChild(corpo);
  r.appendChild(el('div', 'tf-val', tfEuros(x.amount)));
  r.appendChild(el('div', 'tf-r', tfDataCurta(x.spent_on)));
  /* Os papeis da despesa - o talao, a fatura - agarram-se aqui, varios de uma
     vez, sem sair da linha. */
  if (typeof axClipe === 'function'){
    r.appendChild(axClipe(x, { tipo: 'despesa', aoMudar: function(){ if (typeof aeRender === 'function') aeRender(); } }));
  }
  /* Uma despesa que nasceu de uma leitura errada tem de poder sair. Era o que
     a tabela das Financas fazia e o widget nao sabia. */
  if (typeof dpApagar === 'function'){
    var x0 = el('button', 'ae-apagar');
    x0.type = 'button';
    x0.title = 'Apagar a despesa';
    x0.setAttribute('aria-label', 'Apagar «' + nome + '»');
    x0.innerHTML = aeIcone('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>', 12);
    x0.addEventListener('click', function(e){
      e.stopPropagation();
      dpApagar(x, aeRecarregarDespesas);
    });
    r.appendChild(x0);
  }
  return r;
}

/* Um evento da area, ou um lembrete - que e a mesma coisa vista de outro lado:
   uma data que aparece e nao se «faz». Os aniversarios sao disto. */
function aeLinhaEvento(x){
  var r = el('div', 'tf-row');
  var hoje = tfISO(tfHoje());
  var d = parseDay(x.day);
  var cx = el('div', 'ae-ev-dia' + (x.day === hoje ? ' hoje' : (x.day < hoje ? ' passou' : '')));
  cx.appendChild(el('b', null, String(d.getDate())));
  cx.appendChild(el('span', null, MESES[d.getMonth()].slice(0, 3)));
  r.appendChild(cx);
  var corpo = el('div', 'tf-body');
  corpo.appendChild(el('span', 'tf-t', x.title));
  var m = el('div', 'tf-m');
  if (x.at) m.appendChild(el('span', null, x.at));
  if (x.detail) m.appendChild(el('span', null, x.detail));
  if (x.onde) m.appendChild(el('span', null, x.onde));
  if (x.tipo === 'lembrete') m.appendChild(el('span', null, 'lembrete'));
  if (x.repete) m.appendChild(el('span', null, x.repete));
  if (x.dono){
    var dn = el('span'); var dot = el('i', 'dot'); dot.style.background = x.dono.color || 'var(--c1)';
    dn.appendChild(dot); dn.appendChild(document.createTextNode(x.dono.name)); m.appendChild(dn);
  }
  if (d.getFullYear() !== tfHoje().getFullYear()) m.appendChild(el('span', null, String(d.getFullYear())));
  if (m.childNodes.length) corpo.appendChild(m);
  r.appendChild(corpo);
  if (x.tarefa){
    r.style.cursor = 'pointer';
    r.addEventListener('click', function(){
      if (typeof avAbrir === 'function') avAbrir({ origem: 'tarefa', id: x.tarefa, quando: x.day, detail: areaNome(x.context_id) });
      else if (typeof tfIrPara === 'function') tfIrPara(x.tarefa);
    });
  }
  if (x.apagavel && x.orig && typeof axClipe === 'function'){
    r.appendChild(axClipe(x.orig, { tipo: 'evento', aoMudar: function(){ if (typeof renderAll === 'function') renderAll(); } }));
  }
  if (x.apagavel){
    var bx = el('button', 'ae-apagar');
    bx.type = 'button';
    bx.title = 'Apagar o evento';
    bx.setAttribute('aria-label', 'Apagar «' + x.title + '»');
    bx.innerHTML = aeIcone('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>', 12);
    bx.addEventListener('click', function(e){ e.stopPropagation(); aeApagarEvento(x); });
    r.appendChild(bx);
  }
  return r;
}

function aeApagarEvento(x){
  if (!window.confirm('Apagar «' + x.title + '»?\n\nSai do Hoje, da Agenda e desta área.')) return;
  apiGestao('/api/gestao/eventos/' + x.id, { method: 'DELETE' }).then(function(){
    D.events = (D.events || []).filter(function(e){ return e.id !== x.id; });
    toast('Evento apagado.');
    renderAll();
  }).catch(function(e){ toast(e.message || 'Não deu para apagar o evento.'); });
}

/* Criar uma tarefa ou um pagamento sem sair da area. O essencial cabe numa
   janelinha - o resto afina-se depois, no detalhe. */
function aePopNovo(a, ancora, area, subs, tipo){
  tfFecharPop();
  var pag = tipo === 'pagamento';
  var f = aeF(a.view);
  var p = el('div', 'tf-pop');
  p.style.width = '320px';

  var cab = el('div', null, pag ? 'Novo pagamento' : 'Nova tarefa');
  cab.style.cssText = 'font-weight:500;font-size:.8125rem;color:var(--ink)';
  p.appendChild(cab);

  p.appendChild(el('label', null, pag ? 'O que se paga' : 'O que é'));
  var iT = el('input'); iT.type = 'text';
  iT.placeholder = pag ? 'ex.: seguro do carro' : 'ex.: pedir orçamento para os estores';
  p.appendChild(iT);

  var lin = el('div', 'tf-linha'); lin.style.marginTop = '8px';
  var cd = el('div'); cd.style.flex = '1';
  cd.appendChild(el('label', null, 'Prazo'));
  var iD = el('input'); iD.type = 'date';
  cd.appendChild(iD);
  lin.appendChild(cd);
  var iV = null, iP = null;
  if (pag){
    var cv = el('div'); cv.style.width = '110px';
    cv.appendChild(el('label', null, 'Valor'));
    iV = el('input'); iV.type = 'text'; iV.placeholder = '0,00';
    cv.appendChild(iV);
    lin.appendChild(cv);
  } else {
    var cp = el('div'); cp.style.width = '120px';
    cp.appendChild(el('label', null, 'Prioridade'));
    iP = el('select');
    [['normal', 'normal'], ['alta', 'alta'], ['media', 'média'], ['baixa', 'baixa']].forEach(function(o){
      iP.appendChild(new Option(o[1], o[0]));
    });
    cp.appendChild(iP);
    lin.appendChild(cp);
  }
  p.appendChild(lin);

  var lin2 = el('div', 'tf-linha'); lin2.style.marginTop = '8px';
  var cq = el('div'); cq.style.flex = '1';
  cq.appendChild(el('label', null, 'De quem'));
  var sQ = el('select');
  sQ.appendChild(new Option('— ninguém —', ''));
  (G.people || []).filter(function(x){ return x.active !== false && x.can_own_tasks !== false; })
    .forEach(function(x){ sQ.appendChild(new Option(x.name, String(x.id))); });
  if (f.quem !== 'todos') sQ.value = f.quem;
  cq.appendChild(sQ);
  lin2.appendChild(cq);
  var sPay = null;
  if (pag){
    var ce = el('div'); ce.style.flex = '1';
    ce.appendChild(el('label', null, 'A quem'));
    sPay = el('input'); sPay.type = 'text'; sPay.placeholder = 'entidade';
    ce.appendChild(sPay);
    lin2.appendChild(ce);
  }
  p.appendChild(lin2);

  var sC = null;
  if (subs.length){
    p.appendChild(el('label', null, 'Onde'));
    sC = el('select');
    var o0 = el('option', null, area.name + ' · geral'); o0.value = String(area.id);
    sC.appendChild(o0);
    subs.forEach(function(c){ var o = el('option', null, c.name); o.value = String(c.id); sC.appendChild(o); });
    if (f.sub !== 'tudo' && f.sub !== 'geral') sC.value = f.sub;
    p.appendChild(sC);
  }

  var ac = el('div', 'tf-acoes');
  var bC = el('button', 'btn small', 'Cancelar'); bC.type = 'button';
  bC.addEventListener('click', tfFecharPop);
  var bOk = el('button', 'btn small primary', 'Criar'); bOk.type = 'button';
  bOk.addEventListener('click', function(){
    var titulo = iT.value.trim();
    if (!titulo) return iT.focus();
    var corpo = {
      title: titulo, tipo: tipo,
      context_id: sC ? Number(sC.value) : area.id,
      owner_id: sQ.value ? Number(sQ.value) : null,
      due_on: iD.value || null,
      priority: iP ? iP.value : 'normal'
    };
    if (pag){
      corpo.amount = iV.value.trim() || null;
      corpo.payee = sPay.value.trim() || null;
    }
    apiGestao('/api/gestao/tarefas', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function(d){
      tfFecharPop();
      G = d;
      toast(pag ? 'Pagamento criado.' : 'Tarefa criada.');
      renderGestao();
    }).catch(function(e){ toast(e.message || 'Não deu para criar.'); });
  });
  ac.appendChild(bC); ac.appendChild(bOk);
  p.appendChild(ac);
  tfPosicionar(p, ancora);
  iT.focus();
}

/* O botao que abre qualquer uma destas janelas, no rodape do widget. */
function aeBotaoNovo(card, texto, fn){
  var b = el('button', 'btn small primary ae-mais', texto);
  b.type = 'button';
  b.style.marginLeft = '16px';
  b.dataset.tfpop = '1';
  b.addEventListener('click', function(){ fn(b); });
  card.appendChild(b);
  return b;
}

/* O que ja esta fechado vive num grupo proprio, no fim da lista: ve-se que
   existe, estende-se quando interessa. */
function aeGrupoFechados(a, card, chave, titulo, lista, desenhar){
  if (!lista.length) return;
  var k = 'fim:' + chave;
  var aberto = aeAbertoW(a.view, k);
  var h = el('button', 'ae-fim' + (aberto ? '' : ' rec'));
  h.type = 'button';
  h.innerHTML = aeIcone(AE_I.seta, 12);
  h.appendChild(document.createTextNode(titulo));
  h.appendChild(el('span', 'n', String(lista.length)));
  h.addEventListener('click', function(){ aeFecharW(a, k, aberto); });
  card.appendChild(h);
  if (aberto) desenhar(card);
}

/* Marcar uma data nesta area. Fica um evento como os outros: aparece no Hoje e
   na Agenda, e aqui. */
function aePopEvento(a, ancora, area, subs){
  tfFecharPop();
  var p = el('div', 'tf-pop');
  p.style.width = '300px';

  p.appendChild(el('label', null, 'O que é'));
  var iT = el('input'); iT.type = 'text'; iT.placeholder = 'ex.: vistoria do gás';
  p.appendChild(iT);

  var lin = el('div', 'tf-linha');
  lin.style.marginTop = '8px';
  var cd = el('div'); cd.style.flex = '1';
  cd.appendChild(el('label', null, 'Dia'));
  var iD = el('input'); iD.type = 'date'; iD.value = tfISO(tfHoje());
  cd.appendChild(iD);
  var ch = el('div'); ch.style.width = '96px';
  ch.appendChild(el('label', null, 'Hora'));
  var iH = el('input'); iH.type = 'time';
  ch.appendChild(iH);
  lin.appendChild(cd); lin.appendChild(ch);
  p.appendChild(lin);

  var sC = null;
  if (subs.length){
    p.appendChild(el('label', null, 'Onde'));
    sC = el('select');
    var o0 = el('option', null, area.name + ' · geral'); o0.value = String(area.id);
    sC.appendChild(o0);
    subs.forEach(function(c){ var o = el('option', null, c.name); o.value = String(c.id); sC.appendChild(o); });
    var f = aeF(a.view);
    if (f.sub !== 'tudo' && f.sub !== 'geral') sC.value = f.sub;
    p.appendChild(sC);
  }

  p.appendChild(el('label', null, 'Nota (opcional)'));
  var iN = el('input'); iN.type = 'text'; iN.placeholder = 'onde, com quem, o que levar';
  p.appendChild(iN);

  var ac = el('div', 'tf-acoes');
  var bC = el('button', 'btn small', 'Cancelar'); bC.type = 'button';
  bC.addEventListener('click', tfFecharPop);
  var bOk = el('button', 'btn small primary', 'Marcar'); bOk.type = 'button';
  bOk.addEventListener('click', function(){
    var titulo = iT.value.trim();
    if (!titulo) return iT.focus();
    if (!iD.value) return iD.focus();
    apiGestao('/api/gestao/eventos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: titulo, day: iD.value, at: iH.value || null,
        detail: iN.value.trim() || null,
        context_id: sC ? Number(sC.value) : area.id
      })
    }).then(function(ev){
      tfFecharPop();
      D.events = (D.events || []).concat([ev]);
      D.events.sort(function(x, y){ return x.day < y.day ? -1 : (x.day > y.day ? 1 : 0); });
      toast('Marcado para ' + tfDataTxt(ev.day, ev.at) + '.');
      renderAll();
    }).catch(function(e){ toast(e.message || 'Não deu para marcar.'); });
  });
  ac.appendChild(bC); ac.appendChild(bOk);
  p.appendChild(ac);
  tfPosicionar(p, ancora);
  iT.focus();
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
  var dir = el('span', 'mono');
  dir.style.marginLeft = 'auto';
  dir.textContent = dt ? (d.valid_on ? 'até ' : '') + (typeof tfDataCurta === 'function' ? tfDataCurta(dt) : dt) : '';
  r.appendChild(dir);
  return r;
}

function aeLinhaProjeto(p, tudo){
  var r = el('div', 'ae-pj');
  var g = el('div');
  g.style.flex = '1';
  g.style.minWidth = '0';
  g.appendChild(el('b', null, p.name));
  var pai = p.parent_id ? projeto(p.parent_id) : null;
  var sub = [pai ? pai.name : null, tudo ? areaNome(p.context_id) : null, p.status === 'planeado' ? 'planeado' : null]
    .filter(Boolean).join(' · ');
  if (sub){ g.appendChild(document.createElement('br')); g.appendChild(el('small', null, sub)); }
  r.appendChild(g);
  var c = p.contagem || {};
  var pc = c.total ? Math.round((c.feitas / c.total) * 100) : 0;
  var barra = el('span', 'ae-barra');
  var i = el('i', c.atrasadas ? 'bad' : '');
  i.style.width = pc + '%';
  barra.appendChild(i);
  barra.title = pc + '% feitas';
  r.appendChild(barra);
  var conta = el('span', 'mono');
  conta.style.width = '170px';
  conta.style.textAlign = 'right';
  conta.textContent = (c.abertas || 0) + ' por fazer' + (c.atrasadas ? ' · ' + c.atrasadas + ' em atraso' : '');
  r.appendChild(conta);
  r.addEventListener('click', function(){ if (typeof pjAbrir === 'function') pjAbrir(p.id); else show('projetos'); });
  return r;
}

function aeOrdem(a, b){
  if (a.due_on && b.due_on && a.due_on !== b.due_on) return a.due_on < b.due_on ? -1 : 1;
  if (!!a.due_on !== !!b.due_on) return a.due_on ? -1 : 1;
  return String(a.title).localeCompare(String(b.title), 'pt');
}

/* ------------------------------------------------------------------ *
 * o widget
 * ------------------------------------------------------------------ */

function aeWidget(a, chave, cfg){
  var aberto = aeAbertoW(a.view, chave);
  var card = el('div', 'card ae-w' + (aberto ? '' : ' ae-fechado'));
  var h = el('button', 'ae-wh');
  h.type = 'button';
  var ic = el('span', 'ae-wi ' + chave);
  ic.innerHTML = aeIcone(AE_I[chave], 15);
  h.appendChild(ic);
  h.appendChild(el('span', 'ae-wt', cfg.titulo));
  if (cfg.n) h.appendChild(el('span', 'ae-wn', String(cfg.n)));
  var s = el('span', 'ae-ws');
  if (cfg.resumo) s.appendChild(el('span', cfg.aviso ? 'bad' : '', cfg.resumo));
  var seta = el('span', 'ae-seta');
  seta.innerHTML = aeIcone(AE_I.seta, 14);
  s.appendChild(seta);
  h.appendChild(s);
  h.title = aberto ? 'Recolher' : 'Expandir';
  h.addEventListener('click', function(){ aeFecharW(a, chave, aberto); });
  card.appendChild(h);
  if (aberto) cfg.corpo(card);
  return card;
}

function aeRodape(card, texto, fn){
  var b = el('button', 'btn small ae-mais', texto);
  b.type = 'button';
  b.style.marginLeft = '16px';
  b.addEventListener('click', fn);
  card.appendChild(b);
}

/* As linhas de uma lista de tarefas ou pagamentos, partidas por sub-area
   quando o filtro esta em «Tudo». */
function aeCorpoTarefas(card, lista, grupos, area, vazio){
  if (!lista.length){ card.appendChild(el('p', 'ae-vazio', vazio)); return; }
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
    g.lista.forEach(function(t){ rows.appendChild(aeLinha(t)); });
    gr.appendChild(rows);
    card.appendChild(gr);
  });
}

function aeCorpoDespesas(card, lista, havia){
  if (AE.despesas === null){ card.appendChild(el('p', 'ae-vazio', 'A ler as despesas…')); return; }
  if (!lista.length){
    card.appendChild(el('p', 'ae-vazio', havia
      ? 'Nenhuma despesa desta área no que está filtrado.'
      : 'Nenhuma despesa arrumada nesta área. As que não têm área vivem nas Finanças.'));
    return;
  }
  var rows = el('div', 'tf-rows');
  lista.forEach(function(x){ rows.appendChild(aeLinhaDespesa(x)); });
  card.appendChild(rows);
}

/* Os documentos da area. Na vista de tudo vem arrumados por sub-area, e os
   que sao da area sem sub-area nenhuma ficam no fim, em «geral». */
function aeCorpoDocs(card, docs, area, grupos, havia){
  if (!window.D || !D.documents){ card.appendChild(el('p', 'ae-vazio', 'A ler os documentos…')); return; }
  if (!docs.length){
    card.appendChild(el('p', 'ae-vazio', havia
      ? 'Nenhum papel desta área no que está filtrado.'
      : 'Nenhum papel arrumado nesta área. Arrumam-se nos Documentos.'));
    return;
  }
  var CJ = typeof docsConjuntos === 'function' ? docsConjuntos() : { filhos: {}, pendurado: {} };
  var ordem = grupos.filter(function(c){ return c.id !== area.id; })
    .concat(grupos.filter(function(c){ return c.id === area.id; }));
  var gs = ordem.map(function(c){ return { c: c, lista: docs.filter(function(d){ return d.context_id === c.id; }) }; })
    .filter(function(g){ return g.lista.length; });
  var cabecas = grupos.length > 1;
  gs.forEach(function(g){
    var gr = el('div', 'ae-grp');
    if (cabecas){
      var h4 = el('h4', null, g.c.id === area.id ? area.name + ' · geral' : g.c.name);
      h4.appendChild(el('span', null, String(g.lista.length)));
      gr.appendChild(h4);
    }
    g.lista.forEach(function(d){ gr.appendChild(aeLinhaDoc(d, CJ.filhos[d.id])); });
    card.appendChild(gr);
  });
}

function aeCorpoEventos(card, lista, vazio){
  if (!lista.length){ card.appendChild(el('p', 'ae-vazio', vazio)); return; }
  var rows = el('div', 'tf-rows');
  lista.forEach(function(x){ rows.appendChild(aeLinhaEvento(x)); });
  card.appendChild(rows);
}

function aeCorpoProjetos(card, pjs, tudo){
  if (!pjs.length){ card.appendChild(el('p', 'ae-vazio', 'Nenhum projeto aberto com este filtro.')); return; }
  pjs.forEach(function(p){ card.appendChild(aeLinhaProjeto(p, tudo)); });
}

/* ------------------------------------------------------------------ *
 * as despesas (o ecra das Financas le-as so quando la se entra)
 * ------------------------------------------------------------------ */

function aeRecarregarDespesas(){
  AE.despesas = null;
  AE.aLerDespesas = false;
  aeRender();
}

function aeDespesas(){
  if (AE.despesas) return AE.despesas;
  if (!AE.aLerDespesas){
    AE.aLerDespesas = true;
    apiGestao('/api/despesas').then(function(d){
      AE.despesas = d.despesas || [];
      aeRender();
    }).catch(function(){ AE.despesas = []; });
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * o ecra
 * ------------------------------------------------------------------ */

function aeChip(nome, ligado, fn, extra){
  var b = el('button', 'ae-chip' + (ligado ? ' on' : ''));
  b.type = 'button';
  if (extra && extra.cor){ var d = el('i', 'dot'); d.style.background = extra.cor; b.appendChild(d); }
  b.appendChild(document.createTextNode(nome));
  if (extra && extra.n) b.appendChild(el('small', extra.atraso ? 'bad' : '', String(extra.n)));
  b.addEventListener('click', fn);
  return b;
}

/* Uma lista pendente: o botao diz o rotulo e o que esta escolhido; a janela
   (um tf-pop, como as outras deste ecra) tem caixas de escolha multipla. A
   escolha aplica-se na hora e a janela volta a abrir-se por cima do ecra
   redesenhado, para se poder marcar varias seguidas. */
var AE_DD = { aberta: null };
function aeDropdown(rotulo, valor, ligado, atraso, encher){
  var b = el('button', 'ae-dd' + (ligado ? ' on' : ''));
  b.type = 'button';
  b.dataset.tfpop = '1';
  b.dataset.dd = rotulo;
  b.appendChild(el('span', 'ae-lbl', rotulo));
  b.appendChild(el('b', null, valor));
  if (atraso){ var sm = el('small', null, String(atraso)); sm.title = atraso + ' em atraso'; b.appendChild(sm); }
  var seta = el('span'); seta.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>';
  b.appendChild(seta.firstChild);
  b.encher = encher;
  b.addEventListener('click', function(){
    if (AE_DD.aberta === rotulo && document.querySelector('.ae-ddp')){ tfFecharPop(); AE_DD.aberta = null; return; }
    aeAbrirDropdown(b);
  });
  return b;
}
function aeAbrirDropdown(b){
  tfFecharPop();
  var p = el('div', 'tf-pop ae-ddp');
  b.encher(p);
  AE_DD.aberta = b.dataset.dd;
  tfPosicionar(p, b);
}
/* Depois de redesenhar, a janela aberta volta a abrir-se sobre o botao novo. */
function aeReabrir(){
  var r = AE_DD.aberta;
  if (!r) return;
  setTimeout(function(){
    var b = document.querySelector('.view.is-active .ae-dd[data-dd="' + r + '"]') ||
            document.querySelector('.ae-dd[data-dd="' + r + '"]');
    if (b) aeAbrirDropdown(b); else AE_DD.aberta = null;
  }, 0);
}
function aeOpcao(nome, ligado, fn, extra){
  extra = extra || {};
  var l = el('label', 'ae-op');
  var c = el('input'); c.type = extra.radio ? 'radio' : 'checkbox'; c.checked = !!ligado;
  c.addEventListener('change', function(){ fn(); aeReabrir(); });
  l.appendChild(c);
  if (extra.cor){ var d = el('i', 'dot'); d.style.background = extra.cor; l.appendChild(d); }
  l.appendChild(el('span', null, nome));
  if (extra.n) l.appendChild(el('small', extra.atr ? 'bad' : '', String(extra.n) + (extra.atr ? ' · ' + extra.atr + ' atraso' : '')));
  return l;
}

function aeFila(rotulo){
  var linha = el('div', 'ae-fl');
  linha.appendChild(el('span', 'ae-lbl', rotulo));
  var chips = el('div', 'ae-chips');
  linha.appendChild(chips);
  linha.chips = chips;
  return linha;
}

function aeKpi(valor, nome, cls, fn){
  var b = el('button', 'ae-kpi');
  b.type = 'button';
  b.appendChild(el('b', cls || '', valor));
  b.appendChild(el('span', null, nome));
  b.addEventListener('click', fn);
  return b;
}

function aeRenderArea(a){
  var box = aeCaixa(a);
  if (!box) return;
  clear(box);
  var area = aeArea(a);
  if (!area) return;
  var f = aeF(a.view);
  var subs = aeSubs(area);
  var todos = [area].concat(subs);
  var idsTodos = todos.map(function(c){ return c.id; });

  var daArea = (G.tasks || []).filter(function(t){
    return !t.parent_id && !t.project_id && idsTodos.indexOf(t.context_id) >= 0;
  });
  var abertas = daArea.filter(aeAberta);
  /* O /api/gestao traz as fechadas ha pouco; as mais antigas vivem no
     historico das Tarefas, e e para la que o rodape leva. */
  var jaFechadas = daArea.filter(function(t){ return !aeAberta(t); });
  var pjsTodos = (G.projects || []).filter(function(p){
    return p.tipo !== 'programa' && p.status !== 'concluido' && idsTodos.indexOf(p.context_id) >= 0;
  });
  var docsTodos = ((window.D && D.documents) || []).filter(function(d){ return idsTodos.indexOf(d.context_id) >= 0; });
  /* As Financas sao a casa do dinheiro sem area: uma despesa que a caixa de
     entrada catalogou sem area nao pode ficar invisivel em lado nenhum. */
  var orfas = a.view === 'financas';
  var despTodas = (aeDespesas() || []).filter(function(x){
    return idsTodos.indexOf(x.context_id) >= 0 || (orfas && !x.context_id);
  });

  /* Onde: Tudo, cada sub-area, e «Geral» so quando a area tem coisas suas.
     Um filtro guardado que deixou de existir volta a Tudo. */
  var opcoes = [];
  if (subs.length){
    opcoes.push({ k: 'tudo', nome: 'Tudo', ids: idsTodos });
    subs.forEach(function(s){ opcoes.push({ k: String(s.id), nome: s.name, ids: [s.id] }); });
    var temGeral = abertas.some(function(t){ return t.context_id === area.id; }) ||
      pjsTodos.some(function(p){ return p.context_id === area.id; }) ||
      docsTodos.some(function(d){ return d.context_id === area.id; });
    if (temGeral) opcoes.push({ k: 'geral', nome: 'Geral', ids: [area.id] });
  }
  /* Varias sub-areas somam-se. Nenhuma escolhida (ou uma que deixou de
     existir) e tudo. */
  var escolhidas = opcoes.filter(function(o){ return o.k !== 'tudo' && f.subs.indexOf(o.k) >= 0; });
  var ids = escolhidas.length ? [].concat.apply([], escolhidas.map(function(o){ return o.ids; })) : idsTodos;
  var tudo = !escolhidas.length;
  /* Sem Quem neste ecra, a pessoa guardada de outros tempos nao conta. */
  if (a.semQuem) f.quem = 'todos';
  var grupos = todos.filter(function(c){ return ids.indexOf(c.id) >= 0; });

  /* Os periodos somam-se: basta cair num. «Em atraso» e um criterio a parte
     (so se aplica ao que tem prazo e esta por fazer). */
  var JS = f.periodos.length ? {
    atraso: f.periodos.indexOf('atraso') >= 0,
    janelas: f.periodos.filter(function(p){ return p !== 'atraso'; }).map(aeJanela).filter(function(x){ return x && x !== 'atraso'; })
  } : null;
  function naJ(iso){ return !!iso && JS.janelas.some(function(w){ return aeNaJanela(w, iso); }); }
  function naArea(x){ return ids.indexOf(x.context_id) >= 0; }
  function naAreaDesp(x){ return naArea(x) || (orfas && tudo && !x.context_id); }
  function passaTarefa(t){
    if (!naArea(t)) return false;
    if (!aePassaPessoa(f, t.owner_id, t.subjects)) return false;
    if (!JS) return true;
    if (JS.atraso && tfNivelData(t) === 'bad') return true;
    if (!JS.janelas.length) return false;
    /* Sem data nao ha periodo que a apanhe: fica sempre a vista. */
    return !t.due_on || naJ(t.due_on);
  }

  var filtradas = abertas.filter(passaTarefa);
  var notas = filtradas.filter(function(t){ return tfTipo(t) === 'nota'; }).length;
  /* Um aniversario e um evento, nao uma tarefa: os lembretes saem daqui e vao
     para o widget dos Eventos, que e onde uma data que so aparece pertence. */
  var lembretes = filtradas.filter(function(t){ return tfTipo(t) === 'lembrete'; });
  var soltas = filtradas.filter(function(t){ return tfTipo(t) === 'tarefa' || tfTipo(t) === 'pagamento'; });
  var pags = soltas.filter(function(t){ return tfTipo(t) === 'pagamento'; }).sort(aeOrdem);
  var outras = soltas.filter(function(t){ return tfTipo(t) === 'tarefa'; }).sort(aeOrdem);

  /* Os eventos da area e os lembretes, na mesma lista: sao a mesma coisa vista
     de dois lados - uma data que chega. */
  function passaDia(dia){
    if (!JS) return true;
    return naJ(dia);
  }
  /* As fechadas passam pelos mesmos filtros, mas pela data em que fecharam. */
  function passaFechada(t){
    if (!naArea(t)) return false;
    if (!aePassaPessoa(f, t.owner_id, t.subjects)) return false;
    if (!JS) return true;
    if (!JS.janelas.length) return false;
    var dia = t.completed_at ? String(t.completed_at).slice(0, 10) : t.due_on;
    return !dia || naJ(dia);
  }
  var verFeitas = f.fechados.indexOf('tarefas') >= 0, verPagos = f.fechados.indexOf('pagamentos') >= 0;
  var fechadas = (verFeitas || verPagos) ? jaFechadas.filter(passaFechada) : [];
  var tarefasFechadas = verFeitas ? fechadas.filter(function(t){ return tfTipo(t) === 'tarefa'; }).sort(aeOrdem) : [];
  var pagamentosFechados = verPagos ? fechadas.filter(function(t){ return tfTipo(t) === 'pagamento'; }).sort(aeOrdem) : [];

  var eventos = [], eventosPassados = [];
  var hojeISO = tfISO(tfHoje());
  var guardaEvento = function(x){ (x.day < hojeISO ? eventosPassados : eventos).push(x); };
  ((window.D && D.events) || []).forEach(function(e){
    var meu = typeof e.id === 'number' && naArea(e);
    /* Os aniversarios nao tem area: sao da Familia, e e la que aparecem. */
    var aniv = a.view === 'familia' && e.calendar === 'aniversarios';
    if ((!meu && !aniv) || !passaDia(e.day)) return;
    guardaEvento({ id: e.id, title: e.title, day: e.day, at: e.at, detail: e.detail,
                   context_id: e.context_id, apagavel: typeof e.id === 'number', orig: e });
  });
  var semData = 0;
  lembretes.forEach(function(t){
    if (!t.due_on){ semData++; return; }
    if (!passaDia(t.due_on)) return;
    guardaEvento({ title: t.title, day: t.due_on, at: t.due_time, tipo: 'lembrete',
                   tarefa: t.id, context_id: t.context_id, dono: pessoa(t.owner_id),
                   repete: t.repeat_rule ? (t.repeat_label || 'repete') : null });
  });
  var porDia = function(x, y){
    if (x.day !== y.day) return x.day < y.day ? -1 : 1;
    return String(x.at || '').localeCompare(String(y.at || ''));
  };
  eventos.sort(porDia);
  eventosPassados.sort(porDia).reverse();
  if (f.fechados.indexOf('eventos') < 0) eventosPassados = [];

  var despesas = despTodas.filter(function(x){
    if (!naAreaDesp(x)) return false;
    if (!aePassaPessoaSo(f, [x.person_id])) return false;
    if (!JS) return true;
    return naJ(x.spent_on);
  });

  var docs = docsTodos.filter(function(d){
    if (!naArea(d)) return false;
    if (!aePassaPessoaSo(f, [d.person_id])) return false;
    if (!JS) return true;
    if (!JS.janelas.length) return false;
    /* O papel entra pela data dele ou pela validade - basta uma das duas. */
    if (!d.issued_on && !d.valid_on) return true;
    return naJ(d.issued_on) || naJ(d.valid_on);
  });

  var pjs = pjsTodos.filter(function(p){
    if (!naArea(p)) return false;
    if (!aePassaPessoaSo(f, (p.members || []).map(function(m){ return m.person_id; }))) return false;
    /* Um projeto dura meses: o periodo nao o corta, so o «em atraso». */
    if (JS && JS.atraso && !JS.janelas.length) return (p.contagem || {}).atrasadas > 0;
    return true;
  });

  /* ---- a barra dos filtros: uma linha, listas pendentes ---- */
  var barra = el('div', 'card ae-filtros');
  var dds = el('div', 'ae-dds');
  barra.appendChild(dds);

  function contagem(o){
    var n = abertas.filter(function(t){ return tfTipo(t) !== 'nota' && o.ids.indexOf(t.context_id) >= 0; });
    return { n: n.length, atr: n.filter(function(t){ return tfNivelData(t) === 'bad'; }).length };
  }

  if (opcoes.length){
    var nomeOnde = !escolhidas.length ? 'Tudo'
      : escolhidas.length === 1 ? escolhidas[0].nome
      : escolhidas.length + ' sub-áreas';
    var cOnde = escolhidas.length ? null : contagem(opcoes[0]);
    dds.appendChild(aeDropdown('Onde', nomeOnde, !!escolhidas.length, cOnde && cOnde.atr, function(pop){
      opcoes.forEach(function(o){
        var c = contagem(o);
        var todo = o.k === 'tudo';
        pop.appendChild(aeOpcao(o.nome, todo ? !escolhidas.length : f.subs.indexOf(o.k) >= 0, function(){
          if (todo) aePor(a, 'subs', []); else aeAlternar(a, 'subs', o.k);
        }, { n: c.n, atr: c.atr }));
        if (todo) pop.appendChild(el('hr'));
      });
    }));
  }

  if (!a.semQuem){
    var quemP = f.quem !== 'todos' ? pessoa(Number(f.quem)) : null;
    dds.appendChild(aeDropdown('Quem', quemP ? quemP.name : 'Agregado todo', !!quemP, 0, function(pop){
      var seg = el('div', 'ae-seg' + (f.quem === 'todos' ? ' ae-off' : ''));
      if (f.quem === 'todos') seg.title = 'Escolhe uma pessoa para isto contar';
      AE_PAPEIS.forEach(function(pp){
        var b = el('button', f.papel === pp[0] ? 'on' : '', pp[1]);
        b.type = 'button';
        b.addEventListener('click', function(){ aePor(a, 'papel', pp[0]); aeReabrir(); });
        seg.appendChild(b);
      });
      pop.appendChild(seg);
      pop.appendChild(aeOpcao('Agregado todo', f.quem === 'todos', function(){ aePor(a, 'quem', 'todos'); }, { radio: true, cor: 'var(--faint)' }));
      (G.people || []).filter(function(p){ return p.active !== false; }).forEach(function(p){
        pop.appendChild(aeOpcao(p.name, f.quem === String(p.id), function(){ aePor(a, 'quem', String(p.id)); },
          { radio: true, cor: p.color || 'var(--c1)' }));
      });
      if (quemP){
        pop.appendChild(el('hr'));
        var bf = el('button', 'ae-chip ae-ficha', 'Ficha de ' + quemP.name.split(' ')[0]);
        bf.type = 'button';
        bf.dataset.ficha = quemP.id;
        bf.style.margin = '2px 8px 4px';
        pop.appendChild(bf);
      }
    }));
  }

  var nomesQ = f.periodos.map(aeNomePeriodo);
  var nomeQuando = !nomesQ.length ? 'Tudo' : nomesQ.length <= 2 ? nomesQ.join(' + ') : nomesQ.length + ' períodos';
  dds.appendChild(aeDropdown('Quando', nomeQuando, !!nomesQ.length, 0, function(pop){
    pop.appendChild(aeOpcao('Tudo', !f.periodos.length, function(){ aePor(a, 'periodos', []); }));
    pop.appendChild(el('hr'));
    AE_PERIODOS.filter(function(pp){ return pp[0] !== 'tudo'; }).forEach(function(pp){
      pop.appendChild(aeOpcao(pp[1], f.periodos.indexOf(pp[0]) >= 0, function(){ aeAlternar(a, 'periodos', pp[0]); }));
    });
    var aMao = f.periodos.filter(aePeriodoAMao);
    if (aMao.length){
      pop.appendChild(el('hr'));
      aMao.forEach(function(pk){
        pop.appendChild(aeOpcao(aeNomePeriodo(pk), true, function(){ aeAlternar(a, 'periodos', pk); }));
      });
    }
    pop.appendChild(el('hr'));
    pop.appendChild(el('div', 'ae-ddt', 'Juntar um mês ou um ano'));
    var linhaM = el('div', 'ae-mes');
    var sM = el('select');
    var o0 = el('option', null, 'ano inteiro'); o0.value = '0'; sM.appendChild(o0);
    MESES.forEach(function(nome, i){ var o = el('option', null, nome); o.value = String(i + 1); sM.appendChild(o); });
    var hj = tfHoje();
    sM.value = String(hj.getMonth() + 1);
    var sA = el('select');
    for (var y = hj.getFullYear() + 1; y >= hj.getFullYear() - 5; y--){
      var oa = el('option', null, String(y)); oa.value = String(y); sA.appendChild(oa);
    }
    sA.value = String(hj.getFullYear());
    var bJ = el('button', 'btn small', 'Juntar'); bJ.type = 'button';
    bJ.addEventListener('click', function(){
      var m = Number(sM.value);
      var pk = m ? 'm:' + sA.value + '-' + String(m).padStart(2, '0') : 'a:' + sA.value;
      var l = aeF(a.view).periodos;
      if (l.indexOf(pk) < 0) l.push(pk);
      aePor(a, 'periodos', l);
      aeReabrir();
    });
    linhaM.appendChild(sM); linhaM.appendChild(sA); linhaM.appendChild(bJ);
    pop.appendChild(linhaM);
  }));

  var nomesF = AE_FECHADOS.filter(function(x){ return f.fechados.indexOf(x[0]) >= 0; });
  var nomeFech = !nomesF.length ? 'Escondidos'
    : nomesF.length === AE_FECHADOS.length ? 'Todos à vista'
    : nomesF.map(function(x){ return x[1].split(' ')[0]; }).join(', ');
  dds.appendChild(aeDropdown('Fechados', nomeFech, !!nomesF.length, 0, function(pop){
    pop.appendChild(el('div', 'ae-ddt', 'Mostrar o que já foi feito, pago ou passou'));
    AE_FECHADOS.forEach(function(x){
      pop.appendChild(aeOpcao(x[1], f.fechados.indexOf(x[0]) >= 0, function(){ aeAlternar(a, 'fechados', x[0]); }));
    });
  }));

  if (escolhidas.length || f.periodos.length || f.fechados.length || (!a.semQuem && f.quem !== 'todos')){
    var bL = el('button', 'ae-limpar', 'Limpar filtros');
    bL.type = 'button';
    bL.addEventListener('click', function(){
      var nf = aeF(a.view);
      nf.subs = []; nf.periodos = []; nf.fechados = []; nf.quem = 'todos';
      AE.filtro[a.view] = nf;
      aeGuardar('aeFiltro', AE.filtro);
      aeRenderArea(a);
    });
    dds.appendChild(bL);
  }
  box.appendChild(barra);

  /* ---- os numeros, que sao botoes ---- */
  var atrasadas = soltas.filter(function(t){ return tfNivelData(t) === 'bad'; }).length;
  var aPagar = pags.reduce(function(s, t){ return s + Number(t.amount || 0); }, 0);
  function abrirW(chave){ return function(){ aeFecharW(a, chave, false); }; }

  /* A sub-area a que as Despesas e os Documentos devem abrir: a unica
     escolhida no Onde, senao a area inteira. */
  var alvoId = escolhidas.length === 1 && escolhidas[0].k !== 'geral' ? Number(escolhidas[0].k) : area.id;
  var alvoNome = escolhidas.length === 1 ? escolhidas[0].nome : area.name;

  var kpis = el('div', 'ae-kpis');
  kpis.appendChild(aeKpi(String(soltas.length), 'por fazer', '', function(){
    AE.tipo[a.view] = 'todas'; aeFecharW(a, 'tarefas', false);
  }));
  kpis.appendChild(aeKpi(String(atrasadas), 'em atraso', atrasadas ? 'bad' : '', function(){ aePor(a, 'periodos', ['atraso']); }));
  kpis.appendChild(aeKpi(tfEuros(aPagar), 'a pagar', '', function(){
    AE.tipo[a.view] = 'pagamento'; aeFecharW(a, 'tarefas', false);
  }));
  kpis.appendChild(aeKpi(String(eventos.length), 'na agenda', '', abrirW('eventos')));

  /* As despesas: o mes corrente da area (ou da sub-area), com os ultimos nove
     meses em miniatura. O detalhe - graficos, quadro, periodos - vive na
     pagina das Despesas, que abre ja filtrada. */
  var despAqui = AE.despesas === null ? null : despTodas.filter(naAreaDesp);
  var hojeD = tfHoje();
  var meses9 = [];
  for (var mi = 8; mi >= 0; mi--){
    var dm = new Date(hojeD.getFullYear(), hojeD.getMonth() - mi, 1);
    meses9.push(tfISO(dm).slice(0, 7));
  }
  var porMes = {};
  (despAqui || []).forEach(function(x){ var k = String(x.spent_on || '').slice(0, 7); porMes[k] = (porMes[k] || 0) + Number(x.amount || 0); });
  var esteMes = porMes[meses9[8]] || 0;
  var bD = el('button', 'ae-kpi ae-link');
  bD.type = 'button';
  var vD = el('b', null, despAqui === null ? '…' : tfEuros(esteMes));
  vD.appendChild(el('i', null, '→'));
  bD.appendChild(vD);
  bD.appendChild(el('span', null, 'despesas · ' + MESES[hojeD.getMonth()]));
  var sp = el('span', 'ae-spark');
  var maxM = Math.max.apply(null, meses9.map(function(k){ return porMes[k] || 0; }).concat([1]));
  meses9.forEach(function(k, ix){
    var barra = el('i', ix === 8 ? 'agora' : '');
    barra.style.height = Math.max(2, Math.round((porMes[k] || 0) / maxM * 16)) + 'px';
    sp.appendChild(barra);
  });
  bD.appendChild(sp);
  bD.title = 'Ver o detalhe das despesas de ' + alvoNome;
  bD.addEventListener('click', function(){
    if (typeof dpAbrir === 'function') dpAbrir(alvoId); else show('despesas');
  });
  kpis.appendChild(bD);

  /* Os documentos da area, sem o periodo: e o arquivo dela. Abre os
     Documentos ja filtrados. */
  var docsAqui = docsTodos.filter(naArea);
  var porLerAqui = docsAqui.filter(function(d){ return !d.lido; }).length;
  var bO = el('button', 'ae-kpi ae-link');
  bO.type = 'button';
  var vO = el('b', null, String(docsAqui.length));
  vO.appendChild(el('i', null, '→'));
  bO.appendChild(vO);
  bO.appendChild(el('span', null, 'documentos · ' + alvoNome));
  if (porLerAqui) bO.appendChild(el('small', null, porLerAqui + ' por ler'));
  bO.title = 'Abrir os Documentos de ' + alvoNome;
  bO.addEventListener('click', function(){
    if (typeof DOCS_AREA !== 'undefined') DOCS_AREA = alvoId;
    show('documentos');
    if (typeof renderDocumentos === 'function') renderDocumentos();
  });
  kpis.appendChild(bO);
  box.appendChild(kpis);

  var MAXT = 40;
  /* Uma lista vazia diz coisas diferentes conforme a area nao ter nada, ou
     ter e o filtro estar a tapar. */
  var temTarefas = abertas.some(function(t){ return tfTipo(t) === 'tarefa'; });
  var temPagamentos = abertas.some(function(t){ return tfTipo(t) === 'pagamento'; });
  var comSub = grupos.length > 1;

  /* ---- a esquerda (3/4): tarefas e pagamentos numa lista so, por prazo ---- */
  var tipoSel = AE.tipo[a.view] || 'todas';
  var lista = soltas.filter(function(t){ return tipoSel === 'todas' || tfTipo(t) === tipoSel; }).sort(aeOrdem);
  var fechadasT = tarefasFechadas.concat(pagamentosFechados)
    .filter(function(t){ return tipoSel === 'todas' || tfTipo(t) === tipoSel; }).sort(aeOrdem);
  var limite14 = tfISO(tfMais(tfHoje(), 14));
  var gAtraso = [], gProx = [], gDepois = [], gSem = [];
  lista.forEach(function(t){
    if (!t.due_on) gSem.push(t);
    else if (tfNivelData(t) === 'bad') gAtraso.push(t);
    else if (t.due_on <= limite14) gProx.push(t);
    else gDepois.push(t);
  });
  var nAtrasoL = gAtraso.length;
  var aPagarL = lista.filter(function(t){ return tfTipo(t) === 'pagamento'; })
    .reduce(function(s2, t){ return s2 + Number(t.amount || 0); }, 0);

  var main = el('div', 'ae-main');
  main.appendChild(aeWidget(a, 'tarefas', {
    titulo: 'Tarefas',
    n: lista.length,
    resumo: [nAtrasoL ? nAtrasoL + ' em atraso' : 'em dia', aPagarL ? tfEuros(aPagarL) + ' a pagar' : ''].filter(Boolean).join(' · '),
    aviso: nAtrasoL > 0,
    corpo: function(card){
      var ls = el('div', 'ae-lseg');
      var seg = el('div', 'ae-seg');
      [['todas', 'Todas', soltas.length],
       ['tarefa', 'Tarefas', soltas.filter(function(t){ return tfTipo(t) === 'tarefa'; }).length],
       ['pagamento', 'Pagamentos', pags.length]].forEach(function(o){
        var b = el('button', tipoSel === o[0] ? 'on' : '', o[1] + ' ' + o[2]);
        b.type = 'button';
        b.addEventListener('click', function(){ AE.tipo[a.view] = o[0]; aeRenderArea(a); });
        seg.appendChild(b);
      });
      ls.appendChild(seg);
      card.appendChild(ls);

      if (!lista.length){
        card.appendChild(el('p', 'ae-vazio', (tipoSel === 'pagamento'
          ? (temPagamentos ? 'Nenhum pagamento no que está filtrado.' : 'Nenhum pagamento por fazer.')
          : (temTarefas || temPagamentos ? 'Nada por fazer no que está filtrado.' : 'Nada por fazer fora dos projetos.'))));
      }
      var usados = 0;
      [['Em atraso', gAtraso, 'bad'], ['Próximos 14 dias', gProx, 'acc'], ['Mais tarde', gDepois, ''], ['Sem prazo', gSem, '']]
        .forEach(function(g){
          if (!g[1].length || usados >= MAXT) return;
          var gr = el('div', 'ae-grp');
          var h4 = el('h4', g[2], g[0]);
          h4.appendChild(el('span', null, String(g[1].length)));
          gr.appendChild(h4);
          var rows = el('div', 'tf-rows');
          g[1].slice(0, MAXT - usados).forEach(function(t){ rows.appendChild(aeLinha(t, comSub)); });
          usados += g[1].length;
          gr.appendChild(rows);
          card.appendChild(gr);
        });
      if (lista.length > MAXT) card.appendChild(el('p', 'ae-nota', 'e mais ' + (lista.length - MAXT) + ' nas Tarefas.'));
      if (notas) card.appendChild(el('p', 'ae-nota', notas + (notas === 1 ? ' nota' : ' notas') + ' nas Tarefas › Notas.'));
      aeGrupoFechados(a, card, 'tarefas', 'Já feitas e pagas', fechadasT, function(c){
        var rows = el('div', 'tf-rows');
        fechadasT.slice(0, MAXT).forEach(function(t){
          var li = aeLinha(t, comSub); li.classList.add('done'); rows.appendChild(li);
        });
        c.appendChild(rows);
        if (fechadasT.length > MAXT) c.appendChild(el('p', 'ae-nota', 'e mais ' + (fechadasT.length - MAXT) + ' no histórico das Tarefas.'));
      });
      var bT = aeBotaoNovo(card, '+ Nova tarefa', function(b){ aePopNovo(a, b, area, subs, 'tarefa'); });
      var bP = aeBotaoNovo(card, '+ Novo pagamento', function(b){ aePopNovo(a, b, area, subs, 'pagamento'); });
      bP.className = 'btn small ae-mais';
      bP.style.marginLeft = '6px';
      aeRodape(card, 'Abrir as Tarefas', function(){ show('tarefas'); });
    }
  }));

  /* ---- a direita (1/4): a agenda da sub-area e os projetos ---- */
  var dir = el('div', 'ae-dir');
  dir.appendChild(aeWidget(a, 'eventos', {
    titulo: 'Agenda',
    n: eventos.length + eventosPassados.length,
    resumo: (function(){
      var h = tfISO(tfHoje());
      var prox = eventos.filter(function(x){ return x.day >= h; })[0];
      return prox ? (prox.day === h ? 'hoje' : tfDataCurta(prox.day)) : '';
    })(),
    corpo: function(card){
      aeCorpoEventos(card, eventos.slice(0, 15), 'Nada marcado nesta área no que está filtrado.');
      if (eventos.length > 15) card.appendChild(el('p', 'ae-nota', 'e mais ' + (eventos.length - 15) + ' nos Eventos.'));
      if (semData) card.appendChild(el('p', 'ae-nota', semData + (semData === 1 ? ' lembrete sem data' : ' lembretes sem data') + ', nas Tarefas › Lembretes.'));
      aeGrupoFechados(a, card, 'eventos', 'Já passaram', eventosPassados, function(c){
        var rows = el('div', 'tf-rows');
        eventosPassados.slice(0, 15).forEach(function(x){
          var li = aeLinhaEvento(x); li.classList.add('done'); rows.appendChild(li);
        });
        c.appendChild(rows);
      });
      aeBotaoNovo(card, '+ Marcar uma data', function(b){ aePopEvento(a, b, area, subs); });
    }
  }));
  dir.appendChild(aeWidget(a, 'projetos', {
    titulo: 'Projetos',
    n: pjs.length,
    resumo: pjs.reduce(function(s3, p){ return s3 + ((p.contagem || {}).abertas || 0); }, 0) + ' por fazer',
    aviso: pjs.some(function(p){ return (p.contagem || {}).atrasadas; }),
    corpo: function(card){
      aeCorpoProjetos(card, pjs, tudo);
      aeRodape(card, 'Abrir os Projetos', function(){ show('projetos'); });
    }
  }));
  main.appendChild(dir);
  box.appendChild(main);
}

/* ------------------------------------------------------------------ *
 * As sub-areas no menu (26 set)
 *
 * Cada area com sub-areas mostra-as no menu, por baixo dela, com uma seta
 * para recolher (comecam abertas). Carregar numa sub-area abre o ecra da
 * area ja filtrado por ela - e o mesmo filtro «Onde» do ecra, nao um
 * segundo: mudar la muda o realce aqui, e vice-versa. Carregar na area em
 * si mostra-a inteira.
 * ------------------------------------------------------------------ */

var AE_NAV_CSS =
  '.nav .ae-nseta{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:5px;color:var(--faint);flex:none}' +
  '.nav .badge + .ae-nseta{margin-left:4px}' +
  '.nav .ae-nseta:hover{background:var(--surface);color:var(--ink)}' +
  '.nav .ae-nseta svg{opacity:1;transition:transform .15s}' +
  '.nav .ae-nseta.fechado svg{transform:rotate(-90deg)}' +
  '.nav .ae-nsubs{display:flex;flex-direction:column;gap:1px;margin:1px 0 3px}' +
  '.nav .ae-nsubs[hidden]{display:none}' +
  '.nav button.ae-nsub{padding:5px 8px 5px 34px;font-size:.8125rem;color:var(--muted);position:relative}' +
  '.nav button.ae-nsub::before{content:"";position:absolute;left:15px;top:50%;width:9px;height:1px;background:var(--line)}' +
  '.nav button.ae-nsub.is-active{background:var(--accent-soft);color:var(--accent-ink);font-weight:500}' +
  '.nav button.ae-nsub span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.nav button.is-active.ae-com-sub{background:none}' +
  '@media (max-width: 900px){.nav .ae-nsubs,.nav .ae-nseta{display:none}}';

var AE_NAV_FECHADO = aeLerGuardado('aeNavFechado');

function aeNavEstilo(){
  if (document.getElementById('aeNavCss')) return;
  var st = document.createElement('style'); st.id = 'aeNavCss'; st.textContent = AE_NAV_CSS;
  document.head.appendChild(st);
}

/* Escolher no menu e escolher no ecra sao a mesma coisa: uma sub-area so,
   ou nenhuma (a area inteira). Os outros filtros (quem, quando) ficam. */
function aeNavFiltrar(a, sub){
  var f = aeF(a.view);
  f.subs = sub ? [sub] : [];
  AE.filtro[a.view] = f;
  aeGuardar('aeFiltro', AE.filtro);
  try { aeRenderArea(a); } catch (e) { console.error('[farol] area ' + a.view, e); }
}

function aeNavMontar(){
  var nav = document.getElementById('nav');
  if (!nav || !window.G || !G.contextos) return;
  aeNavEstilo();
  AE_AREAS.forEach(function(a){
    var b = nav.querySelector('button[data-view="' + a.view + '"]');
    if (!b) return;
    var area = aeArea(a);
    var subs = area ? aeSubs(area).filter(function(s){ return s.active !== false; }) : [];
    var chave = subs.map(function(s){ return s.id + ':' + s.name; }).join('|');
    var caixa = b.nextElementSibling && b.nextElementSibling.classList.contains('ae-nsubs') ? b.nextElementSibling : null;

    /* Carregar na area mostra-a inteira. Corre antes do ouvinte geral do
       menu (que esta no #nav e so apanha o clique a subir). */
    if (!b.dataset.aeNav){
      b.dataset.aeNav = '1';
      b.addEventListener('click', function(ev){
        if (ev.target.closest('.ae-nseta')) return;
        aeNavFiltrar(a, null);
      });
    }

    if (caixa && caixa.dataset.chave === chave) return;
    if (caixa) caixa.remove();
    var seta = b.querySelector('.ae-nseta');
    if (!subs.length){ if (seta) seta.remove(); return; }

    if (!seta){
      seta = el('span', 'ae-nseta');
      seta.setAttribute('role', 'button');
      seta.innerHTML = aeIcone(AE_I.seta, 12);
      seta.addEventListener('click', function(ev){
        /* A seta so abre e fecha: nao muda de ecra. */
        ev.stopPropagation();
        var cx = b.nextElementSibling;
        if (!cx || !cx.classList.contains('ae-nsubs')) return;
        cx.hidden = !cx.hidden;
        seta.classList.toggle('fechado', cx.hidden);
        seta.title = cx.hidden ? 'Mostrar as sub-áreas' : 'Recolher as sub-áreas';
        AE_NAV_FECHADO[a.view] = cx.hidden;
        aeGuardar('aeNavFechado', AE_NAV_FECHADO);
      });
      b.appendChild(seta);
    }
    caixa = el('div', 'ae-nsubs');
    caixa.dataset.chave = chave;
    caixa.hidden = AE_NAV_FECHADO[a.view] === true;
    seta.classList.toggle('fechado', caixa.hidden);
    seta.title = caixa.hidden ? 'Mostrar as sub-áreas' : 'Recolher as sub-áreas';
    subs.forEach(function(s){
      var sb = el('button', 'ae-nsub');
      sb.type = 'button';
      sb.dataset.aeSub = String(s.id);
      sb.title = s.name;
      sb.appendChild(el('span', null, s.name));
      sb.addEventListener('click', function(){
        aeNavFiltrar(a, String(s.id));
        show(a.view);
      });
      caixa.appendChild(sb);
    });
    b.parentNode.insertBefore(caixa, b.nextSibling);
  });
  aeNavMarcar();
}

/* O realce: a sub-area quando o ecra esta filtrado so por ela; a area
   quando esta inteira (ou filtrada de outra maneira, no proprio ecra). */
function aeNavMarcar(){
  var nav = document.getElementById('nav');
  if (!nav) return;
  var ativa = nav.querySelector('button[data-view].is-active');
  var view = ativa ? ativa.dataset.view : null;
  AE_AREAS.forEach(function(a){
    var b = nav.querySelector('button[data-view="' + a.view + '"]');
    var cx = b && b.nextElementSibling && b.nextElementSibling.classList.contains('ae-nsubs') ? b.nextElementSibling : null;
    if (!b || !cx) return;
    var f = aeF(a.view);
    var so = f.subs.length === 1 ? f.subs[0] : null;
    var marcou = false;
    cx.querySelectorAll('button.ae-nsub').forEach(function(sb){
      var on = view === a.view && sb.dataset.aeSub === so;
      sb.classList.toggle('is-active', on);
      if (on) marcou = true;
    });
    /* Com a sub-area realcada, a area fica so com o texto forte, sem fundo:
       dois fundos seguidos nao dizem onde se esta. */
    b.classList.toggle('ae-com-sub', marcou);
  });
}

/* O show() do app.js poe o realce nos botoes do menu; as sub-areas vao atras. */
var _aeShow = show;
show = function(view){
  _aeShow(view);
  aeNavMarcar();
};

var AE_ESPERA = 0;
function aeRender(){
  /* Se o desenho apanhar a app a meio do arranque - sem areas ainda, ou sem o
     tarefas.js pronto - nao ha segunda chamada que o salve: o ecra ficava
     vazio ate se carregar em Actualizar. Volta-se a tentar sozinho. */
  if (!window.G || !G.contextos || !G.contextos.length || typeof tfCaixa !== 'function'){
    if (AE_ESPERA++ < 40) setTimeout(aeRender, 350);
    return;
  }
  AE_ESPERA = 0;
  aeMontar();
  aeArrumarNav();
  AE_AREAS.forEach(function(a){
    /* Um ecra que rebenta nao cala os outros. */
    try { aeRenderArea(a); } catch (e) { console.error('[farol] area ' + a.view, e); }
  });
  try { aeNavMontar(); } catch (e) { console.error('[farol] menu das areas', e); }
  /* As paginas gerais dos Eventos e das Despesas bebem dos mesmos dados: ou
     se desenham aqui, ou ficavam a espera de um clique. */
  try { if (typeof evRender === 'function') evRender(); } catch (e) { console.error('[farol] eventos', e); }
  try { if (typeof dpRender === 'function') dpRender(); } catch (e) { console.error('[farol] despesas', e); }
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

/* Este ficheiro e o ultimo da pagina e os pedidos nao esperam por ele: com o
   cache desligado, o /api/bootstrap e o /api/gestao chegam muitas vezes antes
   de estes embrulhos existirem, e a primeira - e unica - chamada passava ao
   lado. Desenha-se aqui tambem; se os dados ainda nao chegaram, o aeRender
   espera por eles. */
aeRender();
