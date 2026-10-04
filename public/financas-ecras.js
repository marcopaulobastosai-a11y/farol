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

  /* Os filtros mudam só a lista: a barra fica, a lista recarrega por baixo
     (sem «A ler…» a tapar o ecrã e sem saltar para o topo). */
  var zona = h('div', { class: 'fn-movzona' });
  var mudar = function(){ FN.mov.sel = {}; FN.mov.mostrar = 0; desenharFiltros(); fnMovLista(zona); };
  var f = h('div', { class: 'fn-barra' });
  var desenharFiltros = function(){
    clear(f);
    f.appendChild(fnFiltroContas(mudar));
    var seg = h('div', { class: 'fn-seg', role: 'group', 'aria-label': 'Estado' });
    [['','Todos'],['categorizar','Por categorizar'],['sugestoes','Sugestões da IA'],['reconciliar','Por reconciliar'],['semdespesa','Sem despesa'],['reembolsos','Reembolsos'],['divididos','Divididos'],['repetidos','Repetidos']].forEach(function(o){
      seg.appendChild(h('button', { type: 'button', class: FN.mov.estado === o[0] ? 'on' : '', onclick: function(){ FN.mov.estado = o[0]; mudar(); } }, o[1]));
    });
    f.appendChild(seg);
    var sc = fnSelCategorias(FN.mov.categoria, 'Todas as categorias'); sc.setAttribute('aria-label', 'Categoria');
    sc.insertBefore(h('option', { value: 'nenhuma' }, 'Sem categoria'), sc.children[1] || null);
    if (FN.mov.categoria) sc.value = FN.mov.categoria;
    sc.addEventListener('change', function(){ FN.mov.categoria = sc.value; mudar(); });
    f.appendChild(sc);
    var sp = h('select', { class: 'fn-sel', 'aria-label': 'Período' });
    [['mes','O mês'],['m3','3 meses'],['m12','12 meses'],['tudo','Tudo']].forEach(function(o){ sp.appendChild(h('option', { value: o[0] }, o[1])); });
    /* O período «tudo» esconde o mês na barra de cima: aí redesenha-se tudo. */
    sp.value = FN.mov.periodo; sp.addEventListener('change', function(){ var antes = FN.mov.periodo; FN.mov.periodo = sp.value; FN.mov.sel = {}; FN.mov.mostrar = 0;
      if ((antes === 'tudo') !== (sp.value === 'tudo')) fnRender('financas'); else mudar(); });
    f.appendChild(sp);
    if (FN.mov.pessoa) f.appendChild(h('span', { class: 'fn-pill tr', style: 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px' }, [
      'Pessoa: ' + (fnPessoaNome(FN.mov.pessoa) || FN.mov.pessoa),
      h('button', { type: 'button', class: 'btn small', 'aria-label': 'Tirar o filtro da pessoa', style: 'padding:0 6px;min-height:0', onclick: function(){ FN.mov.pessoa = ''; mudar(); } }, '×')]));
    if (FN.mov.projeto) f.appendChild(h('span', { class: 'fn-pill tr', style: 'display:inline-flex;align-items:center;gap:6px;padding:4px 10px' }, [
      'Projeto: ' + (fnProjetoNome(FN.mov.projeto) || FN.mov.projeto),
      h('button', { type: 'button', class: 'btn small', 'aria-label': 'Tirar o filtro do projeto', style: 'padding:0 6px;min-height:0', onclick: function(){ FN.mov.projeto = ''; mudar(); } }, '×')]));
    var qi = h('input', { class: 'fn-sel', type: 'search', placeholder: 'Procurar descrição ou valor', value: FN.mov.q, 'aria-label': 'Procurar', style: 'flex:1 1 180px' });
    var tmr = null;
    qi.addEventListener('input', function(){ clearTimeout(tmr); tmr = setTimeout(function(){ if (FN.mov.q !== qi.value.trim()) { FN.mov.q = qi.value.trim(); FN.mov.sel = {}; FN.mov.mostrar = 0; fnMovLista(zona); } }, 350); });
    f.appendChild(qi);
  };
  desenharFiltros();
  corpo.appendChild(f);
  corpo.appendChild(zona);
  fnMovLista(zona);
}

/* A lista de movimentos, aos bocados de 200 pedidos ao servidor. Guarda-se
   por filtro (FN.cache, que se limpa quando algo muda) com as páginas já
   lidas; entretanto mostra-se a última lista com estes filtros, esbatida, e
   troca-se quando chegar a nova. Os totais e os avisos vêm do servidor e
   contam a lista toda, não só o que está à vista. */
var FN_MOV_PAG = 200;
function fnMovQs(){
  var per = fnPeriodoMov();
  return fnQs({ estado: FN.mov.estado, conta: FN.mov.conta, categoria: FN.mov.categoria, projeto: FN.mov.projeto || '', pessoa: FN.mov.pessoa || '', q: FN.mov.q, de: per.de, ate: per.ate, ambito: FN.ambito, area: FN.area });
}
/* A lista dos projetos, para pôr um movimento num (o casamento, a casa nova).
   Os programas ficam de fora: guardam projetos, não movimentos. */
function fnProjetos(){
  return ((window.G && G.projects) || []).filter(function(p){ return p.tipo !== 'programa'; });
}
/* As pessoas do agregado (e o Brownie), para dizer de quem é um movimento. */
function fnPessoas(){ return ((window.G && G.people) || []).filter(function(p){ return p.active !== false; }); }
function fnPessoaNome(id){ var p = fnPessoas().filter(function(x){ return x.id === Number(id); })[0]; return p ? p.name : ''; }
function fnSelPessoas(valor, vazio){
  var s = h('select', { class: 'fn-sel' }, [h('option', { value: '' }, vazio || '— ninguém em especial —')].concat(fnPessoas().map(function(p){ return h('option', { value: p.id }, p.name); })));
  if (valor) s.value = String(valor);
  return s;
}
function fnProjetoNome(id){ var p = fnProjetos().filter(function(x){ return x.id === Number(id); })[0]; return p ? p.name : ''; }
function fnSelProjetos(valor, vazio){
  var s = h('select', { class: 'fn-sel' }, [h('option', { value: '' }, vazio || '— sem projeto —')]);
  var ps = fnProjetos();
  var abertos = ps.filter(function(p){ return p.status !== 'concluido' && p.status !== 'cancelado'; });
  var fechados = ps.filter(function(p){ return abertos.indexOf(p) < 0; });
  abertos.forEach(function(p){ s.appendChild(h('option', { value: p.id }, p.name)); });
  if (fechados.length) s.appendChild(h('optgroup', { label: 'Fechados' }, fechados.map(function(p){ return h('option', { value: p.id }, p.name); })));
  if (valor) s.value = String(valor);
  return s;
}
function fnMovLista(zona){
  var qs = fnMovQs();
  var chave = 'mov:' + qs;
  FN.movPedido = qs;
  var pronto = FN.cache[chave];
  if (pronto) { fnMovDesenhar(zona, pronto, qs); return; }
  var velho = FN.movUlt && FN.movUlt.qs === qs ? FN.movUlt.d : null;
  if (velho) fnMovDesenhar(zona, velho, qs);
  if (zona.firstChild) zona.classList.add('fn-aler');
  else zona.appendChild(h('p', { class: 'fn-nota' }, 'A ler…'));
  /* Pede pelo menos tantas linhas como as que estavam à vista. */
  var quantas = Math.max(FN_MOV_PAG, FN.mov.mostrar || 0);
  apiGestao('/api/financas/movimentos?' + qs + '&desde=0&limite=' + quantas).then(function(d){
    FN.cache[chave] = d;
    if (FN.movPedido !== qs || !zona.isConnected) return;
    FN.movUlt = { qs: qs, d: d };
    zona.classList.remove('fn-aler');
    fnMovDesenhar(zona, d, qs);
  }, function(e){
    if (FN.movPedido !== qs) return;
    zona.classList.remove('fn-aler'); clear(zona);
    zona.appendChild(fnVazio('Não foi possível ler.', e.message, [fnBtn('Tentar outra vez', fnMudou)]));
  });
}
function fnMovDesenhar(zona, d, qs){
  clear(zona);
  var ms = d.movimentos;
  var todosIds = d.todos || ms.map(function(m){ return [m.id, m.valor]; });
  var rs = d.resumo || {};
  var avisos = h('div');
  zona.appendChild(avisos);
  var desenharAvisos = function(){
    clear(avisos);
    var sug = rs.sugestoes || [];
    if (sug.length){
      avisos.appendChild(h('div', { class: 'fn-banner' }, [h('span', { class: 'fn-pill ai' }, '✦ IA'),
        h('div', { class: 'g' }, [h('b', null, sug.length + (sug.length === 1 ? ' movimento tem' : ' movimentos têm') + ' categoria sugerida'),
          h('span', { class: 'fn-muted' }, (rs.confianca != null ? ' · confiança média ' + Math.round(rs.confianca * 100) + '%.' : '') + ' Vêm das tuas regras, do histórico e do Gemini.')]),
        fnBtn('Aceitar ' + (sug.length === 1 ? 'a sugestão' : 'as ' + sug.length), function(){
          fnApi('/api/financas/movimentos/lote', 'POST', { ids: sug, aceitar: true })
            .then(function(r){ fnAviso(r.feitos + ' categorizados.'); fnMudou(); }, fnErro);
        }, 'primary small')]));
    }
    if (rs.reembolsos && FN.mov.estado !== 'reembolsos'){
      avisos.appendChild(h('div', { class: 'fn-banner' }, [h('span', { class: 'fn-pill ai' }, '✦ Reembolsos'),
        h('div', { class: 'g' }, [h('b', null, rs.reembolsos + (rs.reembolsos === 1 ? ' entrada parece' : ' entradas parecem') + ' alguém a devolver a parte de uma conta'),
          h('span', { class: 'fn-muted' }, ' · pelo nome de quem mandou e por um pagamento teu, dos dias antes, que é múltiplo exato do valor.')]),
        fnBtn('Ver', function(){ FN.mov.estado = 'reembolsos'; FN.mov.sel = {}; FN.mov.mostrar = 0; fnRender('financas'); }, 'small')]));
    }
  };
  desenharAvisos();
  fnAvisoPares(zona);
  fnAvisoTarefas(zona);
  var cartao = h('div', { class: 'card', style: 'padding:6px 10px' });
  zona.appendChild(cartao);
  if (!ms.length) { cartao.appendChild(fnVazio('Nenhum movimento com estes filtros.', FN.mov.estado ? 'Experimenta «Todos» ou outro período.' : null)); return; }
  /* A barra do lote redesenha-se sozinha quando se marca uma linha. */
  var lote = h('div');
  cartao.appendChild(lote);
  var todos = h('input', { type: 'checkbox', 'aria-label': 'Escolher todos' });
  var tb = h('tbody');
  var desenharLote = function(){
    clear(lote);
    var selN = Object.keys(FN.mov.sel).filter(function(k){ return FN.mov.sel[k]; });
    todos.checked = selN.length > 0 && selN.length === todosIds.length;
    if (selN.length) lote.appendChild(fnBarraLote(selN, todosIds.map(function(x){ return { id: x[0], valor: x[1] }; }), function(){
      FN.mov.sel = {}; Array.prototype.forEach.call(tb.querySelectorAll('input[type=checkbox]'), function(c){ c.checked = false; }); desenharLote(); }));
  };
  todos.addEventListener('change', function(){
    FN.mov.sel = {}; if (todos.checked) todosIds.forEach(function(x){ FN.mov.sel[x[0]] = true; });
    Array.prototype.forEach.call(tb.querySelectorAll('input[type=checkbox]'), function(c){ c.checked = todos.checked; });
    desenharLote();
  });
  /* O que está à vista fica registado, para se poder trocar uma linha só. */
  FN.movVista = { d: d, qs: qs, tb: tb, aoMarcar: desenharLote, avisos: desenharAvisos };
  var maisZona = h('div', { class: 'fn-acoes', style: 'justify-content:center;padding:8px' });
  var acrescentar = function(lista){
    var frag = document.createDocumentFragment();
    lista.forEach(function(m){ frag.appendChild(fnLinhaMov(m, desenharLote)); });
    tb.appendChild(frag);
    FN.mov.mostrar = d.movimentos.length;
    desenharMais();
  };
  var desenharMais = function(){
    clear(maisZona);
    var falta = (d.total || ms.length) - d.movimentos.length;
    if (falta <= 0) return;
    maisZona.appendChild(h('span', { class: 'fn-nota' }, 'A mostrar ' + d.movimentos.length + ' de ' + d.total + '.'));
    var pedir = function(n, botao){
      if (botao) botao.disabled = true;
      apiGestao('/api/financas/movimentos?' + qs + '&desde=' + d.movimentos.length + '&limite=' + n).then(function(p){
        d.movimentos = d.movimentos.concat(p.movimentos);
        acrescentar(p.movimentos);
      }, function(e){ if (botao) botao.disabled = false; fnErro(e); });
    };
    var b1 = fnBtn('Mostrar mais ' + Math.min(300, falta), function(){ pedir(300, b1); }, 'small');
    var b2 = fnBtn('Mostrar todos', function(){ pedir(falta, b2); }, 'small');
    maisZona.appendChild(b1); maisZona.appendChild(b2);
  };
  cartao.appendChild(h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab fn-movtab', style: 'min-width:1230px' }, [
    h('colgroup', null, [h('col', { style: 'width:30px' }), h('col', { style: 'width:62px' }), h('col', { style: 'width:140px' }), h('col'), h('col', { style: 'width:118px' }), h('col', { style: 'width:104px' }), h('col', { style: 'width:240px' }), h('col', { style: 'width:120px' }), h('col', { style: 'width:140px' }), h('col', { style: 'width:160px' })]),
    h('thead', null, [h('tr', null, [h('th', null, [todos]), h('th', null, 'Data'), h('th', null, 'Conta'), h('th', null, 'Descrição'), h('th', { class: 'r' }, 'Valor'), h('th', { class: 'r' }, 'Saldo'), h('th', null, 'Categoria'), h('th', null, 'Área'), h('th', null, 'De quem'), h('th', null, 'Ligado a')])]),
    tb])]));
  cartao.appendChild(maisZona);
  acrescentar(ms);
  desenharLote();
  var total = d.total != null ? d.total : ms.length;
  cartao.appendChild(h('p', { class: 'fn-nota', style: 'padding:8px' }, total + ' movimentos · entradas ' + fnEur(rs.entradas != null ? rs.entradas : 0) +
    ' · saídas ' + fnEur(rs.saidas != null ? rs.saidas : 0) + ' · saldo ' + fnEur(rs.saldo != null ? rs.saldo : 0, true)));
}

