'use strict';
/* Farol - Tarefas (segunda versao).
 *
 * Aprendido com o TickTick, onde a casa viveu ate setembro de 2026:
 *   - listas inteligentes a esquerda (Hoje, Amanha, 7 dias, Atrasadas...),
 *     por pessoa, por projeto e por etiqueta;
 *   - uma barra de captura rapida que percebe «amanha 15h !alta #casa @Ana»;
 *   - clicar numa tarefa abre o detalhe ao lado, e tudo se edita no sitio:
 *     passos, subtarefas, datas, repeticao, lembretes, comentarios.
 *
 * Usa os globais do app.js ($, el, clear, toast, pill, parseDay, MESES,
 * apiGestao, G, loadGestao, pessoa, projeto, areaNome, docPorId, D).
 */

var TF = {
  tipo: 'tarefa',         // tarefa | lembrete | nota
  vista: 'hoje',          // hoje | amanha | semana | atrasadas | todas | semdata | espera | concluidas | naofarei | p:<id> | proj:<id> | tag:<nome>
  aberta: null,           // id da tarefa no detalhe
  detalhe: null,          // a tarefa completa (com comentarios e historico)
  historico: [], histFim: false, histVista: null,
  fechados: {},           // grupos recolhidos
  montado: false
};

var TF_PRIO = [['alta', 'Alta'], ['media', 'Média'], ['normal', 'Nenhuma'], ['baixa', 'Baixa']];
var TF_PRIO_ORD = { alta: 0, media: 1, normal: 2, baixa: 3 };
/* Os cinco estados de uma tarefa. Os tres primeiros sao o caminho normal; os
   dois ultimos fecham-na. A cruz na caixinha e o atalho para «Concluída». */
/* Tres coisas diferentes viviam na mesma lista: o que pede accao, o que so
   precisa de aparecer no dia e o que e memoria. Cada uma tem o seu separador. */
var TF_TIPOS = [
  ['tarefa', 'Tarefas', 'Pede uma acção tua'],
  ['pagamento', 'Pagamentos', 'Dinheiro a sair — com comprovativo no fim'],
  ['lembrete', 'Lembretes', 'Só precisa de aparecer no dia'],
  ['nota', 'Notas', 'Memória — sem ciclo de vida']
];
var TF_METODOS = ['transferência', 'débito direto', 'multibanco', 'mb way', 'cartão', 'numerário', 'cheque', 'outro'];
function tfEuros(v){
  if (v === null || v === undefined || v === '') return '';
  return Number(v).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}
function tfPapel(t, papel){
  return (t.papeis || []).filter(function(x){ return x.papel === papel; }).map(function(x){ return x.id; });
}
function tfSemProva(t){
  return t.tipo === 'pagamento' && t.paid_on && !tfPapel(t, 'comprovativo').length && !tfPapel(t, 'recibo').length;
}
function tfTipo(t){ return (t && t.tipo) || 'tarefa'; }

var TF_ESTADOS = [['aberta', 'Por iniciar', ''], ['em_curso', 'Em execução', 'accent'], ['a_espera', 'À espera', 'warn']];
var TF_ESTADOS_FIM = [['concluida', 'Concluída', 'good'], ['cancelada', 'Não farei', '']];
function tfEstado(v){
  var todos = TF_ESTADOS.concat(TF_ESTADOS_FIM);
  for (var i = 0; i < todos.length; i++) if (todos[i][0] === v) return todos[i];
  return TF_ESTADOS[0];
}
var TF_DIAS_SEM = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
var TF_RRULE_DIAS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

var TF_CSS = [
  "#view-tarefas .tf{display:grid;grid-template-columns:210px minmax(0,1fr) 400px;gap:14px;align-items:start}",
  "#view-tarefas .tf.sem-detalhe{grid-template-columns:210px minmax(0,1fr)}",
  ".tf-side{position:sticky;top:140px;display:flex;flex-direction:column;gap:2px;max-height:calc(100vh - 150px);overflow:auto;padding-right:2px}",
  ".tf-side .tf-lbl{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--faint);padding:12px 8px 4px}",
  ".tf-side button{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:6px 8px;border-radius:7px;font-size:.8125rem;color:var(--ink-2);border:0;background:none;cursor:pointer}",
  ".tf-side button:hover{background:var(--surface-2)}",
  ".tf-side button.on{background:var(--accent-soft);color:var(--accent-ink);font-weight:500}",
  ".tf-side button .n{margin-left:auto;font-family:var(--mono);font-size:.6875rem;color:var(--faint)}",
  ".tf-side button.on .n{color:var(--accent-ink)}",
  ".tf-side button .n.bad{color:var(--bad)}",
  ".tf-side button i{width:8px;height:8px;border-radius:50%;flex:none}",
  ".tf-side svg{flex:none;opacity:.75}",
  ".tf-main{min-width:0}",
  ".tf-main > header{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}",
  ".tf-main > header h3{font-size:1.1rem}",
  ".tf-main > header .mono{margin-left:auto}",
  ".tf-tipos{display:flex;gap:2px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:3px;width:fit-content;margin-bottom:12px}",
  ".tf-tipos button{padding:5px 12px;border-radius:6px;font-size:.8125rem;color:var(--muted);border:0;background:none;cursor:pointer;display:flex;gap:6px;align-items:center}",
  ".tf-tipos button.on{background:var(--surface);color:var(--ink);box-shadow:var(--shadow);font-weight:500}",
  ".tf-tipos button .n{font-family:var(--mono);font-size:.625rem;color:var(--faint)}",
  ".tf-add{position:relative;margin-bottom:12px}",
  ".tf-add input{width:100%;font:inherit;font-size:.875rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:9px;padding:10px 12px 10px 34px}",
  ".tf-add input:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);background:var(--surface)}",
  ".tf-add > svg{position:absolute;left:11px;top:12px;color:var(--faint)}",
  ".tf-prev{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px;min-height:0}",
  ".tf-prev:empty{display:none}",
  ".tf-grp{margin-bottom:10px}",
  ".tf-grp > h4{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted);padding:6px 2px;cursor:pointer;user-select:none;font-weight:500}",
  ".tf-grp > h4 span{color:var(--faint)}",
  ".tf-grp > h4 svg{transition:transform .15s}",
  ".tf-grp.fechado > h4 svg{transform:rotate(-90deg)}",
  ".tf-grp.fechado > .tf-rows{display:none}",
  ".tf-grp.late > h4{color:var(--bad)}",
  ".tf-row{display:flex;align-items:flex-start;gap:9px;padding:8px 8px;border-radius:8px;border-top:1px solid var(--line-soft);cursor:pointer}",
  ".tf-rows .tf-row:first-child{border-top-color:transparent}",
  ".tf-row:hover{background:var(--surface-2)}",
  ".tf-row.sel{background:var(--accent-soft)}",
  ".tf-row.sub{margin-left:26px}",
  ".tf-row.done .tf-t{color:var(--faint);text-decoration:line-through}",
  ".tf-box{flex:none;width:17px;height:17px;margin-top:1px;border-radius:5px;border:1.6px solid var(--line-strong,#B9C6C7);background:var(--surface);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}",
  ".tf-box svg{opacity:0;stroke:#fff}",
  ".tf-box.alta{border-color:var(--bad)} .tf-box.media{border-color:var(--warn)} .tf-box.baixa{border-color:var(--accent)}",
  ".tf-box:hover svg{opacity:.35;stroke:var(--ink)}",
  ".tf-box.on{background:var(--accent);border-color:var(--accent)} .tf-box.on svg{opacity:1;stroke:#fff}",
  ".tf-box.x{background:var(--line);border-color:var(--line)}",
  ".tf-body{flex:1;min-width:0}",
  ".tf-t{display:block;font-size:.875rem;color:var(--ink);line-height:1.35;overflow-wrap:anywhere}",
  ".tf-m{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-top:3px;font-size:.72rem;color:var(--muted)}",
  ".tf-m .dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:4px;vertical-align:0}",
  ".tf-m svg{vertical-align:-2px;margin-right:2px}",
  ".tf-est{font-family:var(--mono);font-size:.625rem;letter-spacing:.04em;text-transform:uppercase;padding:1px 7px;border-radius:99px;border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer}",
  ".tf-est:hover{border-color:var(--accent);color:var(--accent-ink)}",
  ".tf-est.accent{background:var(--accent-soft);border-color:transparent;color:var(--accent-ink)}",
  ".tf-est.warn{background:var(--warn-soft);border-color:transparent;color:var(--warn)}",
  ".tf-est.good{background:var(--good-soft);border-color:transparent;color:var(--good)}",
  ".tf-tag{font-family:var(--mono);font-size:.625rem;padding:1px 6px;border-radius:99px;background:var(--surface-2);border:1px solid var(--line-soft);color:var(--muted)}",
  ".tf-val{flex:none;font-family:var(--mono);font-size:.8125rem;color:var(--ink);padding-top:1px;white-space:nowrap;font-variant-numeric:tabular-nums}",
  ".tf-row.done .tf-val{color:var(--faint)}",
  ".tf-r{flex:none;text-align:right;font-family:var(--mono);font-size:.6875rem;color:var(--muted);padding-top:2px;white-space:nowrap}",
  ".tf-r.bad{color:var(--bad)} .tf-r.warn{color:var(--warn)} .tf-r.acc{color:var(--accent-ink)}",
  ".tf-mais{margin:8px auto 0;display:block}",
  ".tf-det{position:sticky;top:140px;max-height:calc(100vh - 150px);overflow:auto}",
  ".tf-det .tf-top{display:flex;align-items:center;gap:8px;padding-bottom:10px;border-bottom:1px solid var(--line-soft);margin-bottom:10px}",
  ".tf-det .tf-top .tf-sp{flex:1}",
  ".tf-chipbtn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);border-radius:7px;padding:4px 9px;font:inherit;font-size:.75rem;color:var(--ink-2);cursor:pointer}",
  ".tf-chipbtn:hover{border-color:var(--accent)}",
  ".tf-chipbtn.bad{color:var(--bad)} .tf-chipbtn.warn{color:var(--warn)}",
  ".tf-ico{border:0;background:none;padding:4px;border-radius:6px;color:var(--muted);cursor:pointer;display:inline-flex}",
  ".tf-ico:hover{background:var(--surface-2);color:var(--ink)}",
  ".tf-titulo{width:100%;font:inherit;font-family:var(--serif);font-size:1.25rem;line-height:1.3;color:var(--ink);border:0;background:none;resize:none;padding:2px 0;overflow:hidden}",
  ".tf-titulo:focus,.tf-notas:focus{outline:0}",
  ".tf-notas{width:100%;font:inherit;font-size:.8125rem;line-height:1.55;color:var(--ink-2);border:0;background:none;resize:none;padding:4px 0;min-height:2.4em;white-space:pre-wrap}",
  ".tf-sec{margin-top:14px}",
  ".tf-sec > .tf-lbl{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin-bottom:6px;display:flex;gap:6px;align-items:center}",
  ".tf-it{display:flex;align-items:center;gap:8px;padding:3px 0}",
  ".tf-it input[type=text]{flex:1;min-width:0;font:inherit;font-size:.8125rem;border:0;background:none;color:var(--ink);padding:3px 0}",
  ".tf-it input[type=text]:focus{outline:0;border-bottom:1px solid var(--accent)}",
  ".tf-it.done input[type=text]{color:var(--faint);text-decoration:line-through}",
  ".tf-it .tf-ico{opacity:0} .tf-it:hover .tf-ico{opacity:1}",
  ".tf-novo{width:100%;font:inherit;font-size:.8125rem;border:0;border-bottom:1px dashed var(--line);background:none;color:var(--ink);padding:5px 0 5px 25px}",
  ".tf-novo:focus{outline:0;border-bottom-color:var(--accent)}",
  ".tf-grid{display:grid;grid-template-columns:110px minmax(0,1fr);gap:6px 10px;align-items:center;font-size:.8125rem}",
  ".tf-grid > span{color:var(--muted);font-size:.75rem}",
  ".tf-grid select,.tf-grid input[type=text],.tf-pop select,.tf-pop input{font:inherit;font-size:.8125rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:7px;padding:5px 8px;width:100%;min-width:0}",
  ".tf-chips{display:flex;flex-wrap:wrap;gap:5px}",
  ".tf-chips .chip{cursor:pointer;font-size:.72rem}",
  ".tf-chips .chip[aria-pressed=false]{opacity:.4}",
  ".tf-com{padding:7px 0;border-top:1px solid var(--line-soft);font-size:.8125rem;white-space:pre-wrap;color:var(--ink-2)}",
  ".tf-com small{display:block;font-family:var(--mono);font-size:.625rem;color:var(--faint);margin-bottom:2px}",
  ".tf-hist{font-family:var(--mono);font-size:.6875rem;color:var(--muted);display:flex;flex-wrap:wrap;gap:4px}",
  ".tf-vazio{padding:3rem 1rem;text-align:center;color:var(--muted);font-size:.875rem}",
  ".tf-pop{position:fixed;z-index:60;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 18px 50px -18px rgba(15,40,40,.5);padding:12px;width:300px;max-width:calc(100vw - 24px)}",
  ".tf-pop .tf-rapidos{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:10px}",
  ".tf-pop .tf-rapidos button{border:1px solid var(--line);background:var(--surface-2);border-radius:7px;padding:6px 2px;font:inherit;font-size:.7rem;color:var(--ink-2);cursor:pointer}",
  ".tf-pop .tf-rapidos button:hover{border-color:var(--accent);color:var(--accent-ink)}",
  ".tf-pop label{display:block;font-size:.72rem;color:var(--muted);margin:8px 0 3px}",
  ".tf-pop .tf-linha{display:flex;gap:6px;align-items:center}",
  ".tf-pop .tf-dias{display:flex;gap:3px;flex-wrap:wrap}",
  ".tf-pop .tf-dias button{width:30px;height:26px;border:1px solid var(--line);border-radius:6px;background:var(--surface);font:inherit;font-size:.68rem;cursor:pointer;color:var(--ink-2)}",
  ".tf-pop .tf-dias button.on{background:var(--accent);border-color:var(--accent);color:#fff}",
  ".tf-pop .tf-acoes{display:flex;justify-content:flex-end;gap:6px;margin-top:12px}",
  ".tf-menu{position:fixed;z-index:60;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 18px 50px -18px rgba(15,40,40,.5);padding:4px;min-width:170px}",
  ".tf-menu button{display:flex;gap:8px;align-items:center;width:100%;text-align:left;border:0;background:none;padding:7px 10px;border-radius:6px;font:inherit;font-size:.8125rem;color:var(--ink-2);cursor:pointer}",
  ".tf-menu button:hover{background:var(--surface-2)}",
  ".tf-menu button.danger{color:var(--bad)}",
  ".tf-fechar{display:none}",
  "@media (max-width:1180px){#view-tarefas .tf,#view-tarefas .tf.sem-detalhe{grid-template-columns:190px minmax(0,1fr)}",
  "  .tf-det{position:fixed;top:0;right:0;bottom:0;width:min(440px,100vw);max-height:none;z-index:50;border-radius:0;box-shadow:-20px 0 60px -30px rgba(0,0,0,.5)}",
  "  .tf-fechar{display:inline-flex}}",
  "@media (max-width:760px){#view-tarefas .tf,#view-tarefas .tf.sem-detalhe{grid-template-columns:minmax(0,1fr)}",
  "  .tf-side{position:static;flex-direction:row;overflow-x:auto;max-height:none;gap:4px;padding-bottom:4px}",
  "  .tf-side .tf-lbl{display:none} .tf-side button{width:auto;white-space:nowrap;border:1px solid var(--line)}}"
].join('\n');

