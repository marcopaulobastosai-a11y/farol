'use strict';
/* Farol — Finanças e Património (3 out 2026).
 *
 * Os ecrãs das áreas Finanças e Património ganham separadores. As tarefas e
 * os papéis da área continuam lá, no último separador («Tarefas & papéis»):
 * o area-tarefas.js desenha-os como sempre, e aqui só se esconde a caixa dele
 * quando se está noutro separador.
 *
 *   Finanças:   Resumo · Movimentos · Orçamentos · Análise · Contas correntes · Contas partilhadas · Pessoas
 *               · Categorias & IA · Tarefas & papéis
 *   Património: Visão geral · Contas · Bens & dívidas · Tarefas & papéis
 *
 * Os dados vêm de /api/financas/*. Nada aqui inventa um número: um ecrã sem
 * contas diz que não há contas e mostra como começar.
 */

var FN = {
  montado: false, tentativas: 0,
  aba: { financas: 'resumo', patrimonio: 'visao' },
  mes: null, ambito: 'tudo', area: '', empresas: false,
  base: null, cache: {},
  mov: { estado: '', conta: '', categoria: '', periodo: 'mes', q: '', sel: {}, aberto: null },
  orcVista: 'mes', catNatureza: 'despesa', ccAberta: null
};
(function(){
  var d = new Date();
  FN.mes = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  try {
    var g = JSON.parse(localStorage.getItem('fnEstado') || 'null');
    if (g){
      if (g.aba) FN.aba = Object.assign(FN.aba, g.aba);
      if (g.ambito) FN.ambito = g.ambito;
    }
  } catch (e) {}
})();
function fnGuardar(){ try { localStorage.setItem('fnEstado', JSON.stringify({ aba: FN.aba, ambito: FN.ambito })); } catch (e) {} }

var FN_ABAS = {
  financas: [['resumo','Resumo'],['movimentos','Movimentos'],['orcamentos','Orçamentos'],['analise','Análise'],['cc','Contas correntes'],['partilhadas','Contas partilhadas'],['pessoas','Pessoas'],['categorias','Categorias & IA'],['area','Tarefas & papéis']],
  patrimonio: [['visao','Visão geral'],['contas','Contas'],['bens','Bens & dívidas'],['area','Tarefas & papéis']]
};

