'use strict';
/* Farol - Entrada do OneDrive (21 nov 2026).
 *
 * Ecra em Transversal com o rasto da rotina que esvazia a pasta
 * OneDrive-Pessoal/00_Entrada: cada ficheiro, o que gerou no Farol (pela
 * Caixa de entrada), a area, para onde foi a copia no OneDrive e os
 * follow-ups. Mais o horario da rotina, o «Correr agora», as execucoes e a
 * pasta do OneDrive de cada area.
 *
 * A rotina usa este ficheiro para enviar: ha sempre um <input type=file>
 * escondido (#odUpload) e a funcao window.odEnviarFicheiro(execId, meta), que
 * manda o ficheiro escolhido para /api/inbox e regista-o em /api/onedrive.
 * Dados em /api/onedrive (src/onedrive.js).
 */

var OD = { d: null, aLer: false, filtro: 'todos', procura: '', aba: 'historico' };
var OD_DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
var OD_TIPOS = { documento: 'Documento', tarefa: 'Tarefa', pagamento: 'Pagamento', evento: 'Evento', despesa: 'Despesa' };
var OD_EXEC = {
  pedida: ['Pedida', 'meio'], a_correr: ['A correr', 'meio'], concluida: ['Concluída', 'ok'],
  com_erros: ['Com erros', 'mau'], falhou: ['Falhou', 'mau']
};

