'use strict';
/* Farol — a papelada de uma empresa.
 *
 * O cartão que diz, numa sub-área do Profissional, que papéis é que se espera
 * ter e quais é que faltam. Duas listas feitas: uma para uma empresa dele
 * (certidão, RCBE, licenças, seguros, contas) e outra para o sítio onde
 * trabalha (contrato, recibos, carro, apólices de que é beneficiário). Mal se
 * escolhe o que a sub-área é, a lista é copiada para lá e passa a ser dela.
 *
 * O que falta não vira tarefa sozinho: a linha fica a laranja e tem ali um
 * botão para criar a tarefa quando ele quiser. Foi escolha dele, e é a
 * escolha certa — uma lista destas tem sempre linhas que não se aplicam, e
 * nascer trabalho de cada uma delas enchia as Tarefas de ruído.
 *
 * Segue o padrão dos outros módulos: não toca no app.js, pendura-se no ecrã
 * da área pela função ppCartao(subAreaId) e reaproveita os globais.
 */

var PP = { dados: {}, aberto: {}, bloco: {} };

var PP_CSS =
  '.pp-topo{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;padding:0 16px 10px}' +
  '.pp-bloco{border-top:1px solid var(--line-soft);padding:.55rem 16px .2rem}' +
  '.pp-bloco:first-of-type{border-top:0}' +
  '.pp-bh{display:flex;align-items:baseline;gap:.5rem;cursor:pointer;width:100%;background:none;border:0;padding:.2rem 0;text-align:left;color:inherit;font:inherit}' +
  '.pp-bn{font-weight:600;font-size:.9375rem;color:var(--ink)}' +
  '.pp-bc{font-family:var(--mono);font-size:var(--fs-mono);color:var(--muted);letter-spacing:.05em}' +
  '.pp-l{display:flex;align-items:baseline;gap:.6rem;padding:.38rem 0;border-top:1px solid var(--line-soft)}' +
  '.pp-l:first-child{border-top:0}' +
  '.pp-p{flex:0 0 auto;width:9px;height:9px;border-radius:50%;margin-top:.35rem;background:var(--line)}' +
  '.pp-p.tem{background:var(--good,#2E7D54)}' +
  '.pp-p.falta{background:var(--warn,#B07A1A)}' +
  '.pp-p.falta.obrig{background:var(--bad,#A8322B)}' +
  '.pp-p.caduca{background:var(--warn,#B07A1A)}' +
  '.pp-p.caducado{background:var(--bad,#A8322B)}' +
  '.pp-p.dispensado{background:transparent;border:1px solid var(--line)}' +
  '.pp-c{flex:1;min-width:0}' +
  '.pp-t{color:var(--ink);font-size:.9375rem}' +
  '.pp-l.off .pp-t{color:var(--muted);text-decoration:line-through}' +
  '.pp-ob{font-family:var(--mono);font-size:.625rem;letter-spacing:.08em;text-transform:uppercase;color:var(--bad,#A8322B);margin-left:.4rem}' +
  '.pp-s{display:block;font-size:.8125rem;color:var(--muted);margin-top:.1rem}' +
  '.pp-s a{color:var(--accent-ink);text-decoration:none;border-bottom:1px solid var(--line)}' +
  '.pp-s a:hover{border-bottom-color:var(--accent)}' +
  '.pp-s .aviso{color:var(--warn,#B07A1A)}' +
  '.pp-s .mau{color:var(--bad,#A8322B)}' +
  '.pp-a{flex:0 0 auto;display:flex;gap:.3rem;align-items:center;opacity:0;transition:opacity .12s}' +
  '.pp-l:hover .pp-a,.pp-l:focus-within .pp-a{opacity:1}' +
  '.pp-a .btn{padding:.12rem .45rem;font-size:.75rem}' +
  '.pp-vazio{padding:1.4rem 16px;color:var(--muted);font-size:.9375rem}' +
  '.pp-soltos{border-top:1px solid var(--line-soft);padding:.6rem 16px .8rem;font-size:.8125rem;color:var(--muted)}' +
  '.pp-sem{text-decoration:underline dotted;text-underline-offset:2px;cursor:help}';

(function ppEstilo(){
  if (document.getElementById('pp-css')) return;
  var s = document.createElement('style');
  s.id = 'pp-css';
  s.textContent = PP_CSS;
  document.head.appendChild(s);
}());

function ppApi(url, metodo, corpo){
  return fetch(url, {
    method: metodo || 'GET',
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'same-origin',
    body: corpo ? JSON.stringify(corpo) : undefined
  }).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){
      if (!r.ok) throw new Error(j.error || 'Não foi possível.');
      return j;
    });
  });
}

