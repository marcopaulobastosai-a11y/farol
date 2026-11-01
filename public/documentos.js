'use strict';
/* Farol - os Documentos por categorias (1 nov 2026).
 *
 * A tabela corrida deu lugar a um arquivo: o tipo que cada papel ja tem
 * (fatura, comprovativo, cartao...) arruma-o numa de nove pastas. Por cima,
 * quatro numeros do que pede atencao e a faixa dos prazos; ao centro, as
 * pastas, a lista agrupada por categoria e mes, ou tudo por data; ao lado, a
 * ficha do papel escolhido com as accoes que antes eram cinco botoes por
 * linha.
 *
 * Substitui o renderDocumentos do app.js, mas usa as mesmas pecas: os
 * filtros DOCS_AREA / DOCS_PESSOA / DOCS_ARQ, o editarDocumento,
 * arquivarDocumento, apagarDocumento, anexarDocumento, marcarLido e o
 * relAbrir. O mesmo miolo serve a pagina Documentos de cada area (o
 * area-tarefas.js empresta-o), e o cartao de papeis da visao geral de um bem
 * passa a ter as categorias.
 */

var DC = { vista: 'pastas', cat: null, att: null, q: '', sel: null };
try { var _dcG = JSON.parse(localStorage.getItem('dcEstado') || '{}'); if (_dcG.vista) DC.vista = _dcG.vista; } catch (e) {}
function dcGuardar(){ try { localStorage.setItem('dcEstado', JSON.stringify({ vista: DC.vista })); } catch (e) {} }

var DC_ICO = {
  id: '<path d="M3 6h18v12H3z"/><circle cx="9" cy="12" r="2.2"/><path d="M14 10h4M14 14h3"/>',
  fat: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  comp: '<path d="M4 12l5 5L20 6"/>',
  con: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 13h7M9 17h4"/><path d="M14 3v5h5"/>',
  cert: '<circle cx="12" cy="9" r="5"/><path d="M9 13l-2 8 5-3 5 3-2-8"/>',
  imo: '<path d="M3 11l9-7 9 7v10H3z"/><path d="M9 21v-6h6v6"/>',
  sau: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  out: '<path d="M4 7h16v12H4z"/><path d="M4 7l8 6 8-6"/>',
  sem: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.01"/>',
  todos: '<path d="M3 7h7l2 2h9v10H3z"/>',
  procura: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  abrir: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>'
};
/* As pastas. `kinds` e o documents.kind sem acentos e em minusculas; um tipo
   que nao esta em lado nenhum vai para «Correspondencia e outros», e um papel
   sem tipo fica em «Sem categoria» ate se dizer o que e. */
var DC_CATS = [
  { k: 'id', n: 'Identificação', d: 'Cartões, NIF, passaporte, carta', kinds: ['cartao', 'passaporte', 'identificacao', 'carta de conducao'], cor: '#3D63B8' },
  { k: 'fat', n: 'Faturas e recibos', d: 'O que se pagou ou falta pagar', kinds: ['fatura', 'factura', 'recibo', 'nota de credito'], cor: '#B0702A' },
  { k: 'comp', n: 'Comprovativos', d: 'Transferências e pagamentos', kinds: ['comprovativo'], cor: '#2E7A55' },
  { k: 'con', n: 'Contratos e seguros', d: 'Contratos, propostas, apólices', kinds: ['contrato', 'proposta', 'seguro', 'apolice', 'cpcv', 'orcamento'], cor: '#7A4FB0' },
  { k: 'cert', n: 'Certidões e declarações', d: 'Certidões, declarações, autos', kinds: ['certidao', 'declaracao', 'auto', 'licenca'], cor: '#0F7A6C' },
  { k: 'imo', n: 'Imóveis', d: 'Escrituras, cadernetas, plantas', kinds: ['escritura', 'caderneta', 'planta', 'registo predial'], cor: '#8A6A3A' },
  { k: 'sau', n: 'Saúde', d: 'Exames, análises, relatórios', kinds: ['exame', 'analises', 'receita', 'relatorio medico'], cor: '#C04F5C' },
  { k: 'out', n: 'Correspondência e outros', d: 'Cartas, avisos, o resto', kinds: ['outro', 'correspondencia', 'carta'], cor: '#6B7385' },
  { k: 'sem', n: 'Sem categoria', d: 'Falta dizer o que são', kinds: [], cor: '#A93A38' }
];
var DC_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

