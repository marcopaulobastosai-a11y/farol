'use strict';
/* Farol - ecra da Caixa de entrada.
 *
 * Nao toca no app.js: cria o botao do menu, a seccao e o seu proprio estilo,
 * e reaproveita os globais que ja la estao ($, el, clear, pill, row, toast,
 * parseDay, MESES, apiGestao, G, gState, loadGestao).
 *
 * O estilo usa so os tokens da aplicacao (--accent, --line, --muted, ...),
 * para a Caixa de entrada nao parecer colada de outro sitio.
 */

var IB = { itens: [], porTriar: 0, estado: 'por_triar', triando: null, montado: false, carregado: false };

var IB_CSS = "#view-inbox .ib-drop{display:flex;align-items:center;gap:.75rem;padding:1.25rem;border:1px dashed var(--line);border-radius:var(--radius);background:var(--surface-2);cursor:pointer;transition:border-color .15s,background .15s}\n#view-inbox .ib-drop:hover,#view-inbox .ib-drop.is-over{border-color:var(--accent);background:var(--accent-soft)}\n#view-inbox .ib-drop input[type=file]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}\n#view-inbox .ib-dropi{flex:0 0 auto;width:34px;height:34px;border-radius:8px;background:var(--surface);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--accent);font-family:var(--mono);font-size:1rem}\n#view-inbox .ib-dropt{font-weight:500;color:var(--ink-2)}\n#view-inbox .ib-drops{font-size:.8125rem;color:var(--muted);margin-top:.125rem}\n#view-inbox .ib-item{display:flex;gap:.875rem;padding:.9rem 0;border-top:1px solid var(--line-soft);align-items:flex-start}\n#view-inbox .ib-item:first-child{border-top:0;padding-top:.25rem}\n#view-inbox .ib-thumb{flex:0 0 52px;width:52px;height:52px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:var(--fs-mono);color:var(--faint);text-transform:uppercase;overflow:hidden}\n#view-inbox .ib-thumb img{width:100%;height:100%;object-fit:cover;display:block}\n#view-inbox .ib-body{flex:1 1 auto;min-width:0}\n#view-inbox .ib-title{font-weight:500;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#view-inbox .ib-meta{font-size:.8125rem;color:var(--muted);margin-top:.15rem}\n#view-inbox .ib-note{font-size:.875rem;color:var(--ink-2);margin:.4rem 0 0}\n#view-inbox .ib-acts{display:flex;gap:.375rem;flex-wrap:wrap;margin-top:.55rem}\n#view-inbox .ib-dest{border:1px solid var(--line);border-radius:var(--radius);padding:.55rem .8rem;margin-bottom:.35rem;background:var(--surface)}\n#view-inbox .ib-dest.is-on{border-color:var(--accent);background:var(--accent-soft)}\n#view-inbox .ib-desth{display:flex;align-items:center;gap:.5rem;font-weight:500;cursor:pointer;color:var(--ink)}\n#view-inbox .ib-destc{margin-top:.75rem}\n#view-inbox .ib-alvo{font-family:var(--mono);font-size:var(--fs-mono);color:var(--accent-ink);background:var(--accent-soft);border-radius:6px;padding:.3rem .5rem;display:inline-block;margin:.1rem 0 .7rem}\n#view-inbox .ib-empty{padding:2.25rem 1rem;text-align:center;color:var(--muted);font-size:.9375rem}";

var IB_DESTINOS = [
  { tipo: 'tarefa', nome: 'Tarefa', campos: [
    { k: 'title', l: 'O que e preciso fazer', tipo: 'text' },
    { k: 'due_on', l: 'Prazo', tipo: 'date' },
    { k: 'owner_id', l: 'Quem faz', tipo: 'pessoa' },
    { k: 'project_id', l: 'Projeto', tipo: 'projeto' }
  ] },
  { tipo: 'evento', nome: 'Evento na Agenda', campos: [
    { k: 'title', l: 'Titulo', tipo: 'text' },
    { k: 'day', l: 'Dia', tipo: 'date' },
    { k: 'at', l: 'Hora', tipo: 'time' }
  ] },
  { tipo: 'documento', nome: 'Documento', campos: [
    { k: 'name', l: 'Nome', tipo: 'text' },
    { k: 'entity', l: 'Entidade', tipo: 'text' },
    { k: 'valid_on', l: 'Valido ate', tipo: 'date' },
    { k: 'person_id', l: 'De quem', tipo: 'pessoa' }
  ] },
  { tipo: 'despesa', nome: 'Despesa', campos: [
    { k: 'description', l: 'Descricao', tipo: 'text' },
    { k: 'amount', l: 'Valor (\u20ac)', tipo: 'number' },
    { k: 'spent_on', l: 'Data', tipo: 'date' },
    { k: 'merchant', l: 'Onde', tipo: 'text' }
  ] }
];

