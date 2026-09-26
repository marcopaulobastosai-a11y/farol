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

var IB = { itens: [], porTriar: 0, porAprovar: 0, estado: 'por_triar', triando: null, montado: false, carregado: false };

var IB_CSS = "#view-inbox .ib-drop{display:flex;align-items:center;gap:.75rem;padding:1.25rem;border:1px dashed var(--line);border-radius:var(--radius);background:var(--surface-2);cursor:pointer;transition:border-color .15s,background .15s}\n#view-inbox .ib-drop:hover,#view-inbox .ib-drop.is-over{border-color:var(--accent);background:var(--accent-soft)}\n#view-inbox .ib-drop input[type=file]{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}\n#view-inbox .ib-dropi{flex:0 0 auto;width:34px;height:34px;border-radius:8px;background:var(--surface);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--accent);font-family:var(--mono);font-size:1rem}\n#view-inbox .ib-dropt{font-weight:500;color:var(--ink-2)}\n#view-inbox .ib-drops{font-size:.8125rem;color:var(--muted);margin-top:.125rem}\n#view-inbox .ib-item{display:flex;gap:.875rem;padding:.9rem 0;border-top:1px solid var(--line-soft);align-items:flex-start}\n#view-inbox .ib-item:first-child{border-top:0;padding-top:.25rem}\n#view-inbox .ib-thumb{flex:0 0 52px;width:52px;height:52px;border-radius:8px;border:1px solid var(--line);background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:var(--fs-mono);color:var(--faint);text-transform:uppercase;overflow:hidden}\n#view-inbox .ib-thumb img{width:100%;height:100%;object-fit:cover;display:block}\n#view-inbox .ib-body{flex:1 1 auto;min-width:0}\n#view-inbox .ib-title{font-weight:500;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n#view-inbox .ib-meta{font-size:.8125rem;color:var(--muted);margin-top:.15rem}\n#view-inbox .ib-note{font-size:.875rem;color:var(--ink-2);margin:.4rem 0 0}\n#view-inbox .ib-acts{display:flex;gap:.375rem;flex-wrap:wrap;margin-top:.55rem}\n#view-inbox .ib-dest{border:1px solid var(--line);border-radius:var(--radius);padding:.55rem .8rem;margin-bottom:.35rem;background:var(--surface)}\n#view-inbox .ib-dest.is-on{border-color:var(--accent);background:var(--accent-soft)}\n#view-inbox .ib-desth{display:flex;align-items:center;gap:.5rem;font-weight:500;cursor:pointer;color:var(--ink)}\n#view-inbox .ib-destc{margin-top:.75rem}\n#view-inbox .ib-alvo{font-family:var(--mono);font-size:var(--fs-mono);color:var(--accent-ink);background:var(--accent-soft);border-radius:6px;padding:.3rem .5rem;display:inline-block;margin:.1rem 0 .7rem}\n#view-inbox .ib-empty{padding:2.25rem 1rem;text-align:center;color:var(--muted);font-size:.9375rem}\n#view-inbox .ib-drop{padding:1.4rem 1.25rem;border-radius:12px;border-width:1.5px;gap:1rem}\n#view-inbox .ib-dropi{width:40px;height:40px;border-radius:10px;font-size:1.35rem;line-height:1}\n#view-inbox .ib-dropt{font-size:.9375rem;color:var(--ink)}\n#view-inbox .field{gap:6px;margin:1.1rem 0 0}\n#view-inbox input[type=text],#view-inbox input[type=number],#view-inbox input[type=date],#view-inbox input[type=time],#view-inbox select{font:inherit;font-size:.875rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:9px 11px;width:100%;min-width:0;transition:border-color .15s ease,box-shadow .15s ease}\n#view-inbox input::placeholder{color:var(--faint)}\n#view-inbox input:focus,#view-inbox select:focus{outline:0;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}\n#view-inbox .form-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem}\n#view-inbox .form-actions .btn{padding:8px 16px;font-size:.875rem}\n#view-inbox .tabs{margin:1.1rem 0}\n#view-inbox .ib-empty{padding:3rem 1rem}\n#view-inbox .ib-sug{display:flex;gap:.55rem;align-items:baseline;flex-wrap:wrap;border:1px solid var(--accent);background:var(--accent-soft);color:var(--ink-2);border-radius:10px;padding:.65rem .85rem;margin:.1rem 0 .9rem;font-size:.875rem}\n#view-inbox .ib-sugt{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--accent-ink)}\n#view-inbox .ib-conf{margin-left:auto;font-family:var(--mono);font-size:var(--fs-mono);text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}\n#view-inbox .ib-conf.alta{color:var(--good)}\n#view-inbox .ib-ia{font-size:.8125rem;color:var(--muted);margin-top:.2rem}\n#view-inbox .ib-ia.pronta{color:var(--accent-ink)}\n#view-inbox .ib-ia.falhou{color:var(--bad)}\n#view-inbox .ib-ia .btn{margin-left:.5rem;padding:2px 9px;font-size:.75rem;vertical-align:1px}";

var IB_DESTINOS = [
  { tipo: 'tarefa', nome: 'Tarefa', campos: [
    { k: 'title', l: 'O que é preciso fazer', tipo: 'text' },
    { k: 'due_on', l: 'Prazo', tipo: 'date' },
    { k: 'owner_id', l: 'Quem faz', tipo: 'pessoa' },
    { k: 'project_id', l: 'Projeto', tipo: 'projeto' }
  ] },
  { tipo: 'pagamento', nome: 'Pagamento', campos: [
    { k: 'title', l: 'O que se paga', tipo: 'text' },
    { k: 'amount', l: 'Valor (\u20ac)', tipo: 'number' },
    { k: 'due_on', l: 'Até quando', tipo: 'date' },
    { k: 'payee', l: 'A quem', tipo: 'text' },
    { k: 'payment_ref', l: 'IBAN ou referência', tipo: 'text' },
    { k: 'context_id', l: 'Área', tipo: 'area' },
    { k: 'owner_id', l: 'Quem paga', tipo: 'pessoa' }
  ] },
  { tipo: 'evento', nome: 'Evento na Agenda', campos: [
    { k: 'title', l: 'Título', tipo: 'text' },
    { k: 'day', l: 'Dia', tipo: 'date' },
    { k: 'at', l: 'Hora', tipo: 'time' },
    { k: 'person_id', l: 'De quem', tipo: 'pessoa' }
  ] },
  { tipo: 'documento', nome: 'Documento', campos: [
    { k: 'name', l: 'Nome', tipo: 'text' },
    { k: 'entity', l: 'Entidade', tipo: 'text' },
    { k: 'issued_on', l: 'Data do documento', tipo: 'date' },
    { k: 'valid_on', l: 'Válido até', tipo: 'date' },
    { k: 'person_id', l: 'De quem', tipo: 'pessoa' },
    { k: 'context_id', l: 'Área', tipo: 'area' }
  ] },
  { tipo: 'despesa', nome: 'Despesa', campos: [
    { k: 'description', l: 'Descrição', tipo: 'text' },
    { k: 'amount', l: 'Valor (\u20ac)', tipo: 'number' },
    { k: 'spent_on', l: 'Data', tipo: 'date' },
    { k: 'merchant', l: 'Onde', tipo: 'text' },
    { k: 'context_id', l: 'Área', tipo: 'area' }
  ] }
];

