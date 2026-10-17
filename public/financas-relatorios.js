/* Finanças › Relatórios (17 out 2026).
 *
 * Três vistas para avaliar a vida pessoal e cada empresa por si, iguais às
 * que o Marco entrega da gestão bancária da Cúpula Arejada:
 *   - Entradas e saídas: o mapa por rubrica e mês (com exportação CSV);
 *   - Saldo e movimentos: o saldo no fim de cada mês e o que entrou e saiu;
 *   - Despesas: para onde vai o dinheiro, por categoria.
 * Os números vêm de GET /api/financas/relatorios (src/relatorios.js).
 */
var RL = { vista: 'mapa', ambito: 'pessoal', ano: String(new Date().getFullYear()), aberta: null };
try { var _rl = JSON.parse(localStorage.getItem('fnRelatorios') || 'null'); if (_rl) { RL.vista = _rl.vista || RL.vista; RL.ambito = _rl.ambito || RL.ambito; } } catch (e) {}
function rlGuardar(){ try { localStorage.setItem('fnRelatorios', JSON.stringify({ vista: RL.vista, ambito: RL.ambito })); } catch (e) {} }

var RL_CSS =
  '.rl-barra{display:flex;flex-wrap:wrap;gap:10px;align-items:center}' +
  '.rl-barra .fn-esp{flex:1}' +
  '.rl-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}' +
  '.rl-kpis .fn-kpi .v{font-size:1.5rem}' +
  '.rl-pos{color:var(--fn-in)}.rl-neg{color:var(--fn-out)}.rl-zero{color:var(--muted)}' +
  '.rl-mapa{border-collapse:collapse;font-size:.8125rem;min-width:100%}' +
  '.rl-mapa th{font-family:var(--mono);font-size:.625rem;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:500;padding:7px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}' +
  '.rl-mapa th:first-child{text-align:left}' +
  '.rl-mapa td{padding:7px 8px;border-bottom:1px solid var(--line-soft);text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}' +
  '.rl-mapa td:first-child{text-align:left;font-family:inherit;white-space:normal;min-width:180px;padding-left:22px;color:var(--ink-2)}' +
  '.rl-mapa tr.sec td{background:var(--surface-2);font-weight:600}' +
  '.rl-mapa tr.sec td:first-child{padding-left:8px;color:var(--ink)}' +
  '.rl-mapa tr.res td{border-top:2px solid var(--ink);font-weight:600;border-bottom:0}' +
  '.rl-mapa tr.res td:first-child{padding-left:8px;color:var(--ink)}' +
  '.rl-mapa td.t,.rl-mapa th.t{border-left:1px solid var(--line);font-weight:600}' +
  '.rl-mapa tr.clic{cursor:pointer}.rl-mapa tr.clic:hover td{background:var(--accent-soft)}' +
  '.rl-graf{display:flex;gap:10px;height:260px;padding-top:6px}' +
  '.rl-eixo{display:flex;flex-direction:column;justify-content:space-between;font-family:var(--mono);font-size:.6875rem;color:var(--muted);text-align:right;min-width:62px;padding-bottom:22px}' +
  '.rl-barras{flex:1;display:flex;gap:10px;align-items:flex-end;border-left:1px solid var(--line);padding-left:10px;min-width:0}' +
  '.rl-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px;height:100%;min-width:0}' +
  '.rl-col i{display:block;width:100%;max-width:60px;border-radius:6px 6px 0 0;background:color-mix(in srgb,var(--accent) 55%,transparent)}' +
  '.rl-col i.ult{background:var(--accent)}.rl-col i.neg{background:var(--fn-out)}' +
  '.rl-col small{font-size:.75rem;color:var(--muted)}.rl-col span{font-family:var(--mono);font-size:.6875rem;color:var(--ink-2);white-space:nowrap}' +
  '.rl-aviso{display:flex;gap:10px;align-items:flex-start;border:1px solid color-mix(in srgb,var(--fn-out) 45%,transparent);background:color-mix(in srgb,var(--fn-out) 9%,var(--surface));border-radius:var(--radius);padding:11px 14px;font-size:.875rem}' +
  '.rl-roscas{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}' +
  '.rl-rosca{display:flex;gap:20px;align-items:center;flex-wrap:wrap}' +
  '.rl-disco{width:160px;height:160px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center}' +
  '.rl-disco > div{width:100px;height:100px;border-radius:50%;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}' +
  '.rl-disco b{font-family:var(--mono);font-size:.8125rem;font-weight:500}.rl-disco small{font-size:.6875rem;color:var(--muted)}' +
  '.rl-leg{flex:1;min-width:200px;display:flex;flex-direction:column;gap:8px;font-size:.8125rem}' +
  '.rl-leg div{display:flex;gap:8px;align-items:center}.rl-leg i{width:10px;height:10px;border-radius:3px;flex:none}' +
  '.rl-leg span{flex:1}.rl-leg b{font-family:var(--mono);font-weight:500}.rl-leg em{font-style:normal;width:46px;text-align:right;color:var(--muted);font-family:var(--mono);font-size:.75rem}' +
  '.rl-sub{font-size:.625rem;font-family:var(--mono);letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}' +
  '.rl-dentro td{background:var(--surface-2)}' +
  '.rl-seta{display:inline-block;width:12px;transition:transform .15s;color:var(--muted)}.rl-seta.on{transform:rotate(90deg)}';

