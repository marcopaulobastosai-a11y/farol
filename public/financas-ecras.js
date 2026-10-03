'use strict';
/* Farol — Finanças: Resumo, Movimentos, Orçamentos e Análise.
 * As peças comuns (filtros, janelas, gráficos) estão no financas.js. */

/* ======================= RESUMO ======================= */
function fn_financas_resumo(corpo){
  if (!FN.base.contas.length) { corpo.appendChild(fnSemContas()); return; }
  fnBarraFiltros(corpo, true, [fnBtn('Importar extrato', function(){ fnImportar(); }), fnBtn('+ Movimento', function(){ fnNovoMovimento(); }, 'primary')]);
  fnCarregar(corpo, fnLer('resumo|' + fnQs(fnFiltro()), '/api/financas/resumo?' + fnQs(fnFiltro())), function(d){
    var k = d.kpi;
    /* O mes que ainda vai a meio nao se compara com meses inteiros. */
    var corrente = FN.mes === fnHoje().slice(0, 7);
    var vEnt = corrente ? null : fnVar(k.entradas, k.entradas_media), vDesp = corrente ? null : fnVar(k.despesas, k.despesas_media);
    var sub = function(v, media){ return v != null ? (v >= 0 ? '+' : '') + fnPct(v) + ' vs média 12m' : media != null ? (corrente ? 'até hoje · ' : '') + 'média ' + fnEur0(media) : 'sem histórico'; };
    var kp = h('div', { class: 'fn-kpis' }, [
      fnKpi('Entradas', fnEur(k.entradas), sub(vEnt, k.entradas_media), vEnt != null && vEnt < 0 ? 'fn-warn' : ''),
      fnKpi('Despesas', fnEur(k.despesas), sub(vDesp, k.despesas_media), vDesp != null && vDesp > 5 ? 'fn-warn' : vDesp != null ? 'fn-good' : ''),
      fnKpi('Poupado', fnEur(k.poupado), k.taxa == null ? 'sem entradas' : 'taxa de poupança ' + fnPct(k.taxa), k.poupado < 0 ? 'fn-bad' : ''),
      k.orcado ? h('div', { class: 'fn-kpi' }, [h('span', { class: 'mono' }, 'Orçamento usado'), h('span', { class: 'v' }, fnPct(k.orcamento_pct)),
        h('div', { class: 'fn-acoes' }, [fnBarra(k.orcamento_pct), h('span', { class: 's' }, fnEur0(k.gasto_orcado) + ' / ' + fnEur0(k.orcado))])])
        : fnKpi('Orçamento', '—', 'ainda sem orçamentos'),
      fnKpiLink('Por categorizar', String(k.por_categorizar), k.sugestoes ? 'a IA sugere ' + k.sugestoes + ' →' : 'ver →', function(){ FN.mov.estado = k.sugestoes ? 'sugestoes' : 'categorizar'; FN.mov.periodo = 'tudo'; fnIr('movimentos'); }),
      fnKpiLink('Por reconciliar', String(k.por_reconciliar), (k.despesas_sem_banco ? k.despesas_sem_banco + ' despesas sem banco · ' : '') + 'ver →', function(){ FN.mov.estado = 'reconciliar'; FN.mov.periodo = 'tudo'; fnIr('movimentos'); })
    ]);
    corpo.appendChild(kp);

    var l1 = h('div', { class: 'fn-linha' });
    var temSerie = d.serie.some(function(s){ return s.entradas || s.despesas; });
    l1.appendChild(fnCard('Entradas e despesas · 12 meses', h('div', { class: 'fn-leg' }, [h('span', null, [h('i', { style: 'background:var(--fn-in)' }), 'Entradas']), h('span', null, [h('i', { style: 'background:var(--fn-out)' }), 'Despesas'])]),
      [temSerie ? fnGrafPares(d.serie) : fnVazio('Sem movimentos nestes meses.'),
        h('div', { class: 'fn-barra', style: 'gap:24px;margin-top:10px' }, [
          fnMini('Média de despesas', d.ano.media == null ? '—' : fnEur0(d.ano.media) + '/mês'),
          fnMini('Despesas no ano', fnEur0(d.ano.despesas_ytd)),
          fnMini('Projeção do ano', fnEur0(d.ano.projecao)),
          fnMini('Poupança 12 meses', fnEur0(d.ano.poupanca12))])], 'largo'));
    var tl = h('div', { class: 'fn-lista' });
    if (!d.tendencias.length) tl.appendChild(h('p', { class: 'fn-nota' }, 'Nada fora do normal neste mês.'));
    d.tendencias.forEach(function(t){
      var acoes = [];
      if (t.tipo === 'orcado_a_mais') acoes.push(fnBtn('Ajustar para ' + fnEur0(t.sugerido), function(){
        fnApi('/api/financas/orcamentos/' + t.orcamento_id, 'PATCH', { mensal: t.sugerido }).then(function(){ fnAviso('Orçamento ajustado.'); fnMudou(); }, fnErro);
      }, 'small'));
      if (t.categoria_id) acoes.push(fnBtn('Ver', function(){ FN.mov.categoria = String(t.categoria_id); FN.mov.estado = ''; FN.mov.periodo = 'mes'; fnIr('movimentos'); }, 'small'));
      tl.appendChild(h('div', { class: 'fn-li' }, [
        h('span', { class: 'fn-pill ' + (t.nivel === 'bad' ? 'bad' : t.nivel === 'warn' ? 'warn' : 'ai') }, t.nivel === 'info' ? '✦' : '!'),
        h('div', { class: 'g' }, [h('b', null, t.titulo), h('small', null, t.texto)]),
        acoes.length ? h('div', { class: 'fn-acoes' }, acoes) : null]));
    });
    l1.appendChild(fnCard('Tendências', d.tendencias.length ? String(d.tendencias.length) : null, [tl]));
    corpo.appendChild(l1);

    var l2 = h('div', { class: 'fn-linha' });
    var max = Math.max.apply(null, d.categorias.map(function(c){ return c.valor; }).concat([1]));
    var lc = h('div', { class: 'fn-lista' });
    if (!d.categorias.length) lc.appendChild(h('p', { class: 'fn-nota' }, 'Sem despesas neste mês.'));
    d.categorias.forEach(function(c){
      var v = fnVar(c.valor, c.media6);
      lc.appendChild(h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [c.grupo, v != null && Math.abs(v) >= 15 ? h('small', { class: v > 0 ? 'fn-warn' : 'fn-good' }, (v > 0 ? '+' : '') + fnPct(Math.round(v)) + ' vs média 6m') : null]),
        h('div', { style: 'width:120px' }, [fnBarra(c.valor / max * 100, ' ')]), h('span', { class: 'fn-n', style: 'width:96px;text-align:right' }, fnEur(c.valor))]));
    });
    l2.appendChild(fnCard('Despesas por grupo', fnMesCurto(FN.mes), [lc, h('p', { class: 'fn-nota' }, 'Poupanças, PPR e investimentos não contam como despesa: passam para o Património.')]));

    var lo = h('div', { class: 'fn-lista' });
    if (!d.orcamento.length) lo.appendChild(fnVazio('Ainda sem orçamentos.', null, [fnBtn('Criar o primeiro', function(){ fnIr('orcamentos'); }, 'small')]));
    d.orcamento.forEach(function(o){
      lo.appendChild(h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [o.nome, h('small', null, fnEur(o.gasto) + ' de ' + fnEur(o.mensal))]),
        h('div', { style: 'width:120px' }, [fnBarra(o.pct)]), h('span', { class: 'fn-n ' + (o.pct > 100 ? 'fn-bad' : ''), style: 'width:48px;text-align:right' }, o.pct + '%')]));
    });
    l2.appendChild(fnCard('Orçamento', h('button', { type: 'button', class: 'btn small', onclick: function(){ fnIr('orcamentos'); } }, 'Ver todos'), [lo]));

    l2.appendChild(fnProximos(d.liquidez));
    corpo.appendChild(l2);
  });
}
function fnKpi(rot, v, s, cls){ return h('div', { class: 'fn-kpi' }, [h('span', { class: 'mono' }, rot), h('span', { class: 'v' }, v), h('span', { class: 's ' + (cls || '') }, s)]); }
function fnKpiLink(rot, v, s, fn){ return h('button', { type: 'button', class: 'fn-kpi', onclick: fn }, [h('span', { class: 'mono' }, rot), h('span', { class: 'v' }, v), h('span', { class: 's', style: 'color:var(--accent-ink)' }, s)]); }
function fnMini(rot, v){ return h('div', null, [h('div', { class: 'mono' }, rot), h('div', { class: 'fn-n', style: 'font-size:1rem' }, v)]); }
function fnIr(aba){ FN.aba.financas = aba; fnGuardar(); fnRender('financas'); window.scrollTo({ top: 0, behavior: 'smooth' }); }

/* Os pagamentos por fazer nos próximos 30 dias, das Tarefas. */
function fnProximos(liquidez){
  var hoje = fnHoje(), lim = new Date(); lim.setDate(lim.getDate() + 30);
  var limIso = lim.toISOString().slice(0, 10);
  var ts = ((window.G && G.tasks) || []).filter(function(t){
    return t.tipo === 'pagamento' && t.status !== 'concluida' && t.status !== 'cancelada' && t.due_on && t.due_on.slice(0, 10) <= limIso && !t.paid_on;
  }).sort(function(a, b){ return a.due_on < b.due_on ? -1 : 1; });
  var l = h('div', { class: 'fn-lista' });
  var total = 0;
  if (!ts.length) l.appendChild(h('p', { class: 'fn-nota' }, 'Nenhum pagamento com prazo nos próximos 30 dias.'));
  ts.slice(0, 8).forEach(function(t){
    var v = t.amount != null ? Number(t.amount) : null; if (v) total += v;
    var atraso = t.due_on.slice(0, 10) < hoje;
    l.appendChild(h('div', { class: 'fn-li' }, [h('span', { class: 'fn-n ' + (atraso ? 'fn-bad' : 'fn-muted'), style: 'width:52px;font-size:.75rem' }, fnData(t.due_on.slice(0, 10))),
      h('div', { class: 'g' }, [t.title, t.payee ? h('small', null, t.payee) : null]), h('span', { class: 'fn-n' }, v == null ? '—' : fnEur(-v))]));
  });
  var corpo = [l];
  if (liquidez != null) corpo.push(h('div', { class: 'fn-caixa', style: 'flex-direction:row;justify-content:space-between;flex-wrap:wrap' },
    [h('span', { class: 'fn-muted' }, 'Contas à ordem depois destes pagamentos'), h('b', { class: 'fn-n ' + (liquidez - total < 0 ? 'fn-bad' : '') }, fnEur(liquidez - total))]));
  return fnCard('Próximos 30 dias', 'das Tarefas', corpo);
}

