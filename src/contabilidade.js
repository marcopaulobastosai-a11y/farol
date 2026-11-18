'use strict';
/**
 * Farol - o dossie da contabilidade.
 *
 * Cada papel que entra numa area marcada para a contabilidade (a empresa)
 * fica «por imprimir» sozinho - quem o poe la e um gatilho na base de dados,
 * venha o papel da caixa, de um email ou de uma mudanca de area. Daqui
 * passa a «impresso» e depois a «entregue», com a data de cada passo. Era o
 * que a tarefa «Entrega a contabilidade» fazia a mao, passo a passo.
 *
 * Para imprimir de uma vez, os ficheiros escolhidos juntam-se num so PDF
 * (as imagens vao cada uma para uma pagina A4).
 */
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;
const ESTADOS = ['imprimir', 'impresso', 'entregue'];
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());

function ids(lista) {
  return Array.from(new Set((Array.isArray(lista) ? lista : String(lista || '').split(','))
    .map(Number).filter((n) => Number.isInteger(n) && n > 0))).slice(0, 300);
}

function instalar(app) {
  /* Mudar o estado de um ou mais papeis. estado null tira-os do dossie. */
  app.patch('/api/documentos-contabilidade', async (req, res) => {
    const b = req.body || {};
    const lista = ids(b.ids);
    const estado = b.estado === null || b.estado === '' ? null : String(b.estado || '');
    if (!lista.length) return res.status(400).json({ error: 'Nenhum documento escolhido.' });
    if (estado !== null && ESTADOS.indexOf(estado) < 0) return res.status(400).json({ error: 'Estado desconhecido.' });
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(b.data || '')) ? b.data : hoje();
    try {
      const r = await query(
        `UPDATE documents
            SET contab_estado = $2::text,
                contab_impresso_em = CASE WHEN $2::text IN ('impresso', 'entregue')
                                          THEN COALESCE(contab_impresso_em, $3::date) END,
                contab_entregue_em = CASE WHEN $2::text = 'entregue'
                                          THEN COALESCE(contab_entregue_em, $3::date) END
          WHERE id = ANY($1::int[])`, [lista, estado, data]);
      res.json({ ok: true, n: r.rowCount, estado, data });
    } catch (err) {
      console.error('[farol] PATCH contabilidade:', err.message);
      res.status(400).json({ error: 'Não foi possível mudar o estado.' });
    }
  });

  /* Os ficheiros escolhidos num so PDF, pela ordem da data do papel. */
  app.get('/api/documentos-contabilidade/imprimir', async (req, res) => {
    const lista = ids(req.query.ids);
    if (!lista.length) return res.status(400).json({ error: 'Nenhum documento escolhido.' });
    try {
      const { PDFDocument } = require('pdf-lib');
      const inbox = require('./inbox');
      const fich = await all(
        `SELECT d.id, d.name, i.file_path, i.store, i.mime_type, i.file_name
           FROM documents d
           JOIN inbox_links l ON l.target_type = 'documento' AND l.target_id = d.id
           JOIN inbox_items i ON i.id = l.inbox_id
          WHERE d.id = ANY($1::int[]) AND i.file_path IS NOT NULL
          ORDER BY d.issued_on NULLS LAST, d.name, d.id, l.inbox_id`, [lista]);
      const saida = await PDFDocument.create();
      const falhas = [];
      for (const f of fich) {
        try {
          const buf = await inbox.lerFicheiro(f.store, f.file_path);
          const mime = String(f.mime_type || '').toLowerCase();
          const nome = String(f.file_name || '').toLowerCase();
          if (mime.indexOf('pdf') >= 0 || /\.pdf$/.test(nome)) {
            const src = await PDFDocument.load(buf, { ignoreEncryption: true });
            const pags = await saida.copyPages(src, src.getPageIndices());
            pags.forEach((p) => saida.addPage(p));
          } else if (/png/.test(mime) || /\.png$/.test(nome) || /jpe?g/.test(mime) || /\.jpe?g$/.test(nome)) {
            const img = /png/.test(mime) || /\.png$/.test(nome) ? await saida.embedPng(buf) : await saida.embedJpg(buf);
            const W = 595.28, H = 841.89, M = 28;
            const pag = saida.addPage([W, H]);
            const k = Math.min((W - 2 * M) / img.width, (H - 2 * M) / img.height, 1);
            const w = img.width * k, h = img.height * k;
            pag.drawImage(img, { x: (W - w) / 2, y: H - M - h, width: w, height: h });
          } else {
            falhas.push(f.name);
          }
        } catch (e) {
          console.error('[farol] imprimir', f.id, e.message);
          falhas.push(f.name);
        }
      }
      if (!saida.getPageCount()) return res.status(404).json({ error: 'Nenhum destes papéis tem um PDF ou imagem para imprimir.', falhas });
      const bytes = await saida.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="contabilidade-' + hoje() + '.pdf"');
      res.setHeader('Cache-Control', 'private, max-age=0, no-store');
      if (falhas.length) res.setHeader('X-Farol-Sem-Ficheiro', encodeURIComponent(falhas.join(' | ')).slice(0, 1500));
      res.end(Buffer.from(bytes));
    } catch (err) {
      console.error('[farol] GET imprimir contabilidade:', err.message);
      res.status(500).json({ error: 'Não foi possível juntar os ficheiros.' });
    }
  });
}

module.exports = { instalar };