var IB_TABS = [['por_triar', 'Por triar'], ['catalogado', 'Catalogados'], ['descartado', 'Descartados']];

/* ---------------- utilitarios ---------------- */
function ibTamanho(n) {
  if (!n) return '';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}
function ibImagem(mime) { return /^image\//.test(mime || ''); }
function ibExt(nome) {
  var p = String(nome || '').split('.');
  return p.length > 1 ? p.pop().slice(0, 4) : 'txt';
}
function ibQuando(s) {
  if (!s) return '';
  var d = parseDay(s.slice(0, 10));
  return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3) + ', ' + s.slice(11);
}

/* ---------------- montagem ---------------- */
function ibEstilo() {
  if (document.getElementById('ibCss')) return;
  var s = document.createElement('style');
  s.id = 'ibCss';
  s.textContent = IB_CSS;
  document.head.appendChild(s);
}

function ibCabecalho(pai, titulo, direita) {
  var h = document.createElement('header');
  h.appendChild(el('h3', null, titulo));
  if (direita !== null) {
    var m = el('span', 'mono', direita);
    m.id = 'ibCount';
    h.appendChild(m);
  }
  pai.appendChild(h);
}

function ibMontar() {
  if (IB.montado) return;
  ibEstilo();

  if (window.TITLES) TITLES.inbox = ['Caixa de entrada', 'Guardar agora, decidir depois'];

  var nav = $('nav');
  if (nav && !nav.querySelector('[data-view="inbox"]')) {
    var b = el('button', null, 'Caixa de entrada');
    b.dataset.view = 'inbox';
    var badge = el('span', 'n');
    badge.id = 'badgeInbox';
    b.appendChild(badge);
    var alvo = nav.querySelector('[data-view="tarefas"]');
    if (alvo && alvo.nextSibling) nav.insertBefore(b, alvo.nextSibling);
    else nav.appendChild(b);
  }

  var sec = el('section', 'view');
  sec.id = 'view-inbox';

  /* --- captura --- */
  var cap = el('div', 'card');
  ibCabecalho(cap, 'Guardar qualquer coisa', null);

  var drop = el('label', 'ib-drop');
  drop.id = 'ibDrop';
  drop.appendChild(el('span', 'ib-dropi', '+'));
  var dtxt = el('div', 'grow');
  var dt1 = el('div', 'ib-dropt', 'Escolher ficheiro ou arrastar para aqui');
  dt1.id = 'ibDropT';
  dtxt.appendChild(dt1);
  dtxt.appendChild(el('div', 'ib-drops', 'Fotografias, PDF, documentos - ate 25 MB'));
  drop.appendChild(dtxt);
  var fich = el('input');
  fich.type = 'file'; fich.id = 'ibFicheiro';
  fich.accept = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt';
  drop.appendChild(fich);
  cap.appendChild(drop);

  var lbl = el('label', 'field');
  lbl.appendChild(el('span', null, 'Nota (opcional)'));
  var nota = el('input');
  nota.type = 'text'; nota.id = 'ibNota';
  nota.placeholder = 'Ex.: talao da maquina de lavar, garantia 2 anos';
  lbl.appendChild(nota);
  cap.appendChild(lbl);

  var acts = el('div', 'form-actions');
  var guardar = el('button', 'btn primary', 'Guardar na caixa');
  guardar.type = 'button'; guardar.id = 'ibGuardar';
  acts.appendChild(guardar);
  cap.appendChild(acts);
  sec.appendChild(cap);

  /* --- separadores --- */
  var tabs = el('div', 'tabs');
  tabs.dataset.tabs = 'ib';
  IB_TABS.forEach(function (t) {
    var tb = el('button', t[0] === IB.estado ? 'is-active' : null, t[1]);
    tb.dataset.tab = t[0];
    tabs.appendChild(tb);
  });
  sec.appendChild(tabs);

  /* --- lista --- */
  var caixa = el('div', 'card');
  ibCabecalho(caixa, 'Por triar', '');
  var lista = el('div');
  lista.id = 'ibLista';
  caixa.appendChild(lista);
  sec.appendChild(caixa);

  var painel = el('div', 'card');
  painel.id = 'ibTriagem';
  painel.hidden = true;
  sec.appendChild(painel);

  var irmao = document.querySelector('.view');
  (irmao ? irmao.parentNode : document.body).appendChild(sec);

  ibLigar();
  IB.montado = true;
}

