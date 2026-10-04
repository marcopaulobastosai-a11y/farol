/* Farol - a Familia por sub-areas.
 *
 * Familia (topo) e o agregado todo. Cada sub-area e a vida de algumas
 * pessoas: Ana Lucia e Marco Paulo, Meninos, Pais Bastos, Brownie. Ao
 * escolher uma, o ecra da area mostra por cima dos cartoes de sempre a
 * vida dessas pessoas: o que tem em curso, os dados (o que vivia em
 * Administracao > Pessoas), o cofre e os documentos. Sonhos e um quadro a
 * parte, com os objetivos de vida da casa.
 *
 * O area-tarefas.js chama fmSubArea(id). Reaproveita a ficha (ficha.js):
 * fiDados, fiTarefas, fiDocumentos... desenham aqui o mesmo que la.
 */
var FM = { cfg: null, aLer: false, fichas: {}, quem: {}, tab: {}, cofre: {}, cofreAte: {}, sonhos: null, pat: null, base: null, hz: 'todos', sel: null };

var FM_CSS = [
  '#nav button[data-view="pessoas"]{display:none!important}',
  '.fm-p{padding:16px 18px}',
  '.fm-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
  '.fm-who{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px 0 6px;border-radius:999px;border:1px solid var(--line);background:var(--surface);font:inherit;font-size:.875rem;color:var(--ink);cursor:pointer}',
  '.fm-who.on{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}',
  '.fm-av{width:32px;height:32px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-family:var(--mono);font-size:.75rem;overflow:hidden;flex:none}',
  '.fm-av img{width:100%;height:100%;object-fit:cover}',
  '.fm-tabs{display:flex;flex-wrap:wrap;border-bottom:1px solid var(--line);margin:12px 0 14px}',
  '.fm-tab{min-height:42px;padding:0 16px;border:0;border-bottom:2px solid transparent;background:none;font:inherit;font-size:.875rem;font-weight:500;color:var(--muted);cursor:pointer}',
  '.fm-tab.on{color:var(--accent-ink);border-bottom-color:var(--accent)}',
  '.fm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;align-items:start}',
  '.fm-cofre-bar{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding:12px 16px;border-radius:10px;background:#12262A;color:#E7EFEE;font-size:.875rem}',
  '.fm-cofre-bar .btn{background:transparent;color:#E7EFEE;border-color:#2E4A4E}',
  '.fm-cartoes{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin:12px 0}',
  '.fm-cartao{border-radius:14px;padding:14px 16px;color:#fff;min-height:112px;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;border:0;text-align:left;font:inherit;cursor:pointer}',
  '.fm-cartao .n{font-family:var(--mono);font-size:1.2rem;letter-spacing:.12em}',
  '.fm-cartao .l{display:flex;justify-content:space-between;font-size:.75rem;opacity:.9}',
  '.fm-aviso{font-size:.8125rem;color:var(--ink-2);margin:8px 0}',
  '.fm-dlg{border:0;padding:0;background:transparent}',
  '.fm-dlg::backdrop{background:rgba(12,28,28,.45)}',
  '.fm-dlgc{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px;width:min(520px,94vw);max-height:86vh;overflow:auto}',
  '.fm-dlgc h3{margin:0 0 10px;font-size:1.0625rem}',
  '.fm-dlgc label{display:flex;flex-direction:column;gap:4px;font-size:.75rem;color:var(--muted);margin-bottom:10px}',
  '.fm-dlgc input,.fm-dlgc select,.fm-dlgc textarea{font:inherit;font-size:.875rem;color:var(--ink);background:var(--surface-2);border:1px solid var(--line);border-radius:8px;padding:9px 11px;width:100%;box-sizing:border-box}',
  '.fm-dlgc textarea{min-height:5rem;resize:vertical}',
  '.fm-acts{display:flex;justify-content:flex-end;gap:8px;margin-top:6px;flex-wrap:wrap}',
  /* Sonhos */
  '.fm-son{background:#0D1C1F;color:#E6EEEC;border-radius:14px;overflow:hidden;margin-bottom:14px}',
  '.fm-son a{color:#E9B872}',
  '.fm-son-hero{position:relative;overflow:hidden;padding:34px 34px 0;min-height:250px;background:#112A2E}',
  '.fm-son-hero svg{position:absolute;left:0;right:0;bottom:0;width:100%;height:190px}',
  '.fm-son-hero h2{position:relative;margin:6px 0 8px;font-family:var(--serif);font-weight:300;font-style:italic;font-size:3rem;line-height:1.02;color:#F4EFE6}',
  '.fm-son-hero p{position:relative;margin:0;max-width:600px;font-family:var(--serif);font-size:1.15rem;line-height:1.45;color:#C9D7D5}',
  '.fm-son-lbl{position:relative;font-family:var(--mono);font-size:.6875rem;letter-spacing:.09em;text-transform:uppercase;color:#8FA6A4}',
  '.fm-son-corpo{padding:20px 30px 30px;display:flex;flex-direction:column;gap:18px}',
  '.fm-hz{min-height:40px;padding:0 16px;border-radius:999px;border:1px solid #2E4A4E;background:transparent;color:#C9D7D5;font:inherit;font-size:.8125rem;font-weight:500;cursor:pointer}',
  '.fm-hz.on{background:#E9B872;border-color:#E9B872;color:#1A1408}',
  '.fm-tool{min-height:40px;padding:0 14px;border-radius:9px;border:1px solid #2E4A4E;background:#132629;color:#E6EEEC;font:inherit;font-size:.8125rem;font-weight:500;cursor:pointer}',
  '.fm-quadro{flex:999 1 520px;min-width:0;column-width:240px;column-gap:18px}',
  '.fm-sonho{display:block;width:100%;break-inside:avoid;margin:0 0 18px;padding:12px 12px 16px;border:0;border-radius:6px;background:#F4EFE6;color:#1D2A2B;text-align:left;font:inherit;cursor:pointer;box-shadow:0 18px 40px -22px rgba(0,0,0,.8)}',
  '.fm-sonho:hover,.fm-sonho.on{outline:2px solid #E9B872;outline-offset:3px}',
  '.fm-sonho img,.fm-sonho svg{display:block;width:100%;height:auto;aspect-ratio:8/5;object-fit:cover;border-radius:3px}',
  '.fm-sonho .t{display:block;margin-top:10px;font-family:var(--serif);font-size:1.35rem;line-height:1.15}',
  '.fm-sonho .m{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center}',
  '.fm-sonho .hzp{font-family:var(--mono);font-size:.625rem;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:#E6DCCB}',
  '.fm-sonho .q{font-size:.75rem;color:#5E5A52}',
  '.fm-sonho .pr{display:flex;gap:4px;margin-top:10px}',
  '.fm-sonho .pr span{flex:1;height:4px;border-radius:2px;background:#D9CFBE}',
  '.fm-sonho .pr span.f{background:#C08A2E}',
  '.fm-sonho .nx{display:block;margin-top:8px;font-size:.8125rem;color:#3A4344}',
  '.fm-sonho.feito{opacity:.75}',
  '.fm-pens{break-inside:avoid;margin:0 0 18px;padding:18px 20px;border-radius:6px;background:#1A3034;color:#E6EEEC;font-family:var(--serif);font-style:italic;font-size:1.3rem;line-height:1.4;position:relative}',
  '.fm-pens small{display:block;margin-top:10px;font-family:var(--sans);font-style:normal;font-size:.75rem;color:#8FA6A4}',
  '.fm-pens button{position:absolute;top:6px;right:6px;border:0;background:none;color:#5D7A7C;cursor:pointer;font:inherit;font-size:.75rem;padding:6px}',
  '.fm-lado{flex:1 1 320px;max-width:400px;box-sizing:border-box;padding:20px;border-radius:10px;background:#132629;border:1px solid #22393C}',
  '.fm-lado h3{margin:8px 0 6px;font-family:var(--serif);font-weight:400;font-size:1.9rem;line-height:1.1;color:#F4EFE6}',
  '.fm-lado .hist{margin:0 0 14px;font-family:var(--serif);font-size:1.05rem;line-height:1.5;color:#C9D7D5;white-space:pre-line}',
  '.fm-passo{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #2A4246;font-size:.875rem}',
  '.fm-passo input[type=checkbox]{width:18px;height:18px;accent-color:#E9B872}',
  '.fm-passo .q{font-size:.75rem;color:#8FA6A4}',
  '.fm-passo button{border:0;background:none;color:#8FA6A4;cursor:pointer;font:inherit;font-size:.75rem;padding:6px}',
  '.fm-barra{height:6px;border-radius:3px;background:#22393C;overflow:hidden;margin-top:6px}',
  '.fm-barra span{display:block;height:6px;background:#E9B872}',
  '.fm-novo-passo{display:flex;gap:6px;margin-top:8px}',
  '.fm-novo-passo input{flex:1;min-width:0;min-height:38px;padding:0 10px;border-radius:8px;border:1px solid #2E4A4E;background:#0D1C1F;color:#E6EEEC;font:inherit;font-size:.875rem}'
].join('\n');