/* Depois de gravar um movimento, troca-se só a linha dele: lê-se esse
   movimento e acerta-se o aviso das sugestões. As outras listas guardadas
   deixam de valer (podiam ter este movimento com a categoria velha). */
function fnMovAtualizar(id){
  if (FN.movJanela) { FN.movJanela.fechar(); FN.movJanela = null; }
  var v = FN.movVista;
  var tr = v && v.tb && v.tb.isConnected ? v.tb.querySelector('tr[data-id="' + id + '"]') : null;
  if (!tr) { fnMudou(); return Promise.resolve(); }
  tr.classList.add('fn-aler');
  return apiGestao('/api/financas/movimentos/' + id).then(function(r){
    var m = r.movimento;
    /* Os outros ecrãs (resumo, análise, orçamentos) e as outras listas
       voltam a ler-se quando se abrirem. */
    Object.keys(FN.cache).forEach(function(k){ if (k !== 'mov:' + v.qs) delete FN.cache[k]; });
    var i = v.d.movimentos.map(function(x){ return x.id; }).indexOf(id);
    if (i >= 0) v.d.movimentos[i] = m;
    var rs = v.d.resumo || {};
    if (rs.sugestoes && (m.categoria_id || !m.ia_categoria_id)) rs.sugestoes = rs.sugestoes.filter(function(x){ return x !== id; });
    if (rs.reembolsos && m.cc_pessoa_id && !m.reembolso && !m.divisao) rs.reembolsos = Math.max(0, rs.reembolsos - 1);
    var novo = fnLinhaMov(m, v.aoMarcar);
    if (tr.parentNode) tr.parentNode.replaceChild(novo, tr);
    v.avisos();
  }, function(e){ tr.classList.remove('fn-aler'); fnErro(e); fnMudou(); });
}

/* ---- Transferências entre contas: a saída numa conta e a entrada na outra ---- */
/* Na janela do movimento: a que está ligado, ou os candidatos para ligar. */
function fnPainelPar(p, m){
  if (m.valor === 0) return;
  var t = h('div', { class: 'mono', style: 'margin-top:6px' }, 'Entre contas');
  p.appendChild(t);
  if (m.par_id){
    var pc = fnConta(m.par_conta_id);
    p.appendChild(h('div', { class: 'fn-caixa melhor' }, [
      h('b', null, m.valor < 0 ? 'Saiu desta conta para ' + (pc ? pc.nome : 'outra conta') : 'Entrou nesta conta vindo de ' + (pc ? pc.nome : 'outra conta')),
      h('small', { class: 'fn-muted' }, 'O outro lado foi a ' + fnData(m.par_data) + '. Não conta como despesa nem como receita.'),
      h('div', { class: 'fn-acoes' }, [fnBtn('Desligar', function(){ fnApi('/api/financas/movimentos/' + m.id + '/par', 'DELETE').then(function(){ fnMudou(); }, fnErro); }, 'small')])]));
    return;
  }
  /* A conta do outro lado, quando o movimento de lá não está no Farol (o
     cartão cujo extrato ainda não veio, o cartão da Sofia, as poupanças). */
  var outras = (FN.base.contas || []).filter(function(c){ return c.id !== m.conta_id; });
  var sd = h('select', { class: 'fn-sel' }, [h('option', { value: '' }, '— não é uma transferência entre contas —')].concat(outras.map(function(c){ return h('option', { value: c.id }, c.nome + (c.ativo ? '' : ' (só para identificar)')); })));
  if (m.para_conta_id) sd.value = String(m.para_conta_id);
  p.appendChild(h('div', { class: 'fn-caixa' + (m.para_conta_id ? ' melhor' : '') }, [
    fnCampo(m.valor < 0 ? 'Foi para a conta' : 'Veio da conta', sd),
    h('small', { class: 'fn-muted' }, 'Para quando o outro lado não está no Farol. Liga-se sozinho ao movimento de lá quando esse extrato entrar (e, para ficar automático, põe um identificador na conta: Património › Contas).'),
    h('div', { class: 'fn-acoes' }, [fnBtn('Guardar a conta', function(){
      fnApi('/api/financas/movimentos/' + m.id, 'PATCH', { para_conta_id: sd.value ? Number(sd.value) : null }).then(function(){ fnAviso('Guardado.'); fnMovAtualizar(m.id); }, fnErro);
    }, 'small')])]));
  var cx = h('div', { class: 'fn-lista' }, [h('p', { class: 'fn-nota' }, 'A procurar o outro lado…')]);
  p.appendChild(cx);
  apiGestao('/api/financas/movimentos/' + m.id + '/pares').then(function(r){
    clear(cx);
    if (!r.pares.length){ if (cx.parentNode) cx.parentNode.removeChild(cx); return; }
    r.pares.slice(0, 4).forEach(function(o, i){
      cx.appendChild(h('div', { class: 'fn-caixa' + (i === 0 ? ' melhor' : ''), style: 'margin-bottom:6px' }, [
        h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, (m.valor < 0 ? 'Para ' : 'De ') + o.conta), h('span', { class: 'fn-pill ai' }, '✦ ' + Math.round(o.confianca * 100) + '%')]),
        h('small', { class: 'fn-muted' }, fnData(o.data) + ' · ' + o.descricao + ' · ' + fnEur(o.valor, true)),
        h('div', { class: 'fn-acoes' }, [fnBtn('É este o outro lado', function(){
          var par = m.valor < 0 ? { saida: m.id, entrada: o.id } : { saida: o.id, entrada: m.id };
          fnApi('/api/financas/pares', 'POST', par).then(function(x){ if (x.erros && x.erros.length) return fnAviso(x.erros[0]); fnAviso('Ligado.'); fnMudou(); }, fnErro);
        }, 'primary small')])]));
    });
  }, function(){ clear(cx); });
}
/* Aviso por cima da lista: transferências que parecem ir de uma conta tua
   para outra e ainda não estão ligadas. Lê-se uma vez (fica na cache). */
function fnAvisoPares(zona){
  var aviso = h('div');
  zona.appendChild(aviso);
  fnLer('pares', '/api/financas/pares/sugeridos').then(function(r){
    var ps = r.pares || [];
    if (!ps.length || !aviso.isConnected) return;
    var certos = ps.filter(function(x){ return x.certo; }).length;
    aviso.appendChild(h('div', { class: 'fn-banner' }, [h('span', { class: 'fn-pill ai' }, '✦ Entre contas'),
      h('div', { class: 'g' }, [h('b', null, ps.length + (ps.length === 1 ? ' transferência parece' : ' transferências parecem') + ' ir de uma conta tua para outra'),
        h('span', { class: 'fn-muted' }, ' · o mesmo valor ao contrário, noutra conta, perto da data' + (certos ? '; ' + certos + ' sem dúvidas' : '') + '.')]),
      fnBtn('Ver e ligar', function(){ fnParesJanela(ps); }, 'small')]));
  }, function(){});
}
function fnParesJanela(ps){
  var marc = {};
  ps.forEach(function(x, i){ marc[i] = x.certo; });
  var cont = h('small', { class: 'fn-muted' });
  var contar = function(){ cont.textContent = Object.keys(marc).filter(function(k){ return marc[k]; }).length + ' escolhidas.'; };
  var lista = h('div', { class: 'fn-lista', style: 'max-height:60vh;overflow:auto' }, ps.map(function(x, i){
    return h('label', { class: 'fn-check', style: 'align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--line)' }, [
      h('input', { type: 'checkbox', checked: !!marc[i], onchange: function(e){ marc[i] = e.target.checked; contar(); } }),
      h('span', { style: 'flex:1;min-width:0' }, [
        h('span', { style: 'display:flex;gap:8px;justify-content:space-between' }, [h('b', { style: 'font-weight:500' }, x.saida.conta + ' → ' + x.entrada.conta), h('b', { class: 'fn-n', style: 'font-weight:500' }, fnEur(-x.saida.valor))]),
        h('small', { class: 'fn-muted', style: 'display:block' }, fnData(x.saida.data) + ' · ' + x.saida.descricao),
        h('small', { class: 'fn-muted', style: 'display:block' }, fnData(x.entrada.data) + ' · ' + x.entrada.descricao),
        h('span', { class: 'fn-pill ' + (x.duvidoso ? 'warn' : 'ai'), style: 'margin-top:2px' }, x.duvidoso ? 'há outro igual: confirma' : '✦ ' + Math.round(x.confianca * 100) + '%')])]);
  }));
  contar();
  fnJanela('Transferências entre contas', [h('p', { class: 'fn-nota' }, 'Cada linha é uma saída numa conta e a entrada noutra. Ligadas, ficam em «Entre contas» (ou «Pagamento do cartão») e mostram de onde vieram e para onde foram.'), lista, cont],
    [{ txt: 'Ligar as escolhidas', pri: true, fn: function(){
      var pares = ps.filter(function(x, i){ return marc[i]; }).map(function(x){ return [x.saida.id, x.entrada.id]; });
      if (!pares.length) { fnAviso('Nenhuma escolhida.'); return false; }
      return fnApi('/api/financas/pares', 'POST', { pares: pares }).then(function(r){ fnAviso(r.feitos + ' ligadas.'); fnMudou(); }, fnErro);
    } }]);
  var ovs = document.querySelectorAll('.fn-ov'); var mod = ovs.length ? ovs[ovs.length - 1].querySelector('.fn-mod') : null; if (mod) mod.classList.add('largo');
}

