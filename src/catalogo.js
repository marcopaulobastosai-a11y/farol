'use strict';
/**
 * Farol - desfazer uma catalogacao.
 *
 * A leitura automatica acerta quase sempre, mas quando erra deixava o papel
 * ou a despesa la para sempre: nao havia forma nenhuma de os tirar do ecra.
 * Este modulo e so isso - apagar, e limpar o rasto que ficou.
 *
 * Se aquilo tinha vindo de um ficheiro da caixa de entrada, a ligacao
 * desaparece com ele; e se o ficheiro ficar sem mais nada agarrado, volta a
 * por triar. O ficheiro continua guardado: o que se desfez foi a arrumacao,
 * nao o papel.
 *
 * Traz tambem a lista das despesas, que nao aparecia em lado nenhum da app:
 * a catalogacao criava-as e ninguem as voltava a ver.
 */
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;

const TIPOS = {
  documento: { tabela: 'documents', rotulo: 'name' },
  despesa:   { tabela: 'expenses',  rotulo: 'description' }
};

async function apagar(tipo, id) {
  const t = TIPOS[tipo];
  const linha = await all(
    'SELECT id, ' + t.rotulo + ' AS rotulo FROM ' + t.tabela + ' WHERE id = $1', [id]);
  if (!linha.length) return null;

  const vindos = await all(
    'SELECT inbox_id FROM inbox_links WHERE target_type = $1 AND target_id = $2', [tipo, id]);
  await query('DELETE FROM inbox_links WHERE target_type = $1 AND target_id = $2', [tipo, id]);
  await query('DELETE FROM ' + t.tabela + ' WHERE id = $1', [id]);

  const caixa = [];
  for (const l of vindos) {
    const restam = await all('SELECT 1 FROM inbox_links WHERE inbox_id = $1', [l.inbox_id]);
    if (!restam.length) {
      await query(
        "UPDATE inbox_items SET status = 'por_triar', resolved_at = NULL WHERE id = $1",
        [l.inbox_id]);
      caixa.push(l.inbox_id);
    }
  }

  console.log('[farol]', tipo, 'apagada/o:', id, linha[0].rotulo);
  return caixa;
}

function rotaApagar(app, caminho, tipo) {
  app.delete(caminho, async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Falta dizer o que apagar.' });
    try {
      const caixa = await apagar(tipo, id);
      if (caixa === null) return res.status(404).json({ error: 'Ja nao existe.' });
      res.json({ ok: true, id: id, caixa: caixa });
    } catch (err) {
      console.error('[farol] DELETE ' + tipo + ':', err.message);
      res.status(400).json({ error: 'Nao foi possivel apagar.' });
    }
  });
}

function instalar(app) {
  rotaApagar(app, '/api/documentos/:id', 'documento');
  rotaApagar(app, '/api/despesas/:id', 'despesa');

  /* Lido ou por ler. Marca-se sozinho quando se abre o ficheiro pelo nome, e
     pode voltar atras para quem quer deixar um papel a chamar por si. */
  app.patch('/api/documentos/:id/lido', async (req, res) => {
    const id = Number(req.params.id);
    const lido = (req.body || {}).lido !== false;
    try {
      const r = await query(
        'UPDATE documents SET read_at = ' + (lido ? 'COALESCE(read_at, now())' : 'NULL') +
        ' WHERE id = $1', [id]);
      if (!r.rowCount) return res.status(404).json({ error: 'Documento nao encontrado.' });
      res.json({ ok: true, id: id, lido: lido });
    } catch (err) {
      console.error('[farol] PATCH lido:', err.message);
      res.status(400).json({ error: 'Nao foi possivel marcar o documento.' });
    }
  });

  app.get('/api/despesas', async (req, res) => {
    try {
      const linhas = await all(
        `SELECT e.id, e.description, e.amount::float AS amount,
                to_char(e.spent_on, 'YYYY-MM-DD') AS spent_on,
                e.merchant, e.category, e.person_id, e.note,
                p.name AS pessoa
           FROM expenses e
           LEFT JOIN people p ON p.id = e.person_id
          ORDER BY e.spent_on DESC, e.id DESC
          LIMIT 200`);
      res.json({ despesas: linhas });
    } catch (err) {
      console.error('[farol] GET despesas:', err.message);
      res.status(500).json({ error: 'Nao foi possivel ler as despesas.' });
    }
  });
}

module.exports = { instalar };
