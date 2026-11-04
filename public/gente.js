'use strict';
/* Farol - o separador Pessoas (fase 4 do menu novo, 24 out 2026).
 *
 * A ficha de cada pessoa ja existia (ficha.js) e a Familia ja mostrava a vida
 * das pessoas por sub-area. Faltava o sitio para olhar para as pessoas em
 * si: quem conta, o que cada uma tem esta semana, e os cuidados com quem
 * depende da casa. Este ecra tem tres blocos:
 *
 *   Cuidados   - o que vem ai para os familiares que nao fazem tarefas
 *                (os pais), e quem trata de cada coisa; o que nao tem
 *                responsavel fica a vista.
 *   Circulos   - Agregado, Familia alargada e Prestadores (os
 *                destinatarios dos emails: senhorio, contabilista...).
 *   Esta semana - em cada cartao, o que a pessoa tem nos proximos 7 dias.
 *
 * Cada cartao abre a ficha (data-ficha). O ⋯ de cada cartao ajusta o
 * circulo (Agregado, Familia alargada, Amigos e proximos, nao mostrar), os
 * cuidados e as preferencias da pessoa (colunas circulo, cuidados e
 * preferencias de people; NULL = automatico pelo tipo). So aparece com o
 * menu novo ligado.
 */

var GT = { destinatarios: null, aLerDest: false, verEscondidos: false, dlg: null };