function fnSemContas(){
  return fnCard('Começar', null, [fnVazio('Ainda não há contas.',
    'Cria as tuas contas (à ordem, cartões, poupança, das empresas) e importa o extrato de cada uma — CSV, OFX ou PDF. A partir daí o Farol categoriza, compara com os orçamentos e mostra as tendências.',
    [fnBtn('+ Conta', function(){ fnContaJanela(); }, 'primary')])]);
}

/* ======================= MOVIMENTOS ======================= */
function fnPeriodoMov(){
  var p = FN.mov.periodo;
  if (p === 'mes') return { de: FN.mes + '-01', ate: fnFimMes(FN.mes) };
  if (p === 'm3') return { de: fnSomaMes(FN.mes, -2) + '-01', ate: fnFimMes(FN.mes) };
  if (p === 'm12') return { de: fnSomaMes(FN.mes, -11) + '-01', ate: fnFimMes(FN.mes) };
  return { de: '', ate: '' };
}
function fn_financas_movimentos(corpo){
  if (!FN.base.contas.length) { corpo.appendChild(fnSemContas()); return; }
  fnBarraFiltros(corpo, FN.mov.periodo !== 'tudo', [fnBtn('Importar extrato', function(){ fnImportar(); }), fnBtn('+ Movimento', function(){ fnNovoMovimento(); }, 'primary')]);

  var f = h('div', { class: 'fn-barra' });
  f.appendChild(fnFiltroContas());
  var seg = h('div', { class: 'fn-seg', role: 'group', 'aria-label': 'Estado' });
  [['','Todos'],['categorizar','Por categorizar'],['sugestoes','Sugestões da IA'],['reconciliar','Por reconciliar'],['semdespesa','Sem despesa'],['reembolsos','Reembolsos'],['divididos','Divididos'],['repetidos','Repetidos']].forEach(function(o){
    seg.appendChild(h('button', { type: 'button', class: FN.mov.estado === o[0] ? 'on' : '', onclick: function(){ FN.mov.estado = o[0]; FN.mov.sel = {}; fnRender('financas'); } }, o[1]));
  });
  f.appendChild(seg);
  var sc = fnSelCategorias(FN.mov.categoria, 'Todas as categorias'); sc.setAttribute('aria-label', 'Categoria');
  sc.insertBefore(h('option', { value: 'nenhuma' }, 'Sem categoria'), sc.children[1] || null);
  if (FN.mov.categoria) sc.value = FN.mov.categoria;
  sc.addEventListener('change', function(){ FN.mov.categoria = sc.value; fnRender('financas'); });
  f.appendChild(sc);
  var sp = h('select', { class: 'fn-sel', 'aria-label': 'Período' });
  [['mes','O mês'],['m3','3 meses'],['m12','12 meses'],['tudo','Tudo']].forEach(function(o){ sp.appendChild(h('option', { value: o[0] }, o[1])); });
  sp.value = FN.mov.periodo; sp.addEventListener('change', function(){ FN.mov.periodo = sp.value; fnRender('financas'); });
  f.appendChild(sp);
  var qi = h('input', { class: 'fn-sel', type: 'search', placeholder: 'Procurar descrição ou valor', value: FN.mov.q, 'aria-label': 'Procurar', style: 'flex:1 1 180px' });
  qi.addEventListener('change', function(){ FN.mov.q = qi.value.trim(); fnRender('financas'); });
  f.appendChild(qi);
  corpo.appendChild(f);

  var per = fnPeriodoMov();
  var qs = fnQs({ estado: FN.mov.estado, conta: FN.mov.conta, categoria: FN.mov.categoria, q: FN.mov.q, de: per.de, ate: per.ate, ambito: FN.ambito, area: FN.area, limite: 1500 });
  fnCarregar(corpo, apiGestao('/api/financas/movimentos?' + qs), function(d){
    var ms = d.movimentos;
    var comSug = ms.filter(function(m){ return !m.categoria_id && m.ia_categoria_id && !m.reembolso && !m.divisao; });
    if (comSug.length){
      corpo.appendChild(h('div', { class: 'fn-banner' }, [h('span', { class: 'fn-pill ai' }, '✦ IA'),
        h('div', { class: 'g' }, [h('b', null, comSug.length + (comSug.length === 1 ? ' movimento tem' : ' movimentos têm') + ' categoria sugerida'),
          h('span', { class: 'fn-muted' }, ' · confiança média ' + Math.round(comSug.reduce(function(s, m){ return s + (m.ia_confianca || 0); }, 0) / comSug.length * 100) + '%. Vêm das tuas regras, do histórico e do Gemini.')]),
        fnBtn('Aceitar ' + (comSug.length === 1 ? 'a sugestão' : 'as ' + comSug.length), function(){
          fnApi('/api/financas/movimentos/lote', 'POST', { ids: comSug.map(function(m){ return m.id; }), aceitar: true })
            .then(function(r){ fnAviso(r.feitos + ' categorizados.'); fnMudou(); }, fnErro);
        }, 'primary small')]));
    }
    var reemb = ms.filter(function(m){ return m.reembolso || m.divisao; });
    if (reemb.length && FN.mov.estado !== 'reembolsos'){
      corpo.appendChild(h('div', { class: 'fn-banner' }, [h('span', { class: 'fn-pill ai' }, '✦ Reembolsos'),
        h('div', { class: 'g' }, [h('b', null, reemb.length + (reemb.length === 1 ? ' entrada parece' : ' entradas parecem') + ' alguém a devolver a parte de uma conta'),
          h('span', { class: 'fn-muted' }, ' · pelo nome de quem mandou e por um pagamento teu, dos dias antes, que é múltiplo exato do valor.')]),
        fnBtn('Ver', function(){ FN.mov.estado = 'reembolsos'; FN.mov.sel = {}; fnRender('financas'); }, 'small')]));
    }
    var linha = h('div', { class: 'fn-linha', style: 'align-items:flex-start' });
    var cartao = h('div', { class: 'card largo', style: 'padding:6px 10px' });
    var selN = Object.keys(FN.mov.sel).filter(function(k){ return FN.mov.sel[k]; });
    if (selN.length) cartao.appendChild(fnBarraLote(selN, ms));
    if (!ms.length) cartao.appendChild(fnVazio('Nenhum movimento com estes filtros.', FN.mov.estado ? 'Experimenta «Todos» ou outro período.' : null));
    else {
      var tb = h('tbody');
      ms.forEach(function(m){ tb.appendChild(fnLinhaMov(m)); });
      var tot = ms.reduce(function(s, m){ return s + m.valor; }, 0);
      cartao.appendChild(h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab', style: 'min-width:820px' }, [
        h('thead', null, [h('tr', null, [h('th', { style: 'width:26px' }, [h('input', { type: 'checkbox', 'aria-label': 'Escolher todos', checked: selN.length === ms.length,
          onchange: function(e){ FN.mov.sel = {}; if (e.target.checked) ms.forEach(function(m){ FN.mov.sel[m.id] = true; }); fnRender('financas'); } })]),
          h('th', null, 'Data'), h('th', null, 'Descrição'), h('th', null, 'Categoria'), h('th', null, 'Área'), h('th', null, 'Ligado a'), h('th', { class: 'r' }, 'Valor')])]),
        tb])]));
      cartao.appendChild(h('p', { class: 'fn-nota', style: 'padding:8px' }, ms.length + ' movimentos · entradas ' + fnEur(ms.filter(function(m){ return m.valor > 0; }).reduce(function(s, m){ return s + m.valor; }, 0)) +
        ' · saídas ' + fnEur(ms.filter(function(m){ return m.valor < 0; }).reduce(function(s, m){ return s - m.valor; }, 0)) + ' · saldo ' + fnEur(tot, true)));
    }
    linha.appendChild(cartao);
    var painel = h('div', { class: 'card fn-painel' });
    var aberto = ms.filter(function(m){ return m.id === FN.mov.aberto; })[0];
    if (aberto) fnPainelMov(painel, aberto);
    else painel.appendChild(h('p', { class: 'fn-nota' }, 'Escolhe um movimento para o categorizar, ligar a uma despesa do Farol (com o papel) ou a uma conta corrente.'));
    linha.appendChild(painel);
    corpo.appendChild(linha);
  });
}

/* O filtro das contas: todas, uma, ou várias. Um botão como os outros
   filtros, que abre a lista com a data do último extrato de cada conta. */
