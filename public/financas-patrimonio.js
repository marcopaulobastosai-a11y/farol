'use strict';
/* Farol — Património, Contas correntes e Categorias & IA.
 * As peças comuns estão no financas.js. */

/* ======================= PATRIMÓNIO ======================= */
var FN_COMP = [['liquidez','Liquidez','var(--fn-in)'],['investimentos','Investimentos & poupança','var(--fn-c3)'],['bens','Bens','var(--fn-out)'],['a_receber','A receber','var(--fn-c4)']];

function fnBarraPatrimonio(corpo, extra){
  var seg = h('div', { class: 'fn-seg', role: 'group', 'aria-label': 'Âmbito' }, [[false,'Pessoal'],[true,'Com as empresas']].map(function(o){
    return h('button', { type: 'button', class: FN.empresas === o[0] ? 'on' : '', onclick: function(){ FN.empresas = o[0]; FN.cache = {}; fnRender('patrimonio'); } }, o[1]);
  }));
  corpo.appendChild(h('div', { class: 'fn-barra' }, [seg, h('span', { class: 'fn-esp' })].concat(extra || [])));
}

function fn_patrimonio_visao(corpo){
  fnBarraPatrimonio(corpo, [fnBtn('+ Bem ou dívida', function(){ fnBemJanela(); }), fnBtn('+ Conta', function(){ fnContaJanela(); }, 'primary')]);
  fnCarregar(corpo, fnLer('pat|' + FN.empresas, '/api/financas/patrimonio?empresas=' + (FN.empresas ? 1 : 0)), function(d){
    if (!d.contas.length && !d.bens.length && !d.cc.pessoas.length){
      corpo.appendChild(fnCard('Começar', null, [fnVazio('Ainda não há contas nem bens.', 'Cria as contas (com o saldo de hoje, ou importando o extrato), os bens (casa, carro) e as dívidas (créditos). O património líquido calcula-se a partir daí.',
        [fnBtn('+ Conta', function(){ fnContaJanela(); }, 'primary'), fnBtn('+ Bem ou dívida', function(){ fnBemJanela(); })])]));
      return;
    }
    var l1 = h('div', { class: 'fn-linha' });
    var rot = d.serie.map(function(s){ return fnMesCurto(s.mes) + (s.mes.slice(5) === '01' ? ' ' + s.mes.slice(2, 4) : ''); });
    var pontos = d.serie.map(function(s){ return s.valor; });
    var series = [{ pontos: pontos, cor: 'var(--accent)', area: true, ponto: true }];
    if (d.projecao){
      d.projecao.forEach(function(p){ rot.push(fnMesCurto(p.mes)); });
      series[0].pontos = pontos.concat(d.projecao.map(function(){ return null; }));
      series.push({ pontos: pontos.map(function(v, i){ return i === pontos.length - 1 ? v : null; }).concat(d.projecao.map(function(p){ return p.valor; })), cor: 'var(--accent)', tracejado: true });
    }
    l1.appendChild(h('div', { class: 'card largo' }, [
      h('div', { class: 'fn-barra', style: 'align-items:flex-end' }, [h('div', null, [h('div', { class: 'mono' }, 'Património líquido'), h('div', { class: 'fn-big' }, fnEur(d.liquido)),
        h('div', { class: 'fn-muted', style: 'font-size:.8125rem' }, [d.var_mes == null ? '' : h('span', { class: d.var_mes >= 0 ? 'fn-good' : 'fn-bad' }, fnEur(d.var_mes, true) + ' este mês'),
          d.var_12m_pct == null ? '' : ' · ' + (d.var_12m_pct > 0 ? '+' : '') + fnPct(d.var_12m_pct) + ' em 12 meses'])])]),
      fnGrafLinhas(series, rot, 'Evolução do património líquido'),
      h('p', { class: 'fn-nota' }, d.projecao ? 'A tracejado: a projeção ao ritmo dos últimos 12 meses. A evolução vem dos extratos e dos saldos escritos; uma conta sem histórico pesa só a partir do primeiro saldo.' : 'A evolução vem dos extratos e dos saldos escritos.')
    ]));
    var tAtivo = d.ativo || 1;
    var comp = h('div', { class: 'fn-comp', role: 'img', 'aria-label': 'Composição do ativo' }, FN_COMP.map(function(c){ return h('i', { style: 'width:' + Math.max(0, d.composicao[c[0]] / tAtivo * 100) + '%;background:' + c[2] }); }));
    var lc = h('div', { class: 'fn-lista' });
    FN_COMP.forEach(function(c){ lc.appendChild(h('div', { class: 'fn-li' }, [h('span', { class: 'g' }, [h('i', { style: 'display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:8px;background:' + c[2] }), c[1]]), h('span', { class: 'fn-n' }, fnEur(d.composicao[c[0]]))])); });
    lc.appendChild(h('div', { class: 'fn-li' }, [h('b', { class: 'g' }, 'Ativo'), h('b', { class: 'fn-n' }, fnEur(d.ativo))]));
    [['cartoes','Cartões'],['dividas','Dívidas'],['a_pagar','Devo a outros']].forEach(function(p){ if (d.passivos[p[0]]) lc.appendChild(h('div', { class: 'fn-li' }, [h('span', { class: 'g' }, p[1]), h('span', { class: 'fn-n fn-bad' }, fnEur(d.passivos[p[0]]))])); });
    lc.appendChild(h('div', { class: 'fn-li' }, [h('b', { class: 'g' }, 'Passivo'), h('b', { class: 'fn-n fn-bad' }, fnEur(d.passivo))]));
    l1.appendChild(fnCard('Composição', null, [comp, lc]));
    corpo.appendChild(l1);

    var l2 = h('div', { class: 'fn-linha' });
    l2.appendChild(fnCard('Contas', h('button', { type: 'button', class: 'btn small', onclick: function(){ FN.aba.patrimonio = 'contas'; fnRender('patrimonio'); } }, 'Gerir'), [fnTabelaContas(d.contas, false)], 'largo'));
    var dir = h('div', { style: 'flex:1 1 340px;display:flex;flex-direction:column;gap:14px;min-width:0' });
    var lr = h('div', { class: 'fn-lista' });
    var comSaldo = d.cc.pessoas.filter(function(p){ return p.ativo && Math.abs(p.saldo) >= 0.01; }).sort(function(a, b){ return b.saldo - a.saldo; });
    if (!comSaldo.length) lr.appendChild(h('p', { class: 'fn-nota' }, 'Ninguém te deve nada, nem tu a ninguém.'));
    comSaldo.forEach(function(p){ lr.appendChild(h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [p.nome, h('small', null, p.splitwise_id ? 'Splitwise' : 'à mão')]), h('span', { class: 'fn-n ' + (p.saldo > 0 ? 'fn-good' : 'fn-bad') }, fnEur(p.saldo, true))])); });
    dir.appendChild(fnCard('A receber e a pagar', h('button', { type: 'button', class: 'btn small', onclick: function(){ FN.aba.financas = 'cc'; fnGuardar(); show('financas'); } }, 'Contas correntes'), [lr]));
    var lb = h('div', { class: 'fn-lista' });
    if (!d.bens.length) lb.appendChild(h('p', { class: 'fn-nota' }, 'Sem bens nem dívidas registados.'));
    d.bens.forEach(function(b){ lb.appendChild(fnLinhaBem(b)); });
    dir.appendChild(fnCard('Bens & dívidas', h('button', { type: 'button', class: 'btn small', onclick: function(){ fnBemJanela(); } }, '+ Bem'), [lb]));
    l2.appendChild(dir);
    corpo.appendChild(l2);
  });
}