/* ------------------------------------------------------------------ *
 * utilitarios
 * ------------------------------------------------------------------ */

function tfHoje(){ var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function tfISO(dt){ return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0'); }
function tfMais(dt, n){ return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n); }
function tfNorm(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function tfFechada(t){ return t.status === 'concluida' || t.status === 'cancelada'; }
function tfSvg(d, w){
  return '<svg width="' + (w || 14) + '" height="' + (w || 14) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
}
var TF_I = {
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  amanha: '<path d="M4 17h16"/><path d="M7 17a5 5 0 0 1 10 0"/><path d="M12 5v4M5.6 8.6l2 2M18.4 8.6l-2 2"/>',
  semana: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  atraso: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  todas: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h1M4 12h1M4 18h1"/>',
  semdata: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17"/><path d="M9 14l6 4M15 14l-6 4"/>',
  curso: '<circle cx="12" cy="12" r="9"/><path d="M12 12l0-5"/><path d="M12 12l3.5 3.5"/>',
  espera: '<path d="M7 3h10M7 21h10"/><path d="M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9"/>',
  feito: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  nao: '<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>',
  rep: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
  sino: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21h4"/>',
  lista: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  com: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  bandeira: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
  pontos: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  seta: '<path d="M6 9l6 6 6-6"/>',
  proj: '<path d="M4 6h16M4 12h10M4 18h6"/>',
  euro: '<path d="M18 6a7 7 0 1 0 0 12"/><path d="M4 10h9M4 14h9"/>',
  papel: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  check: '<path d="M5 13l4 4L19 7"/>'
};
function tfIcone(nome, w){ var s = el('span'); s.innerHTML = tfSvg(TF_I[nome], w); s.style.display = 'inline-flex'; return s; }

function tfDataTxt(isoD, hora){
  if (!isoD) return '';
  var d = parseDay(isoD), h = tfHoje();
  var dif = Math.round((d - h) / 86400000);
  var txt;
  if (dif === 0) txt = 'Hoje';
  else if (dif === 1) txt = 'Amanhã';
  else if (dif === -1) txt = 'Ontem';
  else if (dif > 1 && dif < 7) txt = TF_DIAS_SEM[d.getDay()].replace(/^./, function(c){ return c.toUpperCase(); });
  else txt = d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3) + (d.getFullYear() !== h.getFullYear() ? ' ' + d.getFullYear() : '');
  return txt + (hora ? ', ' + hora : '');
}
function tfNivelData(t){
  if (!t.due_on || tfFechada(t)) return '';
  var d = parseDay(t.due_on), h = tfHoje();
  if (d < h) return 'bad';
  if (d.getTime() === h.getTime()) return 'acc';
  return '';
}

function tfLembreteTxt(min, dia){
  if (min === 0) return dia ? 'no próprio dia, 00:00' : 'na hora';
  if (dia){
    // relativo a meia-noite do dia do prazo
    var dias = Math.floor(-min / 1440 + 1), resto = ((min % 1440) + 1440) % 1440;
    if (min > 0 && min < 1440) return 'no dia às ' + String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
    var hh = String(Math.floor(resto / 60)).padStart(2, '0') + ':' + String(resto % 60).padStart(2, '0');
    if (min < 0) return (dias === 1 ? 'na véspera' : dias + ' dias antes') + ' às ' + hh;
  }
  var a = Math.abs(min);
  var u = a % 1440 === 0 ? [a / 1440, 'dia'] : (a % 60 === 0 ? [a / 60, 'hora'] : [a, 'minuto']);
  return u[0] + ' ' + u[1] + (u[0] > 1 ? 's' : '') + (min < 0 ? ' antes' : ' depois');
}

/* ------------------------------------------------------------------ *
 * captura rapida
 * ------------------------------------------------------------------ */

function tfProximoDiaSemana(n){
  var h = tfHoje(), d = (n - h.getDay() + 7) % 7 || 7;
  return tfMais(h, d);
}

function tfPerceber(texto){
  var r = { title: texto, tipo: null, amount: null, due_on: null, due_time: null, priority: null, owner_id: null, subjects: [],
            context_id: null, project_id: null, tags: [], repeat_rule: null, sinais: [] };
  var s = ' ' + texto + ' ';
  function tira(re, fn){
    s = s.replace(re, function(){ var v = fn.apply(null, arguments); return v === false ? arguments[0] : ' '; });
  }
  var h = tfHoje();

  tira(/\s!(lembrete|nota|tarefa|pagamento)(?=\s)/i, function(_, p){
    r.tipo = tfNorm(p);
    r.sinais.push([r.tipo === 'nota' ? 'lista' : (r.tipo === 'lembrete' ? 'sino' : (r.tipo === 'pagamento' ? 'euro' : 'todas')), r.tipo]);
  });
  /* «1250€», «€1.250,00» ou «1250 eur»: o valor tira-se do texto e a linha
     passa a pagamento sem ser preciso dize-lo. */
  tira(/\s(?:€\s?([\d.]+(?:,\d{1,2})?)|([\d.]+(?:,\d{1,2})?)\s?(?:€|eur(?:os)?))(?=\s)/i, function(_, a, b){
    r.amount = (a || b);
    if (!r.tipo) r.tipo = 'pagamento';
    r.sinais.push(['euro', r.amount.replace('.', '') + ' €']);
  });
  tira(/\s!(alta|m[eé]dia|baixa|[123])(?=\s)/i, function(_, p){
    p = tfNorm(p); r.priority = { alta: 'alta', media: 'media', baixa: 'baixa', '1': 'alta', '2': 'media', '3': 'baixa' }[p];
    r.sinais.push(['bandeira', 'prioridade ' + p]);
  });
  tira(/\stodos os dias(?=\s)/i, function(){ r.repeat_rule = 'FREQ=DAILY'; r.sinais.push(['rep', 'todos os dias']); });
  tira(/\sdias [uú]teis(?=\s)/i, function(){ r.repeat_rule = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR'; r.sinais.push(['rep', 'dias úteis']); });
  tira(/\stodas as semanas(?=\s)/i, function(){ r.repeat_rule = 'FREQ=WEEKLY'; r.sinais.push(['rep', 'todas as semanas']); });
  tira(/\stodos os anos(?=\s)/i, function(){ r.repeat_rule = 'FREQ=YEARLY'; r.sinais.push(['rep', 'todos os anos']); });
  tira(/\stodo o dia (\d{1,2})(?=\s)/i, function(_, d){
    r.repeat_rule = 'FREQ=MONTHLY;BYMONTHDAY=' + (+d); r.sinais.push(['rep', 'todos os meses, dia ' + d]);
    var alvo = new Date(h.getFullYear(), h.getMonth(), +d); if (alvo < h) alvo = new Date(h.getFullYear(), h.getMonth() + 1, +d);
    r.due_on = tfISO(alvo);
  });
  tira(/\stodos os meses(?=\s)/i, function(){ r.repeat_rule = 'FREQ=MONTHLY'; r.sinais.push(['rep', 'todos os meses']); });

  tira(/\s(hoje)(?=\s)/i, function(){ r.due_on = tfISO(h); });
  tira(/\sdepois de amanh[aã](?=\s)/i, function(){ r.due_on = tfISO(tfMais(h, 2)); });
  tira(/\samanh[aã](?=\s)/i, function(){ r.due_on = tfISO(tfMais(h, 1)); });
  tira(/\spr[oó]xima semana(?=\s)/i, function(){ r.due_on = tfISO(tfProximoDiaSemana(1)); });
  tira(/\s(?:na |no |pr[oó]xim[ao] )?(segunda|ter[cç]a|quarta|quinta|sexta|s[aá]bado|domingo)(?:-feira)?(?=\s)/i, function(_, d){
    var n = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'].indexOf(tfNorm(d));
    r.due_on = tfISO(tfProximoDiaSemana(n));
  });
  tira(/\s(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=\s)/, function(_, d, m, a){
    var ano = a ? (a.length === 2 ? 2000 + (+a) : +a) : h.getFullYear();
    var alvo = new Date(ano, +m - 1, +d);
    if (!a && alvo < h) alvo = new Date(ano + 1, +m - 1, +d);
    if (isNaN(alvo)) return false;
    r.due_on = tfISO(alvo);
  });
  tira(/\sdia (\d{1,2})(?=\s)/i, function(_, d){
    var alvo = new Date(h.getFullYear(), h.getMonth(), +d); if (alvo < h) alvo = new Date(h.getFullYear(), h.getMonth() + 1, +d);
    r.due_on = tfISO(alvo);
  });
  tira(/\s(?:[àa]s? )?(\d{1,2})(?:h(\d{2})?|:(\d{2}))(?=\s)/i, function(_, hh, m1, m2){
    if (+hh > 23) return false;
    r.due_time = String(+hh).padStart(2, '0') + ':' + (m1 || m2 || '00');
    if (!r.due_on) r.due_on = tfISO(h);
  });

  tira(/\s@([^\s#!@]+)/g, function(_, nome){
    var n = tfNorm(nome), p = (G.people || []).filter(function(x){ return tfNorm(x.name).indexOf(n) === 0 || tfNorm(x.name).replace(/\s+/g, '').indexOf(n) === 0; })[0];
    if (!p) return false;
    if (!r.owner_id && p.can_own_tasks) r.owner_id = p.id; else if (r.subjects.indexOf(p.id) < 0) r.subjects.push(p.id);
  });
  tira(/\s#([^\s#!@]+)/g, function(_, nome){
    var n = tfNorm(nome).replace(/[-_]/g, ' ');
    var cs = G.contextos || [], ps = G.projects || [];
    // primeiro o que bate certo por inteiro, depois o que comeca assim
    var c = cs.filter(function(x){ return x.slug === n.replace(/\s+/g, '-') || tfNorm(x.name) === n; })[0];
    var pr = c ? null : (ps.filter(function(x){ return tfNorm(x.name) === n; })[0] ||
                         ps.filter(function(x){ return tfNorm(x.name).indexOf(n) === 0; })[0]);
    if (!c && !pr) c = cs.filter(function(x){ return tfNorm(x.name).indexOf(n) === 0; })[0];
    if (pr && !r.project_id){ r.project_id = pr.id; if (!r.context_id) r.context_id = pr.context_id; return; }
    if (c && !r.context_id){ r.context_id = c.id; return; }
    r.tags.push(tfNorm(nome));
  });

  r.title = s.replace(/\s+/g, ' ').trim();
  if (r.due_on) r.sinais.unshift(['semana', tfDataTxt(r.due_on, r.due_time)]);
  if (r.owner_id) r.sinais.push(['todas', pessoa(r.owner_id).name]);
  r.subjects.forEach(function(id){ r.sinais.push(['todas', 'por causa de ' + pessoa(id).name]); });
  if (r.project_id) r.sinais.push(['proj', projeto(r.project_id).name]);
  else if (r.context_id) r.sinais.push(['proj', areaNome(r.context_id)]);
  r.tags.forEach(function(tg){ r.sinais.push(['tag', tg]); });
  return r;
}

function tfContextoPorOmissao(){
  var cs = (G.contextos || []).filter(function(c){ return !c.parent_id && c.active; });
  var f = cs.filter(function(c){ return c.slug === 'familia'; })[0];
  return (f || cs[0] || {}).id || null;
}

function tfCriarRapido(input){
  var txt = input.value.trim();
  if (!txt) return;
  var r = tfPerceber(txt);
  if (!r.title) { toast('Falta dizer o que é para fazer.'); return; }
  var v = TF.vista, base = {};
  // o que a lista aberta ja diz sobre a tarefa
  if (v === 'hoje' && !r.due_on) base.due_on = tfISO(tfHoje());
  if (v === 'amanha' && !r.due_on) base.due_on = tfISO(tfMais(tfHoje(), 1));
  if (v === 'espera') base.status = 'a_espera';
  if (v === 'execucao') base.status = 'em_curso';
  if (v.indexOf('p:') === 0 && !r.owner_id){
    var p = pessoa(Number(v.slice(2)));
    if (p && p.can_own_tasks) base.owner_id = p.id; else if (p) base.subjects = [p.id];
  }
  if (v.indexOf('proj:') === 0 && !r.project_id){
    var pr = projeto(Number(v.slice(5)));
    if (pr){ base.project_id = pr.id; base.context_id = pr.context_id; }
  }
  if (v.indexOf('tag:') === 0) r.tags.push(v.slice(4));
  var dados = {
    tipo: r.tipo || TF.tipo,
    amount: r.amount,
    title: r.title,
    due_on: r.due_on || base.due_on || null,
    due_time: r.due_time,
    priority: r.priority || 'normal',
    owner_id: r.owner_id || base.owner_id || null,
    subjects: r.subjects.length ? r.subjects : (base.subjects || []),
    project_id: r.project_id || base.project_id || null,
    context_id: r.context_id || base.context_id || tfContextoPorOmissao(),
    tags: r.tags,
    repeat_rule: r.repeat_rule,
    status: base.status || 'aberta',
    reminders: r.due_time ? [{ min: 0 }] : []
  };
  input.disabled = true;
  apiGestao('/api/gestao/tarefas', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
  }).then(function(d){
    G = d; input.value = ''; tfPrevisao('');
    renderGestao();
    toast('Tarefa adicionada.');
  }).catch(function(e){ toast(e.message || 'Não deu para gravar.'); })
    .then(function(){ input.disabled = false; input.focus(); });
}

function tfPrevisao(txt){
  var box = $('tfPrev');
  if (!box) return;
  clear(box);
  if (!txt.trim()) return;
  tfPerceber(txt).sinais.forEach(function(s){
    var c = el('span', 'pill accent');
    c.appendChild(tfIcone(s[0], 11));
    c.appendChild(document.createTextNode(' ' + s[1]));
    box.appendChild(c);
  });
}

/* ------------------------------------------------------------------ *
 * listas
 * ------------------------------------------------------------------ */

function tfAbertas(){
  return (G.tasks || []).filter(function(t){ return !tfFechada(t) && tfTipo(t) === TF.tipo; });
}

function tfFiltro(v){
  var h = tfISO(tfHoje()), am = tfISO(tfMais(tfHoje(), 1)), sem = tfISO(tfMais(tfHoje(), 7));
  if (v === 'hoje') return function(t){ return t.due_on && t.due_on <= h; };
  if (v === 'amanha') return function(t){ return t.due_on === am; };
  if (v === 'semana') return function(t){ return t.due_on && t.due_on <= sem; };
  if (v === 'atrasadas') return function(t){ return t.due_on && t.due_on < h; };
  if (v === 'semdata') return function(t){ return !t.due_on; };
  if (v === 'espera') return function(t){ return t.status === 'a_espera'; };
  if (v === 'execucao') return function(t){ return t.status === 'em_curso'; };
  if (v === 'rever') return function(t){ return t.due_on && t.due_on <= h; };
  if (v === 'mes') return function(t){ return t.due_on && t.due_on <= h.slice(0, 8) + '31'; };
  if (v.indexOf('p:') === 0){
    var id = Number(v.slice(2));
    return function(t){ return t.owner_id === id || (t.subjects || []).indexOf(id) >= 0; };
  }
  if (v.indexOf('proj:') === 0){ var pid = Number(v.slice(5)); return function(t){ return t.project_id === pid; }; }
  if (v.indexOf('tag:') === 0){ var tg = v.slice(4); return function(t){ return (t.tags || []).indexOf(tg) >= 0; }; }
  return function(){ return true; };
}

function tfTituloVista(v){
  var M = { hoje: 'Hoje', amanha: 'Amanhã', semana: 'Próximos 7 dias', atrasadas: 'Atrasadas', todas: 'Por fazer',
            execucao: 'Em execução', semdata: 'Sem data', espera: 'À espera',
            concluidas: 'Concluídas', naofarei: 'Não farei', rever: 'Para rever' };
  if (TF.tipo === 'pagamento'){
    if (v === 'todas') return 'A pagar';
    if (v === 'atrasadas') return 'Em atraso';
    if (v === 'mes') return 'Este mês';
    if (v === 'semprova') return 'Sem comprovativo';
    if (v === 'concluidas') return 'Pagos';
  }
  if (TF.tipo === 'lembrete'){
    if (v === 'todas') return 'Lembretes';
    if (v === 'concluidas') return 'Já vistos';
  }
  if (TF.tipo === 'nota'){
    if (v === 'todas') return 'Notas';
    if (v === 'rever') return 'Para rever';
    if (v === 'semdata') return 'Sem data de revisão';
    if (v === 'concluidas') return 'Arquivadas';
  }
  if (M[v]) return M[v];
  if (v.indexOf('p:') === 0){ var p = pessoa(Number(v.slice(2))); return p ? p.name : 'Pessoa'; }
  if (v.indexOf('proj:') === 0){ var pr = projeto(Number(v.slice(5))); return pr ? pr.name : 'Projeto'; }
  if (v.indexOf('tag:') === 0) return '#' + v.slice(4);
  return 'Tarefas';
}

function tfOrdenar(a, b){
  var da = a.due_on || '9999', db = b.due_on || '9999';
  if (da !== db) return da < db ? -1 : 1;
  var ha = a.due_time || '', hb = b.due_time || '';
  if (ha !== hb) return ha < hb ? -1 : 1;
  var pa = TF_PRIO_ORD[a.priority] || 2, pb = TF_PRIO_ORD[b.priority] || 2;
  if (pa !== pb) return pa - pb;
  return (a.sort_order || 0) - (b.sort_order || 0);
}

function tfBalde(t){
  if (!t.due_on) return 'semdata';
  var h = tfISO(tfHoje());
  if (t.due_on < h) return 'atrasadas';
  if (t.due_on === h) return 'hoje';
  if (t.due_on === tfISO(tfMais(tfHoje(), 1))) return 'amanha';
  if (t.due_on <= tfISO(tfMais(tfHoje(), 7))) return 'semana';
  return 'depois';
}
var TF_BALDES = [['atrasadas', 'Atrasadas'], ['hoje', 'Hoje'], ['amanha', 'Amanhã'], ['semana', 'Próximos 7 dias'],
                 ['depois', 'Mais tarde'], ['semdata', 'Sem data']];
var TF_BALDES_LEMBRETE = [['atrasadas', 'Já passaram'], ['hoje', 'Hoje'], ['amanha', 'Amanhã'],
                          ['semana', 'Próximos 7 dias'], ['depois', 'Mais tarde'], ['semdata', 'Sem data']];
var TF_BALDES_NOTA = [['atrasadas', 'Para rever'], ['hoje', 'Para rever hoje'], ['amanha', 'Amanhã'],
                      ['semana', 'A rever nos próximos 7 dias'], ['depois', 'A rever mais tarde'],
                      ['semdata', 'Sem data de revisão']];

function tfGrupos(lista, v){
  if (v.indexOf('proj:') === 0){
    var secs = {}, ordem = [];
    lista.forEach(function(t){
      var s = t.section || 'Sem secção';
      if (!secs[s]){ secs[s] = []; ordem.push(s); }
      secs[s].push(t);
    });
    ordem.sort(function(a, b){ return a === 'Sem secção' ? 1 : (b === 'Sem secção' ? -1 : a.localeCompare(b, 'pt')); });
    return ordem.map(function(s){ return [s, s, secs[s]]; });
  }
  var baldes = TF.tipo === 'nota' ? TF_BALDES_NOTA : (TF.tipo === 'lembrete' ? TF_BALDES_LEMBRETE : TF_BALDES);
  return baldes.map(function(b){
    return [b[0], b[1], lista.filter(function(t){ return tfBalde(t) === b[0]; })];
  }).filter(function(g){ return g[2].length; });
}

/* ------------------------------------------------------------------ *
 * desenho
 * ------------------------------------------------------------------ */

function tfMontar(){
  if (TF.montado || !$('tf')) return;
  TF.montado = true;
  var st = document.createElement('style');
  st.textContent = TF_CSS;
  document.head.appendChild(st);

  var raiz = $('tf');
  raiz.className = 'tf sem-detalhe';
  var side = el('nav', 'tf-side'); side.id = 'tfSide';
  var main = el('div', 'card tf-main');
  var head = el('header');
  var h3 = el('h3'); h3.id = 'tfTitulo';
  var n = el('span', 'mono'); n.id = 'tfConta';
  head.appendChild(h3); head.appendChild(n);
  main.appendChild(head);

  var tipos = el('div', 'tf-tipos'); tipos.id = 'tfTipos';
  main.appendChild(tipos);

  var add = el('div', 'tf-add');
  add.innerHTML = tfSvg(TF_I.mais, 15);
  var inp = el('input'); inp.type = 'text'; inp.id = 'tfNova';
  inp.placeholder = 'Adicionar tarefa — ex.: pagar IMI amanhã 15h !alta #casa @Ana';
  inp.setAttribute('autocomplete', 'off');
  inp.addEventListener('input', function(){ tfPrevisao(inp.value); });
  inp.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); tfCriarRapido(inp); } });
  add.appendChild(inp);
  var prev = el('div', 'tf-prev'); prev.id = 'tfPrev';
  add.appendChild(prev);
  main.appendChild(add);

  var lista = el('div'); lista.id = 'tfLista';
  main.appendChild(lista);

  var det = el('div', 'card tf-det'); det.id = 'tfDet'; det.hidden = true;
  raiz.appendChild(side); raiz.appendChild(main); raiz.appendChild(det);

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape'){ tfFecharPop(); }
  });
  document.addEventListener('mousedown', function(e){
    var p = document.querySelector('.tf-pop, .tf-menu');
    if (p && !p.contains(e.target) && !e.target.closest('[data-tfpop]')) tfFecharPop();
  });
  tfAvisos();
}

