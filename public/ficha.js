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

/* As contas de Acessos ficam a parte do resto: a janela de edicao pode ser
   aberta a partir da ficha ou da pagina de Pessoas, e o menu da conta tem
   de ter as mesmas opcoes nos dois sitios. */
var FI = { id: null, dados: null, contas: null, montado: false };

var FI_CSS = [
  '.fi-ecra .fi-topo{display:flex;gap:1rem;align-items:flex-start}',
  '.fi-ecra .fi-av{flex:0 0 auto;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;',
  'justify-content:center;color:#fff;font-family:var(--mono);font-size:1.25rem;overflow:hidden}',
  '.fi-ecra .fi-av img{width:100%;height:100%;object-fit:cover;display:block}',
  '.fi-ecra .fi-nome{font-family:var(--serif,Newsreader),serif;font-size:1.5rem;margin:0}',
  '.fi-ecra .fi-sub{color:var(--muted);font-size:.875rem;margin:.15rem 0 .5rem}',
  '.fi-ecra .fi-nota{font-size:.875rem;color:var(--ink-2);margin:.6rem 0 0}',
  '.fi-ecra .fi-num{display:flex;gap:1.5rem;margin-top:.9rem;flex-wrap:wrap}',
  '.fi-ecra .fi-num div{min-width:4rem}',
  '.fi-ecra .fi-num b{display:block;font-family:var(--mono);font-size:1.25rem;color:var(--ink)}',
  '.fi-ecra .fi-num span{font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}',
  '.fi-ecra .fi-vazio{color:var(--muted);font-size:.8125rem;margin:0;padding:10px 2px}',
  '.fi-ecra .fi-sl{display:block;font-size:.75rem;color:var(--muted);margin-top:2px}',
  '.fi-ecra .fi-volta{margin-bottom:.9rem}',
  '.fi-ecra .fi-topo > .grow{flex:1 1 auto;min-width:0}',
  '.fi-ecra .fi-editar{flex:0 0 auto;align-self:flex-start}',
  '#peDlg{max-height:calc(100dvh - 2rem);overflow-y:auto}',
  '.pe-dlgc .fi-par{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:0 .75rem}',
  '.fi-ecra .fi-quando{flex:0 0 3.4rem;font-family:var(--mono);font-size:.75rem;color:var(--muted);line-height:1.35}',
  '.fi-ecra .fi-quando b{display:block;font-size:.9375rem;color:var(--ink);font-weight:500}',
  '.pe-dlgc textarea{font:inherit;font-size:.875rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);',
  'border-radius:8px;padding:9px 11px;width:100%;min-width:0;min-height:4.5rem;resize:vertical;box-sizing:border-box}',
  '.pe-dlgc textarea:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}',
  '.pe-dlgc .fi-checks{display:flex;gap:1.25rem;flex-wrap:wrap;margin:.35rem 0 .1rem}',
  '.pe-dlgc .fi-sec{font-family:var(--mono);font-size:.6875rem;letter-spacing:.08em;text-transform:uppercase;',
  'color:var(--accent);margin:1.2rem 0 .6rem;padding-top:.9rem;border-top:1px solid var(--line-soft)}',
  '.pe-dlgc .fi-dica{font-size:.75rem;color:var(--muted);margin:-.4rem 0 .8rem}',
  '.pe-dlgc input[type=date],.pe-dlgc input[type=email],.pe-dlgc input[type=tel]{font:inherit;font-size:.875rem;',
  'color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:9px 11px;',
  'width:100%;min-width:0;box-sizing:border-box}',
  '.pe-dlgc input[type=date]:focus,.pe-dlgc input[type=email]:focus,.pe-dlgc input[type=tel]:focus',
  '{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}',
  '.fi-ecra .fi-dados{display:grid;grid-template-columns:minmax(7.5rem,auto) 1fr;gap:.45rem 1rem;margin:0;font-size:.875rem}',
  '.fi-ecra .fi-dados dt{color:var(--muted);font-size:.8125rem}',
  '.fi-ecra .fi-dados dd{margin:0;color:var(--ink);min-width:0;overflow-wrap:anywhere}',
  '.fi-ecra .fi-dados .fi-grupo{grid-column:1/-1;font-family:var(--mono);font-size:.6875rem;letter-spacing:.08em;',
  'text-transform:uppercase;color:var(--muted);margin-top:.6rem;padding-top:.6rem;border-top:1px solid var(--line-soft)}',
  '.fi-ecra .fi-dados .fi-grupo:first-child{margin-top:0;padding-top:0;border-top:0}',
  '.fi-ecra .fi-num-id{font-family:var(--mono);letter-spacing:.02em}',
  '.fi-ecra .fi-dados a{color:var(--accent);text-underline-offset:2px}',
  '.fi-ecra .fi-ver{border:0;background:none;color:var(--accent);font:inherit;font-size:.75rem;cursor:pointer;padding:0}',
  '.fi-ecra .fi-g{display:flex;flex-direction:column;gap:5px;align-items:flex-start}',
  '.fi-ecra .fi-g small{color:var(--muted);font-size:.75rem}',
  '.fi-ecra .fi-g small.mau{color:var(--bad)}',
  '.fi-ecra .fi-gb{display:flex;gap:6px;flex-wrap:wrap}',
  '.fi-ecra .fi-gb button{border:1px solid var(--line);background:var(--surface);color:var(--ink-2);',
  'border-radius:99px;padding:3px 10px;font:inherit;font-size:.75rem;cursor:pointer}',
  '.fi-ecra .fi-gb button:hover{border-color:var(--accent);color:var(--accent-ink)}',
  '.fi-ecra .fi-gb button[disabled]{opacity:.5;cursor:default}',
  '.fi-ecra .fi-link{color:var(--accent);cursor:pointer;text-decoration:underline;text-underline-offset:2px}',
  '.fi-ecra .fi-acc > header{cursor:pointer;user-select:none;align-items:center}',
  '.fi-ecra .fi-acc > header h3{flex:1 1 auto;margin:0}',
  '.fi-ecra .fi-acc > header .mono{margin-left:0}',
  '.fi-ecra .fi-acc > header:focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:4px}',
  '.fi-ecra .fi-chev{flex:0 0 auto;color:var(--muted);transition:transform .15s ease;display:inline-flex}',
  '.fi-ecra .fi-acc.fechado .fi-chev{transform:rotate(-90deg)}',
  '.fi-ecra .fi-acc.fechado > header{margin-bottom:0}',
  '.fi-ecra .fi-acc.fechado > .fi-corpo{display:none}',
  '.fi-ecra .fi-col-t{font-family:var(--mono);font-size:.6875rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 -.25rem 2px}',
  '.pe-dlg:has(.fi-tabs){max-width:37rem}',
  '.pe-dlgc .fi-tabs{display:flex;flex-wrap:wrap;gap:2px;border-bottom:1px solid var(--line);margin:0 0 1rem}',
  '.pe-dlgc .fi-tab{border:0;background:none;font:inherit;font-size:.8125rem;color:var(--muted);padding:8px 10px 9px;',
  'border-bottom:2px solid transparent;margin-bottom:-1px;cursor:pointer;white-space:nowrap}',
  '.pe-dlgc .fi-tab:hover{color:var(--ink)}',
  '.pe-dlgc .fi-tab.on{color:var(--ink);border-bottom-color:var(--accent);font-weight:500}',
  '.pe-dlgc .fi-painel{min-height:16rem}'
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
    img.src = '/api/pessoas/' + p.id + '/avatar?v=' + encodeURIComponent(p.avatar_em || '1');
    img.alt = p.name || '';
    a.appendChild(img);
  } else {
    a.appendChild(document.createTextNode(p.initials || String(p.name || '?').slice(0, 1)));
  }
  return a;
}

