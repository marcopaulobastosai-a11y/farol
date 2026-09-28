'use strict';
/**
 * Farol - a janela de criar (e corrigir) uma tarefa, um pagamento, um
 * lembrete ou uma nota.
 *
 * Havia uma janela por sitio: a linha de escrita rapida das Tarefas, a
 * janelinha do rodape dos cartoes das areas, o «+ Novo» do topo. Cada uma
 * pedia coisas diferentes, e nenhuma pedia o que o evento ja pedia - onde e,
 * quanto tempo leva, quem vai, quando lembrar, que papeis leva. Isto e uma
 * janela so, com o aspecto da dos eventos (partilha o mesmo CSS e os mesmos
 * ajudantes, os `evj*`), que mostra em cada tipo apenas os campos que fazem
 * sentido nele.
 *
 * O evento continua na sua janela - `evJanela` - porque fala com outra tabela
 * e com outra rota; `nvJanela('evento', ...)` encaminha para la, para quem
 * chama nao ter de saber a diferenca.
 *
 * Nada aqui inventa campos: tudo isto ja existia na base de dados (assuntos,
 * papeis, lembretes) ou foi acrescentado em 28 set (location, duration_min).
 */

/* Cada tipo diz o que mostra. «quando» e o prazo; «duracao» so faz sentido
   em coisas que se fazem; «dinheiro» so num pagamento. */
var NV_TIPOS = {
  tarefa: {
    nome: 'Tarefa', novo: 'Nova tarefa', abrir: 'Tarefa',
    exemplo: 'ex.: levar o carro à inspeção',
    quando: 'Prazo', duracao: true, dinheiro: false, prioridade: true, repete: true
  },
  pagamento: {
    nome: 'Pagamento', novo: 'Novo pagamento', abrir: 'Pagamento',
    exemplo: 'ex.: renda do apartamento de Algés',
    quando: 'Paga-se até', duracao: false, dinheiro: true, prioridade: true, repete: true
  },
  lembrete: {
    nome: 'Lembrete', novo: 'Novo lembrete', abrir: 'Lembrete',
    exemplo: 'ex.: anos da Olga',
    quando: 'Dia', duracao: false, dinheiro: false, prioridade: false, repete: true
  },
  nota: {
    nome: 'Nota', novo: 'Nova nota', abrir: 'Nota',
    exemplo: 'ex.: horário da escola no 1.º período',
    quando: 'Dia (opcional)', duracao: false, dinheiro: false, prioridade: false, repete: false
  }
};

var NV_PRIOS = [['normal', 'Normal'], ['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']];

var NV_REPETE = [
  ['', 'Não repete'],
  ['FREQ=DAILY', 'Todos os dias'],
  ['FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', 'Dias úteis'],
  ['FREQ=WEEKLY', 'Todas as semanas'],
  ['FREQ=MONTHLY', 'Todos os meses'],
  ['FREQ=YEARLY', 'Todos os anos']
];

/* Quem pode ficar com uma tarefa nas maos (o «de quem é»), ao contrario do
   «quem», que e toda a gente da casa por causa de quem a coisa existe. */
function nvDonos(){
  return (typeof evjPessoas === 'function' ? evjPessoas() : []).filter(function(p){ return p.can_own_tasks; });
}

/* O ponto de entrada unico: qualquer botao de «novo» chama isto. */
function nvJanela(tipo, item, opts){
  if (tipo === 'evento' || (item && item.day !== undefined && !item.tipo)){
    if (typeof evJanela !== 'function'){ toast('A agenda ainda não está pronta.'); return null; }
    return evJanela(item || null, opts || {});
  }
  return nvJanelaTarefa(tipo || (item && item.tipo) || 'tarefa', item, opts || {});
}

