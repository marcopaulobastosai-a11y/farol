/* Farol - o Orcamento no Hoje (11 out 2026).
 *
 * Um cartao na coluna da direita, por cima da Agenda, com o que pede atencao
 * no orcamento do mes:
 *
 *   - o total gasto contra o orcado, com a marca do dia em que se esta;
 *   - Estourado: categorias que ja passaram o que tinham (o acumulado conta);
 *   - Acima do ritmo: categorias variaveis que gastaram mais do que a parte
 *     do mes que ja passou justifica;
 *   - Fixos por pagar: categorias fixas (renda, credito, seguros) ainda sem
 *     movimento este mes;
 *   - Fora do orcamento: o que se gastou em categorias sem orcamento.
 *
 * O resto conta-se numa linha («N dentro do ritmo»). Clicar numa linha ou no
 * «Ver orcamentos» abre Financas > Orcamentos.
 *
 * Le o mesmo /api/financas/orcamentos do ecra dos orcamentos. Nao toca no
 * app.js nem no hoje.js: embrulha o renderHoje.
 */
'use strict';

var HO = { dados: null, lido: 0, aPedir: false };

var HO_CSS =
  '#hoOrc .ho-tot{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}' +
  '#hoOrc .ho-tot b{font-family:var(--serif);font-size:1.35rem;font-weight:500;color:var(--ink)}' +
  '#hoOrc .ho-tot span{color:var(--muted);font-size:.8125rem}' +
  '#hoOrc .ho-bar{position:relative;height:8px;background:var(--line-soft);border-radius:4px;overflow:visible;margin:4px 0 4px}' +
  '#hoOrc .ho-bar i{display:block;height:100%;background:var(--accent);border-radius:4px;max-width:100%}' +
  '#hoOrc .ho-bar i.over{background:var(--bad)}#hoOrc .ho-bar i.near{background:var(--warn)}' +
  '#hoOrc .ho-bar em{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--ink);opacity:.55;border-radius:1px}' +
  '#hoOrc .ho-leg{display:flex;justify-content:space-between;font-size:.6875rem;color:var(--faint);margin-bottom:10px}' +
  '#hoOrc h4{font-family:var(--mono);font-size:.6875rem;letter-spacing:.07em;text-transform:uppercase;font-weight:500;color:var(--muted);margin:12px 0 4px;display:flex;gap:6px}' +
  '#hoOrc h4 .n{color:var(--faint)}' +
  '#hoOrc h4.bad{color:var(--bad)}#hoOrc h4.warn{color:var(--warn)}' +
  '#hoOrc ul{list-style:none;margin:0;padding:0}' +
  '#hoOrc li{display:grid;grid-template-columns:1fr auto;column-gap:10px;row-gap:3px;padding:6px 6px;margin:0 -6px;border-radius:8px;cursor:pointer}' +
  '#hoOrc li:hover{background:var(--surface-2)}' +
  '#hoOrc li .nm{font-size:.8125rem;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '#hoOrc li .vl{font-size:.75rem;color:var(--ink-2);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}' +
  '#hoOrc li .nt{grid-column:1 / -1;font-size:.6875rem;color:var(--muted)}' +
  '#hoOrc li .nt.bad{color:var(--bad)}#hoOrc li .nt.warn{color:var(--warn)}' +
  '#hoOrc li .ho-bar{grid-column:1 / -1;height:5px;margin:0}' +
  '#hoOrc li .ho-bar em{top:-2px;bottom:-2px}' +
  '#hoOrc .ho-ok{font-size:.75rem;color:var(--muted);margin-top:12px;display:flex;align-items:center;gap:8px}' +
  '#hoOrc .ho-ok::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--good);flex:none}' +
  '#hoOrc .ho-vazio{font-size:.8125rem;color:var(--muted)}';

function hoEstilo() {
  if (document.getElementById('hoCss')) return;
  var s = document.createElement('style'); s.id = 'hoCss'; s.textContent = HO_CSS;
  document.head.appendChild(s);
}