/* Cada bloco da ficha e um acordeao: abre sempre aberto e fecha com um
   clique no titulo. Devolve o corpo, que e onde o conteudo entra. */
function fiCartao(pai, titulo, direita) {
  var c = el('div', 'card fi-acc');
  var h = document.createElement('header');
  h.tabIndex = 0;
  h.setAttribute('role', 'button');
  h.setAttribute('aria-expanded', 'true');
  h.appendChild(el('h3', null, titulo));
  if (direita) h.appendChild(el('span', 'mono', direita));
  var chev = el('span', 'fi-chev');
  chev.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
  h.appendChild(chev);
  var corpo = el('div', 'fi-corpo');
  var alternar = function () {
    var fechado = c.classList.toggle('fechado');
    h.setAttribute('aria-expanded', fechado ? 'false' : 'true');
  };
  h.addEventListener('click', function (e) {
    if (e.target.closest('button, a, .fi-link')) return;
    alternar();
  });
  h.addEventListener('keydown', function (e) {
    if (e.target !== h) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); }
  });
  c.appendChild(h);
  c.appendChild(corpo);
  corpo.cabecalho = h;
  pai.appendChild(c);
  return corpo;
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

var FI_TIPOS = { adulto: 'adulto', crianca: 'criança', familiar: 'familiar', animal: 'animal' };
var FI_DOCS = { cc: 'Cartão de Cidadão', tr: 'Título de residência' };
var FI_HUMANO = { adulto: true, crianca: true, familiar: true };

/* O que cada tipo de pessoa tem de proprio. A ordem e a da janela. */
var FI_DETALHES = {
  adulto:   [['empregador', 'Entidade patronal', 'Onde trabalha']],
  crianca:  [['escola', 'Escola', ''], ['ano_turma', 'Ano e turma', 'Ex.: 5.º B'],
             ['escola_contacto', 'Contacto da escola', 'Telefone ou email da secretaria']],
  familiar: [],
  animal:   [['raca', 'Raça', ''], ['microchip', 'N.º do microchip', ''],
             ['veterinario', 'Veterinário', 'Nome e contacto'], ['seguro', 'Seguro', 'Seguradora e apólice']]
};
/* A mesma relacao chama-se de maneira diferente conforme quem e. */
var FI_RESPONSAVEL = { crianca: 'Encarregado de educação', familiar: 'Quem acompanha' };

function fiIdade(iso) {
  if (!iso) return null;
  var p = String(iso).split('-').map(Number);
  var h = new Date();
  var anos = h.getFullYear() - p[0];
  if (h.getMonth() + 1 < p[1] || (h.getMonth() + 1 === p[1] && h.getDate() < p[2])) anos--;
  return anos >= 0 ? anos : null;
}

/* Os numeros que se pedem ao balcao nao ficam expostos no ecra de quem passa:
   veem-se os ultimos tres e mostram-se todos a pedido. */
