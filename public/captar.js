'use strict';
/* Farol - a captura universal (fase 5 do menu novo, 24 out 2026).
 *
 * O + passa a abrir uma folha so: escreve-se (ou dita-se) a frase como se
 * diria a alguem, o Gemini parte-a em cartoes (src/captar.js) e a pessoa
 * confirma cartao a cartao - corrige o que quiser, desmarca o que nao quer -
 * e grava. Grava-se pelas rotas de sempre (tarefas, eventos, contas
 * correntes) e, durante dez segundos, da para desfazer tudo de uma vez.
 *
 * Os papeis e as fotografias continuam a ir para a Caixa de entrada, que ja
 * os le sozinha. A criacao a mao (Tarefa, Pagamento, Lembrete, Evento)
 * continua a um toque, no fundo da folha.
 *
 * Substitui o menu do + do menu.js (mnCaptar). So com o menu novo ligado.
 */

var CP = { dlg: null, passo: 'texto', texto: '', resposta: null, cartoes: [], aGravar: false, eu: null, voz: null, aOuvir: false };

var CP_TIPOS = [
  ['evento', 'Evento'], ['tarefa', 'Tarefa'], ['pagamento', 'Pagamento'],
  ['lembrete', 'Lembrete'], ['nota', 'Nota'], ['conta_corrente', 'Conta corrente']
];
var CP_REPETE = [['', 'Não repete'], ['semana', 'Todas as semanas'], ['mes', 'Todos os meses'], ['ano', 'Todos os anos']];