function nvJanelaTarefa(tipo, item, opts){
  if (typeof evjEstilo !== 'function' || typeof tfPerceber !== 'function'){
    toast('As tarefas ainda estão a carregar.');
    return null;
  }
  evjEstilo();
  if (typeof tfFecharPop === 'function') tfFecharPop();
  evjFechar();

  var cfg = NV_TIPOS[tipo] || NV_TIPOS.tarefa;
  var novo = !item || !item.id;
  var t = item || {};

  var dlg = el('dialog', 'evj');
  dlg.id = 'evjDlg';
  var c = el('div', 'evj-c');
  dlg.appendChild(c);
  c.appendChild(el('h3', null, novo ? cfg.novo : cfg.abrir));

  /* ---- o que e ---- */
  var iT = el('input'); iT.type = 'text'; iT.placeholder = cfg.exemplo;
  iT.value = t.title || opts.title || '';
  evjCampo(c, 'O que é', iT);

  /* ---- quando ---- */
  var sQ = el('div', 'evj-sec');
  sQ.appendChild(el('div', 'evj-lbl', 'Quando'));
  var lin0 = el('div', 'evj-linha');
  lin0.style.marginBottom = '8px';
  var lSem = el('label', 'evj-chk'); var cSem = el('input'); cSem.type = 'checkbox';
  lSem.appendChild(cSem); lSem.appendChild(document.createTextNode('Sem prazo'));
  lin0.appendChild(lSem);
  sQ.appendChild(lin0);

  var g1 = el('div', cfg.duracao ? 'evj-g3' : 'evj-g');
  var iD = el('input'); iD.type = 'date';
  iD.value = t.due_on || opts.due_on || '';
  var wD = evjCampo(g1, cfg.quando, iD);
  var iH = el('input'); iH.type = 'time'; iH.value = t.due_time || '';
  var wH = evjCampo(g1, 'Hora', iH);
  var sDur = null, wDur = null, iFim = null;
  if (cfg.duracao){
    sDur = evjSelect(EVJ_DURACOES);
    iFim = el('input'); iFim.type = 'time'; iFim.style.display = 'none'; iFim.style.marginTop = '6px';
    wDur = evjCampo(g1, 'Duração', sDur);
    wDur.appendChild(iFim);
  }
  sQ.appendChild(g1);

  var g1b = el('div', 'evj-g');
  var sRep = null, sPri = null;
  if (cfg.repete){ sRep = evjSelect(NV_REPETE, t.repeat_rule || ''); evjCampo(g1b, 'Repete', sRep); }
  if (cfg.prioridade){ sPri = evjSelect(NV_PRIOS, t.priority || 'normal'); evjCampo(g1b, 'Prioridade', sPri); }
  if (g1b.childNodes.length){ g1b.style.marginTop = '8px'; sQ.appendChild(g1b); }
  var dQ = el('div', 'evj-dica');
  sQ.appendChild(dQ);
  c.appendChild(sQ);

  /* Uma coisa nova estreia-se com a data de hoje a vista: o prazo e o
     lembrete ficam a mao de quem os quer, e quem nao os quer marca «Sem
     prazo». Uma nota e o contrario - nasce sem data. */
  if (novo && !iD.value && tipo !== 'nota') iD.value = tfISO(tfHoje());
  cSem.checked = novo ? !iD.value : !t.due_on;
  if (cfg.duracao && t.duration_min){
    var ex = EVJ_DURACOES.filter(function(o){ return o[0] === String(t.duration_min); })[0];
    if (ex) sDur.value = ex[0];
    else { sDur.value = 'outra'; iFim.value = t.due_time ? evjHora(evjMin(t.due_time) + Number(t.duration_min)) : ''; }
  }

  function duracao(){
    if (!cfg.duracao || cSem.checked) return null;
    if (sDur.value === 'outra'){
      var a = evjMin(iH.value), b = evjMin(iFim.value);
      if (a === null || b === null) return null;
      var d = b - a;
      if (d <= 0) d += 1440;
      return d;
    }
    return sDur.value ? Number(sDur.value) : null;
  }

  /* ---- onde e com quem ---- */
  var sO = el('div', 'evj-sec');
  sO.appendChild(el('div', 'evj-lbl', 'Onde e com quem'));
  var g2 = el('div', 'evj-g');
  var iL = el('input'); iL.type = 'text'; iL.placeholder = 'morada, sítio ou link da videochamada';
  iL.value = t.location || '';
  var wL = evjCampo(g2, 'Local', iL);
  var dL = el('div', 'evj-dica'); wL.appendChild(dL);
  var sC = evjAreas(novo ? (opts.context_id || '') : t.context_id);
  evjCampo(g2, 'Área', sC);
  sO.appendChild(g2);

  var g2b = el('div', 'evj-g');
  var sDono = el('select');
  sDono.appendChild(new Option('— ninguém —', ''));
  nvDonos().forEach(function(p){ sDono.appendChild(new Option(p.name, String(p.id))); });
  var donoAlvo = novo ? (opts.owner_id || '') : (t.owner_id || '');
  sDono.value = donoAlvo ? String(donoAlvo) : '';
  evjCampo(g2b, 'De quem é', sDono);
  g2b.style.marginTop = '8px';
  sO.appendChild(g2b);

  var quem = {};
  (t.subjects || []).forEach(function(id){ quem[id] = true; });
  if (novo && opts.subject_id) quem[opts.subject_id] = true;
  var wP = el('div'); wP.style.marginTop = '10px';
  wP.appendChild(el('label', null, 'Por causa de quem'));
  var pes = el('div', 'evj-pes');
  evjPessoas().forEach(function(p){
    var b = el('button');
    b.type = 'button';
    var av = el('span', 'evj-av', p.initials || (p.name || '?').slice(0, 1));
    av.style.background = p.color || 'var(--accent)';
    b.appendChild(av);
    b.appendChild(document.createTextNode(p.name));
    b.setAttribute('aria-pressed', quem[p.id] ? 'true' : 'false');
    if (quem[p.id]) b.classList.add('on');
    b.addEventListener('click', function(){
      quem[p.id] = !quem[p.id];
      b.classList.toggle('on', quem[p.id]);
      b.setAttribute('aria-pressed', quem[p.id] ? 'true' : 'false');
    });
    pes.appendChild(b);
  });
  if (!pes.childNodes.length) pes.appendChild(el('span', 'evj-dica', 'Não há pessoas na app.'));
  wP.appendChild(pes);
  sO.appendChild(wP);
  c.appendChild(sO);

  /* ---- o dinheiro, so num pagamento ---- */
  var iV = null, iQP = null, iRef = null;
  if (cfg.dinheiro){
    var sM = el('div', 'evj-sec');
    sM.appendChild(el('div', 'evj-lbl', 'Dinheiro'));
    var g3 = el('div', 'evj-g3');
    iV = el('input'); iV.type = 'text'; iV.inputMode = 'decimal'; iV.placeholder = '0,00';
    iV.value = t.amount != null ? String(t.amount).replace('.', ',') : '';
    evjCampo(g3, 'Valor (€)', iV);
    iQP = el('input'); iQP.type = 'text'; iQP.placeholder = 'nome de quem recebe';
    iQP.value = t.payee || '';
    evjCampo(g3, 'A quem se paga', iQP);
    iRef = el('input'); iRef.type = 'text'; iRef.placeholder = 'IBAN, referência multibanco';
    iRef.value = t.payment_ref || '';
    evjCampo(g3, 'Referência', iRef);
    sM.appendChild(g3);
    c.appendChild(sM);
  }

  /* ---- lembrete e notas ---- */
  var sL = el('div', 'evj-sec');
  sL.appendChild(el('div', 'evj-lbl', 'Lembrete e notas'));
  var sRem = el('select');
  var wRem = evjCampo(sL, 'Lembrar', sRem);
  var dR = el('div', 'evj-dica'); sL.appendChild(dR);
  var iN = el('textarea'); iN.placeholder = 'o que levar, o que preparar, contactos';
  iN.value = t.notes || '';
  var wN = evjCampo(sL, 'Notas', iN); wN.style.marginTop = '8px';
  c.appendChild(sL);

  function encherLembretes(){
    var antes = sRem.value;
    clear(sRem);
    (iH.value ? EVJ_LEMBRETES_HORA : EVJ_LEMBRETES_DIA).forEach(function(o){ sRem.appendChild(new Option(o[1], o[0])); });
    sRem.value = antes || '';
    if (sRem.value !== (antes || '')){
      var n = Number(antes), melhor = '';
      Array.prototype.forEach.call(sRem.options, function(o){ if (o.value !== '' && Number(o.value) <= n) melhor = o.value; });
      sRem.value = melhor;
    }
  }
  sRem.value = '';
  encherLembretes();
  var remGuardado = (t.reminders || []).length ? String(t.reminders[0].min) : null;
  if (remGuardado !== null){
    if (!Array.prototype.some.call(sRem.options, function(o){ return o.value === remGuardado; })){
      sRem.appendChild(new Option(evjDurTxt(Number(remGuardado)) + ' antes', remGuardado));
    }
    sRem.value = remGuardado;
  }

  /* ---- documentos ---- */
  var sD = el('div', 'evj-sec evj-drop');
  sD.appendChild(el('div', 'evj-lbl', 'Documentos'));
  var pend = { ficheiros: [], docs: [] };
  if (!novo && typeof axBloco === 'function'){
    sD.appendChild(axBloco(t, { tipo: 'tarefa', aoMudar: function(){ if (typeof renderGestao === 'function') renderGestao(); } }));
    sD.classList.remove('evj-drop');
  } else {
    sD.appendChild(evjPendentes(pend));
  }
  c.appendChild(sD);

  /* ---- acoes ---- */
  var erro = el('div', 'evj-erro');
  c.appendChild(erro);
  var ac = el('div', 'evj-acoes');
  var bC = el('button', 'btn small esq', novo ? 'Cancelar' : 'Fechar');
  bC.type = 'button';
  bC.addEventListener('click', evjFechar);
  var bOk = el('button', 'btn small primary', novo ? 'Criar' : 'Gravar');
  bOk.type = 'button';
  ac.appendChild(bC); ac.appendChild(bOk);
  c.appendChild(ac);

  /* ---- o que muda com o que se escolhe ---- */
  function acertar(){
    var sem = cSem.checked;
    wD.style.display = sem ? 'none' : '';
    wH.style.display = sem ? 'none' : '';
    if (wDur) wDur.style.display = sem ? 'none' : '';
    if (iFim) iFim.style.display = !sem && sDur.value === 'outra' ? '' : 'none';
    wRem.style.display = sem ? 'none' : '';
    dR.style.display = sem ? 'none' : '';

    var txt = '';
    if (!sem && cfg.duracao){
      var d = duracao(), a = evjMin(iH.value);
      if (a !== null && d) txt = 'Das ' + iH.value + ' às ' + evjHora(a + d) + ' · ' + evjDurTxt(d) + '.';
      else if (a === null && sDur && sDur.value) txt = 'Falta a hora.';
    }
    dQ.textContent = txt;

    var l = iL.value.trim();
    clear(dL);
    if (l){
      var a2 = el('a', null, /^https?:\/\//i.test(l) ? 'Abrir a ligação' : 'Ver no mapa');
      a2.href = /^https?:\/\//i.test(l) ? l : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l);
      a2.target = '_blank'; a2.rel = 'noopener';
      dL.appendChild(a2);
    }

    /* O lembrete de uma tarefa nao e um aviso no telemovel: e o sino na
       linha e a nota no detalhe, para quem olha saber que quis ser avisado. */
    dR.textContent = sem || sRem.value === ''
      ? ''
      : (evjAvisoTxt(iD.value, iH.value, sRem.value) || '').replace(
          'Aparece no Hoje, em «Precisa de ti», a partir de', 'Fica marcado para');
  }
  cSem.addEventListener('change', acertar);
  iH.addEventListener('change', function(){ encherLembretes(); acertar(); });
  [iD, iH, iL, sRem].concat(sDur ? [sDur, iFim] : []).forEach(function(x){
    x.addEventListener('input', acertar);
    x.addEventListener('change', acertar);
  });
  if (sDur){
    sDur.addEventListener('change', function(){
      if (sDur.value === 'outra' && !iFim.value && iH.value) iFim.value = evjHora(evjMin(iH.value) + 60);
    });
  }
  acertar();

  /* ---- gravar ---- */
  bOk.addEventListener('click', function(){
    erro.textContent = '';
    var titulo = iT.value.trim();
    if (!titulo){ erro.textContent = 'Falta dizer o que é.'; return iT.focus(); }
    var sem = cSem.checked;
    if (!sem && !iD.value){ erro.textContent = 'Falta o dia. Se não tem prazo, marca «Sem prazo».'; return iD.focus(); }
    if (!sem && cfg.duracao && sDur.value === 'outra' && !duracao()){
      erro.textContent = 'Falta a hora de início ou a de fim.'; return;
    }
    var corpo = {
      tipo: tipo,
      title: titulo,
      notes: iN.value.trim() || null,
      due_on: sem ? null : iD.value,
      due_time: sem || !iH.value ? null : iH.value,
      duration_min: sem ? null : duracao(),
      location: iL.value.trim() || null,
      context_id: sC.value ? Number(sC.value) : null,
      owner_id: sDono.value ? Number(sDono.value) : null,
      subjects: Object.keys(quem).filter(function(k){ return quem[k]; }).map(Number),
      /* Criada de dentro de um projeto, fica nesse projeto. Nao ha campo na
         janela: quem abriu daqui ja disse onde estava. */
      project_id: novo ? (opts.project_id || null) : (t.project_id || null),
      reminders: sem || sRem.value === '' ? [] : [{ min: Number(sRem.value) }]
    };
    if (cfg.repete) corpo.repeat_rule = sRep.value || null;
    if (cfg.prioridade) corpo.priority = sPri.value || 'normal';
    if (cfg.dinheiro){
      corpo.amount = iV.value.trim() ? iV.value.trim() : null;
      corpo.payee = iQP.value.trim() || null;
      corpo.payment_ref = iRef.value.trim() || null;
    }
    bOk.disabled = true;
    var url = novo ? '/api/gestao/tarefas' : '/api/gestao/tarefas/' + t.id;
    apiGestao(url, {
      method: novo ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function(r){
      /* A rota devolve a gestao inteira; a tarefa nova e a que tem este id. */
      if (r && r.tasks) G = r;
      var id = novo ? nvIdNovo(titulo) : t.id;
      if (!novo || (!pend.ficheiros.length && !pend.docs.length) || !id) return { falhou: '' };
      return evjEnviarPendentes({ id: id }, pend, 'tarefa');
    }).then(function(res){
      evjFechar();
      toast(cfg.nome + (novo ? ' criad' + (tipo === 'nota' ? 'a' : 'o') : ' gravad' + (tipo === 'nota' ? 'a' : 'o')) + '.' +
            (res && res.falhou ? ' ' + res.falhou : ''));
      if (typeof renderGestao === 'function') renderGestao();
    }).catch(function(er){
      bOk.disabled = false;
      erro.textContent = (er && er.message) || 'Não deu para gravar.';
    });
  });

  dlg.addEventListener('cancel', function(){ setTimeout(evjFechar, 0); });
  document.body.appendChild(dlg);
  dlg.showModal();
  iT.focus();
  return dlg;
}

/* A rota de criar devolve a gestao toda, nao o id. A tarefa nova e a mais
   recente com este titulo - basta para lhe agarrar os papeis. */
function nvIdNovo(titulo){
  var iguais = ((window.G && G.tasks) || []).filter(function(x){ return x.title === titulo; });
  if (!iguais.length) return null;
  return iguais.reduce(function(a, b){ return b.id > a.id ? b : a; }).id;
}
