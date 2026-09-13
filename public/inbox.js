'use strict';
/* Farol — ecrã da Caixa de entrada.
 *
 * Escrito para não tocar no app.js: cria o botão do menu e a secção sozinho,
 * reaproveita os globais que já lá estão ($, el, clear, pill, row, toast,
 * parseDay, MESES, apiGestao, G, gState, loadGestao) e carrega os dados só
 * quando alguém abre o ecrã pela primeira vez.
 */

var IB = { itens: [], porTriar: 0, estado: 'por_triar', triando: null, montado: false, carregado: false };

var IB_DESTINOS = [
  { tipo: 'tarefa', nome: 'Tarefa', campos: [
    { k: 'title', l: 'Título', tipo: 'text' },
    { k: 'due_on', l: 'Prazo', tipo: 'date' },
    { k: 'owner_id', l: 'Quem faz', tipo: 'pessoa' },
    { k: 'project_id', l: 'Projeto', tipo: 'projeto' }
  ] },
  { tipo: 'evento', nome: 'Evento na Agenda', campos: [
    { k: 'title', l: 'Título', tipo: 'text' },
    { k: 'day', l: 'Dia', tipo: 'date' },
    { k: 'at', l: 'Hora', tipo: 'time' }
  ] },
  { tipo: 'documento', nome: 'Documento', campos: [
    { k: 'name', l: 'Nome', tipo: 'text' },
    { k: 'entity', l: 'Entidade', tipo: 'text' },
    { k: 'valid_on', l: 'Válido até', tipo: 'date' },
    { k: 'person_id', l: 'De quem', tipo: 'pessoa' }
  ] },
  { tipo: 'despesa', nome: 'Despesa', campos: [
    { k: 'description', l: 'Descrição', tipo: 'text' },
    { k: 'amount', l: 'Valor (€)', tipo: 'number' },
    { k: 'spent_on', l: 'Data', tipo: 'date' },
    { k: 'merchant', l: 'Onde', tipo: 'text' }
  ] }
];

var IB_TABS = [['por_triar', 'Por triar'], ['catalogado', 'Catalogados'], ['descartado', 'Descartados']];

/* ---------------- utilitários ---------------- */
function ibTamanho(n) {
  if (!n) return '';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}
function ibImagem(mime) { return /^image\//.test(mime || ''); }
function ibQuando(s) {
  if (!s) return '';
  var d = parseDay(s.slice(0, 10));
  return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3) + ' · ' + s.slice(11);
}

/* ---------------- montagem ---------------- */
function ibMontar() {
  if (IB.montado) return;

  if (window.TITLES) {
    TITLES.inbox = ['Caixa de entrada', 'Guardar agora, decidir depois'];
  }

  var nav = $('nav');
  if (nav && !nav.querySelector('[data-view="inbox"]')) {
    var b = el('button', null, 'Caixa de entrada');
    b.dataset.view = 'inbox';
    var badge = el('span', 'badge');
    badge.id = 'badgeInbox';
    b.appendChild(badge);
    var alvo = nav.querySelector('[data-view="tarefas"]');
    if (alvo && alvo.nextSibling) nav.insertBefore(b, alvo.nextSibling);
    else nav.appendChild(b);
  }

  var sec = el('section', 'view');
  sec.id = 'view-inbox';

  /* captura */
  var cap = el('div', 'card');
  cap.appendChild(el('h3', null, 'Guardar qualquer coisa'));
  var fich = el('input');
  fich.type = 'file'; fich.id = 'ibFicheiro';
  fich.accept = 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt';
  var nota = el('input');
  nota.type = 'text'; nota.id = 'ibNota'; nota.placeholder = 'Ou escreve uma nota…';
  var guardar = el('button', 'btn primary', 'Guardar na caixa');
  guardar.id = 'ibGuardar';
  cap.appendChild(fich); cap.appendChild(nota); cap.appendChild(guardar);
  sec.appendChild(cap);

  /* separadores */
  var tabs = el('div', 'tabs');
  tabs.dataset.tabs = 'ib';
  IB_TABS.forEach(function (t) {
    var tb = el('button', t[0] === IB.estado ? 'is-active' : null, t[1]);
    tb.dataset.tab = t[0];
    tabs.appendChild(tb);
  });
  sec.appendChild(tabs);

  var lista = el('div');
  lista.id = 'ibLista';
  sec.appendChild(lista);

  var painel = el('div', 'card');
  painel.id = 'ibTriagem';
  painel.style.display = 'none';
  sec.appendChild(painel);

  var main = document.querySelector('.view') ? document.querySelector('.view').parentNode : document.body;
  main.appendChild(sec);

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
  }).catch(function () { toast('Não foi possível ler a caixa de entrada.'); });
}