/* ---------------- leitura ---------------- */
function ibCarregar() {
  return apiGestao('/api/inbox?estado=' + IB.estado).then(function (d) {
    IB.itens = d.itens || [];
    IB.porTriar = d.porTriar || 0;
    IB.carregado = true;
    ibRender();
  }).catch(function () { toast('Nao foi possivel ler a caixa de entrada.'); });
}

function ibRender() {
  var badge = $('badgeInbox');
  if (badge) badge.textContent = IB.porTriar || '';

  var titulo = (IB_TABS.filter(function (t) { return t[0] === IB.estado; })[0] || ['', ''])[1];
  var cab = $('ibCount');
  if (cab) {
    cab.textContent = IB.itens.length ? IB.itens.length + (IB.itens.length === 1 ? ' item' : ' itens') : '';
    var h3 = cab.parentNode.querySelector('h3');
    if (h3) h3.textContent = titulo;
  }

  var lista = $('ibLista');
  if (!lista) return;
  clear(lista);

  if (!IB.itens.length) {
    lista.appendChild(el('div', 'ib-empty', IB.estado === 'por_triar'
      ? 'Nada por triar. A caixa esta limpa.'
      : 'Nada aqui.'));
    return;
  }
  IB.itens.forEach(function (item) { lista.appendChild(ibItem(item)); });
}

function ibItem(item) {
  var w = el('div', 'ib-item');

  var th = el('div', 'ib-thumb');
  if (item.file_name && ibImagem(item.mime_type)) {
    var img = el('img');
    img.src = '/api/inbox/' + item.id + '/ficheiro';
    img.alt = '';
    img.loading = 'lazy';
    th.appendChild(img);
  } else {
    th.textContent = item.file_name ? ibExt(item.file_name) : 'nota';
  }
  w.appendChild(th);

  var body = el('div', 'ib-body');
  var titulo = item.title || item.file_name || (item.note || '').slice(0, 70) || 'Sem nome';
  body.appendChild(el('div', 'ib-title', titulo));
  body.appendChild(el('div', 'ib-meta',
    [ibQuando(item.captured_at), ibTamanho(item.byte_size)].filter(Boolean).join('  -  ')));

  if (item.note && item.note !== titulo) body.appendChild(el('p', 'ib-note', item.note));

  if ((item.links && item.links.length) || (item.status === 'catalogado' && item.store === 'inbox')) {
    var chips = el('div', 'chips');
    (item.links || []).forEach(function (l) { chips.appendChild(pill(l.tipo, 'good')); });
    if (item.status === 'catalogado' && item.store === 'inbox') chips.appendChild(pill('por arquivar', 'warn'));
    body.appendChild(chips);
  }

  var acoes = el('div', 'ib-acts');
  if (item.file_name) {
    var ver = el('a', 'btn', 'Abrir');
    ver.href = '/api/inbox/' + item.id + '/ficheiro';
    ver.target = '_blank'; ver.rel = 'noopener';
    acoes.appendChild(ver);
  }
  if (item.status === 'por_triar') {
    var triar = el('button', 'btn primary', 'Catalogar');
    triar.onclick = function () { ibAbrirTriagem(item); };
    acoes.appendChild(triar);
    var desc = el('button', 'btn', 'Descartar');
    desc.onclick = function () { ibEstado(item.id, 'descartado'); };
    acoes.appendChild(desc);
  } else if (item.status === 'descartado') {
    var volta = el('button', 'btn', 'Repor');
    volta.onclick = function () { ibEstado(item.id, 'por_triar'); };
    acoes.appendChild(volta);
  }
  var apagar = el('button', 'btn danger', 'Apagar');
  apagar.onclick = function () {
    if (window.confirm('Apagar de vez? O ficheiro tambem desaparece.')) ibApagar(item.id);
  };
  acoes.appendChild(apagar);
  body.appendChild(acoes);

  w.appendChild(body);
  return w;
}

