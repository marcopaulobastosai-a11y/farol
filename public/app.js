'use strict';
/* Farol — o cliente não tem dados: tudo vem de /api/bootstrap. */

var DIAS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
var DIAS_CURTO = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

var TITLES = {
  hoje: ['Hoje', null],
  agenda: ['Agenda', 'Calendário de toda a família'],
  familia: ['Família', 'Agregado alargado · agenda, tarefas e apoio aos pais'],
  casa: ['Casa', 'Manutenção, consumos, avarias e garantias'],
  projetos: ['Projetos', 'Frentes activas · tempo e marcos'],
  financas: ['Finanças', 'Orçamento, subscrições e compromissos'],
  saude: ['Saúde & rotinas', 'Hábitos da semana e marcações'],
  documentos: ['Documentos', 'Prazos, renovações e arquivo']
};

var D = null;              // payload da API
var calState = { selected: null, active: {} };

function $(id){ return document.getElementById(id); }
function el(tag, cls, text){
  var n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function clear(node){ while (node && node.firstChild) node.removeChild(node.firstChild); }
function pill(label, level){
  var p = el('span', 'pill' + (level ? ' ' + level : ''), label);
  return p;
}
function row(title, sub, right){
  var r = el('div', 'row');
  var g = el('div', 'grow');
  g.appendChild(el('span', 't', title));
  if (sub) g.appendChild(el('span', 's', sub));
  r.appendChild(g);
  if (right) r.appendChild(right);
  return r;
}
function parseDay(s){ var a = s.split('-'); return new Date(+a[0], +a[1]-1, +a[2]); }
function iso(dt){
  return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
}
function addDays(dt, n){ return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n); }
function mondayOf(dt){ return addDays(dt, -((dt.getDay() + 6) % 7)); }
function calColor(code){
  var c = (D.calendars || []).filter(function(x){ return x.code === code; })[0];
  return c ? c.color : 'var(--c1)';
}
function calName(code){
  var c = (D.calendars || []).filter(function(x){ return x.code === code; })[0];
  return c ? c.name : code;
}
function checkItem(task, onToggle){
  var li = el('li', task.done ? 'done' : '');
  var b = el('button');
  b.type = 'button';
  var box = el('span', 'box');
  box.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke-width="3.2" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>';
  b.appendChild(box);
  b.appendChild(el('span', 'lbl', task.title));
  if (task.tag) {
    var t = pill(task.tag, task.tag_level);
    t.classList.add('meta');
    b.appendChild(t);
  }
  b.addEventListener('click', function(){ onToggle(task, li); });
  li.appendChild(b);
  return li;
}

/* ---------------- toast ---------------- */
var toastTimer;
function toast(msg){
  var t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 3000);
}

/* ---------------- tarefas (escrita na base de dados) ---------------- */
function toggleTask(task, li){
  var next = !task.done;
  fetch('/api/tasks/' + task.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done: next })
  }).then(function(r){
    if (!r.ok) throw new Error('falhou');
    return r.json();
  }).then(function(saved){
    task.done = saved.done;
    li.classList.toggle('done', saved.done);
    renderTaskCounters();
  }).catch(function(){
    toast('Não deu para gravar. A base de dados não respondeu.');
  });
}
function renderTaskCounters(){
  var hoje = D.tasks.filter(function(t){ return t.scope === 'hoje'; });
  var done = hoje.filter(function(t){ return t.done; }).length;
  $('todoCount').textContent = done + ' de ' + hoje.length;
  var fam = D.tasks.filter(function(t){ return t.scope === 'familia' && !t.done; });
  $('famTaskCount').textContent = fam.length + ' por fazer';
  $('badgeFamilia').textContent = fam.length;
}

