/* Farol - o detalhe de um aviso do painel Hoje, sem sair do painel.
 *
 * Clicar num cartao do Hoje atirava a pessoa para as Tarefas ou para os
 * Documentos e deixava-a la, a procurar a linha que tinha acabado de ver.
 * Agora abre uma janela com o aviso e com os campos que se mexem quando se
 * quer resolve-lo - o prazo, o estado, a validade - e o Hoje fica por baixo,
 * intacto. Quem quiser o ecra inteiro tem sempre o botao para la ir.
 *
 * Nao toca no app.js a nao ser por uma linha: o attnCard chama avAbrir(a) se
 * ela existir. Usa os globais do app.js ($, el, clear, pill, toast, apiGestao,
 * D, G, load, loadGestao, show, diasAte, urgencia, editarDocumento) e, quando
 * estao carregados, o tfAbrir das Tarefas e o fiAbrir da ficha.
 */

var AV = { aberto: null, folha: null, casa: null, depois: null, tfFechar: null };

/* A janela veste-se com o que ja existe (.ar-dlg, das Areas): o mesmo desenho
   da correccao de um documento. Daqui so vem o que falta. */
var AV_CSS = [
  '.ar-dlg.av{max-width:34rem}',
  '.av-top{display:flex;align-items:flex-start;gap:.75rem}',
  '.av-top .grow{flex:1;min-width:0}',
  '.av-top h3{margin:0}',
  '.av-sub{color:var(--muted);font-size:.8125rem;margin:.15rem 0 0}',
  '.av-grelha{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}',
  '.av-grelha .larga{grid-column:1 / -1}',
  '.ar-dlgc textarea{width:100%;padding:.5rem .6rem;border:1px solid var(--line);',
  'border-radius:8px;background:var(--ground);color:var(--ink);font:inherit;',
  'font-size:.875rem;min-height:4.5rem;resize:vertical}',
  '.av-acoes{display:flex;gap:.5rem;align-items:center;margin-top:.25rem}',
  '.av-acoes .esq{margin-right:auto}',
  '.av-espera{color:var(--muted);font-size:.875rem;padding:.25rem 0}',
  '@media (max-width:520px){.av-grelha{grid-template-columns:1fr}}'
].join('');

function avEstilo(){
  if (document.getElementById('avCss')) return;
  var s = document.createElement('style');
  s.id = 'avCss';
  s.textContent = AV_CSS;
  document.head.appendChild(s);
}

function avFechar(){
  var d = document.getElementById('avDlg');
  if (d){ try { d.close(); } catch (e) {} d.remove(); }
  AV.aberto = null;
}

/* ---------------- pecas ---------------- */

function avPrazoPill(a){
  /* Uma tarefa aberta a partir do ecra de uma area pode nao ter prazo: sem
     data nao ha urgencia a calcular, e o parseDay rebentava com a janela. */
  if (!a.quando) return pill('sem prazo', '');
  var n = typeof diasAte === 'function' ? diasAte(a.quando) : null;
  var u = typeof urgencia === 'function' ? urgencia(n, a.origem) : { texto: '', nivel: '' };
  return pill(u.texto || a.quando || '—', u.nivel);
}

function avShell(titulo, sub, a){
  avEstilo();
  avFechar();
  AV.aberto = a;

  var dlg = el('dialog', 'ar-dlg av');
  dlg.id = 'avDlg';
  var cx = el('div', 'ar-dlgc');

  var topo = el('div', 'av-top');
  var g = el('div', 'grow');
  g.appendChild(el('h3', null, titulo || '—'));
  if (sub) g.appendChild(el('p', 'av-sub', sub));
  topo.appendChild(g);
  topo.appendChild(avPrazoPill(a));
  cx.appendChild(topo);

  var grelha = el('div', 'av-grelha');
  cx.appendChild(grelha);
  var acoes = el('div', 'av-acoes');
  cx.appendChild(acoes);

  dlg.appendChild(cx);
  dlg.addEventListener('cancel', function(){ setTimeout(avFechar, 0); });
  document.body.appendChild(dlg);
  dlg.showModal();
  return { dlg: dlg, cx: cx, grelha: grelha, acoes: acoes };
}