/* Euros a portuguesa: ponto nos milhares (o pt-PT do browser nao o poe em
   numeros de quatro algarismos), virgula nos centimos e so abaixo dos 100 €. */
function hoEur(v) {
  var n = Math.abs(Number(v) || 0);
  var dec = n < 100 && Math.round(n * 100) % 100 ? 2 : 0;
  var p = n.toFixed(dec).split('.');
  var s = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (p[1] ? ',' + p[1] : '') + ' €';
  return Number(v) < 0 ? '−' + s : s;
}

/* Que parte do mes ja passou (0 a 1), contando o dia de hoje. */
function hoRitmo() {
  var d = new Date();
  var dias = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { dia: d.getDate(), dias: dias, f: d.getDate() / dias };
}

function hoMesNome() {
  return new Date().toLocaleDateString('pt-PT', { month: 'long' });
}

/* Abre Financas > Orcamentos. */
function hoAbrir() {
  try {
    if (window.FN) { FN.aba.financas = 'orcamentos'; if (typeof fnGuardar === 'function') fnGuardar(); }
    show('financas');
  } catch (e) { console.error('[farol] abrir orcamentos', e); }
}

function hoBarra(pct, ritmo, cls) {
  var b = el('div', 'ho-bar');
  var i = document.createElement('i');
  i.style.width = Math.max(0, Math.min(100, pct)) + '%';
  if (cls) i.className = cls;
  b.appendChild(i);
  if (ritmo != null) {
    var m = document.createElement('em');
    m.style.left = 'calc(' + Math.round(ritmo * 100) + '% - 1px)';
    m.title = 'Hoje';
    b.appendChild(m);
  }
  return b;
}

/* Classifica cada linha do orcamento. O acumulado conta como dinheiro que a
   categoria tem: uma categoria que acumula e chega ao mes com folga nao esta
   «acima do ritmo» so por ter gasto mais do que o mensal. */
function hoClassificar(d) {
  var r = hoRitmo();
  var linhas = (d.linhas || []).filter(function (l) { return l.natureza === 'despesa'; });
  var out = { estourado: [], ritmo: [], fixos: [], ok: 0, fora: [], r: r, orc: 0, gasto: 0 };
  linhas.forEach(function (l) {
    var tem = Number(l.mensal) + (l.acumula ? Number(l.acumulado) : 0);
    var gasto = Math.max(0, Number(l.gasto) || 0);
    out.orc += Number(l.mensal);
    out.gasto += gasto;
    var nome = l.nome || '';
    var pct = tem > 0 ? gasto / tem * 100 : (gasto > 0 ? 999 : 0);
    var x = { l: l, nome: nome, tem: tem, gasto: gasto, pct: pct };
    /* Estourado so a partir de 1 € e 2% acima: os centimos de um seguro
       que subiu nao sao um alarme. */
    if (gasto > tem + Math.max(1, tem * 0.02)) { out.estourado.push(x); return; }
    if (l.fixa) {
      if (gasto === 0) out.fixos.push(x); else out.ok++;
      return;
    }
    /* Acima do ritmo: mais de 15 pontos a frente do mes e ja com metade
       gasta - no inicio do mes uma compra so nao chega para alarmar. */
    if (pct >= 50 && pct > r.f * 100 + 15) { out.ritmo.push(x); return; }
    out.ok++;
  });
  out.estourado.sort(function (a, b) { return (b.gasto - b.tem) - (a.gasto - a.tem); });
  out.ritmo.sort(function (a, b) { return b.pct - a.pct; });
  out.fixos.sort(function (a, b) { return b.tem - a.tem; });
  out.fora = (d.sem || []).filter(function (s) { return s.gasto >= 20; }).slice(0, 4);
  out.foraTotal = (d.sem || []).reduce(function (s, x) { return s + x.gasto; }, 0);
  return out;
}

