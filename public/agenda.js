'use strict';
/* Farol — a Agenda (4 out 2026).
 *
 * O calendario de toda a familia, visto como se quiser: dia, 3 dias, semana,
 * semana util, mes, trimestre, ano e lista. Junta o que ja esta na base:
 *   - os eventos do Farol e os que vem do Google de cada pessoa (D.events);
 *   - o tempo «ocupado» dos calendarios que so contam como ocupado (o do
 *     trabalho): ve-se que a hora esta tomada, nao o que e;
 *   - as tarefas, pagamentos e lembretes com data (G.tasks);
 *   - os aniversarios, que o servidor tira das datas de nascimento.
 *
 * Os filtros (pessoas, areas, o que mostrar) valem para todas as vistas e
 * ficam guardados no browser. A cor e a da pessoa; pode passar a ser a da
 * area. Nada aqui inventa dados: um dia vazio diz que esta vazio.
 *
 * Como os outros modulos, reaproveita os globais ($, el, clear, toast,
 * apiGestao, D, G, evJanela, avAbrir, tfGravar, tfFechar, tfPopPagar).
 */

var AG = {
  view: 'semana', cur: null, sel: null, item: null, range: null, mini: null,
  cor: 'pessoa', semPessoas: {}, semAreas: {}, semTipos: {}, q: '', porPessoa: false,
  google: {}, montado: false, H: 44
};
(function(){
  try {
    var s = JSON.parse(localStorage.getItem('agEstado') || 'null');
    if (s){
      ['view', 'cor', 'semPessoas', 'semAreas', 'semTipos', 'porPessoa'].forEach(function(k){
        if (s[k] !== undefined) AG[k] = s[k];
      });
    }
  } catch (e) {}
})();
function agGuardar(){
  try {
    localStorage.setItem('agEstado', JSON.stringify({ view: AG.view, cor: AG.cor, semPessoas: AG.semPessoas,
      semAreas: AG.semAreas, semTipos: AG.semTipos, porPessoa: AG.porPessoa }));
  } catch (e) {}
}

var AG_VISTAS = [['dia', 'Dia', 'D'], ['3d', '3 dias', '3'], ['semana', 'Semana', 'S'], ['util', 'Semana útil', 'U'],
  ['mes', 'Mês', 'M'], ['trim', 'Trimestre', 'T'], ['ano', 'Ano', 'A'], ['lista', 'Lista', 'L']];
var AG_TIPOS = [['evento', 'Eventos'], ['ocupado', 'Trabalho (só «ocupado»)'], ['tarefa', 'Tarefas com data'],
  ['pagamento', 'Pagamentos'], ['lembrete', 'Lembretes'], ['aniversario', 'Aniversários']];
var AG_MS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
var AG_DS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
var AG_DW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