function fiMascara(v) {
  var t = String(v || '');
  if (t.length <= 3) return t;
  return new Array(t.length - 2).join(String.fromCharCode(8226)) + t.slice(-3);
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

  var sec = el('section', 'view fi-ecra');
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
    .then(function (d) { FI.dados = d; FI.contas = d.contas || []; fiDesenhar(); })
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
    [p.full_name && p.full_name !== p.name ? p.full_name : null, p.role, FI_TIPOS[p.kind] || p.kind,
     fiIdade(p.birth_on) !== null ? fiIdade(p.birth_on) + (fiIdade(p.birth_on) === 1 ? ' ano' : ' anos') : null]
      .filter(Boolean).join(' · ')));
  var chips = el('div', 'chips');
  if (!p.active) chips.appendChild(pill('desactivada', 'warn'));
  if (p.in_household) chips.appendChild(pill('do agregado'));
  if (p.can_own_tasks) chips.appendChild(pill('pode ter tarefas'));
  txt.appendChild(chips);
  if (p.note) txt.appendChild(el('p', 'fi-nota', p.note));
  topo.appendChild(txt);
  /* Editar aqui mesmo: quem esta a olhar para a pessoa e quem sabe o que
     esta errado nela. So aparece se a pagina de Pessoas estiver carregada,
     porque e dela que vem o formulario. */
  if (typeof peCampo === 'function' && typeof PE !== 'undefined') {
    var editar = el('button', 'btn fi-editar', 'Editar');
    editar.type = 'button';
    editar.onclick = function () { fiEditar(p); };
    topo.appendChild(editar);
  }
  cab.appendChild(topo);

  var porFazer = d.tarefas.filter(function (t) { return !t.done; }).length;
  var compromissos = d.compromissos || [];
  var nums = el('div', 'fi-num');
  [[porFazer, 'por fazer'], [compromissos.length, 'compromissos'], [d.documentos.length, 'documentos'],
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

  /* A esquerda quem a pessoa e; a direita o que ela tem em curso. */
  esq.appendChild(el('div', 'fi-col-t', 'Quem é'));
  dir.appendChild(el('div', 'fi-col-t', 'Em curso'));
  fiDados(esq, p, d.dependentes || [], d.google || null);
  fiCompromissos(dir, compromissos, d.compromissosPassados || 0);
  fiTarefas(dir, d.tarefas);
  fiDocumentos(dir, d.documentos);
  fiProjetos(dir, d.projetos);
  fiDespesas(dir, d.despesas);
  fiMovimentos(dir, p);
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

/* ---------------- os dados da pessoa ---------------- */
function fiDados(pai, p, dependentes, google) {
  var feitos = 0;

  function numero(v, lista) {
    if (!v) return null;
    var s = el('span', 'fi-num-id', fiMascara(v));
    s.dataset.inteiro = v;
    lista.push(s);
    return s;
  }
  function ligacao(href, texto) {
    var a = el('a', null, texto);
    a.href = href;
    return a;
  }
  function pessoaLink(x) {
    var a = el('span', 'fi-link', x.name);
    a.dataset.ficha = x.id;
    return a;
  }
  /* Um bloco so vira widget quando tem pelo menos uma linha preenchida. */
  function bloco(titulo, linhas, mascarados) {
    linhas = linhas.filter(function (l) { return l[1] !== null && l[1] !== undefined && l[1] !== ''; });
    if (!linhas.length) return;
    var c = fiCartao(pai, titulo);
    var dl = el('dl', 'fi-dados');
    linhas.forEach(function (l) {
      dl.appendChild(el('dt', null, l[0]));
      var dd = el('dd');
      if (l[1].nodeType) dd.appendChild(l[1]); else dd.appendChild(document.createTextNode(l[1]));
      dl.appendChild(dd);
    });
    c.appendChild(dl);
    feitos++;
    /* Os numeros veem-se tapados; mostram-se a pedido, so neste bloco. */
    if (mascarados && mascarados.length) {
      var ver = el('button', 'fi-ver', 'mostrar');
      ver.type = 'button';
      var aberto = false;
      ver.onclick = function () {
        aberto = !aberto;
        mascarados.forEach(function (s) { s.textContent = aberto ? s.dataset.inteiro : fiMascara(s.dataset.inteiro); });
        ver.textContent = aberto ? 'esconder' : 'mostrar';
      };
      c.cabecalho.insertBefore(ver, c.cabecalho.querySelector('.fi-chev'));
    }
  }

  var humano = FI_HUMANO[p.kind];
  var idade = fiIdade(p.birth_on);
  bloco('Nascimento', [
    [p.kind === 'animal' ? 'Nasceu' : 'Data',
     p.birth_on ? fiData(p.birth_on) + (idade !== null ? '  ·  ' + idade + (idade === 1 ? ' ano' : ' anos') : '') : null]
  ]);

  if (humano) {
    bloco('Contactos', [
      ['Telemóvel', p.phone ? ligacao('tel:' + String(p.phone).replace(/\s+/g, ''), p.phone) : null],
      ['Email', p.email ? ligacao('mailto:' + p.email, p.email) : null],
      ['Morada', p.address]
    ]);

    var tapados = [];
    var validade = null;
    if (p.id_doc_validade) {
      validade = el('span');
      var pz = fiPrazo(p.id_doc_validade, 60);
      if (pz) validade.appendChild(pz);
    }
    bloco('Identificação', [
      ['NIF', numero(p.nif, tapados)],
      ['Utente SNS', numero(p.sns, tapados)],
      [FI_DOCS[p.id_doc_tipo] || 'Documento', numero(p.id_doc_numero, tapados)],
      ['Válido até', validade]
    ], tapados);
  }

  var det = p.detalhes || {};
  var titulos = { adulto: 'Trabalho', crianca: 'Escola', animal: 'Cuidados', familiar: 'Apoio' };
  var chip = [];
  var linhasDet = (FI_DETALHES[p.kind] || []).map(function (f) {
    return [f[1], f[0] === 'microchip' ? numero(det[f[0]], chip) : det[f[0]]];
  });
  if (FI_RESPONSAVEL[p.kind]) linhasDet.push([FI_RESPONSAVEL[p.kind], p.responsavel ? pessoaLink(p.responsavel) : null]);
  if (linhasDet.length) bloco(titulos[p.kind] || 'Apoio', linhasDet, chip);

  /* Do outro lado da mesma relacao: de quem esta pessoa trata. */
  if (dependentes.length) {
    var lista = function (xs) {
      if (!xs.length) return null;
      var sp = el('span');
      xs.forEach(function (x, i) {
        if (i) sp.appendChild(document.createTextNode(', '));
        sp.appendChild(pessoaLink(x));
      });
      return sp;
    };
    bloco('Responsável por', [
      ['Encarregado de', lista(dependentes.filter(function (x) { return x.kind === 'crianca'; }))],
      ['Acompanha', lista(dependentes.filter(function (x) { return x.kind !== 'crianca'; }))]
    ]);
  }

  if (humano) {
    bloco('Em caso de emergência', [
      ['Ligar a', p.emerg_nome],
      ['Telefone', p.emerg_tel ? ligacao('tel:' + String(p.emerg_tel).replace(/\s+/g, ''), p.emerg_tel) : null]
    ]);
    bloco('Na app', [['Conta de acesso', p.conta_email],
                     ['Calendário Google', fiGoogle(p, google)]]);
  }

  if (!feitos) fiVazio(fiCartao(pai, 'Dados'), 'Ainda sem dados. Carrega em Editar para os pôr.');
}

/* ---------------- o calendario Google ---------------- */
/* Cada pessoa liga a conta dela e o calendario dela entra na Agenda. Desde
   4 out o Farol pede tambem licenca para ESCREVER, mas so mexe no que e seu:
   as copias dos eventos marcados no Farol. Os eventos que nasceram no Google
   corrigem-se no Google. Quem ligou antes so deu licenca para ler: o botao
   «Deixar escrever» volta a pedir, com as duas. */
function fiQuando(ms) {
  var n = Number(ms || 0);
  if (!n) return 'ainda não foi lido';
  var seg = Math.round((Date.now() - n) / 1000);
  if (seg < 90) return 'lido agora mesmo';
  if (seg < 5400) return 'lido há ' + Math.round(seg / 60) + ' min';
  if (seg < 172800) return 'lido há ' + Math.round(seg / 3600) + ' h';
  return 'lido a ' + fiData(new Date(n).toISOString().slice(0, 10));
}

function fiGoogle(p, g) {
  var caixa = el('div', 'fi-g');
  var botoes = el('div', 'fi-gb');

  if (!g) {
    var ligar = el('button', null, 'Ligar o Google');
    ligar.type = 'button';
    ligar.title = 'Traz o calendário desta pessoa para a Agenda do Farol';
    ligar.onclick = function () { location.href = '/api/google/ligar?pessoa=' + p.id; };
    botoes.appendChild(ligar);
    caixa.appendChild(botoes);
    caixa.appendChild(el('small', null, 'Por ligar — a Agenda não tem o calendário desta pessoa.'));
    return caixa;
  }

  caixa.appendChild(document.createTextNode(g.email || 'ligado'));
  var linha = [fiQuando(g.lido_ms), g.proximos ? g.proximos + ' a chegar' : null].filter(Boolean).join('  ·  ');
  caixa.appendChild(el('small', null, linha));
  if (g.erro) caixa.appendChild(el('small', 'mau', g.erro));
  caixa.appendChild(el('small', null, g.escrever
    ? 'Lê e escreve: os eventos do Farol com esta pessoa podem ir para o calendário dela.'
    : 'Só lê. Para o Farol pôr eventos no calendário desta pessoa, carrega em «Deixar escrever».'));
  if (g.extra) caixa.appendChild(el('small', null, g.extra + (g.extra === 1 ? ' calendário a mais' : ' calendários a mais') + ' na Agenda.'));

  var actualizar = el('button', null, 'Actualizar');
  actualizar.type = 'button';
  actualizar.onclick = function () {
    actualizar.disabled = true;
    actualizar.textContent = 'a ler…';
    fiGooglePedir('/api/google/sincronizar', { pessoa: p.id })
      .then(function () { toast('Calendário de ' + p.name + ' lido.'); fiRecarregar(true); })
      .catch(function (e) { toast(e.message || 'Não foi possível ler o calendário.'); fiRecarregar(false); });
  };
  var desligar = el('button', null, 'Desligar');
  desligar.type = 'button';
  desligar.onclick = function () {
    if (!confirm('Desligar o Google de ' + p.name + '? Os eventos que vieram de lá saem da Agenda; no Google fica tudo como está.')) return;
    desligar.disabled = true;
    fiGooglePedir('/api/google/desligar', { pessoa: p.id })
      .then(function () { toast('Google desligado.'); fiRecarregar(true); })
      .catch(function (e) { toast(e.message || 'Não foi possível desligar.'); fiRecarregar(false); });
  };
  var cals = el('button', null, 'Calendários');
  cals.type = 'button';
  cals.title = 'Escolher que calendários desta conta entram na Agenda, e quais só como «ocupado»';
  cals.onclick = function () { fiCalendarios(p); };
  botoes.appendChild(actualizar);
  botoes.appendChild(cals);
  if (!g.escrever) {
    var esc = el('button', null, 'Deixar escrever');
    esc.type = 'button';
    esc.title = 'Volta à Google para dar licença ao Farol de pôr eventos neste calendário';
    esc.onclick = function () { location.href = '/api/google/ligar?pessoa=' + p.id; };
    botoes.appendChild(esc);
  }
  botoes.appendChild(desligar);
  caixa.appendChild(botoes);
  return caixa;
}

/* Os calendarios da conta: o principal entra sempre; os outros entram
   completos, so como «ocupado» (o do trabalho) ou nao entram. */
function fiCalendarios(p) {
  var velho = document.getElementById('fiCalDlg');
  if (velho) velho.remove();
  var dlg = el('dialog', 'folha');
  dlg.id = 'fiCalDlg';
  dlg.style.cssText = 'border:none;border-radius:14px;padding:0;width:min(520px,calc(100% - 2rem));background:transparent';
  var c = el('div');
  c.style.cssText = 'background:var(--surface);border-radius:14px;padding:18px 20px;display:flex;flex-direction:column;gap:10px;max-height:88vh;overflow:auto';
  c.appendChild(el('h3', null, 'Calendários de ' + p.name));
  var dica = el('p', null, 'O principal entra sempre. «Só ocupado» mostra que a hora está tomada sem dizer o que é — serve para o calendário do trabalho.');
  dica.style.cssText = 'margin:0;font-size:.8125rem;color:var(--muted)';
  c.appendChild(dica);
  var lista = el('div'); lista.textContent = 'A pedir a lista à Google…';
  c.appendChild(lista);
  var fim = el('div'); fim.style.cssText = 'display:flex;justify-content:flex-end';
  var fechar = el('button', 'btn small', 'Fechar'); fechar.type = 'button';
  fechar.onclick = function () { dlg.close(); dlg.remove(); fiRecarregar(true); };
  fim.appendChild(fechar); c.appendChild(fim);
  dlg.appendChild(c);
  dlg.addEventListener('cancel', function () { setTimeout(function () { dlg.remove(); fiRecarregar(true); }, 0); });
  document.body.appendChild(dlg);
  dlg.showModal();

  apiGestao('/api/google/calendarios?pessoa=' + p.id).then(function (r) {
    clear(lista);
    (r.calendarios || []).forEach(function (cal) {
      var linha = el('div');
      linha.style.cssText = 'display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--line-soft)';
      var cor = el('i'); cor.style.cssText = 'width:10px;height:10px;border-radius:3px;flex:none;background:' + (cal.cor || 'var(--c3)');
      var nome = el('span', null, cal.nome + (cal.principal ? ' · principal' : ''));
      nome.style.cssText = 'flex:1;min-width:0;font-size:.875rem;overflow:hidden;text-overflow:ellipsis';
      linha.appendChild(cor); linha.appendChild(nome);
      if (cal.principal) {
        linha.appendChild(el('small', null, 'completo'));
      } else {
        var s = el('select');
        [['fora', 'Não entra'], ['completo', 'Completo'], ['ocupado', 'Só ocupado']].forEach(function (o) { s.appendChild(new Option(o[1], o[0])); });
        s.value = cal.modo || 'fora';
        s.onchange = function () {
          s.disabled = true;
          fiGooglePedir('/api/google/calendarios', { pessoa: p.id, cal_id: cal.id, nome: cal.nome, modo: s.value })
            .then(function () { toast(s.value === 'fora' ? cal.nome + ' saiu da Agenda.' : cal.nome + ' entrou na Agenda.'); })
            .catch(function (e) { toast(e.message || 'Não foi possível gravar.'); })
            .then(function () { s.disabled = false; });
        };
        linha.appendChild(s);
      }
      lista.appendChild(linha);
    });
    if (!lista.childNodes.length) lista.textContent = 'A Google não devolveu calendários.';
  }).catch(function (e) { lista.textContent = e.message || 'Não foi possível pedir a lista.'; });
}

function fiGooglePedir(url, corpo) {
  return apiGestao(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  });
}