function tfSideBtn(box, chave, icone, texto, n, extra){
  var b = el('button', TF.vista === chave ? 'on' : '');
  b.type = 'button';
  if (icone) b.appendChild(tfIcone(icone));
  if (extra) b.appendChild(extra);
  b.appendChild(document.createTextNode(texto));
  if (n !== null && n !== undefined){
    var c = el('span', 'n' + (chave === 'atrasadas' && n ? ' bad' : ''), n ? String(n) : '');
    b.appendChild(c);
  }
  b.addEventListener('click', function(){ tfIr(chave); });
  box.appendChild(b);
}

function tfRenderTipos(){
  var box = $('tfTipos');
  if (!box) return;
  clear(box);
  var abertas = (G.tasks || []).filter(function(t){ return !tfFechada(t) && !t.parent_id; });
  TF_TIPOS.forEach(function(tp){
    var b = el('button', TF.tipo === tp[0] ? 'on' : '');
    b.type = 'button';
    b.title = tp[2];
    b.appendChild(document.createTextNode(tp[1]));
    var n = abertas.filter(function(t){ return tfTipo(t) === tp[0]; }).length;
    if (n) b.appendChild(el('span', 'n', String(n)));
    b.addEventListener('click', function(){
      if (TF.tipo === tp[0]) return;
      TF.tipo = tp[0];
      TF.aberta = null; TF.detalhe = null;
      var d = $('tfDet'); if (d){ d.hidden = true; clear(d); }
      $('tf').classList.add('sem-detalhe');
      /* Cada tipo tem a sua lista de entrada: as tarefas comecam no Hoje, os
         lembretes e as notas nao fazem sentido filtrados por atraso. */
      TF.vista = tp[0] === 'tarefa' ? 'hoje' : 'todas';
      tfIr(TF.vista);
    });
    box.appendChild(b);
  });
}