var CP_CSS = [
  '#cpDlg .cp{padding:22px 22px 28px;display:flex;flex-direction:column;gap:16px}',
  '#cpDlg .cp-h{display:flex;align-items:center;justify-content:space-between;gap:10px}',
  '#cpDlg .cp-h h2{font-family:var(--sans);font-size:1.375rem;font-weight:700;letter-spacing:-.01em;margin:0}',
  '#cpDlg .cp-fechar{min-width:44px;min-height:44px;border-radius:10px;color:var(--muted);font-size:1.25rem}',
  '#cpDlg .cp-fechar:hover{background:var(--surface-2);color:var(--ink)}',
  '#cpDlg label.cp-l{font-size:.8125rem;font-weight:500;color:var(--ink-2);display:block;margin-bottom:6px}',
  '#cpDlg textarea{width:100%;box-sizing:border-box;font:inherit;font-size:1rem;line-height:1.5;padding:14px;border-radius:12px;border:1.5px solid var(--line);background:var(--surface);color:var(--ink);resize:vertical;min-height:110px}',
  '#cpDlg textarea:focus{outline:none;border-color:var(--accent)}',
  '#cpDlg .cp-ex{color:var(--muted);font-size:.8125rem;margin:6px 0 0}',
  '#cpDlg .cp-botoes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
  '#cpDlg .cp-gr{min-height:64px;border-radius:12px;border:1px solid var(--line);background:var(--surface);display:flex;align-items:center;justify-content:center;gap:8px;font-size:.875rem;font-weight:500;color:var(--ink)}',
  '#cpDlg .cp-gr:hover{border-color:var(--accent)}',
  '#cpDlg .cp-gr.on{border-color:var(--bad);color:var(--bad)}',
  '#cpDlg .cp-acoes{display:flex;gap:10px;flex-wrap:wrap}',
  '#cpDlg .cp-acoes .btn{min-height:48px;padding:0 18px;font-size:.9375rem;flex:1}',
  '#cpDlg .cp-mao{border-top:1px solid var(--line-soft);padding-top:14px;display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
  '#cpDlg .cp-mao span{color:var(--muted);font-size:.8125rem;margin-right:4px}',
  '#cpDlg .cp-mao button{font-size:.8125rem;min-height:36px;padding:0 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface)}',
  '#cpDlg .cp-mao button:hover{border-color:var(--accent)}',
  '#cpDlg .cp-frase{font-size:.875rem;color:var(--ink-2);background:var(--surface-2);border-radius:10px;padding:10px 12px}',
  '#cpDlg .cp-perg{font-size:.875rem;background:var(--warn-soft);color:var(--warn);border-radius:10px;padding:10px 12px;font-weight:500}',
  '#cpDlg .cp-card{border:1px solid var(--line);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--surface)}',
  '#cpDlg .cp-card.off{opacity:.5}',
  '#cpDlg .cp-ct{display:flex;align-items:center;gap:10px}',
  '#cpDlg .cp-ct input[type=checkbox]{width:22px;height:22px;margin:0;accent-color:var(--accent);flex:none}',
  '#cpDlg .cp-ct select{font:inherit;font-size:.75rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--accent-ink);background:var(--accent-soft);border:none;border-radius:6px;padding:4px 8px}',
  '#cpDlg .cp-sug{font-size:.75rem;color:var(--muted);margin-left:auto}',
  '#cpDlg .cp-tit{font:inherit;font-size:1rem;font-weight:600;width:100%;box-sizing:border-box;border:1px solid transparent;border-radius:8px;padding:6px 8px;margin:-6px -8px;background:none;color:var(--ink)}',
  '#cpDlg .cp-tit:hover,#cpDlg .cp-tit:focus{border-color:var(--line);outline:none}',
  '#cpDlg .cp-campos{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}',
  '#cpDlg .cp-campos label{display:flex;flex-direction:column;gap:3px;font-size:.6875rem;color:var(--muted);font-weight:500}',
  '#cpDlg .cp-campos input,#cpDlg .cp-campos select{font:inherit;font-size:.875rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:7px 8px;min-height:36px;box-sizing:border-box;width:100%}',
  '#cpDlg .cp-chips{display:flex;flex-wrap:wrap;gap:6px}',
  '#cpDlg .cp-chips button{font-size:.8125rem;min-height:32px;padding:0 10px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink-2)}',
  '#cpDlg .cp-chips button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}',
  ':root[data-theme="dark"] #cpDlg .cp-chips button[aria-pressed=true],:root:not([data-theme="light"]) #cpDlg .cp-chips button[aria-pressed=true]{color:#06181A}',
  '#cpDlg .cp-sub{font-size:.6875rem;color:var(--muted);font-weight:500;margin-bottom:-4px}',
  '#cpDlg .cp-a-ler{display:flex;align-items:center;gap:12px;color:var(--muted);font-size:.9375rem;padding:24px 4px}',
  '#cpDlg .cp-a-ler i{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--accent);animation:cpRoda .8s linear infinite}',
  '@keyframes cpRoda{to{transform:rotate(360deg)}}',
  '#cpDlg .cp-erro{color:var(--bad);font-size:.875rem}',
  '#cpDesfazer{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:1300;display:flex;align-items:center;gap:14px;padding:12px 14px 12px 18px;border-radius:12px;background:var(--ink);color:var(--surface);font-size:.875rem;box-shadow:0 10px 30px rgba(0,0,0,.25);max-width:calc(100vw - 32px)}',
  '#cpDesfazer button{color:var(--warn-soft,#FBEBD0);font-weight:600;min-height:36px;padding:0 10px;border-radius:8px}',
  '@media (max-width:900px){ body.mn-on #cpDesfazer{bottom:calc(96px + env(safe-area-inset-bottom,0px))} }'
].join('\n');

function cpEstilo(){
  if (document.getElementById('cpCss')) return;
  var st = document.createElement('style'); st.id = 'cpCss'; st.textContent = CP_CSS;
  document.head.appendChild(st);
}

/* ------------------------------ a folha ------------------------------ */
function cpAbrir(){
  cpEstilo();
  if (CP.dlg && CP.dlg.open) return;
  if (!CP.dlg){
    CP.dlg = el('dialog', 'folha larga');
    CP.dlg.id = 'cpDlg';
    CP.dlg.setAttribute('aria-label', 'Captar');
    CP.dlg.addEventListener('close', function(){ cpParar(); });
    document.body.appendChild(CP.dlg);
  }
  CP.passo = 'texto'; CP.resposta = null; CP.cartoes = []; CP.erro = null;
  cpDesenhar();
  CP.dlg.showModal();
  var t = CP.dlg.querySelector('textarea');
  if (t) setTimeout(function(){ t.focus(); }, 30);
}
function cpFechar(){ if (CP.dlg && CP.dlg.open) CP.dlg.close(); }