function avCampo(grelha, rotulo, elemento, larga){
  var w = el('div', larga ? 'larga' : null);
  w.appendChild(el('label', null, rotulo));
  w.appendChild(elemento);
  grelha.appendChild(w);
  return elemento;
}
function avTexto(v){ var i = el('input'); i.type = 'text'; i.value = v || ''; return i; }
function avData(v){ var i = el('input'); i.type = 'date'; i.value = v || ''; return i; }
function avNotas(v){ var t = el('textarea'); t.value = v || ''; return t; }
function avSelect(ops, v){
  var s = el('select');
  ops.forEach(function(o){ s.appendChild(new Option(o[1], o[0])); });
  s.value = v == null ? '' : String(v);
  return s;
}
function avPessoas(v){
  var s = el('select');
  s.appendChild(new Option('— de ninguém —', ''));
  ((window.G && G.people) || D.people || []).forEach(function(p){
    s.appendChild(new Option(p.name, p.id));
  });
  s.value = v == null ? '' : String(v);
  return s;
}
function avAreas(v){
  var s = el('select');
  s.appendChild(new Option('— sem área —', ''));
  ((window.G && G.contextos) || []).filter(function(c){ return !c.parent_id && c.active; })
    .forEach(function(area){
      var gr = document.createElement('optgroup');
      gr.label = area.name;
      gr.appendChild(new Option(area.name, area.id));
      G.contextos.filter(function(c){ return c.parent_id === area.id && c.active; })
        .forEach(function(sub){ gr.appendChild(new Option('   ' + sub.name, sub.id)); });
      s.appendChild(gr);
    });
  s.value = v == null ? '' : String(v);
  return s;
}

/* A esquerda a saida para o ecra inteiro, a direita fechar e gravar. */
function avBotoes(s, rotuloIr, ir, gravar){
  clear(s.acoes);
  if (rotuloIr){
    var b = el('button', 'btn esq', rotuloIr);
    b.type = 'button';
    b.addEventListener('click', ir);
    s.acoes.appendChild(b);
  }
  var cancelar = el('button', 'btn', 'Fechar');
  cancelar.type = 'button';
  cancelar.addEventListener('click', avFechar);
  s.acoes.appendChild(cancelar);
  if (gravar){
    var ok = el('button', 'btn primary', 'Gravar');
    ok.type = 'button';
    ok.addEventListener('click', function(){ gravar(ok); });
    s.acoes.appendChild(ok);
  }
}

function avGravar(botao, rota, corpo, tambemGestao){
  botao.disabled = true;
  apiGestao(rota, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo)
  }).then(function(){
    avFechar();
    toast('Gravado.');
    load();
    if (tambemGestao && typeof loadGestao === 'function') loadGestao();
  }).catch(function(e){
    botao.disabled = false;
    toast(e.message || 'Não foi possível gravar.');
  });
}

/* Levar a tarefa as Tarefas: la dentro, o tfIrPara poe a lista no separador
   certo e abre o detalhe. Sem o ficheiro das Tarefas carregado, vai-se na
   mesma para la - mais vale a pagina certa do que nada. */
function avIrLista(id){
  if (typeof tfIrPara === 'function'){ tfIrPara(id); return; }
  show('tarefas');
  if (typeof tfAbrir === 'function') setTimeout(function(){ tfAbrir(id); }, 0);
}

/* ---------------- os tres tipos de aviso ---------------- */

var AV_ESTADOS = [['aberta', 'Por iniciar'], ['em_curso', 'Em execução'],
  ['a_espera', 'À espera'], ['concluida', 'Concluída'], ['cancelada', 'Não farei']];
var AV_PRIOS = [['alta', 'Alta'], ['media', 'Média'], ['normal', 'Nenhuma'], ['baixa', 'Baixa']];
var AV_DOCS_ID = [['', '— sem documento —'], ['cc', 'Cartão de Cidadão'],
  ['tr', 'Título de residência']];