/* A caixa e uma fila de trabalho: o que ja foi aprovado sai daqui e passa a
   viver nos Documentos, nas Despesas, nas Tarefas e na Agenda. */
var IB_TABS = [['por_triar', 'Por triar'], ['catalogado', 'Por aprovar'], ['arrumado', 'Arrumados'],
  ['descartado', 'Descartados']];

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
/* A pessoa do ficheiro: uma linha no cartao e a janela de escolha. */
var IB_CSS_PESSOA = 
  '#view-inbox .ib-dono{display:inline-flex;align-items:center;gap:.4rem;margin-top:.35rem;font-size:.8125rem;color:var(--ink)}' +
  '#view-inbox .ib-dono .ib-av{width:20px;height:20px;font-size:.625rem}' +
  '.ib-av{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;color:#fff;font-size:.75rem;font-weight:600;letter-spacing:.02em;flex:none}' +
  '.ib-dlg{border:none;border-radius:14px;padding:0;max-width:26rem;width:calc(100% - 2rem);box-shadow:0 18px 48px rgba(15,23,32,.22)}' +
  '.ib-dlg::backdrop{background:rgba(15,23,32,.38)}' +
  '.ib-dlgc{background:var(--surface);padding:1.25rem;border-radius:14px}' +
  '.ib-dlgc h3{margin:0 0 .25rem;font-size:1.0625rem}' +
  '.ib-dlgc p{margin:0 0 .9rem;font-size:.8125rem;color:var(--muted)}' +
  '.ib-pessoas{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}' +
  '.ib-pessoa{display:flex;align-items:center;gap:.55rem;padding:.5rem .6rem;border:1px solid var(--line);border-radius:10px;background:var(--ground);cursor:pointer;font:inherit;font-size:.875rem;text-align:left}' +
  '.ib-pessoa:hover{border-color:var(--accent)}' +
  '.ib-pessoa.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}' +
  '.ib-dlga{display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem}' +
  /* Catalogar e corrigir sao formularios, nao uma escolha rapida: precisam
     de mais largura e de poder rolar quando o ecra e baixo. */
  '.ib-dlg.larga{max-width:46rem}' +
  '.ib-dlg.larga .card{border:none;box-shadow:none;margin:0;max-height:82vh;overflow:auto}';

function ibEstilo() {
  if (document.getElementById('ibCss')) return;
  var s = document.createElement('style');
  s.id = 'ibCss';
  s.textContent = IB_CSS + IB_CSS_PESSOA;
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

/* Um tabuleiro de entrada. 16x16, traco de 1.6, como os outros do menu. */
function ibIcone() {
  var caixa = document.createElement('span');
  caixa.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"' +
    ' stroke="currentColor" stroke-width="1.6" stroke-linecap="round"' +
    ' stroke-linejoin="round"><path d="M4 13l2.2-7.4A1 1 0 0 1 7.2 5h9.6a1 1 0 0 1 1 .6L20 13"/>' +
    '<path d="M4 13h4.5l1.2 2h4.6l1.2-2H20v4.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/></svg>';
  return caixa.firstChild;
}

function ibMontar() {
  if (IB.montado) return;
  ibEstilo();

  if (window.TITLES) TITLES.inbox = ['Caixa de entrada', 'Guardar agora, decidir depois'];

  var nav = $('nav');
  if (nav && !nav.querySelector('[data-view="inbox"]')) {
    var b = el('button', null, 'Caixa de entrada');
    b.dataset.view = 'inbox';
    /* Os botoes do menu que vem do index.html trazem um icone; os que sao
       criados por um modulo tem de trazer o seu, senao ficam a flutuar. */
    b.insertBefore(ibIcone(), b.firstChild);
    /* Duas bolhas, duas perguntas diferentes: quantos papeis ninguem leu
       ainda, e quantos ja estao lidos a espera de uma decisao. */
    var badge = el('span', 'badge');
    badge.id = 'badgeInbox';
    badge.title = 'Por triar';
    b.appendChild(badge);
    var badge2 = el('span', 'badge aprovar');
    badge2.id = 'badgeInboxAprovar';
    badge2.title = 'Catalogados, a espera de aprovacao';
    b.appendChild(badge2);
    /* Entra depois dos Projetos, que sao o vizinho das Tarefas; se ainda nao
       estiverem no menu, entra logo a seguir as Tarefas. */
    var alvo = nav.querySelector('[data-view="projetos"]') || nav.querySelector('[data-view="tarefas"]');
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
  dtxt.appendChild(el('div', 'ib-drops', 'Fotografias, PDF, documentos — até 25 MB'));
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
  nota.placeholder = 'Ex.: talão da máquina de lavar, garantia 2 anos';
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
  /* Filtros por data: o que entrou nos ultimos dias, ou num mes e ano. */
  var filtros = el('div', 'ib-filtros');
  filtros.id = 'ibFiltros';
  caixa.appendChild(filtros);
  var lista = el('div');
  lista.id = 'ibLista';
  caixa.appendChild(lista);
  sec.appendChild(caixa);

  /* Catalogar deixou de acontecer no meio da pagina: abre em janela, como
     tudo o resto que pede para preencher campos. */
  var janela = el('dialog', 'ib-dlg larga');
  janela.id = 'ibTriagemJanela';
  var painel = el('div', 'card');
  painel.id = 'ibTriagem';
  janela.appendChild(painel);
  janela.addEventListener('cancel', function () { setTimeout(ibFecharTriagem, 0); });
  sec.appendChild(janela);

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
    IB.porAprovar = d.porAprovar || 0;
    IB.carregado = true;
    ibRender();
  }).catch(function () { toast('Não foi possível ler a caixa de entrada.'); });
}

function ibNumeros() {
  var badge = $('badgeInbox');
  if (badge) {
    badge.textContent = IB.porTriar || '';
    badge.hidden = !IB.porTriar;
  }
  var badge2 = $('badgeInboxAprovar');
  if (badge2) {
    badge2.textContent = IB.porAprovar || '';
    badge2.hidden = !IB.porAprovar;
  }
}

function ibRender() {
  ibNumeros();

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
  ibDesenharFiltros();

  var visiveis = IB.itens.filter(ibNoPeriodo);
  if (cab && ibFiltroActivo()) {
    cab.textContent = visiveis.length + ' de ' + IB.itens.length +
      (IB.itens.length === 1 ? ' item' : ' itens');
  }
  if (IB.itens.length && !visiveis.length) {
    lista.appendChild(el('div', 'ib-empty', 'Nada neste per\u00edodo.'));
    return;
  }

  if (!IB.itens.length) {
    lista.appendChild(el('div', 'ib-empty', IB.estado === 'por_triar'
      ? 'Nada por triar. A caixa está limpa.'
      : (IB.estado === 'catalogado'
        ? 'Nada à espera de aprovação. O que já foi aprovado está em Arrumados.'
        : (IB.estado === 'arrumado'
          ? 'Ainda nada arrumado.'
          : 'Nada aqui.'))));
    return;
  }
  visiveis.forEach(function (item) { lista.appendChild(ibItem(item)); });
}