var GT_CSS = [
  '#nav button[data-view="gente"]{display:none}',
  'body.mn-on #nav button[data-view="gente"]{display:flex}',
  '#view-gente .gt-bloco{margin-bottom:26px}',
  '#view-gente .gt-h{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin:0 0 12px}',
  '#view-gente .gt-h h3{margin:0;font-size:1.0625rem;font-weight:600}',
  '#view-gente .gt-h span{color:var(--muted);font-size:.8125rem}',
  /* a grelha: cada coluna tem a sua largura e nada passa para a do lado */
  '#view-gente .gt-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,270px),1fr));gap:12px;align-items:stretch}',
  '#view-gente .gt-cw{position:relative;display:flex;min-width:0}',
  '#view-gente .gt-card{font:inherit;text-align:left;display:flex;gap:12px;align-items:flex-start;padding:14px 14px 12px;border:1px solid var(--line);',
  'border-radius:12px;background:var(--surface);color:var(--ink);cursor:pointer;min-width:0;width:100%;box-sizing:border-box;transition:border-color .15s,box-shadow .15s}',
  '#view-gente .gt-card:hover{border-color:var(--accent);box-shadow:0 2px 10px rgba(0,0,0,.05)}',
  '#view-gente .gt-av{width:40px;height:40px;border-radius:50%;flex:none;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-family:var(--mono);font-size:.75rem;letter-spacing:.02em;overflow:hidden}',
  '#view-gente .gt-av img{width:100%;height:100%;object-fit:cover}',
  '#view-gente .gt-t{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}',
  '#view-gente .gt-t b{font-weight:600;font-size:.9375rem;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:30px}',
  '#view-gente .gt-t small{color:var(--muted);font-size:.75rem;line-height:1.35;overflow:hidden;text-overflow:ellipsis}',
  '#view-gente .gt-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}',
  '#view-gente .gt-tag{font-size:.625rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;padding:2px 7px;border-radius:5px;background:var(--accent-soft);color:var(--accent-ink);white-space:nowrap}',
  '#view-gente .gt-num{font-size:.75rem;color:var(--ink-2);margin-top:8px;padding-top:8px;border-top:1px solid var(--line-soft)}',
  '#view-gente .gt-num b{display:inline;font-weight:600;padding:0;font-size:.75rem}',
  /* o que a pessoa tem esta semana: uma linha por coisa, a data numa coluna */
  '#view-gente .gt-sem{display:flex;flex-direction:column;gap:3px;margin-top:6px;min-width:0}',
  '#view-gente .gt-li{display:flex;gap:8px;align-items:baseline;min-width:0;font-size:.75rem;line-height:1.4}',
  '#view-gente .gt-li .q{flex:0 0 3.4rem;font-family:var(--mono);font-size:.6875rem;color:var(--muted)}',
  '#view-gente .gt-li.hoje .q{color:var(--accent-ink);font-weight:600}',
  '#view-gente .gt-li .tt{flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink-2)}',
  '#view-gente .gt-li.mais .tt{color:var(--muted)}',
  '#view-gente .gt-aj{position:absolute;right:6px;top:8px;width:30px;height:30px;border-radius:8px;color:var(--muted);font-size:1.125rem;line-height:1;display:inline-flex;align-items:center;justify-content:center}',
  '#view-gente .gt-aj:hover{background:var(--surface-2);color:var(--ink)}',
  '#view-gente .gt-pref{font-size:.75rem;color:var(--ink-2);margin-top:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
  /* prestadores: cartoes baixos, so nome e email */
  '#view-gente .gt-cards.pr{grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:8px}',
  '#view-gente .gt-card.pr{align-items:center;padding:10px 12px;gap:10px}',
  '#view-gente .gt-card.pr .gt-av{width:32px;height:32px;font-size:.6875rem;background:var(--line-soft)!important;color:var(--ink-2)}',
  '#view-gente .gt-card.pr .gt-t b{padding-right:0;font-size:.875rem}',
  '#view-gente .gt-card.pr .gt-t small{white-space:nowrap}',
  /* cuidados: um cartao por pessoa, lado a lado */
  '#view-gente .gt-cuids{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:12px}',
  '#view-gente .gt-cuid{border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden;min-width:0}',
  '#view-gente .gt-cuid h4{margin:0;padding:12px 14px;font-size:.875rem;font-weight:600;display:flex;align-items:center;gap:10px}',
  '#view-gente .gt-cuid h4 .gt-av{width:28px;height:28px;font-size:.625rem}',
  '#view-gente .gt-cuid h4 .gt-cv{margin-left:auto;font-weight:400;font-size:.75rem;color:var(--muted)}',
  '#view-gente .gt-it{font:inherit;width:100%;text-align:left;display:flex;align-items:center;gap:12px;padding:10px 14px;border:none;border-top:1px solid var(--line-soft);background:none;color:var(--ink);cursor:pointer;min-height:48px}',
  '#view-gente .gt-it:hover{background:var(--surface-2)}',
  '#view-gente .gt-q{flex:none;width:64px;font-family:var(--mono);font-size:.75rem;color:var(--muted)}',
  '#view-gente .gt-q.atr{color:var(--bad)}',
  '#view-gente .gt-it .gt-tt{flex:1;min-width:0;font-size:.875rem}',
  '#view-gente .gt-it .gt-tt small{display:block;color:var(--muted);font-size:.75rem}',
  '#view-gente .gt-resp{flex:none;font-size:.75rem;padding:3px 9px;border-radius:999px;background:var(--line-soft);color:var(--ink-2);white-space:nowrap;max-width:40%;overflow:hidden;text-overflow:ellipsis}',
  '#view-gente .gt-resp.falta{background:var(--warn-soft,#fbebd0);color:var(--warn,#7a4a06);font-weight:500}',
  '#view-gente .gt-vazio{color:var(--muted);font-size:.8125rem;padding:10px 14px;margin:0;border-top:1px solid var(--line-soft)}',
  '#view-gente .gt-nota{color:var(--muted);font-size:.8125rem;margin:10px 2px 0}',
  '#view-gente .gt-mostrar{font-size:.8125rem;text-decoration:underline;color:var(--muted);margin-left:4px}',
  '#gtDlg .gt-f{padding:22px;display:flex;flex-direction:column;gap:14px}',
  '#gtDlg .gt-f h2{margin:0;font-size:1.25rem;font-weight:700}',
  '#gtDlg .gt-f label{display:flex;flex-direction:column;gap:6px;font-size:.8125rem;font-weight:500;color:var(--ink-2)}',
  '#gtDlg .gt-f select,#gtDlg .gt-f textarea{font:inherit;font-size:.9375rem;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 12px}',
  '#gtDlg .gt-f textarea{min-height:120px;resize:vertical}',
  '#gtDlg .gt-f small{color:var(--muted);font-weight:400}',
  '#gtDlg .gt-acoes{display:flex;gap:10px;justify-content:flex-end}',
  '#gtDlg .gt-acoes .btn{min-height:44px;padding:0 18px}',
  '#gtDlg .gt-erro{color:var(--bad);font-size:.875rem;margin:0}'
].join('\n');

