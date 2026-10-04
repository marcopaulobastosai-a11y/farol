'use strict';
/* Farol — Eventos.
 *
 * O que está marcado, visto de cima: as datas de todas as áreas na mesma
 * lista, mais os lembretes e os aniversários — que são eventos e não tarefas.
 *
 * Nas áreas cada uma mostra o que é seu (area-tarefas.js); aqui vê-se tudo
 * junto, por mês, e marca-se uma data para a área que se quiser.
 *
 * Como os outros módulos, não toca no app.js: faz o seu botão no menu e o seu
 * ecrã, e reaproveita os globais ($, el, clear, toast, apiGestao, D, G).
 */

var EV = { montado: false, filtro: { onde: 'tudo', quando: 'proximos' } };
try { EV.filtro = JSON.parse(localStorage.getItem('evFiltro') || 'null') || EV.filtro; } catch (e) {}
function evGuardar(){ try { localStorage.setItem('evFiltro', JSON.stringify(EV.filtro)); } catch (e) {} }

var EV_CSS =
  '#view-eventos .ev-mes{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;' +
  'text-transform:uppercase;color:var(--muted);padding:14px 16px 4px;display:flex;gap:8px;font-weight:500}' +
  '#view-eventos .ev-mes span{color:var(--faint)}' +
  '#view-eventos .ev-mes.agora{color:var(--accent-ink)}' +
  '#view-eventos .tf-rows{padding:0 10px}';

var EV_QUANDO = [
  ['proximos', 'O que vem aí'],
  ['mes', 'Este mês'],
  ['d90', '90 dias'],
  ['ano', 'Este ano'],
  ['passados', 'Já passaram'],
  ['tudo', 'Tudo']
];

function evMontar(){
  if (EV.montado) return;
  EV.montado = true;

  var st = document.createElement('style'); st.id = 'evCss'; st.textContent = EV_CSS;
  document.head.appendChild(st);

  if (window.TITLES) TITLES.eventos = ['Eventos', 'O que está marcado, de todas as áreas'];

  var nav = document.getElementById('nav');
  if (nav && !nav.querySelector('[data-view="eventos"]')){
    var b = el('button', null, ' Eventos');
    b.dataset.view = 'eventos';
    b.insertBefore(evIcone(), b.firstChild);
    var agenda = nav.querySelector('[data-view="agenda"]');
    if (agenda) nav.insertBefore(b, agenda.nextSibling); else nav.appendChild(b);
  }

  var sec = el('section', 'view'); sec.id = 'view-eventos';
  sec.appendChild(el('div', 'stack')).id = 'evCaixa';
  var docs = document.getElementById('view-documentos');
  if (docs) docs.parentNode.insertBefore(sec, docs);
  else document.querySelector('main').appendChild(sec);
}

function evIcone(){
  var s = document.createElement('span');
  s.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' +
    '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none"/></svg>';
  return s.firstChild;
}

function evAreas(){
  return ((window.G && G.contextos) || []).filter(function(c){ return !c.parent_id; });
}
/* Uma area de topo e as sub-areas dela: um evento da «Quinta do Anjo» conta
   para a Casa. */
function evIdsDaArea(id){
  var ids = [id];
  ((window.G && G.contextos) || []).forEach(function(c){ if (c.parent_id === id) ids.push(c.id); });
  return ids;
}

function evLista(){
  var f = EV.filtro;
  var hoje = tfISO(tfHoje());
  var ids = null;
  if (f.onde !== 'tudo' && f.onde !== 'sem') ids = evIdsDaArea(Number(f.onde));

  function passaOnde(ctx){
    if (f.onde === 'tudo') return true;
    if (f.onde === 'sem') return !ctx;
    return ids.indexOf(ctx) >= 0;
  }
  function passaQuando(dia){
    if (f.quando === 'tudo') return true;
    if (f.quando === 'proximos') return dia >= hoje;
    if (f.quando === 'passados') return dia < hoje;
    var h = tfHoje();
    if (f.quando === 'mes') return dia >= tfISO(new Date(h.getFullYear(), h.getMonth(), 1)) &&
      dia <= tfISO(new Date(h.getFullYear(), h.getMonth() + 1, 0));
    if (f.quando === 'ano') return dia >= h.getFullYear() + '-01-01' && dia <= h.getFullYear() + '-12-31';
    return dia >= hoje && dia <= tfISO(tfMais(h, 90));
  }

  var out = [];
  ((window.D && D.events) || []).forEach(function(e){
    var real = typeof e.id === 'number';
    if (e.ocupado) return;   /* o tempo do trabalho: so a Agenda o desenha */
    /* Um evento de varios dias que ja comecou ainda esta a acontecer. */
    var dia = f.quando === 'proximos' && e.ends_on && e.ends_on > e.day ? e.ends_on : e.day;
    if (!passaOnde(real ? e.context_id : null) || !passaQuando(dia)) return;
    out.push({ id: e.id, title: e.title, day: e.day, at: e.at, detail: e.detail,
               location: e.location, tentative: e.tentative, pessoas: e.pessoas,
               remind_min: e.remind_min, quando: real ? evjQuandoTxt(e) : null,
               context_id: e.context_id, onde: real ? areaNome(e.context_id) : 'aniversário',
               apagavel: real, orig: e });
  });
  ((window.G && G.tasks) || []).forEach(function(t){
    if (tfTipo(t) !== 'lembrete' || tfFechada(t) || !t.due_on) return;
    if (!passaOnde(t.context_id) || !passaQuando(t.due_on)) return;
    out.push({ title: t.title, day: t.due_on, at: t.due_time, tipo: 'lembrete', tarefa: t.id,
               context_id: t.context_id, onde: areaNome(t.context_id), dono: pessoa(t.owner_id),
               repete: t.repeat_rule ? (t.repeat_label || 'repete') : null });
  });
  out.sort(function(x, y){
    if (x.day !== y.day) return x.day < y.day ? -1 : 1;
    return String(x.at || '').localeCompare(String(y.at || ''));
  });
  if (f.quando === 'passados') out.reverse();
  return out;
}

