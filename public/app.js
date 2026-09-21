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

/* ---------------- toast ---------------- */
var toastTimer;
function toast(msg){
  var t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 3000);
}

/* Os contadores viviam da coluna scope, que so o seed preenchia: diziam
   sempre zero de zero. O numero que interessa e o das tarefas a serio, e esse
   vem do /api/gestao - e escrito la. */

/* ---------------- HOJE ---------------- */
/* Quantos dias faltam, contados a partir de hoje. Negativo e passado. */
function diasAte(iso){
  var d = parseDay(iso);
  if (!d) return null;
  var hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
}

/* A mesma data quer dizer coisas diferentes conforme o que expira: um prazo
   de tarefa e urgente a dois dias, um cartao avisa-se com um mes. */
function urgencia(n, origem){
  if (n === null) return { texto: '', nivel: '' };
  var perto = origem === 'tarefa' ? 7 : 30;
  var texto = n < 0 ? (n === -1 ? 'ontem' : 'h\u00e1 ' + (-n) + ' dias')
    : n === 0 ? 'hoje'
    : n === 1 ? 'amanh\u00e3'
    : 'em ' + n + ' dias';
  var nivel = n < 0 ? 'bad' : n <= perto ? 'warn' : '';
  return { texto: texto, nivel: nivel };
}

/* Um cartao do painel Hoje. Vive fora do renderHoje porque agora e desenhado
   em dois sitios: o que esta a chegar, e o que ja passou. */
function attnCard(x){
  var a = x.a;
  var art = el('article', x.u.nivel);
  var g = el('div', 'grow');
  g.appendChild(el('h4', null, a.title));
  var abaixo = [a.origem === 'tarefa' ? 'prazo' : 'validade', a.detail]
    .filter(Boolean).join(' \u00b7 ');
  g.appendChild(el('p', null, abaixo));
  art.appendChild(g);
  var w = el('div', 'when');
  var p = pill(x.u.texto || dataCurta(a.quando), x.u.nivel);
  p.insertBefore(el('i', 'dot'), p.firstChild);
  w.appendChild(p);
  art.appendChild(w);
  /* Clicar resolve aqui mesmo: o aviso abre numa janela por cima do Hoje, com
     os campos que se mexem para o despachar (aviso.js). O salto para o ecra
     inteiro fica la dentro, num botao, para quem precisar dele. */
  art.style.cursor = 'pointer';
  art.addEventListener('click', function(){
    if (typeof avAbrir === 'function') { avAbrir(a); return; }
    if (a.origem === 'pessoa' && typeof fiAbrir === 'function') { fiAbrir(a.id); return; }
    show(a.origem === 'documento' ? 'documentos' : 'tarefas');
  });
  return art;
}

