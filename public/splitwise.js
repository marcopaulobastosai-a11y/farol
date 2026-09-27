/* Farol - a despesa que se divide, no Splitwise.
 *
 * Dois ecras:
 *   Administracao › Splitwise - ligar com a chave pessoal, ler os grupos de
 *     la e dizer quais ficam disponiveis para escolher num pagamento.
 *   Janela de «dar por pago» - a caixa «Registar no Splitwise», o grupo, quem
 *     pagou e como se divide, tudo a vista antes de subir.
 *
 * Vive sozinho: injecta o seu CSS, o seu botao no menu e o seu ecra, e
 * pendura-se na janela de pagar pelo swBlocoPagar, que o tarefas.js chama se
 * este ficheiro estiver carregado. Nao mexe no app.js.
 */
(function () {
  'use strict';

  var SW = { estado: null, carregado: false, aLer: false };

  var SW_CSS = [
    '#view-splitwise .sw-card{margin-bottom:14px}',
    '#view-splitwise .sw-sub{color:var(--muted);font-size:.875rem;margin:.2rem 0 1rem;line-height:1.5}',
    '#view-splitwise .sw-lig{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '#view-splitwise .sw-lig input[type=password],#view-splitwise .sw-lig input[type=text]{flex:1 1 320px;min-width:0;font:inherit;font-size:.875rem;padding:9px 11px;border:1px solid var(--line);border-radius:9px;background:var(--surface-2);color:var(--ink)}',
    '#view-splitwise .sw-g{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--line-soft)}',
    '#view-splitwise .sw-g:first-of-type{border-top:0}',
    '#view-splitwise .sw-g .grow{flex:1 1 auto;min-width:0}',
    '#view-splitwise .sw-g b{display:block;font-weight:500}',
    '#view-splitwise .sw-g small{color:var(--muted);font-size:.8125rem}',
    '#view-splitwise .sw-g label{display:flex;align-items:center;gap:6px;font-size:.8125rem;color:var(--ink-2);white-space:nowrap;cursor:pointer}',
    '#view-splitwise .sw-g input[type=checkbox],#view-splitwise .sw-g input[type=radio]{width:15px;height:15px;accent-color:var(--accent)}',
    '.sw-pag{margin-top:12px;border-top:1px solid var(--line);padding-top:10px}',
    '.sw-pag .sw-top{display:flex;align-items:center;gap:7px;color:var(--ink-2);font-size:.78rem}',
    '.sw-pag .sw-top input{width:15px;height:15px;accent-color:var(--accent)}',
    '.sw-pag .sw-corpo{margin-top:8px;display:none}',
    '.sw-pag.on .sw-corpo{display:block}',
    '.sw-pag select{width:100%;font:inherit;font-size:.8125rem;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--ink);margin-bottom:6px}',
    '.sw-pag .sw-lbl{font-family:var(--mono);font-size:var(--fs-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin:8px 0 3px}',
    '.sw-pag .sw-m{display:flex;align-items:center;gap:8px;padding:3px 0;font-size:.8125rem}',
    '.sw-pag .sw-m span{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.sw-pag .sw-m input[type=number]{width:86px;font:inherit;font-size:.8125rem;padding:4px 6px;border:1px solid var(--line);border-radius:7px;background:var(--surface-2);color:var(--ink);text-align:right}',
    '.sw-pag .sw-soma{font-size:.72rem;color:var(--muted);margin-top:5px}',
    '.sw-pag .sw-soma.mau{color:var(--bad)}',
    '.sw-pag .sw-igual{border:0;background:none;color:var(--accent-ink);font:inherit;font-size:.72rem;cursor:pointer;padding:0;text-decoration:underline}'
  ].join('\n');

  function swEstilo() {
    if (document.getElementById('swCss')) return;
    var st = document.createElement('style');
    st.id = 'swCss';
    st.textContent = SW_CSS;
    document.head.appendChild(st);
  }

  var SW_ICONE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M6 8h5"/><path d="M13 16h5"/><circle cx="6" cy="8" r="0"/></svg>';

  function swMontar() {
    if (document.getElementById('view-splitwise')) return;
    swEstilo();
    if (window.TITLES) TITLES.splitwise = ['Splitwise', 'Os grupos onde as despesas se dividem'];
    var nav = document.getElementById('nav');
    if (!nav) return;
    var b = el('button', null, ' Splitwise');
    b.dataset.view = 'splitwise';
    var ic = document.createElement('span');
    ic.innerHTML = SW_ICONE;
    b.insertBefore(ic.firstChild, b.firstChild);
    var dest = nav.querySelector('[data-view="destinatarios"]');
    if (dest) nav.insertBefore(b, dest.nextSibling); else nav.appendChild(b);

    var sec = el('section', 'view'); sec.id = 'view-splitwise'; sec.hidden = true;
    var c1 = el('div', 'card sw-card'); c1.id = 'swLigacao';
    var c2 = el('div', 'card sw-card'); c2.id = 'swGrupos';
    sec.appendChild(c1); sec.appendChild(c2);
    var irmao = document.querySelector('.view');
    (irmao ? irmao.parentNode : document.body).appendChild(sec);
  }

  function swCarregar(forcar) {
    if (SW.aLer || (SW.carregado && !forcar)) return Promise.resolve(SW.estado);
    SW.aLer = true;
    return apiGestao('/api/splitwise').then(function (d) {
      SW.estado = d; SW.carregado = true;
      swDesenhar();
      return d;
    }).catch(function () { return null; })
      .then(function (d) { SW.aLer = false; return d; });
  }

  /* ---------------- o ecra de configuracao ---------------- */

  function swDesenhar() {
    var box = document.getElementById('swLigacao');
    if (!box || !SW.estado) return;
    var d = SW.estado;
    clear(box);
    var h = el('header');
    h.appendChild(el('h3', null, 'Splitwise'));
    if (d.ligado) {
      h.appendChild(pill(d.utilizador ? 'ligado a ' + d.utilizador.nome : 'ligado', 'good'));
    }
    box.appendChild(h);
    box.appendChild(el('p', 'sw-sub',
      'Quando um pagamento é de dois, a despesa pode ir também para o Splitwise, no grupo certo. ' +
      'A ligação é uma chave pessoal tua: em secure.splitwise.com/apps, na página da aplicação, «generate API key». ' +
      'Fica guardada cifrada e nunca volta a aparecer aqui.'));

    if (!d.segredo) {
      box.appendChild(el('p', 'sw-sub', 'Falta a variável SESSION_SECRET no Railway para se poder guardar a chave em segurança.'));
    }

    var linha = el('div', 'sw-lig');
    if (d.ligado) {
      var quem = el('span', null, d.utilizador ? (d.utilizador.nome + ' · ' + d.utilizador.email)
        : (d.por_variavel ? 'a chave está nas Variables do Railway (SPLITWISE_API_KEY)' : 'ligado'));
      quem.style.cssText = 'flex:1 1 auto;color:var(--ink-2);font-size:.875rem';
      linha.appendChild(quem);
      var bL = el('button', 'btn', 'Ler os grupos outra vez');
      bL.type = 'button';
      bL.addEventListener('click', function () {
        bL.disabled = true; bL.textContent = 'A ler…';
        apiGestao('/api/splitwise/grupos', { method: 'POST' }).then(function (r) {
          SW.estado.grupos = r.grupos || [];
          toast(r.lidos + (r.lidos === 1 ? ' grupo lido.' : ' grupos lidos.'));
          swDesenhar();
        }).catch(function (e) { toast(e.message || 'Não deu para ler os grupos.'); })
          .then(function () { bL.disabled = false; bL.textContent = 'Ler os grupos outra vez'; });
      });
      linha.appendChild(bL);
      var bD = el('button', 'btn danger', 'Desligar');
      bD.type = 'button';
      bD.hidden = Boolean(d.por_variavel);
      bD.addEventListener('click', function () {
        apiGestao('/api/splitwise/chave', { method: 'DELETE' }).then(function () {
          toast('Splitwise desligado.');
          swCarregar(true);
        }).catch(function (e) { toast(e.message || 'Não deu para desligar.'); });
      });
      linha.appendChild(bD);
    } else {
      var iK = el('input'); iK.type = 'password'; iK.placeholder = 'Colar aqui a chave do Splitwise';
      iK.autocomplete = 'off';
      linha.appendChild(iK);
      var bK = el('button', 'btn primary', 'Ligar');
      bK.type = 'button';
      bK.addEventListener('click', function () {
        if (!iK.value.trim()) { toast('Falta a chave.'); return; }
        bK.disabled = true; bK.textContent = 'A ligar…';
        apiGestao('/api/splitwise/chave', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chave: iK.value.trim() })
        }).then(function (r) {
          iK.value = '';
          toast('Ligado ao Splitwise como ' + (r.utilizador ? r.utilizador.nome : '') + '.');
          swCarregar(true);
        }).catch(function (e) { toast(e.message || 'Não deu para ligar.'); })
          .then(function () { bK.disabled = false; bK.textContent = 'Ligar'; });
      });
      linha.appendChild(bK);
    }
    box.appendChild(linha);
    swDesenharGrupos();
  }

  function swDesenharGrupos() {
    var box = document.getElementById('swGrupos');
    if (!box || !SW.estado) return;
    clear(box);
    var d = SW.estado;
    var h = el('header');
    h.appendChild(el('h3', null, 'Grupos'));
    box.appendChild(h);
    if (!d.ligado) {
      box.appendChild(el('p', 'sw-sub', 'Liga o Splitwise para ver aqui os teus grupos.'));
      return;
    }
    box.appendChild(el('p', 'sw-sub',
      'Os grupos vêm do Splitwise, tal como lá estão. Marca os que queres ter à mão quando pagas, ' +
      'e escolhe qual é o que vem proposto.'));
    if (!(d.grupos || []).length) {
      box.appendChild(el('p', 'sw-sub', 'Não há grupos. Cria um no Splitwise e lê outra vez.'));
      return;
    }
    d.grupos.forEach(function (g) {
      var l = el('div', 'sw-g');
      var gw = el('div', 'grow');
      gw.appendChild(el('b', null, g.nome));
      var membros = (g.membros || []).map(function (m) { return m.nome; }).join(', ');
      gw.appendChild(el('small', null, membros || 'sem membros'));
      l.appendChild(gw);

      var lA = el('label');
      var cA = el('input'); cA.type = 'checkbox'; cA.checked = !!g.ativo;
      cA.addEventListener('change', function () { swGrupo(g.id, { ativo: cA.checked }); });
      lA.appendChild(cA); lA.appendChild(document.createTextNode('à mão quando pago'));
      l.appendChild(lA);

      var lO = el('label');
      var cO = el('input'); cO.type = 'radio'; cO.name = 'swOmissao'; cO.checked = !!g.omissao;
      cO.addEventListener('change', function () { if (cO.checked) swGrupo(g.id, { omissao: true }); });
      lO.appendChild(cO); lO.appendChild(document.createTextNode('proposto'));
      l.appendChild(lO);
      box.appendChild(l);
    });
  }

  function swGrupo(id, mudanca) {
    return apiGestao('/api/splitwise/grupos/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mudanca)
    }).then(function (r) {
      SW.estado.grupos = r.grupos || [];
      swDesenharGrupos();
    }).catch(function (e) { toast(e.message || 'Não deu para gravar.'); swCarregar(true); });
  }

  /* ---------------- o bloco na janela de pagar ---------------- */

  var cent = function (v) { return Math.round(Number(v || 0) * 100) / 100; };

  /* Devolve o no para pendurar na janela, e um valor() que diz o que enviar
     (ou null quando a caixa esta desmarcada). */
  function swBlocoPagar(t, quanto) {
    swEstilo();
    var caixa = el('div', 'sw-pag');
    var top = el('label', 'sw-top');
    var cx = el('input'); cx.type = 'checkbox';
    top.appendChild(cx);
    var rotulo = el('span', null, 'Registar a despesa no Splitwise');
    top.appendChild(rotulo);
    caixa.appendChild(top);
    var corpo = el('div', 'sw-corpo');
    caixa.appendChild(corpo);

    var sel = el('select');
    var quemSel = el('select');
    var partes = el('div');
    var soma = el('div', 'sw-soma');
    corpo.appendChild(el('div', 'sw-lbl', 'Grupo'));
    corpo.appendChild(sel);
    corpo.appendChild(el('div', 'sw-lbl', 'Pago por'));
    corpo.appendChild(quemSel);
    var lblD = el('div', 'sw-lbl', 'Dividido');
    var bIgual = el('button', 'sw-igual', 'partes iguais');
    bIgual.type = 'button';
    bIgual.style.marginLeft = '8px';
    lblD.appendChild(bIgual);
    corpo.appendChild(lblD);
    corpo.appendChild(partes);
    corpo.appendChild(soma);

    var linhas = [];
    function grupoAtual() {
      var id = String(sel.value);
      return ((SW.estado && SW.estado.grupos) || []).filter(function (g) { return String(g.id) === id; })[0] || null;
    }
    function total() { return cent(typeof quanto === 'function' ? quanto() : quanto); }
    function contar() {
      var s = linhas.reduce(function (a, l) { return a + cent(l.i.value); }, 0);
      var t2 = total();
      var falta = cent(t2 - s);
      soma.textContent = 'Somam ' + s.toFixed(2).replace('.', ',') + ' € de ' + t2.toFixed(2).replace('.', ',') + ' €' +
        (Math.abs(falta) >= 0.01 ? ' · faltam ' + falta.toFixed(2).replace('.', ',') + ' €, que ficam com quem pagou' : '');
      soma.className = 'sw-soma' + (Math.abs(falta) >= 0.01 ? ' mau' : '');
    }
    function iguais() {
      var g = grupoAtual();
      if (!g) return;
      var m = g.membros || [];
      var cada = cent(total() / (m.length || 1));
      linhas.forEach(function (l, i) { l.i.value = (i === 0 ? cent(total() - cada * (m.length - 1)) : cada).toFixed(2); });
      contar();
    }
    function desenharPartes() {
      clear(partes); clear(quemSel); linhas = [];
      var g = grupoAtual();
      if (!g) return;
      (g.membros || []).forEach(function (m) {
        quemSel.appendChild(new Option(m.nome, String(m.id)));
        var l = el('div', 'sw-m');
        l.appendChild(el('span', null, m.nome));
        var i = el('input'); i.type = 'number'; i.step = '0.01'; i.min = '0';
        i.addEventListener('input', contar);
        l.appendChild(i);
        l.appendChild(el('span', null, '€'));
        l.lastChild.style.cssText = 'flex:0 0 auto;color:var(--muted)';
        partes.appendChild(l);
        linhas.push({ id: m.id, i: i });
      });
      var eu = SW.estado && SW.estado.utilizador;
      if (eu) quemSel.value = String(eu.id);
      iguais();
    }
    bIgual.addEventListener('click', iguais);
    sel.addEventListener('change', desenharPartes);
    cx.addEventListener('change', function () {
      caixa.classList.toggle('on', cx.checked);
      if (cx.checked && !linhas.length) desenharPartes();
    });

    function encher() {
      var d = SW.estado;
      if (!d || !d.ligado) { caixa.hidden = true; return; }
      var ativos = (d.grupos || []).filter(function (g) { return g.ativo; });
      if (!ativos.length) { caixa.hidden = true; return; }
      caixa.hidden = false;
      clear(sel);
      ativos.forEach(function (g) { sel.appendChild(new Option(g.nome, String(g.id))); });
      var doPagamento = t && t.splitwise_grupo ? String(t.splitwise_grupo) : null;
      var proposto = (ativos.filter(function (g) { return g.omissao; })[0] || ativos[0]).id;
      sel.value = doPagamento && ativos.some(function (g) { return String(g.id) === doPagamento; })
        ? doPagamento : String(proposto);
      /* Um pagamento que ja tem grupo escolhido vem com a caixa marcada: e
         disso que ele vive. Os outros ficam por marcar. */
      if (doPagamento) { cx.checked = true; caixa.classList.add('on'); desenharPartes(); }
      rotulo.textContent = 'Registar a despesa no Splitwise';
    }

    caixa.hidden = true;
    if (SW.carregado) encher(); else swCarregar().then(encher);

    return {
      no: caixa,
      valor: function () {
        if (!cx.checked || caixa.hidden) return null;
        return {
          grupo: Number(sel.value),
          pago_por: Number(quemSel.value),
          partes: linhas.map(function (l) { return { user_id: l.id, owed: cent(l.i.value) }; })
        };
      }
    };
  }

  /* Depois de o pagamento ficar pago. Se o Splitwise falhar, o pagamento fica
     na mesma - so nao subiu, e diz-se. */
  function swLancar(taskId, pedido, extra) {
    var corpo = Object.assign({ task_id: taskId }, pedido, extra || {});
    return apiGestao('/api/splitwise/despesa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    }).then(function (r) {
      toast('Também foi para o Splitwise · ' + (r.despesa ? r.despesa.grupo : ''));
      return r;
    }).catch(function (e) {
      toast('O pagamento ficou registado, mas o Splitwise falhou: ' + (e.message || ''));
      return null;
    });
  }

  window.swBlocoPagar = swBlocoPagar;
  window.swLancar = swLancar;
  window.swCarregar = swCarregar;

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-view="splitwise"]');
    if (b) swCarregar(true);
  });

  (function esperar(n) {
    n = n || 0;
    if (document.getElementById('nav') && document.getElementById('nav').querySelector('[data-view="areas"]')) {
      swMontar(); swCarregar(); return;
    }
    if (n > 30) { swMontar(); return; }
    setTimeout(function () { esperar(n + 1); }, 400);
  })();
})();