var FN_CSS =
  ':root{--fn-in:var(--accent);--fn-out:#C46A1F;--fn-c3:#3E6FB0;--fn-c4:#8C7BC4;--fn-c5:#93A3A4;--fn-tr:#6A5BA8}' +
  '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--fn-out:#E39A55;--fn-c3:#79A3DE;--fn-c4:#B4A6E8;--fn-c5:#6E8382;--fn-tr:#A99BE0}}' +
  ':root[data-theme="dark"]{--fn-out:#E39A55;--fn-c3:#79A3DE;--fn-c4:#B4A6E8;--fn-c5:#6E8382;--fn-tr:#A99BE0}' +
  '.view.fn-on > .ae{display:none}' +
  '.view:not(.fn-on) > .fn-corpo{display:none}' +
  '.fn-abas{display:flex;gap:2px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin-bottom:14px}' +
  '.fn-abas button{padding:9px 13px;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px;font-weight:500;font-size:.875rem}' +
  '.fn-abas button.on{color:var(--accent-ink);border-color:var(--accent)}' +
  '.fn-corpo{display:flex;flex-direction:column;gap:14px}' +
  '.fn-barra{display:flex;gap:8px;flex-wrap:wrap;align-items:center}' +
  '.fn-barra .fn-esp{flex:1}' +
  '.fn-seg{display:inline-flex;flex-wrap:wrap;border:1px solid var(--line);border-radius:999px;padding:3px;background:var(--surface-2)}' +
  '.fn-seg button{padding:5px 12px;border-radius:999px;font-size:.8125rem;color:var(--ink-2)}' +
  '.fn-seg button.on{background:var(--surface);color:var(--accent-ink);font-weight:600;box-shadow:var(--shadow)}' +
  '.fn-sel{border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:.8125rem;padding:6px 10px;min-height:34px}' +
  '.fn-in{border:1px solid var(--line);border-radius:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:.875rem;padding:7px 10px;min-height:36px;width:100%;box-sizing:border-box}' +
  '.fn-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}' +
  '.fn-kpi{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px;display:flex;flex-direction:column;gap:3px;text-align:left;min-width:0}' +
  'button.fn-kpi{cursor:pointer;border-color:var(--accent)}' +
  '.fn-kpi .v{font-family:var(--mono);font-size:1.35rem;font-weight:500;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.fn-kpi .s{font-size:.75rem;color:var(--muted)}' +
  '.fn-linha{display:flex;gap:14px;flex-wrap:wrap;align-items:stretch}' +
  '.fn-linha > .card{flex:1 1 340px;min-width:0;margin:0}' +
  '.fn-linha > .card.largo{flex:999 1 560px}' +
  '.fn-good{color:var(--good)}.fn-bad{color:var(--bad)}.fn-warn{color:var(--warn)}.fn-muted{color:var(--muted)}' +
  '.fn-n{font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}' +
  '.fn-lista{display:flex;flex-direction:column}' +
  '.fn-li{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid var(--line-soft);min-width:0}' +
  '.fn-li:first-child{border-top:0}' +
  '.fn-li .g{flex:1;min-width:0}' +
  '.fn-li .g small{display:block;color:var(--muted);font-size:.75rem}' +
  '.fn-bar{height:8px;background:var(--line-soft);border-radius:4px;overflow:hidden;flex:1;min-width:60px}' +
  '.fn-bar i{display:block;height:100%;background:var(--accent);border-radius:4px}' +
  '.fn-bar i.over{background:var(--bad)}.fn-bar i.near{background:var(--warn)}.fn-bar i.tr{background:var(--fn-tr)}' +
  '.fn-pill{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:2px 9px;font-size:.75rem;font-weight:500;background:var(--line-soft);color:var(--ink-2);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}' +
  '.fn-pill.ai{background:var(--accent-soft);color:var(--accent-ink);border:1px dashed var(--accent)}' +
  '.fn-pill.good{background:var(--good-soft);color:var(--good)}.fn-pill.warn{background:var(--warn-soft);color:var(--warn)}.fn-pill.bad{background:var(--bad-soft);color:var(--bad)}' +
  '.fn-pill.tr{background:color-mix(in srgb, var(--fn-tr) 16%, transparent);color:var(--fn-tr)}' +
  'button.fn-pill{cursor:pointer}' +
  '.fn-tab{width:100%;border-collapse:collapse;font-size:.8125rem}' +
  '.fn-tab th{text-align:left;font-family:var(--mono);font-size:.625rem;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:500;padding:6px 8px;border-bottom:1px solid var(--line);white-space:nowrap}' +
  '.fn-tab td{padding:8px;border-bottom:1px solid var(--line-soft);vertical-align:middle}' +
  '.fn-tab td.r,.fn-tab th.r{text-align:right}' +
  '.fn-tab td.r{font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}' +
  '.fn-tab tr.grp td{background:var(--surface-2);font-weight:600}' +
  '.fn-tab tr.clic{cursor:pointer}.fn-tab tr.clic:hover td{background:var(--surface-2)}' +
  '.fn-tab tr.on td{background:var(--accent-soft)}' +
  '.fn-tab .d{font-weight:500;display:block;max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.fn-tab small{color:var(--muted);font-size:.6875rem}' +
  '.fn-scroll{overflow-x:auto}' +
  '.fn-banner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border:1px solid var(--accent);background:var(--accent-soft);border-radius:var(--radius);padding:10px 14px}' +
  '.fn-banner .g{flex:1;min-width:220px}' +
  '.fn-vazio{padding:28px 18px;text-align:center;color:var(--muted);display:flex;flex-direction:column;gap:10px;align-items:center}' +
  '.fn-vazio b{color:var(--ink);font-size:1rem}' +
  '.fn-graf{width:100%;display:block}' +
  '.fn-graf text{font-family:var(--mono);font-size:10px;fill:var(--muted)}' +
  '.fn-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:.75rem;color:var(--ink-2)}' +
  '.fn-leg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}' +
  '.fn-painel{flex:1 1 330px;min-width:0;display:flex;flex-direction:column;gap:10px;position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto}' +
  '.fn-caixa{border:1px solid var(--line);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}' +
  '.fn-caixa.melhor{border-color:var(--accent);background:var(--accent-soft)}' +
  '.fn-campos{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}' +
  '.fn-campo{display:flex;flex-direction:column;gap:4px;min-width:0}' +
  '.fn-campo > span{font-family:var(--mono);font-size:.625rem;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}' +
  '.fn-check{display:flex;gap:8px;align-items:center;font-size:.8125rem}' +
  '.fn-check input{width:16px;height:16px;accent-color:var(--accent)}' +
  '.fn-big{font-family:var(--mono);font-size:2.2rem;font-weight:500;letter-spacing:-.03em;line-height:1.1}' +
  '.fn-comp{display:flex;height:14px;border-radius:6px;overflow:hidden;background:var(--line-soft)}' +
  '.fn-comp i{display:block;height:100%}' +
  '.fn-ov{position:fixed;inset:0;background:rgba(10,20,22,.45);display:flex;align-items:flex-start;justify-content:center;z-index:200;padding:6vh 16px;overflow:auto}' +
  '.fn-mod{background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);width:min(640px,100%);padding:18px 20px;display:flex;flex-direction:column;gap:14px}' +
  '.fn-mod h3{font-size:1.15rem}' +
  '.fn-mod .acoes{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}' +
  '.fn-acoes{display:flex;gap:6px;flex-wrap:wrap;align-items:center}' +
  '.fn-acoes .btn.small,.fn-li .btn.small,.fn-tab .btn.small,.fn-caixa .btn.small,.fn-banner .btn.small{margin-left:0}' +
  '.fn-nota{font-size:.75rem;color:var(--muted);margin:0}' +
  '.fn-spark{display:block}' +
  '.fn-aler{opacity:.55;transition:opacity .15s;pointer-events:none}' +
  '.fn-mod.largo{width:min(780px,100%)}.fn-movdet{display:flex;flex-direction:column;gap:10px}' +
  '.fn-movtab{table-layout:fixed;min-width:860px}.fn-movtab td{overflow:hidden}.fn-movtab .d{max-width:100%}' +
  '.fn-movtab .d2{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.fn-movtab td.r{font-size:.875rem;font-weight:500}.fn-movtab .fn-area{font-size:.75rem;white-space:nowrap;text-overflow:ellipsis}' +
  '.fn-movtab .fn-pill{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle}' +
  '.fn-dq{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:2px 6px 2px 2px;border-radius:999px;border:1px solid transparent;background:none;font:inherit;font-size:.8125rem;color:var(--ink);cursor:pointer;white-space:nowrap;overflow:hidden}' +
  '.fn-dq span:last-child{overflow:hidden;text-overflow:ellipsis}.fn-dq .ib-av{width:22px;height:22px;font-size:.625rem;flex:none}' +
  '.fn-dq:hover{border-color:var(--line);background:var(--ground)}.fn-dq.vazio{color:var(--muted);font-size:.75rem;padding:2px 8px;opacity:.55}' +
  'tr:hover .fn-dq.vazio{opacity:1}' +
  '.fn-movtab tr.fn-tocada td{background:color-mix(in srgb, var(--accent) 11%, transparent);font-weight:600}' +
  '.fn-movtab tr.fn-tocada td:first-child{box-shadow:inset 3px 0 0 var(--accent)}' +
  '.fn-movtab tr.fn-tocada{animation:fnPisca 1.4s ease-out 1}' +
  '@keyframes fnPisca{0%{background:color-mix(in srgb, var(--accent) 38%, transparent)}100%{background:transparent}}' +
  '.fn-movtab td.fn-saldo{font-size:.8125rem;color:var(--ink-2);font-variant-numeric:tabular-nums}.fn-movtab td.fn-saldo.calc{color:var(--muted)}' +
  '.fn-movtab .fn-area.da-conta{color:var(--muted);font-style:italic}' +
  '.fn-dq-avs{display:inline-flex}.fn-dq-avs .ib-av + .ib-av{margin-left:-7px;box-shadow:0 0 0 2px var(--surface)}' +
  '@media (max-width:720px){.fn-big{font-size:1.7rem}.fn-tab .d{max-width:200px}.fn-movtab .d{max-width:100%}}';

