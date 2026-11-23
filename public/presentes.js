'use strict';
/* Farol - os presentes (23 nov 2026). Substitui a app Gift List do Mac.
 *
 * Transversal > Presentes. No topo as ocasioes (o Natal de cada ano, os
 * aniversarios, outras); por baixo, para a ocasiao aberta:
 *   - o orcamento, o que ja se comprou, o que sobra e as ideias por decidir;
 *   - a faixa dos estados (ideia, comprado, enviado, chegou, embrulhado,
 *     entregue), que filtra a lista;
 *   - os grupos (Family, Amigos...) e a procura;
 *   - um cartao por pessoa com os presentes dela;
 *   - «Precisa de ti»: quem nao tem presente, comprados sem preco, encomendas
 *     atrasadas, o que chegou e falta embrulhar (cria a tarefa).
 * Separador «Orçamento»: por pessoa (com o orcamento de cada uma), por grupo
 * e ano a ano.
 * Na ficha de cada pessoa do Farol aparece o cartao «Presentes».
 *
 * Dados em /api/presentes (src/presentes.js). Nao mexe no app.js: cria a
 * seccao, o botao do menu e embrulha o show() e o fiDesenhar().
 */

var PR = { d: null, oc: null, grupo: 'Todos', estado: null, q: '', vista: 'lista', aLer: false };

var PR_EST = {
  ideia: ['Ideia', '#EEEAF6', '#4B3A7A'],
  comprado: ['Comprado', '#E3ECF8', '#1E4C8A'],
  feito: ['Feito por nós', '#E3ECF8', '#1E4C8A'],
  enviado: ['Enviado', '#FBEBD0', '#6E4300'],
  chegou: ['Chegou', '#DDF0EC', '#145C50'],
  embrulhado: ['Embrulhado', '#E2F1DF', '#2F5E26'],
  entregue: ['Entregue', '#14213D', '#FFFFFF']
};
/* A faixa junta «comprado» e «feito por nos»: os dois querem dizer que ja ha. */
var PR_FAIXA = [['ideia', ['ideia']], ['comprado', ['comprado', 'feito']], ['enviado', ['enviado']],
  ['chegou', ['chegou']], ['embrulhado', ['embrulhado']], ['entregue', ['entregue']]];
var PR_TIPOS_OC = { natal: 'Natal', aniversario: 'Aniversário', outra: 'Outra' };
var PR_CORES = ['#F3C27A', '#B9D7CF', '#C9D3EA', '#E9C6C0', '#D9CFEA', '#CFE3C4'];

