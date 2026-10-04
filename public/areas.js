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
  '.ar-dlga{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.25rem}' +
  '#view-areas .ar-cor{width:14px;height:14px;border-radius:4px;flex:none;border:1px solid var(--line)}' +
  '#view-areas .ar-cor.vazia{background:repeating-linear-gradient(45deg,transparent 0 3px,var(--line) 3px 4px)}' +
  '.ar-cores{display:flex;flex-wrap:wrap;gap:6px;align-items:center}' +
  '.ar-cores button{width:28px;height:28px;border-radius:7px;border:1px solid var(--line);cursor:pointer;padding:0}' +
  '.ar-cores button.on{outline:2px solid var(--accent);outline-offset:2px}' +
  '.ar-cores button.sem{background:repeating-linear-gradient(45deg,transparent 0 4px,var(--line) 4px 5px)}' +
  '.ar-dlgc .ar-cores input[type=color]{width:34px;height:30px;padding:2px;border-radius:7px;cursor:pointer}' +
  '.ar-dlgc .ar-cores small{font-size:.72rem;color:var(--muted)}' +
  '.attn article.ar-tinta{background:color-mix(in srgb, var(--ar-cor) 9%, var(--surface));border-color:color-mix(in srgb, var(--ar-cor) 22%, var(--line))}' +
  /* O Hoje compacto: uma linha por aviso, titulo e onde lado a lado, sem
     sombra. Com a cor em tom pastel, 30 avisos cabem num ecra sem gritar. */
  '#view-hoje .attn{gap:6px}' +
  '#view-hoje .attn article{padding:9px 12px 9px 16px;box-shadow:none;border-radius:10px;align-items:center;gap:10px;transition:box-shadow .15s}' +
  '#view-hoje .attn article:hover{box-shadow:0 1px 5px rgba(15,23,32,.1)}' +
  '#view-hoje .attn article .grow{display:flex;align-items:baseline;gap:10px;min-width:0}' +
  '#view-hoje .attn article h4{font-size:.875rem;font-weight:600;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:0 1 auto}' +
  '#view-hoje .attn article p{font-size:.75rem;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 10 auto}' +
  '#view-hoje .attn article::before{width:3px;top:8px;bottom:8px;left:6px;border-radius:3px}' +
  '#view-hoje .attn .when .pill{font-size:.625rem}' +
  '#view-hoje .attn details.atraso{box-shadow:none}' +
  /* O Hoje em branco, para os cartoes com a cor da area se lerem. */
  'body:has(#view-hoje.is-active){background:var(--surface)}' +
  'body:has(#view-hoje.is-active) .topbar{background:color-mix(in srgb, var(--surface) 88%, transparent)}' +
  /* A amostra da cor na lista e um botao: muda-se a cor ali mesmo. */
  '#view-areas button.ar-cor{cursor:pointer;width:20px;height:20px;border-radius:6px;padding:0}' +
  '#view-areas button.ar-cor:hover{outline:2px solid var(--accent);outline-offset:2px}' +
  '.ar-pop{position:fixed;z-index:60;background:var(--surface);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(15,23,32,.2);padding:10px 12px;display:flex;flex-direction:column;gap:8px}' +
  '.ar-pop b{font-size:.8125rem}' +
  '.ar-pop input[type=color]{width:34px;height:30px;padding:2px;border:1px solid var(--line);border-radius:7px;cursor:pointer;background:var(--surface)}';

/* Cores a mao, para nao ter de escolher num circulo de cores. Sao fundos: a
   percentagem baixa com que pintam os cartoes do Hoje (13%) chega para as
   distinguir em claro e em escuro sem tapar o texto. */
var AR_CORES = ['#2a78d6', '#1baf7a', '#eda100', '#eb6834', '#e87ba4', '#8a63d2', '#0f9aa8', '#7a8a8b'];

/* A cor que vale para um contexto: a dele, senao a da area de cima. */
function arCorDe(id) {
  var cs = (window.G && G.contextos) || [];
  var c = cs.filter(function (x) { return x.id === id; })[0];
  if (!c) return null;
  if (c.color) return c.color;
  if (!c.parent_id) return null;
  var p = cs.filter(function (x) { return x.id === c.parent_id; })[0];
  return (p && p.color) || null;
}

function arEstilo() {
  if (document.getElementById('arCss')) return;
  var s = document.createElement('style');
  s.id = 'arCss';
  s.textContent = AR_CSS;
  document.head.appendChild(s);
}

/* Camadas sobrepostas: uma area por cima da outra. */
function arIcone() {
  var caixa = document.createElement('span');
  caixa.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"' +
    ' stroke="currentColor" stroke-width="1.6" stroke-linecap="round"' +
    ' stroke-linejoin="round"><path d="M12 3.5l8.5 4.2-8.5 4.2-8.5-4.2z"/>' +
    '<path d="M3.5 12.3l8.5 4.2 8.5-4.2"/></svg>';
  return caixa.firstChild;
}