/* ---------------- filtros por data ---------------- */
/* Os filtros valem para todos os separadores e ficam quando se muda de um
   para outro: quem procura «o que entrou em agosto» quer ve-lo em todos. */
var IB_MESES = ['Janeiro', 'Fevereiro', 'Mar\u00e7o', 'Abril', 'Maio', 'Junho', 'Julho',
  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
var IB_PERIODOS = [[0, 'Tudo'], [1, 'Hoje'], [7, '7 dias'], [30, '30 dias'], [90, '3 meses']];

function ibFiltro() {
  if (!IB.filtro) IB.filtro = { dias: 0, mes: '', ano: '', q: '' };
  return IB.filtro;
}

function ibFiltroActivo() {
  var f = ibFiltro();
  return Boolean(f.dias || f.mes || f.ano || f.q);
}

/* O texto onde a pesquisa procura: o nome do cartao, o do ficheiro, a nota e
   o que ficou gravado em cada coisa (nome, entidade, a quem se paga, valor). */
function ibTextoDe(item) {
  var partes = [item.title, item.file_name, item.note];
  (item.links || []).forEach(function (l) {
    var x = l.dados || {};
    partes.push(l.tipo, x.name, x.title, x.description, x.entity, x.payee, x.merchant, x.payment_ref);
    if (x.amount !== null && x.amount !== undefined) {
      partes.push(String(x.amount), Number(x.amount).toFixed(2).replace('.', ','));
    }
  });
  return ibSimples(partes.filter(Boolean).join(' '));
}

function ibHojeIso() {
  var d = new Date();
  var z = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}

function ibNoPeriodo(item) {
  var f = ibFiltro();
  var d = String(item.captured_at || '');
  if (!ibFiltroActivo()) return true;
  if (f.q) {
    var texto = ibTextoDe(item);
    var palavras = ibSimples(f.q).split(/\s+/).filter(Boolean);
    if (!palavras.every(function (w) { return texto.indexOf(w) >= 0; })) return false;
    if (!f.dias && !f.mes && !f.ano) return true;
  }
  if (!d) return false;
  if (f.dias === 1) return d.slice(0, 10) === ibHojeIso();
  if (f.dias) {
    var limite = new Date(); limite.setHours(0, 0, 0, 0);
    limite.setDate(limite.getDate() - (f.dias - 1));
    if (new Date(d.slice(0, 10) + 'T00:00:00') < limite) return false;
  }
  if (f.ano && d.slice(0, 4) !== f.ano) return false;
  if (f.mes && d.slice(5, 7) !== f.mes) return false;
  return true;
}

function ibDesenharFiltros() {
  var caixa = $('ibFiltros');
  if (!caixa) return;
  if (!$('ibFiltrosCss')) {
    var st = document.createElement('style');
    st.id = 'ibFiltrosCss';
    st.textContent = '#view-inbox .ib-filtros{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:.1rem 0 .9rem}' +
      '#view-inbox .ib-per{display:flex;gap:2px;background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:2px}' +
      '#view-inbox .ib-per button{font:inherit;font-size:.8125rem;border:0;background:none;color:var(--muted);padding:5px 10px;border-radius:6px;cursor:pointer}' +
      '#view-inbox .ib-per button.is-on{background:var(--surface);color:var(--ink);box-shadow:0 0 0 1px var(--line)}' +
      '#view-inbox .ib-filtros select{width:auto;font-size:.8125rem;padding:6px 9px}' +
      '#view-inbox #ibProcura{font:inherit;font-size:.8125rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:7px 10px;flex:1 1 220px;min-width:0}' +
      '#view-inbox #ibFiltrosResto{margin:0}' +
      '#view-inbox .ib-limpar{font-size:.8125rem;color:var(--accent-ink);background:none;border:0;cursor:pointer;text-decoration:underline;padding:0 .25rem}';
    document.head.appendChild(st);
  }
  var f = ibFiltro();
  /* A caixa de pesquisa nasce uma vez so: redesenha-la a cada tecla tirava-lhe
     o foco a meio da palavra. O resto dos filtros redesenha-se a vontade. */
  var procura = $('ibProcura');
  if (!procura) {
    clear(caixa);
    procura = el('input');
    procura.id = 'ibProcura';
    procura.type = 'search';
    procura.placeholder = 'Procurar: nome, entidade, valor\u2026';
    procura.setAttribute('aria-label', 'Procurar na caixa');
    procura.addEventListener('input', function () { f.q = procura.value; ibRender(); });
    caixa.appendChild(procura);
    var resto0 = el('span', 'ib-filtros');
    resto0.id = 'ibFiltrosResto';
    caixa.appendChild(resto0);
  }
  if (procura.value !== f.q) procura.value = f.q;
  caixa = $('ibFiltrosResto');
  clear(caixa);

  var per = el('div', 'ib-per');
  IB_PERIODOS.forEach(function (p) {
    var b = el('button', f.dias === p[0] && !f.mes && !f.ano ? 'is-on' : null, p[1]);
    b.type = 'button';
    b.onclick = function () { f.dias = p[0]; f.mes = ''; f.ano = ''; ibRender(); };
    per.appendChild(b);
  });
  caixa.appendChild(per);

  /* Mes e ano sao outra maneira de perguntar: escolher um deles larga os
     «ultimos dias». */
  var mes = el('select');
  mes.setAttribute('aria-label', 'M\u00eas');
  mes.appendChild(new Option('Todos os meses', ''));
  IB_MESES.forEach(function (m, i) {
    var v = (i < 9 ? '0' : '') + (i + 1);
    mes.appendChild(new Option(m, v));
  });
  mes.value = f.mes;
  mes.onchange = function () { f.mes = mes.value; f.dias = 0; ibRender(); };
  caixa.appendChild(mes);

  var anos = {};
  anos[String(new Date().getFullYear())] = true;
  (IB.itens || []).forEach(function (i) { if (i.captured_at) anos[String(i.captured_at).slice(0, 4)] = true; });
  if (f.ano) anos[f.ano] = true;
  var ano = el('select');
  ano.setAttribute('aria-label', 'Ano');
  ano.appendChild(new Option('Todos os anos', ''));
  Object.keys(anos).sort().reverse().forEach(function (a) { ano.appendChild(new Option(a, a)); });
  ano.value = f.ano;
  ano.onchange = function () { f.ano = ano.value; f.dias = 0; ibRender(); };
  caixa.appendChild(ano);

  if (ibFiltroActivo()) {
    var limpar = el('button', 'ib-limpar', 'Limpar');
    limpar.type = 'button';
    limpar.onclick = function () { f.dias = 0; f.mes = ''; f.ano = ''; f.q = ''; ibRender(); };
    caixa.appendChild(limpar);
  }
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
  /* O nome do ficheiro tal como vem do telemovel nao e um titulo:
     ibNomeBonito tira a extensao, os underscores e a cauda de numeros. */
  var titulo = ibNomeBonito(item) || 'Sem nome';
  if (titulo.length > 80) titulo = titulo.slice(0, 80) + '…';
  body.appendChild(el('div', 'ib-title', titulo));
  body.appendChild(el('div', 'ib-meta',
    [ibQuando(item.captured_at), ibTamanho(item.byte_size)].filter(Boolean).join('  -  ')));

  /* Estado da leitura automatica, se estiver ligada. */
  if (item.ai_status === 'pendente') {
    body.appendChild(el('div', 'ib-ia', 'a ler o ficheiro\u2026'));
  } else if (item.ai_status === 'feito' && !item.approved_at) {
    /* Nos arrumados a proposta ja nao interessa: vale o que ficou gravado. */
    var jx = ibProposta(item);
    var lida = el('div', 'ib-ia' + (jx ? ' pronta' : ''),
      jx ? 'sugest\u00e3o pronta: ' + jx.destinos.map(function (x) { return x.tipo; }).join(', ')
         : 'sem sugest\u00e3o');
    /* Uma leitura pobre (so o titulo, sem valor nem area) tambem merece outra
       oportunidade, nao so a que falhou. Se a nova vier boa, o item pode
       arrumar-se sozinho: o separador Arrumados mostra-o. */
    if (item.status === 'por_triar' && item.file_name) {
      var denovo = el('button', 'btn', 'Ler outra vez');
      denovo.type = 'button';
      denovo.onclick = function () { ibReanalisar(item.id); };
      lida.appendChild(denovo);
    }
    body.appendChild(lida);
  } else if (item.ai_status === 'falhou') {
    /* Dizer o que correu mal e melhor do que um «nao consegui»: o limite do
       dia do plano gratuito nao se resolve carregando outra vez. */
    var razao = item.ai_erro && item.ai_erro.indexOf('API ') !== 0
      ? item.ai_erro
      : 'n\u00e3o consegui ler o ficheiro';
    var linha = el('div', 'ib-ia falhou', razao);
    var outra = el('button', 'btn', 'Tentar outra vez');
    outra.type = 'button';
    outra.onclick = function () { ibReanalisar(item.id); };
    linha.appendChild(outra);
    body.appendChild(linha);
  }

  if (item.note && item.note !== titulo) body.appendChild(el('p', 'ib-note', item.note));

  if ((item.links && item.links.length) || (item.status === 'catalogado' && item.store === 'inbox')) {
    var chips = el('div', 'chips');
    (item.links || []).forEach(function (l) { chips.appendChild(pill(l.tipo, 'good')); });
    if (item.status === 'catalogado' && item.store === 'inbox') chips.appendChild(pill('por arquivar', 'warn'));
    if (item.status === 'catalogado') {
      chips.appendChild(item.approved_at
        ? pill('arrumado', 'good')
        : pill('por aprovar', 'warn'));
      if (!item.approved_at && ibSemEntidade(item)) chips.appendChild(pill('sem entidade', 'warn'));
    }
    body.appendChild(chips);
  }

  /* Nos arrumados diz-se para onde foi cada coisa e o que ficou gravado: e
     a resposta a «catalogou-se sozinho e nao sei onde esta». */
  if (item.status === 'catalogado') {
    (item.links || []).filter(function (l) { return l.dados; }).forEach(function (l) {
      body.appendChild(el('div', 'ib-ia pronta', ibResumoLink(l)));
    });
  }

  /* De quem e o papel. E a primeira coisa que se procura num ficheiro velho,
     por isso aparece no cartao e nao so na janela. */
  var dono = ibPessoaPorId(item.person_id);
  if (dono) {
    var ld = el('div', 'ib-dono');
    ld.appendChild(ibAvatar(dono));
    ld.appendChild(el('span', null, dono.name));
    body.appendChild(ld);
  }

  var acoes = el('div', 'ib-acts');
  if (item.file_name) {
    var ver = el('a', 'btn', 'Abrir');
    ver.href = '/api/inbox/' + item.id + '/ficheiro';
    ver.target = '_blank'; ver.rel = 'noopener';
    acoes.appendChild(ver);
  }
  /* Quando a leitura automatica nao acerta na pessoa, corrige-se aqui. */
  var quem = el('button', 'btn', dono ? 'Pessoa: ' + dono.name : 'Pessoa');
  quem.type = 'button';
  quem.onclick = function () { ibEscolherPessoa(item); };
  acoes.appendChild(quem);
  if (item.status === 'por_triar') {
    var triar = el('button', 'btn primary', 'Catalogar');
    triar.onclick = function () { ibAbrirTriagem(item); };
    acoes.appendChild(triar);
    var desc = el('button', 'btn', 'Descartar');
    desc.onclick = function () { ibEstado(item.id, 'descartado'); };
    acoes.appendChild(desc);
  } else if (item.status === 'catalogado' && !item.approved_at) {
    /* Um pagamento que nasce de uma fatura traz o documento dela: cada um
       tem o seu Editar, para nao ter de aprovar primeiro e corrigir depois. */
    var alvos = (item.links || []).filter(function (l) { return IB_EDITAVEIS.indexOf(l.tipo) >= 0; });
    alvos.forEach(function (alvo) {
      var ed = el('button', 'btn', alvos.length > 1 ? 'Editar ' + ibNomeCurto(alvo.tipo) : 'Editar');
      ed.type = 'button';
      ed.onclick = function () { ibEditarAlvo(item, alvo); };
      acoes.appendChild(ed);
    });
    var ok = el('button', 'btn primary', 'Aprovar');
    ok.type = 'button';
    ok.onclick = function () { ibAprovar(item.id); };
    acoes.appendChild(ok);
  } else if (item.status === 'catalogado' && item.approved_at) {
    (item.links || []).filter(function (l) { return IB_ROTAS[l.tipo] && l.dados; })
      .forEach(function (l) {
        var edl = el('button', 'btn', 'Editar ' + ibNomeCurto(l.tipo));
        edl.type = 'button';
        edl.onclick = function () { ibEditarAlvo(item, l); };
        acoes.appendChild(edl);
      });
    var rec = el('button', 'btn', 'Recatalogar');
    rec.type = 'button';
    rec.onclick = function () { ibRecatalogar(item); };
    acoes.appendChild(rec);
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
/* ---------------- proposta da IA ---------------- */
/* A proposta chega em ai_json e nunca e aplicada sozinha: marca os destinos,
   preenche os campos, e fica a espera que alguem carregue em Catalogar. */
function ibProposta(item) {
  if (!item || !item.ai_json) return null;
  var j = item.ai_json;
  if (typeof j === 'string') { try { j = JSON.parse(j); } catch (e) { return null; } }
  if (!j || !j.destinos || !j.destinos.length) return null;
  return j;
}

function ibPorTipo(item) {
  var j = ibProposta(item);
  var mapa = {};
  if (j) j.destinos.forEach(function (x) { if (x && x.tipo && !mapa[x.tipo]) mapa[x.tipo] = x; });
  return mapa;
}

function ibPessoaPorId(id) {
  if (!id || typeof G === 'undefined' || !G.people) return null;
  for (var i = 0; i < G.people.length; i++) if (G.people[i].id === id) return G.people[i];
  return null;
}

function ibAvatar(p) {
  var a = el('span', 'ib-av', p.initials || String(p.name || '?').slice(0, 1));
  a.style.background = p.color || 'var(--c1)';
  return a;
}

/* A janela de escolher de quem e o ficheiro. Oito pessoas cabem num relance:
   nao vale a pena uma lista pendente para isto. */
function ibEscolherPessoa(item) {
  var dlg = el('dialog', 'ib-dlg');
  var cx = el('div', 'ib-dlgc');
  cx.appendChild(el('h3', null, 'De quem \u00e9 este ficheiro' + String.fromCharCode(63)));
  cx.appendChild(el('p', null, 'Fica no t\u00edtulo e arruma tamb\u00e9m o que j\u00e1 nasceu deste ficheiro.'));
  var lista = el('div', 'ib-pessoas');
  ((typeof G !== 'undefined' && G.people) || []).forEach(function (p) {
    var b = el('button', 'ib-pessoa' + (item.person_id === p.id ? ' on' : ''));
    b.type = 'button';
    b.appendChild(ibAvatar(p));
    b.appendChild(el('span', null, p.name));
    b.onclick = function () { ibGravarPessoa(item.id, p.id, dlg); };
    lista.appendChild(b);
  });
  cx.appendChild(lista);
  var pe = el('div', 'ib-dlga');
  var nada = el('button', 'btn', 'Ningu\u00e9m');
  nada.type = 'button';
  nada.onclick = function () { ibGravarPessoa(item.id, null, dlg); };
  var fecha = el('button', 'btn', 'Fechar');
  fecha.type = 'button';
  fecha.onclick = function () { dlg.close(); dlg.remove(); };
  pe.appendChild(nada); pe.appendChild(fecha);
  cx.appendChild(pe);
  dlg.appendChild(cx);
  /* O evento close nao chega a disparar em todo o lado; a janela sai a mao. */
  dlg.addEventListener('cancel', function () { setTimeout(function () { dlg.remove(); }, 0); });
  document.body.appendChild(dlg);
  dlg.showModal();
}

function ibGravarPessoa(id, pid, dlg) {
  apiGestao('/api/inbox/' + id + '/pessoa?estado=' + IB.estado, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person_id: pid })
  }).then(function (d) {
    IB.itens = d.itens || []; IB.porTriar = d.porTriar || 0; IB.porAprovar = d.porAprovar || 0; ibRender();
    if (dlg) { dlg.close(); dlg.remove(); }
    if (typeof loadGestao === 'function') loadGestao();
    if (typeof load === 'function') load();
  }).catch(function (e) { toast(e.message || 'N\u00e3o foi poss\u00edvel gravar.'); });
}

