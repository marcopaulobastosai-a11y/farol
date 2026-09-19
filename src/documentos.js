'use strict';
/**
 * Farol - apagar documentos.
 *
 * A catalogacao automatica acerta quase sempre, mas quando erra deixava o
 * papel la para sempre: nao havia forma nenhuma de o tirar do ecra. Este
 * modulo e so isso - apagar um documento e limpar o rasto que ele deixou.
 *
 * Se o documento tinha vindo de um ficheiro da caixa de entrada, a ligacao
 * desaparece com ele; e se aquele ficheiro ficar sem mais nada agarrado,
 * volta a por triar. O ficheiro continua guardado: o que se desfez foi a
 * arrumacao, nao o papel.
 */
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;

function instalar(app) {
  app.delete('/api/documentos/:id', async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Documento por identificar.' });
    try {
      const doc = await all('SELECT id, name FROM documents WHERE id = $1', [id]);
      if (!doc.length) return res.status(404).json({ error: 'Documento nao encontrado.' });

      const vindos = await all(
        "SELECT inbox_id FROM inbox_links WHERE target_type = 'documento' AND target_id = $1", [id]);
      await query(
        "DELETE FROM inbox_links WHERE target_type = 'documento' AND target_id = $1", [id]);
      await query('DELETE FROM documents WHERE id = $1', [id]);

      for (const l of vindos) {
        const restam = await all('SELECT 1 FROM inbox_links WHERE inbox_id = $1', [l.inbox_id]);
        if (!restam.length) {
          await query(
            "UPDATE inbox_items SET status = 'por_triar', resolved_at = NULL WHERE id = $1",
            [l.inbox_id]);
        }
      }

      console.log('[farol] documento apagado:', id, doc[0].name);
      res.json({ ok: true, id: id, caixa: vindos.map((l) => l.inbox_id) });
    } catch (err) {
      console.error('[farol] DELETE documento:', err.message);
      res.status(400).json({ error: 'Nao foi possivel apagar o documento.' });
    }
  });
}

module.exports = { instalar };