var PR_CSS = [
  '#nav button[data-view="presentes"] .pr-dias{margin-left:auto;font-size:.68rem;font-weight:700;border-radius:999px;padding:1px 7px;background:var(--ambar,#F3C27A);color:var(--navy,#14213D)}',
  '#view-presentes .pr-topo{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 14px}',
  '#view-presentes .pr-oc{font:inherit;font-size:.85rem;font-weight:600;min-height:38px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer;white-space:nowrap}',
  '#view-presentes .pr-oc.on{background:var(--navy,#14213D);border-color:var(--navy,#14213D);color:#fff;font-weight:700}',
  '#view-presentes .pr-oc.arq{border-style:dashed;color:var(--muted)}',
  '#view-presentes .pr-link{font:inherit;font-size:.85rem;font-weight:700;background:none;border:0;color:var(--warn);cursor:pointer;padding:6px}',
  '#view-presentes .pr-esp{flex:1 1 auto}',
  '#view-presentes .pr-seg{display:flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}',
  '#view-presentes .pr-seg button{font:inherit;font-size:.82rem;font-weight:600;min-height:36px;padding:0 14px;border:0;background:var(--surface);color:var(--ink);cursor:pointer}',
  '#view-presentes .pr-seg button.on{background:var(--navy,#14213D);color:#fff}',
  '#view-presentes .pr-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 14px}',
  '#view-presentes .pr-kpi{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:6px;min-width:0;text-align:left;font:inherit;color:var(--ink)}',
  '#view-presentes button.pr-kpi{cursor:pointer}',
  '#view-presentes .pr-kpi span{font-size:.75rem;color:var(--muted);font-weight:600}',
  '#view-presentes .pr-kpi b{font-size:1.45rem;font-weight:800;line-height:1.1}',
  '#view-presentes .pr-kpi small{font-size:.72rem;color:var(--muted)}',
  '#view-presentes .pr-kpi.ok b{color:#2E7D6B}',
  '#view-presentes .pr-kpi.mau b{color:#9B1C1C}',
  '#view-presentes .pr-kpi.ideias{background:#FFF6E6;border-color:#F3C27A}',
  '#view-presentes .pr-kpi.ideias span,#view-presentes .pr-kpi.ideias small{color:#7A4A00}',
  '#view-presentes .pr-kpi.ideias b{color:#3D2503}',
  '#view-presentes .pr-bar{height:6px;border-radius:4px;background:var(--line-soft);overflow:hidden}',
  '#view-presentes .pr-bar i{display:block;height:100%;background:#2E7D6B}',
  '#view-presentes .pr-bar i.mau{background:#9B1C1C}',
  '#view-presentes .pr-faixa{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:0 0 14px}',
  '#view-presentes .pr-faixa button{font:inherit;display:flex;flex-direction:column;align-items:flex-start;gap:2px;border-radius:10px;padding:10px 12px;cursor:pointer;border:2px solid transparent;text-align:left}',
  '#view-presentes .pr-faixa b{font-size:1.3rem;font-weight:800;line-height:1.1}',
  '#view-presentes .pr-faixa span{font-size:.78rem;font-weight:700}',
  '#view-presentes .pr-filtros{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 12px}',
  '#view-presentes .pr-filtros button{font:inherit;font-size:.8rem;font-weight:700;min-height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}',
  '#view-presentes .pr-filtros button.on{background:var(--navy,#14213D);border-color:var(--navy,#14213D);color:#fff}',
  '#view-presentes .pr-filtros input{font:inherit;font-size:.85rem;min-height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--ink);width:220px;max-width:100%;box-sizing:border-box}',
  '#view-presentes .pr-corpo{display:flex;gap:16px;align-items:flex-start}',
  '#view-presentes .pr-cartoes{flex:1 1 auto;min-width:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}',
  '#view-presentes .pr-lado{flex:0 0 290px;display:flex;flex-direction:column;gap:12px}',
  '#view-presentes .pr-c{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:2px;min-width:0}',
  '#view-presentes .pr-c header{display:flex;align-items:center;gap:10px;margin-bottom:6px}',
  '#view-presentes .pr-av{flex:none;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.78rem;color:#14213D}',
  '#view-presentes .pr-nome{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}',
  '#view-presentes .pr-nome button{font:inherit;font-weight:800;font-size:.95rem;text-align:left;background:none;border:0;padding:0;color:var(--ink);cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '#view-presentes .pr-nome small{font-size:.74rem;color:var(--muted)}',
  '#view-presentes .pr-tot{font-weight:800;font-size:.92rem;white-space:nowrap;text-align:right}',
  '#view-presentes .pr-tot small{display:block;font-size:.7rem;font-weight:600;color:var(--muted)}',
  '#view-presentes .pr-tot small.mau{color:#9B1C1C}',
  '#view-presentes .pr-l{font:inherit;width:100%;display:flex;align-items:center;gap:8px;text-align:left;border:0;border-top:1px solid var(--line-soft);background:none;padding:8px 0;color:var(--ink);cursor:pointer;min-height:40px}',
  '#view-presentes .pr-l .t{flex:1 1 auto;min-width:0;font-size:.86rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '#view-presentes .pr-de{font-size:.68rem;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:1px 6px;white-space:nowrap}',
  '#view-presentes .pr-p{font-size:.82rem;font-weight:700;white-space:nowrap}',
  '#view-presentes .pr-p.sem{color:#8A3B12;background:#FBE4DA;border-radius:6px;padding:1px 6px}',
  '#view-presentes .pr-p.vz{color:var(--faint);font-weight:500}',
  '#view-presentes .pr-mais{font:inherit;font-size:.8rem;font-weight:700;background:none;border:0;color:var(--warn);cursor:pointer;padding:8px 0 2px;text-align:left}',
  '#view-presentes .pr-vazia{font:inherit;font-size:.82rem;font-weight:700;color:#7A4A00;background:#FFF6E6;border:0;border-radius:10px;padding:10px 12px;cursor:pointer;text-align:left}',
  '#view-presentes .pr-desejos{font-size:.74rem;color:var(--muted);padding-top:4px}',
  '#view-presentes .pr-ptd{background:var(--navy,#14213D);color:#E8ECF4;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px}',
  '#view-presentes .pr-ptd h3{margin:0;font-size:.95rem;color:#fff}',
  '#view-presentes .pr-ptd .it{display:flex;gap:10px;align-items:flex-start;font-size:.82rem;line-height:1.45}',
  '#view-presentes .pr-ptd .it b{flex:none;min-width:26px;height:26px;border-radius:8px;background:var(--ambar,#F3C27A);color:#14213D;display:flex;align-items:center;justify-content:center;font-size:.8rem}',
  '#view-presentes .pr-ptd button{font:inherit;font-size:.82rem;font-weight:800;border:0;border-radius:10px;padding:10px 12px;background:var(--ambar,#F3C27A);color:#14213D;cursor:pointer}',
  '#view-presentes .pr-ptd .ok{font-size:.82rem;color:#B8C2D6}',
  '#view-presentes .pr-box{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px;font-size:.82rem;line-height:1.45}',
  '#view-presentes .pr-box h3{margin:0;font-size:.92rem}',
  '#view-presentes .pr-box p{margin:0;color:var(--muted)}',
  '#view-presentes .pr-aniv{display:flex;align-items:center;gap:12px;justify-content:space-between;flex-wrap:wrap;background:var(--surface);border:1px solid #F3C27A;border-radius:12px;padding:10px 14px;margin:0 0 12px;font-size:.85rem}',
  '#view-presentes .pr-comecar{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:10px;max-width:640px}',
  '#view-presentes .pr-comecar p{margin:0;color:var(--muted);font-size:.875rem;line-height:1.5}',
  '#view-presentes .pr-orc{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:16px;align-items:start}',
  '#view-presentes .pr-orc section{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px;min-width:0}',
  '#view-presentes .pr-orc h3{margin:0 0 4px;font-size:.95rem}',
  '#view-presentes .pr-bl{display:grid;grid-template-columns:150px minmax(0,1fr) 88px 84px;gap:10px;align-items:center;font-size:.82rem}',
  '#view-presentes .pr-bl > span:first-child{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '#view-presentes .pr-bt{position:relative;height:14px;background:var(--line-soft);border-radius:4px;display:flex;overflow:hidden}',
  '#view-presentes .pr-bt i{display:block;height:100%}',
  '#view-presentes .pr-bt .c{background:#2E7D6B}#view-presentes .pr-bt .d{background:#C9BEE6}',
  '#view-presentes .pr-bt .m{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--ink)}',
  '#view-presentes .pr-bl b{text-align:right}',
  '#view-presentes .pr-bl input{font:inherit;font-size:.8rem;width:100%;box-sizing:border-box;min-height:30px;padding:2px 6px;border-radius:6px;border:1px solid var(--line);background:var(--ground);color:var(--ink);text-align:right}',
  '#view-presentes .pr-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:.74rem;color:var(--muted)}',
  '#view-presentes .pr-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}',
  '#view-presentes .pr-anos{display:flex;gap:18px;align-items:flex-end;height:150px;padding:6px 4px 0}',
  '#view-presentes .pr-anos > div{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:.78rem;min-width:0}',
  '#view-presentes .pr-anos i{display:block;width:100%;border-radius:6px 6px 0 0;background:#C9D3EA}',
  '#view-presentes .pr-anos .on i{background:#2E7D6B}',
  '#view-presentes .pr-anos small{color:var(--muted);text-align:center}',
  '.pr-chip{display:inline-block;font-size:.68rem;font-weight:800;border-radius:6px;padding:3px 7px;white-space:nowrap}',
  '.pr-dlg{border:none;border-radius:14px;padding:0;width:min(36rem,calc(100vw - 16px));max-height:calc(100dvh - 24px);box-shadow:0 18px 48px rgba(15,23,32,.25)}',
  '.pr-dlg::backdrop{background:rgba(15,23,32,.45)}',
  '.pr-dlg form{background:var(--surface);color:var(--ink);padding:18px;display:flex;flex-direction:column;gap:12px}',
  '.pr-dlg h3{margin:0;font-size:1.1rem}',
  '.pr-dlg p{margin:0;font-size:.78rem;color:var(--muted);line-height:1.45}',
  '.pr-dlg label{display:flex;flex-direction:column;gap:4px;font-size:.75rem;color:var(--muted);font-weight:600;min-width:0}',
  '.pr-dlg input,.pr-dlg select,.pr-dlg textarea{font:inherit;font-size:.9rem;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--ground);color:var(--ink);min-height:38px;box-sizing:border-box;width:100%}',
  '.pr-dlg .dois{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
  '.pr-dlg .tres{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}',
  '.pr-dlg .bloco{background:var(--surface-2);border:1px solid var(--line-soft);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:10px}',
  '.pr-dlg .bloco > b{font-size:.82rem}',
  '.pr-dlg .est{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px}',
  '.pr-dlg .est button{font:inherit;font-size:.7rem;font-weight:700;min-height:36px;padding:2px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer}',
  '.pr-dlg .est button.feito{background:#DCE5DA;border-color:#DCE5DA;color:#2F5E26}',
  '.pr-dlg .est button.on{background:var(--navy,#14213D);border-color:var(--navy,#14213D);color:var(--ambar,#F3C27A)}',
  '.pr-dlg .seg{display:flex;gap:6px}',
  '.pr-dlg .seg button{font:inherit;flex:1;font-size:.82rem;font-weight:700;min-height:38px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}',
  '.pr-dlg .seg button.on{background:var(--navy,#14213D);border-color:var(--navy,#14213D);color:#fff}',
  '.pr-dlg .mov{display:flex;align-items:center;gap:8px;font-size:.82rem;flex-wrap:wrap}',
  '.pr-dlg .mov .ligado{flex:1;min-width:0;background:var(--surface);border:1px solid #CFE3C4;border-radius:8px;padding:8px 10px}',
  '.pr-dlg .movs{display:flex;flex-direction:column;gap:4px;max-height:200px;overflow:auto}',
  '.pr-dlg .movs button{font:inherit;font-size:.8rem;text-align:left;display:flex;gap:8px;border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);padding:7px 9px;cursor:pointer}',
  '.pr-dlg .movs button span:nth-child(2){flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.pr-dlg .acoes{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:4px;position:sticky;bottom:-18px;background:var(--surface);padding:10px 0 2px}',
  '.pr-dlg .acoes .apagar{margin-right:auto;color:#9B1C1C}',
  '.pr-dlg .desejo{display:flex;gap:8px;align-items:center;font-size:.84rem;border-top:1px solid var(--line-soft);padding-top:6px}',
  '.pr-dlg .desejo span{flex:1;min-width:0}',
  '.pr-fi-l{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--line-soft);font-size:.85rem}',
  '.pr-fi-l:first-child{border-top:0}',
  '.pr-fi-l .t{flex:1;min-width:0}',
  '.pr-fi-l small{color:var(--muted)}',
  '.pr-fi-h{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:8px 0 2px}',
  '@media (max-width:1100px){#view-presentes .pr-cartoes{grid-template-columns:1fr}}',
  '@media (max-width:900px){',
  '  #view-presentes .pr-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}',
  '  #view-presentes .pr-faixa{grid-template-columns:repeat(3,minmax(0,1fr))}',
  '  #view-presentes .pr-corpo{flex-direction:column}',
  '  #view-presentes .pr-lado{flex:none;width:100%;order:-1}',
  '  #view-presentes .pr-orc{grid-template-columns:1fr}',
  '  #view-presentes .pr-bl{grid-template-columns:96px minmax(0,1fr) 76px 70px}',
  '  #view-presentes .pr-topo{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px}',
  '  #view-presentes .pr-topo > *{flex:none;white-space:nowrap}',
  '  #view-presentes .pr-topo .pr-esp{display:none}',
  '  .pr-dlg .est{grid-template-columns:repeat(4,minmax(0,1fr))}',
  '  .pr-dlg .tres{grid-template-columns:1fr 1fr}',
  '}'
].join('\n');