var OD_CSS = [
  '#view-onedrive .od-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 14px}',
  '#view-onedrive .od-kpi{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:0;cursor:pointer;text-align:left;font:inherit;color:var(--ink)}',
  '#view-onedrive .od-kpi.on{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}',
  '#view-onedrive .od-kpi span{font-size:.75rem;color:var(--muted);font-weight:600}',
  '#view-onedrive .od-kpi b{font-size:1.5rem;font-weight:700;line-height:1.1}',
  '#view-onedrive .od-kpi small{font-size:.72rem;color:var(--muted)}',
  '#view-onedrive .od-cartao{background:var(--surface);border:1px solid var(--line);border-radius:12px;margin:0 0 14px;overflow:hidden}',
  '#view-onedrive .od-cartao > header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line-soft);flex-wrap:wrap}',
  '#view-onedrive .od-cartao > header h3{margin:0;font-size:.95rem;font-weight:700}',
  '#view-onedrive .od-cartao > header small{color:var(--muted);font-size:.78rem}',
  '#view-onedrive .od-agenda{display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:14px 16px}',
  '#view-onedrive .od-horas{display:flex;gap:6px;flex-wrap:wrap}',
  '#view-onedrive .od-hora{font-family:var(--mono);font-size:.9rem;font-weight:600;padding:4px 10px;border-radius:8px;background:var(--line-soft)}',
  '#view-onedrive .od-agenda .od-prox{color:var(--muted);font-size:.82rem;flex:1 1 220px}',
  '#view-onedrive .od-agenda .od-acoes{display:flex;gap:8px;flex-wrap:wrap}',
  '#view-onedrive .od-aviso{padding:10px 16px;font-size:.8rem;color:var(--muted);border-top:1px solid var(--line-soft)}',
  '#view-onedrive .od-abas{display:flex;gap:6px;margin:0 0 12px;flex-wrap:wrap}',
  '#view-onedrive .od-abas button{font:inherit;font-size:.82rem;font-weight:600;min-height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:var(--surface);color:var(--ink);cursor:pointer}',
  '#view-onedrive .od-abas button.on{background:var(--ink);border-color:var(--ink);color:var(--surface)}',
  '#view-onedrive .od-filtros{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--line-soft)}',
  '#view-onedrive .od-filtros input{font:inherit;font-size:.85rem;padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:var(--ground);color:var(--ink);min-height:34px;flex:1 1 220px}',
  '#view-onedrive .od-l{display:grid;grid-template-columns:92px minmax(0,2.2fr) minmax(0,2fr) minmax(0,1.6fr) minmax(0,1.5fr) 150px;gap:12px;align-items:start;padding:10px 16px;border-top:1px solid var(--line-soft);font-size:.84rem}',
  '#view-onedrive .od-l.cab{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;border-top:0;padding-top:8px;padding-bottom:6px}',
  '#view-onedrive .od-l .data{font-family:var(--mono);font-size:.75rem;color:var(--muted)}',
  '#view-onedrive .od-l .nome b{display:block;font-weight:600;word-break:break-word}',
  '#view-onedrive .od-l .nome small,#view-onedrive .od-l small{display:block;color:var(--muted);font-size:.74rem;word-break:break-word}',
  '#view-onedrive .od-l .nome a{color:inherit;text-decoration:none}',
  '#view-onedrive .od-l .nome a:hover b{text-decoration:underline}',
  '#view-onedrive .od-pill{display:inline-block;font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap;margin:0 4px 4px 0;border:0;font-family:inherit;cursor:default}',
  '#view-onedrive button.od-pill{cursor:pointer}',
  '#view-onedrive .od-pill.ok{background:#DDF1E5;color:#1F6440}',
  '#view-onedrive .od-pill.meio{background:#FBEFD9;color:#7A5A1E}',
  '#view-onedrive .od-pill.mau{background:#FBE1E1;color:#9B1C1C}',
  '#view-onedrive .od-pill.neutro{background:var(--line-soft);color:var(--muted)}',
  '#view-onedrive .od-fu{display:block;font-size:.76rem;margin:0 0 3px;background:none;border:0;padding:0;font-family:inherit;color:var(--ink);text-align:left;cursor:pointer}',
  '#view-onedrive .od-fu.feito{color:var(--muted);text-decoration:line-through}',
  '#view-onedrive .od-l .acoes{display:flex;flex-direction:column;gap:4px;align-items:stretch}',
  '#view-onedrive .od-l .acoes .btn{min-height:30px;font-size:.76rem;padding:3px 8px}',
  '#view-onedrive .od-nota{font-size:.76rem;color:var(--ink);background:var(--line-soft);border-radius:6px;padding:4px 7px;margin-top:4px;white-space:pre-wrap}',
  '#view-onedrive .od-vazio{padding:26px 16px;color:var(--muted);font-size:.875rem;text-align:center}',
  '#view-onedrive .od-mais{display:flex;justify-content:center;padding:10px}',
  '#view-onedrive .od-e{display:grid;grid-template-columns:150px 110px 100px minmax(0,1fr);gap:12px;padding:9px 16px;border-top:1px solid var(--line-soft);font-size:.82rem;align-items:start}',
  '#view-onedrive .od-e.cab{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700;border-top:0}',
  '#view-onedrive .od-e .data{font-family:var(--mono);font-size:.75rem}',
  '#view-onedrive .od-e .res{color:var(--muted);white-space:pre-wrap}',
  '#view-onedrive .od-p{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,2fr) 90px;gap:10px;align-items:center;padding:7px 16px;border-top:1px solid var(--line-soft);font-size:.84rem}',
  '#view-onedrive .od-p.sub .nm{padding-left:18px;color:var(--ink)}',
  '#view-onedrive .od-p:not(.sub) .nm{font-weight:700}',
  '#view-onedrive .od-p input{font:inherit;font-size:.82rem;font-family:var(--mono);padding:6px 9px;border-radius:8px;border:1px solid var(--line);background:var(--ground);color:var(--ink);min-height:34px;width:100%;box-sizing:border-box}',
  '#view-onedrive .od-p input::placeholder{color:var(--muted);font-style:italic}',
  '#view-onedrive .od-p .btn{min-height:32px;font-size:.76rem}',
  '@media (max-width:900px){#view-onedrive .od-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}',
  '#view-onedrive .od-l{grid-template-columns:1fr;gap:4px}#view-onedrive .od-l.cab{display:none}',
  '#view-onedrive .od-l .acoes{flex-direction:row;flex-wrap:wrap}',
  '#view-onedrive .od-e{grid-template-columns:1fr 1fr}#view-onedrive .od-e.cab{display:none}',
  '#view-onedrive .od-p{grid-template-columns:1fr}}',
  '.od-dlg{border:none;border-radius:14px;padding:0;width:min(32rem,calc(100vw - 16px));box-shadow:0 18px 48px rgba(15,23,32,.25)}',
  '.od-dlg::backdrop{background:rgba(15,23,32,.4)}',
  '.od-dlg form{background:var(--surface);color:var(--ink);padding:18px;display:flex;flex-direction:column;gap:10px}',
  '.od-dlg h3{margin:0;font-size:1.05rem}',
  '.od-dlg p{margin:0;font-size:.8rem;color:var(--muted)}',
  '.od-dlg label{display:flex;flex-direction:column;gap:4px;font-size:.75rem;color:var(--muted);font-weight:600}',
  '.od-dlg label.linha{flex-direction:row;align-items:center;gap:8px}',
  '.od-dlg input,.od-dlg select,.od-dlg textarea{font:inherit;font-size:.9rem;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--ground);color:var(--ink);min-height:38px;box-sizing:border-box;width:100%}',
  '.od-dlg label.linha input{width:auto;min-height:0}',
  '.od-dlg .dois{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
  '.od-dlg .acoes{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:4px}',
  '#odUpload{position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0}'
].join('\n');

function odEstilo(){
  if (document.getElementById('odCss')) return;
  var s = document.createElement('style');
  s.id = 'odCss';
  s.textContent = OD_CSS;
  document.head.appendChild(s);
}

