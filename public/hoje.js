/* Farol - o Hoje por periodos (27 set).
 *
 * O Hoje era uma lista corrida de trinta avisos, com o que ja passou numa
 * gaveta. Passa a estar partido pelo tempo, que e a pergunta que se faz ao
 * abrir a app: o que e para hoje, para amanha, para esta semana.
 *
 *   Em atraso · Hoje · Amanha · Esta semana · Proxima semana · Este mes ·
 *   e depois um bloco por mes (outubro, novembro...).
 *
 * Cada periodo recolhe-se clicando no titulo; comecam abertos, salvo o Em
 * atraso, que comeca recolhido, e a escolha fica no browser. Cada aviso diz o que e por um icone (tarefa,
 * pagamento, lembrete, aniversario, documento, identificacao) e as tarefas e
 * os pagamentos tem a caixinha para fechar ali mesmo - um pagamento abre a
 * janela de pagar, como nas Tarefas e nas areas.
 *
 * Nao toca no app.js: embrulha o renderHoje e redesenha so a lista dos
 * avisos (#attnList). O cartao e o mesmo attnCard, com as cores das areas.
 */
'use strict';

var HJ = { fechados: {}, pendente: false };
try { HJ.fechados = JSON.parse(localStorage.getItem('hjFechados') || '{}') || {}; } catch (e) { HJ.fechados = {}; }
function hjGuardar() { try { localStorage.setItem('hjFechados', JSON.stringify(HJ.fechados)); } catch (e) {} }

var HJ_CSS =
  '#attnList .hj-per{margin-bottom:6px}' +
  '#attnList .hj-per > h4{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:.6875rem;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:500;padding:8px 2px 6px;cursor:pointer;user-select:none;margin:0}' +
  '#attnList .hj-per > h4:hover{color:var(--ink)}' +
  '#attnList .hj-per > h4 .hj-n{color:var(--faint)}' +
  '#attnList .hj-per > h4 svg{transition:transform .15s;flex:none}' +
  '#attnList .hj-per.fechado > h4 svg{transform:rotate(-90deg)}' +
  '#attnList .hj-per.fechado > .attn{display:none}' +
  '#attnList .hj-per.atraso > h4{color:var(--bad)}' +
  '#attnList .hj-per.hoje > h4{color:var(--accent-ink)}' +
  '#attnList .hj-per > h4::after{content:"";flex:1;height:1px;background:var(--line-soft);margin-left:4px}' +
  '#attnList .hj-ico{flex:none;width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;color:var(--muted);background:color-mix(in srgb, var(--surface) 70%, transparent)}' +
  '#attnList .hj-ico.pag{color:#b7791f}' +
  '#attnList .hj-ico.lem{color:#6b7fa8}' +
  '#attnList .hj-ico.ani{color:#c05688}' +
  '#attnList .hj-ico.doc{color:#5f7478}' +
  '#attnList .hj-ico.ev{color:var(--accent-ink)}' +
  '#attnList .hj-box{flex:none;display:inline-flex}' +
  '#attnList .hj-box .tf-box{margin-top:0}' +
  '#attnList .hj-sem{flex:none;width:17px}' +
  '#attnList article.hj-feito{opacity:.45}' +
  '#attnList article.hj-feito h4{text-decoration:line-through}' +
  /* A Agenda da semana */
  '#agendaHoje.hj-ag li{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:none}' +
  '#agendaHoje.hj-ag li.hj-dia{font-family:var(--mono);font-size:.6875rem;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);padding:12px 0 4px;border-bottom:1px solid var(--line-soft);margin-bottom:2px}' +
  '#agendaHoje.hj-ag li.hj-dia:first-child{padding-top:2px}' +
  '#agendaHoje.hj-ag li.hj-dia.hoje{color:var(--accent-ink);font-weight:600}' +
  '#agendaHoje.hj-ag li.hj-dia .hj-livre{margin-left:auto;text-transform:none;letter-spacing:0;font-family:var(--sans);color:var(--faint)}' +
  '#agendaHoje.hj-ag li.hj-it{cursor:default}' +
  '#agendaHoje.hj-ag li.hj-it.clica{cursor:pointer;border-radius:8px}' +
  '#agendaHoje.hj-ag li.hj-it.clica:hover{background:var(--surface-2)}' +
  '#agendaHoje.hj-ag time{width:40px;font-size:.6875rem;padding:0;color:var(--muted)}' +
  '#agendaHoje.hj-ag .body{min-width:0;flex:1}' +
  '#agendaHoje.hj-ag .body b{display:block;font-size:.8125rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '#agendaHoje.hj-ag .who{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '#agendaHoje.hj-ag .hj-ico{width:20px;height:20px}' +
  '#agendaHoje.hj-ag .hj-ico.ev{color:var(--accent-ink)}' +
  '#agendaHoje.hj-ag .hj-ico.nota{color:#8a7a4f}' +
  '#agendaHoje.hj-ag .hj-cor{width:6px;height:6px;border-radius:50%;flex:none}' +
  /* Os dias que ja passaram ficam a cinzento: riscar diria «feito», e um
     evento nao se faz, acontece. */
  '#agendaHoje.hj-ag li.hj-sem-sep{font-family:var(--serif);font-size:.95rem;color:var(--ink);padding:18px 0 2px}' +
    '#agendaHoje.hj-ag li.passado{opacity:.45}' +
  '#agendaHoje.hj-ag li.passado .hj-ico{filter:grayscale(1)}' +
  /* O Estado das areas compacto: numero a esquerda, nome e nota ao lado,
     sem o titulo do cartao. Metade da altura, os mesmos cinco numeros. */
  '#view-hoje > .card:first-child{padding:10px 12px;margin-bottom:12px !important}' +
  '#view-hoje > .card:first-child > header{display:none}' +
  '#view-hoje .tiles{gap:8px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}' +
  '#view-hoje .tile{display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:center;padding:8px 12px;box-shadow:none}' +
  '#view-hoje .tile .v{grid-row:1 / span 2;grid-column:1;font-size:1.6rem;margin:0;line-height:1}' +
  '#view-hoje .tile .k{grid-column:2;font-size:.78rem;color:var(--ink-2)}' +
  '#view-hoje .tile .n{grid-column:2;font-size:.6875rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';