function prEstilo(){
  if (document.getElementById('prCss')) return;
  var st = document.createElement('style'); st.id = 'prCss'; st.textContent = PR_CSS;
  document.head.appendChild(st);
}

/* ------------------------------ uteis ------------------------------ */
function prEur(v){
  var t = (Math.round((Number(v) || 0) * 100) / 100).toFixed(2).split('.');
  return t[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + ',' + t[1] + ' €';
}
function prCurta(iso){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  var ms = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return m ? Number(m[3]) + ' ' + ms[Number(m[2]) - 1] : '';
}
function prIni(nome){
  var p = String(nome || '').replace(/\(.*?\)/g, '').split(/[\s&]+/).filter(function(w){ return w.length > 1 && w.charAt(0) === w.charAt(0).toUpperCase(); });
  return (p.slice(0, 2).map(function(w){ return w.charAt(0); }).join('') || String(nome || '?').charAt(0)).toUpperCase();
}
function prChip(est){
  var e = PR_EST[est] || PR_EST.ideia;
  var s = el('span', 'pr-chip', e[0]);
  s.style.background = e[1]; s.style.color = e[2];
  return s;
}
function prBtn(txt, cls, fn){
  var b = el('button', cls || 'btn', txt);
  b.type = 'button';
  if (fn) b.addEventListener('click', fn);
  return b;
}
function prJson(url, metodo, corpo){
  return apiGestao(url, { method: metodo || 'GET', headers: { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo) });
}
function prDest(id){ return ((PR.d && PR.d.destinatarios) || []).find(function(d){ return d.id === id; }) || null; }
function prDaOc(){
  var d = PR.d; if (!d || !d.ocasiao) return [];
  return d.presentes.filter(function(p){ return p.ocasiao_id === d.ocasiao.id; });
}

/* ------------------------------ carregar ------------------------------ */
function prCarregar(oc){
  if (PR.aLer) return;
  PR.aLer = true;
  var url = '/api/presentes' + (oc || PR.oc ? '?ocasiao=' + (oc || PR.oc) : '');
  apiGestao(url).then(function(d){ PR.aLer = false; prReceber(d); })
    .catch(function(e){ PR.aLer = false; var s = document.getElementById('view-presentes'); if (s){ clear(s); s.appendChild(el('p', 'muted', e.message || 'Não foi possível ler os presentes.')); } });
}
function prReceber(d){
  PR.d = d;
  PR.oc = d.ocasiao ? d.ocasiao.id : null;
  prBadge();
  var s = document.getElementById('view-presentes');
  if (s && s.classList.contains('is-active')) prRender();
}
/* Os dias que faltam, no botao do menu, quando a ocasiao esta a 45 dias. */
function prBadge(){
  var b = document.querySelector('#nav button[data-view="presentes"]');
  if (!b) return;
  var t = b.querySelector('.pr-dias');
  var dias = PR.d && PR.d.resumo ? PR.d.resumo.dias : null;
  if (dias == null || dias < 0 || dias > 45){ if (t) t.remove(); return; }
  if (!t){ t = el('span', 'pr-dias'); b.appendChild(t); }
  t.textContent = dias === 0 ? 'hoje' : dias + ' d';
}

/* ------------------------------ desenhar ------------------------------ */
function prRender(){
  var sec = document.getElementById('view-presentes');
  if (!sec) return;
  clear(sec);
  var d = PR.d;
  if (!d){ sec.appendChild(el('p', 'muted', 'A ler os presentes…')); prCarregar(); return; }
  if (window.TITLES && d.ocasiao){
    var dias = d.resumo.dias;
    TITLES.presentes = ['Presentes', d.ocasiao.nome + (dias != null && dias >= 0 ? ' · faltam ' + dias + (dias === 1 ? ' dia' : ' dias') : '')];
    var st = document.getElementById('pageSub'); if (st) st.textContent = TITLES.presentes[1];
  }
  if (!d.ocasioes.length){ prComecar(sec); return; }
  prTopo(sec);
  prAniversarios(sec);
  if (PR.vista === 'orcamento'){ prOrcamento(sec); return; }
  prKpis(sec);
  prFaixa(sec);
  prFiltros(sec);
  var corpo = el('div', 'pr-corpo');
  var cartoes = el('div', 'pr-cartoes');
  var lado = el('aside', 'pr-lado');
  corpo.appendChild(cartoes); corpo.appendChild(lado);
  sec.appendChild(corpo);
  prCartoes(cartoes);
  prLado(lado);
}

function prComecar(sec){
  var c = el('div', 'pr-comecar');
  c.appendChild(el('h3', null, 'Presentes'));
  c.appendChild(el('p', null, 'Uma lista por ocasião — o Natal de cada ano, os aniversários, o que for — com as pessoas, as ideias, o que já se comprou, o que falta chegar e embrulhar, e o orçamento.'));
  var ano = new Date().getFullYear();
  var b = prBtn('Começar o Natal ' + ano, 'btn primary', function(){
    prJson('/api/presentes/ocasioes', 'POST', { nome: 'Natal ' + ano, tipo: 'natal', data: ano + '-12-25' })
      .then(prReceber).then(prRender).catch(function(e){ toast(e.message); });
  });
  var row = el('div'); row.appendChild(b);
  row.appendChild(prBtn('Outra ocasião', 'btn', function(){ prDlgOcasiao(null); }));
  row.style.display = 'flex'; row.style.gap = '8px';
  c.appendChild(row);
  sec.appendChild(c);
}

function prTopo(sec){
  var d = PR.d;
  var t = el('div', 'pr-topo');
  var abertas = d.ocasioes.filter(function(o){ return !o.arquivada; });
  var arq = d.ocasioes.filter(function(o){ return o.arquivada; });
  abertas.forEach(function(o){
    var on = d.ocasiao && d.ocasiao.id === o.id;
    var dias = o.data ? Math.round((Date.parse(o.data) - Date.parse(d.hoje)) / 86400000) : null;
    var b = prBtn(o.nome + (on && dias != null && dias >= 0 ? ' · faltam ' + dias + ' d' : ''), 'pr-oc' + (on ? ' on' : ''), function(){
      if (on){ prDlgOcasiao(o); return; }
      PR.oc = o.id; PR.estado = null; prCarregar(o.id);
    });
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) b.title = 'Editar a ocasião';
    t.appendChild(b);
  });
  if (arq.length){
    var sel = el('select', 'pr-oc arq');
    sel.setAttribute('aria-label', 'Ocasiões arquivadas');
    var o0 = el('option', null, 'Arquivo (' + arq.length + ')'); o0.value = ''; sel.appendChild(o0);
    arq.forEach(function(o){ var op = el('option', null, o.nome); op.value = o.id; if (d.ocasiao && d.ocasiao.id === o.id) op.selected = true; sel.appendChild(op); });
    sel.addEventListener('change', function(){ if (sel.value){ PR.oc = Number(sel.value); prCarregar(PR.oc); } });
    t.appendChild(sel);
  }
  t.appendChild(prBtn('+ Ocasião', 'pr-link', function(){ prDlgOcasiao(null); }));
  t.appendChild(el('span', 'pr-esp'));
  var seg = el('div', 'pr-seg');
  [['lista', 'Lista'], ['orcamento', 'Orçamento']].forEach(function(x){
    var b = prBtn(x[1], PR.vista === x[0] ? 'on' : '', function(){ PR.vista = x[0]; prRender(); });
    b.setAttribute('aria-pressed', PR.vista === x[0] ? 'true' : 'false');
    seg.appendChild(b);
  });
  t.appendChild(seg);
  t.appendChild(prBtn('+ Presente', 'btn primary', function(){ prDlgPresente(null, {}); }));
  sec.appendChild(t);
}