/* ------------------------------------------------------------------ *
 * O detalhe de uma tarefa (3 out)
 *
 * Esta janela tinha um formulario proprio - titulo, prazo, estado, de quem,
 * prioridade, area, notas - e mais nada. Quem via a tarefa no Hoje nao via os
 * passos, nem as subtarefas, nem o email, nem os comentarios: para isso tinha
 * de ir as Tarefas e abri-la outra vez. Eram dois detalhes da mesma coisa, e
 * um deles ficava sempre para tras.
 *
 * Agora e um so. A folha pede emprestado o painel das Tarefas - o proprio no,
 * nao uma copia - e po-lo aqui dentro; ao fechar devolve-o. E exactamente o
 * mesmo detalhe, com tudo o que lhe for acrescentado de futuro.
 * ------------------------------------------------------------------ */

var AV_FOLHA_CSS = [
  '.av-folha{position:fixed;inset:0;z-index:55;display:flex;justify-content:flex-end}',
  '.av-folha-fundo{position:absolute;inset:0;background:rgba(15,23,32,.28)}',
  '.av-folha-cx{position:relative;width:min(27rem,100vw);height:100%;background:var(--surface);',
  'border-left:1px solid var(--line);box-shadow:-20px 0 60px -30px rgba(0,0,0,.45);',
  'display:flex;flex-direction:column;animation:avEntra .18s ease}',
  '.av-folha-mio{flex:1;min-height:0;overflow:auto;padding:14px 16px}',
  '.av-folha-rod{border-top:1px solid var(--line);padding:10px 16px;display:flex;gap:.5rem;align-items:center}',
  /* O painel vem de uma coluna que cola e tem altura propria: aqui quem rola e
     a folha, por isso ele volta a ser um bloco normal e sem moldura. */
  '.av-folha .tf-det{position:static;max-height:none;overflow:visible;width:auto;',
  'border:none;background:none;box-shadow:none;border-radius:0;padding:0;z-index:auto}',
  /* Nas Tarefas a cruz so aparece em ecras estreitos, porque o painel vive la
     sempre. Aqui e a saida da folha: aparece sempre. */
  '.av-folha .tf-fechar{display:inline-flex}',
  '@keyframes avEntra{from{transform:translateX(16px);opacity:.4}to{transform:none;opacity:1}}',
  '@media (max-width:520px){.av-folha-cx{width:100vw}}'
].join('');

function avFolhaEstilo(){
  if (document.getElementById('avFolhaCss')) return;
  var s = document.createElement('style');
  s.id = 'avFolhaCss';
  s.textContent = AV_FOLHA_CSS;
  document.head.appendChild(s);
}

/* O painel, esteja onde estiver: os ecras das areas tambem o pedem emprestado,
   e quando estao a segura-lo o getElementById nao chega. */
function avPainel(){
  if (typeof aeNo === 'function'){ try { return aeNo('det', 'tfDet'); } catch (e) {} }
  return document.getElementById('tfDet');
}

function avFecharFolha(){
  if (!AV.folha) return;
  var folha = AV.folha, casa = AV.casa, depois = AV.depois, antigo = AV.tfFechar;
  AV.folha = null; AV.casa = null; AV.depois = null; AV.tfFechar = null;
  /* Repor o tfFecharDetalhe antes de o chamar, senao chama-se a si proprio. */
  if (antigo) tfFecharDetalhe = antigo;
  var no = avPainel();
  if (no && casa){
    if (depois && depois.parentNode === casa) casa.insertBefore(no, depois);
    else casa.appendChild(no);
    no.hidden = true;
  }
  folha.remove();
  if (typeof tfFecharPop === 'function') tfFecharPop();
  /* Vindo da cruz do painel, o detalhe ja fechou e o TF.aberta esta vazio.
     Vindo do fundo ou do Escape, falta fecha-lo. */
  if (antigo && window.TF && TF.aberta) antigo();
  document.removeEventListener('keydown', avFolhaEscape, true);
}

function avFolhaEscape(e){
  if (e.key !== 'Escape' || !AV.folha) return;
  /* Primeiro Escape arruma o calendario ou o menu que esteja aberto por cima;
     so o seguinte e que fecha a folha. */
  if (document.querySelector('.tf-pop, .tf-menu')) return;
  e.stopPropagation();
  avFecharFolha();
}