function fmMontar() {
  if (document.getElementById('fmCss')) return;
  var st = document.createElement('style'); st.id = 'fmCss'; st.textContent = FM_CSS;
  document.head.appendChild(st);
}

function fmApi(url, metodo, corpo) {
  var o = metodo ? { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) } : undefined;
  return apiGestao(url, o);
}
function fmRedesenhar() { if (typeof aeRender === 'function') aeRender(); }
function fmPessoa(id) { return ((window.G && G.people) || []).filter(function (p) { return p.id === id; })[0] || null; }
function fmCtx(id) { return ((window.G && G.contextos) || []).filter(function (c) { return c.id === id; })[0] || null; }
function fmNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function fmData(iso) { return iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''; }
function fmEuros(v) { return v == null ? '—' : Number(v).toLocaleString('pt-PT', { maximumFractionDigits: 0 }) + ' €'; }

function fmCarregar() {
  if (FM.cfg || FM.aLer) return;
  FM.aLer = true;
  apiGestao('/api/familia').then(function (d) { FM.cfg = d; })
    .catch(function () { FM.cfg = { pessoas: {}, cofre: false, erro: true }; })
    .then(function () { FM.aLer = false; fmRedesenhar(); });
}

function fmAvatar(p) {
  var a = el('span', 'fm-av');
  a.style.background = p.color || 'var(--accent)';
  a.appendChild(document.createTextNode(p.initials || String(p.name || '?').slice(0, 1)));
  var img = document.createElement('img');
  img.alt = '';
  img.onload = function () { clear(a); a.appendChild(img); };
  img.src = '/api/pessoas/' + p.id + '/avatar';
  return a;
}

/* ---------------- a janela ---------------- */
function fmJanela(titulo, campos, botoes) {
  fmMontar();
  var dlg = el('dialog', 'fm-dlg');
  var c = el('div', 'fm-dlgc');
  c.appendChild(el('h3', null, titulo));
  campos.forEach(function (x) {
    if (x.nodeType) { c.appendChild(x); return; }
    var l = el('label');
    l.appendChild(document.createTextNode(x[0]));
    l.appendChild(x[1]);
    c.appendChild(l);
  });
  var acts = el('div', 'fm-acts');
  var fechar = function () { try { dlg.close(); } catch (e) {} dlg.remove(); };
  (botoes || []).forEach(function (b) {
    var bt = el('button', 'btn' + (b.pri ? ' primary' : ''), b.txt);
    bt.type = 'button';
    bt.onclick = function () {
      var r = b.fn ? b.fn() : null;
      if (r === false) return;
      if (r && typeof r.then === 'function') { bt.disabled = true; r.then(function (ok) { if (ok !== false) fechar(); else bt.disabled = false; }, function (e) { bt.disabled = false; toast((e && e.message) || 'Não foi possível.'); }); return; }
      fechar();
    };
    acts.appendChild(bt);
  });
  var cancel = el('button', 'btn', 'Cancelar'); cancel.type = 'button'; cancel.onclick = fechar;
  acts.appendChild(cancel);
  c.appendChild(acts);
  dlg.appendChild(c);
  dlg.addEventListener('cancel', function () { setTimeout(function () { dlg.remove(); }, 0); });
  document.body.appendChild(dlg);
  dlg.showModal();
  return fechar;
}
function fmInput(tipo, valor, ph) { var i = el('input'); i.type = tipo || 'text'; if (valor != null) i.value = valor; if (ph) i.placeholder = ph; return i; }
function fmSelect(opcoes, valor) {
  var s = el('select');
  opcoes.forEach(function (o) { s.appendChild(new Option(o[1], o[0])); });
  if (valor != null) s.value = String(valor);
  return s;
}