var AG_CSS = [
  '#view-agenda .ag{display:grid;grid-template-columns:220px minmax(0,1fr) 300px;gap:14px;align-items:start}',
  '#view-agenda .ag-side{display:flex;flex-direction:column;gap:8px;position:sticky;top:12px}',
  '#view-agenda .ag-sec{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:11px 12px}',
  '#view-agenda .ag-sec h4{margin:0 0 7px;font-family:var(--mono);font-weight:500;font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted);display:flex;justify-content:space-between;align-items:center}',
  '#view-agenda .ag-sec h4 button{border:0;background:none;color:var(--accent-ink);font:inherit;font-family:var(--sans);font-size:.75rem;letter-spacing:0;text-transform:none;padding:0;cursor:pointer}',
  '.ag-mh{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}',
  '.ag-mh b{font-family:var(--serif);font-weight:500;font-size:1rem}',
  '.ag-mh button{border:0;background:none;color:var(--muted);font-size:1rem;padding:2px 6px;cursor:pointer}',
  '.ag-mini{display:grid;grid-template-columns:repeat(7,1fr);gap:1px;text-align:center;font-family:var(--mono);font-size:.6875rem}',
  '.ag-mini span{color:var(--faint);padding:2px 0}',
  '.ag-mini button{border:0;background:none;border-radius:6px;padding:4px 0;position:relative;color:var(--ink);cursor:pointer}',
  '.ag-mini button.fora{color:var(--faint)}',
  '.ag-mini button.vis{background:var(--accent-soft)}',
  '.ag-mini button.hoje{color:var(--accent-ink);font-weight:600}',
  '.ag-mini button.sel{background:var(--accent);color:#fff}',
  '.ag-mini button.tem::after{content:"";position:absolute;left:50%;bottom:1px;width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.55;transform:translateX(-50%)}',
  '.ag-chips{display:flex;flex-wrap:wrap;gap:5px}',
  '.ag-chips button{border:1px solid var(--line);background:var(--surface-2);border-radius:99px;padding:3px 9px;font:inherit;font-size:.75rem;color:var(--ink-2);cursor:pointer}',
  '.ag-chips button:hover{border-color:var(--accent)}',
  '.ag-int{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:8px}',
  '.ag-int input{min-width:0;border:1px solid var(--line);border-radius:6px;padding:4px 5px;background:var(--surface-2);color:var(--ink);font:inherit;font-size:.75rem}',
  '.ag-int button{grid-column:1/-1}',
  '.ag-row{display:flex;align-items:center;gap:8px;padding:4px 3px;border-radius:7px;font-size:.8125rem;cursor:pointer}',
  '.ag-row:hover{background:var(--surface-2)}',
  '.ag-row input{margin:0;accent-color:var(--accent)}',
  '.ag-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.ag-row .st{font-family:var(--mono);font-size:.625rem;color:var(--faint);white-space:nowrap}',
  '.ag-row .st.mau{color:var(--bad)}',
  '.ag-row .st.liga{color:var(--accent-ink);border:0;background:none;padding:0;cursor:pointer;font-family:var(--mono)}',
  '.ag-sw{width:10px;height:10px;border-radius:3px;background:var(--c);flex:none}',
  '.ag-av{width:20px;height:20px;border-radius:50%;background:var(--c);color:#fff;font-size:.56rem;font-weight:600;display:inline-flex;align-items:center;justify-content:center;flex:none}',
  '.ag-avs{display:inline-flex}.ag-avs .ag-av{width:17px;height:17px;border:2px solid var(--surface);margin-left:-5px}.ag-avs .ag-av:first-child{margin-left:0}',
  '.ag-bandeja{display:flex;flex-direction:column;gap:5px;max-height:240px;overflow:auto}',
  '.ag-tr{display:flex;gap:7px;align-items:flex-start;border:1px dashed var(--line);border-radius:7px;padding:5px 7px;font-size:.8125rem;cursor:grab;background:var(--surface-2)}',
  '.ag-tr .ag-sw{margin-top:4px}',
  '.ag-dica{color:var(--muted);font-size:.75rem;margin:6px 0 0}',
  '#view-agenda .ag-main{padding:0;min-width:0;overflow:hidden;position:relative}',
  '.ag-tb{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:10px 12px;border-bottom:1px solid var(--line)}',
  '.ag-nav{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}',
  '.ag-nav button{border:0;background:var(--surface);padding:5px 10px;font:inherit;font-size:.8125rem;color:var(--ink);cursor:pointer}',
  '.ag-nav button+button{border-left:1px solid var(--line)}',
  '.ag-nav button:hover{background:var(--surface-2)}',
  '.ag-per{border:0;background:none;display:flex;align-items:baseline;gap:7px;padding:3px 6px;border-radius:8px;cursor:pointer;color:var(--ink)}',
  '.ag-per:hover{background:var(--surface-2)}',
  '.ag-per b{font-family:var(--serif);font-size:1.25rem;font-weight:500}',
  '.ag-per .wk{font-family:var(--mono);font-size:.625rem;color:var(--muted);border:1px solid var(--line);border-radius:4px;padding:1px 5px}',
  '.ag-esp{flex:1}',
  '.ag-seg{display:inline-flex;flex-wrap:wrap;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:2px}',
  '.ag-seg button{border:0;background:none;padding:4px 9px;border-radius:6px;font:inherit;font-size:.78rem;color:var(--muted);cursor:pointer}',
  '.ag-seg button.on{background:var(--surface);color:var(--ink);font-weight:500;box-shadow:var(--shadow)}',
  '.ag-tb2{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line-soft);background:var(--surface-2)}',
  '.ag-q{display:flex;align-items:center;gap:6px;border:1px solid var(--line);border-radius:8px;padding:4px 9px;background:var(--surface);min-width:150px;flex:1;max-width:280px}',
  '.ag-q input{border:0;outline:0;background:transparent;width:100%;font:inherit;font-size:.8125rem;color:var(--ink)}',
  '.ag-sync{font-size:.75rem;color:var(--muted);display:flex;align-items:center;gap:6px}',
  '.ag-sync i{width:7px;height:7px;border-radius:50%;background:var(--good)}',
  '.ag-sync.mau i{background:var(--bad)}',
  '.ag-sync.lendo i{background:var(--warn)}',
  '.ag-pop{position:absolute;z-index:20;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 30px rgba(15,23,32,.18);padding:12px;width:280px}',
  '.ag-pop .yr{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}',
  '.ag-pop .yr b{font-family:var(--serif);font-size:1.1rem;font-weight:500}',
  '.ag-pop .yr button{border:0;background:none;font-size:1.1rem;padding:2px 8px;cursor:pointer;color:var(--ink)}',
  '.ag-pop .ms{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}',
  '.ag-pop .ms button,.ag-pop .qs button{border:1px solid var(--line);background:var(--surface-2);border-radius:6px;padding:6px 0;font:inherit;font-size:.75rem;color:var(--ink);cursor:pointer}',
  '.ag-pop .ms button.on{background:var(--accent);color:#fff;border-color:var(--accent)}',
  '.ag-pop .qs{display:flex;gap:4px;margin-top:8px}.ag-pop .qs button{flex:1}',
  /* grelha de horas */
  '.ag-x{overflow-x:auto}',
  '.ag-tg{min-width:calc(52px + var(--n) * var(--minw))}',
  '.ag-r{display:grid;grid-template-columns:52px repeat(var(--n),minmax(0,1fr))}',
  '.ag-hd{border-bottom:1px solid var(--line);background:var(--surface)}',
  '.ag-hd .h{padding:7px 7px 5px;border-left:1px solid var(--line-soft);display:flex;align-items:center;gap:6px;cursor:pointer;min-width:0}',
  '.ag-hd .h:hover{background:var(--surface-2)}',
  '.ag-hd .dw{font-family:var(--mono);font-size:.625rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}',
  '.ag-hd .dn{font-family:var(--serif);font-size:1.25rem;line-height:1}',
  '.ag-hd .h.hoje .dn{background:var(--accent);color:#fff;border-radius:50%;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-size:1rem}',
  '.ag-hd .h.fds,.ag-col.fds{background-color:var(--surface-2)}',
  '.ag-hd .cnt{margin-left:auto;font-family:var(--mono);font-size:.625rem;color:var(--faint)}',
  '.ag-hd .gut,.ag-ad .gut{font-family:var(--mono);font-size:.5625rem;color:var(--faint);padding:6px 5px;text-align:right}',
  '.ag-ad{border-bottom:1px solid var(--line)}',
  '.ag-ad .c{border-left:1px solid var(--line-soft);padding:3px;display:flex;flex-direction:column;gap:2px;min-height:24px;min-width:0}',
  '.ag-ad .c.alvo,.ag-col.alvo,.ag-mc.alvo{background:var(--accent-soft)}',
  '.ag-sc{max-height:min(640px,calc(100vh - 260px));overflow-y:auto;position:relative}',
  '.ag-hrs div{height:var(--H);font-family:var(--mono);font-size:.5625rem;color:var(--faint);text-align:right;padding-right:5px;transform:translateY(-6px)}',
  '.ag-col{position:relative;border-left:1px solid var(--line-soft);background-image:linear-gradient(var(--line-soft) 1px,transparent 1px);background-size:100% var(--H);height:calc(24 * var(--H));cursor:copy}',
  '.ag-agora{position:absolute;left:0;right:0;height:2px;background:var(--bad);z-index:3;pointer-events:none}',
  '.ag-agora::before{content:"";position:absolute;left:-4px;top:-3px;width:8px;height:8px;border-radius:50%;background:var(--bad)}',
  '.ag-ev{--c:var(--accent);display:block;width:100%;text-align:left;border:0;border-left:3px solid var(--c);background:color-mix(in srgb,var(--c) 15%,var(--surface));border-radius:4px;padding:2px 5px;font:inherit;font-size:.72rem;line-height:1.3;color:var(--ink);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;min-width:0;cursor:pointer}',
  '.ag-ev:hover{background:color-mix(in srgb,var(--c) 26%,var(--surface))}',
  '.ag-ev.sel{outline:2px solid var(--c);outline-offset:1px}',
  '.ag-ev .tm{font-family:var(--mono);font-size:.625rem;color:var(--muted);margin-right:3px}',
  '.ag-ev.k-tarefa,.ag-ev.k-lembrete{border-left-style:dashed}',
  '.ag-ev.k-tarefa .g::before{content:"☐ "}',
  '.ag-ev.k-pagamento .g::before{content:"€ ";font-weight:600}',
  '.ag-ev.k-aniversario .g::before,.ag-ev.k-lembrete .g::before{content:"✻ "}',
  '.ag-ev.feito{text-decoration:line-through;opacity:.55}',
  '.ag-ev.prov{border-left-style:dotted}',
  '.ag-bl{position:absolute;white-space:normal;padding:2px 5px;display:flex;flex-direction:column;z-index:1;box-shadow:0 0 0 1px var(--surface)}',
  '.ag-bl .tt{font-weight:500;overflow:hidden;text-overflow:ellipsis}',
  '.ag-bl .mt{font-size:.66rem;color:var(--muted);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}',
  '.ag-bl.curto .mt{display:none}',
  '.ag-bl.k-ocupado{background:repeating-linear-gradient(135deg,var(--surface-2) 0 6px,transparent 6px 12px);border-left-color:var(--faint);color:var(--muted);z-index:0}',
  /* mes */
  '.ag-mg{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;padding:10px 12px 12px}',
  '.ag-mg .wd{font-family:var(--mono);font-size:.625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);text-align:center;padding:3px 0}',
  '.ag-mc{border:1px solid var(--line-soft);background:var(--surface-2);border-radius:8px;min-height:98px;padding:4px;display:flex;flex-direction:column;gap:2px;min-width:0;cursor:pointer}',
  '.ag-mc.fora{opacity:.5}',
  '.ag-mc.sel{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}',
  '.ag-mc .n{display:flex;justify-content:space-between;font-family:var(--mono);font-size:.6875rem;color:var(--muted)}',
  '.ag-mc .n b{font-weight:500;color:var(--ink)}',
  '.ag-mc.hoje .n b{background:var(--accent);color:#fff;border-radius:99px;padding:0 6px}',
  '.ag-mc .mais{border:0;background:none;color:var(--accent-ink);font:inherit;font-size:.6875rem;text-align:left;padding:0 3px;cursor:pointer}',
  /* trimestre e ano */
  '.ag-qg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:12px}',
  '.ag-yg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:12px}',
  '.ag-qm{border:1px solid var(--line-soft);border-radius:10px;padding:9px;min-width:0;background:var(--surface-2)}',
  '.ag-qm h5{font-family:var(--serif);font-weight:500;font-size:1.05rem;margin:0 0 5px;cursor:pointer}',
  '.ag-yg .ag-qm h5{font-size:.95rem}',
  '.ag-qd{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-family:var(--mono);font-size:.6875rem;text-align:center}',
  '.ag-qd span{color:var(--faint);font-size:.5625rem}',
  '.ag-qd button{border:0;border-radius:5px;padding:4px 0 6px;background:transparent;position:relative;color:var(--ink);font:inherit;cursor:pointer}',
  '.ag-yg .ag-qd button{padding:3px 0;font-size:.625rem}',
  '.ag-qd button.hoje{color:var(--accent-ink);font-weight:600;box-shadow:inset 0 0 0 1px var(--accent)}',
  '.ag-qd button.sel{background:var(--accent);color:#fff}',
  '.ag-qd .dots{position:absolute;left:0;right:0;bottom:1px;display:flex;justify-content:center;gap:1px}',
  '.ag-qd .dots i{width:4px;height:4px;border-radius:50%;background:var(--c)}',
  '.ag-ql{margin-top:9px;display:flex;flex-direction:column;gap:1px;border-top:1px solid var(--line);padding-top:7px}',
  '.ag-ql button{display:flex;gap:7px;align-items:center;border:0;background:none;text-align:left;padding:3px 2px;border-radius:6px;min-width:0;font:inherit;color:var(--ink);cursor:pointer}',
  '.ag-ql button:hover{background:var(--surface)}',
  '.ag-ql .dd{font-family:var(--mono);font-size:.625rem;color:var(--muted);width:42px;flex:none}',
  '.ag-ql .tx{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:.8125rem}',
  '.ag-leg{display:flex;align-items:center;gap:6px;padding:0 12px 12px;color:var(--muted);font-size:.75rem;flex-wrap:wrap}',
  '.ag-leg i{width:13px;height:13px;border-radius:3px;display:inline-block}',
  /* lista */
  '.ag-ls{padding:4px 14px 14px}',
  '.ag-ls .dia{display:grid;grid-template-columns:88px minmax(0,1fr);gap:10px;padding:9px 0;border-bottom:1px solid var(--line-soft)}',
  '.ag-ls .dl{font-family:var(--mono);font-size:.6875rem;color:var(--muted);padding-top:2px}',
  '.ag-ls .dl b{display:block;font-family:var(--serif);font-size:1.4rem;font-weight:500;color:var(--ink);line-height:1}',
  '.ag-ls .dl .hj{color:var(--accent-ink)}',
  '.ag-li{display:grid;grid-template-columns:86px 10px minmax(0,1fr) auto;gap:9px;align-items:center;border:0;background:none;text-align:left;padding:4px 5px;border-radius:7px;width:100%;font:inherit;color:var(--ink);cursor:pointer}',
  '.ag-li:hover,.ag-li.sel{background:var(--surface-2)}',
  '.ag-li .tm{font-family:var(--mono);font-size:.6875rem;color:var(--muted)}',
  '.ag-li .tt{min-width:0}',
  '.ag-li .tt b{font-weight:500;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8125rem}',
  '.ag-li .tt small{color:var(--muted);font-size:.72rem;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.ag-li .src{font-family:var(--mono);font-size:.5625rem;color:var(--faint);text-align:right;white-space:nowrap}',
  '.ag-li.feito b{text-decoration:line-through;opacity:.6}',
  '.ag-vazio{padding:36px 16px;text-align:center;color:var(--muted)}',
  /* painel da direita */
  /* 5 out: o calendario pequeno e o periodo passaram para a direita, por
     cima do dia; a esquerda fica so com os filtros. */
  '#view-agenda .ag-dir{display:flex;flex-direction:column;gap:8px;position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto;min-width:0}',
  '#view-agenda .ag-dir .ag-sec{flex:none}',
  '#view-agenda .ag-det{display:flex;flex-direction:column;gap:13px;flex:none}',
  '.ag-det h3{font-family:var(--serif);font-weight:500;font-size:1.2rem;margin:0;line-height:1.25}',
  '.ag-dh{display:flex;justify-content:space-between;align-items:baseline;gap:8px}',
  '.ag-k{font-family:var(--mono);font-size:.625rem;letter-spacing:.06em;color:var(--muted);text-transform:uppercase;white-space:nowrap}',
  '.ag-dl{display:grid;grid-template-columns:78px minmax(0,1fr);gap:7px 10px;font-size:.8125rem;margin:0}',
  '.ag-dl dt{color:var(--muted);font-family:var(--mono);font-size:.625rem;padding-top:2px;text-transform:uppercase;letter-spacing:.05em}',
  '.ag-dl dd{margin:0;min-width:0;overflow-wrap:anywhere}',
  '.ag-dl dd a{color:var(--accent-ink)}',
  '.ag-pp{display:flex;flex-wrap:wrap;gap:6px}.ag-pp span{display:inline-flex;align-items:center;gap:5px}',
  '.ag-acoes{display:flex;flex-wrap:wrap;gap:6px}',
  '.ag-nota{font-size:.75rem;color:var(--muted);background:var(--surface-2);border-radius:8px;padding:8px 10px;margin:0}',
  '.ag-voltar{border:0;background:none;color:var(--accent-ink);padding:0;font:inherit;font-size:.8125rem;text-align:left;cursor:pointer}',
  '.ag-dia{display:flex;flex-direction:column;gap:1px}',
  '.ag-dia .ag-li{grid-template-columns:44px 10px minmax(0,1fr)}',
  '.ag-livre{display:flex;flex-direction:column;gap:5px}',
  '.ag-livre .fr{display:grid;grid-template-columns:70px minmax(0,1fr);gap:8px;align-items:center;font-size:.75rem}',
  '.ag-livre .bar{position:relative;height:11px;background:var(--surface-2);border-radius:3px;border:1px solid var(--line-soft)}',
  '.ag-livre .bar i{position:absolute;top:0;bottom:0;background:var(--c);border-radius:2px;opacity:.85}',
  '.ag-livre .ax{display:flex;justify-content:space-between;font-family:var(--mono);font-size:.5625rem;color:var(--faint);margin-left:78px}',
  '.ag-so-estreito{display:none}',
  '@media (max-width:1400px){#view-agenda .ag{grid-template-columns:210px minmax(0,1fr)}#view-agenda .ag-dir{grid-column:1/-1;position:static;max-height:none;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));align-items:start}}',
  '@media (max-width:860px){#view-agenda .ag{grid-template-columns:minmax(0,1fr)}#view-agenda .ag-side{position:static;display:none}#view-agenda .ag-side.aberto{display:flex}.ag-so-estreito{display:inline-block}.ag-qg{grid-template-columns:minmax(0,1fr)}.ag-yg{grid-template-columns:repeat(2,minmax(0,1fr))}.ag-mc{min-height:66px}.ag-mc .ag-ev .tm{display:none}.ag-ls .dia{grid-template-columns:minmax(0,1fr)}.ag-li{grid-template-columns:64px 10px minmax(0,1fr)}.ag-li .src{display:none}}'
].join('\n');