/* O modelo devolve um nome; aqui procura-se a pessoa correspondente. */
function ibPessoaPorNome(nome) {
  if (!nome || typeof G === 'undefined' || !G.people) return null;
  var alvo = String(nome).trim().toLowerCase();
  if (alvo.length < 3) return null;
  for (var i = 0; i < G.people.length; i++) {
    var p = G.people[i];
    var n = String(p.name || '').toLowerCase();
    var c = String(p.full_name || '').toLowerCase();
    if (n === alvo || c === alvo || c.indexOf(alvo) >= 0 || alvo.indexOf(n) >= 0) return p.id;
  }
  return null;
}

/* Os campos dos cinco destinos falam da mesma coisa com nomes diferentes: o
   titulo da tarefa e o nome do documento e a descricao da despesa. Aqui cada
   campo aponta para um valor comum, para que mudar de destino na triagem nao
   deite fora o que ja estava escrito - nem o que a IA leu. */
var IB_COMUM = {
  tarefa: { title: 'titulo', due_on: 'prazo', owner_id: 'pessoa', project_id: 'projeto' },
  pagamento: { title: 'titulo', amount: 'valor', due_on: 'prazo', payee: 'entidade',
    payment_ref: 'ref', context_id: 'area', owner_id: 'pessoa' },
  evento: { title: 'titulo', day: 'dia', at: 'hora', person_id: 'pessoa' },
  documento: { name: 'titulo', entity: 'entidade', issued_on: 'data', valid_on: 'validade',
    person_id: 'pessoa', context_id: 'area' },
  despesa: { description: 'titulo', amount: 'valor', spent_on: 'data', merchant: 'entidade',
    context_id: 'area' }
};
/* Quando o destino nao tem o seu proprio valor, vai buscar o mais parecido:
   o vencimento de uma fatura e o dia do evento sao a mesma data. */
