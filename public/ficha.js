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
  '#view-pessoa .fi-volta{margin-bottom:.9rem}',
  '#view-pessoa .fi-topo > .grow{flex:1 1 auto;min-width:0}',
  '#view-pessoa .fi-editar{flex:0 0 auto;align-self:flex-start}',
  '#peDlg{max-height:calc(100dvh - 2rem);overflow-y:auto}',
  '.pe-dlgc .fi-par{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:0 .75rem}',
  '#view-pessoa .fi-quando{flex:0 0 3.4rem;font-family:var(--mono);font-size:.75rem;color:var(--muted);line-height:1.35}',
  '#view-pessoa .fi-quando b{display:block;font-size:.9375rem;color:var(--ink);font-weight:500}',
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
  '#view-pessoa .fi-dados{display:grid;grid-template-columns:minmax(7.5rem,auto) 1fr;gap:.45rem 1rem;margin:0;font-size:.875rem}',
  '#view-pessoa .fi-dados dt{color:var(--muted);font-size:.8125rem}',
  '#view-pessoa .fi-dados dd{margin:0;color:var(--ink);min-width:0;overflow-wrap:anywhere}',
  '#view-pessoa .fi-dados .fi-grupo{grid-column:1/-1;font-family:var(--mono);font-size:.6875rem;letter-spacing:.08em;',
  'text-transform:uppercase;color:var(--muted);margin-top:.6rem;padding-top:.6rem;border-top:1px solid var(--line-soft)}',
  '#view-pessoa .fi-dados .fi-grupo:first-child{margin-top:0;padding-top:0;border-top:0}',
  '#view-pessoa .fi-num-id{font-family:var(--mono);letter-spacing:.02em}',
  '#view-pessoa .fi-dados a{color:var(--accent);text-underline-offset:2px}',
  '#view-pessoa .fi-ver{border:0;background:none;color:var(--accent);font:inherit;font-size:.75rem;cursor:pointer;padding:0}',
  '#view-pessoa .fi-link{color:var(--accent);cursor:pointer;text-decoration:underline;text-underline-offset:2px}'
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

  fiTarefas(esq, d.tarefas);
  fiDocumentos(esq, d.documentos);
  fiDados(dir, p, d.dependentes || []);
  fiCompromissos(dir, compromissos, d.compromissosPassados || 0);
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