function odPost(url, corpo, metodo){
  return apiGestao(url, { method: metodo || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) });
}

function odData(iso, comHora){
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d)) return String(iso).slice(0, 10);
  var dd = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  if (!comHora) return dd;
  return dd + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function odNorm(s){ return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

/* A proxima passagem, contada no browser a partir das horas guardadas. */
function odProxima(ag){
  if (!ag || !ag.ativo || !ag.horas || !ag.horas.length) return null;
  var agora = new Date();
  for (var d = 0; d < 8; d++){
    for (var i = 0; i < ag.horas.length; i++){
      var p = ag.horas[i].split(':');
      var t = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + d, Number(p[0]), Number(p[1]), 0);
      if (t > agora) return t;
    }
  }
  return null;
}

/* O estado de um ficheiro, em palavras e com uma cor. */
function odSituacao(f){
  if (f.estado === 'erro') return ['Erro ao enviar', 'mau'];
  if (f.caixa_estado === 'descartado') return ['Descartado na caixa', 'neutro'];
  var criados = f.criados || [];
  var porAprovar = criados.some(function(c){ return c.aprovado === false; });
  if (criados.length && porAprovar) return ['Por aprovar', 'meio'];
  if (criados.length) return ['Arrumado', 'ok'];
  if (f.ai_status === 'pendente') return ['A ler', 'meio'];
  if (f.caixa_estado === 'por_triar') return ['Por triar na caixa', 'meio'];
  if (f.estado === 'repetido') return ['Já estava na caixa', 'neutro'];
  return ['Na caixa', 'neutro'];
}

function odCarregar(){
  if (OD.aLer || typeof apiGestao !== 'function') return;
  OD.aLer = true;
  apiGestao('/api/onedrive').then(function(d){ OD.d = d; }, function(e){ OD.erro = e.message || 'erro'; })
    .then(function(){ OD.aLer = false; odRender(); });
}

function odRender(){
  var sec = document.getElementById('view-onedrive');
  if (!sec) return;
  clear(sec);
  if (!OD.d){
    sec.appendChild(el('div', 'od-vazio', OD.erro ? 'Não foi possível ler a Entrada do OneDrive: ' + OD.erro : 'A ler…'));
    return;
  }
  var d = OD.d;
  var fs = d.ficheiros || [];
  var nAprovar = fs.filter(function(f){ return odSituacao(f)[0] === 'Por aprovar' || odSituacao(f)[0] === 'Por triar na caixa' || odSituacao(f)[0] === 'A ler'; }).length;
  var nCopiar = fs.filter(function(f){ return f.movido_para && !f.copiado_para && f.estado !== 'erro'; }).length;
  var nFu = fs.reduce(function(s, f){ return s + (f.follow_ups || []).filter(function(x){ return !x.feito; }).length; }, 0);

  var kp = el('div', 'od-kpis');
  [['todos', 'Ficheiros tratados', fs.length, 'desde o início'],
   ['aprovar', 'À espera de si', nAprovar, 'por triar ou aprovar na caixa'],
   ['copiar', 'Cópia por fazer', nCopiar, 'sem área ou sem pasta'],
   ['followup', 'Follow-ups abertos', nFu, 'tarefas de seguimento']].forEach(function(k){
    var b = el('button', 'od-kpi' + (OD.filtro === k[0] && OD.aba === 'historico' ? ' on' : ''));
    b.type = 'button';
    b.appendChild(el('span', null, k[1]));
    b.appendChild(el('b', null, String(k[2])));
    b.appendChild(el('small', null, k[3]));
    b.addEventListener('click', function(){ OD.filtro = k[0]; OD.aba = 'historico'; odRender(); });
    kp.appendChild(b);
  });
  sec.appendChild(kp);

  sec.appendChild(odCartaoAgenda(d));

  var abas = el('div', 'od-abas');
  [['historico', 'Histórico'], ['execucoes', 'Execuções'], ['pastas', 'Pastas no OneDrive']].forEach(function(a){
    var b = el('button', OD.aba === a[0] ? 'on' : null, a[1]);
    b.type = 'button';
    b.addEventListener('click', function(){ OD.aba = a[0]; odRender(); });
    abas.appendChild(b);
  });
  sec.appendChild(abas);

  if (OD.aba === 'execucoes') sec.appendChild(odExecucoes(d));
  else if (OD.aba === 'pastas') sec.appendChild(odPastas(d));
  else sec.appendChild(odHistorico(d));
}

