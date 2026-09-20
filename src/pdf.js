'use strict';
/**
 * Farol - um PDF simples a partir de texto, sem dependencias.
 *
 * Serve para os documentos que nasceram de uma nota (o TickTick guardava o
 * numero do NIF ou a morada de um seguro como texto, sem papel nenhum): a
 * regra e que cada documento tem um ficheiro, e aqui o ficheiro e a propria
 * nota, paginada em A4.
 *
 * Helvetica com WinAnsiEncoding: cobre o portugues todo (acentos, cedilha,
 * ordinais, euro). O que ficar de fora vira '?', em vez de partir o ficheiro.
 */

/* Larguras da Helvetica (em milesimos do corpo), caracteres 32..126. */
const LARG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,
  722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,
  667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,
  222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,
  260,334,584];

/* Os caracteres do cp1252 que nao coincidem com o latin1. */
const CP1252 = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '–': 0x96,
  '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95,
  '™': 0x99, 'œ': 0x9c, 'Œ': 0x8c };

function codigo(ch) {
  if (CP1252[ch]) return CP1252[ch];
  const c = ch.charCodeAt(0);
  if (c === 9) return 32;
  if (c >= 32 && c < 127) return c;
  if (c >= 160 && c <= 255) return c;
  return 63;
}

function largura(txt, corpo) {
  let w = 0;
  for (const ch of txt) {
    const c = codigo(ch);
    w += (c >= 32 && c <= 126) ? LARG[c - 32] : 556;
  }
  return w * corpo / 1000;
}

/* Parte uma linha em pedacos que cabem na largura, pelas palavras. */
function partir(linha, corpo, max) {
  if (!linha.trim()) return [''];
  const out = [];
  let atual = '';
  for (const palavra of linha.split(/(\s+)/)) {
    const tentativa = atual + palavra;
    if (largura(tentativa, corpo) <= max) { atual = tentativa; continue; }
    if (atual.trim()) out.push(atual.replace(/\s+$/, ''));
    atual = palavra.replace(/^\s+/, '');
    while (largura(atual, corpo) > max) {
      let n = atual.length;
      while (n > 1 && largura(atual.slice(0, n), corpo) > max) n--;
      out.push(atual.slice(0, n));
      atual = atual.slice(n);
    }
  }
  if (atual.trim() || !out.length) out.push(atual.replace(/\s+$/, ''));
  return out;
}

function literal(txt) {
  const bytes = [];
  for (const ch of txt) {
    const c = codigo(ch);
    if (c === 40 || c === 41 || c === 92) bytes.push(92);
    bytes.push(c);
  }
  return '(' + Buffer.from(bytes).toString('latin1') + ')';
}

/**
 * blocos: [{ texto, corpo, negrito, cor, antes }]
 *   cor em cinzento (0..1); antes = espaco extra acima, em pontos.
 */
function gerar(blocos, { titulo } = {}) {
  const L = 595.28, A = 841.89, M = 56, W = L - 2 * M;
  const paginas = [];
  let ops = [], y = A - M;

  const novaPagina = () => { if (ops.length) paginas.push(ops.join('\n')); ops = []; y = A - M; };

  for (const b of blocos) {
    const corpo = b.corpo || 11, alto = corpo * 1.35;
    y -= (b.antes || 0);
    const linhas = String(b.texto == null ? '' : b.texto).replace(/\r\n?/g, '\n').split('\n')
      .reduce((acc, l) => acc.concat(partir(l, corpo, W)), []);
    for (const l of linhas) {
      if (y - corpo < M) novaPagina();
      y -= alto;
      if (l) {
        ops.push('BT /' + (b.negrito ? 'F2' : 'F1') + ' ' + corpo + ' Tf ' +
          (b.cor != null ? b.cor : 0) + ' g ' + M + ' ' + y.toFixed(2) + ' Td ' + literal(l) + ' Tj ET');
      }
    }
  }
  novaPagina();
  if (!paginas.length) paginas.push('');

  /* Objectos: 1 catalogo, 2 paginas, 3 F1, 4 F2, 5 info, depois pares pagina/conteudo. */
  const obj = [];
  const kids = paginas.map((_, i) => (6 + 2 * i) + ' 0 R').join(' ');
  obj.push('<< /Type /Catalog /Pages 2 0 R >>');
  obj.push('<< /Type /Pages /Kids [' + kids + '] /Count ' + paginas.length + ' >>');
  obj.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  obj.push('<< /Producer (Farol) /Title ' + literal(titulo || 'Documento') + ' >>');
  paginas.forEach((conteudo, i) => {
    obj.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + L + ' ' + A + '] ' +
      '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (7 + 2 * i) + ' 0 R >>');
    const len = Buffer.byteLength(conteudo, 'latin1');
    obj.push('<< /Length ' + len + ' >>\nstream\n' + conteudo + '\nendstream');
  });

  let pdf = '%PDF-1.4\n%âãÏÓ\n';
  const offs = [];
  obj.forEach((o, i) => {
    offs.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += (i + 1) + ' 0 obj\n' + o + '\nendobj\n';
  });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += 'xref\n0 ' + (obj.length + 1) + '\n0000000000 65535 f \n' +
    offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') +
    'trailer\n<< /Size ' + (obj.length + 1) + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(pdf, 'latin1');
}

module.exports = { gerar };
