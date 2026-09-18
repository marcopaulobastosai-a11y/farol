'use strict';
/* Farol - pagina de Acessos: quem pode entrar na app.
 *
 * Nao toca no app.js nem no index.html: cria o botao do menu, a seccao e o
 * seu proprio estilo, e reaproveita os globais que ja la estao ($, el, clear,
 * toast, apiGestao).
 *
 * So aparece a quem e administrador - se o GET /api/acessos responder 403,
 * nada disto chega a ser montado.
 */

var AC = { contas: [], administrador: null, editar: null, montado: false, carregado: false };

var AC_CSS = "#view-acessos .ac-linha{display:flex;gap:.875rem;align-items:flex-start;padding:.85rem 0;border-top:1px solid var(--line-soft)}\n#view-acessos .ac-linha:first-child{border-top:0;padding-top:.25rem}\n#view-acessos .ac-av{flex:0 0 34px;width:34px;height:34px;border-radius:50%;background:var(--accent-soft);color:var(--accent-ink);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:var(--fs-mono);text-transform:uppercase}\n#view-acessos .ac-corpo{flex:1 1 auto;min-width:0}\n#view-acessos .ac-email{font-weight:500;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#view-acessos .ac-meta{font-size:.8125rem;color:var(--muted);margin-top:.15rem}\n#view-acessos .ac-acts{display:flex;gap:.375rem;flex-wrap:wrap;align-items:center;flex:0 0 auto}\n#view-acessos .ac-aviso{border:1px solid var(--line);border-left:3px solid var(--warn,#8A5A16);border-radius:var(--radius);padding:.7rem .9rem;background:var(--surface-2);color:var(--ink-2);font-size:.875rem;margin-bottom:.9rem}\n#view-acessos .ac-vazio{padding:2rem 1rem;text-align:center;color:var(--muted)}\n#view-acessos .card > header .btn{align-self:center}\n.ac-dlg{border:0;padding:0;background:transparent;max-width:26rem;width:calc(100% - 2rem);color:var(--ink)}\n.ac-dlg::backdrop{background:rgba(10,18,20,.45);backdrop-filter:blur(2px)}\n.ac-dlgc{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:1.5rem;box-shadow:0 24px 60px -20px rgba(15,40,40,.45)}\n.ac-dlg[open] .ac-dlgc{animation:acEntra .16s ease-out}\n@keyframes acEntra{from{opacity:0;transform:translateY(6px) scale(.985)}to{opacity:1;transform:none}}\n.ac-dlgc h3{margin:0;font-size:1.15rem;font-weight:500}\n.ac-dlgs{color:var(--muted);font-size:.875rem;line-height:1.5;margin:.35rem 0 1.4rem}\n.ac-dlgc .field{margin-bottom:.9rem;gap:6px}\n.ac-dlgc input,.ac-dlgc select{font:inherit;font-size:.875rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:9px 11px;width:100%;min-width:0;transition:border-color .15s ease,box-shadow .15s ease}\n.ac-dlgc input::placeholder{color:var(--faint)}\n.ac-dlgc input:focus,.ac-dlgc select:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}\n.ac-dlgc select{appearance:none;-webkit-appearance:none;padding-right:32px;background-repeat:no-repeat;background-position:right 11px center;background-size:12px;background-image:url(data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAxMiAxMic+PHBhdGggZD0nTTIuNSA0LjUgNiA4bDMuNS0zLjUnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzdFOTE5Micgc3Ryb2tlLXdpZHRoPScxLjYnIHN0cm9rZS1saW5lY2FwPSdyb3VuZCcgc3Ryb2tlLWxpbmVqb2luPSdyb3VuZCcvPjwvc3ZnPg==)}\n.ac-dlga{display:flex;gap:.5rem;justify-content:flex-end;margin-top:1.5rem;padding-top:1.15rem;border-top:1px solid var(--line-soft)}\n.ac-dlga .btn{padding:8px 16px;font-size:.875rem}";

/* ---------------- utilitarios ---------------- */
function acInicial(c) {
  var s = (c.nome || c.email || '?').trim();
  return s.charAt(0);
}
function acData(s) {
  if (!s) return null;
  var d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.getDate() + ' ' + (window.MESES ? MESES[d.getMonth()].slice(0, 3) : (d.getMonth() + 1)) + ' ' + d.getFullYear();
}
function acEstilo() {
  if (document.getElementById('acCss')) return;
  var s = document.createElement('style');
  s.id = 'acCss';
  s.textContent = AC_CSS;
  document.head.appendChild(s);
}
function acCabecalho(pai, titulo, direita, accao) {
  var h = document.createElement('header');
  h.appendChild(el('h3', null, titulo));
  if (direita != null) h.appendChild(el('span', 'mono', direita));
  if (accao) h.appendChild(accao);
  pai.appendChild(h);
}