function hjSvg(d, w) {
  return '<svg width="' + w + '" height="' + w + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
}
var HJ_I = {
  tarefa: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  pagamento: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/>',
  lembrete: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  aniversario: '<path d="M4 21h16"/><path d="M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7"/><path d="M5 16c1.5 1 2.5 1 4 0s2.5-1 4 0 2.5 1 4 0"/><path d="M12 12V8"/><path d="M12 5.5c.8-.8.8-1.7 0-2.5-.8.8-.8 1.7 0 2.5z"/>',
  documento: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  pessoa: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4"/><path d="M15 10h3M15 13h3"/>',
  seta: '<path d="M6 9l6 6 6-6"/>',
  evento: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  nota: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4"/><path d="M8 12h8M8 16h5"/>'
};

function hjEstilo() {
  if (document.getElementById('hjCss')) return;
  var s = document.createElement('style'); s.id = 'hjCss'; s.textContent = HJ_CSS;
  document.head.appendChild(s);
}

function hjTarefa(id) {
  return ((window.G && G.tasks) || []).filter(function (t) { return t.id === id; })[0] || null;
}

/* O que e cada aviso, para o icone. */
function hjTipo(a, t) {
  if (a.origem === 'documento') return 'documento';
  if (a.origem === 'pessoa') return 'pessoa';
  if (a.origem === 'evento') return 'evento';
  var tipo = (t && t.tipo) || 'tarefa';
  if (tipo === 'lembrete') return /YEARLY/.test((t && t.repeat_rule) || '') ? 'aniversario' : 'lembrete';
  return tipo === 'pagamento' ? 'pagamento' : 'tarefa';
}
var HJ_NOMES = { tarefa: 'Tarefa', pagamento: 'Pagamento', lembrete: 'Lembrete', aniversario: 'Aniversário',
  documento: 'Documento a perder validade', pessoa: 'Documento de identificação', evento: 'Evento (lembrete)' };