function fnTabelaContas(contas, gerir){
  var grupos = {};
  contas.forEach(function(c){ (grupos[c.tipo] = grupos[c.tipo] || []).push(c); });
  var tb = h('tbody');
  FN_TIPOS.forEach(function(t){
    var cs = grupos[t[0]]; if (!cs) return;
    var soma = cs.filter(function(c){ return c.ativo; }).reduce(function(s, c){ return s + c.saldo; }, 0);
    tb.appendChild(h('tr', { class: 'grp' }, [h('td', { colspan: gerir ? 4 : 3 }, t[1] + (t[0] === 'empresa' ? ' · fora do pessoal' : '')), h('td', { class: 'r' + (soma < 0 ? ' fn-bad' : '') }, fnEur(soma)), h('td'), gerir ? h('td') : null]));
    cs.forEach(function(c){
      tb.appendChild(h('tr', { style: c.ativo ? '' : 'opacity:.55' }, [
        h('td', null, [h('b', { style: 'font-weight:500' }, c.nome), h('small', { style: 'display:block' }, [c.instituicao, c.pessoal ? null : 'empresa', c.ativo ? null : 'desativada'].filter(Boolean).join(' · '))]),
        h('td', null, [h('span', { class: 'fn-pill' }, c.fonte)]),
        h('td', { style: 'font-size:.75rem' }, c.atualizado ? fnData(c.atualizado) : '—'),
        gerir ? h('td', { style: 'font-size:.75rem' }, fnCtxNome(c.context_id) || '—') : null,
        h('td', { class: 'r' + (c.saldo < 0 ? ' fn-bad' : '') }, fnEur(c.saldo)),
        h('td', { class: 'r ' + (c.var30 > 0 ? 'fn-good' : '') }, c.var30 ? fnEur(c.var30, true) : '—'),
        gerir ? h('td', null, [h('div', { class: 'fn-acoes' }, [
          fnBtn('Importar', function(){ fnImportar(c.id); }, 'small'),
          fnBtn('Saldo', function(){ fnSaldoJanela(c); }, 'small'),
          fnBtn('Editar', function(){ fnContaJanela(c); }, 'small')])]) : null
      ]));
    });
  });
  return h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab', style: 'min-width:' + (gerir ? 820 : 520) + 'px' }, [h('thead', null, [h('tr', null, [h('th', null, 'Conta'), h('th', null, 'Fonte'), h('th', null, 'Até'),
    gerir ? h('th', null, 'Área') : null, h('th', { class: 'r' }, 'Saldo'), h('th', { class: 'r' }, '30 dias'), gerir ? h('th') : null])]), tb])]);
}

function fn_patrimonio_contas(corpo){
  fnBarraPatrimonio(corpo, [fnBtn('Importar extrato', function(){ fnImportar(); }), fnBtn('+ Conta', function(){ fnContaJanela(); }, 'primary')]);
  var cs = FN.base.contas.filter(function(c){ return FN.empresas || c.pessoal; });
  if (!cs.length) { corpo.appendChild(fnSemContas()); return; }
  corpo.appendChild(fnCard('Contas', String(cs.length), [fnTabelaContas(cs, true),
    h('p', { class: 'fn-nota' }, 'O saldo de uma conta com extrato vem do próprio extrato (quando traz a coluna do saldo) ou do último saldo escrito, mais os movimentos que vieram depois. Contas sem extrato — PPR, ações, dinheiro — atualizam-se com «Saldo».')]));
}