/* ---------------- montagem ---------------- */
function acMontar() {
  if (AC.montado) return;
  acEstilo();

  if (window.TITLES) TITLES.acessos = ['Acessos', 'Quem pode abrir o Farol'];

  var nav = $('nav');
  if (nav && !nav.querySelector('[data-view="acessos"]')) {
    nav.appendChild(el('div', 'nav-label mono', 'Administra\u00e7\u00e3o'));
    var b = el('button', null, 'Acessos');
    b.dataset.view = 'acessos';
    nav.appendChild(b);
  }

  var sec = el('section', 'view');
  sec.id = 'view-acessos';

  /* --- lista --- */
  var lista = el('div', 'card');
  var abrir = el('button', 'btn primary', 'Dar acesso');
  abrir.type = 'button';
  abrir.id = 'acAbrir';
  acCabecalho(lista, 'Quem pode entrar', '', abrir);
  lista.appendChild(el('div', 'ac-aviso',
    'Quem entra v\u00ea tudo: tarefas, projetos, documentos e finan\u00e7as. N\u00e3o h\u00e1 perfis dentro da app \u2014 dar acesso \u00e9 dar acesso a tudo.'));
  var corpo = el('div');
  corpo.id = 'acLista';
  lista.appendChild(corpo);
  sec.appendChild(lista);

  var irmao = document.querySelector('.view');
  (irmao ? irmao.parentNode : document.body).appendChild(sec);

  acMontarDialogo();
  abrir.onclick = function () { acAbrir(null); };

  AC.montado = true;
}

/* A janela serve para as duas coisas: dar acesso a alguem novo e editar quem
   ja la esta. Vive fora da pagina e so aparece quando e chamada. */
function acMontarDialogo() {
  if ($('acDlg')) return;

  var dlg = el('dialog', 'ac-dlg');
  dlg.id = 'acDlg';

  var cx = el('div', 'ac-dlgc');

  var titulo = el('h3', null, 'Dar acesso a algu\u00e9m');
  titulo.id = 'acDlgTitulo';
  cx.appendChild(titulo);

  var sub = el('p', 'ac-dlgs', '');
  sub.id = 'acDlgSub';
  cx.appendChild(sub);

  var f1 = el('label', 'field');
  f1.appendChild(el('span', null, 'Email da conta Google'));
  var iEmail = el('input');
  iEmail.type = 'email'; iEmail.id = 'acEmail'; iEmail.placeholder = 'nome@gmail.com';
  f1.appendChild(iEmail);
  cx.appendChild(f1);

  var f2 = el('label', 'field');
  f2.appendChild(el('span', null, 'Nome'));
  var iNome = el('input');
  iNome.type = 'text'; iNome.id = 'acNome'; iNome.placeholder = 'Como lhe chamamos';
  f2.appendChild(iNome);
  cx.appendChild(f2);

  var f3 = el('label', 'field');
  f3.appendChild(el('span', null, 'Papel'));
  var sel = el('select');
  sel.id = 'acPapel';
  var o1 = el('option', null, 'Membro \u2014 entra e usa a app'); o1.value = 'membro';
  var o2 = el('option', null, 'Administrador \u2014 tamb\u00e9m gere acessos'); o2.value = 'admin';
  sel.appendChild(o1); sel.appendChild(o2);
  f3.appendChild(sel);
  cx.appendChild(f3);

  var nota = el('p', 'ac-dlgs', '');
  nota.id = 'acDlgNota';
  nota.style.margin = '.15rem 0 0';
  nota.hidden = true;
  cx.appendChild(nota);

  var acts = el('div', 'ac-dlga');
  var cancelar = el('button', 'btn', 'Cancelar');
  cancelar.type = 'button';
  cancelar.onclick = acFechar;
  var ok = el('button', 'btn primary', 'Dar acesso');
  ok.type = 'button';
  ok.id = 'acConfirmar';
  ok.onclick = acSubmeter;
  acts.appendChild(cancelar);
  acts.appendChild(ok);
  cx.appendChild(acts);

  dlg.appendChild(cx);
  document.body.appendChild(dlg);

  iEmail.addEventListener('keydown', function (e) { if (e.key === 'Enter') acSubmeter(); });
  iNome.addEventListener('keydown', function (e) { if (e.key === 'Enter') acSubmeter(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) acFechar(); });
}

/* conta a editar, ou nada para dar acesso a alguem novo */
function acAbrir(conta) {
  var dlg = $('acDlg');
  if (!dlg) return;
  AC.editar = conta || null;

  var iEmail = $('acEmail'), iNome = $('acNome'), sel = $('acPapel'), nota = $('acDlgNota');

  if (conta) {
    $('acDlgTitulo').textContent = 'Editar acesso';
    $('acDlgSub').textContent = 'O email n\u00e3o se muda \u2014 para trocar de conta, retira esta e d\u00e1 acesso \u00e0 nova.';
    iEmail.value = conta.email;
    iEmail.disabled = true;
    iNome.value = conta.nome || '';
    sel.value = conta.papel;
    sel.disabled = Boolean(conta.protegido);
    nota.hidden = !conta.protegido;
    nota.textContent = conta.protegido
      ? 'Esta \u00e9 a conta de administrador do Farol: o papel n\u00e3o pode mudar.'
      : '';
    $('acConfirmar').textContent = 'Guardar';
  } else {
    $('acDlgTitulo').textContent = 'Dar acesso a algu\u00e9m';
    $('acDlgSub').textContent = 'A pessoa entra com esta conta Google e passa a ver tudo o que est\u00e1 no Farol.';
    iEmail.value = '';
    iEmail.disabled = false;
    iNome.value = '';
    sel.value = 'membro';
    sel.disabled = false;
    nota.hidden = true;
    $('acConfirmar').textContent = 'Dar acesso';
  }

  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  (conta ? iNome : iEmail).focus();
}