function tfRenderSide(){
  var box = $('tfSide');
  clear(box);
  var ab = tfAbertas();
  var conta = function(v){ var f = tfFiltro(v); return ab.filter(function(t){ return !t.parent_id && f(t); }).length; };
  if (TF.tipo === 'tarefa'){
    tfSideBtn(box, 'hoje', 'sol', 'Hoje', conta('hoje'));
    tfSideBtn(box, 'amanha', 'amanha', 'Amanhã', conta('amanha'));
    tfSideBtn(box, 'semana', 'semana', 'Próximos 7 dias', conta('semana'));
    tfSideBtn(box, 'atrasadas', 'atraso', 'Atrasadas', conta('atrasadas'));
    tfSideBtn(box, 'todas', 'todas', 'Por fazer', conta('todas'));
    tfSideBtn(box, 'execucao', 'curso', 'Em execução', conta('execucao'));
    tfSideBtn(box, 'semdata', 'semdata', 'Sem data', conta('semdata'));
    tfSideBtn(box, 'espera', 'espera', 'À espera', conta('espera'));
    tfSideBtn(box, 'concluidas', 'feito', 'Concluídas', null);
    tfSideBtn(box, 'naofarei', 'nao', 'Não farei', null);
  } else if (TF.tipo === 'pagamento'){
    tfSideBtn(box, 'todas', 'euro', 'A pagar', conta('todas'));
    tfSideBtn(box, 'atrasadas', 'atraso', 'Em atraso', conta('atrasadas'));
    tfSideBtn(box, 'semana', 'semana', 'Próximos 7 dias', conta('semana'));
    tfSideBtn(box, 'mes', 'sino', 'Este mês', conta('mes'));
    tfSideBtn(box, 'semprova', 'papel', 'Sem comprovativo', null);
    tfSideBtn(box, 'concluidas', 'feito', 'Pagos', null);
  } else if (TF.tipo === 'lembrete'){
    /* Um lembrete nao se atrasa: ou ja passou ou ainda vem. */
    tfSideBtn(box, 'todas', 'sino', 'Todos', conta('todas'));
    tfSideBtn(box, 'hoje', 'sol', 'Hoje', conta('hoje'));
    tfSideBtn(box, 'semana', 'semana', 'Próximos 7 dias', conta('semana'));
    tfSideBtn(box, 'semdata', 'semdata', 'Sem data', conta('semdata'));
    tfSideBtn(box, 'concluidas', 'feito', 'Já vistos', null);
  } else {
    tfSideBtn(box, 'todas', 'lista', 'Todas', conta('todas'));
    tfSideBtn(box, 'rever', 'atraso', 'Para rever', conta('rever'));
    tfSideBtn(box, 'semdata', 'semdata', 'Sem revisão', conta('semdata'));
    tfSideBtn(box, 'concluidas', 'feito', 'Arquivadas', null);
  }

  box.appendChild(el('div', 'tf-lbl', 'Pessoas'));
  (G.people || []).filter(function(p){ return p.active !== false; }).forEach(function(p){
    var i = el('i'); i.style.background = p.color || 'var(--c1)';
    tfSideBtn(box, 'p:' + p.id, null, p.name, conta('p:' + p.id), i);
  });

  var projs = (G.projects || []).filter(function(p){ return p.status !== 'concluido'; });
  if (projs.length){
    box.appendChild(el('div', 'tf-lbl', 'Projetos'));
    projs.forEach(function(p){ tfSideBtn(box, 'proj:' + p.id, 'proj', p.name, conta('proj:' + p.id)); });
  }

  var tags = {};
  ab.forEach(function(t){ (t.tags || []).forEach(function(tg){ tags[tg] = (tags[tg] || 0) + 1; }); });
  var nomes = Object.keys(tags).sort();
  if (nomes.length){
    box.appendChild(el('div', 'tf-lbl', 'Etiquetas'));
    nomes.forEach(function(tg){ tfSideBtn(box, 'tag:' + tg, 'tag', tg, tags[tg]); });
  }
}

function tfIr(v){
  TF.vista = v;
  if (v === 'concluidas' || v === 'naofarei' || v === 'semprova'){
    TF.historico = []; TF.histFim = false; TF.histVista = v; tfCarregarHistorico();
  }
  tfRender();
  var lista = $('tfLista');
  if (lista && lista.getBoundingClientRect().top < 0) window.scrollTo({ top: 0 });
}

function tfCarregarHistorico(){
  if (TF.vista === 'semprova'){
    var pedido = TF.vista;
    return apiGestao('/api/tarefas/pagamentos/sem-prova').then(function(rows){
      if (TF.vista !== pedido) return;
      TF.historico = rows; TF.histFim = true; tfRenderLista();
    }).catch(function(){ toast('Não deu para ler os pagamentos sem comprovativo.'); });
  }
  var ultimo = TF.historico[TF.historico.length - 1];
  var url = '/api/tarefas/historico?limite=60&tipo=' + TF.tipo +
    '&estado=' + (TF.vista === 'naofarei' ? 'cancelada' : 'concluida') +
    (ultimo && ultimo.completed_at ? '&antes=' + encodeURIComponent(ultimo.completed_at) : '');
  var pedido = TF.vista;
  return apiGestao(url).then(function(rows){
    if (TF.vista !== pedido) return;
    TF.historico = TF.historico.concat(rows);
    TF.histFim = rows.length < 60;
    tfRenderLista();
  }).catch(function(){ toast('Não deu para ler o histórico.'); });
}

function tfRender(){
  if (!$('tf')) return;
  tfMontar();
  tfRenderTipos();
  tfRenderSide();
  tfRenderLista();
  if (TF.aberta){
    var t = tfPorId(TF.aberta);
    if (t) tfRenderDetalhe(t); else tfFecharDetalhe();
  }
}

function tfPorId(id){
  var t = (G.tasks || []).filter(function(x){ return x.id === id; })[0];
  if (!t) t = TF.historico.filter(function(x){ return x.id === id; })[0];
  if (!t && TF.detalhe && TF.detalhe.id === id) t = TF.detalhe;
  return t || null;
}

function tfRenderLista(){
  var box = $('tfLista');
  if (!box) return;
  clear(box);
  var v = TF.vista;
  $('tfTitulo').textContent = tfTituloVista(v);
  var hist = v === 'concluidas' || v === 'naofarei' || v === 'semprova';
  $('tfNova').parentNode.hidden = hist;
  $('tfNova').placeholder = TF.tipo === 'pagamento'
    ? 'Novo pagamento — ex.: renda 1250€ dia 9 todos os meses #casa'
    : TF.tipo === 'nota'
    ? 'Guardar nota — ex.: horário da escola #família'
    : (TF.tipo === 'lembrete'
        ? 'Novo lembrete — ex.: anos da Olga 15/10 todos os anos'
        : 'Adicionar tarefa — ex.: pagar IMI amanhã 15h !alta #casa @Ana');

  var lista;
  if (hist) lista = TF.historico.slice();
  else {
    var f = tfFiltro(v);
    lista = tfAbertas().filter(f).sort(tfOrdenar);
  }
  var nome = TF.tipo === 'nota' ? ['nota', 'notas']
    : (TF.tipo === 'lembrete' ? ['lembrete', 'lembretes']
      : (TF.tipo === 'pagamento' ? ['pagamento', 'pagamentos'] : ['tarefa', 'tarefas']));
  var conta = lista.length + (hist && !TF.histFim ? '+' : '') + ' ' + (lista.length === 1 ? nome[0] : nome[1]);
  if (TF.tipo === 'pagamento'){
    /* Numa lista de pagamentos, o que interessa saber de relance e quanto e. */
    var soma = lista.reduce(function(a, t){ return a + Number((hist ? t.paid_amount : t.amount) || 0); }, 0);
    if (soma) conta += ' · ' + tfEuros(soma);
  }
  $('tfConta').textContent = conta;

  if (!lista.length){
    box.appendChild(el('div', 'tf-vazio', hist ? 'Nada por aqui.' : (v === 'hoje' ? 'Nada para hoje. Bom trabalho.' : 'Nada por fazer nesta lista.')));
    return;
  }

  if (hist){
    var g = el('div', 'tf-rows');
    lista.forEach(function(t){ g.appendChild(tfLinha(t, false)); });
    box.appendChild(g);
    if (!TF.histFim){
      var b = el('button', 'btn small tf-mais', 'Carregar mais');
      b.type = 'button';
      b.addEventListener('click', tfCarregarHistorico);
      box.appendChild(b);
    }
    return;
  }

  // subtarefas ficam debaixo da mae quando a mae esta na lista
  var ids = {};
  lista.forEach(function(t){ ids[t.id] = true; });
  var raizes = lista.filter(function(t){ return !t.parent_id || !ids[t.parent_id]; });
  var filhos = {};
  lista.forEach(function(t){ if (t.parent_id && ids[t.parent_id]) (filhos[t.parent_id] = filhos[t.parent_id] || []).push(t); });

  tfGrupos(raizes, v).forEach(function(gr){
    var chave = v + '|' + gr[0];
    var grp = el('div', 'tf-grp' + (gr[0] === 'atrasadas' && TF.tipo === 'tarefa' ? ' late' : '') + (TF.fechados[chave] ? ' fechado' : ''));
    var h = el('h4');
    h.appendChild(tfIcone('seta', 12));
    h.appendChild(document.createTextNode(gr[1]));
    h.appendChild(el('span', null, String(gr[2].length)));
    h.addEventListener('click', function(){ TF.fechados[chave] = !TF.fechados[chave]; grp.classList.toggle('fechado'); });
    grp.appendChild(h);
    var rows = el('div', 'tf-rows');
    gr[2].forEach(function(t){
      rows.appendChild(tfLinha(t, false));
      (filhos[t.id] || []).sort(tfOrdenar).forEach(function(c){ rows.appendChild(tfLinha(c, true)); });
    });
    grp.appendChild(rows);
    box.appendChild(grp);
  });
}