function cpCabeca(c, titulo){
  var h = el('div', 'cp-h');
  h.appendChild(el('h2', null, titulo));
  var x = el('button', 'cp-fechar', '×');
  x.type = 'button';
  x.setAttribute('aria-label', 'Fechar');
  x.addEventListener('click', cpFechar);
  h.appendChild(x);
  c.appendChild(h);
}

function cpDesenhar(){
  var d = CP.dlg;
  clear(d);
  var c = el('div', 'cp');
  d.appendChild(c);
  if (CP.passo === 'texto') return cpPassoTexto(c);
  if (CP.passo === 'a-ler'){
    cpCabeca(c, 'Captar');
    c.appendChild(el('div', 'cp-frase', CP.texto));
    var l = el('div', 'cp-a-ler'); l.appendChild(el('i')); l.appendChild(el('span', null, 'O Gemini está a ler…'));
    c.appendChild(l);
    return;
  }
  return cpPassoCartoes(c);
}

/* ---- passo 1: a frase ---- */
function cpPassoTexto(c){
  cpCabeca(c, 'Captar');
  var w = el('div');
  var lab = el('label', 'cp-l', 'Escreve como dirias a alguém');
  lab.htmlFor = 'cpTexto';
  w.appendChild(lab);
  var t = el('textarea');
  t.id = 'cpTexto';
  t.value = CP.texto || '';
  t.placeholder = 'Consulta da mãe no dentista dia 12 às 15h, 60 €';
  t.addEventListener('input', function(){ CP.texto = t.value; });
  t.addEventListener('keydown', function(e){ if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') cpLer(); });
  w.appendChild(t);
  w.appendChild(el('p', 'cp-ex', 'Podes juntar várias coisas numa frase. Nada é gravado sem confirmares.'));
  if (CP.erro) w.appendChild(el('p', 'cp-erro', CP.erro));
  c.appendChild(w);

  var bs = el('div', 'cp-botoes');
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (Rec){
    var bv = el('button', 'cp-gr' + (CP.aOuvir ? ' on' : ''));
    bv.type = 'button';
    bv.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
    bv.appendChild(el('span', null, CP.aOuvir ? 'A ouvir… toca para parar' : 'Ditar'));
    bv.addEventListener('click', function(){ CP.aOuvir ? cpParar() : cpOuvir(t); });
    bs.appendChild(bv);
  }
  var bf = el('button', 'cp-gr');
  bf.type = 'button';
  bf.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l1.5-3h5L16 7"/></svg>';
  bf.appendChild(el('span', null, 'Foto ou ficheiro'));
  bf.title = 'Vai para a Caixa de entrada, que lê o papel sozinha';
  bf.addEventListener('click', function(){
    cpFechar();
    if (window.IB && !IB.carregado && typeof ibCarregar === 'function') ibCarregar();
    show('inbox');
    var f = document.getElementById('ibFicheiro');
    if (f) f.click();
  });
  bs.appendChild(bf);
  c.appendChild(bs);

  var ac = el('div', 'cp-acoes');
  var bn = el('button', 'btn', 'Guardar como nota');
  bn.type = 'button';
  bn.title = 'Guarda a frase tal como está, para decidir depois';
  bn.addEventListener('click', function(){
    var txt = (CP.texto || '').trim();
    if (!txt){ CP.erro = 'Escreve primeiro alguma coisa.'; return cpDesenhar(); }
    CP.cartoes = [{ tipo: 'nota', titulo: txt.slice(0, 120), notas: txt.length > 120 ? txt : null, pessoas: [], on: true }];
    cpGravar();
  });
  var bp = el('button', 'btn primary', 'Ver proposta');
  bp.type = 'button';
  bp.addEventListener('click', cpLer);
  ac.appendChild(bn); ac.appendChild(bp);
  c.appendChild(ac);

  var mao = el('div', 'cp-mao');
  mao.appendChild(el('span', null, 'Ou criar à mão:'));
  [['tarefa', 'Tarefa'], ['pagamento', 'Pagamento'], ['lembrete', 'Lembrete'], ['evento', 'Evento']].forEach(function(x){
    var b = el('button', null, x[1]);
    b.type = 'button';
    b.addEventListener('click', function(){
      cpFechar();
      if (typeof nvJanela === 'function') nvJanela(x[0], null, {});
    });
    mao.appendChild(b);
  });
  c.appendChild(mao);
}

/* ---- a voz ---- */
function cpOuvir(t){
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) return;
  try {
    var r = new Rec();
    r.lang = 'pt-PT';
    r.interimResults = true;
    r.continuous = true;
    var base = (t.value ? t.value.replace(/\s+$/, '') + ' ' : '');
    r.onresult = function(ev){
      var txt = '';
      for (var i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
      t.value = base + txt.trim();
      CP.texto = t.value;
    };
    r.onerror = function(ev){
      CP.aOuvir = false;
      CP.erro = ev.error === 'not-allowed' ? 'O browser não deixou usar o microfone.' : 'Não deu para ouvir. Tenta outra vez ou escreve.';
      cpDesenhar();
    };
    r.onend = function(){ if (CP.aOuvir){ CP.aOuvir = false; if (CP.passo === 'texto') cpDesenhar(); } };
    CP.voz = r;
    CP.aOuvir = true;
    CP.erro = null;
    r.start();
    cpDesenhar();
  } catch (e) { CP.aOuvir = false; }
}
function cpParar(){
  if (CP.voz){ try { CP.voz.stop(); } catch (e) {} }
  CP.voz = null;
  if (CP.aOuvir){ CP.aOuvir = false; if (CP.dlg && CP.dlg.open && CP.passo === 'texto') cpDesenhar(); }
}

/* ---- passo 2: o Gemini ---- */
function cpLer(){
  var txt = (CP.texto || '').trim();
  if (!txt){ CP.erro = 'Escreve ou dita primeiro o que queres captar.'; return cpDesenhar(); }
  cpParar();
  CP.passo = 'a-ler'; CP.erro = null;
  cpDesenhar();
  apiGestao('/api/captar/interpretar', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: txt })
  }).then(function(d){
    CP.resposta = d;
    CP.cartoes = (d.cartoes || []).map(function(x){ return Object.assign({ on: !x.sugestao }, x); });
    if (!CP.cartoes.length){
      CP.passo = 'texto';
      CP.erro = d.pergunta || 'Não percebi o que é para guardar. Tenta dizer de outra maneira.';
    } else CP.passo = 'cartoes';
    if (CP.dlg.open) cpDesenhar();
  }).catch(function(e){
    CP.passo = 'texto';
    CP.erro = (e.message || 'Não foi possível ler a frase.') + ' Podes guardá-la como nota.';
    if (CP.dlg.open) cpDesenhar();
  });
}