function evRender(){
  evBotaoNaAgenda();
  if (!document.getElementById('view-eventos')) return;
  if (!window.D || !D.events || typeof aeLinhaEvento !== 'function') return;
  var box = document.getElementById('evCaixa');
  if (!box) return;
  clear(box);
  var f = EV.filtro;

  /* ---- filtros ---- */
  var barra = el('div', 'card ae-filtros');
  var fl1 = el('div', 'ae-fl');
  fl1.appendChild(el('span', 'ae-lbl', 'Onde'));
  var c1 = el('div', 'ae-chips'); fl1.appendChild(c1);
  function chip(caixa, nome, ligado, fn){
    var b = el('button', 'ae-chip' + (ligado ? ' on' : ''), nome);
    b.type = 'button';
    b.addEventListener('click', fn);
    caixa.appendChild(b);
    return b;
  }
  chip(c1, 'Tudo', f.onde === 'tudo', function(){ EV.filtro.onde = 'tudo'; evGuardar(); evRender(); });
  evAreas().forEach(function(c){
    chip(c1, c.name, f.onde === String(c.id), function(){ EV.filtro.onde = String(c.id); evGuardar(); evRender(); });
  });
  chip(c1, 'Sem área', f.onde === 'sem', function(){ EV.filtro.onde = 'sem'; evGuardar(); evRender(); });
  barra.appendChild(fl1);

  var fl2 = el('div', 'ae-fl');
  fl2.appendChild(el('span', 'ae-lbl', 'Quando'));
  var c2 = el('div', 'ae-chips'); fl2.appendChild(c2);
  EV_QUANDO.forEach(function(q){
    chip(c2, q[1], f.quando === q[0], function(){ EV.filtro.quando = q[0]; evGuardar(); evRender(); });
  });
  barra.appendChild(fl2);
  box.appendChild(barra);

  /* ---- a lista, por mes ---- */
  var lista = evLista();
  var card = el('div', 'card');
  var h = el('header');
  h.appendChild(el('h3', null, 'Marcado'));
  h.appendChild(el('span', 'mono', lista.length ? lista.length + (lista.length === 1 ? ' data' : ' datas') : ''));
  var bNovo = el('button', 'btn primary', '+ Marcar uma data');
  bNovo.type = 'button';
  bNovo.addEventListener('click', function(){ evJanela(null); });
  h.appendChild(bNovo);
  card.appendChild(h);

  if (!lista.length){
    card.appendChild(el('p', 'ae-vazio', 'Nada marcado no que está filtrado.'));
  } else {
    var mesAgora = tfISO(tfHoje()).slice(0, 7);
    var mes = null, rows = null;
    lista.forEach(function(x){
      var m = x.day.slice(0, 7);
      if (m !== mes){
        mes = m;
        var p = m.split('-');
        var t = el('h4', 'ev-mes' + (m === mesAgora ? ' agora' : ''), MESES[Number(p[1]) - 1] + ' ' + p[0]);
        t.appendChild(el('span', null, String(lista.filter(function(y){ return y.day.slice(0, 7) === m; }).length)));
        card.appendChild(t);
        rows = el('div', 'tf-rows');
        card.appendChild(rows);
      }
      rows.appendChild(aeLinhaEvento(x));
    });
  }
  box.appendChild(card);
}

/* ------------------------------------------------------------------ *
 * A janela de um evento: marcar e corrigir (28 set)
 *
 * Marcar era um titulo, um dia, uma hora e uma nota. Para uma consulta ou
 * uma reuniao faltava o que se pergunta logo a seguir: quanto tempo leva,
 * onde e, quem vai, quando e que a app me lembra, e os papeis que e preciso
 * levar. A mesma janela serve para marcar e para corrigir - clicar num evento
 * da lista abre-a com o que la esta - e e chamada da Agenda, dos Eventos, do
 * ecra de cada area e do aviso do Hoje.
 *
 * O lembrete nao finge ser uma notificacao: o evento entra no Hoje, em
 * «Precisa de ti», a partir da hora escolhida. A janela di-lo com a data.
 * ------------------------------------------------------------------ */