function fnFiltroContas(){
  var contas = FN.base.contas.filter(function(c){ return c.ativo; });
  var sel = String(FN.mov.conta || '').split(',').filter(Boolean);
  var rot = !sel.length ? 'Todas as contas' : sel.length === 1 ? ((fnConta(Number(sel[0])) || {}).nome || '1 conta') : sel.length + ' contas';
  var caixa = h('div', { class: 'fn-contas-pop', style: 'display:none;position:absolute;z-index:30;top:calc(100% + 4px);left:0;min-width:280px;max-height:360px;overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:6px' });
  var aplicar = function(lista){ FN.mov.conta = lista.join(','); FN.mov.sel = {}; fnRender('financas'); };
  caixa.appendChild(h('label', { class: 'fn-check', style: 'padding:6px 8px;font-weight:600' }, [
    h('input', { type: 'checkbox', checked: !sel.length, onchange: function(){ aplicar([]); } }), 'Todas as contas']));
  contas.forEach(function(c){
    var on = sel.indexOf(String(c.id)) >= 0;
    caixa.appendChild(h('div', { class: 'fn-acoes', style: 'justify-content:space-between;padding:2px 8px;flex-wrap:nowrap' }, [
      h('label', { class: 'fn-check', style: 'flex:1;min-width:0' }, [h('input', { type: 'checkbox', checked: on, onchange: function(e){
        var l = sel.filter(function(x){ return x !== String(c.id); }); if (e.target.checked) l.push(String(c.id)); aplicar(l); } }),
        h('span', null, [c.nome, h('small', { class: 'fn-muted', style: 'display:block' }, c.movimentos ? 'extrato até ' + fnData(c.atualizado) : 'sem movimentos')])]),
      h('button', { type: 'button', class: 'btn small', title: 'Só esta conta', onclick: function(){ aplicar([String(c.id)]); } }, 'só')]));
  });
  var botao = h('button', { type: 'button', class: 'fn-sel', 'aria-label': 'Contas', 'aria-haspopup': 'true', style: 'text-align:left;min-width:170px' + (sel.length ? ';border-color:var(--accent-ink)' : '') }, rot + ' ▾');
  var fora = function(e){ if (!caixa.contains(e.target) && e.target !== botao){ caixa.style.display = 'none'; document.removeEventListener('click', fora); } };
  botao.addEventListener('click', function(e){ e.stopPropagation(); var abre = caixa.style.display === 'none'; caixa.style.display = abre ? 'block' : 'none';
    if (abre) setTimeout(function(){ document.addEventListener('click', fora); }, 0); });
  return h('div', { style: 'position:relative;display:inline-block' }, [botao, caixa]);
}

/* A categoria muda-se na própria linha: carregar na etiqueta (sugerida,
   escolhida ou por categorizar) abre a lista, e escolher grava logo. */
function fnCatNaLinha(m, conteudo){
  var wrap = h('div', { class: 'fn-acoes', style: 'flex-wrap:nowrap' });
  var mostrar = function(){
    clear(wrap);
    var sc = fnSelCategorias(m.categoria_id || m.ia_categoria_id, '— sem categoria —');
    sc.style.maxWidth = '230px';
    sc.addEventListener('click', function(e){ e.stopPropagation(); });
    sc.addEventListener('change', function(){
      var v = sc.value ? Number(sc.value) : null;
      fnApi('/api/financas/movimentos/' + m.id, 'PATCH', { categoria_id: v, aceite: !m.categoria_id && v && v === m.ia_categoria_id })
        .then(function(){ fnMudou(); }, fnErro);
    });
    sc.addEventListener('keydown', function(e){ if (e.key === 'Escape'){ e.stopPropagation(); pronto(); } });
    sc.addEventListener('blur', function(){ setTimeout(function(){ if (document.activeElement !== sc) pronto(); }, 150); });
    wrap.appendChild(sc);
    setTimeout(function(){ sc.focus(); }, 0);
  };
  var pronto = function(){ clear(wrap); conteudo.forEach(function(c){ wrap.appendChild(c); }); };
  conteudo[0].style.cursor = 'pointer';
  conteudo[0].setAttribute('title', (conteudo[0].getAttribute('title') ? conteudo[0].getAttribute('title') + ' · ' : '') + 'Carrega para mudar a categoria');
  conteudo[0].addEventListener('click', function(e){ e.stopPropagation(); mostrar(); });
  pronto();
  return wrap;
}

function fnLinhaMov(m){
  var cat;
  if (m.categoria_id) cat = h('span', { class: 'fn-pill' + (m.natureza === 'transferencia' || m.natureza === 'financiamento' || m.natureza === 'acerto' ? ' tr' : m.natureza === 'receita' ? ' good' : '') }, fnCatNome(m.categoria_id));
  else if (m.ia_categoria_id) cat = h('div', { class: 'fn-acoes' }, [h('span', { class: 'fn-pill ai', title: 'Sugestão: ' + ({ historico: 'histórico', modelo: 'Gemini', transferencia: 'transferência entre contas' }[m.ia_fonte] || m.ia_fonte) },
      '✦ ' + fnCatNome(m.ia_categoria_id, true) + ' · ' + Math.round((m.ia_confianca || 0) * 100) + '%'),
    h('button', { type: 'button', class: 'btn small', onclick: function(e){ e.stopPropagation();
      fnApi('/api/financas/movimentos/' + m.id, 'PATCH', { categoria_id: m.ia_categoria_id, aceite: true }).then(function(){ fnMudou(); }, fnErro); } }, 'Aceitar')]);
  else cat = h('span', { class: 'fn-pill warn' }, 'por categorizar');
  cat = fnCatNaLinha(m, cat.classList.contains('fn-acoes') ? Array.prototype.slice.call(cat.childNodes) : [cat]);
  var lig = [];
  if (m.expense_id) lig.push(h('span', { class: 'fn-pill good', title: m.despesa || '' }, (m.despesa_papel ? 'papel · ' : 'despesa · ') + (m.despesa || '').slice(0, 24)));
  if (m.cc_pessoa) lig.push(h('span', { class: 'fn-pill tr' }, (m.cc_origem === 'reembolso' ? 'reembolso · ' : 'c/c · ') + m.cc_pessoa));
  var outros = (m.partes || []).filter(function(p){ return p.pessoa_id; });
  if (outros.length) lig.push(h('span', { class: 'fn-pill tr', title: outros.map(function(p){ return p.pessoa + ' ' + fnEur(-p.valor); }).join(' · ') },
    'dividido · ' + outros.map(function(p){ return (p.pessoa || '').split(' ')[0]; }).join(', ')));
  if (m.reembolso) lig.push(h('div', { class: 'fn-acoes' }, [h('span', { class: 'fn-pill ai', title: m.reembolso.motivo }, '✦ de ' + m.reembolso.nome + '?'),
    h('button', { type: 'button', class: 'btn small', onclick: function(e){ e.stopPropagation();
      fnApi('/api/financas/movimentos/' + m.id, 'PATCH', { cc_pessoa_id: m.reembolso.pessoa_id }).then(function(){ fnAviso('Reembolso de ' + m.reembolso.nome + '.'); fnMudou(); }, fnErro); } }, 'Sim')]));
  else if (m.divisao) lig.push(h('div', { class: 'fn-acoes' }, [h('span', { class: 'fn-pill ai', title: fnTextoDivisao(m.divisao) }, '✦ parte de «' + m.divisao.descricao.slice(0, 18) + '»?'),
    h('button', { type: 'button', class: 'btn small', onclick: function(e){ e.stopPropagation(); fnAceitarDivisao(m.id, m.divisao); } }, 'Sim')]));
  if (!lig.length && m.valor < 0 && m.natureza === 'despesa') lig.push(h('span', { class: 'fn-muted', style: 'font-size:.75rem' }, '—'));
  var conta = fnConta(m.conta_id);
  var tr = h('tr', { class: 'clic' + (FN.mov.aberto === m.id ? ' on' : ''), onclick: function(){ FN.mov.aberto = FN.mov.aberto === m.id ? null : m.id; fnRender('financas'); } }, [
    h('td', { onclick: function(e){ e.stopPropagation(); } }, [h('input', { type: 'checkbox', 'aria-label': 'Escolher', checked: !!FN.mov.sel[m.id], onchange: function(e){ FN.mov.sel[m.id] = e.target.checked; fnRender('financas'); } })]),
    h('td', { class: 'fn-n', style: 'font-size:.75rem' }, fnData(m.data)),
    h('td', null, [h('span', { class: 'd', title: m.descricao }, m.descricao), h('small', null, (conta ? conta.nome : '') + (m.categoria_fonte === 'regra' ? ' · regra' : ''))]),
    h('td', null, [cat]),
    h('td', { style: 'font-size:.75rem' }, fnCtxNome(m.context_id || (conta && conta.context_id)) || h('span', { class: 'fn-muted' }, '—')),
    h('td', null, lig),
    h('td', { class: 'r ' + (m.valor > 0 ? 'fn-good' : '') }, [fnEur(m.valor, true), fnMinhaParte(m)])
  ]);
  return tr;
}

/* Num movimento dividido, a parte que e mesmo do Marco. */
function fnMinhaParte(m){
  if (!m.partes || !m.partes.length) return null;
  var minha = m.partes.filter(function(p){ return !p.pessoa_id; }).reduce(function(s, p){ return s + p.valor; }, 0);
  return h('small', { style: 'display:block', class: 'fn-muted' }, 'tua parte ' + fnEur(minha));
}

function fnBarraLote(ids, ms){
  var sc = fnSelCategorias('', 'Categoria…');
  var debs = (ms || []).filter(function(m){ return FN.mov.sel[m.id] && m.valor < 0; });
  var sa = fnSelAreas('', 'Área…');
  return h('div', { class: 'fn-barra', style: 'padding:8px;border-bottom:1px solid var(--line)' }, [
    h('b', null, ids.length + ' escolhidos'), sc,
    fnBtn('Categorizar', function(){ if (!sc.value) return fnAviso('Escolhe a categoria.');
      fnApi('/api/financas/movimentos/lote', 'POST', { ids: ids, categoria_id: Number(sc.value) }).then(function(r){ FN.mov.sel = {}; fnAviso(r.feitos + ' categorizados.'); fnMudou(); }, fnErro); }, 'small'),
    sa,
    fnBtn('Pôr na área', function(){
      fnApi('/api/financas/movimentos/lote', 'POST', { ids: ids, context_id: sa.value ? Number(sa.value) : null }).then(function(r){ FN.mov.sel = {}; fnAviso(r.feitos + ' arrumados.'); fnMudou(); }, fnErro); }, 'small'),
    debs.length ? fnBtn('Dividir com… (' + debs.length + ')', function(){ fnDividirGrupoJanela(debs); }, 'small') : null,
    fnBtn('Aceitar sugestões', function(){
      fnApi('/api/financas/movimentos/lote', 'POST', { ids: ids, aceitar: true }).then(function(r){ FN.mov.sel = {}; fnAviso(r.feitos + ' categorizados.'); fnMudou(); }, fnErro); }, 'small'),
    fnBtn('Apagar', function(){
      fnJanela('Apagar ' + ids.length + ' movimentos?', [h('p', null, 'Saem do Farol. Se voltares a importar o mesmo extrato, voltam a entrar.')], [{ txt: 'Apagar', pri: true, fn: function(){
        return fnApi('/api/financas/movimentos/lote', 'POST', { ids: ids, apagar: true }).then(function(r){ FN.mov.sel = {}; fnAviso(r.feitos + ' apagados.'); fnMudou(); }, fnErro); } }]);
    }, 'small'),
    fnBtn('Limpar', function(){ FN.mov.sel = {}; fnRender('financas'); }, 'small')
  ]);
}