function ibRender() {
  var badge = $('badgeInbox');
  if (badge) badge.textContent = IB.porTriar || '';

  var lista = $('ibLista');
  if (!lista) return;
  clear(lista);

  if (!IB.itens.length) {
    var vazio = el('div', 'card');
    vazio.appendChild(el('p', 'muted', IB.estado === 'por_triar'
      ? 'Nada por triar. A caixa está limpa.'
      : 'Nada aqui.'));
    lista.appendChild(vazio);
    return;
  }

  IB.itens.forEach(function (item) { lista.appendChild(ibCartao(item)); });
}

function ibCartao(item) {
  var c = el('div', 'card');

  if (item.file_name && ibImagem(item.mime_type)) {
    var img = el('img');
    img.src = '/api/inbox/' + item.id + '/ficheiro';
    img.alt = item.file_name;
    img.loading = 'lazy';
    img.style.maxWidth = '100%';
    img.style.borderRadius = '8px';
    c.appendChild(img);
  }

  var titulo = item.title || item.file_name || (item.note || '').slice(0, 60) || 'Sem nome';
  var sub = [ibQuando(item.captured_at), ibTamanho(item.byte_size)].filter(Boolean).join(' · ');
  c.appendChild(row(titulo, sub));

  if (item.note && item.note !== titulo) c.appendChild(el('p', 'muted', item.note));

  if (item.links && item.links.length) {
    var tags = el('div', 'chips');
    item.links.forEach(function (l) { tags.appendChild(pill(l.tipo, 'ok')); });
    c.appendChild(tags);
  }
  if (item.status === 'catalogado' && item.store === 'inbox') {
    c.appendChild(pill('por arquivar', 'warn'));
  }

  var acoes = el('div', 'acoes');
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
    if (window.confirm('Apagar de vez? O ficheiro também desaparece.')) ibApagar(item.id);
  };
  acoes.appendChild(apagar);
  c.appendChild(acoes);
  return c;
}

/* ---------------- triagem ---------------- */
function ibAbrirTriagem(item) {
  IB.triando = item;

  // As pessoas e os projetos vêm do módulo de Tarefas; se ainda não foram
  // lidos, lê-os agora para os selects não aparecerem vazios.
  if (typeof gState !== 'undefined' && !gState.loaded && typeof loadGestao === 'function') {
    loadGestao().then(function () { ibDesenharTriagem(); });
  }
  ibDesenharTriagem();
}

function ibDesenharTriagem() {
  var p = $('ibTriagem');
  if (!p || !IB.triando) return;
  clear(p);
  p.style.display = '';

  p.appendChild(el('h3', null, 'No que é que isto se transforma?'));
  p.appendChild(el('p', 'muted', 'Pode ser mais do que uma coisa. O talão da máquina é despesa e é garantia.'));

  IB_DESTINOS.forEach(function (d) {
    var bloco = el('div', 'bloco');
    var cab = el('label', 'destino');
    var cx = el('input');
    cx.type = 'checkbox'; cx.id = 'ibUsar_' + d.tipo;
    cab.appendChild(cx);
    cab.appendChild(el('span', null, ' ' + d.nome));
    bloco.appendChild(cab);

    var campos = el('div', 'campos');
    campos.style.display = 'none';
    d.campos.forEach(function (c) { campos.appendChild(ibCampo(d.tipo, c)); });
    cx.onchange = function () { campos.style.display = cx.checked ? '' : 'none'; };
    bloco.appendChild(campos);
    p.appendChild(bloco);
  });

  var acoes = el('div', 'acoes');
  var ok = el('button', 'btn primary', 'Catalogar');
  ok.onclick = ibSubmeterTriagem;
  var cancelar = el('button', 'btn', 'Cancelar');
  cancelar.onclick = function () { IB.triando = null; p.style.display = 'none'; clear(p); };
  acoes.appendChild(ok); acoes.appendChild(cancelar);
  p.appendChild(acoes);
}