var PP_ESTADO = {
  tem: 'está cá',
  falta: 'falta',
  caduca: 'a acabar',
  caducado: 'caducado',
  dispensado: 'não se aplica'
};

function ppData(iso){
  if (!iso) return '';
  var m = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
  return Number(iso.slice(8,10)) + ' ' + m[Number(iso.slice(5,7)) - 1] + ' ' + iso.slice(2,4);
}

/* Quantos dias faltam (ou passaram). */
function ppDias(iso){
  var hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.round((new Date(iso + 'T00:00:00') - hoje) / 86400000);
}

/* O nome do papel, a abrir o ficheiro digitalizado numa aba nova. O ficheiro
   mora na caixa que o trouxe (inbox), nao no documento: e de la que se le.
   Quando o documento e so ficha, sem papel digitalizado, fica texto simples e
   diz-se porque e que nao abre. */
function ppNomeDoc(d){
  if (!d) return el('span', null, '');
  if (!d.inbox_id){
    var t = el('span', 'pp-sem', d.name);
    t.title = 'Este documento está no arquivo mas não tem ficheiro para abrir.';
    return t;
  }
  var a = el('a', null, d.name);
  a.href = '/api/inbox/' + d.inbox_id + '/ficheiro';
  a.target = '_blank';
  a.rel = 'noopener';
  a.title = 'Abrir o ficheiro';
  return a;
}

/* A linha de baixo: o papel que está lá, ou o que falta dizer. */
function ppLegenda(l){
  var s = el('small', 'pp-s');
  if (l.estado === 'dispensado'){ s.textContent = 'Não se aplica a esta empresa.'; return s; }
  if (l.estado === 'falta'){
    s.textContent = l.nota || 'Não há nenhum papel destes arrumado aqui.';
    return s;
  }
  var d = (l.docs || [])[0];
  if (!d) { s.textContent = l.nota || ''; return s; }
  s.appendChild(ppNomeDoc(d));
  if (l.estado === 'caducado'){
    s.appendChild(el('span', 'mau', ' · caducou a ' + ppData(l.ate)));
  } else if (l.estado === 'caduca' && l.ate){
    var dias = ppDias(l.ate);
    s.appendChild(el('span', 'aviso', ' · acaba a ' + ppData(l.ate) + (dias >= 0 ? ' (' + dias + ' dias)' : '')));
  } else if (l.estado === 'caduca' && l.desde){
    s.appendChild(el('span', 'aviso', ' · de ' + ppData(l.desde) + ', renova todos os anos'));
  } else if (l.ate){
    s.appendChild(el('span', null, ' · até ' + ppData(l.ate)));
  } else if (d.issued_on){
    s.appendChild(el('span', null, ' · ' + ppData(d.issued_on)));
  }
  if ((l.docs || []).length > 1) s.appendChild(el('span', null, ' · e mais ' + (l.docs.length - 1)));
  return s;
}

/* Criar a tarefa de tratar deste papel. Não nasce sozinha: é ele que carrega. */
function ppTarefa(ctx, nome, l){
  var o = {
    title: (l.estado === 'falta' ? 'Obter ' : 'Renovar ') + l.titulo.charAt(0).toLowerCase() + l.titulo.slice(1),
    tipo: 'tarefa',
    context_id: ctx,
    notes: 'Papelada de ' + nome + (l.nota ? '\n' + l.nota : '')
  };
  if (l.ate) o.due_on = l.ate;
  return ppApi('/api/gestao/tarefas', 'POST', o).then(function(){
    if (typeof toast === 'function') toast('Tarefa criada em ' + nome + '.');
    if (typeof window.recarregar === 'function') window.recarregar();
  }, function(e){ if (typeof toast === 'function') toast(e.message); });
}

function ppLinha(d, l){
  var linha = el('div', 'pp-l' + (l.estado === 'dispensado' ? ' off' : ''));
  var p = el('span', 'pp-p ' + l.estado + (l.obrigatorio ? ' obrig' : ''));
  p.title = PP_ESTADO[l.estado] || l.estado;
  linha.appendChild(p);
  var c = el('div', 'pp-c');
  var t = el('div', 'pp-t', l.titulo);
  if (l.obrigatorio && l.estado !== 'dispensado') t.appendChild(el('span', 'pp-ob', 'obrigatório'));
  c.appendChild(t);
  c.appendChild(ppLegenda(l));
  linha.appendChild(c);

  var acts = el('div', 'pp-a');
  var mexer = function(corpo){
    return ppApi('/api/papelada/linha/' + l.id, 'PATCH', corpo)
      .then(function(j){ PP.dados[d.contexto.id] = j; ppRedesenhar(d.contexto.id); },
            function(e){ if (typeof toast === 'function') toast(e.message); });
  };
  if (l.estado === 'falta' || l.estado === 'caduca' || l.estado === 'caducado'){
    var bT = el('button', 'btn small', 'Tarefa');
    bT.type = 'button';
    bT.title = 'Criar a tarefa de tratar disto';
    bT.addEventListener('click', function(){ ppTarefa(d.contexto.id, d.contexto.nome, l); });
    acts.appendChild(bT);
  }
  var bD = el('button', 'btn small', l.dispensado ? 'Repor' : 'Não se aplica');
  bD.type = 'button';
  bD.addEventListener('click', function(){ mexer({ dispensado: !l.dispensado }); });
  acts.appendChild(bD);
  linha.appendChild(acts);
  return linha;
}

