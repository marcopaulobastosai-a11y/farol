'use strict';
/**
 * Farol - a revisao da semana (fase 6 do menu novo, 24 out 2026).
 *
 * O ecra (public/revisao.js) calcula tudo com os dados que ja tem. Aqui so
 * se guarda quando cada semana foi fechada, e com que numeros, para o Hoje
 * saber se a revisao de domingo ja esta feita e para haver historico.
 * Vive na tabela settings (chave 'revisao_fechos'), como a familia: nada de
 * tabelas novas para uma lista curta.
 */
const { query } = require('./db');

const CHAVE = 'revisao_fechos';
const MAX = 104; // dois anos de domingos

async function ler() {
  const r = await query('SELECT value FROM settings WHERE key = $1', [CHAVE]);
  if (!r.rows.length) return [];
  try { const v = JSON.parse(r.rows[0].value); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}

function semanaValida(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

function instalar(app) {
  app.get('/api/revisao', async (_req, res) => {
    try { res.json({ fechos: await ler() }); }
    catch (err) {
      console.error('[farol] revisao:', err.message);
      res.status(500).json({ error: 'Não foi possível ler as revisões.' });
    }
  });

  app.post('/api/revisao/fechar', async (req, res) => {
    try {
      const b = req.body || {};
      if (!semanaValida(b.semana)) return res.status(400).json({ error: 'Falta a semana.' });
      const numeros = {};
      Object.keys(b.numeros || {}).slice(0, 12).forEach((k) => {
        const n = Number(b.numeros[k]);
        if (Number.isFinite(n)) numeros[String(k).slice(0, 30)] = n;
      });
      const fechos = (await ler()).filter((f) => f.semana !== b.semana);
      fechos.unshift({ semana: b.semana, em: new Date().toISOString(), numeros });
      fechos.sort((x, y) => (x.semana < y.semana ? 1 : -1));
      await query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [CHAVE, JSON.stringify(fechos.slice(0, MAX))]);
      res.json({ fechos: fechos.slice(0, MAX) });
    } catch (err) {
      console.error('[farol] revisao (fechar):', err.message);
      res.status(500).json({ error: 'Não foi possível fechar a semana.' });
    }
  });
}

module.exports = { instalar };
