/* =========================================================================
 * Farol - anexos de uma tarefa
 *
 * Um ficheiro que se junta a uma tarefa nao fica um ficheiro solto: nasce
 * como documento no arquivo, com a area e a pessoa da tarefa, para que dali
 * a um ano ainda se encontre por quem e, do que e e a que trabalho pertence.
 * O mesmo bloco serve os tres sitios onde se olha para uma tarefa - o detalhe
 * nas Tarefas, o painel dos Projetos e a janela de um aviso no Hoje - porque
 * ter tres desenhos do mesmo era garantir que dois ficavam por corrigir.
 *
 * A app propoe o papel, a pessoa corrige: num pagamento por pagar o que
 * costuma faltar e a fatura, depois de pago e a prova. Fora disso e um anexo.
 * ========================================================================= */

var AX_PAPEIS = ['anexo', 'fatura', 'comprovativo', 'recibo'];
var AX_MAX = 25 * 1024 * 1024;

var AX_CSS = [
  ".ax{display:block}",
  ".ax-lin{display:flex;align-items:center;gap:8px;padding:3px 0;min-width:0}",
  ".ax-nome{flex:1;min-width:0;font-size:.8125rem;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
  "a.ax-nome{color:var(--accent-ink);text-decoration:none}",
  "a.ax-nome:hover{text-decoration:underline}",
  ".ax-papel{flex:none;font:inherit;font-family:var(--mono);font-size:.625rem;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);border:1px solid var(--line-soft);background:var(--surface-2);border-radius:99px;padding:1px 4px 1px 6px;cursor:pointer}",
  ".ax-papel:hover{border-color:var(--accent);color:var(--accent-ink)}",
  ".ax-papel.prova{color:var(--good,#2F7A4A)}",
  ".ax-x{flex:none;border:0;background:none;padding:2px 4px;border-radius:6px;color:var(--faint);cursor:pointer;line-height:1;font-size:.9rem;opacity:0}",
  ".ax-lin:hover .ax-x,.ax-x:focus{opacity:1}",
  ".ax-x:hover{background:var(--surface-2);color:var(--bad)}",
  ".ax-vazio{font-size:.75rem;color:var(--faint);padding:2px 0}",
  ".ax-fim{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}",
  ".ax-bt{display:inline-flex;align-items:center;gap:5px;border:1px dashed var(--line);background:var(--surface);border-radius:7px;padding:4px 9px;font:inherit;font-size:.75rem;color:var(--ink-2);cursor:pointer}",
  ".ax-bt:hover{border-color:var(--accent);color:var(--accent-ink)}",
  ".ax-proc{position:relative;flex:1;min-width:150px}",
  ".ax-proc input{width:100%;box-sizing:border-box;font:inherit;font-size:.75rem;color:var(--ink);border:1px solid var(--line);background:var(--surface);border-radius:7px;padding:5px 8px}",
  ".ax-proc input:focus{outline:0;border-color:var(--accent)}",
  ".ax-res{position:absolute;z-index:40;left:0;right:0;top:100%;margin-top:3px;max-height:196px;overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 24px rgba(15,30,32,.14)}",
  ".ax-res button{display:block;width:100%;text-align:left;border:0;background:none;font:inherit;font-size:.75rem;color:var(--ink);padding:6px 9px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
  ".ax-res button:hover,.ax-res button.on{background:var(--surface-2);color:var(--accent-ink)}",
  ".ax-res .ax-nada{padding:6px 9px;font-size:.75rem;color:var(--faint)}",
  ".ax-res small{color:var(--muted)}",
  ".ax.sobre{outline:2px dashed var(--accent);outline-offset:4px;border-radius:8px}",
  ".ax-erro{font-size:.75rem;color:var(--bad);padding:3px 0}",
  /* Os ecras que recebem o bloco tem regras suas para select e input
     dentro das grelhas; estas duas devolvem-lhe a largura. */
  ".ax .ax-papel{width:auto}",
  ".ax .ax-proc input{width:100%;box-sizing:border-box;font:inherit;font-size:.75rem;color:var(--ink);border:1px solid var(--line);background:var(--surface);border-radius:7px;padding:5px 8px}"
].join('\n');