/* ================= entrada: o area-tarefas.js chama isto ================= */
function fmSubArea(ctxId) {
  fmMontar();
  var c = fmCtx(ctxId);
  if (!c) return null;
  if (fmNorm(c.name).indexOf('sonho') === 0) {
    var s = fmSonhos(ctxId);
    s.setAttribute('data-so', '1');
    return s;
  }
  if (!FM.cfg) { fmCarregar(); return null; }
  var ids = (FM.cfg.pessoas || {})[ctxId] || [];
  return fmPainel(ctxId, ids);
}

/* ================= a vida das pessoas da sub-area ================= */
function fmPainel(ctxId, ids) {
  var card = el('div', 'card fm-p fi-ecra');
  var topo = el('div', 'fm-top');
  card.appendChild(topo);
  var pessoas = ids.map(fmPessoa).filter(Boolean);
  if (!pessoas.length) {
    topo.appendChild(el('span', null, 'Esta sub-área ainda não tem pessoas.'));
  }
  var quem = FM.quem[ctxId];
  if (!pessoas.some(function (p) { return p.id === quem; })) quem = FM.quem[ctxId] = pessoas.length ? pessoas[0].id : null;
  pessoas.forEach(function (p) {
    var b = el('button', 'fm-who' + (p.id === quem ? ' on' : ''));
    b.type = 'button';
    b.appendChild(fmAvatar(p));
    b.appendChild(document.createTextNode(p.name));
    b.onclick = function () { FM.quem[ctxId] = p.id; fmRedesenhar(); };
    topo.appendChild(b);
  });
  var esp = el('span'); esp.style.flex = '1'; topo.appendChild(esp);
  var gerir = el('button', 'btn', 'Pessoas da sub-área'); gerir.type = 'button';
  gerir.onclick = function () { fmGerirPessoas(ctxId, ids); };
  topo.appendChild(gerir);
  if (typeof fiEditar === 'function') {
    var nova = el('button', 'btn', '+ Pessoa'); nova.type = 'button';
    nova.onclick = function () { fiEditar({}, function () { if (typeof loadGestao === 'function') loadGestao(); }); };
    topo.appendChild(nova);
  }
  if (!quem) return card;

  var tab = FM.tab[ctxId] || 'curso';
  var tabs = el('div', 'fm-tabs'); tabs.setAttribute('role', 'tablist');
  [['curso', 'Em curso'], ['dados', 'Dados'], ['cofre', 'Cofre'], ['docs', 'Documentos']].forEach(function (t) {
    var b = el('button', 'fm-tab' + (tab === t[0] ? ' on' : ''), t[1]); b.type = 'button'; b.setAttribute('role', 'tab');
    b.onclick = function () { FM.tab[ctxId] = t[0]; fmRedesenhar(); };
    tabs.appendChild(b);
  });
  card.appendChild(tabs);
  var corpo = el('div');
  card.appendChild(corpo);

  if (tab === 'cofre') { fmCofre(corpo, quem); return card; }

  var d = FM.fichas[quem];
  if (!d) {
    corpo.appendChild(el('p', 'fi-vazio', 'A ler…'));
    apiGestao('/api/pessoas/' + quem + '/ficha').then(function (f) { FM.fichas[quem] = f; fmRedesenhar(); })
      .catch(function (e) { clear(corpo); corpo.appendChild(el('p', 'fi-vazio', (e && e.message) || 'Não foi possível ler.')); });
    return card;
  }
  /* Os blocos da ficha leem o FI de passagem (a edicao e o Google). */
  if (typeof FI !== 'undefined') { FI.id = quem; FI.dados = d; FI.contas = d.contas || []; }
  var p = d.pessoa;
  try {
    if (tab === 'dados') {
      var g = el('div', 'fm-grid'); corpo.appendChild(g);
      var col = el('div', 'stack'); g.appendChild(col);
      if (typeof fiDados === 'function') fiDados(col, p, d.dependentes || [], d.google || null);
      if (typeof fiEditar === 'function') {
        var ed = el('button', 'btn', 'Editar dados de ' + p.name); ed.type = 'button';
        ed.onclick = function () { fiEditar(p, function () { delete FM.fichas[quem]; fmRedesenhar(); }); };
        corpo.appendChild(ed);
      }
    } else if (tab === 'docs') {
      if (typeof fiDocumentos === 'function') fiDocumentos(corpo, d.documentos || []);
    } else {
      var g2 = el('div', 'fm-grid'); corpo.appendChild(g2);
      var a = el('div', 'stack'), b2 = el('div', 'stack'); g2.appendChild(a); g2.appendChild(b2);
      if (typeof fiCompromissos === 'function') fiCompromissos(a, d.compromissos || [], d.compromissosPassados || 0);
      if (typeof fiTarefas === 'function') fiTarefas(a, d.tarefas || []);
      if (typeof fiProjetos === 'function') fiProjetos(b2, d.projetos || []);
      if (typeof fiDespesas === 'function') fiDespesas(b2, d.despesas || []);
      if (typeof fiCaixa === 'function') fiCaixa(b2, d.caixa || []);
    }
  } catch (e) {
    console.error('[farol] familia painel', e);
    corpo.appendChild(el('p', 'fi-vazio', 'Este bloco falhou a desenhar.'));
  }
  return card;
}