function rlEstilo(){
  if (document.getElementById('rlCss')) return;
  var s = document.createElement('style'); s.id = 'rlCss'; s.textContent = RL_CSS; document.head.appendChild(s);
}
function rlCls(v){ return Math.abs(v) < 0.5 ? 'rl-zero' : (v > 0 ? 'rl-pos' : 'rl-neg'); }
function rlNum(v){ return Math.abs(v) < 0.5 ? '—' : fnEur0(v); }
function rlMes(ym){ return fnMesCurto(ym) + ' ' + ym.slice(2, 4); }
function rlPct(v, t){ return t ? String(Math.round(v / t * 1000) / 10).replace('.', ',') + ' %' : '—'; }
var RL_CORES = ['var(--accent)', 'var(--fn-out)', 'var(--fn-c3)', 'var(--fn-c4)', 'var(--fn-c5)'];

function fn_financas_relatorios(corpo){
  rlEstilo();
  var url = '/api/financas/relatorios?ambito=' + encodeURIComponent(RL.ambito) + '&ano=' + encodeURIComponent(RL.ano);
  fnCarregar(corpo, fnLer('rl|' + RL.ambito + '|' + RL.ano, url), function(d){
    if (d.ambito !== RL.ambito) { RL.ambito = d.ambito; }
    corpo.appendChild(rlBarra(d));
    if (RL.vista === 'saldo') rlSaldo(corpo, d);
    else if (RL.vista === 'despesas') rlDespesas(corpo, d);
    else rlMapa(corpo, d);
  });
}

function rlBarra(d){
  var vistas = h('div', { class: 'fn-seg', role: 'group', 'aria-label': 'Relatório' });
  [['mapa', 'Entradas e saídas'], ['saldo', 'Saldo e movimentos'], ['despesas', 'Despesas']].forEach(function(v){
    vistas.appendChild(h('button', { type: 'button', class: RL.vista === v[0] ? 'on' : '', onclick: function(){ RL.vista = v[0]; RL.aberta = null; rlGuardar(); fnRender(); } }, v[1]));
  });
  var amb = h('div', { class: 'fn-seg', role: 'group', 'aria-label': 'Âmbito' });
  d.ambitos.forEach(function(a){
    amb.appendChild(h('button', { type: 'button', class: d.ambito === a.id ? 'on' : '', onclick: function(){ RL.ambito = a.id; RL.aberta = null; rlGuardar(); fnRender(); } }, a.nome));
  });
  var ano = h('select', { class: 'fn-sel', 'aria-label': 'Período', onchange: function(e){ RL.ano = e.target.value; RL.aberta = null; fnRender(); } });
  var anos = d.anos.slice();
  if (anos.indexOf(String(new Date().getFullYear())) < 0) anos.push(String(new Date().getFullYear()));
  anos.slice().reverse().forEach(function(a){ ano.appendChild(h('option', { value: a }, a)); });
  ano.appendChild(h('option', { value: '12m' }, 'Últimos 12 meses'));
  ano.value = d.ano;
  return h('div', { class: 'rl-barra' }, [vistas, h('span', { class: 'fn-esp' }), amb, ano]);
}