var DC_CSS = [
  '.dc{display:flex;flex-direction:column;gap:14px}',
  '.dc .lbl{font-family:var(--mono);font-size:.625rem;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}',
  '.dc-att{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}',
  '.dc-att button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:10px 14px;cursor:pointer;font:inherit;color:var(--ink)}',
  '.dc-att button:hover,.dc-att button.on{border-color:var(--ink)}',
  '.dc-att b{font-family:var(--mono);font-size:1.25rem;font-weight:500;font-variant-numeric:tabular-nums}',
  '.dc-att span{font-size:.75rem;color:var(--muted)}',
  '.dc-att .w b{color:var(--warn)} .dc-att .r b{color:var(--bad)}',
  '.dc-ren{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px}',
  '.dc-ren-h{display:flex;align-items:center;gap:10px;margin-bottom:10px}',
  '.dc-ren-h h3{margin:0;font-size:.9375rem}',
  '.dc-ren-l{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}',
  '.dc-rc{flex:none;width:220px;border:1px solid var(--line-soft);border-radius:10px;padding:9px 11px;display:flex;flex-direction:column;align-items:flex-start;gap:3px;background:var(--surface-2);cursor:pointer;text-align:left;font:inherit;color:var(--ink)}',
  '.dc-rc:hover{border-color:var(--ink-2)}',
  '.dc-rc .t{font-weight:600;font-size:.8125rem;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dc-rc .m{font-size:.72rem;color:var(--muted);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dc-pill{display:inline-flex;align-items:center;gap:4px;font-family:var(--mono);font-size:.66rem;padding:2px 7px;border-radius:999px;white-space:nowrap}',
  '.dc-pill.warn{background:var(--warn-soft);color:var(--warn)}',
  '.dc-pill.bad{background:var(--bad-soft);color:var(--bad)}',
  '.dc-pill.good{background:var(--good-soft);color:var(--good)}',
  '.dc-pill.mut{background:var(--surface-2);color:var(--muted);border:1px solid var(--line-soft)}',
  '.dc-arq{display:grid;grid-template-columns:220px minmax(0,1fr);gap:14px;align-items:start}',
  '.dc-arq.det{grid-template-columns:220px minmax(0,1fr) 330px}',
  '.dc-side{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:10px;position:sticky;top:12px;display:flex;flex-direction:column;gap:2px}',
  '.dc-side .lbl{padding:8px 8px 4px}',
  '.dc-cat{display:flex;align-items:center;gap:9px;width:100%;border:0;background:none;text-align:left;padding:7px 8px;border-radius:8px;cursor:pointer;font:inherit;font-size:.8125rem;color:var(--ink)}',
  '.dc-cat:hover{background:var(--surface-2)}',
  '.dc-cat.on{background:var(--accent-soft);font-weight:700}',
  '.dc-cat i,.dc-tile-h i,.dc-grp-h i,.dc-wcats i{border-radius:6px;flex:none;display:inline-flex;align-items:center;justify-content:center}',
  '.dc-cat i{width:22px;height:22px}',
  '.dc-cat span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dc-cat small{font-family:var(--mono);font-size:.68rem;color:var(--muted);font-variant-numeric:tabular-nums}',
  '.dc-cat em{font-style:normal;font-family:var(--mono);font-size:.62rem;background:var(--warn-soft);color:var(--warn);border-radius:999px;padding:0 6px}',
  '.dc-side hr{border:0;border-top:1px solid var(--line-soft);margin:6px 4px;width:auto}',
  '.dc-side select{width:100%;margin:0 0 4px;border:1px solid var(--line);background:var(--surface-2);color:var(--ink);border-radius:8px;padding:6px 8px;font:inherit;font-size:.8rem}',
  '.dc-main{min-width:0;display:flex;flex-direction:column;gap:12px}',
  '.dc-tool{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
  '.dc-srch{flex:1 1 260px;display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:6px 14px;color:var(--muted)}',
  '.dc-srch input{border:0;background:none;outline:0;font:inherit;color:var(--ink);width:100%;padding:2px 0;min-height:0;box-shadow:none}',
  '.dc-seg{display:inline-flex;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:3px}',
  '.dc-seg button{border:0;background:none;padding:5px 12px;border-radius:999px;font:inherit;font-size:.78rem;font-weight:600;color:var(--muted);cursor:pointer}',
  '.dc-seg button.on{background:var(--ink);color:var(--surface)}',
  '.dc-chips{display:flex;flex-wrap:wrap;gap:6px}',
  '.dc-chip{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:4px 11px;font:inherit;font-size:.75rem;cursor:pointer;color:var(--ink)}',
  '.dc-chip.on{background:var(--ink);border-color:var(--ink);color:var(--surface)}',
  '.dc-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}',
  '.dc-tile{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:10px;font:inherit;color:var(--ink)}',
  '.dc-tile:hover{border-color:var(--ink-2);box-shadow:var(--shadow)}',
  '.dc-tile-h{display:flex;align-items:center;gap:10px;width:100%}',
  '.dc-tile-h i{width:34px;height:34px;border-radius:9px}',
  '.dc-tile-h b{font-size:.9375rem;display:block}',
  '.dc-tile-h small{font-size:.72rem;color:var(--muted)}',
  '.dc-tile-h .n{margin-left:auto;font-family:var(--mono);font-size:1.25rem;font-variant-numeric:tabular-nums}',
  '.dc-tile ul{list-style:none;margin:0;padding:9px 0 0;display:flex;flex-direction:column;gap:5px;border-top:1px solid var(--line-soft);width:100%}',
  '.dc-tile li{display:flex;gap:8px;font-size:.78rem;align-items:baseline}',
  '.dc-tile li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dc-tile li small{font-family:var(--mono);font-size:.66rem;color:var(--faint);white-space:nowrap}',
  '.dc-grp{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}',
  '.dc-grp-h{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line-soft);background:var(--surface-2)}',
  '.dc-grp-h i{width:24px;height:24px;border-radius:7px}',
  '.dc-grp-h b{font-size:.875rem}',
  '.dc-grp-h small{font-family:var(--mono);font-size:.68rem;color:var(--muted)}',
  '.dc-mes{padding:8px 14px 2px;font-family:var(--mono);font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}',
  '.dc-row{display:grid;grid-template-columns:28px minmax(0,1fr) minmax(0,170px) 64px auto 28px;gap:12px;align-items:center;padding:9px 14px;border-top:1px solid var(--line-soft);cursor:pointer;background:var(--surface)}',
  '.dc-mes + .dc-row{border-top:0}',
  '.dc-row:hover{background:var(--surface-2)}',
  '.dc-row.on{background:var(--accent-soft)}',
  '.dc-row:focus-visible,.dc-tile:focus-visible,.dc-cat:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}',
  '.dc-ic{width:26px;height:32px;border-radius:5px;border:1px solid var(--line);position:relative;display:flex;align-items:flex-end;justify-content:center;padding-bottom:3px;background:var(--surface);flex:none}',
  '.dc-ic::before{content:"";position:absolute;top:0;left:0;right:0;height:5px;border-radius:5px 5px 0 0;background:var(--k)}',
  '.dc-ic span{font-family:var(--mono);font-size:.5rem;color:var(--muted)}',
  '.dc-nm{min-width:0}',
  '.dc-nm b{display:flex;align-items:center;gap:6px;font-weight:600;font-size:.84rem;overflow:hidden}',
  '.dc-nm b span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dc-nl{width:7px;height:7px;border-radius:50%;background:var(--warn);flex:none}',
  '.dc-mt{display:flex;gap:6px;align-items:center;font-size:.72rem;color:var(--muted);margin-top:2px;flex-wrap:wrap}',
  '.dc-ref{font-family:var(--mono);font-size:.66rem;color:var(--faint)}',
  '.dc-area{display:inline-flex;align-items:center;gap:5px}',
  '.dc-area i{width:6px;height:6px;border-radius:50%;background:var(--faint)}',
  '.dc-ent{font-size:.75rem;color:var(--ink-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dc-dt{font-family:var(--mono);font-size:.72rem;color:var(--muted);font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}',
  '.dc-st{display:flex;justify-content:flex-end;gap:4px;align-items:center}',
  '.dc-av{width:22px;height:22px;border-radius:50%;color:#fff;font-size:.56rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex:none}',
  '.dc-more{border:0;background:none;color:var(--faint);cursor:pointer;border-radius:6px;width:26px;height:26px;font:inherit;font-size:1rem;line-height:1}',
  '.dc-more:hover{background:var(--line-soft);color:var(--ink)}',
  '.dc-par{display:inline-flex;align-items:center;gap:4px;font-size:.68rem;color:var(--good);background:var(--good-soft);border-radius:999px;padding:1px 7px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dc-par.falta{color:var(--warn);background:var(--warn-soft)}',
  '.dc-par.mut{color:var(--muted);background:var(--surface-2)}',
  '.dc-vazio{padding:28px;text-align:center;color:var(--muted);background:var(--surface);border:1px dashed var(--line);border-radius:var(--radius)}',
  '.dc-mais{border:0;background:none;font:inherit;font-size:.78rem;color:var(--ink-2);padding:9px 14px;width:100%;text-align:left;border-top:1px solid var(--line-soft);cursor:pointer}',
  '.dc-mais:hover{background:var(--surface-2)}',
  '.dc-ficha{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);position:sticky;top:12px;overflow:hidden;display:flex;flex-direction:column;max-height:calc(100vh - 24px)}',
  '.dc-fi-top{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line-soft);background:var(--surface-2)}',
  '.dc-fi-top .dc-ic{width:40px;height:50px}',
  '.dc-fi-top h3{margin:4px 0 0;font-size:1rem;line-height:1.3}',
  '.dc-fi-x{margin-left:auto;border:0;background:none;font-size:1.3rem;line-height:1;color:var(--muted);cursor:pointer;padding:0 4px}',
  '.dc-fi-b{padding:14px 16px;display:flex;flex-direction:column;gap:12px;overflow:auto}',
  '.dc-dl{display:grid;grid-template-columns:92px minmax(0,1fr);gap:6px 10px;font-size:.8rem;margin:0}',
  '.dc-dl dt{color:var(--muted);font-size:.74rem}',
  '.dc-dl dd{margin:0;overflow-wrap:anywhere}',
  '.dc-rel{display:flex;flex-direction:column;gap:6px}',
  '.dc-rel a,.dc-rel div{display:flex;gap:8px;align-items:center;font-size:.78rem;color:var(--ink);text-decoration:none;border:1px solid var(--line-soft);border-radius:8px;padding:7px 9px}',
  '.dc-rel a:hover{border-color:var(--ink-2)}',
  '.dc-acts{display:flex;flex-wrap:wrap;gap:6px;border-top:1px solid var(--line-soft);padding-top:12px}',
  '.dc-acts .del{color:var(--bad)}',
  '.dc-pop{position:fixed;z-index:60;background:var(--surface);border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);padding:5px;display:flex;flex-direction:column;min-width:180px}',
  '.dc-pop button{border:0;background:none;text-align:left;padding:7px 10px;border-radius:7px;font:inherit;font-size:.8rem;cursor:pointer;color:var(--ink)}',
  '.dc-pop button:hover{background:var(--surface-2)}',
  '.dc-pop button.del{color:var(--bad)}',
  '.dc-topo{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
  '.dc-topo .sp{flex:1}',
  /* o cartao da visao geral */
  '.dc-w .dc-wcats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:0 16px 12px}',
  '.dc-wcats button{border:1px solid var(--line-soft);background:var(--surface-2);border-radius:9px;padding:7px 4px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;font:inherit;font-size:.62rem;color:var(--muted);min-width:0}',
  '.dc-wcats button:hover{border-color:var(--ink-2)}',
  '.dc-wcats i{width:24px;height:24px;border-radius:7px}',
  '.dc-wcats b{font-family:var(--mono);font-size:.8rem;color:var(--ink);font-weight:500}',
  '.dc-wcats span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dc-wr{display:flex;gap:10px;align-items:center;padding:8px 16px;border-top:1px solid var(--line-soft);font-size:.78rem;color:var(--ink);text-decoration:none}',
  '.dc-wr:hover{background:var(--surface-2)}',
  '.dc-wr .dc-ic{width:22px;height:27px}',
  '.dc-wr span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dc-wr small{font-family:var(--mono);font-size:.66rem;color:var(--faint);white-space:nowrap}',
  '@media (max-width:1250px){.dc-arq.det{grid-template-columns:200px minmax(0,1fr)}.dc-arq.det .dc-ficha{grid-column:1/-1;position:static;max-height:none}.dc-arq{grid-template-columns:200px minmax(0,1fr)}}',
  '@media (max-width:860px){.dc-arq,.dc-arq.det{grid-template-columns:minmax(0,1fr)}.dc-side{position:static;flex-direction:row;flex-wrap:wrap}.dc-side .lbl,.dc-side hr{display:none}.dc-side select{width:auto;flex:1 1 140px}.dc-cat{width:auto;border:1px solid var(--line-soft)}.dc-row{grid-template-columns:26px minmax(0,1fr) 56px 26px}.dc-row .dc-ent,.dc-row .dc-st{display:none}}'
].join('\n');