/* ---------------- HOJE ---------------- */
function renderHoje(){
  var list = $('attnList');
  clear(list);
  D.attention.forEach(function(a){
    var art = el('article', a.level);
    var g = el('div', 'grow');
    g.appendChild(el('h4', null, a.title));
    if (a.detail) g.appendChild(el('p', null, a.detail));
    art.appendChild(g);
    if (a.when_label) {
      var w = el('div', 'when');
      var p = pill(a.when_label, a.when_level);
      p.insertBefore(el('i', 'dot'), p.firstChild);
      w.appendChild(p);
      art.appendChild(w);
    }
    list.appendChild(art);
  });
  $('attnLabel').textContent = 'Precisa de ti · ' + D.attention.length;
  $('badgeHoje').textContent = D.attention.length;

  var tiles = $('tiles');
  clear(tiles);
  D.tiles.forEach(function(t){
    var b = el('button', 'tile');
    b.dataset.goto = t.goto || '';
    b.appendChild(el('span', 'k', t.label));
    b.appendChild(el('span', 'v num', t.value));
    b.appendChild(el('span', 'n', t.note || ''));
    tiles.appendChild(b);
  });

  var today = D.meta.today;
  var agenda = $('agendaHoje');
  clear(agenda);
  var todays = D.events.filter(function(e){ return e.day === today; });
  todays.forEach(function(e){
    agenda.appendChild(agendaItem(e));
  });
  $('agendaDayLabel').textContent = DIAS[(parseDay(today).getDay()+6)%7];
  $('badgeAgenda').textContent = todays.length;

  var ul = $('todayList');
  clear(ul);
  D.tasks.filter(function(t){ return t.scope === 'hoje'; }).forEach(function(t){
    ul.appendChild(checkItem(t, toggleTask));
  });
  $('tilesStamp').textContent = 'dados da base';
}
function agendaItem(e){
  var li = el('li');
  li.appendChild(el('time', null, e.at || '—'));
  var body = el('div', 'body');
  body.appendChild(el('b', null, e.title));
  var sub = e.detail ? e.detail : calName(e.calendar);
  body.appendChild(el('span', 'who', sub));
  li.appendChild(body);
  return li;
}

