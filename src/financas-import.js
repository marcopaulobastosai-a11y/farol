'use strict';
/**
 * Farol - ler extratos bancarios.
 *
 * Cada banco exporta a sua maneira: separador ; ou , ou tabulacao, datas
 * 03-10-2026 ou 2026-10-03, valores «1.234,56» ou «-12.30», uma coluna de
 * montante ou duas (debito e credito), linhas de cabecalho antes da tabela.
 * Aqui le-se o ficheiro, adivinha-se onde esta a tabela e o que e cada coluna,
 * e devolve-se a adivinha para a pessoa confirmar. O mapa confirmado fica na
 * conta: o extrato seguinte do mesmo banco ja nao pergunta.
 *
 * OFX le-se sozinho. PDF vai ao Gemini, que devolve as linhas - e a pessoa ve
 * o que entrou antes de qualquer conta.
 */

const CHAVE = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const MODELO = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

/* ---------------- texto ---------------- */
function decodificar(buf) {
  const u = buf.toString('utf8');
  /* Um extrato em latin1 lido como utf8 enche-se de caracteres de troca. */
  if ((u.match(/�/g) || []).length > 2) return buf.toString('latin1');
  return u.replace(/^﻿/, '');
}

function separador(linhas) {
  const cands = [';', '\t', ',', '|'];
  let melhor = ';', pontos = -1;
  cands.forEach((c) => {
    const contagens = linhas.slice(0, 40).map((l) => contarFora(l, c)).filter((n) => n > 0);
    if (!contagens.length) return;
    /* O separador certo aparece muitas vezes e quase sempre o mesmo numero de
       vezes por linha. */
    const moda = contagens.sort((a, b) => a - b)[Math.floor(contagens.length / 2)];
    const iguais = contagens.filter((n) => n === moda).length;
    const p = iguais * Math.min(moda, 12);
    if (p > pontos) { pontos = p; melhor = c; }
  });
  return melhor;
}
function contarFora(linha, c) {
  let n = 0, dentro = false;
  for (const ch of linha) {
    if (ch === '"') dentro = !dentro;
    else if (ch === c && !dentro) n++;
  }
  return n;
}
function partir(linha, sep) {
  const out = []; let cur = '', dentro = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (dentro && linha[i + 1] === '"') { cur += '"'; i++; } else dentro = !dentro;
    } else if (ch === sep && !dentro) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/* ---------------- datas e valores ---------------- */
function lerData(s) {
  const t = String(s || '').trim();
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    let a = +m[3]; if (a < 100) a += 2000;
    return iso(a, +m[2], +m[1]);
  }
  m = t.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  return null;
}
function iso(a, me, d) {
  if (!(a > 1990 && a < 2100 && me >= 1 && me <= 12 && d >= 1 && d <= 31)) return null;
  return a + '-' + String(me).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

function lerValor(s) {
  let t = String(s == null ? '' : s).trim();
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  t = t.replace(/EUR|€|\s| /gi, '');
  if (/-$/.test(t)) { neg = true; t = t.slice(0, -1); }
  if (/^[+-]/.test(t)) { if (t[0] === '-') neg = !neg; t = t.slice(1); }
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  const ponto = t.lastIndexOf('.'), virg = t.lastIndexOf(',');
  if (ponto >= 0 && virg >= 0) {
    t = ponto > virg ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.');
  } else if (virg >= 0) {
    t = (t.match(/,/g).length > 1) ? t.replace(/,/g, '') : t.replace(',', '.');
  } else if (ponto >= 0 && /^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');
  }
  const v = Number(t);
  if (!isFinite(v)) return null;
  return Math.round((neg ? -v : v) * 100) / 100;
}

/* ---------------- CSV ---------------- */
function tabela(texto) {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== '');
  const sep = separador(linhas);
  return { sep, linhas: linhas.map((l) => partir(l, sep)) };
}

const RE = {
  data: /^(data|date|dt)\b|data (mov|opera|lan|contab)|data$/i,
  valor: /montante|valor|importe|amount|quantia/i,
  debito: /d[eé]bito|debit|sa[ií]da|levantamento/i,
  credito: /cr[eé]dito|credit|entrada|dep[oó]sito/i,
  saldo: /saldo|balance/i,
  descricao: /descri|movimento|hist[oó]rico|detalhe|concept|description|refer|narrat|benefici/i
};

/* Onde comeca a tabela: a primeira linha que tem uma data e um valor; o
   cabecalho e a linha antes dela, se nao tiver datas. */
