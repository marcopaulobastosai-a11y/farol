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
    dir.appendChild(fnCard('A receber e a pagar', h('button', { type: 'button', class: 'btn small', onclick: function(){ FN.aba.financas = 'pessoas'; fnGuardar(); show('financas'); fnRender('financas'); } }, 'Pessoas'), [lr]));
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
var FN_CLASSES_BEM = { imovel: 'Imóvel', viatura: 'Viatura', credito: 'Crédito', outro: 'Outro' };
function fnNomeArea(id){
  var cs = (window.G && G.contextos) || [], c = cs.filter(function(x){ return x.id === id; })[0];
  if (!c) return null;
  var pai = c.parent_id ? cs.filter(function(x){ return x.id === c.parent_id; })[0] : null;
  return pai ? pai.name + ' › ' + c.name : c.name;
}
/* Os papeis de um bem sao os da sub-area dele. Carregar no numero abre os
   Documentos ja filtrados por essa sub-area. */
function fnDocsDoBem(b){
  if (!b.context_id) return null;
  var n = b.documentos || 0;
  return fnBtn(n ? n + (n === 1 ? ' documento' : ' documentos') : 'Sem documentos', function(){
    if (typeof DOCS_AREA === 'undefined' || typeof show !== 'function') return;
    DOCS_AREA = b.context_id;
    show('documentos');
    if (typeof renderDocumentos === 'function') renderDocumentos();
  }, 'small');
}
function fnLinhaBem(b, editar){
  var sub = [FN_CLASSES_BEM[b.classe] || b.classe, b.context_id ? fnNomeArea(b.context_id) : null, b.prestacao ? fnEur(b.prestacao) + '/mês' : null, b.termina ? 'acaba ' + fnData(b.termina) : null, b.valor_em ? 'valor de ' + fnData(b.valor_em) : null].filter(Boolean).join(' · ');
  return h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [b.nome, h('small', null, sub)]),
    h('span', { class: 'fn-n ' + (b.lado === 'passivo' ? 'fn-bad' : '') }, b.valor == null ? 'sem valor' : fnEur(b.lado === 'passivo' ? -Math.abs(b.valor) : b.valor)),
    editar !== false && b.context_id ? fnBtn('Ficha', function(){ fnIrParaArea(b.context_id); }, 'small') : null,
    editar !== false ? fnDocsDoBem(b) : null,
    editar !== false ? fnBtn('Editar', function(){ fnBemJanela(b); }, 'small') : null]);
}
/* A area Patrimonio, onde vivem as sub-areas dos bens. */
function fnAreaPatrimonio(){
  var cs = (window.G && G.contextos) || [];
  return cs.filter(function(c){ return !c.parent_id && (c.slug === 'patrimonio' || /patrim/i.test(c.name)); })[0] || null;
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
  var idents = h('textarea', { class: 'fn-in', rows: 2, placeholder: 'ex.: PREST.55046103770' }, c ? (c.identificadores || '') : '');
  /* De quem é o dinheiro desta conta: dela própria (a dele) ou de uma empresa.
     Numa conta da empresa, as despesas de representação ficam só registadas
     para apresentar — não há nada a receber. */
  var emp = h('select', { class: 'fn-sel' }, [h('option', { value: '' }, '— é minha —')]);
  apiGestao('/api/financas/cc').then(function(cc){
    (cc.pessoas || []).filter(function(x){ return x.empresa; }).forEach(function(x){
      emp.appendChild(h('option', { value: String(x.id) }, 'É de ' + x.nome));
    });
    if (c && c.empresa_id) emp.value = String(c.empresa_id);
  }, function(){});
  tipo.addEventListener('change', function(){ if (tipo.value === 'empresa') pes.checked = false; });
  var bts = [{ txt: c ? 'Guardar' : 'Criar', pri: true, fn: function(){
    if (!nome.value.trim()) { fnAviso('Falta o nome.'); return false; }
    var corpo = { nome: nome.value.trim(), tipo: tipo.value, instituicao: inst.value, context_id: area.value ? Number(area.value) : null, pessoal: pes.checked, identificadores: idents.value.trim(), empresa_id: emp.value ? Number(emp.value) : null };
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
    fnCampo('De quem é o dinheiro', emp),
    h('p', { class: 'fn-nota' }, 'Sendo de uma empresa (o cartão que ela te dá), as despesas de representação que lançares aqui ficam só registadas para apresentares — não há nada a receber, porque não saiu do teu bolso.'),
    c ? h('label', { class: 'fn-check' }, [ativo, 'Ativa']) : null,
    h('div', { class: 'fn-campos' }, [fnCampo(c ? 'Novo saldo (opcional)' : 'Saldo (opcional)', saldo), fnCampo('Em', em)]),
    h('p', { class: 'fn-nota' }, 'Se o extrato trouxer a coluna do saldo, não é preciso escrevê-lo.'),
    fnCampo('Identificadores (um por linha)', idents),
    h('p', { class: 'fn-nota' }, 'O texto que aparece nos movimentos das outras contas quando o dinheiro vai para esta (o número do contrato do cartão, a referência da poupança). Esses movimentos ficam ligados a esta conta sozinhos, também os que vierem depois.')
  ], bts, { folha: true });
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
function fnBemJanela(b, pre){
  pre = pre || {};
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
  var area = fnSelAreas(b ? b.context_id : (pre.context_id || ''));
  /* A identificacao do bem: o que se procura no IMI, no IRS e numa venda. */
  var dd = (b && b.dados) || {};
  var ident = {};
  var inp = function(k, ph, tipo){ ident[k] = h('input', { class: 'fn-in', type: tipo || 'text', placeholder: ph || '', value: dd[k] || '' }); return ident[k]; };
  var casa = fnSelAreas(dd.casa_context_id || '', '— não se vive lá —');
  var blocoImovel = h('div', null, [
    h('div', { class: 'fn-campos' }, [fnCampo('Artigo matricial', inp('artigo', 'ex.: U-4019')), fnCampo('Registo predial', inp('registo', 'ex.: CRP Agualva-Cacém n.º 5860'))]),
    h('div', { class: 'fn-campos' }, [fnCampo('Área (m²)', inp('area_m2')), fnCampo('Valor patrimonial (VPT)', inp('vpt'))]),
    fnCampo('Onde se vive nele (sub-área da Casa)', casa)]);
  var blocoViatura = h('div', null, [
    h('div', { class: 'fn-campos' }, [fnCampo('Matrícula', inp('matricula')), fnCampo('Marca e modelo', inp('modelo'))]),
    h('div', { class: 'fn-campos' }, [fnCampo('Data da matrícula', inp('data_matricula', '', 'date')), fnCampo('Seguradora', inp('seguradora'))]),
    fnCampo('Apólice', inp('apolice'))]);
  var blocoCompra = h('div', { class: 'fn-campos' }, [fnCampo('Comprado em', inp('compra_data', '', 'date')), fnCampo('Preço de compra', inp('compra_preco')),
    fnCampo('IMT pago', inp('imt')), fnCampo('Imposto do Selo', inp('imposto_selo'))]);
  var identBox = h('div', null, [h('p', { class: 'fn-nota' }, 'Identificação (aparece na ficha do bem)'), blocoImovel, blocoViatura, blocoCompra]);
  function ajustarIdent(){
    var ativo = lado.value === 'ativo';
    identBox.hidden = !ativo || (classe.value !== 'imovel' && classe.value !== 'viatura');
    blocoImovel.hidden = classe.value !== 'imovel';
    blocoViatura.hidden = classe.value !== 'viatura';
  }
  [lado, classe].forEach(function(x){ x.addEventListener('change', ajustarIdent); });
  ajustarIdent();
  function lerIdent(){
    if (identBox.hidden) return b ? b.dados || null : null;
    var o = {};
    Object.keys(ident).forEach(function(k){ if (ident[k].value.trim()) o[k] = ident[k].value.trim(); });
    if (classe.value === 'imovel' && casa.value) o.casa_context_id = Number(casa.value);
    return o;
  }
  /* Um imovel ou um carro novo ganha a sua sub-area em Patrimonio: e la que
     ficam a escritura, a caderneta, o seguro, as tarefas e os movimentos dele. */
  var patr = fnAreaPatrimonio();
  var novaArea = h('input', { type: 'checkbox' });
  var linhaNova = h('label', { class: 'fn-check' }, [novaArea, h('span', null, '')]);
  function ajustarNova(){
    var pede = patr && !area.value && lado.value === 'ativo' && (classe.value === 'imovel' || classe.value === 'viatura');
    linhaNova.hidden = !pede;
    if (!pede) novaArea.checked = false;
    linhaNova.lastChild.textContent = 'Criar a sub-área «' + (nome.value.trim() || 'nome do bem') + '» em ' + (patr ? patr.name : 'Património') + ' e arrumar lá os papéis deste bem';
  }
  if (!b) novaArea.checked = true;
  [area, lado, classe].forEach(function(x){ x.addEventListener('change', ajustarNova); });
  nome.addEventListener('input', ajustarNova);
  ajustarNova();
  var bts = [{ txt: b ? 'Guardar' : 'Criar', pri: true, fn: function(){
    if (!nome.value.trim()) { fnAviso('Falta o nome.'); return false; }
    var corpo = { nome: nome.value.trim(), lado: lado.value, classe: classe.value, valor: valor.value, valor_em: em.value || null, prestacao: prest.value, termina: termina.value || null, pessoal: pes.checked, nota: nota.value, context_id: area.value ? Number(area.value) : null, dados: lerIdent() };
    var antes = Promise.resolve();
    if (novaArea.checked && !linhaNova.hidden && patr) {
      antes = fnApi('/api/contextos', 'POST', { name: corpo.nome, parent_id: patr.id }).then(function(r){
        corpo.context_id = r.id;
        if (typeof loadGestao === 'function') loadGestao();
      });
    }
    return antes.then(function(){
      return b ? fnApi('/api/financas/bens/' + b.id, 'PATCH', corpo) : fnApi('/api/financas/bens', 'POST', corpo);
    }).then(function(){ fnMudou(); }, fnErro);
  } }];
  if (b) bts.push({ txt: 'Apagar', fn: function(){ return fnApi('/api/financas/bens/' + b.id, 'DELETE').then(function(){ fnMudou(); }, fnErro); } });
  fnJanela(b ? b.nome : 'Novo bem ou dívida', [h('div', { class: 'fn-campos' }, [fnCampo('Nome', nome), fnCampo('É', lado), fnCampo('Classe', classe)]),
    h('div', { class: 'fn-campos' }, [fnCampo('Valor (ou o que falta pagar)', valor), fnCampo('Valor de', em)]),
    h('div', { class: 'fn-campos' }, [fnCampo('Prestação mensal', prest), fnCampo('Acaba em', termina)]),
    fnCampo('Nota', nota), fnCampo('Área (onde ficam os papéis deste bem)', area), linhaNova, identBox, h('label', { class: 'fn-check' }, [pes, 'Pessoal'])], bts, { folha: true });
}

/* ======================= CONTAS CORRENTES ======================= */
/* Uma conta corrente e um grupo do Splitwise (com os membros dele) ou a
   conta direta com uma pessoa (o que nao e de grupo nenhum, ou quem nao esta
   no Splitwise). Tambem se criam contas so do Farol com quem se quiser. */
function fnTipoCc(c){
  if (c.grupo) return 'Grupo do Splitwise';
  if (c.direta) return c.tipo === 'splitwise' ? 'Splitwise · sem grupo' : 'Só no Farol';
  return 'Conta do Farol';
}
function fnSegFiltro(chave, opcoes, conta){
  return h('div', { class: 'fn-seg', role: 'group' }, opcoes.map(function(o){
    return h('button', { type: 'button', class: FN[chave] === o[0] ? 'on' : '', onclick: function(){ FN[chave] = o[0]; fnGuardar(); fnRender('financas'); } },
      o[1] + (conta ? ' · ' + conta(o[0]) : ''));
  }));
}
function fnCcBarra(corpo, d, extra){
  corpo.appendChild(h('div', { class: 'fn-barra' }, [
    h('span', { class: 'fn-nota' }, d.splitwise ? 'Lê o Splitwise sozinho todos os dias às 23:30' + (d.sync_em ? ' · última leitura ' + new Date(d.sync_em).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '') + '.' : 'O Splitwise não está ligado (Administração › Splitwise). As contas funcionam à mão.'),
    h('span', { class: 'fn-esp' }),
    d.splitwise ? fnBtn('Ler o Splitwise agora', function(e){ var b = e && e.target; if (b) b.disabled = true;
      fnApi('/api/financas/cc/sincronizar', 'POST', {}).then(function(r){ fnAviso(r.lidas + ' despesas lidas.'); FN.cache = {}; fnRender('financas'); }, function(x){ if (b) b.disabled = false; fnErro(x); }); }) : null
  ].concat(extra || [])));
}
function fnCcKpis(corpo, d){
  var ps = d.pessoas.filter(function(p){ return p.ativo; });
  var kpis = [fnKpi('Devem-me', fnEur(d.a_receber), ps.filter(function(p){ return p.saldo > 0.005; }).length + ' pessoas', 'fn-good'),
    fnKpi('Devo eu', fnEur(d.a_pagar), ps.filter(function(p){ return p.saldo < -0.005; }).length + ' pessoas', d.a_pagar ? 'fn-bad' : ''),
    fnKpi('Líquido', fnEur(d.a_receber + d.a_pagar), 'entra no Património como «a receber»')];
  /* Despesas de representação: o que falta apresentar é o que se esquece. */
  var emp = ps.filter(function(p){ return p.empresa; });
  var apres = emp.reduce(function(t, p){ return t + (p.por_apresentar || 0); }, 0);
  var receb = emp.reduce(function(t, p){ return t + (p.por_receber || 0); }, 0);
  if (emp.length) kpis.push(fnKpi('Por apresentar', fnEur(apres),
    (receb > 0.005 ? fnEur(receb) + ' por receber · ' : '') + emp.map(function(p){ return p.nome; }).join(', '), apres > 0.005 ? 'fn-bad' : ''));
  corpo.appendChild(h('div', { class: 'fn-kpis' }, kpis));
  if (emp.length) fnRepresQuadro(corpo);
}

/* O quadro das despesas de representação: por empresa e por quem pagou de
   facto — o cartão da empresa ou o bolso dele. É a pergunta que ele faz («quanto
   tenho do CA no cartão deles, e quanto adiantei eu»), por isso é esta a
   divisão das colunas. */
function fnRepresQuadro(corpo){
  var cx = h('div', { class: 'card largo', style: 'padding:6px 10px' });
  corpo.appendChild(cx);
  cx.appendChild(h('header', null, [h('h3', null, 'Despesas de representação'), h('span', { class: 'mono' }, 'a ler…')]));
  apiGestao('/api/financas/representacao').then(function(r){
    clear(cx);
    var ls = r.linhas || [];
    cx.appendChild(h('header', null, [h('h3', null, 'Despesas de representação'),
      h('span', { class: 'mono' }, ls.reduce(function(t, x){ return t + x.n; }, 0) + ' movimentos')]));
    if (!ls.length) {
      cx.appendChild(fnVazio('Ainda não há nenhuma.', 'Num pagamento, usa «Despesa de representação» e diz de que empresa é.'));
      return;
    }
    /* Uma linha por empresa, e dentro dela o que está por apresentar e o resto. */
    var porEmp = {};
    ls.forEach(function(x){
      var e = porEmp[x.empresa_id] = porEmp[x.empresa_id] || { nome: x.empresa, cartao: 0, bolso: 0, porApres: 0, porReceber: 0, n: 0, desde: null };
      e.n += x.n;
      e[x.cartao ? 'cartao' : 'bolso'] += x.total;
      var aberta = ['adiantado', 'registada', ''].indexOf(x.estado) >= 0;
      if (aberta) { e.porApres += x.total; if (!e.desde || x.primeiro < e.desde) e.desde = x.primeiro; }
      if (!x.cartao && ['adiantado', 'apresentado', ''].indexOf(x.estado) >= 0) e.porReceber += x.total;
    });
    var tb = h('tbody');
    Object.keys(porEmp).forEach(function(k){
      var e = porEmp[k];
      tb.appendChild(h('tr', null, [
        h('td', null, [h('b', { style: 'font-weight:500' }, e.nome), h('small', { style: 'display:block' }, e.n + (e.n === 1 ? ' movimento' : ' movimentos'))]),
        h('td', { class: 'r' }, fnEur(e.cartao)),
        h('td', { class: 'r' }, fnEur(e.bolso)),
        h('td', { class: 'r' }, h('b', null, fnEur(e.cartao + e.bolso))),
        h('td', { class: 'r' + (e.porApres > 0.005 ? ' fn-bad' : '') }, [fnEur(e.porApres),
          e.desde && e.porApres > 0.005 ? h('small', { class: 'fn-muted', style: 'display:block' }, 'desde ' + fnData(e.desde)) : null]),
        h('td', { class: 'r' + (e.porReceber > 0.005 ? ' fn-good' : '') }, fnEur(e.porReceber))
      ]));
    });
    cx.appendChild(h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab', style: 'min-width:680px' }, [
      h('thead', null, [h('tr', null, [h('th', null, 'Empresa'), h('th', { class: 'r' }, 'Cartão da empresa'),
        h('th', { class: 'r' }, 'Do meu bolso'), h('th', { class: 'r' }, 'Total'),
        h('th', { class: 'r' }, 'Por apresentar'), h('th', { class: 'r' }, 'Por receber')])]), tb])]));
    cx.appendChild(h('div', { class: 'fn-acoes', style: 'padding:8px' }, [
      h('p', { class: 'fn-nota', style: 'flex:1' }, '«Por receber» é só do que saiu do teu bolso: o que a empresa pagou com o cartão dela não te volta, só tem de ser apresentado.'),
      fnBtn('Ver as que faltam apresentar', function(){ FN.mov.estado = 'reembolsar'; FN.mov.categoria = ''; FN.mov.sinal = ''; FN.mov.periodo = 'tudo'; fnIr('movimentos'); }, 'small')]));
  }, function(e){ clear(cx); cx.appendChild(h('header', null, [h('h3', null, 'Despesas de representação')]));
    cx.appendChild(h('p', { class: 'fn-nota' }, 'Não foi possível ler: ' + e.message)); });
}