function fn_patrimonio_bens(corpo){
  fnBarraPatrimonio(corpo, [fnBtn('+ Bem ou dívida', function(){ fnBemJanela(); }, 'primary')]);
  fnCarregar(corpo, fnLer('pat|' + FN.empresas, '/api/financas/patrimonio?empresas=' + (FN.empresas ? 1 : 0)), function(d){
    var at = d.bens.filter(function(b){ return b.lado !== 'passivo'; }), ps = d.bens.filter(function(b){ return b.lado === 'passivo'; });
    var l = h('div', { class: 'fn-linha' });
    var la = h('div', { class: 'fn-lista' }); at.forEach(function(b){ la.appendChild(fnLinhaBem(b, true)); });
    if (!at.length) la.appendChild(fnVazio('Sem bens.', 'Casa, carro, terreno — com o valor que achas que valem hoje.'));
    var lp = h('div', { class: 'fn-lista' }); ps.forEach(function(b){ lp.appendChild(fnLinhaBem(b, true)); });
    if (!ps.length) lp.appendChild(fnVazio('Sem dívidas.', 'Créditos à habitação, automóvel, pessoais — com o que falta pagar e a prestação.'));
    l.appendChild(fnCard('Bens', fnEur(at.reduce(function(s, b){ return s + (b.valor || 0); }, 0)), [la]));
    l.appendChild(fnCard('Dívidas', fnEur(-ps.reduce(function(s, b){ return s + Math.abs(b.valor || 0); }, 0)), [lp]));
    corpo.appendChild(l);
  });
}
function fnLinhaBem(b, editar){
  var sub = [b.classe, b.prestacao ? fnEur(b.prestacao) + '/mês' : null, b.termina ? 'acaba ' + fnData(b.termina) : null, b.valor_em ? 'valor de ' + fnData(b.valor_em) : null].filter(Boolean).join(' · ');
  return h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [b.nome, h('small', null, sub)]),
    h('span', { class: 'fn-n ' + (b.lado === 'passivo' ? 'fn-bad' : '') }, b.valor == null ? 'sem valor' : fnEur(b.lado === 'passivo' ? -Math.abs(b.valor) : b.valor)),
    editar !== false ? fnBtn('Editar', function(){ fnBemJanela(b); }, 'small') : null]);
}

function fnContaJanela(c){
  var nome = h('input', { class: 'fn-in', value: c ? c.nome : '', placeholder: 'ex.: CA · Marco' });
  var tipo = h('select', { class: 'fn-sel' }, FN_TIPOS.map(function(t){ return h('option', { value: t[0] }, t[1]); }));
  if (c) tipo.value = c.tipo;
  var inst = h('input', { class: 'fn-in', value: c ? (c.instituicao || '') : '', placeholder: 'Banco' });
  var area = fnSelAreas(c ? c.context_id : '');
  var pes = h('input', { type: 'checkbox', checked: c ? c.pessoal : true });
  var ativo = h('input', { type: 'checkbox', checked: c ? c.ativo : true });
  var saldo = h('input', { class: 'fn-in', inputmode: 'decimal', placeholder: 'opcional' });
  var em = h('input', { class: 'fn-in', type: 'date', value: fnHoje() });
  tipo.addEventListener('change', function(){ if (tipo.value === 'empresa') pes.checked = false; });
  var bts = [{ txt: c ? 'Guardar' : 'Criar', pri: true, fn: function(){
    if (!nome.value.trim()) { fnAviso('Falta o nome.'); return false; }
    var corpo = { nome: nome.value.trim(), tipo: tipo.value, instituicao: inst.value, context_id: area.value ? Number(area.value) : null, pessoal: pes.checked };
    if (c) corpo.ativo = ativo.checked;
    var p = c ? fnApi('/api/financas/contas/' + c.id, 'PATCH', corpo).then(function(){ return c.id; }) : fnApi('/api/financas/contas', 'POST', corpo).then(function(r){ return r.id; });
    return p.then(function(id){
      if (saldo.value.trim()) return fnApi('/api/financas/contas/' + id + '/saldo', 'POST', { saldo: saldo.value, em: em.value });
    }).then(function(){ fnMudou(); }, fnErro);
  } }];
  if (c) bts.push({ txt: 'Apagar', fn: function(){
    var n = c.movimentos;
    fnJanela('Apagar a conta ' + c.nome + '?', [h('p', null, n ? 'Tem ' + n + ' movimentos, que se apagam com ela. Para a guardar sem a usar, desativa-a.' : 'Não tem movimentos.')],
      [{ txt: 'Apagar', pri: true, fn: function(){ return fnApi('/api/financas/contas/' + c.id + '?apagar_movimentos=1', 'DELETE').then(function(){ fnMudou(); }, fnErro); } }]);
  } });
  fnJanela(c ? 'Conta · ' + c.nome : 'Nova conta', [
    h('div', { class: 'fn-campos' }, [fnCampo('Nome', nome), fnCampo('Tipo', tipo)]),
    h('div', { class: 'fn-campos' }, [fnCampo('Instituição', inst), fnCampo('Área', area)]),
    h('label', { class: 'fn-check' }, [pes, 'Conta pessoal (as das empresas ficam fora do património pessoal)']),
    c ? h('label', { class: 'fn-check' }, [ativo, 'Ativa']) : null,
    h('div', { class: 'fn-campos' }, [fnCampo(c ? 'Novo saldo (opcional)' : 'Saldo (opcional)', saldo), fnCampo('Em', em)]),
    h('p', { class: 'fn-nota' }, 'Se o extrato trouxer a coluna do saldo, não é preciso escrevê-lo.')
  ], bts);
}
function fnSaldoJanela(c){
  var s = h('input', { class: 'fn-in', inputmode: 'decimal', placeholder: '0,00' });
  var em = h('input', { class: 'fn-in', type: 'date', value: fnHoje() });
  fnJanela('Saldo · ' + c.nome, [h('p', { class: 'fn-nota' }, 'Hoje está em ' + fnEur(c.saldo) + '. Escreve o saldo que vês no banco ou na plataforma, e a data.'),
    h('div', { class: 'fn-campos' }, [fnCampo('Saldo', s), fnCampo('Em', em)])],
  [{ txt: 'Guardar', pri: true, fn: function(){
    if (!s.value.trim()) { fnAviso('Falta o saldo.'); return false; }
    return fnApi('/api/financas/contas/' + c.id + '/saldo', 'POST', { saldo: s.value, em: em.value }).then(function(){ fnMudou(); }, fnErro);
  } }]);
}
function fnBemJanela(b){
  var nome = h('input', { class: 'fn-in', value: b ? b.nome : '' });
  var lado = h('select', { class: 'fn-sel' }, [h('option', { value: 'ativo' }, 'Bem (ativo)'), h('option', { value: 'passivo' }, 'Dívida (passivo)')]);
  if (b) lado.value = b.lado;
  var classe = h('select', { class: 'fn-sel' }, [['imovel','Imóvel'],['viatura','Viatura'],['credito','Crédito'],['outro','Outro']].map(function(x){ return h('option', { value: x[0] }, x[1]); }));
  if (b) classe.value = b.classe;
  var valor = h('input', { class: 'fn-in', inputmode: 'decimal', value: b && b.valor != null ? String(Math.abs(b.valor)).replace('.', ',') : '' });
  var em = h('input', { class: 'fn-in', type: 'date', value: b && b.valor_em ? b.valor_em : fnHoje() });
  var prest = h('input', { class: 'fn-in', inputmode: 'decimal', value: b && b.prestacao ? String(b.prestacao).replace('.', ',') : '' });
  var termina = h('input', { class: 'fn-in', type: 'date', value: b && b.termina ? b.termina : '' });
  var pes = h('input', { type: 'checkbox', checked: b ? b.pessoal : true });
  var nota = h('input', { class: 'fn-in', value: b ? (b.nota || '') : '' });
  var bts = [{ txt: b ? 'Guardar' : 'Criar', pri: true, fn: function(){
    if (!nome.value.trim()) { fnAviso('Falta o nome.'); return false; }
    var corpo = { nome: nome.value.trim(), lado: lado.value, classe: classe.value, valor: valor.value, valor_em: em.value || null, prestacao: prest.value, termina: termina.value || null, pessoal: pes.checked, nota: nota.value };
    var p = b ? fnApi('/api/financas/bens/' + b.id, 'PATCH', corpo) : fnApi('/api/financas/bens', 'POST', corpo);
    return p.then(function(){ fnMudou(); }, fnErro);
  } }];
  if (b) bts.push({ txt: 'Apagar', fn: function(){ return fnApi('/api/financas/bens/' + b.id, 'DELETE').then(function(){ fnMudou(); }, fnErro); } });
  fnJanela(b ? b.nome : 'Novo bem ou dívida', [h('div', { class: 'fn-campos' }, [fnCampo('Nome', nome), fnCampo('É', lado), fnCampo('Classe', classe)]),
    h('div', { class: 'fn-campos' }, [fnCampo('Valor (ou o que falta pagar)', valor), fnCampo('Valor de', em)]),
    h('div', { class: 'fn-campos' }, [fnCampo('Prestação mensal', prest), fnCampo('Acaba em', termina)]),
    fnCampo('Nota', nota), h('label', { class: 'fn-check' }, [pes, 'Pessoal'])], bts);
}