function tfCaixa(t, onclick){
  var b = el('button', 'tf-box ' + (t.priority || '') + (t.status === 'concluida' ? ' on' : '') + (t.status === 'cancelada' ? ' x' : ''));
  b.type = 'button';
  b.innerHTML = tfSvg(TF_I.check, 11).replace('stroke-width="1.7"', 'stroke-width="3.2"');
  b.title = tfFechada(t) ? 'Reabrir' : 'Concluir';
  b.addEventListener('click', function(e){ e.stopPropagation(); onclick(); });
  return b;
}

/* O estado vive na linha: ve-se sem abrir nada e muda-se ali mesmo. */
function tfEtiquetaEstado(t){
  var e = tfEstado(t.status);
  var b = el('button', 'tf-est' + (e[2] ? ' ' + e[2] : ''), e[1]);
  b.type = 'button';
  b.dataset.tfpop = '1';
  b.title = 'Mudar o estado';
  b.addEventListener('click', function(ev){
    ev.stopPropagation();
    var ops = TF_ESTADOS.concat(TF_ESTADOS_FIM).filter(function(x){ return x[0] !== t.status; })
      .map(function(x){
        return [x[1], function(){ tfMudarEstado(t, x[0]); }];
      });
    tfMenu(b, ops);
  });
  return b;
}

function tfLinha(t, sub){
  var li = el('div', 'tf-row' + (sub ? ' sub' : '') + (tfFechada(t) ? ' done' : '') + (TF.aberta === t.id ? ' sel' : ''));
  var nota = tfTipo(t) === 'nota';
  if (nota){
    /* Uma nota nao se conclui: arquiva-se quando deixar de interessar. */
    var ponto = el('span'); ponto.innerHTML = tfSvg(TF_I.lista, 14);
    ponto.style.cssText = 'flex:none;color:var(--faint);padding-top:2px';
    li.appendChild(ponto);
  } else {
    li.appendChild(tfCaixa(t, function(){ tfAlternar(t); }));
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
  /* Um lembrete nao tem ciclo de vida: ou ja apareceu ou ainda vem. */
  if (tfTipo(t) === 'tarefa') m.appendChild(tfEtiquetaEstado(t));
  if (t.tipo === 'pagamento' && t.payee) m.appendChild(el('span', null, t.payee));
  if (tfSemProva(t)) m.appendChild(pill('falta comprovativo', 'warn'));
  var pr = projeto(t.project_id);
  if (pr && TF.vista !== 'proj:' + pr.id) m.appendChild(el('span', null, pr.name));
  if ((t.items || []).length){
    var feitos = t.items.filter(function(i){ return i.done; }).length;
    var c = el('span'); c.innerHTML = tfSvg(TF_I.lista, 11); c.appendChild(document.createTextNode(feitos + '/' + t.items.length)); m.appendChild(c);
  }
  if (t.repeat_rule){ var r = el('span'); r.innerHTML = tfSvg(TF_I.rep, 11); r.title = t.repeat_label; m.appendChild(r); }
  if ((t.reminders || []).length && !tfFechada(t)){ var s = el('span'); s.innerHTML = tfSvg(TF_I.sino, 11); m.appendChild(s); }
  if (t.comments){ var co = el('span'); co.innerHTML = tfSvg(TF_I.com, 11); co.appendChild(document.createTextNode(String(t.comments))); m.appendChild(co); }
  (t.tags || []).forEach(function(tg){ m.appendChild(el('span', 'tf-tag', tg)); });
  if (m.childNodes.length) corpo.appendChild(m);
  li.appendChild(corpo);
  if (t.tipo === 'pagamento' && (t.amount || t.paid_amount)){
    var val = el('div', 'tf-val', tfEuros(t.paid_on ? (t.paid_amount || t.amount) : t.amount));
    li.appendChild(val);
  }
  var dir;
  if (tfFechada(t) && t.completed_at){
    var cd = new Date(t.completed_at);
    dir = el('div', 'tf-r', cd.getDate() + ' ' + MESES[cd.getMonth()].slice(0, 3) + (cd.getFullYear() !== new Date().getFullYear() ? ' ' + cd.getFullYear() : ''));
  } else {
    dir = el('div', 'tf-r ' + (nota ? '' : tfNivelData(t)),
      (nota && t.due_on ? 'rever ' : '') + tfDataTxt(t.due_on, t.due_time));
  }
  li.appendChild(dir);
  li.addEventListener('click', function(){ tfAbrir(t.id); });
  return li;
}

/* ------------------------------------------------------------------ *
 * escrita
 * ------------------------------------------------------------------ */

function tfGravar(id, dados, msg){
  return apiGestao('/api/gestao/tarefas/' + id, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
  }).then(function(d){
    G = d;
    if (TF.detalhe && TF.detalhe.id === id){
      var nova = tfPorId(id);
      if (nova) Object.keys(nova).forEach(function(k){ TF.detalhe[k] = nova[k]; });
    }
    renderGestao();
    if (msg) toast(msg);
  }).catch(function(e){ toast(e.message || 'Não deu para gravar.'); throw e; });
}

/* Mudar o estado, venha de onde vier. Reabrir uma tarefa fechada tira-a do
   historico que estiver a ser mostrado. */
function tfMudarEstado(t, estado){
  if (estado === 'concluida' || estado === 'cancelada') return tfFechar(t, estado);
  if (!tfFechada(t)) return tfGravar(t.id, { status: estado });
  return tfGravar(t.id, { status: estado }, 'Tarefa reaberta.').then(function(){
    if (TF.vista === 'concluidas' || TF.vista === 'naofarei'){
      TF.historico = TF.historico.filter(function(x){ return x.id !== t.id; });
      tfRenderLista();
    }
  });
}

function tfAlternar(t){
  if (tfFechada(t)) return tfMudarEstado(t, 'aberta');
  /* Marcar um pagamento como feito e dizer quanto, quando e com que prova: a
     caixinha abre a janela em vez de fechar a seco. */
  if (tfTipo(t) === 'pagamento'){
    var alvo = document.querySelector('.tf-row.sel .tf-box') || document.querySelector('.tf-det .tf-box') || $('tfLista');
    tfAbrir(t.id);
    return setTimeout(function(){ tfPopPagar(tfPorId(t.id) || t, alvo); }, 60);
  }
  return tfFechar(t, 'concluida');
}

/* Fechar e sempre a mesma coisa, quer venha da caixinha quer da etiqueta do
   estado: numa rotina fica o registo e a tarefa anda para a proxima data. */
function tfFechar(t, estado){
  if (tfFechada(t)) return tfGravar(t.id, { status: estado });
  var rotina = Boolean(t.repeat_rule);
  var feita = estado === 'concluida';
  return tfGravar(t.id, { status: estado }).then(function(){
    if (rotina){
      var n = tfPorId(t.id);
      var prox = n && !tfFechada(n) ? ' Próxima: ' + tfDataTxt(n.due_on, n.due_time) + '.' : ' A rotina terminou.';
      toast((feita ? 'Feito.' : 'Esta vez fica por fazer.') + prox);
    } else {
      tfDesfazer(feita ? 'Tarefa concluída.' : 'Marcada como «não farei».',
        function(){ tfGravar(t.id, { status: 'aberta' }); });
    }
  });
}

function tfDesfazer(msg, fn){
  toast(msg);
  var t = $('toast');
  var b = el('button', null, 'Desfazer');
  b.type = 'button';
  b.style.cssText = 'margin-left:12px;border:0;background:none;color:inherit;font:inherit;font-weight:600;text-decoration:underline;cursor:pointer';
  b.addEventListener('click', function(){ t.classList.remove('show'); fn(); });
  t.appendChild(b);
}

/* ------------------------------------------------------------------ *
 * detalhe
 * ------------------------------------------------------------------ */

function tfAbrir(id){
  TF.aberta = id;
  var t = tfPorId(id);
  if (!t) return;
  TF.detalhe = JSON.parse(JSON.stringify(t));
  TF.detalhe.comentarios = null; TF.detalhe.historico = null;
  tfRenderDetalhe(TF.detalhe);
  tfRenderLista();
  apiGestao('/api/tarefas/' + id).then(function(x){
    if (TF.aberta !== id) return;
    TF.detalhe.comentarios = x.comentarios; TF.detalhe.historico = x.historico;
    tfRenderDetalhe(TF.detalhe);
  }).catch(function(){});
}

function tfFecharDetalhe(){
  TF.aberta = null; TF.detalhe = null;
  var d = $('tfDet'); if (d){ d.hidden = true; clear(d); }
  $('tf').classList.add('sem-detalhe');
  tfRenderLista();
}

function tfTextoAuto(no, guardar){
  var v0 = no.value;
  var ajusta = function(){ no.style.height = 'auto'; no.style.height = no.scrollHeight + 'px'; };
  no.addEventListener('input', ajusta);
  setTimeout(ajusta, 0);
  no.addEventListener('blur', function(){ if (no.value !== v0){ v0 = no.value; guardar(no.value); } });
}