function renderHoje(){
  var list = $('attnList');
  clear(list);
  var itens = (D.attention || []).map(function(a){
    var n = diasAte(a.quando);
    var u = urgencia(n, a.origem);
    return { a: a, dias: n, u: u };
  });

  /* O painel mostrava tudo o que tinha prazo, incluindo tarefas de ha um ano:
     quarenta e cinco linhas nao apontam para nada. O que ja passou nao se
     esconde - conta-se numa linha so, que se abre. A vista fica o que vem ai. */
  var atrasados = itens.filter(function(x){ return x.dias !== null && x.dias < 0; });
  var proximos  = itens.filter(function(x){ return x.dias === null || x.dias >= 0; });

  if (atrasados.length){
    /* "21 set" para uma data do ano passado engana; nesse caso leva o ano. */
    var q = atrasados[0].a.quando;
    var maisAntigo = dataCurta(q) +
      (q.slice(0, 4) !== String(D.meta.today).slice(0, 4) ? ' de ' + q.slice(0, 4) : '');
    var bloco = el('details', 'atraso');
    var cab = el('summary');
    cab.appendChild(el('b', null, atrasados.length + ' em atraso'));
    cab.appendChild(el('span', null, 'o mais antigo de ' + maisAntigo));
    bloco.appendChild(cab);
    var dentro = el('div', 'attn');
    /* Ao contrario do resto: o que falhou ha menos tempo ainda se resolve. */
    atrasados.slice().reverse().forEach(function(x){ dentro.appendChild(attnCard(x)); });
    bloco.appendChild(dentro);
    list.appendChild(bloco);
  }

  proximos.forEach(function(x){ list.appendChild(attnCard(x)); });

  if (!itens.length){
    list.appendChild(el('p', 'empty', 'Nada com data a chegar. O que tiver prazo aparece aqui sozinho.'));
  } else if (!proximos.length){
    list.appendChild(el('p', 'empty', 'Nada a chegar nos pr\u00f3ximos dias.'));
  }
  var rotulo = 'Precisa de ti \u00b7 ' + proximos.length + ' a chegar';
  if (atrasados.length) rotulo += ' \u00b7 ' + atrasados.length + ' em atraso';
  $('attnLabel').textContent = rotulo;
  $('badgeHoje').textContent = itens.length;

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
  $('loadLabel').textContent = D.meta.week_label || '';

  /* Esta lista lia when_label/when_level, campos que a consulta ja nao devolve:
     mostrava quarenta e cinco tracos. Passa a usar a mesma conta de urgencia
     do painel Hoje, e so o que ainda esta a tempo de ser decidido. */
  var dec = $('decisions');
  clear(dec);
  var decide = (D.attention || []).filter(function(a){
    var n = diasAte(a.quando);
    return n === null || n >= 0;
  });
  decide.forEach(function(a){
    var u = urgencia(diasAte(a.quando), a.origem);
    var r = el('div', 'row');
    r.appendChild(pill(u.texto || dataCurta(a.quando), u.nivel));
    var g = el('div', 'grow');
    g.appendChild(el('span', 't', a.title));
    if (a.detail) g.appendChild(el('span', 's', a.detail));
    r.appendChild(g);
    /* A mesma linha que o Hoje mostra abre a mesma janela: a lista chama-se
       «a precisar de decisao» e agora deixa mesmo decidir sem sair daqui. */
    if (typeof avAbrir === 'function'){
      r.style.cursor = 'pointer';
      r.tabIndex = 0;
      r.setAttribute('role', 'button');
      r.addEventListener('click', function(){ avAbrir(a); });
      r.addEventListener('keydown', function(e){
        if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); avAbrir(a); }
      });
    }
    dec.appendChild(r);
  });
  if (!decide.length){
    dec.appendChild(el('p', 'empty', 'Nada a decidir com data marcada.'));
  }
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
    /* O cartao passa a abrir a ficha: quem clica num nome quer ver a pessoa,
       nao ficar a olhar para as iniciais. O modulo ficha.js escuta o clique
       por este data-id. */
    var d = el('div', 'person');
    d.dataset.id = p.id;
    d.tabIndex = 0;
    d.setAttribute('role', 'button');
    d.onkeydown = function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); d.click(); } };
    var av = el('div', 'avatar', p.tem_avatar ? '' : p.initials);
    if (p.tem_avatar) {
      var img = document.createElement('img');
      img.src = '/api/pessoas/' + p.id + '/avatar';
      img.alt = p.name || '';
      av.appendChild(img);
    }
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
}