/* ======================= CONTAS CORRENTES ======================= */
function fn_financas_cc(corpo){
  fnCarregar(corpo, apiGestao('/api/financas/cc'), function(d){
    var ps = d.pessoas.filter(function(p){ return p.ativo; });
    corpo.appendChild(h('div', { class: 'fn-barra' }, [
      h('span', { class: 'fn-nota' }, d.splitwise ? 'Lê o Splitwise sozinho todos os dias às 23:30' + (d.sync_em ? ' · última leitura ' + new Date(d.sync_em).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '') + '.' : 'O Splitwise não está ligado (Administração › Splitwise). As contas correntes funcionam à mão.'),
      h('span', { class: 'fn-esp' }),
      d.splitwise ? fnBtn('Ler o Splitwise agora', function(e){ var b = e && e.target; if (b) b.disabled = true;
        fnApi('/api/financas/cc/sincronizar', 'POST', {}).then(function(r){ fnAviso(r.lidas + ' despesas lidas.'); FN.cache = {}; fnRender('financas'); }, function(x){ if (b) b.disabled = false; fnErro(x); }); }) : null,
      fnBtn('+ Pessoa', function(){ fnPessoaCcJanela(); }, 'primary')]));
    corpo.appendChild(h('div', { class: 'fn-kpis' }, [fnKpi('Devem-me', fnEur(d.a_receber), ps.filter(function(p){ return p.saldo > 0.005; }).length + ' pessoas', 'fn-good'),
      fnKpi('Devo eu', fnEur(d.a_pagar), ps.filter(function(p){ return p.saldo < -0.005; }).length + ' pessoas', d.a_pagar ? 'fn-bad' : ''),
      fnKpi('Líquido', fnEur(d.a_receber + d.a_pagar), 'entra no Património como «a receber»')]));
    var linha = h('div', { class: 'fn-linha', style: 'align-items:flex-start' });
    var tb = h('tbody');
    ps.sort(function(a, b){ return Math.abs(b.saldo) - Math.abs(a.saldo); }).forEach(function(p){
      var grupos = (p.por_grupo || []).map(function(g){ return h('span', { class: 'fn-pill', style: 'margin:1px' }, g.nome + ' ' + fnEur(g.saldo, true)); });
      tb.appendChild(h('tr', { class: 'clic' + (FN.ccAberta === p.id ? ' on' : ''), onclick: function(){ FN.ccAberta = FN.ccAberta === p.id ? null : p.id; fnRender('financas'); } }, [
        h('td', null, [h('b', { style: 'font-weight:500' }, p.nome), h('small', { style: 'display:block' }, p.splitwise_id ? 'Splitwise' + (p.saldo_tu ? ' + à mão' : '') : 'à mão')]),
        h('td', null, grupos.length ? grupos : h('span', { class: 'fn-muted' }, '—')),
        h('td', { style: 'font-size:.75rem' }, p.ultimo ? fnData(p.ultimo) : '—'),
        h('td', { class: 'r ' + (p.saldo > 0.005 ? 'fn-good' : p.saldo < -0.005 ? 'fn-bad' : '') }, Math.abs(p.saldo) < 0.005 ? 'acertado' : fnEur(p.saldo, true)),
        h('td', null, p.diferenca && Math.abs(p.diferenca) >= 0.01 ? h('span', { class: 'fn-pill warn', title: 'O saldo do Splitwise é a referência.' }, 'dif. ' + fnEur(p.diferenca, true)) : null)
      ]));
    });
    var cartao = h('div', { class: 'card largo', style: 'padding:6px 10px' });
    if (!ps.length) cartao.appendChild(fnVazio('Ainda ninguém.', d.splitwise ? 'Carrega em «Ler o Splitwise agora», ou junta uma pessoa à mão.' : 'Junta as pessoas com quem divides dinheiro.'));
    else cartao.appendChild(h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab', style: 'min-width:600px' }, [h('thead', null, [h('tr', null, [h('th', null, 'Pessoa'), h('th', null, 'Por grupo'), h('th', null, 'Último'), h('th', { class: 'r' }, 'Saldo'), h('th')])]), tb])]));
    cartao.appendChild(h('p', { class: 'fn-nota', style: 'padding:8px' }, 'Saldo positivo: a pessoa deve-te. Negativo: deves tu. Nas pessoas do Splitwise o saldo é o do Splitwise, mais o que lançares aqui à mão.'));
    linha.appendChild(cartao);
    var painel = h('div', { class: 'card fn-painel' });
    var ab = ps.filter(function(p){ return p.id === FN.ccAberta; })[0];
    if (ab) fnPainelCc(painel, ab); else painel.appendChild(h('p', { class: 'fn-nota' }, 'Escolhe uma pessoa para ver os movimentos e lançar acertos.'));
    linha.appendChild(painel);
    corpo.appendChild(linha);
    var inativos = d.pessoas.filter(function(p){ return !p.ativo; });
    if (inativos.length) corpo.appendChild(h('p', { class: 'fn-nota' }, 'Escondidas: ' + inativos.map(function(p){ return p.nome; }).join(', ') + '.'));
  });
}
function fnPainelCc(p, pessoa){
  p.appendChild(h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('h3', { style: 'font-size:1.05rem' }, pessoa.nome), h('b', { class: 'fn-n ' + (pessoa.saldo > 0 ? 'fn-good' : pessoa.saldo < 0 ? 'fn-bad' : '') }, fnEur(pessoa.saldo, true))]));
  var dt = h('input', { class: 'fn-in', type: 'date', value: fnHoje() });
  var ds = h('input', { class: 'fn-in', placeholder: 'Descrição' });
  var vl = h('input', { class: 'fn-in', inputmode: 'decimal', placeholder: '0,00' });
  var sen = h('select', { class: 'fn-sel' }, [h('option', { value: '1' }, 'Deve-me'), h('option', { value: '-1' }, 'Devo eu')]);
  p.appendChild(h('div', { class: 'fn-caixa' }, [h('div', { class: 'mono' }, 'Lançar à mão'), h('div', { class: 'fn-campos' }, [fnCampo('Data', dt), fnCampo('Valor', vl), fnCampo('', sen)]), ds,
    h('div', { class: 'fn-acoes' }, [fnBtn('Lançar', function(){
      var v = Number(String(vl.value).replace(/\s/g, '').replace(',', '.'));
      if (!v) return fnAviso('Falta o valor.');
      fnApi('/api/financas/cc/' + pessoa.id + '/mov', 'POST', { data: dt.value, descricao: ds.value || 'Acerto', valor: Math.abs(v) * Number(sen.value) }).then(function(){ FN.cache = {}; fnRender('financas'); }, fnErro);
    }, 'primary small'), fnBtn('Acertar tudo', function(){
      if (Math.abs(pessoa.saldo) < 0.01) return fnAviso('Já está acertado.');
      fnJanela('Acertar com ' + pessoa.nome + '?', [h('p', null, 'Lança ' + fnEur(-pessoa.saldo, true) + ' e o saldo fica a zero.' + (pessoa.splitwise_id ? ' Se o acerto foi feito no Splitwise, não é preciso: aparece sozinho ao fim do dia.' : ''))],
        [{ txt: 'Acertar', pri: true, fn: function(){ return fnApi('/api/financas/cc/' + pessoa.id + '/mov', 'POST', { descricao: 'Acerto de contas', valor: -pessoa.saldo }).then(function(){ FN.cache = {}; fnRender('financas'); }, fnErro); } }]);
    }, 'small'), fnBtn('Editar', function(){ fnPessoaCcJanela(pessoa); }, 'small')])]));
  var lista = h('div', { class: 'fn-lista' }, [h('p', { class: 'fn-nota' }, 'A ler…')]);
  p.appendChild(lista);
  apiGestao('/api/financas/cc/' + pessoa.id).then(function(r){
    clear(lista);
    if (!r.movimentos.length) lista.appendChild(h('p', { class: 'fn-nota' }, 'Sem movimentos.'));
    r.movimentos.slice(0, 200).forEach(function(m){
      lista.appendChild(h('div', { class: 'fn-li' }, [h('span', { class: 'fn-n fn-muted', style: 'width:52px;font-size:.75rem' }, fnData(m.data)),
        h('div', { class: 'g' }, [m.descricao, h('small', null, [m.origem === 'splitwise' ? 'Splitwise' + (m.grupo ? ' · ' + m.grupo : '') + (m.total ? ' · total ' + fnEur(m.total) : '') : m.origem === 'banco' ? 'do banco' : 'à mão', m.pagamento ? ' · pagamento' : ''].join(''))]),
        h('span', { class: 'fn-n ' + (m.valor > 0 ? 'fn-good' : 'fn-bad') }, fnEur(m.valor, true)),
        m.origem !== 'splitwise' ? h('button', { type: 'button', class: 'btn small', 'aria-label': 'Apagar', onclick: function(){ fnApi('/api/financas/cc/mov/' + m.id, 'DELETE').then(function(){ FN.cache = {}; fnRender('financas'); }, fnErro); } }, '×') : null]));
    });
  }, function(e){ clear(lista); lista.appendChild(h('p', { class: 'fn-nota' }, e.message)); });
}
function fnPessoaCcJanela(p){
  var nome = h('input', { class: 'fn-in', value: p ? p.nome : '' });
  var pes = h('select', { class: 'fn-sel' }, [h('option', { value: '' }, '— ninguém da casa —')]);
  ((window.G && (G.people || G.pessoas)) || (window.D && D.people) || []).forEach(function(x){ pes.appendChild(h('option', { value: x.id }, x.name)); });
  if (p && p.person_id) pes.value = String(p.person_id);
  var ativo = h('input', { type: 'checkbox', checked: p ? p.ativo : true });
  fnJanela(p ? p.nome : 'Nova pessoa na conta corrente', [fnCampo('Nome', nome), fnCampo('É da casa', pes), p ? h('label', { class: 'fn-check' }, [ativo, 'Mostrar (desmarca para esconder)']) : null,
    p && p.splitwise_id ? h('p', { class: 'fn-nota' }, 'Vem do Splitwise: o nome volta a ser o de lá na próxima leitura só se mudares lá.') : h('p', { class: 'fn-nota' }, 'Para quem não está no Splitwise: a empresa, os pais, um amigo.')],
  [{ txt: p ? 'Guardar' : 'Criar', pri: true, fn: function(){
    if (!nome.value.trim()) { fnAviso('Falta o nome.'); return false; }
    var corpo = { nome: nome.value.trim(), person_id: pes.value ? Number(pes.value) : null };
    if (p) corpo.ativo = ativo.checked;
    var q = p ? fnApi('/api/financas/cc/pessoas/' + p.id, 'PATCH', corpo) : fnApi('/api/financas/cc/pessoas', 'POST', corpo).then(function(r){ FN.ccAberta = r.id; });
    return q.then(function(){ FN.cache = {}; fnRender('financas'); }, fnErro);
  } }]);
}