function axEstilo(){
  if (document.getElementById('axCss')) return;
  var s = document.createElement('style');
  s.id = 'axCss';
  s.textContent = AX_CSS;
  document.head.appendChild(s);
}

/* O papel que a app propoe. Fica a sugestao, nao a decisao: a linha traz um
   seletor onde se corrige sem ter de apagar e voltar a juntar. */
function axPapelProposto(t){
  if (!t || (t.tipo || 'tarefa') !== 'pagamento') return 'anexo';
  return t.paid_on || t.status === 'concluida' ? 'comprovativo' : 'fatura';
}

function axRefs(t){
  if (t && t.papeis) return t.papeis.map(function(r){ return { id: r.id, papel: r.papel || 'anexo' }; });
  return ((t && t.documents) || []).map(function(id){ return { id: id, papel: 'anexo' }; });
}

function axDoc(id){
  if (typeof docPorId === 'function'){
    var d = docPorId(id);
    if (d) return d;
  }
  return null;
}

function axNomeDoc(id){
  var d = axDoc(id);
  return d ? d.name : 'documento ' + id;
}

/* ------------------------------------------------------------------ *
 * escrita
 * ------------------------------------------------------------------ */

/* Gravar e sempre a lista inteira: e o que o servidor recebe e o que evita
   dois pedidos a discutir qual e a ligacao que fica. */
function axGravar(t, refs, box, opts){
  var p;
  if (typeof tfGravar === 'function'){
    p = tfGravar(t.id, { documents: refs });
  } else {
    p = apiGestao('/api/gestao/tarefas/' + t.id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documents: refs })
    }).then(function(d){
      window.G = d;
      if (typeof renderGestao === 'function') renderGestao();
    });
  }
  return p.then(function(){
    t.papeis = refs.map(function(r){ return { id: r.id, papel: r.papel }; });
    t.documents = refs.map(function(r){ return r.id; });
    /* Quem grava pode ter feito o ecra inteiro de novo - e ai ja ha outro
       bloco no lugar deste. Redesenha-se o que ainda esta no ecra. */
    if (box.isConnected) axDesenhar(box, t, opts);
    if (opts && opts.aoMudar) opts.aoMudar();
  }).catch(function(e){
    axDesenhar(box, t, opts, e && e.message ? e.message : 'Não deu para gravar.');
  });
}

/* O ficheiro sobe uma vez e passa a ser um documento do arquivo. Se o mesmo
   ficheiro ja la estava, o servidor devolve o documento que existe em vez de
   criar um segundo: e melhor dizer «ja ca estava» do que duplicar. */
