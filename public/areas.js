/* Farol — Áreas (Administração).
 *
 * As áreas e as sub-áreas onde tudo se arruma. Dois níveis, e mais nenhum:
 * o servidor recusa um terceiro, e a página nem o oferece.
 *
 * Segue o padrão dos outros ecrãs novos: não toca no app.js, cria o seu botão
 * de menu, a sua secção e o seu estilo, e reaproveita os globais.
 */
'use strict';

var AR = { linhas: [], carregado: false };

var AR_CSS =
  '#view-areas .ar-lista{display:flex;flex-direction:column}' +
  '#view-areas .ar-linha{display:flex;align-items:center;gap:.75rem;padding:.6rem 0;border-bottom:1px solid var(--line-soft)}' +
  '#view-areas .ar-linha:last-child{border-bottom:0}' +
  '#view-areas .ar-sub{padding-left:1.75rem}' +
  '#view-areas .ar-nome{font-weight:600}' +
  '#view-areas .ar-sub .ar-nome{font-weight:400}' +
  '#view-areas .ar-corpo{flex:1;min-width:0}' +
  '#view-areas .ar-nota{font-size:.75rem;color:var(--muted)}' +
  '#view-areas .ar-acts{display:flex;gap:.4rem;flex:none}' +
  '#view-areas .ar-acts .btn{padding:.18rem .5rem;font-size:.75rem}' +
  '#view-areas .ar-off{opacity:.5}' +
  '#view-areas input[type=text]{width:100%;padding:.5rem .6rem;border:1px solid var(--line);border-radius:8px;background:var(--ground);color:var(--ink);font:inherit;font-size:.875rem}' +
  '#view-areas input[type=text]:focus{outline:none;border-color:var(--accent)}' +
  '.ar-dlg{border:none;border-radius:14px;padding:0;max-width:26rem;width:calc(100% - 2rem);box-shadow:0 18px 48px rgba(15,23,32,.22)}' +
  '.ar-dlg::backdrop{background:rgba(15,23,32,.38)}' +
  '.ar-dlgc{background:var(--surface);padding:1.25rem;border-radius:14px;display:flex;flex-direction:column;gap:.75rem}' +
  '.ar-dlgc h3{margin:0;font-size:1.0625rem}' +
  '.ar-dlgc label{display:block;font-size:.75rem;color:var(--muted);margin-bottom:.25rem}' +
  '.ar-dlgc input,.ar-dlgc select{width:100%;padding:.5rem .6rem;border:1px solid var(--line);border-radius:8px;background:var(--ground);color:var(--ink);font:inherit;font-size:.875rem}' +
  '.ar-dlga{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.25rem}';

function arEstilo() {
  if (document.getElementById('arCss')) return;
  var s = document.createElement('style');
  s.id = 'arCss';
  s.textContent = AR_CSS;
  document.head.appendChild(s);
}

function arMontar() {
  if (document.getElementById('view-areas')) return;
  arEstilo();

  if (window.TITLES) TITLES.areas = ['\u00c1reas', 'Onde tudo se arruma'];

  var nav = $('nav');
  if (!nav) return;
  var b = el('button', null, '\u00c1reas');
  b.dataset.view = 'areas';
  /* Quem poe o cabecalho da Administracao e o primeiro modulo a chegar. Este
     espera pelo das Pessoas (ver o fim do ficheiro) e entra antes dele, ja
     debaixo do cabecalho. So o poe ele proprio se o outro faltar. */
  var pessoas = nav.querySelector('[data-view="pessoas"]');
  if (pessoas) {
    nav.insertBefore(b, pessoas);
  } else {
    var temLabel = false;
    var labels = nav.querySelectorAll('.nav-label');
    for (var i = 0; i < labels.length; i++) {
      if (/administra/i.test(labels[i].textContent)) temLabel = true;
    }
    if (!temLabel) nav.appendChild(el('div', 'nav-label mono', 'Administra\u00e7\u00e3o'));
    nav.appendChild(b);
  }

  var sec = el('section', 'view');
  sec.id = 'view-areas';
  sec.hidden = true;
  var card = el('div', 'card');
  var h = el('header');
  h.appendChild(el('h3', null, '\u00c1reas e sub-\u00e1reas'));
  var novo = el('button', 'btn primary', 'Nova');
  novo.type = 'button';
  novo.addEventListener('click', function () { arJanela(null); });
  h.appendChild(novo);
  card.appendChild(h);
  card.appendChild(el('p', 'ar-nota', 'Dois n\u00edveis, e mais nenhum. Uma \u00e1rea guarda coisas; um projeto \u00e9 o trabalho sobre elas.'));
  var lista = el('div', 'ar-lista');
  lista.id = 'arLista';
  card.appendChild(lista);
  sec.appendChild(card);

  var irmao = document.querySelector('.view');
  (irmao ? irmao.parentNode : document.body).appendChild(sec);
}

function arCarregar() {
  return apiGestao('/api/contextos').then(function (d) {
    AR.linhas = d.contextos || [];
    AR.carregado = true;
    arRender();
  }).catch(function () { /* sem sess\u00e3o ainda */ });
}

