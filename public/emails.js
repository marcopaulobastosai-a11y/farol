/* Farol — enviar os papeis de um pagamento a quem se paga (27 set).
 *
 * Duas coisas:
 *  - Administracao › Destinatarios: a ligacao ao Gmail e a lista de a quem
 *    se mandam os emails dos pagamentos, cada um com o seu texto e com a
 *    regra de quando (manual, rever, sozinho).
 *  - No detalhe de um pagamento: o bloco «Enviar a quem se paga», com o
 *    email ja preenchido para rever e enviar, e o que ja foi enviado.
 *
 * Nao toca nos outros ficheiros: cria a sua secao e o seu botao, e embrulha
 * o tfRenderDetalhe das Tarefas para juntar o bloco ao painel.
 */
'use strict';

var EM = { dest: [], gmail: null, carregado: false, pag: {}, aLer: {} };

var EM_QUANDO = [['manual', 'Só quando eu carregar em Enviar'], ['rever', 'Preparar e esperar que eu reveja'], ['auto', 'Enviar sozinho quando o comprovativo for aprovado']];
var EM_QUANDO_CURTO = { manual: 'manual', rever: 'pede para rever', auto: 'envia sozinho' };
var EM_CAMPOS = ['{nome}', '{titulo}', '{total}', '{data do pagamento}', '{prazo}', '{meses}', '{lista das faturas}', '{referência}', '{pessoa}'];

var EM_CSS =
  '#view-destinatarios .em-card{margin-bottom:14px}' +
  '#view-destinatarios .em-linha{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line-soft)}' +
  '#view-destinatarios .em-linha:last-child{border-bottom:0}' +
  '#view-destinatarios .em-corpo{flex:1;min-width:0}' +
  '#view-destinatarios .em-nome{font-weight:600}' +
  '#view-destinatarios .em-sub{font-size:.78rem;color:var(--muted)}' +
  '#view-destinatarios .em-off{opacity:.5}' +
  '.em-dlg{border:none;border-radius:14px;padding:0;max-width:44rem;width:calc(100% - 2rem);box-shadow:0 18px 48px rgba(15,23,32,.22)}' +
  '.em-dlg::backdrop{background:rgba(15,23,32,.38)}' +
  '.em-dlgc{background:var(--surface);padding:1.25rem;border-radius:14px;display:flex;flex-direction:column;gap:.7rem;max-height:86vh;overflow:auto}' +
  '.em-dlgc h3{margin:0;font-size:1.0625rem}' +
  '.em-dlgc label{display:block;font-size:.75rem;color:var(--muted);margin-bottom:.2rem}' +
  '.em-dlgc input[type=text],.em-dlgc input[type=email],.em-dlgc select,.em-dlgc textarea{width:100%;box-sizing:border-box;padding:.5rem .6rem;border:1px solid var(--line);border-radius:8px;background:var(--ground);color:var(--ink);font:inherit;font-size:.875rem}' +
  '.em-dlgc textarea{min-height:12rem;line-height:1.45;resize:vertical}' +
  '.em-dlgc .em-2{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}' +
  '.em-dlgc .em-chk{display:flex;gap:1rem;flex-wrap:wrap;font-size:.85rem}' +
  '.em-dlgc .em-chk label{display:flex;gap:.4rem;align-items:center;color:var(--ink);font-size:.85rem;margin:0}' +
  '.em-dlgc .em-campos{display:flex;gap:4px;flex-wrap:wrap;font-family:var(--mono);font-size:.7rem;color:var(--muted)}' +
  '.em-dlgc .em-campos span{border:1px solid var(--line);border-radius:5px;padding:1px 5px}' +
  '.em-dlga{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.25rem;flex-wrap:wrap}' +
  '.em-anx{display:flex;flex-direction:column;gap:4px;font-size:.84rem}' +
  '.em-anx label{display:flex;gap:.45rem;align-items:center;color:var(--ink);margin:0;font-size:.84rem}' +
  '.em-anx small{color:var(--warn)}' +
  '.tf-det .em-bloco{border:1px solid var(--accent);border-radius:10px;padding:12px;background:var(--surface-2);display:flex;flex-direction:column;gap:8px;font-size:.8125rem}' +
  '.tf-det .em-bloco .em-top{display:flex;align-items:center;gap:8px}' +
  '.tf-det .em-bloco .em-top b{font-weight:600}' +
  '.tf-det .em-bloco .em-top .pill{margin-left:auto}' +
  '.tf-det .em-bloco .em-l{color:var(--muted)}' +
  '.tf-det .em-bloco select{font:inherit;font-size:.8125rem;border:1px solid var(--line);border-radius:7px;padding:4px 6px;background:var(--surface);color:var(--ink);max-width:100%}' +
  '.tf-det .em-bloco .em-acts{display:flex;gap:6px;flex-wrap:wrap}' +
  '.tf-det .em-hist{display:flex;flex-direction:column;gap:3px;font-size:.75rem;color:var(--muted)}' +
  '.tf-det .em-hist .erro{color:var(--bad)}';