/* O painel do movimento: categoria, área, conta corrente, e a reconciliação
   com as despesas do Farol. */
function fnPainelMov(p, m){
  var conta = fnConta(m.conta_id);
  p.appendChild(h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('h3', { style: 'font-size:1.05rem' }, 'Movimento'), h('button', { type: 'button', class: 'btn small', onclick: function(){ FN.mov.aberto = null; fnRender('financas'); } }, 'Fechar')]));
  p.appendChild(h('div', { class: 'fn-caixa', style: 'background:var(--surface-2)' }, [
    h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, m.descricao), h('b', { class: 'fn-n ' + (m.valor > 0 ? 'fn-good' : '') }, fnEur(m.valor, true))]),
    h('small', { class: 'fn-muted' }, fnData(m.data) + ' · ' + (conta ? conta.nome : '') + (m.saldo != null ? ' · saldo ' + fnEur(m.saldo) : ''))]));

  var sc = fnSelCategorias(m.categoria_id || m.ia_categoria_id);
  var sa = fnSelAreas(m.context_id);
  var sp = h('select', { class: 'fn-sel' }, [h('option', { value: '' }, '— nenhuma —')]);
  var nota = h('input', { class: 'fn-in', value: m.nota || '', placeholder: 'Nota' });
  var regra = h('input', { type: 'checkbox' });
  var padrao = h('input', { class: 'fn-in', value: fnChaveDesc(m.descricao), 'aria-label': 'Texto da regra' });
  apiGestao('/api/financas/cc').then(function(c){
    c.pessoas.filter(function(x){ return x.ativo; }).forEach(function(x){ sp.appendChild(h('option', { value: x.id }, x.nome)); });
    if (m.cc_pessoa_id) sp.value = String(m.cc_pessoa_id);
  }, function(){});
  p.appendChild(h('div', { class: 'fn-campos' }, [fnCampo('Categoria' + (!m.categoria_id && m.ia_categoria_id ? ' (sugerida)' : ''), sc), fnCampo('Área', sa)]));
  p.appendChild(fnCampo('Conta corrente de', sp));
  p.appendChild(fnCampo('Nota', nota));
  p.appendChild(h('label', { class: 'fn-check' }, [regra, 'Criar regra: quando a descrição tiver']));
  p.appendChild(padrao);
  p.appendChild(h('div', { class: 'fn-acoes' }, [fnBtn('Guardar', function(){
    var corpo = { categoria_id: sc.value ? Number(sc.value) : null, context_id: sa.value ? Number(sa.value) : null, nota: nota.value,
      cc_pessoa_id: sp.value ? Number(sp.value) : null, aceite: !m.categoria_id && m.ia_categoria_id && String(m.ia_categoria_id) === sc.value };
    if (regra.checked) { corpo.criar_regra = true; corpo.regra_padrao = padrao.value; }
    fnApi('/api/financas/movimentos/' + m.id, 'PATCH', corpo).then(function(){ fnAviso('Guardado.'); fnMudou(); }, fnErro);
  }, 'primary small'), fnBtn('Apagar movimento', function(){
    fnJanela('Apagar este movimento?', [h('p', null, m.descricao + ' · ' + fnEur(m.valor))], [{ txt: 'Apagar', pri: true, fn: function(){
      return fnApi('/api/financas/movimentos/' + m.id, 'DELETE').then(function(){ FN.mov.aberto = null; fnMudou(); }, fnErro); } }]);
  }, 'small')]));

  if (m.valor > 0) { fnPainelReembolso(p, m); return; }
  if (m.valor === 0) return;
  fnPainelDivisao(p, m);
  p.appendChild(h('div', { class: 'mono', style: 'margin-top:6px' }, 'Despesa no Farol'));
  if (m.expense_id){
    p.appendChild(h('div', { class: 'fn-caixa melhor' }, [h('b', null, m.despesa || 'Despesa'),
      h('small', { class: 'fn-muted' }, (m.despesa_papel ? 'Com papel na caixa. ' : '') + (m.despesa_splitwise ? 'Dividida no Splitwise.' : '')),
      h('div', { class: 'fn-acoes' }, [fnBtn('Desligar', function(){ fnApi('/api/financas/movimentos/' + m.id, 'PATCH', { expense_id: null }).then(function(){ fnMudou(); }, fnErro); }, 'small')])]));
    return;
  }
  var cx = h('div', { class: 'fn-lista' }, [h('p', { class: 'fn-nota' }, 'A procurar…')]);
  p.appendChild(cx);
  apiGestao('/api/financas/movimentos/' + m.id + '/candidatos').then(function(r){
    clear(cx);
    if (!r.candidatos.length) cx.appendChild(h('p', { class: 'fn-nota' }, 'Nenhuma despesa do Farol com este valor perto desta data.'));
    r.candidatos.forEach(function(e, i){
      cx.appendChild(h('div', { class: 'fn-caixa' + (i === 0 ? ' melhor' : ''), style: 'margin-bottom:6px' }, [
        h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, e.description), h('span', { class: 'fn-pill ai' }, '✦ ' + Math.round(e.confianca * 100) + '%')]),
        h('small', { class: 'fn-muted' }, fnData(e.spent_on) + ' · ' + fnEur(e.amount) + (e.de_pagamento ? ' · de um pagamento' : '') + (e.tem_papel ? ' · com papel' : '')),
        h('div', { class: 'fn-acoes' }, [fnBtn('Ligar', function(){ fnApi('/api/financas/movimentos/' + m.id, 'PATCH', { expense_id: e.id }).then(function(){ fnAviso('Ligado.'); fnMudou(); }, fnErro); }, 'primary small'),
          h('span', { class: 'fn-nota' }, Math.abs(e.dias) === 0 ? 'mesmo dia' : Math.abs(e.dias) + (Math.abs(e.dias) === 1 ? ' dia' : ' dias'))])]));
    });
    cx.appendChild(fnBtn('Não é nenhuma · criar a despesa', function(){
      fnApi('/api/financas/movimentos/' + m.id + '/despesa', 'POST', {}).then(function(){ fnAviso('Despesa criada e ligada.'); fnMudou(); }, fnErro);
    }, 'small'));
    cx.appendChild(h('p', { class: 'fn-nota', style: 'margin-top:6px' }, 'Ligar não cria nada novo: o movimento do banco passa a ser a prova de que a despesa foi paga, e a despesa deixa de contar duas vezes.'));
  }, function(e){ clear(cx); cx.appendChild(h('p', { class: 'fn-nota' }, e.message)); });
}
/* Conta dividida: pagaste por todos e os outros devolvem a parte deles. */
function fnPainelDivisao(p, m){
  p.appendChild(h('div', { class: 'mono', style: 'margin-top:6px' }, 'Conta dividida'));
  var outros = (m.partes || []).filter(function(x){ return x.pessoa_id; });
  if (!outros.length){
    p.appendChild(h('div', { class: 'fn-caixa' }, [h('small', { class: 'fn-muted' }, 'Pagaste por outros (um jantar, um presente)? Divide: só a tua parte conta como despesa e o resto fica a receber de cada um.'),
      h('div', { class: 'fn-acoes' }, [fnBtn('Dividir a conta…', function(){ fnDividirJanela(m); }, 'small')])]));
    return;
  }
  var minha = (m.partes || []).filter(function(x){ return !x.pessoa_id; })[0];
  p.appendChild(h('div', { class: 'fn-caixa melhor' }, [
    h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, ['A tua parte', h('small', null, minha && minha.categoria_id ? fnCatNome(minha.categoria_id) : 'sem categoria')]), h('span', { class: 'fn-n' }, fnEur(minha ? -minha.valor : 0))])
  ].concat(outros.map(function(x){ return h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [x.pessoa, h('small', null, 'a receber · conta corrente')]), h('span', { class: 'fn-n fn-good' }, fnEur(-x.valor))]); })).concat([
    h('div', { class: 'fn-acoes' }, [fnBtn('Alterar', function(){ fnDividirJanela(m); }, 'small'),
      fnBtn('Desfazer', function(){ fnApi('/api/financas/movimentos/' + m.id + '/partes', 'DELETE').then(function(){ fnAviso('Divisão desfeita.'); fnMudou(); }, fnErro); }, 'small')])])));
}