function dcEstilo(){
  if (document.getElementById('dcCss')) return;
  var st = document.createElement('style'); st.id = 'dcCss'; st.textContent = DC_CSS;
  document.head.appendChild(st);
}

/* ------------------------------ pecas ------------------------------ */
function dcNorm(s){ return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
function dcCat(d){
  var k = dcNorm(d.kind);
  if (!k) return DC_CATS[DC_CATS.length - 1];
  for (var i = 0; i < DC_CATS.length; i++) if (DC_CATS[i].kinds.indexOf(k) >= 0) return DC_CATS[i];
  return DC_CATS[7];
}
function dcCatK(k){ return DC_CATS.filter(function(c){ return c.k === k; })[0]; }
function dcSvg(k, s){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="' + (s || 13) + '" height="' + (s || 13) + '">' + DC_ICO[k] + '</svg>';
}
function dcIconeCat(c, cls){
  var i = el('i', cls || null);
  i.style.background = 'color-mix(in srgb, ' + c.cor + ' 15%, transparent)';
  i.style.color = c.cor;
  i.innerHTML = dcSvg(c.k, cls === 'g' ? 16 : 13);
  return i;
}
/* O nome sem a data a frente («20261022 ...») nem a referencia logo a seguir
   («300839684959», «FT 2026/934»): esses vao para a linha de baixo. */
function dcNome(d){
  var n = String(d.name || '').trim();
  n = n.replace(/^\d{8}\s+/, '');
  var ref = '';
  var m = /^((?:FT|FR|FS|NC|INV|FAT)\s?[A-Z0-9][A-Z0-9\/.\-]*(?:\s[0-9][0-9\/.\-]*)?|[A-Z0-9][A-Z0-9\/.\-]{5,})\s+(.{3,})$/i.exec(n);
  if (m && /\d/.test(m[1]) && /[a-zA-ZÀ-ſ]{3}/.test(m[2])) { ref = m[1]; n = m[2]; }
  return { nome: n || d.name || 'Documento', ref: ref };
}
function dcData(d){ return /^\d{4}-\d{2}-\d{2}/.test(String(d.issued_on || '')) ? String(d.issued_on).slice(0, 10) : ''; }
function dcDias(isoD){
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(isoD || ''))) return null;
  var a = String(isoD).slice(0, 10).split('-');
  var d = new Date(+a[0], +a[1] - 1, +a[2]); var h = new Date(); h.setHours(0, 0, 0, 0);
  return Math.round((d - h) / 86400000);
}
function dcCurta(isoD){
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(isoD || ''))) return isoD || '';
  var a = String(isoD).slice(0, 10).split('-');
  var ano = String(new Date().getFullYear());
  return Number(a[2]) + ' ' + DC_MESES[Number(a[1]) - 1].slice(0, 3) + (a[0] !== ano ? ' ' + a[0].slice(2) : '');
}
function dcValidade(d){
  var v = d.valid_on || d.valid_until || '';
  if (!v) return null;
  var n = dcDias(d.valid_on || v);
  if (n === null) return { t: String(v), cls: 'mut' };
  if (n < 0) return { t: 'caducou ' + dcCurta(d.valid_on || v), cls: 'bad', n: n };
  if (n <= 90) return { t: n === 0 ? 'caduca hoje' : 'caduca em ' + n + ' d', cls: 'warn', n: n };
  return { t: 'até ' + dcCurta(d.valid_on || v), cls: 'mut', n: n };
}
function dcPill(v){ return v ? el('span', 'dc-pill ' + v.cls, v.t) : null; }
function dcFicheiros(d){ return (d.ficheiros && d.ficheiros.length) ? d.ficheiros : (d.inbox_id ? [d.inbox_id] : []); }
function dcUrl(fid){ return '/api/inbox/' + fid + '/ficheiro'; }
function dcIcone(d){
  var c = dcCat(d);
  var s = el('span', 'dc-ic');
  s.style.setProperty('--k', c.cor);
  var n = dcFicheiros(d).length;
  s.appendChild(el('span', null, n ? (n > 1 ? n + ' fx' : 'doc') : '—'));
  s.title = n ? (n === 1 ? '1 ficheiro' : n + ' ficheiros') : 'sem ficheiro';
  return s;
}
function dcCtx(id){ var cs = (window.G && G.contextos) || []; for (var i = 0; i < cs.length; i++) if (cs[i].id === id) return cs[i]; return null; }
function dcCorArea(id){
  var c = dcCtx(id); if (!c) return null;
  if (c.color) return c.color;
  var p = c.parent_id ? dcCtx(c.parent_id) : null;
  return p && p.color ? p.color : null;
}
function dcAreaChip(d){
  var nome = typeof areaNome === 'function' ? areaNome(d.context_id) : '';
  var s = el('span', 'dc-area');
  var i = el('i'); var cor = dcCorArea(d.context_id); if (cor) i.style.background = cor;
  s.appendChild(i);
  s.appendChild(document.createTextNode(nome || 'sem área'));
  return s;
}
function dcAvatar(d){
  var p = typeof pessoaDoc === 'function' ? pessoaDoc(d.person_id) : null;
  if (!p) return null;
  var a = el('span', 'dc-av', p.initials || String(p.name || '?').slice(0, 2));
  a.style.background = p.color || '#5B6478';
  a.title = p.name;
  return a;
}
/* Os papeis agarrados ao mesmo pagamento: a fatura e o comprovativo passam a
   ser um par, dito numa pilula, em vez de duas linhas de texto. */