function axEnviar(t, ficheiros, box, opts){
  var fila = Array.prototype.slice.call(ficheiros || []);
  if (!fila.length) return Promise.resolve();
  var grande = fila.filter(function(f){ return f.size > AX_MAX; });
  if (grande.length){
    axDesenhar(box, t, opts, 'O ficheiro «' + grande[0].name + '» passa dos 25 MB.');
    return Promise.resolve();
  }
  var papel = axPapelProposto(t);
  axDesenhar(box, t, opts, null, 'A enviar ' + (fila.length > 1 ? fila.length + ' ficheiros…' : '«' + fila[0].name + '»…'));

  var repetidos = 0;
  var seguinte = function(i){
    if (i >= fila.length) return Promise.resolve();
    var fd = new FormData();
    fd.append('ficheiro', fila[i]);
    fd.append('papel', papel);
    return apiGestao('/api/tarefas/' + t.id + '/anexo', { method: 'POST', body: fd })
      .then(function(r){
        if (r && r.repetido) repetidos++;
        if (r && r.documento && window.D && D.documents && !axDoc(r.documento.id)){
          D.documents.push(r.documento);
        }
        return seguinte(i + 1);
      });
  };

  return seguinte(0).then(function(){
    if (typeof renderDocumentos === 'function') { try { renderDocumentos(); } catch (e) {} }
    /* Reler primeiro, acertar a tarefa que o ecra tem na mao, e so depois
       redesenhar: ao contrario, o detalhe redesenha-se com a lista antiga e
       o ficheiro que acabou de subir so aparece na visita seguinte. */
    return apiGestao('/api/gestao').then(function(d){
      window.G = d;
      var fresca = (d.tasks || []).filter(function(x){ return x.id === t.id; })[0];
      if (fresca){ t.papeis = fresca.papeis; t.documents = fresca.documents; }
      if (typeof renderGestao === 'function') renderGestao();
      if (box.isConnected) axDesenhar(box, t, opts);
      if (opts && opts.aoMudar) opts.aoMudar();
      if (typeof toast === 'function'){
        toast(repetidos
          ? (repetidos === fila.length
              ? 'Este ficheiro já estava no arquivo: ficou ligado o documento que lá estava.'
              : 'Guardado. ' + repetidos + ' já estavam no arquivo.')
          : (fila.length > 1 ? fila.length + ' ficheiros guardados no arquivo.' : 'Ficheiro guardado no arquivo.'));
      }
    });
  }).catch(function(e){
    axDesenhar(box, t, opts, (e && e.message) || 'Não deu para enviar o ficheiro.');
  });
}

/* ------------------------------------------------------------------ *
 * desenho
 * ------------------------------------------------------------------ */

function axLinha(t, ref, box, opts){
  var l = el('div', 'ax-lin');
  var doc = axDoc(ref.id);

  var nome;
  if (doc && doc.inbox_id){
    nome = el('a', 'ax-nome', doc.name);
    nome.href = '/api/inbox/' + doc.inbox_id + '/ficheiro';
    nome.target = '_blank';
    nome.rel = 'noopener';
  } else {
    nome = el('span', 'ax-nome', axNomeDoc(ref.id));
  }
  nome.title = axNomeDoc(ref.id) + (doc && doc.inbox_id ? ' — abrir o ficheiro' : ' — sem ficheiro no arquivo');
  l.appendChild(nome);

  var sp = el('select', 'ax-papel' + (ref.papel === 'comprovativo' || ref.papel === 'recibo' ? ' prova' : ''));
  AX_PAPEIS.forEach(function(p){ sp.appendChild(new Option(p, p)); });
  sp.value = ref.papel;
  sp.title = 'O que este documento é para esta tarefa';
  sp.addEventListener('change', function(){
    var refs = axRefs(t).map(function(r){
      return r.id === ref.id ? { id: r.id, papel: sp.value } : r;
    });
    axGravar(t, refs, box, opts);
  });
  l.appendChild(sp);

  var x = el('button', 'ax-x', '×');
  x.type = 'button';
  x.title = 'Desligar este documento da tarefa (fica no arquivo)';
  x.setAttribute('aria-label', 'Desligar ' + axNomeDoc(ref.id));
  x.addEventListener('click', function(){
    axGravar(t, axRefs(t).filter(function(r){ return r.id !== ref.id; }), box, opts);
  });
  l.appendChild(x);
  return l;
}

/* Setenta e nove documentos numa lista fechada nao sao uma escolha, sao uma
   procura a pe. Escreve-se duas letras e aparecem os que interessam. */
