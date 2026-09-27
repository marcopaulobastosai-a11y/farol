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
  '#attnList .hj-box{flex:none;display:inline-flex}' +
  '#attnList .hj-box .tf-box{margin-top:0}' +
  '#attnList .hj-sem{flex:none;width:17px}' +
  '#attnList article.hj-feito{opacity:.45}' +
  '#attnList article.hj-feito h4{text-decoration:line-through}';

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
  seta: '<path d="M6 9l6 6 6-6"/>'
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
  var tipo = (t && t.tipo) || 'tarefa';
  if (tipo === 'lembrete') return /YEARLY/.test((t && t.repeat_rule) || '') ? 'aniversario' : 'lembrete';
  return tipo === 'pagamento' ? 'pagamento' : 'tarefa';
}
var HJ_NOMES = { tarefa: 'Tarefa', pagamento: 'Pagamento', lembrete: 'Lembrete', aniversario: 'Aniversário',
  documento: 'Documento a perder validade', pessoa: 'Documento de identificação' };
var HJ_CLS = { tarefa: '', pagamento: 'pag', lembrete: 'lem', aniversario: 'ani', documento: 'doc', pessoa: 'doc' };

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
  var itens = (D.attention || []).map(function (a) {
    var n = diasAte(a.quando);
    return { a: a, dias: n, u: urgencia(n, a.origem) };
  });
  if (!itens.length) return;           // o renderHoje ja escreveu a frase do vazio

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

if (typeof renderHoje === 'function') {
  var _hjRenderHoje = renderHoje;
  renderHoje = function () {
    _hjRenderHoje();
    try { hjRender(); } catch (e) { console.error('[farol] hoje por periodos', e); }
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
    else if (window.D && D.attention && !document.querySelector('#attnList .hj-box')) {
      try { hjRender(); } catch (e) { console.error('[farol] hoje por periodos', e); }
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