var IB_PERTO = { prazo: ['validade', 'dia'], dia: ['prazo', 'validade', 'data'], data: ['dia'] };

function ibDataCurta(v) {
  var m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v || ''));
  return m ? m[1] : '';
}

/* O que a IA leu, junto num sitio so. Vale o primeiro destino proposto; os
   outros so preenchem o que ele deixou vazio. */
/* A semente e o que estava gravado antes de recatalogar: vale mais do que a
   leitura da IA, porque pode ter sido corrigido a mao. */
function ibValoresIniciais(item, semente) {
  var v = {};
  var pos = function (k, x) {
    if (x === null || x === undefined || x === '') return;
    if (v[k] === undefined || v[k] === '') v[k] = String(x);
  };
  var j = ibProposta(item);
  (semente || []).concat(j ? j.destinos : []).forEach(function (d) {
    var x = (d && d.dados) || {};
    pos('titulo', x.name || x.title || x.description);
    if (x.amount !== null && x.amount !== undefined && x.amount !== '') {
      var n = Number(String(x.amount).replace(/\s/g, '').replace(',', '.'));
      if (!isNaN(n)) pos('valor', n);
    }
    pos('prazo', ibDataCurta(x.due_on));
    pos('dia', ibDataCurta(x.day));
    pos('hora', x.at);
    pos('data', ibDataCurta(x.spent_on) || ibDataCurta(x.issued_on));
    pos('validade', ibDataCurta(x.valid_on));
    pos('entidade', x.payee || x.entity || x.merchant);
    pos('ref', x.payment_ref);
    if (x.pessoa) pos('pessoa', ibPessoaPorNome(x.pessoa));
    if (x.area) pos('area', ibContextoPorNome(x.area));
    pos('area', x.context_id);
    pos('pessoa', x.owner_id || x.person_id);
    pos('projeto', x.project_id);
  });
  pos('titulo', ibNomeBonito(item));
  pos('pessoa', item.person_id);
  return v;
}

/* Os valores de um destino, tirados do conjunto comum. */
function ibValoresDe(tipo) {
  var mapa = IB_COMUM[tipo] || {};
  var out = {};
  Object.keys(mapa).forEach(function (k) {
    var c = mapa[k];
    var x = IB.val[c];
    if (x === undefined || x === '') {
      (IB_PERTO[c] || []).some(function (o) {
        if (IB.val[o] !== undefined && IB.val[o] !== '') { x = IB.val[o]; return true; }
        return false;
      });
    }
    out[k] = x === undefined ? '' : x;
  });
  return out;
}