var GT_TIPO = { adulto: 'Adulto', crianca: 'Criança', familiar: 'Família', animal: 'Animal' };

function gtEstilo(){
  if (document.getElementById('gtCss')) return;
  var st = document.createElement('style'); st.id = 'gtCss'; st.textContent = GT_CSS;
  document.head.appendChild(st);
}

function gtMontar(){
  if (document.getElementById('view-gente')) return;
  gtEstilo();
  if (window.TITLES) TITLES.gente = ['Pessoas', 'Quem conta, e o que tem cada um'];
  var nav = document.getElementById('nav');
  if (nav && !nav.querySelector('[data-view="gente"]')){
    var b = el('button');
    b.dataset.view = 'gente';
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><circle cx="17.5" cy="9.5" r="2.2"/><path d="M16 15c3 0 5 1.6 5 4.5"/></svg>';
    b.appendChild(document.createTextNode(' Pessoas'));
    nav.appendChild(b);
  }
  var sec = el('section', 'view');
  sec.id = 'view-gente';
  var docs = document.getElementById('view-documentos');
  if (docs) docs.parentNode.insertBefore(sec, docs); else document.querySelector('main').appendChild(sec);
}

/* ------------------------------ os dados ------------------------------ */
function gtHojeISO(){ return typeof tfISO === 'function' ? tfISO(tfHoje()) : new Date().toISOString().slice(0, 10); }
function gtMaisDias(iso, n){
  var p = iso.split('-').map(Number);
  var d = new Date(p[0], p[1] - 1, p[2] + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function gtPessoa(id){ return ((window.G && G.people) || []).filter(function(p){ return p.id === id; })[0] || null; }
function gtAberta(t){ return t.status !== 'concluida' && t.status !== 'cancelada' && !t.done; }
function gtTipoT(t){ return typeof tfTipo === 'function' ? tfTipo(t) : (t.tipo || 'tarefa'); }

/* O circulo e os cuidados vem do tipo da pessoa, a nao ser que se tenham
   ajustado a mao (colunas circulo e cuidados; NULL = automatico). */
var GT_CIRC = [['agregado', 'Agregado — vive na casa'], ['alargada', 'Família alargada'], ['amigos', 'Amigos e próximos'], ['escondido', 'Não mostrar aqui']];
function gtCircAuto(p){ return p.kind === 'familiar' ? 'alargada' : 'agregado'; }
function gtCirculo(p){ return p.circulo || gtCircAuto(p); }
function gtCuidAuto(p){ return p.kind === 'familiar' && !p.can_own_tasks; }
function gtCuidados(p){ return p.cuidados === true || p.cuidados === false ? p.cuidados : gtCuidAuto(p); }

/* O que uma pessoa tem entre dois dias: tarefas (de que e responsavel ou
   por causa de quem) e eventos em que esta. Com «atrasadas», tambem o que
   tinha prazo antes e ainda nao se fez. */
function gtCoisas(pid, de, ate, atrasadas){
  var out = [];
  ((window.G && G.tasks) || []).forEach(function(t){
    if (t.parent_id || !gtAberta(t) || !t.due_on) return;
    var tipo = gtTipoT(t);
    if (tipo === 'nota') return;
    var dela = t.owner_id === pid || (t.subjects || []).indexOf(pid) >= 0;
    if (!dela) return;
    var dentro = t.due_on >= de && t.due_on <= ate;
    var atraso = atrasadas && t.due_on < de;
    if (!dentro && !atraso) return;
    out.push({ k: 'tarefa', dia: t.due_on, hora: t.due_time || '', titulo: t.title, t: t, atraso: atraso,
               resp: t.owner_id, tipo: tipo });
  });
  ((window.D && D.events) || []).forEach(function(e){
    if (e.ocupado || e.day < de || e.day > ate) return;
    if ((e.pessoas || []).indexOf(pid) < 0) return;
    out.push({ k: 'evento', dia: e.day, hora: e.at || '', titulo: e.title, e: e, resp: null });
  });
  out.sort(function(a, b){ return a.dia === b.dia ? String(a.hora).localeCompare(String(b.hora)) : (a.dia < b.dia ? -1 : 1); });
  return out;
}

function gtQuando(iso, hoje){
  if (iso === hoje) return 'hoje';
  if (iso === gtMaisDias(hoje, 1)) return 'amanhã';
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  var ms = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return m ? Number(m[3]) + ' ' + ms[Number(m[2]) - 1] : iso;
}

function gtAbrir(x){
  if (x.k === 'tarefa' && typeof avAbrir === 'function'){
    avAbrir({ origem: 'tarefa', id: x.t.id, quando: x.t.due_on, title: x.t.title, detail: '' });
  } else if (x.k === 'evento'){
    if (typeof evAbrirId === 'function' && typeof x.e.id === 'number') evAbrirId(x.e.id);
    else if (typeof evJanela === 'function') evJanela(x.e);
  }
}

/* ------------------------------ o desenho ------------------------------ */
function gtAvatar(p){
  var av = el('span', 'gt-av');
  av.style.background = p.color || 'var(--c1)';
  if (typeof aeTemFoto === 'function' && aeTemFoto(p.id)){
    var img = el('img'); img.alt = ''; img.src = '/api/pessoas/' + p.id + '/avatar'; av.appendChild(img);
  } else av.textContent = p.initials || String(p.name || '?').slice(0, 2).toUpperCase();
  return av;
}

function gtCartao(p, hoje, fim){
  var b = el('button', 'gt-card');
  b.type = 'button';
  b.dataset.ficha = p.id;
  b.title = 'Abrir a ficha de ' + p.name;
  b.appendChild(gtAvatar(p));
  var t = el('span', 'gt-t');
  t.appendChild(el('b', null, p.name));
  var meta = el('span', 'gt-meta');
  meta.appendChild(el('small', null, p.role || GT_TIPO[p.kind] || ''));
  if (gtCuidados(p)) meta.appendChild(el('span', 'gt-tag', 'Cuidados'));
  t.appendChild(meta);
  var semana = gtCoisas(p.id, hoje, fim, false);
  var abertas = ((window.G && G.tasks) || []).filter(function(x){
    return !x.parent_id && gtAberta(x) && gtTipoT(x) !== 'nota' && x.owner_id === p.id;
  }).length;
  var num = el('span', 'gt-num');
  if (p.can_own_tasks){
    num.appendChild(el('b', null, String(abertas)));
    num.appendChild(document.createTextNode(abertas === 1 ? ' por fazer · ' : ' por fazer · '));
  }
  if (semana.length){
    num.appendChild(el('b', null, String(semana.length)));
    num.appendChild(document.createTextNode(' esta semana'));
  } else num.appendChild(document.createTextNode('nada esta semana'));
  t.appendChild(num);
  if (semana.length){
    var s = el('span', 'gt-sem');
    semana.slice(0, 3).forEach(function(x){
      var li = el('span', 'gt-li' + (x.dia === hoje ? ' hoje' : ''));
      li.appendChild(el('span', 'q', gtQuando(x.dia, hoje)));
      li.appendChild(el('span', 'tt', x.titulo));
      li.title = x.titulo;
      s.appendChild(li);
    });
    if (semana.length > 3){
      var mais = el('span', 'gt-li mais');
      mais.appendChild(el('span', 'q', ''));
      mais.appendChild(el('span', 'tt', '+ ' + (semana.length - 3) + ' esta semana'));
      s.appendChild(mais);
    }
    t.appendChild(s);
  }
  if (p.preferencias) t.appendChild(el('span', 'gt-pref', '♥ ' + p.preferencias));
  b.appendChild(t);
  var w = el('div', 'gt-cw');
  w.appendChild(b);
  var aj = el('button', 'gt-aj', '⋯');
  aj.type = 'button';
  aj.title = 'Círculo, cuidados e preferências de ' + p.name;
  aj.setAttribute('aria-label', aj.title);
  aj.addEventListener('click', function(ev){ ev.stopPropagation(); gtAjustar(p); });
  w.appendChild(aj);
  return w;
}

/* ------------------------------ ajustar ------------------------------ */
function gtAjustar(p){
  if (!GT.dlg){
    GT.dlg = el('dialog', 'folha');
    GT.dlg.id = 'gtDlg';
    document.body.appendChild(GT.dlg);
  }
  var d = GT.dlg;
  clear(d);
  var f = el('form', 'gt-f');
  f.method = 'dialog';
  f.appendChild(el('h2', null, p.name));

  var l1 = el('label', null, 'Círculo');
  var s1 = el('select');
  var auto = GT_CIRC.filter(function(x){ return x[0] === gtCircAuto(p); })[0];
  var o0 = el('option', null, 'Automático (' + auto[1].split(' — ')[0] + ')'); o0.value = ''; s1.appendChild(o0);
  GT_CIRC.forEach(function(x){ var o = el('option', null, x[1]); o.value = x[0]; s1.appendChild(o); });
  s1.value = p.circulo || '';
  l1.appendChild(s1); f.appendChild(l1);

  var l2 = el('label', null, 'Cuidados');
  var s2 = el('select');
  [['', 'Automático (' + (gtCuidAuto(p) ? 'sim' : 'não') + ')'], ['sim', 'Sim — mostrar o que vem aí e quem trata'], ['nao', 'Não']].forEach(function(x){
    var o = el('option', null, x[1]); o.value = x[0]; s2.appendChild(o);
  });
  s2.value = p.cuidados === true ? 'sim' : p.cuidados === false ? 'nao' : '';
  l2.appendChild(s2); f.appendChild(l2);

  var l3 = el('label', null, 'Preferências');
  l3.appendChild(el('small', null, 'Gostos, tamanhos, ideias de presentes, o que evitar…'));
  var ta = el('textarea');
  ta.value = p.preferencias || '';
  ta.maxLength = 2000;
  l3.appendChild(ta); f.appendChild(l3);

  var erro = el('p', 'gt-erro'); erro.hidden = true; f.appendChild(erro);
  var ac = el('div', 'gt-acoes');
  var cancelar = el('button', 'btn', 'Cancelar'); cancelar.type = 'button';
  cancelar.addEventListener('click', function(){ d.close(); });
  var gravar = el('button', 'btn primary', 'Guardar'); gravar.type = 'submit';
  ac.appendChild(cancelar); ac.appendChild(gravar); f.appendChild(ac);
  f.addEventListener('submit', function(ev){
    ev.preventDefault();
    gravar.disabled = true; gravar.textContent = 'A guardar…'; erro.hidden = true;
    var corpo = { circulo: s1.value || null, cuidados: s2.value === 'sim' ? true : s2.value === 'nao' ? false : null, preferencias: ta.value };
    apiGestao('/api/pessoas/' + p.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) })
      .then(function(){
        p.circulo = corpo.circulo; p.cuidados = corpo.cuidados; p.preferencias = corpo.preferencias.trim() || null;
        d.close();
        gtRender();
        if (typeof loadGestao === 'function') loadGestao();
      })
      .catch(function(e){ erro.textContent = (e && e.message) || 'Não foi possível guardar.'; erro.hidden = false; gravar.disabled = false; gravar.textContent = 'Guardar'; });
  });
  d.appendChild(f);
  d.showModal();
}