function odCartaoAgenda(d){
  var ag = d.agendamento || {};
  var c = el('div', 'od-cartao');
  var h = el('header');
  h.appendChild(el('h3', null, 'Rotina da pasta 00_Entrada'));
  var ult = (d.execucoes || []).filter(function(e){ return e.terminada_em; })[0];
  h.appendChild(el('small', null, ult ? 'Última passagem: ' + odData(ult.terminada_em, true) + ' · ' + ult.n_ficheiros + ' ficheiro(s)' : 'Ainda não correu.'));
  c.appendChild(h);
  var a = el('div', 'od-agenda');
  var hs = el('div', 'od-horas');
  (ag.horas || []).forEach(function(x){ hs.appendChild(el('span', 'od-hora', x)); });
  if (!ag.ativo) hs.appendChild(el('span', 'od-pill mau', 'Em pausa'));
  a.appendChild(hs);
  var px = odProxima(ag);
  var aCorrer = (d.execucoes || []).filter(function(e){ return e.estado === 'a_correr' || e.estado === 'pedida'; })[0];
  a.appendChild(el('div', 'od-prox', aCorrer
    ? (aCorrer.estado === 'pedida' ? 'Execução pedida às ' + odData(aCorrer.pedida_em, true).slice(11) + ', à espera da rotina.' : 'A correr desde ' + odData(aCorrer.iniciada_em, true).slice(11) + '.')
    : (px ? 'Próxima: ' + OD_DIAS[px.getDay()] + ', ' + String(px.getHours()).padStart(2, '0') + ':' + String(px.getMinutes()).padStart(2, '0') + ' · todos os dias' : 'Sem passagens marcadas.')));
  var ac = el('div', 'od-acoes');
  var bAg = el('button', 'btn', 'Alterar horário');
  bAg.type = 'button';
  bAg.addEventListener('click', function(){ odJanelaAgenda(ag); });
  var bCo = el('button', 'btn primary', 'Correr agora');
  bCo.type = 'button';
  bCo.disabled = Boolean(aCorrer);
  bCo.addEventListener('click', function(){
    bCo.disabled = true;
    odPost('/api/onedrive/correr').then(function(r){
      toast(r.disparada ? 'Rotina a arrancar no Mac. A página atualiza sozinha.' : 'Pedido registado. A próxima passagem trata dele.');
      odCarregar(); odVigiar();
    }).catch(function(e){ bCo.disabled = false; toast(e.message || 'Não foi possível pedir a execução.'); });
  });
  ac.appendChild(bAg); ac.appendChild(bCo);
  a.appendChild(ac);
  c.appendChild(a);
  var av = el('div', 'od-aviso');
  av.textContent = d.disparo_direto
    ? 'Corre no Mac (Chrome aberto e OneDrive sincronizado). Cada ficheiro da raiz vai para a Caixa de entrada, o original passa para 00_Entrada/OK e uma cópia vai para a pasta da área.'
    : 'O «Correr agora» fica registado e é apanhado pela próxima passagem. Para arrancar logo, falta pôr ROTINA_ENTRADA_URL e ROTINA_ENTRADA_TOKEN nas Variables do Railway (token criado na rotina, em claude.ai/code/routines → API).';
  c.appendChild(av);
  return c;
}

/* Enquanto houver uma execucao pedida ou a correr, rele de 20 em 20 s. */
function odVigiar(){
  if (OD.vigia) return;
  OD.vigia = setInterval(function(){
    var sec = document.getElementById('view-onedrive');
    var aberto = OD.d && (OD.d.execucoes || []).some(function(e){ return e.estado === 'a_correr' || e.estado === 'pedida'; });
    if (!sec || !sec.classList.contains('is-active') || !aberto){ clearInterval(OD.vigia); OD.vigia = null; return; }
    odCarregar();
  }, 20000);
}

function odHistorico(d){
  var c = el('div', 'od-cartao');
  var f = el('div', 'od-filtros');
  var inp = el('input');
  inp.type = 'search';
  inp.placeholder = 'Procurar ficheiro, área, tarefa…';
  inp.value = OD.procura;
  inp.addEventListener('input', function(){
    OD.procura = inp.value;
    var lista = c.querySelector('.od-lista');
    if (lista) lista.parentNode.replaceChild(odLista(d), lista);
  });
  f.appendChild(inp);
  if (OD.filtro !== 'todos'){
    var lim = el('button', 'btn', 'Ver todos');
    lim.type = 'button';
    lim.addEventListener('click', function(){ OD.filtro = 'todos'; odRender(); });
    f.appendChild(lim);
  }
  c.appendChild(f);
  c.appendChild(odLista(d));
  return c;
}