/* ---------------- AGENDA ---------------- */
function renderAgendaShell(){
  var head = $('calHead');
  clear(head);
  DIAS_CURTO.forEach(function(d){ head.appendChild(el('span', null, d)); });

  var f = $('whoFilter');
  clear(f);
  D.calendars.forEach(function(c){
    calState.active[c.code] = calState.active[c.code] !== false;
    var b = el('button', 'chip');
    b.type = 'button';
    b.dataset.who = c.code;
    var i = el('i');
    i.style.background = c.color;
    b.appendChild(i);
    b.appendChild(document.createTextNode(c.name));
    b.addEventListener('click', function(){
      calState.active[c.code] = !calState.active[c.code];
      b.classList.toggle('off', !calState.active[c.code]);
      renderMonth(); renderDay(); renderUpcoming(); renderLoad();
    });
    f.appendChild(b);
  });

  $('calMonth').textContent = D.meta.month_label || '';
  $('calNote').textContent = D.notes.agenda_nota || '';
  $('loadNote').textContent = D.notes.agenda_carga || '';
  $('loadLabel').textContent = D.meta.week_label || '';

  var src = $('eventSources');
  clear(src);
  D.eventSources.forEach(function(s){
    src.appendChild(row(s.name, s.detail, s.status_label ? pill(s.status_label, s.status_level) : null));
  });

  var dec = $('decisions');
  clear(dec);
  D.attention.forEach(function(a){
    var r = el('div', 'row');
    r.appendChild(pill(a.when_label || '—', a.when_level));
    var g = el('div', 'grow');
    g.appendChild(el('span', 't', a.title));
    if (a.detail) g.appendChild(el('span', 's', a.detail));
    r.appendChild(g);
    dec.appendChild(r);
  });
}
function eventsOf(dayKey){
  return D.events.filter(function(e){ return e.day === dayKey && calState.active[e.calendar]; });
}
function renderMonth(){
  var grid = $('calGrid');
  clear(grid);
  var parts = (D.meta.month || D.meta.today).split('-');
  var year = +parts[0], month = +parts[1] - 1;
  var first = new Date(year, month, 1);
  var start = mondayOf(first);
  var total = 0;

  for (var i = 0; i < 42; i++){
    var dt = addDays(start, i);
    var key = iso(dt);
    var evs = eventsOf(key);
    if (dt.getMonth() === month) total += evs.length;

    var cell = el('button', 'day');
    cell.type = 'button';
    cell.dataset.key = key;
    if (dt.getMonth() !== month) cell.classList.add('out');
    if (key === D.meta.today) cell.classList.add('today');
    if (key === calState.selected) cell.classList.add('sel');
    cell.appendChild(el('span', 'n', String(dt.getDate())));
    evs.slice(0, 3).forEach(function(e){
      var r = el('span', 'ce');
      var dot = el('i');
      dot.style.background = calColor(e.calendar);
      r.appendChild(dot);
      r.appendChild(el('span', null, e.title));
      cell.appendChild(r);
    });
    if (evs.length > 3) cell.appendChild(el('span', 'more', '+' + (evs.length - 3)));
    cell.addEventListener('click', function(){
      calState.selected = this.dataset.key;
      renderMonth(); renderDay();
    });
    grid.appendChild(cell);
  }
  $('calCount').textContent = total + ' eventos';
}
function renderDay(){
  var dt = parseDay(calState.selected);
  $('dayTitle').textContent = DIAS[(dt.getDay()+6)%7] + ', ' + dt.getDate() + ' de ' + MESES[dt.getMonth()];
  var evs = eventsOf(calState.selected);
  $('dayCount').textContent = evs.length ? evs.length + (evs.length === 1 ? ' evento' : ' eventos') : 'livre';
  var list = $('dayList');
  clear(list);
  if (!evs.length){
    var li = el('li');
    var b = el('div', 'body');
    b.style.color = 'var(--muted)';
    b.textContent = 'Nada marcado.';
    li.appendChild(b);
    list.appendChild(li);
    return;
  }
  evs.forEach(function(e){
    var li = el('li');
    li.appendChild(el('time', null, e.at || '—'));
    var body = el('div', 'body');
    body.appendChild(el('b', null, e.title));
    body.appendChild(el('span', 'who', calName(e.calendar)));
    li.appendChild(body);
    list.appendChild(li);
  });
}
function renderUpcoming(){
  var ul = $('upcoming');
  clear(ul);
  var from = parseDay(D.meta.today), to = addDays(from, 21);
  var evs = D.events.filter(function(e){
    var d = parseDay(e.day);
    return calState.active[e.calendar] && d >= from && d <= to;
  });
  evs.forEach(function(e){
    var dt = parseDay(e.day);
    var li = el('li', e.day === D.meta.today ? 'is-today' : '');
    li.appendChild(el('span', 'dt', DIAS_CURTO[(dt.getDay()+6)%7] + ' ' + dt.getDate() + ' ' + MESES[dt.getMonth()].slice(0,3) + (e.at ? ' · ' + e.at : '')));
    var ce = el('span', 'ce');
    var dot = el('i');
    dot.style.background = calColor(e.calendar);
    ce.appendChild(dot);
    ce.appendChild(el('span', null, e.title));
    li.appendChild(ce);
    var who = pill(calName(e.calendar));
    who.classList.add('who');
    li.appendChild(who);
    ul.appendChild(li);
  });
  $('upCount').textContent = evs.length + ' eventos';
}
function renderLoad(){
  var ul = $('load');
  clear(ul);
  var start = mondayOf(parseDay(D.meta.today));
  var end = addDays(start, 6);
  var counts = {};
  D.events.forEach(function(e){
    var d = parseDay(e.day);
    if (d >= start && d <= end) counts[e.calendar] = (counts[e.calendar] || 0) + 1;
  });
  var max = Math.max.apply(null, Object.keys(counts).map(function(k){ return counts[k]; }).concat([1]));
  D.calendars.forEach(function(c){
    var n = counts[c.code] || 0;
    if (!n) return;
    var li = el('li');
    li.appendChild(el('span', null, c.name));
    li.appendChild(el('span', 'amt', n + (n === 1 ? ' compromisso' : ' compromissos')));
    var bar = el('div', 'bar');
    var fill = el('span');
    fill.style.width = Math.round(n / max * 100) + '%';
    fill.style.background = c.color;
    bar.appendChild(fill);
    li.appendChild(bar);
    ul.appendChild(li);
  });
}