function emEstilo(){
  if (document.getElementById('emCss')) return;
  var s = document.createElement('style'); s.id = 'emCss'; s.textContent = EM_CSS;
  document.head.appendChild(s);
}

/* ---------------- Administracao › Destinatarios ---------------- */
function emMontar(){
  if (document.getElementById('view-destinatarios')) return;
  emEstilo();
  if (window.TITLES) TITLES.destinatarios = ['Destinatários', 'A quem se mandam os emails dos pagamentos'];
  var nav = $('nav');
  if (!nav) return;
  var b = el('button', null, ' Destinatários');
  b.dataset.view = 'destinatarios';
  var ic = document.createElement('span');
  ic.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5l8.5 6 8.5-6"/></svg>';
  b.insertBefore(ic.firstChild, b.firstChild);
  var areas = nav.querySelector('[data-view="areas"]');
  if (areas) nav.insertBefore(b, areas.nextSibling); else nav.appendChild(b);

  var sec = el('section', 'view'); sec.id = 'view-destinatarios'; sec.hidden = true;
  var c1 = el('div', 'card em-card'); c1.id = 'emGmail';
  var c2 = el('div', 'card em-card');
  var h = el('header');
  h.appendChild(el('h3', null, 'Destinatários'));
  var novo = el('button', 'btn primary', 'Novo'); novo.type = 'button';
  novo.addEventListener('click', function(){ emJanelaDest(null); });
  h.appendChild(novo);
  c2.appendChild(h);
  c2.appendChild(el('p', 'em-sub', 'A quem se manda o email de um pagamento, com as faturas e o comprovativo. O pagamento encontra o seu destinatário pelos termos (o nome de quem recebe ou o título) ou por escolha no próprio pagamento.'));
  var lista = el('div'); lista.id = 'emLista';
  c2.appendChild(lista);
  sec.appendChild(c1); sec.appendChild(c2);
  var irmao = document.querySelector('.view');
  (irmao ? irmao.parentNode : document.body).appendChild(sec);
}

function emCarregar(){
  return Promise.all([
    apiGestao('/api/destinatarios'),
    apiGestao('/api/gmail/estado')
  ]).then(function(r){
    EM.dest = r[0].destinatarios || [];
    EM.gmail = r[1];
    EM.carregado = true;
    emRender();
  }).catch(function(){});
}