/* O detalhe das Tarefas, aqui dentro. Devolve false quando as Tarefas ainda
   nao estao carregadas - ai serve o formulario antigo. */
function avFolhaTarefa(t){
  if (typeof tfMontar !== 'function' || typeof tfAbrir !== 'function') return false;
  if (!document.getElementById('tf')) return false;
  tfMontar();
  if (typeof aeDevolver === 'function'){ try { aeDevolver('det'); } catch (e) {} }
  var no = avPainel();
  if (!no || !no.parentNode) return false;

  avFolhaEstilo();
  avFechar();
  avFecharFolha();

  var folha = el('div', 'av-folha');
  var fundo = el('div', 'av-folha-fundo');
  fundo.addEventListener('click', avFecharFolha);
  folha.appendChild(fundo);
  var cx = el('div', 'av-folha-cx');
  var mio = el('div', 'av-folha-mio');
  cx.appendChild(mio);
  var rod = el('div', 'av-folha-rod');
  var bIr = el('button', 'btn', 'Abrir na lista');
  bIr.type = 'button';
  bIr.addEventListener('click', function(){ var id = t.id; avFecharFolha(); avIrLista(id); });
  rod.appendChild(bIr);
  cx.appendChild(rod);
  folha.appendChild(cx);
  document.body.appendChild(folha);

  AV.folha = folha;
  AV.casa = no.parentNode;
  AV.depois = no.nextSibling;
  mio.appendChild(no);

  /* A cruz do painel fecha o detalhe; aqui tem de fechar tambem a folha. Em
     vez de se mexer no botao, que renasce a cada desenho, veste-se o
     tfFecharDetalhe - e despe-se ao sair. */
  AV.tfFechar = typeof tfFecharDetalhe === 'function' ? tfFecharDetalhe : null;
  if (AV.tfFechar){
    tfFecharDetalhe = function(){
      var f = AV.tfFechar;
      if (f) f.apply(null, arguments);
      avFecharFolha();
    };
  }
  document.addEventListener('keydown', avFolhaEscape, true);

  TF.aberta = t.id;
  tfAbrir(t.id);
  return true;
}

function avTarefa(a){
  var t = typeof tfPorId === 'function' ? tfPorId(a.id) : null;
  if (!t) ((window.G && G.tasks) || []).forEach(function(x){ if (x.id === a.id) t = x; });
  /* Sem a lista de tarefas carregada nao ha nada honesto para mostrar aqui. */
  if (!t){ show('tarefas'); return; }

  /* O detalhe e o das Tarefas. So se as Tarefas nao estiverem de pe e que se
     desenha aqui o formulario curto. */
  if (avFolhaTarefa(t)) return;

  var s = avShell(t.title, 'Tarefa' + (a.detail ? ' · ' + a.detail : ''), a);
  var iTit = avCampo(s.grelha, 'Título', avTexto(t.title), true);
  var iPrazo = avCampo(s.grelha, 'Prazo', avData(t.due_on));
  var iEstado = avCampo(s.grelha, 'Estado', avSelect(AV_ESTADOS, t.status || 'aberta'));
  var iQuem = avCampo(s.grelha, 'De quem', avPessoas(t.owner_id));
  var iPrio = avCampo(s.grelha, 'Prioridade', avSelect(AV_PRIOS, t.priority || 'normal'));
  var iArea = avCampo(s.grelha, 'Área', avAreas(t.context_id), true);
  var iNotas = avCampo(s.grelha, 'Notas', avNotas(t.notes), true);

  /* A prova do que se fez costuma aparecer aqui, no aviso do dia, e nao mais
     tarde quando a pessoa se lembrar de ir as Tarefas: o mesmo bloco de
     documentos do anexos.js, que grava sozinho. */
  if (typeof axBloco === 'function') avCampo(s.grelha, 'Documentos', axBloco(t), true);

  avBotoes(s, 'Abrir na lista', function(){
    avFechar();
    avIrLista(t.id);
  }, function(botao){
    avGravar(botao, '/api/gestao/tarefas/' + t.id, {
      title: iTit.value.trim() || t.title,
      due_on: iPrazo.value || null,
      status: iEstado.value,
      priority: iPrio.value,
      owner_id: iQuem.value || null,
      context_id: iArea.value || null,
      notes: iNotas.value.trim() || null
    }, true);
  });
  /* Apagar mora aqui tambem: e nesta janela que se olha para uma tarefa a
     partir do Hoje e dos ecras das areas. Fica ao lado da saida, longe do
     Gravar, para nao se carregar nele por engano. */
  if (typeof tfApagarJa === 'function'){
    var bApagar = el('button', 'btn danger', 'Apagar');
    bApagar.type = 'button';
    bApagar.addEventListener('click', function(){
      tfApagarJa(t, function(){ avFechar(); load(); });
    });
    /* Encostado a saida, a esquerda: a margem que empurra o resto para a
       direita passa para ele. */
    var esq = s.acoes.querySelector('.esq');
    if (esq){ esq.style.marginRight = '0'; bApagar.style.marginRight = 'auto'; }
    s.acoes.insertBefore(bApagar, esq ? esq.nextSibling : s.acoes.firstChild);
  }
  iPrazo.focus();
}