function arMontar() {
  if (document.getElementById('view-areas')) return;
  arEstilo();

  if (window.TITLES) TITLES.areas = ['\u00c1reas', 'Onde tudo se arruma'];

  var nav = $('nav');
  if (!nav) return;
  var b = el('button', null, '\u00c1reas');
  b.dataset.view = 'areas';
  b.insertBefore(arIcone(), b.firstChild);
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
    var sw = el('button', 'ar-cor' + (c.color ? '' : ' vazia'));
    sw.type = 'button';
    if (c.color) sw.style.background = c.color;
    sw.title = (c.color ? 'Cor ' + c.color : (c.parent_id ? 'Sem cor: usa a da \u00e1rea' : 'Sem cor')) + ' \u2014 clicar para mudar';
    sw.addEventListener('click', function (ev) { ev.stopPropagation(); arPopCor(c, sw); });
    w.appendChild(sw);
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
  var dlg = el('dialog', 'ar-dlg folha');
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

  /* Uma sub-area pode mudar de area; leva consigo tudo o que tem. */
  var iPai = null;
  if (c && c.parent_id) {
    var campoPai = el('div');
    campoPai.appendChild(el('label', null, 'Dentro de'));
    iPai = el('select');
    AR.linhas.filter(function (x) { return !x.parent_id; }).forEach(function (x) {
      var op = el('option', null, x.name);
      op.value = String(x.id);
      if (x.id === c.parent_id) op.selected = true;
      iPai.appendChild(op);
    });
    campoPai.appendChild(iPai);
    cx.appendChild(campoPai);
  }

  /* A cor do fundo dos cartoes do Hoje. */
  var corEscolhida = (c && c.color) || null;
  /* Toda a area de topo tem cor: uma nova nasce com a primeira das prontas
     que ainda ninguem usa (muda-se ali mesmo, antes de gravar). Uma
     sub-area nasce sem cor e usa a da area. */
  if (!c && !paiId) {
    var usadas = AR.linhas.map(function (x) { return x.color; });
    corEscolhida = AR_CORES.filter(function (k) { return usadas.indexOf(k) < 0; })[0] || AR_CORES[0];
  }
  var campoCor = el('div');
  campoCor.appendChild(el('label', null, c && c.parent_id || paiId
    ? 'Cor (sem cor, usa a da \u00e1rea)' : 'Cor dos cart\u00f5es no Hoje'));
  var cores = el('div', 'ar-cores');
  var iCor = el('input');
  iCor.type = 'color';
  iCor.title = 'Outra cor';
  iCor.value = '#7a8a8b';
  function marcarCor() {
    cores.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', (b.dataset.cor || null) === corEscolhida);
    });
    if (corEscolhida) iCor.value = corEscolhida;
  }
  var bSem = el('button', 'sem');
  bSem.type = 'button';
  bSem.title = 'Sem cor';
  bSem.addEventListener('click', function () { corEscolhida = null; marcarCor(); });
  cores.appendChild(bSem);
  AR_CORES.forEach(function (k) {
    var b = el('button');
    b.type = 'button';
    b.dataset.cor = k;
    b.style.background = k;
    b.title = k;
    b.addEventListener('click', function () { corEscolhida = k; marcarCor(); });
    cores.appendChild(b);
  });
  iCor.addEventListener('input', function () { corEscolhida = iCor.value.toLowerCase(); marcarCor(); });
  cores.appendChild(iCor);
  campoCor.appendChild(cores);
  cx.appendChild(campoCor);
  marcarCor();

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
    var corpo = { name: iNome.value.trim(), note: iNota.value.trim() || null, color: corEscolhida };
    if (iActiva) corpo.active = iActiva.value === '1';
    if (iPai && Number(iPai.value) !== c.parent_id) corpo.parent_id = Number(iPai.value);
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
      /* As cores vivem tambem no /api/gestao: rele-se para o Hoje as ver. */
      if (typeof loadGestao === 'function') loadGestao();
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

/* ------------------------------------------------------------------ *
 * O Hoje com as cores das areas (27 set)
 *
 * Cada cartao do Hoje que pertence a uma area leva o fundo na cor dela. O
 * app.js nao se toca: embrulha-se o attnCard, que o renderHoje chama pelo
 * nome. As cores vem no /api/gestao, que pode chegar depois do /api/bootstrap:
 * quando chega, o Hoje desenha-se outra vez.
 * ------------------------------------------------------------------ */