/* O detalhe de um movimento abre numa janela por cima da lista. */
function fnMovJanela(m){
  var corpo = h('div', { class: 'fn-movdet' });
  var j = fnJanela((m.valor > 0 ? 'Entrada' : 'Saída') + ' · ' + fnData(m.data), [corpo], []);
  var ovs = document.querySelectorAll('.fn-ov');
  var mod = ovs.length ? ovs[ovs.length - 1].querySelector('.fn-mod') : null;
  if (mod) mod.classList.add('largo');
  FN.movJanela = j;
  fnPainelMov(corpo, m, true);
  return j;
}

/* O filtro das contas: todas, uma, ou várias. Um botão como os outros
   filtros, que abre a lista com a data do último extrato de cada conta. */
function fnFiltroContas(depois){
  var contas = FN.base.contas.filter(function(c){ return c.ativo; });
  var sel = String(FN.mov.conta || '').split(',').filter(Boolean);
  var rot = !sel.length ? 'Todas as contas' : sel.length === 1 ? ((fnConta(Number(sel[0])) || {}).nome || '1 conta') : sel.length + ' contas';
  var caixa = h('div', { class: 'fn-contas-pop', style: 'display:none;position:absolute;z-index:30;top:calc(100% + 4px);left:0;min-width:280px;max-height:360px;overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);padding:6px' });
  var aplicar = function(lista){ FN.mov.conta = lista.join(','); FN.mov.sel = {}; document.removeEventListener('click', fora); if (depois) depois(); else fnRender('financas'); };
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
        .then(function(){ fnMovAtualizar(m.id); }, fnErro);
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

function fnLinhaMov(m, aoMarcar){
  var cat;
  if (m.categoria_id) cat = h('span', { class: 'fn-pill' + (m.natureza === 'transferencia' || m.natureza === 'financiamento' || m.natureza === 'acerto' ? ' tr' : m.natureza === 'receita' ? ' good' : ''), title: fnCatNome(m.categoria_id) }, fnCatNome(m.categoria_id, true));
  else if (m.ia_categoria_id) cat = h('div', { class: 'fn-acoes' }, [h('span', { class: 'fn-pill ai', title: 'Sugestão: ' + ({ historico: 'histórico', modelo: 'Gemini', transferencia: 'transferência entre contas' }[m.ia_fonte] || m.ia_fonte) },
      '✦ ' + fnCatNome(m.ia_categoria_id, true) + ' · ' + Math.round((m.ia_confianca || 0) * 100) + '%'),
    h('button', { type: 'button', class: 'btn small', onclick: function(e){ e.stopPropagation();
      fnApi('/api/financas/movimentos/' + m.id, 'PATCH', { categoria_id: m.ia_categoria_id, aceite: true }).then(function(){ fnMovAtualizar(m.id); }, fnErro); } }, 'Aceitar')]);
  else cat = h('span', { class: 'fn-pill warn' }, 'por categorizar');
  /* Repartido por várias categorias (parte combustível, parte Via Verde). */
  var minhas = (m.partes || []).filter(function(x){ return !x.pessoa_id && x.categoria_id; });
  if (minhas.length > 1) cat = h('span', { class: 'fn-pill', title: minhas.map(function(x){ return fnCatNome(x.categoria_id) + ' ' + fnEur(Math.abs(x.valor)); }).join(' · ') },
    minhas.map(function(x){ return fnCatNome(x.categoria_id, true); }).join(' + '));
  cat = fnCatNaLinha(m, cat.classList.contains('fn-acoes') ? Array.prototype.slice.call(cat.childNodes) : [cat]);
  var lig = [];
  var tf = m.tarefa;
  if (tf && tf.tipo === 'pagamento' && m.expense_id && tf.expense_id === m.expense_id)
    lig.push(h('span', { class: 'fn-pill good', title: 'Pagamento: ' + tf.title + ' · despesa: ' + (m.despesa || '') }, 'pago · ' + tf.title.slice(0, 24)));
  else {
    if (m.expense_id) lig.push(h('span', { class: 'fn-pill good', title: m.despesa || '' }, (m.despesa_papel ? 'papel · ' : 'despesa · ') + (m.despesa || '').slice(0, 24)));
    if (tf) lig.push(h('span', { class: 'fn-pill', title: (tf.tipo === 'pagamento' ? 'Pagamento: ' : 'Tarefa: ') + tf.title }, 'tarefa · ' + tf.title.slice(0, 24)));
  }
  if (m.par_id) {
    var pc = fnConta(m.par_conta_id);
    lig.push(h('span', { class: 'fn-pill tr', title: 'Transferência entre contas' + (m.par_data ? ' · ' + fnData(m.par_data) : '') }, (m.valor < 0 ? '→ para ' : '← de ') + (pc ? pc.nome : 'outra conta')));
  } else if (m.para_conta_id) {
    var dc = fnConta(m.para_conta_id);
    lig.push(h('span', { class: 'fn-pill tr', title: 'Transferência entre contas · o outro lado ainda não está no Farol' }, (m.valor < 0 ? '→ para ' : '← de ') + (dc ? dc.nome : 'outra conta')));
  }
  if (m.project_id) lig.push(h('span', { class: 'fn-pill', title: 'Projeto: ' + (m.projeto || '') }, 'projeto · ' + (m.projeto || fnProjetoNome(m.project_id))));
  if (m.cc_pessoa) lig.push(h('span', { class: 'fn-pill tr' }, (m.cc_origem === 'reembolso' ? 'reembolso · ' : 'c/c · ') + m.cc_pessoa));
  var outros = (m.partes || []).filter(function(p){ return p.pessoa_id; });
  if (outros.length) lig.push(h('span', { class: 'fn-pill tr', title: outros.map(function(p){ return p.pessoa + ' ' + fnEur(-p.valor); }).join(' · ') },
    'dividido · ' + outros.map(function(p){ return (p.pessoa || '').split(' ')[0]; }).join(', ')));
  if (m.reembolso) lig.push(h('div', { class: 'fn-acoes' }, [h('span', { class: 'fn-pill ai', title: m.reembolso.motivo }, '✦ de ' + m.reembolso.nome + '?'),
    h('button', { type: 'button', class: 'btn small', onclick: function(e){ e.stopPropagation();
      fnApi('/api/financas/movimentos/' + m.id, 'PATCH', { cc_pessoa_id: m.reembolso.pessoa_id }).then(function(){ fnAviso('Reembolso de ' + m.reembolso.nome + '.'); fnMovAtualizar(m.id); }, fnErro); } }, 'Sim')]));
  else if (m.divisao) lig.push(h('div', { class: 'fn-acoes' }, [h('span', { class: 'fn-pill ai', title: fnTextoDivisao(m.divisao) }, '✦ parte de «' + m.divisao.descricao.slice(0, 18) + '»?'),
    h('button', { type: 'button', class: 'btn small', onclick: function(e){ e.stopPropagation(); fnAceitarDivisao(m.id, m.divisao); } }, 'Sim')]));
  if (!lig.length && m.valor < 0 && m.natureza === 'despesa') lig.push(h('span', { class: 'fn-muted', style: 'font-size:.75rem' }, '—'));
  var conta = fnConta(m.conta_id);
  /* A área: a do movimento, ou (esbatida) a da conta, que é a que vale
     quando o movimento não tem uma sua. */
  var ctx = fnCtx(m.context_id || (conta && conta.context_id));
  var daConta = !m.context_id && ctx;
  var tr = h('tr', { class: 'clic' + (FN.tocados && FN.tocados[m.id] ? ' fn-tocada' : ''), 'data-id': m.id, onclick: function(){ fnMovJanela(m); } }, [
    h('td', { onclick: function(e){ e.stopPropagation(); } }, [h('input', { type: 'checkbox', 'aria-label': 'Escolher', checked: !!FN.mov.sel[m.id], onchange: function(e){ FN.mov.sel[m.id] = e.target.checked; if (aoMarcar) aoMarcar(); else fnRender('financas'); } })]),
    h('td', { class: 'fn-n', style: 'font-size:.75rem;white-space:nowrap' }, fnData(m.data)),
    h('td', { title: conta ? conta.nome : '', style: 'font-size:.75rem;line-height:1.25' }, conta ? conta.nome : h('span', { class: 'fn-muted' }, '—')),
    h('td', { style: 'min-width:0' }, [h('span', { class: 'd', title: m.descricao }, m.descricao), m.categoria_fonte === 'regra' ? h('small', { class: 'd2' }, 'categoria por regra') : null]),
    h('td', { class: 'r ' + (m.valor > 0 ? 'fn-good' : '') }, [fnEur(m.valor, true), fnMinhaParte(m)]),
    h('td', { class: 'r fn-saldo' + (m.saldo_calculado ? ' calc' : ''), title: m.saldo == null ? '' : m.saldo_calculado ? 'Saldo calculado a partir dos saldos conhecidos da conta' : 'Saldo do extrato' }, m.saldo == null ? '—' : fnEur(m.saldo)),
    h('td', null, [cat]),
    h('td', { class: 'fn-area' + (daConta ? ' da-conta' : ''), title: ctx ? fnCtxNome(ctx.id) + (daConta ? ' · da conta ' + (conta ? conta.nome : '') + ' (o movimento não tem área própria)' : '') : '' }, ctx ? ctx.name : h('span', { class: 'fn-muted' }, '—')),
    h('td', { class: 'fn-dequem', onclick: function(e){ e.stopPropagation(); fnEscolherPessoa([m.id], fnIdsPessoas(m)); } }, fnDeQuem(m)),
    h('td', null, lig)
  ]);
  return tr;
}

/* De quem e o movimento: uma ou varias pessoas do agregado, com a cara de
   cada uma, ou um sinal discreto para as escolher. */
function fnIdsPessoas(m){ return (m.person_ids && m.person_ids.length ? m.person_ids : (m.person_id ? [m.person_id] : [])).map(Number); }
function fnDeQuem(m){
  var ids = fnIdsPessoas(m);
  if (!ids.length) return h('button', { type: 'button', class: 'fn-dq vazio', title: 'De quem é este movimento?' }, '+ pessoa');
  var ps = ids.map(function(id, i){ return fnPessoas().filter(function(x){ return x.id === id; })[0] || { name: (m.pessoas_nomes && m.pessoas_nomes[i]) || m.pessoa_nome || '?' }; });
  var nomes = ps.map(function(p){ return p.name; });
  return h('button', { type: 'button', class: 'fn-dq', title: nomes.join(', ') + ' · mudar' },
    [h('span', { class: 'fn-dq-avs' }, ps.slice(0, 3).map(fnAvatar)), h('span', null, ps.length === 1 ? nomes[0] : ps.length === 2 ? nomes.map(function(n){ return n.split(' ')[0]; }).join(' e ') : nomes[0].split(' ')[0] + ' +' + (ps.length - 1))]);
}
function fnAvatar(p){
  if (typeof ibAvatar === 'function') return ibAvatar(p);
  return h('span', { class: 'ib-av', style: 'background:' + (p.color || 'var(--accent)') }, p.initials || String(p.name || '?').slice(0, 1));
}
/* As caras das pessoas para escolher uma ou varias (carregar liga e desliga). */
function fnEscolhaPessoas(atuais, aoMudar){
  if (typeof ibEstilo === 'function') ibEstilo();
  var marc = {};
  (atuais || []).forEach(function(id){ marc[Number(id)] = true; });
  var caixa = h('div', { class: 'ib-pessoas' });
  fnPessoas().forEach(function(p){
    var b = h('button', { type: 'button', class: 'ib-pessoa' + (marc[p.id] ? ' on' : ''), 'aria-pressed': marc[p.id] ? 'true' : 'false', onclick: function(){
      marc[p.id] = !marc[p.id]; b.classList.toggle('on', marc[p.id]); b.setAttribute('aria-pressed', marc[p.id] ? 'true' : 'false'); if (aoMudar) aoMudar();
    } }, [fnAvatar(p), h('span', null, p.name)]);
    caixa.appendChild(b);
  });
  caixa.valor = function(){ return fnPessoas().filter(function(p){ return marc[p.id]; }).map(function(p){ return p.id; }); };
  caixa.limpar = function(){ marc = {}; [].forEach.call(caixa.children, function(b){ b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); }); };
  return caixa;
}
/* A mesma janela da catalogacao dos documentos, agora com varias pessoas:
   carrega-se em quem for e grava-se (num movimento ou em varios). */