/* ---------------- utilitários ---------------- */
function fnEur(v, sinal){
  if (v == null || !isFinite(v)) return '—';
  var s = Math.abs(Number(v)).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  if (Number(v) < 0) return '−' + s;
  return (sinal && Number(v) > 0 ? '+' : '') + s;
}
function fnEur0(v){
  if (v == null || !isFinite(v)) return '—';
  var s = Math.round(Math.abs(v)).toLocaleString('pt-PT') + ' €';
  return Number(v) < 0 ? '−' + s : s;
}
function fnPct(v){ return v == null ? '—' : String(v).replace('.', ',') + '%'; }
var FN_MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
var FN_MESES_L = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function fnMesCurto(ym){ return FN_MESES[Number(ym.slice(5, 7)) - 1]; }
function fnMesLongo(ym){ var n = FN_MESES_L[Number(ym.slice(5, 7)) - 1]; return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + ym.slice(0, 4); }
function fnSomaMes(ym, n){ var a = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n; var d = new Date(a, m, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function fnFimMes(ym){ var d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0); return ym + '-' + String(d.getDate()).padStart(2, '0'); }
function fnHoje(){ var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function fnData(iso){ if (!iso) return '—'; return Number(iso.slice(8, 10)) + ' ' + FN_MESES[Number(iso.slice(5, 7)) - 1] + (iso.slice(0, 4) !== String(new Date().getFullYear()) ? ' ' + iso.slice(2, 4) : ''); }
function fnVar(atual, media){
  if (media == null || !media) return null;
  return Math.round((atual / media - 1) * 1000) / 10;
}

/* h('div', {class:'x', onclick: f}, [filhos]) */
function h(tag, at, filhos){
  var n = document.createElement(tag);
  if (at) Object.keys(at).forEach(function(k){
    var v = at[k];
    if (v == null || v === false) return;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style') n.setAttribute('style', v);
    else if (k.indexOf('on') === 0 && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'value') n.value = v;
    else if (k === 'checked') n.checked = !!v;
    else if (k === 'html') n.innerHTML = v;
    else n.setAttribute(k, v === true ? '' : v);
  });
  [].concat(filhos == null ? [] : filhos).forEach(function(c){
    if (c == null || c === false) return;
    n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  });
  return n;
}
function fnBtn(txt, fn, cls){ return h('button', { type: 'button', class: 'btn' + (cls ? ' ' + cls : ''), onclick: fn }, txt); }
function fnCard(titulo, direita, corpo, cls){
  var hd = h('header', null, [h('h3', null, titulo)]);
  if (direita) hd.appendChild(typeof direita === 'string' ? h('span', { class: 'mono' }, direita) : direita);
  return h('div', { class: 'card' + (cls ? ' ' + cls : '') }, [hd].concat(corpo || []));
}
function fnVazio(titulo, texto, botoes){
  return h('div', { class: 'fn-vazio' }, [h('b', null, titulo), texto ? h('span', null, texto) : null, botoes ? h('div', { class: 'fn-acoes' }, botoes) : null]);
}
function fnAviso(msg){ if (typeof toast === 'function') toast(msg); }

function fnApi(url, metodo, corpo){
  var o = metodo ? { method: metodo, headers: { 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : '{}' } : undefined;
  return apiGestao(url, o).then(function(r){ if (metodo && metodo !== 'GET') fnTocou(url, corpo); return r; });
}
/* Os movimentos em que se acabou de mexer ficam marcados na lista (fundo e
   letra mais forte), para se ver onde se esteve. */
function fnTocou(url, corpo){
  FN.tocados = FN.tocados || {};
  var m = /\/api\/financas\/movimentos\/(\d+)/.exec(url);
  if (m) FN.tocados[Number(m[1])] = true;
  var b = corpo || {};
  [].concat(b.ids || [], b.movimentos || [], b.pares ? [].concat.apply([], b.pares) : [], b.saida ? [b.saida, b.entrada] : []).forEach(function(id){ if (id) FN.tocados[Number(id)] = true; });
}
function fnQs(o){
  return Object.keys(o).filter(function(k){ return o[k] !== '' && o[k] != null; })
    .map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&');
}
function fnFiltro(){ return { ambito: FN.ambito, area: FN.area, mes: FN.mes }; }

/* Depois de gravar: esquece o que estava lido e volta a desenhar. */
function fnMudou(){
  /* Uma mudança feita na janela de um movimento fecha-a: a lista por baixo
     volta a ler-se com o que mudou. */
  if (FN.movJanela) { FN.movJanela.fechar(); FN.movJanela = null; }
  FN.cache = {}; FN.base = null;
  fnRender();
}
function fnLer(chave, url){
  if (FN.cache[chave]) return Promise.resolve(FN.cache[chave]);
  return apiGestao(url).then(function(d){ FN.cache[chave] = d; return d; });
}
function fnBase(){
  if (FN.base) return Promise.resolve(FN.base);
  return apiGestao('/api/financas/base').then(function(d){ FN.base = d; return d; });
}
function fnCat(id){ var cs = (FN.base && FN.base.categorias) || []; for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i]; return null; }
function fnCatNome(id, curto){ var c = fnCat(id); return c ? (curto ? c.nome : c.grupo + ' › ' + c.nome) : '—'; }
function fnConta(id){ var cs = (FN.base && FN.base.contas) || []; for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i]; return null; }
function fnCtx(id){ var cs = (window.G && G.contextos) || []; for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i]; return null; }
function fnCtxNome(id){ var c = fnCtx(id); if (!c) return ''; var p = c.parent_id ? fnCtx(c.parent_id) : null; return p ? p.name + ' › ' + c.name : c.name; }