/* ---------------- triagem ---------------- */
function ibAbrirTriagem(item) {
  IB.triando = item;
  if (typeof gState !== 'undefined' && !gState.loaded && typeof loadGestao === 'function') {
    loadGestao().then(function () { ibDesenharTriagem(); });
  }
  ibDesenharTriagem();
  var p = $('ibTriagem');
  if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function ibDesenharTriagem() {
  var p = $('ibTriagem');
  if (!p || !IB.triando) return;
  clear(p);
  p.hidden = false;

  ibCabecalho(p, 'No que e que isto se transforma?', null);
  p.appendChild(el('div', 'ib-alvo', IB.triando.file_name || ibNomeBonito(IB.triando) || 'Nota sem ficheiro'));
  p.appendChild(el('p', 'ib-note', 'Pode ser mais do que uma coisa. O talao da maquina e despesa e e garantia.'));

  IB_DESTINOS.forEach(function (d) {
    var bloco = el('div', 'ib-dest');
    var cab = el('label', 'ib-desth');
    var cx = el('input');
    cx.type = 'checkbox'; cx.id = 'ibUsar_' + d.tipo;
    cab.appendChild(cx);
    cab.appendChild(el('span', null, d.nome));
    bloco.appendChild(cab);

    var campos = el('div', 'ib-destc');
    campos.hidden = true;
    var par = null;
    d.campos.forEach(function (c, i) {
      if (i % 2 === 0) { par = el('div', 'field-row'); campos.appendChild(par); }
      par.appendChild(ibCampo(d.tipo, c));
    });
    cx.onchange = function () {
      campos.hidden = !cx.checked;
      bloco.classList.toggle('is-on', cx.checked);
    };
    bloco.appendChild(campos);
    p.appendChild(bloco);
  });

  var acoes = el('div', 'form-actions');
  var ok = el('button', 'btn primary', 'Catalogar');
  ok.type = 'button';
  ok.onclick = ibSubmeterTriagem;
  var cancelar = el('button', 'btn', 'Cancelar');
  cancelar.type = 'button';
  cancelar.onclick = function () { IB.triando = null; p.hidden = true; clear(p); };
  acoes.appendChild(ok); acoes.appendChild(cancelar);
  p.appendChild(acoes);
}

function ibCampo(tipo, c) {
  var w = el('label', 'field');
  w.appendChild(el('span', null, c.l));
  var input;
  if (c.tipo === 'pessoa' || c.tipo === 'projeto') {
    input = el('select');
    input.appendChild(el('option', null, '-'));
    var fonte = c.tipo === 'pessoa'
      ? (typeof G !== 'undefined' ? G.people : []).filter(function (x) {
        return c.k === 'owner_id' ? x.can_own_tasks : true;
      })
      : (typeof G !== 'undefined' ? G.projects : []);
    (fonte || []).forEach(function (x) {
      var o = el('option', null, x.name);
      o.value = x.id;
      input.appendChild(o);
    });
  } else {
    input = el('input');
    input.type = c.tipo;
    if (c.tipo === 'number') input.step = '0.01';
  }
  input.id = 'ibC_' + tipo + '_' + c.k;
  if (c.k === 'title' || c.k === 'name' || c.k === 'description') {
    var it = IB.triando;
    if (it) input.value = ibNomeBonito(it);
  }
  w.appendChild(input);
  return w;
}

// O nome cru do ficheiro nao serve como descricao: tira a extensao, troca
// os separadores por espacos e corta a data/hora que as camaras e os
// scanners costumam colar no fim.
function ibNomeBonito(it) {
  if (!it) return '';
  if (it.title) return it.title;
  if (it.note) return it.note;
  var s = String(it.file_name || '').replace(/\.[^.]+$/, '');
  s = s.replace(/[_-]+/g, ' ');
  s = s.replace(/\s*\d{1,2}\s\d{1,2}\s\d{2,4}(\s*\d{1,2}h\d{1,2}(m\d{1,2})?)?\s*$/i, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function ibSubmeterTriagem() {
  if (!IB.triando) return;
  var destinos = [];
  IB_DESTINOS.forEach(function (d) {
    var cx = $('ibUsar_' + d.tipo);
    if (!cx || !cx.checked) return;
    var dados = {};
    d.campos.forEach(function (c) {
      var v = ($('ibC_' + d.tipo + '_' + c.k) || {}).value;
      if (v !== undefined && v !== '' && v !== '-') dados[c.k] = v;
    });
    destinos.push({ tipo: d.tipo, dados: dados });
  });
  if (!destinos.length) { toast('Escolhe pelo menos um destino.'); return; }

  apiGestao('/api/inbox/' + IB.triando.id + '/triagem?estado=' + IB.estado, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destinos: destinos })
  }).then(function (d) {
    IB.triando = null;
    var p = $('ibTriagem');
    p.hidden = true; clear(p);
    IB.itens = d.itens || []; IB.porTriar = d.porTriar || 0;
    ibRender();
    if (typeof loadGestao === 'function') loadGestao();
    toast('Catalogado.');
  }).catch(function (e) { toast(e.message || 'Nao foi possivel catalogar.'); });
}