function emRender(){
  var g = $('emGmail');
  if (g){
    clear(g);
    var hd = el('header'); hd.appendChild(el('h3', null, 'Gmail')); g.appendChild(hd);
    var s = EM.gmail || {};
    if (!s.configurado){
      g.appendChild(el('p', 'em-sub', 'Ainda não dá para ligar: falta o GOOGLE_CLIENT_SECRET nas Variables do Railway (ver as instruções no projeto).'));
    } else if (s.ligado){
      var l = el('div', 'em-linha');
      var cp = el('div', 'em-corpo');
      cp.appendChild(el('div', 'em-nome', 'Ligado · ' + (s.email || s.remetente)));
      cp.appendChild(el('div', 'em-sub', 'O Farol só pode enviar emails por esta conta. Não lê a caixa de correio.'));
      l.appendChild(cp);
      var bd = el('button', 'btn danger', 'Desligar'); bd.type = 'button';
      bd.addEventListener('click', function(){
        if (!window.confirm('Desligar o Gmail? Os emails deixam de sair até o voltares a ligar.')) return;
        apiGestao('/api/gmail/desligar', { method: 'POST' }).then(emCarregar).catch(function(e){ toast(e.message); });
      });
      l.appendChild(bd);
      g.appendChild(l);
    } else {
      g.appendChild(el('p', 'em-sub', 'Os emails saem sempre de ' + s.remetente + '. Na Google, entra com essa conta e autoriza o Farol a enviar emails.'));
      var bl = el('a', 'btn primary', 'Ligar ao Gmail');
      bl.href = '/api/gmail/ligar';
      g.appendChild(bl);
      if (s.redirect) g.appendChild(el('p', 'em-sub', 'Endereço de retorno a autorizar na Google: ' + s.redirect));
    }
  }
  var box = $('emLista');
  if (!box) return;
  clear(box);
  if (!EM.dest.length) box.appendChild(el('p', 'vazio', 'Ainda não há destinatários.'));
  EM.dest.forEach(function(d){
    var w = el('div', 'em-linha' + (d.ativo ? '' : ' em-off'));
    var cp = el('div', 'em-corpo');
    cp.appendChild(el('div', 'em-nome', d.nome));
    cp.appendChild(el('div', 'em-sub', [d.email, d.termos ? 'pagamentos de: ' + d.termos : null, EM_QUANDO_CURTO[d.quando] || d.quando].filter(Boolean).join(' · ')));
    w.appendChild(cp);
    var be = el('button', 'btn', 'Editar'); be.type = 'button';
    be.addEventListener('click', function(){ emJanelaDest(d); });
    var ba = el('button', 'btn danger', 'Apagar'); ba.type = 'button';
    ba.addEventListener('click', function(){
      if (!window.confirm('Apagar «' + d.nome + '»?')) return;
      apiGestao('/api/destinatarios/' + d.id, { method: 'DELETE' }).then(function(r){ EM.dest = r.destinatarios || []; emRender(); })
        .catch(function(e){ toast(e.message); });
    });
    w.appendChild(be); w.appendChild(ba);
    box.appendChild(w);
  });
}

function emCampo(cx, rotulo, no){
  var d = el('div');
  var lb = el('label', null, rotulo);
  if (!no.id) no.id = 'em' + Math.random().toString(36).slice(2, 8);
  lb.htmlFor = no.id;
  d.appendChild(lb); d.appendChild(no);
  cx.appendChild(d);
  return d;
}
function emInput(tipo, valor, ph){
  var i = el('input'); i.type = tipo; i.value = valor || ''; if (ph) i.placeholder = ph; return i;
}