if (typeof attnCard === 'function') {
  var _arAttnCard = attnCard;
  attnCard = function (x) {
    var art = _arAttnCard(x);
    var ctx = x && x.a && x.a.context_id;
    var k = ctx ? arCorDe(ctx) : null;
    if (k) {
      art.classList.add('ar-tinta');
      art.style.setProperty('--ar-cor', k);
      /* Tambem no proprio cartao: se o CSS do modulo ainda nao tiver entrado
         (o Hoje pode ser desenhado antes deste ficheiro chegar), o cartao
         nao fica branco na mesma. */
      art.style.background = 'color-mix(in srgb, ' + k + ' 9%, var(--surface))';
      art.style.borderColor = 'color-mix(in srgb, ' + k + ' 22%, var(--line))';
    }
    return art;
  };
}
if (typeof renderGestao === 'function') {
  var _arRenderGestao = renderGestao;
  renderGestao = function () {
    _arRenderGestao();
    try { if (window.D && D.attention && typeof renderHoje === 'function') { arEstilo(); renderHoje(); } }
    catch (e) { console.error('[farol] hoje com cores', e); }
  };
}

/* ------------------------------------------------------------------ *
 * Mudar a cor na lista das Areas (27 set)
 *
 * A cor escolhia-se so dentro do Editar, e ninguem a encontrava la. A
 * amostra ao lado do nome passa a ser o sitio: clicar abre as oito cores
 * prontas, «sem cor» e o seletor livre, e grava na hora.
 * ------------------------------------------------------------------ */
function arFecharPop() {
  document.querySelectorAll('.ar-pop').forEach(function (p) { p.remove(); });
}
function arGravarCor(c, cor) {
  arFecharPop();
  apiGestao('/api/contextos/' + c.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ color: cor })
  }).then(function (d) {
    AR.linhas = d.contextos || AR.linhas;
    arRender();
    toast(cor ? 'Cor de \u00ab' + c.name + '\u00bb gravada.' : '\u00ab' + c.name + '\u00bb ficou sem cor.');
    if (typeof loadGestao === 'function') loadGestao();
  }).catch(function (e) { toast(e.message || 'N\u00e3o foi poss\u00edvel gravar a cor.'); });
}
function arPopCor(c, ancora) {
  arFecharPop();
  var pop = el('div', 'ar-pop');
  pop.appendChild(el('b', null, c.name));
  var cores = el('div', 'ar-cores');
  var sem = el('button', 'sem' + (c.color ? '' : ' on'));
  sem.type = 'button';
  sem.title = c.parent_id ? 'Sem cor (usa a da \u00e1rea)' : 'Sem cor';
  sem.addEventListener('click', function () { arGravarCor(c, null); });
  cores.appendChild(sem);
  AR_CORES.forEach(function (k) {
    var b = el('button', c.color === k ? 'on' : '');
    b.type = 'button';
    b.style.background = k;
    b.title = k;
    b.addEventListener('click', function () { arGravarCor(c, k); });
    cores.appendChild(b);
  });
  var livre = el('input');
  livre.type = 'color';
  livre.title = 'Outra cor';
  livre.value = c.color || '#0f6e70';
  livre.addEventListener('change', function () { arGravarCor(c, livre.value.toLowerCase()); });
  cores.appendChild(livre);
  pop.appendChild(cores);
  document.body.appendChild(pop);
  var r = ancora.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8)) + 'px';
  pop.style.top = (r.bottom + 6 + pop.offsetHeight > window.innerHeight ? r.top - pop.offsetHeight - 6 : r.bottom + 6) + 'px';
  setTimeout(function () {
    document.addEventListener('click', function fora(ev) {
      if (pop.contains(ev.target)) return;
      document.removeEventListener('click', fora);
      pop.remove();
    });
  }, 0);
}

/* O CSS entra ao carregar, nao so quando se abre o ecra das Areas: e dele que
   o Hoje precisa para as cores. */
arEstilo();

/* Os pedidos nao esperam por este ficheiro: se o /api/gestao chegou antes de
   o renderGestao estar embrulhado, o Hoje ficou desenhado sem cores e nada o
   voltava a desenhar. Espera-se pelas cores e desenha-se outra vez. */
(function arHojeComCores(tentativa) {
  tentativa = tentativa || 0;
  var pronto = window.G && G.contextos && G.contextos.length && window.D && D.attention;
  if (!pronto) { if (tentativa < 50) setTimeout(function () { arHojeComCores(tentativa + 1); }, 300); return; }
  var temCor = G.contextos.some(function (c) { return c.color; });
  var semTinta = !document.querySelector('#attnList article.ar-tinta');
  if (temCor && semTinta && typeof renderHoje === 'function') {
    try { renderHoje(); } catch (e) { console.error('[farol] hoje com cores', e); }
  }
})();