/* ---------------- FAMÍLIA ---------------- */
function renderFamilia(){
  var box = $('people');
  clear(box);
  D.people.forEach(function(p){
    var d = el('div', 'person');
    var av = el('div', 'avatar', p.initials);
    d.appendChild(av);
    d.appendChild(el('b', null, p.name));
    d.appendChild(el('span', 'role', p.role || ''));
    if (p.note) d.appendChild(el('div', 'next', p.note));
    box.appendChild(d);
  });
  $('peopleCount').textContent = D.people.length + ' pessoas';

  var grid = $('weekGrid');
  clear(grid);
  var start = mondayOf(parseDay(D.meta.today));
  for (var i = 0; i < 7; i++){
    var dt = addDays(start, i);
    var key = iso(dt);
    var cell = el('div', 'd' + (key === D.meta.today ? ' today' : ''));
    cell.appendChild(el('h5', null, DIAS_CURTO[i] + ' ' + dt.getDate()));
    D.events.filter(function(e){ return e.day === key; }).slice(0, 4).forEach(function(e){
      var ev = el('div', 'ev');
      var dot = el('i');
      dot.style.background = calColor(e.calendar);
      ev.appendChild(dot);
      ev.appendChild(document.createTextNode(e.title));
      cell.appendChild(ev);
    });
    grid.appendChild(cell);
  }
  $('weekLabel').textContent = D.meta.week_label || '';

  var leg = $('weekLegend');
  clear(leg);
  D.calendars.forEach(function(c){
    var p = pill(c.name);
    var dot = el('i', 'dot');
    dot.style.background = c.color;
    p.insertBefore(dot, p.firstChild);
    leg.appendChild(p);
  });

  var ul = $('familyTasks');
  clear(ul);
  D.tasks.filter(function(t){ return t.scope === 'familia'; }).forEach(function(t){
    ul.appendChild(checkItem(t, toggleTask));
  });

  var sup = $('support');
  clear(sup);
  D.support.forEach(function(s){
    sup.appendChild(row(s.title, s.detail, s.status_label ? pill(s.status_label, s.status_level) : null));
  });

  var fd = $('famDates');
  clear(fd);
  D.familyDates.forEach(function(f){
    var right = el('span', 'mono num', f.when_label);
    fd.appendChild(row(f.title, null, right));
  });
}