function emJanelaDest(d){
  var dlg = el('dialog', 'em-dlg');
  var cx = el('div', 'em-dlgc');
  cx.appendChild(el('h3', null, d ? 'Editar destinatário' : 'Novo destinatário'));
  var duas = el('div', 'em-2');
  var iNome = emInput('text', d && d.nome, 'ex.: Ricardo Costa (senhorio)');
  var iEmail = emInput('email', d && d.email, 'email de quem recebe');
  emCampo(duas, 'Nome', iNome); emCampo(duas, 'Email', iEmail);
  cx.appendChild(duas);
  var duas2 = el('div', 'em-2');
  var iCc = emInput('text', d && d.cc, 'opcional, separados por vírgula');
  var iTermos = emInput('text', d && d.termos, 'ex.: Ricardo Costa; despesas da casa');
  emCampo(duas2, 'Cc', iCc); emCampo(duas2, 'Pagamentos de (nome de quem recebe ou título)', iTermos);
  cx.appendChild(duas2);
  var sQ = el('select');
  EM_QUANDO.forEach(function(q){ var o = new Option(q[1], q[0]); if ((d ? d.quando : 'manual') === q[0]) o.selected = true; sQ.appendChild(o); });
  emCampo(cx, 'Quando se envia', sQ);
  var iAss = emInput('text', d && d.assunto, '{titulo} — {total}');
  emCampo(cx, 'Assunto', iAss);
  var iTxt = el('textarea');
  iTxt.value = (d && d.texto) || 'Olá {nome},\n\nSegue o comprovativo do pagamento de {titulo}, no valor de {total}, feito a {data do pagamento}.\n\n{lista das faturas}\n\nObrigado,\nMarco';
  emCampo(cx, 'Texto', iTxt);
  var campos = el('div', 'em-campos');
  campos.appendChild(document.createTextNode('Campos: '));
  EM_CAMPOS.forEach(function(c){ campos.appendChild(el('span', null, c)); });
  cx.appendChild(campos);
  var chk = el('div', 'em-chk');
  function caixa(rot, v){ var l = el('label'); var i = el('input'); i.type = 'checkbox'; i.checked = v; l.appendChild(i); l.appendChild(document.createTextNode(rot)); chk.appendChild(l); return i; }
  var cF = caixa('Anexar faturas', d ? d.anexar_faturas : true);
  var cC = caixa('Anexar comprovativo', d ? d.anexar_comprovativo : true);
  var cA = caixa('Ativo', d ? d.ativo : true);
  cx.appendChild(chk);
  var pe = el('div', 'em-dlga');
  var bC = el('button', 'btn', 'Cancelar'); bC.type = 'button';
  bC.addEventListener('click', function(){ dlg.close(); dlg.remove(); });
  var bG = el('button', 'btn primary', 'Gravar'); bG.type = 'button';
  bG.addEventListener('click', function(){
    var corpo = { nome: iNome.value.trim(), email: iEmail.value.trim(), cc: iCc.value.trim(), termos: iTermos.value.trim(),
      quando: sQ.value, assunto: iAss.value.trim(), texto: iTxt.value, anexar_faturas: cF.checked, anexar_comprovativo: cC.checked, ativo: cA.checked };
    if (!corpo.nome || !corpo.email){ toast('Falta o nome ou o email.'); return; }
    apiGestao(d ? '/api/destinatarios/' + d.id : '/api/destinatarios', {
      method: d ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo)
    }).then(function(r){ EM.dest = r.destinatarios || EM.dest; EM.pag = {}; emRender(); dlg.close(); dlg.remove(); })
      .catch(function(e){ toast(e.message || 'Não foi possível gravar.'); });
  });
  pe.appendChild(bC); pe.appendChild(bG);
  cx.appendChild(pe);
  dlg.appendChild(cx);
  dlg.addEventListener('cancel', function(){ setTimeout(function(){ dlg.remove(); }, 0); });
  document.body.appendChild(dlg);
  dlg.showModal();
  iNome.focus();
}

/* ---------------- no detalhe de um pagamento ---------------- */
function emLerPagamento(id, forcar){
  var c = EM.pag[id];
  if (c && !forcar && Date.now() - c.t < 30000) return;
  if (EM.aLer[id]) return;
  EM.aLer[id] = true;
  apiGestao('/api/emails/pagamento/' + id).then(function(d){
    EM.pag[id] = { t: Date.now(), d: d };
  }).catch(function(){ EM.pag[id] = { t: Date.now(), d: null }; })
    .then(function(){ EM.aLer[id] = false; emDesenharBloco(id); });
}

