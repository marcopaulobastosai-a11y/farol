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
 * Cada cartao abre a ficha (data-ficha). Nao toca na base de dados nem nos
 * outros modulos. So aparece com o menu novo ligado.
 */

var GT = { destinatarios: null, aLerDest: false };

var GT_CSS = [
  '#nav button[data-view="gente"]{display:none}',
  'body.mn-on #nav button[data-view="gente"]{display:flex}',
  '#view-gente .gt-bloco{margin-bottom:18px}',
  '#view-gente .gt-h{display:flex;align-items:baseline;gap:10px;margin:0 0 10px}',
  '#view-gente .gt-h h3{margin:0;font-size:1rem;font-weight:500}',
  '#view-gente .gt-h span{color:var(--muted);font-size:.8125rem}',
  '#view-gente .gt-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}',
  '#view-gente .gt-card{font:inherit;text-align:left;display:flex;gap:12px;align-items:flex-start;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);cursor:pointer;min-height:64px}',
  '#view-gente .gt-card:hover{border-color:var(--accent)}',
  '#view-gente .gt-av{width:40px;height:40px;border-radius:50%;flex:none;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-family:var(--mono);font-size:.8125rem;overflow:hidden}',
  '#view-gente .gt-av img{width:100%;height:100%;object-fit:cover}',
  '#view-gente .gt-t{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}',
  '#view-gente .gt-t b{font-weight:500}',
  '#view-gente .gt-t small{color:var(--muted);font-size:.75rem}',
  '#view-gente .gt-sem{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}',
  '#view-gente .gt-sem span{font-size:.6875rem;padding:2px 8px;border-radius:999px;background:var(--line-soft);color:var(--ink-2)}',
  '#view-gente .gt-sem span.hoje{background:var(--accent-soft);color:var(--accent-ink)}',
  '#view-gente .gt-tag{font-size:.6875rem;font-weight:500;padding:2px 8px;border-radius:6px;background:var(--accent-soft);color:var(--accent-ink);margin-left:auto;align-self:flex-start;white-space:nowrap}',
  '#view-gente .gt-cuid{border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden}',
  '#view-gente .gt-cuid h4{margin:0;padding:12px 14px 6px;font-size:.875rem;font-weight:500;display:flex;align-items:center;gap:8px}',
  '#view-gente .gt-cuid + .gt-cuid{margin-top:10px}',
  '#view-gente .gt-it{font:inherit;width:100%;text-align:left;display:flex;align-items:center;gap:12px;padding:10px 14px;border:none;border-top:1px solid var(--line-soft);background:none;color:var(--ink);cursor:pointer;min-height:48px}',
  '#view-gente .gt-it:hover{background:var(--surface-2)}',
  '#view-gente .gt-q{flex:none;width:64px;font-family:var(--mono);font-size:.75rem;color:var(--muted)}',
  '#view-gente .gt-q.atr{color:var(--bad)}',
  '#view-gente .gt-it .gt-tt{flex:1;min-width:0}',
  '#view-gente .gt-it .gt-tt small{display:block;color:var(--muted);font-size:.75rem}',
  '#view-gente .gt-resp{flex:none;font-size:.75rem;padding:3px 9px;border-radius:999px;background:var(--line-soft);color:var(--ink-2);white-space:nowrap}',
  '#view-gente .gt-resp.falta{background:var(--warn-soft,#fbebd0);color:var(--warn,#7a4a06);font-weight:500}',
  '#view-gente .gt-vazio{color:var(--muted);font-size:.8125rem;padding:10px 14px;margin:0;border-top:1px solid var(--line-soft)}',
  '#view-gente .gt-nota{color:var(--muted);font-size:.8125rem;margin:8px 2px 0}'
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
  t.appendChild(el('small', null, p.role || GT_TIPO[p.kind] || ''));
  var semana = gtCoisas(p.id, hoje, fim, false);
  var abertas = ((window.G && G.tasks) || []).filter(function(x){
    return !x.parent_id && gtAberta(x) && gtTipoT(x) !== 'nota' && x.owner_id === p.id;
  }).length;
  var linha = [];
  if (p.can_own_tasks) linha.push(abertas + (abertas === 1 ? ' tarefa por fazer' : ' tarefas por fazer'));
  linha.push(semana.length ? semana.length + ' esta semana' : 'nada esta semana');
  t.appendChild(el('small', null, linha.join(' · ')));
  if (semana.length){
    var s = el('span', 'gt-sem');
    semana.slice(0, 3).forEach(function(x){
      s.appendChild(el('span', x.dia === hoje ? 'hoje' : '', gtQuando(x.dia, hoje) + ' · ' + x.titulo));
    });
    if (semana.length > 3) s.appendChild(el('span', null, '+' + (semana.length - 3)));
    t.appendChild(s);
  }
  b.appendChild(t);
  if (!p.can_own_tasks && p.kind === 'familiar') b.appendChild(el('span', 'gt-tag', 'Cuidados'));
  return b;
}

function gtBlocoCuidados(box, cuidar, hoje){
  if (!cuidar.length) return;
  var bl = el('div', 'gt-bloco');
  var h = el('div', 'gt-h');
  h.appendChild(el('h3', null, 'Cuidados'));
  var fim = gtMaisDias(hoje, 30);
  var semResp = 0;
  var porPessoa = cuidar.map(function(p){
    var lista = gtCoisas(p.id, hoje, fim, true);
    lista.forEach(function(x){ if (x.k === 'tarefa' && x.resp == null) semResp++; });
    return { p: p, lista: lista };
  });
  h.appendChild(el('span', null, 'próximos 30 dias' + (semResp ? ' · ' + semResp + ' sem responsável' : '')));
  bl.appendChild(h);
  porPessoa.forEach(function(pp){
    var c = el('div', 'gt-cuid');
    var t = el('h4');
    t.appendChild(gtAvatar(pp.p));
    t.lastChild.style.width = '26px'; t.lastChild.style.height = '26px'; t.lastChild.style.fontSize = '.625rem';
    var nome = el('span', null, pp.p.name);
    nome.dataset.ficha = pp.p.id;
    nome.style.cursor = 'pointer';
    t.appendChild(nome);
    c.appendChild(t);
    if (!pp.lista.length) c.appendChild(el('p', 'gt-vazio', 'Nada marcado nos próximos 30 dias.'));
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
    bl.appendChild(c);
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
  h.appendChild(el('span', null, 'a quem se mandam os emails dos pagamentos'));
  bl.appendChild(h);
  var g = el('div', 'gt-cards');
  GT.destinatarios.forEach(function(d){
    var b = el('button', 'gt-card');
    b.type = 'button';
    var av = el('span', 'gt-av', String(d.nome || '?').slice(0, 2).toUpperCase());
    av.style.background = 'var(--muted)';
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
  var cuidar = ativas.filter(function(p){ return p.kind === 'familiar' && !p.can_own_tasks; });
  gtBlocoCuidados(sec, cuidar, hoje);
  gtBlocoCirculo(sec, 'Agregado', 'quem vive na casa',
    ativas.filter(function(p){ return p.kind === 'adulto' || p.kind === 'crianca' || p.kind === 'animal'; }), hoje, fim);
  gtBlocoCirculo(sec, 'Família alargada', 'não vive na casa',
    ativas.filter(function(p){ return p.kind === 'familiar'; }), hoje, fim);
  gtBlocoPrestadores(sec);
  var inativas = G.people.length - ativas.length;
  if (inativas) sec.appendChild(el('p', 'gt-nota', inativas + (inativas === 1 ? ' pessoa desativada' : ' pessoas desativadas') + ' em Administração › Pessoas.'));
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