function fn_financas_cc(corpo){
  fnCarregar(corpo, apiGestao('/api/financas/cc'), function(d){
    FN.ccEstado = FN.ccEstado || 'aberta';
    FN.ccTipo = FN.ccTipo || 'todas';
    var cs = (d.contas || []).filter(function(c){ return c.ativo; });
    var passa = function(c, est, tp){ return (est === 'todas' || c.estado === est) && (tp === 'todas' || c.tipo === tp); };
    fnCcBarra(corpo, d, [fnBtn('+ Conta corrente', function(){ fnContaCcJanela(null, d); }, 'primary')]);
    fnCcKpis(corpo, d);
    corpo.appendChild(h('div', { class: 'fn-barra', style: 'gap:8px;flex-wrap:wrap' }, [
      fnSegFiltro('ccEstado', [['aberta', 'Em aberto'], ['saldada', 'Saldadas'], ['todas', 'Todas']], function(k){ return cs.filter(function(c){ return passa(c, k, FN.ccTipo); }).length; }),
      fnSegFiltro('ccTipo', [['todas', 'Todas'], ['splitwise', 'Splitwise'], ['farol', 'Só no Farol']])]));
    var vis = cs.filter(function(c){ return passa(c, FN.ccEstado, FN.ccTipo); })
      .sort(function(a, b){ return Math.abs(b.saldo) - Math.abs(a.saldo) || (b.ultimo || '').localeCompare(a.ultimo || ''); });
    var linha = h('div', { class: 'fn-linha', style: 'align-items:flex-start' });
    var cartao = h('div', { class: 'card largo', style: 'padding:6px 10px' });
    var tb = h('tbody');
    vis.forEach(function(c){
      var ms = c.membros.filter(function(m){ return Math.abs(m.saldo) >= 0.01 || c.membros.length <= 4; });
      tb.appendChild(h('tr', { class: 'clic' + (FN.ccConta === c.id ? ' on' : ''), onclick: function(){ FN.ccConta = FN.ccConta === c.id ? null : c.id; fnRender('financas'); } }, [
        h('td', null, [h('b', { style: 'font-weight:500' }, c.nome), h('small', { style: 'display:block' }, fnTipoCc(c))]),
        h('td', null, ms.length ? ms.slice(0, 6).map(function(m){
          return h('span', { class: 'fn-pill' + (m.saldo > 0.005 ? ' good' : m.saldo < -0.005 ? ' bad' : ''), style: 'margin:1px' }, m.nome.split(' ')[0] + (Math.abs(m.saldo) >= 0.01 ? ' ' + fnEur(m.saldo, true) : ''));
        }).concat(c.membros.length > 6 ? [h('span', { class: 'fn-muted', style: 'font-size:.75rem' }, ' +' + (c.membros.length - 6))] : []) : h('span', { class: 'fn-muted' }, '—')),
        h('td', { style: 'font-size:.75rem' }, c.ultimo ? fnData(c.ultimo) : '—'),
        h('td', { class: 'r ' + (c.saldo > 0.005 ? 'fn-good' : c.saldo < -0.005 ? 'fn-bad' : '') }, Math.abs(c.saldo) < 0.005 ? 'acertado' : fnEur(c.saldo, true))
      ]));
    });
    if (!cs.length) cartao.appendChild(fnVazio('Ainda não há contas correntes.', d.splitwise ? 'Carrega em «Ler o Splitwise agora»: cada grupo passa a ser uma conta corrente.' : 'Cria uma, ou liga o Splitwise.'));
    else if (!vis.length) cartao.appendChild(fnVazio(FN.ccEstado === 'aberta' ? 'Nada em aberto.' : 'Nenhuma aqui.', 'Muda o filtro acima para ver as outras.'));
    else cartao.appendChild(h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab', style: 'min-width:560px' }, [
      h('thead', null, [h('tr', null, [h('th', null, 'Conta corrente'), h('th', null, 'Quem deve o quê'), h('th', null, 'Último'), h('th', { class: 'r' }, 'Saldo')])]), tb])]));
    cartao.appendChild(h('p', { class: 'fn-nota', style: 'padding:8px' }, 'Saldo positivo: devem-te. Negativo: deves tu. Nos grupos do Splitwise o saldo é o de lá; somam-se as contas partilhadas que ficaram só no Farol e o que lançares à mão.'));
    linha.appendChild(cartao);
    var painel = h('div', { class: 'card fn-painel' });
    var ab = cs.filter(function(c){ return c.id === FN.ccConta; })[0];
    if (ab) fnPainelConta(painel, ab, d); else painel.appendChild(h('p', { class: 'fn-nota' }, 'Escolhe uma conta corrente para ver quem deve o quê, os movimentos e lançar acertos.'));
    linha.appendChild(painel);
    corpo.appendChild(linha);
    var esc = (d.contas || []).filter(function(c){ return !c.ativo; });
    if (esc.length) corpo.appendChild(h('p', { class: 'fn-nota' }, 'Escondidas: ' + esc.map(function(c){ return c.nome; }).join(', ') + '.'));
  });
}

function fnPainelConta(p, c, d){
  p.appendChild(h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('div', null, [h('h3', { style: 'font-size:1.05rem' }, c.nome), h('small', { class: 'fn-muted' }, fnTipoCc(c))]),
    h('b', { class: 'fn-n ' + (c.saldo > 0 ? 'fn-good' : c.saldo < 0 ? 'fn-bad' : '') }, fnEur(c.saldo, true))]));
  p.appendChild(h('div', { class: 'fn-lista' }, c.membros.map(function(m){
    return h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [h('a', { href: '#', onclick: function(e){ e.preventDefault(); FN.ccPessoa = m.pessoa_id; FN.aba.financas = 'pessoas'; fnGuardar(); fnRender('financas'); } }, m.nome),
      h('small', null, [m.splitwise && c.tipo === 'splitwise' ? 'Splitwise ' + fnEur(m.saldo_splitwise, true) : '', Math.abs(m.saldo_farol) >= 0.01 ? 'Farol ' + fnEur(m.saldo_farol, true) : ''].filter(Boolean).join(' · ') || 'sem nada em aberto')]),
      h('span', { class: 'fn-n ' + (m.saldo > 0.005 ? 'fn-good' : m.saldo < -0.005 ? 'fn-bad' : '') }, Math.abs(m.saldo) < 0.005 ? 'acertado' : fnEur(m.saldo, true))]);
  })));
  /* Lançar à mão: um acerto, um empréstimo, o que não passou pelo banco. */
  var quem = h('select', { class: 'fn-sel' }, c.membros.map(function(m){ return h('option', { value: m.pessoa_id }, m.nome); }));
  var dt = h('input', { class: 'fn-in', type: 'date', value: fnHoje() });
  var ds = h('input', { class: 'fn-in', placeholder: 'Descrição' });
  var vl = h('input', { class: 'fn-in', inputmode: 'decimal', placeholder: '0,00' });
  var sen = h('select', { class: 'fn-sel' }, [h('option', { value: '1' }, 'Deve-me'), h('option', { value: '-1' }, 'Devo eu')]);
  var recarregar = function(){ FN.cache = {}; fnRender('financas'); };
  p.appendChild(h('div', { class: 'fn-caixa' }, [h('div', { class: 'mono' }, 'Lançar à mão'), h('div', { class: 'fn-campos' }, [c.membros.length > 1 ? fnCampo('Quem', quem) : null, fnCampo('Data', dt), fnCampo('Valor', vl), fnCampo('', sen)]), ds,
    h('div', { class: 'fn-acoes' }, [fnBtn('Lançar', function(){
      var v = Number(String(vl.value).replace(/\s/g, '').replace(',', '.'));
      if (!v) return fnAviso('Falta o valor.');
      fnApi('/api/financas/cc/' + quem.value + '/mov', 'POST', { data: dt.value, descricao: ds.value || 'Acerto', valor: Math.abs(v) * Number(sen.value), conta_id: c.id }).then(recarregar, fnErro);
    }, 'primary small'), fnBtn('Acertar', function(){
      var m = c.membros.filter(function(x){ return x.pessoa_id === Number(quem.value); })[0];
      if (!m || Math.abs(m.saldo) < 0.01) return fnAviso('Já está acertado.');
      fnJanela('Acertar com ' + m.nome + '?', [h('p', null, 'Lança ' + fnEur(-m.saldo, true) + ' nesta conta e o saldo fica a zero.' + (c.tipo === 'splitwise' ? ' Se o acerto foi feito no Splitwise, não é preciso: aparece sozinho.' : ''))],
        [{ txt: 'Acertar', pri: true, fn: function(){ return fnApi('/api/financas/cc/' + m.pessoa_id + '/mov', 'POST', { descricao: 'Acerto de contas', valor: -m.saldo, conta_id: c.id }).then(recarregar, fnErro); } }]);
    }, 'small'), fnBtn('Editar', function(){ fnContaCcJanela(c, d); }, 'small')])]));
  var lista = h('div', { class: 'fn-lista' }, [h('p', { class: 'fn-nota' }, 'A ler…')]);
  p.appendChild(h('div', { class: 'mono' }, 'Movimentos'));
  p.appendChild(lista);
  apiGestao('/api/financas/cc/contas/' + c.id).then(function(r){
    clear(lista);
    if (!r.movimentos.length) lista.appendChild(h('p', { class: 'fn-nota' }, 'Sem movimentos.'));
    r.movimentos.slice(0, 300).forEach(function(m){ lista.appendChild(fnLinhaCc(m, c.membros.length > 1, recarregar)); });
  }, function(e){ clear(lista); lista.appendChild(h('p', { class: 'fn-nota' }, e.message)); });
}

function fnOrigemCc(m){
  return m.origem === 'splitwise' ? 'Splitwise' + (m.grupo ? ' · ' + m.grupo : '') + (m.total ? ' · total ' + fnEur(m.total) : '')
    : m.origem === 'banco' ? 'do banco' : m.origem === 'partilha' ? 'conta partilhada' + (m.total ? ' · total ' + fnEur(m.total) : '')
    : m.origem === 'reembolso' ? 'reembolso, do banco' : 'à mão';
}
function fnLinhaCc(m, comPessoa, depois){
  return h('div', { class: 'fn-li' }, [h('span', { class: 'fn-n fn-muted', style: 'width:52px;font-size:.75rem' }, fnData(m.data)),
    h('div', { class: 'g' }, [m.descricao, h('small', null, [comPessoa && m.pessoa ? m.pessoa : '', m.conta && !comPessoa ? m.conta : '', fnOrigemCc(m), m.pagamento ? 'pagamento' : ''].filter(Boolean).join(' · '))]),
    h('span', { class: 'fn-n ' + (m.valor > 0 ? 'fn-good' : 'fn-bad') }, fnEur(m.valor, true)),
    m.origem !== 'splitwise' && m.origem !== 'partilha' ? h('button', { type: 'button', class: 'btn small', 'aria-label': 'Apagar', onclick: function(){ fnApi('/api/financas/cc/mov/' + m.id, 'DELETE').then(depois, fnErro); } }, '×')
      : m.partilha_id ? h('button', { type: 'button', class: 'btn small', title: 'Abrir a conta partilhada', onclick: function(){ fnAbrirPartilha(m.partilha_id); } }, 'Abrir') : null]);
}