function dcPorTarefa(){
  var por = {};
  (D.documents || []).forEach(function(d){
    (d.tarefas || []).forEach(function(u){
      if (!u.task_id) return;
      (por[u.task_id] = por[u.task_id] || []).push({ d: d, papel: dcNorm(u.papel) });
    });
  });
  return por;
}
function dcPar(d, PT){
  var c = dcCat(d).k;
  var ts = d.tarefas || [];
  if (c !== 'fat' && c !== 'comp') {
    if (!ts.length) return null;
    return { t: '↳ ' + ts[0].title, cls: 'mut' };
  }
  if (!ts.length) return c === 'fat' ? { t: 'sem pagamento ligado', cls: 'falta', falta: true } : { t: 'sem fatura', cls: 'mut' };
  var u = ts[0];
  var irm = (PT[u.task_id] || []).filter(function(x){ return x.d.id !== d.id; });
  if (c === 'fat') {
    var comp = irm.some(function(x){ return x.papel === 'comprovativo' || x.papel === 'recibo' || dcCat(x.d).k === 'comp'; });
    if (u.paid_on || comp) return { t: '✓ pago' + (u.paid_on ? ' ' + dcCurta(u.paid_on) : ''), cls: '' };
    return { t: 'por pagar · ' + u.title, cls: 'falta', falta: true };
  }
  var fat = irm.some(function(x){ return x.papel === 'fatura' || dcCat(x.d).k === 'fat'; });
  if (fat) return { t: '✓ com fatura · ' + u.title, cls: '' };
  return { t: '↳ ' + u.title + ' · falta a fatura', cls: 'falta', falta: true };
}

/* ------------------------------ filtros ------------------------------ */
function dcBase(){
  return (D.documents || []).filter(function(d){
    if (!(typeof docsVisivel === 'function' ? docsVisivel(d) : !d.arquivado_em)) return false;
    if (typeof DOCS_PESSOA !== 'undefined' && DOCS_PESSOA && d.person_id !== DOCS_PESSOA) return false;
    if (typeof docsPassaArea === 'function' && !docsPassaArea(d)) return false;
    return true;
  });
}
function dcFiltrar(lista, PT){
  var q = dcNorm(DC.q);
  return lista.filter(function(d){
    if (DC.cat && dcCat(d).k !== DC.cat) return false;
    if (DC.att === 'nl' && d.lido) return false;
    if (DC.att === 'cad') { var v = dcValidade(d); if (!v || v.n === undefined || v.n > 90) return false; }
    if (DC.att === 'par') { var p = dcPar(d, PT); if (!p || !p.falta) return false; }
    if (q && (typeof docsTextoDe === 'function' ? docsTextoDe(d) : dcNorm(d.name)).indexOf(q) < 0) return false;
    return true;
  });
}
function dcOrdem(a, b){
  var x = dcData(a), y = dcData(b);
  if (x !== y) return x < y ? 1 : -1;
  return String(a.name).localeCompare(String(b.name), 'pt');
}

/* ------------------------------ desenho ------------------------------ */
var DC_POP = null;
function dcFecharPop(){ if (DC_POP){ DC_POP.remove(); DC_POP = null; } }
document.addEventListener('click', function(e){ if (DC_POP && !DC_POP.contains(e.target)) dcFecharPop(); });

function dcAcoes(d){
  var f = dcFicheiros(d);
  var l = [];
  if (f.length) l.push(['Abrir ficheiro', function(){ window.open(dcUrl(f[0]), '_blank', 'noopener'); if (!d.lido && typeof marcarLido === 'function') marcarLido(d, true); }]);
  if (typeof relAbrir === 'function') l.push(['Relacionar…', function(){ relAbrir(d, load); }]);
  if (typeof anexarDocumento === 'function') l.push([f.length ? '+ Ficheiro' : 'Anexar ficheiro', function(){ anexarDocumento(d); }]);
  if (typeof editarDocumento === 'function') l.push(['Editar', function(){ editarDocumento(d); }]);
  if (typeof marcarLido === 'function') l.push([d.lido ? 'Marcar por ler' : 'Marcar como lido', function(){ marcarLido(d, !d.lido); }]);
  if (typeof arquivarDocumento === 'function') l.push([d.arquivado_em ? 'Reativar' : 'Arquivar', function(){ arquivarDocumento(d, !d.arquivado_em); }]);
  if (typeof apagarDocumento === 'function') l.push(['Apagar', function(){ apagarDocumento(d); }, 'del']);
  return l;
}
function dcMenu(d, botao){
  dcFecharPop();
  var r = botao.getBoundingClientRect();
  var p = el('div', 'dc-pop');
  dcAcoes(d).forEach(function(x){
    var b = el('button', x[2] || null, x[0]); b.type = 'button';
    b.addEventListener('click', function(e){ e.stopPropagation(); dcFecharPop(); x[1](); });
    p.appendChild(b);
  });
  document.body.appendChild(p);
  var h = p.offsetHeight;
  p.style.top = Math.max(8, Math.min(r.bottom + 4, window.innerHeight - h - 8)) + 'px';
  p.style.left = Math.max(8, r.right - p.offsetWidth) + 'px';
  DC_POP = p;
}