function emDesenharBloco(id){
  var det = $('tfDet');
  if (!det || det.hidden || !window.TF || TF.aberta !== id) return;
  var velho = det.querySelector('.em-sec');
  var sec = el('div', 'tf-sec em-sec');
  sec.appendChild(el('div', 'tf-lbl', 'Email a quem se paga'));
  var c = EM.pag[id];
  var b = el('div', 'em-bloco');
  sec.appendChild(b);
  if (!c){ b.appendChild(el('span', 'em-l', 'A preparar…')); }
  else if (!c.d){ b.appendChild(el('span', 'em-l', 'Não foi possível preparar o email.')); }
  else {
    var d = c.d;
    var enviados = (d.envios || []).filter(function(e){ return e.estado === 'enviado'; });
    var top = el('div', 'em-top');
    top.appendChild(el('b', null, d.destinatario ? d.destinatario.nome : 'Sem destinatário'));
    top.appendChild(enviados.length ? pill('enviado ' + enviados[0].quando.slice(8, 10) + '/' + enviados[0].quando.slice(5, 7), 'good')
      : (d.pagamento.pago ? pill('por enviar', 'warn') : pill('ainda por pagar', '')));
    b.appendChild(top);
    /* Escolher o destinatario deste pagamento (ou deixar pelos termos). */
    var sD = el('select');
    sD.setAttribute('aria-label', 'Destinatário');
    var oA = new Option(d.destinatario && d.destinatario.como === 'termos' ? 'Pelos termos: ' + d.destinatario.nome : 'Pelos termos (nenhum encontrado)', '');
    sD.appendChild(oA);
    EM.dest.filter(function(x){ return x.ativo; }).forEach(function(x){
      var o = new Option(x.nome + ' · ' + x.email, String(x.id));
      if (d.destinatario && d.destinatario.como === 'escolhido' && d.destinatario.id === x.id) o.selected = true;
      sD.appendChild(o);
    });
    sD.addEventListener('change', function(){
      tfGravar(id, { destinatario_id: sD.value ? Number(sD.value) : null }).then(function(){ emLerPagamento(id, true); });
    });
    b.appendChild(sD);
    if (d.destinatario) b.appendChild(el('span', 'em-l', 'Para ' + d.para + (d.cc ? ' · Cc ' + d.cc : '') + ' · ' + (EM_QUANDO_CURTO[d.destinatario.quando] || '')));
    b.appendChild(el('span', 'em-l', d.anexos.length ? d.anexos.length + ' anexo' + (d.anexos.length === 1 ? '' : 's') + ': ' +
      d.anexos.map(function(a){ return a.papel; }).join(', ') : 'Sem faturas nem comprovativo para anexar.'));
    var acts = el('div', 'em-acts');
    var bR = el('button', 'btn small primary', enviados.length ? 'Enviar outra vez' : 'Rever e enviar');
    bR.type = 'button';
    bR.style.marginLeft = '0';
    bR.addEventListener('click', function(){ emJanelaEnvio(id, d); });
    acts.appendChild(bR);
    b.appendChild(acts);
    if (!d.gmail.ligado) b.appendChild(el('span', 'em-l', d.gmail.configurado ? 'O Gmail ainda não está ligado (Administração › Destinatários).' : 'Falta configurar o Gmail.'));
    if ((d.envios || []).length){
      var hs = el('div', 'em-hist');
      d.envios.slice(0, 5).forEach(function(e){
        hs.appendChild(el('span', e.estado === 'erro' ? 'erro' : '', e.quando + ' · ' + (e.estado === 'erro' ? 'falhou: ' + (e.erro || '') : 'enviado para ' + e.para + (e.automatico ? ' (sozinho)' : ''))));
      });
      b.appendChild(hs);
    }
  }
  if (velho) velho.replaceWith(sec);
  else {
    var secs = det.querySelectorAll('.tf-sec');
    var depois = null;
    secs.forEach(function(s){ var l = s.querySelector('.tf-lbl'); if (l && /^(Documentos|Faturas juntas)/.test(l.textContent)) depois = s; });
    if (depois && depois.nextSibling) det.insertBefore(sec, depois.nextSibling); else det.appendChild(sec);
  }
}