function fmGerirPessoas(ctxId, ids) {
  var box = el('div');
  var marcas = {};
  ((window.G && G.people) || []).filter(function (p) { return p.active !== false; }).forEach(function (p) {
    var l = el('label'); l.style.flexDirection = 'row'; l.style.alignItems = 'center'; l.style.gap = '10px'; l.style.fontSize = '.875rem'; l.style.color = 'var(--ink)';
    var c = fmInput('checkbox'); c.style.width = '18px'; c.checked = ids.indexOf(p.id) >= 0;
    marcas[p.id] = c;
    l.appendChild(c); l.appendChild(document.createTextNode(p.name));
    box.appendChild(l);
  });
  fmJanela('Quem vive nesta sub-área', [el('p', 'fm-aviso', 'A vida destas pessoas aparece aqui: o que têm em curso, os dados, o cofre e os documentos.'), box], [{ txt: 'Guardar', pri: true, fn: function () {
    var sel = Object.keys(marcas).filter(function (k) { return marcas[k].checked; }).map(Number);
    return fmApi('/api/familia/pessoas', 'PUT', { context_id: ctxId, pessoas: sel }).then(function (r) { FM.cfg.pessoas = r.pessoas; fmRedesenhar(); });
  } }]);
}

/* ================= o cofre ================= */
var FM_CORES_CARTAO = ['#1F4E5F', '#3F3A63', '#5B3A2E', '#2E5A3E', '#5A3550', '#3B4A5C'];
function fmCofre(pai, pid) {
  var bar = el('div', 'fm-cofre-bar');
  pai.appendChild(bar);
  var aberto = FM.cofre[pid] && FM.cofreAte[pid] > Date.now();
  bar.insertAdjacentHTML('beforeend', '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E9B872" stroke-width="1.8" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>');
  var txt = el('span', null, aberto ? 'Cofre aberto — fecha sozinho ao fim de 5 minutos.' : (FM.cfg && FM.cfg.cofre ? 'Cofre fechado.' : 'O cofre só abre para os adultos da casa.'));
  txt.style.flex = '1 1 260px';
  bar.appendChild(txt);
  if (FM.cfg && FM.cfg.cofre) {
    var b = el('button', 'btn', aberto ? 'Fechar agora' : 'Abrir cofre'); b.type = 'button';
    b.onclick = function () {
      if (aberto) { delete FM.cofre[pid]; fmRedesenhar(); return; }
      apiGestao('/api/cofre?pessoas=' + pid).then(function (d) {
        FM.cofre[pid] = d.itens || []; FM.cofreAte[pid] = Date.now() + 5 * 60000;
        setTimeout(function () { if (FM.cofreAte[pid] <= Date.now()) { delete FM.cofre[pid]; fmRedesenhar(); } }, 5 * 60000 + 500);
        fmRedesenhar();
      }).catch(function (e) { toast((e && e.message) || 'Não foi possível abrir o cofre.'); });
    };
    bar.appendChild(b);
  }
  var av = el('p', 'fm-aviso');
  av.innerHTML = 'Guarda-se o que identifica um cartão — banco, últimos 4 dígitos, validade e a foto como documento. <strong>Nunca o número completo, o CVV nem o PIN.</strong>';
  pai.appendChild(av);
  if (!aberto) return;

  var itens = FM.cofre[pid];
  var bancos = itens.filter(function (x) { return x.tipo === 'banco'; });
  var ids = itens.filter(function (x) { return x.tipo !== 'banco'; });
  var acoes = el('div', 'fm-acts'); acoes.style.justifyContent = 'flex-start';
  var nb = el('button', 'btn', '+ Cartão bancário'); nb.type = 'button'; nb.onclick = function () { fmCofreJanela(pid, { tipo: 'banco' }); };
  var ni = el('button', 'btn', '+ Documento de identificação'); ni.type = 'button'; ni.onclick = function () { fmCofreJanela(pid, { tipo: 'id' }); };
  acoes.appendChild(nb); acoes.appendChild(ni);
  pai.appendChild(acoes);

  pai.appendChild(el('div', 'fi-col-t', 'Cartões bancários'));
  if (!bancos.length) pai.appendChild(el('p', 'fi-vazio', 'Nenhum cartão guardado.'));
  var grade = el('div', 'fm-cartoes'); pai.appendChild(grade);
  bancos.forEach(function (x, i) {
    var c = el('button', 'fm-cartao'); c.type = 'button';
    c.style.background = FM_CORES_CARTAO[i % FM_CORES_CARTAO.length];
    var l1 = el('span', 'l'); l1.appendChild(el('span', null, x.entidade || '')); l1.appendChild(el('span', null, x.nome));
    var n = el('span', 'n', '•••• ' + (x.ultimos4 || '????'));
    var l2 = el('span', 'l'); l2.appendChild(el('span', null, x.nota || '')); l2.appendChild(el('span', null, x.validade ? 'val. ' + x.validade.slice(5, 7) + '/' + x.validade.slice(2, 4) : ''));
    c.appendChild(l1); c.appendChild(n); c.appendChild(l2);
    c.onclick = function () { fmCofreJanela(pid, x); };
    grade.appendChild(c);
  });

  pai.appendChild(el('div', 'fi-col-t', 'Cartões e documentos de identificação'));
  if (!ids.length) pai.appendChild(el('p', 'fi-vazio', 'Nenhum documento guardado.'));
  var lista = el('div', 'card'); lista.style.padding = '4px 16px'; if (ids.length) pai.appendChild(lista);
  var hoje = new Date().toISOString().slice(0, 10);
  var em90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  ids.forEach(function (x) {
    var r = el('div', 'row');
    var g = el('div', 'grow');
    g.appendChild(el('span', 't', x.nome));
    g.appendChild(el('span', 's', [x.entidade, x.numero ? 'n.º ' + x.numero : null, x.nota].filter(Boolean).join(' · ')));
    r.appendChild(g);
    if (x.validade) r.appendChild(pill('val. ' + fmData(x.validade), x.validade < hoje ? 'bad' : (x.validade < em90 ? 'warn' : '')));
    if (x.ficheiro) { var a = el('a', null, 'abrir'); a.href = '/api/inbox/' + x.ficheiro + '/ficheiro'; a.target = '_blank'; a.rel = 'noopener'; r.appendChild(a); }
    var e = el('button', 'btn small', 'Editar'); e.type = 'button'; e.onclick = function () { fmCofreJanela(pid, x); };
    r.appendChild(e);
    lista.appendChild(r);
  });
}

