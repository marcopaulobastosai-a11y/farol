/* Farol - relacionar um papel com uma tarefa, um pagamento ou um evento.
 *
 * O caminho contrario ja existia: estando na tarefa, anexa-se um ficheiro ou
 * liga-se um documento do arquivo. Faltava este, que e o mais natural de
 * todos - estou a olhar para o recibo de vencimento que acabou de chegar e
 * quero dizer a que e que ele pertence, sem ter de ir procurar a tarefa.
 *
 * Vive sozinho: injecta o seu CSS, nao mexe no app.js e so precisa dos
 * ajudantes que ja la estao (el, clear, toast, apiGestao, G, D). Quem o quiser
 * usar chama relAbrir(documento, depois).
 */
(function () {
  'use strict';

  var REL_CSS = [
    '.rel-dlg{border:0;padding:0;background:transparent}',
    '.rel-dlg::backdrop{background:rgba(12,28,28,.45)}',
    '.rel-c{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px;width:min(520px,94vw);max-height:86vh;overflow:auto;box-shadow:0 30px 80px -30px rgba(10,30,30,.6)}',
    '.rel-c h3{margin:0 0 2px;font-size:1.0625rem}',
    '.rel-c .rel-sub{margin:0 0 14px;color:var(--faint);font-size:.8125rem}',
    '.rel-tipos{display:flex;gap:6px;margin-bottom:10px}',
    '.rel-tipos button{flex:1;padding:7px 8px;border:1px solid var(--line);border-radius:9px;background:var(--ground);font:inherit;font-size:.8125rem;color:var(--ink-2);cursor:pointer}',
    '.rel-tipos button.on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-ink);font-weight:500}',
    '.rel-busca{width:100%;padding:8px 10px;border:1px solid var(--line);border-radius:9px;font:inherit;font-size:.875rem;background:var(--ground);color:var(--ink)}',
    '.rel-papel{display:flex;align-items:center;gap:8px;margin:10px 0 6px;font-size:.8125rem;color:var(--faint)}',
    '.rel-filtros{display:flex;gap:6px;margin-top:8px}',
    '.rel-filtros select{flex:1;min-width:0;padding:6px 8px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:.8125rem;background:var(--ground);color:var(--ink)}',
    '.rel-filtros select.estado{flex:0 0 auto}',
    '.rel-nota{font-size:.75rem;color:var(--faint);padding:4px 2px}',
    '.rel-papel select{padding:5px 8px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:.8125rem;background:var(--ground);color:var(--ink)}',
    '.rel-lista{display:flex;flex-direction:column;gap:4px;max-height:280px;overflow:auto;margin-top:8px}',
    '.rel-lista button{display:block;width:100%;text-align:left;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--ground);font:inherit;font-size:.875rem;color:var(--ink);cursor:pointer}',
    '.rel-lista button:hover{border-color:var(--accent)}',
    '.rel-lista button.ja{opacity:.55;cursor:default}',
    '.rel-lista .rel-m{display:block;font-size:.75rem;color:var(--faint);margin-top:2px}',
    '.rel-vazio{padding:10px;color:var(--faint);font-size:.8125rem}',
    '.rel-ja{margin-top:14px;border-top:1px solid var(--line);padding-top:10px}',
    '.rel-ja .rel-lbl{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin-bottom:6px}',
    '.rel-linha{display:flex;align-items:center;gap:8px;padding:5px 0;font-size:.8125rem}',
    '.rel-linha .rel-x{margin-left:auto;border:0;background:none;color:var(--faint);cursor:pointer;font:inherit;padding:2px 6px;border-radius:6px}',
    '.rel-linha .rel-x:hover{background:var(--surface-2);color:var(--bad)}',
    '.rel-acoes{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}',
    '.rel-novo{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}',
    '.rel-novo > button.rel-abre{border:0;background:none;padding:0;font:inherit;font-size:.8125rem;color:var(--accent-ink);cursor:pointer}',
    '.rel-novo .rel-campos{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}',
    '.rel-novo input,.rel-novo select{padding:7px 9px;border:1px solid var(--line);border-radius:9px;font:inherit;font-size:.8125rem;background:var(--ground);color:var(--ink)}',
    '.rel-novo input.titulo{flex:1 1 100%;min-width:0}',
    '.rel-novo .rel-dica{font-size:.75rem;color:var(--faint);margin-top:6px}',
    '.rel-arq{display:flex;flex-direction:column;gap:8px;margin-top:4px}',
    '.rel-arq label{display:flex;flex-direction:column;gap:4px;font-size:.75rem;color:var(--faint)}',
    '.rel-arq select{padding:7px 9px;border:1px solid var(--line);border-radius:9px;font:inherit;font-size:.875rem;background:var(--ground);color:var(--ink)}',
    '.rel-arq .rel-arq-acoes{display:flex;justify-content:flex-end}'
  ].join('\n');

  var REL_PAPEIS = ['anexo', 'fatura', 'comprovativo', 'recibo'];
  var REL_TIPOS = [
    ['arquivo', '\u00c1rea / projeto'],
    ['tarefa', 'Tarefa'],
    ['pagamento', 'Pagamento'],
    ['evento', 'Evento']
  ];

  /* Arrumar um papel sem o pendurar em nada: uma escritura, um CPCV, uma
     caderneta nao pertencem a uma tarefa, pertencem a um imovel. Fica na area
     (ou sub-area) e, se houver, no projeto - e o bem do Patrimonio que vive
     nessa sub-area passa a mostra-lo. */
  var REL_KINDS = [
    ['escritura', 'Escritura'], ['cpcv', 'CPCV / contrato-promessa'], ['contrato', 'Contrato'],
    ['caderneta', 'Caderneta predial'], ['certidao', 'Certid\u00e3o'], ['planta', 'Planta / projeto'],
    ['licenca', 'Licen\u00e7a / alvar\u00e1'], ['seguro', 'Ap\u00f3lice de seguro'],
    ['fatura', 'Fatura'], ['comprovativo', 'Comprovativo'], ['recibo', 'Recibo'],
    ['declaracao', 'Declara\u00e7\u00e3o'], ['cartao', 'Cart\u00e3o / identifica\u00e7\u00e3o'],
    ['proposta', 'Proposta / or\u00e7amento'], ['correspondencia', 'Correspond\u00eancia'], ['outro', 'Outro']
  ];

  function relNomeArea(id) {
    var cs = relAreas(), c = null, i;
    for (i = 0; i < cs.length; i++) if (cs[i].id === Number(id)) c = cs[i];
    if (!c) return '';
    if (!c.parent_id) return c.name;
    for (i = 0; i < cs.length; i++) if (cs[i].id === c.parent_id) return cs[i].name + ' \u203a ' + c.name;
    return c.name;
  }

  function relBlocoArquivo(doc, estado, depois) {
    var caixa = el('div', 'rel-arq');
    var arq = estado.arquivo || {};

    var area = el('select');
    area.appendChild(new Option('\u2014 sem \u00e1rea \u2014', ''));
    var cs = relAreas();
    cs.filter(function (x) { return !x.parent_id; }).forEach(function (a) {
      area.appendChild(new Option(a.name, a.id));
      cs.filter(function (x) { return x.parent_id === a.id; }).forEach(function (sub) {
        area.appendChild(new Option('\u00a0\u00a0' + a.name + ' \u203a ' + sub.name, sub.id));
      });
    });
    area.value = String(arq.context_id || doc.context_id || '');

    var proj = el('select');
    function desenharProjetos() {
      var atual = proj.value || String(arq.project_id || doc.project_id || '');
      clear(proj);
      proj.appendChild(new Option('\u2014 sem projeto \u2014', ''));
      var ids = relIdsDaArea(area.value);
      ((window.G && G.projects) || []).filter(function (p) {
        if (String(p.id) === atual) return true;
        if (p.status === 'arquivado' || p.status === 'concluido') return false;
        return !ids || ids.indexOf(p.context_id) >= 0;
      }).forEach(function (p) { proj.appendChild(new Option(p.name, p.id)); });
      proj.value = atual;
      if (proj.value !== atual) proj.value = '';
    }
    desenharProjetos();
    area.addEventListener('change', desenharProjetos);

    var kind = el('select');
    var k = String(arq.kind || doc.kind || '');
    var conhecido = REL_KINDS.some(function (x) { return x[0] === k; });
    if (k && !conhecido) kind.appendChild(new Option(k, k));
    if (!k) kind.appendChild(new Option('\u2014 escolher \u2014', ''));
    REL_KINDS.forEach(function (x) { kind.appendChild(new Option(x[1], x[0])); });
    kind.value = k;

    var l1 = el('label'); l1.appendChild(document.createTextNode('\u00c1rea ou sub-\u00e1rea')); l1.appendChild(area);
    var l2 = el('label'); l2.appendChild(document.createTextNode('Projeto (opcional)')); l2.appendChild(proj);
    var l3 = el('label'); l3.appendChild(document.createTextNode('Que papel \u00e9')); l3.appendChild(kind);
    caixa.appendChild(l1); caixa.appendChild(l2); caixa.appendChild(l3);
    caixa.appendChild(el('div', 'rel-nota', 'Um im\u00f3vel, um carro: escolhe a sub-\u00e1rea dele em Patrim\u00f3nio e o papel aparece tamb\u00e9m no bem.'));

    var acoes = el('div', 'rel-arq-acoes');
    var guardar = el('button', 'btn primary', 'Guardar');
    guardar.type = 'button';
    acoes.appendChild(guardar);
    caixa.appendChild(acoes);

    guardar.addEventListener('click', function () {
      var corpo = { context_id: area.value ? Number(area.value) : null,
        project_id: proj.value ? Number(proj.value) : null, kind: kind.value || null };
      guardar.disabled = true;
      apiGestao('/api/documentos/' + doc.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
      }).then(function () {
        guardar.disabled = false;
        estado.arquivo = corpo;
        doc.context_id = corpo.context_id; doc.project_id = corpo.project_id; doc.kind = corpo.kind;
        toast('Arrumado.');
        if (typeof estado.redesenhar === 'function') estado.redesenhar();
        if (typeof depois === 'function') depois(estado.relacoes);
        if (typeof load === 'function') load();
      }).catch(function (e) {
        guardar.disabled = false;
        toast((e && e.message) || 'N\u00e3o foi poss\u00edvel gravar.');
      });
    });
    return caixa;
  }

  function relMontar() {
    if (document.getElementById('relCss')) return;
    var st = document.createElement('style');
    st.id = 'relCss';
    st.textContent = REL_CSS;
    document.head.appendChild(st);
  }

  function relSemAcentos(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function relData(iso) {
    return iso ? String(iso).split('-').reverse().join('/') : '';
  }

  function relEuros(v) {
    return v === null || v === undefined || v === ''
      ? '' : Number(v).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  /* Os candidatos de cada tipo, do mais provavel para o menos: o que esta
     aberto primeiro, e dentro disso o de prazo mais proximo. O que ja esta
     fechado nao desaparece - um recibo chega quase sempre depois de a coisa
     estar feita. */
  function relHoje() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* fechadas: as que o servidor devolveu do historico (G.tasks so traz as
     fechadas das duas ultimas semanas). */
  function relCandidatos(tipo, fechadas) {
    var out = [];
    if (tipo === 'evento') {
      var hoje = relHoje();
      ((window.D && D.events) || []).forEach(function (e) {
        if (typeof e.id !== 'number') return;
        out.push({ id: e.id, titulo: e.title, quando: e.day, meta: relData(e.day),
          fechado: Boolean(e.day && e.day < hoje), ctx: e.context_id || null });
      });
      out.sort(function (a, b) { return String(b.quando || '').localeCompare(String(a.quando || '')); });
      return out;
    }
    var vistos = {};
    ((window.G && G.tasks) || []).concat(fechadas || []).forEach(function (t) {
      if (vistos[t.id]) return;
      vistos[t.id] = true;
      var ehPag = (t.tipo || 'tarefa') === 'pagamento';
      if (tipo === 'pagamento' ? !ehPag : ehPag) return;
      var m = [];
      if (ehPag && t.amount) m.push(relEuros(t.amount));
      if (t.payee) m.push(t.payee);
      var fechada = Boolean(t.done) || t.status === 'concluida' || t.status === 'cancelada';
      if (t.due_on) m.push((fechada ? 'era a ' : 'até ') + relData(t.due_on));
      if (t.status === 'cancelada') m.push('não farei');
      else if (t.paid_on) m.push('paga a ' + relData(t.paid_on));
      else if (fechada) m.push('fechada');
      out.push({ id: t.id, titulo: t.title, quando: t.due_on, meta: m.join(' · '), fechado: fechada,
        ctx: t.context_id || null });
    });
    out.sort(function (a, b) {
      if (a.fechado !== b.fechado) return a.fechado ? 1 : -1;
      /* As fechadas das mais recentes para as mais antigas: o papel que chega
         e quase sempre do que se fechou ha pouco. */
      if (a.fechado) return String(b.quando || '').localeCompare(String(a.quando || ''));
      return String(a.quando || '9999').localeCompare(String(b.quando || '9999'));
    });
    return out;
  }

  /* O papel que faz sentido propor: uma fatura e uma fatura, um recibo de
     ordenado e um recibo. Quem quiser outro muda no seletor. */
  function relPapelProposto(doc) {
    var k = relSemAcentos((doc && doc.kind) || '') + ' ' + relSemAcentos((doc && doc.name) || '');
    if (k.indexOf('comprovativo') >= 0 || k.indexOf('transferencia') >= 0) return 'comprovativo';
    if (k.indexOf('recibo') >= 0) return 'recibo';
    if (k.indexOf('fatura') >= 0 || k.indexOf('factura') >= 0) return 'fatura';
    return 'anexo';
  }

  /* As areas como no resto da app: a area e o grupo, com as sub-areas por
     baixo. Escolher uma area apanha tambem o que esta nas sub-areas dela. */
  function relAreas() {
    return ((window.G && G.contextos) || []).filter(function (c) { return c.active !== false; });
  }
  function relIdsDaArea(id) {
    if (!id) return null;
    var n = Number(id);
    var ids = [n];
    relAreas().forEach(function (c) { if (c.parent_id === n) ids.push(c.id); });
    return ids;
  }
  function relSelectAreas() {
    var s = el('select');
    s.appendChild(new Option('Todas as \u00e1reas', ''));
    var ctx = relAreas();
    ctx.filter(function (x) { return !x.parent_id; }).forEach(function (a) {
      var g = document.createElement('optgroup');
      g.label = a.name;
      g.appendChild(new Option(a.name + ' (toda)', a.id));
      ctx.filter(function (x) { return x.parent_id === a.id; }).forEach(function (sub) {
        g.appendChild(new Option('\u00a0\u00a0' + sub.name, sub.id));
      });
      s.appendChild(g);
    });
    return s;
  }

  /* O filtro fica escolhido enquanto a pagina estiver aberta: quem relaciona
     varios papeis da mesma area nao a volta a escolher a cada um. */
  var REL_FILTRO = { area: '', estado: 'abertas' };

  function relNome(tipo) {
    for (var i = 0; i < REL_TIPOS.length; i++) if (REL_TIPOS[i][0] === tipo) return REL_TIPOS[i][1];
    return tipo === 'despesa' ? 'Despesa' : tipo;
  }

  /* Criar ali mesmo o que ainda nao existe.
   *
   * Procurar so serve quando a coisa ja esta criada. O caso mais comum e o
   * contrario: chega um cartao que expira em 2029 e o que falta e um lembrete
   * nesse dia; chega um contrato e o que falta e uma nota a dizer o que ficou
   * combinado. Aqui cria-se - tarefa, lembrete, nota ou evento, com data - e
   * fica logo relacionado com o papel.
   *
   * A area vem do documento: um papel arrumado em «Casa > Quinta do Anjo» da
   * um lembrete da mesma area, sem ninguem ter de o dizer. */
  var REL_NOVOS = [
    ['lembrete', 'Lembrete'],
    ['tarefa', 'Tarefa'],
    ['nota', 'Nota'],
    ['evento', 'Evento']
  ];

  function relBlocoCriar(doc, gravar) {
    var caixa = el('div', 'rel-novo');
    var abre = el('button', 'rel-abre', '+ Criar e relacionar');
    abre.type = 'button';
    caixa.appendChild(abre);

    var campos = el('div', 'rel-campos');
    campos.hidden = true;
    caixa.appendChild(campos);

    var oQue = el('select');
    REL_NOVOS.forEach(function (x) { oQue.appendChild(new Option(x[1], x[0])); });
    /* Um papel com validade pede quase sempre um lembrete para a renovar. */
    var validade = doc.valid_on || doc.valid_until || '';
    oQue.value = validade ? 'lembrete' : 'tarefa';
    campos.appendChild(oQue);

    var titulo = el('input', 'titulo');
    titulo.type = 'text';
    titulo.placeholder = 'O que é?';
    titulo.value = (validade ? 'Renovar ' : '') + (doc.name || '');
    campos.appendChild(titulo);

    var quando = el('input');
    quando.type = 'date';
    quando.value = validade ? String(validade).slice(0, 10) : '';
    campos.appendChild(quando);

    var hora = el('input');
    hora.type = 'time';
    hora.hidden = true;
    campos.appendChild(hora);

    var criar = el('button', 'btn primary', 'Criar');
    criar.type = 'button';
    campos.appendChild(criar);

    var dica = el('div', 'rel-dica', '');
    caixa.appendChild(dica);

    function ajustar() {
      var ev = oQue.value === 'evento';
      hora.hidden = !ev;
      quando.title = ev ? 'Dia' : 'Prazo';
      dica.textContent = ev
        ? 'Entra na Agenda e no Hoje, na \u00e1rea do papel.'
        : (oQue.value === 'nota'
          ? 'Uma nota n\u00e3o se conclui; a data \u00e9 opcional.'
          : 'Entra nas Tarefas com este prazo, na \u00e1rea do papel.');
    }
    oQue.addEventListener('change', ajustar);
    ajustar();

    abre.addEventListener('click', function () {
      campos.hidden = !campos.hidden;
      abre.textContent = campos.hidden ? '+ Criar e relacionar' : '\u2212 Criar e relacionar';
      if (!campos.hidden) titulo.focus();
    });

    criar.addEventListener('click', function () {
      var t = titulo.value.trim();
      if (!t) { toast('Escreve o que \u00e9.'); titulo.focus(); return; }
      var tipo = oQue.value;
      var dia = quando.value;
      if (tipo === 'evento' && !dia) { toast('Um evento precisa de um dia.'); quando.focus(); return; }
      if (tipo !== 'nota' && tipo !== 'evento' && !dia) { toast('Escolhe uma data.'); quando.focus(); return; }
      criar.disabled = true;

      var feito = function (relTipo, id) {
        criar.disabled = false;
        campos.hidden = true;
        abre.textContent = '+ Criar e relacionar';
        gravar('POST', relTipo, id);
      };
      var falhou = function (e) {
        criar.disabled = false;
        toast((e && e.message) || 'N\u00e3o foi poss\u00edvel criar.');
      };

      if (tipo === 'evento') {
        apiGestao('/api/gestao/eventos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: t, day: dia, at: hora.value || null,
            context_id: doc.context_id || null, detail: doc.name || null })
        }).then(function (ev) {
          if (!ev || !ev.id) throw new Error('O evento n\u00e3o voltou com id.');
          if (typeof load === 'function') load();
          feito('evento', ev.id);
        }).catch(falhou);
        return;
      }

      /* O POST das tarefas devolve o G inteiro, nao o id: o novo e o que
         aparece a mais. */
      var antes = {};
      ((window.G && G.tasks) || []).forEach(function (x) { antes[x.id] = true; });
      apiGestao('/api/gestao/tarefas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tipo, title: t, due_on: dia || null,
          context_id: doc.context_id || null })
      }).then(function (g) {
        if (g && g.tasks) { window.G = g; if (typeof renderGestao === 'function') renderGestao(); }
        var novo = ((g && g.tasks) || []).filter(function (x) { return !antes[x.id]; })
          .sort(function (a, b) { return b.id - a.id; })[0];
        if (!novo) throw new Error('A tarefa foi criada mas n\u00e3o se encontrou.');
        feito(tipo === 'pagamento' ? 'pagamento' : 'tarefa', novo.id);
      }).catch(falhou);
    });

    return caixa;
  }

  /* A janela. `doc` e a linha do documento (precisa de id e, se houver, nome e
     tipo); `depois` e chamado sempre que alguma coisa muda, para quem abriu a
     janela recarregar o seu ecra. */
  function relAbrir(doc, depois) {
    if (!doc || !doc.id) { toast('Este ficheiro ainda não é um documento.'); return; }
    relMontar();

    /* Uma fatura, um recibo, um comprovativo pertencem a um pagamento; o
       resto (escrituras, contratos, cadernetas) arruma-se numa area. */
    var estado = { tipo: relPapelProposto(doc) === 'anexo' ? 'arquivo' : 'pagamento', busca: '',
      relacoes: (doc.relacoes || []).slice(), fechadas: {}, aCarregar: {},
      arquivo: { context_id: doc.context_id || null, project_id: doc.project_id || null, kind: doc.kind || null } };

    var dlg = el('dialog', 'rel-dlg');
    var cx = el('div', 'rel-c');
    cx.appendChild(el('h3', null, 'Relacionar este papel'));
    cx.appendChild(el('p', 'rel-sub', doc.name || doc.titulo || ('Documento #' + doc.id)));

    var tipos = el('div', 'rel-tipos');
    cx.appendChild(tipos);

    var busca = el('input', 'rel-busca');
    busca.type = 'search';
    busca.placeholder = 'Procurar pelo nome…';
    cx.appendChild(busca);

    var filtros = el('div', 'rel-filtros');
    var fArea = relSelectAreas();
    fArea.value = String(REL_FILTRO.area || '');
    var fEstado = el('select', 'estado');
    filtros.appendChild(fArea);
    filtros.appendChild(fEstado);
    cx.appendChild(filtros);

    var papelLinha = el('div', 'rel-papel');
    papelLinha.appendChild(el('span', null, 'Como'));
    var papel = el('select');
    REL_PAPEIS.forEach(function (x) { papel.appendChild(new Option(x, x)); });
    papel.value = relPapelProposto(doc);
    papelLinha.appendChild(papel);
    cx.appendChild(papelLinha);

    var lista = el('div', 'rel-lista');
    cx.appendChild(lista);

    var arquivoBox = el('div');
    cx.appendChild(arquivoBox);

    var criarBox = relBlocoCriar(doc, gravar);
    cx.appendChild(criarBox);

    var ja = el('div', 'rel-ja');
    cx.appendChild(ja);

    var acoes = el('div', 'rel-acoes');
    var fechar = el('button', 'btn', 'Fechar');
    fechar.type = 'button';
    fechar.onclick = function () { try { dlg.close(); } catch (e) {} dlg.remove(); };
    acoes.appendChild(fechar);
    cx.appendChild(acoes);

    function temJa(tipo, id) {
      return estado.relacoes.some(function (r) { return r.tipo === tipo && r.id === id; });
    }

    function gravar(metodo, tipo, id) {
      var corpo = { tipo: tipo, item_id: id, papel: papel.value };
      apiGestao('/api/documentos/' + doc.id + '/relacionar', {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
      }).then(function (d) {
        estado.relacoes = d.relacoes || [];
        doc.relacoes = estado.relacoes;
        toast(metodo === 'POST' ? 'Relacionado.' : 'Desligado.');
        desenhar();
        if (typeof depois === 'function') depois(estado.relacoes);
        if (typeof loadGestao === 'function') loadGestao();
        if (typeof load === 'function') load();
      }).catch(function (e) { toast(e.message || 'Não foi possível gravar.'); });
    }

    function desenharTipos() {
      clear(tipos);
      REL_TIPOS.forEach(function (t) {
        var b = el('button', estado.tipo === t[0] ? 'on' : '', t[1]);
        b.type = 'button';
        b.onclick = function () { estado.tipo = t[0]; desenhar(); busca.focus(); };
        tipos.appendChild(b);
      });
    }

    function desenharEstado() {
      clear(fEstado);
      var ev = estado.tipo === 'evento';
      [['abertas', ev ? 'Pr\u00f3ximos' : 'Por fazer'], ['fechadas', ev ? 'Passados' : 'Fechadas'],
       ['todas', ev ? 'Todos' : 'Todas']].forEach(function (o) { fEstado.appendChild(new Option(o[1], o[0])); });
      fEstado.value = REL_FILTRO.estado;
    }

    /* As fechadas vem do historico, por tipo: ate 200 das mais recentes, ja
       filtradas pela area. */
    function chaveFechadas() { return estado.tipo + '|' + (REL_FILTRO.area || ''); }
    function buscarFechadas() {
      if (estado.tipo === 'evento' || REL_FILTRO.estado === 'abertas') return;
      var k = chaveFechadas();
      if (estado.fechadas[k] || estado.aCarregar[k]) return;
      estado.aCarregar[k] = true;
      var ids = relIdsDaArea(REL_FILTRO.area);
      apiGestao('/api/tarefas/historico?tipo=' + estado.tipo + '&limite=200' +
        (ids ? '&contextos=' + ids.join(',') : ''))
        .then(function (r) { estado.fechadas[k] = r || []; })
        .catch(function () { estado.fechadas[k] = []; })
        .then(function () { estado.aCarregar[k] = false; desenharLista(); });
    }

    function desenharLista() {
      clear(lista);
      var q = relSemAcentos(estado.busca);
      var ids = relIdsDaArea(REL_FILTRO.area);
      var k = chaveFechadas();
      var fechadas = estado.fechadas[k] || [];
      var todos = relCandidatos(estado.tipo, fechadas).filter(function (c) {
        if (ids && ids.indexOf(c.ctx) < 0) return false;
        if (REL_FILTRO.estado === 'abertas' && c.fechado) return false;
        if (REL_FILTRO.estado === 'fechadas' && !c.fechado) return false;
        return !q || relSemAcentos(c.titulo).indexOf(q) >= 0 || relSemAcentos(c.meta).indexOf(q) >= 0;
      });
      if (!todos.length) {
        lista.appendChild(el('div', 'rel-vazio', estado.aCarregar[k] ? 'A procurar\u2026'
          : q ? 'Nada com esse nome.' : 'Nada com estes filtros.'));
        return;
      }
      if (estado.tipo !== 'evento' && REL_FILTRO.estado !== 'abertas' && fechadas.length >= 200) {
        lista.appendChild(el('div', 'rel-nota', 'Das fechadas, mostro as 200 mais recentes. Escolhe uma \u00e1rea para ver mais para tr\u00e1s.'));
      }
      todos.slice(0, 80).forEach(function (c) {
        var posto = temJa(estado.tipo, c.id);
        var b = el('button', posto ? 'ja' : '');
        b.type = 'button';
        b.appendChild(document.createTextNode(c.titulo || ('#' + c.id)));
        var m = c.meta + (posto ? (c.meta ? ' · ' : '') + 'já relacionado' : '');
        if (m) b.appendChild(el('span', 'rel-m', m));
        if (!posto) b.onclick = function () { gravar('POST', estado.tipo, c.id); };
        lista.appendChild(b);
      });
    }

    function desenharJa() {
      clear(ja);
      var a = estado.arquivo || {};
      if (a.context_id || a.project_id) {
        ja.appendChild(el('div', 'rel-lbl', 'Arrumado em'));
        var la = el('div', 'rel-linha');
        var partes = [];
        if (a.context_id) partes.push(relNomeArea(a.context_id) || ('\u00e1rea #' + a.context_id));
        if (a.project_id) {
          var pj = ((window.G && G.projects) || []).filter(function (p) { return p.id === a.project_id; })[0];
          partes.push('projeto ' + (pj ? pj.name : '#' + a.project_id));
        }
        la.appendChild(pill('\u00c1rea', 'good'));
        la.appendChild(el('span', null, partes.join(' \u00b7 ')));
        ja.appendChild(la);
      }
      if (!estado.relacoes.length) {
        if (a.context_id || a.project_id) return;
        ja.appendChild(el('div', 'rel-vazio', 'Este papel ainda não está relacionado com nada.'));
        return;
      }
      ja.appendChild(el('div', 'rel-lbl', 'Já relacionado'));
      estado.relacoes.forEach(function (r) {
        var l = el('div', 'rel-linha');
        l.appendChild(pill(relNome(r.tipo), 'good'));
        l.appendChild(el('span', null, r.title || ('#' + r.id)));
        if (r.papel && r.papel !== 'anexo') l.appendChild(el('span', 'rel-m', r.papel));
        var x = el('button', 'rel-x', 'desligar');
        x.type = 'button';
        x.onclick = function () { gravar('DELETE', r.tipo, r.id); };
        l.appendChild(x);
        ja.appendChild(l);
      });
    }

    function desenhar() {
      var arq = estado.tipo === 'arquivo';
      busca.hidden = arq; filtros.hidden = arq; papelLinha.hidden = arq; lista.hidden = arq; criarBox.hidden = arq;
      clear(arquivoBox);
      desenharTipos();
      if (arq) arquivoBox.appendChild(relBlocoArquivo(doc, estado, depois));
      else { desenharEstado(); buscarFechadas(); desenharLista(); }
      desenharJa();
    }
    estado.redesenhar = desenhar;

    busca.addEventListener('input', function () { estado.busca = busca.value; desenharLista(); });
    fArea.addEventListener('change', function () { REL_FILTRO.area = fArea.value; buscarFechadas(); desenharLista(); });
    fEstado.addEventListener('change', function () { REL_FILTRO.estado = fEstado.value; buscarFechadas(); desenharLista(); });
    desenhar();
    /* O que o cartao trazia pode estar velho - e vindo dos Documentos nao vem
       nada. Pergunta-se sempre, e redesenha-se quando a resposta chega. */
    apiGestao('/api/documentos/' + doc.id + '/relacionar').then(function (d) {
      estado.relacoes = d.relacoes || [];
      doc.relacoes = estado.relacoes;
      if (d.arquivo) estado.arquivo = d.arquivo;
      desenhar();
    }).catch(function () {});

    dlg.appendChild(cx);
    dlg.addEventListener('cancel', function () { setTimeout(function () { dlg.remove(); }, 0); });
    document.body.appendChild(dlg);
    dlg.showModal();
    if (estado.tipo !== 'arquivo') busca.focus();
  }

  /* O mesmo botao na janela de um documento, no ecra dos Documentos e nos
     avisos: a hipotese de relacionar tem de estar onde o papel esta, nao so na
     caixa de entrada. Embrulha-se a funcao que ja existe em vez de lhe mexer. */
  if (typeof window.editarDocumento === 'function') {
    var relOriginal = window.editarDocumento;
    window.editarDocumento = function (d, aviso) {
      var r = relOriginal.apply(this, arguments);
      try {
        var dlgs = document.querySelectorAll('dialog.ar-dlg');
        var dlg = dlgs[dlgs.length - 1];
        var pe = dlg && dlg.querySelector('.ar-dlga');
        if (pe && d && d.id) {
          var b = el('button', 'btn', 'Relacionar\u2026');
          b.type = 'button';
          b.style.marginRight = 'auto';
          b.onclick = function () { relAbrir(d); };
          pe.insertBefore(b, pe.firstChild);
        }
      } catch (e) {}
      return r;
    };
  }

  window.relAbrir = relAbrir;
  window.relNome = relNome;
})();