/* ---------------- datas ---------------- */
function agPad(n){ return String(n).padStart(2, '0'); }
function agKey(d){ return d.getFullYear() + '-' + agPad(d.getMonth() + 1) + '-' + agPad(d.getDate()); }
function agDia(k){ var a = k.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
function agMais(d, n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function agSeg(d){ return agMais(d, -((d.getDay() + 6) % 7)); }
function agMin(h){ return h && /^\d{1,2}:\d{2}/.test(h) ? Number(h.split(':')[0]) * 60 + Number(h.split(':')[1].slice(0, 2)) : null; }
function agHora(m){ m = Math.max(0, Math.min(m, 1439)); return agPad(Math.floor(m / 60)) + ':' + agPad(m % 60); }
function agSemana(d){
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n);
  var y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y) / 864e5 + 1) / 7);
}
function agHoje(){ var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function agEsc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function agDataTxt(d){ return AG_DW[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()]; }

/* ---------------- dados ---------------- */
function agPessoas(){ return ((window.D && D.people) || []).slice(); }
function agPessoa(id){ return agPessoas().filter(function(p){ return p.id === id; })[0] || null; }
function agContextos(){ return (window.G && G.contextos) || []; }
function agAreas(){ return agContextos().filter(function(c){ return !c.parent_id && c.active !== false; }); }
function agCtx(id){ return agContextos().filter(function(c){ return c.id === id; })[0] || null; }
function agTopo(id){
  var c = agCtx(id);
  if (!c) return 0;
  return c.parent_id || c.id;
}
var AG_PALETA = ['var(--c1)', 'var(--c2)', 'var(--c4)', 'var(--c5)', 'var(--c3)'];
function agCorArea(id){
  var c = agCtx(id);
  if (c && c.color) return c.color;
  var i = agAreas().map(function(a){ return a.id; }).indexOf(id);
  return i >= 0 ? AG_PALETA[i % AG_PALETA.length] : 'var(--c3)';
}
function agCorPessoa(id){ var p = agPessoa(id); return (p && p.color) || 'var(--c1)'; }

/* Tudo o que a Agenda mostra, num formato so. Refaz-se a cada desenho; sao
   umas centenas de linhas, barato. */
function agItens(){
  var out = [];
  ((window.D && D.events) || []).forEach(function(e){
    var aniv = typeof e.id !== 'number';
    var pessoas = (e.pessoas || []).slice();
    if (aniv){
      var m = /^nasc-(\d+)-/.exec(String(e.id));
      if (m) pessoas = [Number(m[1])];
    } else if (!pessoas.length && e.google_pessoa) pessoas = [e.google_pessoa];
    out.push({
      key: 'e' + e.id, tipo: aniv ? 'aniversario' : (e.ocupado ? 'ocupado' : 'evento'),
      t: e.title, d: e.day, fim: e.ends_on && e.ends_on > e.day ? e.ends_on : null,
      s: e.at || null, dur: e.duration_min || null, p: pessoas, ctx: e.context_id || null,
      loc: e.location || null, notas: e.detail || null, prov: Boolean(e.tentative), ev: e
    });
  });
  ((window.G && G.tasks) || []).forEach(function(t){
    if (!t.due_on || t.status === 'cancelada' || t.parent_id) return;
    var tipo = (t.tipo || 'tarefa');
    if (tipo === 'nota') return;
    if (tipo === 'lembrete' && /YEARLY/.test(t.repeat_rule || '')) tipo = 'aniversario';
    var ps = [];
    if (t.owner_id) ps.push(t.owner_id);
    (t.subjects || []).forEach(function(x){ if (ps.indexOf(x) < 0) ps.push(x); });
    out.push({
      key: 't' + t.id, tipo: tipo, t: t.title, d: t.due_on, fim: null,
      s: t.due_time || null, dur: t.due_time ? (t.duration_min || 30) : null, p: ps, ctx: t.context_id || null,
      loc: t.location || null, notas: t.notes || null, feito: t.status === 'concluida', tarefa: t
    });
  });
  return out;
}
function agPassa(x){
  if (AG.semTipos[x.tipo]) return false;
  if (AG.semAreas[String(agTopo(x.ctx))]) return false;
  if (x.p.length && !x.p.some(function(p){ return !AG.semPessoas[p]; })) return false;
  if (AG.q){
    var txt = (x.t + ' ' + (x.loc || '') + ' ' + (x.notas || '')).toLowerCase();
    if (txt.indexOf(AG.q) < 0) return false;
  }
  return true;
}
var AG_CACHE = null;
function agTodos(){ if (!AG_CACHE) AG_CACHE = agItens().filter(agPassa); return AG_CACHE; }
function agOrdem(a, b){
  return (a.s ? 1 : 0) - (b.s ? 1 : 0) || String(a.s || '').localeCompare(String(b.s || '')) || a.t.localeCompare(b.t);
}
/* O que acontece num dia: inclui os eventos de varios dias que o atravessam. */
function agNoDia(k){
  return agTodos().filter(function(x){ return x.d === k || (x.fim && x.d < k && x.fim >= k); }).sort(agOrdem);
}
function agCor(x){
  if (x.tipo === 'ocupado') return 'var(--faint)';
  if (AG.cor === 'area' && x.ctx) return agCorArea(agTopo(x.ctx));
  var p = x.p.filter(function(id){ return !AG.semPessoas[id]; })[0] || x.p[0];
  if (p) return agCorPessoa(p);
  return x.ctx ? agCorArea(agTopo(x.ctx)) : 'var(--accent)';
}
function agOrigem(x){
  if (x.tarefa) return { tarefa: 'Tarefas', pagamento: 'Pagamentos', lembrete: 'Lembretes', aniversario: 'Lembretes' }[x.tipo] || 'Tarefas';
  if (x.tipo === 'aniversario') return 'Fichas das pessoas';
  var e = x.ev;
  if (e.origin === 'google'){
    var p = agPessoa(e.google_pessoa);
    return 'Google · ' + (p ? p.name : '—');
  }
  return 'Farol';
}
function agQuando(x){
  if (!x.s) return x.fim ? 'dia inteiro' : 'dia todo';
  if (!x.dur) return x.s;
  return x.s + '–' + agHora(agMin(x.s) + Number(x.dur));
}
function agAv(id){
  var p = agPessoa(id);
  if (!p) return '';
  return '<span class="ag-av" style="--c:' + agEsc(p.color || 'var(--c1)') + '" title="' + agEsc(p.name) + '">' +
    agEsc(p.initials || (p.name || '?').slice(0, 1)) + '</span>';
}
function agAreaTxt(x){
  if (!x.ctx) return '';
  var c = agCtx(x.ctx);
  if (!c) return '';
  var topo = c.parent_id ? agCtx(c.parent_id) : null;
  return topo ? topo.name + ' › ' + c.name : c.name;
}

/* ---------------- periodo ---------------- */
function agIntervalo(){
  var c = AG.cur;
  switch (AG.view){
    case 'dia': return [c, c];
    case '3d': return [c, agMais(c, 2)];
    case 'semana': return [agSeg(c), agMais(agSeg(c), 6)];
    case 'util': return [agSeg(c), agMais(agSeg(c), 4)];
    case 'mes': return [new Date(c.getFullYear(), c.getMonth(), 1), new Date(c.getFullYear(), c.getMonth() + 1, 0)];
    case 'trim':
      var q = Math.floor(c.getMonth() / 3) * 3;
      return [new Date(c.getFullYear(), q, 1), new Date(c.getFullYear(), q + 3, 0)];
    case 'ano': return [new Date(c.getFullYear(), 0, 1), new Date(c.getFullYear(), 11, 31)];
    default: return AG.range || [c, agMais(c, 29)];
  }
}
function agRotulo(){
  var r = agIntervalo(), a = r[0], b = r[1], c = AG.cur, wk = '', t;
  if (['dia', '3d', 'semana', 'util'].indexOf(AG.view) >= 0) wk = 'S' + agSemana(a);
  if (AG.view === 'mes') t = MESES[c.getMonth()] + ' de ' + c.getFullYear();
  else if (AG.view === 'trim'){ t = (Math.floor(c.getMonth() / 3) + 1) + '.º trimestre de ' + c.getFullYear(); wk = AG_MS[a.getMonth()] + '–' + AG_MS[b.getMonth()]; }
  else if (AG.view === 'ano') t = String(c.getFullYear());
  else if (agKey(a) === agKey(b)) t = agDataTxt(a) + ' ' + a.getFullYear();
  else if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) t = a.getDate() + ' – ' + b.getDate() + ' de ' + MESES[a.getMonth()] + ' ' + a.getFullYear();
  else if (a.getFullYear() === b.getFullYear()) t = a.getDate() + ' ' + AG_MS[a.getMonth()] + ' – ' + b.getDate() + ' ' + AG_MS[b.getMonth()] + ' ' + a.getFullYear();
  else t = a.getDate() + ' ' + AG_MS[a.getMonth()] + ' ' + a.getFullYear() + ' – ' + b.getDate() + ' ' + AG_MS[b.getMonth()] + ' ' + b.getFullYear();
  return { t: t, wk: wk };
}
function agPasso(dir){
  var c = AG.cur, m = { dia: 1, '3d': 3, semana: 7, util: 7 }[AG.view];
  if (m) AG.cur = agMais(c, dir * m);
  else if (AG.view === 'mes') AG.cur = new Date(c.getFullYear(), c.getMonth() + dir, 1);
  else if (AG.view === 'trim') AG.cur = new Date(c.getFullYear(), c.getMonth() + 3 * dir, 1);
  else if (AG.view === 'ano') AG.cur = new Date(c.getFullYear() + dir, 0, 1);
  else {
    var r = agIntervalo(), n = Math.round((r[1] - r[0]) / 864e5) + 1;
    AG.range = [agMais(r[0], dir * n), agMais(r[1], dir * n)];
    AG.cur = AG.range[0];
  }
  AG.mini = new Date(AG.cur.getFullYear(), AG.cur.getMonth(), 1);
  agRender();
}