function axProcura(t, box, opts){
  var w = el('div', 'ax-proc');
  var i = el('input');
  i.type = 'text';
  i.placeholder = 'Ligar a um documento do arquivo…';
  i.autocomplete = 'off';
  w.appendChild(i);

  var res = el('div', 'ax-res');
  res.style.display = 'none';
  w.appendChild(res);

  var ligados = {};
  axRefs(t).forEach(function(r){ ligados[r.id] = true; });

  var abrir = function(){
    var q = i.value.trim().toLowerCase();
    var todos = ((window.D && D.documents) || []).filter(function(d){ return !ligados[d.id]; });
    var achados = todos.filter(function(d){
      if (!q) return true;
      var quem = typeof pessoa === 'function' ? pessoa(d.person_id) : null;
      var alvo = (d.name + ' ' + (d.entity || '') + ' ' + (d.kind || '') + ' ' + (quem ? quem.name : '')).toLowerCase();
      return alvo.indexOf(q) >= 0;
    });
    achados.sort(function(a, b){ return b.id - a.id; });
    clear(res);
    if (!achados.length){
      res.appendChild(el('div', 'ax-nada', todos.length ? 'Nenhum documento com esse nome.' : 'Todos os documentos já estão ligados.'));
    } else {
      achados.slice(0, 8).forEach(function(d){
        var b = el('button');
        b.type = 'button';
        b.appendChild(document.createTextNode(d.name));
        var quem = typeof pessoa === 'function' ? pessoa(d.person_id) : null;
        var extra = [d.entity, quem ? quem.name : null].filter(Boolean).join(' · ');
        if (extra) b.appendChild(el('small', null, '  ' + extra));
        b.addEventListener('mousedown', function(ev){
          ev.preventDefault();
          var refs = axRefs(t);
          refs.push({ id: d.id, papel: axPapelProposto(t) });
          axGravar(t, refs, box, opts);
        });
        res.appendChild(b);
      });
      if (achados.length > 8) res.appendChild(el('div', 'ax-nada', 'e mais ' + (achados.length - 8) + ' — escreve para afinar.'));
    }
    res.style.display = '';
  };

  i.addEventListener('focus', abrir);
  i.addEventListener('input', abrir);
  i.addEventListener('blur', function(){ setTimeout(function(){ res.style.display = 'none'; }, 120); });
  i.addEventListener('keydown', function(ev){ if (ev.key === 'Escape'){ res.style.display = 'none'; i.blur(); } });
  return w;
}

function axDesenhar(box, t, opts, erro, aviso){
  if (!box) return;
  clear(box);
  opts = opts || {};

  var refs = axRefs(t);
  if (refs.length){
    refs.forEach(function(r){ box.appendChild(axLinha(t, r, box, opts)); });
  } else if (!aviso){
    box.appendChild(el('div', 'ax-vazio', 'Sem documentos.'));
  }

  if (aviso) box.appendChild(el('div', 'ax-vazio', aviso));
  if (erro) box.appendChild(el('div', 'ax-erro', erro));

  var fim = el('div', 'ax-fim');

  var inp = el('input');
  inp.type = 'file';
  inp.multiple = true;
  inp.style.display = 'none';
  inp.addEventListener('change', function(){
    /* A lista de ficheiros e viva: limpar o campo esvazia-a. Copia-se antes,
       senao o que sobe e uma lista vazia e ninguem percebe porque. */
    var f = Array.prototype.slice.call(inp.files);
    inp.value = '';
    axEnviar(t, f, box, opts);
  });
  fim.appendChild(inp);

  var bt = el('button', 'ax-bt', '+ Anexar ficheiro');
  bt.type = 'button';
  bt.title = 'O ficheiro fica guardado como documento do arquivo';
  bt.addEventListener('click', function(){ inp.click(); });
  fim.appendChild(bt);

  fim.appendChild(axProcura(t, box, opts));
  box.appendChild(fim);
}

/* O bloco que os tres ecras pedem. opts.aoMudar corre depois de cada gravacao,
   para quem tenha numeros proprios a acertar. */
function axBloco(t, opts){
  axEstilo();
  var box = el('div', 'ax');
  box.addEventListener('dragover', function(ev){ ev.preventDefault(); box.classList.add('sobre'); });
  box.addEventListener('dragleave', function(){ box.classList.remove('sobre'); });
  box.addEventListener('drop', function(ev){
    ev.preventDefault();
    box.classList.remove('sobre');
    if (ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files.length){
      axEnviar(t, ev.dataTransfer.files, box, opts || {});
    }
  });
  axDesenhar(box, t, opts || {});
  return box;
}