function ibCampo(tipo, c) {
  var w = el('div', 'campo');
  w.appendChild(el('label', null, c.l));
  var input;
  if (c.tipo === 'pessoa' || c.tipo === 'projeto') {
    input = el('select');
    input.appendChild(el('option', null, '—'));
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
  // Pré-preencher o título com o que já sabemos poupa metade das teclas.
  if (c.k === 'title' || c.k === 'name' || c.k === 'description') {
    var it = IB.triando;
    if (it) input.value = it.title || it.note || (it.file_name || '').replace(/\.[^.]+$/, '');
  }
  w.appendChild(input);
  return w;
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
      if (v !== undefined && v !== '' && v !== '—') dados[c.k] = v;
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
    $('ibTriagem').style.display = 'none';
    clear($('ibTriagem'));
    IB.itens = d.itens || []; IB.porTriar = d.porTriar || 0;
    ibRender();
    // O que foi criado vive nos ecrãs de Tarefas e Agenda; recarregar para
    // não ficarem desactualizados por trás.
    if (typeof loadGestao === 'function') loadGestao();
    toast('Catalogado.');
  }).catch(function (e) { toast(e.message || 'Não foi possível catalogar.'); });
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
  if (btn) { btn.disabled = true; btn.textContent = 'A guardar…'; }

  // Sem Content-Type à mão: o browser tem de escrever o boundary do multipart.
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
      toast('Guardado.');
      return ibCarregar();
    })
    .catch(function (e) { toast(e.message || 'Não foi possível guardar.'); })
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
  }).catch(function (e) { toast(e.message || 'Não foi possível gravar.'); });
}

function ibApagar(id) {
  apiGestao('/api/inbox/' + id + '?estado=' + IB.estado, { method: 'DELETE' })
    .then(function (d) {
      IB.itens = d.itens || []; IB.porTriar = d.porTriar || 0; ibRender();
    }).catch(function (e) { toast(e.message || 'Não foi possível apagar.'); });
}

/* ---------------- ligações ---------------- */
function ibLigar() {
  var g = $('ibGuardar');
  if (g) g.onclick = ibGuardar;

  var tabs = document.querySelector('[data-tabs="ib"]');
  if (tabs) {
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]');
      if (!b) return;
      IB.estado = b.dataset.tab;
      var todos = tabs.querySelectorAll('button');
      for (var i = 0; i < todos.length; i++) {
        todos[i].classList.toggle('is-active', todos[i] === b);
      }
      ibCarregar();
    });
  }
}

/* Arranque preguiçoso: só lê a caixa quando alguém a abre. */
document.addEventListener('click', function (e) {
  var b = e.target.closest && e.target.closest('button[data-view="inbox"]');
  if (b && !IB.carregado) ibCarregar();
});

(function esperarApp() {
  // O app.js desenha o menu depois do login. Esperamos por ele para
  // pendurar o botão, em vez de assumir que já lá está.
  if ($('nav') && document.querySelector('.view')) {
    ibMontar();
    // Contador no menu logo à partida, sem abrir o ecrã.
    apiGestao('/api/inbox?estado=por_triar').then(function (d) {
      IB.porTriar = d.porTriar || 0;
      var badge = $('badgeInbox');
      if (badge) badge.textContent = IB.porTriar || '';
    }).catch(function () { /* sem sessão ainda; fica para quando abrir */ });
    return;
  }
  setTimeout(esperarApp, 400);
})();