function dcLinha(d, PT, redesenhar){
  var nm = dcNome(d);
  var r = el('div', 'dc-row' + (DC.sel === d.id ? ' on' : ''));
  r.tabIndex = 0;
  r.setAttribute('role', 'button');
  r.appendChild(dcIcone(d));
  var c = el('div', 'dc-nm');
  var b = el('b');
  if (!d.lido) { var nl = el('i', 'dc-nl'); nl.title = 'por ler'; b.appendChild(nl); }
  var sn = el('span', null, nm.nome); sn.title = d.name || '';
  b.appendChild(sn);
  c.appendChild(b);
  var mt = el('div', 'dc-mt');
  mt.appendChild(dcAreaChip(d));
  if (nm.ref) mt.appendChild(el('span', 'dc-ref', nm.ref));
  var par = dcPar(d, PT);
  if (par) { var p = el('span', 'dc-par' + (par.cls ? ' ' + par.cls : ''), par.t); p.title = par.t; mt.appendChild(p); }
  if (d.arquivado_em) mt.appendChild(el('span', 'dc-pill mut', 'arquivado'));
  c.appendChild(mt);
  r.appendChild(c);
  var en = el('div', 'dc-ent', d.entity || '—'); en.title = d.entity || '';
  r.appendChild(en);
  r.appendChild(el('div', 'dc-dt', dcCurta(dcData(d)) || '—'));
  var st = el('div', 'dc-st');
  var vp = dcPill(dcValidade(d)); if (vp) st.appendChild(vp);
  var av = dcAvatar(d); if (av) st.appendChild(av);
  r.appendChild(st);
  var mais = el('button', 'dc-more', '⋯'); mais.type = 'button'; mais.setAttribute('aria-label', 'Mais ações');
  mais.addEventListener('click', function(e){ e.stopPropagation(); dcMenu(d, mais); });
  r.appendChild(mais);
  function escolher(){ DC.sel = DC.sel === d.id ? null : d.id; redesenhar(); }
  r.addEventListener('click', escolher);
  r.addEventListener('keydown', function(e){ if (e.key === 'Enter' && e.target === r) escolher(); });
  r.addEventListener('dblclick', function(){ var f = dcFicheiros(d); if (f.length) { window.open(dcUrl(f[0]), '_blank', 'noopener'); if (!d.lido && typeof marcarLido === 'function') marcarLido(d, true); } });
  return r;
}

function dcGrupo(titulo, cat, lista, PT, redesenhar, porMes){
  var g = el('section', 'dc-grp');
  var h = el('div', 'dc-grp-h');
  if (cat) h.appendChild(dcIconeCat(cat));
  h.appendChild(el('b', null, titulo));
  h.appendChild(el('small', null, String(lista.length)));
  g.appendChild(h);
  var MAX = 60, mostrados = 0, ultimo = null;
  function pintar(ate){
    lista.slice(mostrados, ate).forEach(function(d){
      if (porMes) {
        var m = dcData(d).slice(0, 7) || 'sem data';
        if (m !== ultimo) {
          ultimo = m;
          g.appendChild(el('div', 'dc-mes', m === 'sem data' ? 'sem data' : DC_MESES[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4)));
        }
      }
      g.appendChild(dcLinha(d, PT, redesenhar));
    });
    mostrados = Math.min(ate, lista.length);
  }
  pintar(MAX);
  if (lista.length > MAX) {
    var b = el('button', 'dc-mais', 'Mostrar mais ' + (lista.length - MAX));
    b.type = 'button';
    b.addEventListener('click', function(){ b.remove(); pintar(lista.length); });
    g.appendChild(b);
  }
  return g;
}

function dcFicha(d, PT, redesenhar){
  var c = dcCat(d), nm = dcNome(d);
  var f = el('aside', 'dc-ficha');
  var top = el('div', 'dc-fi-top');
  var ic = dcIcone(d); top.appendChild(ic);
  var t = el('div');
  var pc = el('span', 'dc-pill mut', c.n); pc.style.color = c.cor; t.appendChild(pc);
  t.appendChild(el('h3', null, nm.nome));
  top.appendChild(t);
  var x = el('button', 'dc-fi-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar');
  x.addEventListener('click', function(){ DC.sel = null; redesenhar(); });
  top.appendChild(x);
  f.appendChild(top);
  var b = el('div', 'dc-fi-b');
  var dl = el('dl', 'dc-dl');
  function linha(k, v){ if (!v) return; dl.appendChild(el('dt', null, k)); var dd = el('dd'); if (typeof v === 'string') dd.textContent = v; else dd.appendChild(v); dl.appendChild(dd); }
  linha('Nome', d.name);
  linha('Área', dcAreaChip(d));
  var p = typeof pessoaDoc === 'function' ? pessoaDoc(d.person_id) : null;
  linha('Pessoa', p ? p.name : '');
  linha('Entidade', d.entity || '');
  linha('Tipo', d.kind || 'sem tipo');
  if (nm.ref) linha('Referência', nm.ref);
  linha('Data', dcCurta(dcData(d)));
  var v = dcValidade(d);
  if (v) { var vv = el('span'); vv.appendChild(document.createTextNode((d.valid_on ? dcCurta(d.valid_on) : (d.valid_until || '')) + ' ')); if (v.cls !== 'mut') vv.appendChild(dcPill(v)); linha('Válido até', vv); }
  linha('Estado', d.status_label || '');
  b.appendChild(dl);

  var fs = dcFicheiros(d);
  var rf = el('div', 'dc-rel');
  rf.appendChild(el('span', 'lbl', fs.length ? (fs.length === 1 ? 'Ficheiro' : fs.length + ' ficheiros') : 'Sem ficheiro'));
  fs.forEach(function(fid, i){
    var a = el('a'); a.href = dcUrl(fid); a.target = '_blank'; a.rel = 'noopener';
    var s = el('span'); s.innerHTML = dcSvg('abrir', 13); s.style.color = 'var(--muted)';
    a.appendChild(s);
    a.appendChild(document.createTextNode(fs.length === 1 ? 'Abrir o ficheiro' : 'Ficheiro ' + (i + 1)));
    a.addEventListener('click', function(){ if (!d.lido && typeof marcarLido === 'function') marcarLido(d, true); });
    rf.appendChild(a);
  });
  b.appendChild(rf);

  if ((d.tarefas || []).length) {
    var rl = el('div', 'dc-rel');
    rl.appendChild(el('span', 'lbl', 'Ligado a'));
    d.tarefas.forEach(function(u){
      var irm = (PT[u.task_id] || []).filter(function(xx){ return xx.d.id !== d.id; });
      var dv = el('div');
      dv.style.flexDirection = 'column'; dv.style.alignItems = 'flex-start'; dv.style.gap = '3px';
      dv.appendChild(el('span', null, (u.papel && u.papel !== 'anexo' ? u.papel + ' de ' : '') + '«' + u.title + '»' + (u.paid_on ? ' · pago a ' + dcCurta(u.paid_on) : '')));
      irm.forEach(function(xx){
        var ff = dcFicheiros(xx.d);
        var a = el(ff.length ? 'a' : 'span', null, (xx.papel && xx.papel !== 'anexo' ? xx.papel + ': ' : '') + dcNome(xx.d).nome);
        a.style.cssText = 'border:0;padding:0;color:var(--muted);font-size:.74rem';
        if (ff.length) { a.href = dcUrl(ff[0]); a.target = '_blank'; a.rel = 'noopener'; }
        dv.appendChild(a);
      });
      rl.appendChild(dv);
    });
    b.appendChild(rl);
  }

  var acts = el('div', 'dc-acts');
  dcAcoes(d).forEach(function(xx, i){
    var bt = el('button', 'btn small' + (i === 0 && fs.length ? ' primary' : '') + (xx[2] ? ' ' + xx[2] : ''), xx[0]);
    bt.type = 'button';
    bt.addEventListener('click', xx[1]);
    acts.appendChild(bt);
  });
  b.appendChild(acts);
  f.appendChild(b);
  return f;
}