/* Listas pendentes reutilizáveis. */
function fnSelCategorias(valor, vazio, natureza){
  var s = h('select', { class: 'fn-sel' });
  s.appendChild(h('option', { value: '' }, vazio || '— sem categoria —'));
  var grupos = {};
  ((FN.base && FN.base.categorias) || []).filter(function(c){ return c.ativo && (!natureza || c.natureza === natureza); }).forEach(function(c){
    var k = c.grupo; (grupos[k] = grupos[k] || []).push(c);
  });
  Object.keys(grupos).forEach(function(g){
    var og = h('optgroup', { label: g });
    grupos[g].forEach(function(c){ og.appendChild(h('option', { value: c.id }, c.nome)); });
    s.appendChild(og);
  });
  if (valor) s.value = String(valor);
  return s;
}
function fnSelAreas(valor, vazio){
  var s = h('select', { class: 'fn-sel' });
  s.appendChild(h('option', { value: '' }, vazio || '— sem área —'));
  var cs = ((window.G && G.contextos) || []).filter(function(c){ return c.active !== false; });
  cs.filter(function(c){ return !c.parent_id; }).forEach(function(a){
    s.appendChild(h('option', { value: a.id }, a.name));
    cs.filter(function(c){ return c.parent_id === a.id; }).forEach(function(sub){ s.appendChild(h('option', { value: sub.id }, '   ' + a.name + ' › ' + sub.name)); });
  });
  if (valor) s.value = String(valor);
  return s;
}
function fnSelContas(valor, vazio){
  var s = h('select', { class: 'fn-sel' });
  if (vazio !== false) s.appendChild(h('option', { value: '' }, vazio || 'Todas as contas'));
  ((FN.base && FN.base.contas) || []).filter(function(c){ return c.ativo; }).forEach(function(c){ s.appendChild(h('option', { value: c.id }, c.nome)); });
  if (valor) s.value = String(valor);
  return s;
}
var FN_TIPOS = [['ordem','À ordem'],['cartao','Cartão de crédito'],['poupanca','Poupança'],['investimento','Investimento'],['dinheiro','Dinheiro'],['empresa','Empresa'],['outra','Outra']];
function fnTipoNome(t){ for (var i = 0; i < FN_TIPOS.length; i++) if (FN_TIPOS[i][0] === t) return FN_TIPOS[i][1]; return t; }