function gtBlocoCuidados(box, cuidar, hoje){
  if (!cuidar.length) return;
  var bl = el('div', 'gt-bloco');
  var h = el('div', 'gt-h');
  h.appendChild(el('h3', null, 'Cuidados'));
  bl.dataset.salto = 'Cuidados';
  var fim = gtMaisDias(hoje, 30);
  var semResp = 0;
  var porPessoa = cuidar.map(function(p){
    var lista = gtCoisas(p.id, hoje, fim, true);
    lista.forEach(function(x){ if (x.k === 'tarefa' && x.resp == null) semResp++; });
    return { p: p, lista: lista };
  });
  h.appendChild(el('span', null, 'próximos 30 dias' + (semResp ? ' · ' + semResp + ' sem responsável' : '')));
  bl.appendChild(h);
  var grade = el('div', 'gt-cuids');
  bl.appendChild(grade);
  porPessoa.forEach(function(pp){
    var c = el('div', 'gt-cuid');
    var t = el('h4');
    t.appendChild(gtAvatar(pp.p));
    var nome = el('span', null, pp.p.name);
    nome.dataset.ficha = pp.p.id;
    nome.style.cursor = 'pointer';
    t.appendChild(nome);
    t.appendChild(el('span', 'gt-cv', pp.lista.length ? pp.lista.length + (pp.lista.length === 1 ? ' coisa' : ' coisas') : 'nada marcado'));
    c.appendChild(t);
    pp.lista.forEach(function(x){
      var it = el('button', 'gt-it');
      it.type = 'button';
      it.appendChild(el('span', 'gt-q' + (x.atraso ? ' atr' : ''), x.atraso ? 'atrasado' : gtQuando(x.dia, hoje)));
      var tt = el('span', 'gt-tt', x.titulo);
      tt.appendChild(el('small', null, x.k === 'evento' ? ('Evento' + (x.hora ? ' · ' + x.hora : '')) : ({ tarefa: 'Tarefa', pagamento: 'Pagamento', lembrete: 'Lembrete' }[x.tipo] || 'Tarefa')));
      it.appendChild(tt);
      if (x.k === 'tarefa'){
        var r = x.resp != null ? gtPessoa(x.resp) : null;
        it.appendChild(el('span', 'gt-resp' + (r ? '' : ' falta'), r ? r.name : 'Sem responsável'));
      } else {
        var quem = (x.e.pessoas || []).filter(function(id){ return id !== pp.p.id; }).map(gtPessoa).filter(Boolean)
          .map(function(q){ return q.name.split(' ')[0]; });
        it.appendChild(el('span', 'gt-resp' + (quem.length ? '' : ' falta'), quem.length ? quem.join(', ') : 'Ninguém a acompanhar'));
      }
      it.addEventListener('click', function(){ gtAbrir(x); });
      c.appendChild(it);
    });
    grade.appendChild(c);
  });
  bl.appendChild(el('p', 'gt-nota', 'O responsável muda-se ao abrir a tarefa. Num evento, quem acompanha são as pessoas marcadas nele.'));
  box.appendChild(bl);
}

