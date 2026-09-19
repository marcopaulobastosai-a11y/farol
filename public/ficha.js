'use strict';
/**
 * Farol - a ficha de uma pessoa.
 *
 * O ecra da Familia mostrava oito cartoes que nao abriam para lado nenhum.
 * A app sabe muito sobre cada pessoa - o que tem para fazer, que papeis sao
 * seus, o que gastou, em que projectos anda - mas estava tudo espalhado por
 * seis ecras diferentes e por nenhum ao mesmo tempo. Isto junta.
 *
 * Como os outros modulos, nao toca no app.js: cria a seccao, o estilo e o
 * caminho para la chegar, e reaproveita o que ja existe ($ el clear pill row
 * toast show apiGestao G D).
 */

var FI = { id: null, dados: null, montado: false };

var FI_CSS = [
  '#view-pessoa .fi-topo{display:flex;gap:1rem;align-items:flex-start}',
  '#view-pessoa .fi-av{flex:0 0 auto;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;',
  'justify-content:center;color:#fff;font-family:var(--mono);font-size:1.25rem;overflow:hidden}',
  '#view-pessoa .fi-av img{width:100%;height:100%;object-fit:cover;display:block}',
  '#view-pessoa .fi-nome{font-family:var(--serif,Newsreader),serif;font-size:1.5rem;margin:0}',
  '#view-pessoa .fi-sub{color:var(--muted);font-size:.875rem;margin:.15rem 0 .5rem}',
  '#view-pessoa .fi-nota{font-size:.875rem;color:var(--ink-2);margin:.6rem 0 0}',
  '#view-pessoa .fi-num{display:flex;gap:1.5rem;margin-top:.9rem;flex-wrap:wrap}',
  '#view-pessoa .fi-num div{min-width:4rem}',
  '#view-pessoa .fi-num b{display:block;font-family:var(--mono);font-size:1.25rem;color:var(--ink)}',
  '#view-pessoa .fi-num span{font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}',
  '#view-pessoa .fi-vazio{color:var(--muted);font-size:.8125rem;margin:0;padding:10px 2px}',
  '#view-pessoa .fi-sl{display:block;font-size:.75rem;color:var(--muted);margin-top:2px}',
  '#view-pessoa .fi-volta{margin-bottom:.9rem}'
].join('');

function fiEstilo() {
  if (document.getElementById('fiCSS')) return;
  var st = document.createElement('style');
  st.id = 'fiCSS';
  st.textContent = FI_CSS;
  document.head.appendChild(st);
}

/* ---------------- pecas ---------------- */
function fiAvatar(p) {
  var a = el('div', 'fi-av');
  a.style.background = p.color || 'var(--c1)';
  if (p.tem_avatar) {
    var img = document.createElement('img');
    img.src = '/api/pessoas/' + p.id + '/avatar';
    img.alt = p.name || '';
    a.appendChild(img);
  } else {
    a.appendChild(document.createTextNode(p.initials || String(p.name || '?').slice(0, 1)));
  }
  return a;
}

function fiCartao(pai, titulo, direita) {
  var c = el('div', 'card');
  var h = document.createElement('header');
  h.appendChild(el('h3', null, titulo));
  if (direita) h.appendChild(el('span', 'mono', direita));
  c.appendChild(h);
  pai.appendChild(c);
  return c;
}

function fiVazio(c, texto) {
  c.appendChild(el('p', 'fi-vazio', texto || 'Ainda não há nada aqui.'));
}

/* Um prazo so vale como aviso quando esta perto. As contas sao as mesmas do
   resto da app, mas aqui nao se depende delas: se nao existirem, nao ha pill. */
function fiPrazo(data, limite) {
  if (!data) return null;
  var dias = (typeof diasAte === 'function') ? diasAte(data) : null;
  var rotulo = fiData(data);
  if (dias === null || dias === undefined) return pill(rotulo);
  if (dias < 0) return pill(rotulo, 'bad');
  if (dias <= (limite || 7)) return pill(rotulo, 'warn');
  return pill(rotulo, 'good');
}

function fiData(iso) {
  if (!iso) return '';
  var p = String(iso).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}

function fiArea(x) {
  if (!x || !x.area) return '';
  return x.area_pai ? x.area_pai + ' ' + String.fromCharCode(8250) + ' ' + x.area : x.area;
}

function fiEuros(v) {
  return (Math.round(Number(v || 0) * 100) / 100).toFixed(2).replace('.', ',') + ' ' + String.fromCharCode(8364);
}