var EVJ_CSS = [
  '.evj{border:none;border-radius:14px;padding:0;width:min(560px,calc(100% - 2rem));max-height:92vh;box-shadow:0 18px 48px rgba(15,23,32,.22);background:transparent}',
  '.evj::backdrop{background:rgba(15,23,32,.38)}',
  '.evj-c{background:var(--surface);border-radius:14px;padding:18px 20px;display:flex;flex-direction:column;gap:12px;max-height:92vh;overflow:auto;box-sizing:border-box}',
  '.evj-c h3{margin:0;font-size:1.0625rem}',
  '.evj-c label,.evj-lbl{display:block;font-size:.75rem;color:var(--muted);margin-bottom:4px}',
  '.evj-c input[type=text],.evj-c input[type=date],.evj-c input[type=time],.evj-c select,.evj-c textarea{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid var(--line);border-radius:8px;background:var(--ground);color:var(--ink);font:inherit;font-size:.875rem}',
  '.evj-c textarea{min-height:64px;resize:vertical}',
  '.evj-c input:focus,.evj-c select:focus,.evj-c textarea:focus{outline:0;border-color:var(--accent)}',
  '.evj-g{display:grid;grid-template-columns:1fr 1fr;gap:10px 12px}',
  '.evj-g3{display:grid;grid-template-columns:1.3fr 1fr 1.2fr;gap:10px 12px}',
  '.evj-larga{grid-column:1 / -1}',
  '.evj-sec{border-top:1px solid var(--line-soft,var(--line));padding-top:12px}',
  '.evj-sec > .evj-lbl{font-family:var(--mono);font-size:.6875rem;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin-bottom:8px}',
  '.evj-c label.evj-chk{display:inline-flex;align-items:center;gap:6px;font-size:.8125rem;color:var(--ink-2,var(--ink));cursor:pointer;margin:0}',
  '.evj-chk input{margin:0;accent-color:var(--accent)}',
  '.evj-linha{display:flex;align-items:center;gap:14px;flex-wrap:wrap}',
  '.evj-dica{font-size:.75rem;color:var(--muted);margin-top:4px;min-height:1em}',
  '.evj-dica a{color:var(--accent-ink)}',
  '.evj-pes{display:flex;flex-wrap:wrap;gap:6px}',
  '.evj-pes button{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--ground);border-radius:99px;padding:4px 10px 4px 6px;font:inherit;font-size:.8125rem;color:var(--ink-2,var(--ink));cursor:pointer}',
  '.evj-pes button .evj-av{width:18px;height:18px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:600;color:#fff;flex:none}',
  '.evj-pes button.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-ink);font-weight:500}',
  '.evj-pend{display:flex;flex-direction:column;gap:2px;margin-bottom:4px}',
  '.evj-pend .ax-lin small{color:var(--muted);font-size:.7rem}',
  '.evj-drop.sobre{outline:2px dashed var(--accent);outline-offset:4px;border-radius:8px}',
  '.evj-acoes{display:flex;align-items:center;justify-content:flex-end;gap:8px;border-top:1px solid var(--line-soft,var(--line));padding-top:12px}',
  '.evj-acoes .btn{flex:none;width:auto;margin-left:0}',
  /* O bloco dos anexos tem os seus tamanhos: as regras largas de cima nao lhe tocam. */
  '.evj-c .ax select.ax-papel{width:auto;padding:1px 4px 1px 6px;font-family:var(--mono);font-size:.625rem;border-radius:99px;background:var(--surface-2)}',
  '.evj-c .ax-proc input{padding:5px 8px;font-size:.75rem}',
  '.evj-acoes .btn.esq{margin-right:auto}',
  '.evj-acoes .apagar{color:var(--bad)}',
  '.evj-erro{color:var(--bad);font-size:.8125rem}',
  '@media (max-width:560px){.evj-g,.evj-g3{grid-template-columns:1fr}}'
].join('\n');

var EVJ_DURACOES = [
  ['', '—'], ['15', '15 min'], ['30', '30 min'], ['45', '45 min'], ['60', '1 h'], ['90', '1 h 30'],
  ['120', '2 h'], ['150', '2 h 30'], ['180', '3 h'], ['240', '4 h'], ['360', '6 h'], ['480', '8 h'],
  ['outra', 'termina às…']
];
var EVJ_LEMBRETES_HORA = [
  ['', 'Sem lembrete'], ['0', 'À hora'], ['15', '15 min antes'], ['30', '30 min antes'],
  ['60', '1 h antes'], ['120', '2 h antes'], ['1440', '1 dia antes'], ['2880', '2 dias antes'],
  ['10080', '1 semana antes']
];
var EVJ_LEMBRETES_DIA = [
  ['', 'Sem lembrete'], ['0', 'No próprio dia'], ['1440', '1 dia antes'], ['2880', '2 dias antes'],
  ['4320', '3 dias antes'], ['10080', '1 semana antes'], ['20160', '2 semanas antes']
];

function evjEstilo(){
  if (document.getElementById('evjCss')) return;
  var s = document.createElement('style');
  s.id = 'evjCss';
  s.textContent = EVJ_CSS;
  document.head.appendChild(s);
}

function evjFechar(){
  var d = document.getElementById('evjDlg');
  if (d){ try { d.close(); } catch (e) {} d.remove(); }
}