function odPassa(f){
  var s = odSituacao(f)[0];
  if (OD.filtro === 'aprovar' && !(s === 'Por aprovar' || s === 'Por triar na caixa' || s === 'A ler')) return false;
  if (OD.filtro === 'copiar' && !(f.movido_para && !f.copiado_para && f.estado !== 'erro')) return false;
  if (OD.filtro === 'followup' && !(f.follow_ups || []).some(function(x){ return !x.feito; })) return false;
  if (OD.procura.trim()){
    var txt = odNorm([f.nome, f.area, f.nota, f.copiado_para, f.proposta_resumo,
      (f.criados || []).map(function(x){ return x.nome; }).join(' '),
      (f.follow_ups || []).map(function(x){ return x.titulo; }).join(' ')].join(' '));
    var ok = odNorm(OD.procura).split(/\s+/).filter(Boolean).every(function(p){ return txt.indexOf(p) >= 0; });
    if (!ok) return false;
  }
  return true;
}

function odLista(d){
  var box = el('div', 'od-lista');
  var fs = (d.ficheiros || []).filter(odPassa);
  if (!fs.length){
    box.appendChild(el('div', 'od-vazio', (d.ficheiros || []).length ? 'Nenhum ficheiro com estes filtros.' : 'Ainda não entrou nenhum ficheiro pela pasta 00_Entrada.'));
    return box;
  }
  var cab = el('div', 'od-l cab');
  ['Entrou', 'Ficheiro', 'O que gerou no Farol', 'Área e cópia', 'Follow-up', ''].forEach(function(t){ cab.appendChild(el('div', null, t)); });
  box.appendChild(cab);
  var limite = OD.limite || 100;
  fs.slice(0, limite).forEach(function(f){ box.appendChild(odLinha(f)); });
  if (fs.length > limite){
    var m = el('div', 'od-mais');
    var b = el('button', 'btn', 'Mostrar mais (' + (fs.length - limite) + ')');
    b.type = 'button';
    b.addEventListener('click', function(){ OD.limite = limite + 100; odRender(); });
    m.appendChild(b);
    box.appendChild(m);
  }
  return box;
}

function odLinha(f){
  var l = el('div', 'od-l');
  l.appendChild(el('div', 'data', odData(f.criado_em, true)));

  var n = el('div', 'nome');
  if (f.inbox_id){
    var a = el('a');
    a.href = '/api/inbox/' + f.inbox_id + '/ficheiro';
    a.target = '_blank'; a.rel = 'noopener';
    a.title = 'Abrir o ficheiro';
    a.appendChild(el('b', null, f.nome));
    n.appendChild(a);
  } else n.appendChild(el('b', null, f.nome));
  if (f.proposta_resumo) n.appendChild(el('small', null, f.proposta_resumo));
  if (f.erro) n.appendChild(el('small', null, '⚠ ' + f.erro));
  if (f.nota) n.appendChild(el('div', 'od-nota', f.nota));
  l.appendChild(n);

  var g = el('div');
  var sit = odSituacao(f);
  var ps = el('button', 'od-pill ' + sit[1], sit[0]);
  ps.type = 'button';
  ps.title = 'Abrir a Caixa de entrada';
  ps.addEventListener('click', function(){
    if (window.IB && !IB.carregado && typeof ibCarregar === 'function') ibCarregar();
    show('inbox');
  });
  g.appendChild(ps);
  (f.criados || []).forEach(function(c){
    var x = el('small', null, (OD_TIPOS[c.tipo] || c.tipo) + ': ' + (c.nome || '#' + c.id) + (c.aprovado === false ? ' (por aprovar)' : ''));
    g.appendChild(x);
  });
  if (!(f.criados || []).length && f.proposta_tipo) g.appendChild(el('small', null, 'Proposta: ' + (OD_TIPOS[f.proposta_tipo] || f.proposta_tipo)));
  l.appendChild(g);

  var ar = el('div');
  ar.appendChild(el('div', null, f.area || '—'));
  if (f.area && f.area_de === 'proposta') ar.appendChild(el('small', null, 'área proposta pela leitura'));
  if (f.copiado_para) ar.appendChild(el('small', null, '↳ ' + f.copiado_para));
  else if (f.estado === 'erro') ar.appendChild(el('small', null, 'Ficou na raiz da 00_Entrada.'));
  else if (!f.area_id) ar.appendChild(el('small', null, 'Cópia à espera da área.'));
  else if (!f.pasta_destino) ar.appendChild(el('small', null, 'Cópia à espera: área sem pasta definida.'));
  else ar.appendChild(el('small', null, 'Cópia na próxima passagem → ' + f.pasta_destino));
  l.appendChild(ar);

  var fu = el('div');
  (f.follow_ups || []).forEach(function(t){
    var b = el('button', 'od-fu' + (t.feito ? ' feito' : ''), '• ' + t.titulo + (t.prazo ? ' · ' + odData(t.prazo) : ''));
    b.type = 'button';
    b.title = 'Abrir a tarefa';
    b.addEventListener('click', function(){ odAbrirTarefa(t.id); });
    fu.appendChild(b);
  });
  if (!(f.follow_ups || []).length) fu.appendChild(el('small', null, '—'));
  l.appendChild(fu);

  var ac = el('div', 'acoes');
  var b1 = el('button', 'btn', '+ Follow-up');
  b1.type = 'button';
  b1.addEventListener('click', function(){ odJanelaFollowUp(f); });
  var b2 = el('button', 'btn', f.nota ? 'Editar nota' : 'Nota');
  b2.type = 'button';
  b2.addEventListener('click', function(){ odJanelaNota(f); });
  ac.appendChild(b1); ac.appendChild(b2);
  l.appendChild(ac);
  return l;
}