function ibAbrirTriagem(item, semente) {
  IB.triando = item;
  IB.prop = ibPorTipo(item);
  IB.val = ibValoresIniciais(item, semente);
  var j0 = ibProposta(item);
  var primeiro = (semente && semente[0]) || (j0 && j0.destinos[0]);
  IB.escolhido = primeiro && IB_COMUM[primeiro.tipo] ? primeiro.tipo : null;
  if (typeof gState !== 'undefined' && !gState.loaded && typeof loadGestao === 'function') {
    loadGestao().then(function () { ibDesenharTriagem(); });
  }
  ibDesenharTriagem();
  var j = $('ibTriagemJanela');
  if (j && !j.open) j.showModal();
}

/* O evento close do <dialog> nao e de confianca aqui: fecha-se a mao. */
function ibFecharTriagem() {
  IB.triando = null;
  var j = $('ibTriagemJanela');
  if (j && j.open) { try { j.close(); } catch (e) { /* ja estava fechada */ } }
  var p = $('ibTriagem');
  if (p) clear(p);
}

function ibDesenharTriagem() {
  var p = $('ibTriagem');
  if (!p || !IB.triando) return;
  clear(p);

  ibCabecalho(p, 'No que e que isto se transforma?', null);
  p.appendChild(el('div', 'ib-alvo', IB.triando.file_name || ibNomeBonito(IB.triando) || 'Nota sem ficheiro'));
  p.appendChild(el('p', 'ib-note', 'Escolhe o que isto \u00e9. Se mudares de ideias, o que j\u00e1 est\u00e1 escrito vem contigo.'));

  var jp = ibProposta(IB.triando);
  if (jp) {
    var sug0 = el('div', 'ib-sug');
    sug0.appendChild(el('span', 'ib-sugt', 'Sugest\u00e3o'));
    sug0.appendChild(el('span', null, jp.resumo || 'Li o ficheiro e marquei o que me pareceu.'));
    p.appendChild(sug0);
  }

  var blocos = {};
  var mostrar = function (tipo) {
    IB.escolhido = tipo;
    IB_DESTINOS.forEach(function (d) {
      var b = blocos[d.tipo];
      var on = d.tipo === tipo;
      b.cx.checked = on;
      b.bloco.classList.toggle('is-on', on);
      clear(b.campos);
      b.campos.hidden = !on;
      if (!on) return;
      /* Os campos nascem de novo a cada escolha, a partir do que ja se sabe. */
      var valores = ibValoresDe(d.tipo);
      var par = null;
      d.campos.forEach(function (c, i) {
        if (i % 2 === 0) { par = el('div', 'field-row'); b.campos.appendChild(par); }
        var f = ibCampo(d.tipo, c, valores);
        var inp = f.querySelector('input, select');
        var comum = (IB_COMUM[d.tipo] || {})[c.k];
        if (inp && comum) {
          var guardar = function () { IB.val[comum] = inp.value === '-' ? '' : inp.value; };
          inp.addEventListener('input', guardar);
          inp.addEventListener('change', guardar);
        }
        par.appendChild(f);
      });
    });
  };

  IB_DESTINOS.forEach(function (d) {
    var bloco = el('div', 'ib-dest');
    var cab = el('label', 'ib-desth');
    var cx = el('input');
    cx.type = 'radio'; cx.name = 'ibDestino'; cx.id = 'ibUsar_' + d.tipo;
    cab.appendChild(cx);
    cab.appendChild(el('span', null, d.nome));
    bloco.appendChild(cab);
    var campos = el('div', 'ib-destc');
    campos.hidden = true;
    cx.onchange = function () { if (cx.checked) mostrar(d.tipo); };

    var sugd = IB.prop && IB.prop[d.tipo];
    if (sugd && sugd.confianca && d.tipo === IB.escolhido) {
      cab.appendChild(el('span', 'ib-conf' + (sugd.confianca === 'alta' ? ' alta' : ''), sugd.confianca));
    }
    bloco.appendChild(campos);
    p.appendChild(bloco);
    blocos[d.tipo] = { bloco: bloco, cx: cx, campos: campos };
  });
  if (IB.escolhido) mostrar(IB.escolhido);

  var acoes = el('div', 'form-actions');
  var ok = el('button', 'btn primary', 'Catalogar');
  ok.type = 'button';
  ok.onclick = ibSubmeterTriagem;
  var cancelar = el('button', 'btn', 'Cancelar');
  cancelar.type = 'button';
  cancelar.onclick = ibFecharTriagem;
  acoes.appendChild(ok); acoes.appendChild(cancelar);
  p.appendChild(acoes);
}

function ibCampo(tipo, c, valores, prefixo) {
  var w = el('label', 'field');
  w.appendChild(el('span', null, c.l));
  var input;
  if (c.tipo === 'area') {
    /* Mesma arrumacao que o resto da app: a area e o grupo, as sub-areas
       penduradas por baixo. Duas so, nunca mais fundo. */
    input = el('select');
    input.appendChild(new Option('\u2014 escolher \u00e1rea \u2014', ''));
    var ctx = (typeof G !== 'undefined' && G.contextos) ? G.contextos : [];
    ctx.filter(function (x) { return !x.parent_id && x.active; }).forEach(function (area) {
      var g = document.createElement('optgroup');
      g.label = area.name;
      g.appendChild(new Option(area.name, area.id));
      ctx.filter(function (x) { return x.parent_id === area.id && x.active; })
        .forEach(function (sub) { g.appendChild(new Option('   ' + sub.name, sub.id)); });
      input.appendChild(g);
    });
  } else if (c.tipo === 'pessoa' || c.tipo === 'projeto') {
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
  input.id = (prefixo || 'ibC_') + tipo + '_' + c.k;

  /* Primeiro o que a IA leu; so depois o nome do ficheiro. */
  var dados = valores || (IB.prop && IB.prop[tipo] && IB.prop[tipo].dados);
  var val = dados ? dados[c.k] : null;
  if ((val === null || val === undefined) && dados && c.tipo === 'pessoa' && dados.pessoa) {
    val = ibPessoaPorNome(dados.pessoa);
  }
  if ((val === null || val === undefined) && dados && c.tipo === 'area' && dados.area) {
    val = ibContextoPorNome(dados.area);
  }
  if (val !== null && val !== undefined && val !== '') {
    input.value = String(val);
  } else if (!valores && (c.k === 'title' || c.k === 'name' || c.k === 'description')) {
    var it = IB.triando;
    if (it) input.value = ibNomeBonito(it);
  }
  w.appendChild(input);
  return w;
}

/* A IA escreve a area como a leu na lista: «Casa > Quinta do Anjo». Aqui
   dentro isso e um numero. Vale o ultimo pedaco - a sub-area e mais precisa
   que a area - e so se nao houver e que se fica pelo primeiro. */
function ibSimples(s) {
  /* Acentos nao podem decidir onde se arruma um papel: a IA escreve Familia,
     a area chama-se Familia com acento, e sem isto nao se encontravam. */
  return String(s || '').normalize('NFD').split('')
    .filter(function (c) { var n = c.charCodeAt(0); return n < 768 || n > 879; })
    .join('').toLowerCase().trim();
}

function ibContextoPorNome(nome) {
  var ctx = (typeof G !== 'undefined' && G.contextos) ? G.contextos : [];
  if (!ctx.length || !nome) return null;
  var partes = String(nome).split('>').map(ibSimples).filter(Boolean);
  for (var i = partes.length - 1; i >= 0; i--) {
    for (var j = 0; j < ctx.length; j++) {
      if (ibSimples(ctx[j].name) === partes[i]) return ctx[j].id;
    }
  }
  return null;
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
  // Corta a cauda: numeros soltos ou horas do tipo 21h24m10s, que e o que
  // scanners e camaras colam ao nome do ficheiro.
  s = s.replace(/(\s+(\d{1,2}h\d{1,2}(m\d{1,2})?s?|\d{1,8}))+\s*$/i, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function ibSubmeterTriagem() {
  if (!IB.triando) return;
  var destinos = [];
  IB_DESTINOS.forEach(function (d) {
    var cx = $('ibUsar_' + d.tipo);
    if (!cx || !cx.checked || destinos.length) return;
    var dados = {};
    d.campos.forEach(function (c) {
      var v = ($('ibC_' + d.tipo + '_' + c.k) || {}).value;
      if (v !== undefined && v !== '' && v !== '-') dados[c.k] = v;
    });
    destinos.push({ tipo: d.tipo, dados: dados });
  });
  if (!destinos.length) { toast('Escolhe no que \u00e9 que isto se transforma.'); return; }

  var idTriado = IB.triando.id;
  var tituloNovo = ibTituloDe(destinos[0].dados);
  var tituloVelho = IB.triando.title;
  apiGestao('/api/inbox/' + idTriado + '/triagem?estado=' + IB.estado, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destinos: destinos })
  }).then(function (d) {
    /* O titulo muda depois de catalogar, e nao antes: se a triagem falhar, o
       item fica como estava. Se so o titulo falhar, a triagem ja esta feita e
       vale mais mostra-la do que esconde-la atras de um erro. */
    if (!tituloNovo || tituloNovo === tituloVelho) return d;
    return ibRenomear(idTriado, tituloNovo).then(function (d2) { return d2 || d; }, function () { return d; });
  }).then(function (d) {
    ibFecharTriagem();
    IB.itens = d.itens || []; IB.porTriar = d.porTriar || 0; IB.porAprovar = d.porAprovar || 0;
    ibRender();
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
      return ibCarregar().then(ibAcompanhar);
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
    IB.itens = d.itens || []; IB.porTriar = d.porTriar || 0; IB.porAprovar = d.porAprovar || 0; ibRender();
  }).catch(function (e) { toast(e.message || 'Não foi possível gravar.'); });
}