function fiTabela(c, cabecalhos) {
  var wrap = el('div', 'scroll');
  var t = document.createElement('table');
  var thead = document.createElement('thead');
  var tr = document.createElement('tr');
  cabecalhos.forEach(function (h) { tr.appendChild(el('th', null, h)); });
  thead.appendChild(tr);
  t.appendChild(thead);
  var tb = document.createElement('tbody');
  t.appendChild(tb);
  wrap.appendChild(t);
  c.appendChild(wrap);
  return tb;
}

/* ---------------- o ecra ---------------- */
function fiMontar() {
  if (FI.montado) return;
  fiEstilo();
  if (window.TITLES) TITLES.pessoa = ['Pessoa', 'Tudo o que a casa sabe sobre esta pessoa'];

  var sec = el('section', 'view');
  sec.id = 'view-pessoa';
  var corpo = el('div');
  corpo.id = 'fiCorpo';
  sec.appendChild(corpo);

  var irmao = document.querySelector('.view');
  (irmao ? irmao.parentNode : document.body).appendChild(sec);
  FI.montado = true;
}

function fiAbrir(id) {
  fiMontar();
  FI.id = Number(id);
  show('pessoa');
  var corpo = $('fiCorpo');
  clear(corpo);
  corpo.appendChild(el('p', 'fi-vazio', 'A ler a ficha…'));

  apiGestao('/api/pessoas/' + FI.id + '/ficha')
    .then(function (d) { FI.dados = d; fiDesenhar(); })
    .catch(function (e) {
      clear(corpo);
      corpo.appendChild(el('p', 'fi-vazio', e.message || 'Não foi possível ler a ficha.'));
    });
}

function fiDesenhar() {
  var d = FI.dados;
  if (!d) return;
  var p = d.pessoa;
  var corpo = $('fiCorpo');
  clear(corpo);

  if (window.TITLES) TITLES.pessoa = [p.name, p.full_name && p.full_name !== p.name ? p.full_name : 'Ficha da pessoa'];
  var titulo = $('pageTitle');
  if (titulo) titulo.textContent = p.name;
  var sub = $('pageSub');
  if (sub) sub.textContent = [p.role, p.full_name && p.full_name !== p.name ? p.full_name : null]
    .filter(Boolean).join(' · ');

  var volta = el('button', 'btn fi-volta', String.fromCharCode(8592) + ' Família');
  volta.type = 'button';
  volta.onclick = function () { show('familia'); };
  corpo.appendChild(volta);

  /* --- quem e --- */
  var cab = el('div', 'card');
  var topo = el('div', 'fi-topo');
  topo.appendChild(fiAvatar(p));
  var txt = el('div', 'grow');
  txt.appendChild(el('h2', 'fi-nome', p.name));
  txt.appendChild(el('div', 'fi-sub',
    [p.full_name && p.full_name !== p.name ? p.full_name : null, p.role, p.kind]
      .filter(Boolean).join(' · ')));
  var chips = el('div', 'chips');
  if (!p.active) chips.appendChild(pill('desactivada', 'warn'));
  if (p.in_household) chips.appendChild(pill('do agregado'));
  if (p.can_own_tasks) chips.appendChild(pill('pode ter tarefas'));
  txt.appendChild(chips);
  if (p.note) txt.appendChild(el('p', 'fi-nota', p.note));
  topo.appendChild(txt);
  cab.appendChild(topo);

  var porFazer = d.tarefas.filter(function (t) { return !t.done; }).length;
  var nums = el('div', 'fi-num');
  [[porFazer, 'por fazer'], [d.documentos.length, 'documentos'],
   [d.projetos.length, 'projetos'], [d.caixa.length, 'na caixa']].forEach(function (n) {
    var b = el('div');
    b.appendChild(el('b', null, String(n[0])));
    b.appendChild(el('span', null, n[1]));
    nums.appendChild(b);
  });
  cab.appendChild(nums);
  corpo.appendChild(cab);

  var grelha = el('div', 'grid split');
  corpo.appendChild(grelha);
  var esq = el('div', 'stack');
  var dir = el('div', 'stack');
  grelha.appendChild(esq);
  grelha.appendChild(dir);

  fiTarefas(esq, d.tarefas);
  fiDocumentos(esq, d.documentos);
  fiProjetos(dir, d.projetos);
  fiDespesas(dir, d.despesas);
  fiCaixa(dir, d.caixa);
}