/* ---------------- os dados da pessoa ---------------- */
function fiDados(pai, p, dependentes) {
  var c = fiCartao(pai, 'Dados');
  var dl = el('dl', 'fi-dados');
  var mascarados = [];
  var n = 0;

  function grupo(t) { dl.appendChild(el('div', 'fi-grupo', t)); }
  function linha(rotulo, valor) {
    if (valor === null || valor === undefined || valor === '') return false;
    dl.appendChild(el('dt', null, rotulo));
    var dd = el('dd');
    if (valor.nodeType) dd.appendChild(valor); else dd.appendChild(document.createTextNode(valor));
    dl.appendChild(dd);
    n++;
    return true;
  }
  function numero(v) {
    if (!v) return null;
    var s = el('span', 'fi-num-id', fiMascara(v));
    s.dataset.inteiro = v;
    mascarados.push(s);
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
  /* Os grupos so aparecem quando tem alguma coisa. */
  function bloco(titulo, linhas) {
    var antes = dl.childNodes.length;
    grupo(titulo);
    var algum = false;
    linhas.forEach(function (l) { if (linha(l[0], l[1])) algum = true; });
    if (!algum) while (dl.childNodes.length > antes) dl.removeChild(dl.lastChild);
  }

  var humano = FI_HUMANO[p.kind];
  var idade = fiIdade(p.birth_on);
  bloco('Quem é', [
    [p.kind === 'animal' ? 'Nasceu' : 'Nascimento',
     p.birth_on ? fiData(p.birth_on) + (idade !== null ? '  ·  ' + idade + (idade === 1 ? ' ano' : ' anos') : '') : null]
  ]);

  if (humano) {
    bloco('Contactos', [
      ['Telemóvel', p.phone ? ligacao('tel:' + String(p.phone).replace(/\s+/g, ''), p.phone) : null],
      ['Email', p.email ? ligacao('mailto:' + p.email, p.email) : null],
      ['Morada', p.address]
    ]);

    var validade = null;
    if (p.id_doc_validade) {
      validade = el('span');
      var pz = fiPrazo(p.id_doc_validade, 60);
      if (pz) validade.appendChild(pz);
    }
    bloco('Identificação', [
      ['NIF', numero(p.nif)],
      ['Utente SNS', numero(p.sns)],
      [FI_DOCS[p.id_doc_tipo] || 'Documento', numero(p.id_doc_numero)],
      ['Válido até', validade]
    ]);
  }

  var det = p.detalhes || {};
  var titulos = { adulto: 'Trabalho', crianca: 'Escola', animal: 'Cuidados' };
  var linhasDet = (FI_DETALHES[p.kind] || []).map(function (f) {
    return [f[1], f[0] === 'microchip' ? numero(det[f[0]]) : det[f[0]]];
  });
  if (FI_RESPONSAVEL[p.kind]) linhasDet.push([FI_RESPONSAVEL[p.kind], p.responsavel ? pessoaLink(p.responsavel) : null]);
  if (linhasDet.length) bloco(titulos[p.kind] || 'Apoio', linhasDet);

  /* Do outro lado da mesma relacao: de quem esta pessoa trata. */
  if (dependentes.length) {
    var educa = dependentes.filter(function (x) { return x.kind === 'crianca'; });
    var acomp = dependentes.filter(function (x) { return x.kind !== 'crianca'; });
    var lista = function (xs) {
      if (!xs.length) return null;
      var sp = el('span');
      xs.forEach(function (x, i) {
        if (i) sp.appendChild(document.createTextNode(', '));
        sp.appendChild(pessoaLink(x));
      });
      return sp;
    };
    bloco('Responsável por', [['Encarregado de', lista(educa)], ['Acompanha', lista(acomp)]]);
  }

  if (humano) {
    bloco('Em caso de emergência', [
      ['Ligar a', p.emerg_nome],
      ['Telefone', p.emerg_tel ? ligacao('tel:' + String(p.emerg_tel).replace(/\s+/g, ''), p.emerg_tel) : null]
    ]);
    bloco('Na app', [['Conta de acesso', p.conta_email]]);
  }

  if (!n) {
    fiVazio(c, 'Ainda sem dados. Carrega em Editar para os pôr.');
    return;
  }
  c.appendChild(dl);

  if (mascarados.length) {
    var ver = el('button', 'fi-ver', 'mostrar números');
    ver.type = 'button';
    var aberto = false;
    ver.onclick = function () {
      aberto = !aberto;
      mascarados.forEach(function (s) { s.textContent = aberto ? s.dataset.inteiro : fiMascara(s.dataset.inteiro); });
      ver.textContent = aberto ? 'esconder números' : 'mostrar números';
    };
    c.querySelector('header').appendChild(ver);
  }
}

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
function fiEditar(p) {
  if (typeof peMontarDialogo === 'function') peMontarDialogo();
  var dlg = $('peDlg');
  var cx = $('peDlgC');
  if (!dlg || !cx) { toast('Não foi possível abrir a edição.'); return; }
  PE.fotoNova = null;
  PE.fotoFora = false;
  clear(cx);
  cx.appendChild(el('h3', null, 'Editar ' + p.name));
  cx.appendChild(el('p', 'pe-dlgs', 'Muda o que estiver errado. O resto da app passa a ver a pessoa assim.'));

  var par1 = el('div', 'fi-par');
  par1.appendChild(peCampo('Como lhe chamas', peTexto('fiENome', p.name)));
  par1.appendChild(peCampo('Nome completo', peTexto('fiECompleto', p.full_name, 'Como está nos documentos')));
  cx.appendChild(par1);
  var par2 = el('div', 'fi-par');
  par2.appendChild(peCampo('Quem é', peTexto('fiEPapel', p.role, 'Ex.: Filha')));
  par2.appendChild(peCampo('Tipo', peSelectTipo('fiETipo', p.kind)));
  cx.appendChild(par2);

  var nota = el('textarea');
  nota.id = 'fiENota';
  nota.value = p.note || '';
  nota.placeholder = 'Uma linha que aparece no cartão da Família';
  cx.appendChild(peCampo('Nota', nota));

  cx.appendChild(peBloco('Cor', peCores('fiECor', p.color)));
  cx.appendChild(peBloco('Fotografia', peFoto('fiECor', p)));

  var checks = el('div', 'fi-checks');
  checks.appendChild(peCheck('fiETarefas', 'Pode ter tarefas atribuídas', p.can_own_tasks));
  checks.appendChild(peCheck('fiEActiva', 'Activa', p.active));
  cx.appendChild(checks);

  /* Os dados mudam com o tipo: uma crianca tem escola, o Brownie tem
     microchip. Trocar o tipo redesenha esta parte sem perder o que ja se
     escreveu nos campos que continuam a fazer sentido. */
  var dados = el('div');
  dados.id = 'fiEDados';
  cx.appendChild(dados);
  var v = fiValoresDe(p);
  fiCamposDados(dados, p, p.kind, v);
  $('fiETipo').onchange = function () {
    v = Object.assign(v, fiLerDados());
    fiCamposDados(dados, p, $('fiETipo').value, v);
  };

  var acts = el('div', 'pe-acoes');
  var cancelar = el('button', 'btn', 'Cancelar');
  cancelar.type = 'button';
  cancelar.onclick = peFecharDlg;
  var guardar = el('button', 'btn primary', 'Guardar');
  guardar.type = 'button';
  guardar.onclick = function () { fiGravar(p, guardar); };
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

function fiCamposDados(box, p, kind, v) {
  clear(box);
  var humano = FI_HUMANO[kind];
  var sec = function (t) { box.appendChild(el('div', 'fi-sec', t)); };

  sec('Nascimento');
  fiPar(box, peCampo('Data', fiInput('fiDNasc', 'date', v.birth_on)));

  if (humano) {
    sec('Contactos');
    fiPar(box, peCampo('Telemóvel', fiInput('fiDTel', 'tel', v.phone, '9xx xxx xxx')),
               peCampo('Email', fiInput('fiDEmail', 'email', v.email)));
    box.appendChild(peCampo('Morada', fiInput('fiDMorada', 'text', v.address)));
    box.appendChild(el('p', 'fi-dica', 'Só se não viver na casa.'));

    sec('Identificação');
    fiPar(box, peCampo('NIF', fiInput('fiDNif', 'text', v.nif, '9 algarismos')),
               peCampo('N.º de utente SNS', fiInput('fiDSns', 'text', v.sns, '9 algarismos')));
    fiPar(box, peCampo('Documento', fiSelect('fiDDocTipo',
                 [['', '—'], ['cc', 'Cartão de Cidadão'], ['tr', 'Título de residência']], v.id_doc_tipo)),
               peCampo('Número', fiInput('fiDDocNum', 'text', v.id_doc_numero)));
    fiPar(box, peCampo('Válido até', fiInput('fiDDocVal', 'date', v.id_doc_validade)));
    box.appendChild(el('p', 'fi-dica', 'A validade avisa no Hoje dois meses antes.'));
  }

  var campos = FI_DETALHES[kind] || [];
  var resp = FI_RESPONSAVEL[kind];
  if (campos.length || resp) {
    sec({ adulto: 'Trabalho', crianca: 'Escola', animal: 'Cuidados' }[kind] || 'Apoio');
    var pares = campos.map(function (f) {
      return peCampo(f[1], fiInput('fiDet_' + f[0], 'text', v['det_' + f[0]], f[2]));
    });
    if (resp) {
      var gente = ((typeof G !== 'undefined' && G.people && G.people.length) ? G.people : (D && D.people) || [])
        .filter(function (x) { return x.id !== p.id && x.kind !== 'animal' && x.kind !== 'crianca'; });
      pares.push(peCampo(resp, fiSelect('fiDResp',
        [['', '—']].concat(gente.map(function (x) { return [String(x.id), x.name]; })), v.responsavel_id)));
    }
    for (var i = 0; i < pares.length; i += 2) fiPar(box, pares[i], pares[i + 1]);
  }

  if (humano) {
    sec('Em caso de emergência');
    fiPar(box, peCampo('Ligar a', fiInput('fiDEmNome', 'text', v.emerg_nome, 'Nome')),
               peCampo('Telefone', fiInput('fiDEmTel', 'tel', v.emerg_tel)));

    sec('Na app');
    var contas = (FI.dados && FI.dados.contas) || [];
    if (v.conta_email && contas.indexOf(v.conta_email) < 0) contas = contas.concat([v.conta_email]);
    box.appendChild(peCampo('Conta de acesso', fiSelect('fiDConta',
      [['', '— sem conta —']].concat(contas.map(function (e) { return [e, e]; })), v.conta_email)));
    box.appendChild(el('p', 'fi-dica', 'O email com que entra no Farol. Só aparecem as contas da página Acessos.'));
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

function fiGravar(p, botao) {
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
  if (!corpo.name) { toast('A pessoa tem de ter um nome.'); return; }

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
  if (corpo.id_doc_numero && !corpo.id_doc_tipo) { toast('Diz que documento é: Cartão de Cidadão ou Título de residência.'); return; }

  var foto = PE.fotoNova, fora = PE.fotoFora;
  botao.disabled = true;
  apiGestao('/api/pessoas/' + p.id, {
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
  }).then(function (d) {
    peFecharDlg();
    toast('Guardado.');
    /* A fotografia vai para a cache do browser por um dia. Os cartoes da
       Familia pedem-na sem versao, por isso refresca-se a copia guardada. */
    if (foto || fora) {
      try { fetch('/api/pessoas/' + p.id + '/avatar', { cache: 'reload', credentials: 'same-origin' }).catch(function () {}); }
      catch (e) { /* sem fetch */ }
    }
    /* Tudo o que mostra esta pessoa passa a mostra-la como ficou. */
    if (typeof peGuardar === 'function' && d && d.pessoas) peGuardar(d);
    if (window.loadGestao) loadGestao();
    /* Primeiro o arranque (cartoes da Familia), depois a ficha: o renderAll
       reescreve o subtitulo da pagina e a ficha tem de ficar por cima. */
    var aqui = FI.id;
    apiGestao('/api/bootstrap').then(function (b) {
      if (b && b.people && typeof renderAll === 'function') { D = b; renderAll(); }
    }).catch(function () { /* os cartoes actualizam no proximo arranque */ })
      .then(function () { return apiGestao('/api/pessoas/' + aqui + '/ficha'); })
      .then(function (f) {
        if (FI.id !== aqui) return;
        FI.dados = f;
        var v = document.getElementById('view-pessoa');
        if (v && v.classList.contains('is-active')) fiDesenhar();
      }).catch(function () { /* a ficha antiga fica */ });
  }).catch(function (e) {
    toast(e.message || 'Não foi possível guardar.');
  }).then(function () { botao.disabled = false; });
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