function fnContaCcJanela(c, d){
  var nome = h('input', { class: 'fn-in', value: c ? c.nome : '', disabled: c && c.grupo ? true : null });
  var nota = h('input', { class: 'fn-in', value: (c && c.nota) || '' });
  var ativo = h('input', { type: 'checkbox', checked: c ? c.ativo : true });
  var podeMembros = !c || (!c.grupo && !c.direta);
  var marcados = {};
  (c ? c.membros : []).forEach(function(m){ marcados[m.pessoa_id] = true; });
  var caixa = h('div', { class: 'fn-lista', style: 'max-height:220px;overflow:auto' }, d.pessoas.filter(function(p){ return p.ativo; }).map(function(p){
    var cb = h('input', { type: 'checkbox', checked: !!marcados[p.id], onchange: function(e){ marcados[p.id] = e.target.checked; } });
    return h('label', { class: 'fn-check' }, [cb, p.nome]);
  }));
  fnJanela(c ? c.nome : 'Nova conta corrente', [
    fnCampo('Nome', nome), c && c.grupo ? h('p', { class: 'fn-nota' }, 'É um grupo do Splitwise: o nome e os membros vêm de lá.') : null,
    podeMembros ? h('div', { class: 'mono' }, 'Quem participa') : null, podeMembros ? caixa : null,
    fnCampo('Nota', nota), c ? h('label', { class: 'fn-check' }, [ativo, 'Mostrar (desmarca para esconder)']) : null
  ], [{ txt: c ? 'Guardar' : 'Criar', pri: true, fn: function(){
    var membros = Object.keys(marcados).filter(function(k){ return marcados[k]; }).map(Number);
    var corpo = { nome: nome.value.trim(), nota: nota.value.trim() };
    if (podeMembros) corpo.membros = membros;
    if (c) corpo.ativo = ativo.checked;
    if (!corpo.nome) { fnAviso('Falta o nome.'); return false; }
    var q = c ? fnApi('/api/financas/cc/contas/' + c.id, 'PATCH', corpo) : fnApi('/api/financas/cc/contas', 'POST', corpo).then(function(r){ FN.ccConta = r.id; });
    return q.then(function(){ FN.cache = {}; fnRender('financas'); }, fnErro);
  } }], { folha: true });
}

/* ======================= CONTAS PARTILHADAS ======================= */
/* Um pagamento (ou vários) dividido com outros: quanto pago eu e a linha de
   cada pessoa, que fica numa conta corrente (no Splitwise ou só no Farol). */