function fiTarefas(pai, tarefas) {
  var abertas = tarefas.filter(function (t) { return !t.done; });
  var feitas = tarefas.length - abertas.length;
  var c = fiCartao(pai, 'Tarefas', feitas ? feitas + ' feitas' : '');
  if (!abertas.length) { fiVazio(c, 'Nada por fazer.'); return; }

  abertas.forEach(function (t) {
    var sub = [t.dono ? 'faz' : 'por causa de si', fiArea(t), t.projeto].filter(Boolean)
      .join('  ' + String.fromCharCode(183) + '  ');
    c.appendChild(row(t.title, sub, fiPrazo(t.due_on, 7)));
  });
}

function fiDocumentos(pai, docs) {
  var c = fiCartao(pai, 'Documentos', docs.length ? String(docs.length) : '');
  if (!docs.length) { fiVazio(c); return; }
  var tb = fiTabela(c, ['Documento', 'Entidade', 'Válido até']);
  docs.forEach(function (x) {
    var tr = el('tr');
    var td = el('td');
    if (x.inbox_id) {
      var a = el('a', null, x.name);
      a.href = '/api/inbox/' + x.inbox_id + '/ficheiro';
      a.target = '_blank'; a.rel = 'noopener';
      td.appendChild(a);
    } else {
      td.appendChild(document.createTextNode(x.name));
    }
    var linha = [fiArea(x), x.kind].filter(Boolean).join('  ' + String.fromCharCode(183) + '  ');
    if (linha) td.appendChild(el('span', 'fi-sl', linha));
    tr.appendChild(td);
    tr.appendChild(el('td', null, x.entity || ''));
    var tv = el('td');
    var pz = fiPrazo(x.valid_on, 30);
    if (pz) tv.appendChild(pz);
    tr.appendChild(tv);
    tb.appendChild(tr);
  });
}

function fiProjetos(pai, projetos) {
  var c = fiCartao(pai, 'Projetos', projetos.length ? String(projetos.length) : '');
  if (!projetos.length) { fiVazio(c); return; }
  projetos.forEach(function (x) {
    var sub = [x.member_role, x.status].filter(Boolean).join('  ' + String.fromCharCode(183) + '  ');
    c.appendChild(row(x.name, sub, x.target_on ? fiPrazo(x.target_on, 30) : null));
  });
}

function fiDespesas(pai, despesas) {
  var total = despesas.reduce(function (s, x) { return s + Number(x.amount || 0); }, 0);
  var c = fiCartao(pai, 'Despesas', despesas.length ? fiEuros(total) : '');
  if (!despesas.length) { fiVazio(c); return; }
  var tb = fiTabela(c, ['Dia', 'O que foi', 'Valor']);
  despesas.forEach(function (x) {
    var tr = el('tr');
    tr.appendChild(el('td', 'n', fiData(x.spent_on)));
    var td = el('td', null, x.description);
    var linha = [x.merchant, fiArea(x)].filter(Boolean).join('  ' + String.fromCharCode(183) + '  ');
    if (linha) td.appendChild(el('span', 'fi-sl', linha));
    tr.appendChild(td);
    tr.appendChild(el('td', 'n', fiEuros(x.amount)));
    tb.appendChild(tr);
  });
}

function fiCaixa(pai, itens) {
  var c = fiCartao(pai, 'Na caixa de entrada', itens.length ? String(itens.length) : '');
  if (!itens.length) { fiVazio(c); return; }
  itens.forEach(function (x) {
    var estado = x.status === 'por_triar' ? pill('por triar', 'warn') : pill('catalogado', 'good');
    c.appendChild(row(x.title || x.file_name || 'Sem nome', fiData(x.captured_at), estado));
  });
}

/* ---------------- como se chega la ---------------- */
/* Os cartoes da Familia sao desenhados pelo app.js; aqui so se escuta o
   clique. Assim este modulo continua a nao ter de mexer naquele ficheiro. */
document.addEventListener('click', function (e) {
  var alvo = e.target.closest && e.target.closest('#view-familia .person[data-id]');
  if (alvo) { fiAbrir(alvo.dataset.id); return; }
  var linha = e.target.closest && e.target.closest('[data-ficha]');
  if (linha) fiAbrir(linha.dataset.ficha);
});

(function esperarApp() {
  if ($('nav') && document.querySelector('.view')) { fiMontar(); return; }
  setTimeout(esperarApp, 400);
})();