function dcPastas(lista, redesenhar){
  var w = el('div', 'dc-tiles');
  DC_CATS.forEach(function(c){
    var l = lista.filter(function(d){ return dcCat(d).k === c.k; }).sort(dcOrdem);
    if (!l.length) return;
    var t = el('button', 'dc-tile'); t.type = 'button';
    var h = el('div', 'dc-tile-h');
    h.appendChild(dcIconeCat(c, 'g'));
    var tx = el('div'); tx.appendChild(el('b', null, c.n)); tx.appendChild(el('small', null, c.d)); h.appendChild(tx);
    h.appendChild(el('span', 'n', String(l.length)));
    t.appendChild(h);
    var nl = l.filter(function(d){ return !d.lido; }).length;
    var cad = l.filter(function(d){ var v = dcValidade(d); return v && v.n !== undefined && v.n <= 90; }).length;
    if (nl || cad) {
      var s = el('div', 'dc-chips');
      if (nl) s.appendChild(el('span', 'dc-pill warn', nl + ' por ler'));
      if (cad) s.appendChild(el('span', 'dc-pill bad', cad + ' a caducar'));
      t.appendChild(s);
    }
    var ul = el('ul');
    l.slice(0, 3).forEach(function(d){ var li = el('li'); li.appendChild(el('span', null, dcNome(d).nome)); li.appendChild(el('small', null, dcCurta(dcData(d)))); ul.appendChild(li); });
    t.appendChild(ul);
    t.addEventListener('click', function(){ DC.cat = c.k; DC.sel = null; redesenhar(); });
    w.appendChild(t);
  });
  if (!w.children.length) return el('div', 'dc-vazio', 'Nada com estes filtros.');
  return w;
}

function dcConteudo(lista, PT, redesenhar){
  var box = el('div', 'dc-main-l');
  box.style.cssText = 'display:flex;flex-direction:column;gap:12px';
  var semFiltro = !DC.cat && !DC.att && !DC.q;
  if (DC.vista === 'pastas' && semFiltro) { box.appendChild(dcPastas(lista, redesenhar)); return box; }
  if (!lista.length) { box.appendChild(el('div', 'dc-vazio', 'Nada com estes filtros.')); return box; }
  var ord = lista.slice().sort(dcOrdem);
  if (DC.vista === 'tempo') {
    var g = el('section', 'dc-grp');
    box.appendChild(dcGrupo('Por data', null, ord, PT, redesenhar, true));
    return box;
  }
  DC_CATS.forEach(function(c){
    var l = ord.filter(function(d){ return dcCat(d).k === c.k; });
    if (!l.length) return;
    box.appendChild(dcGrupo(c.n, c, l, PT, redesenhar, c.k !== 'id' && l.length > 6));
  });
  return box;
}

function dcAtencao(base, PT, redesenhar){
  var nl = base.filter(function(d){ return !d.lido; }).length;
  var cad = base.filter(function(d){ var v = dcValidade(d); return v && v.n !== undefined && v.n <= 90; }).length;
  var par = base.filter(function(d){ var p = dcPar(d, PT); return p && p.falta; }).length;
  var sem = base.filter(function(d){ return dcCat(d).k === 'sem'; }).length;
  var w = el('div', 'dc-att');
  [['nl', nl, 'por ler', ''], ['cad', cad, 'caducados ou a caducar em 90 dias', 'w'], ['par', par, 'pagamentos sem o par (fatura ou comprovativo)', 'w'], ['sem', sem, 'sem categoria — falta dizer o que são', 'r']].forEach(function(x){
    var on = x[0] === 'sem' ? DC.cat === 'sem' : DC.att === x[0];
    var b = el('button', (x[3] || '') + (on ? ' on' : '')); b.type = 'button';
    b.appendChild(el('b', null, String(x[1]))); b.appendChild(el('span', null, x[2]));
    b.addEventListener('click', function(){
      if (x[0] === 'sem') { DC.cat = DC.cat === 'sem' ? null : 'sem'; DC.att = null; }
      else { DC.att = DC.att === x[0] ? null : x[0]; }
      DC.sel = null; redesenhar();
    });
    w.appendChild(b);
  });
  return w;
}

function dcPrazos(base, redesenhar){
  var l = base.map(function(d){ return { d: d, v: dcValidade(d) }; })
    .filter(function(x){ return x.v && x.v.n !== undefined && x.v.n >= -60 && x.v.n <= 400; })
    .sort(function(a, b){ return a.v.n - b.v.n; }).slice(0, 14);
  if (!l.length) return null;
  var s = el('section', 'dc-ren');
  var h = el('div', 'dc-ren-h'); h.appendChild(el('h3', null, 'Prazos e renovações')); h.appendChild(el('span', 'lbl', 'pelo que acaba primeiro'));
  s.appendChild(h);
  var r = el('div', 'dc-ren-l');
  l.forEach(function(x){
    var d = x.d, p = typeof pessoaDoc === 'function' ? pessoaDoc(d.person_id) : null;
    var b = el('button', 'dc-rc'); b.type = 'button';
    b.appendChild(el('span', 't', dcNome(d).nome + (p ? ' · ' + String(p.name).split(' ')[0] : '')));
    b.appendChild(el('span', 'm', d.entity || (typeof areaNome === 'function' ? areaNome(d.context_id) : '') || '—'));
    b.appendChild(dcPill(x.v));
    b.addEventListener('click', function(){ DC.sel = d.id; DC.cat = dcCat(d).k; if (DC.vista === 'pastas') DC.vista = 'lista'; redesenhar(); });
    r.appendChild(b);
  });
  s.appendChild(r);
  return s;
}