/* ---- passo 3: os cartoes ---- */
function cpAreas(){
  var cs = ((window.G && G.contextos) || []).filter(function(c){ return c.active !== false; });
  var out = [];
  cs.filter(function(c){ return !c.parent_id; }).forEach(function(a){
    out.push([a.id, a.name]);
    cs.filter(function(s){ return s.parent_id === a.id; }).forEach(function(s){ out.push([s.id, a.name + ' › ' + s.name]); });
  });
  return out;
}
function cpPessoas(){ return ((window.G && G.people) || []).filter(function(p){ return p.active !== false; }); }

function cpSelect(opcoes, valor, vazio, aoMudar){
  var s = el('select');
  if (vazio !== null){ var o0 = el('option', null, vazio); o0.value = ''; s.appendChild(o0); }
  opcoes.forEach(function(o){
    var op = el('option', null, o[1]); op.value = String(o[0]);
    if (String(valor == null ? '' : valor) === String(o[0])) op.selected = true;
    s.appendChild(op);
  });
  s.addEventListener('change', function(){ aoMudar(s.value); });
  return s;
}
function cpCampo(rot, no){ var l = el('label'); l.appendChild(document.createTextNode(rot)); l.appendChild(no); return l; }
function cpInput(tipo, valor, aoMudar, extra){
  var i = el('input'); i.type = tipo; i.value = valor == null ? '' : String(valor);
  if (extra) Object.keys(extra).forEach(function(k){ i.setAttribute(k, extra[k]); });
  i.addEventListener('input', function(){ aoMudar(i.value); });
  return i;
}

