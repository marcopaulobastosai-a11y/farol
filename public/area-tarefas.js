'use strict';
/* Farol - o que cada area tem por fazer.
 *
 * A regra do farol-organizacao.md: a coisa fica na area, o trabalho sobre a
 * coisa fica no projeto. Faltava a outra metade - a area mostrar o que e
 * dela. As tarefas soltas (sem projeto) sao a operacao corrente: o ordenado
 * da loja, a renda da casa, o IUC.
 *
 * Todos os ecras das areas sao agora iguais: a mesma barra de filtros e os
 * mesmos cinco widgets, pela ordem que o Marco escolheu.
 *
 *   linha 1: Tarefas        | Despesas      (abertos)
 *   linha 2: Pagamentos     | Documentos    (recolhidos)
 *   linha 3: Projetos                       (aberto)
 *
 * Cada widget recolhe-se pelo cabecalho e, recolhido, continua a dizer o
 * essencial - a contagem e o dinheiro. E o que faz valer a pena recolher:
 * perde-se o detalhe, nao se perde a informacao.
 *
 * Os tres filtros mandam no ecra inteiro - nos cinco widgets e nos numeros
 * do topo ao mesmo tempo:
 *   - Onde:   a sub-area (Tudo, Cupula Arejada, Falua Vibrante...);
 *   - Quem:   uma pessoa do agregado, e se conta como dono, por causa de
 *             quem, ou ambos;
 *   - Quando: em atraso, 7/30/90 dias, 12 meses, tudo, ou um mes e ano
 *             escolhidos a mao.
 * A escolha fica guardada por area, como ja acontecia com a sub-area.
 *
 * O que o periodo faz a cada widget:
 *   - tarefas e pagamentos: a data de entrega; o que nao tem data aparece
 *     sempre, porque nao tem data para cair fora;
 *   - despesas: o dia em que o dinheiro saiu;
 *   - documentos: a data do papel OU a validade - basta uma das duas;
 *   - projetos: nao sao cortados pelo periodo (duram meses); so o «em
 *     atraso» os filtra.
 *
 * Pagar a partir daqui abre a janela do pagamento aqui mesmo (tfPopPagar),
 * sem saltar para as Tarefas.
 *
 * Profissional e Patrimonio eram areas sem ecra: nascem aqui, com botao no
 * menu. Como os outros modulos, nao toca no app.js.
 */

var AE_AREAS = [
  { view: 'familia', nome: 'familia' },
  { view: 'casa', nome: 'casa' },
  { view: 'financas', nome: 'financas' },
  { view: 'saude', nome: 'saude' },
  { view: 'profissional', nome: 'profissional', novo: true, titulo: 'Profissional',
    sub: 'Operação corrente das empresas, do trabalho e do MBA',
    icone: '<rect x="3.5" y="7" width="17" height="12" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M3.5 12h17"/>' },
  { view: 'patrimonio', nome: 'patrimonio', novo: true, titulo: 'Património',
    sub: 'Bens que se gerem: imóveis, carro, terreno',
    icone: '<path d="M3 20h18"/><path d="M5 20V10l7-5 7 5v10"/><path d="M9 20v-5h6v5"/><path d="M12 9.5v.01"/>' }
];