function dcLateral(base, redesenhar, naArea){
  var nav = el('nav', 'dc-side'); nav.setAttribute('aria-label', 'Categorias');
  nav.appendChild(el('span', 'lbl', 'Categorias'));
  var cont = {};
  base.forEach(function(d){ var k = dcCat(d).k; cont[k] = cont[k] || { n: 0, nl: 0 }; cont[k].n++; if (!d.lido) cont[k].nl++; });
  function botao(k, nome, n, nl, ic){
    var b = el('button', 'dc-cat' + ((DC.cat || '') === k ? ' on' : '')); b.type = 'button';
    b.appendChild(ic);
    b.appendChild(el('span', null, nome));
    if (nl) b.appendChild(el('em', null, String(nl)));
    b.appendChild(el('small', null, String(n)));
    b.addEventListener('click', function(){ DC.cat = k || null; DC.sel = null; redesenhar(); });
    nav.appendChild(b);
  }
  var it = el('i'); it.innerHTML = dcSvg('todos'); it.style.background = 'var(--accent-soft)'; it.style.color = 'var(--ink)';
  botao('', 'Todos', base.length, 0, it);
  DC_CATS.forEach(function(c){ var x = cont[c.k]; if (!x) return; botao(c.k, c.n, x.n, x.nl, dcIconeCat(c)); });

  nav.appendChild(el('hr'));
  if (!naArea) {
    nav.appendChild(el('span', 'lbl', 'Área'));
    var sa = el('select'); sa.setAttribute('aria-label', 'Área');
    var o0 = el('option', null, 'Todas as áreas'); o0.value = ''; sa.appendChild(o0);
    var cs = (window.G && G.contextos) || [];
    cs.filter(function(c){ return !c.parent_id; }).forEach(function(c){
      var o = el('option', null, c.name); o.value = String(c.id); sa.appendChild(o);
      cs.filter(function(s){ return s.parent_id === c.id; }).forEach(function(s){
        var os = el('option', null, ' ' + s.name); os.value = String(s.id); sa.appendChild(os);
      });
    });
    var os2 = el('option', null, 'Sem área'); os2.value = 'sem'; sa.appendChild(os2);
    sa.value = typeof DOCS_AREA !== 'undefined' && DOCS_AREA ? String(DOCS_AREA) : '';
    sa.addEventListener('change', function(){ DOCS_AREA = sa.value === 'sem' ? 'sem' : (sa.value ? Number(sa.value) : null); DC.sel = null; renderDocumentos(); });
    nav.appendChild(sa);
  }
  nav.appendChild(el('span', 'lbl', 'Pessoa'));
  var sp = el('select'); sp.setAttribute('aria-label', 'Pessoa');
  var p0 = el('option', null, 'Toda a gente'); p0.value = ''; sp.appendChild(p0);
  var tem = {};
  (D.documents || []).forEach(function(d){ if (d.person_id) tem[d.person_id] = true; });
  (D.people || []).filter(function(p){ return tem[p.id]; }).forEach(function(p){ var o = el('option', null, p.name); o.value = String(p.id); sp.appendChild(o); });
  sp.value = typeof DOCS_PESSOA !== 'undefined' && DOCS_PESSOA ? String(DOCS_PESSOA) : '';
  sp.addEventListener('change', function(){ DOCS_PESSOA = sp.value ? Number(sp.value) : null; DC.sel = null; renderDocumentos(); });
  nav.appendChild(sp);
  nav.appendChild(el('hr'));
  var arq = el('button', 'dc-cat' + (typeof DOCS_ARQ !== 'undefined' && DOCS_ARQ ? ' on' : '')); arq.type = 'button';
  var ia = el('i'); ia.innerHTML = dcSvg('out'); ia.style.background = 'var(--surface-2)'; arq.appendChild(ia);
  arq.appendChild(el('span', null, DOCS_ARQ ? 'A ver os arquivados' : 'Arquivados'));
  arq.appendChild(el('small', null, String((D.documents || []).filter(function(d){ return d.arquivado_em; }).length)));
  arq.addEventListener('click', function(){ DOCS_ARQ = !DOCS_ARQ; DC.sel = null; renderDocumentos(); });
  nav.appendChild(arq);
  return nav;
}

/* A pagina de uma area: as sub-areas em pilulas, e numa empresa do
   Profissional a Papelada por cima (papelada.js). */
function dcCabecaArea(caixa){
  if (typeof DOCS_AREA === 'undefined' || !DOCS_AREA || DOCS_AREA === 'sem') return;
  var c = dcCtx(DOCS_AREA); if (!c) return;
  var topo = c.parent_id ? dcCtx(c.parent_id) : c;
  if (!topo) return;
  var subs = ((window.G && G.contextos) || []).filter(function(s){ return s.parent_id === topo.id; });
  if (subs.length) {
    var ch = el('div', 'dc-chips');
    [topo].concat(subs).forEach(function(s){
      var b = el('button', 'dc-chip' + (s.id === DOCS_AREA ? ' on' : ''), s.id === topo.id ? 'Tudo em ' + topo.name : s.name);
      b.type = 'button';
      b.addEventListener('click', function(){ DOCS_AREA = s.id; DC.sel = null; renderDocumentos(); });
      ch.appendChild(b);
    });
    caixa.appendChild(ch);
  }
  if (c.parent_id && typeof ppCartao === 'function' && dcNorm(topo.name).indexOf('profissional') === 0) {
    var a = typeof aeAreaAtiva === 'function' ? aeAreaAtiva() : null;
    try { var pp = ppCartao(c.id, a); if (pp) caixa.appendChild(pp); } catch (e) { console.error('[farol] papelada nos documentos', e); }
  }
}

function dcCaixa(){
  var sec = document.getElementById('view-documentos');
  var m = document.getElementById('aeDocsMiolo') || sec;
  var cx = document.getElementById('dcApp');
  if (cx) return cx;
  if (!m) return null;
  /* O quadro antigo sai: o novo ocupa o mesmo sitio (e vai com ele quando a
     pagina de uma area o pede emprestado). */
  var velho = m.querySelector('.stack');
  cx = el('div', 'dc'); cx.id = 'dcApp';
  if (velho) velho.parentNode.replaceChild(cx, velho); else m.appendChild(cx);
  return cx;
}