function fmCofreJanela(pid, x) {
  var banco = x.tipo === 'banco';
  var nome = fmInput('text', x.nome || '', banco ? 'ex.: Classic Dual' : 'ex.: Cartão de Cidadão');
  var ent = fmInput('text', x.entidade || '', banco ? 'Banco' : 'Entidade emissora');
  var u4 = fmInput('text', x.ultimos4 || '', '0000'); u4.maxLength = 4; u4.inputMode = 'numeric';
  var num = fmInput('text', x.numero || '');
  var val = fmInput('date', x.validade || '');
  var nota = fmInput('text', x.nota || '');
  var docs = ((window.D && D.documents) || []).filter(function (d) { return d.person_id === pid; })
    .map(function (d) { return [d.id, d.name]; });
  var doc = fmSelect([['', '— sem documento —']].concat(docs), x.document_id || '');
  var campos = [['Nome', nome], [banco ? 'Banco' : 'Entidade', ent]];
  if (banco) campos.push(['Últimos 4 dígitos', u4]); else campos.push(['Número', num]);
  campos.push(['Validade', val], ['Foto do cartão (documento)', doc], ['Nota', nota]);
  var bts = [{ txt: x.id ? 'Guardar' : 'Guardar no cofre', pri: true, fn: function () {
    if (!nome.value.trim()) { toast('Falta o nome.'); return false; }
    if (banco && u4.value.replace(/\D/g, '').length > 4) { toast('Só os últimos 4 dígitos.'); return false; }
    var corpo = { person_id: pid, tipo: banco ? 'banco' : 'id', nome: nome.value, entidade: ent.value, validade: val.value || null, document_id: doc.value || null, nota: nota.value };
    if (banco) corpo.ultimos4 = u4.value; else corpo.numero = num.value;
    var p = x.id ? fmApi('/api/cofre/' + x.id, 'PATCH', corpo) : fmApi('/api/cofre', 'POST', corpo);
    return p.then(function () { return apiGestao('/api/cofre?pessoas=' + pid); }).then(function (d) { FM.cofre[pid] = d.itens || []; fmRedesenhar(); });
  } }];
  if (x.id) bts.push({ txt: 'Apagar', fn: function () {
    return fmApi('/api/cofre/' + x.id, 'DELETE').then(function () { FM.cofre[pid] = FM.cofre[pid].filter(function (y) { return y.id !== x.id; }); fmRedesenhar(); });
  } });
  fmJanela(banco ? (x.id ? 'Cartão bancário' : 'Novo cartão bancário') : (x.id ? 'Documento de identificação' : 'Novo documento de identificação'), campos, bts);
}

/* ================= Sonhos ================= */
var FM_HZ = { ano: 'Este ano', cinco: 'Próximos 5 anos', vida: 'Para a vida' };
var FM_CENAS = [
  ['#F2D9B0', '#E07A3F', '#5F7F5A', 'M0 110 C 50 90, 90 115, 140 98 S 210 88, 240 100 L240 150 L0 150 Z', 180],
  ['#BFD8E6', '#F2C14E', '#2F6F8A', 'M0 100 C 60 120, 120 80, 240 105 L240 150 L0 150 Z', 60],
  ['#E8E3C8', '#E9A23B', '#6B8E3D', 'M0 120 L60 70 L100 105 L150 55 L240 115 L240 150 L0 150 Z', 200],
  ['#E3D7EE', '#E98E5B', '#5B4E8A', 'M0 115 C 70 85, 150 125, 240 95 L240 150 L0 150 Z', 120],
  ['#CFE3DA', '#E9B872', '#2E6B5A', 'M0 105 C 40 125, 110 90, 170 112 S 220 100, 240 108 L240 150 L0 150 Z', 90]
];

function fmSonhosLer() {
  if (FM.sonhosALer) return;
  FM.sonhosALer = true;
  Promise.all([
    apiGestao('/api/sonhos'),
    apiGestao('/api/financas/patrimonio?empresas=1').catch(function () { return null; }),
    apiGestao('/api/financas/base').catch(function () { return null; })
  ]).then(function (r) { FM.sonhos = r[0].sonhos || []; FM.pat = r[1]; FM.base = r[2]; })
    .catch(function () { FM.sonhos = []; })
    .then(function () { FM.sonhosALer = false; fmRedesenhar(); });
}
function fmSonhosRecarregar() { FM.sonhos = null; fmSonhosLer(); }

function fmCena(id) {
  var c = FM_CENAS[id % FM_CENAS.length];
  var ns = 'http://www.w3.org/2000/svg';
  var s = document.createElementNS(ns, 'svg');
  s.setAttribute('viewBox', '0 0 240 150'); s.setAttribute('aria-hidden', 'true');
  s.style.background = c[0];
  var sol = document.createElementNS(ns, 'circle'); sol.setAttribute('cx', c[4]); sol.setAttribute('cy', 46); sol.setAttribute('r', 18); sol.setAttribute('fill', c[1]);
  var chao = document.createElementNS(ns, 'path'); chao.setAttribute('d', c[3]); chao.setAttribute('fill', c[2]);
  s.appendChild(sol); s.appendChild(chao);
  return s;
}