/* ---------------- montar ---------------- */
function agMontar(){
  if (AG.montado) return true;
  var v = document.getElementById('view-agenda');
  if (!v) return false;
  AG.montado = true;
  var st = document.createElement('style'); st.id = 'agCss'; st.textContent = AG_CSS;
  document.head.appendChild(st);
  AG.cur = agHoje(); AG.sel = agHoje(); AG.mini = new Date(AG.cur.getFullYear(), AG.cur.getMonth(), 1);
  clear(v);
  v.innerHTML =
    '<div class="ag">' +
      '<aside class="ag-side" id="agSide">' +
        '<div class="ag-sec"><h4>Agregado <button type="button" data-ag="pessoas">todos</button></h4><div id="agPes"></div>' +
          '<label class="ag-row" style="margin-top:6px;border-top:1px solid var(--line-soft);padding-top:8px"><input type="checkbox" id="agPorPessoa"><span class="nm" style="white-space:normal">Dia em colunas por pessoa</span></label></div>' +
        '<div class="ag-sec"><h4>Áreas <button type="button" data-ag="areas">todas</button></h4><div id="agAreas"></div></div>' +
        '<div class="ag-sec"><h4>Mostrar</h4><div id="agTipos"></div></div>' +
        '<div class="ag-sec"><h4>Por agendar</h4><div class="ag-bandeja" id="agBandeja"></div><p class="ag-dica">Arrasta uma tarefa para uma hora ou para um dia.</p></div>' +
      '</aside>' +
      '<div class="card ag-main">' +
        '<div class="ag-tb">' +
          '<button type="button" class="btn small ag-so-estreito" data-ag="filtros">Filtros</button>' +
          '<div class="ag-nav"><button type="button" data-ag="ant" aria-label="Anterior">‹</button><button type="button" data-ag="hoje">Hoje</button><button type="button" data-ag="seg" aria-label="Seguinte">›</button></div>' +
          '<button type="button" class="ag-per" id="agPer" aria-haspopup="true"><span class="wk" id="agWk"></span><b id="agRot"></b><span class="ag-k">▾</span></button>' +
          '<span class="ag-esp"></span>' +
          '<div class="ag-seg" id="agVistas"></div>' +
        '</div>' +
        '<div class="ag-tb2">' +
          '<label class="ag-q"><span aria-hidden="true">⌕</span><input id="agQ" placeholder="Procurar na agenda" aria-label="Procurar na agenda"></label>' +
          '<div class="ag-seg" id="agCor"><button type="button" data-cor="pessoa">Cor: pessoa</button><button type="button" data-cor="area">Cor: área</button></div>' +
          '<span class="ag-esp"></span>' +
          '<span class="ag-sync" id="agSync"><i></i><span id="agSyncT">—</span></span>' +
          '<button type="button" class="btn small" data-ag="actualizar">Actualizar</button>' +
          '<button type="button" class="btn small primary" data-ag="novo">+ Marcar uma data</button>' +
        '</div>' +
        '<div class="ag-pop" id="agPop" hidden></div>' +
        '<div id="agVista"></div>' +
      '</div>' +
      '<aside class="ag-dir">' +
        '<div class="ag-sec"><div class="ag-mh"><button type="button" data-ag="mini-" aria-label="Mês anterior">‹</button><b id="agMiniT"></b><button type="button" data-ag="mini+" aria-label="Mês seguinte">›</button></div><div class="ag-mini" id="agMini"></div></div>' +
        '<div class="ag-sec"><h4>Período</h4><div class="ag-chips" id="agRapido"></div>' +
          '<div class="ag-int"><input type="date" id="agDe" aria-label="De"><input type="date" id="agAte" aria-label="Até"><button type="button" class="btn small" data-ag="intervalo">Ver o intervalo em lista</button></div></div>' +
        '<section class="card ag-det" id="agDet" aria-live="polite"></section>' +
      '</aside>' +
    '</div>';
  agLigar(v);
  agLerGoogle();
  return true;
}

/* ---------------- desenhar ---------------- */
function agRender(){
  if (!window.D || !D.events) return;
  if (!agMontar()) return;
  AG_CACHE = null;
  var r = agRotulo();
  $('agRot').textContent = r.t; $('agWk').textContent = r.wk; $('agWk').hidden = !r.wk;
  $('agVistas').innerHTML = AG_VISTAS.map(function(v){
    return '<button type="button" data-vista="' + v[0] + '" class="' + (AG.view === v[0] ? 'on' : '') + '" title="' + v[1] + ' (' + v[2] + ')">' + v[1] + '</button>';
  }).join('');
  $('agCor').querySelectorAll('button').forEach(function(b){ b.classList.toggle('on', b.dataset.cor === AG.cor); });
  var box = $('agVista');
  var sc = box.querySelector('.ag-sc'), topo = sc ? sc.scrollTop : null;
  var v = AG.view;
  box.innerHTML = ['dia', '3d', 'semana', 'util'].indexOf(v) >= 0 ? agGrelha()
    : v === 'mes' ? agMes() : v === 'trim' ? agTrim() : v === 'ano' ? agAno() : agLista();
  sc = box.querySelector('.ag-sc');
  if (sc) sc.scrollTop = topo ? topo : 7 * AG.H;
  agPorAsHoras();
  agLado(); agDetalhe(); agGuardar();
}

function agChip(x, comHora){
  var cls = 'ag-ev k-' + x.tipo + (AG.item === x.key ? ' sel' : '') + (x.feito ? ' feito' : '') + (x.prov ? ' prov' : '');
  return '<button type="button" class="' + cls + '" style="--c:' + agEsc(agCor(x)) + '" data-item="' + x.key + '" title="' + agEsc(x.t + ' · ' + agQuando(x)) + '">' +
    (comHora && x.s ? '<span class="tm">' + x.s + '</span>' : '') + '<span class="g"></span>' + agEsc(x.t) + '</button>';
}

/* Arrumar os blocos que se sobrepoem lado a lado. */
function agArrumar(lista){
  var xs = lista.map(function(x){
    var a = agMin(x.s), b = a + (x.dur ? Number(x.dur) : 30);
    return { x: x, a: a, b: Math.min(Math.max(b, a + 20), 1440) };
  }).sort(function(p, q){ return p.a - q.a || q.b - p.b; });
  var out = [], grupo = [], cols = [], fim = -1;
  function fecha(){ grupo.forEach(function(g){ g.n = cols.length; }); out = out.concat(grupo); grupo = []; cols = []; }
  xs.forEach(function(o){
    if (o.a >= fim && grupo.length){ fecha(); fim = -1; }
    var i = cols.findIndex(function(t){ return t <= o.a; });
    if (i < 0){ i = cols.length; cols.push(0); }
    cols[i] = o.b; o.i = i; grupo.push(o); fim = Math.max(fim, o.b);
  });
  if (grupo.length) fecha();
  return out;
}