/* ---------------- FINANÇAS ---------------- */
function num(n){ return n.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function eur(n){ return num(n) + ' €'; }

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
var DOC_TIPOS = ['cart\u00e3o', 'contrato', 'ap\u00f3lice', 'declara\u00e7\u00e3o',
  'certid\u00e3o', 'fatura', 'recibo', 'exame', 'outro'];

/* Corrigir um documento a mao. A leitura automatica erra de vez em quando, e
   o remedio nao pode ser apagar e voltar a submeter o ficheiro. */
/* Vindo de um aviso do Hoje (aviso.js) traz `aviso`: o cartao que se clicou.
   Ai o cabecalho diz de que documento se trata e quando expira, e aparece a
   porta para o ecra dos Documentos - a mesma janela, mais contexto. */
function editarDocumento(d, aviso){
  var dlg = el('dialog', 'ar-dlg');
  var cx = el('div', 'ar-dlgc');
  if (aviso){
    var topo = el('div', 'av-top');
    var gt = el('div', 'grow');
    gt.appendChild(el('h3', null, d.name || 'Documento'));
    gt.appendChild(el('p', 'av-sub', 'Documento' + (d.entity ? ' \u00b7 ' + d.entity : ' \u00b7 sem entidade')));
    topo.appendChild(gt);
    if (typeof avPrazoPill === 'function') topo.appendChild(avPrazoPill(aviso));
    cx.appendChild(topo);
  } else {
    cx.appendChild(el('h3', null, 'Documento'));
  }

  function campo(rotulo, elemento){
    var w = el('div');
    w.appendChild(el('label', null, rotulo));
    w.appendChild(elemento);
    cx.appendChild(w);
    return elemento;
  }

  var iNome = el('input'); iNome.type = 'text'; iNome.value = d.name || '';
  campo('Nome', iNome);
  var iEnt = el('input'); iEnt.type = 'text'; iEnt.value = d.entity || '';
  campo('Entidade', iEnt);

  var iArea = el('select');
  campo('\u00c1rea', iArea);
  iArea.appendChild(new Option('\u2014 sem \u00e1rea \u2014', ''));
  ((window.G && G.contextos) || []).filter(function(c){ return !c.parent_id && c.active; })
    .forEach(function(area){
      var g = document.createElement('optgroup');
      g.label = area.name;
      g.appendChild(new Option(area.name, area.id));
      G.contextos.filter(function(c){ return c.parent_id === area.id && c.active; })
        .forEach(function(sub){ g.appendChild(new Option('   ' + sub.name, sub.id)); });
      iArea.appendChild(g);
    });
  iArea.value = d.context_id || '';

  var iTipo = el('select');
  campo('Tipo', iTipo);
  iTipo.appendChild(new Option('\u2014 sem tipo \u2014', ''));
  DOC_TIPOS.forEach(function(k){ iTipo.appendChild(new Option(k, k)); });
  if (d.kind && DOC_TIPOS.indexOf(d.kind) < 0) iTipo.appendChild(new Option(d.kind, d.kind));
  iTipo.value = d.kind || '';

  var iQuem = el('select');
  campo('De quem', iQuem);
  iQuem.appendChild(new Option('\u2014 de ningu\u00e9m \u2014', ''));
  (D.people || []).forEach(function(p){ iQuem.appendChild(new Option(p.name, p.id)); });
  iQuem.value = d.person_id || '';

  var iData = el('input'); iData.type = 'date'; iData.value = d.issued_on || '';
  campo('Data do documento', iData);
  var iVal = el('input'); iVal.type = 'date'; iVal.value = d.valid_on || '';
  campo('V\u00e1lido at\u00e9', iVal);

  var pe = el('div', 'ar-dlga');
  if (aviso){
    pe.classList.add('av-acoes');
    var ir = el('button', 'btn esq', 'Abrir nos Documentos');
    ir.type = 'button';
    ir.addEventListener('click', function(){ dlg.close(); dlg.remove(); show('documentos'); });
    pe.appendChild(ir);
  }
  var cancelar = el('button', 'btn', aviso ? 'Fechar' : 'Cancelar');
  cancelar.type = 'button';
  cancelar.addEventListener('click', function(){ dlg.close(); dlg.remove(); });
  var gravar = el('button', 'btn primary', 'Gravar');
  gravar.type = 'button';
  gravar.addEventListener('click', function(){
    apiGestao('/api/documentos/' + d.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: iNome.value.trim() || d.name,
        entity: iEnt.value.trim() || null,
        context_id: iArea.value || null,
        kind: iTipo.value || null,
        person_id: iQuem.value || null,
        issued_on: iData.value || null,
        valid_on: iVal.value || null
      })
    }).then(function(){ dlg.close(); dlg.remove(); })
      .catch(function(e){ toast(e.message || 'N\u00e3o foi poss\u00edvel gravar.'); })
      .then(function(){ load(); });
  });
  pe.appendChild(cancelar); pe.appendChild(gravar);
  cx.appendChild(pe);

  dlg.appendChild(cx);
  dlg.addEventListener('cancel', function(){ setTimeout(function(){ dlg.remove(); }, 0); });
  document.body.appendChild(dlg);
  dlg.showModal();
  iNome.focus();
}

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
    /* Cada documento tem o seu ficheiro; alguns tem mais do que um (frente e
       verso, recibo e comprovativo). O nome abre o primeiro, os outros vao
       numerados ao lado. Sem ficheiro nenhum, diz-se e oferece-se o botao. */
    var fich = (d.ficheiros && d.ficheiros.length) ? d.ficheiros : (d.inbox_id ? [d.inbox_id] : []);
    if (fich.length){
      var a = el('a', null, d.name);
      a.href = '/api/inbox/' + fich[0] + '/ficheiro';
      a.target = '_blank'; a.rel = 'noopener';
      if (!d.lido) a.style.fontWeight = '600';
      a.addEventListener('click', function(){ if (!d.lido) marcarLido(d, true); });
      tdn.appendChild(a);
      fich.slice(1).forEach(function(fid, i){
        var mais = el('a', null, String(i + 2));
        mais.href = '/api/inbox/' + fid + '/ficheiro';
        mais.target = '_blank'; mais.rel = 'noopener';
        mais.title = 'Ficheiro ' + (i + 2) + ' de ' + fich.length;
        mais.style.cssText = 'margin-left:.4rem;font-size:.75rem';
        tdn.appendChild(mais);
      });
    } else {
      var s = el('span', null, d.name);
      if (!d.lido) s.style.fontWeight = '600';
      tdn.appendChild(s);
      var sem = el('span', null, 'sem ficheiro');
      sem.style.cssText = 'margin-left:.5rem;font-size:.6875rem;color:var(--warn, #9a6700)';
      tdn.appendChild(sem);
    }
    if (d.lido){
      var volta = el('button', null, 'marcar por ler');
      volta.type = 'button';
      volta.style.cssText = 'margin-left:.5rem;border:0;background:none;padding:0;font:inherit;font-size:.6875rem;color:var(--faint);cursor:pointer';
      volta.addEventListener('click', function(){ marcarLido(d, false); });
      tdn.appendChild(volta);
    }
    /* Onde vive e o que e, por baixo do nome: nao vale a pena mais duas
       colunas numa tabela que ja tem sete. */
    var onde = [areaNome(d.context_id), d.kind].filter(Boolean).join(' · ');
    if (onde){
      var sub = el('div', null, onde);
      sub.style.cssText = 'font-size:.6875rem;color:var(--muted);margin-top:2px';
      tdn.appendChild(sub);
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
    tdx.style.whiteSpace = 'nowrap';
    var ba = el('button', 'btn', (d.ficheiros && d.ficheiros.length) || d.inbox_id ? '+ Ficheiro' : 'Anexar');
    ba.type = 'button';
    ba.title = 'Pendurar um ficheiro neste documento';
    ba.style.padding = '.18rem .5rem';
    ba.style.fontSize = '.75rem';
    ba.style.marginRight = '.35rem';
    ba.addEventListener('click', function(){ anexarDocumento(d); });
    tdx.appendChild(ba);
    var be = el('button', 'btn', 'Editar');
    be.type = 'button';
    be.style.padding = '.18rem .5rem';
    be.style.fontSize = '.75rem';
    be.style.marginRight = '.35rem';
    be.addEventListener('click', function(){ editarDocumento(d); });
    tdx.appendChild(be);
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
}