var HJ_CLS = { tarefa: '', pagamento: 'pag', lembrete: 'lem', aniversario: 'ani', documento: 'doc', pessoa: 'doc', evento: 'ev' };

/* Os periodos. Uma data cai no primeiro que a aceitar. */
function hjDia(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function hjPeriodos() {
  var h = hjDia(new Date());
  var dow = (h.getDay() + 6) % 7;                       // segunda = 0
  var fimSemana = new Date(h.getFullYear(), h.getMonth(), h.getDate() + (6 - dow));
  var fimProxima = new Date(fimSemana.getFullYear(), fimSemana.getMonth(), fimSemana.getDate() + 7);
  var fimMes = new Date(h.getFullYear(), h.getMonth() + 1, 0);
  return function (iso) {
    if (!iso) return { k: 'semdata', nome: 'Sem data', ordem: 99 };
    var d = parseDay(iso);
    var n = Math.round((hjDia(d) - h) / 86400000);
    if (n < 0) return { k: 'atraso', nome: 'Em atraso', ordem: 0 };
    if (n === 0) return { k: 'hoje', nome: 'Hoje', ordem: 1 };
    if (n === 1) return { k: 'amanha', nome: 'Amanhã', ordem: 2 };
    if (d <= fimSemana) return { k: 'semana', nome: 'Esta semana', ordem: 3 };
    if (d <= fimProxima) return { k: 'proxima', nome: 'Próxima semana', ordem: 4 };
    if (d <= fimMes) return { k: 'mes', nome: 'Este mês', ordem: 5 };
    var nome = MESES[d.getMonth()] + (d.getFullYear() !== h.getFullYear() ? ' ' + d.getFullYear() : '');
    return { k: 'm' + d.getFullYear() + '-' + d.getMonth(), nome: nome, ordem: 10 + (d.getFullYear() - h.getFullYear()) * 12 + d.getMonth() };
  };
}

/* O cartao de sempre (attnCard: cores, clique que abre a janela) com o icone
   e, numa tarefa ou pagamento, a caixinha. */
function hjCartao(x) {
  var a = x.a;
  var art = attnCard(x);
  var t = a.origem === 'tarefa' ? hjTarefa(a.id) : null;
  var tipo = hjTipo(a, t);

  var p = art.querySelector('.grow p');
  if (p && a.origem === 'tarefa') p.textContent = a.detail || '';
  /* O lembrete de um evento: «evento · 10:00 · Hospital da Luz». */
  if (p && a.origem === 'evento') p.textContent = ['evento', a.detail].filter(Boolean).join(' \u00b7 ');

  var ico = el('span', 'hj-ico ' + HJ_CLS[tipo]);
  ico.innerHTML = hjSvg(HJ_I[tipo], 14);
  ico.title = HJ_NOMES[tipo];
  art.insertBefore(ico, art.firstChild);

  if (t && (tipo === 'tarefa' || tipo === 'pagamento') && typeof tfCaixa === 'function') {
    var w = el('span', 'hj-box');
    var caixa = tfCaixa(t, function () {
      HJ.pendente = true;
      if (tipo === 'pagamento') {
        caixa.dataset.tfpop = '1';
        return tfPopPagar(tfPorId(t.id) || t, caixa);
      }
      art.classList.add('hj-feito');
      tfFechar(t, 'concluida').catch(function () { art.classList.remove('hj-feito'); });
    });
    caixa.title = tipo === 'pagamento' ? 'Dar por pago' : 'Concluir';
    w.appendChild(caixa);
    art.insertBefore(w, art.firstChild);
  } else {
    art.insertBefore(el('span', 'hj-sem'), art.firstChild);
  }
  return art;
}

function hjRender() {
  var list = $('attnList');
  if (!list || !window.D || !D.attention) return;
  hjEstilo();
  /* O que nao se faz - lembretes e aniversarios - vive na Agenda, nao aqui. */
  var itens = (D.attention || []).filter(function (a) {
    if (a.origem !== 'tarefa') return true;
    var t = hjTarefa(a.id);
    return !(t && t.tipo === 'lembrete');
  }).map(function (a) {
    var n = diasAte(a.quando);
    return { a: a, dias: n, u: urgencia(n, a.origem) };
  });
  var atras = itens.filter(function (x) { return x.dias !== null && x.dias < 0; }).length;
  var lab = $('attnLabel');
  if (lab) lab.textContent = 'Precisa de ti \u00b7 ' + (itens.length - atras) + ' a chegar' + (atras ? ' \u00b7 ' + atras + ' em atraso' : '');
  var bh = $('badgeHoje'); if (bh) bh.textContent = itens.length || '';
  if (!itens.length) {
    clear(list);
    list.appendChild(el('p', 'empty', 'Nada com prazo a chegar. O que tiver prazo aparece aqui sozinho.'));
    return;
  }

  var qual = hjPeriodos();
  var grupos = {};
  itens.forEach(function (x) {
    var p = qual(x.a.quando);
    if (!grupos[p.k]) grupos[p.k] = { p: p, lista: [] };
    grupos[p.k].lista.push(x);
  });

  clear(list);
  Object.keys(grupos).map(function (k) { return grupos[k]; })
    .sort(function (a, b) { return a.p.ordem - b.p.ordem; })
    .forEach(function (g) {
      /* O atraso comeca recolhido (conta-se no titulo, abre-se quando se
         quiser); os outros periodos comecam abertos. Depois vale o que a
         pessoa escolheu. */
      var fechado = HJ.fechados[g.p.k] !== undefined ? HJ.fechados[g.p.k] === true : g.p.k === 'atraso';
      var sec = el('section', 'hj-per ' + g.p.k + (fechado ? ' fechado' : ''));
      var h = el('h4');
      h.innerHTML = hjSvg(HJ_I.seta, 12);
      h.appendChild(el('span', null, g.p.nome));
      h.appendChild(el('span', 'hj-n', String(g.lista.length)));
      h.addEventListener('click', function () {
        var fechar = !sec.classList.contains('fechado');
        sec.classList.toggle('fechado', fechar);
        HJ.fechados[g.p.k] = fechar;
        hjGuardar();
        hjAlinhar();
      });
      sec.appendChild(h);
      var box = el('div', 'attn');
      /* No atraso, o que falhou ha menos tempo primeiro: ainda se resolve. */
      var lista = g.p.k === 'atraso' ? g.lista.slice().reverse() : g.lista;
      lista.forEach(function (x) { box.appendChild(hjCartao(x)); });
      sec.appendChild(box);
      list.appendChild(sec);
    });
}

/* ------------------------------------------------------------------ *
 * A Agenda da semana
 *
 * O cartao da direita mostrava so os eventos de hoje e passava a maior parte
 * dos dias vazio. Passa a ser o sitio do que nao se faz: eventos,
 * aniversarios, lembretes e notas com data, da segunda ao domingo da semana
 * em que se esta. Os dias que ja passaram ficam a cinzento.
 * ------------------------------------------------------------------ */
function hjIso(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function hjAgenda() {
  var ul = $('agendaHoje');
  if (!ul || !window.D) return;
  hjEstilo();
  var h = hjDia(new Date());
  var seg = new Date(h.getFullYear(), h.getMonth(), h.getDate() - (h.getDay() + 6) % 7);
  var dias = [];
  /* Esta semana e a seguinte. So a semana corrente deixava o domingo cego:
     o aniversario de segunda-feira nao aparecia em lado nenhum. A semana
     seguinte mostra so os dias que tem alguma coisa. */
  for (var i = 0; i < 14; i++) dias.push(new Date(seg.getFullYear(), seg.getMonth(), seg.getDate() + i));
  var de = hjIso(dias[0]), ate = hjIso(dias[13]), hoje = hjIso(h);

  var itens = [];
  (D.events || []).forEach(function (e) {
    if (e.day < de || e.day > ate) return;
    var aniv = e.calendar === 'aniversarios';
    itens.push({ dia: e.day, hora: e.at || '', titulo: e.title, sub: e.detail || (aniv ? 'Anivers\u00e1rio' : calName(e.calendar)),
      tipo: aniv ? 'aniversario' : 'evento', ctx: e.context_id });
  });
  ((window.G && G.tasks) || []).forEach(function (t) {
    if (t.parent_id || !t.due_on || t.due_on < de || t.due_on > ate) return;
    if (t.tipo !== 'lembrete' && t.tipo !== 'nota') return;
    if (t.status === 'cancelada') return;
    var tipo = t.tipo === 'nota' ? 'nota' : (/YEARLY/.test(t.repeat_rule || '') ? 'aniversario' : 'lembrete');
    itens.push({ dia: t.due_on, hora: t.due_time || '', titulo: t.title,
      sub: (typeof areaNome === 'function' ? areaNome(t.context_id) : '') || HJ_NOMES[tipo] || 'Nota',
      tipo: tipo, ctx: t.context_id, tarefa: t });
  });
  itens.sort(function (a, b) { return a.dia === b.dia ? String(a.hora).localeCompare(String(b.hora)) : (a.dia < b.dia ? -1 : 1); });

  clear(ul);
  ul.classList.add('hj-ag');
  var proxVazia = true;
  dias.forEach(function (d, i) {
    var iso = hjIso(d);
    var doDia = itens.filter(function (x) { return x.dia === iso; });
    var passado = iso < hoje;
    if (i === 7) {
      var sep = el('li', 'hj-sem-sep');
      sep.appendChild(el('span', null, 'Pr\u00f3xima semana'));
      ul.appendChild(sep);
    }
    if (i >= 7) {
      if (!doDia.length) {
        if (i === 13 && proxVazia) { var v = el('li', 'hj-dia'); v.appendChild(el('span', 'hj-livre', 'nada marcado')); ul.appendChild(v); }
        return;
      }
      proxVazia = false;
    }
    var cab = el('li', 'hj-dia' + (iso === hoje ? ' hoje' : '') + (passado ? ' passado' : ''));
    cab.appendChild(el('span', null, (iso === hoje ? 'Hoje \u00b7 ' : '') + DIAS[(d.getDay() + 6) % 7] + ' ' + d.getDate()));
    if (!doDia.length) cab.appendChild(el('span', 'hj-livre', 'nada marcado'));
    ul.appendChild(cab);
    doDia.forEach(function (x) {
      var li = el('li', 'hj-it' + (passado ? ' passado' : '') + (x.tarefa ? ' clica' : ''));
      li.appendChild(el('time', null, x.hora || ''));
      var ico = el('span', 'hj-ico ' + ({ evento: 'ev', aniversario: 'ani', lembrete: 'lem', nota: 'nota' })[x.tipo]);
      ico.innerHTML = hjSvg(HJ_I[x.tipo], 13);
      ico.title = x.tipo === 'evento' ? 'Evento' : x.tipo === 'nota' ? 'Nota' : HJ_NOMES[x.tipo];
      li.appendChild(ico);
      var body = el('div', 'body');
      body.appendChild(el('b', null, x.titulo));
      if (x.sub) body.appendChild(el('span', 'who', x.sub));
      li.appendChild(body);
      var cor = x.ctx && typeof arCorDe === 'function' ? arCorDe(x.ctx) : null;
      if (cor) { var p = el('span', 'hj-cor'); p.style.background = cor; li.appendChild(p); }
      if (x.tarefa && typeof avAbrir === 'function') {
        li.addEventListener('click', function () {
          avAbrir({ origem: 'tarefa', id: x.tarefa.id, quando: x.tarefa.due_on, title: x.titulo, detail: x.sub });
        });
      }
      ul.appendChild(li);
    });
  });
  var h3 = ul.parentNode && ul.parentNode.querySelector('header h3');
  if (h3) h3.textContent = 'Agenda';
  var rot = $('agendaDayLabel');
  if (rot) rot.textContent = dias[0].getDate() + ' ' + MESES[dias[0].getMonth()].slice(0, 3) + ' \u2013 ' +
    dias[13].getDate() + ' ' + MESES[dias[13].getMonth()].slice(0, 3);
}

/* A Agenda comeca a altura da primeira caixa que se ve a esquerda (e nao do
   rotulo «Precisa de ti» nem do titulo do periodo): as duas colunas ficam com
   o topo na mesma linha. Mede-se depois de desenhar e quando algo abre ou
   fecha, porque o que se ve primeiro muda. */
function hjAlinhar() {
  var ag = $('agendaHoje');
  var dir = ag && ag.closest('.stack');
  var esq = dir && dir.parentNode ? dir.parentNode.firstElementChild : null;
  if (!dir || !esq || esq === dir) return;
  dir.style.marginTop = '';
  /* Numa coluna so (ecra estreito) nao ha nada a alinhar. */
  if (Math.abs(dir.getBoundingClientRect().top - esq.getBoundingClientRect().top) > 4) return;
  var alvo = null;
  document.querySelectorAll('#attnList .hj-per').forEach(function (s) {
    if (alvo) return;
    alvo = s.classList.contains('fechado') ? null : s.querySelector('.attn > article');
  });
  if (!alvo) alvo = document.querySelector('#attnList .hj-per > h4') || $('attnList');
  var dy = alvo.getBoundingClientRect().top - esq.getBoundingClientRect().top;
  if (dy > 0) dir.style.marginTop = Math.round(dy) + 'px';
}
window.addEventListener('resize', function () { try { hjAlinhar(); } catch (e) {} });
/* Com o ecra escondido nao ha nada para medir: alinha-se quando se volta a ele. */
if (typeof show === 'function') {
  var _hjShow = show;
  show = function (v) { _hjShow(v); if (v === 'hoje') setTimeout(function () { try { hjAlinhar(); } catch (e) {} }, 0); };
}

if (typeof renderHoje === 'function') {
  var _hjRenderHoje = renderHoje;
  renderHoje = function () {
    _hjRenderHoje();
    try { hjRender(); } catch (e) { console.error('[farol] hoje por periodos', e); }
    try { hjAgenda(); } catch (e) { console.error('[farol] agenda da semana', e); }
    hjAlinhar();
  };
}

/* Fechar uma tarefa ou pagar muda o /api/gestao; os avisos do Hoje vem do
   /api/bootstrap. Depois de uma caixinha do Hoje, rele-se o bootstrap. */
if (typeof renderGestao === 'function') {
  var _hjRenderGestao = renderGestao;
  renderGestao = function () {
    _hjRenderGestao();
    if (HJ.pendente && typeof load === 'function') { HJ.pendente = false; load(); }
    /* As caixinhas precisam das tarefas: quando chegam, o Hoje ganha-as. */
    else if (window.D && D.attention) {
      /* As tarefas chegaram ou mudaram: as caixinhas, os lembretes que saem
         da lista e a Agenda dependem delas. */
      try { hjRender(); } catch (e) { console.error('[farol] hoje por periodos', e); }
      try { hjAgenda(); } catch (e) { console.error('[farol] agenda da semana', e); }
      hjAlinhar();
    }
  };
}

/* Os pedidos nao esperam por este ficheiro: se o Hoje ja foi desenhado antes
   de ele chegar, desenha-se outra vez. */
(function hjEsperar(n) {
  n = n || 0;
  if (window.D && D.attention) { try { renderHoje(); } catch (e) { console.error('[farol] hoje', e); } return; }
  if (n < 50) setTimeout(function () { hjEsperar(n + 1); }, 300);
})();