function fnEscolherPessoa(ids, atuais){
  if (typeof ibEstilo === 'function') ibEstilo();
  var dlg = h('dialog', { class: 'ib-dlg' });
  var fechar = function(){ try { dlg.close(); } catch (e) {} if (dlg.parentNode) dlg.parentNode.removeChild(dlg); };
  var gravar = function(pids){
    var q = ids.length === 1 ? fnApi('/api/financas/movimentos/' + ids[0], 'PATCH', { person_ids: pids })
      : fnApi('/api/financas/movimentos/lote', 'POST', { ids: ids, person_ids: pids });
    q.then(function(){
      fechar();
      if (ids.length === 1) fnMovAtualizar(ids[0]);
      else { FN.mov.sel = {}; fnAviso(ids.length + (pids.length ? ' movimentos de ' + pids.map(fnPessoaNome).join(', ') + '.' : ' movimentos sem pessoa.')); fnMudou(); }
    }, fnErro);
  };
  var escolha = fnEscolhaPessoas(atuais);
  dlg.appendChild(h('div', { class: 'ib-dlgc' }, [
    h('h3', null, ids.length === 1 ? 'De quem é este movimento?' : 'De quem são estes ' + ids.length + ' movimentos?'),
    h('p', null, 'Escolhe uma ou mais pessoas. Aparece na ficha de cada uma, no cartão «Movimentos do banco».'),
    escolha,
    h('div', { class: 'ib-dlga' }, [h('button', { type: 'button', class: 'btn', onclick: function(){ gravar([]); } }, 'Ninguém'),
      h('button', { type: 'button', class: 'btn', onclick: fechar }, 'Fechar'),
      h('button', { type: 'button', class: 'btn primary', onclick: function(){ gravar(escolha.valor()); } }, 'Guardar')])]));
  dlg.addEventListener('cancel', function(){ setTimeout(fechar, 0); });
  dlg.addEventListener('click', function(e){ if (e.target === dlg) fechar(); });
  document.body.appendChild(dlg);
  dlg.showModal();
}

/* Num movimento dividido, a parte que e mesmo do Marco. */
function fnMinhaParte(m){
  if (!m.partes || !m.partes.some(function(p){ return p.pessoa_id; })) return null;
  var minha = m.partes.filter(function(p){ return !p.pessoa_id; }).reduce(function(s, p){ return s + p.valor; }, 0);
  return h('small', { style: 'display:block', class: 'fn-muted' }, 'tua parte ' + fnEur(minha));
}

function fnBarraLote(ids, ms, limpar){
  var sc = fnSelCategorias('', 'Categoria…');
  var debs = (ms || []).filter(function(m){ return FN.mov.sel[m.id] && m.valor < 0; });
  var sa = fnSelAreas('', 'Área…');
  var spj = fnSelProjetos('', 'Projeto…');
  return h('div', { class: 'fn-barra', style: 'padding:8px;border-bottom:1px solid var(--line)' }, [
    h('b', null, ids.length + ' escolhidos'), sc,
    fnBtn('Categorizar', function(){ if (!sc.value) return fnAviso('Escolhe a categoria.');
      fnApi('/api/financas/movimentos/lote', 'POST', { ids: ids, categoria_id: Number(sc.value) }).then(function(r){ FN.mov.sel = {}; fnAviso(r.feitos + ' categorizados.'); fnMudou(); }, fnErro); }, 'small'),
    sa,
    fnBtn('Pôr na área', function(){
      fnApi('/api/financas/movimentos/lote', 'POST', { ids: ids, context_id: sa.value ? Number(sa.value) : null }).then(function(r){ FN.mov.sel = {}; fnAviso(r.feitos + ' arrumados.'); fnMudou(); }, fnErro); }, 'small'),
    spj,
    fnBtn('Pôr no projeto', function(){
      fnApi('/api/financas/movimentos/lote', 'POST', { ids: ids, project_id: spj.value ? Number(spj.value) : null }).then(function(r){ FN.mov.sel = {}; fnAviso(r.feitos + (spj.value ? ' postos no projeto.' : ' tirados do projeto.')); fnMudou(); }, fnErro); }, 'small'),
    fnBtn('De quem…', function(){ fnEscolherPessoa(ids, null); }, 'small'),
    debs.length ? fnBtn('Partilhar… (' + debs.length + ')', function(){ fnPartilhaJanela(debs); }, 'small') : null,
    fnBtn('Aceitar sugestões', function(){
      fnApi('/api/financas/movimentos/lote', 'POST', { ids: ids, aceitar: true }).then(function(r){ FN.mov.sel = {}; fnAviso(r.feitos + ' categorizados.'); fnMudou(); }, fnErro); }, 'small'),
    fnBtn('Apagar', function(){
      fnJanela('Apagar ' + ids.length + ' movimentos?', [h('p', null, 'Saem do Farol. Se voltares a importar o mesmo extrato, voltam a entrar.')], [{ txt: 'Apagar', pri: true, fn: function(){
        return fnApi('/api/financas/movimentos/lote', 'POST', { ids: ids, apagar: true }).then(function(r){ FN.mov.sel = {}; fnAviso(r.feitos + ' apagados.'); fnMudou(); }, fnErro); } }]);
    }, 'small'),
    fnBtn('Limpar', function(){ if (limpar) limpar(); else { FN.mov.sel = {}; fnRender('financas'); } }, 'small')
  ]);
}

/* O painel do movimento: categoria, área, conta corrente, e a reconciliação
   com as despesas do Farol. */
function fnPainelMov(p, m, emJanela){
  var conta = fnConta(m.conta_id);
  if (!emJanela) p.appendChild(h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('h3', { style: 'font-size:1.05rem' }, 'Movimento'), h('button', { type: 'button', class: 'btn small', onclick: function(){ FN.mov.aberto = null; fnRender('financas'); } }, 'Fechar')]));
  p.appendChild(h('div', { class: 'fn-caixa', style: 'background:var(--surface-2)' }, [
    h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, m.descricao), h('b', { class: 'fn-n ' + (m.valor > 0 ? 'fn-good' : '') }, fnEur(m.valor, true))]),
    h('small', { class: 'fn-muted' }, fnData(m.data) + ' · ' + (conta ? conta.nome : '') + (m.saldo != null ? ' · saldo ' + fnEur(m.saldo) : '') + (m.categoria_fonte ? ' · categoria: ' + ({ regra: 'regra', tu: 'escolhida por ti', 'tu-corrigiu': 'corrigida por ti', 'ia-aceite': 'sugestão aceite', par: 'transferência ligada' }[m.categoria_fonte] || m.categoria_fonte) : '')),
    m.nota ? h('small', null, 'Nota: ' + m.nota) : null]));

  var sc = fnSelCategorias(m.categoria_id || m.ia_categoria_id);
  /* Sem área própria, vale a da conta: diz-se qual é. */
  var ctxConta = conta && conta.context_id ? fnCtx(conta.context_id) : null;
  var sa = fnSelAreas(m.context_id, ctxConta ? '— a da conta: ' + ctxConta.name + ' —' : '— sem área —');
  var spj = fnSelProjetos(m.project_id);
  var spe = fnEscolhaPessoas(fnIdsPessoas(m));
  spe.style.gridTemplateColumns = 'repeat(auto-fill,minmax(150px,1fr))';
  var nota = h('input', { class: 'fn-in', value: m.nota || '', placeholder: 'Nota' });
  var regra = h('input', { type: 'checkbox' });
  var padrao = h('input', { class: 'fn-in', value: fnChaveDesc(m.descricao), 'aria-label': 'Texto da regra' });
  var minhas = (m.partes || []).filter(function(x){ return !x.pessoa_id && x.categoria_id; });
  var catCampo = fnCampo('Categoria' + (!m.categoria_id && m.ia_categoria_id ? ' (sugerida)' : '') + (minhas.length > 1 ? ' (a maior parte)' : ''), sc);
  p.appendChild(h('div', { class: 'fn-campos' }, [catCampo, fnCampo('Área', sa)]));
  if (m.valor !== 0) p.appendChild(h('div', { class: 'fn-acoes', style: 'margin-top:-4px' }, [
    minhas.length > 1 ? h('small', { class: 'fn-muted' }, 'Repartido: ' + minhas.map(function(x){ return fnCatNome(x.categoria_id, true) + ' ' + fnEur(Math.abs(x.valor)); }).join(' · ')) : null,
    fnBtn(minhas.length > 1 ? 'Alterar as categorias…' : 'Repartir por categorias…', function(){ fnCategoriasJanela(m); }, 'small')]));
  p.appendChild(fnCampo('Projeto', spj));
  p.appendChild(h('div', { class: 'fn-campo' }, [h('span', null, 'De quem é (agregado) · uma ou mais pessoas'), spe]));
  p.appendChild(fnCampo('Nota', nota));
  p.appendChild(h('label', { class: 'fn-check' }, [regra, 'Criar regra: quando a descrição tiver']));
  p.appendChild(padrao);
  p.appendChild(h('div', { class: 'fn-acoes' }, [fnBtn('Guardar', function(){
    var corpo = { categoria_id: sc.value ? Number(sc.value) : null, context_id: sa.value ? Number(sa.value) : null, nota: nota.value,
      project_id: spj.value ? Number(spj.value) : null, person_ids: spe.valor(),
      aceite: !m.categoria_id && m.ia_categoria_id && String(m.ia_categoria_id) === sc.value };
    if (regra.checked) { corpo.criar_regra = true; corpo.regra_padrao = padrao.value; }
    var mudouCat = corpo.categoria_id && corpo.categoria_id !== m.categoria_id && !corpo.aceite;
    fnApi('/api/financas/movimentos/' + m.id, 'PATCH', corpo).then(function(){
      fnAviso('Guardado.');
      var depois = corpo.criar_regra ? fnMudou() : fnMovAtualizar(m.id);
      if (mudouCat) Promise.resolve(depois).then(function(){ fnSemelhantes(m, corpo.categoria_id); });
    }, fnErro);
  }, 'primary small'), fnBtn('Apagar movimento', function(){
    fnJanela('Apagar este movimento?', [h('p', null, m.descricao + ' · ' + fnEur(m.valor))], [{ txt: 'Apagar', pri: true, fn: function(){
      return fnApi('/api/financas/movimentos/' + m.id, 'DELETE').then(function(){ FN.mov.aberto = null; fnMudou(); }, fnErro); } }]);
  }, 'small')]));

  fnPainelPar(p, m);
  /* Uma transferência entre contas tuas não se partilha nem é despesa. */
  if (m.par_id || m.para_conta_id) return;
  if (m.valor === 0) return;
  fnPainelTarefa(p, m);
  fnPainelPartilhas(p, m);
  if (m.valor > 0) return;
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
/* Tarefa do movimento: o pagamento que ele pagou (tarefa → despesa →
   movimento) ou uma tarefa a que diz respeito. Ligar a um pagamento por
   pagar marca-o pago com a data e o valor do banco. */