/* 'HH:MM' <-> minutos desde a meia-noite. */
function evjMin(h){
  if (!h || !/^\d{2}:\d{2}$/.test(h)) return null;
  return Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
}
function evjHora(m){
  m = ((m % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
function evjDurTxt(m){
  if (!m) return '';
  var h = Math.floor(m / 60), r = m % 60;
  return (h ? h + ' h' : '') + (h && r ? ' ' : '') + (r ? r + ' min' : '');
}

/* O texto curto de quando e, para a linha da lista: «10:00–11:30»,
   «dia inteiro», «até 6 out». */
function evjQuandoTxt(e){
  if (!e) return '';
  var p = [];
  if (e.at){
    var ini = evjMin(e.at);
    p.push(e.duration_min && ini !== null ? e.at + '–' + evjHora(ini + Number(e.duration_min)) : e.at);
  }
  if (e.ends_on && e.ends_on !== e.day){
    var d = parseDay(e.ends_on);
    p.push('até ' + d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3).toLowerCase());
  }
  return p.join(' · ');
}

/* Quando e que o lembrete entra no Hoje, dito em portugues. */
function evjAvisoTxt(dia, hora, remind){
  if (remind === '' || remind === null || remind === undefined || !dia) return '';
  var base = parseDay(dia);
  var m = hora ? evjMin(hora) : 9 * 60;
  var quando = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, m - Number(remind));
  var dd = quando.getDate() + ' ' + MESES[quando.getMonth()].slice(0, 3).toLowerCase();
  var hh = String(quando.getHours()).padStart(2, '0') + ':' + String(quando.getMinutes()).padStart(2, '0');
  var dia7 = (typeof DIAS !== 'undefined' && DIAS[(quando.getDay() + 6) % 7]) || '';
  return 'Aparece no Hoje, em «Precisa de ti», a partir de ' + (dia7 ? dia7.toLowerCase().slice(0, 3) + ' ' : '') + dd + ' às ' + hh + '.';
}

/* As contas Google de cada pessoa: quem pode receber copias. */
var EVJ_CONTAS = null;
function evjContasGoogle(){
  if (window.AG && AG.google && Object.keys(AG.google).length) return AG.google;
  return EVJ_CONTAS;
}
function evjLerContas(depois){
  if (typeof apiGestao !== 'function') return;
  apiGestao('/api/google/estado').then(function(r){
    EVJ_CONTAS = {};
    ((r && r.contas) || []).forEach(function(c){ EVJ_CONTAS[c.person_id] = c; });
    if (depois) depois();
  }).catch(function(){});
}
function evjGoogleTxt(g){
  if (!g) return '';
  var t = [];
  if (g.copiados && g.copiados.length) t.push('No Google de ' + g.copiados.join(', ') + '.');
  if (g.falhas && g.falhas.length) t.push('O Google falhou: ' + g.falhas.join('; ') + '.');
  return t.length ? ' ' + t.join(' ') : '';
}

function evjPessoas(){
  var ps = (window.G && G.people) || (window.D && D.people) || [];
  return ps.filter(function(p){ return p.active !== false; });
}

function evjSelect(ops, v){
  var s = el('select');
  ops.forEach(function(o){ s.appendChild(new Option(o[1], o[0])); });
  if (v !== undefined && v !== null) s.value = String(v);
  return s;
}

function evjAreas(v){
  var s = el('select');
  s.appendChild(new Option('— sem área —', ''));
  evAreas().forEach(function(a){
    var g = document.createElement('optgroup');
    g.label = a.name;
    g.appendChild(new Option(a.name + ' · geral', String(a.id)));
    ((window.G && G.contextos) || []).filter(function(c){ return c.parent_id === a.id; }).forEach(function(c){
      g.appendChild(new Option(c.name, String(c.id)));
    });
    s.appendChild(g);
  });
  s.value = v ? String(v) : '';
  return s;
}

function evjCampo(pai, rotulo, elemento, cls){
  var w = el('div', cls || null);
  if (rotulo) w.appendChild(el('label', null, rotulo));
  w.appendChild(elemento);
  pai.appendChild(w);
  return w;
}

/* ev: o evento a corrigir (de D.events), ou null para marcar um novo.
   opts.context_id: a area proposta; opts.day: o dia proposto. */
function evJanela(ev, opts){
  opts = opts || {};
  evjEstilo();
  if (typeof tfFecharPop === 'function') tfFecharPop();
  evjFechar();
  var novo = !ev;
  var e = ev || {};

  var dlg = el('dialog', 'evj folha');
  dlg.id = 'evjDlg';
  var c = el('div', 'evj-c');
  dlg.appendChild(c);
  c.appendChild(el('h3', null, novo ? 'Marcar um evento' : 'Evento'));

  /* ---- o que e ---- */
  var iT = el('input'); iT.type = 'text'; iT.placeholder = 'ex.: consulta de pediatria da Maria';
  iT.value = e.title || '';
  evjCampo(c, 'O que é', iT);

  /* ---- quando ---- */
  var sQ = el('div', 'evj-sec');
  sQ.appendChild(el('div', 'evj-lbl', 'Quando'));
  var lin0 = el('div', 'evj-linha');
  lin0.style.marginBottom = '8px';
  var lDia = el('label', 'evj-chk'); var cDia = el('input'); cDia.type = 'checkbox';
  lDia.appendChild(cDia); lDia.appendChild(document.createTextNode('Dia inteiro'));
  var lConf = el('label', 'evj-chk'); var cConf = el('input'); cConf.type = 'checkbox';
  lConf.appendChild(cConf); lConf.appendChild(document.createTextNode('Ainda por confirmar'));
  lin0.appendChild(lDia); lin0.appendChild(lConf);
  sQ.appendChild(lin0);

  var g1 = el('div', 'evj-g3');
  var iD = el('input'); iD.type = 'date';
  iD.value = e.day || opts.day || tfISO(tfHoje());
  evjCampo(g1, 'Dia', iD);
  var iH = el('input'); iH.type = 'time'; iH.value = e.at || (novo && opts.at) || '';
  var wH = evjCampo(g1, 'Começa às', iH);
  var sDur = evjSelect(EVJ_DURACOES);
  var iFim = el('input'); iFim.type = 'time'; iFim.style.display = 'none'; iFim.style.marginTop = '6px';
  var wDur = evjCampo(g1, 'Duração', sDur);
  wDur.appendChild(iFim);
  var iAte = el('input'); iAte.type = 'date'; iAte.value = e.ends_on || '';
  var wAte = evjCampo(g1, 'Até (opcional)', iAte);
  sQ.appendChild(g1);
  var dQ = el('div', 'evj-dica');
  sQ.appendChild(dQ);
  c.appendChild(sQ);

  cDia.checked = !novo && !e.at;
  cConf.checked = Boolean(e.tentative);
  if (e.duration_min){
    var ex = EVJ_DURACOES.filter(function(o){ return o[0] === String(e.duration_min); })[0];
    if (ex) sDur.value = ex[0];
    else { sDur.value = 'outra'; iFim.value = e.at ? evjHora(evjMin(e.at) + Number(e.duration_min)) : ''; }
  }

  /* A duracao em minutos, a partir do que esta escolhido. */
  function duracao(){
    if (cDia.checked) return null;
    if (sDur.value === 'outra'){
      var a = evjMin(iH.value), b = evjMin(iFim.value);
      if (a === null || b === null) return null;
      var d = b - a;
      if (d <= 0) d += 1440;   // acaba depois da meia-noite
      return d;
    }
    return sDur.value ? Number(sDur.value) : null;
  }

  /* ---- onde e com quem ---- */
  var sO = el('div', 'evj-sec');
  sO.appendChild(el('div', 'evj-lbl', 'Onde e com quem'));
  var g2 = el('div', 'evj-g');
  var iL = el('input'); iL.type = 'text'; iL.placeholder = 'morada, sítio ou link da videochamada';
  iL.value = e.location || '';
  var wL = evjCampo(g2, 'Local', iL);
  var dL = el('div', 'evj-dica'); wL.appendChild(dL);
  var sC = evjAreas(novo ? (opts.context_id || (EV.filtro.onde !== 'tudo' && EV.filtro.onde !== 'sem' ? EV.filtro.onde : '')) : e.context_id);
  evjCampo(g2, 'Área', sC);
  sO.appendChild(g2);

  var quem = {};
  (e.pessoas || []).forEach(function(id){ quem[id] = true; });
  if (novo && opts.person_id) quem[opts.person_id] = true;
  var wP = el('div'); wP.style.marginTop = '10px';
  wP.appendChild(el('label', null, 'Quem vai'));
  var pes = el('div', 'evj-pes');
  evjPessoas().forEach(function(p){
    var b = el('button');
    b.type = 'button';
    var av = el('span', 'evj-av', p.initials || (p.name || '?').slice(0, 1));
    av.style.background = p.color || 'var(--accent)';
    b.appendChild(av);
    b.appendChild(document.createTextNode(p.name));
    b.setAttribute('aria-pressed', quem[p.id] ? 'true' : 'false');
    if (quem[p.id]) b.classList.add('on');
    b.addEventListener('click', function(){
      quem[p.id] = !quem[p.id];
      b.classList.toggle('on', quem[p.id]);
      b.setAttribute('aria-pressed', quem[p.id] ? 'true' : 'false');
    });
    pes.appendChild(b);
  });
  if (!pes.childNodes.length) pes.appendChild(el('span', 'evj-dica', 'Não há pessoas na app.'));
  wP.appendChild(pes);
  sO.appendChild(wP);

  /* O Google de quem vai (4 out): uma copia do evento no calendario de cada
     pessoa que vai e que deu licenca para o Farol escrever. A copia e do
     Farol: corrigir ou apagar aqui corrige ou apaga la. */
  var wG = el('div'); wG.style.marginTop = '10px';
  var lG = el('label', 'evj-chk'); var cG = el('input'); cG.type = 'checkbox';
  lG.appendChild(cG); lG.appendChild(document.createTextNode('Pôr no calendário Google de quem vai'));
  wG.appendChild(lG);
  var dG = el('div', 'evj-dica'); wG.appendChild(dG);
  sO.appendChild(wG);
  cG.checked = novo ? true : Boolean(e.no_google);
  function acertarG(){
    var ids = Object.keys(quem).filter(function(k){ return quem[k]; }).map(Number);
    var contas = evjContasGoogle();
    if (!contas){ dG.textContent = ''; return; }
    if (!cG.checked){ dG.textContent = ids.length ? 'Fica só no Farol.' : ''; return; }
    if (!ids.length){ dG.textContent = 'Escolhe quem vai para o evento ir para o Google dessas pessoas.'; return; }
    var vai = [], sem = [];
    ids.forEach(function(id){
      var p = evjPessoas().filter(function(x){ return x.id === id; })[0];
      if (!p) return;
      var c = contas[id];
      if (c && c.escrever) vai.push(p.name); else sem.push(p.name + (c ? ' (falta licença para escrever)' : ' (sem Google ligado)'));
    });
    dG.textContent = [vai.length ? 'Vai para o Google de ' + vai.join(', ') + '.' : '',
      sem.length ? 'Não vai para: ' + sem.join(', ') + ' — liga ou renova na ficha da pessoa.' : ''].filter(Boolean).join(' ');
  }
  pes.addEventListener('click', function(){ setTimeout(acertarG, 0); });
  cG.addEventListener('change', acertarG);
  evjLerContas(acertarG);
  acertarG();
  c.appendChild(sO);

  /* ---- lembrete e notas ---- */
  var sL = el('div', 'evj-sec');
  sL.appendChild(el('div', 'evj-lbl', 'Lembrete e notas'));
  var sRem = el('select');
  evjCampo(sL, 'Lembrar', sRem);
  var dR = el('div', 'evj-dica'); sL.appendChild(dR);
  var iN = el('textarea'); iN.placeholder = 'o que levar, o que preparar, contactos, quem leva quem';
  iN.value = e.detail || '';
  var wN = evjCampo(sL, 'Notas', iN); wN.style.marginTop = '8px';
  c.appendChild(sL);

  function encherLembretes(){
    var antes = sRem.value;
    clear(sRem);
    (cDia.checked ? EVJ_LEMBRETES_DIA : EVJ_LEMBRETES_HORA).forEach(function(o){ sRem.appendChild(new Option(o[1], o[0])); });
    var alvo = antes !== undefined && antes !== null ? antes : '';
    sRem.value = alvo;
    if (sRem.value !== alvo){
      /* Um valor que so existe na outra lista: fica o mais proximo por baixo. */
      var n = Number(alvo), melhor = '';
      Array.prototype.forEach.call(sRem.options, function(o){ if (o.value !== '' && Number(o.value) <= n) melhor = o.value; });
      sRem.value = alvo === '' ? '' : melhor;
    }
  }
  sRem.value = '';
  encherLembretes();
  if (e.remind_min !== null && e.remind_min !== undefined){
    var r = String(e.remind_min);
    if (!Array.prototype.some.call(sRem.options, function(o){ return o.value === r; })){
      sRem.appendChild(new Option(evjDurTxt(Number(r)) + ' antes', r));
    }
    sRem.value = r;
  }

  /* ---- documentos ---- */
  var sD = el('div', 'evj-sec evj-drop');
  sD.appendChild(el('div', 'evj-lbl', 'Documentos'));
  var pend = { ficheiros: [], docs: [] };   // so para um evento novo
  if (!novo && typeof axBloco === 'function'){
    /* O evento ja existe: o bloco dos anexos grava logo, como nas tarefas. */
    sD.appendChild(axBloco(e, { tipo: 'evento', aoMudar: function(){ if (typeof renderAll === 'function') renderAll(); } }));
    sD.classList.remove('evj-drop');
  } else {
    sD.appendChild(evjPendentes(pend));
  }
  c.appendChild(sD);

  /* ---- acoes ---- */
  var erro = el('div', 'evj-erro');
  c.appendChild(erro);
  var ac = el('div', 'evj-acoes');
  if (!novo){
    var bX = el('button', 'btn small apagar esq', 'Apagar');
    bX.type = 'button';
    bX.addEventListener('click', function(){
      if (!window.confirm('Apagar «' + (e.title || '') + '»?\n\nSai do Hoje, da Agenda e das áreas. Os documentos ficam no arquivo.')) return;
      apiGestao('/api/gestao/eventos/' + e.id, { method: 'DELETE' }).then(function(){
        D.events = (D.events || []).filter(function(x){ return x.id !== e.id; });
        evjFechar();
        toast('Evento apagado.');
        renderAll();
      }).catch(function(er){ erro.textContent = er.message || 'Não deu para apagar.'; });
    });
    ac.appendChild(bX);
  }
  var bC = el('button', 'btn small' + (novo ? ' esq' : ''), novo ? 'Cancelar' : 'Fechar');
  bC.type = 'button';
  bC.addEventListener('click', evjFechar);
  var bOk = el('button', 'btn small primary', novo ? 'Marcar' : 'Gravar');
  bOk.type = 'button';
  ac.appendChild(bC); ac.appendChild(bOk);
  c.appendChild(ac);

  /* ---- o que muda com o que se escolhe ---- */
  function acertar(){
    var inteiro = cDia.checked;
    wH.style.display = inteiro ? 'none' : '';
    wDur.style.display = inteiro ? 'none' : '';
    wAte.style.display = inteiro ? '' : 'none';
    iFim.style.display = !inteiro && sDur.value === 'outra' ? '' : 'none';
    g1.className = inteiro ? 'evj-g' : 'evj-g3';

    var txt = '';
    if (!inteiro){
      var d = duracao(), a = evjMin(iH.value);
      if (a !== null && d) txt = 'Das ' + iH.value + ' às ' + evjHora(a + d) + (a + d >= 1440 ? ' do dia seguinte' : '') + ' · ' + evjDurTxt(d) + '.';
      else if (a === null && sDur.value) txt = 'Falta a hora de início.';
    } else if (iAte.value && iD.value && iAte.value > iD.value){
      var n = Math.round((parseDay(iAte.value) - parseDay(iD.value)) / 86400000) + 1;
      txt = n + ' dias.';
    }
    dQ.textContent = txt;

    var l = iL.value.trim();
    clear(dL);
    if (l){
      var a2 = el('a', null, /^https?:\/\//i.test(l) ? 'Abrir a ligação' : 'Ver no mapa');
      a2.href = /^https?:\/\//i.test(l) ? l : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l);
      a2.target = '_blank'; a2.rel = 'noopener';
      dL.appendChild(a2);
    }

    dR.textContent = evjAvisoTxt(iD.value, inteiro ? '' : iH.value, sRem.value);
  }
  cDia.addEventListener('change', function(){ encherLembretes(); acertar(); });
  [iD, iH, sDur, iFim, iAte, iL, sRem].forEach(function(x){
    x.addEventListener('input', acertar);
    x.addEventListener('change', acertar);
  });
  sDur.addEventListener('change', function(){
    if (sDur.value === 'outra' && !iFim.value && iH.value) iFim.value = evjHora(evjMin(iH.value) + 60);
  });
  acertar();

  /* ---- gravar ---- */
  bOk.addEventListener('click', function(){
    erro.textContent = '';
    var titulo = iT.value.trim();
    if (!titulo){ erro.textContent = 'Falta dizer o que é.'; return iT.focus(); }
    if (!iD.value){ erro.textContent = 'Falta o dia.'; return iD.focus(); }
    var inteiro = cDia.checked;
    if (!inteiro && sDur.value === 'outra' && !duracao()){ erro.textContent = 'Falta a hora de início ou a de fim.'; return; }
    if (inteiro && iAte.value && iAte.value < iD.value){ erro.textContent = 'O último dia é antes do primeiro.'; return iAte.focus(); }
    var corpo = {
      title: titulo,
      day: iD.value,
      at: inteiro ? null : (iH.value || null),
      duration_min: inteiro || !iH.value ? null : duracao(),
      ends_on: inteiro ? (iAte.value || null) : null,
      location: iL.value.trim() || null,
      context_id: sC.value ? Number(sC.value) : null,
      person_ids: Object.keys(quem).filter(function(k){ return quem[k]; }).map(Number),
      remind_min: sRem.value === '' ? null : Number(sRem.value),
      tentative: cConf.checked,
      no_google: cG.checked,
      detail: iN.value.trim() || null
    };
    bOk.disabled = true;
    var url = novo ? '/api/gestao/eventos' : '/api/gestao/eventos/' + e.id;
    apiGestao(url, {
      method: novo ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function(r){
      var fresco = novo ? r : (r && r.evento);
      if (!fresco) throw new Error('O servidor não devolveu o evento.');
      var gRes = r && r.google;
      D.events = (D.events || []).filter(function(x){ return x.id !== fresco.id; }).concat([fresco]);
      D.events.sort(function(x, y){ return x.day < y.day ? -1 : (x.day > y.day ? 1 : String(x.at || '').localeCompare(String(y.at || ''))); });
      if (!novo || (!pend.ficheiros.length && !pend.docs.length)) return { ev: fresco, google: gRes };
      return evjEnviarPendentes(fresco, pend).then(function(x){ x.google = gRes; return x; });
    }).then(function(res){
      evjFechar();
      toast((novo ? 'Marcado para ' : 'Gravado: ') + tfDataTxt(res.ev.day, res.ev.at) + '.' + (res.falhou ? ' ' + res.falhou : '') + evjGoogleTxt(res.google));
      renderAll();
    }).catch(function(er){
      bOk.disabled = false;
      erro.textContent = (er && er.message) || 'Não deu para gravar.';
    });
  });

  dlg.addEventListener('cancel', function(){ setTimeout(evjFechar, 0); });
  document.body.appendChild(dlg);
  dlg.showModal();
  if (novo) iT.focus();
  return dlg;
}

/* Num evento novo ainda nao ha a que agarrar os ficheiros: ficam em espera na
   janela e sobem depois de o evento existir. */
function evjPendentes(pend){
  if (typeof axEstilo === 'function') axEstilo();
  var box = el('div');
  function desenhar(){
    clear(box);
    var lista = el('div', 'evj-pend');
    pend.ficheiros.forEach(function(f, i){
      var l = el('div', 'ax-lin');
      l.appendChild(el('span', 'ax-nome', f.name));
      l.appendChild(el('small', null, Math.max(1, Math.round(f.size / 1024)) + ' KB · sobe ao marcar'));
      var x = el('button', 'ax-x', '×'); x.type = 'button'; x.style.opacity = '1';
      x.setAttribute('aria-label', 'Tirar ' + f.name);
      x.addEventListener('click', function(){ pend.ficheiros.splice(i, 1); desenhar(); });
      l.appendChild(x);
      lista.appendChild(l);
    });
    pend.docs.forEach(function(d, i){
      var l = el('div', 'ax-lin');
      l.appendChild(el('span', 'ax-nome', d.name));
      l.appendChild(el('small', null, 'do arquivo'));
      var x = el('button', 'ax-x', '×'); x.type = 'button'; x.style.opacity = '1';
      x.setAttribute('aria-label', 'Tirar ' + d.name);
      x.addEventListener('click', function(){ pend.docs.splice(i, 1); desenhar(); });
      l.appendChild(x);
      lista.appendChild(l);
    });
    if (!pend.ficheiros.length && !pend.docs.length) lista.appendChild(el('div', 'ax-vazio', 'Sem documentos. Podes largar aqui ficheiros.'));
    box.appendChild(lista);

    var fim = el('div', 'ax-fim');
    var inp = el('input'); inp.type = 'file'; inp.multiple = true; inp.style.display = 'none';
    inp.addEventListener('change', function(){
      juntar(inp.files);
      inp.value = '';
    });
    fim.appendChild(inp);
    var bt = el('button', 'ax-bt', '+ Anexar ficheiros');
    bt.type = 'button';
    bt.addEventListener('click', function(){ inp.click(); });
    fim.appendChild(bt);
    fim.appendChild(procura());
    box.appendChild(fim);
  }
  function juntar(files){
    var max = typeof AX_MAX === 'number' ? AX_MAX : 25 * 1024 * 1024;
    Array.prototype.slice.call(files || []).forEach(function(f){
      if (f.size > max){ toast('«' + f.name + '» passa dos 25 MB.'); return; }
      pend.ficheiros.push(f);
    });
    desenhar();
  }
  function procura(){
    var w = el('div', 'ax-proc');
    var i = el('input'); i.type = 'text'; i.placeholder = 'Ligar a um documento do arquivo…'; i.autocomplete = 'off';
    w.appendChild(i);
    var res = el('div', 'ax-res'); res.style.display = 'none';
    w.appendChild(res);
    function abrir(){
      var q = i.value.trim().toLowerCase();
      var ja = {}; pend.docs.forEach(function(d){ ja[d.id] = true; });
      var achados = ((window.D && D.documents) || []).filter(function(d){
        if (ja[d.id]) return false;
        if (!q) return true;
        var p = typeof pessoa === 'function' ? pessoa(d.person_id) : null;
        return (d.name + ' ' + (d.entity || '') + ' ' + (d.kind || '') + ' ' + (p ? p.name : '')).toLowerCase().indexOf(q) >= 0;
      }).sort(function(a, b){ return b.id - a.id; });
      clear(res);
      if (!achados.length) res.appendChild(el('div', 'ax-nada', 'Nenhum documento com esse nome.'));
      achados.slice(0, 8).forEach(function(d){
        var b = el('button'); b.type = 'button';
        b.appendChild(document.createTextNode(d.name));
        if (d.entity) b.appendChild(el('small', null, '  ' + d.entity));
        b.addEventListener('mousedown', function(ev){
          ev.preventDefault();
          pend.docs.push({ id: d.id, name: d.name });
          desenhar();
        });
        res.appendChild(b);
      });
      if (achados.length > 8) res.appendChild(el('div', 'ax-nada', 'e mais ' + (achados.length - 8) + ' — escreve para afinar.'));
      res.style.display = '';
    }
    i.addEventListener('focus', abrir);
    i.addEventListener('input', abrir);
    i.addEventListener('blur', function(){ setTimeout(function(){ res.style.display = 'none'; }, 120); });
    return w;
  }
  box.juntar = juntar;
  desenhar();
  /* Largar ficheiros em cima da seccao. */
  setTimeout(function(){
    var sec = box.parentNode;
    if (!sec) return;
    sec.addEventListener('dragover', function(ev){ ev.preventDefault(); sec.classList.add('sobre'); });
    sec.addEventListener('dragleave', function(){ sec.classList.remove('sobre'); });
    sec.addEventListener('drop', function(ev){
      ev.preventDefault(); sec.classList.remove('sobre');
      if (ev.dataTransfer && ev.dataTransfer.files) juntar(ev.dataTransfer.files);
    });
  }, 0);
  return box;
}

/* Depois de o evento existir: sobem os ficheiros (cada um fica documento do
   arquivo, com a area do evento) e ligam-se os documentos escolhidos. Se
   alguma coisa falhar, o evento fica marcado e a mensagem di-lo - os papeis
   que faltam juntam-se depois pelo clipe da linha. */
/* tipo: 'evento' (por omissao) ou 'tarefa' — a janela de criar uma tarefa,
   um pagamento, um lembrete ou uma nota usa o mesmo caminho. */
function evjEnviarPendentes(ev, pend, tipo){
  var alvo = tipo || 'evento';
  var papeis = [];
  var falhas = 0;
  var i = 0;
  function seguinte(){
    if (i >= pend.ficheiros.length) return Promise.resolve();
    var fd = new FormData();
    fd.append('ficheiro', pend.ficheiros[i]);
    fd.append('papel', 'anexo');
    i++;
    return apiGestao('/api/anexos/' + alvo + '/' + ev.id + '/ficheiro', { method: 'POST', body: fd })
      .then(function(r){
        if (r && r.papeis) papeis = r.papeis;
        if (r && r.documento && window.D && D.documents &&
            !D.documents.some(function(d){ return d.id === r.documento.id; })) D.documents.push(r.documento);
      }, function(){ falhas++; })
      .then(seguinte);
  }
  return seguinte().then(function(){
    if (!pend.docs.length) return;
    var refs = papeis.map(function(r){ return { id: r.id, papel: r.papel }; });
    pend.docs.forEach(function(d){
      if (!refs.some(function(r){ return r.id === d.id; })) refs.push({ id: d.id, papel: 'anexo' });
    });
    return apiGestao('/api/anexos/' + alvo + '/' + ev.id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents: refs })
    }).then(function(r){ if (r && r.papeis) papeis = r.papeis; }, function(){ falhas += pend.docs.length; });
  }).then(function(){
    ev.papeis = papeis;
    ev.documents = papeis.map(function(r){ return r.id; });
    if (typeof renderDocumentos === 'function') { try { renderDocumentos(); } catch (e) {} }
    return { ev: ev, falhou: falhas ? (falhas === 1 ? 'Um documento não ficou agarrado' : falhas + ' documentos não ficaram agarrados') + ' — junta-os pelo clipe.' : '' };
  });
}