/* ---------------- 1. Entradas e saídas ---------------- */
function rlMapa(corpo, d){
  var k = d.kpi, n = d.meses.length;
  var empresaNome = d.ambito === 'pessoal' ? 'Para a empresa' : 'Devoluções ao sócio';
  corpo.appendChild(h('div', { class: 'rl-kpis' }, [
    fnKpi('Entradas', fnEur0(k.entradas), 'no período · ' + n + (n === 1 ? ' mês' : ' meses')),
    fnKpi('Custos fixos', fnEur0(k.fixos), fnEur0(k.fixos / n) + ' por mês, em média'),
    fnKpi('Custos variáveis', fnEur0(k.variaveis), fnEur0(k.variaveis / n) + ' por mês, em média'),
    k.empresa ? fnKpi(empresaNome, fnEur0(k.empresa), d.ambito === 'pessoal' ? 'suprimentos e transferências para a empresa' : 'o que voltou para o sócio') : null,
    fnKpi('Resultado', fnEur0(k.resultado), k.resultado < 0 ? 'saiu mais do que entrou' : 'entrou mais do que saiu', k.resultado < 0 ? 'fn-bad' : 'fn-good')
  ]));

  var cab = h('tr', null, [h('th', null, 'Rubrica')].concat(d.meses.map(function(m){ return h('th', null, rlMes(m)); })).concat([h('th', { class: 't' }, 'Total')]));
  var tb = h('tbody');
  var soma = function(ls){ return d.meses.map(function(_, i){ return ls.reduce(function(a, r){ return a + r.v[i]; }, 0); }); };
  var tot = function(a){ return a.reduce(function(x, y){ return x + y; }, 0); };
  var csv = [['Rubrica'].concat(d.meses.map(rlMes)).concat(['Total'])];
  function bloco(titulo, ls, sinal){
    var s = soma(ls);
    tb.appendChild(h('tr', { class: 'sec' }, [h('td', null, titulo)].concat(s.map(function(v){ return h('td', { class: rlCls(v * sinal) }, rlNum(v * sinal)); })).concat([h('td', { class: 't ' + rlCls(tot(s) * sinal) }, rlNum(tot(s) * sinal))])));
    csv.push([titulo].concat(s.map(function(v){ return Math.round(v * sinal * 100) / 100; })).concat([Math.round(tot(s) * sinal * 100) / 100]));
    ls.forEach(function(r){
      var abre = r.categoria_id ? function(){ rlAbrirMovs(d, r.categoria_id, r.nome); } : null;
      tb.appendChild(h('tr', { class: abre ? 'clic' : '', onclick: abre, title: abre ? 'Ver os movimentos' : null }, [h('td', null, r.nome)]
        .concat(r.v.map(function(v){ return h('td', { class: rlCls(v * sinal) }, rlNum(v * sinal)); }))
        .concat([h('td', { class: 't ' + rlCls(r.total * sinal) }, rlNum(r.total * sinal))])));
      csv.push([r.nome].concat(r.v.map(function(v){ return Math.round(v * sinal * 100) / 100; })).concat([Math.round(r.total * sinal * 100) / 100]));
    });
    return s;
  }
  var e = bloco('Entradas', d.mapa.entradas, 1);
  var f = bloco('Custos fixos', d.mapa.fixos, -1);
  var v = bloco(d.ambito === 'pessoal' ? 'Custos variáveis (por grupo)' : 'Custos variáveis', d.mapa.variaveis, -1);
  var x = d.mapa.empresa.length ? bloco(empresaNome, d.mapa.empresa, -1) : d.meses.map(function(){ return 0; });
  var res = e.map(function(val, i){ return val - f[i] - v[i] - x[i]; });
  tb.appendChild(h('tr', { class: 'res' }, [h('td', null, 'Resultado')].concat(res.map(function(val){ return h('td', { class: rlCls(val) }, rlNum(val)); })).concat([h('td', { class: 't ' + rlCls(tot(res)) }, rlNum(tot(res)))])));
  csv.push(['Resultado'].concat(res.map(function(val){ return Math.round(val * 100) / 100; })).concat([Math.round(tot(res) * 100) / 100]));

  var nomeAmb = (d.ambitos.filter(function(a){ return a.id === d.ambito; })[0] || {}).nome || '';
  var bCsv = fnBtn('Exportar CSV', function(){ rlCsv(csv, 'entradas-e-saidas-' + nomeAmb + '-' + d.ano); }, 'small');
  corpo.appendChild(fnCard('Mapa por rubrica e mês', bCsv, [
    h('p', { class: 'fn-nota', style: 'margin:0 0 8px' }, 'Entradas positivas, saídas negativas. As transferências entre as contas ' + (d.ambito === 'pessoal' ? 'pessoais' : 'da empresa') + ' não contam' + (d.fora ? ' (' + d.fora + ' movimentos de transferência ficaram de fora)' : '') + '. Carrega numa categoria para ver os movimentos.'),
    h('div', { class: 'fn-scroll' }, [h('table', { class: 'rl-mapa' }, [h('thead', null, [cab]), tb])])
  ]));
}