function tfRenderDetalhe(base){
  var t = TF.detalhe && TF.detalhe.id === base.id ? TF.detalhe : base;
  var det = $('tfDet');
  var foco = document.activeElement && det.contains(document.activeElement) ? document.activeElement.dataset.tfk : null;
  clear(det);
  det.hidden = false;
  $('tf').classList.remove('sem-detalhe');
  var fechada = tfFechada(t);

  // barra de cima: concluir, data, prioridade, menu
  var ehNota = tfTipo(t) === 'nota';
  var top = el('div', 'tf-top');
  if (!ehNota) top.appendChild(tfCaixa(t, function(){ tfAlternar(t); }));
  var bData = el('button', 'tf-chipbtn ' + tfNivelData(t).replace('acc', ''));
  bData.type = 'button'; bData.dataset.tfpop = '1';
  bData.appendChild(tfIcone('semana', 13));
  bData.appendChild(document.createTextNode(t.due_on
    ? (ehNota ? 'rever ' : '') + tfDataTxt(t.due_on, t.due_time)
    : (ehNota ? 'Data de revisão' : 'Data')));
  if (t.repeat_rule){ bData.appendChild(tfIcone('rep', 12)); }
  bData.addEventListener('click', function(e){ e.stopPropagation(); tfPopData(t, bData); });
  top.appendChild(bData);
  if (tfTipo(t) === 'pagamento' && !fechada){
    var bPagar = el('button', 'btn small primary', t.paid_on ? 'Corrigir pagamento' : 'Pagar');
    bPagar.type = 'button';
    bPagar.style.marginLeft = '6px';
    bPagar.dataset.tfpop = '1';
    bPagar.addEventListener('click', function(e){ e.stopPropagation(); tfPopPagar(t, bPagar); });
    top.appendChild(bPagar);
  }
  top.appendChild(el('span', 'tf-sp'));
  var bPrio = el('button', 'tf-ico'); bPrio.type = 'button'; bPrio.dataset.tfpop = '1'; bPrio.title = 'Prioridade';
  bPrio.innerHTML = tfSvg(TF_I.bandeira, 16);
  bPrio.style.color = { alta: 'var(--bad)', media: 'var(--warn)', baixa: 'var(--accent)' }[t.priority] || '';
  bPrio.addEventListener('click', function(e){
    e.stopPropagation();
    tfMenu(bPrio, TF_PRIO.map(function(p){ return [p[1], function(){ tfGravar(t.id, { priority: p[0] }); }]; }));
  });
  top.appendChild(bPrio);
  var bMais = el('button', 'tf-ico'); bMais.type = 'button'; bMais.dataset.tfpop = '1'; bMais.title = 'Mais';
  bMais.innerHTML = tfSvg(TF_I.pontos, 16);
  bMais.addEventListener('click', function(e){
    e.stopPropagation();
    var ops = [];
    if (!fechada && ehNota) ops.push(['Arquivar', function(){ tfGravar(t.id, { status: 'concluida' }, 'Nota arquivada.'); }]);
    if (!fechada && !ehNota) ops.push(['Não farei', function(){ tfFechar(t, 'cancelada'); }]);
    ops.push(['Duplicar', function(){ tfDuplicar(t); }]);
    if (!t.parent_id) ops.push(['Adicionar subtarefa', function(){ var i = document.querySelector('[data-tfk=novasub]'); if (i) i.focus(); }]);
    ops.push(['Apagar', function(){ tfApagar(t); }, 'danger']);
    tfMenu(bMais, ops);
  });
  top.appendChild(bMais);
  var bX = el('button', 'tf-ico tf-fechar'); bX.type = 'button'; bX.innerHTML = tfSvg(TF_I.x, 16); bX.title = 'Fechar';
  bX.addEventListener('click', tfFecharDetalhe);
  top.appendChild(bX);
  det.appendChild(top);

  if (t.parent_id){
    var mae = tfPorId(t.parent_id);
    if (mae){
      var lm = el('button', 'tf-chipbtn', '↑ ' + mae.title); lm.type = 'button'; lm.style.marginBottom = '6px';
      lm.addEventListener('click', function(){ tfAbrir(mae.id); });
      det.appendChild(lm);
    }
  }

  var tit = el('textarea', 'tf-titulo'); tit.rows = 1; tit.value = t.title; tit.dataset.tfk = 'titulo';
  tit.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); tit.blur(); } });
  tfTextoAuto(tit, function(v){ if (v.trim()) tfGravar(t.id, { title: v.trim() }); });
  det.appendChild(tit);

  var notas = el('textarea', 'tf-notas'); notas.placeholder = 'Notas…'; notas.value = t.notes || ''; notas.dataset.tfk = 'notas';
  tfTextoAuto(notas, function(v){ tfGravar(t.id, { notes: v.trim() || null }); });
  det.appendChild(notas);

  // passos
  var sp = el('div', 'tf-sec');
  var feitos = (t.items || []).filter(function(i){ return i.done; }).length;
  sp.appendChild(el('div', 'tf-lbl', 'Passos' + ((t.items || []).length ? ' · ' + feitos + '/' + t.items.length : '')));
  (t.items || []).forEach(function(it){
    var l = el('div', 'tf-it' + (it.done ? ' done' : ''));
    l.appendChild(tfCaixa({ status: it.done ? 'concluida' : 'aberta' }, function(){ tfItem('PATCH', it.id, { done: !it.done }); }));
    var i = el('input'); i.type = 'text'; i.value = it.title; i.dataset.tfk = 'item' + it.id;
    i.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); i.blur(); } });
    i.addEventListener('blur', function(){ if (i.value.trim() && i.value !== it.title) tfItem('PATCH', it.id, { title: i.value.trim() }); });
    l.appendChild(i);
    var x = el('button', 'tf-ico'); x.type = 'button'; x.innerHTML = tfSvg(TF_I.x, 13); x.title = 'Tirar passo';
    x.addEventListener('click', function(){ tfItem('DELETE', it.id); });
    l.appendChild(x);
    sp.appendChild(l);
  });
  var ni = el('input', 'tf-novo'); ni.type = 'text'; ni.placeholder = '+ passo'; ni.dataset.tfk = 'novoitem';
  ni.addEventListener('keydown', function(e){
    if (e.key === 'Enter' && ni.value.trim()){ e.preventDefault(); tfItemNovo(t.id, ni.value.trim()); }
  });
  sp.appendChild(ni);
  det.appendChild(sp);

  // subtarefas
  if (!t.parent_id){
    var ss = el('div', 'tf-sec');
    var subs = (G.tasks || []).filter(function(x){ return x.parent_id === t.id; });
    ss.appendChild(el('div', 'tf-lbl', 'Subtarefas' + (subs.length ? ' · ' + subs.filter(tfFechada).length + '/' + subs.length : '')));
    subs.sort(tfOrdenar).forEach(function(c){
      var l = el('div', 'tf-it' + (tfFechada(c) ? ' done' : ''));
      l.appendChild(tfCaixa(c, function(){ tfAlternar(c); }));
      var a = el('button', 'tf-chipbtn', c.title); a.type = 'button'; a.style.cssText = 'border:0;padding:3px 0;flex:1;justify-content:flex-start;text-align:left';
      a.addEventListener('click', function(){ tfAbrir(c.id); });
      l.appendChild(a);
      if (c.due_on) l.appendChild(el('span', 'tf-r ' + tfNivelData(c), tfDataTxt(c.due_on, c.due_time)));
      ss.appendChild(l);
    });
    var ns = el('input', 'tf-novo'); ns.type = 'text'; ns.placeholder = '+ subtarefa'; ns.dataset.tfk = 'novasub';
    ns.addEventListener('keydown', function(e){
      if (e.key === 'Enter' && ns.value.trim()){
        e.preventDefault();
        apiGestao('/api/gestao/tarefas', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: ns.value.trim(), parent_id: t.id, context_id: t.context_id, project_id: t.project_id,
                                 owner_id: t.owner_id, section: t.section }) })
          .then(function(d){ G = d; renderGestao(); var q = document.querySelector('[data-tfk=novasub]'); if (q) q.focus(); })
          .catch(function(){ toast('Não deu para criar a subtarefa.'); });
      }
    });
    ss.appendChild(ns);
    det.appendChild(ss);
  }

  // campos
  var sc = el('div', 'tf-sec');
  sc.appendChild(el('div', 'tf-lbl', 'Detalhes'));
  var grid = el('div', 'tf-grid');
  function campo(rotulo, no){ grid.appendChild(el('span', null, rotulo)); grid.appendChild(no); }

  var sTipo = el('select');
  TF_TIPOS.forEach(function(tp){ sTipo.appendChild(new Option(tp[1].replace(/s$/, ''), tp[0])); });
  sTipo.value = tfTipo(t);
  sTipo.title = 'Tarefa pede acção · Lembrete só precisa de aparecer no dia · Nota é memória';
  sTipo.addEventListener('change', function(){
    var novo = sTipo.value;
    tfGravar(t.id, { tipo: novo }).then(function(){
      if (novo !== TF.tipo){ TF.tipo = novo; TF.vista = novo === 'tarefa' ? 'hoje' : 'todas'; tfRender(); }
    });
  });
  campo('Tipo', sTipo);

  if (!fechada && tfTipo(t) === 'tarefa'){
    var sEst = el('select');
    TF_ESTADOS.forEach(function(e){ sEst.appendChild(new Option(e[1], e[0])); });
    sEst.value = t.status;
    sEst.addEventListener('change', function(){ tfGravar(t.id, { status: sEst.value }); });
    campo('Estado', sEst);
  }

  if (tfTipo(t) === 'pagamento'){
    var iVal = el('input'); iVal.type = 'text'; iVal.value = t.amount != null ? String(t.amount).replace('.', ',') : '';
    iVal.placeholder = '0,00';
    iVal.addEventListener('change', function(){ tfGravar(t.id, { amount: iVal.value }); });
    campo('Valor', iVal);

    var iQuem = el('input'); iQuem.type = 'text'; iQuem.value = t.payee || ''; iQuem.placeholder = 'a quem se paga';
    iQuem.addEventListener('change', function(){ tfGravar(t.id, { payee: iQuem.value.trim() || null }); });
    campo('A quem', iQuem);

    var iRef = el('input'); iRef.type = 'text'; iRef.value = t.payment_ref || '';
    iRef.placeholder = 'IBAN, entidade e referência…';
    iRef.addEventListener('change', function(){ tfGravar(t.id, { payment_ref: iRef.value.trim() || null }); });
    campo('Referência', iRef);

    if (t.paid_on){
      var pago = el('div');
      pago.appendChild(pill('pago a ' + tfDataTxt(t.paid_on), 'good'));
      if (t.paid_amount != null) pago.appendChild(document.createTextNode(' ' + tfEuros(t.paid_amount)));
      if (t.payment_method) pago.appendChild(document.createTextNode(' · ' + t.payment_method));
      if (t.expense_id) pago.appendChild(document.createTextNode(' · despesa registada'));
      if (tfSemProva(t)){
        pago.appendChild(document.createElement('br'));
        pago.appendChild(pill('falta comprovativo', 'warn'));
      }
      campo('Pagamento', pago);
    }
  }

  var sDono = el('select');
  sDono.appendChild(new Option('—', ''));
  (G.people || []).filter(function(p){ return p.can_own_tasks && p.active !== false; }).forEach(function(p){ sDono.appendChild(new Option(p.name, p.id)); });
  sDono.value = t.owner_id || '';
  sDono.addEventListener('change', function(){ tfGravar(t.id, { owner_id: sDono.value ? Number(sDono.value) : null }); });
  campo('Quem faz', sDono);

  var ch = el('div', 'tf-chips');
  (G.people || []).filter(function(p){ return p.active !== false; }).forEach(function(p){
    var b = el('button', 'chip'); b.type = 'button';
    var on = (t.subjects || []).indexOf(p.id) >= 0;
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    var i = el('i'); i.style.background = p.color || 'var(--c1)'; b.appendChild(i);
    b.appendChild(document.createTextNode(p.name));
    b.addEventListener('click', function(){
      var s = (t.subjects || []).slice();
      if (on) s = s.filter(function(x){ return x !== p.id; }); else s.push(p.id);
      tfGravar(t.id, { subjects: s });
    });
    ch.appendChild(b);
  });
  campo('Por causa de', ch);

  var sArea = el('select'); sArea.id = 'tfArea' + t.id;
  sArea.appendChild(new Option('—', ''));
  (G.contextos || []).filter(function(c){ return !c.parent_id && c.active; }).forEach(function(area){
    var g = document.createElement('optgroup'); g.label = area.name;
    g.appendChild(new Option(area.name, area.id));
    G.contextos.filter(function(c){ return c.parent_id === area.id && c.active; })
      .forEach(function(sub){ g.appendChild(new Option('   ' + sub.name, sub.id)); });
    sArea.appendChild(g);
  });
  sArea.value = t.context_id || '';
  sArea.addEventListener('change', function(){ tfGravar(t.id, { context_id: sArea.value ? Number(sArea.value) : null }); });
  campo('Área', sArea);

  var sProj = el('select');
  sProj.appendChild(new Option('—', ''));
  (G.projects || []).forEach(function(p){ sProj.appendChild(new Option(p.name, p.id)); });
  sProj.value = t.project_id || '';
  sProj.addEventListener('change', function(){
    var pr = projeto(Number(sProj.value));
    var dados = { project_id: sProj.value ? Number(sProj.value) : null };
    if (pr && pr.context_id && !t.context_id) dados.context_id = pr.context_id;
    tfGravar(t.id, dados);
  });
  campo('Projeto', sProj);

  if (t.project_id){
    var iSec = el('input'); iSec.type = 'text'; iSec.value = t.section || ''; iSec.placeholder = 'ex.: Fase 2';
    var secs = {};
    (G.tasks || []).forEach(function(x){ if (x.project_id === t.project_id && x.section) secs[x.section] = true; });
    var dl = el('datalist'); dl.id = 'tfSecs'; Object.keys(secs).forEach(function(s){ dl.appendChild(new Option(s)); });
    iSec.setAttribute('list', 'tfSecs');
    iSec.addEventListener('change', function(){ tfGravar(t.id, { section: iSec.value.trim() || null }); });
    var wrap = el('div'); wrap.appendChild(iSec); wrap.appendChild(dl);
    campo('Secção', wrap);
  }

  var iTags = el('input'); iTags.type = 'text'; iTags.value = (t.tags || []).join(', '); iTags.placeholder = 'rotina, pagamentos…';
  iTags.addEventListener('change', function(){
    tfGravar(t.id, { tags: iTags.value.split(',').map(function(s){ return s.trim(); }).filter(Boolean) });
  });
  campo('Etiquetas', iTags);

  // documentos
  var dBox = el('div');
  (t.papeis || (t.documents || []).map(function(x){ return { id: x, papel: 'anexo' }; })).forEach(function(ref){
    var did = ref.id;
    var doc = docPorId(did);
    var l = el('div', 'tf-it');
    if (ref.papel && ref.papel !== 'anexo'){
      var et = el('span', 'tf-tag', ref.papel);
      et.style.marginRight = '4px';
      l.appendChild(et);
    }
    var nome = doc && doc.inbox_id ? el('a', null, doc.name) : el('span', null, doc ? doc.name : 'documento ' + did);
    if (doc && doc.inbox_id){ nome.href = '/api/inbox/' + doc.inbox_id + '/ficheiro'; nome.target = '_blank'; nome.rel = 'noopener'; }
    nome.style.flex = '1';
    l.appendChild(nome);
    var x = el('button', 'tf-ico'); x.type = 'button'; x.innerHTML = tfSvg(TF_I.x, 13);
    x.addEventListener('click', function(){
      tfGravar(t.id, { documents: (t.papeis || []).filter(function(y){ return y.id !== did; }) });
    });
    l.appendChild(x);
    dBox.appendChild(l);
  });
  var sDoc = el('select');
  sDoc.appendChild(new Option('+ juntar documento', ''));
  ((window.D && D.documents) || []).forEach(function(doc){
    if ((t.documents || []).indexOf(doc.id) >= 0) return;
    var dono = pessoa(doc.person_id);
    sDoc.appendChild(new Option(doc.name + (dono ? ' (' + dono.name + ')' : ''), doc.id));
  });
  sDoc.addEventListener('change', function(){
    if (!sDoc.value) return;
    var lista = (t.papeis || []).slice();
    lista.push({ id: Number(sDoc.value), papel: tfTipo(t) === 'pagamento' ? 'fatura' : 'anexo' });
    tfGravar(t.id, { documents: lista });
  });
  dBox.appendChild(sDoc);
  campo('Documentos', dBox);

  if ((t.reminders || []).length){
    campo('Lembretes', el('span', null, t.reminders.map(function(r){ return tfLembreteTxt(r.min, !t.due_time); }).join(' · ')));
  }
  if (t.repeat_rule){
    campo('Repete', el('span', null, t.repeat_label + (t.repeat_from === 'conclusao' ? ' (a contar da conclusão)' : '') +
      (t.repeat_until ? ' até ' + tfDataTxt(t.repeat_until) : '')));
  }
  sc.appendChild(grid);
  det.appendChild(sc);

  // historico da rotina
  if (t.historico && t.historico.length){
    var sh = el('div', 'tf-sec');
    sh.appendChild(el('div', 'tf-lbl', 'Últimas vezes'));
    var hb = el('div', 'tf-hist');
    t.historico.forEach(function(x){
      var dd = x.completed_at ? new Date(x.completed_at) : null;
      var p = pill((x.status === 'cancelada' ? '✕ ' : '✓ ') + (x.due_on ? tfDataTxt(x.due_on) : (dd ? dd.toLocaleDateString('pt-PT') : '')), x.status === 'cancelada' ? '' : 'good');
      p.title = dd ? 'fechada a ' + dd.toLocaleDateString('pt-PT') : '';
      hb.appendChild(p);
    });
    sh.appendChild(hb);
    det.appendChild(sh);
  }

  // comentarios
  var sk = el('div', 'tf-sec');
  sk.appendChild(el('div', 'tf-lbl', 'Comentários' + (t.comentarios && t.comentarios.length ? ' · ' + t.comentarios.length : '')));
  (t.comentarios || []).forEach(function(c){
    var cc = el('div', 'tf-com');
    var dd = new Date(c.created_at);
    cc.appendChild(el('small', null, (c.author || '—') + ' · ' + dd.toLocaleDateString('pt-PT') + ' ' + dd.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })));
    cc.appendChild(document.createTextNode(c.body));
    sk.appendChild(cc);
  });
  var nc = el('textarea', 'tf-novo'); nc.rows = 1; nc.placeholder = '+ comentário (Enter grava, Shift+Enter muda de linha)'; nc.dataset.tfk = 'novocom';
  nc.style.resize = 'vertical'; nc.style.paddingLeft = '0';
  nc.addEventListener('keydown', function(e){
    if (e.key === 'Enter' && !e.shiftKey && nc.value.trim()){
      e.preventDefault();
      apiGestao('/api/tarefas/' + t.id + '/comentarios', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: nc.value.trim() }) })
        .then(function(lista){ TF.detalhe.comentarios = lista; TF.detalhe.comments = lista.length; tfRenderDetalhe(TF.detalhe);
          var q = document.querySelector('[data-tfk=novocom]'); if (q) q.focus(); })
        .catch(function(){ toast('Não deu para gravar o comentário.'); });
    }
  });
  sk.appendChild(nc);
  det.appendChild(sk);

  var rod = el('div', 'mono');
  rod.style.cssText = 'margin-top:14px;color:var(--faint);font-size:.625rem';
  rod.textContent = 'criada a ' + new Date(t.created_at).toLocaleDateString('pt-PT') +
    (t.completed_at ? ' · fechada a ' + new Date(t.completed_at).toLocaleDateString('pt-PT') : '');
  det.appendChild(rod);

  if (foco){ var f = det.querySelector('[data-tfk="' + foco + '"]'); if (f) f.focus(); }
}