function fnPainelTarefa(p, m){
  p.appendChild(h('div', { class: 'mono', style: 'margin-top:6px' }, 'Tarefa'));
  var t = m.tarefa;
  if (t) {
    var pag = t.tipo === 'pagamento';
    var est = pag ? (t.paid_on ? 'paga a ' + fnData(t.paid_on) + (t.paid_amount != null ? ' · ' + fnEur(Number(t.paid_amount)) : '') : 'por pagar')
      : ({ aberta: 'aberta', em_curso: 'em curso', a_espera: 'à espera', concluida: 'concluída' }[t.status] || t.status);
    p.appendChild(h('div', { class: 'fn-caixa melhor' }, [
      h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, t.title), h('span', { class: 'fn-pill ' + (pag ? 'good' : 'tr') }, pag ? 'pagamento' : 'tarefa')]),
      h('small', { class: 'fn-muted' }, [est, t.docs ? t.docs + (t.docs === 1 ? ' papel' : ' papéis') : null,
        pag && t.expense_id && t.expense_id === m.expense_id ? 'com a despesa da tarefa' : null,
        t.ligada ? null : 'ligada pela despesa'].filter(Boolean).join(' · ')),
      h('div', { class: 'fn-acoes' }, [
        fnBtn('Abrir a tarefa', function(){ fnAbrirTarefa(t.id); }, 'small'),
        t.ligada ? null : fnBtn('Confirmar', function(){ fnLigarTarefa(m, t.id); }, 'primary small'),
        fnBtn(t.ligada ? 'Desligar' : 'Não é esta', function(){
          fnApi('/api/financas/movimentos/' + m.id + '/tarefa', 'DELETE').then(function(){ fnAviso('Desligada.'); fnMudou(); }, fnErro);
        }, 'small')])]));
    return;
  }
  var cx = h('div', { class: 'fn-lista' }, [h('p', { class: 'fn-nota' }, 'A procurar tarefas…')]);
  p.appendChild(cx);
  apiGestao('/api/financas/movimentos/' + m.id + '/tarefas').then(function(r){
    clear(cx);
    if (r.sugestoes.length) r.sugestoes.forEach(function(x, i){ cx.appendChild(fnCartaoTarefa(m, x, i === 0)); });
    else cx.appendChild(h('p', { class: 'fn-nota' }, 'Nenhuma tarefa parece ser deste movimento (valor, nome de quem recebeu, data, área).'));
    var iaBox = h('div');
    cx.appendChild(h('div', { class: 'fn-acoes' }, [
      fnBtn('Escolher da lista' + (r.area && r.area.nome ? ' · ' + r.area.nome : '') + '…', function(){ fnTarefasJanela(m, r); }, 'small'),
      r.ia ? fnBtn('✦ Perguntar à IA', function(){
        clear(iaBox); iaBox.appendChild(h('p', { class: 'fn-nota' }, 'A IA está a ver as tarefas…'));
        apiGestao('/api/financas/movimentos/' + m.id + '/tarefas/ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then(function(x){
          clear(iaBox);
          if (x.tarefa) iaBox.appendChild(fnCartaoTarefa(m, x.tarefa, true));
          else iaBox.appendChild(h('p', { class: 'fn-nota' }, 'A IA não encontrou nenhuma tarefa deste movimento. Escolhe da lista.'));
        }, function(e){ clear(iaBox); iaBox.appendChild(h('p', { class: 'fn-nota' }, e.message)); });
      }, 'small') : null]));
    cx.appendChild(iaBox);
  }, function(e){ clear(cx); cx.appendChild(h('p', { class: 'fn-nota' }, e.message)); });
}
function fnCartaoTarefa(m, t, melhor, antes){
  var pag = t.tipo === 'pagamento';
  var paga = Boolean(t.paid_on) || t.status === 'concluida';
  var valor = t.paid_amount != null ? t.paid_amount : t.amount;
  var quando = t.paid_on ? 'paga a ' + fnData(t.paid_on) : t.status === 'concluida' ? 'concluída' : t.due_on ? 'vence a ' + fnData(t.due_on) : 'sem data';
  var porque = t.ia ? t.ia.porque : (t.porque || []).join(' · ');
  var pct = t.ia ? '✦ IA ' + Math.round(t.ia.confianca * 100) + '%' : (t.score ? '✦ ' + Math.round(t.score * 100) + '%' : null);
  return h('div', { class: 'fn-caixa' + (melhor ? ' melhor' : ''), style: 'margin-bottom:6px' }, [
    h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, t.title), pct ? h('span', { class: 'fn-pill ai' }, pct) : null]),
    h('small', { class: 'fn-muted' }, [pag ? 'pagamento' : 'tarefa', t.area, quando, valor != null ? fnEur(valor) : null, t.payee, t.repete ? 'repete' : null,
      t.docs ? t.docs + (t.docs === 1 ? ' papel' : ' papéis') : null].filter(Boolean).join(' · ')),
    porque ? h('small', { class: 'fn-nota', style: 'display:block' }, porque) : null,
    t.outro_mov ? h('small', { class: 'fn-muted' }, 'Já está ligada a outro movimento.') :
      h('div', { class: 'fn-acoes' }, [
        fnBtn(pag && !paga ? 'Ligar e marcar paga' : 'Ligar', function(){ if (antes) antes(); fnLigarTarefa(m, t.id); }, (melhor ? 'primary ' : '') + 'small'),
        fnBtn('Abrir', function(){ fnAbrirTarefa(t.id); }, 'small')])]);
}
/* Ligar; se a tarefa e o movimento têm cada um a sua despesa, pergunta-se
   qual fica (não se conta duas vezes). */
function fnLigarTarefa(m, tid, escolha){
  return fetch('/api/financas/movimentos/' + m.id + '/tarefa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ task_id: tid, despesa: escolha || null }) })
    .then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){
        if (r.status === 409 && j.conflito) { fnConflitoDespesas(m, tid, j.conflito); return; }
        if (!r.ok) throw new Error(j.error || 'Não foi possível ligar.');
        fnTocou('/api/financas/movimentos/' + m.id);
        fnAviso(j.pago ? 'Ligada e marcada paga a ' + fnData(m.data) + ' (' + fnEur(Math.abs(m.valor)) + ').' : 'Ligada.' + (j.apagadas ? ' A despesa a mais saiu.' : ''));
        /* As tarefas do ecrã das Tarefas ficam a par (uma paga mudou). */
        apiGestao('/api/gestao').then(function(d){ window.G = d; }, function(){});
        fnMudou();
      });
    }).catch(fnErro);
}
function fnConflitoDespesas(m, tid, c){
  var caixa = function(titulo, ds){
    var tot = ds.reduce(function(s, d){ return s + Number(d.amount || 0); }, 0);
    return h('div', { class: 'fn-caixa', style: 'margin-bottom:8px' }, [h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, titulo), h('b', { class: 'fn-n' }, fnEur(tot))])]
      .concat(ds.map(function(d){ return h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [d.description, h('small', null, [fnData(d.spent_on), d.merchant, d.papel ? 'com papel' : null, d.splitwise ? 'no Splitwise' : null].filter(Boolean).join(' · '))]), h('span', { class: 'fn-n' }, fnEur(d.amount))]); })));
  };
  fnJanela('Duas despesas para o mesmo pagamento', [
    h('p', { class: 'fn-nota' }, 'A tarefa já foi paga e tem a sua despesa; o movimento também tem uma. Ficando as duas, o mesmo dinheiro conta duas vezes. Escolhe a que fica: a outra sai (se nada mais precisar dela).'),
    caixa('Da tarefa', c.tarefa || []), caixa('Do movimento', c.movimento ? [c.movimento] : [])], [
    { txt: 'Fica a da tarefa', pri: true, fn: function(){ fnLigarTarefa(m, tid, 'tarefa'); } },
    { txt: 'Fica a do movimento', fn: function(){ fnLigarTarefa(m, tid, 'movimento'); } },
    { txt: 'Ficam as duas', fn: function(){ fnLigarTarefa(m, tid, 'ambas'); } }]);
}
/* Escolher entre as tarefas de uma área (por omissão, a do movimento). */
function fnTarefasJanela(m, r0){
  var q = h('input', { class: 'fn-in', placeholder: 'Procurar pelo nome ou a quem se paga' });
  var sa = fnSelAreas(r0.area ? r0.area.id : '', '— todas as áreas —');
  var st = h('select', { class: 'fn-sel' }, [h('option', { value: 'pagamentos' }, 'Pagamentos'), h('option', { value: 'todas' }, 'Pagamentos e tarefas')]);
  var se = h('select', { class: 'fn-sel' }, [h('option', { value: 'todas' }, 'Abertas e recentes'), h('option', { value: 'abertas' }, 'Só abertas')]);
  var lista = h('div', { class: 'fn-lista', style: 'max-height:55vh;overflow:auto' });
  var j;
  var desenhar = function(ts){
    clear(lista);
    if (!ts.length) { lista.appendChild(h('p', { class: 'fn-nota' }, 'Nenhuma tarefa com estes filtros.')); return; }
    ts.forEach(function(t){ lista.appendChild(fnCartaoTarefa(m, t, false, function(){ j.fechar(); })); });
  };
  var vez = 0;
  var ler = function(){
    var n = ++vez;
    lista.style.opacity = '.5';
    apiGestao('/api/financas/movimentos/' + m.id + '/tarefas?' + fnQs({ q: q.value.trim(), area: sa.value || 'todas', tipo: st.value, estado: se.value })).then(function(r){
      if (n !== vez) return;
      lista.style.opacity = '';
      desenhar(r.tarefas);
    }, function(e){ lista.style.opacity = ''; fnErro(e); });
  };
  var espera;
  q.addEventListener('input', function(){ clearTimeout(espera); espera = setTimeout(ler, 300); });
  [sa, st, se].forEach(function(s){ s.addEventListener('change', ler); });
  j = fnJanela('Tarefas · ' + m.descricao.slice(0, 40), [
    h('p', { class: 'fn-nota' }, fnData(m.data) + ' · ' + fnEur(m.valor, true) + '. Primeiro as que mais se parecem com o movimento.'),
    q, h('div', { class: 'fn-campos' }, [fnCampo('Área', sa), fnCampo('Tipo', st), fnCampo('Estado', se)]), lista], []);
  desenhar(r0.tarefas || []);
  var ovs = document.querySelectorAll('.fn-ov'); var mod = ovs.length ? ovs[ovs.length - 1].querySelector('.fn-mod') : null; if (mod) mod.classList.add('largo');
}
/* Abre o detalhe da tarefa numa folha por cima (aviso.js), fechando antes as
   janelas das Finanças. Sem folha, salta-se para o ecrã das Tarefas. */