/* Fechar um pagamento que tem email a quem se paga nao e so carregar no
   botao: a janela abre antes, ja com a data, o valor e os papeis que se
   acabaram de escolher, e so depois de decidir o email e que o pagamento
   fecha. Quem nao tem destinatario (ou nao tem o Gmail ligado) fecha como
   sempre - isto nunca fica no caminho.
   Devolve uma promessa: cumpre-se com 'enviado', 'sem-envio' ou 'nada' e
   falha se a pessoa carregar em Cancelar. */
function emAntesDeFechar(id, porGravar, rotulos){
  return new Promise(function(resolve, reject){
    var segue = function(){ resolve('nada'); };
    if (typeof apiGestao !== 'function') return segue();
    apiGestao('/api/emails/pagamento/' + id + '/preparar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(porGravar || {})
    }).then(function(d){
      if (!d || !d.destinatario || !d.gmail || !d.gmail.ligado) return segue();
      if ((d.envios || []).some(function(e){ return e.estado === 'enviado'; })) return segue();
      emEstilo();
      emJanelaEnvio(id, d, {
        fechar: true,
        rotuloEnviar: (rotulos && rotulos.enviar) || 'Enviar e fechar',
        rotuloSem: (rotulos && rotulos.sem) || 'Fechar sem enviar',
        ok: resolve, cancelar: function(){ reject(new Error('cancelado')); }
      });
    }).catch(segue);
  });
}

function emJanelaEnvio(id, d, modo){
  modo = modo || {};
  var dlg = el('dialog', 'em-dlg');
  var cx = el('div', 'em-dlgc');
  cx.appendChild(el('h3', null, modo.fechar ? 'Antes de fechar: o email a quem se paga' : 'Rever antes de enviar'));
  cx.appendChild(el('div', 'em-sub', 'De ' + d.de + ' · ' + d.pagamento.titulo + (d.pagamento.total ? ' · ' + d.pagamento.total : '')));
  var iPara = emInput('text', d.para, 'email de quem recebe');
  var iCc = emInput('text', d.cc, 'opcional');
  var duas = el('div', 'em-2'); emCampo(duas, 'Para', iPara); emCampo(duas, 'Cc', iCc); cx.appendChild(duas);
  var iAss = emInput('text', d.assunto); emCampo(cx, 'Assunto', iAss);
  var iTxt = el('textarea'); iTxt.value = d.corpo; emCampo(cx, 'Texto', iTxt);
  var anx = el('div', 'em-anx');
  anx.appendChild(el('label', null, 'Anexos'));
  var marcas = [];
  d.anexos.forEach(function(a){
    var l = el('label'); var i = el('input'); i.type = 'checkbox'; i.checked = a.ficheiro; i.disabled = !a.ficheiro;
    l.appendChild(i); l.appendChild(document.createTextNode(a.nome + ' (' + a.papel + ')'));
    if (!a.ficheiro) l.appendChild(el('small', null, ' sem ficheiro'));
    anx.appendChild(l); marcas.push({ a: a, i: i });
  });
  if (!d.anexos.length) anx.appendChild(el('span', 'em-sub', 'Nenhum papel para anexar.'));
  cx.appendChild(anx);
  var pe = el('div', 'em-dlga');
  var sair = function(){ try { dlg.close(); } catch (e) {} dlg.remove(); };
  var bC = el('button', 'btn', 'Cancelar'); bC.type = 'button';
  bC.addEventListener('click', function(){ sair(); if (modo.cancelar) modo.cancelar(); });
  /* A fechar um pagamento: dá para seguir sem enviar, mas é uma escolha, não
     um esquecimento - é para isto que a janela aparece antes de fechar. */
  var bS = null;
  if (modo.fechar){
    bS = el('button', 'btn', modo.rotuloSem || 'Fechar sem enviar'); bS.type = 'button';
    bS.addEventListener('click', function(){ sair(); if (modo.ok) modo.ok('sem-envio'); });
  }
  var rotulo = modo.fechar ? (modo.rotuloEnviar || 'Enviar e fechar') : 'Enviar';
  var bE = el('button', 'btn primary', rotulo); bE.type = 'button';
  if (!d.gmail.ligado){ bE.disabled = true; bE.title = 'Liga primeiro o Gmail na Administração'; }
  bE.addEventListener('click', function(){
    bE.disabled = true; bE.textContent = 'A enviar…';
    apiGestao('/api/emails/pagamento/' + id + '/enviar', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ para: iPara.value, cc: iCc.value, assunto: iAss.value, corpo: iTxt.value,
        anexos: marcas.filter(function(m){ return m.i.checked; }).map(function(m){ return m.a.id; }) })
    }).then(function(){
      toast('Email enviado.');
      sair();
      emLerPagamento(id, true);
      if (modo.ok) modo.ok('enviado');
      else if (typeof loadGestao === 'function') loadGestao();
    }).catch(function(e){
      toast(e.message || 'Não foi possível enviar.');
      bE.disabled = false; bE.textContent = rotulo;
      emLerPagamento(id, true);
    });
  });
  pe.appendChild(bC);
  if (bS) pe.appendChild(bS);
  pe.appendChild(bE);
  cx.appendChild(pe);
  dlg.appendChild(cx);
  dlg.addEventListener('cancel', function(){ setTimeout(function(){ dlg.remove(); }, 0); });
  document.body.appendChild(dlg);
  dlg.showModal();
}

