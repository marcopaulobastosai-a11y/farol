'use strict';
/* Farol - pagina de Pessoas, em Administracao.
 *
 * Substitui o cartao que vivia dentro das Tarefas. Nao toca no app.js nem no
 * index.html: cria o botao do menu, a seccao e o seu proprio estilo, e
 * reaproveita os globais que ja la estao ($, el, clear, toast, apiGestao).
 *
 * Uma linha por pessoa, e cada linha abre o ecra dela: o mesmo que a ficha
 * da Familia mostra do lado esquerdo - quem e, contactos, identificacao,
 * trabalho ou escola, emergencia, a conta e o calendario - mas sem nada que
 * dependa de outras tabelas. Tarefas, agenda, documentos, projetos, despesas
 * e caixa sao trabalho, e trabalho ve-se na ficha; aqui e so o cadastro.
 *
 * Criar e corrigir usam a mesma janela completa que a ficha usa (fiEditar,
 * no ficha.js): um so formulario, uma so lista de campos para manter.
 */

var PE = { pessoas: [], contas: [], montado: false, fotoNova: null, fotoFora: false };

/* O ecra de uma pessoa, aqui dentro da Administracao. */
var PD = { id: null, dados: null, montado: false };

var PE_CORES = [
  ['var(--c1)', 'Petroleo'], ['var(--c2)', 'Verde'], ['var(--c3)', 'Ardosia'],
  ['var(--c4)', 'Ocre'], ['var(--c5)', 'Ameixa'], ['var(--c6)', 'Tijolo'],
  ['var(--c7)', 'Indigo'], ['var(--c8)', 'Musgo']
];

var PE_TIPOS = [['adulto', 'Adulto'], ['crianca', 'Criança'], ['familiar', 'Familiar'], ['animal', 'Animal']];