function ibApagar(id) {
  apiGestao('/api/inbox/' + id + '?estado=' + IB.estado, { method: 'DELETE' })
    .then(function (d) {
      IB.itens = d.itens || []; IB.porTriar = d.porTriar || 0; IB.porAprovar = d.porAprovar || 0; ibRender();
    }).catch(function (e) { toast(e.message || 'Não foi possível apagar.'); });
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
      ibFecharTriagem();
      ibCarregar();
    });
  }
}

/* A análise corre no servidor depois da resposta, e o que ela decidir muda a
   lista: o item ganha nome, ou sai daqui para Por aprovar. Em vez de obrigar
   a carregar em Actualizar, espreita-se algumas vezes e pára. */
/* O modelo enche-se a horas de ponta e devolve 503. O ficheiro continua no
   balde, por isso dar outra oportunidade n\u00e3o custa nada a quem o enviou. */
/* A entidade nao trava a catalogacao, mas vale a pena dizer que falta antes
   de alguem aprovar um papel sem saber quem o emitiu. */
function ibSemEntidade(item) {
  /* Depois de catalogado, quem manda e a linha gravada: o cartao dizia «sem
     entidade» para sempre porque continuava a ler a proposta da IA, mesmo
     depois de alguem ter escrito a entidade a mao. */
  var docs = (item.links || []).filter(function (l) { return l.tipo === 'documento'; });
  if (docs.length) {
    return docs.some(function (l) { return !((l.dados || {}).entity || '').trim(); });
  }
  var j = ibProposta(item);
  if (!j) return false;
  return j.destinos.some(function (d) {
    return d.tipo === 'documento' && !((d.dados || {}).entity || '').trim();
  });
}

/* Corrigir antes de aprovar. Os mesmos campos da catalogacao, desta vez
   preenchidos com o que esta gravado, numa janela - nao no meio da pagina. */
var IB_EDITAVEIS = ['documento', 'despesa', 'pagamento', 'tarefa', 'evento'];
var IB_ROTAS = { documento: '/api/documentos/', despesa: '/api/despesas/',
  pagamento: '/api/gestao/tarefas/', tarefa: '/api/gestao/tarefas/',
  evento: '/api/gestao/eventos/' };

/* Para os botoes: «Editar evento», e nao «Editar evento na agenda». */
function ibNomeCurto(tipo) {
  return tipo === 'evento' ? 'evento' : ibNomeDoTipo(tipo).toLowerCase();
}

function ibNomeDoTipo(tipo) {
  var d = IB_DESTINOS.filter(function (x) { return x.tipo === tipo; })[0];
  return d ? d.nome : tipo;
}

/* Uma linha por coisa que nasceu do ficheiro: o que e, como se chama, e os
   dois ou tres numeros que se procuram (quanto, ate quando, onde). */
function ibResumoLink(l) {
  var x = l.dados || {};
  var partes = [ibNomeDoTipo(l.tipo) + ':'];
  var nome = x.name || x.title || x.description;
  partes.push(nome || '(j\u00e1 n\u00e3o existe)');
  if (x.amount !== null && x.amount !== undefined && x.amount !== '') {
    partes.push('\u00b7 ' + Number(x.amount).toFixed(2).replace('.', ',') + ' \u20ac');
  }
  var data = x.due_on ? 'at\u00e9 ' + ibDataPt(x.due_on)
    : x.day ? ibDataPt(x.day) + (x.at ? ' ' + x.at : '')
    : x.spent_on ? ibDataPt(x.spent_on)
    : x.valid_on ? 'v\u00e1lido at\u00e9 ' + ibDataPt(x.valid_on)
    : x.issued_on ? ibDataPt(x.issued_on) : '';
  if (data) partes.push('\u00b7 ' + data);
  var ctx = (typeof G !== 'undefined' && G.contextos) ? G.contextos : [];
  var area = ctx.filter(function (c) { return c.id === x.context_id; })[0];
  if (area) partes.push('\u00b7 ' + area.name);
  if ((l.tipo === 'pagamento' || l.tipo === 'tarefa') && x.done) partes.push('\u00b7 feito');
  return partes.join(' ');
}

function ibDataPt(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || '');
}

/* Desfazer e voltar a catalogar. O ficheiro fica guardado; o que nasceu dele
   e apagado, e a janela de catalogar abre logo, com o que estava gravado. */