function fnDividirJanela(m){
  var total = -m.valor;
  var pessoas = [];
  var lista = h('datalist', { id: 'fn-dl-pessoas' });
  var linhas = h('div');
  var catSel = fnSelCategorias(((m.partes || []).filter(function(x){ return !x.pessoa_id; })[0] || {}).categoria_id || m.categoria_id || m.ia_categoria_id, '— categoria da tua parte —', 'despesa');
  var desc = h('input', { class: 'fn-in', value: '', placeholder: m.descricao });
  var nTot = h('input', { class: 'fn-in', type: 'number', min: '2', step: '1', value: String(Math.max(2, ((m.partes || []).filter(function(x){ return x.pessoa_id; }).length || 1) + 1)), style: 'width:70px' });
  var resumo = h('p', { class: 'fn-nota' });
  function num(v){ var n = Number(String(v || '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
  function atualizar(){
    var soma = 0;
    linhas.querySelectorAll('.fn-dv-v').forEach(function(i){ soma += num(i.value); });
    var minha = Math.round((total - soma) * 100) / 100;
    resumo.textContent = minha < -0.004 ? 'A parte dos outros passa o total (' + fnEur(total) + ').' : 'A tua parte: ' + fnEur(minha) + ' de ' + fnEur(total) + '. Só esta conta como despesa.';
    resumo.style.color = minha < -0.004 ? 'var(--bad)' : '';
  }
  function linha(nome, valor){
    var ni = h('input', { class: 'fn-in fn-dv-n', list: 'fn-dl-pessoas', value: nome || '', placeholder: 'Nome', style: 'flex:2 1 140px' });
    var vi = h('input', { class: 'fn-in fn-dv-v', inputmode: 'decimal', value: valor != null ? String(valor.toFixed(2)).replace('.', ',') : '', placeholder: '0,00', style: 'flex:1 1 80px' });
    vi.addEventListener('input', atualizar);
    var row = h('div', { class: 'fn-acoes', style: 'margin-bottom:6px;flex-wrap:nowrap' }, [ni, vi,
      h('button', { type: 'button', class: 'btn small', 'aria-label': 'Tirar', onclick: function(){ row.parentNode.removeChild(row); atualizar(); } }, '×')]);
    linhas.appendChild(row);
    return row;
  }
  function porIgual(){
    var n = Math.max(2, Math.round(num(nTot.value)) || 2);
    var cada = Math.floor(total / n * 100) / 100;
    var rows = linhas.querySelectorAll('.fn-dv-n');
    var nomes = []; rows.forEach(function(i){ nomes.push(i.value); });
    clear(linhas);
    for (var i = 0; i < n - 1; i++) linha(nomes[i] || '', cada);
    atualizar();
  }
  var antes = (m.partes || []).filter(function(x){ return x.pessoa_id; });
  if (antes.length) antes.forEach(function(x){ linha(x.pessoa, -x.valor); });
  apiGestao('/api/financas/cc').then(function(c){
    pessoas = c.pessoas.filter(function(x){ return x.ativo; });
    pessoas.forEach(function(x){ lista.appendChild(h('option', { value: x.nome })); });
  }, function(){});
  fnJanela('Dividir a conta', [
    h('p', { class: 'fn-nota' }, m.descricao + ' · ' + fnData(m.data) + ' · pagaste ' + fnEur(total) + '.'),
    h('div', { class: 'fn-acoes', style: 'align-items:center' }, [h('span', null, 'Éramos'), nTot, fnBtn('Dividir por igual', porIgual, 'small')]),
    h('div', { class: 'mono', style: 'margin-top:8px' }, 'Quem te deve e quanto'), lista, linhas,
    fnBtn('+ Pessoa', function(){ linha('', null); }, 'small'),
    fnCampo('A tua parte vai para', catSel),
    fnCampo('Descrição nas contas correntes (opcional)', desc),
    resumo,
    h('p', { class: 'fn-nota' }, 'Escreve o nome de quem já está nas contas correntes, ou um nome novo: a pessoa é criada. Quando te devolverem, a transferência liga-se como reembolso.')
  ], [{ txt: 'Guardar', pri: true, fn: function(){
    var outros = [];
    linhas.querySelectorAll('.fn-acoes').forEach(function(r){
      var n = r.querySelector('.fn-dv-n').value.trim(), v = num(r.querySelector('.fn-dv-v').value);
      if (!n && !v) return;
      var ex = pessoas.filter(function(x){ return x.nome.toLowerCase() === n.toLowerCase(); })[0];
      outros.push(ex ? { pessoa_id: ex.id, valor: v } : { nome: n, valor: v });
    });
    if (!outros.length) { fnAviso('Falta com quem dividir.'); return false; }
    if (outros.some(function(o){ return !(o.valor > 0) || (!o.pessoa_id && !o.nome); })) { fnAviso('Cada pessoa precisa de nome e valor.'); return false; }
    return fnApi('/api/financas/movimentos/' + m.id + '/partes', 'PUT', { outros: outros, categoria_id: catSel.value ? Number(catSel.value) : null, descricao: desc.value.trim() })
      .then(function(r){ fnAviso('Dividido: a tua parte ' + fnEur(r.minha) + ', a receber ' + fnEur(r.outros) + '.'); fnMudou(); }, fnErro);
  } }]);
  if (!antes.length) porIgual(); else atualizar();
}

/* A explicação de uma sugestão de conta dividida. */
function fnTextoDivisao(d){
  var nomes = d.pagos.map(function(x){ return x.nome; });
  var quem = nomes.length === 1 ? nomes[0] + ' mandou ' : nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] + ' mandaram ';
  return quem + fnEur(d.parte) + (nomes.length > 1 ? ' cada' : '') + '. «' + d.descricao + '» (' + fnData(d.data) + ', ' + fnEur(d.total) + ') dá ' + fnEur(d.parte) + ' a dividir por ' + d.pessoas +
    (d.juntar ? '; já estava dividido e junta-se ' + (nomes.length > 1 ? 'quem falta' : nomes[0]) + '.' : '.') +
    (d.pessoas > nomes.length + 1 ? ' Falta(m) ' + (d.pessoas - nomes.length - 1) + ' por devolver: entram quando mandarem.' : '');
}
function fnAceitarDivisao(creditoId, d){
  return fnApi('/api/financas/movimentos/' + creditoId + '/devolucao', 'POST', { debito_id: d.movimento_id, creditos: d.pagos.map(function(x){ return { id: x.id }; }) })
    .then(function(r){ fnAviso('Dividido: a tua parte ' + fnEur(r.minha) + ' · ' + r.ligados + (r.ligados === 1 ? ' reembolso ligado.' : ' reembolsos ligados.')); fnMudou(); }, fnErro);
}

/* Vários pagamentos (as viagens de Uber de um fim de semana) divididos pelo
   grupo de uma vez: o total reparte-se por quem andou, e a parte de cada um
   fica na conta corrente dele, repartida pelos pagamentos. */
function fnDividirGrupoJanela(debs){
  var total = Math.round(debs.reduce(function(s, m){ return s - m.valor; }, 0) * 100) / 100;
  var pessoas = [];
  var lista = h('datalist', { id: 'fn-dl-pessoas-g' });
  var linhas = h('div');
  var catSel = fnSelCategorias('', '— manter a categoria de cada pagamento —', 'despesa');
  var desc = h('input', { class: 'fn-in', placeholder: 'Ex.: Ubers do fim de semana em Lisboa' });
  var nTot = h('input', { class: 'fn-in', type: 'number', min: '2', step: '1', value: '2', style: 'width:70px' });
  var resumo = h('p', { class: 'fn-nota' });
  function num(v){ var n = Number(String(v || '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
  function atualizar(){
    var soma = 0; linhas.querySelectorAll('.fn-dv-v').forEach(function(i){ soma += num(i.value); });
    var minha = Math.round((total - soma) * 100) / 100;
    resumo.textContent = minha < -0.004 ? 'A parte dos outros passa o total (' + fnEur(total) + ').' : 'A tua parte: ' + fnEur(minha) + ' de ' + fnEur(total) + '. Cada pessoa fica com a sua parte repartida pelos ' + debs.length + ' pagamentos.';
    resumo.style.color = minha < -0.004 ? 'var(--bad)' : '';
  }
  function linha(nome, valor){
    var ni = h('input', { class: 'fn-in fn-dv-n', list: 'fn-dl-pessoas-g', value: nome || '', placeholder: 'Nome', style: 'flex:2 1 140px' });
    var vi = h('input', { class: 'fn-in fn-dv-v', inputmode: 'decimal', value: valor != null ? String(valor.toFixed(2)).replace('.', ',') : '', placeholder: '0,00', style: 'flex:1 1 80px' });
    vi.addEventListener('input', atualizar);
    var row = h('div', { class: 'fn-acoes', style: 'margin-bottom:6px;flex-wrap:nowrap' }, [ni, vi,
      h('button', { type: 'button', class: 'btn small', 'aria-label': 'Tirar', onclick: function(){ row.parentNode.removeChild(row); atualizar(); } }, '×')]);
    linhas.appendChild(row);
  }
  function porIgual(){
    var n = Math.max(2, Math.round(num(nTot.value)) || 2);
    var cada = Math.floor(total / n * 100) / 100;
    var nomes = []; linhas.querySelectorAll('.fn-dv-n').forEach(function(i){ nomes.push(i.value); });
    clear(linhas);
    for (var i = 0; i < n - 1; i++) linha(nomes[i] || '', cada);
    atualizar();
  }
  apiGestao('/api/financas/cc').then(function(c){
    pessoas = c.pessoas.filter(function(x){ return x.ativo; });
    pessoas.forEach(function(x){ lista.appendChild(h('option', { value: x.nome })); });
  }, function(){});
  var lst = h('div', { class: 'fn-lista', style: 'max-height:150px;overflow:auto;margin-bottom:6px' }, debs.map(function(m){
    return h('div', { class: 'fn-li' }, [h('span', { class: 'fn-n fn-muted', style: 'width:52px;font-size:.75rem' }, fnData(m.data)), h('div', { class: 'g' }, m.descricao), h('span', { class: 'fn-n' }, fnEur(-m.valor))]);
  }));
  fnJanela('Dividir ' + debs.length + (debs.length === 1 ? ' pagamento' : ' pagamentos') + ' com o grupo', [
    lst,
    h('p', { class: 'fn-nota' }, 'Total pago: ' + fnEur(total) + '.'),
    h('div', { class: 'fn-acoes', style: 'align-items:center' }, [h('span', null, 'Éramos'), nTot, fnBtn('Dividir por igual', porIgual, 'small')]),
    h('div', { class: 'mono', style: 'margin-top:8px' }, 'Quem te deve e quanto, no total'), lista, linhas,
    fnBtn('+ Pessoa', function(){ linha('', null); }, 'small'),
    fnCampo('Descrição nas contas correntes (opcional)', desc),
    fnCampo('A tua parte vai para', catSel),
    resumo
  ], [{ txt: 'Guardar', pri: true, fn: function(){
    var outros = [];
    linhas.querySelectorAll('.fn-acoes').forEach(function(r){
      var n = r.querySelector('.fn-dv-n').value.trim(), v = num(r.querySelector('.fn-dv-v').value);
      if (!n && !v) return;
      var ex = pessoas.filter(function(x){ return x.nome.toLowerCase() === n.toLowerCase(); })[0];
      outros.push(ex ? { pessoa_id: ex.id, valor: v } : { nome: n, valor: v });
    });
    if (!outros.length) { fnAviso('Falta com quem dividir.'); return false; }
    if (outros.some(function(o){ return !(o.valor > 0) || (!o.pessoa_id && !o.nome); })) { fnAviso('Cada pessoa precisa de nome e valor.'); return false; }
    return fnApi('/api/financas/movimentos/dividir-grupo', 'POST', { ids: debs.map(function(m){ return m.id; }), outros: outros,
      categoria_id: catSel.value ? Number(catSel.value) : null, descricao: desc.value.trim() })
      .then(function(r){ FN.mov.sel = {}; fnAviso('Dividido em ' + r.pagamentos + ' pagamentos: a tua parte ' + fnEur(r.minha) + ', a receber ' + fnEur(r.outros) + '.'); fnMudou(); }, fnErro);
  } }]);
  porIgual();
}

/* Uma entrada pode ser alguém a devolver a parte de uma conta dividida. */
function fnPainelReembolso(p, m){
  if (m.cc_pessoa_id) {
    p.appendChild(h('div', { class: 'fn-caixa melhor', style: 'margin-top:6px' }, [h('b', null, (m.cc_origem === 'reembolso' ? 'Reembolso de ' : 'Acerto com ') + m.cc_pessoa),
      h('small', { class: 'fn-muted' }, 'Abate no que a pessoa te devia. Não conta como receita.'),
      h('div', { class: 'fn-acoes' }, [fnBtn('Desligar', function(){ fnApi('/api/financas/movimentos/' + m.id, 'PATCH', { cc_pessoa_id: null }).then(function(){ fnMudou(); }, fnErro); }, 'small')])]));
    return;
  }
  p.appendChild(h('div', { class: 'mono', style: 'margin-top:6px' }, 'É alguém a devolver?'));
  var cx = h('div', { class: 'fn-lista' }, [h('p', { class: 'fn-nota' }, 'A procurar…')]);
  p.appendChild(cx);
  apiGestao('/api/financas/movimentos/' + m.id + '/candidatos').then(function(r){
    clear(cx);
    if (r.divisao) {
      cx.appendChild(h('div', { class: 'fn-caixa melhor', style: 'margin-bottom:6px' }, [
        h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, 'Parte de «' + r.divisao.descricao + '»'), h('span', { class: 'fn-pill ai' }, '✦ ' + Math.round(r.divisao.confianca * 100) + '%')]),
        h('small', { class: 'fn-muted' }, fnTextoDivisao(r.divisao)),
        h('div', { class: 'fn-acoes' }, [fnBtn('Dividir e ligar', function(){ fnAceitarDivisao(m.id, r.divisao); }, 'primary small')])]));
    }
    (r.pessoas || []).forEach(function(x, i){
      cx.appendChild(h('div', { class: 'fn-caixa' + (i === 0 ? ' melhor' : ''), style: 'margin-bottom:6px' }, [
        h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, x.nome), h('span', { class: 'fn-pill ai' }, '✦ ' + Math.round(x.confianca * 100) + '%')]),
        h('small', { class: 'fn-muted' }, 'Deve ' + fnEur(x.aberto) + ' · ' + x.motivo + '.'),
        h('div', { class: 'fn-acoes' }, [fnBtn('É reembolso de ' + x.nome.split(' ')[0], function(){
          fnApi('/api/financas/movimentos/' + m.id, 'PATCH', { cc_pessoa_id: x.pessoa_id }).then(function(){ fnAviso('Ligado.'); fnMudou(); }, fnErro); }, 'primary small')])]));
    });
    /* À mão: escolher o pagamento de que isto é a parte. */
    if (r.debitos && r.debitos.length) {
      /* Um ou mais pagamentos: a entrada reparte-se por eles na proporção
         do valor de cada um (várias viagens de Uber, por exemplo). */
      var esc = {};
      var tot = h('small', { class: 'fn-muted' }, 'Nenhum pagamento escolhido.');
      var contar = function(){
        var ids = Object.keys(esc).filter(function(k){ return esc[k]; });
        var soma = r.debitos.filter(function(d){ return esc[d.id]; }).reduce(function(s, d){ return s - d.valor; }, 0);
        tot.textContent = !ids.length ? 'Nenhum pagamento escolhido.' : ids.length + (ids.length === 1 ? ' pagamento' : ' pagamentos') + ' · ' + fnEur(soma) + ' · desta entrada: ' + fnEur(m.valor) + (m.valor > soma + 0.005 ? ' (é mais do que os pagamentos)' : '');
      };
      var ld = h('div', { class: 'fn-lista', style: 'max-height:200px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:2px 6px' }, r.debitos.map(function(d){
        return h('label', { class: 'fn-check', style: 'padding:3px 0;align-items:flex-start' }, [h('input', { type: 'checkbox', onchange: function(e){ esc[d.id] = e.target.checked; contar(); } }),
          h('span', { style: 'flex:1;min-width:0' }, [fnData(d.data) + ' · ' + d.descricao.slice(0, 34), h('small', { class: 'fn-muted', style: 'display:block' }, fnEur(d.valor) + (d.dividido ? ' · já dividido' : ''))])]);
      }));
      var nm = h('input', { class: 'fn-in', value: r.pagador || '', placeholder: 'Quem mandou' });
      cx.appendChild(h('div', { class: 'fn-caixa' }, [h('small', { class: 'fn-muted' }, (r.divisao || (r.pessoas && r.pessoas.length) ? 'Não é isso? ' : '') + 'É a parte de alguém numa ou mais contas que pagaste? Escolhe os pagamentos: ficam divididos e esta entrada liga-se como reembolso.'),
        ld, tot, nm, h('div', { class: 'fn-acoes' }, [fnBtn('Dividir e ligar', function(){
          var ids = Object.keys(esc).filter(function(k){ return esc[k]; }).map(Number);
          if (!ids.length) return fnAviso('Escolhe um ou mais pagamentos.');
          if (!nm.value.trim()) return fnAviso('Falta quem mandou.');
          fnApi('/api/financas/movimentos/' + m.id + '/devolucao', 'POST', { debito_ids: ids, creditos: [{ id: m.id, nome: nm.value.trim() }] })
            .then(function(x){ fnAviso('Dividido em ' + x.pagamentos + (x.pagamentos === 1 ? ' pagamento' : ' pagamentos') + ': a tua parte ' + fnEur(x.minha) + '.'); fnMudou(); }, fnErro);
        }, 'small')])]));
    } else if (!r.divisao && !(r.pessoas && r.pessoas.length)) {
      cx.appendChild(h('p', { class: 'fn-nota' }, 'Nada bate com esta entrada. Se for alguém a acertar contas, escolhe a pessoa em «Conta corrente de» e guarda.'));
    }
  }, function(e){ clear(cx); cx.appendChild(h('p', { class: 'fn-nota' }, e.message)); });
}