function fnAbrirTarefa(id){
  [].slice.call(document.querySelectorAll('.fn-ov')).forEach(function(o){ if (o.parentNode) o.parentNode.removeChild(o); });
  FN.movJanela = null;
  var ir = function(){
    if (typeof avTarefaId === 'function' && avTarefaId(id)) return true;
    return typeof tfIrPara === 'function' && tfIrPara(id);
  };
  if (ir()) return;
  apiGestao('/api/gestao').then(function(d){ window.G = d; if (!ir()) fnAviso('Não encontrei a tarefa.'); }, fnErro);
}
/* Aviso da lista: pagamentos que quase de certeza foram pagos por estes
   movimentos (mesmo valor, nome no banco ou data). */
function fnAvisoTarefas(zona){
  var aviso = h('div');
  zona.appendChild(aviso);
  fnLer('tarefasSug', '/api/financas/tarefas/sugeridas').then(function(r){
    var ps = r.pares || [];
    if (!ps.length || !aviso.isConnected) return;
    aviso.appendChild(h('div', { class: 'fn-banner' }, [h('span', { class: 'fn-pill ai' }, '✦ Tarefas'),
      h('div', { class: 'g' }, [h('b', null, ps.length + (ps.length === 1 ? ' movimento parece' : ' movimentos parecem') + ' pagar uma tarefa de pagamento'),
        h('span', { class: 'fn-muted' }, ' · o mesmo valor, o nome de quem recebeu ou a data.')]),
      fnBtn('Ver e ligar', function(){ fnTarefasLoteJanela(ps); }, 'small')]));
  }, function(){});
}
function fnTarefasLoteJanela(ps){
  var marc = {};
  ps.forEach(function(x, i){ marc[i] = !x.conflito; });
  var cont = h('small', { class: 'fn-muted' });
  var contar = function(){ cont.textContent = Object.keys(marc).filter(function(k){ return marc[k]; }).length + ' escolhidos.'; };
  var lista = h('div', { class: 'fn-lista', style: 'max-height:60vh;overflow:auto' }, ps.map(function(x, i){
    var t = x.tarefa, mv = x.movimento;
    return h('label', { class: 'fn-check', style: 'align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--line)' + (x.conflito ? ';opacity:.7' : '') }, [
      h('input', { type: 'checkbox', checked: !!marc[i], disabled: x.conflito, onchange: function(e){ marc[i] = e.target.checked; contar(); } }),
      h('span', { style: 'flex:1;min-width:0' }, [
        h('span', { style: 'display:flex;gap:8px;justify-content:space-between' }, [h('b', { style: 'font-weight:500' }, t.title), h('b', { class: 'fn-n', style: 'font-weight:500' }, fnEur(-mv.valor))]),
        h('small', { class: 'fn-muted', style: 'display:block' }, fnData(mv.data) + ' · ' + mv.conta + ' · ' + mv.descricao),
        h('small', { class: 'fn-muted', style: 'display:block' }, [t.area, t.paid_on ? 'paga a ' + fnData(t.paid_on) : 'por pagar' + (t.due_on ? ', vence a ' + fnData(t.due_on) : '')].filter(Boolean).join(' · ') + ' · ' + x.porque.join(' · ')),
        x.conflito ? h('span', { class: 'fn-pill warn', style: 'margin-top:2px' }, 'cada um tem a sua despesa: abre o movimento para escolher a que fica')
          : h('span', { class: 'fn-pill ai', style: 'margin-top:2px' }, '✦ ' + Math.round(x.score * 100) + '%' + (t.paid_on ? '' : ' · fica paga'))])]);
  }));
  contar();
  fnJanela('Movimentos e tarefas de pagamento', [h('p', { class: 'fn-nota' }, 'Ligado, o movimento fica com a tarefa e a despesa dela; um pagamento ainda por pagar fica pago com a data e o valor do banco.'), lista, cont],
    [{ txt: 'Ligar os escolhidos', pri: true, fn: function(){
      var pares = ps.filter(function(x, i){ return marc[i]; }).map(function(x){ return { movimento_id: x.movimento.id, task_id: x.tarefa.id }; });
      if (!pares.length) { fnAviso('Nenhum escolhido.'); return false; }
      return fnApi('/api/financas/tarefas/ligar', 'POST', { pares: pares, ids: pares.map(function(x){ return x.movimento_id; }) }).then(function(r){
        fnAviso(r.ligados + ' ligados' + (r.saltados.length ? '; ' + r.saltados.length + ' ficaram por ligar (' + r.saltados[0].motivo + ')' : '') + '.');
        apiGestao('/api/gestao').then(function(d){ window.G = d; }, function(){});
        fnMudou();
      }, fnErro);
    } }]);
  var ovs = document.querySelectorAll('.fn-ov'); var mod = ovs.length ? ovs[ovs.length - 1].querySelector('.fn-mod') : null; if (mod) mod.classList.add('largo');
}
/* Um movimento em várias categorias (parte combustível, parte Via Verde). */
function fnCategoriasJanela(m){
  var outros = (m.partes || []).filter(function(x){ return x.pessoa_id; }).reduce(function(t, x){ return t + Math.abs(x.valor); }, 0);
  var total = Math.round((Math.abs(m.valor) - outros) * 100) / 100;
  var num = function(v){ var n = Number(String(v || '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? Math.round(n * 100) / 100 : 0; };
  var txt = function(v){ return v.toFixed(2).replace('.', ','); };
  var nat = m.valor < 0 ? 'despesa' : 'receita';
  var linhas = h('div');
  var resumo = h('p', { class: 'fn-nota' });
  function rows(){ return [].slice.call(linhas.querySelectorAll('.fn-ct-l')); }
  function atualizar(){
    var soma = rows().reduce(function(t, r){ return t + num(r.querySelector('input').value); }, 0);
    var falta = Math.round((total - soma) * 100) / 100;
    resumo.textContent = (outros ? 'A tua parte: ' : 'Total: ') + fnEur(total) + ' · repartido ' + fnEur(soma) + (Math.abs(falta) >= 0.01 ? (falta > 0 ? ' · faltam ' + fnEur(falta) : ' · passa ' + fnEur(-falta)) : ' · certo.');
    resumo.style.color = Math.abs(falta) >= 0.01 ? 'var(--bad)' : '';
  }
  function linha(cat, valor){
    var sc = fnSelCategorias(cat || '', '— categoria —', nat);
    var vi = h('input', { class: 'fn-in', inputmode: 'decimal', value: valor != null ? txt(valor) : '', placeholder: '0,00', style: 'max-width:110px' });
    vi.addEventListener('input', atualizar);
    var row = h('div', { class: 'fn-acoes fn-ct-l', style: 'margin-bottom:6px;flex-wrap:nowrap' }, [sc, vi,
      h('button', { type: 'button', class: 'btn small', 'aria-label': 'Tirar', onclick: function(){ row.parentNode.removeChild(row); atualizar(); } }, '×')]);
    linhas.appendChild(row);
  }
  var minhas = (m.partes || []).filter(function(x){ return !x.pessoa_id && x.categoria_id; });
  if (minhas.length > 1) minhas.forEach(function(x){ linha(x.categoria_id, Math.abs(x.valor)); });
  else { linha(m.categoria_id || m.ia_categoria_id, null); linha('', null); }
  fnJanela('Repartir por categorias', [
    h('p', { class: 'fn-nota' }, m.descricao + ' · ' + fnData(m.data) + ' · ' + fnEur(Math.abs(m.valor)) + (outros ? ' (a parte dos outros, ' + fnEur(outros) + ', fica de fora)' : '') + '.'),
    linhas,
    h('div', { class: 'fn-acoes' }, [fnBtn('+ Categoria', function(){ linha('', null); atualizar(); }, 'small'),
      fnBtn('A última fica com o resto', function(){ var rs = rows(); if (!rs.length) return; var antes = rs.slice(0, -1).reduce(function(t, r){ return t + num(r.querySelector('input').value); }, 0);
        rs[rs.length - 1].querySelector('input').value = txt(Math.max(0, Math.round((total - antes) * 100) / 100)); atualizar(); }, 'small')]),
    resumo,
    h('p', { class: 'fn-nota' }, 'Cada parte conta na sua categoria (nos resumos, na análise e nos orçamentos). Com uma só categoria, o movimento volta a ser normal.')
  ], [{ txt: 'Guardar', pri: true, fn: function(){
    var partes = rows().map(function(r){ return { categoria_id: r.querySelector('select').value ? Number(r.querySelector('select').value) : null, valor: num(r.querySelector('input').value) }; }).filter(function(x){ return x.valor > 0 || x.categoria_id; });
    if (partes.some(function(x){ return !x.categoria_id || !(x.valor > 0); })) { fnAviso('Cada parte precisa de categoria e valor.'); return false; }
    return fnApi('/api/financas/movimentos/' + m.id + '/categorias', 'PUT', { partes: partes }).then(function(r){
      fnAviso(r.partes > 1 ? 'Repartido por ' + r.partes + ' categorias.' : 'Uma só categoria.'); fnMovAtualizar(m.id);
    }, fnErro);
  } }]);
  atualizar();
}

/* Depois de corrigir a categoria: há outros movimentos com o mesmo texto?
   Pergunta-se se vão também (e se fica uma regra para os próximos). */
function fnSemelhantes(m, catId){
  apiGestao('/api/financas/movimentos/' + m.id + '/semelhantes').then(function(r){
    var ms = (r.movimentos || []).filter(function(x){ return x.categoria_id !== catId; });
    if (!ms.length) return;
    var marc = {};
    ms.forEach(function(x){ marc[x.id] = true; });
    var regra = h('input', { type: 'checkbox', checked: true });
    var porCat = {};
    ms.forEach(function(x){ var k = x.categoria_id ? fnCatNome(x.categoria_id, true) : 'sem categoria'; porCat[k] = (porCat[k] || 0) + 1; });
    var lista = h('div', { class: 'fn-lista', style: 'max-height:45vh;overflow:auto' }, ms.map(function(x){
      return h('label', { class: 'fn-check', style: 'padding:4px 0' }, [h('input', { type: 'checkbox', checked: true, onchange: function(e){ marc[x.id] = e.target.checked; } }),
        h('span', { style: 'flex:1;min-width:0' }, [fnData(x.data) + ' · ' + x.descricao, h('small', { class: 'fn-muted', style: 'display:block' }, ((fnConta(x.conta_id) || {}).nome || '') + ' · ' + (x.categoria_id ? fnCatNome(x.categoria_id) : 'sem categoria'))]),
        h('span', { class: 'fn-n' }, fnEur(x.valor, true))]);
    }));
    fnJanela('Mudar também os outros?', [
      h('p', null, 'Há ' + ms.length + (ms.length === 1 ? ' movimento' : ' movimentos') + ' com o mesmo texto («' + r.chave + '») noutra categoria (' + Object.keys(porCat).map(function(k){ return porCat[k] + ' em ' + k; }).join(', ') + '). Passam para «' + fnCatNome(catId) + '»?'),
      lista,
      h('label', { class: 'fn-check' }, [regra, 'E os próximos com este texto também (cria uma regra)'])
    ], [{ txt: 'Mudar os escolhidos', pri: true, fn: function(){
      var ids = Object.keys(marc).filter(function(k){ return marc[k]; }).map(Number);
      if (!ids.length) return true;
      return fnApi('/api/financas/movimentos/lote', 'POST', { ids: ids, categoria_id: catId }).then(function(x){
        var q = regra.checked ? fnApi('/api/financas/regras', 'POST', { padrao: r.chave, categoria_id: catId }).catch(function(){}) : Promise.resolve();
        return q.then(function(){ fnAviso(x.feitos + ' movimentos mudados' + (regra.checked ? ' e regra criada.' : '.')); fnMudou(); });
      }, fnErro);
    } }]);
  }, function(){});
}

/* Partilhas e acertos: o que este movimento é entre ti e os outros.
   Saída: despesa partilhada, paguei por um amigo, ou empréstimo que devolvo.
   Entrada: acerto de contas (alguém a pagar-te o que devia). */
function fnPainelPartilhas(p, m){
  p.appendChild(h('div', { class: 'mono', style: 'margin-top:6px' }, 'Partilhas e acertos'));
  var outros = (m.partes || []).filter(function(x){ return x.pessoa_id; });
  if (outros.length){
    var minha = (m.partes || []).filter(function(x){ return !x.pessoa_id; });
    var minhaV = minha.reduce(function(t, x){ return t - x.valor; }, 0);
    var pid = (m.partes || []).filter(function(x){ return x.partilha_id; }).map(function(x){ return x.partilha_id; })[0];
    var amigo = !minha.length && outros.length === 1;
    p.appendChild(h('div', { class: 'fn-caixa melhor' }, [
      h('b', null, amigo ? 'Paguei por ' + outros[0].pessoa : 'Despesa partilhada'),
      amigo ? null : h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, ['Eu', h('small', null, minha.length > 1 ? 'em ' + minha.length + ' categorias' : minha[0] && minha[0].categoria_id ? fnCatNome(minha[0].categoria_id) : 'sem categoria')]), h('span', { class: 'fn-n' }, fnEur(minhaV))])
    ].concat(outros.map(function(x){ return h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [x.pessoa, h('small', null, 'deve-te · ' + (x.conta || 'conta corrente'))]), h('span', { class: 'fn-n fn-good' }, fnEur(-x.valor))]); })).concat([
      h('div', { class: 'fn-acoes' }, [fnBtn('Alterar', function(){ if (pid) fnAbrirPartilha(pid); else fnPartilhaJanela([m]); }, 'small'),
        fnBtn('Desfazer', function(){ fnApi('/api/financas/movimentos/' + m.id + '/partes', 'DELETE').then(function(){ fnAviso('Desfeito.'); fnMudou(); }, fnErro); }, 'small')])])));
    return;
  }
  if (m.cc_pessoa_id){
    var sw = m.cc_sw_pagamento;
    p.appendChild(h('div', { class: 'fn-caixa melhor' }, [
      h('b', null, (m.valor > 0 ? 'Acerto de contas · ' : 'Empréstimo devolvido a ') + m.cc_pessoa),
      h('small', { class: 'fn-muted' }, 'Conta: ' + (m.cc_conta_direta ? (sw ? 'Splitwise, sem grupo' : 'só no Farol') : (m.cc_conta || 'conta corrente')) +
        (sw ? ' · pagamento no Splitwise ' + (m.cc_sw_criado ? '(criado pelo Farol)' : '(já lá estava)') : '') +
        '. Não conta como ' + (m.valor > 0 ? 'receita.' : 'despesa.')),
      h('div', { class: 'fn-acoes' }, [fnBtn('Mudar', function(){ fnAcertoJanela(m, m.cc_pessoa_id); }, 'small'),
        fnBtn('Desligar', function(){ fnApi('/api/financas/movimentos/' + m.id, 'PATCH', { cc_pessoa_id: null }).then(function(){ fnAviso('Desligado' + (m.cc_sw_criado ? ' (e o pagamento saiu do Splitwise).' : '.')); fnMudou(); }, fnErro); }, 'small')])]));
    return;
  }
  var opcao = function(titulo, texto, fn, pri){
    return h('button', { type: 'button', class: 'fn-opcao' + (pri ? ' pri' : ''), onclick: fn }, [h('b', null, titulo), h('small', null, texto)]);
  };
  /* A despesa do Farol a que está ligado já foi dividida no Splitwise:
     mostra-se essa divisão (quem pagou, quanto é de cada um), não as
     opções em branco. */
  if (m.valor < 0 && m.despesa_splitwise) {
    var cx = h('div', { class: 'fn-caixa melhor' }, [h('small', { class: 'fn-muted' }, 'A ler a despesa no Splitwise…')]);
    p.appendChild(cx);
    var outras = h('details', { style: 'margin-top:6px' }, [h('summary', { class: 'fn-muted', style: 'cursor:pointer;font-size:.8125rem' }, 'Tratar de outra forma'),
      h('div', { class: 'fn-opcoes', style: 'margin-top:6px' }, [
        opcao('Despesa partilhada', 'Dividir de outra maneira.', function(){ fnPartilhaJanela([m]); }),
        opcao('Paguei por um amigo', 'É tudo de outra pessoa.', function(){ fnAmigoJanela(m); }),
        opcao('Empréstimo', 'Alguém pagou por ti e estás a devolver.', function(){ fnAcertoJanela(m); })])]);
    p.appendChild(outras);
    apiGestao('/api/financas/splitwise/despesas/' + m.despesa_splitwise).then(function(r){
      var d = r.despesa;
      clear(cx);
      var eu = d.pessoas.filter(function(x){ return x.eu; })[0] || { deve: 0, pagou: 0 };
      var bate = Math.abs(d.total + m.valor) < 0.006;
      cx.appendChild(h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, 'Dividida no Splitwise'), h('span', { class: 'fn-pill tr' }, d.grupo_nome)]));
      cx.appendChild(h('small', { class: 'fn-muted' }, '«' + d.descricao + '» · ' + fnData(d.data) + ' · total ' + fnEur(d.total) + (d.apagada ? ' · APAGADA no Splitwise' : '') + (bate ? '' : ' · o movimento é de ' + fnEur(-m.valor))));
      d.pessoas.slice().sort(function(a, b){ return (b.eu ? 1 : 0) - (a.eu ? 1 : 0); }).forEach(function(x){
        cx.appendChild(h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [x.nome, h('small', null, (x.pagou > 0.005 ? 'pagou ' + fnEur(x.pagou) + ' · ' : '') + 'a parte é ' + fnEur(x.deve))]),
          h('span', { class: 'fn-n' + (!x.eu && x.deve > 0.005 ? ' fn-good' : '') }, x.eu ? fnEur(x.deve) : (x.deve > 0.005 ? 'deve-te ' + fnEur(x.deve) : '—'))]));
      });
      cx.appendChild(h('small', { class: 'fn-muted' }, 'Por agora conta como despesa tua o movimento inteiro (' + fnEur(-m.valor) + '). Com o botão, conta só a tua parte (' + fnEur(eu.deve) + ') e a dos outros fica nas contas correntes do Splitwise; no Splitwise não se cria nada de novo.'));
      if (!d.apagada && bate) cx.appendChild(h('div', { class: 'fn-acoes' }, [fnBtn('Contar só a minha parte', function(){
        fnApi('/api/financas/movimentos/' + m.id + '/partilha-splitwise', 'POST', { expense_id: Number(m.despesa_splitwise), categoria_id: m.categoria_id || null })
          .then(function(x){ fnAviso('Feito: eu pago ' + fnEur(x.minha) + ', os outros ' + fnEur(x.outros) + ' (ligado à despesa do Splitwise).'); fnMudou(); }, fnErro);
      }, 'primary small')]));
    }, function(e){ clear(cx); cx.appendChild(h('small', { class: 'fn-muted' }, 'Ligada a uma despesa do Splitwise, mas não foi possível lê-la: ' + e.message)); });
    return;
  }
  if (m.valor < 0) {
    p.appendChild(h('div', { class: 'fn-opcoes' }, [
      opcao('Despesa partilhada', 'Pagaste e divides: tudo teu, 50/50, partes, percentagens… (conta corrente aqui ou no Splitwise).', function(){ fnPartilhaJanela([m]); }),
      opcao('Paguei por um amigo', 'É tudo dele: fica a dever-to e entra nas contas partilhadas.', function(){ fnAmigoJanela(m); }),
      opcao('Empréstimo', 'Alguém pagou por ti e estás a devolver.', function(){ fnAcertoJanela(m); })]));
    return;
  }
  p.appendChild(h('div', { class: 'fn-opcoes' }, [
    opcao('Acerto de contas', 'Alguém a pagar-te o que devia: diz quem é e em que conta corrente (aqui ou no Splitwise).', function(){ fnAcertoJanela(m); })]));
  fnPainelReembolso(p, m);
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