function odAbrirTarefa(id){
  show('tarefas');
  setTimeout(function(){ if (typeof tfAbrir === 'function') { try { tfAbrir(id); } catch (e) {} } }, 300);
}

function odExecucoes(d){
  var c = el('div', 'od-cartao');
  var ex = d.execucoes || [];
  if (!ex.length){ c.appendChild(el('div', 'od-vazio', 'A rotina ainda não correu.')); return c; }
  var cab = el('div', 'od-e cab');
  ['Quando', 'Origem', 'Estado', 'Resumo'].forEach(function(t){ cab.appendChild(el('div', null, t)); });
  c.appendChild(cab);
  ex.forEach(function(e){
    var l = el('div', 'od-e');
    l.appendChild(el('div', 'data', odData(e.iniciada_em || e.pedida_em, true)));
    l.appendChild(el('div', null, e.origem === 'manual' ? 'Correr agora' : 'Agendada'));
    var st = OD_EXEC[e.estado] || [e.estado, 'neutro'];
    var p = el('div'); p.appendChild(el('span', 'od-pill ' + st[1], st[0])); l.appendChild(p);
    var r = el('div', 'res');
    var nums = e.terminada_em ? e.n_ficheiros + ' ficheiro(s), ' + e.n_copias + ' cópia(s)' + (e.n_erros ? ', ' + e.n_erros + ' erro(s)' : '') : '';
    r.textContent = [nums, e.resumo].filter(Boolean).join(' — ') || '—';
    l.appendChild(r);
    c.appendChild(l);
  });
  return c;
}

function odPastas(d){
  var c = el('div', 'od-cartao');
  var h = el('header');
  h.appendChild(el('h3', null, 'Pasta do OneDrive de cada área'));
  h.appendChild(el('small', null, 'Caminho a partir de OneDrive-Pessoal. Uma sub-área sem pasta usa a da área.'));
  c.appendChild(h);
  (d.pastas || []).forEach(function(p){
    var l = el('div', 'od-p' + (p.sub ? ' sub' : ''));
    l.appendChild(el('div', 'nm', p.sub ? p.nome.split(' › ').slice(1).join(' › ') : p.nome));
    var i = el('input');
    i.value = p.caminho || '';
    i.placeholder = p.herdado ? 'usa ' + p.efetivo : 'sem pasta — a cópia fica à espera';
    l.appendChild(i);
    var b = el('button', 'btn', 'Gravar');
    b.type = 'button';
    b.disabled = true;
    i.addEventListener('input', function(){ b.disabled = (i.value.trim() === (p.caminho || '')); });
    b.addEventListener('click', function(){
      b.disabled = true;
      odPost('/api/onedrive/pastas', { context_id: p.context_id, caminho: i.value }, 'PUT').then(function(lista){
        OD.d.pastas = lista; toast('Pasta gravada.'); odCarregar();
      }).catch(function(e){ b.disabled = false; toast(e.message || 'Não foi possível gravar.'); });
    });
    l.appendChild(b);
    c.appendChild(l);
  });
  return c;
}

function odJanela(titulo, nota, campos, botoes){
  var dlg = el('dialog', 'od-dlg');
  var f = el('form'); f.method = 'dialog';
  f.appendChild(el('h3', null, titulo));
  if (nota) f.appendChild(el('p', null, nota));
  campos.forEach(function(x){ f.appendChild(x); });
  var bar = el('div', 'acoes');
  botoes.forEach(function(b){ bar.appendChild(b); });
  f.appendChild(bar);
  dlg.appendChild(f);
  dlg.addEventListener('close', function(){ if (dlg.parentNode) dlg.parentNode.removeChild(dlg); });
  document.body.appendChild(dlg);
  dlg.showModal();
  return dlg;
}
function odCampo(rot, tipo, valor, opcoes){
  var l = el('label', null, rot);
  var i;
  if (tipo === 'select'){
    i = el('select');
    opcoes.forEach(function(o){ var op = el('option', null, o[1]); op.value = o[0]; if (String(o[0]) === String(valor == null ? '' : valor)) op.selected = true; i.appendChild(op); });
  } else if (tipo === 'textarea'){
    i = el('textarea'); i.value = valor == null ? '' : valor; i.rows = 4;
  } else { i = el('input'); i.type = tipo; i.value = valor == null ? '' : String(valor); }
  l.appendChild(i);
  l.input = i;
  return l;
}
function odBotao(txt, cls){ var b = el('button', 'btn' + (cls ? ' ' + cls : ''), txt); b.type = 'button'; return b; }