/* ---------------- CASA ---------------- */
function renderCasa(){
  var tb = $('maintenance');
  clear(tb);
  D.maintenance.forEach(function(m){
    var tr = el('tr');
    tr.appendChild(el('td', null, m.item));
    tr.appendChild(el('td', null, m.periodicity || ''));
    tr.appendChild(el('td', 'n', m.last_label || ''));
    tr.appendChild(el('td', 'n', m.next_label || ''));
    var td = el('td');
    td.appendChild(pill(m.status_label, m.status_level));
    tr.appendChild(td);
    tb.appendChild(tr);
  });

  var cons = $('consumption');
  clear(cons);
  var utilities = [];
  D.consumption.forEach(function(c){ if (utilities.indexOf(c.utility) < 0) utilities.push(c.utility); });
  utilities.forEach(function(u){
    var rows = D.consumption.filter(function(c){ return c.utility === u; });
    var max = Math.max.apply(null, rows.map(function(r){ return r.value; }));
    var wrap = el('div');
    wrap.appendChild(el('div', 'mono', u + ' · ' + (rows[0].unit || '')));
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 160 60');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '60');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Consumo de ' + u + ' nos últimos seis meses');
    rows.forEach(function(r, i){
      var h = Math.max(4, Math.round(r.value / max * 52));
      var rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', 2 + i * 26);
      rect.setAttribute('y', 60 - h);
      rect.setAttribute('width', 20);
      rect.setAttribute('height', h);
      rect.setAttribute('rx', 2);
      rect.setAttribute('fill', r.is_current ? 'var(--accent)' : 'var(--accent-soft)');
      svg.appendChild(rect);
    });
    wrap.appendChild(svg);
    var foot = el('div');
    foot.style.display = 'flex';
    foot.style.justifyContent = 'space-between';
    foot.appendChild(el('span', 'mono', rows[0].month_label));
    var last = rows[rows.length - 1];
    var delta = el('span', 'mono num', last.delta_label || '');
    if (last.delta_level === 'good') delta.style.color = 'var(--good)';
    if (last.delta_level === 'warn') delta.style.color = 'var(--warn)';
    if (last.delta_level === 'bad') delta.style.color = 'var(--bad)';
    foot.appendChild(delta);
    wrap.appendChild(foot);
    cons.appendChild(wrap);
  });

  var iss = $('issues');
  clear(iss);
  D.issues.forEach(function(i){
    iss.appendChild(row(i.title, i.detail, pill(i.status_label, i.status_level)));
  });
  $('issuesCount').textContent = D.issues.length;
  $('badgeCasa').textContent = D.issues.length;

  var as = $('assets');
  clear(as);
  D.assets.forEach(function(a){
    var tr = el('tr');
    tr.appendChild(el('td', null, a.name));
    tr.appendChild(el('td', 'n', a.bought_label || ''));
    var td = el('td');
    td.appendChild(pill(a.warranty_label, a.warranty_level));
    tr.appendChild(td);
    as.appendChild(tr);
  });
}

/* ---------------- PROJETOS ---------------- */
function renderProjetos(){
  var box = $('projects');
  clear(box);
  D.projects.forEach(function(p){
    var art = el('article', 'proj');
    var top = el('div', 'top');
    top.appendChild(el('h4', null, p.name));
    var st = pill(p.status_label, p.status_level);
    st.insertBefore(el('i', 'dot'), st.firstChild);
    st.style.marginLeft = 'auto';
    top.appendChild(st);
    art.appendChild(top);
    var desc = el('p', null, p.description || '');
    desc.style.color = 'var(--muted)';
    desc.style.fontSize = '.8125rem';
    art.appendChild(desc);
    var pct = el('div', 'pct');
    pct.appendChild(el('span', null, 'Progresso'));
    pct.appendChild(el('span', 'num', p.progress + '%'));
    art.appendChild(pct);
    var bar = el('div', 'bar' + (p.status_level ? ' ' + p.status_level : ''));
    var fill = el('span');
    fill.style.width = p.progress + '%';
    bar.appendChild(fill);
    art.appendChild(bar);
    var next = el('div', 'next');
    next.appendChild(el('span', null, 'Próximo marco'));
    next.appendChild(document.createTextNode(p.milestone || ''));
    art.appendChild(next);
    box.appendChild(art);
  });
  $('badgeProjetos').textContent = D.projects.length;

  var ul = $('projectActions');
  clear(ul);
  D.tasks.filter(function(t){ return t.scope === 'projetos'; }).forEach(function(t){
    ul.appendChild(checkItem(t, toggleTask));
  });

  var ts = $('timeSpent');
  clear(ts);
  var max = Math.max.apply(null, D.projects.map(function(p){ return p.hours || 0; }).concat([1]));
  D.projects.forEach(function(p){
    var li = el('li');
    li.appendChild(el('span', null, p.name));
    li.appendChild(el('span', 'amt', (p.hours || 0) + ' h'));
    var bar = el('div', 'bar' + (p.status_level ? ' ' + p.status_level : ''));
    var fill = el('span');
    fill.style.width = Math.round((p.hours || 0) / max * 100) + '%';
    bar.appendChild(fill);
    li.appendChild(bar);
    ts.appendChild(li);
  });
  $('timeNote').textContent = D.notes.projetos_tempo || '';
}