/* Uma entrada pode ser alguém a devolver a parte de uma conta dividida. */
function fnPainelReembolso(p, m){
  if (m.cc_pessoa_id) {
    p.appendChild(h('div', { class: 'fn-caixa melhor', style: 'margin-top:6px' }, [h('b', null, (m.cc_origem === 'reembolso' ? 'Reembolso de ' : 'Acerto com ') + m.cc_pessoa),
      h('small', { class: 'fn-muted' }, 'Abate no que a pessoa te devia. Não conta como receita.'),
      h('div', { class: 'fn-acoes' }, [fnBtn('Desligar', function(){ fnApi('/api/financas/movimentos/' + m.id, 'PATCH', { cc_pessoa_id: null }).then(function(){ fnMudou(); }, fnErro); }, 'small')])]));
    return;
  }
  var lbl = h('div', { class: 'mono', style: 'margin-top:6px' }, 'Sugestões: quem pode ser');
  p.appendChild(lbl);
  var cx = h('div', { class: 'fn-lista' }, [h('p', { class: 'fn-nota' }, 'A procurar…')]);
  p.appendChild(cx);
  apiGestao('/api/financas/movimentos/' + m.id + '/candidatos').then(function(r){
    clear(cx);
    if (r.empresa) { if (lbl.parentNode) lbl.parentNode.removeChild(lbl); if (cx.parentNode) cx.parentNode.removeChild(cx); return; }
    /* Escolhida a pessoa, falta a conta corrente (aqui ou no Splitwise). */
    var ligar = function(pid){ fnAcertoJanela(m, pid); };
    /* O que a IA acha, quando acha alguma coisa. */
    if (r.divisao) {
      cx.appendChild(h('div', { class: 'fn-caixa melhor', style: 'margin-bottom:6px' }, [
        h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, 'Parte de «' + r.divisao.descricao + '»'), h('span', { class: 'fn-pill ai' }, '✦ ' + Math.round(r.divisao.confianca * 100) + '%')]),
        h('small', { class: 'fn-muted' }, fnTextoDivisao(r.divisao)),
        h('div', { class: 'fn-acoes' }, [fnBtn('Dividir e ligar', function(){ fnAceitarDivisao(m.id, r.divisao); }, 'primary small')])]));
    }
    (r.pessoas || []).slice(0, 1).forEach(function(x){
      cx.appendChild(h('div', { class: 'fn-caixa melhor', style: 'margin-bottom:6px' }, [
        h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, x.nome), h('span', { class: 'fn-pill ai' }, '✦ ' + Math.round(x.confianca * 100) + '%')]),
        h('small', { class: 'fn-muted' }, 'Deve ' + fnEur(x.aberto) + ' · ' + x.motivo + '.'),
        h('div', { class: 'fn-acoes' }, [fnBtn('É reembolso de ' + x.nome.split(' ')[0], function(){ ligar(x.pessoa_id, x.nome); }, 'primary small')])]));
    });
    /* Três maneiras: uma conta corrente que já existe, uma nova a partir
       desta entrada, ou os pagamentos que fizeste e de que é a parte. */
    var abas = [['existe', 'Conta que já existe'], ['nova', 'Conta nova'], ['pagamentos', 'Pagamentos que fiz']];
    var aba = FN.reembAba || ((r.contas && r.contas.length) || (r.devedores && r.devedores.length) ? 'existe' : 'pagamentos');
    var seg = h('div', { class: 'fn-seg', role: 'group', 'aria-label': 'Como ligar', style: 'margin:4px 0 6px' });
    var zona = h('div');
    var mostrar = function(){
      clear(seg); clear(zona);
      abas.forEach(function(o){ seg.appendChild(h('button', { type: 'button', class: aba === o[0] ? 'on' : '', onclick: function(){ aba = o[0]; FN.reembAba = aba; mostrar(); } }, o[1])); });
      if (aba === 'existe') fnReembExiste(zona, m, r, ligar);
      else if (aba === 'nova') fnReembNova(zona, m, r);
      else fnReembPagamentos(zona, m, r);
    };
    cx.appendChild(seg); cx.appendChild(zona);
    mostrar();
  }, function(e){ clear(cx); cx.appendChild(h('p', { class: 'fn-nota' }, e.message)); });
}
/* 1. Ligar a uma conta corrente que já existe: as contas divididas com alguém
   por pagar (com a parte de cada um) e as pessoas que te devem. */