function hoLinha(x, tipo, r) {
  var li = el('li');
  li.appendChild(el('span', 'nm', x.nome));
  li.appendChild(el('span', 'vl', hoEur(x.gasto) + ' / ' + hoEur(x.tem)));
  if (tipo !== 'fixo') li.appendChild(hoBarra(x.pct, tipo === 'estourado' ? null : r.f, tipo === 'estourado' ? 'over' : 'near'));
  var nt;
  if (tipo === 'estourado') nt = el('span', 'nt bad', hoEur(x.gasto - x.tem) + ' acima do orçamento');
  else if (tipo === 'ritmo') {
    /* Ao ritmo de agora, quanto se gasta no mes inteiro. */
    var proj = r.f > 0 ? x.gasto / r.f : x.gasto;
    nt = el('span', 'nt warn', Math.round(x.pct) + '% gasto com ' + Math.round(r.f * 100) + '% do mês · restam ' + hoEur(x.tem - x.gasto) +
      (proj > x.tem ? ' · a este ritmo, ' + hoEur(proj) : ''));
  } else nt = el('span', 'nt', 'Ainda sem movimento este mês');
  li.appendChild(nt);
  li.addEventListener('click', hoAbrir);
  return li;
}

function hoBloco(box, titulo, cls, lista, tipo, r) {
  if (!lista.length) return;
  var t = el('h4', cls);
  t.appendChild(el('span', null, titulo));
  t.appendChild(el('span', 'n', String(lista.length)));
  box.appendChild(t);
  var ul = el('ul');
  lista.forEach(function (x) { ul.appendChild(hoLinha(x, tipo, r)); });
  box.appendChild(ul);
}

function hoCartao() {
  var col = document.querySelector('#view-hoje .grid.split > .stack:nth-child(2)');
  if (!col) return null;
  var card = document.getElementById('hoOrc');
  if (!card) {
    card = el('div', 'card'); card.id = 'hoOrc';
    col.insertBefore(card, col.firstChild);
  }
  return card;
}