function fnChaveDesc(s){
  return String(s || '').replace(/\d{3,}/g, ' ').replace(/\b(COMPRA|PAGAMENTO|TRF|DD|MB WAY|IMEDIATA)\b/gi, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ');
}

/* Importar um extrato: escolher a conta e o ficheiro; da primeira vez num
   CSV, confirmar o que é cada coluna. */
function fnImportar(contaId){
  var sc = fnSelContas(contaId || String(FN.mov.conta || '').split(',')[0] || '', false);
  var fi = h('input', { type: 'file', class: 'fn-in', accept: '.csv,.txt,.ofx,.qfx,.pdf' });
  var aviso = h('p', { class: 'fn-nota' }, 'CSV de qualquer banco, OFX, ou PDF do extrato (lido pela IA). O mesmo extrato importado duas vezes não duplica nada.');
  var j = fnJanela('Importar extrato', [
    FN.base.contas.length ? fnCampo('Conta', sc) : h('p', null, 'Primeiro cria uma conta.'),
    fnCampo('Ficheiro', fi), aviso,
    h('div', { class: 'fn-acoes' }, [fnBtn('+ Conta nova', function(){ j.fechar(); fnContaJanela(); }, 'small')])
  ], [{ txt: 'Importar', pri: true, fn: function(){
    if (!fi.files[0] || !sc.value) { fnAviso('Escolhe a conta e o ficheiro.'); return false; }
    aviso.textContent = 'A ler o ficheiro…';
    return fnEnviarExtrato(sc.value, fi.files[0], null);
  } }]);
}
function fnEnviarExtrato(contaId, ficheiro, mapa){
  var fd = new FormData(); fd.append('ficheiro', ficheiro);
  if (mapa) fd.append('mapa', JSON.stringify(mapa));
  return apiGestao('/api/financas/contas/' + contaId + '/importar', { method: 'POST', body: fd }).then(function(r){
    if (r.precisa_mapa) { fnMapaJanela(contaId, ficheiro, r); return true; }
    fnJanela('Extrato importado', [h('p', null, r.lidos + ' movimentos lidos, de ' + fnData(r.de) + ' a ' + fnData(r.ate) + '.'),
      h('p', null, [h('b', null, r.novos + ' novos'), r.repetidos ? ' · ' + r.repetidos + ' já estavam no Farol' : '']),
      h('p', { class: 'fn-nota' }, r.novos ? 'As regras já foram aplicadas. A IA está a sugerir categorias para o resto — aparecem em Movimentos › Sugestões da IA dentro de um minuto.' : '')], []);
    fnMudou();
    return true;
  }, fnErro);
}
function fnMapaJanela(contaId, ficheiro, r){
  var mapa = Object.assign({}, r.mapa || {});
  var campos = [['data','Data'],['descricao','Descrição'],['valor','Valor (uma coluna, com sinal)'],['debito','Débito'],['credito','Crédito'],['saldo','Saldo']];
  var sels = {};
  var grade = h('div', { class: 'fn-campos' });
  campos.forEach(function(c){
    var s = h('select', { class: 'fn-sel' }, [h('option', { value: '' }, '—')]);
    r.colunas.forEach(function(nome, i){ s.appendChild(h('option', { value: i }, nome)); });
    if (mapa[c[0]] != null) s.value = String(mapa[c[0]]);
    sels[c[0]] = s;
    grade.appendChild(fnCampo(c[1], s));
  });
  var inv = h('input', { type: 'checkbox', checked: !!mapa.inverter });
  var tb = h('tbody');
  r.amostra.forEach(function(l){ tb.appendChild(h('tr', null, r.colunas.map(function(_, i){ return h('td', { style: 'white-space:nowrap' }, l[i] || ''); }))); });
  fnJanela('O que é cada coluna?', [
    h('p', { class: 'fn-nota' }, 'É a primeira vez que este formato entra nesta conta. Confirma as colunas — a próxima vez já não pergunta.'),
    grade, h('label', { class: 'fn-check' }, [inv, 'Os débitos vêm positivos (inverter o sinal)']),
    h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab' }, [h('thead', null, [h('tr', null, r.colunas.map(function(c){ return h('th', null, c); }))]), tb])])
  ], [{ txt: 'Importar', pri: true, fn: function(){
    var m = { cabecalho: mapa.cabecalho, primeira: mapa.primeira, inverter: inv.checked };
    campos.forEach(function(c){ m[c[0]] = sels[c[0]].value === '' ? null : Number(sels[c[0]].value); });
    if (m.data == null || (m.valor == null && m.debito == null && m.credito == null)) { fnAviso('Faltam a data e o valor (ou débito/crédito).'); return false; }
    return fnEnviarExtrato(contaId, ficheiro, m);
  } }]);
}

function fnNovoMovimento(){
  var sc = fnSelContas(String(FN.mov.conta || '').split(',')[0] || '', false);
  var dt = h('input', { class: 'fn-in', type: 'date', value: fnHoje() });
  var ds = h('input', { class: 'fn-in', placeholder: 'Descrição' });
  var vl = h('input', { class: 'fn-in', inputmode: 'decimal', placeholder: '0,00' });
  var sen = h('select', { class: 'fn-sel' }, [h('option', { value: '-1' }, 'Saiu'), h('option', { value: '1' }, 'Entrou')]);
  var cat = fnSelCategorias('');
  var ar = fnSelAreas('');
  fnJanela('Novo movimento', [h('div', { class: 'fn-campos' }, [fnCampo('Conta', sc), fnCampo('Data', dt)]), fnCampo('Descrição', ds),
    h('div', { class: 'fn-campos' }, [fnCampo('Valor', vl), fnCampo('Sentido', sen)]), h('div', { class: 'fn-campos' }, [fnCampo('Categoria', cat), fnCampo('Área', ar)]),
    h('p', { class: 'fn-nota' }, 'Para o dinheiro vivo e o que não aparece em extrato nenhum.')],
  [{ txt: 'Criar', pri: true, fn: function(){
    var v = Number(String(vl.value).replace(/\s/g, '').replace(',', '.'));
    if (!sc.value || !v) { fnAviso('Faltam a conta e o valor.'); return false; }
    return fnApi('/api/financas/movimentos', 'POST', { conta_id: Number(sc.value), data: dt.value, descricao: ds.value || 'Movimento', valor: Math.abs(v) * Number(sen.value),
      categoria_id: cat.value ? Number(cat.value) : null, context_id: ar.value ? Number(ar.value) : null }).then(function(){ fnMudou(); }, fnErro);
  } }]);
}

/* ======================= ORÇAMENTOS ======================= */
function fn_financas_orcamentos(corpo){
  var seg = h('div', { class: 'fn-seg', role: 'group', 'aria-label': 'Vista' }, [['mes','Mês'],['ano','Ano']].map(function(o){
    return h('button', { type: 'button', class: FN.orcVista === o[0] ? 'on' : '', onclick: function(){ FN.orcVista = o[0]; fnRender('financas'); } }, o[1]);
  }));
  fnBarraFiltros(corpo, true, [seg, fnBtn('+ Orçamento', function(){ fnOrcJanela(); }, 'primary')]);
  fnCarregar(corpo, fnLer('orc|' + fnQs(fnFiltro()), '/api/financas/orcamentos?' + fnQs(fnFiltro())), function(d){
    var desp = d.linhas.filter(function(l){ return l.natureza === 'despesa'; });
    var metas = d.linhas.filter(function(l){ return l.natureza !== 'despesa'; });
    var orc = desp.reduce(function(s, l){ return s + l.mensal; }, 0), gasto = desp.reduce(function(s, l){ return s + Math.max(0, l.gasto); }, 0);
    var acum = desp.reduce(function(s, l){ return s + l.acumulado; }, 0);
    var semT = d.sem.reduce(function(s, x){ return s + x.gasto; }, 0);
    corpo.appendChild(h('div', { class: 'fn-kpis' }, [
      fnKpi('Orçado · despesa', fnEur(orc), desp.length + ' linhas'),
      fnKpi('Gasto', fnEur(gasto), orc ? Math.round(gasto / orc * 100) + '% do orçado' : '', orc && gasto > orc ? 'fn-bad' : ''),
      fnKpi('Disponível', fnEur(orc - gasto), acum ? (acum > 0 ? '+ ' : '') + fnEur(acum) + ' acumulado' : 'sem acumulado', orc - gasto < 0 ? 'fn-bad' : 'fn-good'),
      fnKpi('Metas de poupança', metas.length ? fnEur0(metas.reduce(function(s, l){ return s + Math.max(0, l.gasto); }, 0)) + ' / ' + fnEur0(metas.reduce(function(s, l){ return s + l.mensal; }, 0)) : '—', metas.length ? 'vão para o Património' : 'orçamenta PPR, poupança…'),
      fnKpi('Gasto sem orçamento', fnEur(semT), d.sem.length ? d.sem.slice(0, 2).map(function(x){ return x.nome.split(' › ').pop(); }).join(', ') + (d.sem.length > 2 ? '…' : '') : 'nada', semT ? 'fn-warn' : '')
    ]));
    if (!d.linhas.length){ corpo.appendChild(fnCard('Orçamentos', null, [fnVazio('Ainda sem orçamentos.', 'Um orçamento é quanto se pode gastar por mês numa categoria. Pode acumular: o que sobra passa para o mês seguinte.', [fnBtn('+ Orçamento', function(){ fnOrcJanela(); }, 'primary')])])); }
    else {
      var ano = FN.orcVista === 'ano';
      var tb = h('tbody');
      var porGrupo = {};
      d.linhas.forEach(function(l){ var g = l.natureza === 'despesa' ? l.grupo : 'Metas de poupança'; (porGrupo[g] = porGrupo[g] || []).push(l); });
      Object.keys(porGrupo).sort(function(a, b){ return a === 'Metas de poupança' ? 1 : b === 'Metas de poupança' ? -1 : 0; }).forEach(function(g){
        var ls = porGrupo[g];
        var so = ls.reduce(function(s, l){ return s + (ano ? l.ano_orcado : l.mensal); }, 0), sg = ls.reduce(function(s, l){ return s + (ano ? l.ano_gasto : l.gasto); }, 0);
        tb.appendChild(h('tr', { class: 'grp' }, [h('td', { colspan: 2 }, g), h('td', { class: 'r' }, fnEur(so)), h('td', { class: 'r' }, fnEur(sg)), h('td'), h('td', { class: 'r' }, fnEur(so - sg)), h('td'), h('td'), h('td')]));
        ls.forEach(function(l){
          var o = ano ? l.ano_orcado : l.mensal, gg = ano ? l.ano_gasto : l.gasto, pct = o ? Math.round(gg / o * 100) : 0;
          var meta = l.natureza !== 'despesa';
          tb.appendChild(h('tr', null, [
            h('td', null, [h('b', { style: 'font-weight:500' }, l.nome)]),
            h('td', null, [h('span', { class: 'fn-pill' + (meta ? ' tr' : '') }, meta ? '→ Património' : l.fixa ? 'fixa' : 'variável')]),
            h('td', { class: 'r' }, fnEur(o)), h('td', { class: 'r ' + (!meta && gg > o + 0.005 ? 'fn-bad' : '') }, fnEur(gg)),
            h('td', { style: 'min-width:120px' }, [fnBarra(pct, meta ? 'tr' : null)]),
            h('td', { class: 'r ' + (o - gg < 0 && !meta ? 'fn-bad' : '') }, ano ? fnEur(o - gg) : fnEur(l.disponivel)),
            h('td', { class: 'r' }, l.acumula ? fnEur(l.acumulado) : h('span', { class: 'fn-muted' }, '—')),
            h('td', null, [fnSpark(l.serie, l.media6 && l.gasto > l.media6 * 1.25)]),
            h('td', null, [h('div', { class: 'fn-acoes' }, [fnBtn('Editar', function(){ fnOrcJanela(l); }, 'small')])])
          ]));
        });
      });
      corpo.appendChild(h('div', { class: 'card', style: 'padding:6px 10px' }, [h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab', style: 'min-width:860px' }, [
        h('thead', null, [h('tr', null, [h('th', null, 'Categoria'), h('th', null, 'Tipo'), h('th', { class: 'r' }, ano ? 'Orçado no ano' : 'Orçado'), h('th', { class: 'r' }, ano ? 'Gasto no ano' : 'Gasto'),
          h('th', null, 'Usado'), h('th', { class: 'r' }, 'Disponível'), h('th', { class: 'r' }, 'Acumulado'), h('th', null, '12 meses'), h('th')])]), tb])])]));
    }
    if (d.sem.length){
      var l = h('div', { class: 'fn-lista' });
      d.sem.forEach(function(x){
        var sug = Math.ceil(Math.max(x.media6, x.gasto) * 1.05 / 5) * 5;
        l.appendChild(h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [x.nome, x.media6 ? h('small', null, 'média 6 meses ' + fnEur(x.media6)) : null]), h('span', { class: 'fn-n' }, fnEur(x.gasto)),
          x.categoria_id ? fnBtn('Orçamentar ' + fnEur0(sug), function(){ fnApi('/api/financas/orcamentos', 'POST', { categoria_id: x.categoria_id, mensal: sug, acumula: false, desde: FN.mes }).then(function(){ fnMudou(); }, fnErro); }, 'small') : null]));
      });
      corpo.appendChild(fnCard('Gasto sem orçamento', fnMesCurto(FN.mes), [l]));
    }
  });
}
function fnOrcJanela(l){
  var cat = fnSelCategorias(l ? l.categoria_id : '', '— escolhe —');
  if (l) cat.disabled = true;
  var v = h('input', { class: 'fn-in', inputmode: 'decimal', value: l ? String(l.mensal).replace('.', ',') : '', placeholder: '0,00' });
  var ac = h('input', { type: 'checkbox', checked: l ? l.acumula : false });
  var de = h('input', { class: 'fn-in', type: 'month', value: FN.mes });
  var bts = [{ txt: l ? 'Guardar' : 'Criar', pri: true, fn: function(){
    var n = Number(String(v.value).replace(/\s/g, '').replace(',', '.'));
    if (!(n > 0) || !cat.value) { fnAviso('Faltam a categoria e o valor.'); return false; }
    var p = l ? fnApi('/api/financas/orcamentos/' + l.id, 'PATCH', { mensal: n, acumula: ac.checked })
      : fnApi('/api/financas/orcamentos', 'POST', { categoria_id: Number(cat.value), mensal: n, acumula: ac.checked, desde: de.value });
    return p.then(function(){ fnMudou(); }, fnErro);
  } }];
  if (l) bts.push({ txt: 'Apagar', fn: function(){ return fnApi('/api/financas/orcamentos/' + l.id, 'DELETE').then(function(){ fnMudou(); }, fnErro); } });
  fnJanela(l ? 'Orçamento · ' + l.nome : 'Novo orçamento', [fnCampo('Categoria', cat), h('div', { class: 'fn-campos' }, [fnCampo('Por mês', v), l ? null : fnCampo('Desde', de)]),
    h('label', { class: 'fn-check' }, [ac, 'Acumula: o que sobra (ou falta) passa para o mês seguinte']),
    h('p', { class: 'fn-nota' }, 'Uma categoria de transferência (PPR, poupança) vira meta de poupança: conta o que lá se pôs.')], bts);
}

