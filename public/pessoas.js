'use strict';
/* Farol - pagina de Pessoas, em Administracao.
 *
 * Substitui o cartao que vivia dentro das Tarefas. Nao toca no app.js nem no
 * index.html: cria o botao do menu, a seccao e o seu proprio estilo, e
 * reaproveita os globais que ja la estao ($, el, clear, toast, apiGestao).
 *
 * Criar abre uma janela. Editar acontece na propria linha, para se ver o
 * antes e o depois sem sair do sitio.
 */

var PE = { pessoas: [], montado: false, aEditar: null, fotoNova: null, fotoFora: false };

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
  var nomes = { tarefas: 'tarefas', assunto: 'como assunto', projetos: 'projetos', despesas: 'despesas', documentos: 'documentos', inbox: 'na caixa' };
  var out = [];
  for (var k in l) if (l[k]) out.push(l[k] + ' ' + nomes[k]);
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
  novo.onclick = peAbrirNova;
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
  var dlg = el('dialog', 'pe-dlg');
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

function peAbrirNova() {
  PE.fotoNova = null;
  PE.fotoFora = false;
  var cx = $('peDlgC');
  clear(cx);
  cx.appendChild(el('h3', null, 'Nova pessoa'));
  cx.appendChild(el('p', 'pe-dlgs', 'Conta quem é. O resto — tarefas, agenda, documentos — passa a poder apontar para ela.'));

  cx.appendChild(peCampo('Como lhe chamas', peTexto('peNome', '', 'Ex.: Sofia')));
  cx.appendChild(peCampo('Nome completo (opcional)', peTexto('peCompleto', '', 'Como está nos documentos')));
  cx.appendChild(peCampo('Quem é', peTexto('pePapel', '', 'Ex.: Filha')));
  cx.appendChild(peCampo('Tipo', peSelectTipo('peTipo', 'adulto')));
  cx.appendChild(peBloco('Cor', peCores('peCor', 'var(--c1)')));
  cx.appendChild(peBloco('Fotografia', peFoto('peCor', null)));

  var checks = el('div');
  checks.style.marginTop = '.6rem';
  checks.appendChild(peCheck('peTarefas', 'Pode ter tarefas atribuídas', true));
  cx.appendChild(checks);

  var acts = el('div', 'pe-acoes');
  var cancelar = el('button', 'btn', 'Cancelar');
  cancelar.type = 'button';
  cancelar.onclick = peFecharDlg;
  var criar = el('button', 'btn primary', 'Criar pessoa');
  criar.type = 'button';
  criar.onclick = peCriar;
  acts.appendChild(cancelar);
  acts.appendChild(criar);
  cx.appendChild(acts);

  var d = $('peDlg');
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  $('peNome').focus();
}

function peCriar() {
  var nome = ($('peNome').value || '').trim();
  if (!nome) { toast('Falta o nome.'); return; }
  apiGestao('/api/pessoas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: nome,
      full_name: ($('peCompleto').value || '').trim(),
      role: ($('pePapel').value || '').trim(),
      kind: $('peTipo').value,
      color: $('peCor').dataset.cor,
      can_own_tasks: $('peTarefas').checked,
      avatar: PE.fotoNova || undefined
    })
  }).then(function (d) {
    peFecharDlg();
    peGuardar(d);
    toast(nome + ' entrou na lista.');
  }).catch(function (e) { toast(e.message || 'Não foi possível criar a pessoa.'); });
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

  PE.pessoas.forEach(function (p) {
    alvo.appendChild(PE.aEditar === p.id ? peLinhaEdicao(p) : peLinha(p));
  });
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
  linha.appendChild(corpo);

  var acts = el('div', 'pe-acts');

  var editar = el('button', 'btn', 'Editar');
  editar.type = 'button';
  editar.onclick = function () { PE.aEditar = p.id; PE.fotoNova = null; PE.fotoFora = false; peRender(); };
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

function peLinhaEdicao(p) {
  var linha = el('div', 'pe-linha');
  var caixa = el('div', 'pe-edita');

  var grelha = el('div', 'pe-grelha');
  grelha.appendChild(peCampo('Como lhe chamas', peTexto('peENome', p.name)));
  grelha.appendChild(peCampo('Nome completo', peTexto('peECompleto', p.full_name, 'Opcional')));
  grelha.appendChild(peCampo('Quem é', peTexto('peEPapel', p.role, 'Ex.: Filha')));
  grelha.appendChild(peCampo('Tipo', peSelectTipo('peETipo', p.kind)));
  caixa.appendChild(grelha);

  var segunda = el('div', 'pe-grelha');
  segunda.appendChild(peBloco('Cor', peCores('peECor', p.color)));
  segunda.appendChild(peBloco('Fotografia', peFoto('peECor', p)));
  caixa.appendChild(segunda);

  var checks = el('div');
  checks.style.display = 'flex';
  checks.style.gap = '1.25rem';
  checks.style.flexWrap = 'wrap';
  checks.style.margin = '.35rem 0 .1rem';
  checks.appendChild(peCheck('peETarefas', 'Pode ter tarefas atribuídas', p.can_own_tasks));
  checks.appendChild(peCheck('peEActiva', 'Activa', p.active));
  caixa.appendChild(checks);

  var acts = el('div', 'pe-acoes');
  var cancelar = el('button', 'btn', 'Cancelar');
  cancelar.type = 'button';
  cancelar.onclick = function () { PE.aEditar = null; PE.fotoNova = null; PE.fotoFora = false; peRender(); };
  var guardar = el('button', 'btn primary', 'Guardar');
  guardar.type = 'button';
  guardar.onclick = function () { peGravar(p); };
  acts.appendChild(cancelar);
  acts.appendChild(guardar);
  caixa.appendChild(acts);

  linha.appendChild(caixa);
  return linha;
}

/* ---------------- dados ---------------- */
function peGuardar(d) {
  PE.pessoas = d.pessoas || [];
  peRender();
}

function peCarregar() {
  return apiGestao('/api/pessoas').then(peGuardar);
}

function peGravar(p) {
  var corpo = {
    name: ($('peENome').value || '').trim(),
    full_name: ($('peECompleto').value || '').trim(),
    role: ($('peEPapel').value || '').trim(),
    kind: $('peETipo').value,
    color: $('peECor').dataset.cor,
    can_own_tasks: $('peETarefas').checked,
    active: $('peEActiva').checked
  };
  if (!corpo.name) { toast('A pessoa tem de ter um nome.'); return; }

  var foto = PE.fotoNova, fora = PE.fotoFora;
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
    PE.aEditar = null;
    PE.fotoNova = null;
    PE.fotoFora = false;
    peGuardar(d);
    toast('Guardado.');
    if (window.loadGestao) loadGestao();
  }).catch(function (e) { toast(e.message || 'Não foi possível guardar.'); });
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