function odJanelaFollowUp(f){
  var pessoas = ((window.G && G.people) || []).filter(function(p){ return p.can_own_tasks && p.active !== false; });
  var areas = ((OD.d && OD.d.pastas) || []).map(function(p){ return [p.context_id, p.nome]; });
  var amanha = new Date(); amanha.setDate(amanha.getDate() + 7);
  var tit = odCampo('O que é preciso fazer', 'text', '');
  var prazo = odCampo('Prazo', 'date', amanha.toISOString().slice(0, 10));
  var dono = odCampo('Responsável', 'select', pessoas.length ? pessoas[0].id : '', [['', '—']].concat(pessoas.map(function(p){ return [p.id, p.name]; })));
  var area = odCampo('Área', 'select', f.area_id || '', [['', '—']].concat(areas));
  var prio = odCampo('Prioridade', 'select', 'normal', [['baixa', 'Baixa'], ['normal', 'Normal'], ['media', 'Média'], ['alta', 'Alta']]);
  var notas = odCampo('Notas', 'textarea', '');
  var dois = el('div', 'dois'); dois.appendChild(prazo); dois.appendChild(dono);
  var dois2 = el('div', 'dois'); dois2.appendChild(area); dois2.appendChild(prio);
  var cancelar = odBotao('Cancelar');
  var criar = odBotao('Criar tarefa', 'primary');
  var temDoc = (f.criados || []).some(function(c){ return c.tipo === 'documento'; });
  var dlg = odJanela('Follow-up de «' + f.nome + '»',
    'Cria uma tarefa nas Tarefas' + (temDoc ? ', com o documento agarrado.' : '. O documento ainda não foi arrumado: a tarefa fica sem anexo.'),
    [tit, dois, dois2, notas], [cancelar, criar]);
  setTimeout(function(){ tit.input.focus(); }, 30);
  cancelar.addEventListener('click', function(){ dlg.close(); });
  criar.addEventListener('click', function(){
    if (!tit.input.value.trim()){ toast('Escreve o que é preciso fazer.'); return; }
    criar.disabled = true;
    odPost('/api/onedrive/ficheiros/' + f.id + '/follow-up', {
      titulo: tit.input.value, due_on: prazo.input.value || null, owner_id: dono.input.value || null,
      context_id: area.input.value || null, priority: prio.input.value, notas: notas.input.value
    }).then(function(){
      dlg.close(); toast('Follow-up criado nas Tarefas.');
      if (typeof load === 'function') { try { load(); } catch (e) {} }
      odCarregar();
    }).catch(function(e){ criar.disabled = false; toast(e.message || 'Não foi possível criar.'); });
  });
}

function odJanelaNota(f){
  var nota = odCampo('Nota', 'textarea', f.nota || '');
  var cancelar = odBotao('Cancelar');
  var gravar = odBotao('Gravar', 'primary');
  var dlg = odJanela('Nota sobre «' + f.nome + '»', 'Para lembrar o que se pretende com este papel.', [nota], [cancelar, gravar]);
  cancelar.addEventListener('click', function(){ dlg.close(); });
  gravar.addEventListener('click', function(){
    gravar.disabled = true;
    odPost('/api/onedrive/ficheiros/' + f.id + '/nota', { nota: nota.input.value }, 'PATCH').then(function(){
      dlg.close(); toast('Nota gravada.'); odCarregar();
    }).catch(function(e){ gravar.disabled = false; toast(e.message || 'Não foi possível gravar.'); });
  });
}

function odJanelaAgenda(ag){
  var horas = odCampo('Horas (separadas por vírgula)', 'text', (ag.horas || []).join(', '));
  var at = el('label', 'linha');
  var cb = el('input'); cb.type = 'checkbox'; cb.checked = ag.ativo !== false;
  at.appendChild(cb); at.appendChild(document.createTextNode('Rotina ativa'));
  var cancelar = odBotao('Cancelar');
  var gravar = odBotao('Gravar', 'primary');
  var dlg = odJanela('Horário da rotina', 'Todos os dias, hora de Lisboa. A rotina lê este horário em cada passagem e acerta a sua própria agenda.', [horas, at], [cancelar, gravar]);
  cancelar.addEventListener('click', function(){ dlg.close(); });
  gravar.addEventListener('click', function(){
    var lista = horas.input.value.split(/[,;\s]+/).filter(Boolean);
    gravar.disabled = true;
    odPost('/api/onedrive/agendamento', { horas: lista, ativo: cb.checked }, 'PUT').then(function(){
      dlg.close(); toast('Horário gravado. A rotina acerta-se na próxima passagem.'); odCarregar();
    }).catch(function(e){ gravar.disabled = false; toast(e.message || 'Não foi possível gravar.'); });
  });
}