function acFechar() {
  var dlg = $('acDlg');
  if (!dlg) return;
  AC.editar = null;
  if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
}

/* ---------------- desenho ---------------- */
function acRender() {
  var alvo = $('acLista');
  if (!alvo) return;
  clear(alvo);

  var cab = document.querySelector('#view-acessos header .mono');
  if (cab) cab.textContent = AC.contas.length + (AC.contas.length === 1 ? ' conta' : ' contas');

  if (!AC.contas.length) {
    alvo.appendChild(el('div', 'ac-vazio', 'Ningu\u00e9m, o que n\u00e3o deveria acontecer.'));
    return;
  }

  AC.contas.forEach(function (c) {
    var linha = el('div', 'ac-linha');
    linha.appendChild(el('div', 'ac-av', acInicial(c)));

    var corpo = el('div', 'ac-corpo');
    corpo.appendChild(el('div', 'ac-email', c.nome ? c.nome + ' \u2014 ' + c.email : c.email));

    var partes = [];
    if (c.protegido) partes.push('administrador do Farol, n\u00e3o pode ser removido');
    else if (c.papel === 'admin') partes.push('administrador');
    if (c.visto_em) partes.push('\u00faltima entrada ' + acData(c.visto_em));
    else partes.push('ainda n\u00e3o entrou');
    if (c.criado_em) partes.push('desde ' + acData(c.criado_em));
    corpo.appendChild(el('div', 'ac-meta', partes.join(' \u00b7 ')));
    linha.appendChild(corpo);

    var acts = el('div', 'ac-acts');
    if (c.papel === 'admin') acts.appendChild(pill('admin', 'good'));

    var editar = el('button', 'btn', 'Editar');
    editar.type = 'button';
    editar.onclick = function () { acAbrir(c); };
    acts.appendChild(editar);

    if (!c.protegido) {
      var tirar = el('button', 'btn', 'Retirar acesso');
      tirar.type = 'button';
      tirar.onclick = function () { acRemover(c); };
      acts.appendChild(tirar);
    }
    linha.appendChild(acts);
    alvo.appendChild(linha);
  });
}

/* ---------------- dados ---------------- */
function acGuardar(d) {
  AC.contas = d.contas || [];
  AC.administrador = d.administrador || null;
  AC.carregado = true;
  acRender();
}

function acCarregar() {
  return apiGestao('/api/acessos').then(acGuardar);
}

function acSubmeter() {
  return AC.editar ? acGravarEdicao(AC.editar) : acAdicionar();
}

function acAdicionar() {
  var email = ($('acEmail').value || '').trim();
  var nome = ($('acNome').value || '').trim();
  var papel = $('acPapel').value;
  if (!email) { toast('Falta o email.'); return; }
  apiGestao('/api/acessos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email, nome: nome, papel: papel })
  }).then(function (d) {
    acFechar();
    acGuardar(d);
    toast(email + ' passa a ter acesso.');
  }).catch(function (e) { toast(e.message || 'N\u00e3o foi poss\u00edvel dar o acesso.'); });
}

function acGravarEdicao(c) {
  var nome = ($('acNome').value || '').trim();
  var papel = $('acPapel').disabled ? c.papel : $('acPapel').value;
  apiGestao('/api/acessos/' + c.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: nome, papel: papel })
  }).then(function (d) {
    acFechar();
    acGuardar(d);
    toast('Guardado.');
  }).catch(function (e) { toast(e.message || 'N\u00e3o foi poss\u00edvel guardar.'); });
}

function acRemover(c) {
  apiGestao('/api/acessos/' + c.id, { method: 'DELETE' }).then(function (d) {
    acGuardar(d);
    toast(c.email + ' deixou de ter acesso.');
  }).catch(function (e) { toast(e.message || 'N\u00e3o foi poss\u00edvel retirar o acesso.'); });
}

/* ---------------- arranque ---------------- */
/* A pagina so existe para administradores. Espera que o login passe (a app
   fica escondida ate la) e so entao pergunta a API; se a API recusar, nao se
   monta nada - nem o botao do menu aparece. */
(function esperarApp() {
  if (AC.montado || AC.desistiu) return;
  var app = $('app');
  var pronto = $('nav') && document.querySelector('.view') && app && !app.hidden;
  if (!pronto) { setTimeout(esperarApp, 600); return; }
  apiGestao('/api/acessos').then(function (d) {
    acMontar();
    acGuardar(d);
  }).catch(function () { AC.desistiu = true; });
})();