var PE_CSS = [
  ":root{--c6:#A15C43;--c7:#4C5C97;--c8:#4A7A52}",
  "@media (prefers-color-scheme:dark){:root:not([data-theme=\"light\"]){--c6:#D0907A;--c7:#8FA0D8;--c8:#84B48C}}",
  ":root[data-theme=\"dark\"]{--c6:#D0907A;--c7:#8FA0D8;--c8:#84B48C}",
  "#view-pessoas .pe-linha{display:flex;gap:.9rem;align-items:center;padding:.8rem 0;border-top:1px solid var(--line-soft)}",
  "#view-pessoas .pe-linha:first-child{border-top:0;padding-top:.25rem}",
  "#view-pessoas .pe-linha.off{opacity:.55}",
  "#view-pessoas .pe-av{flex:0 0 38px;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--mono);font-size:.75rem;letter-spacing:.04em;overflow:hidden;background:var(--c1)}",
  "#view-pessoas .pe-av img{width:100%;height:100%;object-fit:cover;display:block}",
  "#view-pessoas .pe-corpo{flex:1 1 auto;min-width:0}",
  "#view-pessoas .pe-nome{font-weight:500;color:var(--ink)}",
  "#view-pessoas .pe-meta{font-size:.8125rem;color:var(--muted);margin-top:.15rem}",
  "#view-pessoas .pe-acts{display:flex;gap:.375rem;align-items:center;flex:0 0 auto}",
  "#view-pessoas .pe-edita{flex:1 1 auto;min-width:0}",
  "#view-pessoas .pe-grelha{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.7rem}",
  "#view-pessoas .pe-vazio{padding:2rem 1rem;text-align:center;color:var(--muted)}",
  "#view-pessoas .card > header .btn{align-self:center}",
  "#view-pessoas .pe-corpo{cursor:pointer}",
  "#view-pessoas .pe-linha:hover .pe-nome{color:var(--accent-ink,var(--accent))}",
  "#view-pessoa-dados .pd-acts{display:flex;gap:.4rem;flex:0 0 auto;flex-wrap:wrap;justify-content:flex-end}",
  "#pdCorpo{max-width:52rem}",
  "#view-pessoa-dados .pd-falta{font-size:.8125rem;color:var(--muted);margin:.7rem 0 0}",
  "#view-pessoa-dados .pd-falta button{border:0;background:none;padding:0;font:inherit;color:var(--accent);cursor:pointer;text-decoration:underline;text-underline-offset:2px}",
  ".pe-cores{display:flex;gap:.4rem;flex-wrap:wrap;padding-top:.15rem}",
  ".pe-cor{width:22px;height:22px;border-radius:50%;border:2px solid transparent;box-shadow:0 0 0 1px var(--line);cursor:pointer;padding:0}",
  ".pe-cor.on{border-color:var(--surface);box-shadow:0 0 0 2px var(--accent)}",
  ".pe-foto{display:flex;gap:.6rem;align-items:center}",
  ".pe-foto input[type=file]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}",
  ".pe-prev{width:44px;height:44px;border-radius:50%;overflow:hidden;background:var(--surface-2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:#fff;font-family:var(--mono);font-size:.75rem}",
  ".pe-prev img{width:100%;height:100%;object-fit:cover;display:block}",
  ".pe-check{display:flex;gap:.45rem;align-items:center;font-size:.875rem;color:var(--ink-2);cursor:pointer}",
  ".pe-check input{width:15px;height:15px;accent-color:var(--accent)}",
  ".pe-acoes{display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem;padding-top:.9rem;border-top:1px solid var(--line-soft)}",
  ".pe-dlg{border:0;padding:0;background:transparent;max-width:30rem;width:calc(100% - 2rem);color:var(--ink)}",
  ".pe-dlg::backdrop{background:rgba(10,18,20,.45);backdrop-filter:blur(2px)}",
  ".pe-dlgc{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:1.5rem;box-shadow:0 24px 60px -20px rgba(15,40,40,.45)}",
  ".pe-dlg[open] .pe-dlgc{animation:peEntra .16s ease-out}",
  "@keyframes peEntra{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}",
  ".pe-dlgc h3{margin:0;font-size:1.15rem;font-weight:500}",
  ".pe-dlgs{color:var(--muted);font-size:.875rem;line-height:1.5;margin:.35rem 0 1.3rem}",
  "#view-pessoas .field,.pe-dlgc .field{gap:6px;margin-bottom:.85rem}",
  "#view-pessoas input[type=text],#view-pessoas select,.pe-dlgc input[type=text],.pe-dlgc select{font:inherit;font-size:.875rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:9px 11px;width:100%;min-width:0;transition:border-color .15s ease,box-shadow .15s ease}",
  "#view-pessoas input::placeholder,.pe-dlgc input::placeholder{color:var(--faint)}",
  "#view-pessoas input:focus,#view-pessoas select:focus,.pe-dlgc input:focus,.pe-dlgc select:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}"
].join('\n');