function prAniversarios(sec){
  (PR.d.aniversarios || []).slice(0, 2).forEach(function(a){
    var b = el('div', 'pr-aniv');
    b.appendChild(el('span', null, 'Aniversário de ' + a.nome + ' a ' + prCurta(a.data) + '.'));
    b.appendChild(prBtn('Criar a ocasião', 'btn', function(){
      prJson('/api/presentes/ocasioes', 'POST', { nome: 'Aniversário ' + a.nome + ' ' + a.data.slice(0, 4), tipo: 'aniversario', data: a.data })
        .then(function(d){ PR.vista = 'lista'; prReceber(d); prRender(); }).catch(function(e){ toast(e.message); });
    }));
    sec.appendChild(b);
  });
}

function prKpis(sec){
  var d = PR.d, oc = d.ocasiao, r = d.resumo;
  var k = el('div', 'pr-kpis');
  var orc = oc.orcamento;
  var c1 = el('button', 'pr-kpi'); c1.type = 'button';
  c1.addEventListener('click', function(){ prDlgOcasiao(oc); });
  c1.appendChild(el('span', null, 'Orçamento'));
  c1.appendChild(el('b', null, orc ? prEur(orc) : 'Pôr orçamento'));
  if (orc){
    var bar = el('div', 'pr-bar'); var i = el('i');
    var pc = Math.min(100, Math.round(r.gasto / orc * 100));
    i.style.width = pc + '%'; if (r.gasto > orc) i.className = 'mau';
    bar.appendChild(i); c1.appendChild(bar);
    c1.appendChild(el('small', null, Math.round(r.gasto / orc * 100) + '% já comprado'));
  } else c1.appendChild(el('small', null, 'Toque para definir o limite'));
  k.appendChild(c1);
  var c2 = el('div', 'pr-kpi');
  c2.appendChild(el('span', null, 'Já comprado'));
  c2.appendChild(el('b', null, prEur(r.gasto)));
  var compr = r.total - (r.por_estado.ideia || 0);
  c2.appendChild(el('small', null, compr + ' presente' + (compr === 1 ? '' : 's') + (r.sem_preco ? ' · ' + r.sem_preco + ' sem preço' : '')));
  k.appendChild(c2);
  var c3 = el('div', 'pr-kpi ' + (orc && r.gasto > orc ? 'mau' : 'ok'));
  c3.appendChild(el('span', null, orc && r.gasto > orc ? 'Acima do orçamento' : 'Sobra'));
  c3.appendChild(el('b', null, orc ? prEur(Math.abs(orc - r.gasto)) : '—'));
  c3.appendChild(el('small', null, orc ? 'até ao limite do orçamento' : 'sem orçamento definido'));
  k.appendChild(c3);
  var c4 = el('div', 'pr-kpi ideias');
  c4.appendChild(el('span', null, 'Ideias por decidir · ' + (r.por_estado.ideia || 0)));
  c4.appendChild(el('b', null, prEur(r.ideias_valor)));
  var se = orc ? r.gasto + r.ideias_valor - orc : null;
  c4.appendChild(el('small', null, se == null ? 'o que custam as ideias com preço' :
    (se > 0 ? 'Se comprar todas, passa o orçamento em ' + prEur(se) : 'Cabem todas no orçamento')));
  k.appendChild(c4);
  sec.appendChild(k);
}

function prFaixa(sec){
  var r = PR.d.resumo;
  var f = el('div', 'pr-faixa');
  PR_FAIXA.forEach(function(x){
    var n = x[1].reduce(function(s, e){ return s + (r.por_estado[e] || 0); }, 0);
    var e = PR_EST[x[0]];
    var on = PR.estado === x[0];
    var b = el('button'); b.type = 'button';
    b.style.background = e[1]; b.style.color = e[2];
    if (on) b.style.borderColor = e[2];
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.appendChild(el('b', null, String(n)));
    b.appendChild(el('span', null, e[0]));
    b.addEventListener('click', function(){ PR.estado = on ? null : x[0]; prRender(); });
    f.appendChild(b);
  });
  sec.appendChild(f);
}

function prGrupos(){
  var g = [];
  PR.d.destinatarios.forEach(function(d){ var n = d.grupo || 'Sem grupo'; if (g.indexOf(n) < 0) g.push(n); });
  g.sort(function(a, b){ return a === 'Sem grupo' ? 1 : b === 'Sem grupo' ? -1 : a.localeCompare(b, 'pt'); });
  return g;
}
function prFiltros(sec){
  var f = el('div', 'pr-filtros');
  ['Todos'].concat(prGrupos()).forEach(function(g){
    var b = prBtn(g, PR.grupo === g ? 'on' : '', function(){ PR.grupo = g; prRender(); });
    b.setAttribute('aria-pressed', PR.grupo === g ? 'true' : 'false');
    f.appendChild(b);
  });
  f.appendChild(el('span', 'pr-esp'));
  var q = el('input'); q.type = 'search'; q.placeholder = 'Procurar pessoa ou presente'; q.value = PR.q;
  q.setAttribute('aria-label', 'Procurar pessoa ou presente');
  q.addEventListener('input', function(){
    PR.q = q.value;
    var c = document.querySelector('#view-presentes .pr-cartoes');
    if (c){ clear(c); prCartoes(c); }
  });
  f.appendChild(q);
  f.appendChild(prBtn('+ Pessoa', 'pr-link', function(){ prDlgDest(null); }));
  sec.appendChild(f);
}