/* Escolher um ficheiro e pendura-lo no documento, sem passar pela caixa:
   o documento ja esta decidido, falta-lhe so o papel. */
function anexarDocumento(d){
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'application/pdf,image/*,.doc,.docx,.xls,.xlsx,.txt';
  inp.addEventListener('change', function(){
    var f = inp.files && inp.files[0];
    if (!f) return;
    var fd = new FormData();
    fd.append('ficheiro', f);
    toast('A guardar o ficheiro\u2026');
    fetch('/api/documentos/' + d.id + '/ficheiro', { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || 'Falhou.'); return j; }); })
      .then(function(){ toast('Ficheiro guardado em \u00ab' + d.name + '\u00bb.'); })
      .catch(function(e){ toast(e.message || 'N\u00e3o foi poss\u00edvel guardar o ficheiro.'); })
      .then(function(){ load(); });
  });
  inp.click();
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

function renderAll(){
  $('brandSub').textContent = D.meta.household || '';
  $('ownerName').textContent = D.meta.owner || '';
  var me = D.people[0];
  $('ownerInitials').textContent = me ? me.initials : '—';
  $('ownerMeta').textContent = 'Agregado · ' + D.people.length + ' pessoas';
  $('pageSub').textContent = D.meta.today_label || '';

  calState.selected = calState.selected || D.meta.today;
  renderHoje();
  renderAgendaShell();
  renderMonth(); renderDay(); renderUpcoming(); renderLoad();
  renderFamilia();
  renderDocumentos();
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

/* A lista, o detalhe e a captura rapida das tarefas vivem em tarefas.js. */

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

/* O nome da área por extenso: «Casa › Quinta do Anjo». Sem o pai, uma
   sub-área sozinha não diz onde vive. */
function areaNome(id){
  if (!id || !G.contextos) return '';
  for (var i = 0; i < G.contextos.length; i++){
    var c = G.contextos[i];
    if (c.id === id) return c.parent_name ? c.parent_name + ' \u203a ' + c.name : c.name;
  }
  return '';
}

function projetoNome(id){
  if (!id || !G.projects) return '';
  for (var i = 0; i < G.projects.length; i++) if (G.projects[i].id === id) return G.projects[i].name;
  return '';
}

/* O ecra dos Projetos vive no projetos.js: lista, pagina de cada projeto e
   tudo o que la se edita. Aqui fica so a ponte, para que uma recarga da
   gestao chegue a esse ecra sem o app.js saber como ele e desenhado. */
function renderProjetos(){
  if (typeof pjRender === 'function'){ pjRender(); return; }
  var b = $('badgeProjetos');
  if (b) b.textContent = (G.projects || []).filter(function(p){ return p.status !== 'concluido'; }).length || '';
}

function encherAreas(id){
  var s = $(id);
  if (!s || !G.contextos) return;
  var atual = s.value;
  clear(s);
  s.appendChild(new Option('\u2014 escolher \u00e1rea \u2014', ''));
  G.contextos.filter(function(c){ return !c.parent_id && c.active; }).forEach(function(area){
    var g = document.createElement('optgroup');
    g.label = area.name;
    g.appendChild(new Option(area.name, area.id));
    G.contextos.filter(function(c){ return c.parent_id === area.id && c.active; })
      .forEach(function(sub){ g.appendChild(new Option('   ' + sub.name, sub.id)); });
    s.appendChild(g);
  });
  s.value = atual;
}

function docPorId(id){
  if (!window.D || !D.documents) return null;
  for (var i = 0; i < D.documents.length; i++) if (D.documents[i].id === id) return D.documents[i];
  return null;
}

function renderGestao(){
  renderProjetos();
  /* O numero ao lado de Tarefas conta tarefas: lembretes e notas nao sao
     trabalho por fazer. */
  var abertas = G.tasks.filter(function(t){
    return t.status !== 'concluida' && t.status !== 'cancelada' && (t.tipo || 'tarefa') === 'tarefa';
  }).length;
  $('badgeTarefas').textContent = abertas || '';
  if (typeof tfRender === 'function') tfRender();
}


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