var AE_CSS =
  '.ae{margin-bottom:14px}' +
  '.ae-filtros{padding:10px 14px;display:flex;flex-direction:column;gap:8px;margin-bottom:12px}' +
  '.ae-fl{display:flex;align-items:flex-start;gap:10px}' +
  '.ae-fl > .ae-lbl{flex:none;width:58px;padding-top:7px}' +
  '.ae-lbl{font-family:var(--mono);font-size:.625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}' +
  '.ae-chips{display:flex;flex-wrap:wrap;gap:6px;flex:1;min-width:0}' +
  '.ae-chip{border:1px solid var(--line);background:var(--surface);color:var(--ink-2);border-radius:99px;padding:4px 11px;font:inherit;font-size:.78rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;min-height:30px}' +
  '.ae-chip:hover{border-color:var(--accent);color:var(--accent-ink)}' +
  '.ae-chip.on{background:var(--accent);border-color:var(--accent);color:#fff}' +
  ':root[data-theme="dark"] .ae-chip.on,:root:not([data-theme="light"]) .ae-chip.on{color:#06181A}' +
  '.ae-chip i.dot{width:7px;height:7px;border-radius:50%;flex:none}' +
  '.ae-chip small{font-family:var(--mono);font-size:.68rem;opacity:.75}' +
  '.ae-chip small.bad{color:var(--bad);opacity:1}' +
  '.ae-chip.on small.bad{color:inherit}' +
  '.ae-seg{display:flex;gap:2px;background:var(--surface-2);border:1px solid var(--line);border-radius:99px;padding:2px;margin-right:4px}' +
  '.ae-seg button{border:0;background:none;font:inherit;font-size:.72rem;color:var(--muted);padding:3px 10px;border-radius:99px;cursor:pointer}' +
  '.ae-seg button.on{background:var(--surface);color:var(--ink);box-shadow:var(--shadow)}' +
  '.ae-seg.ae-off{opacity:.55}' +
  '.ae-kpis{display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap}' +
  '.ae-kpi{flex:1;min-width:150px;display:flex;flex-direction:column;gap:1px;align-items:flex-start;text-align:left;padding:10px 14px;border:1px solid var(--line);background:var(--surface);border-radius:var(--radius);cursor:pointer;font:inherit}' +
  '.ae-kpi:hover{border-color:var(--accent)}' +
  '.ae-kpi b{font-family:var(--mono);font-size:1.25rem;font-weight:500;line-height:1.15;font-variant-numeric:tabular-nums;color:var(--ink)}' +
  '.ae-kpi b.bad{color:var(--bad)}' +
  '.ae-kpi span{font-size:.75rem;color:var(--muted)}' +
  '.ae-w{overflow:hidden}' +
  '.ae-wh{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:0;background:none;padding:13px 16px;cursor:pointer;font:inherit;border-radius:var(--radius)}' +
  '.ae-wh:hover{background:var(--surface-2)}' +
  '.ae-wi{flex:none;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--surface-2);color:var(--ink-2)}' +
  '.ae-wi.tarefas,.ae-wi.projetos{background:var(--accent-soft);color:var(--accent-ink)}' +
  '.ae-wi.pagamentos{background:var(--warn-soft);color:var(--warn)}' +
  '.ae-wi.despesas{background:var(--good-soft);color:var(--good)}' +
  '.ae-wt{font-size:.9375rem;font-weight:600;color:var(--ink);letter-spacing:-.01em}' +
  '.ae-wn{font-family:var(--mono);font-size:.6875rem;color:var(--muted);background:var(--surface-2);border:1px solid var(--line-soft);border-radius:99px;padding:1px 7px}' +
  '.ae-ws{margin-left:auto;display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:.75rem;color:var(--ink-2);font-variant-numeric:tabular-nums}' +
  '.ae-ws .bad{color:var(--bad)}' +
  '.ae-seta{display:flex;color:var(--muted);transition:transform .15s}' +
  '.ae-fechado .ae-seta{transform:rotate(-90deg)}' +
  '.ae-w .tf-rows{padding:0 10px}' +
  '.ae-w .tf-row{padding:8px 6px}' +
  '.ae-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start;margin-bottom:14px}' +
  '@media (max-width:980px){.ae-cols{grid-template-columns:minmax(0,1fr)}}' +
  '.ae{container-type:inline-size}' +
  '@container (max-width:860px){.ae-cols{grid-template-columns:minmax(0,1fr)}}' +
  '.ae-grp{margin-top:6px}' +
  '.ae-grp + .ae-grp{margin-top:14px}' +
  '.ae-grp > h4{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted);padding:4px 16px;font-weight:500;display:flex;gap:8px}' +
  '.ae-grp > h4 span{color:var(--faint)}' +
  '.ae-vazio{color:var(--muted);font-size:.85rem;padding:2px 22px 16px;margin:0}' +
  '.ae-nota{color:var(--muted);font-size:.78rem;padding:0 22px 12px;margin:0}' +
  '.ae-docs-t{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:4px;font-size:.72rem}' +
  '.ae-docs-t > a,.ae-docs-t > span{color:var(--accent-ink);text-decoration:none;display:inline-flex;align-items:center;gap:4px;max-width:100%}' +
  '.ae-docs-t a:hover{text-decoration:underline}' +
  '.ae-docs-t em{font-style:normal;color:var(--muted)}' +
  '.ae-docs-t > * span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}' +
  '.ae-pj,.ae-doc{display:flex;align-items:baseline;gap:10px;padding:8px 16px;border-top:1px solid var(--line-soft)}' +
  '.ae-pj{cursor:pointer;align-items:center}' +
  '.ae-pj:first-of-type,.ae-doc:first-of-type{border-top-color:transparent}' +
  '.ae-pj:hover,.ae-doc:hover{background:var(--surface-2)}' +
  '.ae-pj b,.ae-doc b{font-weight:500;font-size:.875rem;color:var(--ink)}' +
  '.ae-doc a{color:var(--ink);text-decoration:none}' +
  '.ae-doc a:hover{color:var(--accent-ink);text-decoration:underline}' +
  '.ae-pj small,.ae-doc small{color:var(--muted);font-size:.72rem}' +
  '.ae-doc small.uso{color:var(--accent-ink)}' +
  '.ae-pj .mono,.ae-doc .mono{white-space:nowrap}' +
  '.ae-barra{flex:none;width:150px;height:6px;border-radius:99px;background:var(--line-soft);overflow:hidden}' +
  '.ae-barra i{display:block;height:6px;background:var(--accent)}' +
  '.ae-barra i.bad{background:var(--bad)}' +
  '.ae-dic{flex:none;width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:var(--surface-2);color:var(--muted);margin-top:1px}' +
  '.ae-mais{margin:2px 16px 14px}' +
  '.ae-apagar{flex:none;border:0;background:none;color:var(--faint);cursor:pointer;padding:2px;border-radius:6px;opacity:0;display:flex}' +
  '.tf-row:hover .ae-apagar{opacity:1}' +
  '.ae-apagar:hover{color:var(--bad);background:var(--bad-soft)}' +
  '.ae-ficha{border-style:dashed;color:var(--accent-ink)}' +
  '.ae-topo{display:flex;justify-content:flex-end;margin-bottom:8px}';

var AE = { filtro: {}, fechados: {}, despesas: null, aLerDespesas: false };
function aeLerGuardado(chave){
  try { return JSON.parse(localStorage.getItem(chave) || '{}') || {}; } catch (e) { return {}; }
}
function aeGuardar(chave, v){ try { localStorage.setItem(chave, JSON.stringify(v)); } catch (e) {} }
AE.filtro = aeLerGuardado('aeFiltro');
AE.fechados = aeLerGuardado('aeFechados');

/* Os widgets da segunda linha comecam recolhidos: o que a area tem de mais
   urgente esta na primeira. */
var AE_INICIO_FECHADO = { pagamentos: true, documentos: true };

function aeF(view){
  var f = AE.filtro[view];
  /* O filtro antigo era so o nome da sub-area, guardado como texto. */
  if (typeof f === 'string') f = { sub: f };
  if (!f || typeof f !== 'object') f = {};
  return {
    sub: f.sub || 'tudo',
    quem: f.quem || 'todos',
    papel: f.papel || 'ambos',
    periodo: f.periodo || 'tudo'
  };
}
function aePor(a, campo, valor){
  var f = aeF(a.view);
  f[campo] = valor;
  AE.filtro[a.view] = f;
  aeGuardar('aeFiltro', AE.filtro);
  aeRenderArea(a);
}
function aeAbertoW(view, chave){
  var m = AE.fechados[view] || {};
  if (m[chave] === undefined) return !AE_INICIO_FECHADO[chave];
  return !m[chave];
}
function aeFecharW(a, chave, fechado){
  var m = AE.fechados[a.view] || {};
  m[chave] = fechado;
  AE.fechados[a.view] = m;
  aeGuardar('aeFechados', AE.fechados);
  aeRenderArea(a);
}

var AE_CLIPE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>';

var AE_I = {
  tarefas: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h10"/>',
  pagamentos: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  despesas: '<path d="M4 18V9"/><path d="M10 18V5"/><path d="M16 18v-6"/><path d="M3 21h18"/>',
  documentos: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
  projetos: '<path d="M4 6h10"/><path d="M4 12h16"/><path d="M4 18h7"/><circle cx="18" cy="6" r="2"/><circle cx="15" cy="18" r="2"/>',
  seta: '<path d="M6 9l6 6 6-6"/>',
  ficheiro: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4"/>',
  dobrar: '<path d="M5 9l7-5 7 5"/><path d="M5 15l7 5 7-5"/>'
};
function aeIcone(d, w){
  return '<svg width="' + w + '" height="' + w + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
}

/* Os Documentos nao sao uma area, sao o arquivo de todas elas: vao para a
   Administracao. O rotulo e posto pelos modulos da administracao, que podem
   chegar depois - por isso isto tenta outra vez a cada desenho. */