/* ======================= ANÁLISE ======================= */
function fn_financas_analise(corpo){
  fnBarraFiltros(corpo, true);
  fnCarregar(corpo, fnLer('an|' + fnQs(fnFiltro()), '/api/financas/analise?' + fnQs(fnFiltro())), function(d){
    var k = d.kpi;
    corpo.appendChild(h('div', { class: 'fn-kpis' }, [
      fnKpi('Custo fixo / mês', fnEur0(k.custo_fixo), k.fixo_pct == null ? '' : k.fixo_pct + '% da despesa'),
      fnKpi('Custo variável / mês', fnEur0(k.custo_variavel), 'média 12 meses'),
      fnKpi('Taxa de poupança', fnPct(k.taxa_poupanca), '12 meses', k.taxa_poupanca != null && k.taxa_poupanca < 10 ? 'fn-warn' : 'fn-good'),
      fnKpi('Reserva de emergência', k.reserva_meses == null ? '—' : String(k.reserva_meses).replace('.', ',') + ' meses', 'liquidez ÷ despesa média', k.reserva_meses != null && k.reserva_meses < 3 ? 'fn-warn' : ''),
      fnKpi('Dívida / rendimento', fnPct(k.divida_rendimento), 'prestações ÷ entradas', k.divida_rendimento > 35 ? 'fn-bad' : ''),
      fnKpi('Despesa por dia', fnEur(k.despesa_dia), 'média 12 meses')
    ]));
    var l1 = h('div', { class: 'fn-linha' });
    var leg = h('div', { class: 'fn-leg' }, d.grupos.map(function(g, i){ return h('span', null, [h('i', { style: 'background:' + FN_CORES[i % 5] }), g]); }));
    l1.appendChild(fnCard('Despesa mensal por grupo', leg, [d.mensal.some(function(m){ return Object.keys(m.grupos).length; }) ? fnGrafEmpilhado(d.mensal, d.grupos) : fnVazio('Sem despesas nestes meses.')], 'largo'));
    var ant = d.anual.anterior, at = d.anual.atual;
    var temAnt = ant.some(function(v){ return v > 0; });
    var mesesR = FN_MESES.slice();
    l1.appendChild(fnCard(d.anual.ano + ' contra ' + (d.anual.ano - 1), 'despesa acumulada', [
      fnGrafLinhas([temAnt ? { pontos: ant, cor: 'var(--fn-c5)', tracejado: true } : null, { pontos: at, cor: 'var(--accent)', ponto: true }].filter(Boolean), mesesR, 'Despesa acumulada deste ano e do anterior'),
      h('div', { class: 'fn-leg' }, [h('span', null, [h('i', { style: 'background:var(--accent)' }), d.anual.ano + ' · ' + fnEur0(at[at.length - 1] || 0)]),
        temAnt ? h('span', null, [h('i', { style: 'background:var(--fn-c5)' }), (d.anual.ano - 1) + ' no mesmo ponto · ' + fnEur0(ant[at.length - 1] || 0)]) : h('span', { class: 'fn-muted' }, 'sem dados do ano anterior')])
    ]));
    corpo.appendChild(l1);

    var tb = h('tbody');
    d.tabela.forEach(function(r){
      var vm = fnVar(r.mes, r.media12), va = r.ytd_anterior ? fnVar(r.ytd, r.ytd_anterior) : null;
      tb.appendChild(h('tr', null, [h('td', null, r.grupo), h('td', { class: 'r' }, fnEur0(r.media12)), h('td', { class: 'r' }, fnEur0(r.mes)),
        h('td', { class: 'r ' + (vm > 10 ? 'fn-warn' : vm < -10 ? 'fn-good' : '') }, vm == null ? '—' : (vm > 0 ? '+' : '') + Math.round(vm) + '%'),
        h('td', { class: 'r' }, fnEur0(r.ytd)), h('td', { class: 'r' }, r.ytd_anterior ? fnEur0(r.ytd_anterior) : '—'),
        h('td', { class: 'r ' + (va > 10 ? 'fn-warn' : va < -10 ? 'fn-good' : '') }, va == null ? '—' : (va > 0 ? '+' : '') + Math.round(va) + '%'),
        h('td', { class: 'r' }, fnEur0(r.projecao)), h('td', null, [fnSpark(r.serie)]),
        h('td', null, [h('span', { class: 'fn-pill ' + (r.tendencia === 'sobe' ? 'warn' : r.tendencia === 'desce' ? 'good' : '') }, r.tendencia === 'sobe' ? '↑ a subir' : r.tendencia === 'desce' ? '↓ a descer' : 'estável')])]));
    });
    corpo.appendChild(fnCard('Custo por grupo', 'tendência pela recta dos últimos 12 meses', [h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab', style: 'min-width:860px' }, [
      h('thead', null, [h('tr', null, [h('th', null, 'Grupo'), h('th', { class: 'r' }, 'Média/mês'), h('th', { class: 'r' }, fnMesCurto(FN.mes)), h('th', { class: 'r' }, 'vs média'),
        h('th', { class: 'r' }, d.anual.ano + ' até ' + fnMesCurto(FN.mes)), h('th', { class: 'r' }, d.anual.ano - 1), h('th', { class: 'r' }, 'vs ' + (d.anual.ano - 1)), h('th', { class: 'r' }, 'Projeção'), h('th', null, '12 meses'), h('th', null, 'Tendência')])]), tb])])]));

    var l2 = h('div', { class: 'fn-linha' });
    var la = h('div', { class: 'fn-lista' });
    var maxA = Math.max.apply(null, d.areas.map(function(a){ return Math.max(a.entradas, a.saidas); }).concat([1]));
    if (!d.areas.length) la.appendChild(h('p', { class: 'fn-nota' }, 'Sem movimentos neste ano.'));
    d.areas.forEach(function(a){
      la.appendChild(h('div', { class: 'fn-li', style: 'flex-direction:column;align-items:stretch;gap:4px' }, [
        h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, a.area), h('span', { class: 'fn-n ' + (a.resultado < 0 ? 'fn-bad' : 'fn-good') }, 'resultado ' + fnEur0(a.resultado))]),
        h('div', { class: 'fn-bar', style: 'height:10px' }, [h('i', { style: 'width:' + (a.entradas / maxA * 100) + '%;background:var(--fn-in)' })]),
        h('div', { class: 'fn-bar', style: 'height:10px' }, [h('i', { style: 'width:' + (a.saidas / maxA * 100) + '%;background:var(--fn-out)' })]),
        h('small', { class: 'fn-muted' }, 'entradas ' + fnEur0(a.entradas) + ' · saídas ' + fnEur0(a.saidas) + (a.financiamento ? ' · financiamento ' + fnEur0(a.financiamento) + ' (não conta)' : ''))]));
    });
    l2.appendChild(fnCard('Pessoal e profissional', d.anual.ano + ' até ' + fnMesCurto(FN.mes), [la]));
    var lr = h('div', { class: 'fn-lista' });
    if (!d.recorrentes.length) lr.appendChild(h('p', { class: 'fn-nota' }, 'Nenhum débito que se repita todos os meses com o mesmo valor (precisa de três meses de extrato).'));
    d.recorrentes.forEach(function(r){
      lr.appendChild(h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [r.descricao, h('small', null, (r.categoria_id ? fnCatNome(r.categoria_id) + ' · ' : '') + 'desde ' + fnData(r.desde))]),
        r.nova ? h('span', { class: 'fn-pill warn' }, 'nova') : null, h('span', { class: 'fn-n' }, fnEur(r.mensal) + '/mês')]));
    });
    if (d.recorrentes.length) lr.appendChild(h('div', { class: 'fn-caixa', style: 'flex-direction:row;justify-content:space-between' }, [h('span', { class: 'fn-muted' }, 'Por ano'), h('b', { class: 'fn-n' }, fnEur(d.recorrentes_ano))]));
    l2.appendChild(fnCard('Subscrições e débitos fixos', 'detetados no extrato', [lr]));
    corpo.appendChild(l2);
  });
}
