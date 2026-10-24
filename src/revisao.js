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
const VISTOS = 'revisao_vistos'; // { semana, passos: { caixa: true, ... } } - so a semana corrente

async function lerVistos() {
  const r = await query('SELECT value FROM settings WHERE key = $1', [VISTOS]);
  if (!r.rows.length) return null;
  try { const v = JSON.parse(r.rows[0].value); return v && v.semana ? v : null; } catch (e) { return null; }
}

async function ler() {
  const r = await query('SELECT value FROM settings WHERE key = $1', [CHAVE]);
  if (!r.rows.length) return [];
  try { const v = JSON.parse(r.rows[0].value); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}

function semanaValida(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

function instalar(app) {
  app.get('/api/revisao', async (_req, res) => {
    try { res.json({ fechos: await ler(), vistos: await lerVistos() }); }
    catch (err) {
      console.error('[farol] revisao:', err.message);
      res.status(500).json({ error: 'Não foi possível ler as revisões.' });
    }
  });

  /* Os «Visto» de cada passo passam a valer em todos os browsers. Pedido:
     { semana, passos: {chave: bool} } (substitui) ou { semana, chave, visto }. */
  app.post('/api/revisao/visto', async (req, res) => {
    try {
      const b = req.body || {};
      if (!semanaValida(b.semana)) return res.status(400).json({ error: 'Falta a semana.' });
      const atual = await lerVistos();
      const passos = atual && atual.semana === b.semana ? Object.assign({}, atual.passos) : {};
      const pos = (k, v) => { k = String(k).slice(0, 30); if (v) passos[k] = true; else delete passos[k]; };
      if (b.passos && typeof b.passos === 'object') Object.keys(b.passos).slice(0, 20).forEach((k) => pos(k, b.passos[k]));
      if (b.chave) pos(b.chave, Boolean(b.visto));
      const v = { semana: b.semana, passos, em: new Date().toISOString() };
      await query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [VISTOS, JSON.stringify(v)]);
      res.json({ vistos: v });
    } catch (err) {
      console.error('[farol] revisao (visto):', err.message);
      res.status(500).json({ error: 'Não foi possível guardar.' });
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