function gtBlocoCirculo(box, titulo, sub, pessoas, hoje, fim){
  if (!pessoas.length) return;
  var bl = el('div', 'gt-bloco');
  var h = el('div', 'gt-h');
  h.appendChild(el('h3', null, titulo));
  h.appendChild(el('span', null, sub));
  bl.dataset.salto = titulo;
  bl.appendChild(h);
  var g = el('div', 'gt-cards');
  pessoas.forEach(function(p){ g.appendChild(gtCartao(p, hoje, fim)); });
  bl.appendChild(g);
  box.appendChild(bl);
}

function gtBlocoPrestadores(box){
  if (GT.destinatarios === null){
    if (!GT.aLerDest && typeof apiGestao === 'function'){
      GT.aLerDest = true;
      apiGestao('/api/destinatarios').then(function(d){ GT.destinatarios = (d.destinatarios || []).filter(function(x){ return x.ativo !== false; }); })
        .catch(function(){ GT.destinatarios = []; })
        .then(function(){ GT.aLerDest = false; gtRender(); });
    }
    return;
  }
  if (!GT.destinatarios.length) return;
  var bl = el('div', 'gt-bloco');
  var h = el('div', 'gt-h');
  h.appendChild(el('h3', null, 'Prestadores'));
  bl.dataset.salto = 'Prestadores';
  h.appendChild(el('span', null, 'a quem se mandam os emails dos pagamentos'));
  bl.appendChild(h);
  var g = el('div', 'gt-cards pr');
  GT.destinatarios.forEach(function(d){
    var b = el('button', 'gt-card pr');
    b.type = 'button';
    b.title = [d.nome, d.email].filter(Boolean).join(' — ');
    /* Iniciais das duas primeiras palavras, sem o que vem entre parenteses. */
    var pal = String(d.nome || '?').replace(/\(.*?\)/g, ' ').trim().split(/\s+/);
    var ini = (pal[0] || '?').charAt(0) + (pal.length > 1 ? pal[pal.length - 1].charAt(0) : '');
    var av = el('span', 'gt-av', ini.toUpperCase());
    b.appendChild(av);
    var t = el('span', 'gt-t');
    t.appendChild(el('b', null, d.nome));
    t.appendChild(el('small', null, d.email || ''));
    b.appendChild(t);
    b.addEventListener('click', function(){ show('destinatarios'); });
    g.appendChild(b);
  });
  bl.appendChild(g);
  box.appendChild(bl);
}