/* Depois de mexer no calendario: o ecra volta a ser o que a base diz, e a
   Agenda tambem, porque os eventos mudaram. O mesmo bloco «Na app» aparece
   na ficha da Familia e no ecra de dados em Pessoas - relê-se aquele que
   estiver a ser visto. */
function fiRecarregar(tambemAgenda) {
  var p = tambemAgenda && typeof apiGestao === 'function'
    ? apiGestao('/api/bootstrap').then(function (b) {
        if (b && b.people && typeof renderAll === 'function') { D = b; renderAll(); }
      }).catch(function () {})
    : Promise.resolve();
  return p.then(function () {
    var v = document.getElementById('view-pessoa');
    if (!(v && v.classList.contains('is-active') && FI.id)) {
      return typeof pdRecarregar === 'function' ? pdRecarregar() : null;
    }
    var aqui = FI.id;
    return apiGestao('/api/pessoas/' + aqui + '/ficha').then(function (f) {
      if (FI.id !== aqui) return;
      FI.dados = f;
      FI.contas = f.contas || [];
      fiDesenhar();
    });
  }).catch(function () {});
}

/* A volta da Google: diz como correu, limpa o endereco e abre a ficha. */
(function () {
  var m = /[?&]google=([^&]+)/.exec(location.search);
  if (!m) return;
  var v = decodeURIComponent(m[1]);
  var msg = {
    ok: 'Calendário ligado. Os eventos já estão na Agenda.',
    recusado: 'A Google não deu autorização.',
    'sem-calendario': 'Falta autorizar a leitura do calendário.',
    'sem-acesso': 'A Google não devolveu acesso permanente: tenta outra vez.',
    estado: 'A ligação expirou: tenta outra vez.',
    erro: 'Não foi possível ligar o Google.'
  }[v] || 'Google: ' + v;
  history.replaceState(null, '', location.pathname);
  setTimeout(function () { if (typeof toast === 'function') toast(msg); }, 1500);
})();