function fnReembExiste(z, m, r, ligar){
  /* Primeiro as contas em que a parte de alguém é igual a esta entrada,
     depois as mais perto da data dela. */
  var perto = function(c){ return Math.abs(new Date(c.data) - new Date(m.data)); };
  var bate = function(c){ return c.pessoas.some(function(x){ return x.deve > 0.005 && Math.abs(x.valor - m.valor) < 0.006; }) ? 1 : 0; };
  var contas = (r.contas || []).slice().sort(function(a, b){ return bate(b) - bate(a) || perto(a) - perto(b); });
  var nasContas = {};
  if (contas.length) z.appendChild(h('small', { class: 'fn-muted', style: 'display:block;margin-bottom:4px' }, 'Contas divididas por pagar. Carrega na pessoa que te mandou este dinheiro.'));
  contas.forEach(function(c){
    var linhas = c.pessoas.map(function(x){
      nasContas[x.pessoa_id] = true;
      var bate = Math.abs(x.valor - m.valor) < 0.006;
      return h('div', { class: 'fn-acoes', style: 'justify-content:space-between;gap:6px;padding:2px 0' }, [
        h('span', { style: 'flex:1;min-width:0' }, [x.nome, h('small', { class: 'fn-muted', style: 'display:block' }, 'parte ' + fnEur(x.valor) + (x.deve > 0.005 ? ' · deve ' + fnEur(x.deve) : ' · já pagou'))]),
        x.deve > 0.005 ? fnBtn(bate ? 'É esta pessoa ✓' : 'É esta pessoa', function(){ ligar(x.pessoa_id, x.nome); }, bate ? 'primary small' : 'small') : null]);
    });
    z.appendChild(h('div', { class: 'fn-caixa', style: 'margin-bottom:6px' }, [
      h('b', null, c.descricao), h('small', { class: 'fn-muted', style: 'display:block' }, fnData(c.data) + ' · total ' + fnEur(c.total))].concat(linhas)));
  });
  var outros = (r.devedores || []).filter(function(x){ return !nasContas[x.pessoa_id]; });
  if (outros.length) {
    z.appendChild(h('small', { class: 'fn-muted', style: 'display:block;margin:6px 0 4px' }, 'Outras contas correntes em aberto'));
    outros.forEach(function(x){
      z.appendChild(h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [x.nome, h('small', null, (x.tipo === 'splitwise' ? 'Splitwise' : 'no Farol') + ' · deve ' + fnEur(x.saldo))]),
        fnBtn('Ligar', function(){ ligar(x.pessoa_id, x.nome); }, 'small')]));
    });
  }
  if (!contas.length && !outros.length) z.appendChild(h('p', { class: 'fn-nota' }, 'Não há contas correntes em aberto.'));
  /* Qualquer outra pessoa, mesmo com a conta saldada. */
  var sel = h('select', { class: 'fn-sel' }, [h('option', { value: '' }, '— outra pessoa —')].concat((r.todas || []).map(function(x){
    return h('option', { value: x.pessoa_id }, x.nome + (Math.abs(x.saldo) >= 0.01 ? ' (' + fnEur(x.saldo, true) + ')' : ' (saldada)'));
  })));
  z.appendChild(h('div', { class: 'fn-acoes', style: 'margin-top:6px' }, [sel, fnBtn('Ligar', function(){
    if (!sel.value) return fnAviso('Escolhe a pessoa.');
    ligar(Number(sel.value), sel.options[sel.selectedIndex].text.replace(/ \(.*\)$/, ''));
  }, 'small')]));
}
/* 2. Uma conta corrente nova a partir desta entrada. */
function fnReembNova(z, m, r){
  var nm = h('input', { class: 'fn-in', value: r.pagador || '', placeholder: 'Quem mandou' });
  var ds = h('input', { class: 'fn-in', placeholder: 'De quê (opcional): jantar, bilhetes…' });
  var t1 = h('input', { type: 'radio', name: 'fn-nova-tipo-' + m.id, checked: true });
  var t2 = h('input', { type: 'radio', name: 'fn-nova-tipo-' + m.id });
  z.appendChild(h('div', { class: 'fn-caixa' }, [
    h('small', { class: 'fn-muted' }, 'Abre uma conta corrente para esta pessoa a partir desta entrada. Se o pagamento está no Farol, usa antes «Pagamentos que fiz».'),
    fnCampo('Nome', nm),
    h('label', { class: 'fn-check', style: 'align-items:flex-start' }, [t1, h('span', null, ['É a parte dela numa conta que paguei fora do Farol', h('small', { class: 'fn-muted', style: 'display:block' }, 'Em dinheiro ou noutra conta: fica registado e acertado.')])]),
    h('label', { class: 'fn-check', style: 'align-items:flex-start' }, [t2, h('span', null, ['Adiantou-me ou emprestou-me', h('small', { class: 'fn-muted', style: 'display:block' }, 'Fico eu a dever ' + fnEur(m.valor) + '.')])]),
    ds,
    h('div', { class: 'fn-acoes' }, [fnBtn('Criar e ligar', function(){
      if (!nm.value.trim()) return fnAviso('Falta o nome.');
      fnApi('/api/financas/movimentos/' + m.id + '/nova-cc', 'POST', { nome: nm.value.trim(), tipo: t2.checked ? 'adiantou' : 'parte', descricao: ds.value.trim() })
        .then(function(x){ fnAviso('Conta corrente de ' + x.nome + (x.tipo === 'adiantou' ? ': ficas a dever ' + fnEur(m.valor) + '.' : ': registado e acertado.')); FN.cache = {}; fnMudou(); }, fnErro);
    }, 'primary small')])]));
}
/* 3. Os pagamentos de que esta entrada é a parte: procura por texto e por
   período; primeiro os que dão conta certa (o total é 2, 3, 4… vezes esta
   entrada), depois os mais perto da data. */
function fnReembPagamentos(z, m, r){
  var q = h('input', { class: 'fn-in', type: 'search', placeholder: 'Procurar: uber, restaurante…', style: 'flex:1 1 140px' });
  var per = h('select', { class: 'fn-sel' }, [[15, '15 dias'], [45, '45 dias'], [90, '3 meses'], [180, '6 meses'], [365, '1 ano']].map(function(o){ return h('option', { value: o[0] }, o[1]); }));
  per.value = '45';
  var certos = h('input', { type: 'checkbox' });
  var esc = {}, vistos = {};
  var tot = h('small', { class: 'fn-muted' }, 'Nenhum pagamento escolhido.');
  var contar = function(){
    var ids = Object.keys(esc).filter(function(k){ return esc[k]; });
    var soma = ids.reduce(function(s, k){ return s - vistos[k].valor; }, 0);
    tot.textContent = !ids.length ? 'Nenhum pagamento escolhido.' : ids.length + (ids.length === 1 ? ' pagamento' : ' pagamentos') + ' · ' + fnEur(soma) + ' · esta entrada: ' + fnEur(m.valor) + (m.valor > soma + 0.005 ? ' (é mais do que os pagamentos)' : '');
  };
  var ld = h('div', { class: 'fn-lista', style: 'max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:2px 6px' });
  var info = h('small', { class: 'fn-muted', style: 'display:block' });
  var tmr = null;
  var ler = function(){
    clear(ld); ld.appendChild(h('p', { class: 'fn-nota' }, 'A procurar…'));
    var url = '/api/financas/movimentos/' + m.id + '/pagamentos?dias=' + per.value + (q.value.trim() ? '&q=' + encodeURIComponent(q.value.trim()) : '') + (certos.checked ? '&so=certos' : '');
    apiGestao(url).then(function(x){
      clear(ld);
      info.textContent = 'Das contas pessoais, de ' + per.options[per.selectedIndex].text + ' antes a 10 dias depois (o cartão lança mais tarde). Primeiro os que dão conta certa com ' + fnEur(m.valor) + '.';
      if (!x.pagamentos.length) { ld.appendChild(h('p', { class: 'fn-nota' }, 'Nenhum pagamento' + (q.value.trim() ? ' com «' + q.value.trim() + '»' : '') + ' neste período.')); return; }
      x.pagamentos.forEach(function(d){
        vistos[d.id] = d;
        ld.appendChild(h('label', { class: 'fn-check', style: 'padding:4px 0;align-items:flex-start;border-bottom:1px solid var(--line)' }, [
          h('input', { type: 'checkbox', checked: !!esc[d.id], onchange: function(e){ esc[d.id] = e.target.checked; contar(); } }),
          h('span', { style: 'flex:1;min-width:0' }, [h('span', { style: 'display:flex;gap:6px;justify-content:space-between' }, [h('span', { style: 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, d.descricao), h('b', { class: 'fn-n', style: 'font-weight:500' }, fnEur(d.valor))]),
            h('small', { class: 'fn-muted', style: 'display:block' }, [fnData(d.data), d.conta, d.categoria].filter(Boolean).join(' · ')),
            d.vezes ? h('span', { class: 'fn-pill good', style: 'margin:2px 4px 0 0' }, d.vezes + ' × ' + fnEur(m.valor)) : null,
            d.dividido ? h('span', { class: 'fn-pill', style: 'margin-top:2px' }, 'já dividido') : null])]));
      });
      if (x.total > x.pagamentos.length) ld.appendChild(h('p', { class: 'fn-nota' }, 'Mostram-se ' + x.pagamentos.length + ' de ' + x.total + '. Procura por texto para afinar.'));
    }, function(e){ clear(ld); ld.appendChild(h('p', { class: 'fn-nota' }, e.message)); });
  };
  q.addEventListener('input', function(){ clearTimeout(tmr); tmr = setTimeout(ler, 300); });
  per.addEventListener('change', ler);
  certos.addEventListener('change', ler);
  var nm = h('input', { class: 'fn-in', value: r.pagador || '', placeholder: 'Quem mandou' });
  z.appendChild(h('div', { class: 'fn-caixa' }, [
    h('small', { class: 'fn-muted' }, 'Escolhe um ou mais pagamentos: ficam divididos e esta entrada liga-se como reembolso.'),
    h('div', { class: 'fn-acoes', style: 'flex-wrap:wrap;gap:6px' }, [q, per]),
    h('label', { class: 'fn-check' }, [certos, 'Só os que dão conta certa']),
    info, ld, tot, nm,
    h('div', { class: 'fn-acoes' }, [fnBtn('Dividir e ligar', function(){
      var ids = Object.keys(esc).filter(function(k){ return esc[k]; }).map(Number);
      if (!ids.length) return fnAviso('Escolhe um ou mais pagamentos.');
      if (!nm.value.trim()) return fnAviso('Falta quem mandou.');
      fnApi('/api/financas/movimentos/' + m.id + '/devolucao', 'POST', { debito_ids: ids, creditos: [{ id: m.id, nome: nm.value.trim() }] })
        .then(function(x){ fnAviso('Dividido em ' + x.pagamentos + (x.pagamentos === 1 ? ' pagamento' : ' pagamentos') + ': a tua parte ' + fnEur(x.minha) + '.'); FN.cache = {}; fnMudou(); }, fnErro);
    }, 'primary small')])]));
  ler();
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