function ppBloco(d, nome, linhas){
  var caixa = el('div', 'pp-bloco');
  var chave = d.contexto.id + ':' + nome;
  var aberto = PP.bloco[chave] !== false;
  var h = el('button', 'pp-bh');
  h.type = 'button';
  h.appendChild(el('span', 'pp-bn', nome));
  var faltam = linhas.filter(function(l){ return l.estado === 'falta' || l.estado === 'caducado'; }).length;
  var tem = linhas.filter(function(l){ return l.estado === 'tem'; }).length;
  h.appendChild(el('span', 'pp-bc', tem + ' de ' + linhas.filter(function(l){ return l.estado !== 'dispensado'; }).length +
    (faltam ? ' · faltam ' + faltam : '')));
  h.addEventListener('click', function(){ PP.bloco[chave] = !aberto; ppRedesenhar(d.contexto.id); });
  caixa.appendChild(h);
  if (aberto) linhas.forEach(function(l){ caixa.appendChild(ppLinha(d, l)); });
  return caixa;
}

/* Escolher o que a sub-área é. É isto que semeia a lista. */
function ppEscolherPapel(ctxId, atual){
  var caixa = el('div', 'pp-vazio');
  caixa.appendChild(el('p', null, 'Esta sub-área ainda não diz o que é. Diz, e o Farol mostra a papelada que se espera dela.'));
  var acts = el('div', 'fn-acoes');
  acts.style.marginTop = '.6rem';
  [['empresa', 'É uma empresa minha'], ['empregador', 'É onde eu trabalho']].forEach(function(o){
    var b = el('button', 'btn small' + (atual === o[0] ? ' primary' : ''), o[1]);
    b.type = 'button';
    b.addEventListener('click', function(){
      b.disabled = true;
      ppApi('/api/papelada/' + ctxId + '/papel', 'PATCH', { papel: o[0] }).then(function(j){
        PP.dados[ctxId] = j; ppRedesenhar(ctxId);
      }, function(e){ b.disabled = false; if (typeof toast === 'function') toast(e.message); });
    });
    acts.appendChild(b);
  });
  caixa.appendChild(acts);
  return caixa;
}

function ppCorpo(card, ctxId){
  var d = PP.dados[ctxId];
  if (!d){ card.appendChild(el('p', 'pp-vazio', 'A ler a papelada…')); return; }
  if (!d.contexto.papel){ card.appendChild(ppEscolherPapel(ctxId, null)); return; }

  var topo = el('div', 'pp-topo');
  topo.appendChild(el('span', 'fn-nota', d.contexto.papel === 'empresa'
    ? 'O que se espera ter de uma empresa tua.'
    : 'O que se espera guardar de onde trabalhas.'));
  var esp = el('span'); esp.style.flex = '1'; topo.appendChild(esp);
  var bN = el('button', 'btn small', '+ Papel');
  bN.type = 'button';
  bN.title = 'Acrescentar uma linha que o modelo não previu';
  bN.addEventListener('click', function(){ ppNovaLinha(ctxId); });
  topo.appendChild(bN);
  card.appendChild(topo);

  var blocos = [];
  d.linhas.forEach(function(l){
    var b = blocos.filter(function(x){ return x.nome === l.bloco; })[0];
    if (!b) { b = { nome: l.bloco, linhas: [] }; blocos.push(b); }
    b.linhas.push(l);
  });
  blocos.forEach(function(b){ card.appendChild(ppBloco(d, b.nome, b.linhas)); });

  if (d.soltos && d.soltos.length){
    var s = el('div', 'pp-soltos');
    s.appendChild(el('b', null, d.soltos.length + (d.soltos.length === 1 ? ' papel' : ' papéis') + ' fora da lista'));
    s.appendChild(el('span', null, ' — '));
    d.soltos.slice(0, 4).forEach(function(x, i){
      if (i) s.appendChild(el('span', null, ' · '));
      s.appendChild(ppNomeDoc(x));
    });
    if (d.soltos.length > 4) s.appendChild(el('span', null, ' …'));
    card.appendChild(s);
  }
}