/* O programa: quantas tarefas feitas de quantas (somando os projetos filhos). */
function fmProgresso(pid) {
  var ps = (window.G && G.projects) || [];
  var p = ps.filter(function (x) { return x.id === pid; })[0];
  if (!p) return null;
  var tot = 0, fei = 0;
  [p].concat(ps.filter(function (x) { return x.parent_id === pid; })).forEach(function (x) {
    var c = x.contagem || {}; tot += c.total || 0; fei += c.feitas || 0;
  });
  return { nome: p.name, tipo: p.tipo, total: tot, feitas: fei };
}
function fmSaldo(contaId) {
  var cs = (FM.pat && FM.pat.contas) || [];
  var c = cs.filter(function (x) { return x.id === contaId; })[0];
  return c ? { nome: c.nome, saldo: c.saldo } : null;
}

function fmSonhos(ctxId) {
  FM.sonhosCtx = ctxId;
  var raiz = el('div', 'fm-son');
  var hero = el('div', 'fm-son-hero');
  hero.innerHTML = '<svg viewBox="0 0 1200 300" preserveAspectRatio="none" aria-hidden="true"><circle cx="900" cy="150" r="70" fill="#E9B872" opacity=".9"/><path d="M0 210 C 200 150, 380 190, 560 160 S 900 120, 1200 170 L1200 300 L0 300 Z" fill="#1E4A4E"/><path d="M0 240 C 180 200, 420 245, 640 215 S 980 200, 1200 230 L1200 300 L0 300 Z" fill="#163A3E"/><path d="M0 270 C 260 245, 520 285, 780 258 S 1060 250, 1200 265 L1200 300 L0 300 Z" fill="#0D1C1F"/></svg>';
  hero.appendChild(el('div', 'fm-son-lbl', 'Família › Sonhos'));
  hero.appendChild(el('h2', null, 'O nosso horizonte'));
  hero.appendChild(el('p', null, 'O que queremos viver juntos — perto, a meio caminho e para a vida. Cada sonho tem um passo seguinte.'));
  raiz.appendChild(hero);
  var corpo = el('div', 'fm-son-corpo');
  raiz.appendChild(corpo);
  if (!FM.sonhos) { corpo.appendChild(el('p', null, 'A ler os sonhos…')); fmSonhosLer(); return raiz; }

  var barra = el('div'); barra.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:10px';
  [['todos', 'Todos'], ['ano', 'Este ano'], ['cinco', 'Próximos 5 anos'], ['vida', 'Para a vida']].forEach(function (h) {
    var b = el('button', 'fm-hz' + (FM.hz === h[0] ? ' on' : ''), h[1]); b.type = 'button';
    b.onclick = function () { FM.hz = h[0]; fmRedesenhar(); };
    barra.appendChild(b);
  });
  var esp = el('span'); esp.style.flex = '1'; barra.appendChild(esp);
  var bs = el('button', 'fm-tool', '+ Sonho'); bs.type = 'button'; bs.onclick = function () { fmSonhoJanela({}); };
  var bp = el('button', 'fm-tool', '+ Pensamento'); bp.type = 'button'; bp.onclick = function () { fmPensamentoJanela(); };
  barra.appendChild(bs); barra.appendChild(bp);
  corpo.appendChild(barra);

  var linha = el('div'); linha.style.cssText = 'display:flex;flex-wrap:wrap;gap:26px;align-items:flex-start';
  corpo.appendChild(linha);
  var quadro = el('div', 'fm-quadro'); linha.appendChild(quadro);

  var sonhos = FM.sonhos.filter(function (s) { return s.tipo === 'sonho'; });
  var visiveis = FM.sonhos.filter(function (s) { return s.tipo === 'pensamento' || FM.hz === 'todos' || s.horizonte === FM.hz; });
  if (!sonhos.length) {
    var v = el('div', 'fm-pens', 'Ainda não há sonhos. Comecem pelo mais perto — e escrevam o primeiro passo.');
    quadro.appendChild(v);
  }
  if (!FM.sel || !sonhos.some(function (s) { return s.id === FM.sel; })) FM.sel = sonhos.length ? sonhos[0].id : null;

  visiveis.forEach(function (s) {
    if (s.tipo === 'pensamento') {
      var p = el('div', 'fm-pens', '«' + (s.texto || '') + '»');
      var autor = s.autor_id ? fmPessoa(s.autor_id) : null;
      p.appendChild(el('small', null, autor ? '— ' + autor.name : ''));
      var x = el('button', null, 'tirar'); x.type = 'button'; x.setAttribute('aria-label', 'Tirar este pensamento');
      x.onclick = function () { fmApi('/api/sonhos/' + s.id, 'DELETE').then(fmSonhosRecarregar); };
      p.appendChild(x);
      quadro.appendChild(p);
      return;
    }
    var b = el('button', 'fm-sonho' + (s.id === FM.sel ? ' on' : '') + (s.cumprido ? ' feito' : '')); b.type = 'button';
    if (s.tem_foto) { var img = el('img'); img.src = '/api/sonhos/' + s.id + '/foto?v=' + (FM.fotoV || 1); img.alt = s.titulo || ''; b.appendChild(img); }
    else b.appendChild(fmCena(s.id));
    b.appendChild(el('span', 't', (s.cumprido ? '✓ ' : '') + (s.titulo || '')));
    var m = el('span', 'm'); m.appendChild(el('span', 'hzp', FM_HZ[s.horizonte] || '')); if (s.quem) m.appendChild(el('span', 'q', s.quem));
    b.appendChild(m);
    if (s.passos.length) {
      var pr = el('span', 'pr'); pr.setAttribute('aria-label', 'Progresso');
      s.passos.forEach(function (p) { pr.appendChild(el('span', p.feito ? 'f' : null)); });
      b.appendChild(pr);
    }
    var prox = s.passos.filter(function (p) { return !p.feito; })[0];
    b.appendChild(el('span', 'nx', prox ? 'Próximo: ' + prox.texto + (prox.quando ? ' · ' + prox.quando : '') : (s.passos.length ? 'Todos os passos dados.' : 'Falta o primeiro passo.')));
    b.onclick = function () { FM.sel = s.id; fmRedesenhar(); };
    quadro.appendChild(b);
  });

  var sel = sonhos.filter(function (s) { return s.id === FM.sel; })[0];
  if (sel) linha.appendChild(fmSonhoLado(sel));
  return raiz;
}