function cpCartao(x){
  var card = el('div', 'cp-card' + (x.on ? '' : ' off'));
  var ct = el('div', 'cp-ct');
  var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!x.on;
  cb.setAttribute('aria-label', 'Incluir este cartão');
  cb.addEventListener('change', function(){ x.on = cb.checked; card.classList.toggle('off', !x.on); cpContar(); });
  ct.appendChild(cb);
  ct.appendChild(cpSelect(CP_TIPOS, x.tipo, null, function(v){ x.tipo = v; cpDesenhar(); }));
  if (x.sugestao) ct.appendChild(el('span', 'cp-sug', 'Sugestão'));
  card.appendChild(ct);

  var tit = cpInput('text', x.titulo, function(v){ x.titulo = v; });
  tit.className = 'cp-tit';
  tit.setAttribute('aria-label', 'Título');
  card.appendChild(tit);

  var cs = el('div', 'cp-campos');
  if (x.tipo !== 'nota'){
    cs.appendChild(cpCampo(x.tipo === 'evento' ? 'Dia' : (x.tipo === 'conta_corrente' ? 'Data' : 'Prazo'), cpInput('date', x.data, function(v){ x.data = v || null; })));
    if (x.tipo === 'evento' || x.tipo === 'tarefa' || x.tipo === 'lembrete') cs.appendChild(cpCampo('Hora', cpInput('time', x.hora, function(v){ x.hora = v || null; })));
  }
  if (x.tipo === 'pagamento' || x.tipo === 'conta_corrente'){
    cs.appendChild(cpCampo('Valor (€)', cpInput('number', x.valor, function(v){ x.valor = v === '' ? null : Number(v); }, { step: '0.01', min: '0', inputmode: 'decimal' })));
  }
  if (x.tipo === 'pagamento') cs.appendChild(cpCampo('A quem', cpInput('text', x.entidade, function(v){ x.entidade = v || null; })));
  if (x.tipo === 'conta_corrente'){
    var ccs = ((window.CP && CP.cc) || []).map(function(p){ return [p.id, p.nome]; });
    cs.appendChild(cpCampo('Conta corrente', cpSelect(ccs, x.cc_id, 'Escolher…', function(v){ x.cc_id = v ? Number(v) : null; })));
    cs.appendChild(cpCampo('Sentido', cpSelect([['deve_me', 'Deve-me'], ['devo', 'Devo eu']], x.sentido || 'deve_me', null, function(v){ x.sentido = v; })));
  } else {
    cs.appendChild(cpCampo('Área', cpSelect(cpAreas(), x.context_id, 'Sem área', function(v){ x.context_id = v ? Number(v) : null; })));
  }
  if (x.tipo === 'tarefa' || x.tipo === 'pagamento'){
    var donos = cpPessoas().filter(function(p){ return p.can_own_tasks; }).map(function(p){ return [p.id, p.name]; });
    cs.appendChild(cpCampo('Responsável', cpSelect(donos, x.responsavel_id, 'Ninguém', function(v){ x.responsavel_id = v ? Number(v) : null; })));
  }
  if (x.tipo !== 'evento' && x.tipo !== 'nota' && x.tipo !== 'conta_corrente'){
    cs.appendChild(cpCampo('Repete', cpSelect(CP_REPETE, x.repete || '', null, function(v){ x.repete = v || null; })));
  }
  card.appendChild(cs);

  if (x.tipo !== 'conta_corrente'){
    card.appendChild(el('div', 'cp-sub', x.tipo === 'evento' ? 'Quem vai' : 'Por causa de quem'));
    var chips = el('div', 'cp-chips');
    cpPessoas().forEach(function(p){
      var on = (x.pessoas || []).indexOf(p.id) >= 0;
      var b = el('button', null, p.name.split(' ')[0]);
      b.type = 'button';
      b.title = p.name;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', function(){
        x.pessoas = x.pessoas || [];
        var i = x.pessoas.indexOf(p.id);
        if (i >= 0) x.pessoas.splice(i, 1); else x.pessoas.push(p.id);
        b.setAttribute('aria-pressed', i >= 0 ? 'false' : 'true');
      });
      chips.appendChild(b);
    });
    card.appendChild(chips);
  }
  if (x.notas) card.appendChild(el('p', 'cp-ex', x.notas));
  return card;
}