/* ---------------- janela ---------------- */
function fnJanela(titulo, corpo, botoes){
  var ov = h('div', { class: 'fn-ov' });
  var mod = h('div', { class: 'fn-mod', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo });
  var fechar = function(){ if (ov.parentNode) ov.parentNode.removeChild(ov); };
  mod.appendChild(h('h3', null, titulo));
  [].concat(corpo).forEach(function(c){ if (c) mod.appendChild(c); });
  var ac = h('div', { class: 'acoes' });
  (botoes || []).forEach(function(b){
    ac.appendChild(fnBtn(b.txt, function(){
      var r = b.fn ? b.fn() : true;
      if (r && typeof r.then === 'function') r.then(function(ok){ if (ok !== false) fechar(); });
      else if (r !== false) fechar();
    }, b.pri ? 'primary' : ''));
  });
  ac.appendChild(fnBtn(botoes && botoes.length ? 'Cancelar' : 'Fechar', fechar));
  mod.appendChild(ac);
  ov.appendChild(mod);
  ov.addEventListener('click', function(e){ if (e.target === ov) fechar(); });
  ov.addEventListener('keydown', function(e){ if (e.key === 'Escape') fechar(); });
  document.body.appendChild(ov);
  var f = mod.querySelector('input, select, textarea'); if (f) setTimeout(function(){ f.focus(); }, 30);
  return { fechar: fechar };
}
function fnCampo(rot, ctrl){ return h('label', { class: 'fn-campo' }, [h('span', null, rot), ctrl]); }
function fnErro(e){ fnAviso((e && e.message) || 'Não foi possível.'); return false; }

