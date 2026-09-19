'use strict';
/* Farol — o cliente não tem dados: tudo vem de /api/bootstrap. */

var DIAS = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
var DIAS_CURTO = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
var MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

var TITLES = {
  hoje: ['Hoje', null],
  agenda: ['Agenda', 'Calendário de toda a família'],
  tarefas: ['Tarefas', 'Quem faz o quê, por causa de quem, até quando'],
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
function num(n){ return n.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function eur(n){ return num(n) + ' €'; }
function renderFinancas(){
  var ul = $('budget');
  clear(ul);
  D.budget.forEach(function(c){
    var pctv = c.budget ? c.spent / c.budget : 0;
    var li = el('li');
    li.appendChild(el('span', null, c.name));
    li.appendChild(el('span', 'amt', num(c.spent) + ' / ' + eur(c.budget)));
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
/* De quem e cada papel. O filtro por cima da tabela responde a pergunta que
   se faz mesmo: mostra-me tudo o que e da Sofia. So aparecem as pessoas que
   tem documentos - uma fila de chips vazios nao ajuda ninguem. */
var DOCS_PESSOA = null;

function pessoaDoc(id){
  if (!id || !D.people) return null;
  for (var i = 0; i < D.people.length; i++) if (D.people[i].id === id) return D.people[i];
  return null;
}

/* Apagar o papel, nao o ficheiro: se o documento tinha vindo da caixa de
   entrada, o ficheiro fica la, outra vez por triar. */
function apagarDocumento(d){
  var nome = d.name || 'este documento';
  if (!window.confirm('Apagar \u00ab' + nome + '\u00bb\u003f\n\nSe tiver vindo da caixa de entrada, o ficheiro volta a ficar por triar.')) return;
  apiGestao('/api/documentos/' + d.id, { method: 'DELETE' })
    .then(function(r){
      toast(r.caixa && r.caixa.length
        ? 'Documento apagado. O ficheiro voltou \u00e0 caixa, por triar.'
        : 'Documento apagado.');
    })
    .catch(function(e){ toast(e.message || 'N\u00e3o foi poss\u00edvel apagar o documento.'); })
    /* Correndo bem ou mal, o ecra volta a ser o que a base de dados diz. Uma
       linha que ja nao existe nao pode ficar a espera de um refresh a mao. */
    .then(function(){
      load();
      if (typeof ibCarregar === 'function') ibCarregar();
    });
}

function renderDocsFiltro(){
  var box = $('docsFiltro');
  if (!box) return;
  clear(box);
  var comDono = {};
  D.documents.forEach(function(d){ if (d.person_id) comDono[d.person_id] = true; });
  (D.people || []).forEach(function(p){
    if (!comDono[p.id]) return;
    var b = el('button', 'chip' + (DOCS_PESSOA && DOCS_PESSOA !== p.id ? ' off' : ''));
    b.type = 'button';
    var i = el('i');
    i.style.background = p.color || 'var(--c1)';
    b.appendChild(i);
    b.appendChild(document.createTextNode(p.name));
    b.addEventListener('click', function(){
      DOCS_PESSOA = DOCS_PESSOA === p.id ? null : p.id;
      renderDocumentos();
    });
    box.appendChild(b);
  });
  if (box.children.length){
    var todos = el('button', 'chip' + (DOCS_PESSOA ? ' off' : ''));
    todos.type = 'button';
    todos.textContent = 'Todos';
    todos.addEventListener('click', function(){ DOCS_PESSOA = null; renderDocumentos(); });
    box.appendChild(todos);
  }
}

function renderDocumentos(){
  var tb = $('documents');
  clear(tb);
  renderDocsFiltro();

  var porLer = 0;
  D.documents.forEach(function(d){ if (!d.lido) porLer++; });

  var lista = D.documents.filter(function(d){
    return !DOCS_PESSOA || d.person_id === DOCS_PESSOA;
  });

  lista.forEach(function(d){
    var tr = el('tr');

    /* O nome abre o ficheiro. Quem abre, leu: a marca desaparece sozinha. */
    var tdn = el('td');
    if (!d.lido){
      var ponto = el('i');
      ponto.title = 'Por ler';
      ponto.style.cssText = 'display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent);margin-right:7px;vertical-align:middle;cursor:pointer';
      ponto.addEventListener('click', function(){ marcarLido(d, true); });
      tdn.appendChild(ponto);
    }
    if (d.inbox_id){
      var a = el('a', null, d.name);
      a.href = '/api/inbox/' + d.inbox_id + '/ficheiro';
      a.target = '_blank'; a.rel = 'noopener';
      if (!d.lido) a.style.fontWeight = '600';
      a.addEventListener('click', function(){ if (!d.lido) marcarLido(d, true); });
      tdn.appendChild(a);
    } else {
      var s = el('span', null, d.name);
      if (!d.lido) s.style.fontWeight = '600';
      tdn.appendChild(s);
    }
    if (d.lido){
      var volta = el('button', null, 'marcar por ler');
      volta.type = 'button';
      volta.style.cssText = 'margin-left:.5rem;border:0;background:none;padding:0;font:inherit;font-size:.6875rem;color:var(--faint);cursor:pointer';
      volta.addEventListener('click', function(){ marcarLido(d, false); });
      tdn.appendChild(volta);
    }
    tr.appendChild(tdn);

    var dono = pessoaDoc(d.person_id);
    var tdp = el('td', null, dono ? dono.name : '');
    tdp.style.whiteSpace = 'nowrap';
    tr.appendChild(tdp);

    tr.appendChild(el('td', null, d.entity || ''));
    tr.appendChild(el('td', 'n', d.issued_on || ''));
    tr.appendChild(el('td', 'n', d.valid_on || d.valid_until || ''));

    /* A catalogacao automatica ha-de errar um dia; sem isto o papel errado
       ficava no ecra para sempre. */
    var tdx = el('td');
    var bx = el('button', 'btn danger', 'Apagar');
    bx.type = 'button';
    bx.style.padding = '.18rem .5rem';
    bx.style.fontSize = '.75rem';
    bx.addEventListener('click', function(){ apagarDocumento(d); });
    tdx.appendChild(bx);
    tr.appendChild(tdx);
    tb.appendChild(tr);
  });

  if (!lista.length){
    var vazio = el('tr');
    var c = el('td', 'empty', DOCS_PESSOA ? 'Nada em nome desta pessoa.' : 'Ainda n\u00e3o h\u00e1 documentos.');
    c.colSpan = 6;
    vazio.appendChild(c);
    tb.appendChild(vazio);
  }

  /* O numero ao lado de Documentos e o que falta ler, nao o total. */
  $('badgeDocs').textContent = porLer;
  var resumo = $('docsResumo');
  if (resumo){
    resumo.textContent = porLer
      ? porLer + ' por ler'
      : (D.documents.length ? 'tudo lido' : '');
  }
  if ($('docsNote')) $('docsNote').textContent = D.notes.docs_avisos || '';
}

function marcarLido(d, lido){
  apiGestao('/api/documentos/' + d.id + '/lido', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lido: lido })
  }).then(function(){
    d.lido = lido;
    renderDocumentos();
  }).catch(function(e){
    toast(e.message || 'N\u00e3o foi poss\u00edvel marcar o documento.');
    load();
  });
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

function renderEnvBar(){
  var env = (D.meta.env || '').trim();
  var bar = $('envbar'), chip = $('envChip');
  if (!env || env.toLowerCase() === 'real'){
    bar.hidden = true; chip.hidden = true;
    document.body.classList.remove('has-envbar');
    return;
  }
  $('envbarTitle').textContent = 'Ambiente de ' + env;
  $('envbarNote').textContent = D.meta.env_nota || 'Os dados não são reais — nada aqui aconteceu.';
  chip.textContent = env;
  bar.hidden = false; chip.hidden = false;
  document.body.classList.add('has-envbar');
}

function renderAll(){
  $('brandSub').textContent = D.meta.household || '';
  $('ownerName').textContent = D.meta.owner || '';
  var me = D.people[0];
  $('ownerInitials').textContent = me ? me.initials : '—';
  $('ownerMeta').textContent = 'Agregado · ' + D.people.length + ' pessoas';
  $('pageSub').textContent = D.meta.today_label || '';
  renderEnvBar();

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
    .then(function(r){
      if (r.status === 401) { mostrarLogin('A sessão terminou. Entra outra vez.'); throw new Error('401'); }
      if (!r.ok) throw new Error('api');
      return r.json();
    })
    .then(function(data){
      D = data;
      renderAll();
      if (notify) toast('Dados relidos da base de dados.');
    })
    .catch(function(err){
      if (err && err.message === '401') return;
      $('pageSub').textContent = 'Não foi possível ler a base de dados.';
      toast('Sem ligação à base de dados.');
    });
}

wire();

/* =========================================================================
 * TAREFAS — pessoas, projetos e tarefas reais (origin='real')
 * ========================================================================= */

var G = { people: [], projects: [], tasks: [] };
var gState = { view: 'abertas', person: null, editing: null, loaded: false };

function hoje0(){ var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function diaISO(dt){
  return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
}
function pessoa(id){ return G.people.filter(function(p){ return p.id === id; })[0] || null; }
function projeto(id){ return G.projects.filter(function(p){ return p.id === id; })[0] || null; }

function dataCurta(iso){
  if (!iso) return '';
  var d = parseDay(iso);
  return d.getDate() + ' ' + MESES[d.getMonth()].slice(0,3);
}

function apiGestao(url, opts){
  return fetch(url, opts).then(function(r){
    if (!r.ok) return r.json().catch(function(){ return {}; }).then(function(e){ throw new Error(e.error || 'erro'); });
    return r.json();
  });
}

function loadGestao(){
  return apiGestao('/api/gestao').then(function(d){
    G = d; gState.loaded = true; renderGestao();
  }).catch(function(){ toast('Não foi possível ler as tarefas.'); });
}

/* ---------- listagem ---------- */
function balde(t){
  if (!t.due_on) return 'semdata';
  var hoje = hoje0(), d = parseDay(t.due_on);
  if (d < hoje) return 'atrasadas';
  if (d.getTime() === hoje.getTime()) return 'hoje';
  if (d <= addDays(hoje, 7)) return 'semana';
  return 'depois';
}
var BALDES = [
  ['atrasadas','Atrasadas'], ['hoje','Hoje'], ['semana','Próximos 7 dias'],
  ['depois','Mais tarde'], ['semdata','Sem prazo']
];

function tarefasVisiveis(){
  return G.tasks.filter(function(t){
    var feita = t.status === 'concluida' || t.status === 'cancelada';
    if (gState.view === 'abertas' && feita) return false;
    if (gState.view === 'concluidas' && !feita) return false;
    if (gState.person){
      var envolve = t.owner_id === gState.person || (t.subjects || []).indexOf(gState.person) >= 0;
      if (!envolve) return false;
    }
    return true;
  });
}

function renderLista(){
  var box = $('tList');
  clear(box);
  var lista = tarefasVisiveis();
  $('tCount').textContent = lista.length + (lista.length === 1 ? ' tarefa' : ' tarefas');

  if (!G.people.length){
    var vazio = el('p', 'empty', 'Ainda não há ninguém registado. Começa por adicionar as pessoas, aí em baixo — depois as tarefas passam a ter dono.');
    box.appendChild(vazio);
    return;
  }
  if (!lista.length){
    box.appendChild(el('p', 'empty', gState.view === 'concluidas' ? 'Nada concluído ainda.' : 'Nada por fazer com estes filtros.'));
    return;
  }

  BALDES.forEach(function(b){
    var doBalde = lista.filter(function(t){ return balde(t) === b[0]; });
    if (!doBalde.length) return;
    var g = el('div', 'tgroup' + (b[0] === 'atrasadas' ? ' late' : ''));
    var h = el('h4');
    h.appendChild(document.createTextNode(b[1]));
    h.appendChild(el('span', null, String(doBalde.length)));
    g.appendChild(h);
    doBalde.forEach(function(t){ g.appendChild(itemTarefa(t)); });
    box.appendChild(g);
  });
}

function itemTarefa(t){
  var feita = t.status === 'concluida';
  var li = el('div', 'titem' + (feita ? ' done' : ''));

  var box = el('button', 'box');
  box.type = 'button';
  box.title = feita ? 'Reabrir' : 'Marcar como feita';
  box.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke-width="3.2" stroke-linecap="round"><path d="M5 13l4 4L19 7"/></svg>';
  box.addEventListener('click', function(){
    guardarTarefa(t.id, { status: feita ? 'aberta' : 'concluida' });
  });
  li.appendChild(box);

  var main = el('button', 'tmain');
  main.type = 'button';
  main.appendChild(el('b', null, t.title));
  var meta = el('div', 'tmeta');
  var dono = pessoa(t.owner_id);
  if (dono){
    var m = el('span', 'mini');
    var dot = el('i'); dot.style.background = dono.color || 'var(--c1)';
    m.appendChild(dot); m.appendChild(document.createTextNode(dono.name));
    meta.appendChild(m);
  }
  (t.subjects || []).forEach(function(pid){
    var p = pessoa(pid);
    if (!p) return;
    meta.appendChild(el('span', 'sep', '·'));
    meta.appendChild(el('span', null, 'por causa de ' + p.name));
  });
  var pr = projeto(t.project_id);
  if (pr){
    meta.appendChild(el('span', 'sep', '·'));
    var pill = pill_(pr.name, 'accent');
    meta.appendChild(pill);
  }
  if (t.notes){
    meta.appendChild(el('span', 'sep', '·'));
    meta.appendChild(el('span', null, t.notes));
  }
  main.appendChild(meta);
  main.addEventListener('click', function(){ editarTarefa(t); });
  li.appendChild(main);

  var right = el('div', 'right');
  if (t.due_on){
    var b = balde(t);
    var nivel = b === 'atrasadas' ? 'bad' : (b === 'hoje' ? 'warn' : '');
    right.appendChild(pill_(b === 'hoje' ? 'hoje' : dataCurta(t.due_on), nivel));
  }
  if (t.priority !== 'normal'){
    var p2 = el('span', 'prio ' + t.priority);
    p2.title = t.priority === 'alta' ? 'Prioridade alta' : 'Prioridade baixa';
    right.appendChild(p2);
  }
  li.appendChild(right);
  return li;
}
function pill_(texto, nivel){ return pill(texto, nivel); }

/* ---------- escrita ---------- */
function guardarTarefa(id, dados){
  apiGestao('/api/gestao/tarefas/' + id, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados)
  }).then(function(d){ G = d; renderGestao(); })
    .catch(function(){ toast('Não deu para gravar.'); });
}

function editarTarefa(t){
  gState.editing = t.id;
  var f = $('tForm');
  f.title.value = t.title || '';
  f.owner_id.value = t.owner_id || '';
  f.due_on.value = t.due_on || '';
  f.project_id.value = t.project_id || '';
  f.area.value = t.area || '';
  f.priority.value = t.priority || 'normal';
  f.repeat_every.value = t.repeat_every || '';
  f.notes.value = t.notes || '';
  marcarChips('tSubjects', t.subjects || []);
  $('tFormTitle').textContent = 'Editar tarefa';
  $('tFormHint').textContent = t.status === 'concluida' ? 'concluída' : '';
  $('tSubmit').textContent = 'Guardar';
  $('tCancel').hidden = false;
  $('tDelete').hidden = false;
  f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function limparForm(){
  gState.editing = null;
  var f = $('tForm');
  f.reset();
  marcarChips('tSubjects', []);
  $('tFormTitle').textContent = 'Nova tarefa';
  $('tFormHint').textContent = '';
  $('tSubmit').textContent = 'Adicionar';
  $('tCancel').hidden = true;
  $('tDelete').hidden = true;
}

function chipsSelecionados(id){
  var out = [];
  $(id).querySelectorAll('.chip').forEach(function(c){
    if (c.getAttribute('aria-pressed') === 'true') out.push(Number(c.dataset.id));
  });
  return out;
}
function marcarChips(id, ids){
  $(id).querySelectorAll('.chip').forEach(function(c){
    var on = ids.indexOf(Number(c.dataset.id)) >= 0;
    c.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
function construirChips(id, pessoas){
  var box = $(id);
  clear(box);
  pessoas.forEach(function(p){
    var b = el('button', 'chip');
    b.type = 'button';
    b.dataset.id = p.id;
    b.setAttribute('aria-pressed', 'false');
    var i = el('i');
    i.style.background = p.color || 'var(--c1)';
    b.appendChild(i);
    b.appendChild(document.createTextNode(p.name));
    b.addEventListener('click', function(){
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
    });
    box.appendChild(b);
  });
}

/* ---------- painéis laterais ---------- */
function renderProjetos(){
  var box = $('tProjects');
  clear(box);
  if (!G.projects.length){
    box.appendChild(el('p', 'empty', 'Ainda sem projetos. A mudança de casa e a sociedade nova entram aqui.'));
    return;
  }
  G.projects.forEach(function(pr){
    var abertas = G.tasks.filter(function(t){
      return t.project_id === pr.id && t.status !== 'concluida' && t.status !== 'cancelada';
    }).length;
    var nomes = (pr.members || []).map(function(m){
      var p = pessoa(m.person_id);
      return p ? (m.member_role === 'responsavel' ? p.name + ' (resp.)' : p.name) : null;
    }).filter(Boolean).join(', ');
    var detalhe = [pr.description, nomes].filter(Boolean).join(' · ');
    var right = el('div');
    right.style.textAlign = 'right';
    right.appendChild(pill(abertas + (abertas === 1 ? ' tarefa' : ' tarefas'), abertas ? 'accent' : ''));
    if (pr.target_on){
      var d = el('div', 'mono num', dataCurta(pr.target_on));
      d.style.marginTop = '3px';
      right.appendChild(d);
    }
    box.appendChild(row(pr.name, detalhe, right));
  });
}

function renderFiltros(){
  var box = $('tFilter');
  clear(box);
  G.people.forEach(function(p){
    var b = el('button', 'chip' + (gState.person && gState.person !== p.id ? ' off' : ''));
    b.type = 'button';
    var i = el('i');
    i.style.background = p.color || 'var(--c1)';
    b.appendChild(i);
    b.appendChild(document.createTextNode(p.name));
    b.addEventListener('click', function(){
      gState.person = gState.person === p.id ? null : p.id;
      renderGestao();
    });
    box.appendChild(b);
  });
  if (G.people.length){
    var todos = el('button', 'chip' + (gState.person ? '' : ' off'));
    todos.type = 'button';
    todos.textContent = 'Todos';
    todos.addEventListener('click', function(){ gState.person = null; renderGestao(); });
    box.appendChild(todos);
  }
}

function encherSelects(){
  var owner = $('tOwner');
  var atual = owner.value;
  clear(owner);
  owner.appendChild(new Option('—', ''));
  G.people.filter(function(p){ return p.can_own_tasks; }).forEach(function(p){
    owner.appendChild(new Option(p.name, p.id));
  });
  owner.value = atual;

  var proj = $('tProject');
  var atualP = proj.value;
  clear(proj);
  proj.appendChild(new Option('—', ''));
  G.projects.forEach(function(p){ proj.appendChild(new Option(p.name, p.id)); });
  proj.value = atualP;

  construirChips('tSubjects', G.people);
  construirChips('pMembers', G.people);
}

function renderGestao(){
  renderFiltros();
  encherSelects();
  renderLista();
  renderProjetos();
  var abertas = G.tasks.filter(function(t){ return t.status !== 'concluida' && t.status !== 'cancelada'; }).length;
  $('badgeTarefas').textContent = abertas || '';
  var alvo = gState.person ? pessoa(gState.person) : null;
  $('tListTitle').textContent = alvo ? ('Tarefas de ' + alvo.name) : 'Tarefas';
}

/* ---------- ligações ---------- */
function ligarGestao(){
  var tabs = document.querySelector('[data-tabs="tar"]');
  if (tabs){
    tabs.addEventListener('click', function(e){
      var b = e.target.closest('button[data-tab]');
      if (!b) return;
      gState.view = b.dataset.tab;
      renderLista();
    });
  }

  $('tForm').addEventListener('submit', function(e){
    e.preventDefault();
    var f = e.target;
    var dados = {
      title: f.title.value.trim(),
      owner_id: f.owner_id.value || null,
      due_on: f.due_on.value || null,
      project_id: f.project_id.value || null,
      area: f.area.value || null,
      priority: f.priority.value,
      repeat_every: f.repeat_every.value || null,
      notes: f.notes.value.trim() || null,
      subjects: chipsSelecionados('tSubjects')
    };
    if (!dados.title) return;
    var url = gState.editing ? '/api/gestao/tarefas/' + gState.editing : '/api/gestao/tarefas';
    apiGestao(url, {
      method: gState.editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    }).then(function(d){
      G = d;
      limparForm();
      renderGestao();
      toast(gState.editing ? 'Tarefa gravada.' : 'Tarefa adicionada.');
    }).catch(function(){ toast('Não deu para gravar a tarefa.'); });
  });

  $('tCancel').addEventListener('click', limparForm);
  $('tDelete').addEventListener('click', function(){
    if (!gState.editing) return;
    var id = gState.editing;
    apiGestao('/api/gestao/tarefas/' + id, { method: 'DELETE' }).then(function(d){
      G = d; limparForm(); renderGestao(); toast('Tarefa apagada.');
    }).catch(function(){ toast('Não deu para apagar.'); });
  });


  $('btnProjeto').addEventListener('click', function(){
    var f = $('pForm');
    f.hidden = !f.hidden;
    if (!f.hidden) f.name.focus();
  });
  $('pCancel').addEventListener('click', function(){ $('pForm').hidden = true; });
  $('pForm').addEventListener('submit', function(e){
    e.preventDefault();
    var f = e.target;
    apiGestao('/api/gestao/projetos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: f.name.value.trim(),
        description: f.description.value.trim() || null,
        area: f.area.value,
        target_on: f.target_on.value || null,
        members: chipsSelecionados('pMembers').map(function(id){ return { person_id: id, member_role: 'participante' }; })
      })
    }).then(function(){
      f.reset(); f.hidden = true;
      return loadGestao();
    }).then(function(){ toast('Projeto criado.'); })
      .catch(function(){ toast('Não deu para criar o projeto.'); });
  });
}

ligarGestao();

/* =========================================================================
 * ENTRADA — o painel só abre depois do login (quando há login configurado)
 * ========================================================================= */

var CFG = { authEnabled: false };

function iniciarApp(sessao){
  $('loginScreen').hidden = true;
  $('app').hidden = false;
  if (sessao && sessao.email){
    var b = $('btnSair');
    b.hidden = false;
    b.title = 'Terminar sessão de ' + sessao.email;
  }
  load(false);
  loadGestao();
}

function mostrarLogin(erro){
  $('app').hidden = true;
  var ecra = $('loginScreen');
  ecra.hidden = false;
  if (erro){
    var e = $('loginErro');
    e.textContent = erro;
    e.hidden = false;
  }
  desenharBotaoGoogle();
}

function desenharBotaoGoogle(){
  if (!CFG.googleClientId) {
    $('loginNota').textContent = 'Falta configurar o GOOGLE_CLIENT_ID no servidor.';
    return;
  }
  if (!(window.google && google.accounts && google.accounts.id)){
    return setTimeout(desenharBotaoGoogle, 300);
  }
  if (desenharBotaoGoogle.feito) return;
  desenharBotaoGoogle.feito = true;
  google.accounts.id.initialize({
    client_id: CFG.googleClientId,
    callback: function(resposta){
      fetch('/auth/google', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: resposta.credential })
      }).then(function(r){
        return r.json().then(function(d){
          if (!r.ok) throw new Error(d.error || 'Não foi possível entrar.');
          return d;
        });
      }).then(function(sessao){
        $('loginErro').hidden = true;
        iniciarApp(sessao);
      }).catch(function(err){
        var e = $('loginErro');
        e.textContent = err.message;
        e.hidden = false;
      });
    }
  });
  google.accounts.id.renderButton($('gbtn'), {
    theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'pt-PT'
  });
}

function arrancar(){
  fetch('/api/config')
    .then(function(r){ return r.json(); })
    .then(function(cfg){
      CFG = cfg;
      if (!cfg.authEnabled) return iniciarApp(null);
      if (cfg.sessao && cfg.sessao.email) return iniciarApp(cfg.sessao);
      mostrarLogin(null);
    })
    .catch(function(){ iniciarApp(null); });
}

var sair = $('btnSair');
if (sair){
  sair.addEventListener('click', function(){
    fetch('/auth/logout', { method: 'POST' }).then(function(){ location.reload(); });
  });
}

arrancar();
