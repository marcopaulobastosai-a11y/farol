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
    '.rel-acoes{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}'
  ].join('\n');

  var REL_PAPEIS = ['anexo', 'fatura', 'comprovativo', 'recibo'];
  var REL_TIPOS = [
    ['tarefa', 'Tarefa'],
    ['pagamento', 'Pagamento'],
    ['evento', 'Evento']
  ];

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

  /* A janela. `doc` e a linha do documento (precisa de id e, se houver, nome e
     tipo); `depois` e chamado sempre que alguma coisa muda, para quem abriu a
     janela recarregar o seu ecra. */
  function relAbrir(doc, depois) {
    if (!doc || !doc.id) { toast('Este ficheiro ainda não é um documento.'); return; }
    relMontar();

    var estado = { tipo: 'pagamento', busca: '', relacoes: (doc.relacoes || []).slice(),
      fechadas: {}, aCarregar: {} };

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
      if (!estado.relacoes.length) {
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

    function desenhar() { desenharTipos(); desenharEstado(); buscarFechadas(); desenharLista(); desenharJa(); }

    busca.addEventListener('input', function () { estado.busca = busca.value; desenharLista(); });
    fArea.addEventListener('change', function () { REL_FILTRO.area = fArea.value; buscarFechadas(); desenharLista(); });
    fEstado.addEventListener('change', function () { REL_FILTRO.estado = fEstado.value; buscarFechadas(); desenharLista(); });
    desenhar();
    /* O que o cartao trazia pode estar velho - e vindo dos Documentos nao vem
       nada. Pergunta-se sempre, e redesenha-se quando a resposta chega. */
    apiGestao('/api/documentos/' + doc.id + '/relacionar').then(function (d) {
      estado.relacoes = d.relacoes || [];
      doc.relacoes = estado.relacoes;
      desenhar();
    }).catch(function () {});

    dlg.appendChild(cx);
    dlg.addEventListener('cancel', function () { setTimeout(function () { dlg.remove(); }, 0); });
    document.body.appendChild(dlg);
    dlg.showModal();
    busca.focus();
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