/* ======================= CATEGORIAS & IA ======================= */
function fn_financas_categorias(corpo){
  var linha = h('div', { class: 'fn-linha', style: 'align-items:flex-start' });
  /* Categorias. */
  var seg = h('div', { class: 'fn-seg', role: 'group', 'aria-label': 'Natureza' }, [['despesa','Despesa'],['receita','Receita'],['transferencia','Transferência'],['financiamento','Financiamento']].map(function(o){
    return h('button', { type: 'button', class: FN.catNatureza === o[0] ? 'on' : '', onclick: function(){ FN.catNatureza = o[0]; fnRender('financas'); } }, o[1]);
  }));
  var lc = h('div', { class: 'fn-lista' });
  var grupos = {};
  FN.base.categorias.filter(function(c){ return c.natureza === FN.catNatureza; }).forEach(function(c){ (grupos[c.grupo] = grupos[c.grupo] || []).push(c); });
  Object.keys(grupos).forEach(function(g){
    var n = grupos[g].reduce(function(s, c){ return s + c.n; }, 0);
    lc.appendChild(h('div', { class: 'fn-li', style: 'font-weight:600;padding-top:12px' }, [h('span', { class: 'g' }, g), h('span', { class: 'fn-n fn-muted', style: 'font-size:.75rem' }, String(n))]));
    grupos[g].forEach(function(c){
      lc.appendChild(h('div', { class: 'fn-li', style: 'padding-left:14px;' + (c.ativo ? '' : 'opacity:.5') }, [h('span', { class: 'g' }, [c.nome, c.fixa ? h('small', null, 'fixa') : null, c.context_id ? h('small', null, 'só ' + fnCtxNome(c.context_id)) : null]),
        h('span', { class: 'fn-n fn-muted', style: 'font-size:.75rem' }, String(c.n)), fnBtn('Editar', function(){ fnCatJanela(c); }, 'small')]));
    });
  });
  linha.appendChild(fnCard('Categorias', h('button', { type: 'button', class: 'btn small', onclick: function(){ fnCatJanela(); } }, '+ Categoria'),
    [seg, lc, h('p', { class: 'fn-nota' }, 'A natureza decide como conta: despesa e receita entram nos totais; transferências (entre contas, poupança, PPR) e financiamento (suprimentos, empréstimos) não.')]));

  var dir = h('div', { style: 'flex:999 1 560px;display:flex;flex-direction:column;gap:14px;min-width:0' });
  var cIa = h('div', { class: 'card' }, [h('header', null, [h('h3', null, 'Como a IA categoriza'), h('span', { class: 'fn-pill ai', style: 'margin-left:auto' }, '✦ sugere, não decide')])]);
  dir.appendChild(cIa);
  var cRegras = h('div', { class: 'card' }); dir.appendChild(cRegras);
  var cProp = h('div', { class: 'card' }); dir.appendChild(cProp);
  dir.appendChild(fnAlertasCard());
  linha.appendChild(dir);
  corpo.appendChild(linha);

  apiGestao('/api/financas/ia').then(function(ia){
    cIa.appendChild(h('div', { class: 'fn-campos' }, [
      h('div', null, [h('b', null, '1 · Regras'), h('p', { class: 'fn-nota' }, 'A descrição bate com uma regra tua: aplica-se logo.')]),
      h('div', null, [h('b', null, '2 · Histórico'), h('p', { class: 'fn-nota' }, 'O mesmo comerciante já teve categoria: propõe a mesma. Também reconhece transferências entre as tuas contas.')]),
      h('div', null, [h('b', null, '3 · Gemini'), h('p', { class: 'fn-nota' }, ia.ativa ? 'Lê descrição, valor e conta e propõe, com a confiança.' : 'Desligado: falta a GEMINI_API_KEY.')])]));
    cIa.appendChild(h('div', { class: 'fn-kpis' }, [fnKpi('Acerto · 30 dias', ia.acerto == null ? '—' : ia.acerto + '%', 'aceites ÷ (aceites + corrigidas)', 'fn-good'),
      fnKpi('Aceites', String(ia.aceites), 'por regra: ' + ia.por_regra), fnKpi('Corrigidas', String(ia.corrigidas), ''), fnKpi('Por rever', String(ia.por_rever), ia.sem_categoria + ' sem categoria')]));
    cIa.appendChild(h('div', { class: 'fn-acoes', style: 'margin-top:10px' }, [fnBtn('Categorizar agora', function(e){
      var b = e && e.target; if (b) { b.disabled = true; b.textContent = 'A categorizar…'; }
      fnApi('/api/financas/ia/categorizar', 'POST', {}).then(function(r){ fnAviso(r.regra + ' por regra · ' + r.sugestoes + ' sugestões.'); fnMudou(); }, function(x){ if (b) b.disabled = false; fnErro(x); });
    }, 'primary small'), fnBtn('Rever as sugestões', function(){ FN.mov.estado = 'sugestoes'; FN.mov.periodo = 'tudo'; fnIr('movimentos'); }, 'small')]));
    cProp.appendChild(h('header', null, [h('h3', null, 'Regras propostas'), h('span', { class: 'mono' }, 'do que já categorizaste')]));
    if (!ia.propostas.length) cProp.appendChild(h('p', { class: 'fn-nota' }, 'Quando puseres o mesmo comerciante três vezes na mesma categoria, aparece aqui a proposta de regra.'));
    ia.propostas.forEach(function(p){
      cProp.appendChild(h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, ['«' + p.padrao + '» → ', h('b', null, p.categoria), h('small', null, p.n + ' vezes')]),
        fnBtn('Criar regra', function(){ fnApi('/api/financas/regras', 'POST', { padrao: p.padrao, categoria_id: p.categoria_id, origem: 'ia' }).then(function(r){ fnAviso('Regra criada' + (r.aplicada ? ' e aplicada a ' + r.aplicada : '') + '.'); fnMudou(); }, fnErro); }, 'primary small')]));
    });
  }, function(e){ cIa.appendChild(h('p', { class: 'fn-nota' }, e.message)); });

  apiGestao('/api/financas/regras').then(function(r){
    cRegras.appendChild(h('header', null, [h('h3', null, 'Regras'), h('span', { class: 'mono' }, r.regras.length + ' regras'), h('button', { type: 'button', class: 'btn small', onclick: function(){ fnRegraJanela(); } }, '+ Regra')]));
    if (!r.regras.length) { cRegras.appendChild(h('p', { class: 'fn-nota' }, 'Ainda sem regras. «Se a descrição tem GALP, é Combustível.»')); return; }
    var tb = h('tbody');
    r.regras.forEach(function(x){
      tb.appendChild(h('tr', { style: x.ativo ? '' : 'opacity:.5' }, [h('td', null, [h('code', null, x.padrao), x.valor_min != null || x.valor_max != null ? h('small', { style: 'display:block' }, 'valor ' + (x.valor_min != null ? '≥ ' + fnEur(x.valor_min) : '') + (x.valor_max != null ? ' ≤ ' + fnEur(x.valor_max) : '')) : null]),
        h('td', null, x.categoria), h('td', { style: 'font-size:.75rem' }, [x.conta || '', x.context_id ? ' ' + fnCtxNome(x.context_id) : ''].join('') || '—'),
        h('td', null, [h('span', { class: 'fn-pill' + (x.origem === 'ia' ? ' ai' : '') }, x.origem === 'ia' ? 'proposta da IA' : 'tu')]),
        h('td', { class: 'r' }, x.usos + '×'), h('td', null, [fnBtn('Editar', function(){ fnRegraJanela(x); }, 'small')])]));
    });
    cRegras.appendChild(h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab', style: 'min-width:620px' }, [h('thead', null, [h('tr', null, [h('th', null, 'Se a descrição tem'), h('th', null, 'Então'), h('th', null, 'Só em'), h('th', null, 'Origem'), h('th', { class: 'r' }, 'Usada'), h('th')])]), tb])]));
  }, function(e){ cRegras.appendChild(h('p', { class: 'fn-nota' }, e.message)); });
}