/* ---- Para a rotina ----
   A rotina poe um ficheiro no #odUpload (ferramenta de upload do browser) e
   chama odEnviarFicheiro. Devolve { ok, estado, inbox_id, ficheiro_id, erro }. */
function odInputUpload(){
  var i = document.getElementById('odUpload');
  if (i) return i;
  i = document.createElement('input');
  i.type = 'file';
  i.id = 'odUpload';
  i.setAttribute('aria-label', 'Ficheiro da Entrada do OneDrive');
  document.body.appendChild(i);
  return i;
}

window.odEnviarFicheiro = function(execId, meta){
  meta = meta || {};
  var inp = odInputUpload();
  var lista = inp.files ? Array.prototype.slice.call(inp.files) : [];
  var f = lista[0];
  if (!f) return Promise.resolve({ ok: false, erro: 'sem ficheiro no #odUpload' });
  var nome = meta.nome || f.name;
  var fd = new FormData();
  fd.append('ficheiro', f, nome);
  fd.append('note', 'Entrada do OneDrive (00_Entrada): ' + nome);
  return fetch('/api/inbox', { method: 'POST', body: fd }).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){ return { st: r.status, j: j }; });
  }).then(function(x){
    var reg = { execucao_id: execId, nome: nome, tamanho: f.size, modificado_em: meta.modificado_em || null };
    if (x.st === 201) { reg.estado = 'enviado'; reg.inbox_id = x.j.id; }
    else if (x.st === 409) { reg.estado = 'repetido'; reg.inbox_id = x.j.id; }
    else { reg.estado = 'erro'; reg.erro = (x.j && x.j.error) || ('HTTP ' + x.st); }
    return fetch('/api/onedrive/ficheiros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reg) })
      .then(function(r){ return r.json(); })
      .then(function(j){
        inp.value = '';
        return { ok: reg.estado !== 'erro', estado: reg.estado, inbox_id: reg.inbox_id || null, ficheiro_id: j.id, erro: reg.erro || null };
      });
  }).catch(function(e){ return { ok: false, erro: e.message }; });
};

function odMontar(){
  if (document.getElementById('view-onedrive')) return;
  odEstilo();
  if (window.TITLES) TITLES.onedrive = ['Entrada do OneDrive', 'Ficheiros da pasta 00_Entrada: o que geraram, para onde foram e o que falta'];
  if (window.MN_ORDEM) MN_ORDEM.onedrive = 46;
  var nav = document.getElementById('nav');
  if (nav && !nav.querySelector('[data-view="onedrive"]')){
    var b = el('button');
    b.dataset.view = 'onedrive';
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 8.5a4 4 0 0 1 .5 9.5z"/><path d="M12 11v6M9.5 13.5 12 11l2.5 2.5"/></svg>';
    b.appendChild(document.createTextNode(' Entrada OneDrive'));
    nav.appendChild(b);
  }
  var sec = el('section', 'view');
  sec.id = 'view-onedrive';
  var docs = document.getElementById('view-documentos');
  if (docs) docs.parentNode.insertBefore(sec, docs); else document.querySelector('main').appendChild(sec);
  odInputUpload();
}

function odLigar(){
  odMontar();
  if (typeof window.show === 'function' && !window.show.odEmbrulhado){
    var antes = window.show;
    var novo = function(v){
      var r = antes.apply(this, arguments);
      if (v === 'onedrive'){
        try { odRender(); odCarregar(); odVigiar(); } catch (e) { console.error('[farol] onedrive', e); }
      }
      return r;
    };
    for (var k in antes) if (Object.prototype.hasOwnProperty.call(antes, k)) novo[k] = antes[k];
    novo.odEmbrulhado = true;
    window.show = novo;
  }
  /* Abrir o Farol com #onedrive leva logo a este ecra (a rotina usa isto). */
  if (location.hash === '#onedrive') setTimeout(function(){ show('onedrive'); }, 400);
}

(function odEsperar(n){
  if (document.getElementById('nav') && typeof el === 'function' && typeof show === 'function'){
    try { odLigar(); } catch (e) { console.error('[farol] onedrive', e); }
    return;
  }
  if (n < 60) setTimeout(function(){ odEsperar(n + 1); }, 250);
})(0);