function fmSonhoLado(s) {
  var lado = el('aside', 'fm-lado');
  lado.appendChild(el('div', 'fm-son-lbl', [FM_HZ[s.horizonte], s.quem].filter(Boolean).join(' · ')));
  lado.appendChild(el('h3', null, s.titulo || ''));
  if (s.texto) lado.appendChild(el('p', 'hist', s.texto));

  lado.appendChild(el('div', 'fm-son-lbl', 'Passos'));
  s.passos.forEach(function (p) {
    var r = el('div', 'fm-passo');
    var c = fmInput('checkbox'); c.checked = p.feito; c.setAttribute('aria-label', 'Feito');
    c.onchange = function () { fmApi('/api/sonhos/passos/' + p.id, 'PATCH', { feito: c.checked }).then(fmSonhosRecarregar); };
    r.appendChild(c);
    var t = el('span', null, p.texto); t.style.flex = '1'; r.appendChild(t);
    if (p.quando) r.appendChild(el('span', 'q', p.quando));
    if (!p.task_id) {
      var tt = el('button', null, 'tarefa'); tt.type = 'button'; tt.title = 'Criar uma tarefa para este passo';
      tt.onclick = function () { fmPassoTarefa(s, p); };
      r.appendChild(tt);
    } else r.appendChild(el('span', 'q', 'tarefa ✓'));
    var x = el('button', null, '×'); x.type = 'button'; x.setAttribute('aria-label', 'Tirar este passo');
    x.onclick = function () { fmApi('/api/sonhos/passos/' + p.id, 'DELETE').then(fmSonhosRecarregar); };
    r.appendChild(x);
    lado.appendChild(r);
  });
  var np = el('div', 'fm-novo-passo');
  var ni = fmInput('text', '', 'Novo passo…');
  var nq = fmInput('text', '', 'quando'); nq.style.maxWidth = '90px';
  var nb = el('button', 'fm-tool', '+'); nb.type = 'button'; nb.setAttribute('aria-label', 'Acrescentar passo');
  var junta = function () { if (!ni.value.trim()) return; fmApi('/api/sonhos/' + s.id + '/passos', 'POST', { texto: ni.value, quando: nq.value }).then(fmSonhosRecarregar); };
  nb.onclick = junta; ni.onkeydown = function (e) { if (e.key === 'Enter') junta(); };
  np.appendChild(ni); np.appendChild(nq); np.appendChild(nb);
  lado.appendChild(np);

  var pg = s.project_id ? fmProgresso(s.project_id) : null;
  var sd = s.conta_id ? fmSaldo(s.conta_id) : null;
  if (pg || sd) {
    var lg = el('div', 'fm-son-lbl', 'Ligado a'); lg.style.marginTop = '16px'; lado.appendChild(lg);
    if (pg) {
      var r1 = el('div', 'fm-passo'); r1.style.flexDirection = 'column'; r1.style.alignItems = 'stretch';
      var l1 = el('span'); l1.style.cssText = 'display:flex;justify-content:space-between;gap:8px';
      l1.appendChild(el('span', null, (pg.tipo === 'programa' ? 'Programa · ' : 'Projeto · ') + pg.nome));
      l1.appendChild(el('span', 'q', pg.feitas + ' de ' + pg.total + ' tarefas'));
      var b1 = el('div', 'fm-barra'); var f1 = el('span'); f1.style.width = (pg.total ? Math.round(pg.feitas / pg.total * 100) : 0) + '%'; b1.appendChild(f1);
      r1.appendChild(l1); r1.appendChild(b1); lado.appendChild(r1);
    }
    if (sd) {
      var r2 = el('div', 'fm-passo'); r2.style.flexDirection = 'column'; r2.style.alignItems = 'stretch';
      var l2 = el('span'); l2.style.cssText = 'display:flex;justify-content:space-between;gap:8px';
      l2.appendChild(el('span', null, 'Poupança · ' + sd.nome));
      l2.appendChild(el('span', 'q', fmEuros(sd.saldo) + (s.meta ? ' de ' + fmEuros(s.meta) : '')));
      r2.appendChild(l2);
      if (s.meta) { var b2 = el('div', 'fm-barra'); var f2 = el('span'); f2.style.width = Math.max(0, Math.min(100, Math.round((sd.saldo || 0) / s.meta * 100))) + '%'; b2.appendChild(f2); r2.appendChild(b2); }
      lado.appendChild(r2);
    }
  }

  var acts = el('div'); acts.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:16px';
  var ed = el('button', 'fm-tool', 'Editar'); ed.type = 'button'; ed.onclick = function () { fmSonhoJanela(s); };
  var ft = el('button', 'fm-tool', s.tem_foto ? 'Trocar foto' : 'Pôr foto'); ft.type = 'button';
  var fi = el('input'); fi.type = 'file'; fi.accept = 'image/*'; fi.hidden = true;
  fi.onchange = function () { if (fi.files && fi.files[0]) fmSonhoFoto(s, fi.files[0]); };
  ft.onclick = function () { fi.click(); };
  var cu = el('button', 'fm-tool', s.cumprido ? 'Voltar a sonhar' : 'Cumprido!'); cu.type = 'button';
  cu.onclick = function () { fmApi('/api/sonhos/' + s.id, 'PATCH', { cumprido: !s.cumprido }).then(fmSonhosRecarregar); };
  acts.appendChild(ed); acts.appendChild(ft); acts.appendChild(fi); acts.appendChild(cu);
  lado.appendChild(acts);
  return lado;
}