function hoDesenhar() {
  var card = hoCartao();
  if (!card) return;
  hoEstilo();
  clear(card);
  var hd = el('header');
  hd.appendChild(el('h3', null, 'Orçamento'));
  var st = el('span', 'mono', hoMesNome());
  hd.appendChild(st);
  var ver = el('button', 'btn small', 'Ver orçamentos');
  ver.type = 'button';
  ver.addEventListener('click', hoAbrir);
  hd.appendChild(ver);
  card.appendChild(hd);

  if (!HO.dados) { card.appendChild(el('p', 'ho-vazio', 'A carregar…')); return; }
  var c = hoClassificar(HO.dados);
  if (!c.orc) {
    card.appendChild(el('p', 'ho-vazio', 'Ainda sem orçamentos. Criam-se em Finanças › Orçamentos.'));
    return;
  }
  var r = c.r;
  st.textContent = hoMesNome() + ' · dia ' + r.dia + ' de ' + r.dias;

  var tot = el('div', 'ho-tot');
  tot.appendChild(el('b', null, hoEur(c.gasto)));
  tot.appendChild(el('span', null, 'de ' + hoEur(c.orc) + ' · ' + Math.round(c.gasto / c.orc * 100) + '%'));
  card.appendChild(tot);
  var pctT = c.gasto / c.orc * 100;
  card.appendChild(hoBarra(pctT, r.f, pctT > 100 ? 'over' : (pctT > r.f * 100 + 10 ? 'near' : '')));
  var leg = el('div', 'ho-leg');
  leg.appendChild(el('span', null, 'Disponível ' + hoEur(c.orc - c.gasto)));
  leg.appendChild(el('span', null, 'Mês a ' + Math.round(r.f * 100) + '%'));
  card.appendChild(leg);

  hoBloco(card, 'Estourado', 'bad', c.estourado, 'estourado', r);
  hoBloco(card, 'Acima do ritmo', 'warn', c.ritmo, 'ritmo', r);
  /* Os fixos grandes (100 € ou mais) tem linha propria; os pequenos - as
     subscricoes - juntam-se numa so linha, para nao encherem o cartao. */
  var grandes = c.fixos.filter(function (x) { return x.tem >= 100; });
  var pequenos = c.fixos.filter(function (x) { return x.tem < 100; });
  hoBloco(card, 'Fixos por pagar', '', grandes, 'fixo', r);
  if (pequenos.length) {
    if (!grandes.length) {
      var tf = el('h4');
      tf.appendChild(el('span', null, 'Fixos por pagar'));
      tf.appendChild(el('span', 'n', String(pequenos.length)));
      card.appendChild(tf);
    }
    var ulp = el('ul'), lp = el('li');
    lp.appendChild(el('span', 'nm', pequenos.length + (pequenos.length === 1 ? ' pequeno' : ' pequenos')));
    lp.appendChild(el('span', 'vl', hoEur(pequenos.reduce(function (t, x) { return t + x.tem; }, 0))));
    lp.appendChild(el('span', 'nt', pequenos.map(function (x) { return x.nome; }).join(' · ')));
    lp.addEventListener('click', hoAbrir);
    ulp.appendChild(lp);
    card.appendChild(ulp);
  }

  if (c.fora.length) {
    var t = el('h4');
    t.appendChild(el('span', null, 'Fora do orçamento'));
    t.appendChild(el('span', 'n', hoEur(c.foraTotal)));
    card.appendChild(t);
    var ul = el('ul');
    c.fora.forEach(function (s) {
      var li = el('li');
      li.appendChild(el('span', 'nm', s.nome.split(' › ').pop()));
      li.appendChild(el('span', 'vl', hoEur(s.gasto)));
      if (s.media6) li.appendChild(el('span', 'nt', 'média ' + hoEur(s.media6) + '/mês'));
      li.addEventListener('click', hoAbrir);
      ul.appendChild(li);
    });
    card.appendChild(ul);
  }

  var ok = el('div', 'ho-ok', c.ok ? c.ok + (c.ok === 1 ? ' categoria dentro do ritmo' : ' categorias dentro do ritmo') : 'Nenhuma categoria dentro do ritmo');
  if (!c.estourado.length && !c.ritmo.length && !c.fixos.length) ok.textContent = 'Tudo dentro do ritmo · ' + c.ok + ' categorias';
  card.appendChild(ok);
}

/* Le os orcamentos no maximo uma vez por minuto; o Actualizar do topo
   (que chama o load e depois o renderHoje) forca uma leitura nova. */
function hoLer(forcar) {
  hoDesenhar();
  if (HO.aPedir) return;
  if (!forcar && HO.dados && Date.now() - HO.lido < 60000) return;
  HO.aPedir = true;
  fetch('/api/financas/orcamentos', { credentials: 'same-origin' })
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (d) { HO.dados = d; HO.lido = Date.now(); })
    .catch(function (e) { console.error('[farol] orcamento no hoje', e); })
    .then(function () { HO.aPedir = false; try { hoDesenhar(); } catch (e) { console.error('[farol] orcamento no hoje', e); } });
}

if (typeof renderHoje === 'function') {
  var _hoRenderHoje = renderHoje;
  renderHoje = function () {
    _hoRenderHoje();
    try { hoLer(true); } catch (e) { console.error('[farol] orcamento no hoje', e); }
  };
}

/* Mudou um orcamento ou um movimento nas Financas: ao voltar ao Hoje, le-se
   de novo. */
if (typeof show === 'function') {
  var _hoShow = show;
  show = function (v) { _hoShow(v); if (v === 'hoje') { try { hoLer(false); } catch (e) {} } };
}

(function hoEsperar(n) {
  n = n || 0;
  if (window.D && D.attention && document.querySelector('#view-hoje .grid.split')) { try { hoLer(true); } catch (e) {} return; }
  if (n < 50) setTimeout(function () { hoEsperar(n + 1); }, 300);
})();