function agGrelha(){
  var cols = [], H = AG.H, hojeK = agKey(agHoje());
  if (AG.view === 'dia' && AG.porPessoa){
    var k = agKey(AG.cur);
    agPessoas().filter(function(p){ return !AG.semPessoas[p.id]; }).forEach(function(p){
      cols.push({ k: k, d: AG.cur, pessoa: p.id,
        cab: agAv(p.id) + '<span style="font-weight:500;font-size:.8125rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + agEsc(p.name) + '</span>',
        f: function(x){ return x.p.indexOf(p.id) >= 0 || !x.p.length; } });
    });
  } else {
    var r = agIntervalo();
    for (var d = r[0]; d <= r[1]; d = agMais(d, 1)){
      cols.push({ k: agKey(d), d: d, cab: '<span class="dw">' + AG_DS[d.getDay()] + '</span><span class="dn">' + d.getDate() + '</span>',
        f: function(){ return true; } });
    }
  }
  if (!cols.length) return '<div class="ag-vazio">Escolhe pelo menos uma pessoa nos filtros.</div>';
  var n = cols.length, minw = n >= 5 ? '70px' : '140px';
  var agora = new Date(), agoraM = agora.getHours() * 60 + agora.getMinutes();
  var h = '<div class="ag-x"><div class="ag-tg" style="--n:' + n + ';--minw:' + minw + ';--H:' + H + 'px">';
  h += '<div class="ag-r ag-hd"><div class="gut"></div>' + cols.map(function(c){
    var cnt = agNoDia(c.k).filter(c.f).filter(function(x){ return x.tipo !== 'ocupado'; }).length;
    var fds = !c.pessoa && c.d.getDay() % 6 === 0;
    return '<div class="h' + (c.k === hojeK && !c.pessoa ? ' hoje' : '') + (fds ? ' fds' : '') + '" data-ir="' + c.k + '">' + c.cab + '<span class="cnt">' + (cnt || '') + '</span></div>';
  }).join('') + '</div>';
  h += '<div class="ag-r ag-ad"><div class="gut">dia todo</div>' + cols.map(function(c){
    return '<div class="c" data-largar="' + c.k + '">' + agNoDia(c.k).filter(c.f).filter(function(x){ return !x.s; }).map(function(x){ return agChip(x); }).join('') + '</div>';
  }).join('') + '</div>';
  h += '<div class="ag-sc"><div class="ag-r"><div class="ag-hrs">';
  for (var i = 0; i < 24; i++) h += '<div>' + (i ? agPad(i) + ':00' : '') + '</div>';
  h += '</div>';
  cols.forEach(function(c){
    var fds = !c.pessoa && c.d.getDay() % 6 === 0;
    h += '<div class="ag-col' + (fds ? ' fds' : '') + '" data-col="' + c.k + '"' + (c.pessoa ? ' data-pessoa="' + c.pessoa + '"' : '') + '>';
    agArrumar(agNoDia(c.k).filter(c.f).filter(function(x){ return x.s && x.d === c.k; })).forEach(function(o){
      var x = o.x, topo = o.a / 60 * H, alt = Math.max(17, (o.b - o.a) / 60 * H - 2), w = 100 / o.n, curto = alt < 32;
      var nomes = x.p.map(function(id){ var p = agPessoa(id); return p ? p.name : ''; }).filter(Boolean).join(', ');
      h += '<button type="button" class="ag-ev ag-bl k-' + x.tipo + (curto ? ' curto' : '') + (AG.item === x.key ? ' sel' : '') + (x.feito ? ' feito' : '') + (x.prov ? ' prov' : '') +
        '" data-item="' + x.key + '" style="--c:' + agEsc(agCor(x)) + ';top:' + topo + 'px;height:' + alt + 'px;left:calc(' + (o.i * w) + '% + 2px);width:calc(' + w + '% - 4px)" title="' + agEsc(x.t + ' · ' + agQuando(x)) + '">' +
        '<span class="tt"><span class="g"></span>' + (curto ? '<span class="tm">' + x.s + '</span>' : '') + agEsc(x.t) + '</span>' +
        '<span class="mt">' + agQuando(x) + (x.loc ? ' · ' + agEsc(x.loc) : '') + '</span>' +
        (!curto && alt > 58 && nomes && x.tipo !== 'ocupado' ? '<span class="mt">' + agEsc(nomes) + '</span>' : '') + '</button>';
    });
    if (c.k === hojeK) h += '<div class="ag-agora" style="top:' + (agoraM / 60 * H) + 'px"></div>';
    h += '</div>';
  });
  return h + '</div></div></div></div>';
}

function agMes(){
  var c = AG.cur, ini = agSeg(new Date(c.getFullYear(), c.getMonth(), 1)), hojeK = agKey(agHoje()), selK = agKey(AG.sel);
  var h = '<div class="ag-mg">' + ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(function(x){ return '<div class="wd">' + x + '</div>'; }).join('');
  for (var i = 0; i < 42; i++){
    var d = agMais(ini, i), k = agKey(d);
    var xs = agNoDia(k).filter(function(x){ return x.tipo !== 'ocupado'; });
    var mostra = xs.slice(0, 3), mais = xs.length - mostra.length;
    h += '<div class="ag-mc' + (d.getMonth() !== c.getMonth() ? ' fora' : '') + (k === hojeK ? ' hoje' : '') + (k === selK ? ' sel' : '') +
      '" data-dia="' + k + '" data-largar="' + k + '"><div class="n"><b>' + d.getDate() + '</b><span>' + (d.getDate() === 1 ? AG_MS[d.getMonth()] : '') + '</span></div>' +
      mostra.map(function(x){ return agChip(x, true); }).join('') +
      (mais > 0 ? '<button type="button" class="mais" data-ir="' + k + '">+' + mais + ' mais</button>' : '') + '</div>';
  }
  return h + '</div>';
}

function agMiniMes(y, m, denso){
  var p = new Date(y, m, 1), off = (p.getDay() + 6) % 7, dias = new Date(y, m + 1, 0).getDate();
  var hojeK = agKey(agHoje()), selK = agKey(AG.sel);
  var h = '<div class="ag-qd">' + ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(function(x){ return '<span>' + x + '</span>'; }).join('');
  for (var i = 0; i < off; i++) h += '<i></i>';
  for (var dd = 1; dd <= dias; dd++){
    var k = y + '-' + agPad(m + 1) + '-' + agPad(dd);
    var xs = agNoDia(k).filter(function(x){ return x.tipo !== 'ocupado'; });
    var cls = (k === hojeK ? 'hoje' : '') + (k === selK ? ' sel' : '');
    var tit = agEsc(xs.map(function(x){ return x.t; }).join(' · '));
    if (denso){
      var n = xs.length;
      var fundo = n ? 'background:color-mix(in srgb,var(--accent) ' + Math.min(14 + n * 16, 80) + '%,transparent);' + (n >= 3 ? 'color:#fff' : '') : '';
      h += '<button type="button" class="' + cls + '" style="' + fundo + '" data-ir="' + k + '" title="' + tit + '">' + dd + '</button>';
    } else {
      h += '<button type="button" class="' + cls + '" data-dia="' + k + '" title="' + tit + '">' + dd + '<span class="dots">' +
        xs.slice(0, 4).map(function(x){ return '<i style="--c:' + agEsc(agCor(x)) + '"></i>'; }).join('') + '</span></button>';
    }
  }
  return h + '</div>';
}

function agTrim(){
  var c = AG.cur, q = Math.floor(c.getMonth() / 3) * 3, h = '<div class="ag-qg">';
  for (var m = q; m < q + 3; m++){
    var y = c.getFullYear(), pre = y + '-' + agPad(m + 1);
    /* Os marcos do mes: o que nao e rotina nem «ocupado». */
    var xs = agTodos().filter(function(x){
      return x.d.slice(0, 7) === pre && x.tipo !== 'ocupado' && !(x.tarefa && x.tarefa.repeat_rule && x.tipo !== 'aniversario');
    }).sort(function(a, b){ return a.d < b.d ? -1 : a.d > b.d ? 1 : agOrdem(a, b); });
    h += '<div class="ag-qm"><h5 data-mes="' + pre + '">' + MESES[m] + '</h5>' + agMiniMes(y, m, false) + '<div class="ag-ql">' +
      (xs.length ? xs.slice(0, 40).map(function(x){
        var d = agDia(x.d);
        return '<button type="button" data-item="' + x.key + '"><span class="dd">' + agPad(d.getDate()) + ' ' + AG_DS[d.getDay()] + '</span><span class="ag-sw" style="--c:' + agEsc(agCor(x)) + '"></span><span class="tx">' + agEsc(x.t) + '</span></button>';
      }).join('') + (xs.length > 40 ? '<span class="ag-dica">e mais ' + (xs.length - 40) + '…</span>' : '')
        : '<span class="ag-dica">Nada marcado neste mês.</span>') + '</div></div>';
  }
  return h + '</div>';
}

function agAno(){
  var y = AG.cur.getFullYear(), h = '<div class="ag-yg">';
  for (var m = 0; m < 12; m++) h += '<div class="ag-qm"><h5 data-mes="' + y + '-' + agPad(m + 1) + '">' + MESES[m] + '</h5>' + agMiniMes(y, m, true) + '</div>';
  h += '</div><div class="ag-leg">Cor mais forte, mais coisas marcadas nesse dia:';
  [1, 2, 4].forEach(function(n){ h += '<i style="background:color-mix(in srgb,var(--accent) ' + Math.min(14 + n * 16, 80) + '%,transparent)"></i>' + n + (n === 4 ? '+' : ''); });
  return h + ' · clica num dia para o abrir.</div>';
}