function fmSonhoFoto(s, ficheiro) {
  var fr = new FileReader();
  fr.onload = function () {
    var img = new Image();
    img.onload = function () {
      var max = 1400, k = Math.min(1, max / Math.max(img.width, img.height));
      var cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      fmApi('/api/sonhos/' + s.id + '/foto', 'POST', { foto: cv.toDataURL('image/jpeg', 0.82) })
        .then(function () { FM.fotoV = Date.now(); fmSonhosRecarregar(); toast('Foto guardada.'); })
        .catch(function (e) { toast((e && e.message) || 'Não foi possível guardar a foto.'); });
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(ficheiro);
}

function fmPassoTarefa(s, p) {
  var antes = {};
  ((window.G && G.tasks) || []).forEach(function (x) { antes[x.id] = true; });
  fmApi('/api/gestao/tarefas', 'POST', { tipo: 'tarefa', title: p.texto + ' (' + s.titulo + ')', context_id: FM.sonhosCtx || null, project_id: s.project_id || null })
    .then(function (g) {
      if (g && g.tasks) window.G = g;
      var nova = ((g && g.tasks) || []).filter(function (x) { return !antes[x.id]; }).sort(function (a, b) { return b.id - a.id; })[0];
      if (!nova) return;
      return fmApi('/api/sonhos/passos/' + p.id, 'PATCH', { task_id: nova.id });
    }).then(function () { toast('Tarefa criada.'); fmSonhosRecarregar(); })
    .catch(function (e) { toast((e && e.message) || 'Não foi possível criar a tarefa.'); });
}

function fmSonhoJanela(s) {
  var titulo = fmInput('text', s.titulo || '', 'ex.: Uma grande viagem em família');
  var texto = el('textarea'); texto.value = s.texto || ''; texto.placeholder = 'A história do sonho: porquê, como imaginamos…';
  var hz = fmSelect([['ano', 'Este ano'], ['cinco', 'Próximos 5 anos'], ['vida', 'Para a vida']], s.horizonte || 'cinco');
  var subs = ((window.G && G.contextos) || []).filter(function (c) { var f = fmCtx(FM.sonhosCtx); return f && c.parent_id === f.parent_id && c.id !== FM.sonhosCtx; });
  var quem = fmSelect([['Família', 'Família']].concat(subs.map(function (c) { return [c.name, c.name]; })), s.quem || 'Família');
  var projs = ((window.G && G.projects) || []).filter(function (p) { return p.status !== 'arquivado' && p.status !== 'concluido'; })
    .sort(function (a, b) { return (a.tipo === 'programa' ? 0 : 1) - (b.tipo === 'programa' ? 0 : 1) || String(a.name).localeCompare(String(b.name)); })
    .map(function (p) { return [p.id, (p.tipo === 'programa' ? 'Programa · ' : '') + p.name]; });
  var proj = fmSelect([['', '— nenhum —']].concat(projs), s.project_id || '');
  var contas = ((FM.base && FM.base.contas) || []).filter(function (c) { return c.ativo !== false && c.pessoal !== false; })
    .map(function (c) { return [c.id, c.nome]; });
  var conta = fmSelect([['', '— nenhuma —']].concat(contas), s.conta_id || '');
  var meta = fmInput('text', s.meta ? String(s.meta).replace('.', ',') : '', 'quanto é preciso juntar (€)'); meta.inputMode = 'decimal';
  var bts = [{ txt: s.id ? 'Guardar' : 'Criar o sonho', pri: true, fn: function () {
    if (!titulo.value.trim()) { toast('Dá um nome ao sonho.'); return false; }
    var corpo = { tipo: 'sonho', titulo: titulo.value, texto: texto.value, horizonte: hz.value, quem: quem.value, project_id: proj.value || null, conta_id: conta.value || null, meta: meta.value };
    var p = s.id ? fmApi('/api/sonhos/' + s.id, 'PATCH', corpo) : fmApi('/api/sonhos', 'POST', corpo).then(function (r) { FM.sel = r.id; });
    return p.then(fmSonhosRecarregar);
  } }];
  if (s.id) bts.push({ txt: 'Apagar', fn: function () { return fmApi('/api/sonhos/' + s.id, 'DELETE').then(function () { FM.sel = null; fmSonhosRecarregar(); }); } });
  fmJanela(s.id ? 'Editar sonho' : 'Novo sonho', [['Sonho', titulo], ['História', texto], ['Horizonte', hz], ['De quem', quem], ['Ligado a um programa ou projeto', proj], ['Poupança', conta], ['Meta da poupança', meta]], bts);
}

function fmPensamentoJanela() {
  var texto = el('textarea'); texto.placeholder = 'Uma frase, uma ideia, uma lembrança…';
  var adultos = ((window.G && G.people) || []).filter(function (p) { return p.active !== false && p.kind !== 'animal'; }).map(function (p) { return [p.id, p.name]; });
  var autor = fmSelect([['', '—']].concat(adultos), '');
  fmJanela('Novo pensamento', [['Pensamento', texto], ['De quem', autor]], [{ txt: 'Pôr no quadro', pri: true, fn: function () {
    if (!texto.value.trim()) { toast('Escreve o pensamento.'); return false; }
    return fmApi('/api/sonhos', 'POST', { tipo: 'pensamento', texto: texto.value, autor_id: autor.value || null }).then(fmSonhosRecarregar);
  } }]);
}

/* Arranque: o estilo (que tambem esconde Pessoas do menu) e a configuracao. */
(function () {
  fmMontar();
  var tentar = function (n) {
    if (window.G && G.contextos) { fmCarregar(); return; }
    if (n < 60) setTimeout(function () { tentar(n + 1); }, 500);
  };
  tentar(0);
})();