var AE_NAV = { tentativas: 0 };
function aeArrumarNav(){
  var nav = document.getElementById('nav');
  if (!nav) return;
  var b = nav.querySelector('button[data-view="documentos"]');
  if (!b) return;
  var admin = null;
  nav.querySelectorAll('.nav-label').forEach(function(l){ if (/Administra/.test(l.textContent)) admin = l; });
  if (!admin){
    /* O rotulo e posto pelos modulos da administracao, que podem chegar
       depois de nos. Espera-se por ele, sem insistir para sempre. */
    if (AE_NAV.tentativas++ < 25) setTimeout(aeArrumarNav, 300);
    return;
  }
  if (b.previousElementSibling === admin) return;
  admin.parentNode.insertBefore(b, admin.nextSibling);
}

function aeNorm(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

/* A area de topo de um ecra, encontrada pelo nome e nao pelo id: os ids sao
   da base de producao e o repositorio e publico. */
function aeArea(a){
  var cs = (window.G && G.contextos) || [];
  for (var i = 0; i < cs.length; i++){
    if (!cs[i].parent_id && aeNorm(cs[i].name).indexOf(a.nome) === 0) return cs[i];
  }
  return null;
}
function aeSubs(area){
  return ((G && G.contextos) || []).filter(function(c){ return c.parent_id === area.id; });
}
function aeAberta(t){ return t.status !== 'concluida' && t.status !== 'cancelada'; }

function aeMontar(){
  if (document.getElementById('aeCss')) return;
  var st = document.createElement('style'); st.id = 'aeCss'; st.textContent = AE_CSS;
  document.head.appendChild(st);

  var nav = document.getElementById('nav');
  var docsBtn = nav && nav.querySelector('button[data-view="documentos"]');
  var docsView = document.getElementById('view-documentos');
  AE_AREAS.forEach(function(a){
    if (!a.novo || document.getElementById('view-' + a.view)) return;
    TITLES[a.view] = [a.titulo, a.sub];
    var b = document.createElement('button');
    b.dataset.view = a.view;
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' + a.icone + '</svg>';
    b.appendChild(document.createTextNode(' ' + a.titulo));
    if (nav) nav.insertBefore(b, docsBtn || null);
    var sec = el('section', 'view'); sec.id = 'view-' + a.view;
    if (docsView) docsView.parentNode.insertBefore(sec, docsView);
    else document.querySelector('main').appendChild(sec);
  });

  /* Os cartoes da maqueta prometiam que isto ainda nao existia. Agora existe:
     saem todos, de todas as areas. */
  AE_AREAS.forEach(function(a){
    var sec = document.getElementById('view-' + a.view);
    if (!sec) return;
    sec.querySelectorAll('.card').forEach(function(c){
      var v = c.querySelector('p.vazio');
      if (v && /Ainda n\u00e3o h\u00e1 nada aqui/.test(v.textContent)) c.remove();
    });
    /* Uma coluna que ficou vazia nao tem de roubar metade do ecra. */
    var g = sec.querySelector('.grid.split');
    if (g){
      var cols = g.querySelectorAll(':scope > .stack');
      if (cols.length === 2 && !cols[1].children.length){ cols[1].remove(); g.classList.remove('split'); }
    }
  });
}

/* Onde o bloco vai morar em cada ecra. Na Familia fica na coluna da direita,
   no sitio do cartao que dizia «ainda nao ha nada aqui»; nos outros, no topo. */
function aeCaixa(a){
  var id = 'ae-' + a.view;
  var box = document.getElementById(id);
  if (box) return box;
  var sec = document.getElementById('view-' + a.view);
  if (!sec) return null;
  box = el('div', 'stack ae'); box.id = id;
  sec.insertBefore(box, sec.firstChild);
  return box;
}

function aeDoc(id){
  var ds = (window.D && D.documents) || [];
  for (var i = 0; i < ds.length; i++) if (ds[i].id === id) return ds[i];
  return null;
}
function aeFicheiro(d){
  var f = (d.ficheiros && d.ficheiros.length) ? d.ficheiros[0] : d.inbox_id;
  return f ? '/api/inbox/' + f + '/ficheiro' : null;
}

/* ------------------------------------------------------------------ *
 * o periodo
 * ------------------------------------------------------------------ */

var AE_PERIODOS = [
  ['atraso', 'Em atraso'],
  ['d7', '7 dias'],
  ['d30', '30 dias'],
  ['d90', '90 dias'],
  ['d365', '12 meses'],
  ['tudo', 'Tudo']
];

/* Uma janela de datas, ou «atraso», ou nada quando e «tudo». Os dias contam
   para os dois lados: o que ja passou e esta por fazer conta tanto como o
   que vem ai. */
function aeJanela(p){
  if (!p || p === 'tudo') return null;
  if (p === 'atraso') return 'atraso';
  if (p.slice(0, 2) === 'm:'){
    var pa = p.slice(2).split('-'), ano = Number(pa[0]), mes = Number(pa[1]);
    return { de: tfISO(new Date(ano, mes - 1, 1)), ate: tfISO(new Date(ano, mes, 0)) };
  }
  if (p.slice(0, 2) === 'a:'){
    var an = Number(p.slice(2));
    return { de: an + '-01-01', ate: an + '-12-31' };
  }
  var n = Number(p.slice(1)) || 30;
  var h = tfHoje();
  return { de: tfISO(tfMais(h, -n)), ate: tfISO(tfMais(h, n)) };
}
function aeNaJanela(j, iso){ return !!iso && iso >= j.de && iso <= j.ate; }

function aeNomePeriodo(p){
  for (var i = 0; i < AE_PERIODOS.length; i++) if (AE_PERIODOS[i][0] === p) return AE_PERIODOS[i][1];
  if (p.slice(0, 2) === 'm:'){
    var pa = p.slice(2).split('-');
    return MESES[Number(pa[1]) - 1].slice(0, 3).toLowerCase() + ' ' + pa[0];
  }
  if (p.slice(0, 2) === 'a:') return p.slice(2);
  return 'Tudo';
}
function aePeriodoAMao(p){ return p.slice(0, 2) === 'm:' || p.slice(0, 2) === 'a:'; }

/* Escolher um mes e um ano a mao: o «90 dias» serve para o que vem ai, isto
   serve para ir buscar o que ja foi. */
function aePopPeriodo(a, ancora){
  tfFecharPop();
  var f = aeF(a.view);
  var hoje = tfHoje();
  var ano = hoje.getFullYear(), mes = hoje.getMonth() + 1;
  if (aePeriodoAMao(f.periodo)){
    var pa = f.periodo.slice(2).split('-');
    ano = Number(pa[0]);
    mes = pa.length > 1 ? Number(pa[1]) : 0;
  }
  var p = el('div', 'tf-pop');
  p.style.width = '240px';

  p.appendChild(el('label', null, 'Mês'));
  var sM = el('select');
  var o0 = el('option', null, '— o ano inteiro —'); o0.value = '0'; sM.appendChild(o0);
  MESES.forEach(function(nome, i){
    var o = el('option', null, nome); o.value = String(i + 1);
    sM.appendChild(o);
  });
  sM.value = String(mes || 0);
  p.appendChild(sM);

  p.appendChild(el('label', null, 'Ano'));
  var sA = el('select');
  for (var y = hoje.getFullYear() + 1; y >= hoje.getFullYear() - 5; y--){
    var oa = el('option', null, String(y)); oa.value = String(y);
    sA.appendChild(oa);
  }
  sA.value = String(ano);
  p.appendChild(sA);

  var ac = el('div', 'tf-acoes');
  var bC = el('button', 'btn small', 'Cancelar'); bC.type = 'button';
  bC.addEventListener('click', tfFecharPop);
  var bOk = el('button', 'btn small primary', 'Ver'); bOk.type = 'button';
  bOk.addEventListener('click', function(){
    var m = Number(sM.value);
    tfFecharPop();
    aePor(a, 'periodo', m ? 'm:' + sA.value + '-' + String(m).padStart(2, '0') : 'a:' + sA.value);
  });
  ac.appendChild(bC); ac.appendChild(bOk);
  p.appendChild(ac);
  tfPosicionar(p, ancora);
}

/* ------------------------------------------------------------------ *
 * quem
 * ------------------------------------------------------------------ */

var AE_PAPEIS = [['dono', 'Dono'], ['assunto', 'Por causa de'], ['ambos', 'Ambos']];

/* Uma tarefa tem duas pessoas: quem a faz e por causa de quem se faz. O
   filtro deixa escolher qual das duas conta. */
function aePassaPessoa(f, dono, assuntos){
  if (f.quem === 'todos') return true;
  var id = Number(f.quem);
  var ehDono = dono === id;
  var ehAssunto = (assuntos || []).indexOf(id) >= 0;
  if (f.papel === 'dono') return ehDono;
  if (f.papel === 'assunto') return ehAssunto;
  return ehDono || ehAssunto;
}
/* Uma despesa, um papel ou um projeto so tem uma pessoa: o «dono / por causa
   de» nao se lhes aplica. */
function aePassaPessoaSo(f, ids){
  if (f.quem === 'todos') return true;
  return (ids || []).indexOf(Number(f.quem)) >= 0;
}

/* ------------------------------------------------------------------ *
 * as linhas
 * ------------------------------------------------------------------ */

/* Os papeis agarrados a tarefa, a vista na linha: fatura, comprovativo,
   recibo. Abrem o ficheiro sem abrir a tarefa. */
function aeDocsDaTarefa(t){
  var ps = t.papeis || [];
  if (!ps.length) return null;
  var box = el('div', 'ae-docs-t');
  ps.forEach(function(pp){
    var d = aeDoc(pp.id);
    var nome = d ? d.name : 'documento';
    var url = d ? aeFicheiro(d) : null;
    var a = el(url ? 'a' : 'span');
    if (url){ a.href = url; a.target = '_blank'; a.rel = 'noopener'; }
    a.innerHTML = AE_CLIPE;
    if (pp.papel && pp.papel !== 'anexo') a.appendChild(el('em', null, pp.papel));
    a.appendChild(el('span', null, nome));
    a.title = (pp.papel && pp.papel !== 'anexo' ? pp.papel + ': ' : '') + nome;
    a.addEventListener('click', function(e){ e.stopPropagation(); });
    box.appendChild(a);
  });
  return box;
}

function aeLinha(t){
  var li = el('div', 'tf-row');
  var caixa = tfCaixa(t, function(){
    /* Um pagamento fecha-se com valor e prova, e a janela abre aqui mesmo,
       por cima da area: ir para as Tarefas fazia perder o sitio. */
    if (tfTipo(t) === 'pagamento' && !tfFechada(t)){
      caixa.dataset.tfpop = '1';
      return tfPopPagar(tfPorId(t.id) || t, caixa);
    }
    tfAlternar(t);
  });
  li.appendChild(caixa);
  var corpo = el('div', 'tf-body');
  corpo.appendChild(el('span', 'tf-t', t.title));
  var m = el('div', 'tf-m');
  var dono = pessoa(t.owner_id);
  if (dono){
    var d = el('span'); var dot = el('i', 'dot'); dot.style.background = dono.color || 'var(--c1)';
    d.appendChild(dot); d.appendChild(document.createTextNode(dono.name)); m.appendChild(d);
  }
  (t.subjects || []).forEach(function(pid){ var p = pessoa(pid); if (p) m.appendChild(el('span', null, '→ ' + p.name)); });
  /* O estado ve-se e muda-se aqui, sem sair da area: e a mesma etiqueta da
     pagina das Tarefas, e num pagamento «Pago» abre a janela do dinheiro. */
  if (tfTipo(t) === 'tarefa' || tfTipo(t) === 'pagamento') m.appendChild(tfEtiquetaEstado(t));
  if (tfTipo(t) === 'pagamento' && t.payee) m.appendChild(el('span', null, t.payee));
  if (tfTipo(t) === 'lembrete') m.appendChild(el('span', null, 'lembrete'));
  if (t.repeat_rule){
    var r = el('span'); r.innerHTML = tfSvg(TF_I.rep, 11);
    r.appendChild(document.createTextNode(t.repeat_label || 'repete'));
    m.appendChild(r);
  }
  if (tfSemProva(t)) m.appendChild(pill('falta comprovativo', 'warn'));
  if (m.childNodes.length) corpo.appendChild(m);
  var dt = aeDocsDaTarefa(t);
  if (dt) corpo.appendChild(dt);
  li.appendChild(corpo);
  if (tfTipo(t) === 'pagamento' && t.amount) li.appendChild(el('div', 'tf-val', tfEuros(t.amount)));
  li.appendChild(el('div', 'tf-r ' + tfNivelData(t), tfDataTxt(t.due_on, t.due_time)));
  li.addEventListener('click', function(){
    if (typeof avAbrir === 'function') avAbrir({ origem: 'tarefa', id: t.id, quando: t.due_on || null, detail: areaNome(t.context_id) });
    else { show('tarefas'); tfAbrir(t.id); }
  });
  return li;
}

function aeLinhaDespesa(x){
  var r = el('div', 'tf-row');
  var ic = el('span', 'ae-dic'); ic.innerHTML = aeIcone(AE_I.ficheiro, 12);
  r.appendChild(ic);
  var corpo = el('div', 'tf-body');
  var nome = x.description || 'despesa';
  var url = x.inbox_id ? '/api/inbox/' + x.inbox_id + '/ficheiro' : null;
  if (url){
    var a = el('a', 'tf-t', nome);
    a.href = url; a.target = '_blank'; a.rel = 'noopener';
    a.style.color = 'var(--ink)'; a.style.textDecoration = 'none';
    a.title = 'Abrir o ficheiro';
    corpo.appendChild(a);
  } else {
    corpo.appendChild(el('span', 'tf-t', nome));
  }
  var m = el('div', 'tf-m');
  var p = x.person_id ? pessoa(x.person_id) : null;
  if (p){
    var s = el('span'); var dot = el('i', 'dot'); dot.style.background = p.color || 'var(--c1)';
    s.appendChild(dot); s.appendChild(document.createTextNode(p.name)); m.appendChild(s);
  }
  if (x.merchant) m.appendChild(el('span', null, x.merchant));
  if (x.category) m.appendChild(el('span', null, x.category));
  if (!url) m.appendChild(el('span', null, 'sem ficheiro'));
  if (m.childNodes.length) corpo.appendChild(m);
  r.appendChild(corpo);
  r.appendChild(el('div', 'tf-val', tfEuros(x.amount)));
  r.appendChild(el('div', 'tf-r', tfDataCurta(x.spent_on)));
  /* Uma despesa que nasceu de uma leitura errada tem de poder sair. Era o que
     a tabela das Financas fazia e o widget nao sabia. */
  if (typeof dpApagar === 'function'){
    var x0 = el('button', 'ae-apagar');
    x0.type = 'button';
    x0.title = 'Apagar a despesa';
    x0.setAttribute('aria-label', 'Apagar «' + nome + '»');
    x0.innerHTML = aeIcone('<path d="M6 6l12 12"/><path d="M18 6L6 18"/>', 12);
    x0.addEventListener('click', function(e){
      e.stopPropagation();
      dpApagar(x, aeRecarregarDespesas);
    });
    r.appendChild(x0);
  }
  return r;
}

function aeLinhaDoc(d, filhos){
  var r = el('div', 'ae-doc');
  var g = el('div');
  var url = aeFicheiro(d);
  var nome = el(url ? 'a' : 'b', null, d.name);
  if (url){ nome.href = url; nome.target = '_blank'; nome.rel = 'noopener'; nome.style.fontWeight = '500'; nome.style.fontSize = '.875rem'; }
  g.appendChild(nome);
  var sub = [d.kind, d.entity].filter(Boolean).join(' · ');
  if (!url) sub = (sub ? sub + ' · ' : '') + 'sem ficheiro';
  if (sub){ g.appendChild(document.createElement('br')); g.appendChild(el('small', null, sub)); }
  var usos = typeof tfUsosDoc === 'function' ? tfUsosDoc(d) : (d.tarefas || []);
  if (usos.length){
    g.appendChild(document.createElement('br'));
    g.appendChild(el('small', 'uso', '↳ ' + (usos[0].papel && usos[0].papel !== 'anexo' ? usos[0].papel + ' de ' : '') +
      '«' + usos[0].title + '»' + (usos.length > 1 ? ' e mais ' + (usos.length - 1) : '')));
  }
  /* Comprovativo e recibo do mesmo pagamento, pendurados na fatura. */
  (filhos || []).forEach(function(f){
    g.appendChild(document.createElement('br'));
    var url2 = aeFicheiro(f.d);
    var sm = el('small', null, '↳ ' + f.papel + ': ');
    var n2 = el(url2 ? 'a' : 'span', null, f.d.name);
    if (url2){ n2.href = url2; n2.target = '_blank'; n2.rel = 'noopener'; n2.style.color = 'var(--accent-ink)'; }
    sm.appendChild(n2);
    g.appendChild(sm);
  });
  r.appendChild(g);
  var dt = d.valid_on || d.issued_on;
  var dir = el('span', 'mono');
  dir.style.marginLeft = 'auto';
  dir.textContent = dt ? (d.valid_on ? 'até ' : '') + (typeof tfDataCurta === 'function' ? tfDataCurta(dt) : dt) : '';
  r.appendChild(dir);
  return r;
}

function aeLinhaProjeto(p, tudo){
  var r = el('div', 'ae-pj');
  var g = el('div');
  g.style.flex = '1';
  g.style.minWidth = '0';
  g.appendChild(el('b', null, p.name));
  var pai = p.parent_id ? projeto(p.parent_id) : null;
  var sub = [pai ? pai.name : null, tudo ? areaNome(p.context_id) : null, p.status === 'planeado' ? 'planeado' : null]
    .filter(Boolean).join(' · ');
  if (sub){ g.appendChild(document.createElement('br')); g.appendChild(el('small', null, sub)); }
  r.appendChild(g);
  var c = p.contagem || {};
  var pc = c.total ? Math.round((c.feitas / c.total) * 100) : 0;
  var barra = el('span', 'ae-barra');
  var i = el('i', c.atrasadas ? 'bad' : '');
  i.style.width = pc + '%';
  barra.appendChild(i);
  barra.title = pc + '% feitas';
  r.appendChild(barra);
  var conta = el('span', 'mono');
  conta.style.width = '170px';
  conta.style.textAlign = 'right';
  conta.textContent = (c.abertas || 0) + ' por fazer' + (c.atrasadas ? ' · ' + c.atrasadas + ' em atraso' : '');
  r.appendChild(conta);
  r.addEventListener('click', function(){ if (typeof pjAbrir === 'function') pjAbrir(p.id); else show('projetos'); });
  return r;
}

function aeOrdem(a, b){
  if (a.due_on && b.due_on && a.due_on !== b.due_on) return a.due_on < b.due_on ? -1 : 1;
  if (!!a.due_on !== !!b.due_on) return a.due_on ? -1 : 1;
  return String(a.title).localeCompare(String(b.title), 'pt');
}

/* ------------------------------------------------------------------ *
 * o widget
 * ------------------------------------------------------------------ */

function aeWidget(a, chave, cfg){
  var aberto = aeAbertoW(a.view, chave);
  var card = el('div', 'card ae-w' + (aberto ? '' : ' ae-fechado'));
  var h = el('button', 'ae-wh');
  h.type = 'button';
  var ic = el('span', 'ae-wi ' + chave);
  ic.innerHTML = aeIcone(AE_I[chave], 15);
  h.appendChild(ic);
  h.appendChild(el('span', 'ae-wt', cfg.titulo));
  if (cfg.n) h.appendChild(el('span', 'ae-wn', String(cfg.n)));
  var s = el('span', 'ae-ws');
  if (cfg.resumo) s.appendChild(el('span', cfg.aviso ? 'bad' : '', cfg.resumo));
  var seta = el('span', 'ae-seta');
  seta.innerHTML = aeIcone(AE_I.seta, 14);
  s.appendChild(seta);
  h.appendChild(s);
  h.title = aberto ? 'Recolher' : 'Expandir';
  h.addEventListener('click', function(){ aeFecharW(a, chave, aberto); });
  card.appendChild(h);
  if (aberto) cfg.corpo(card);
  return card;
}

function aeRodape(card, texto, fn){
  var b = el('button', 'btn small ae-mais', texto);
  b.type = 'button';
  b.style.marginLeft = '16px';
  b.addEventListener('click', fn);
  card.appendChild(b);
}

/* As linhas de uma lista de tarefas ou pagamentos, partidas por sub-area
   quando o filtro esta em «Tudo». */
function aeCorpoTarefas(card, lista, grupos, area, vazio){
  if (!lista.length){ card.appendChild(el('p', 'ae-vazio', vazio)); return; }
  var ordem = grupos.filter(function(c){ return c.id !== area.id; })
    .concat(grupos.filter(function(c){ return c.id === area.id; }));
  var gs = ordem.map(function(g){ return { c: g, lista: lista.filter(function(t){ return t.context_id === g.id; }) }; })
    .filter(function(g){ return g.lista.length; });
  var cabecas = grupos.length > 1;
  gs.forEach(function(g){
    var gr = el('div', 'ae-grp');
    if (cabecas){
      var h4 = el('h4', null, g.c.id === area.id ? area.name + ' · geral' : g.c.name);
      h4.appendChild(el('span', null, String(g.lista.length)));
      gr.appendChild(h4);
    }
    var rows = el('div', 'tf-rows');
    g.lista.forEach(function(t){ rows.appendChild(aeLinha(t)); });
    gr.appendChild(rows);
    card.appendChild(gr);
  });
}

function aeCorpoDespesas(card, lista, havia){
  if (AE.despesas === null){ card.appendChild(el('p', 'ae-vazio', 'A ler as despesas…')); return; }
  if (!lista.length){
    card.appendChild(el('p', 'ae-vazio', havia
      ? 'Nenhuma despesa desta área no que está filtrado.'
      : 'Nenhuma despesa arrumada nesta área. As que não têm área vivem nas Finanças.'));
    return;
  }
  var rows = el('div', 'tf-rows');
  lista.forEach(function(x){ rows.appendChild(aeLinhaDespesa(x)); });
  card.appendChild(rows);
}

/* Os documentos da area. Na vista de tudo vem arrumados por sub-area, e os
   que sao da area sem sub-area nenhuma ficam no fim, em «geral». */
function aeCorpoDocs(card, docs, area, grupos, havia){
  if (!window.D || !D.documents){ card.appendChild(el('p', 'ae-vazio', 'A ler os documentos…')); return; }
  if (!docs.length){
    card.appendChild(el('p', 'ae-vazio', havia
      ? 'Nenhum papel desta área no que está filtrado.'
      : 'Nenhum papel arrumado nesta área. Arrumam-se nos Documentos.'));
    return;
  }
  var CJ = typeof docsConjuntos === 'function' ? docsConjuntos() : { filhos: {}, pendurado: {} };
  var ordem = grupos.filter(function(c){ return c.id !== area.id; })
    .concat(grupos.filter(function(c){ return c.id === area.id; }));
  var gs = ordem.map(function(c){ return { c: c, lista: docs.filter(function(d){ return d.context_id === c.id; }) }; })
    .filter(function(g){ return g.lista.length; });
  var cabecas = grupos.length > 1;
  gs.forEach(function(g){
    var gr = el('div', 'ae-grp');
    if (cabecas){
      var h4 = el('h4', null, g.c.id === area.id ? area.name + ' · geral' : g.c.name);
      h4.appendChild(el('span', null, String(g.lista.length)));
      gr.appendChild(h4);
    }
    g.lista.forEach(function(d){ gr.appendChild(aeLinhaDoc(d, CJ.filhos[d.id])); });
    card.appendChild(gr);
  });
}

function aeCorpoProjetos(card, pjs, tudo){
  if (!pjs.length){ card.appendChild(el('p', 'ae-vazio', 'Nenhum projeto aberto com este filtro.')); return; }
  pjs.forEach(function(p){ card.appendChild(aeLinhaProjeto(p, tudo)); });
}

/* ------------------------------------------------------------------ *
 * as despesas (o ecra das Financas le-as so quando la se entra)
 * ------------------------------------------------------------------ */

function aeRecarregarDespesas(){
  AE.despesas = null;
  AE.aLerDespesas = false;
  aeRender();
}

function aeDespesas(){
  if (AE.despesas) return AE.despesas;
  if (!AE.aLerDespesas){
    AE.aLerDespesas = true;
    apiGestao('/api/despesas').then(function(d){
      AE.despesas = d.despesas || [];
      aeRender();
    }).catch(function(){ AE.despesas = []; });
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * o ecra
 * ------------------------------------------------------------------ */

function aeChip(nome, ligado, fn, extra){
  var b = el('button', 'ae-chip' + (ligado ? ' on' : ''));
  b.type = 'button';
  if (extra && extra.cor){ var d = el('i', 'dot'); d.style.background = extra.cor; b.appendChild(d); }
  b.appendChild(document.createTextNode(nome));
  if (extra && extra.n) b.appendChild(el('small', extra.atraso ? 'bad' : '', String(extra.n)));
  b.addEventListener('click', fn);
  return b;
}

function aeFila(rotulo){
  var linha = el('div', 'ae-fl');
  linha.appendChild(el('span', 'ae-lbl', rotulo));
  var chips = el('div', 'ae-chips');
  linha.appendChild(chips);
  linha.chips = chips;
  return linha;
}

function aeKpi(valor, nome, cls, fn){
  var b = el('button', 'ae-kpi');
  b.type = 'button';
  b.appendChild(el('b', cls || '', valor));
  b.appendChild(el('span', null, nome));
  b.addEventListener('click', fn);
  return b;
}

function aeRenderArea(a){
  var box = aeCaixa(a);
  if (!box) return;
  clear(box);
  var area = aeArea(a);
  if (!area) return;
  var f = aeF(a.view);
  var subs = aeSubs(area);
  var todos = [area].concat(subs);
  var idsTodos = todos.map(function(c){ return c.id; });

  var abertas = (G.tasks || []).filter(function(t){
    return aeAberta(t) && !t.parent_id && !t.project_id && idsTodos.indexOf(t.context_id) >= 0;
  });
  var pjsTodos = (G.projects || []).filter(function(p){
    return p.tipo !== 'programa' && p.status !== 'concluido' && idsTodos.indexOf(p.context_id) >= 0;
  });
  var docsTodos = ((window.D && D.documents) || []).filter(function(d){ return idsTodos.indexOf(d.context_id) >= 0; });
  /* As Financas sao a casa do dinheiro sem area: uma despesa que a caixa de
     entrada catalogou sem area nao pode ficar invisivel em lado nenhum. */
  var orfas = a.view === 'financas';
  var despTodas = (aeDespesas() || []).filter(function(x){
    return idsTodos.indexOf(x.context_id) >= 0 || (orfas && !x.context_id);
  });

  /* Onde: Tudo, cada sub-area, e «Geral» so quando a area tem coisas suas.
     Um filtro guardado que deixou de existir volta a Tudo. */
  var opcoes = [];
  if (subs.length){
    opcoes.push({ k: 'tudo', nome: 'Tudo', ids: idsTodos });
    subs.forEach(function(s){ opcoes.push({ k: String(s.id), nome: s.name, ids: [s.id] }); });
    var temGeral = abertas.some(function(t){ return t.context_id === area.id; }) ||
      pjsTodos.some(function(p){ return p.context_id === area.id; }) ||
      docsTodos.some(function(d){ return d.context_id === area.id; });
    if (temGeral) opcoes.push({ k: 'geral', nome: 'Geral', ids: [area.id] });
  }
  var sel = opcoes.filter(function(o){ return o.k === f.sub; })[0] || opcoes[0] || { k: 'tudo', ids: idsTodos };
  var ids = sel.ids, tudo = sel.k === 'tudo';
  var grupos = todos.filter(function(c){ return ids.indexOf(c.id) >= 0; });

  var j = aeJanela(f.periodo);
  function naArea(x){ return ids.indexOf(x.context_id) >= 0; }
  function naAreaDesp(x){ return naArea(x) || (orfas && tudo && !x.context_id); }
  function passaTarefa(t){
    if (!naArea(t)) return false;
    if (!aePassaPessoa(f, t.owner_id, t.subjects)) return false;
    if (!j) return true;
    if (j === 'atraso') return tfNivelData(t) === 'bad';
    /* Sem data nao ha periodo que a apanhe: fica sempre a vista. */
    return !t.due_on || aeNaJanela(j, t.due_on);
  }

  var soltas = abertas.filter(passaTarefa);
  var notas = soltas.filter(function(t){ return tfTipo(t) === 'nota'; }).length;
  soltas = soltas.filter(function(t){ return tfTipo(t) !== 'nota'; });
  var pags = soltas.filter(function(t){ return tfTipo(t) === 'pagamento'; }).sort(aeOrdem);
  var outras = soltas.filter(function(t){ return tfTipo(t) !== 'pagamento'; }).sort(aeOrdem);

  var despesas = despTodas.filter(function(x){
    if (!naAreaDesp(x)) return false;
    if (!aePassaPessoaSo(f, [x.person_id])) return false;
    if (!j) return true;
    if (j === 'atraso') return false;
    return aeNaJanela(j, x.spent_on);
  });

  var docs = docsTodos.filter(function(d){
    if (!naArea(d)) return false;
    if (!aePassaPessoaSo(f, [d.person_id])) return false;
    if (!j) return true;
    if (j === 'atraso') return false;
    /* O papel entra pela data dele ou pela validade - basta uma das duas. */
    if (!d.issued_on && !d.valid_on) return true;
    return aeNaJanela(j, d.issued_on) || aeNaJanela(j, d.valid_on);
  });

  var pjs = pjsTodos.filter(function(p){
    if (!naArea(p)) return false;
    if (!aePassaPessoaSo(f, (p.members || []).map(function(m){ return m.person_id; }))) return false;
    /* Um projeto dura meses: o periodo nao o corta, so o «em atraso». */
    if (j === 'atraso') return (p.contagem || {}).atrasadas > 0;
    return true;
  });

  /* ---- a barra dos filtros ---- */
  var barra = el('div', 'card ae-filtros');

  if (opcoes.length){
    var fl1 = aeFila('Onde');
    opcoes.forEach(function(o){
      var n = abertas.filter(function(t){ return tfTipo(t) !== 'nota' && o.ids.indexOf(t.context_id) >= 0; });
      var atr = n.filter(function(t){ return tfNivelData(t) === 'bad'; }).length;
      fl1.chips.appendChild(aeChip(o.nome, o.k === sel.k, function(){ aePor(a, 'sub', o.k); },
        { n: n.length || 0, atraso: atr }));
    });
    barra.appendChild(fl1);
  }

  var fl2 = aeFila('Quem');
  var seg = el('div', 'ae-seg' + (f.quem === 'todos' ? ' ae-off' : ''));
  if (f.quem === 'todos') seg.title = 'Escolhe uma pessoa para isto contar';
  AE_PAPEIS.forEach(function(pp){
    var b = el('button', f.papel === pp[0] ? 'on' : '', pp[1]);
    b.type = 'button';
    b.addEventListener('click', function(){ aePor(a, 'papel', pp[0]); });
    seg.appendChild(b);
  });
  fl2.chips.appendChild(seg);
  fl2.chips.appendChild(aeChip('Agregado todo', f.quem === 'todos', function(){ aePor(a, 'quem', 'todos'); },
    { cor: 'var(--faint)' }));
  (G.people || []).filter(function(p){ return p.active !== false; }).forEach(function(p){
    fl2.chips.appendChild(aeChip(p.name, f.quem === String(p.id), function(){ aePor(a, 'quem', String(p.id)); },
      { cor: p.color || 'var(--c1)' }));
  });
  if (f.quem !== 'todos'){
    var quem = pessoa(Number(f.quem));
    if (quem){
      var bf = el('button', 'ae-chip ae-ficha', 'Ficha de ' + quem.name.split(' ')[0]);
      bf.type = 'button';
      bf.dataset.ficha = quem.id;
      bf.title = 'Abrir a ficha de ' + quem.name;
      fl2.chips.appendChild(bf);
    }
  }
  barra.appendChild(fl2);

  var fl3 = aeFila('Quando');
  AE_PERIODOS.forEach(function(pp){
    fl3.chips.appendChild(aeChip(pp[1], f.periodo === pp[0], function(){ aePor(a, 'periodo', pp[0]); }));
  });
  var bMes = aeChip(aePeriodoAMao(f.periodo) ? aeNomePeriodo(f.periodo) : 'Mês…', aePeriodoAMao(f.periodo), function(){
    bMes.dataset.tfpop = '1';
    aePopPeriodo(a, bMes);
  });
  bMes.title = 'Escolher um mês ou um ano';
  fl3.chips.appendChild(bMes);
  barra.appendChild(fl3);
  box.appendChild(barra);

  /* ---- os numeros, que sao botoes ---- */
  var atrasadas = soltas.filter(function(t){ return tfNivelData(t) === 'bad'; }).length;
  var aPagar = pags.reduce(function(s, t){ return s + Number(t.amount || 0); }, 0);
  var gasto = despesas.reduce(function(s, x){ return s + Number(x.amount || 0); }, 0);
  var porLer = docs.filter(function(d){ return !d.lido; }).length;

  function abrirW(chave){ return function(){ aeFecharW(a, chave, false); }; }
  var kpis = el('div', 'ae-kpis');
  kpis.appendChild(aeKpi(String(soltas.length), 'por fazer', '', abrirW('tarefas')));
  kpis.appendChild(aeKpi(String(atrasadas), 'em atraso', atrasadas ? 'bad' : '', function(){ aePor(a, 'periodo', 'atraso'); }));
  kpis.appendChild(aeKpi(tfEuros(aPagar), 'a pagar', '', abrirW('pagamentos')));
  kpis.appendChild(aeKpi(tfEuros(gasto), 'já gasto', '', abrirW('despesas')));
  kpis.appendChild(aeKpi(String(docs.length), docs.length === 1 ? 'papel' : 'papéis', '', abrirW('documentos')));
  box.appendChild(kpis);

  /* ---- os cinco widgets, pela ordem escolhida ---- */
  /* Uma lista vazia diz coisas diferentes conforme a area nao ter nada, ou
     ter e o filtro estar a tapar. */
  var temTarefas = abertas.some(function(t){ return tfTipo(t) !== 'nota' && tfTipo(t) !== 'pagamento'; });
  var temPagamentos = abertas.some(function(t){ return tfTipo(t) === 'pagamento'; });
  var MAXT = 12, MAXD = 8;

  var cols1 = el('div', 'ae-cols');
  cols1.appendChild(aeWidget(a, 'tarefas', {
    titulo: 'Tarefas',
    n: outras.length,
    resumo: outras.filter(function(t){ return tfNivelData(t) === 'bad'; }).length
      ? outras.filter(function(t){ return tfNivelData(t) === 'bad'; }).length + ' em atraso' : 'em dia',
    aviso: outras.some(function(t){ return tfNivelData(t) === 'bad'; }),
    corpo: function(card){
      aeCorpoTarefas(card, outras.slice(0, MAXT), grupos, area,
        temTarefas ? 'Nada por fazer no que está filtrado.' : 'Nada por fazer fora dos projetos.');
      if (notas) card.appendChild(el('p', 'ae-nota', notas + (notas === 1 ? ' nota' : ' notas') + ' nas Tarefas › Notas.'));
      aeRodape(card, outras.length > MAXT ? 'Ver as ' + outras.length + ' nas Tarefas' : 'Abrir as Tarefas',
        function(){ show('tarefas'); });
    }
  }));
  cols1.appendChild(aeWidget(a, 'despesas', {
    titulo: 'Despesas',
    n: despesas.length,
    resumo: despesas.length ? tfEuros(gasto) : '',
    corpo: function(card){
      aeCorpoDespesas(card, despesas.slice(0, MAXD), despTodas.length > 0);
      aeRodape(card, despesas.length > MAXD ? 'Ver as ' + despesas.length + ' nas Finanças' : 'Abrir as Finanças',
        function(){ show('financas'); });
    }
  }));
  box.appendChild(cols1);

  var cols2 = el('div', 'ae-cols');
  cols2.appendChild(aeWidget(a, 'pagamentos', {
    titulo: 'Pagamentos',
    n: pags.length,
    resumo: pags.length ? tfEuros(aPagar) : '',
    aviso: pags.some(function(t){ return tfNivelData(t) === 'bad'; }),
    corpo: function(card){
      aeCorpoTarefas(card, pags.slice(0, MAXT), grupos, area,
        temPagamentos ? 'Nenhum pagamento no que está filtrado.' : 'Nenhum pagamento por fazer.');
      aeRodape(card, pags.length > MAXT ? 'Ver os ' + pags.length + ' nos Pagamentos' : 'Abrir os Pagamentos',
        function(){ show('tarefas'); });
    }
  }));
  cols2.appendChild(aeWidget(a, 'documentos', {
    titulo: 'Documentos',
    n: docs.length,
    resumo: porLer ? porLer + ' por ler' : '',
    corpo: function(card){
      aeCorpoDocs(card, docs.slice(0, MAXD), area, grupos, docsTodos.length > 0);
      aeRodape(card, docs.length > MAXD ? 'Ver os ' + docs.length + ' nos Documentos' : 'Abrir os Documentos',
        function(){ show('documentos'); });
    }
  }));
  box.appendChild(cols2);

  box.appendChild(aeWidget(a, 'projetos', {
    titulo: 'Projetos',
    n: pjs.length,
    resumo: pjs.reduce(function(s, p){ return s + ((p.contagem || {}).abertas || 0); }, 0) + ' por fazer',
    aviso: pjs.some(function(p){ return (p.contagem || {}).atrasadas; }),
    corpo: function(card){
      aeCorpoProjetos(card, pjs, tudo);
      aeRodape(card, 'Abrir os Projetos', function(){ show('projetos'); });
    }
  }));
}

var AE_ESPERA = 0;
function aeRender(){
  /* Se o desenho apanhar a app a meio do arranque - sem areas ainda, ou sem o
     tarefas.js pronto - nao ha segunda chamada que o salve: o ecra ficava
     vazio ate se carregar em Actualizar. Volta-se a tentar sozinho. */
  if (!window.G || !G.contextos || !G.contextos.length || typeof tfCaixa !== 'function'){
    if (AE_ESPERA++ < 40) setTimeout(aeRender, 350);
    return;
  }
  AE_ESPERA = 0;
  aeMontar();
  aeArrumarNav();
  AE_AREAS.forEach(function(a){
    /* Um ecra que rebenta nao cala os outros. */
    try { aeRenderArea(a); } catch (e) { console.error('[farol] area ' + a.view, e); }
  });
}

var _aeRenderGestao = renderGestao;
renderGestao = function(){
  _aeRenderGestao();
  aeRender();
};
/* Os documentos vem do /api/bootstrap, que pode chegar depois das tarefas. */
var _aeRenderAll = renderAll;
renderAll = function(){
  _aeRenderAll();
  aeRender();
};