/* ---------------- utilitarios ---------------- */
function peIniciais(p) {
  if (p && p.initials) return p.initials;
  var partes = String((p && p.name) || '?').trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function peAvatar(p, tamanho) {
  var d = el('div', 'pe-av');
  d.style.background = p.color || 'var(--c1)';
  if (tamanho) { d.style.width = tamanho; d.style.height = tamanho; d.style.flexBasis = tamanho; }
  if (p.tem_avatar) {
    var img = el('img');
    img.alt = p.name;
    img.src = '/api/pessoas/' + p.id + '/avatar?v=' + encodeURIComponent(p.avatar_em || '1');
    d.appendChild(img);
  } else {
    d.appendChild(document.createTextNode(peIniciais(p)));
  }
  return d;
}

function peTipo(k) {
  for (var i = 0; i < PE_TIPOS.length; i++) if (PE_TIPOS[i][0] === k) return PE_TIPOS[i][1];
  return k || '';
}

function peLigacoesTexto(p) {
  var l = p.ligacoes || {};
  var nomes = { tarefas: 'tarefas', assunto: 'como assunto', projetos: 'projetos',
    despesas: 'despesas', documentos: 'documentos', compromissos: 'na agenda', inbox: 'na caixa' };
  var out = [];
  /* Sem o nome nao se escreve nada: uma ligacao nova no servidor aparecia
     aqui como «1 undefined» ate alguem se lembrar de a baptizar. */
  for (var k in l) if (l[k] && nomes[k]) out.push(l[k] + ' ' + nomes[k]);
  return out.join(', ');
}

function pePreso(p) {
  var l = p.ligacoes || {};
  for (var k in l) if (l[k]) return true;
  return false;
}

function peEstilo() {
  if (document.getElementById('peCss2')) return;
  var s = document.createElement('style');
  s.id = 'peCss2';
  s.textContent = PE_CSS;
  document.head.appendChild(s);
}

/* Encolhe a fotografia no browser: quadrado de 256, cortado ao centro. */
function peEncolher(ficheiro) {
  return new Promise(function (ok, falha) {
    var fr = new FileReader();
    fr.onerror = function () { falha(new Error('Nao consegui ler o ficheiro.')); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { falha(new Error('Isso nao parece uma imagem.')); };
      img.onload = function () {
        var L = 256;
        var lado = Math.min(img.width, img.height);
        var cv = document.createElement('canvas');
        cv.width = L; cv.height = L;
        cv.getContext('2d').drawImage(img,
          (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, L, L);
        ok(cv.toDataURL('image/jpeg', 0.85));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(ficheiro);
  });
}

/* ---------------- pecas de formulario ---------------- */
function peCampo(etiqueta, no) {
  var l = el('label', 'field');
  l.appendChild(el('span', null, etiqueta));
  l.appendChild(no);
  return l;
}

/* Igual, mas sem ser <label>: um label a envolver botoes ou um input de
   ficheiro faz com que clicar em qualquer sitio do bloco os dispare. */
function peBloco(etiqueta, no) {
  var d = el('div', 'field');
  d.appendChild(el('span', null, etiqueta));
  d.appendChild(no);
  return d;
}

function peTexto(id, valor, dica) {
  var i = el('input');
  i.type = 'text'; i.id = id; i.value = valor || '';
  if (dica) i.placeholder = dica;
  return i;
}

function peSelectTipo(id, valor) {
  var s = el('select');
  s.id = id;
  PE_TIPOS.forEach(function (t) {
    var o = el('option', null, t[1]);
    o.value = t[0];
    s.appendChild(o);
  });
  s.value = valor || 'adulto';
  return s;
}

function peCores(id, valor) {
  var caixa = el('div', 'pe-cores');
  caixa.id = id;
  caixa.dataset.cor = valor || 'var(--c1)';
  PE_CORES.forEach(function (c) {
    var b = el('button', 'pe-cor' + (c[0] === caixa.dataset.cor ? ' on' : ''));
    b.type = 'button';
    b.title = c[1];
    b.style.background = c[0];
    b.onclick = function () {
      caixa.dataset.cor = c[0];
      var todos = caixa.querySelectorAll('.pe-cor');
      for (var i = 0; i < todos.length; i++) todos[i].classList.toggle('on', todos[i] === b);
      var prev = document.getElementById(id + 'Prev');
      if (prev && !prev.querySelector('img')) prev.style.background = c[0];
    };
    caixa.appendChild(b);
  });
  return caixa;
}

function peCheck(id, etiqueta, ligado) {
  var l = el('label', 'pe-check');
  var i = el('input');
  i.type = 'checkbox'; i.id = id; i.checked = Boolean(ligado);
  l.appendChild(i);
  l.appendChild(el('span', null, etiqueta));
  return l;
}

/* Bloco da fotografia: pre-visualizacao, escolher e tirar. */
function peFoto(prefixo, pessoa) {
  var caixa = el('div', 'pe-foto');

  var prev = el('div', 'pe-prev');
  prev.id = prefixo + 'Prev';
  prev.style.background = (pessoa && pessoa.color) || 'var(--c1)';
  if (pessoa && pessoa.tem_avatar) {
    var img = el('img');
    img.src = '/api/pessoas/' + pessoa.id + '/avatar?v=' + encodeURIComponent(pessoa.avatar_em || '1');
    prev.appendChild(img);
  } else {
    prev.appendChild(document.createTextNode(pessoa ? peIniciais(pessoa) : '?'));
  }
  caixa.appendChild(prev);

  var escolher = el('label', 'btn', 'Escolher fotografia');
  var f = el('input');
  f.type = 'file'; f.accept = 'image/*'; f.id = prefixo + 'Ficheiro';
  f.onchange = function () {
    if (!f.files || !f.files[0]) return;
    peEncolher(f.files[0]).then(function (dataUrl) {
      PE.fotoNova = dataUrl;
      PE.fotoFora = false;
      clear(prev);
      var i2 = el('img');
      i2.src = dataUrl;
      prev.appendChild(i2);
    }).catch(function (e) { toast(e.message); });
  };
  escolher.appendChild(f);
  caixa.appendChild(escolher);

  if (pessoa && pessoa.tem_avatar) {
    var tirar = el('button', 'btn', 'Tirar');
    tirar.type = 'button';
    tirar.onclick = function () {
      PE.fotoNova = null;
      PE.fotoFora = true;
      clear(prev);
      prev.style.background = pessoa.color || 'var(--c1)';
      prev.appendChild(document.createTextNode(peIniciais(pessoa)));
    };
    caixa.appendChild(tirar);
  }

  return caixa;
}

/* ---------------- montagem ---------------- */
/* Duas pessoas, uma a frente da outra. */
function peIcone() {
  var caixa = document.createElement('span');
  caixa.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"' +
    ' stroke="currentColor" stroke-width="1.6" stroke-linecap="round"' +
    ' stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/>' +
    '<path d="M3.2 19c0-3.1 2.6-5 5.8-5s5.8 1.9 5.8 5"/>' +
    '<path d="M16.2 5.3a3.2 3.2 0 0 1 0 5.4"/>' +
    '<path d="M17.6 14.4c1.9.6 3.2 2 3.2 4.6"/></svg>';
  return caixa.firstChild;
}

function peMontar() {
  if (PE.montado) return;
  peEstilo();

  if (window.TITLES) TITLES.pessoas = ['Pessoas', 'Quem conta no Farol'];

  var nav = $('nav');
  if (nav && !nav.querySelector('[data-view="pessoas"]')) {
    var temLabel = false;
    var labels = nav.querySelectorAll('.nav-label');
    for (var i = 0; i < labels.length; i++) {
      if (/administra/i.test(labels[i].textContent)) temLabel = true;
    }
    if (!temLabel) nav.appendChild(el('div', 'nav-label mono', 'Administração'));
    var b = el('button', null, 'Pessoas');
    b.dataset.view = 'pessoas';
    b.insertBefore(peIcone(), b.firstChild);
    nav.appendChild(b);
  }

  var sec = el('section', 'view');
  sec.id = 'view-pessoas';

  var card = el('div', 'card');
  var cab = document.createElement('header');
  cab.appendChild(el('h3', null, 'Quem há em casa'));
  var cont = el('span', 'mono', '');
  cont.id = 'peConta';
  cab.appendChild(cont);
  var novo = el('button', 'btn primary', '+ Pessoa');
  novo.type = 'button';
  novo.onclick = peNova;
  cab.appendChild(novo);
  card.appendChild(cab);

  var lista = el('div');
  lista.id = 'peLista';
  card.appendChild(lista);
  sec.appendChild(card);

  var irmao = document.querySelector('.view');
  (irmao ? irmao.parentNode : document.body).appendChild(sec);

  peMontarDialogo();
  PE.montado = true;
}

function peMontarDialogo() {
  if ($('peDlg')) return;
  var dlg = el('dialog', 'pe-dlg folha');
  dlg.id = 'peDlg';
  var cx = el('div', 'pe-dlgc');
  cx.id = 'peDlgC';
  dlg.appendChild(cx);
  document.body.appendChild(dlg);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) peFecharDlg(); });
}

function peFecharDlg() {
  var d = $('peDlg');
  if (d && d.close) d.close(); else if (d) d.removeAttribute('open');
  PE.fotoNova = null;
  PE.fotoFora = false;
}

/* A mesma janela que corrige uma pessoa serve para criar uma: se nao houver
   id, o fiGravar faz POST em vez de PATCH. Assim ha uma lista de campos, e
   quem entra pela porta da Administracao pode preencher tudo de uma vez em
   vez de criar primeiro e ir buscar o resto depois. */
function peNova() {
  if (typeof fiEditar !== 'function') { toast('A janela de edição ainda não carregou.'); return; }
  peContas();
  fiEditar({ kind: 'adulto', color: 'var(--c1)', can_own_tasks: true, active: true, detalhes: {} });
}

/* ---------------- desenho ---------------- */
function peRender() {
  var alvo = $('peLista');
  if (!alvo) return;
  clear(alvo);

  var conta = $('peConta');
  if (conta) {
    var activas = PE.pessoas.filter(function (p) { return p.active; }).length;
    conta.textContent = PE.pessoas.length + (PE.pessoas.length === 1 ? ' pessoa' : ' pessoas') +
      (activas === PE.pessoas.length ? '' : ' · ' + activas + ' activas');
  }

  if (!PE.pessoas.length) {
    alvo.appendChild(el('div', 'pe-vazio', 'Ainda ninguém.'));
    return;
  }

  PE.pessoas.forEach(function (p) { alvo.appendChild(peLinha(p)); });
}

function peLinha(p) {
  var linha = el('div', 'pe-linha' + (p.active ? '' : ' off'));
  linha.appendChild(peAvatar(p));

  var corpo = el('div', 'pe-corpo');
  corpo.appendChild(el('div', 'pe-nome', p.name + (p.full_name && p.full_name !== p.name ? '  ·  ' + p.full_name : '')));

  var partes = [];
  if (p.role) partes.push(p.role);
  partes.push(peTipo(p.kind));
  if (!p.can_own_tasks) partes.push('só assunto');
  if (!p.active) partes.push('desactivada');
  var lig = peLigacoesTexto(p);
  if (lig) partes.push(lig);
  corpo.appendChild(el('div', 'pe-meta', partes.join(' · ')));
  /* Clicar na pessoa abre o que se sabe dela. Os botoes da direita ficam de
     fora deste pedaco, para nao abrirem o ecra sem querer. */
  corpo.title = 'Ver os dados de ' + p.name;
  corpo.onclick = function () { pdAbrir(p.id); };
  linha.appendChild(corpo);

  var acts = el('div', 'pe-acts');

  var editar = el('button', 'btn', 'Editar');
  editar.type = 'button';
  editar.onclick = function () {
    if (typeof fiEditar !== 'function') { toast('A janela de edição ainda não carregou.'); return; }
    peContas();
    fiEditar(p);
  };
  acts.appendChild(editar);

  var remover = el('button', 'btn', 'Remover');
  remover.type = 'button';
  if (pePreso(p)) {
    remover.disabled = true;
    remover.style.opacity = '.45';
    remover.style.cursor = 'not-allowed';
    remover.title = 'Tem ' + peLigacoesTexto(p) + '. Desactiva em vez de remover.';
  } else {
    remover.onclick = function () { peRemover(p); };
  }
  acts.appendChild(remover);

  linha.appendChild(acts);
  return linha;
}

/* ---------------- o ecra de uma pessoa ---------------- *
 * Uma copia da ficha da Familia com metade do corpo: fica o lado esquerdo,
 * que e a pessoa, e sai o lado direito, que e o trabalho dela. Reaproveita
 * as pecas do ficha.js (cartoes em acordeao, os blocos de dados, a janela de
 * edicao) para nao haver duas maneiras de mostrar o mesmo NIF.
 */
function pdMontar() {
  if (PD.montado) return;
  if (typeof fiEstilo === 'function') fiEstilo();
  peEstilo();
  if (window.TITLES) TITLES['pessoa-dados'] = ['Pessoa', 'O que está guardado nesta pessoa'];

  var sec = el('section', 'view fi-ecra');
  sec.id = 'view-pessoa-dados';
  var corpo = el('div');
  corpo.id = 'pdCorpo';
  sec.appendChild(corpo);

  var irmao = document.querySelector('.view');
  (irmao ? irmao.parentNode : document.body).appendChild(sec);
  PD.montado = true;
}

function pdAbrir(id) {
  if (typeof fiDados !== 'function') { toast('Os dados da pessoa ainda não carregaram.'); return; }
  pdMontar();
  PD.id = Number(id);
  PD.dados = null;
  show('pessoa-dados');
  var corpo = $('pdCorpo');
  clear(corpo);
  corpo.appendChild(el('p', 'fi-vazio', 'A ler…'));

  /* O erro de leitura vai no segundo argumento do .then: assim uma excepcao
     a desenhar aparece como excepcao, e nao como «nao foi possivel ler». */
  apiGestao('/api/pessoas/' + PD.id + '/dados').then(function (d) {
    PD.dados = d;
    if (typeof FI !== 'undefined') FI.contas = d.contas || [];
  }, function (e) {
    clear(corpo);
    corpo.appendChild(el('p', 'fi-vazio', e.message || 'Não foi possível ler esta pessoa.'));
  }).then(function () { if (PD.dados) pdDesenhar(); });
}

/* Chamado pelo ficha.js quando o calendario Google muda e e este o ecra que
   esta a ser visto. */
function pdRecarregar() {
  var v = document.getElementById('view-pessoa-dados');
  if (!PD.id || !v || !v.classList.contains('is-active')) return null;
  var aqui = PD.id;
  return apiGestao('/api/pessoas/' + aqui + '/dados').then(function (d) {
    if (PD.id !== aqui) return;
    PD.dados = d;
    if (typeof FI !== 'undefined') FI.contas = d.contas || [];
  }).then(function () { if (PD.id === aqui && PD.dados) pdDesenhar(); });
}

/* O que esta por preencher. Os blocos so mostram o que existe - e por isso
   que um NIF em falta nao aparece em lado nenhum. Aqui, que e a pagina de
   quem trata do cadastro, diz-se o que ainda falta e abre-se a janela. */
var PD_PEDE = {
  adulto: [['birth_on', 'data de nascimento'], ['phone', 'telemóvel'], ['email', 'email'],
           ['nif', 'NIF'], ['sns', 'n.º de utente'], ['id_doc_numero', 'documento de identificação'],
           ['emerg_nome', 'contacto de emergência'], ['det_empregador', 'entidade patronal']],
  crianca: [['birth_on', 'data de nascimento'], ['nif', 'NIF'], ['sns', 'n.º de utente'],
            ['id_doc_numero', 'documento de identificação'], ['responsavel_id', 'encarregado de educação'],
            ['det_escola', 'escola'], ['det_ano_turma', 'ano e turma']],
  familiar: [['birth_on', 'data de nascimento'], ['phone', 'telemóvel'], ['nif', 'NIF'],
             ['sns', 'n.º de utente'], ['emerg_nome', 'contacto de emergência']],
  animal: [['birth_on', 'data de nascimento'], ['det_raca', 'raça'],
           ['det_microchip', 'microchip'], ['det_veterinario', 'veterinário']]
};

function pdFaltam(p) {
  var det = p.detalhes || {};
  return (PD_PEDE[p.kind] || []).filter(function (f) {
    var v = f[0].indexOf('det_') === 0 ? det[f[0].slice(4)] : p[f[0]];
    return !v;
  }).map(function (f) { return f[1]; });
}

function pdDesenhar() {
  var d = PD.dados;
  if (!d) return;
  var p = d.pessoa;
  var corpo = $('pdCorpo');
  clear(corpo);

  if (window.TITLES) TITLES['pessoa-dados'] = [p.name, 'O que está guardado nesta pessoa'];
  var t = $('pageTitle');
  if (t) t.textContent = p.name;
  var sub = $('pageSub');
  if (sub) sub.textContent = [p.role, p.full_name && p.full_name !== p.name ? p.full_name : null]
    .filter(Boolean).join(' · ');

  var volta = el('button', 'btn fi-volta', String.fromCharCode(8592) + ' Pessoas');
  volta.type = 'button';
  volta.onclick = function () { show('pessoas'); };
  corpo.appendChild(volta);

  var cab = el('div', 'card');
  var topo = el('div', 'fi-topo');
  topo.appendChild(fiAvatar(p));

  var txt = el('div', 'grow');
  txt.appendChild(el('h2', 'fi-nome', p.name));
  var idade = fiIdade(p.birth_on);
  txt.appendChild(el('div', 'fi-sub',
    [p.full_name && p.full_name !== p.name ? p.full_name : null, p.role,
     FI_TIPOS[p.kind] || p.kind,
     idade !== null ? idade + (idade === 1 ? ' ano' : ' anos') : null]
      .filter(Boolean).join(' · ')));
  var chips = el('div', 'chips');
  if (!p.active) chips.appendChild(pill('desactivada', 'warn'));
  if (p.in_household) chips.appendChild(pill('do agregado'));
  if (p.can_own_tasks) chips.appendChild(pill('pode ter tarefas'));
  txt.appendChild(chips);
  if (p.note) txt.appendChild(el('p', 'fi-nota', p.note));

  var faltam = pdFaltam(p);
  if (faltam.length) {
    var aviso = el('p', 'pd-falta');
    aviso.appendChild(document.createTextNode('Por preencher: ' + faltam.join(', ') + '.  '));
    var por = el('button', null, 'Preencher agora');
    por.type = 'button';
    por.onclick = function () { fiEditar(p, function () { pdRecarregar(); }); };
    aviso.appendChild(por);
    txt.appendChild(aviso);
  }
  topo.appendChild(txt);

  var acts = el('div', 'pd-acts');
  var editar = el('button', 'btn primary', 'Editar');
  editar.type = 'button';
  editar.onclick = function () { fiEditar(p, function () { pdRecarregar(); }); };
  acts.appendChild(editar);
  /* O trabalho desta pessoa - tarefas, agenda, documentos, projetos - vive na
     ficha, e e a um clique daqui. */
  var ficha = el('button', 'btn', 'Ficha completa');
  ficha.type = 'button';
  ficha.title = 'Tarefas, agenda, documentos, projetos e despesas de ' + p.name;
  ficha.onclick = function () { fiAbrir(p.id); };
  acts.appendChild(ficha);
  topo.appendChild(acts);

  cab.appendChild(topo);
  corpo.appendChild(cab);

  var col = el('div', 'stack');
  corpo.appendChild(col);
  fiDados(col, p, d.dependentes || [], d.google || null);
}

/* Um nome clicavel dentro deste ecra (o responsavel, ou quem esta pessoa
   acompanha) fica neste ecra. O ficha.js ouve o mesmo clique e levaria para
   a ficha da Familia; como este modulo carrega primeiro, chega-lhe a vez
   antes e corta a passagem. */
document.addEventListener('click', function (e) {
  if (!e.target.closest) return;
  var alvo = e.target.closest('[data-ficha]');
  if (!alvo) return;
  var v = document.getElementById('view-pessoa-dados');
  if (!v || !v.classList.contains('is-active')) return;
  e.stopImmediatePropagation();
  pdAbrir(alvo.dataset.ficha);
});

/* ---------------- dados ---------------- */
function peGuardar(d) {
  PE.pessoas = d.pessoas || [];
  if (d.contas) PE.contas = d.contas;
  peRender();
}

/* A janela de edicao vai buscar as contas ao FI.contas. Quem a abre daqui
   poe la as que estao por atribuir; o fiCamposDados junta-lhes a da propria
   pessoa, se ela ja tiver uma. */
function peContas() {
  if (typeof FI !== 'undefined') FI.contas = PE.contas || [];
}

function peCarregar() {
  return apiGestao('/api/pessoas').then(peGuardar);
}

function peRemover(p) {
  apiGestao('/api/pessoas/' + p.id, { method: 'DELETE' }).then(function (d) {
    peGuardar(d);
    toast(p.name + ' saiu da lista.');
    if (window.loadGestao) loadGestao();
  }).catch(function (e) { toast(e.message || 'Não foi possível remover.'); });
}

/* ---------------- arranque ---------------- */
(function peEsperarApp() {
  if (PE.montado) return;
  var app = $('app');
  var pronto = $('nav') && document.querySelector('.view') && app && !app.hidden;
  if (!pronto) { setTimeout(peEsperarApp, 600); return; }
  apiGestao('/api/pessoas').then(function (d) {
    peMontar();
    peGuardar(d);
  }).catch(function () { /* sem sessao */ });
})();