function rlCsv(linhas, nome){
  var txt = '﻿' + linhas.map(function(l){ return l.map(function(c){ var s = typeof c === 'number' ? String(c).replace('.', ',') : String(c); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';'); }).join('\r\n');
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
  a.download = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') + '.csv';
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* Os movimentos de uma categoria, no âmbito e no período, numa folha. */
function rlAbrirMovs(d, catId, nome){
  var url = '/api/financas/movimentos?limite=200&categoria=' + catId + '&conta=' + d.contas_fluxo.join(',') + '&de=' + d.de + '&ate=' + d.ate;
  apiGestao(url).then(function(r){
    var ms = (r && r.movimentos) || [];
    var dlg = h('dialog', { class: 'folha' });
    var lista = h('div', { class: 'fn-lista' });
    ms.forEach(function(m){
      lista.appendChild(h('button', { type: 'button', class: 'fn-li', style: 'width:100%;text-align:left', onclick: function(){ dlg.close(); dlg.remove(); fnMovJanela(m); } }, [
        h('div', { class: 'g' }, [fnMovNome(m), h('small', null, fnData(m.data) + ' · ' + ((fnConta(m.conta_id) || {}).nome || ''))]),
        h('span', { class: 'fn-n ' + (m.valor < 0 ? 'rl-neg' : 'rl-pos') }, fnEur(m.valor))]));
    });
    if (!ms.length) lista.appendChild(h('p', { class: 'fn-nota' }, 'Sem movimentos.'));
    dlg.appendChild(h('div', { style: 'padding:18px 20px;display:flex;flex-direction:column;gap:12px;max-width:640px' }, [
      h('h3', { style: 'margin:0' }, nome), h('span', { class: 'fn-muted' }, ms.length + ' movimentos · ' + fnData(d.de) + ' a ' + fnData(d.ate)), lista,
      h('div', { class: 'fn-acoes', style: 'justify-content:flex-end' }, [fnBtn('Fechar', function(){ dlg.close(); dlg.remove(); })])]));
    dlg.addEventListener('close', function(){ dlg.remove(); });
    document.body.appendChild(dlg); dlg.showModal();
  }).catch(function(e){ fnAviso(e.message || 'Não deu para ler os movimentos.'); });
}

/* ---------------- 2. Saldo e movimentos ---------------- */
function rlSaldo(corpo, d){
  var s = d.saldo;
  corpo.appendChild(h('div', { class: 'rl-kpis' }, [
    fnKpi('Saldo', fnEur(s.fim.saldo), 'a ' + fnData(s.fim.dia)),
    fnKpi('Entradas no período', fnEur0(s.entradas.v), s.entradas.n + ' movimentos'),
    fnKpi('Saídas no período', fnEur0(s.saidas.v), s.saidas.n + ' movimentos'),
    fnKpi('Resultado de tesouraria', fnEur0(s.resultado), s.resultado < 0 ? 'saiu mais do que entrou' : 'entrou mais do que saiu', s.resultado < 0 ? 'fn-bad' : 'fn-good')
  ]));
  if (s.diferenca) {
    corpo.appendChild(h('div', { class: 'rl-aviso', role: 'note' }, [
      h('b', { class: 'rl-neg', 'aria-hidden': 'true' }, '!'),
      h('span', null, 'O saldo ' + (s.fim.saldo - s.inicio.saldo < 0 ? 'desceu ' : 'subiu ') + fnEur0(Math.abs(s.fim.saldo - s.inicio.saldo)) + ' no período, mas os movimentos no Farol dão ' + fnEur0(s.resultado) +
        ': há ' + fnEur0(Math.abs(s.diferenca)) + ' de ' + (s.diferenca > 0 ? 'entradas' : 'saídas') + ' que o extrato tem e o Farol ainda não. Vale a pena carregar o extrato desses meses.')
    ]));
  }
  var vals = s.pontos.map(function(p){ return p.saldo; });
  var max = Math.max.apply(null, vals.map(Math.abs).concat([1]));
  var passo = Math.pow(10, Math.floor(Math.log10(max))), topo = Math.ceil(max / passo) * passo;
  var barras = h('div', { class: 'rl-barras' });
  s.pontos.forEach(function(p, i){
    var alt = Math.max(2, Math.round(Math.abs(p.saldo) / topo * 210));
    barras.appendChild(h('div', { class: 'rl-col', title: rlMes(p.mes) + ': ' + fnEur(p.saldo) }, [
      h('span', null, (p.saldo < 0 ? '−' : '') + String(Math.round(Math.abs(p.saldo) / 100) / 10).replace('.', ',') + ' k'),
      h('i', { class: (p.saldo < 0 ? 'neg' : (i === s.pontos.length - 1 ? 'ult' : '')), style: 'height:' + alt + 'px' }),
      h('small', null, fnMesCurto(p.mes))]));
  });
  var eixo = h('div', { class: 'rl-eixo', 'aria-hidden': 'true' }, [topo, topo * 2 / 3, topo / 3, 0].map(function(v){ return h('span', null, fnEur0(v)); }));
  corpo.appendChild(fnCard('Evolução do saldo', 'fim de cada mês', [
    h('p', { class: 'fn-nota', style: 'margin:0 0 6px' }, (d.ambito === 'pessoal' ? 'Soma das contas à ordem, poupança e dinheiro (os cartões ficam à parte): ' : '') + s.contas.join(', ') + '.'),
    h('div', { class: 'rl-graf', role: 'img', 'aria-label': 'Saldo no fim de cada mês' }, [eixo, barras])
  ]));

  var tb = h('tbody');
  d.recentes.forEach(function(m){
    tb.appendChild(h('tr', { class: 'clic', onclick: function(){ apiGestao('/api/financas/movimentos?id=' + m.id).then(function(r){ var x = r && r.movimentos && r.movimentos[0]; if (x) fnMovJanela(x); }); } }, [
      h('td', { class: 'fn-n' }, fnData(m.data)), h('td', null, m.nome), h('td', { class: 'fn-muted' }, m.categoria || 'por categorizar'),
      h('td', { class: 'r fn-n ' + (m.valor < 0 ? 'rl-neg' : 'rl-pos') }, fnEur(m.valor))]));
  });
  var ver = fnBtn('Ver todos em Movimentos', function(){
    FN.ambito = 'tudo'; FN.area = ''; FN.mov.estado = ''; FN.mov.categoria = ''; FN.mov.sinal = ''; FN.mov.conta = s.conta_ids.join(','); FN.mov.periodo = 'datas'; FN.mov.de = d.de; FN.mov.ate = d.ate; FN.cache = {}; fnIr('movimentos');
  }, 'small');
  corpo.appendChild(fnCard('Movimentos', ver, [h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab' }, [
    h('thead', null, [h('tr', null, [h('th', null, 'Data'), h('th', null, 'Descritivo'), h('th', null, 'Categoria'), h('th', { class: 'r' }, 'Valor')])]), tb])])]));
}