function arRender() {
  var box = document.getElementById('arLista');
  if (!box) return;
  clear(box);
  AR.linhas.forEach(function (c) {
    var w = el('div', 'ar-linha' + (c.parent_id ? ' ar-sub' : '') + (c.active ? '' : ' ar-off'));
    var corpo = el('div', 'ar-corpo');
    corpo.appendChild(el('div', 'ar-nome', c.name));
    var abaixo = [];
    if (c.note) abaixo.push(c.note);
    if (!c.active) abaixo.push('desactivada');
    if (abaixo.length) corpo.appendChild(el('div', 'ar-nota', abaixo.join(' \u00b7 ')));
    w.appendChild(corpo);

    var acts = el('div', 'ar-acts');
    if (!c.parent_id) {
      var mais = el('button', 'btn', '+ sub-\u00e1rea');
      mais.type = 'button';
      mais.addEventListener('click', function () { arJanela(null, c.id); });
      acts.appendChild(mais);
    }
    var edit = el('button', 'btn', 'Editar');
    edit.type = 'button';
    edit.addEventListener('click', function () { arJanela(c); });
    acts.appendChild(edit);
    var apagar = el('button', 'btn danger', 'Apagar');
    apagar.type = 'button';
    apagar.addEventListener('click', function () { arApagar(c); });
    acts.appendChild(apagar);
    w.appendChild(acts);
    box.appendChild(w);
  });
}

/* Criar e editar na mesma janela: os campos são os mesmos. */
function arJanela(c, paiId) {
  var dlg = el('dialog', 'ar-dlg');
  var cx = el('div', 'ar-dlgc');
  cx.appendChild(el('h3', null, c ? 'Editar \u00e1rea' : (paiId ? 'Nova sub-\u00e1rea' : 'Nova \u00e1rea')));

  var campoNome = el('div');
  campoNome.appendChild(el('label', null, 'Nome'));
  var iNome = el('input');
  iNome.type = 'text';
  iNome.value = c ? c.name : '';
  campoNome.appendChild(iNome);
  cx.appendChild(campoNome);

  var campoNota = el('div');
  campoNota.appendChild(el('label', null, 'Nota (opcional)'));
  var iNota = el('input');
  iNota.type = 'text';
  iNota.value = (c && c.note) || '';
  campoNota.appendChild(iNota);
  cx.appendChild(campoNota);

  var iActiva = null;
  if (c) {
    var campoEstado = el('div');
    campoEstado.appendChild(el('label', null, 'Estado'));
    iActiva = el('select');
    [['1', 'Activa'], ['0', 'Desactivada']].forEach(function (o) {
      var op = el('option', null, o[1]);
      op.value = o[0];
      if ((c.active ? '1' : '0') === o[0]) op.selected = true;
      iActiva.appendChild(op);
    });
    campoEstado.appendChild(iActiva);
    cx.appendChild(campoEstado);
  }

  var pe = el('div', 'ar-dlga');
  var cancelar = el('button', 'btn', 'Cancelar');
  cancelar.type = 'button';
  cancelar.addEventListener('click', function () { dlg.close(); dlg.remove(); });
  var gravar = el('button', 'btn primary', 'Gravar');
  gravar.type = 'button';
  gravar.addEventListener('click', function () {
    var corpo = { name: iNome.value.trim(), note: iNota.value.trim() || null };
    if (iActiva) corpo.active = iActiva.value === '1';
    if (!c && paiId) corpo.parent_id = paiId;
    if (!corpo.name) { toast('A \u00e1rea precisa de um nome.'); return; }
    apiGestao(c ? '/api/contextos/' + c.id : '/api/contextos', {
      method: c ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (d) {
      AR.linhas = d.contextos || AR.linhas;
      arRender();
      dlg.close(); dlg.remove();
    }).catch(function (e) { toast(e.message || 'N\u00e3o foi poss\u00edvel gravar.'); });
  });
  pe.appendChild(cancelar); pe.appendChild(gravar);
  cx.appendChild(pe);

  dlg.appendChild(cx);
  dlg.addEventListener('cancel', function () { setTimeout(function () { dlg.remove(); }, 0); });
  document.body.appendChild(dlg);
  dlg.showModal();
  iNome.focus();
}

/* O servidor e que decide se pode sair; aqui so se pergunta e se mostra o que
   ele responder, que ja vem com a lista do que esta agarrado. */
function arApagar(c) {
  if (!window.confirm('Apagar \u00ab' + c.name + '\u00bb\u003f')) return;
  apiGestao('/api/contextos/' + c.id, { method: 'DELETE' })
    .then(function (d) { AR.linhas = d.contextos || AR.linhas; toast('\u00c1rea removida.'); })
    .catch(function (e) { toast(e.message || 'N\u00e3o foi poss\u00edvel remover.'); })
    .then(function () { arCarregar(); });
}

document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('button[data-view="areas"]');
  if (b && !AR.carregado) arCarregar();
});

(function esperarApp(tentativa) {
  tentativa = tentativa || 0;
  if ($('nav') && document.querySelector('.view')) {
    /* Da tempo ao modulo das Pessoas de por o cabecalho da Administracao. Se
       ao fim de uns segundos ele nao aparecer, seguimos sem ele. */
    if (!$('nav').querySelector('[data-view="pessoas"]') && tentativa < 15) {
      setTimeout(function () { esperarApp(tentativa + 1); }, 300);
      return;
    }
    arMontar();
    return;
  }
  setTimeout(function () { esperarApp(tentativa + 1); }, 400);
})();