var DC_AREA_ANTES = undefined;
function dcRender(){
  dcEstilo();
  dcFecharPop();
  var cx = dcCaixa();
  if (!cx || !window.D || !D.documents) return;
  /* Mudar de area (ou entrar na pagina de uma) comeca sem os filtros de antes. */
  var areaAgora = typeof DOCS_AREA !== 'undefined' ? DOCS_AREA : null;
  if (DC_AREA_ANTES !== undefined && areaAgora !== DC_AREA_ANTES) { DC.cat = null; DC.att = null; DC.q = ''; DC.sel = null; }
  DC_AREA_ANTES = areaAgora;
  var naArea = !cx.closest('#view-documentos');
  clear(cx);
  var PT = dcPorTarefa();
  var base = dcBase();
  var lista = dcFiltrar(base, PT);
  if (DC.sel && !base.some(function(d){ return d.id === DC.sel; })) DC.sel = null;

  if (naArea) dcCabecaArea(cx);
  cx.appendChild(dcAtencao(base, PT, dcRender));
  if (!DC.cat && !DC.att && !DC.q && !DOCS_ARQ) { var pz = dcPrazos(base, dcRender); if (pz) cx.appendChild(pz); }

  var arq = el('div', 'dc-arq' + (DC.sel ? ' det' : ''));
  arq.appendChild(dcLateral(base, dcRender, naArea));
  var main = el('div', 'dc-main');
  var tool = el('div', 'dc-tool');
  var sr = el('label', 'dc-srch');
  var si = el('span'); si.innerHTML = dcSvg('procura', 14); sr.appendChild(si);
  var inp = el('input'); inp.type = 'search'; inp.id = 'dcProcura'; inp.placeholder = 'Procurar por nome, referência, entidade, pagamento…'; inp.value = DC.q;
  inp.setAttribute('aria-label', 'Procurar nos documentos');
  var tmr = null;
  inp.addEventListener('input', function(){
    clearTimeout(tmr);
    tmr = setTimeout(function(){
      DC.q = inp.value; var pos = inp.selectionStart;
      dcRender();
      var n = document.getElementById('dcProcura'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} }
    }, 180);
  });
  sr.appendChild(inp);
  tool.appendChild(sr);
  var seg = el('div', 'dc-seg'); seg.setAttribute('role', 'tablist');
  var efetiva = DC.vista === 'pastas' && (DC.cat || DC.att || DC.q) ? 'lista' : DC.vista;
  [['pastas', 'Pastas'], ['lista', 'Lista'], ['tempo', 'Por data']].forEach(function(v){
    var b = el('button', efetiva === v[0] ? 'on' : '', v[1]); b.type = 'button';
    b.addEventListener('click', function(){ DC.vista = v[0]; if (v[0] === 'pastas') { DC.cat = null; DC.att = null; } dcGuardar(); dcRender(); });
    seg.appendChild(b);
  });
  tool.appendChild(seg);
  if (DC.cat || DC.att || DC.q) {
    var lp = el('button', 'btn small', 'Limpar'); lp.type = 'button';
    lp.addEventListener('click', function(){ DC.cat = null; DC.att = null; DC.q = ''; DC.sel = null; dcRender(); });
    tool.appendChild(lp);
  }
  main.appendChild(tool);
  main.appendChild(dcConteudo(lista, PT, dcRender));
  arq.appendChild(main);
  if (DC.sel) {
    var d = base.filter(function(x){ return x.id === DC.sel; })[0];
    if (d) arq.appendChild(dcFicha(d, PT, dcRender));
  }
  cx.appendChild(arq);
}

/* ---------------------- o lugar do renderDocumentos ---------------------- */
(function dcLigar(n){
  if (typeof window.renderDocumentos !== 'function' || typeof el !== 'function') {
    if (n < 80) setTimeout(function(){ dcLigar(n + 1); }, 150);
    return;
  }
  if (window.renderDocumentos.dcNovo) return;
  var novo = function(){
    try { dcRender(); } catch (e) { console.error('[farol] documentos', e); }
    /* O numero ao lado de Documentos e o que falta ler. */
    try {
      var porLer = (D.documents || []).filter(function(d){ return !d.lido && !d.arquivado_em; }).length;
      var bd = document.getElementById('badgeDocs'); if (bd) bd.textContent = porLer;
    } catch (e) {}
  };
  novo.dcNovo = true;
  window.renderDocumentos = novo;
  try { renderDocumentos = novo; } catch (e) {}
  if (window.D && D.documents) novo();
})(0);

/* Entrar nos Documentos pelo menu e comecar pelas pastas, sem a area que uma
   pagina de area la deixou escolhida. */
document.addEventListener('click', function(e){
  var b = e.target.closest && e.target.closest('#nav button[data-view="documentos"], .mn-nav [data-view="documentos"]');
  if (!b) return;
  if (typeof DOCS_AREA !== 'undefined') DOCS_AREA = null;
  DC.sel = null; DC.att = null;
  setTimeout(function(){ if (typeof renderDocumentos === 'function') renderDocumentos(); }, 0);
}, true);

/* ---------------- o cartao da visao geral (Patrimonio) ---------------- */
(function dcCartao(n){
  if (typeof window.aeDocsLado !== 'function') { if (n < 80) setTimeout(function(){ dcCartao(n + 1); }, 150); return; }
  if (window.aeDocsLado.dcNovo) return;
  var novo = function(docs, nome, abrir){
    dcEstilo();
    var card = el('div', 'card ae-w ae-bem-docs dc-w');
    var hd = el('div', 'ae-wh');
    var ic = el('span', 'ae-wi documentos');
    if (typeof aeIcone === 'function' && window.AE_I) ic.innerHTML = aeIcone(AE_I.documentos, 15);
    hd.appendChild(ic);
    hd.appendChild(el('span', 'ae-wt', 'Documentos'));
    var nl = docs.filter(function(d){ return !d.lido; }).length;
    hd.appendChild(el('span', 'ae-wn', docs.length + (nl ? ' · ' + nl + ' por ler' : '')));
    card.appendChild(hd);
    if (!docs.length) {
      card.appendChild(el('p', 'ae-vazio', 'Ainda não há papéis em ' + nome + '. Arruma-os aqui em Relacionar › Área / projeto.'));
      if (typeof aeRodape === 'function') aeRodape(card, 'Abrir nos Documentos', abrir);
      return card;
    }
    var cont = {};
    docs.forEach(function(d){ var k = dcCat(d).k; cont[k] = (cont[k] || 0) + 1; });
    var g = el('div', 'dc-wcats');
    DC_CATS.filter(function(c){ return cont[c.k]; }).slice(0, 8).forEach(function(c){
      var b = el('button'); b.type = 'button'; b.title = c.n;
      b.appendChild(dcIconeCat(c));
      b.appendChild(el('b', null, String(cont[c.k])));
      b.appendChild(el('span', null, c.n.split(' ')[0]));
      b.addEventListener('click', function(){ DC.cat = c.k; DC.sel = null; if (DC.vista === 'pastas') DC.vista = 'lista'; abrir(); });
      g.appendChild(b);
    });
    card.appendChild(g);
    docs.slice().sort(function(x, y){
      if (!x.lido !== !y.lido) return x.lido ? 1 : -1;
      return dcOrdem(x, y);
    }).slice(0, 8).forEach(function(d){
      var f = dcFicheiros(d);
      var r = el(f.length ? 'a' : 'div', 'dc-wr');
      if (f.length) { r.href = dcUrl(f[0]); r.target = '_blank'; r.rel = 'noopener'; r.addEventListener('click', function(){ if (!d.lido && typeof marcarLido === 'function') marcarLido(d, true); }); }
      r.appendChild(dcIcone(d));
      var s = el('span');
      if (!d.lido) { var p = el('i', 'dc-nl'); p.style.display = 'inline-block'; p.style.marginRight = '6px'; s.appendChild(p); }
      s.appendChild(document.createTextNode(dcNome(d).nome));
      s.title = d.name || '';
      r.appendChild(s);
      r.appendChild(el('small', null, dcCurta(dcData(d))));
      card.appendChild(r);
    });
    if (typeof aeRodape === 'function') aeRodape(card, docs.length > 8 ? 'Ver os ' + docs.length + ' nos Documentos' : 'Abrir nos Documentos', abrir);
    return card;
  };
  novo.dcNovo = true;
  window.aeDocsLado = novo;
  try { aeDocsLado = novo; } catch (e) {}
})(0);