function fn_financas_partilhadas(corpo){
  fnCarregar(corpo, apiGestao('/api/financas/partilhas'), function(d){
    FN.ptEstado = FN.ptEstado || 'aberta';
    var ps = d.partilhas || [];
    var q = (FN.ptQ || '').toLowerCase();
    /* Com quem é a conta: o que faltava para se perceber de relance a que
       conta corrente pertence cada despesa, e para se ver só as de uma. */
    var quem = {};
    ps.forEach(function(p){ p.linhas.forEach(function(l){ if (l.pessoa_id) quem[l.pessoa_id] = l.nome; }); });
    if (FN.ptQuem && !quem[FN.ptQuem]) FN.ptQuem = '';
    var pePt = function(p){ return p.representacao ? (p.representacao.estado || 'adiantado') : ''; };
    var vis = ps.filter(function(p){ return (FN.ptEstado === 'todas' || p.estado === FN.ptEstado) &&
      (!FN.ptQuem || p.linhas.some(function(l){ return String(l.pessoa_id) === String(FN.ptQuem); })) &&
      (!FN.ptPe || (FN.ptPe === 'nenhuma' ? !p.representacao : pePt(p) === FN.ptPe)) &&
      (!q || (p.descricao + ' ' + p.linhas.map(function(l){ return l.nome; }).join(' ')).toLowerCase().indexOf(q) >= 0); });
    var sq = h('select', { class: 'fn-sel', 'aria-label': 'Com quem' }, [h('option', { value: '' }, 'Com toda a gente')]);
    Object.keys(quem).sort(function(a, b){ return quem[a].localeCompare(quem[b]); }).forEach(function(id){
      var n = ps.filter(function(p){ return p.linhas.some(function(l){ return String(l.pessoa_id) === String(id); }); }).length;
      sq.appendChild(h('option', { value: id }, quem[id] + ' · ' + n));
    });
    sq.value = FN.ptQuem || '';
    sq.addEventListener('change', function(){ FN.ptQuem = sq.value; fnRender('financas'); });
    /* Em que pé está a despesa de representação: é por aqui que se vê o que
       já foi apresentado e o que já voltou. */
    var conta = function(k){ return ps.filter(function(p){ return k === 'nenhuma' ? !p.representacao : pePt(p) === k; }).length; };
    var sp = h('select', { class: 'fn-sel', 'aria-label': 'Representação' }, [h('option', { value: '' }, 'Em qualquer pé')]);
    /* Os tres pes do bolso aparecem sempre, mesmo a zero: estavam a sumir
       quando nao havia nenhum e parecia que o filtro nao existia. Os do
       cartao da empresa so aparecem se houver. */
    [['adiantado','Adiantado',1],['apresentado','Apresentado',1],['reembolsado','Reembolsado',1],
     ['registada','Registada',0],['apresentada','Apresentada',0],['nenhuma','Não é representação',0]].forEach(function(o){
      var n = conta(o[0]);
      if (n || o[2]) sp.appendChild(h('option', { value: o[0] }, o[1] + ' · ' + n));
    });
    if (FN.ptPe && ![].slice.call(sp.options).some(function(o){ return o.value === FN.ptPe; })) FN.ptPe = '';
    sp.value = FN.ptPe || '';
    sp.addEventListener('change', function(){ FN.ptPe = sp.value; fnRender('financas'); });
    var procura = h('input', { class: 'fn-in', type: 'search', placeholder: 'Procurar descrição ou pessoa', value: FN.ptQ || '', style: 'max-width:280px' });
    procura.addEventListener('input', function(){ FN.ptQ = procura.value; clearTimeout(FN.ptT); FN.ptT = setTimeout(function(){ fnRender('financas'); setTimeout(function(){ var i = document.querySelector('#fnc-financas input[type=search]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); }, 250); });
    corpo.appendChild(h('div', { class: 'fn-barra' }, [
      fnSegFiltro('ptEstado', [['aberta', 'Por receber'], ['saldada', 'Saldadas'], ['todas', 'Todas']], function(k){ return ps.filter(function(p){ return k === 'todas' || p.estado === k; }).length; }),
      sq, sp, procura, h('span', { class: 'fn-esp' }),
      h('span', { class: 'fn-nota' }, 'Nasce de um pagamento: em Movimentos, abre-o e carrega em «Partilhar a conta…», ou escolhe vários e «Partilhar…».')]));
    /* Com alguém escolhido, os números passam a ser os dele: é o que se quer
       saber («quanto tenho com o Crédito Agrícola»). */
    var base = FN.ptQuem ? ps.filter(function(p){ return p.linhas.some(function(l){ return String(l.pessoa_id) === String(FN.ptQuem); }); }) : ps;
    var soDele = function(p){
      if (!FN.ptQuem) return p.a_receber;
      return p.linhas.filter(function(l){ return String(l.pessoa_id) === String(FN.ptQuem) && l.estado !== 'pago' && l.estado !== 'splitwise'; })
        .reduce(function(t, l){ return t + (l.valor - l.pago); }, 0);
    };
    var receber = base.reduce(function(t, p){ return t + soDele(p); }, 0);
    var nSw = base.reduce(function(t, p){ return t + p.linhas.filter(function(l){ return l.splitwise && (!FN.ptQuem || String(l.pessoa_id) === String(FN.ptQuem)); }).length; }, 0);
    corpo.appendChild(h('div', { class: 'fn-kpis' }, [
      fnKpi('Por receber' + (FN.ptQuem ? ' · ' + quem[FN.ptQuem] : ''), fnEur(receber),
        base.filter(function(p){ return p.estado === 'aberta'; }).length + ' contas em aberto', 'fn-good'),
      fnKpi('Partilhadas', String(base.length), FN.ptQuem ? 'com ' + quem[FN.ptQuem] : 'no total'),
      fnKpi('No Splitwise', String(nSw), nSw === 1 ? 'parte acertada lá' : 'partes acertadas lá')]));
    var cartao = h('div', { class: 'card', style: 'padding:6px 10px' });
    if (!ps.length) { cartao.appendChild(fnVazio('Ainda não há contas partilhadas.', 'Abre um pagamento em Movimentos e carrega em «Partilhar a conta…».')); corpo.appendChild(cartao); return; }
    if (!vis.length) { cartao.appendChild(fnVazio('Nada aqui.', 'Muda o filtro acima.')); corpo.appendChild(cartao); return; }
    var tb = h('tbody');
    vis.forEach(function(p){
      tb.appendChild(h('tr', { class: 'clic', onclick: function(){ fnPartilhaJanela(null, p); } }, [
        h('td', { class: 'fn-n', style: 'font-size:.75rem;white-space:nowrap' }, fnData(p.data)),
        h('td', null, [h('span', { class: 'd' }, p.descricao), h('small', { class: 'd2' }, p.movimentos.length > 1 ? p.movimentos.length + ' pagamentos' : (p.movimentos[0] ? (fnConta(p.movimentos[0].conta_id) || {}).nome || '' : ''))]),
        h('td', { class: 'r' }, fnEur(p.total)),
        h('td', { class: 'r fn-muted' }, fnEur(p.minha)),
        h('td', null, p.linhas.map(function(l){ return fnPillLinha(l); })),
        h('td', null, p.representacao
          ? h('span', { class: 'fn-pill ' + fnRepCor(p.representacao.estado),
              title: 'Despesa de representação de ' + (p.representacao.empresa || '') + ' · ' + (p.representacao.cartao ? 'cartão da empresa' : 'do teu bolso') },
            fnRepNome(p.representacao.estado, p.representacao.cartao))
          : h('span', { class: 'fn-muted', style: 'font-size:.75rem' }, '—')),
        h('td', null, [h('span', { class: 'fn-pill ' + (p.estado === 'aberta' ? 'warn' : 'good') }, p.estado === 'aberta' ? 'falta ' + fnEur(p.a_receber) : 'saldada'),
          /* Dizer que já foi reembolsada é uma coisa; ligar a entrada que a
             saldou é outra. Enquanto não se ligar, diz-se o que falta fazer. */
          p.representacao && p.representacao.estado === 'reembolsado' && p.estado === 'aberta'
            ? h('small', { class: 'fn-muted', style: 'display:block' }, 'dizes que já recebeste — falta ligar a entrada') : null])
      ]));
    });
    cartao.appendChild(h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab', style: 'min-width:940px' }, [
      h('thead', null, [h('tr', null, [h('th', null, 'Data'), h('th', null, 'Descrição'), h('th', { class: 'r' }, 'Total'), h('th', { class: 'r' }, 'Eu pago'), h('th', null, 'Pessoas'), h('th', null, 'Representação'), h('th', null, 'Estado')])]), tb])]));
    corpo.appendChild(cartao);
  });
}
/* O nome inteiro, não só o primeiro: «Crédito» não diz se é o Crédito
   Agrícola ou um crédito qualquer. A conta corrente vai no título e, quando
   não é a própria pessoa, também à vista. */
function fnPillLinha(l){
  var cls = l.estado === 'pago' ? ' good' : l.estado === 'splitwise' ? ' tr' : l.estado === 'parcial' ? ' warn' : '';
  var cc = l.conta && l.conta !== l.nome ? l.conta : '';
  return h('span', { class: 'fn-pill' + cls, style: 'margin:1px',
    title: l.nome + ' · ' + fnEur(l.valor) + (l.conta ? ' · conta corrente: ' + l.conta : '') + ' · ' +
      (l.estado === 'splitwise' ? 'no Splitwise' : l.estado + (l.pago > 0.005 && l.estado !== 'pago' ? ', pagou ' + fnEur(l.pago) : '')) },
    (l.splitwise ? 'SW · ' : '') + l.nome + (cc ? ' (' + cc + ')' : '') + ' ' + fnEur(l.valor));
}
function fnAbrirPartilha(id){
  apiGestao('/api/financas/partilhas/' + id).then(function(r){ fnPartilhaJanela(null, r.partilha); }, fnErro);
}

/* A janela da conta partilhada (como no Buxfer): quanto pago eu, e uma linha
   por pessoa com o valor e a conta corrente onde fica. Em partes iguais, o
   que eu não pago reparte-se pelas linhas. */
function fnPartilhaJanela(movs, partilha){
  apiGestao('/api/financas/cc').then(function(cc){ fnPartilhaAbrir(movs, partilha, cc); }, fnErro);
}
/* As contas onde fica a parte de uma pessoa: só no Farol, uma conta do Farol
   onde ela está, ou uma conta do Splitwise (um grupo, ou sem grupo). */
function fnOpcoesContaCc(cc, sel, p, valor){
  clear(sel);
  sel.appendChild(h('option', { value: 'f' }, 'Só no Farol'));
  (cc.contas || []).filter(function(c){ return c.ativo && !c.direta && !c.grupo && p && c.membros.some(function(m){ return m.pessoa_id === p.id; }); }).forEach(function(c){
    sel.appendChild(h('option', { value: 'c:' + c.id }, 'Farol · ' + c.nome));
  });
  if (p && p.splitwise_id) {
    (cc.contas || []).filter(function(c){ return c.tipo === 'splitwise' && c.membros.some(function(m){ return m.pessoa_id === p.id; }); }).forEach(function(c){
      sel.appendChild(h('option', { value: 's:' + c.id }, 'Splitwise · ' + (c.grupo ? c.nome : 'sem grupo')));
    });
  }
  if (valor && [].some.call(sel.options, function(o){ return o.value === valor; })) sel.value = valor;
}
/* O valor escolhido numa dessas listas, para mandar ao servidor. */
function fnContaEscolhida(v){
  if (!v || v === 'f') return {};
  if (v.charAt(0) === 's') return { conta_id: Number(v.slice(2)), splitwise: true };
  return { conta_id: Number(v.slice(2)) };
}
/* O saldo de uma pessoa numa conta corrente (para se ver, ao escolher). */
function fnSaldoNaConta(cc, p, v){
  if (!p) return null;
  var conta = null;
  if (!v || v === 'f') conta = (cc.contas || []).filter(function(c){ return c.pessoa_direta_id === p.id; })[0];
  else conta = (cc.contas || []).filter(function(c){ return c.id === Number(v.slice(2)); })[0];
  var mb = conta ? conta.membros.filter(function(x){ return x.pessoa_id === p.id; })[0] : null;
  if (!mb) return null;
  return v && v.charAt(0) === 's' ? mb.saldo_splitwise : (!v || v === 'f' ? mb.saldo_farol : mb.saldo);
}

/* A janela da despesa partilhada (como no Splitwise): quem entra, eu
   incluído, e como se divide - partes iguais, valores, percentagens,
   porções ou ajustes. Atalhos: tudo eu, 50/50, tudo de outra pessoa. */
function fnPartilhaAbrir(movs, partilha, cc){
  movs = partilha ? partilha.movimentos : movs;
  var total = Math.round(movs.reduce(function(s, m){ return s - m.valor; }, 0) * 100) / 100;
  var T = Math.round(total * 100);
  var pessoas = cc.pessoas.filter(function(p){ return p.ativo; });
  var porNome = function(n){ n = String(n || '').trim().toLowerCase(); return pessoas.filter(function(p){ return p.nome.toLowerCase() === n; })[0]; };
  var num = function(v){ var n = Number(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  var txt = function(v){ return (Math.round(v * 100) / 100).toFixed(2).replace('.', ','); };
  var m0 = movs[0] || {};
  var metodo = partilha ? (partilha.metodo === 'amigo' ? 'valores' : partilha.metodo || 'valores') : 'iguais';
  var ent = (partilha && partilha.entradas) || { p: {} };
  var desc = h('input', { class: 'fn-in', value: partilha ? partilha.descricao : (movs.length === 1 ? fnMovNome(m0) : ''), placeholder: movs.length > 1 ? 'Ex.: Ubers do fim de semana' : '' });
  var catSel = fnSelCategorias((partilha && partilha.categoria_id) || m0.categoria_id || m0.ia_categoria_id || '', '— categoria da minha parte —', 'despesa');
  var linhas = h('div', { class: 'fn-pt-linhas' });
  var lista = h('datalist', { id: 'fn-dl-pt' }, pessoas.map(function(p){ return h('option', { value: p.nome }); }));
  var resumo = h('p', { class: 'fn-nota', style: 'margin:4px 0' });
  var seg = h('div', { class: 'fn-seg', role: 'group', 'aria-label': 'Como dividir' });
  var METODOS = [['iguais', '= Partes iguais'], ['valores', '1,23 Valores'], ['percent', '% Percentagens'], ['porcoes', 'Porções'], ['ajustes', '+/− Ajustes']];
  var DICA = { iguais: 'Divide em partes iguais por quem está marcado.', valores: 'Escreve quanto é de cada um.', percent: 'Escreve a percentagem de cada um (somam 100).',
    porcoes: 'Escreve as porções de cada um (ex.: 2 para um casal, 1 para os outros).', ajustes: 'Partes iguais, mais ou menos o que escreveres em cada um.' };
  var dica = h('small', { class: 'fn-muted', style: 'display:block;margin:4px 0' });

  /* Uma linha: eu, ou uma pessoa. */
  function linha(o){
    var eu = !!o.eu;
    var on = h('input', { type: 'checkbox', checked: o.on !== false, 'aria-label': 'Entra na divisão' });
    var ni = eu ? h('b', { style: 'flex:2 1 150px;font-weight:500' }, 'Eu') : h('input', { class: 'fn-in fn-pt-n', list: 'fn-dl-pt', value: o.nome || '', placeholder: 'Nome da pessoa nova', style: 'flex:1 1 auto' });
    /* Quem entra escolhe-se das pessoas do Farol (Finanças › Pessoas); uma
       pessoa nova escreve-se à mão e fica criada ao guardar. */
    var psel = null, quem = ni;
    if (!eu) {
      var nomes = pessoas.map(function(x){ return x.nome; });
      psel = h('select', { class: 'fn-sel fn-pt-p', style: 'flex:1 1 auto' }, [h('option', { value: '' }, '— escolhe a pessoa —')]
        .concat(pessoas.slice().sort(function(a, b){ return a.nome.localeCompare(b.nome); }).map(function(x){ return h('option', { value: x.nome }, x.nome + (x.splitwise_id ? '' : ' · só no Farol')); }))
        .concat(o.nome && nomes.indexOf(o.nome) < 0 ? [h('option', { value: o.nome }, o.nome)] : [])
        .concat([h('option', { value: '__nova' }, 'Outra pessoa (nova)…')]));
      psel.value = o.nome || '';
      ni.style.display = 'none';
      psel.addEventListener('change', function(){
        if (psel.value === '__nova') { ni.value = ''; ni.style.display = ''; ni.focus(); }
        else { ni.style.display = 'none'; ni.value = psel.value; }
        ni.dispatchEvent(new Event('change'));
      });
      quem = h('div', { style: 'flex:2 1 150px;display:flex;flex-direction:column;gap:4px;min-width:0' }, [psel, ni]);
    }
    var ei = h('input', { class: 'fn-in fn-pt-e', inputmode: 'decimal', value: o.entrada != null ? String(o.entrada).replace('.', ',') : '', style: 'flex:0 1 84px;min-width:64px' });
    var cs = eu ? h('span', { style: 'flex:2 1 160px' }) : h('select', { class: 'fn-sel fn-pt-c', style: 'flex:2 1 160px' });
    var vd = h('b', { class: 'fn-n', style: 'flex:0 0 92px;text-align:right;font-weight:500' });
    var est = h('small', { class: 'fn-muted', style: 'flex:1 1 100%;margin:-2px 0 2px 26px' });
    /* Numa conta do Splitwise: escolher a despesa que já lá está para esta linha. */
    var swb = eu ? null : h('button', { type: 'button', class: 'btn small', style: 'flex:0 0 auto' }, 'Já lá está…');
    var swInfo = eu ? null : h('small', { class: 'fn-muted', style: 'flex:1 1 100%;margin:-2px 0 2px 26px' });
    var mostrarSw = function(){
      if (eu) return;
      var naSw = String(cs.value || '').charAt(0) === 's';
      swb.style.display = naSw ? '' : 'none';
      if (!naSw) { row._sw = null; swInfo.textContent = ''; }
      else if (row._sw) swInfo.textContent = 'Liga a «' + row._sw.descricao + '» (' + fnData(row._sw.data) + ', ' + fnEur(row._sw.valor) + ') — no Splitwise não se cria nada.';
      else if (!(o.l && o.l.splitwise_despesa)) swInfo.textContent = 'Ao guardar, o Farol cria esta despesa no Splitwise (paga por ti, esta parte para esta pessoa) e fica ligada — a não ser que lá encontre uma igual. Se já lá está, usa «Já lá está…».';
      else swInfo.textContent = '';
    };
    if (!eu) {
      opcoesConta(cs, porNome(ni.value), o.contaValor || 'f');
      ni.addEventListener('change', function(){ opcoesConta(cs, porNome(ni.value), cs.value); mostrarSw(); });
      cs.addEventListener('change', function(){ row._sw = null; mostrarSw(); });
      swb.addEventListener('click', function(){
        var v = calcular(), rs = rows(), soma = 0;
        rs.forEach(function(r, i){ if (!r._eu && r._cs.value === cs.value) soma += v[i]; });
        fnSwDespesasJanela(m0, null, null, { conta_id: Number(cs.value.slice(2)), valor: soma / 100, escolher: function(d){
          /* A divisão desta linha passa a ser a da despesa escolhida (ex.: a
             Mónica com metade de 23,34 €), e a parte que sobra é a minha. */
          mudarMetodo('valores');
          var rs2 = rows(), daqui = rs2.filter(function(r){ return !r._eu && r._cs.value === cs.value; });
          var outrosD = d.pessoas.filter(function(x){ return !x.eu; });
          daqui.forEach(function(r){
            var nm = r._ni.value.trim().toLowerCase();
            var x = outrosD.filter(function(y){ return String(y.nome || '').toLowerCase() === nm; })[0] || (daqui.length === 1 && outrosD.length === 1 ? outrosD[0] : null);
            var val = x ? x.deve : (daqui.length === 1 ? d.outros : null);
            if (val != null) { r._ei.value = txt(val); r._on.checked = true; }
            r._sw = { id: d.id, descricao: d.descricao, data: d.data, valor: val != null ? val : d.outros };
            r._mostrarSw();
          });
          var euR = rs2.filter(function(r){ return r._eu; })[0];
          if (euR) {
            var outrosC = rs2.filter(function(r){ return !r._eu && r._on.checked; }).reduce(function(t, r){ return t + Math.round(num(r._ei.value) * 100); }, 0);
            euR._on.checked = true; euR._ei.value = txt(Math.max(0, T - outrosC) / 100);
          }
          atualizar();
        } });
      });
      if (o.l && o.l.splitwise_despesa) est.textContent = o.l.splitwise_despesa.criada ? 'Despesa criada pelo Farol no Splitwise.' : 'Ligada a uma despesa que já estava no Splitwise.';
      else if (o.l && o.l.estado && o.l.estado !== 'splitwise') est.textContent = o.l.estado === 'pago' ? 'Já pagou.' : o.l.estado === 'parcial' ? 'Pagou ' + fnEur(o.l.pago) + '.' : 'Ainda não pagou.';
    }
    on.addEventListener('change', atualizar);
    ei.addEventListener('input', atualizar);
    var row = h('div', { class: 'fn-acoes fn-pt-l', style: 'margin-bottom:4px;flex-wrap:wrap;align-items:center' }, [on, quem, ei, cs, swb, vd,
      eu ? h('span', { style: 'width:30px' }) : h('button', { type: 'button', class: 'btn small', 'aria-label': 'Tirar', onclick: function(){ row.parentNode.removeChild(row); atualizar(); } }, '×'),
      est.textContent ? est : null, swInfo]);
    row._eu = eu; row._on = on; row._ni = ni; row._ei = ei; row._cs = cs; row._vd = vd; row._sw = null; row._mostrarSw = mostrarSw;
    mostrarSw();
    linhas.appendChild(row);
    return row;
  }
  function opcoesConta(sel, p, valor){ fnOpcoesContaCc(cc, sel, p, valor); }
  function rows(){ return [].slice.call(linhas.querySelectorAll('.fn-pt-l')); }
  /* Reparte c cêntimos por pesos, os que sobram para as maiores frações. */
  function repartir(c, pesos){
    var soma = pesos.reduce(function(t, x){ return t + x; }, 0);
    if (!(soma > 0)) return pesos.map(function(){ return 0; });
    var brutos = pesos.map(function(x){ return c * x / soma; });
    var out = brutos.map(Math.floor);
    var falta = c - out.reduce(function(t, x){ return t + x; }, 0);
    brutos.map(function(x, i){ return [x - Math.floor(x), i]; }).sort(function(a, b){ return b[0] - a[0]; }).forEach(function(z){ if (falta > 0) { out[z[1]]++; falta--; } });
    return out;
  }
  /* Quanto é de cada um, em cêntimos. */
  function calcular(){
    var rs = rows(), on = rs.map(function(r){ return r._on.checked; });
    var e = rs.map(function(r){ return num(r._ei.value); });
    var v = rs.map(function(){ return 0; });
    var idx = rs.map(function(r, i){ return i; }).filter(function(i){ return on[i]; });
    if (metodo === 'iguais') { var p = repartir(T, idx.map(function(){ return 1; })); idx.forEach(function(i, k){ v[i] = p[k]; }); }
    else if (metodo === 'valores') idx.forEach(function(i){ v[i] = Math.round(e[i] * 100); });
    else if (metodo === 'percent') {
      var sp = idx.reduce(function(t, i){ return t + e[i]; }, 0);
      if (Math.abs(sp - 100) < 0.001) { var pp = repartir(T, idx.map(function(i){ return e[i]; })); idx.forEach(function(i, k){ v[i] = pp[k]; }); }
      else idx.forEach(function(i){ v[i] = Math.round(T * e[i] / 100); });
    } else if (metodo === 'porcoes') { var ps = repartir(T, idx.map(function(i){ return Math.max(0, e[i]); })); idx.forEach(function(i, k){ v[i] = ps[k]; }); }
    else if (metodo === 'ajustes') {
      var aj = idx.map(function(i){ return Math.round(e[i] * 100); });
      var base = repartir(T - aj.reduce(function(t, x){ return t + x; }, 0), idx.map(function(){ return 1; }));
      idx.forEach(function(i, k){ v[i] = base[k] + aj[k]; });
    }
    return v;
  }
  function atualizar(){
    clear(seg);
    METODOS.forEach(function(o){ seg.appendChild(h('button', { type: 'button', class: metodo === o[0] ? 'on' : '', onclick: function(){ mudarMetodo(o[0]); } }, o[1])); });
    dica.textContent = DICA[metodo];
    var rs = rows(), v = calcular();
    rs.forEach(function(r, i){
      r._ei.style.display = metodo === 'iguais' ? 'none' : '';
      r._ei.placeholder = metodo === 'percent' ? '%' : metodo === 'porcoes' ? 'porções' : metodo === 'ajustes' ? '+/− €' : '0,00';
      r._vd.textContent = r._on.checked ? fnEur(v[i] / 100) : '—';
      r.style.opacity = r._on.checked ? '' : '.55';
    });
    var soma = v.reduce(function(t, x){ return t + x; }, 0);
    var eu = rs.filter(function(r){ return r._eu; })[0];
    var minha = eu ? v[rs.indexOf(eu)] : 0;
    var falta = T - soma;
    var extra = metodo === 'percent' ? ' · ' + rs.filter(function(r){ return r._on.checked; }).reduce(function(t, r){ return t + num(r._ei.value); }, 0).toFixed(1).replace('.', ',') + '%' : '';
    resumo.textContent = 'Total ' + fnEur(total) + ' · eu ' + fnEur(minha / 100) + ' · os outros ' + fnEur((soma - minha) / 100) + extra +
      (falta ? (falta > 0 ? ' · faltam ' + fnEur(falta / 100) + ' por distribuir' : ' · passa ' + fnEur(-falta / 100) + ' do total') : ' · certo.');
    resumo.style.color = falta ? 'var(--bad)' : '';
  }
  /* Ao mudar de método, as entradas partem do que está dividido agora. */
  function mudarMetodo(novo){
    var rs = rows(), v = calcular();
    var on = rs.filter(function(r){ return r._on.checked; });
    rs.forEach(function(r, i){
      if (novo === 'valores') r._ei.value = r._on.checked ? txt(v[i] / 100) : '';
      else if (novo === 'percent') r._ei.value = r._on.checked && T ? String(Math.round(v[i] / T * 1000) / 10).replace('.', ',') : '';
      else if (novo === 'porcoes') r._ei.value = r._on.checked ? '1' : '';
      else if (novo === 'ajustes') r._ei.value = r._on.checked ? '0' : '';
    });
    if (novo === 'percent' && on.length) {
      var s = on.reduce(function(t, r){ return t + num(r._ei.value); }, 0);
      if (Math.abs(s - 100) > 0.001) on[on.length - 1]._ei.value = String(Math.round((num(on[on.length - 1]._ei.value) + 100 - s) * 10) / 10).replace('.', ',');
    }
    metodo = novo;
    atualizar();
  }
  /* Atalhos. */
  function tudoEu(){
    rows().forEach(function(r){ r._on.checked = r._eu; });
    metodo = 'iguais'; atualizar();
  }
  function meias(){
    var rs = rows(), primeira = rs.filter(function(r){ return !r._eu; })[0];
    if (!primeira) primeira = linha({});
    rows().forEach(function(r){ r._on.checked = r._eu || r === primeira; });
    metodo = 'iguais'; atualizar();
  }
  function tudoOutro(){
    var rs = rows(), primeira = rs.filter(function(r){ return !r._eu; })[0];
    if (!primeira) primeira = linha({});
    rows().forEach(function(r){ r._on.checked = r === primeira; });
    metodo = 'iguais'; atualizar();
  }

  /* As linhas de partida. */
  var minhaE = ent.eu != null ? ent.eu : (metodo === 'valores' && partilha ? partilha.minha : null);
  linha({ eu: true, on: partilha ? (partilha.minha > 0.005 || ent.eu != null) : true, entrada: minhaE });
  if (partilha && partilha.linhas.length) partilha.linhas.forEach(function(l){
    var contaValor = l.splitwise ? 's:' + l.conta_id : (cc.contas || []).some(function(c){ return c.id === l.conta_id && !c.direta && !c.grupo; }) ? 'c:' + l.conta_id : 'f';
    linha({ nome: l.nome, contaValor: contaValor, l: l, entrada: ent.p && ent.p[l.pessoa_id] != null ? ent.p[l.pessoa_id] : (metodo === 'valores' ? l.valor : null) });
  });
  else linha({});
  if (metodo === 'valores') rows().forEach(function(r){ if (r._ei.value) r._ei.value = txt(num(r._ei.value)); });

  var lst = movs.length > 1 ? h('div', { class: 'fn-lista', style: 'max-height:130px;overflow:auto;margin-bottom:6px' }, movs.map(function(m){
    return h('div', { class: 'fn-li' }, [h('span', { class: 'fn-n fn-muted', style: 'width:52px;font-size:.75rem' }, fnData(m.data)), h('div', { class: 'g' }, fnMovNome(m)), h('span', { class: 'fn-n' }, fnEur(-m.valor))]);
  })) : null;
  var botoes = [{ txt: 'Guardar', pri: true, fn: function(){
    var rs = rows(), v = calcular();
    if (v.reduce(function(t, x){ return t + x; }, 0) !== T) { fnAviso('As partes têm de somar ' + fnEur(total) + '.'); return false; }
    var ls = [], erro = '', minha = 0, entEu = null;
    rs.forEach(function(r, i){
      if (r._eu) { minha = v[i] / 100; entEu = r._on.checked && metodo !== 'iguais' && metodo !== 'valores' ? num(r._ei.value) : null; return; }
      var n = r._ni.value.trim();
      if (!n && !v[i]) return;
      if (!n) { erro = 'Falta o nome numa linha.'; return; }
      if (!(v[i] > 0)) return;
      var p = porNome(n);
      var l = Object.assign(p ? { pessoa_id: p.id } : { nome: n }, { valor: v[i] / 100, entrada: metodo === 'iguais' || metodo === 'valores' ? null : num(r._ei.value) }, fnContaEscolhida(r._cs.value));
      ls.push(l);
    });
    if (erro) { fnAviso(erro); return false; }
    var existente = {};
    rs.forEach(function(r){ if (!r._eu && r._sw && String(r._cs.value).charAt(0) === 's') existente[r._cs.value.slice(2)] = r._sw.id; });
    var corpo = { movimentos: movs.map(function(m){ return m.id; }), descricao: desc.value.trim(), minha: minha, iguais: metodo === 'iguais', metodo: metodo, entrada_eu: entEu,
      categoria_id: catSel.value ? Number(catSel.value) : null, linhas: ls, splitwise_existente: Object.keys(existente).length ? existente : undefined };
    var q = partilha ? fnApi('/api/financas/partilhas/' + partilha.id, 'PUT', corpo) : fnApi('/api/financas/partilhas', 'POST', corpo);
    return q.then(function(r){ fnAvisoPartilha(r); FN.mov.sel = {}; fnMudou(); }, fnErro);
  } }];
  if (partilha) botoes.push({ txt: 'Desfazer', fn: function(){
    return fnApi('/api/financas/partilhas/' + partilha.id, 'DELETE').then(function(r){
      var s = r.splitwise || {};
      fnAviso('Conta partilhada desfeita' + (s.apagadas ? '; a despesa que o Farol tinha posto no Splitwise foi apagada.' : '.'));
      fnMudou();
    }, fnErro);
  } });
  var jp = fnJanela(partilha ? 'Despesa partilhada' : 'Despesa partilhada · ' + (movs.length > 1 ? movs.length + ' pagamentos' : 'dividir'), [
    lst,
    h('p', { class: 'fn-nota' }, (movs.length === 1 ? fnMovNome(m0) + ' · ' + fnData(m0.data) + ' · ' : '') + 'pagaste ' + fnEur(total) + '.'),
    fnCampo('Descrição', desc),
    h('div', { class: 'fn-acoes', style: 'flex-wrap:wrap;gap:6px;margin:4px 0' }, [h('span', { class: 'fn-muted', style: 'font-size:.8125rem' }, 'Atalhos:'),
      fnBtn('Tudo eu (100%)', tudoEu, 'small'), fnBtn('50/50', meias, 'small'), fnBtn('Tudo de outra pessoa', tudoOutro, 'small'),
      movs.length && movs.every(function(x){ return x.valor < 0; }) ? fnBtn('Já está no Splitwise…', function(){ fnSwDespesasJanela(m0, catSel.value, function(){ jp.fechar(); }, { movs: movs }); }, 'small') : null]),
    seg, dica,
    h('div', { class: 'mono', style: 'margin-top:6px' }, 'Quem entra e quanto'), lista, linhas,
    h('div', { class: 'fn-acoes' }, [fnBtn('+ Pessoa', function(){ linha({}); if (metodo === 'porcoes') rows()[rows().length - 1]._ei.value = '1'; if (metodo === 'ajustes') rows()[rows().length - 1]._ei.value = '0'; atualizar(); }, 'small')]),
    resumo,
    fnCampo('A minha parte vai para', catSel),
    h('p', { class: 'fn-nota' }, 'A conta de cada pessoa: «Só no Farol» fica na conta corrente dela aqui, e o reembolso liga-se quando chegar ao banco. Numa conta do Splitwise, o Farol lança lá a despesa, mas primeiro procura se já lá está (mesmo valor, mesmas pessoas, perto da data) e, se estiver, só a liga. Para escolheres tu a que já lá está, carrega em «Já lá está…» na linha (cada linha pode ir para uma despesa diferente).')
  ], botoes, { folha: true, largo: true });
  var mods = document.querySelectorAll('.fn-mod'); if (mods.length) mods[mods.length - 1].classList.add('largo');
  atualizar();
}
/* Escolher a despesa que já está no Splitwise: a divisão vem de lá (quem
   pagou, a parte de cada um) e o Farol só a liga, não cria outra. */
function fnSwDespesasJanela(m, categoria, fecharPai, o){
  o = o || {};
  /* Vários pagamentos para uma despesa só do Splitwise (ex.: as poupanças
     da Sofia e da Maria, 50 + 50 numa despesa de 100). */
  var movs = o.movs && o.movs.length ? o.movs : [m];
  var tot = Math.round(movs.reduce(function(t, x){ return t - x.valor; }, 0) * 100) / 100;
  var q = h('input', { class: 'fn-in', placeholder: 'Procurar pela descrição no Splitwise' });
  var lista = h('div', { class: 'fn-lista', style: 'max-height:58vh;overflow:auto' }, [h('p', { class: 'fn-nota' }, 'A ler o Splitwise…')]);
  var j;
  var cartao = function(d, i){
    var eu = d.pessoas.filter(function(x){ return x.eu; })[0];
    var pode = d.igual && !d.usada;
    return h('div', { class: 'fn-caixa' + (pode && i === 0 ? ' melhor' : ''), style: 'margin-bottom:6px' + (pode ? '' : ';opacity:.65') }, [
      h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('b', null, d.descricao), h('b', { class: 'fn-n' }, fnEur(d.total))]),
      h('small', { class: 'fn-muted' }, [fnData(d.data) + (d.dias ? ' (' + (d.dias > 0 ? '+' : '') + d.dias + ' d)' : ' (mesmo dia)'), d.grupo_nome,
        d.pessoas.map(function(x){ return x.nome + (x.pagou > 0.005 ? ' pagou ' + fnEur(x.pagou) + ',' : '') + ' parte ' + fnEur(x.deve); }).join(' · ')].join(' · ')),
      !d.igual ? h('small', { class: 'fn-muted', style: 'display:block' }, o.escolher ? 'Não bate com a linha (' + fnEur(o.valor) + ': a parte dos outros ou o total).' : 'Valor diferente do movimento (' + fnEur(tot) + ').')
        : d.usada ? h('small', { class: 'fn-muted', style: 'display:block' }, 'Já ligada a outro movimento.')
        : !o.escolher && eu && eu.pagou < d.total - 0.005 ? h('small', { class: 'fn-muted', style: 'display:block' }, 'No Splitwise não foste tu a pagar tudo — confirma que é esta.') : null,
      pode ? h('div', { class: 'fn-acoes' }, [fnBtn(o.escolher ? 'Usar esta' : 'Ligar a esta', function(){
        if (o.escolher) { o.escolher(d); j.fechar(); return; }
        fnApi('/api/financas/movimentos/' + m.id + '/partilha-splitwise', 'POST', { expense_id: d.id, categoria_id: categoria ? Number(categoria) : null, movimentos: movs.map(function(x){ return x.id; }) }).then(function(x){
          j.fechar(); if (fecharPai) fecharPai();
          fnAviso('Ligado à despesa do Splitwise: tu ' + fnEur(x.minha) + ', os outros ' + fnEur(x.outros) + '. No Splitwise não se criou nada.');
          FN.mov.sel = {}; fnMudou();
        }, fnErro);
      }, (i === 0 ? 'primary ' : '') + 'small')]) : null]);
  };
  var vez = 0;
  var ler = function(){
    var n = ++vez;
    lista.style.opacity = '.5';
    apiGestao('/api/financas/movimentos/' + m.id + '/splitwise-despesas?' + fnQs({ q: q.value.trim(), conta_id: o.conta_id || '', valor: o.valor != null ? o.valor : '', total: movs.length > 1 ? tot : '' })).then(function(r){
      if (n !== vez) return;
      lista.style.opacity = '';
      clear(lista);
      if (!r.despesas.length) lista.appendChild(h('p', { class: 'fn-nota' }, 'Nenhuma despesa no Splitwise entre 30 dias antes e 30 dias depois' + (q.value.trim() ? ' com esse texto' : '') + '.'));
      r.despesas.forEach(function(d, i){ lista.appendChild(cartao(d, i)); });
    }, function(e){ lista.style.opacity = ''; clear(lista); lista.appendChild(h('p', { class: 'fn-nota' }, e.message)); });
  };
  var espera;
  q.addEventListener('input', function(){ clearTimeout(espera); espera = setTimeout(ler, 350); });
  j = fnJanela('Já está no Splitwise', [
    h('p', { class: 'fn-nota' }, o.escolher
      ? 'Só as despesas desta conta do Splitwise. A linha tem ' + fnEur(o.valor) + ': bate a que tem essa parte dos outros (ou esse total). Ao guardar, esta linha liga-se a ela e no Splitwise não se cria nada.'
      : (movs.length > 1 ? movs.length + ' pagamentos · ' : fnMovNome(m) + ' · ' + fnData(m.data) + ' · ') + fnEur(tot) + '. Escolhe a despesa do Splitwise: as pessoas e as partes vêm de lá. Primeiro as do mesmo valor.'),
    q, lista], []);
  var mods = document.querySelectorAll('.fn-mod'); if (mods.length) mods[mods.length - 1].classList.add('largo');
  ler();
}
function fnAvisoPartilha(r){
  var s = r.splitwise || {}, extra = [];
  if (s.criadas) extra.push(s.criadas + (s.criadas === 1 ? ' despesa criada' : ' despesas criadas') + ' no Splitwise');
  if (s.existentes) extra.push(s.existentes + (s.existentes === 1 ? ' já estava no Splitwise (ligada, não duplicada)' : ' já estavam no Splitwise (ligadas, não duplicadas)'));
  if (s.atualizadas) extra.push(s.atualizadas + ' atualizada(s) no Splitwise');
  if (s.apagadas) extra.push(s.apagadas + ' apagada(s) no Splitwise');
  fnAviso('Guardado: eu pago ' + fnEur(r.minha) + ', os outros ' + fnEur(r.outros) + (extra.length ? ' · ' + extra.join(' · ') : '') + '.');
  if (s.erros && s.erros.length) setTimeout(function(){ fnAviso('Splitwise: ' + s.erros.join(' · ')); }, 2500);
}

/* Despesas de representação: o Marco adianta do bolso dele e a empresa
 * devolve. Cada movimento fica 100% a cargo da empresa — a conta corrente
 * dela passa a dizer quanto lhe é devido, a categoria real do gasto
 * mantém-se (almoços de equipa, lavagens) e, porque o movimento fica
 * dividido, deixa de contar como gasto dele nos orçamentos e na análise.
 *
 * Não há pisco de «é profissional»: ter uma empresa a dever é que o diz,
 * e assim nunca pode estar em desacordo com ela própria. */
var FN_REP_BOLSO = [['adiantado', 'Adiantado', 'Pagaste, ainda não apresentaste.'],
                    ['apresentado', 'Apresentado', 'Já entregaste as despesas; falta receber.'],
                    ['reembolsado', 'Reembolsado', 'Já te devolveram.']];
var FN_REP_CARTAO = [['registada', 'Registada', 'Está no cartão da empresa, ainda não a apresentaste.'],
                     ['apresentada', 'Apresentada', 'Já a entregaste à empresa.']];
function fnRepPes(cartao){ return cartao ? FN_REP_CARTAO : FN_REP_BOLSO; }
function fnRepNome(e, cartao){
  var o = fnRepPes(cartao).filter(function(x){ return x[0] === e; })[0];
  return o ? o[1] : fnRepPes(cartao)[0][1];
}
/* Fechado é verde, a meio é lilás, por fazer é laranja. */
function fnRepCor(e){ return e === 'reembolsado' ? 'good' : (e === 'apresentado' || e === 'apresentada') ? 'tr' : 'warn'; }

function fnReembolsarJanela(movs){
  movs = (movs || []).filter(function(m){ return Number(m.valor) < 0; });
  if (!movs.length) { fnAviso('Só entram pagamentos que saíram da conta.'); return; }
  var total = movs.reduce(function(t, m){ return t + Math.abs(Number(m.valor)); }, 0);
  apiGestao('/api/financas/cc').then(function(cc){
    var empresas = (cc.pessoas || []).filter(function(p){ return p.empresa && p.ativo; });
    var se = h('select', { class: 'fn-sel' });
    empresas.forEach(function(e){ se.appendChild(h('option', { value: String(e.id) }, e.nome)); });
    se.appendChild(h('option', { value: 'nova' }, '+ Nova empresa…'));
    var nova = h('input', { class: 'fn-in', placeholder: 'Nome da empresa', style: 'display:none;margin-top:6px' });
    if (!empresas.length) { se.value = 'nova'; nova.style.display = ''; }

    var st = h('select', { class: 'fn-sel' });
    var dica = h('small', { class: 'fn-muted', style: 'display:block;margin-top:4px' });
    var quem = h('p', { class: 'fn-nota' });

    /* Quem pagou não se escolhe: lê-se da conta de onde o movimento saiu. Se
       a conta é da empresa escolhida, foi o cartão dela; senão, foi do bolso
       dele — e é isso que decide os pés possíveis. */
    var doCartao = function(){
      var id = Number(se.value);
      if (!id) return 0;
      return movs.filter(function(m){ var c = fnConta(m.conta_id); return c && Number(c.empresa_id) === id; }).length;
    };
    var acertar = function(){
      nova.style.display = se.value === 'nova' ? '' : 'none';
      var n = doCartao(), bolso = movs.length - n;
      var cartao = n > 0 && bolso === 0;
      var pes = fnRepPes(cartao);
      clear(st);
      pes.forEach(function(o){ st.appendChild(h('option', { value: o[0] }, o[1])); });
      dica.textContent = pes[0][2];
      quem.textContent = (movs.length > 1 ? movs.length + ' pagamentos · ' : fnMovNome(movs[0]) + ' · ') + fnEur(total) + '. ' +
        (n && bolso ? n + ' do cartão da empresa e ' + bolso + ' do teu bolso — cada um segue o seu caminho.'
         : cartao ? 'Saiu do cartão da empresa: fica só registada para apresentares, não há nada a receber.'
         : 'Saiu do teu bolso: fica na conta corrente da empresa e deixa de contar como gasto teu.');
    };
    se.addEventListener('change', function(){ acertar(); if (se.value === 'nova') nova.focus(); });
    st.addEventListener('change', function(){
      var o = [].slice.call(st.options).filter(function(x){ return x.value === st.value; })[0];
      var pes = fnRepPes(doCartao() === movs.length && movs.length > 0);
      var d = pes.filter(function(y){ return y[0] === st.value; })[0];
      dica.textContent = d ? d[2] : '';
      if (!o) return;
    });
    acertar();

    var manda = function(empresaId){
      return fnApi('/api/financas/movimentos/reembolsar', 'POST',
        { ids: movs.map(function(m){ return m.id; }), empresa_id: empresaId, estado: st.value }).then(function(r){
        fnAviso(r.feitos + (r.feitos === 1 ? ' despesa' : ' despesas') + ' de representação · ' + fnEur(total) +
          (r.bolso && r.cartao ? ' (' + r.bolso + ' do bolso, ' + r.cartao + ' do cartão)' : '') + '.');
        fnMudou();
      }, fnErro);
    };

    fnJanela(movs.length > 1 ? 'Representação · ' + movs.length + ' movimentos' : 'Despesa de representação', [
      quem, fnCampo('Empresa', se), nova,
      fnCampo('Em que pé está', st), dica,
      h('small', { class: 'fn-muted', style: 'display:block;margin-top:8px' },
        'Para mudar o pé de várias de uma vez, escolhe-as na lista e volta aqui com o pé novo.')
    ], [{ txt: 'Guardar', pri: true, fn: function(){
      if (se.value !== 'nova') return manda(Number(se.value));
      var n = nova.value.trim();
      if (!n) { fnAviso('Falta o nome da empresa.'); return false; }
      return fnApi('/api/financas/cc/pessoas', 'POST', { nome: n, tipo: 'empresa' })
        .then(function(r){ return manda(Number(r.id)); }, fnErro);
    } }]);
  }, fnErro);
}

/* Paguei por alguém: a conta é toda dessa pessoa, fica a dever-ma.
 *
 * Numa conta do Splitwise a despesa costuma já lá estar - foi lançada por
 * quem a dividiu. Por isso, mal se escolhe a conta, mostram-se aqui as
 * despesas de lá que dá para ligar, com as do mesmo valor à frente: ligar
 * não cria nada. Só quando não há nada para ligar é que se cria. */
function fnAmigoJanela(m){
  apiGestao('/api/financas/cc').then(function(cc){
    var pessoas = cc.pessoas.filter(function(p){ return p.ativo; });
    var porNome = function(n){ n = String(n || '').trim().toLowerCase(); return pessoas.filter(function(p){ return p.nome.toLowerCase() === n; })[0]; };
    var nm = h('input', { class: 'fn-in', list: 'fn-dl-amigo', placeholder: 'Nome' });
    var lista = h('datalist', { id: 'fn-dl-amigo' }, pessoas.map(function(p){ return h('option', { value: p.nome }); }));
    var cs = h('select', { class: 'fn-sel' });
    var desc = h('input', { class: 'fn-in', value: fnMovNome(m) });
    var swCx = h('div', { style: 'display:none;margin:.4rem 0' });
    var escolhida = null, vez = 0, j;

    var guardar = function(){
      var n = nm.value.trim();
      if (!n) { fnAviso('Falta quem.'); return false; }
      var p = porNome(n);
      var l = Object.assign(p ? { pessoa_id: p.id } : { nome: n }, { valor: -m.valor }, fnContaEscolhida(cs.value));
      var corpo = { movimentos: [m.id], minha: 0, metodo: 'amigo', descricao: desc.value.trim(), linhas: [l] };
      /* Escolhida uma despesa que já está no Splitwise: o Farol liga-se a ela
         em vez de criar outra igual. */
      if (escolhida && l.splitwise && l.conta_id) {
        corpo.splitwise_existente = {};
        corpo.splitwise_existente[l.conta_id] = escolhida.id;
      }
      return fnApi('/api/financas/partilhas', 'POST', corpo)
        .then(function(r){ fnAvisoPartilha(r); fnMudou(); }, fnErro);
    };

    var swDesenhar = function(ds){
      clear(swCx);
      if (escolhida) {
        swCx.appendChild(h('div', { class: 'fn-caixa melhor' }, [
          h('div', { class: 'fn-acoes', style: 'justify-content:space-between' },
            [h('b', null, escolhida.descricao), h('b', { class: 'fn-n' }, fnEur(escolhida.total))]),
          h('small', { class: 'fn-muted' }, fnData(escolhida.data) + ' · ' + escolhida.grupo_nome + ' — liga-se a esta; no Splitwise não se cria nada.'),
          h('div', { class: 'fn-acoes' }, [fnBtn('Escolher outra', function(){ escolhida = null; swDesenhar(ds); }, 'small')])]));
        return;
      }
      var podem = (ds || []).filter(function(d){ return !d.usada; });
      if (!podem.length) {
        swCx.appendChild(h('p', { class: 'fn-nota' }, 'No Splitwise não há nada por ligar entre 30 dias antes e 30 dias depois' +
          ((ds || []).length ? ' (as que lá estão já pertencem a outro movimento)' : '') +
          '. Ao guardar, o Farol cria lá a despesa: paga por ti, toda para esta pessoa.'));
        swCx.appendChild(h('div', { class: 'fn-acoes' }, [fnBtn('Criar no Splitwise e guardar', function(){
          var r = guardar();
          if (r && typeof r.then === 'function') r.then(function(ok){ if (ok !== false && j) j.fechar(); });
        }, 'primary small')]));
        return;
      }
      swCx.appendChild(h('p', { class: 'fn-nota' }, 'Já está lá alguma destas? Ligar não cria nada no Splitwise. Primeiro as do mesmo valor.'));
      podem.slice(0, 6).forEach(function(d, i){
        swCx.appendChild(h('div', { class: 'fn-caixa' + (d.igual && i === 0 ? ' melhor' : ''), style: 'margin-bottom:6px' + (d.igual ? '' : ';opacity:.65') }, [
          h('div', { class: 'fn-acoes', style: 'justify-content:space-between' },
            [h('b', null, d.descricao), h('b', { class: 'fn-n' }, fnEur(d.total))]),
          h('small', { class: 'fn-muted' }, [fnData(d.data) + (d.dias ? ' (' + (d.dias > 0 ? '+' : '') + d.dias + ' d)' : ' (mesmo dia)'),
            d.grupo_nome, d.pessoas.map(function(x){ return x.nome + ' ' + fnEur(x.deve); }).join(' · ')].join(' · ')),
          d.igual ? null : h('small', { class: 'fn-muted', style: 'display:block' }, 'Valor diferente de ' + fnEur(-m.valor) + '.'),
          h('div', { class: 'fn-acoes' }, [fnBtn('É esta', function(){ escolhida = d; swDesenhar(ds); }, (i === 0 && d.igual ? 'primary ' : '') + 'small')])]));
      });
      swCx.appendChild(h('p', { class: 'fn-nota' }, 'Nenhuma destas? Guarda assim mesmo e o Farol cria lá a despesa.'));
    };

    var swLer = function(){
      var v = String(cs.value || '');
      escolhida = null;
      if (v.charAt(0) !== 's') { swCx.style.display = 'none'; clear(swCx); vez++; return; }
      swCx.style.display = '';
      clear(swCx);
      swCx.appendChild(h('p', { class: 'fn-nota' }, 'A ler o Splitwise…'));
      var n = ++vez;
      apiGestao('/api/financas/movimentos/' + m.id + '/splitwise-despesas?' + fnQs({ conta_id: v.slice(2), valor: -m.valor })).then(function(r){
        if (n === vez) swDesenhar(r.despesas || []);
      }, function(e){
        if (n !== vez) return;
        clear(swCx);
        swCx.appendChild(h('p', { class: 'fn-nota' }, (e && e.message) || 'Não deu para ler o Splitwise.'));
      });
    };

    fnOpcoesContaCc(cc, cs, null, 'f');
    nm.addEventListener('change', function(){ fnOpcoesContaCc(cc, cs, porNome(nm.value), cs.value); swLer(); });
    cs.addEventListener('change', swLer);
    j = fnJanela('Paguei por alguém', [
      h('p', { class: 'fn-nota' }, fnMovNome(m) + ' · ' + fnData(m.data) + ' · ' + fnEur(-m.valor) + '. É tudo dessa pessoa: não conta como despesa tua, e fica a dever-to.'),
      fnCampo('Quem', nm), lista, fnCampo('Fica na conta', cs), swCx, fnCampo('Descrição', desc),
      h('p', { class: 'fn-nota' }, 'Fica nas contas partilhadas. Numa conta do Splitwise, ou se liga à despesa que já lá está, ou o Farol lança-a.')
    ], [{ txt: 'Guardar', pri: true, fn: guardar }]);
  }, fnErro);
}

/* Acerto de contas (entrada: alguém paga-me o que devia) ou empréstimo
   (saída: devolvo a quem pagou por mim): quem é e em que conta corrente. */
function fnAcertoJanela(m, pessoaId){
  apiGestao('/api/financas/cc').then(function(cc){
    var entrada = m.valor > 0;
    var pessoas = cc.pessoas.filter(function(p){ return p.ativo; });
    var porNome = function(n){ n = String(n || '').trim().toLowerCase(); return pessoas.filter(function(p){ return p.nome.toLowerCase() === n; })[0]; };
    var ini = pessoaId ? pessoas.filter(function(p){ return p.id === Number(pessoaId); })[0] : null;
    var nm = h('input', { class: 'fn-in', list: 'fn-dl-acerto', placeholder: 'Nome', value: ini ? ini.nome : (m.pagador || '') });
    var lista = h('datalist', { id: 'fn-dl-acerto' }, pessoas.map(function(p){ return h('option', { value: p.nome }); }));
    var cs = h('select', { class: 'fn-sel' });
    var info = h('small', { class: 'fn-muted', style: 'display:block' });
    var mostrar = function(){
      var p = porNome(nm.value);
      var s = fnSaldoNaConta(cc, p, cs.value);
      var sw = cs.value.charAt(0) === 's';
      info.textContent = (s == null ? '' : (Math.abs(s) < 0.01 ? 'Nesta conta está acertado. ' : s > 0 ? 'Nesta conta deve-te ' + fnEur(s) + '. ' : 'Nesta conta deves-lhe ' + fnEur(-s) + '. ')) +
        (sw ? 'O pagamento vai para o Splitwise (se ainda lá não estiver um igual); o saldo é o de lá.' : 'Fica só no Farol.');
    };
    var escolher = function(){
      var p = porNome(nm.value);
      /* Por defeito, a conta onde há alguma coisa em aberto. */
      var aberta = p ? (cc.contas || []).filter(function(c){ return c.membros.some(function(x){ return x.pessoa_id === p.id && Math.abs(x.saldo) >= 0.01; }); })[0] : null;
      var pref = aberta ? (aberta.tipo === 'splitwise' ? 's:' + aberta.id : (aberta.direta ? 'f' : 'c:' + aberta.id)) : cs.value;
      fnOpcoesContaCc(cc, cs, p, pref);
      mostrar();
    };
    nm.addEventListener('change', escolher);
    cs.addEventListener('change', mostrar);
    escolher();
    fnJanela(entrada ? 'Acerto de contas' : 'Empréstimo · estou a devolver', [
      h('p', { class: 'fn-nota' }, fnMovNome(m) + ' · ' + fnData(m.data) + ' · ' + fnEur(Math.abs(m.valor)) + '. ' + (entrada
        ? 'Alguém a pagar-te o que devia: abate no que te deve e não conta como receita.'
        : 'Alguém pagou por ti e estás a devolver: abate no que lhe deves e não conta como despesa.')),
      fnCampo(entrada ? 'Quem te pagou' : 'A quem devolves', nm), lista,
      fnCampo('Em que conta corrente', cs), info
    ], [{ txt: 'Guardar', pri: true, fn: function(){
      var n = nm.value.trim();
      if (!n) { fnAviso('Falta quem.'); return false; }
      var p = porNome(n);
      var corpo = Object.assign(p ? { pessoa_id: p.id } : { nome: n }, fnContaEscolhida(cs.value));
      return fnApi('/api/financas/movimentos/' + m.id + '/acerto', 'POST', corpo).then(function(r){
        var s = r.splitwise;
        fnAviso((entrada ? 'Acerto de ' : 'Devolvido a ') + r.pessoa + (s ? (s.criado ? ' · pagamento criado no Splitwise.' : s.existente ? ' · o pagamento já estava no Splitwise (ligado, não duplicado).' : s.erro ? ' · Splitwise: ' + s.erro : '.') : '.'));
        fnMudou();
      }, fnErro);
    } }]);
  }, fnErro);
}

/* ======================= PESSOAS ======================= */
/* Quem entra nas contas correntes e nas contas partilhadas. Uma pessoa pode
   estar em várias de umas e de outras. */
function fn_financas_pessoas(corpo){
  fnCarregar(corpo, apiGestao('/api/financas/cc'), function(d){
    FN.pesVer = FN.pesVer || 'ativas';
    var q = (FN.pesQ || '').toLowerCase();
    var todas = d.pessoas;
    var vis = todas.filter(function(p){ return (FN.pesVer === 'ativas' ? p.ativo : FN.pesVer === 'escondidas' ? !p.ativo : true) && (!q || p.nome.toLowerCase().indexOf(q) >= 0); })
      .sort(function(a, b){ return Math.abs(b.saldo) - Math.abs(a.saldo) || a.nome.localeCompare(b.nome); });
    var procura = h('input', { class: 'fn-in', type: 'search', placeholder: 'Procurar pessoa', value: FN.pesQ || '', style: 'max-width:240px' });
    procura.addEventListener('input', function(){ FN.pesQ = procura.value; clearTimeout(FN.pesT); FN.pesT = setTimeout(function(){ fnRender('financas'); setTimeout(function(){ var i = document.querySelector('#fnc-financas input[type=search]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); }, 250); });
    corpo.appendChild(h('div', { class: 'fn-barra' }, [
      fnSegFiltro('pesVer', [['ativas', 'Ativas'], ['escondidas', 'Escondidas'], ['todas', 'Todas']], function(k){ return todas.filter(function(p){ return k === 'ativas' ? p.ativo : k === 'escondidas' ? !p.ativo : true; }).length; }),
      procura, h('span', { class: 'fn-esp' }), fnBtn('+ Pessoa', function(){ fnPessoaCcJanela(); }, 'primary')]));
    var linha = h('div', { class: 'fn-linha', style: 'align-items:flex-start' });
    var cartao = h('div', { class: 'card largo', style: 'padding:6px 10px' });
    var tb = h('tbody');
    vis.forEach(function(p){
      var casa = p.person_id && typeof fnPessoaNome === 'function' ? fnPessoaNome(p.person_id) : '';
      tb.appendChild(h('tr', { class: 'clic' + (FN.ccPessoa === p.id ? ' on' : ''), onclick: function(){ FN.ccPessoa = FN.ccPessoa === p.id ? null : p.id; fnRender('financas'); } }, [
        h('td', null, [h('b', { style: 'font-weight:500' }, p.nome), h('small', { style: 'display:block' }, [p.splitwise_id ? 'Splitwise' : 'só no Farol', casa ? 'agregado: ' + casa : ''].filter(Boolean).join(' · '))]),
        h('td', null, (p.contas_correntes || []).map(function(c){ return h('span', { class: 'fn-pill' + (c.tipo === 'splitwise' ? ' tr' : ''), style: 'margin:1px' }, (c.direta ? (c.tipo === 'splitwise' ? 'sem grupo' : 'Farol') : c.nome) + (Math.abs(c.saldo) >= 0.01 ? ' ' + fnEur(c.saldo, true) : '')); })),
        h('td', { class: 'r' }, p.n_partilhas ? String(p.n_partilhas) : '—'),
        h('td', { style: 'font-size:.75rem' }, p.ultimo ? fnData(p.ultimo) : '—'),
        h('td', { class: 'r ' + (p.saldo > 0.005 ? 'fn-good' : p.saldo < -0.005 ? 'fn-bad' : '') }, Math.abs(p.saldo) < 0.005 ? 'acertado' : fnEur(p.saldo, true))
      ]));
    });
    if (!vis.length) cartao.appendChild(fnVazio('Ninguém aqui.', 'Junta uma pessoa, ou muda o filtro.'));
    else cartao.appendChild(h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab', style: 'min-width:600px' }, [
      h('thead', null, [h('tr', null, [h('th', null, 'Pessoa'), h('th', null, 'Contas correntes'), h('th', { class: 'r' }, 'Partilhadas'), h('th', null, 'Último'), h('th', { class: 'r' }, 'Saldo')])]), tb])]));
    linha.appendChild(cartao);
    var painel = h('div', { class: 'card fn-painel' });
    var ab = todas.filter(function(p){ return p.id === FN.ccPessoa; })[0];
    if (ab) fnPainelPessoa(painel, ab, d); else painel.appendChild(h('p', { class: 'fn-nota' }, 'Escolhe uma pessoa para ver as contas correntes, as contas partilhadas e os movimentos dela.'));
    linha.appendChild(painel);
    corpo.appendChild(linha);
  });
}

function fnPainelPessoa(p, pessoa, d){
  var recarregar = function(){ FN.cache = {}; fnRender('financas'); };
  p.appendChild(h('div', { class: 'fn-acoes', style: 'justify-content:space-between' }, [h('div', null, [h('h3', { style: 'font-size:1.05rem' }, pessoa.nome),
    h('small', { class: 'fn-muted' }, [pessoa.splitwise_id ? 'no Splitwise' : 'só no Farol', pessoa.person_id && typeof fnPessoaNome === 'function' ? 'agregado: ' + fnPessoaNome(pessoa.person_id) : '', pessoa.ativo ? '' : 'escondida'].filter(Boolean).join(' · '))]),
    h('b', { class: 'fn-n ' + (pessoa.saldo > 0 ? 'fn-good' : pessoa.saldo < 0 ? 'fn-bad' : '') }, fnEur(pessoa.saldo, true))]));
  p.appendChild(h('div', { class: 'fn-acoes' }, [fnBtn('Editar', function(){ fnPessoaCcJanela(pessoa); }, 'small'),
    fnBtn('Juntar com…', function(){ fnJuntarJanela(pessoa, d); }, 'small'),
    /* Arquivar: quem só entrou numa conta pontual sai da lista das ativas
       (continua em «Escondidas», com tudo o que tinha). */
    fnBtn(pessoa.ativo ? 'Arquivar' : 'Voltar a mostrar', function(){
      fnApi('/api/financas/cc/pessoas/' + pessoa.id, 'PATCH', { ativo: !pessoa.ativo }).then(function(){ fnAviso(pessoa.ativo ? pessoa.nome + ' arquivada (está em «Escondidas»).' : pessoa.nome + ' voltou às ativas.'); if (pessoa.ativo) FN.ccPessoa = null; recarregar(); }, fnErro);
    }, 'small'),
    !pessoa.splitwise_id && !pessoa.n && !pessoa.n_partilhas ? fnBtn('Apagar', function(){
      fnJanela('Apagar ' + pessoa.nome + '?', [h('p', null, 'Não tem movimentos nem contas partilhadas: sai do Farol.')], [{ txt: 'Apagar', pri: true, fn: function(){
        return fnApi('/api/financas/cc/pessoas/' + pessoa.id, 'DELETE').then(function(){ FN.ccPessoa = null; recarregar(); }, fnErro); } }]);
    }, 'small') : pessoa.splitwise_id && !pessoa.n && !pessoa.n_partilhas ? h('small', { class: 'fn-muted' }, 'Vem do Splitwise: arquiva-se (apagada, voltava na próxima leitura).') : null]));
  p.appendChild(h('div', { class: 'mono' }, 'Contas correntes'));
  p.appendChild(h('div', { class: 'fn-lista' }, (pessoa.contas_correntes || []).length ? pessoa.contas_correntes.map(function(c){
    return h('div', { class: 'fn-li clic', style: 'cursor:pointer', onclick: function(){ FN.ccConta = c.id; FN.ccEstado = 'todas'; FN.ccTipo = 'todas'; FN.aba.financas = 'cc'; fnGuardar(); fnRender('financas'); } },
      [h('div', { class: 'g' }, [c.direta ? (c.tipo === 'splitwise' ? 'Splitwise · sem grupo' : 'Só no Farol') : c.nome, h('small', null, c.tipo === 'splitwise' ? 'Splitwise' : 'Farol')]),
       h('span', { class: 'fn-n ' + (c.saldo > 0.005 ? 'fn-good' : c.saldo < -0.005 ? 'fn-bad' : '') }, Math.abs(c.saldo) < 0.005 ? 'acertado' : fnEur(c.saldo, true))]);
  }) : [h('p', { class: 'fn-nota' }, 'Em nenhuma.')]));
  var zp = h('div', { class: 'fn-lista' }, [h('p', { class: 'fn-nota' }, 'A ler…')]);
  p.appendChild(h('div', { class: 'mono' }, 'Contas partilhadas'));
  p.appendChild(zp);
  apiGestao('/api/financas/partilhas?pessoa=' + pessoa.id).then(function(r){
    clear(zp);
    if (!r.partilhas.length) zp.appendChild(h('p', { class: 'fn-nota' }, 'Nenhuma.'));
    r.partilhas.slice(0, 60).forEach(function(pt){
      var ls = pt.linhas.filter(function(l){ return l.pessoa_id === pessoa.id; });
      zp.appendChild(h('div', { class: 'fn-li clic', style: 'cursor:pointer', onclick: function(){ fnPartilhaJanela(null, pt); } }, [
        h('span', { class: 'fn-n fn-muted', style: 'width:52px;font-size:.75rem' }, fnData(pt.data)),
        h('div', { class: 'g' }, [pt.descricao, h('small', null, 'total ' + fnEur(pt.total) + ' · ' + ls.map(function(l){ return l.estado === 'splitwise' ? 'no Splitwise' : l.estado; }).join(', '))]),
        h('span', { class: 'fn-n' }, fnEur(ls.reduce(function(t, l){ return t + l.valor; }, 0)))]));
    });
  }, function(e){ clear(zp); zp.appendChild(h('p', { class: 'fn-nota' }, e.message)); });
  var zm = h('div', { class: 'fn-lista' }, [h('p', { class: 'fn-nota' }, 'A ler…')]);
  p.appendChild(h('div', { class: 'mono' }, 'Movimentos'));
  p.appendChild(zm);
  apiGestao('/api/financas/cc/' + pessoa.id).then(function(r){
    clear(zm);
    if (!r.movimentos.length) zm.appendChild(h('p', { class: 'fn-nota' }, 'Sem movimentos.'));
    r.movimentos.slice(0, 300).forEach(function(m){ zm.appendChild(fnLinhaCc(m, false, recarregar)); });
  }, function(e){ clear(zm); zm.appendChild(h('p', { class: 'fn-nota' }, e.message)); });
}

function fnJuntarJanela(pessoa, d){
  var sel = h('select', { class: 'fn-sel' }, [h('option', { value: '' }, '— escolhe —')].concat(d.pessoas.filter(function(x){ return x.id !== pessoa.id; })
    .sort(function(a, b){ return a.nome.localeCompare(b.nome); }).map(function(x){ return h('option', { value: x.id }, x.nome + (x.splitwise_id ? ' (Splitwise)' : '')); })));
  fnJanela('Juntar ' + pessoa.nome + ' com…', [h('p', { class: 'fn-nota' }, 'Para quando é a mesma pessoa com dois nomes (o do banco e o do Splitwise). Tudo o que é de «' + pessoa.nome + '» passa para a escolhida, e «' + pessoa.nome + '» desaparece.'), fnCampo('Fica', sel)],
    [{ txt: 'Juntar', pri: true, fn: function(){
      if (!sel.value) { fnAviso('Escolhe com quem juntar.'); return false; }
      return fnApi('/api/financas/cc/pessoas/' + pessoa.id + '/juntar', 'POST', { em: Number(sel.value) }).then(function(r){ FN.ccPessoa = r.id; FN.cache = {}; fnRender('financas'); }, fnErro);
    } }]);
}

function fnPessoaCcJanela(p){
  var nome = h('input', { class: 'fn-in', value: p ? p.nome : '' });
  var pes = h('select', { class: 'fn-sel' }, [h('option', { value: '' }, '— ninguém da casa —')]);
  ((window.G && (G.people || G.pessoas)) || (window.D && D.people) || []).forEach(function(x){ pes.appendChild(h('option', { value: x.id }, x.name)); });
  if (p && p.person_id) pes.value = String(p.person_id);
  var nota = h('input', { class: 'fn-in', value: (p && p.nota) || '' });
  var ativo = h('input', { type: 'checkbox', checked: p ? p.ativo : true });
  fnJanela(p ? p.nome : 'Nova pessoa', [fnCampo('Nome', nome), fnCampo('É do agregado', pes), fnCampo('Nota', nota), p ? h('label', { class: 'fn-check' }, [ativo, 'Mostrar (desmarca para esconder)']) : null,
    p && p.splitwise_id ? h('p', { class: 'fn-nota' }, 'Vem do Splitwise: os grupos e o saldo vêm de lá.') : h('p', { class: 'fn-nota' }, 'Para quem não está no Splitwise: a empresa, os pais, um amigo. Pode entrar em contas partilhadas e em contas correntes do Farol.')],
  [{ txt: p ? 'Guardar' : 'Criar', pri: true, fn: function(){
    if (!nome.value.trim()) { fnAviso('Falta o nome.'); return false; }
    var corpo = { nome: nome.value.trim(), person_id: pes.value ? Number(pes.value) : null, nota: nota.value.trim() };
    if (p) corpo.ativo = ativo.checked;
    var q = p ? fnApi('/api/financas/cc/pessoas/' + p.id, 'PATCH', corpo) : fnApi('/api/financas/cc/pessoas', 'POST', corpo).then(function(r){ FN.ccPessoa = r.id; });
    return q.then(function(){ FN.cache = {}; fnRender('financas'); }, fnErro);
  } }], { folha: true });
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
    }, 'primary small'), fnBtn('Rever as sugestões', function(){ FN.mov.estado = 'sugestoes'; FN.mov.sinal = ''; FN.mov.periodo = 'tudo'; fnIr('movimentos'); }, 'small')]));
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
    h('label', { class: 'fn-check' }, [fixa, 'Custo fixo (renda, prestações, subscrições)']), c ? h('label', { class: 'fn-check' }, [ativo, 'Ativa']) : null], bts, { folha: true });
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
    r ? h('label', { class: 'fn-check' }, [ativo, 'Ativa']) : null, h('p', { class: 'fn-nota' }, 'Maiúsculas e acentos não contam. Ao criar, aplica-se logo aos movimentos que ainda não têm categoria.')], bts, { folha: true });
}