function tfItem(metodo, id, dados){
  apiGestao('/api/tarefas/itens/' + id, {
    method: metodo, headers: { 'Content-Type': 'application/json' }, body: dados ? JSON.stringify(dados) : undefined
  }).then(tfTarefaVoltou).catch(function(){ toast('Não deu para gravar o passo.'); });
}
function tfItemNovo(taskId, titulo){
  apiGestao('/api/tarefas/' + taskId + '/itens', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: titulo })
  }).then(function(t){ tfTarefaVoltou(t); var q = document.querySelector('[data-tfk=novoitem]'); if (q) q.focus(); })
    .catch(function(){ toast('Não deu para gravar o passo.'); });
}
function tfTarefaVoltou(t){
  if (!t) return;
  for (var i = 0; i < G.tasks.length; i++) if (G.tasks[i].id === t.id){ G.tasks[i] = t; break; }
  if (TF.detalhe && TF.detalhe.id === t.id){
    Object.keys(t).forEach(function(k){ TF.detalhe[k] = t[k]; });
    tfRenderDetalhe(TF.detalhe);
  }
  tfRenderLista();
}

function tfDuplicar(t){
  var dados = {};
  ['title', 'notes', 'context_id', 'project_id', 'owner_id', 'priority', 'due_on', 'due_time', 'repeat_rule', 'repeat_from',
   'repeat_until', 'reminders', 'tags', 'section', 'subjects', 'documents', 'parent_id'].forEach(function(k){ dados[k] = t[k]; });
  dados.items = (t.items || []).map(function(i){ return { title: i.title }; });
  dados.title = t.title + ' (cópia)';
  apiGestao('/api/gestao/tarefas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) })
    .then(function(d){ G = d; renderGestao(); toast('Tarefa duplicada.'); })
    .catch(function(){ toast('Não deu para duplicar.'); });
}

function tfApagar(t){
  var subs = (G.tasks || []).filter(function(x){ return x.parent_id === t.id; }).length;
  if (!window.confirm('Apagar «' + t.title + '»' + (subs ? ' e as ' + subs + ' subtarefas' : '') + '? Não dá para desfazer.')) return;
  apiGestao('/api/gestao/tarefas/' + t.id, { method: 'DELETE' })
    .then(function(d){ G = d; tfFecharDetalhe(); renderGestao(); toast('Tarefa apagada.'); })
    .catch(function(){ toast('Não deu para apagar.'); });
}

/* ------------------------------------------------------------------ *
 * janelinhas: menu e datas
 * ------------------------------------------------------------------ */

function tfFecharPop(){ document.querySelectorAll('.tf-pop, .tf-menu').forEach(function(p){ p.remove(); }); }

function tfPosicionar(p, ancora){
  document.body.appendChild(p);
  var r = ancora.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
  var x = Math.min(r.left, window.innerWidth - w - 12), y = r.bottom + 6;
  if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 6);
  p.style.left = Math.max(12, x) + 'px'; p.style.top = y + 'px';
}

function tfMenu(ancora, ops){
  tfFecharPop();
  var m = el('div', 'tf-menu');
  ops.forEach(function(o){
    var b = el('button', o[2] || '', o[0]); b.type = 'button';
    b.addEventListener('click', function(){ tfFecharPop(); o[1](); });
    m.appendChild(b);
  });
  tfPosicionar(m, ancora);
}

function tfLerRegra(txt){
  var r = {};
  String(txt || '').split(';').forEach(function(p){ var kv = p.split('='); if (kv[0]) r[kv[0]] = kv[1]; });
  return r;
}