/* O que esta na Agenda com o nome desta pessoa, de hoje em diante. */
var FI_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function fiCompromissos(pai, lista, passados) {
  var c = fiCartao(pai, 'Compromissos', lista.length ? String(lista.length) : '');
  if (!lista.length) {
    fiVazio(c, passados
      ? 'Nada marcado daqui para a frente.'
      : 'Nada na Agenda com o nome desta pessoa.');
    return;
  }
  var ponto = '  ' + String.fromCharCode(183) + '  ';
  lista.forEach(function (x) {
    /* Um compromisso de quem esta pessoa acompanha diz de quem e. */
    var sub = [x.de_outro && x.com ? 'de ' + x.com : null, x.detail,
               !x.de_outro && x.com ? 'com ' + x.com : null].filter(Boolean).join(ponto);
    var r = row(x.title, sub, x.at ? pill(x.at) : null);
    var p = String(x.day).split('-');
    var q = el('div', 'fi-quando');
    q.appendChild(el('b', null, String(Number(p[2]))));
    q.appendChild(document.createTextNode(FI_MESES[Number(p[1]) - 1] || ''));
    r.insertBefore(q, r.firstChild);
    c.appendChild(r);
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

/* Os movimentos do banco associados a esta pessoa (nas Finanças, no campo
   «De quem é»). Lê-se à parte, para a ficha não esperar pelas Finanças. */
function fiMovimentos(pai, p) {
  var c = fiCartao(pai, 'Movimentos do banco', '');
  var ler = el('p', 'fi-vazio', 'A ler…');
  c.appendChild(ler);
  apiGestao('/api/financas/movimentos?pessoa=' + p.id + '&desde=0&limite=40').then(function (r) {
    if (ler.parentNode) ler.parentNode.removeChild(ler);
    var ms = r.movimentos || [];
    if (!ms.length) {
      fiVazio(c, 'Nenhum movimento associado. Nas Finanças › Movimentos, abre um movimento e escolhe «De quem é», ou associa vários de uma vez.');
      return;
    }
    var rs = r.resumo || {};
    var cab = c.cabecalho && c.cabecalho.querySelector('.mono');
    var n = String(r.total || ms.length);
    if (cab) cab.textContent = n; else if (c.cabecalho) c.cabecalho.insertBefore(el('span', 'mono', n), c.cabecalho.lastChild);
    c.appendChild(el('p', 'fi-sl', [rs.saidas ? 'Saiu ' + fiEuros(rs.saidas) : '', rs.entradas ? 'entrou ' + fiEuros(rs.entradas) : '']
      .filter(Boolean).join('  ' + String.fromCharCode(183) + '  ')));
    var tb = fiTabela(c, ['Dia', 'Movimento', 'Valor']);
    ms.forEach(function (m) {
      var tr = el('tr');
      tr.appendChild(el('td', 'n', fiData(m.data)));
      var td = el('td', null, m.descricao);
      var conta = (typeof fnConta === 'function' && fnConta(m.conta_id)) || null;
      var cat = (typeof fnCatNome === 'function' && (m.categoria_id || m.ia_categoria_id)) ? fnCatNome(m.categoria_id || m.ia_categoria_id, true) : '';
      var linha = [conta ? conta.nome : '', cat].filter(Boolean).join('  ' + String.fromCharCode(183) + '  ');
      if (linha) td.appendChild(el('span', 'fi-sl', linha));
      tr.appendChild(td);
      tr.appendChild(el('td', 'n', (m.valor > 0 ? '+' : '') + fiEuros(m.valor)));
      tb.appendChild(tr);
    });
    if (typeof FN !== 'undefined') {
      var ver = el('button', 'btn small', (r.total > ms.length ? 'Ver os ' + r.total + ' nas Finanças' : 'Ver nas Finanças'));
      ver.type = 'button';
      ver.style.marginTop = '8px';
      ver.onclick = function () {
        FN.aba.financas = 'movimentos'; FN.mov.pessoa = String(p.id); FN.mov.projeto = ''; FN.mov.periodo = 'tudo';
        FN.mov.estado = ''; FN.mov.q = ''; FN.mov.conta = ''; FN.mov.categoria = ''; FN.ambito = 'tudo'; FN.area = '';
        FN.mov.sel = {}; FN.mov.mostrar = 0;
        show('financas');
        if (typeof fnRender === 'function') fnRender('financas');
      };
      c.appendChild(ver);
    }
  }, function () {
    if (ler.parentNode) ler.parentNode.removeChild(ler);
    fiVazio(c, 'As Finanças não responderam.');
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

/* ---------------- editar ---------------- */
/* O formulario e o da pagina de Pessoas (pessoas.js): os mesmos campos, as
   mesmas cores, a mesma fotografia encolhida no browser. Aqui so se abre numa
   janela e se acrescenta a nota, que e o que aparece no cartao da Familia. */
function fiEditar(p, aoGravar) {
  if (typeof peMontarDialogo === 'function') peMontarDialogo();
  var dlg = $('peDlg');
  var cx = $('peDlgC');
  if (!dlg || !cx) { toast('Não foi possível abrir a edição.'); return; }
  var nova = !p.id;
  PE.fotoNova = null;
  PE.fotoFora = false;
  clear(cx);
  cx.appendChild(el('h3', null, nova ? 'Nova pessoa' : 'Editar ' + p.name));
  cx.appendChild(el('p', 'pe-dlgs', nova
    ? 'Conta quem é. O que não souberes agora fica para depois — só o nome é obrigatório.'
    : 'Muda o que estiver errado. O resto da app passa a ver a pessoa assim.'));

  /* Um separador por bloco, como na ficha. O Geral nao muda; os outros
     dependem do tipo e redesenham-se quando ele muda, sem perder o que ja
     se escreveu nos campos que continuam a fazer sentido. */
  var tabs = el('div', 'fi-tabs');
  tabs.setAttribute('role', 'tablist');
  cx.appendChild(tabs);
  var paineis = el('div');
  cx.appendChild(paineis);

  var geral = el('div', 'fi-painel');
  geral.dataset.tab = 'Geral';
  var par1 = el('div', 'fi-par');
  par1.appendChild(peCampo('Como lhe chamas', peTexto('fiENome', p.name)));
  par1.appendChild(peCampo('Nome completo', peTexto('fiECompleto', p.full_name, 'Como está nos documentos')));
  geral.appendChild(par1);
  var par2 = el('div', 'fi-par');
  par2.appendChild(peCampo('Quem é', peTexto('fiEPapel', p.role, 'Ex.: Filha')));
  par2.appendChild(peCampo('Tipo', peSelectTipo('fiETipo', p.kind)));
  geral.appendChild(par2);
  fiPar(geral, peCampo('Data de nascimento', fiInput('fiDNasc', 'date', p.birth_on)));

  var nota = el('textarea');
  nota.id = 'fiENota';
  nota.value = p.note || '';
  nota.placeholder = 'Uma linha que aparece no cartão da Família';
  geral.appendChild(peCampo('Nota', nota));

  geral.appendChild(peBloco('Cor', peCores('fiECor', p.color)));
  geral.appendChild(peBloco('Fotografia', peFoto('fiECor', p)));

  var checks = el('div', 'fi-checks');
  checks.appendChild(peCheck('fiETarefas', 'Pode ter tarefas atribuídas', p.can_own_tasks));
  checks.appendChild(peCheck('fiEActiva', 'Activa', p.active));
  geral.appendChild(checks);
  paineis.appendChild(geral);

  var dados = el('div');
  dados.id = 'fiEDados';
  paineis.appendChild(dados);
  var v = fiValoresDe(p);
  var ativo = 'Geral';
  var redesenhar = function (kind) {
    fiCamposDados(dados, p, kind, v);
    fiSeparadores(tabs, paineis, ativo, function (t) { ativo = t; });
  };
  redesenhar(p.kind);
  $('fiETipo').onchange = function () {
    v = Object.assign(v, fiLerDados());
    redesenhar($('fiETipo').value);
  };

  var acts = el('div', 'pe-acoes');
  var cancelar = el('button', 'btn', 'Cancelar');
  cancelar.type = 'button';
  cancelar.onclick = peFecharDlg;
  var guardar = el('button', 'btn primary', nova ? 'Criar pessoa' : 'Guardar');
  guardar.type = 'button';
  guardar.onclick = function () { fiGravar(p, guardar, aoGravar); };
  acts.appendChild(cancelar);
  acts.appendChild(guardar);
  cx.appendChild(acts);

  if (dlg.showModal) { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');
  $('fiENome').focus();
}

/* ---- os campos de dados na janela ---- */
function fiValoresDe(p) {
  var v = {
    birth_on: p.birth_on, phone: p.phone, email: p.email, address: p.address,
    nif: p.nif, sns: p.sns, id_doc_tipo: p.id_doc_tipo, id_doc_numero: p.id_doc_numero,
    id_doc_validade: p.id_doc_validade, emerg_nome: p.emerg_nome, emerg_tel: p.emerg_tel,
    conta_email: p.conta_email, responsavel_id: p.responsavel_id
  };
  var det = p.detalhes || {};
  Object.keys(det).forEach(function (k) { v['det_' + k] = det[k]; });
  return v;
}

function fiInput(id, tipo, valor, dica) {
  var i = el('input');
  i.type = tipo; i.id = id; i.value = valor || '';
  if (dica) i.placeholder = dica;
  return i;
}

function fiSelect(id, opcoes, valor) {
  var s = el('select');
  s.id = id;
  opcoes.forEach(function (o) { s.appendChild(new Option(o[1], o[0])); });
  s.value = valor === null || valor === undefined ? '' : String(valor);
  return s;
}

function fiPar(pai, a, b) {
  var d = el('div', 'fi-par');
  d.appendChild(a);
  if (b) d.appendChild(b);
  pai.appendChild(d);
}

/* A barra de separadores sai dos paineis que existem nesse momento. */
function fiSeparadores(tabs, paineis, ativo, mudou) {
  clear(tabs);
  var todos = paineis.querySelectorAll('.fi-painel');
  var nomes = [];
  for (var i = 0; i < todos.length; i++) nomes.push(todos[i].dataset.tab);
  if (nomes.indexOf(ativo) < 0) ativo = 'Geral';
  var abrir = function (nome) {
    for (var k = 0; k < todos.length; k++) todos[k].hidden = todos[k].dataset.tab !== nome;
    var bs = tabs.querySelectorAll('.fi-tab');
    for (var m = 0; m < bs.length; m++) {
      var on = bs[m].dataset.tab === nome;
      bs[m].classList.toggle('on', on);
      bs[m].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    mudou(nome);
  };
  nomes.forEach(function (nome) {
    var b = el('button', 'fi-tab', nome);
    b.type = 'button';
    b.dataset.tab = nome;
    b.setAttribute('role', 'tab');
    b.onclick = function () { abrir(nome); };
    tabs.appendChild(b);
  });
  abrir(ativo);
}

function fiCamposDados(box, p, kind, v) {
  clear(box);
  var humano = FI_HUMANO[kind];
  var painel = function (nome) {
    var d = el('div', 'fi-painel');
    d.dataset.tab = nome;
    box.appendChild(d);
    return d;
  };

  if (humano) {
    var ct = painel('Contactos');
    fiPar(ct, peCampo('Telemóvel', fiInput('fiDTel', 'tel', v.phone, '9xx xxx xxx')),
              peCampo('Email', fiInput('fiDEmail', 'email', v.email)));
    ct.appendChild(peCampo('Morada', fiInput('fiDMorada', 'text', v.address)));
    ct.appendChild(el('p', 'fi-dica', 'Só se não viver na casa.'));

    var id = painel('Identificação');
    fiPar(id, peCampo('NIF', fiInput('fiDNif', 'text', v.nif, '9 algarismos')),
              peCampo('N.º de utente SNS', fiInput('fiDSns', 'text', v.sns, '9 algarismos')));
    fiPar(id, peCampo('Documento', fiSelect('fiDDocTipo',
                [['', '—'], ['cc', 'Cartão de Cidadão'], ['tr', 'Título de residência']], v.id_doc_tipo)),
              peCampo('Número', fiInput('fiDDocNum', 'text', v.id_doc_numero)));
    fiPar(id, peCampo('Válido até', fiInput('fiDDocVal', 'date', v.id_doc_validade)));
    id.appendChild(el('p', 'fi-dica', 'A validade avisa no Hoje dois meses antes.'));
  }

  var campos = FI_DETALHES[kind] || [];
  var resp = FI_RESPONSAVEL[kind];
  if (campos.length || resp) {
    var tp = painel({ adulto: 'Trabalho', crianca: 'Escola', animal: 'Cuidados' }[kind] || 'Apoio');
    var pares = campos.map(function (f) {
      return peCampo(f[1], fiInput('fiDet_' + f[0], 'text', v['det_' + f[0]], f[2]));
    });
    if (resp) {
      var gente = ((typeof G !== 'undefined' && G.people && G.people.length) ? G.people : (D && D.people) || [])
        .filter(function (x) { return x.id !== p.id && x.kind !== 'animal' && x.kind !== 'crianca'; });
      pares.push(peCampo(resp, fiSelect('fiDResp',
        [['', '—']].concat(gente.map(function (x) { return [String(x.id), x.name]; })), v.responsavel_id)));
    }
    for (var i = 0; i < pares.length; i += 2) fiPar(tp, pares[i], pares[i + 1]);
  }

  if (humano) {
    var em = painel('Emergência');
    fiPar(em, peCampo('Ligar a', fiInput('fiDEmNome', 'text', v.emerg_nome, 'Nome')),
              peCampo('Telefone', fiInput('fiDEmTel', 'tel', v.emerg_tel)));

    var ap = painel('Na app');
    var contas = FI.contas || (FI.dados && FI.dados.contas) || [];
    if (v.conta_email && contas.indexOf(v.conta_email) < 0) contas = contas.concat([v.conta_email]);
    ap.appendChild(peCampo('Conta de acesso', fiSelect('fiDConta',
      [['', '— sem conta —']].concat(contas.map(function (e) { return [e, e]; })), v.conta_email)));
    ap.appendChild(el('p', 'fi-dica', 'O email com que entra no Farol. Só aparecem as contas da página Acessos.'));
  }
}

/* Le o que esta escrito nos campos que existem agora na janela. */
function fiLerDados() {
  var v = {};
  var ler = function (id) { var x = $(id); return x ? x.value.trim() : undefined; };
  var mapa = { birth_on: 'fiDNasc', phone: 'fiDTel', email: 'fiDEmail', address: 'fiDMorada',
    nif: 'fiDNif', sns: 'fiDSns', id_doc_tipo: 'fiDDocTipo', id_doc_numero: 'fiDDocNum',
    id_doc_validade: 'fiDDocVal', emerg_nome: 'fiDEmNome', emerg_tel: 'fiDEmTel',
    conta_email: 'fiDConta', responsavel_id: 'fiDResp' };
  Object.keys(mapa).forEach(function (k) { var x = ler(mapa[k]); if (x !== undefined) v[k] = x; });
  Object.keys(FI_DETALHES).forEach(function (t) {
    FI_DETALHES[t].forEach(function (f) { var x = ler('fiDet_' + f[0]); if (x !== undefined) v['det_' + f[0]] = x; });
  });
  return v;
}

/* Quando o servidor recusa, abre o separador onde esta o campo em causa:
   um NIF errado num separador escondido e um erro que ninguem encontra. */
function fiIrParaErro(msg) {
  var alvo = /NIF|utente|documento/i.test(msg) ? 'Identificação'
    : /conta/i.test(msg) ? 'Na app'
    : /nascimento|nome/i.test(msg) ? 'Geral'
    : /email/i.test(msg) ? 'Contactos'
    : /respons/i.test(msg) ? null : null;
  var bs = document.querySelectorAll('#peDlgC .fi-tab');
  for (var i = 0; i < bs.length; i++) {
    if ((alvo && bs[i].dataset.tab === alvo) ||
        (!alvo && /respons/i.test(msg) && ['Escola', 'Apoio'].indexOf(bs[i].dataset.tab) >= 0)) { bs[i].click(); return; }
  }
}

/* Serve os tres sitios de onde se mexe numa pessoa: a ficha da Familia, o
   ecra de dados em Pessoas, e o botao de criar. Sem `p.id` e uma pessoa
   nova; `aoGravar` e o que o ecra que abriu a janela quer fazer a seguir. */
function fiGravar(p, botao, aoGravar) {
  var corpo = {
    name: ($('fiENome').value || '').trim(),
    full_name: ($('fiECompleto').value || '').trim(),
    role: ($('fiEPapel').value || '').trim(),
    kind: $('fiETipo').value,
    note: ($('fiENota').value || '').trim(),
    color: $('fiECor').dataset.cor,
    can_own_tasks: $('fiETarefas').checked,
    active: $('fiEActiva').checked
  };
  if (!corpo.name) { toast('A pessoa tem de ter um nome.'); fiIrParaErro('nome'); return; }

  /* Os dados vao todos; o que nao se aplica ao tipo vai vazio, para nao
     ficar guardado escondido um NIF do Brownie ou uma escola de um adulto. */
  var lidos = fiLerDados();
  var humano = FI_HUMANO[corpo.kind];
  ['birth_on', 'phone', 'email', 'address', 'nif', 'sns', 'id_doc_tipo', 'id_doc_numero',
   'id_doc_validade', 'emerg_nome', 'emerg_tel', 'conta_email', 'responsavel_id'].forEach(function (k) {
    corpo[k] = (k === 'birth_on' || humano || k === 'responsavel_id') && lidos[k] ? lidos[k] : null;
  });
  if (!FI_RESPONSAVEL[corpo.kind]) corpo.responsavel_id = null;
  corpo.detalhes = {};
  (FI_DETALHES[corpo.kind] || []).forEach(function (f) {
    if (lidos['det_' + f[0]]) corpo.detalhes[f[0]] = lidos['det_' + f[0]];
  });
  if (corpo.id_doc_numero && !corpo.id_doc_tipo) {
    toast('Diz que documento é: Cartão de Cidadão ou Título de residência.');
    fiIrParaErro('documento');
    return;
  }

  var foto = PE.fotoNova, fora = PE.fotoFora;
  var nome = corpo.name;
  botao.disabled = true;

  /* Criar leva a fotografia no mesmo pedido, porque ainda nao ha id a quem
     a mandar; corrigir manda-a a seguir, e so se ela mudou. */
  var pedido;
  if (p.id) {
    pedido = apiGestao('/api/pessoas/' + p.id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (d) {
      if (foto) {
        return apiGestao('/api/pessoas/' + p.id + '/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: foto })
        });
      }
      if (fora) return apiGestao('/api/pessoas/' + p.id + '/avatar', { method: 'DELETE' });
      return d;
    });
  } else {
    if (foto) corpo.avatar = foto;
    pedido = apiGestao('/api/pessoas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });
  }

  pedido.then(function (d) {
    peFecharDlg();
    toast(p.id ? 'Guardado.' : nome + ' entrou na lista.');
    /* A fotografia vai para a cache do browser por um dia. Os cartoes da
       Familia pedem-na sem versao, por isso refresca-se a copia guardada. */
    if (p.id && (foto || fora)) {
      try { fetch('/api/pessoas/' + p.id + '/avatar', { cache: 'reload', credentials: 'same-origin' }).catch(function () {}); }
      catch (e) { /* sem fetch */ }
    }
    /* Tudo o que mostra esta pessoa passa a mostra-la como ficou. */
    if (typeof peGuardar === 'function' && d && d.pessoas) peGuardar(d);
    if (window.loadGestao) loadGestao();
    /* Primeiro o arranque (cartoes da Familia), depois o ecra: o renderAll
       reescreve o subtitulo da pagina e o ecra tem de ficar por cima. */
    var arranque = apiGestao('/api/bootstrap').then(function (b) {
      if (b && b.people && typeof renderAll === 'function') { D = b; renderAll(); }
    }).catch(function () { /* os cartoes actualizam no proximo arranque */ });

    if (typeof aoGravar === 'function') { arranque.then(function () { aoGravar(d); }); return; }
    /* Sem ficha aberta nao ha ficha para reler: a janela pode ter sido aberta
       da lista de Pessoas, onde a lista ja se actualizou acima. */
    if (!p.id || !FI.id) return;
    var aqui = FI.id;
    arranque.then(function () { return apiGestao('/api/pessoas/' + aqui + '/ficha'); })
      .then(function (f) {
        if (FI.id !== aqui) return;
        FI.dados = f;
        FI.contas = f.contas || [];
        var v = document.getElementById('view-pessoa');
        if (v && v.classList.contains('is-active')) fiDesenhar();
      }).catch(function () { /* a ficha antiga fica */ });
  }).catch(function (e) {
    toast(e.message || 'Não foi possível guardar.');
    fiIrParaErro(e.message || '');
  }).then(function () { botao.disabled = false; });
}

/* ---------------- como se chega la ---------------- */
/* Qualquer coisa com data-ficha abre a ficha: a fila de pessoas ao lado do
   titulo da Familia, uma linha de tarefa, um nome numa lista. Assim este
   modulo nao tem de saber quem o chama. */
document.addEventListener('click', function (e) {
  var linha = e.target.closest && e.target.closest('[data-ficha]');
  if (linha) fiAbrir(linha.dataset.ficha);
});

(function esperarApp() {
  if ($('nav') && document.querySelector('.view')) { fiMontar(); return; }
  setTimeout(esperarApp, 400);
})();