/* ======================= FICHA DO BEM ======================= */
/* Cada sub-area de Patrimonio e um bem: ao abri-la, o ecra da area mostra
   por cima a ficha dele - quanto vale, quanto se deve, o que o identifica e
   que papeis faltam. As tarefas, os projetos e os documentos continuam nos
   cartoes de sempre, por baixo. Quem chama e o area-tarefas.js. */
var FN_ESSENCIAIS = {
  imovel: [['escritura', 'Escritura'], ['caderneta', 'Caderneta predial'], ['certidao', 'Certidão permanente'],
           ['licenca', 'Licença de utilização', 'casa'], ['seguro', 'Apólice do seguro', 'casa'], ['planta', 'Plantas', 'casa']],
  viatura: [['registo', 'Certificado de matrícula (DUA)'], ['seguro', 'Apólice do seguro'], ['inspecao', 'Última inspeção']]
};
var FN_DIVIDA_DOC = ['contrato', 'Contrato do crédito'];
var FN_FICHA = { dados: null, aLer: false };

function fnFichaLer(depois){
  if (FN_FICHA.dados || FN_FICHA.aLer) return;
  FN_FICHA.aLer = true;
  apiGestao('/api/financas/patrimonio?empresas=1').then(function(d){ FN_FICHA.dados = d; })
    .catch(function(){ FN_FICHA.dados = { bens: [], erro: true }; })
    .then(function(){ FN_FICHA.aLer = false; if (typeof depois === 'function') depois(); });
}
/* Quando se mexe num bem, a ficha volta a ler. */
var _fnMudouFicha = fnMudou;
fnMudou = function(){ FN_FICHA.dados = null; return _fnMudouFicha.apply(this, arguments); };