function fnAlertasCard(){
  var a = FN.base.alertas || {};
  var lim = h('input', { class: 'fn-in', inputmode: 'numeric', value: a.limiar, style: 'width:70px' });
  var orc = h('input', { class: 'fn-in', inputmode: 'numeric', value: a.orcamento, style: 'width:70px' });
  var chk = function(k, txt, extra){ var i = h('input', { type: 'checkbox', checked: a[k] !== false }); i.dataset.k = k; return h('label', { class: 'fn-check', style: 'padding:6px 0;border-top:1px solid var(--line-soft)' }, [i, h('span', { style: 'flex:1' }, txt)].concat(extra || [])); };
  var corpo = h('div', null, [chk('ativo', 'Mostrar tendências no Resumo'), h('div', { class: 'fn-check', style: 'padding:6px 0;border-top:1px solid var(--line-soft)' }, [h('span', { style: 'flex:1' }, 'Avisar quando uma categoria passa a média de 6 meses em mais de'), lim, '%']),
    chk('subscricoes', 'Débitos novos que se repetem todos os meses'), h('div', { class: 'fn-check', style: 'padding:6px 0;border-top:1px solid var(--line-soft)' }, [h('span', { style: 'flex:1' }, 'Avisar quando um orçamento chega a'), orc, '%'])]);
  return fnCard('Alertas de tendência', h('button', { type: 'button', class: 'btn small', onclick: function(){
    var cfg = { limiar: Number(lim.value) || 25, orcamento: Number(orc.value) || 90 };
    corpo.querySelectorAll('input[type=checkbox]').forEach(function(i){ cfg[i.dataset.k] = i.checked; });
    fnApi('/api/financas/alertas', 'PUT', cfg).then(function(){ fnAviso('Alertas guardados.'); fnMudou(); }, fnErro);
  } }, 'Guardar'), [corpo]);
}