function gtRender(){
  var sec = document.getElementById('view-gente');
  if (!sec || !window.G || !G.people) return;
  var y = window.scrollY;
  clear(sec);
  var hoje = gtHojeISO();
  var fim = gtMaisDias(hoje, 6);
  var ativas = G.people.filter(function(p){ return p.active !== false; });
  var cuidar = ativas.filter(gtCuidados);
  gtBlocoCuidados(sec, cuidar, hoje);
  var deC = function(c){ return ativas.filter(function(p){ return gtCirculo(p) === c; }); };
  gtBlocoCirculo(sec, 'Agregado', 'quem vive na casa', deC('agregado'), hoje, fim);
  gtBlocoCirculo(sec, 'Família alargada', 'não vive na casa', deC('alargada'), hoje, fim);
  gtBlocoCirculo(sec, 'Amigos e próximos', 'quem conta, fora da família', deC('amigos'), hoje, fim);
  var escondidas = deC('escondido');
  if (escondidas.length && GT.verEscondidos) gtBlocoCirculo(sec, 'Não mostradas', 'escondidas daqui com ⋯', escondidas, hoje, fim);
  gtBlocoPrestadores(sec);
  var inativas = G.people.length - ativas.length;
  var notas = [];
  if (inativas) notas.push(inativas + (inativas === 1 ? ' pessoa desativada' : ' pessoas desativadas') + ' em Administração › Pessoas.');
  if (escondidas.length) notas.push(escondidas.length + (escondidas.length === 1 ? ' pessoa escondida daqui.' : ' pessoas escondidas daqui.'));
  if (notas.length){
    var pn = el('p', 'gt-nota', notas.join(' '));
    if (escondidas.length){
      var mb = el('button', 'gt-mostrar', GT.verEscondidos ? 'Esconder' : 'Mostrar');
      mb.type = 'button';
      mb.addEventListener('click', function(){ GT.verEscondidos = !GT.verEscondidos; gtRender(); });
      pn.appendChild(mb);
    }
    sec.appendChild(pn);
  }
  var ajuda = el('p', 'gt-nota', 'O círculo, os cuidados e as preferências de cada pessoa ajustam-se no ⋯ do cartão.');
  sec.appendChild(ajuda);
  /* No telemovel: uma fila de botoes para saltar para cada bloco (tema.css). */
  var blocos = sec.querySelectorAll('[data-salto]');
  if (blocos.length > 1){
    var saltos = el('div', 'tm-saltos');
    Array.prototype.forEach.call(blocos, function(b){
      var bt = el('button', null, b.dataset.salto === 'Família alargada' ? 'Família' : b.dataset.salto);
      bt.type = 'button';
      bt.addEventListener('click', function(){ b.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      saltos.appendChild(bt);
    });
    sec.insertBefore(saltos, sec.firstChild);
  }
  if (sec.classList.contains('is-active')) window.scrollTo(0, y);
}

/* ------------------------------ ligacoes ------------------------------ */
function gtLigar(){
  gtMontar();
  if (typeof window.show === 'function' && !window.show.gtEmbrulhado){
    var antes = window.show;
    var novo = function(v){ var r = antes.apply(this, arguments); if (v === 'gente') { try { gtRender(); } catch (e) { console.error('[farol] pessoas', e); } } return r; };
    for (var k in antes) if (Object.prototype.hasOwnProperty.call(antes, k)) novo[k] = antes[k];
    novo.gtEmbrulhado = true;
    window.show = novo;
  }
  ['renderGestao', 'renderAll'].forEach(function(nome){
    var f = window[nome];
    if (typeof f !== 'function' || f.gtEmbrulhado) return;
    var n = function(){ var r = f.apply(this, arguments); try { if (document.getElementById('view-gente')) gtRender(); } catch (e) { console.error('[farol] pessoas', e); } return r; };
    n.gtEmbrulhado = true;
    window[nome] = n;
  });
  gtRender();
}

(function gtEsperar(n){
  if (document.getElementById('nav') && typeof el === 'function' && typeof show === 'function' && window.G){
    try { gtLigar(); } catch (e) { console.error('[farol] pessoas', e); }
    return;
  }
  if (n < 60) setTimeout(function(){ gtEsperar(n + 1); }, 250);
})(0);