/* ---------------- FINANÇAS ---------------- */
function eur(n){ return n.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'; }
function renderFinancas(){
  var ul = $('budget');
  clear(ul);
  D.budget.forEach(function(c){
    var pctv = c.budget ? c.spent / c.budget : 0;
    var li = el('li');
    li.appendChild(el('span', null, c.name));
    li.appendChild(el('span', 'amt', eur(c.spent) + ' / ' + eur(c.budget)));
    var level = pctv > 1 ? 'bad' : (pctv >= 1 ? '' : 'good');
    var bar = el('div', 'bar' + (level ? ' ' + level : ''));
    var fill = el('span');
    fill.style.width = Math.min(100, Math.round(pctv * 100)) + '%';
    bar.appendChild(fill);
    li.appendChild(bar);
    ul.appendChild(li);
  });
  $('budgetMonth').textContent = D.meta.month_label || '';
  var dt = parseDay(D.meta.today);
  var lastDay = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  $('budgetDay').textContent = 'dia ' + dt.getDate() + ' de ' + lastDay;

  var sum = $('finSummary');
  clear(sum);
  D.summary.forEach(function(s){
    var t = el('div', 'tile');
    t.style.boxShadow = 'none';
    t.style.borderColor = 'var(--line-soft)';
    t.appendChild(el('span', 'k', s.label));
    t.appendChild(el('span', 'v num', s.value));
    t.appendChild(el('span', 'n', s.note || ''));
    sum.appendChild(t);
  });

  var al = $('finAlerts');
  clear(al);
  D.alerts.forEach(function(a){
    var r = el('div', 'row');
    r.appendChild(pill(a.badge || '', a.level));
    var g = el('div', 'grow');
    g.appendChild(el('span', 't', a.title));
    if (a.detail) g.appendChild(el('span', 's', a.detail));
    r.appendChild(g);
    al.appendChild(r);
  });

  var tb = $('subs');
  clear(tb);
  var yearly = 0, cut = 0;
  D.subscriptions.forEach(function(s){
    yearly += s.yearly || 0;
    if (s.cuttable) cut += s.yearly || 0;
    var tr = el('tr');
    tr.appendChild(el('td', null, s.name));
    tr.appendChild(el('td', 'n', s.amount_label));
    tr.appendChild(el('td', null, s.cycle || ''));
    tr.appendChild(el('td', 'n', s.next_charge || ''));
    var td = el('td');
    td.appendChild(pill(s.note, s.note_level));
    tr.appendChild(td);
    tb.appendChild(tr);
  });
  $('subsTotal').textContent = eur(Math.round(yearly)) + '/ano';
  $('subsNote').textContent = cut ? 'Candidatas a corte: ' + eur(Math.round(cut)) + '/ano.' : (D.notes.subs_nota || '');

  var cr = $('credits');
  clear(cr);
  D.credits.forEach(function(c){
    var right = c.amount_label ? el('span', 'mono num', c.amount_label) : (c.badge ? pill(c.badge, c.badge_level) : null);
    cr.appendChild(row(c.name, c.detail, right));
  });
  var monthly = D.credits.reduce(function(acc, c){
    var m = (c.amount_label || '').match(/([\d\s.,]+)\s*€/);
    return acc + (m ? parseFloat(m[1].replace(/\s/g, '').replace(',', '.')) : 0);
  }, 0);
  $('creditTotal').textContent = 'Prestação total ' + eur(Math.round(monthly)) + '/mês';

  var rs = $('reserves');
  clear(rs);
  D.reserves.forEach(function(r){
    rs.appendChild(row(r.name, r.detail, pill(r.status_label, r.status_level)));
    if (r.pct != null){
      var bar = el('div', 'bar ' + (r.status_level || ''));
      bar.style.margin = '8px 0 4px';
      var fill = el('span');
      fill.style.width = r.pct + '%';
      bar.appendChild(fill);
      rs.appendChild(bar);
    }
  });

  var bs = $('business');
  clear(bs);
  D.business.forEach(function(b){
    bs.appendChild(row(b.name, b.detail, pill(b.status_label, b.status_level)));
  });
}

/* ---------------- SAÚDE ---------------- */
function renderSaude(){
  var tb = $('habits');
  clear(tb);
  var total = 0, best = null, worst = null;
  D.habits.forEach(function(h){
    var score = h.days.reduce(function(a, v){ return a + (v === 2 ? 1 : v === 1 ? 0.5 : 0); }, 0);
    total += score;
    if (!best || score > best.score) best = { name: h.name, score: score };
    if (!worst || score < worst.score) worst = { name: h.name, score: score };
    var tr = el('tr');
    tr.appendChild(el('td', null, h.name));
    h.days.forEach(function(v){
      var td = el('td');
      td.appendChild(el('div', 'cell' + (v === 2 ? ' on' : v === 1 ? ' half' : '')));
      tr.appendChild(td);
    });
    tb.appendChild(tr);
  });
  var stats = $('habitStats');
  clear(stats);
  function stat(label, value){
    var d = el('div');
    d.appendChild(el('div', 'mono', label));
    var v = el('div', 'num', value);
    v.style.fontFamily = 'var(--serif)';
    v.style.fontSize = '1.4rem';
    d.appendChild(v);
    return d;
  }
  var pct = D.habits.length ? Math.round(total / (D.habits.length * 7) * 100) : 0;
  stats.appendChild(stat('Cumprimento', pct + '%'));
  if (best) stats.appendChild(stat('Melhor rotina', best.name.split(' ')[0]));
  if (worst) stats.appendChild(stat('A escorregar', worst.name.split(' ')[0]));
  $('habitsWeek').textContent = D.meta.week_label || '';

  var ap = $('appointments');
  clear(ap);
  D.appointments.forEach(function(a){
    var right = a.when_level ? pill(a.when_label, a.when_level) : el('span', 'mono num', a.when_label || '');
    ap.appendChild(row(a.title, a.who, right));
  });

  var box = $('activity');
  clear(box);
  var ns = 'http://www.w3.org/2000/svg';
  var svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 300 70');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '70');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Minutos de atividade por semana');
  var max = Math.max.apply(null, D.activity.map(function(a){ return a.minutes; }).concat([1]));
  var pts = D.activity.map(function(a, i){
    var x = 10 + i * (280 / Math.max(1, D.activity.length - 1));
    var y = 62 - (a.minutes / max) * 46;
    return [Math.round(x), Math.round(y)];
  });
  var poly = document.createElementNS(ns, 'polyline');
  poly.setAttribute('points', pts.map(function(p){ return p.join(','); }).join(' '));
  poly.setAttribute('fill', 'none');
  poly.setAttribute('stroke', 'var(--accent)');
  poly.setAttribute('stroke-width', '2');
  poly.setAttribute('stroke-linejoin', 'round');
  poly.setAttribute('stroke-linecap', 'round');
  var area = document.createElementNS(ns, 'polygon');
  area.setAttribute('points', pts.map(function(p){ return p.join(','); }).join(' ') + ' ' + pts[pts.length-1][0] + ',70 ' + pts[0][0] + ',70');
  area.setAttribute('fill', 'var(--accent-soft)');
  var end = document.createElementNS(ns, 'circle');
  end.setAttribute('cx', pts[pts.length-1][0]);
  end.setAttribute('cy', pts[pts.length-1][1]);
  end.setAttribute('r', '3.5');
  end.setAttribute('fill', 'var(--accent)');
  svg.appendChild(area); svg.appendChild(poly); svg.appendChild(end);
  box.appendChild(svg);
  $('activityLabel').textContent = D.activity.length + ' semanas';
  $('activityNote').textContent = D.notes.saude_nota || '';
}