/* O botao «+ Marcar uma data» dos Eventos e da Agenda, e o «+ Novo › Evento»
   das areas. areaId: quem chama de um ecra de area ja sabe onde o evento vai
   ficar; sem ele vale o filtro dos Eventos. */
function evPop(ancora, areaId){ evJanela(null, areaId ? { context_id: areaId } : {}); }

/* Abrir um evento pelo id (o aviso do Hoje so sabe o id). */
function evAbrirId(id){
  var ev = ((window.D && D.events) || []).filter(function(x){ return x.id === id; })[0];
  if (ev) evJanela(ev);
  else toast('Não encontrei o evento — talvez já tenha sido apagado.');
}

/* Marcar uma data tambem a partir da Agenda: e o ecra onde se olha para o
   calendario, e nao tinha por onde escrever nele. */
function evBotaoNaAgenda(){
  var topo = document.querySelector('#view-agenda .cal-top');
  if (!topo || topo.querySelector('.ev-novo')) return;
  var b = el('button', 'btn primary ev-novo', '+ Marcar uma data');
  b.type = 'button';
  b.style.marginLeft = 'auto';
  b.addEventListener('click', function(){ evJanela(null); });
  topo.appendChild(b);
}

(function evEsperar(){
  if (document.getElementById('nav') && typeof el === 'function'){
    evMontar(); evBotaoNaAgenda(); evRender();
    return;
  }
  setTimeout(evEsperar, 300);
})();