function detetar(texto) {
  const { sep, linhas } = tabela(texto);
  let primeira = -1;
  for (let i = 0; i < linhas.length && i < 200; i++) {
    const r = linhas[i];
    if (r.length >= 3 && r.some((c) => lerData(c)) && r.some((c) => !lerData(c) && lerValor(c) !== null)) { primeira = i; break; }
  }
  if (primeira < 0) return { sep, linhas, cabecalho: -1, colunas: [], amostra: [], mapa: null };
  const cab = primeira > 0 && !linhas[primeira - 1].some((c) => lerData(c)) ? primeira - 1 : -1;
  const n = Math.max.apply(null, linhas.slice(primeira, primeira + 20).map((r) => r.length));
  const colunas = [];
  for (let c = 0; c < n; c++) colunas.push(cab >= 0 ? (linhas[cab][c] || ('Coluna ' + (c + 1))) : ('Coluna ' + (c + 1)));
  const amostra = linhas.slice(primeira, primeira + 6);

  /* A adivinha: pelos nomes, e quando nao ha nomes, pelo conteudo. */
  const mapa = { cabecalho: cab, primeira, data: null, descricao: null, valor: null, debito: null, credito: null, saldo: null, inverter: false };
  colunas.forEach((nome, c) => {
    const x = String(nome);
    /* «Data valor» e uma segunda data, nao o montante. */
    if (RE.data.test(x)) { if (mapa.data === null) mapa.data = c; return; }
    if (mapa.saldo === null && RE.saldo.test(x)) mapa.saldo = c;
    else if (mapa.debito === null && RE.debito.test(x)) mapa.debito = c;
    else if (mapa.credito === null && RE.credito.test(x)) mapa.credito = c;
    else if (mapa.valor === null && RE.valor.test(x)) mapa.valor = c;
    else if (mapa.descricao === null && RE.descricao.test(x)) mapa.descricao = c;
  });
  const corpo = linhas.slice(primeira, primeira + 30);
  const eDatas = (c) => corpo.filter((r) => lerData(r[c])).length >= corpo.length * 0.7;
  const eValores = (c) => corpo.filter((r) => r[c] !== undefined && r[c] !== '' && lerValor(r[c]) !== null).length >= corpo.length * 0.5;
  const eTexto = (c) => corpo.filter((r) => r[c] && !lerData(r[c]) && lerValor(r[c]) === null).length >= corpo.length * 0.6;
  if (mapa.data === null) { for (let c = 0; c < n; c++) if (eDatas(c)) { mapa.data = c; break; } }
  if (mapa.descricao === null) {
    let melhor = -1, comp = 0;
    for (let c = 0; c < n; c++) {
      if (!eTexto(c)) continue;
      const m = corpo.reduce((s, r) => s + String(r[c] || '').length, 0);
      if (m > comp) { comp = m; melhor = c; }
    }
    if (melhor >= 0) mapa.descricao = melhor;
  }
  if (mapa.valor === null && mapa.debito === null && mapa.credito === null) {
    const nums = [];
    for (let c = 0; c < n; c++) if (c !== mapa.data && eValores(c)) nums.push(c);
    /* Sem nomes: se ha tres colunas de numeros, a ultima e o saldo. */
    if (nums.length >= 3) { mapa.debito = nums[0]; mapa.credito = nums[1]; if (mapa.saldo === null) mapa.saldo = nums[2]; }
    else if (nums.length === 2) { mapa.valor = nums[0]; if (mapa.saldo === null) mapa.saldo = nums[1]; }
    else if (nums.length === 1) mapa.valor = nums[0];
  }
  return { sep, linhas, cabecalho: cab, colunas, amostra, mapa };
}

function aplicarMapa(texto, mapa) {
  const { linhas } = tabela(texto);
  const out = [];
  const inicio = mapa.primeira != null ? mapa.primeira : (mapa.cabecalho >= 0 ? mapa.cabecalho + 1 : 0);
  const descCols = [].concat(mapa.descricao == null ? [] : mapa.descricao);
  for (let i = inicio; i < linhas.length; i++) {
    const r = linhas[i];
    const data = lerData(r[mapa.data]);
    if (!data) continue;
    let valor = null;
    if (mapa.valor != null && mapa.valor !== '') valor = lerValor(r[mapa.valor]);
    if (valor === null && (mapa.debito != null || mapa.credito != null)) {
      const d = mapa.debito != null ? lerValor(r[mapa.debito]) : null;
      const c = mapa.credito != null ? lerValor(r[mapa.credito]) : null;
      if (d === null && c === null) continue;
      valor = Math.round(((c ? Math.abs(c) : 0) - (d ? Math.abs(d) : 0)) * 100) / 100;
    }
    if (valor === null) continue;
    if (mapa.inverter) valor = -valor;
    const descricao = descCols.map((c) => r[c] || '').filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim() || 'Movimento';
    const saldo = mapa.saldo != null && mapa.saldo !== '' ? lerValor(r[mapa.saldo]) : null;
    out.push({ data, descricao, valor, saldo });
  }
  return out;
}