function prCartoes(box){
  var d = PR.d;
  var lista = prDaOc();
  var faixa = PR.estado ? PR_FAIXA.find(function(x){ return x[0] === PR.estado; })[1] : null;
  var q = String(PR.q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  var norm = function(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var n = 0;
  d.destinatarios.forEach(function(dest, i){
    if (!dest.ativo) return;
    if (PR.grupo !== 'Todos' && (dest.grupo || 'Sem grupo') !== PR.grupo) return;
    var todos = lista.filter(function(p){ return p.destinatario_id === dest.id; });
    var deles = faixa ? todos.filter(function(p){ return faixa.indexOf(p.estado) >= 0; }) : todos;
    if (faixa && !deles.length) return;
    if (q && norm(dest.nome).indexOf(q) < 0){
      deles = deles.filter(function(p){ return norm(p.titulo).indexOf(q) >= 0; });
      if (!deles.length) return;
    }
    n += 1;
    var c = el('article', 'pr-c');
    var h = document.createElement('header');
    var av = el('span', 'pr-av', prIni(dest.nome)); av.setAttribute('aria-hidden', 'true');
    av.style.background = PR_CORES[i % PR_CORES.length];
    h.appendChild(av);
    var nm = el('div', 'pr-nome');
    nm.appendChild(prBtn(dest.nome, null, function(){ prDlgDest(dest); }));
    var ideias = todos.filter(function(p){ return p.estado === 'ideia'; }).length;
    var compr = todos.length - ideias;
    nm.appendChild(el('small', null, (dest.grupo || 'Sem grupo') + ' · ' + (todos.length ? compr + ' comprado' + (compr === 1 ? '' : 's') + (ideias ? ' · ' + ideias + ' ideia' + (ideias === 1 ? '' : 's') : '') : 'sem presente')));
    h.appendChild(nm);
    var tot = todos.reduce(function(s, p){ return s + (p.preco || 0); }, 0);
    var tt = el('div', 'pr-tot', tot ? prEur(tot) : '');
    var lim = d.orcamentos[dest.id];
    if (lim != null){
      var gastoP = todos.filter(function(p){ return p.estado !== 'ideia'; }).reduce(function(s, p){ return s + (p.preco || 0); }, 0);
      tt.appendChild(el('small', gastoP > lim ? 'mau' : null, 'limite ' + prEur(lim)));
    }
    h.appendChild(tt);
    c.appendChild(h);
    if (!todos.length){
      c.appendChild(prBtn('Ainda sem presente — + ideia para ' + dest.nome, 'pr-vazia', function(){ prDlgPresente(null, { destinatario_id: dest.id }); }));
    }
    deles.forEach(function(p){
      var l = el('button', 'pr-l'); l.type = 'button';
      l.appendChild(prChip(p.estado));
      l.appendChild(el('span', 't', p.titulo));
      if (p.de_quem) l.appendChild(el('span', 'pr-de', 'de ' + p.de_quem));
      var semPreco = !p.preco && p.estado !== 'ideia';
      l.appendChild(el('span', 'pr-p' + (semPreco ? ' sem' : (!p.preco ? ' vz' : '')), p.preco ? prEur(p.preco) : (semPreco ? 'sem preço' : '—')));
      l.addEventListener('click', function(){ prDlgPresente(p); });
      c.appendChild(l);
    });
    if (todos.length) c.appendChild(prBtn('+ ideia', 'pr-mais', function(){ prDlgPresente(null, { destinatario_id: dest.id }); }));
    var desejos = d.presentes.filter(function(p){ return p.ocasiao_id === null && p.destinatario_id === dest.id; }).length;
    if (desejos) c.appendChild(el('div', 'pr-desejos', desejos + ' na lista de desejos'));
    box.appendChild(c);
  });
  if (!n) box.appendChild(el('p', 'muted', d.destinatarios.length ? 'Nada com estes filtros.' : 'Ainda não há pessoas. «+ Pessoa» ou «+ Presente» para começar.'));
}

function prLado(lado){
  var d = PR.d, r = d.resumo;
  var lista = prDaOc();
  var ptd = el('div', 'pr-ptd');
  ptd.appendChild(el('h3', null, 'Precisa de ti'));
  var itens = 0;
  var item = function(n, txt, fn){
    if (!n) return;
    itens += 1;
    var it = el('div', 'it');
    it.appendChild(el('b', null, String(n)));
    var s = el('span', null, txt);
    it.appendChild(s);
    if (fn){ it.style.cursor = 'pointer'; it.addEventListener('click', fn); }
    ptd.appendChild(it);
  };
  var sp = r.sem_presente || [];
  item(sp.length, 'Sem presente: ' + sp.slice(0, 6).join(', ') + (sp.length > 6 ? '…' : ''));
  item(r.sem_preco, 'Comprados sem preço — o total está abaixo do real', function(){ PR.estado = null; PR.q = ''; prRender(); });
  item(r.atrasados, 'Encomendas que já deviam ter chegado', function(){ PR.estado = 'enviado'; prRender(); });
  var envi = (r.por_estado.enviado || 0) - (r.atrasados || 0);
  item(envi, 'Enviados, à espera que cheguem', function(){ PR.estado = 'enviado'; prRender(); });
  var porEmb = lista.filter(function(p){ return ['chegou', 'feito'].indexOf(p.estado) >= 0; });
  var semTarefa = porEmb.filter(function(p){ return !p.task_id; }).length;
  item(porEmb.length, 'Já chegaram e falta embrulhar', function(){ PR.estado = 'chegou'; prRender(); });
  item(r.por_estado.ideia || 0, 'Ideias por decidir', function(){ PR.estado = 'ideia'; prRender(); });
  if (semTarefa){
    ptd.appendChild(prBtn('Criar tarefa «Embrulhar ' + semTarefa + ' presente' + (semTarefa === 1 ? '' : 's') + '»', null, function(){
      prJson('/api/presentes/embrulhar', 'POST', { ocasiao_id: d.ocasiao.id })
        .then(function(x){ prReceber(x); prRender(); toast('Tarefa criada com ' + x.passos + ' passos.'); })
        .catch(function(e){ toast(e.message); });
    }));
  }
  if (!itens) ptd.appendChild(el('span', 'ok', 'Nada pendente nesta ocasião.'));
  lado.appendChild(ptd);

  var box = el('div', 'pr-box');
  box.appendChild(el('h3', null, 'Ligado ao resto do Farol'));
  box.appendChild(el('p', null, r.por_ligar ? r.por_ligar + ' compras com preço ainda sem o movimento do banco. Abra o presente e use «Ligar à compra».' : 'Todas as compras com preço estão ligadas ao movimento do banco.'));
  box.appendChild(el('p', null, 'A tarefa de embrulhar risca-se nas Tarefas: cada passo riscado passa o presente a «Embrulhado».'));
  lado.appendChild(box);

  var natais = d.ocasioes.filter(function(o){ return o.tipo === d.ocasiao.tipo && o.id !== d.ocasiao.id && o.gasto > 0; });
  if (natais.length){
    var a = el('div', 'pr-box');
    a.appendChild(el('h3', null, 'Anos anteriores'));
    natais.slice(0, 3).forEach(function(o){ a.appendChild(el('p', null, o.nome + ': ' + prEur(o.gasto))); });
    a.appendChild(prBtn('Comparar', 'pr-link', function(){ PR.vista = 'orcamento'; prRender(); }));
    lado.appendChild(a);
  }
}

/* ------------------------------ orcamento ------------------------------ */
function prOrcamento(sec){
  var d = PR.d, oc = d.ocasiao;
  var lista = prDaOc();
  var g = el('div', 'pr-orc');
  var s1 = el('section');
  s1.appendChild(el('h3', null, 'Por pessoa · ' + oc.nome));
  var leg = el('div', 'pr-leg');
  [['#2E7D6B', 'Comprado'], ['#C9BEE6', 'Ideia'], ['var(--ink)', 'Limite da pessoa']].forEach(function(x){
    var s = el('span'); var i = el('i'); i.style.background = x[0]; s.appendChild(i); s.appendChild(document.createTextNode(x[1])); leg.appendChild(s);
  });
  s1.appendChild(leg);
  var linhas = d.destinatarios.filter(function(x){ return x.ativo; }).map(function(dest){
    var deles = lista.filter(function(p){ return p.destinatario_id === dest.id; });
    var c = deles.filter(function(p){ return p.estado !== 'ideia'; }).reduce(function(s, p){ return s + (p.preco || 0); }, 0);
    var i = deles.filter(function(p){ return p.estado === 'ideia'; }).reduce(function(s, p){ return s + (p.preco || 0); }, 0);
    return { dest: dest, c: c, i: i, lim: d.orcamentos[dest.id] };
  }).sort(function(a, b){ return (b.c + b.i) - (a.c + a.i) || a.dest.nome.localeCompare(b.dest.nome, 'pt'); });
  var max = Math.max.apply(null, [1].concat(linhas.map(function(l){ return Math.max(l.c + l.i, l.lim || 0); })));
  var cab = el('div', 'pr-bl');
  cab.appendChild(el('span', 'muted', '')); cab.appendChild(el('span')); cab.appendChild(el('b', 'muted', 'Total')); cab.appendChild(el('b', 'muted', 'Limite'));
  cab.style.fontSize = '.7rem';
  s1.appendChild(cab);
  linhas.forEach(function(l){
    var r = el('div', 'pr-bl');
    r.appendChild(el('span', null, l.dest.nome));
    var bt = el('div', 'pr-bt');
    var ic = el('i', 'c'); ic.style.width = (l.c / max * 100) + '%'; bt.appendChild(ic);
    var ii = el('i', 'd'); ii.style.width = (l.i / max * 100) + '%'; bt.appendChild(ii);
    if (l.lim){ var m = el('i', 'm'); m.style.left = 'calc(' + Math.min(100, l.lim / max * 100) + '% - 1px)'; bt.appendChild(m); }
    r.appendChild(bt);
    r.appendChild(el('b', null, l.c + l.i ? prEur(l.c + l.i) : '—'));
    var inp = el('input'); inp.inputMode = 'decimal'; inp.placeholder = '—';
    inp.setAttribute('aria-label', 'Limite para ' + l.dest.nome);
    inp.value = l.lim != null ? String(l.lim).replace('.', ',') : '';
    inp.addEventListener('change', function(){
      prJson('/api/presentes/orcamentos', 'PUT', { ocasiao_id: oc.id, destinatario_id: l.dest.id, valor: inp.value })
        .then(function(x){ prReceber(x); prRender(); }).catch(function(e){ toast(e.message); });
    });
    r.appendChild(inp);
    s1.appendChild(r);
  });
  g.appendChild(s1);

  var dir = el('div'); dir.style.display = 'flex'; dir.style.flexDirection = 'column'; dir.style.gap = '16px';
  var s2 = el('section');
  s2.appendChild(el('h3', null, 'Por grupo (comprado)'));
  var porG = {};
  lista.forEach(function(p){
    if (p.estado === 'ideia') return;
    var dest = prDest(p.destinatario_id); var gr = (dest && dest.grupo) || 'Sem grupo';
    porG[gr] = (porG[gr] || 0) + (p.preco || 0);
  });
  var gs = Object.keys(porG).sort(function(a, b){ return porG[b] - porG[a]; });
  var gmax = Math.max.apply(null, [1].concat(gs.map(function(k){ return porG[k]; })));
  gs.forEach(function(k){
    var r = el('div', 'pr-bl'); r.style.gridTemplateColumns = '130px minmax(0,1fr) 88px';
    r.appendChild(el('span', null, k));
    var bt = el('div', 'pr-bt'); var i = el('i'); i.style.background = '#F3C27A'; i.style.width = (porG[k] / gmax * 100) + '%'; bt.appendChild(i);
    r.appendChild(bt); r.appendChild(el('b', null, prEur(porG[k])));
    s2.appendChild(r);
  });
  if (!gs.length) s2.appendChild(el('p', 'muted', 'Ainda nada comprado.'));
  dir.appendChild(s2);

  var s3 = el('section');
  s3.appendChild(el('h3', null, 'Ano a ano'));
  var mesmas = d.ocasioes.filter(function(o){ return o.tipo === oc.tipo; }).slice(0, 5).reverse();
  var amax = Math.max.apply(null, [1].concat(mesmas.map(function(o){ return o.gasto; })));
  var anos = el('div', 'pr-anos');
  mesmas.forEach(function(o){
    var col = el('div', o.id === oc.id ? 'on' : null);
    col.appendChild(el('b', null, prEur(o.gasto)));
    var i = el('i'); i.style.height = Math.max(4, Math.round(o.gasto / amax * 100)) + 'px'; col.appendChild(i);
    col.appendChild(el('small', null, o.nome));
    anos.appendChild(col);
  });
  s3.appendChild(anos);
  s3.appendChild(el('p', 'muted', 'Cada ocasião fica guardada: não é preciso arquivar nem limpar a lista no fim.'));
  dir.appendChild(s3);
  g.appendChild(dir);
  sec.appendChild(g);
}

/* ------------------------------ janelas ------------------------------ */
function prDialogo(titulo){
  var dlg = el('dialog', 'pr-dlg');
  var f = el('form'); f.method = 'dialog';
  f.appendChild(el('h3', null, titulo));
  dlg.appendChild(f);
  document.body.appendChild(dlg);
  dlg.addEventListener('close', function(){ dlg.remove(); });
  return { dlg: dlg, f: f };
}
function prCampo(pai, rotulo, tipo, valor, extra){
  var l = el('label', null, rotulo);
  var i = el(tipo === 'textarea' ? 'textarea' : 'input');
  if (tipo !== 'textarea') i.type = tipo || 'text';
  else i.rows = 2;
  if (valor != null) i.value = valor;
  if (extra) Object.keys(extra).forEach(function(k){ i[k] = extra[k]; });
  l.appendChild(i);
  pai.appendChild(l);
  return i;
}
function prSelect(pai, rotulo, opcoes, valor){
  var l = el('label', null, rotulo);
  var s = el('select');
  opcoes.forEach(function(o){ var op = el('option', null, o[1]); op.value = o[0]; if (String(o[0]) === String(valor)) op.selected = true; s.appendChild(op); });
  l.appendChild(s); pai.appendChild(l);
  return s;
}
function prAcoes(f, apagar, guardar, extra){
  var a = el('div', 'acoes');
  if (apagar) a.appendChild(prBtn('Apagar', 'btn apagar', apagar));
  (extra || []).forEach(function(b){ a.appendChild(b); });
  var cancel = prBtn('Cancelar', 'btn', function(){ f.parentNode.close(); });
  a.appendChild(cancel);
  var ok = el('button', 'btn primary', 'Guardar'); ok.type = 'submit';
  a.appendChild(ok);
  f.addEventListener('submit', function(e){ e.preventDefault(); guardar(ok); });
  f.appendChild(a);
}

function prDlgPresente(p, base){
  var d = PR.d;
  var novo = !p;
  p = p || Object.assign({ estado: 'ideia', tipo: 'presente', ocasiao_id: d.ocasiao ? d.ocasiao.id : null }, base || {});
  var j = prDialogo(novo ? 'Presente ou ideia' : 'Presente');
  var f = j.f;
  var tit = prCampo(f, 'Presente', 'text', p.titulo || '', { required: true, maxLength: 160 });

  var estado = p.estado;
  var eb = el('div', 'bloco');
  eb.appendChild(el('b', null, 'Estado'));
  var ebs = el('div', 'est');
  var ordem = ['ideia', 'comprado', 'feito', 'enviado', 'chegou', 'embrulhado', 'entregue'];
  var pintar = function(){
    Array.prototype.forEach.call(ebs.children, function(b){
      var k = b.dataset.e;
      var antes = ordem.indexOf(k) < ordem.indexOf(estado) && !(k === 'feito' && estado !== 'feito') && !(k === 'comprado' && estado === 'feito');
      b.className = k === estado ? 'on' : (antes ? 'feito' : '');
      b.setAttribute('aria-pressed', k === estado ? 'true' : 'false');
    });
  };
  ordem.forEach(function(k){
    var b = prBtn(PR_EST[k][0], null, function(){ estado = k; pintar(); });
    b.dataset.e = k; ebs.appendChild(b);
  });
  eb.appendChild(ebs);
  var datas = p.estados && typeof p.estados === 'object' ? Object.keys(p.estados).filter(function(k){ return PR_EST[k]; })
    .sort(function(a, b){ return ordem.indexOf(a) - ordem.indexOf(b); })
    .map(function(k){ return PR_EST[k][0].toLowerCase() + ' a ' + prCurta(p.estados[k]); }) : [];
  if (datas.length) eb.appendChild(el('p', null, datas.join(' · ')));
  f.appendChild(eb);
  pintar();

  var g1 = el('div', 'dois');
  var opDest = d.destinatarios.map(function(x){ return [x.id, x.nome]; });
  opDest.unshift(['', '— escolher —']); opDest.push(['__novo', '+ Pessoa nova…']);
  var sDest = prSelect(g1, 'Para', opDest, p.destinatario_id || '');
  var opOc = d.ocasioes.map(function(o){ return [o.id, o.nome]; }); opOc.push(['', 'Lista de desejos (sem ocasião)']);
  var sOc = prSelect(g1, 'Ocasião', opOc, p.ocasiao_id == null ? '' : p.ocasiao_id);
  f.appendChild(g1);
  var novoNome = prCampo(f, 'Nome da pessoa nova', 'text', '');
  novoNome.parentNode.hidden = true;
  sDest.addEventListener('change', function(){ novoNome.parentNode.hidden = sDest.value !== '__novo'; });

  var g2 = el('div', 'tres');
  var preco = prCampo(g2, 'Preço (€)', 'text', p.preco != null ? String(p.preco).replace('.', ',') : '', { inputMode: 'decimal' });
  var de = prCampo(g2, 'De (quem oferece)', 'text', p.de_quem || '', { placeholder: 'nós' });
  var tipo = p.tipo;
  var tl = el('label', null, 'Tipo');
  var seg = el('div', 'seg');
  [['presente', 'Presente'], ['lembranca', 'Lembrança']].forEach(function(x){
    var b = prBtn(x[1], tipo === x[0] ? 'on' : '', function(){ tipo = x[0]; Array.prototype.forEach.call(seg.children, function(c){ c.className = c === b ? 'on' : ''; }); });
    seg.appendChild(b);
  });
  tl.appendChild(seg); g2.appendChild(tl);
  f.appendChild(g2);
  var g3 = el('div', 'dois');
  var loja = prCampo(g3, 'Loja ou link', 'text', p.loja || '');
  var tam = prCampo(g3, 'Tamanho / variante', 'text', p.tamanho || '');
  f.appendChild(g3);

  var enc = el('div', 'bloco');
  enc.appendChild(el('b', null, 'Encomenda'));
  var g4 = el('div', 'tres');
  var transp = prCampo(g4, 'Transportadora', 'text', p.transportadora || '');
  var seg2 = prCampo(g4, 'Seguimento', 'text', p.seguimento || '');
  var chega = prCampo(g4, 'Chega até', 'date', p.chega_ate || '');
  enc.appendChild(g4);
  f.appendChild(enc);

  var mov = el('div', 'bloco');
  mov.appendChild(el('b', null, 'Compra no banco'));
  var movId = p.movimento_id || null;
  var movLinha = el('div', 'mov');
  var movLista = el('div', 'movs');
  var pintarMov = function(txt){
    clear(movLinha);
    if (movId){
      movLinha.appendChild(el('span', 'ligado', txt || (p.mov_data ? prCurta(p.mov_data) + ' · ' + (p.mov_descricao || '') + ' · ' + prEur(p.mov_valor) : 'Movimento ligado')));
      movLinha.appendChild(prBtn('Desligar', 'btn', function(){ movId = null; pintarMov(); }));
    } else if (!novo){
      movLinha.appendChild(prBtn('Ligar à compra', 'btn', function(){
        clear(movLista); movLista.appendChild(el('p', null, 'A procurar…'));
        apiGestao('/api/presentes/' + p.id + '/movimentos' + (loja.value ? '?q=' + encodeURIComponent(loja.value) : '')).then(function(x){
          clear(movLista);
          if (!x.movimentos.length){ movLista.appendChild(el('p', null, 'Não encontrei saídas com este valor nem desta loja nos últimos 120 dias.')); return; }
          x.movimentos.forEach(function(m){
            var b = el('button'); b.type = 'button';
            b.appendChild(el('span', null, prCurta(m.data)));
            b.appendChild(el('span', null, m.descricao + ' · ' + m.conta));
            b.appendChild(el('b', null, prEur(m.valor)));
            b.addEventListener('click', function(){ movId = m.id; clear(movLista); pintarMov(prCurta(m.data) + ' · ' + m.descricao + ' · ' + prEur(m.valor)); });
            movLista.appendChild(b);
          });
        }).catch(function(e){ clear(movLista); movLista.appendChild(el('p', null, e.message)); });
      }));
      movLinha.appendChild(el('span', 'muted', 'procura pelo preço e pela loja'));
    } else movLinha.appendChild(el('span', 'muted', 'Depois de guardar dá para ligar ao movimento do banco.'));
  };
  pintarMov();
  mov.appendChild(movLinha); mov.appendChild(movLista);
  f.appendChild(mov);

  var guard = prCampo(f, 'Guardado em', 'text', p.guardado || '', { placeholder: 'onde está escondido' });
  var notas = prCampo(f, 'Notas', 'textarea', p.notas || '');

  var extra = [];
  if (!novo){
    extra.push(prBtn('Copiar para…', 'btn', function(){
      var nome = window.prompt('Copiar «' + p.titulo + '» para quem? (nome exatamente como está na lista)');
      if (!nome) return;
      var alvo = d.destinatarios.find(function(x){ return x.nome.toLowerCase() === nome.trim().toLowerCase(); });
      if (!alvo){ toast('Não encontrei «' + nome + '» na lista.'); return; }
      prJson('/api/presentes/' + p.id + '/copiar', 'POST', { destinatario_id: alvo.id })
        .then(function(x){ prReceber(x); prRender(); toast('Copiado para ' + alvo.nome + ' (como ideia).'); }).catch(function(e){ toast(e.message); });
    }));
  }
  prAcoes(f, novo ? null : function(){
    if (!window.confirm('Apagar «' + p.titulo + '»?')) return;
    prJson('/api/presentes/' + p.id, 'DELETE').then(function(x){ j.dlg.close(); prReceber(x); prRender(); }).catch(function(e){ toast(e.message); });
  }, function(ok){
    var corpo = {
      titulo: tit.value, estado: estado, tipo: tipo, preco: preco.value, de_quem: de.value, loja: loja.value, tamanho: tam.value,
      transportadora: transp.value, seguimento: seg2.value, chega_ate: chega.value, guardado: guard.value, notas: notas.value,
      ocasiao_id: sOc.value ? Number(sOc.value) : null, ver: PR.oc
    };
    if (sDest.value === '__novo'){
      if (!novoNome.value.trim()){ toast('Falta o nome da pessoa.'); return; }
      corpo.destinatario_nome = novoNome.value.trim();
    } else if (sDest.value) corpo.destinatario_id = Number(sDest.value);
    else { toast('Falta para quem é.'); return; }
    if (!novo) corpo.movimento_id = movId;
    ok.disabled = true;
    (novo ? prJson('/api/presentes', 'POST', corpo) : prJson('/api/presentes/' + p.id, 'PATCH', corpo))
      .then(function(x){ j.dlg.close(); prCarregar(PR.oc); void x; })
      .catch(function(e){ ok.disabled = false; toast(e.message); });
  }, extra);
  j.dlg.showModal();
  if (novo) tit.focus();
}

function prDlgDest(dest){
  var d = PR.d;
  var novo = !dest;
  dest = dest || { ativo: true };
  var j = prDialogo(novo ? 'Pessoa a quem se oferece' : dest.nome);
  var f = j.f;
  var nome = prCampo(f, 'Nome', 'text', dest.nome || '', { required: true, maxLength: 120 });
  var g = el('div', 'dois');
  var op = d.pessoas.map(function(x){ return [x.id, x.name]; }); op.unshift(['', '— não é pessoa do Farol —']);
  var pes = prSelect(g, 'Pessoa do Farol', op, dest.person_id || '');
  var grupo = prCampo(g, 'Grupo', 'text', dest.grupo || '', { placeholder: 'Family, Amigos…' });
  var dl = el('datalist'); dl.id = 'prGruposDl';
  prGrupos().forEach(function(x){ if (x !== 'Sem grupo'){ var o = el('option'); o.value = x; dl.appendChild(o); } });
  f.appendChild(dl); grupo.setAttribute('list', 'prGruposDl');
  f.appendChild(g);
  var gostos = prCampo(f, 'Gostos', 'textarea', dest.gostos || '');
  var tam = prCampo(f, 'Tamanhos', 'text', dest.tamanhos || '', { placeholder: 'calçado 38 · roupa M' });
  if (!novo){
    var desejos = d.presentes.filter(function(p){ return p.ocasiao_id === null && p.destinatario_id === dest.id; });
    var b = el('div', 'bloco');
    b.appendChild(el('b', null, 'Lista de desejos'));
    if (!desejos.length) b.appendChild(el('p', null, 'Ideias sem ocasião ficam aqui (no presente, escolha «Lista de desejos»).'));
    desejos.forEach(function(p){
      var l = el('div', 'desejo');
      l.appendChild(el('span', null, p.titulo + (p.preco ? ' · ' + prEur(p.preco) : '')));
      if (d.ocasiao) l.appendChild(prBtn('Usar em ' + d.ocasiao.nome, 'btn', function(){
        prJson('/api/presentes/' + p.id, 'PATCH', { ocasiao_id: d.ocasiao.id, ver: d.ocasiao.id })
          .then(function(x){ j.dlg.close(); prReceber(x); prRender(); }).catch(function(e){ toast(e.message); });
      }));
      b.appendChild(l);
    });
    b.appendChild(prBtn('+ desejo', 'btn', function(){ j.dlg.close(); prDlgPresente(null, { destinatario_id: dest.id, ocasiao_id: null }); }));
    f.appendChild(b);
    var at = el('label'); at.style.flexDirection = 'row'; at.style.alignItems = 'center'; at.style.gap = '8px';
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = !dest.ativo; cb.style.width = 'auto'; cb.style.minHeight = '0';
    at.appendChild(cb); at.appendChild(document.createTextNode('Esconder da lista (já não se oferece)'));
    f.appendChild(at);
    if (dest.person_id && typeof fiAbrir === 'function'){
      f.appendChild(prBtn('Abrir a ficha de ' + (dest.pessoa || dest.nome), 'pr-link', function(){ j.dlg.close(); fiAbrir(dest.person_id); }));
    }
  }
  prAcoes(f, novo ? null : function(){
    var n = d.presentes.filter(function(p){ return p.destinatario_id === dest.id; }).length;
    if (!window.confirm('Apagar ' + dest.nome + (n ? ' e os ' + n + ' presentes desta pessoa (de todas as ocasiões)' : '') + '?')) return;
    prJson('/api/presentes/destinatarios/' + dest.id + '?ocasiao=' + (PR.oc || ''), 'DELETE')
      .then(function(x){ j.dlg.close(); prReceber(x); prRender(); }).catch(function(e){ toast(e.message); });
  }, function(ok){
    var corpo = { nome: nome.value, person_id: pes.value ? Number(pes.value) : null, grupo: grupo.value, gostos: gostos.value, tamanhos: tam.value, ocasiao_id: PR.oc };
    if (!novo) corpo.ativo = !cb.checked;
    ok.disabled = true;
    (novo ? prJson('/api/presentes/destinatarios', 'POST', corpo) : prJson('/api/presentes/destinatarios/' + dest.id, 'PATCH', corpo))
      .then(function(x){ j.dlg.close(); prReceber(x); prRender(); })
      .catch(function(e){ ok.disabled = false; toast(e.message); });
  });
  j.dlg.showModal();
}

function prDlgOcasiao(oc){
  var novo = !oc;
  oc = oc || { tipo: 'outra' };
  var j = prDialogo(novo ? 'Ocasião nova' : 'Ocasião');
  var f = j.f;
  var nome = prCampo(f, 'Nome', 'text', oc.nome || '', { required: true, maxLength: 120, placeholder: 'Natal 2027, Aniversário da Maria…' });
  var g = el('div', 'tres');
  var tipo = prSelect(g, 'Tipo', Object.keys(PR_TIPOS_OC).map(function(k){ return [k, PR_TIPOS_OC[k]]; }), oc.tipo);
  var data = prCampo(g, 'Data', 'date', oc.data || '');
  var orc = prCampo(g, 'Orçamento (€)', 'text', oc.orcamento != null ? String(oc.orcamento).replace('.', ',') : '', { inputMode: 'decimal' });
  f.appendChild(g);
  var arq = null;
  if (!novo){
    var at = el('label'); at.style.flexDirection = 'row'; at.style.alignItems = 'center'; at.style.gap = '8px';
    arq = el('input'); arq.type = 'checkbox'; arq.checked = !!oc.arquivada; arq.style.width = 'auto'; arq.style.minHeight = '0';
    at.appendChild(arq); at.appendChild(document.createTextNode('Já passou — guardar no arquivo'));
    f.appendChild(at);
    f.appendChild(el('p', null, 'No arquivo continua tudo lá: escolhe-se em «Arquivo» no topo.'));
  }
  prAcoes(f, novo ? null : function(){
    if (!window.confirm('Apagar «' + oc.nome + '» e os ' + (oc.n || 0) + ' presentes desta ocasião? Não dá para desfazer.')) return;
    prJson('/api/presentes/ocasioes/' + oc.id, 'DELETE').then(function(x){ j.dlg.close(); PR.oc = null; prReceber(x); prRender(); }).catch(function(e){ toast(e.message); });
  }, function(ok){
    var corpo = { nome: nome.value, tipo: tipo.value, data: data.value, orcamento: orc.value };
    if (arq) corpo.arquivada = arq.checked;
    ok.disabled = true;
    (novo ? prJson('/api/presentes/ocasioes', 'POST', corpo) : prJson('/api/presentes/ocasioes/' + oc.id, 'PATCH', corpo))
      .then(function(x){ j.dlg.close(); PR.vista = 'lista'; prReceber(x); prRender(); })
      .catch(function(e){ ok.disabled = false; toast(e.message); });
  });
  j.dlg.showModal();
}

/* ------------------------------ ficha da pessoa ------------------------------ */
function prFicha(){
  if (typeof FI === 'undefined' || !FI.dados || !FI.dados.pessoa) return;
  var pid = FI.dados.pessoa.id;
  var corpo = document.getElementById('fiCorpo');
  if (!corpo) return;
  var stacks = corpo.querySelectorAll('.grid.split > .stack');
  var dir = stacks[1];
  if (!dir || dir.querySelector('.pr-fi')) return;
  apiGestao('/api/presentes/pessoa/' + pid).then(function(x){
    if (!FI.dados || FI.dados.pessoa.id !== pid || !x.destinatarios.length) return;
    if (dir.querySelector('.pr-fi')) return;
    var total = x.presentes.length;
    var c = typeof fiCartao === 'function' ? fiCartao(dir, 'Presentes', total ? String(total) : '') : null;
    if (!c) return;
    c.parentNode.classList.add('pr-fi');
    var dest = x.destinatarios[0];
    if (dest.gostos) c.appendChild(el('p', 'fi-vazio', '♥ ' + dest.gostos));
    if (dest.tamanhos) c.appendChild(el('p', 'fi-vazio', 'Tamanhos: ' + dest.tamanhos));
    var grupos = {};
    var ordem = [];
    x.presentes.forEach(function(p){
      var k = p.ocasiao || 'Lista de desejos';
      if (!grupos[k]){ grupos[k] = []; ordem.push(k); }
      grupos[k].push(p);
    });
    ordem.forEach(function(k){
      var soma = grupos[k].filter(function(p){ return p.estado !== 'ideia'; }).reduce(function(s, p){ return s + (p.preco || 0); }, 0);
      c.appendChild(el('div', 'pr-fi-h', k + (soma ? ' · ' + prEur(soma) : '')));
      grupos[k].forEach(function(p){
        var l = el('div', 'pr-fi-l');
        l.appendChild(prChip(p.estado));
        var t = el('span', 't', p.titulo);
        if (p.de_quem){ t.appendChild(document.createTextNode(' ')); t.appendChild(el('small', null, 'de ' + p.de_quem)); }
        l.appendChild(t);
        l.appendChild(el('small', null, p.preco ? prEur(p.preco) : ''));
        c.appendChild(l);
      });
    });
    if (!total) c.appendChild(el('p', 'fi-vazio', 'Ainda sem presentes.'));
    c.appendChild(prBtn('Abrir em Presentes', 'btn', function(){ show('presentes'); }));
  }).catch(function(){});
}

/* ------------------------------ ligar ------------------------------ */
function prMontar(){
  if (document.getElementById('view-presentes')) return;
  prEstilo();
  if (window.TITLES) TITLES.presentes = ['Presentes', 'Natal, aniversários e outras ocasiões'];
  var nav = document.getElementById('nav');
  if (nav && !nav.querySelector('[data-view="presentes"]')){
    var b = el('button');
    b.dataset.view = 'presentes';
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-3.5-5-1.2C7 8 9.5 8 12 8zM12 8c1.5-3 5-3.5 5-1.2C17 8 14.5 8 12 8z"/></svg>';
    b.appendChild(document.createTextNode(' Presentes'));
    nav.appendChild(b);
  }
  var sec = el('section', 'view');
  sec.id = 'view-presentes';
  var docs = document.getElementById('view-documentos');
  if (docs) docs.parentNode.insertBefore(sec, docs); else document.querySelector('main').appendChild(sec);
}

function prLigar(){
  prMontar();
  if (typeof window.show === 'function' && !window.show.prEmbrulhado){
    var antes = window.show;
    var novo = function(v){
      var r = antes.apply(this, arguments);
      if (v === 'presentes'){ try { prRender(); prCarregar(PR.oc); } catch (e) { console.error('[farol] presentes', e); } }
      return r;
    };
    for (var k in antes) if (Object.prototype.hasOwnProperty.call(antes, k)) novo[k] = antes[k];
    novo.prEmbrulhado = true;
    window.show = novo;
  }
  if (typeof window.fiDesenhar === 'function' && !window.fiDesenhar.prEmbrulhado){
    var fd = window.fiDesenhar;
    var nf = function(){
      var r = fd.apply(this, arguments);
      try { prFicha(); } catch (e) { console.error('[farol] presentes ficha', e); }
      return r;
    };
    nf.prEmbrulhado = true;
    window.fiDesenhar = nf;
  }
  /* «?ver=presentes» abre logo aqui (como as notificacoes fazem). */
  try { if (/[?&]ver=presentes\b/.test(location.search)) show('presentes'); } catch (e) {}
  prCarregar();
}

(function prEsperar(n){
  if (document.getElementById('nav') && typeof el === 'function' && typeof show === 'function' && typeof apiGestao === 'function'){
    try { prLigar(); } catch (e) { console.error('[farol] presentes', e); }
    return;
  }
  if (n < 60) setTimeout(function(){ prEsperar(n + 1); }, 250);
})(0);