if (typeof tfRenderDetalhe === 'function'){
  var _emRenderDetalhe = tfRenderDetalhe;
  tfRenderDetalhe = function(base){
    _emRenderDetalhe(base);
    try {
      if (base && tfTipo(base) === 'pagamento'){
        emEstilo();
        if (!EM.carregado) emCarregar();
        emDesenharBloco(base.id);
        emLerPagamento(base.id);
      }
    } catch (e) { console.error('[farol] email do pagamento', e); }
  };
}

/* A volta da Google: diz como correu e limpa o endereco. */
(function(){
  var m = /[?&]gmail=([^&]+)/.exec(location.search);
  if (!m) return;
  var v = decodeURIComponent(m[1]);
  var msg = { ligado: 'Gmail ligado. Os emails dos pagamentos já podem sair.', recusado: 'A Google não deu autorização.',
    conta: 'Autorizaste outra conta: entra na Google com a conta que envia os emails.', 'sem-envio': 'Falta autorizar o envio de emails.',
    'sem-acesso': 'A Google não devolveu acesso permanente: tenta outra vez.', estado: 'A ligação expirou: tenta outra vez.', erro: 'Não foi possível ligar o Gmail.' }[v] || 'Gmail: ' + v;
  history.replaceState(null, '', location.pathname);
  setTimeout(function(){ if (typeof toast === 'function') toast(msg); emMontar(); if (typeof show === 'function') show('destinatarios'); emCarregar(); }, 1200);
})();

document.addEventListener('click', function(e){
  var b = e.target.closest && e.target.closest('button[data-view="destinatarios"]');
  if (b) emCarregar();
});

(function esperar(n){
  n = n || 0;
  if ($('nav') && $('nav').querySelector('[data-view="areas"]')){ emMontar(); return; }
  if (n > 30){ emMontar(); return; }
  setTimeout(function(){ esperar(n + 1); }, 400);
})();