/* ---------------- 3. Despesas ---------------- */
function rlDespesas(corpo, d){
  var x = d.despesas, n = x.meses || 1;
  corpo.appendChild(h('div', { class: 'rl-kpis' }, [
    fnKpi('Custos fixos', fnEur0(x.fixos / n), 'por mês, média de ' + n + (n === 1 ? ' mês' : ' meses')),
    fnKpi('Custos variáveis', fnEur0(x.variaveis / n), 'por mês, em média'),
    fnKpi('Total de saídas', fnEur0(x.total / n), 'por mês, em média'),
    x.por_classificar ? fnKpiLink('Por classificar', String(x.por_classificar), 'categorizar agora ›', function(){ FN.ambito = 'tudo'; FN.area = ''; FN.mov.estado = 'categorizar'; FN.mov.categoria = ''; FN.mov.sinal = ''; FN.mov.conta = d.contas_fluxo.join(','); FN.mov.periodo = 'datas'; FN.mov.de = d.de; FN.mov.ate = d.ate; FN.cache = {}; fnIr('movimentos'); })
      : fnKpi('Por classificar', '0', 'está tudo classificado', 'fn-good')
  ]));
  if (!x.categorias.length) { corpo.appendChild(fnVazio('Sem despesas neste período.')); return; }

  var top = x.categorias.slice(0, 4), resto = x.total - top.reduce(function(a, c){ return a + c.total; }, 0);
  var fatias = top.map(function(c){ return [c.nome, c.total]; });
  if (x.categorias.length > 4) fatias.push(['Outras (' + (x.categorias.length - 4) + ')', resto]);
  var ac = 0, stops = fatias.map(function(f, i){ var a = ac; ac += Math.max(0, f[1]) / x.total * 360; return RL_CORES[i] + ' ' + a.toFixed(1) + 'deg ' + ac.toFixed(1) + 'deg'; }).join(', ');
  var fa = Math.max(0, x.fixos) / x.total * 360;
  function rosca(fundo, legenda, rotulo){
    return h('div', { class: 'rl-rosca' }, [
      h('div', { class: 'rl-disco', role: 'img', 'aria-label': rotulo, style: 'background:conic-gradient(' + fundo + ')' }, [h('div', null, [h('b', null, fnEur0(x.total)), h('small', null, 'de saídas')])]),
      h('div', { class: 'rl-leg' }, legenda.map(function(l){ return h('div', null, [h('i', { style: 'background:' + l[2] }), h('span', null, l[0]), h('b', null, fnEur0(l[1])), h('em', null, rlPct(l[1], x.total))]); }))]);
  }
  corpo.appendChild(fnCard('Onde vai o dinheiro', 'sobre ' + n + (n === 1 ? ' mês' : ' meses') + ' de extratos', [h('div', { class: 'rl-roscas' }, [
    h('div', null, [h('div', { class: 'rl-sub', style: 'margin-bottom:10px' }, 'Por categoria'), rosca(stops, fatias.map(function(f, i){ return [f[0], f[1], RL_CORES[i]]; }), 'Despesas por categoria')]),
    h('div', null, [h('div', { class: 'rl-sub', style: 'margin-bottom:10px' }, 'Fixas contra variáveis'),
      rosca('var(--accent) 0deg ' + fa.toFixed(1) + 'deg, var(--fn-out) ' + fa.toFixed(1) + 'deg 360deg', [['Despesas fixas', x.fixos, 'var(--accent)'], ['Despesas variáveis', x.variaveis, 'var(--fn-out)']], 'Despesas fixas contra variáveis')])
  ])]));

  var tb = h('tbody');
  x.categorias.forEach(function(c){
    var aberta = RL.aberta === c.id;
    tb.appendChild(h('tr', { class: 'clic', onclick: function(){ RL.aberta = aberta ? null : c.id; fnRender(); } }, [
      h('td', null, [h('span', { class: 'rl-seta' + (aberta ? ' on' : ''), 'aria-hidden': 'true' }, '›'), ' ', h('b', null, c.nome), c.grupo ? h('small', { class: 'fn-muted' }, ' · ' + c.grupo) : null]),
      h('td', null, [h('span', { class: 'fn-pill' + (c.fixa ? ' warn' : '') }, c.fixa ? 'Despesa fixa' : 'Despesa variável')]),
      h('td', { class: 'r fn-n' }, String(c.n)), h('td', { class: 'r fn-n' }, fnEur0(c.total)), h('td', { class: 'r fn-n fn-muted' }, fnEur0(c.total / n))]));
    if (aberta && c.id) {
      var alvo = h('td', { colspan: '5' }, [h('p', { class: 'fn-nota' }, 'A ler…')]);
      tb.appendChild(h('tr', { class: 'rl-dentro' }, [alvo]));
      apiGestao('/api/financas/movimentos?limite=200&categoria=' + c.id + '&conta=' + d.contas_fluxo.join(',') + '&de=' + d.de + '&ate=' + d.ate).then(function(r){
        clear(alvo);
        var l = h('div', { class: 'fn-lista' });
        ((r && r.movimentos) || []).forEach(function(m){
          l.appendChild(h('button', { type: 'button', class: 'fn-li', style: 'width:100%;text-align:left', onclick: function(){ fnMovJanela(m); } }, [
            h('div', { class: 'g' }, [fnMovNome(m), h('small', null, fnData(m.data) + ' · ' + ((fnConta(m.conta_id) || {}).nome || ''))]),
            h('span', { class: 'fn-n ' + (m.valor < 0 ? 'rl-neg' : 'rl-pos') }, fnEur(m.valor))]));
        });
        alvo.appendChild(l);
      }).catch(function(){ clear(alvo); alvo.appendChild(h('p', { class: 'fn-nota' }, 'Não deu para ler os movimentos.')); });
    }
  });
  corpo.appendChild(fnCard('Por categoria', 'carrega numa linha para ver os movimentos', [h('div', { class: 'fn-scroll' }, [h('table', { class: 'fn-tab' }, [
    h('thead', null, [h('tr', null, [h('th', null, 'Categoria'), h('th', null, 'Tipo'), h('th', { class: 'r' }, 'Movimentos'), h('th', { class: 'r' }, 'Total'), h('th', { class: 'r' }, 'Por mês')])]), tb])])]));
}