function fnCatJanela(c){
  var grupo = h('input', { class: 'fn-in', value: c ? c.grupo : '', list: 'fnGrupos' });
  var dl = h('datalist', { id: 'fnGrupos' });
  FN.base.categorias.map(function(x){ return x.grupo; }).filter(function(g, i, a){ return a.indexOf(g) === i; }).forEach(function(g){ dl.appendChild(h('option', { value: g })); });
  var nome = h('input', { class: 'fn-in', value: c ? c.nome : '' });
  var nat = h('select', { class: 'fn-sel' }, [['despesa','Despesa'],['receita','Receita'],['transferencia','Transferência'],['financiamento','Financiamento']].map(function(o){ return h('option', { value: o[0] }, o[1]); }));
  nat.value = c ? c.natureza : FN.catNatureza;
  var fixa = h('input', { type: 'checkbox', checked: c ? c.fixa : false });
  var ativo = h('input', { type: 'checkbox', checked: c ? c.ativo : true });
  var area = fnSelAreas(c ? c.context_id : '', 'Todas as áreas');
  var bts = [{ txt: c ? 'Guardar' : 'Criar', pri: true, fn: function(){
    if (!grupo.value.trim() || !nome.value.trim()) { fnAviso('Faltam o grupo e o nome.'); return false; }
    var corpo = { grupo: grupo.value.trim(), nome: nome.value.trim(), natureza: nat.value, fixa: fixa.checked, context_id: area.value ? Number(area.value) : null };
    if (c) corpo.ativo = ativo.checked;
    return (c ? fnApi('/api/financas/categorias/' + c.id, 'PATCH', corpo) : fnApi('/api/financas/categorias', 'POST', corpo)).then(function(){ fnMudou(); }, fnErro);
  } }];
  if (c) bts.push({ txt: 'Apagar', fn: function(){
    var para = fnSelCategorias('', '— ficam sem categoria —');
    fnJanela('Apagar ' + c.nome + '?', [h('p', null, c.n ? c.n + ' movimentos têm esta categoria. Passam para:' : 'Não tem movimentos.'), c.n ? para : null, h('p', { class: 'fn-nota' }, 'O orçamento e as regras desta categoria apagam-se com ela.')],
      [{ txt: 'Apagar', pri: true, fn: function(){ return fnApi('/api/financas/categorias/' + c.id + (para.value ? '?para=' + para.value : ''), 'DELETE').then(function(){ fnMudou(); }, fnErro); } }]);
  } });
  fnJanela(c ? c.grupo + ' › ' + c.nome : 'Nova categoria', [dl, h('div', { class: 'fn-campos' }, [fnCampo('Grupo', grupo), fnCampo('Nome', nome)]), h('div', { class: 'fn-campos' }, [fnCampo('Natureza', nat), fnCampo('Só na área', area)]),
    h('label', { class: 'fn-check' }, [fixa, 'Custo fixo (renda, prestações, subscrições)']), c ? h('label', { class: 'fn-check' }, [ativo, 'Ativa']) : null], bts);
}