function cpContar(){
  var b = CP.dlg && CP.dlg.querySelector('#cpGuardar');
  if (!b) return;
  var n = CP.cartoes.filter(function(x){ return x.on; }).length;
  b.textContent = n ? (n === 1 ? 'Guardar 1' : 'Guardar ' + n) : 'Nada escolhido';
  b.disabled = !n || CP.aGravar;
}

function cpPassoCartoes(c){
  var n = CP.cartoes.length;
  cpCabeca(c, n === 1 ? 'O Farol propõe 1 coisa' : 'O Farol propõe ' + n + ' coisas');
  c.appendChild(el('div', 'cp-frase', '«' + CP.texto.trim() + '»'));
  if (CP.resposta && CP.resposta.pergunta) c.appendChild(el('div', 'cp-perg', CP.resposta.pergunta));
  if (CP.cartoes.some(function(x){ return x.tipo === 'conta_corrente'; }) && !CP.cc) cpLerCc();
  CP.cartoes.forEach(function(x){ c.appendChild(cpCartao(x)); });
  if (CP.erro) c.appendChild(el('p', 'cp-erro', CP.erro));
  var ac = el('div', 'cp-acoes');
  var bv = el('button', 'btn', '← Corrigir a frase');
  bv.type = 'button';
  bv.addEventListener('click', function(){ CP.passo = 'texto'; CP.erro = null; cpDesenhar(); });
  var bg = el('button', 'btn primary', '');
  bg.type = 'button';
  bg.id = 'cpGuardar';
  bg.addEventListener('click', cpGravar);
  ac.appendChild(bv); ac.appendChild(bg);
  c.appendChild(ac);
  cpContar();
}

function cpLerCc(){
  if (CP.aLerCc) return;
  CP.aLerCc = true;
  apiGestao('/api/financas/cc').then(function(d){
    CP.cc = (d.pessoas || []).filter(function(p){ return p.ativo !== false; });
  }).catch(function(){ CP.cc = []; }).then(function(){ CP.aLerCc = false; if (CP.dlg.open && CP.passo === 'cartoes') cpDesenhar(); });
}