function agLista(){
  var r = agIntervalo(), hojeK = agKey(agHoje()), amanhaK = agKey(agMais(agHoje(), 1)), h = '<div class="ag-ls">', algum = false;
  for (var d = r[0]; d <= r[1]; d = agMais(d, 1)){
    var k = agKey(d), xs = agNoDia(k).filter(function(x){ return x.tipo !== 'ocupado'; });
    if (!xs.length) continue;
    algum = true;
    var tag = k === hojeK ? 'hoje' : k === amanhaK ? 'amanhã' : '';
    h += '<div class="dia"><div class="dl"><b>' + d.getDate() + '</b>' + AG_DS[d.getDay()] + ' · ' + AG_MS[d.getMonth()] + (tag ? ' <span class="hj">· ' + tag + '</span>' : '') + '</div><div>' +
      xs.map(agLinha).join('') + '</div></div>';
  }
  return h + (algum ? '' : '<div class="ag-vazio">Nada neste período com estes filtros.</div>') + '</div>';
}
function agLinha(x){
  var sub = [agAreaTxt(x), x.p.map(function(id){ var p = agPessoa(id); return p ? p.name : ''; }).filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  return '<button type="button" class="ag-li' + (AG.item === x.key ? ' sel' : '') + (x.feito ? ' feito' : '') + '" data-item="' + x.key + '"><span class="tm">' + agQuando(x) +
    '</span><span class="ag-sw" style="--c:' + agEsc(agCor(x)) + '"></span><span class="tt"><b>' + agEsc(x.t) + '</b>' + (sub ? '<small>' + agEsc(sub) + '</small>' : '') +
    '</span><span class="src">' + agEsc(agOrigem(x)) + '</span></button>';
}

/* A grelha de horas abre nas 7h. Desenhada com o ecra escondido, o browser
   ignora o scroll: acerta-se quando a Agenda aparece. */
function agPorAsHoras(){
  var sc = document.querySelector('#view-agenda .ag-sc');
  if (sc && !sc.scrollTop && sc.offsetParent) sc.scrollTop = 7 * AG.H;
}
(function(){
  var v = document.getElementById('view-agenda');
  if (!v || !window.MutationObserver) return;
  new MutationObserver(function(){ if (v.classList.contains('is-active')) agPorAsHoras(); })
    .observe(v, { attributes: true, attributeFilter: ['class'] });
})();

/* ---------------- a coluna da esquerda ---------------- */
function agLado(){
  var m = AG.mini, ini = agSeg(new Date(m.getFullYear(), m.getMonth(), 1)), r = agIntervalo();
  var a = agKey(r[0]), b = agKey(r[1]), hojeK = agKey(agHoje()), selK = agKey(AG.sel);
  $('agMiniT').textContent = MESES[m.getMonth()] + ' ' + m.getFullYear();
  var h = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(function(x){ return '<span>' + x + '</span>'; }).join('');
  for (var i = 0; i < 42; i++){
    var d = agMais(ini, i), k = agKey(d);
    var tem = agNoDia(k).some(function(x){ return x.tipo !== 'ocupado'; });
    h += '<button type="button" data-dia="' + k + '" class="' + [d.getMonth() !== m.getMonth() ? 'fora' : '', k === hojeK ? 'hoje' : '', k === selK ? 'sel' : '',
      k >= a && k <= b ? 'vis' : '', tem ? 'tem' : ''].join(' ') + '">' + d.getDate() + '</button>';
  }
  $('agMini').innerHTML = h;

  $('agRapido').innerHTML = [['hoje', 'Hoje'], ['semana', 'Esta semana'], ['mes', 'Este mês'], ['trim', 'Este trimestre'],
    ['ano', 'Este ano'], ['30', 'Próximos 30 dias']].map(function(x){ return '<button type="button" data-rapido="' + x[0] + '">' + x[1] + '</button>'; }).join('');
  if (!$('agDe').value){ $('agDe').value = hojeK; $('agAte').value = agKey(agMais(agHoje(), 90)); }

  $('agPes').innerHTML = agPessoas().map(function(p){
    var g = AG.google[p.id], st;
    if (g) st = g.erro ? '<span class="st mau" title="' + agEsc(g.erro) + '">G · erro</span>'
      : '<span class="st" title="Google ' + (g.escrever ? 'ligado (lê e escreve)' : 'ligado só para ler') + '">G' + (g.escrever ? '✎' : '') + ' · ' + agEsc(agLido(g.lido_ms)) + '</span>';
    else st = '<button type="button" class="st liga" data-ficha="' + p.id + '" title="Abrir a ficha para ligar o Google">ligar</button>';
    return '<label class="ag-row"><input type="checkbox" data-pes="' + p.id + '"' + (AG.semPessoas[p.id] ? '' : ' checked') + '>' + agAv(p.id) +
      '<span class="nm">' + agEsc(p.name) + '</span>' + st + '</label>';
  }).join('') || '<p class="ag-dica">Sem pessoas na app.</p>';
  $('agPorPessoa').checked = Boolean(AG.porPessoa);

  var areas = agAreas().map(function(c){ return { id: String(c.id), n: c.name, cor: agCorArea(c.id) }; });
  areas.push({ id: '0', n: 'Sem área', cor: 'var(--faint)' });
  $('agAreas').innerHTML = areas.map(function(x){
    return '<label class="ag-row"><input type="checkbox" data-area="' + x.id + '"' + (AG.semAreas[x.id] ? '' : ' checked') + '><span class="ag-sw" style="--c:' + agEsc(x.cor) + '"></span><span class="nm">' + agEsc(x.n) + '</span></label>';
  }).join('');
  $('agTipos').innerHTML = AG_TIPOS.map(function(t){
    return '<label class="ag-row"><input type="checkbox" data-tipo="' + t[0] + '"' + (AG.semTipos[t[0]] ? '' : ' checked') + '><span class="nm">' + t[1] + '</span></label>';
  }).join('');

  var soltas = ((window.G && G.tasks) || []).filter(function(t){
    return !t.due_on && !t.parent_id && (t.tipo || 'tarefa') === 'tarefa' && t.status !== 'concluida' && t.status !== 'cancelada';
  }).slice(0, 40);
  $('agBandeja').innerHTML = soltas.length ? soltas.map(function(t){
    return '<div class="ag-tr" draggable="true" data-solta="' + t.id + '"><span class="ag-sw" style="--c:' + agEsc(t.context_id ? agCorArea(agTopo(t.context_id)) : 'var(--faint)') + '"></span><span>' + agEsc(t.title) + '</span></div>';
  }).join('') : '<p class="ag-dica" style="margin:0">' + (window.G && G.tasks ? 'Todas as tarefas abertas têm data.' : 'A ler as tarefas…') + '</p>';

  var contas = Object.keys(AG.google).map(function(k){ return AG.google[k]; });
  var s = $('agSync');
  if (!s.classList.contains('lendo')){
    var erros = contas.filter(function(c){ return c.erro; });
    s.classList.toggle('mau', erros.length > 0);
    $('agSyncT').textContent = !contas.length ? 'Nenhum Google ligado'
      : erros.length ? erros.length + ' calendário' + (erros.length > 1 ? 's' : '') + ' com erro'
      : contas.length + ' Google ' + (contas.length > 1 ? 'lidos' : 'lido') + ' · ' + agLido(Math.max.apply(null, contas.map(function(c){ return Number(c.lido_ms || 0); })));
  }
}
function agLido(ms){
  var n = Number(ms || 0);
  if (!n) return 'por ler';
  var d = new Date(n), seg = Math.round((Date.now() - n) / 1000);
  if (seg < 90) return 'agora';
  if (seg < 86400) return agPad(d.getHours()) + ':' + agPad(d.getMinutes());
  return d.getDate() + ' ' + AG_MS[d.getMonth()];
}
function agLerGoogle(){
  if (typeof apiGestao !== 'function') return;
  apiGestao('/api/google/estado').then(function(r){
    AG.google = {};
    ((r && r.contas) || []).forEach(function(c){ AG.google[c.person_id] = c; });
    if (AG.montado) agLado();
  }).catch(function(){});
}

/* ---------------- o painel da direita ---------------- */
function agAchar(key){ return agItens().filter(function(x){ return x.key === key; })[0] || null; }
function agDetalhe(){
  var box = $('agDet'), x = AG.item ? agAchar(AG.item) : null;
  if (x) return agDetalheItem(box, x);
  AG.item = null;
  var d = AG.sel, k = agKey(d);
  var xs = agNoDia(k), vis = xs.filter(function(y){ return y.tipo !== 'ocupado'; });
  var tarefas = vis.filter(function(y){ return y.tarefa; }), resto = vis.filter(function(y){ return !y.tarefa; });
  var titulo = agDataTxt(d); titulo = titulo.charAt(0).toUpperCase() + titulo.slice(1);
  var h = '<div class="ag-dh"><h3>' + agEsc(titulo) + '</h3><span class="ag-k">' + (vis.length ? vis.length + (vis.length === 1 ? ' item' : ' itens') : 'livre') + '</span></div>';
  h += resto.length ? '<div class="ag-dia">' + resto.map(function(y){
    return '<button type="button" class="ag-li" data-item="' + y.key + '"><span class="tm">' + (y.s || '—') + '</span><span class="ag-sw" style="--c:' + agEsc(agCor(y)) + '"></span><span class="tt"><b>' + agEsc(y.t) + '</b><small>' + agEsc([agAreaTxt(y), agOrigem(y)].filter(Boolean).join(' · ')) + '</small></span></button>';
  }).join('') + '</div>' : '<p class="ag-dica" style="margin:0">Sem compromissos neste dia.</p>';
  if (tarefas.length){
    h += '<div><div class="ag-dh" style="margin-bottom:4px"><span class="ag-k">Tarefas e pagamentos</span></div><div class="ag-dia">' + tarefas.map(function(y){
      return '<button type="button" class="ag-li' + (y.feito ? ' feito' : '') + '" data-item="' + y.key + '"><span class="tm">' + (y.s || '—') + '</span><span class="ag-sw" style="--c:' + agEsc(agCor(y)) + '"></span><span class="tt"><b>' + agEsc(y.t) + '</b>' + (y.tarefa.amount ? '<small>' + agEsc(String(y.tarefa.amount).replace('.', ',')) + ' €</small>' : '') + '</span></button>';
    }).join('') + '</div></div>';
  }
  /* Quem esta ocupado: as horas marcadas de cada pessoa, das 8h as 23h. */
  var ps = agPessoas().filter(function(p){ if (AG.semPessoas[p.id]) return false;
    var g = ((window.G && G.people) || []).filter(function(x){ return x.id === p.id; })[0];
    return !(g && g.kind === 'animal'); });
  if (ps.length){
    h += '<div><div class="ag-dh" style="margin-bottom:6px"><span class="ag-k">Quem está ocupado</span><span class="ag-k" style="text-transform:none">8h–23h</span></div><div class="ag-livre">';
    ps.forEach(function(p){
      var seg = xs.filter(function(y){ return y.s && y.d === k && y.p.indexOf(p.id) >= 0; }).map(function(y){
        var a = Math.max(agMin(y.s), 480), b = Math.min(agMin(y.s) + (Number(y.dur) || 30), 1380);
        if (b <= a) return '';
        return '<i style="--c:' + agEsc(y.tipo === 'ocupado' ? 'var(--faint)' : agCorPessoa(p.id)) + ';left:' + ((a - 480) / 900 * 100) + '%;width:' + ((b - a) / 900 * 100) + '%" title="' + agEsc(y.t + ' ' + agQuando(y)) + '"></i>';
      }).join('');
      h += '<div class="fr"><span>' + agEsc(p.name) + '</span><div class="bar">' + seg + '</div></div>';
    });
    h += '<div class="ax"><span>8</span><span>11</span><span>14</span><span>17</span><span>20</span><span>23</span></div></div></div>';
  }
  h += '<button type="button" class="btn small" data-novo-dia="' + k + '">+ Marcar neste dia</button>';
  box.innerHTML = h;
}

function agDetalheItem(box, x){
  var d = agDia(x.d);
  var nomes = { evento: 'Evento', ocupado: 'Ocupado', tarefa: 'Tarefa', pagamento: 'Pagamento', lembrete: 'Lembrete', aniversario: 'Aniversário' };
  var h = '<button type="button" class="ag-voltar" data-voltar>← ' + agEsc(agDataTxt(AG.sel)) + '</button>';
  h += '<div class="ag-dh"><span class="ag-k">' + nomes[x.tipo] + (x.prov ? ' · por confirmar' : '') + (x.tarefa && x.tarefa.repeat_rule ? ' · repete' : '') + '</span><span class="ag-sw" style="--c:' + agEsc(agCor(x)) + ';width:13px;height:13px"></span></div>';
  h += '<h3>' + agEsc(x.t) + '</h3><dl class="ag-dl">';
  var quando = agDataTxt(d) + ' ' + d.getFullYear();
  if (x.fim){ var f = agDia(x.fim); quando += ' até ' + f.getDate() + ' ' + AG_MS[f.getMonth()]; }
  h += '<dt>Quando</dt><dd>' + agEsc(quando) + '<br><span style="font-family:var(--mono);font-size:.75rem">' + agEsc(agQuando(x)) + '</span></dd>';
  if (x.tarefa && x.tarefa.repeat_label && x.tarefa.repeat_rule) h += '<dt>Repete</dt><dd>' + agEsc(x.tarefa.repeat_label) + '</dd>';
  var area = agAreaTxt(x);
  if (area) h += '<dt>Área</dt><dd>' + agEsc(area) + '</dd>';
  if (x.p.length) h += '<dt>' + (x.tarefa ? 'Quem' : 'Pessoas') + '</dt><dd class="ag-pp">' + x.p.map(function(id){ var p = agPessoa(id); return p ? '<span>' + agAv(id) + agEsc(p.name) + '</span>' : ''; }).join('') + '</dd>';
  if (x.loc){
    var url = /^https?:\/\//i.test(x.loc) ? x.loc : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(x.loc);
    h += '<dt>Local</dt><dd>' + agEsc(x.loc) + ' · <a href="' + agEsc(url) + '" target="_blank" rel="noopener">' + (/^https?:/i.test(x.loc) ? 'abrir' : 'ver no mapa') + '</a></dd>';
  }
  if (x.tarefa && x.tarefa.amount) h += '<dt>Valor</dt><dd>' + agEsc(String(x.tarefa.amount).replace('.', ',')) + ' €' + (x.tarefa.payee ? ' · ' + agEsc(x.tarefa.payee) : '') + '</dd>';
  h += '<dt>De onde</dt><dd>' + agEsc(agOrigem(x));
  if (x.ev && x.ev.origin === 'real' && (x.ev.no_google_de || []).length){
    h += '<br><small style="color:var(--muted)">Também no Google de ' + agEsc(x.ev.no_google_de.map(function(id){ var p = agPessoa(id); return p ? p.name : ''; }).filter(Boolean).join(', ')) + '</small>';
  }
  h += '</dd>';
  if (x.notas && x.tipo !== 'aniversario') h += '<dt>Notas</dt><dd style="white-space:pre-wrap">' + agEsc(x.notas) + '</dd>';
  else if (x.tipo === 'aniversario' && x.notas) h += '<dt>Idade</dt><dd>' + agEsc(x.notas) + '</dd>';
  if (x.ev && (x.ev.papeis || []).length) h += '<dt>Documentos</dt><dd>' + x.ev.papeis.length + ' agarrado' + (x.ev.papeis.length > 1 ? 's' : '') + ' — abre o evento para os ver</dd>';
  h += '</dl>';
  var ac = '';
  if (x.ev && x.ev.origin === 'google'){
    h += '<p class="ag-nota">' + (x.tipo === 'ocupado'
      ? 'Vem de um calendário que só conta como ocupado: o Farol não guarda o que é.'
      : 'Este evento nasceu no Google. Corrige-se lá; a leitura seguinte (de 15 em 15 minutos, ou em Actualizar) traz a correcção.') + '</p>';
  } else if (x.ev && x.ev.origin === 'real'){
    ac += '<button type="button" class="btn small primary" data-acao="corrigir">Abrir e corrigir</button>';
  } else if (x.tarefa){
    var fechada = x.tarefa.status === 'concluida';
    ac += '<button type="button" class="btn small primary" data-acao="feito">' + (fechada ? 'Reabrir' : x.tipo === 'pagamento' ? 'Dar por pago' : 'Concluir') + '</button>';
    ac += '<button type="button" class="btn small" data-acao="tarefa">Abrir</button>';
  }
  if (ac) h += '<div class="ag-acoes">' + ac + '</div>';
  box.innerHTML = h;
}

/* ---------------- interacao ---------------- */
function agIrDia(k){
  AG.cur = agDia(k); AG.sel = agDia(k); AG.view = 'dia'; AG.item = null; AG.range = null;
  AG.mini = new Date(AG.cur.getFullYear(), AG.cur.getMonth(), 1);
  agRender();
}
function agNovo(dia, hora, pessoa){
  if (typeof evJanela !== 'function'){ toast('A janela de eventos ainda não está pronta.'); return; }
  evJanela(null, { day: dia || agKey(AG.sel), at: hora || null, person_id: pessoa ? Number(pessoa) : null });
}
function agHoraDoClique(col, y){
  var r = col.getBoundingClientRect();
  var m = Math.floor((y - r.top) / AG.H * 2) * 30;
  return agHora(Math.max(0, Math.min(m, 1410)));
}

function agLigar(v){
  v.addEventListener('click', function(ev){
    var t = ev.target, b;
    var pop = $('agPop');
    if (!pop.hidden && !pop.contains(t) && !t.closest('#agPer')) pop.hidden = true;
    if ((b = t.closest('[data-vista]'))){ AG.view = b.dataset.vista; AG.range = null; AG.item = null; return agRender(); }
    if ((b = t.closest('[data-cor]'))){ AG.cor = b.dataset.cor; return agRender(); }
    if ((b = t.closest('[data-item]'))){
      var x = agAchar(b.dataset.item);
      if (!x) return;
      AG.item = x.key; AG.sel = agDia(x.d);
      agRender();
      if (window.innerWidth <= 1400) $('agDet').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if ((b = t.closest('[data-ir]'))) return agIrDia(b.dataset.ir);
    if ((b = t.closest('[data-mes]'))){ AG.cur = agDia(b.dataset.mes + '-01'); AG.view = 'mes'; return agRender(); }
    if ((b = t.closest('#agMini [data-dia]'))){
      var d = agDia(b.dataset.dia);
      AG.sel = d; AG.cur = d; AG.item = null;
      if (AG.view === 'lista') AG.range = null;
      return agRender();
    }
    if ((b = t.closest('[data-dia]'))){ AG.sel = agDia(b.dataset.dia); AG.item = null; return agRender(); }
    if ((b = t.closest('[data-ficha]'))){
      ev.preventDefault();
      if (typeof fiAbrir === 'function') return fiAbrir(Number(b.dataset.ficha));
      return toast('Abre a ficha da pessoa (Família) › Na app › Calendário Google › Ligar o Google.');
    }
    if ((b = t.closest('[data-rapido]'))){
      var q = b.dataset.rapido;
      AG.range = null; AG.cur = agHoje(); AG.sel = agHoje(); AG.item = null;
      AG.view = { hoje: 'dia', semana: 'semana', mes: 'mes', trim: 'trim', ano: 'ano', '30': 'lista' }[q];
      AG.mini = new Date(AG.cur.getFullYear(), AG.cur.getMonth(), 1);
      return agRender();
    }
    if (t.closest('[data-voltar]')){ AG.item = null; return agRender(); }
    if ((b = t.closest('[data-novo-dia]'))) return agNovo(b.dataset.novoDia);
    if ((b = t.closest('[data-acao]'))) return agAcao(b.dataset.acao, b);
    if ((b = t.closest('[data-ag]'))) return agBotao(b.dataset.ag, b);
    if ((b = t.closest('.ag-col'))) return agNovo(b.dataset.col, agHoraDoClique(b, ev.clientY), b.dataset.pessoa);
  });
  v.addEventListener('change', function(ev){
    var t = ev.target;
    if (t.dataset.pes){ if (t.checked) delete AG.semPessoas[t.dataset.pes]; else AG.semPessoas[t.dataset.pes] = true; }
    else if (t.dataset.area){ if (t.checked) delete AG.semAreas[t.dataset.area]; else AG.semAreas[t.dataset.area] = true; }
    else if (t.dataset.tipo){ if (t.checked) delete AG.semTipos[t.dataset.tipo]; else AG.semTipos[t.dataset.tipo] = true; }
    else if (t.id === 'agPorPessoa'){ AG.porPessoa = t.checked; if (t.checked){ AG.view = 'dia'; AG.cur = new Date(AG.sel); } }
    else return;
    agRender();
  });
  var qt = null;
  v.addEventListener('input', function(ev){
    if (ev.target.id !== 'agQ') return;
    clearTimeout(qt);
    qt = setTimeout(function(){ AG.q = ev.target.value.trim().toLowerCase(); agRender(); }, 150);
  });

  /* Arrastar uma tarefa sem data para uma hora ou para um dia. */
  var arrasta = null;
  v.addEventListener('dragstart', function(ev){
    var t = ev.target.closest && ev.target.closest('[data-solta]');
    if (!t) return;
    arrasta = Number(t.dataset.solta);
    ev.dataTransfer.setData('text/plain', String(arrasta));
    ev.dataTransfer.effectAllowed = 'move';
  });
  v.addEventListener('dragover', function(ev){
    var c = arrasta && ev.target.closest && ev.target.closest('.ag-col,[data-largar]');
    if (!c) return;
    ev.preventDefault();
    v.querySelectorAll('.alvo').forEach(function(x){ if (x !== c) x.classList.remove('alvo'); });
    c.classList.add('alvo');
  });
  v.addEventListener('dragend', function(){ arrasta = null; v.querySelectorAll('.alvo').forEach(function(x){ x.classList.remove('alvo'); }); });
  v.addEventListener('drop', function(ev){
    var c = arrasta && ev.target.closest && ev.target.closest('.ag-col,[data-largar]');
    if (!c) return;
    ev.preventDefault();
    var id = arrasta; arrasta = null;
    var dados = c.classList.contains('ag-col')
      ? { due_on: c.dataset.col, due_time: agHoraDoClique(c, ev.clientY) }
      : { due_on: c.dataset.largar };
    if (typeof tfGravar !== 'function') return toast('As tarefas ainda não estão prontas.');
    tfGravar(id, dados, 'Agendada para ' + agDataTxt(agDia(dados.due_on)) + (dados.due_time ? ' às ' + dados.due_time : '') + '.')
      .then(function(){ AG.item = 't' + id; AG.sel = agDia(dados.due_on); agRender(); })
      .catch(function(){});
  });

  document.addEventListener('keydown', function(ev){
    if (!v.classList.contains('is-active')) return;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    if (ev.target.closest && ev.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (document.querySelector('dialog[open]')) return;
    var k = ev.key.toLowerCase();
    var vista = { d: 'dia', '3': '3d', s: 'semana', u: 'util', m: 'mes', t: 'trim', a: 'ano', l: 'lista' }[k];
    if (vista){ AG.view = vista; AG.range = null; agRender(); }
    else if (ev.key === 'ArrowLeft') agPasso(-1);
    else if (ev.key === 'ArrowRight') agPasso(1);
    else if (k === 'h') agBotao('hoje');
    else if (k === 'n') agNovo();
    else if (ev.key === 'Escape'){ $('agPop').hidden = true; if (AG.item){ AG.item = null; agRender(); } }
    else return;
    ev.preventDefault();
  });
}

function agBotao(o, b){
  if (o === 'ant') return agPasso(-1);
  if (o === 'seg') return agPasso(1);
  if (o === 'hoje'){ AG.cur = agHoje(); AG.sel = agHoje(); AG.range = null; AG.mini = new Date(AG.cur.getFullYear(), AG.cur.getMonth(), 1); return agRender(); }
  if (o === 'mini-'){ AG.mini = new Date(AG.mini.getFullYear(), AG.mini.getMonth() - 1, 1); return agLado(); }
  if (o === 'mini+'){ AG.mini = new Date(AG.mini.getFullYear(), AG.mini.getMonth() + 1, 1); return agLado(); }
  if (o === 'filtros') return $('agSide').classList.toggle('aberto');
  if (o === 'pessoas'){
    var todas = !Object.keys(AG.semPessoas).length;
    AG.semPessoas = {};
    /* Com todas ligadas, o botao deixa so a primeira (quem usa a app). */
    if (todas) agPessoas().slice(1).forEach(function(p){ AG.semPessoas[p.id] = true; });
    return agRender();
  }
  if (o === 'areas'){ AG.semAreas = {}; return agRender(); }
  if (o === 'novo') return agNovo();
  if (o === 'intervalo'){
    var a = $('agDe').value, z = $('agAte').value;
    if (!a || !z || a > z) return toast('Escolhe um início antes do fim.');
    AG.range = [agDia(a), agDia(z)]; AG.cur = agDia(a); AG.view = 'lista'; AG.item = null;
    return agRender();
  }
  if (o === 'actualizar') return agActualizar(b);
}
function agActualizar(b){
  var s = $('agSync');
  s.classList.add('lendo'); s.classList.remove('mau');
  $('agSyncT').textContent = 'A ler os calendários Google…';
  if (b) b.disabled = true;
  apiGestao('/api/google/sincronizar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    .catch(function(e){ toast((e && e.message) || 'Não deu para ler o Google.'); })
    .then(function(){ return apiGestao('/api/bootstrap'); })
    .then(function(d){ if (d && d.events){ D = d; renderAll(); } })
    .catch(function(){})
    .then(function(){ s.classList.remove('lendo'); if (b) b.disabled = false; agLerGoogle(); });
}

function agAcao(o, b){
  var x = AG.item ? agAchar(AG.item) : null;
  if (!x) return;
  if (o === 'corrigir' && typeof evJanela === 'function') return evJanela(x.ev);
  if (o === 'tarefa' && typeof avAbrir === 'function') return avAbrir({ origem: 'tarefa', id: x.tarefa.id, title: x.t });
  if (o === 'feito'){
    var t = (typeof tfPorId === 'function' && tfPorId(x.tarefa.id)) || x.tarefa;
    if (t.status === 'concluida') return typeof tfGravar === 'function' && tfGravar(t.id, { status: 'aberta' }, 'Reaberta.');
    if (x.tipo === 'pagamento' && typeof tfPopPagar === 'function') return tfPopPagar(t, b);
    if (typeof tfFechar === 'function') return tfFechar(t, 'concluida');
  }
}

/* O seletor de periodo: ano, mes e trimestre. */
var AG_POP_ANO = null;
function agPop(){
  var c = AG.cur, y = AG_POP_ANO;
  $('agPop').innerHTML = '<div class="yr"><button type="button" data-pa="-1" aria-label="Ano anterior">‹</button><b>' + y + '</b><button type="button" data-pa="1" aria-label="Ano seguinte">›</button></div>' +
    '<div class="ms">' + AG_MS.map(function(m, i){ return '<button type="button" data-pm="' + i + '" class="' + (y === c.getFullYear() && i === c.getMonth() ? 'on' : '') + '">' + m + '</button>'; }).join('') + '</div>' +
    '<div class="qs">' + [1, 2, 3, 4].map(function(q){ return '<button type="button" data-pq="' + q + '">T' + q + '</button>'; }).join('') + '<button type="button" data-pano="1">Ano ' + y + '</button></div>';
}
document.addEventListener('click', function(ev){
  var per = ev.target.closest && ev.target.closest('#agPer');
  if (per){
    var p = $('agPop');
    if (!p.hidden){ p.hidden = true; return; }
    AG_POP_ANO = AG.cur.getFullYear(); agPop();
    var r = per.getBoundingClientRect(), m = per.closest('.ag-main').getBoundingClientRect();
    p.style.left = Math.max(8, Math.min(r.left - m.left, m.width - 290)) + 'px';
    p.style.top = (r.bottom - m.top + 6) + 'px';
    p.hidden = false;
    return;
  }
  var b = ev.target.closest && ev.target.closest('#agPop button');
  if (!b) return;
  ev.stopPropagation();
  if (b.dataset.pa){ AG_POP_ANO += Number(b.dataset.pa); return agPop(); }
  if (b.dataset.pm !== undefined){ AG.cur = new Date(AG_POP_ANO, Number(b.dataset.pm), 1); if (['mes', 'trim', 'ano'].indexOf(AG.view) < 0) AG.view = 'mes'; }
  else if (b.dataset.pq){ AG.cur = new Date(AG_POP_ANO, (Number(b.dataset.pq) - 1) * 3, 1); AG.view = 'trim'; }
  else if (b.dataset.pano){ AG.cur = new Date(AG_POP_ANO, 0, 1); AG.view = 'ano'; }
  AG.range = null; AG.item = null; AG.mini = new Date(AG.cur.getFullYear(), AG.cur.getMonth(), 1);
  $('agPop').hidden = true;
  agRender();
}, true);

/* Os pedidos nao esperam pelos scripts: o /api/bootstrap e o /api/gestao
   chegam muitas vezes antes de este ficheiro (o ultimo) ser lido, e o
   renderAll dessa altura ainda nao sabia da Agenda. Desenha-se aqui tambem;
   sem dados, o agRender nao faz nada e espera pelo proximo renderAll. */
agRender();