function fnRegraJanela(r){
  var padrao = h('input', { class: 'fn-in', value: r ? r.padrao : '', placeholder: 'ex.: GALP' });
  var cat = fnSelCategorias(r ? r.categoria_id : '', '— escolhe —');
  var vmin = h('input', { class: 'fn-in', inputmode: 'decimal', value: r && r.valor_min != null ? r.valor_min : '' });
  var vmax = h('input', { class: 'fn-in', inputmode: 'decimal', value: r && r.valor_max != null ? r.valor_max : '' });
  var conta = fnSelContas(r ? r.conta_id : '', 'Qualquer conta');
  var area = fnSelAreas(r ? r.context_id : '', 'Não mudar a área');
  var ativo = h('input', { type: 'checkbox', checked: r ? r.ativo : true });
  var bts = [{ txt: r ? 'Guardar' : 'Criar', pri: true, fn: function(){
    if (padrao.value.trim().length < 2 || !cat.value) { fnAviso('Faltam o texto e a categoria.'); return false; }
    var corpo = { padrao: padrao.value.trim(), categoria_id: Number(cat.value), valor_min: vmin.value, valor_max: vmax.value, conta_id: conta.value ? Number(conta.value) : null, context_id: area.value ? Number(area.value) : null };
    if (r) corpo.ativo = ativo.checked;
    ['valor_min', 'valor_max'].forEach(function(k){ corpo[k] = corpo[k] === '' ? null : Number(String(corpo[k]).replace(',', '.')); });
    return (r ? fnApi('/api/financas/regras/' + r.id, 'PATCH', corpo) : fnApi('/api/financas/regras', 'POST', corpo).then(function(x){ if (x.aplicada) fnAviso('Aplicada a ' + x.aplicada + ' movimentos.'); })).then(function(){ fnMudou(); }, fnErro);
  } }];
  if (r) bts.push({ txt: 'Apagar', fn: function(){ return fnApi('/api/financas/regras/' + r.id, 'DELETE').then(function(){ fnMudou(); }, fnErro); } });
  fnJanela(r ? 'Regra' : 'Nova regra', [fnCampo('Se a descrição tem', padrao), fnCampo('Então a categoria é', cat),
    h('div', { class: 'fn-campos' }, [fnCampo('Valor mínimo', vmin), fnCampo('Valor máximo', vmax)]), h('div', { class: 'fn-campos' }, [fnCampo('Conta', conta), fnCampo('E a área passa a', area)]),
    r ? h('label', { class: 'fn-check' }, [ativo, 'Ativa']) : null, h('p', { class: 'fn-nota' }, 'Maiúsculas e acentos não contam. Ao criar, aplica-se logo aos movimentos que ainda não têm categoria.')], bts);
}