function tfPopData(t, ancora){
  tfFecharPop();
  var p = el('div', 'tf-pop');
  var st = { due_on: t.due_on || '', due_time: t.due_time || '', starts_on: t.starts_on || '',
             rule: t.repeat_rule || '', from: t.repeat_from || 'prazo', until: t.repeat_until || '',
             reminders: (t.reminders || []).map(function(r){ return r.min; }) };

  var rap = el('div', 'tf-rapidos');
  [['Hoje', 0], ['Amanhã', 1], ['+7 dias', 7], ['Sem data', null]].forEach(function(o){
    var b = el('button', null, o[0]); b.type = 'button';
    b.addEventListener('click', function(){
      if (o[1] === null){ iD.value = ''; iH.value = ''; } else iD.value = tfISO(tfMais(tfHoje(), o[1]));
    });
    rap.appendChild(b);
  });
  p.appendChild(rap);

  p.appendChild(el('label', null, tfTipo(t) === 'nota' ? 'Rever em' : (tfTipo(t) === 'lembrete' ? 'Aparece a' : 'Prazo')));
  var l1 = el('div', 'tf-linha');
  var iD = el('input'); iD.type = 'date'; iD.value = st.due_on;
  var iH = el('input'); iH.type = 'time'; iH.value = st.due_time; iH.style.maxWidth = '110px';
  l1.appendChild(iD); l1.appendChild(iH);
  p.appendChild(l1);

  p.appendChild(el('label', null, 'Começa (opcional)'));
  var iI = el('input'); iI.type = 'date'; iI.value = st.starts_on;
  p.appendChild(iI);

  // repeticao
  p.appendChild(el('label', null, 'Repete'));
  var r0 = tfLerRegra(st.rule);
  var sR = el('select');
  [['', 'Não repete'], ['DAILY', 'Todos os dias'], ['UTEIS', 'Dias úteis'], ['WEEKLY', 'Semanal'], ['MONTHLY', 'Mensal'], ['YEARLY', 'Anual']]
    .forEach(function(o){ sR.appendChild(new Option(o[1], o[0])); });
  var ehUteis = r0.FREQ === 'WEEKLY' && r0.BYDAY === 'MO,TU,WE,TH,FR';
  sR.value = ehUteis ? 'UTEIS' : (r0.FREQ || '');
  p.appendChild(sR);
  var opR = el('div'); p.appendChild(opR);
  var dias = (r0.BYDAY || '').split(',').filter(Boolean);
  var iInt, iMes, sFrom, iAte;
  function desenharRep(){
    clear(opR);
    var f = sR.value;
    if (!f) return;
    if (f !== 'UTEIS'){
      opR.appendChild(el('label', null, 'A cada'));
      var li = el('div', 'tf-linha');
      iInt = el('input'); iInt.type = 'number'; iInt.min = '1'; iInt.value = r0.INTERVAL || '1'; iInt.style.maxWidth = '70px';
      li.appendChild(iInt);
      li.appendChild(el('span', null, { DAILY: 'dia(s)', WEEKLY: 'semana(s)', MONTHLY: 'mês(es)', YEARLY: 'ano(s)' }[f]));
      opR.appendChild(li);
    }
    if (f === 'WEEKLY'){
      opR.appendChild(el('label', null, 'Nos dias'));
      var bd = el('div', 'tf-dias');
      ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].forEach(function(c, k){
        var b = el('button', dias.indexOf(c) >= 0 ? 'on' : '', ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'][k]); b.type = 'button';
        b.title = TF_DIAS_SEM[TF_RRULE_DIAS.indexOf(c)];
        b.addEventListener('click', function(){
          if (dias.indexOf(c) >= 0) dias = dias.filter(function(x){ return x !== c; }); else dias.push(c);
          b.classList.toggle('on');
        });
        bd.appendChild(b);
      });
      opR.appendChild(bd);
    }
    if (f === 'MONTHLY'){
      opR.appendChild(el('label', null, 'Dia do mês (vazio = o do prazo)'));
      iMes = el('input'); iMes.type = 'number'; iMes.min = '1'; iMes.max = '31'; iMes.value = r0.BYMONTHDAY || '';
      opR.appendChild(iMes);
    }
    opR.appendChild(el('label', null, 'A próxima conta a partir'));
    sFrom = el('select');
    sFrom.appendChild(new Option('do prazo', 'prazo')); sFrom.appendChild(new Option('do dia em que se conclui', 'conclusao'));
    sFrom.value = st.from;
    opR.appendChild(sFrom);
    opR.appendChild(el('label', null, 'Termina (opcional)'));
    iAte = el('input'); iAte.type = 'date'; iAte.value = st.until;
    opR.appendChild(iAte);
  }
  sR.addEventListener('change', desenharRep);
  desenharRep();

  // lembretes
  p.appendChild(el('label', null, 'Lembretes'));
  var lbox = el('div', 'tf-chips');
  var OPS_H = [[0, 'Na hora'], [-15, '15 min antes'], [-60, '1 hora antes'], [-1440, '1 dia antes']];
  var OPS_D = [[540, 'No dia, 9:00'], [-900, 'Na véspera, 9:00'], [-2340, '2 dias antes, 9:00'], [-9540, '1 semana antes, 9:00']];
  function desenharLemb(){
    clear(lbox);
    (iH.value ? OPS_H : OPS_D).forEach(function(o){
      var b = el('button', 'chip'); b.type = 'button';
      b.setAttribute('aria-pressed', st.reminders.indexOf(o[0]) >= 0 ? 'true' : 'false');
      b.textContent = o[1];
      b.addEventListener('click', function(){
        if (st.reminders.indexOf(o[0]) >= 0) st.reminders = st.reminders.filter(function(x){ return x !== o[0]; });
        else st.reminders.push(o[0]);
        desenharLemb();
      });
      lbox.appendChild(b);
    });
    st.reminders.forEach(function(m){
      if ((iH.value ? OPS_H : OPS_D).some(function(o){ return o[0] === m; })) return;
      var b = el('button', 'chip', tfLembreteTxt(m, !iH.value)); b.type = 'button'; b.setAttribute('aria-pressed', 'true');
      b.addEventListener('click', function(){ st.reminders = st.reminders.filter(function(x){ return x !== m; }); desenharLemb(); });
      lbox.appendChild(b);
    });
  }
  iH.addEventListener('change', desenharLemb);
  desenharLemb();
  p.appendChild(lbox);

  var ac = el('div', 'tf-acoes');
  var bC = el('button', 'btn small', 'Cancelar'); bC.type = 'button'; bC.addEventListener('click', tfFecharPop);
  var bOk = el('button', 'btn small primary', 'Guardar'); bOk.type = 'button';
  bOk.addEventListener('click', function(){
    var f = sR.value, regra = null;
    if (f === 'UTEIS') regra = 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    else if (f){
      regra = 'FREQ=' + f;
      if (iInt && Number(iInt.value) > 1) regra += ';INTERVAL=' + Number(iInt.value);
      if (f === 'WEEKLY' && dias.length) regra += ';BYDAY=' + dias.join(',');
      if (f === 'MONTHLY' && iMes && iMes.value) regra += ';BYMONTHDAY=' + Number(iMes.value);
    }
    if (regra && !iD.value){ toast('Uma rotina precisa de uma data.'); return; }
    tfFecharPop();
    tfGravar(t.id, {
      due_on: iD.value || null, due_time: iD.value ? (iH.value || null) : null, starts_on: iI.value || null,
      repeat_rule: regra, repeat_from: sFrom ? sFrom.value : 'prazo', repeat_until: regra && iAte ? (iAte.value || null) : null,
      reminders: iD.value ? st.reminders.map(function(m){ return { min: m }; }) : []
    });
  });
  ac.appendChild(bC); ac.appendChild(bOk);
  p.appendChild(ac);
  tfPosicionar(p, ancora);
}

/* ------------------------------------------------------------------ *
 * pagar
 * ------------------------------------------------------------------ */

function tfEscolherDoc(rotulo, escolhidos){
  var box = el('div');
  box.appendChild(el('label', null, rotulo));
  var s = el('select');
  s.appendChild(new Option('— nenhum —', ''));
  ((window.D && D.documents) || []).forEach(function(doc){
    var dono = pessoa(doc.person_id);
    s.appendChild(new Option(doc.name + (dono ? ' (' + dono.name + ')' : ''), doc.id));
  });
  if (escolhidos && escolhidos.length) s.value = escolhidos[0];
  box.appendChild(s);
  box.valor = function(){ return s.value ? Number(s.value) : null; };
  return box;
}

function tfPopPagar(t, ancora){
  tfFecharPop();
  var p = el('div', 'tf-pop');
  p.style.width = '330px';

  p.appendChild(el('label', null, 'Pago a'));
  var iD = el('input'); iD.type = 'date'; iD.value = t.paid_on || tfISO(tfHoje());
  p.appendChild(iD);

  p.appendChild(el('label', null, 'Valor'));
  var linha = el('div', 'tf-linha');
  var iV = el('input'); iV.type = 'text';
  iV.value = (t.paid_amount != null ? t.paid_amount : (t.amount != null ? t.amount : '')).toString().replace('.', ',');
  iV.placeholder = '0,00';
  var sM = el('select');
  sM.appendChild(new Option('— método —', ''));
  TF_METODOS.forEach(function(m){ sM.appendChild(new Option(m, m)); });
  if (t.payment_method) sM.value = t.payment_method;
  linha.appendChild(iV); linha.appendChild(sM);
  p.appendChild(linha);

  var comp = tfEscolherDoc('Comprovativo de pagamento', tfPapel(t, 'comprovativo'));
  var rec = tfEscolherDoc('Recibo ou fatura', tfPapel(t, 'recibo').concat(tfPapel(t, 'fatura')));
  p.appendChild(comp); p.appendChild(rec);
  var ajuda = el('div', null, 'Sem eles o pagamento fica pago na mesma, marcado como «falta comprovativo». Os ficheiros que chegam pela Caixa de entrada aparecem aqui depois de catalogados.');
  ajuda.style.cssText = 'font-size:.7rem;color:var(--muted);margin-top:6px;line-height:1.45';
  p.appendChild(ajuda);

  var lin2 = el('label');
  lin2.style.cssText = 'display:flex;gap:7px;align-items:center;margin-top:10px;color:var(--ink-2);font-size:.78rem';
  var cx = el('input'); cx.type = 'checkbox'; cx.checked = !t.expense_id;
  cx.style.cssText = 'width:15px;height:15px;accent-color:var(--accent)';
  lin2.appendChild(cx);
  lin2.appendChild(document.createTextNode(t.expense_id ? 'Registar outra despesa nas Finanças' : 'Registar a despesa nas Finanças'));
  p.appendChild(lin2);

  var ac = el('div', 'tf-acoes');
  var bC = el('button', 'btn small', 'Cancelar'); bC.type = 'button'; bC.addEventListener('click', tfFecharPop);
  var bOk = el('button', 'btn small primary', 'Dar por pago'); bOk.type = 'button';
  bOk.addEventListener('click', function(){
    var docs = [];
    if (comp.valor()) docs.push({ id: comp.valor(), papel: 'comprovativo' });
    if (rec.valor()) docs.push({ id: rec.valor(), papel: 'recibo' });
    var rotina = Boolean(t.repeat_rule);
    tfFecharPop();
    apiGestao('/api/tarefas/' + t.id + '/pagar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paid_on: iD.value || null, paid_amount: iV.value || null,
        payment_method: sM.value || null, criar_despesa: cx.checked, documentos: docs
      })
    }).then(function(d){
      G = d;
      renderGestao();
      var n = tfPorId(t.id);
      var falta = !docs.length ? ' Falta o comprovativo.' : '';
      toast(rotina && n && !tfFechada(n)
        ? 'Pago. Próximo: ' + tfDataTxt(n.due_on) + '.' + falta
        : 'Pagamento registado.' + falta);
    }).catch(function(e){ toast(e.message || 'Não deu para registar o pagamento.'); });
  });
  ac.appendChild(bC); ac.appendChild(bOk);
  p.appendChild(ac);
  tfPosicionar(p, ancora);
}

/* ------------------------------------------------------------------ *
 * lembretes no browser, enquanto o Farol estiver aberto
 * ------------------------------------------------------------------ */

function tfAvisos(){
  if (!('Notification' in window)) return;
  setInterval(tfVerAvisos, 60000);
  setTimeout(tfVerAvisos, 5000);
}
function tfVerAvisos(){
  if (Notification.permission !== 'granted') return;
  var agora = Date.now();
  var dados;
  try { dados = JSON.parse(localStorage.getItem('tfAvisados') || '{}'); } catch (e){ dados = {}; }
  tfAbertas().forEach(function(t){
    if (!t.due_on || !(t.reminders || []).length) return;
    var d = parseDay(t.due_on);
    if (t.due_time){ var hm = t.due_time.split(':'); d.setHours(+hm[0], +hm[1]); }
    t.reminders.forEach(function(r){
      var quando = d.getTime() + r.min * 60000;
      var chave = t.id + '|' + t.due_on + '|' + r.min;
      if (quando <= agora && agora - quando < 6 * 3600000 && !dados[chave]){
        dados[chave] = agora;
        try { new Notification(t.title, { body: tfDataTxt(t.due_on, t.due_time), tag: chave }); } catch (e){}
      }
    });
  });
  try { localStorage.setItem('tfAvisados', JSON.stringify(dados)); } catch (e){}
}
function tfPedirAvisos(){
  if (!('Notification' in window)) return toast('Este browser não mostra avisos.');
  Notification.requestPermission().then(function(p){
    toast(p === 'granted' ? 'Avisos ligados: os lembretes aparecem enquanto o Farol estiver aberto.' : 'Avisos desligados.');
    tfRenderSide();
  });
}

var _tfSideOrig = tfRenderSide;
tfRenderSide = function(){
  _tfSideOrig();
  if ('Notification' in window && Notification.permission === 'default'){
    var b = el('button', null); b.type = 'button';
    b.appendChild(tfIcone('sino')); b.appendChild(document.createTextNode('Ligar avisos'));
    b.style.marginTop = '10px';
    b.addEventListener('click', tfPedirAvisos);
    $('tfSide').appendChild(b);
  }
};

if (window.G && G.tasks && G.tasks.length) tfRender();
