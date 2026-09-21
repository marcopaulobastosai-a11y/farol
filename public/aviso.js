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

var AV = { aberto: null };

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

/* ---------------- os tres tipos de aviso ---------------- */

var AV_ESTADOS = [['aberta', 'Por iniciar'], ['em_curso', 'Em execução'],
  ['a_espera', 'À espera'], ['concluida', 'Concluída'], ['cancelada', 'Não farei']];
var AV_PRIOS = [['alta', 'Alta'], ['media', 'Média'], ['normal', 'Nenhuma'], ['baixa', 'Baixa']];
var AV_DOCS_ID = [['', '— sem documento —'], ['cc', 'Cartão de Cidadão'],
  ['tr', 'Título de residência']];

function avTarefa(a){
  var t = null;
  ((window.G && G.tasks) || []).forEach(function(x){ if (x.id === a.id) t = x; });
  /* Sem a lista de tarefas carregada nao ha nada honesto para mostrar aqui. */
  if (!t){ show('tarefas'); return; }

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
    show('tarefas');
    if (typeof tfAbrir === 'function') setTimeout(function(){ tfAbrir(t.id); }, 0);
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
  if (a.origem === 'tarefa') return avTarefa(a);
  if (a.origem === 'documento') return avDocumento(a);
  if (a.origem === 'pessoa') return avPessoa(a);
}