function fnIrParaArea(ctxId){
  var c = ((window.G && G.contextos) || []).filter(function(x){ return x.id === ctxId; })[0];
  if (!c || typeof show !== 'function' || typeof AE === 'undefined') return;
  var topo = c.parent_id ? G.contextos.filter(function(x){ return x.id === c.parent_id; })[0] : c;
  var nome = typeof aeNorm === 'function' ? aeNorm(topo.name) : topo.name.toLowerCase();
  var a = (typeof AE_AREAS !== 'undefined' ? AE_AREAS : []).filter(function(x){ return nome.indexOf(x.nome) === 0; })[0];
  if (!a) return;
  AE.filtro[a.view] = Object.assign({}, AE.filtro[a.view] || {}, { subs: c.parent_id ? [String(c.id)] : [] });
  /* Nas Financas e no Patrimonio o ecra da area vive no separador «Tarefas &
     papeis»: sem isto abria-se a vista certa no separador errado. */
  if (window.FN && FN.aba && typeof FN_ABAS !== 'undefined' && FN_ABAS[a.view]) { FN.aba[a.view] = 'area'; fnGuardar(); }
  show(a.view);
  if (typeof aeRender === 'function') aeRender();
  if (typeof fnRender === 'function') fnRender(a.view);
}

/* Escolher um bem no menu (Patrimonio › BMW 216d) abre a ficha dele, que
   esta no separador «Tarefas & papeis». */