/* A correccao de um documento ja existe e e a mesma coisa: reaproveita-se em
   vez de nascer aqui um segundo formulario para os mesmos sete campos. */
function avDocumento(a){
  var d = null;
  (D.documents || []).forEach(function(x){ if (x.id === a.id) d = x; });
  if (!d || typeof editarDocumento !== 'function'){ show('documentos'); return; }
  avFechar();
  editarDocumento(d, a);
}

function avPessoa(a){
  var s = avShell(a.title, 'Validade do documento de identificação', a);
  s.grelha.appendChild(el('p', 'av-espera larga', 'A ler…'));
  avBotoes(s, null, null, null);

  apiGestao('/api/pessoas').then(function(r){
    if (AV.aberto !== a) return;
    var p = null;
    ((r && r.pessoas) || []).forEach(function(x){ if (x.id === a.id) p = x; });
    if (!p) throw new Error('Pessoa não encontrada.');

    clear(s.grelha);
    var iTipo = avCampo(s.grelha, 'Documento', avSelect(AV_DOCS_ID, p.id_doc_tipo || ''));
    var iNum = avCampo(s.grelha, 'Número', avTexto(p.id_doc_numero));
    var iVal = avCampo(s.grelha, 'Válido até', avData(p.id_doc_validade), true);

    avBotoes(s, 'Abrir a ficha', function(){
      avFechar();
      if (typeof fiAbrir === 'function') fiAbrir(p.id); else show('familia');
    }, function(botao){
      if (iNum.value.trim() && !iTipo.value){
        toast('Diz que documento é: Cartão de Cidadão ou Título de residência.');
        return;
      }
      avGravar(botao, '/api/pessoas/' + p.id, {
        id_doc_tipo: iTipo.value || null,
        id_doc_numero: iNum.value.trim() || null,
        id_doc_validade: iVal.value || null
      }, false);
    });
    iVal.focus();
  }).catch(function(e){
    if (AV.aberto !== a) return;
    clear(s.grelha);
    s.grelha.appendChild(el('p', 'av-espera larga', e.message || 'Não foi possível ler a pessoa.'));
    avBotoes(s, null, null, null);
  });
}

/* O estilo entra assim que o modulo carrega, e nao a primeira vez que a janela
   abre: a correccao de um documento e desenhada pelo app.js e tambem precisa
   destas regras. */
avEstilo();

function avAbrir(a){
  if (!a || !a.origem) return;
  avFecharFolha();
  if (a.origem === 'tarefa') return avTarefa(a);
  if (a.origem === 'documento') return avDocumento(a);
  if (a.origem === 'pessoa') return avPessoa(a);
  /* O lembrete de um evento abre a janela do proprio evento (eventos.js). */
  if (a.origem === 'evento' && typeof evAbrirId === 'function') return evAbrirId(a.id);
}