function ppNovaLinha(ctxId){
  var d = PP.dados[ctxId];
  var blocos = [];
  (d.linhas || []).forEach(function(l){ if (blocos.indexOf(l.bloco) < 0) blocos.push(l.bloco); });
  var tit = el('input'); tit.type = 'text'; tit.className = 'fn-in'; tit.placeholder = 'Que papel é';
  var sb = el('select'); sb.className = 'fn-sel';
  blocos.concat(['Outros']).forEach(function(b){ var o = el('option', null, b); o.value = b; sb.appendChild(o); });
  var pr = el('input'); pr.type = 'text'; pr.className = 'fn-in'; pr.placeholder = 'palavras que o encontram (ex.: alvará|licença)';
  var ob = el('input'); ob.type = 'checkbox';
  if (typeof fnJanela !== 'function'){ if (typeof toast === 'function') toast('Não dá para abrir a janela aqui.'); return; }
  var lb = el('label', 'fn-check');
  lb.appendChild(ob);
  lb.appendChild(el('span', null, 'A lei obriga a ter'));
  fnJanela('Acrescentar um papel', [
    fnCampo('Nome', tit), fnCampo('Bloco', sb), fnCampo('Como se encontra', pr), lb
  ], [{ txt: 'Acrescentar', pri: true, fn: function(){
    if (!tit.value.trim()){ if (typeof toast === 'function') toast('Falta o nome.'); return false; }
    return ppApi('/api/papelada/' + ctxId, 'POST', {
      titulo: tit.value.trim(), bloco: sb.value, procura: pr.value.trim() || null, obrigatorio: ob.checked
    }).then(function(j){ PP.dados[ctxId] = j; ppRedesenhar(ctxId); },
            function(e){ if (typeof toast === 'function') toast(e.message); return false; });
  } }]);
}

function ppRedesenhar(ctxId){
  var card = document.querySelector('[data-pp="' + ctxId + '"]');
  if (!card) return;
  var h = card.querySelector('.ae-wh');
  while (card.lastChild && card.lastChild !== h) card.removeChild(card.lastChild);
  var d = PP.dados[ctxId];
  if (h && d) {
    var ws = h.querySelector('.ae-ws span');
    if (ws) ws.textContent = ppResumo(d);
  }
  if (card.classList.contains('ae-fechado')) return;
  ppCorpo(card, ctxId);
}

function ppResumo(d){
  if (!d) return '';
  if (!d.contexto.papel) return 'por dizer o que é';
  var r = d.resumo || {};
  var faltam = (r.falta || 0) + (r.caducado || 0);
  return [
    (r.tem || 0) + ' arrumados',
    faltam ? faltam + ' por ter' : '',
    r.caduca ? r.caduca + ' a acabar' : '',
    r.faltaObrig ? r.faltaObrig + ' obrigatórios em falta' : ''
  ].filter(Boolean).join(' · ');
}

/* O cartão, para o ecrã da área o pendurar numa sub-área. Devolve null quando
   não faz sentido — numa sub-área que não é empresa nem emprego, só aparece
   depois de ele dizer o que ela é, e isso faz-se aqui mesmo. */
function ppCartao(ctxId, a){
  if (!ctxId) return null;
  var card = el('div', 'card ae-w');
  card.setAttribute('data-pp', String(ctxId));
  var aberto = PP.aberto[ctxId] !== false;
  if (!aberto) card.className += ' ae-fechado';
  var h = el('button', 'ae-wh');
  h.type = 'button';
  var ic = el('span', 'ae-wi documentos');
  ic.innerHTML = typeof aeIcone === 'function'
    ? aeIcone('<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>', 15) : '';
  h.appendChild(ic);
  h.appendChild(el('span', 'ae-wt', 'Papelada da empresa'));
  var s = el('span', 'ae-ws');
  s.appendChild(el('span', '', ppResumo(PP.dados[ctxId])));
  var seta = el('span', 'ae-seta');
  if (typeof aeIcone === 'function') seta.innerHTML = aeIcone('<path d="M6 9l6 6 6-6"/>', 14);
  s.appendChild(seta);
  h.appendChild(s);
  h.addEventListener('click', function(){
    PP.aberto[ctxId] = !aberto;
    card.classList.toggle('ae-fechado');
    ppRedesenhar(ctxId);
  });
  card.appendChild(h);
  if (aberto) ppCorpo(card, ctxId);
  /* Lê-se uma vez por sub-área e fica em memória; muda quando ele mexe. */
  if (!PP.dados[ctxId]){
    ppApi('/api/papelada/' + ctxId).then(function(j){
      PP.dados[ctxId] = j; ppRedesenhar(ctxId);
    }, function(){ PP.dados[ctxId] = null; });
  }
  return card;
}