/* ---------------- OFX ---------------- */
function lerOfx(texto) {
  const out = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const campo = (b, n) => {
    const m = b.match(new RegExp('<' + n + '>([^<\\r\\n]*)', 'i'));
    return m ? m[1].trim() : '';
  };
  blocos.forEach((b) => {
    const data = lerData(campo(b, 'DTPOSTED'));
    const valor = lerValor(campo(b, 'TRNAMT'));
    if (!data || valor === null) return;
    const descricao = [campo(b, 'NAME'), campo(b, 'MEMO')].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' · ') || 'Movimento';
    out.push({ data, descricao, valor, saldo: null, fitid: campo(b, 'FITID') || null });
  });
  return out;
}

/* ---------------- PDF, pelo Gemini ---------------- */
const ESQUEMA_PDF = {
  type: 'object',
  properties: {
    movimentos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          data: { type: 'string', description: 'AAAA-MM-DD, a data do movimento' },
          descricao: { type: 'string', description: 'o descritivo tal como esta no extrato' },
          valor: { type: 'number', description: 'negativo se saiu da conta, positivo se entrou' },
          saldo: { type: 'number', description: 'o saldo depois do movimento, se o extrato o mostrar' }
        },
        required: ['data', 'descricao', 'valor']
      }
    }
  },
  required: ['movimentos']
};

async function lerPdf(buf) {
  if (!CHAVE) { const e = new Error('Para ler PDF falta a chave do Gemini (GEMINI_API_KEY).'); e.status = 409; throw e; }
  const corpo = {
    model: MODELO,
    store: false,
    system_instruction: 'Es um leitor de extratos bancarios portugueses. Devolves so as linhas de movimentos, sem inventar nada. ' +
      'Debitos (saidas, pagamentos, compras, levantamentos) sao negativos; creditos (entradas, transferencias recebidas) positivos. ' +
      'Ignora saldos iniciais e finais, totais e linhas de cabecalho.',
    input: [
      { type: 'document', data: buf.toString('base64'), mime_type: 'application/pdf' },
      { type: 'text', text: 'Extrai todos os movimentos deste extrato, por ordem.' }
    ],
    response_format: { type: 'text', mime_type: 'application/json', schema: ESQUEMA_PDF }
  };
  let ultimo = null;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
        method: 'POST', signal: AbortSignal.timeout(120000),
        headers: { 'content-type': 'application/json', 'x-goog-api-key': CHAVE },
        body: JSON.stringify(corpo)
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        ultimo = new Error('O Gemini respondeu ' + r.status + ': ' + t.slice(0, 160));
        if (r.status === 429 || r.status >= 500) { await new Promise((ok) => setTimeout(ok, 4000 * (tentativa + 1))); continue; }
        throw ultimo;
      }
      const j = await r.json();
      let cru = '';
      (j.steps || []).forEach((p) => (p.content || []).forEach((c) => { if (c && c.type === 'text' && c.text) cru += c.text; }));
      if (!cru && typeof j.output_text === 'string') cru = j.output_text;
      const dados = JSON.parse(cru);
      return (dados.movimentos || []).map((m) => ({
        data: lerData(m.data), descricao: String(m.descricao || 'Movimento').trim(),
        valor: Math.round(Number(m.valor) * 100) / 100,
        saldo: m.saldo == null || !isFinite(Number(m.saldo)) ? null : Math.round(Number(m.saldo) * 100) / 100
      })).filter((m) => m.data && isFinite(m.valor));
    } catch (e) {
      ultimo = e;
      if (/Timeout|Abort/.test(String(e.name) + String(e.message))) continue;
      throw e;
    }
  }
  throw ultimo || new Error('Não foi possível ler o PDF.');
}

/* ---------------- o tipo do ficheiro ---------------- */
function tipoDe(nome, mime, buf) {
  const n = String(nome || '').toLowerCase();
  if (/\.ofx$|\.qfx$/.test(n) || /<OFX>/i.test(buf.slice(0, 4000).toString('latin1'))) return 'ofx';
  if (/\.pdf$/.test(n) || mime === 'application/pdf' || buf.slice(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (/\.xlsx?$/.test(n) || buf.slice(0, 2).toString('latin1') === 'PK') return 'xls';
  return 'csv';
}

module.exports = { decodificar, detetar, aplicarMapa, lerOfx, lerPdf, lerData, lerValor, tipoDe };