/* ---------------- DOCUMENTOS ---------------- */
function renderDocumentos(){
  var tb = $('documents');
  clear(tb);
  var urgent = 0;
  D.documents.forEach(function(d){
    if (d.status_level === 'bad') urgent++;
    var tr = el('tr');
    tr.appendChild(el('td', null, d.name));
    tr.appendChild(el('td', null, d.entity || ''));
    tr.appendChild(el('td', 'n', d.valid_until || ''));
    var td = el('td');
    td.appendChild(pill(d.status_label, d.status_level));
    tr.appendChild(td);
    tb.appendChild(tr);
  });
  $('badgeDocs').textContent = urgent;

  var ar = $('archive');
  clear(ar);
  D.archive.forEach(function(a){
    ar.appendChild(row(a.name, a.detail, pill(a.status_label, a.status_level)));
  });
  $('docsNote').textContent = D.notes.docs_avisos || '';
}

/* ---------------- navegação ---------------- */
function show(view){
  var sections = document.querySelectorAll('.view');
  for (var i = 0; i < sections.length; i++){
    sections[i].classList.toggle('is-active', sections[i].id === 'view-' + view);
  }
  var btns = $('nav').querySelectorAll('button');
  for (var j = 0; j < btns.length; j++){
    btns[j].classList.toggle('is-active', btns[j].dataset.view === view);
  }
  var t = TITLES[view];
  if (t){
    $('pageTitle').textContent = t[0];
    $('pageSub').textContent = t[1] || (D ? D.meta.today_label : '');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function wire(){
  $('nav').addEventListener('click', function(e){
    var b = e.target.closest('button[data-view]');
    if (b) show(b.dataset.view);
  });
  document.addEventListener('click', function(e){
    var tile = e.target.closest('[data-goto]');
    if (tile && tile.dataset.goto) { show(tile.dataset.goto); return; }
    var tab = e.target.closest('.tabs button');
    if (tab){
      var group = tab.closest('.tabs');
      var bs = group.querySelectorAll('button');
      for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('is-active', bs[i] === tab);
      var panes = group.closest('.view').querySelectorAll('[data-pane]');
      for (var j = 0; j < panes.length; j++) panes[j].hidden = panes[j].dataset.pane !== tab.dataset.tab;
    }
  });
  $('btnReload').addEventListener('click', function(){ load(true); });
}

function renderAll(){
  $('brandSub').textContent = D.meta.household || '';
  $('ownerName').textContent = D.meta.owner || '';
  var me = D.people[0];
  $('ownerInitials').textContent = me ? me.initials : '—';
  $('ownerMeta').textContent = 'Agregado · ' + D.people.length + ' pessoas';
  $('pageSub').textContent = D.meta.today_label || '';
  if (D.meta.env){
    var p = $('envPill');
    p.textContent = D.meta.env;
    p.hidden = false;
  }
  $('demoBanner').hidden = false;
  $('demoText').textContent = 'Ambiente de ' + (D.meta.env || 'qualidade') + ' — pessoas, valores e datas são fictícios.';

  calState.selected = calState.selected || D.meta.today;
  renderHoje();
  renderAgendaShell();
  renderMonth(); renderDay(); renderUpcoming(); renderLoad();
  renderFamilia();
  renderCasa();
  renderProjetos();
  renderFinancas();
  renderSaude();
  renderDocumentos();
  renderTaskCounters();
}

function load(notify){
  fetch('/api/bootstrap')
    .then(function(r){ if (!r.ok) throw new Error('api'); return r.json(); })
    .then(function(data){
      D = data;
      renderAll();
      if (notify) toast('Dados relidos da base de dados.');
    })
    .catch(function(){
      $('pageSub').textContent = 'Não foi possível ler a base de dados.';
      toast('Sem ligação à base de dados.');
    });
}

wire();
load(false);