if (typeof aeNavFiltrar === 'function') {
  var _fnNavFiltrar = aeNavFiltrar;
  aeNavFiltrar = function(a, sub){
    var bem = a && a.view === 'patrimonio' && sub;
    if (bem && window.FN && FN.aba) { FN.aba.patrimonio = 'area'; fnGuardar(); }
    var r = _fnNavFiltrar.apply(this, arguments);
    if (bem && typeof fnRender === 'function') fnRender('patrimonio');
    return r;
  };
}

function fnFichaBem(ctxId){
  if (!ctxId) return null;
  var card = h('div', { class: 'card fn-ficha' });
  if (!FN_FICHA.dados) {
    card.appendChild(h('p', { class: 'fn-nota' }, 'A ler a ficha do bem…'));
    fnFichaLer(function(){ if (typeof aeRender === 'function') aeRender(); });
    return card;
  }
  var bens = (FN_FICHA.dados.bens || []).filter(function(b){ return b.context_id === ctxId; });
  var ativos = bens.filter(function(b){ return b.lado !== 'passivo'; });
  var dividas = bens.filter(function(b){ return b.lado === 'passivo'; });
  var principal = ativos.filter(function(b){ return b.classe === 'imovel' || b.classe === 'viatura'; })[0] || ativos[0] || null;

  var hd = h('header', null, [h('h3', null, principal ? principal.nome : 'Ficha do bem')]);
  hd.appendChild(principal ? fnBtn('Editar', function(){ fnBemJanela(principal); }, 'small')
    : fnBtn('+ Registar o bem', function(){ fnBemJanela(null, { context_id: ctxId }); }, 'small'));
  card.appendChild(hd);
  if (!bens.length) {
    card.appendChild(h('p', { class: 'fn-nota' }, 'Esta sub-área ainda não tem um bem no Património. Regista-o para veres aqui o valor, a dívida e os papéis que faltam.'));
    return card;
  }

  /* 1. Quanto vale e quanto se deve. */
  var vale = ativos.reduce(function(s, b){ return s + (b.valor || 0); }, 0);
  var deve = dividas.reduce(function(s, b){ return s + Math.abs(b.valor || 0); }, 0);
  var semValor = ativos.some(function(b){ return b.valor == null; }) || dividas.some(function(b){ return b.valor == null; });
  var linhas = [];
  ativos.forEach(function(b){ linhas.push(fnFichaLinha(b.nome, b.valor == null ? 'sem valor' : fnEur(b.valor), b.valor_em ? 'valor de ' + fnData(b.valor_em) : '', b)); });
  dividas.forEach(function(b){
    var sub = [b.prestacao ? fnEur(b.prestacao) + '/mês' : null, b.termina ? 'acaba ' + fnData(b.termina) : null].filter(Boolean).join(' · ');
    linhas.push(fnFichaLinha(b.nome, b.valor == null ? 'sem valor' : fnEur(-Math.abs(b.valor)), sub, b, true));
  });
  var resumo = h('div', { class: 'fn-ficha-resumo' }, [
    h('div', null, [h('small', null, 'Vale'), h('b', null, fnEur(vale))]),
    h('div', null, [h('small', null, 'Deve-se'), h('b', { class: deve ? 'fn-bad' : '' }, fnEur(-deve))]),
    h('div', null, [h('small', null, 'É teu (capital próprio)'), h('b', null, fnEur(vale - deve))])
  ]);
  card.appendChild(resumo);
  if (semValor) card.appendChild(h('p', { class: 'fn-nota' }, 'Há valores por escrever: o capital próprio só fica certo com todos. Carrega em Editar.'));
  card.appendChild(h('div', { class: 'fn-lista' }, linhas));

  /* 2. O que o identifica. */
  var d = (principal && principal.dados) || {};
  var ROT = [['artigo', 'Artigo matricial'], ['registo', 'Registo predial'], ['area_m2', 'Área', ' m²'], ['vpt', 'VPT', ' €'],
    ['matricula', 'Matrícula'], ['modelo', 'Modelo'], ['data_matricula', 'Matrícula de'], ['seguradora', 'Seguradora'], ['apolice', 'Apólice'],
    ['compra_data', 'Comprado em'], ['compra_preco', 'Preço de compra', ' €'], ['imt', 'IMT', ' €'], ['imposto_selo', 'Imposto do Selo', ' €']];
  var ids = ROT.filter(function(r){ return d[r[0]]; }).map(function(r){
    var raw = d[r[0]], v;
    var n = Number(String(raw).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
    if (/data/.test(r[0]) && /^\d{4}-\d\d-\d\d$/.test(raw)) v = fnData(raw);
    else if (r[2] === ' €' && isFinite(n)) v = fnEur(n);
    else v = raw + (r[2] || '');
    return h('div', null, [h('small', null, r[1]), h('span', null, v)]);
  });
  card.appendChild(h('div', { class: 'fn-ficha-sec' }, 'Identificação'));
  card.appendChild(ids.length ? h('div', { class: 'fn-ficha-ids' }, ids)
    : h('p', { class: 'fn-nota' }, 'Ainda sem identificação. Em Editar escreve o artigo, o registo, a compra ou a matrícula.'));

  /* 3. Os papeis essenciais: os que ha e os que faltam. */
  var docs = ((window.D && D.documents) || []).filter(function(x){ return x.context_id === ctxId; });
  var classe = principal ? principal.classe : 'outro';
  var habitavel = !/terreno|lote/i.test(principal ? principal.nome : '');
  var lista = (FN_ESSENCIAIS[classe] || []).filter(function(e){ return e[2] !== 'casa' || habitavel; });
  /* Um sinal recebido (classe Outro) e uma divida mas nao tem contrato de credito. */
  if (dividas.some(function(b){ return b.classe !== 'outro'; })) lista = lista.concat([FN_DIVIDA_DOC]);
  if (lista.length) {
    card.appendChild(h('div', { class: 'fn-ficha-sec' }, 'Documentos essenciais'));
    var ul = h('div', { class: 'fn-ficha-docs' });
    lista.forEach(function(e){
      var ds = docs.filter(function(x){ return (x.kind || '') === e[0]; });
      var ok = ds.length > 0;
      /* Cada papel abre-se dali: o nome e um link para o ficheiro. Havendo
         varios do mesmo tipo (duas certidoes), aparecem todos, o mais
         recente primeiro. */
      var links = h('small', null, ok ? null : 'em falta');
      ds.slice().sort(function(x, y){ return String(y.issued_on || '').localeCompare(String(x.issued_on || '')); }).forEach(function(dd2, i){
        var val = dd2.valid_on || dd2.valid_until;
        var vt = val ? ' · válido até ' + fnData(String(val).slice(0, 10)) : '';
        var f = (dd2.ficheiros && dd2.ficheiros.length) ? dd2.ficheiros[0] : dd2.inbox_id;
        if (i) links.appendChild(h('br'));
        links.appendChild(f ? h('a', { href: '/api/inbox/' + f + '/ficheiro', target: '_blank', rel: 'noopener', title: 'Abrir o ficheiro' }, dd2.name)
          : h('span', { title: 'Este papel não tem ficheiro' }, dd2.name + ' (sem ficheiro)'));
        if (vt) links.appendChild(document.createTextNode(vt));
      });
      ul.appendChild(h('div', { class: ok ? 'ok' : 'falta' }, [h('b', null, ok ? '✓' : '○'), h('span', null, e[1]), links]));
    });
    card.appendChild(ul);
    card.appendChild(h('p', { class: 'fn-nota' }, 'Um papel conta quando está nesta sub-área com o tipo certo (Relacionar › Área / projeto).'));
  }

  /* 4. Onde se vive nele. */
  if (d.casa_context_id) {
    var nm = fnNomeArea(d.casa_context_id);
    if (nm) card.appendChild(h('div', { class: 'fn-ficha-casa' }, [h('span', null, 'O dia a dia da casa (contas, manutenção, mudança) está em '),
      fnBtn(nm + ' →', function(){ fnIrParaArea(d.casa_context_id); }, 'small')]));
  }
  return card;
}
function fnFichaLinha(nome, valor, sub, b, divida){
  return h('div', { class: 'fn-li' }, [h('div', { class: 'g' }, [nome, sub ? h('small', null, sub) : null]),
    h('span', { class: 'fn-n ' + (divida ? 'fn-bad' : '') }, valor), fnBtn('Editar', function(){ fnBemJanela(b); }, 'small')]);
}

/* No sentido contrario: na sub-area da Casa onde se vive, uma linha leva a
   ficha do imovel em Patrimonio. */
function fnLigacaoBem(ctxId){
  if (!ctxId) return null;
  if (!FN_FICHA.dados) { fnFichaLer(function(){ if (typeof aeRender === 'function') aeRender(); }); return null; }
  var b = (FN_FICHA.dados.bens || []).filter(function(x){ return x.lado !== 'passivo' && x.dados && x.dados.casa_context_id === ctxId; })[0];
  if (!b || !b.context_id) return null;
  return h('div', { class: 'card fn-ficha-casa' }, [h('span', null, 'Os papéis, o crédito e os impostos deste imóvel estão em '),
    fnBtn((fnNomeArea(b.context_id) || b.nome) + ' →', function(){ fnIrParaArea(b.context_id); }, 'small')]);
}

(function(){
  if (document.getElementById('fnFichaCss')) return;
  var st = document.createElement('style'); st.id = 'fnFichaCss';
  st.textContent =
    '.fn-ficha .fn-ficha-resumo{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:4px 0 10px}' +
    '.fn-ficha .fn-ficha-resumo div{background:var(--ground);border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-width:0}' +
    '.fn-ficha .fn-ficha-resumo small,.fn-ficha-ids small{display:block;font-size:.72rem;color:var(--faint)}' +
    '.fn-ficha .fn-ficha-resumo b{font-family:var(--mono);font-size:1.05rem;font-weight:500}' +
    '.fn-ficha .fn-ficha-sec{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin:14px 0 6px}' +
    '.fn-ficha .fn-ficha-ids{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px 14px;font-size:.875rem}' +
    '.fn-ficha .fn-ficha-docs div{display:flex;align-items:baseline;gap:8px;padding:5px 0;border-top:1px solid var(--line-soft);font-size:.875rem;min-width:0}' +
    '.fn-ficha .fn-ficha-docs div:first-child{border-top:0}' +
    '.fn-ficha .fn-ficha-docs small{margin-left:auto;color:var(--faint);font-size:.75rem;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%}' +
    '.fn-ficha .fn-ficha-docs .ok b{color:var(--good,#1baf7a)}' +
    '.fn-ficha .fn-ficha-docs a{color:var(--accent-ink,inherit);text-decoration:underline;text-underline-offset:2px}' +
    '.fn-ficha .fn-ficha-docs small{white-space:normal}' +
    '.fn-ficha .fn-ficha-docs .falta b,.fn-ficha .fn-ficha-docs .falta small{color:var(--warn,#c47f00)}' +
    '.fn-ficha-casa{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:.875rem;color:var(--ink-2);margin-top:12px}' +
    '@media (max-width:640px){.fn-ficha .fn-ficha-resumo{grid-template-columns:1fr}}';
  document.head.appendChild(st);
})();