function ibRecatalogar(item) {
  var coisas = (item.links || []).map(function (l) { return ibResumoLink(l); }).join('\n');
  if (!window.confirm('Desfazer esta catalogação e catalogar outra vez?\n\nVai ser apagado:\n' +
      coisas + '\n\nO ficheiro continua guardado.')) return;
  var semente = (item.links || []).filter(function (l) { return l.dados; })
    .map(function (l) { return { tipo: l.tipo, dados: l.dados }; });
  apiGestao('/api/inbox/' + item.id + '/recatalogar?estado=por_triar', { method: 'POST' })
    .then(function (d) {
      IB.estado = 'por_triar';
      var bts = document.querySelectorAll('#view-inbox .tabs button[data-tab]');
      for (var i = 0; i < bts.length; i++) bts[i].classList.toggle('is-active', bts[i].dataset.tab === 'por_triar');
      IB.itens = d.itens || []; IB.porTriar = d.porTriar || 0; IB.porAprovar = d.porAprovar || 0;
      ibRender();
      if (typeof loadGestao === 'function') loadGestao();
      if (typeof load === 'function') load();
      var novo = IB.itens.filter(function (x) { return x.id === item.id; })[0];
      if (novo) ibAbrirTriagem(novo, semente);
    })
    .catch(function (e) { toast(e.message || 'N\u00e3o foi poss\u00edvel desfazer.'); });
}

function ibEditarAlvo(item, link) {
  var d = IB_DESTINOS.filter(function (x) { return x.tipo === link.tipo; })[0];
  if (!d) return;
  var valores = link.dados || {};

  var dlg = el('dialog', 'ib-dlg larga');
  var cx = el('div', 'card');
  ibCabecalho(cx, 'Corrigir ' + ({ documento: 'o documento', despesa: 'a despesa',
    pagamento: 'o pagamento', tarefa: 'a tarefa', evento: 'o evento' }[link.tipo] || ibNomeDoTipo(link.tipo)), null);
  cx.appendChild(el('p', 'ib-note', item.approved_at
    ? 'Muda j\u00e1 o que aparece nos ecr\u00e3s.'
    : 'O que ficar aqui e o que vai para os ecras quando aprovares.'));

  var par = null;
  d.campos.forEach(function (c, i) {
    if (i % 2 === 0) { par = el('div', 'field-row'); cx.appendChild(par); }
    par.appendChild(ibCampo(link.tipo, c, valores, 'ibE_'));
  });

  var acoes = el('div', 'form-actions');
  var gravar = el('button', 'btn primary', 'Gravar');
  gravar.type = 'button';
  gravar.onclick = function () { ibGravarAlvo(item, link, d, dlg); };
  var fechar = el('button', 'btn', 'Cancelar');
  fechar.type = 'button';
  fechar.onclick = function () { dlg.close(); dlg.remove(); };
  acoes.appendChild(gravar); acoes.appendChild(fechar);
  cx.appendChild(acoes);

  dlg.appendChild(cx);
  dlg.addEventListener('cancel', function () { setTimeout(function () { dlg.remove(); }, 0); });
  /* Dentro do ecra e nao no body: o estilo dos campos da caixa esta todo
     pendurado em #view-inbox, e uma janela no body sai de la sem roupa. */
  ($('view-inbox') || document.body).appendChild(dlg);
  dlg.showModal();
}

/* O nome que se ve no cartao da caixa e o titulo do item, e so a IA o
   escrevia. Quem corrige a descricao ao catalogar ou no Editar esta a dizer
   como a coisa se chama: o cartao passa a dizer o mesmo. */
function ibTituloDe(dados) {
  var t = dados && (dados.name || dados.title || dados.description);
  return t ? String(t).trim() : '';
}

function ibRenomear(id, titulo) {
  if (!titulo) return Promise.resolve();
  return apiGestao('/api/inbox/' + id + '?estado=' + IB.estado, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: titulo })
  });
}

function ibGravarAlvo(item, link, d, dlg) {
  var corpo = {};
  d.campos.forEach(function (c) {
    var campo = $('ibE_' + link.tipo + '_' + c.k);
    if (!campo) return;
    var v = campo.value.trim();
    /* A opcao vazia das listas de pessoas e projetos tem o valor «-». */
    corpo[c.k] = v === '' || v === '-' ? null : (c.tipo === 'number' ? Number(v) : v);
  });

  apiGestao(IB_ROTAS[link.tipo] + link.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  }).then(function () {
    var t = ibTituloDe(corpo);
    return t && t !== item.title ? ibRenomear(item.id, t) : null;
  }).then(function () {
    dlg.close(); dlg.remove();
    toast('Gravado.');
    return ibCarregar();
  }).catch(function (e) { toast(e.message || 'Nao foi possivel gravar.'); });
}

/* O passo que faltava: ate aqui e uma proposta da maquina, daqui para a
   frente e um documento da casa. */
function ibAprovar(id) {
  apiGestao('/api/inbox/' + id + '/aprovar?estado=' + IB.estado, { method: 'POST' })
    .then(function (d) {
      IB.itens = d.itens || [];
      IB.porTriar = d.porTriar || 0;
      IB.porAprovar = d.porAprovar || 0;
      ibRender();
      toast('Aprovado. Saiu da caixa e ja esta nos Documentos.');
      if (typeof load === 'function') load();
    })
    .catch(function (e) { toast(e.message || 'Nao foi possivel aprovar.'); });
}

function ibReanalisar(id) {
  apiGestao('/api/inbox/' + id + '/analisar?estado=' + IB.estado, { method: 'POST' })
    .then(function (d) {
      IB.itens = d.itens || [];
      IB.porTriar = d.porTriar || 0;
      IB.porAprovar = d.porAprovar || 0;
      ibRender();
      toast('A ler outra vez\u2026');
      ibAcompanhar();
    })
    .catch(function (e) { toast(e.message || 'N\u00e3o foi poss\u00edvel tentar outra vez.'); });
}

/* A leitura pode levar mais de um minuto: o modelo engasga-se, tenta outra
   vez, e ha esperas de 3, 12 e 25 segundos pelo meio. Espreitar oito vezes
   dava trinta segundos - o cartao acabava de ser lido depois de o ecra ter
   desistido, e ficava a dizer «a ler o ficheiro» para sempre. Agora espreita
   ate aos tres minutos, e quando desiste le a caixa uma ultima vez para nao
   deixar o ecra a mentir. */
function ibAcompanhar(tentativa) {
  var n = tentativa || 0;
  var antes = (IB.itens || []).filter(function (x) { return x.ai_status === 'pendente'; })
    .map(function (x) { return x.id; });
  if (!antes.length) return;
  if (n > 40) { ibCarregar(); return; }

  setTimeout(function () {
    ibCarregar().then(function () {
      var agora = (IB.itens || []).map(function (x) { return x.id; });
      var sumiu = antes.filter(function (id) { return agora.indexOf(id) < 0; });
      if (sumiu.length && IB.estado === 'por_triar') {
        toast(sumiu.length === 1
          ? 'Catalogado sozinho. Está em Por aprovar.'
          : sumiu.length + ' catalogados sozinhos. Estão em Por aprovar.');
      }
      ibAcompanhar(n + 1);
    }).catch(function () {});
  }, n < 3 ? 2500 : 5000);
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
      IB.porAprovar = d.porAprovar || 0;
      ibNumeros();
    }).catch(function () { /* sem sessao ainda */ });
    return;
  }
  setTimeout(esperarApp, 400);
})();
