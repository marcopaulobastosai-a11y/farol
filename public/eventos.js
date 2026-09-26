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
    if (!passaOnde(real ? e.context_id : null) || !passaQuando(e.day)) return;
    out.push({ id: e.id, title: e.title, day: e.day, at: e.at, detail: e.detail,
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
  var novo = el('button', 'btn primary', '+ Marcar uma data');
  novo.type = 'button';
  novo.dataset.tfpop = '1';
  novo.addEventListener('click', function(){ evPop(novo); });
  h.appendChild(novo);
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

/* Marcar uma data, para a area que se quiser - ou para nenhuma. */
function evPop(ancora){
  tfFecharPop();
  var p = el('div', 'tf-pop');
  p.style.width = '310px';

  p.appendChild(el('label', null, 'O que é'));
  var iT = el('input'); iT.type = 'text'; iT.placeholder = 'ex.: reunião na escola';
  p.appendChild(iT);

  var lin = el('div', 'tf-linha'); lin.style.marginTop = '8px';
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

  p.appendChild(el('label', null, 'Área'));
  var sC = el('select');
  var o0 = el('option', null, '— sem área —'); o0.value = '';
  sC.appendChild(o0);
  evAreas().forEach(function(a){
    var g = document.createElement('optgroup');
    g.label = a.name;
    var oa = el('option', null, a.name + ' · geral'); oa.value = String(a.id);
    g.appendChild(oa);
    ((window.G && G.contextos) || []).filter(function(c){ return c.parent_id === a.id; }).forEach(function(c){
      var o = el('option', null, c.name); o.value = String(c.id);
      g.appendChild(o);
    });
    sC.appendChild(g);
  });
  if (EV.filtro.onde !== 'tudo' && EV.filtro.onde !== 'sem') sC.value = EV.filtro.onde;
  p.appendChild(sC);

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
        context_id: sC.value ? Number(sC.value) : null
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

/* Marcar uma data tambem a partir da Agenda: e o ecra onde se olha para o
   calendario, e nao tinha por onde escrever nele. */
function evBotaoNaAgenda(){
  var topo = document.querySelector('#view-agenda .cal-top');
  if (!topo || topo.querySelector('.ev-novo')) return;
  var b = el('button', 'btn primary ev-novo', '+ Marcar uma data');
  b.type = 'button';
  b.style.marginLeft = 'auto';
  b.dataset.tfpop = '1';
  b.addEventListener('click', function(){ evPop(b); });
  topo.appendChild(b);
}

(function evEsperar(){
  if (document.getElementById('nav') && typeof el === 'function'){
    evMontar(); evBotaoNaAgenda(); evRender();
    return;
  }
  setTimeout(evEsperar, 300);
})();