/* ---------------- gráficos ---------------- */
function fnSvg(w, hgt, filhos, rotulo){
  var ns = 'http://www.w3.org/2000/svg';
  var s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 ' + w + ' ' + hgt); s.setAttribute('class', 'fn-graf');
  s.setAttribute('role', 'img'); if (rotulo) s.setAttribute('aria-label', rotulo);
  s.setAttribute('preserveAspectRatio', 'none');
  s.innerHTML = filhos.join('');
  return s;
}
function fnEsc(t){ return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
/* Duas barras por mês: entradas e despesas. */
function fnGrafPares(serie){
  var W = 720, H = 200, base = 176, top = 10;
  var max = Math.max.apply(null, serie.map(function(s){ return Math.max(s.entradas, s.despesas); }).concat([1]));
  var passo = (W - 40) / serie.length, larg = Math.min(14, passo / 3);
  var p = ['<line x1="36" y1="' + base + '" x2="' + W + '" y2="' + base + '" stroke="var(--line)"/>'];
  [0.5, 1].forEach(function(f){ var y = base - (base - top) * f; p.push('<line x1="36" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="var(--line-soft)"/><text x="0" y="' + (y + 3) + '">' + fnEsc(fnK(max * f)) + '</text>'); });
  serie.forEach(function(s, i){
    var x = 40 + i * passo + passo / 2;
    var he = (base - top) * s.entradas / max, hd = (base - top) * s.despesas / max;
    p.push('<rect x="' + (x - larg - 1) + '" y="' + (base - he) + '" width="' + larg + '" height="' + he + '" rx="2" fill="var(--fn-in)"><title>' + fnMesCurto(s.mes) + ' · entradas ' + fnEur(s.entradas) + '</title></rect>');
    p.push('<rect x="' + (x + 1) + '" y="' + (base - hd) + '" width="' + larg + '" height="' + hd + '" rx="2" fill="var(--fn-out)"><title>' + fnMesCurto(s.mes) + ' · despesas ' + fnEur(s.despesas) + '</title></rect>');
    p.push('<text x="' + x + '" y="' + (H - 6) + '" text-anchor="middle">' + fnMesCurto(s.mes) + '</text>');
  });
  return fnSvg(W, H, p, 'Entradas e despesas por mês');
}
function fnK(v){ return v >= 1000 ? (Math.round(v / 100) / 10).toString().replace('.', ',') + 'k' : String(Math.round(v)); }
/* Uma ou mais linhas: [{pontos:[n], cor, tracejado, area}] sobre rótulos. */
function fnGrafLinhas(series, rotulos, rotuloAria){
  var W = 720, H = 210, base = 182, top = 12, esq = 44;
  var todos = [].concat.apply([], series.map(function(s){ return s.pontos.filter(function(v){ return v != null; }); }));
  var max = Math.max.apply(null, todos.concat([1])), min = Math.min.apply(null, todos.concat([0]));
  if (min > 0) min = 0;
  var n = rotulos.length, dx = (W - esq - 10) / Math.max(1, n - 1);
  var y = function(v){ return base - (base - top) * (v - min) / ((max - min) || 1); };
  var p = ['<line x1="' + esq + '" y1="' + y(min) + '" x2="' + W + '" y2="' + y(min) + '" stroke="var(--line)"/>'];
  [0.5, 1].forEach(function(f){ var v = min + (max - min) * f; p.push('<line x1="' + esq + '" y1="' + y(v) + '" x2="' + W + '" y2="' + y(v) + '" stroke="var(--line-soft)"/><text x="0" y="' + (y(v) + 3) + '">' + fnEsc(fnK(v)) + '</text>'); });
  if (min < 0) p.push('<line x1="' + esq + '" y1="' + y(0) + '" x2="' + W + '" y2="' + y(0) + '" stroke="var(--line)" stroke-dasharray="2 3"/>');
  series.forEach(function(s){
    var pts = [];
    s.pontos.forEach(function(v, i){ if (v != null) pts.push((esq + i * dx).toFixed(1) + ',' + y(v).toFixed(1)); });
    if (!pts.length) return;
    if (s.area) p.push('<polygon points="' + pts[0].split(',')[0] + ',' + y(Math.max(0, min)) + ' ' + pts.join(' ') + ' ' + pts[pts.length - 1].split(',')[0] + ',' + y(Math.max(0, min)) + '" fill="var(--accent-soft)"/>');
    p.push('<polyline fill="none" stroke="' + s.cor + '" stroke-width="2.4"' + (s.tracejado ? ' stroke-dasharray="5 4"' : '') + ' points="' + pts.join(' ') + '"/>');
    if (s.ponto) { var u = pts[pts.length - 1].split(','); p.push('<circle cx="' + u[0] + '" cy="' + u[1] + '" r="4" fill="' + s.cor + '"/>'); }
  });
  var cada = Math.ceil(n / 8);
  rotulos.forEach(function(r, i){ if (i % cada === 0 || i === n - 1) p.push('<text x="' + (esq + i * dx) + '" y="' + (H - 4) + '" text-anchor="middle">' + fnEsc(r) + '</text>'); });
  return fnSvg(W, H, p, rotuloAria);
}
/* Barras empilhadas por grupo, mês a mês. */
var FN_CORES = ['var(--fn-in)', 'var(--fn-out)', 'var(--fn-c3)', 'var(--fn-c4)', 'var(--fn-c5)'];
function fnGrafEmpilhado(mensal, grupos){
  var W = 720, H = 220, base = 196, top = 10;
  var tot = mensal.map(function(m){ return grupos.reduce(function(s, g){ return s + (m.grupos[g] || 0); }, 0); });
  var max = Math.max.apply(null, tot.concat([1]));
  var passo = (W - 40) / mensal.length, larg = Math.min(30, passo * 0.6);
  var p = ['<line x1="36" y1="' + base + '" x2="' + W + '" y2="' + base + '" stroke="var(--line)"/>'];
  [0.5, 1].forEach(function(f){ var yy = base - (base - top) * f; p.push('<line x1="36" y1="' + yy + '" x2="' + W + '" y2="' + yy + '" stroke="var(--line-soft)"/><text x="0" y="' + (yy + 3) + '">' + fnEsc(fnK(max * f)) + '</text>'); });
  mensal.forEach(function(m, i){
    var x = 40 + i * passo + (passo - larg) / 2, yy = base;
    grupos.forEach(function(g, k){
      var v = m.grupos[g] || 0; if (!v) return;
      var hh = (base - top) * v / max; yy -= hh;
      p.push('<rect x="' + x + '" y="' + yy + '" width="' + larg + '" height="' + hh + '" fill="' + FN_CORES[k % 5] + '"><title>' + fnEsc(fnMesCurto(m.mes) + ' · ' + g + ' ' + fnEur(v)) + '</title></rect>');
    });
    p.push('<text x="' + (x + larg / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + fnMesCurto(m.mes) + '</text>');
  });
  return fnSvg(W, H, p, 'Despesa mensal por grupo');
}
function fnSpark(vals, alto){
  var W = 84, H = 22, max = Math.max.apply(null, vals.concat([1]));
  var d = W / vals.length;
  var p = vals.map(function(v, i){
    var hh = Math.max(1, (H - 2) * v / max);
    var ult = i === vals.length - 1;
    return '<rect x="' + (i * d + 0.5).toFixed(1) + '" y="' + (H - hh) + '" width="' + Math.max(2, d - 1.5).toFixed(1) + '" height="' + hh + '" rx="1" fill="' + (ult && alto ? 'var(--fn-out)' : ult ? 'var(--accent)' : 'color-mix(in srgb, var(--accent) 35%, transparent)') + '"/>';
  });
  var s = fnSvg(W, H, p, 'Últimos meses');
  s.setAttribute('width', W); s.setAttribute('height', H); s.setAttribute('class', 'fn-spark'); s.removeAttribute('preserveAspectRatio');
  return s;
}
function fnBarra(pct, cls){
  return h('div', { class: 'fn-bar' }, [h('i', { class: cls || (pct > 100 ? 'over' : pct >= 90 ? 'near' : ''), style: 'width:' + Math.max(0, Math.min(100, pct || 0)) + '%' })]);
}

/* ---------------- montagem ---------------- */
function fnMontar(){
  if (!document.getElementById('fnCss')){
    var st = document.createElement('style'); st.id = 'fnCss'; st.textContent = FN_CSS; document.head.appendChild(st);
  }
  if (window.TITLES){
    TITLES.financas = ['Finanças', 'O que entra e sai · pessoal e profissional'];
    TITLES.patrimonio = ['Património', 'O que se tem, o que se deve e o que nos devem'];
  }
  var falta = false;
  ['financas', 'patrimonio'].forEach(function(v){
    var sec = document.getElementById('view-' + v);
    if (!sec){ falta = true; return; }
    if (!document.getElementById('fnt-' + v)){
      var abas = h('div', { class: 'fn-abas', id: 'fnt-' + v, role: 'tablist' });
      sec.insertBefore(abas, sec.firstChild);
      var corpo = h('div', { class: 'fn-corpo', id: 'fnc-' + v });
      sec.insertBefore(corpo, abas.nextSibling);
    }
  });
  FN.montado = !falta;
  if (falta && FN.tentativas++ < 40) setTimeout(fnMontar, 400);
  if (!falta) fnRender();
}

function fnVistaAtiva(){
  var s = document.querySelector('.view.is-active');
  if (!s) return null;
  if (s.id === 'view-financas') return 'financas';
  if (s.id === 'view-patrimonio') return 'patrimonio';
  return null;
}

function fnRender(qual){
  ['financas', 'patrimonio'].forEach(function(v){
    var abas = document.getElementById('fnt-' + v), corpo = document.getElementById('fnc-' + v), sec = document.getElementById('view-' + v);
    if (!abas || !corpo || !sec) return;
    var aba = FN.aba[v];
    /* O area-tarefas.js põe a caixa dele no topo da secção; os separadores
       ficam sempre por cima dela. */
    if (sec.firstChild !== abas) sec.insertBefore(abas, sec.firstChild);
    if (abas.nextSibling !== corpo) sec.insertBefore(corpo, abas.nextSibling);
    clear(abas);
    FN_ABAS[v].forEach(function(a){
      abas.appendChild(h('button', { type: 'button', role: 'tab', 'aria-selected': a[0] === aba ? 'true' : 'false', class: a[0] === aba ? 'on' : '',
        onclick: function(){ FN.aba[v] = a[0]; fnGuardar(); fnRender(v); } }, a[1]));
    });
    sec.classList.toggle('fn-on', aba !== 'area');
    if (aba === 'area') { clear(corpo); return; }
    /* Só se pede ao servidor o que está à vista. */
    if (qual && qual !== v) return;
    if (!qual && fnVistaAtiva() !== v) return;
    /* Enquanto se lê, fica o ecrã que lá estava, esbatido: não pisca nem
       salta para o topo. Com a base já lida, desenha-se logo. */
    var desenhar = function(){
      try {
        corpo.classList.remove('fn-aler');
        clear(corpo);
        var fnDesenho = window['fn_' + v + '_' + aba];
        if (typeof fnDesenho === 'function') fnDesenho(corpo);
      } catch (e) { console.error('[farol] finanças ' + v + '/' + aba, e); clear(corpo); corpo.appendChild(fnVazio('Este ecrã falhou a desenhar.', e.message)); }
    };
    if (FN.base) { desenhar(); return; }
    if (corpo.firstChild) corpo.classList.add('fn-aler');
    else corpo.appendChild(h('p', { class: 'fn-nota' }, 'A ler…'));
    fnBase().then(desenhar, function(e){
      corpo.classList.remove('fn-aler');
      clear(corpo); corpo.appendChild(fnVazio('Não foi possível ler as finanças.', e.message, [fnBtn('Tentar outra vez', function(){ fnMudou(); })]));
    });
  });
}
/* Desenha o que vem de uma promessa sem confundir um erro de leitura com
   um erro de desenho (o desenho fica no segundo .then). */
function fnCarregar(alvo, promessa, desenhar){
  var aguarda = h('p', { class: 'fn-nota' }, 'A ler…');
  alvo.appendChild(aguarda);
  promessa.then(function(d){ return d; }, function(e){
    if (aguarda.parentNode) aguarda.parentNode.replaceChild(fnVazio('Não foi possível ler.', e.message, [fnBtn('Tentar outra vez', fnMudou)]), aguarda);
    return null;
  }).then(function(d){
    if (!d) return;
    if (aguarda.parentNode) aguarda.parentNode.removeChild(aguarda);
    desenhar(d);
  });
}

/* A barra de filtros das Finanças: âmbito, área e mês. */
function fnBarraFiltros(corpo, comMes, extra){
  var b = h('div', { class: 'fn-barra' });
  var seg = h('div', { class: 'fn-seg', role: 'group', 'aria-label': 'Âmbito' });
  [['tudo','Tudo'],['pessoal','Pessoal'],['profissional','Profissional']].forEach(function(o){
    seg.appendChild(h('button', { type: 'button', class: FN.ambito === o[0] ? 'on' : '', onclick: function(){ FN.ambito = o[0]; FN.cache = {}; fnGuardar(); fnRender(); } }, o[1]));
  });
  b.appendChild(seg);
  var sa = fnSelAreas(FN.area, 'Todas as áreas');
  sa.setAttribute('aria-label', 'Área');
  sa.addEventListener('change', function(){ FN.area = sa.value; FN.cache = {}; fnRender(); });
  b.appendChild(sa);
  if (comMes){
    var m = h('div', { class: 'fn-acoes' }, [
      h('button', { type: 'button', class: 'btn small', 'aria-label': 'Mês anterior', onclick: function(){ FN.mes = fnSomaMes(FN.mes, -1); fnRender(); } }, '‹'),
      h('b', { style: 'min-width:120px;text-align:center;font-size:.875rem' }, fnMesLongo(FN.mes)),
      h('button', { type: 'button', class: 'btn small', 'aria-label': 'Mês seguinte', onclick: function(){ FN.mes = fnSomaMes(FN.mes, 1); fnRender(); } }, '›')
    ]);
    b.appendChild(m);
  }
  b.appendChild(h('span', { class: 'fn-esp' }));
  (extra || []).forEach(function(x){ b.appendChild(x); });
  corpo.appendChild(b);
}

/* Liga-se ao resto da app sem lhe mexer: embrulha o show() e o renderGestao(). */
(function(){
  if (typeof show === 'function'){
    var _fnShow = show;
    show = function(v){ _fnShow(v); if (v === 'financas' || v === 'patrimonio'){ if (!FN.montado) fnMontar(); else fnRender(v); } };
  }
  if (typeof renderGestao === 'function'){
    var _fnRG = renderGestao;
    renderGestao = function(){ _fnRG(); if (!FN.montado) fnMontar(); };
  }
  setTimeout(fnMontar, 300);
})();