/* ------------------------------ gravar ------------------------------ */
function cpJson(url, corpo){
  return apiGestao(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
}

function cpGravarUm(x){
  var titulo = String(x.titulo || '').trim();
  if (!titulo) return Promise.reject(new Error('Há um cartão sem título.'));
  if (x.tipo === 'evento'){
    if (!x.data) return Promise.reject(new Error('O evento «' + titulo + '» precisa de um dia.'));
    return cpJson('/api/gestao/eventos', {
      title: titulo, day: x.data, at: x.hora || '', context_id: x.context_id || null,
      person_ids: x.pessoas || [], detail: x.notas || ''
    }).then(function(r){ return { k: 'evento', id: r.id }; });
  }
  if (x.tipo === 'conta_corrente'){
    var v = Number(x.valor || 0);
    if (!x.cc_id) return Promise.reject(new Error('Escolhe a conta corrente de «' + titulo + '».'));
    if (!(v > 0)) return Promise.reject(new Error('Falta o valor em «' + titulo + '».'));
    return cpJson('/api/financas/cc/' + x.cc_id + '/mov', {
      data: x.data || null, descricao: titulo, valor: x.sentido === 'devo' ? -v : v
    }).then(function(r){ return { k: 'cc', id: r.id }; });
  }
  if (x.tipo === 'pagamento' && !(Number(x.valor) > 0)) return Promise.reject(new Error('Falta o valor do pagamento «' + titulo + '».'));
  var dono = x.responsavel_id;
  /* Uma tarefa sem responsavel fica de quem a escreveu - salvo a sugestao de
     apoio (a boleia), que fica sem ninguem para se ver nos Cuidados. */
  if (dono == null && !x.sugestao && (x.tipo === 'tarefa' || x.tipo === 'pagamento')) dono = CP.eu;
  return cpJson('/api/captar/tarefa', {
    tipo: x.tipo, title: titulo, due_on: x.data || null, due_time: x.hora || null,
    amount: x.tipo === 'pagamento' ? Number(x.valor) : null, payee: x.tipo === 'pagamento' ? (x.entidade || null) : null,
    context_id: x.context_id || null, owner_id: dono || null, subjects: x.pessoas || [],
    notes: x.notas || null, repeat_every: x.repete || null
  }).then(function(r){ return { k: 'tarefa', id: r.id }; });
}

function cpGravar(){
  if (CP.aGravar) return;
  var escolhidos = CP.cartoes.filter(function(x){ return x.on; });
  if (!escolhidos.length) return;
  CP.aGravar = true; CP.erro = null; cpContar();
  var feitos = [];
  var cadeia = Promise.resolve();
  escolhidos.forEach(function(x){
    cadeia = cadeia.then(function(){ return cpGravarUm(x).then(function(f){ f.titulo = x.titulo; feitos.push(f); }); });
  });
  cadeia.then(function(){
    CP.aGravar = false;
    CP.texto = '';
    cpFechar();
    cpRecarregar();
    cpAvisoDesfazer(feitos);
  }).catch(function(e){
    CP.aGravar = false;
    /* O que ja ficou gravado desfaz-se, para nao ficar meia frase guardada. */
    cpApagar(feitos).then(function(){
      CP.erro = (e.message || 'Não foi possível guardar.') + (feitos.length ? ' Nada ficou guardado.' : '');
      if (CP.passo !== 'cartoes') CP.passo = 'texto';
      if (CP.dlg.open) cpDesenhar(); else if (typeof toast === 'function') toast(CP.erro);
    });
  });
}

function cpApagar(feitos){
  var urls = { tarefa: '/api/gestao/tarefas/', evento: '/api/gestao/eventos/', cc: '/api/financas/cc/mov/' };
  return feitos.slice().reverse().reduce(function(p, f){
    return p.then(function(){ return apiGestao(urls[f.k] + f.id, { method: 'DELETE' }).catch(function(){}); });
  }, Promise.resolve());
}

function cpRecarregar(){
  if (typeof loadGestao === 'function') loadGestao();
  if (typeof load === 'function') load();
}

function cpAvisoDesfazer(feitos){
  var velho = document.getElementById('cpDesfazer');
  if (velho) velho.remove();
  if (!feitos.length) return;
  var bar = el('div');
  bar.id = 'cpDesfazer';
  bar.setAttribute('role', 'status');
  bar.appendChild(el('span', null, feitos.length === 1 ? 'Guardado: ' + feitos[0].titulo : feitos.length + ' coisas guardadas'));
  var b = el('button', null, 'Desfazer');
  b.type = 'button';
  var t = setTimeout(function(){ bar.remove(); }, 10000);
  b.addEventListener('click', function(){
    clearTimeout(t);
    b.disabled = true;
    b.textContent = 'A desfazer…';
    cpApagar(feitos).then(function(){
      bar.remove();
      cpRecarregar();
      if (typeof toast === 'function') toast('Desfeito.');
    });
  });
  bar.appendChild(b);
  document.body.appendChild(bar);
}

/* ------------------------------ ligar ------------------------------ */
function cpLigar(){
  /* O + do menu novo (menu.js) chama mnCaptar pelo nome: passa a abrir isto. */
  window.mnCaptar = function(){ if (typeof mnGaveta === 'function') mnGaveta(false); cpAbrir(); };
  fetch('/api/me', { credentials: 'same-origin' }).then(function(r){ return r.ok ? r.json() : null; })
    .then(function(me){ if (me && me.pessoa_id) CP.eu = me.pessoa_id; }).catch(function(){});
}

(function cpEsperar(n){
  if (typeof el === 'function' && typeof apiGestao === 'function' && typeof window.mnCaptar === 'function'){
    try { cpLigar(); } catch (e) { console.error('[farol] captar', e); }
    return;
  }
  if (n < 60) setTimeout(function(){ cpEsperar(n + 1); }, 250);
})(0);