/* ---------------- escrita ---------------- */
function ibGuardar() {
  var fich = $('ibFicheiro');
  var nota = $('ibNota');
  var f = fich && fich.files && fich.files[0];
  var texto = nota ? nota.value.trim() : '';
  if (!f && !texto) { toast('Escolhe um ficheiro ou escreve alguma coisa.'); return; }

  var fd = new FormData();
  if (f) fd.append('ficheiro', f);
  if (texto) fd.append('note', texto);

  var btn = $('ibGuardar');
  if (btn) { btn.disabled = true; btn.textContent = 'A guardar...'; }

  // Sem Content-Type a mao: o browser tem de escrever o boundary do multipart.
  fetch('/api/inbox', { method: 'POST', body: fd })
    .then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || 'erro');
        return j;
      });
    })
    .then(function () {
      if (fich) fich.value = '';
      if (nota) nota.value = '';
      ibNomeEscolhido(null);
      toast('Guardado.');
      return ibCarregar();
    })
    .catch(function (e) { toast(e.message || 'Nao foi possivel guardar.'); })
    .then(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Guardar na caixa'; }
    });
}

function ibEstado(id, status) {
  apiGestao('/api/inbox/' + id + '?estado=' + IB.estado, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: status })
  }).then(function (d) {
    IB.itens = d.itens || []; IB.porTriar = d.porTriar || 0; ibRender();
  }).catch(function (e) { toast(e.message || 'Nao foi possivel gravar.'); });
}

function ibApagar(id) {
  apiGestao('/api/inbox/' + id + '?estado=' + IB.estado, { method: 'DELETE' })
    .then(function (d) {
      IB.itens = d.itens || []; IB.porTriar = d.porTriar || 0; ibRender();
    }).catch(function (e) { toast(e.message || 'Nao foi possivel apagar.'); });
}

/* ---------------- ligacoes ---------------- */
function ibNomeEscolhido(nome) {
  var t = $('ibDropT');
  if (t) t.textContent = nome || 'Escolher ficheiro ou arrastar para aqui';
}

function ibLigar() {
  var g = $('ibGuardar');
  if (g) g.onclick = ibGuardar;

  var fich = $('ibFicheiro');
  if (fich) fich.onchange = function () {
    ibNomeEscolhido(fich.files && fich.files[0] ? fich.files[0].name : null);
  };

  var drop = $('ibDrop');
  if (drop) {
    ['dragenter', 'dragover'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files.length) return;
      fich.files = e.dataTransfer.files;
      ibNomeEscolhido(e.dataTransfer.files[0].name);
    });
  }

  var tabs = document.querySelector('[data-tabs="ib"]');
  if (tabs) {
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (!b) return;
      IB.estado = b.dataset.tab;
      var todos = tabs.querySelectorAll('button');
      for (var i = 0; i < todos.length; i++) todos[i].classList.toggle('is-active', todos[i] === b);
      var p = $('ibTriagem');
      if (p) { p.hidden = true; clear(p); }
      IB.triando = null;
      ibCarregar();
    });
  }
}

/* Arranque preguicoso: so le a caixa quando alguem a abre. */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('button[data-view="inbox"]');
  if (b && !IB.carregado) ibCarregar();
});

(function esperarApp() {
  if ($('nav') && document.querySelector('.view')) {
    ibMontar();
    apiGestao('/api/inbox?estado=por_triar').then(function (d) {
      IB.porTriar = d.porTriar || 0;
      var badge = $('badgeInbox');
      if (badge) badge.textContent = IB.porTriar || '';
    }).catch(function () { /* sem sessao ainda */ });
    return;
  }
  setTimeout(esperarApp, 400);
})();
