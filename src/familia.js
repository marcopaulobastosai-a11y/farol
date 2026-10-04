'use strict';
/**
 * Farol - a Familia por sub-areas: quem vive em cada uma, o cofre de cada
 * pessoa e os sonhos da casa.
 *
 * Cada sub-area da Familia (Ana Lucia e Marco Paulo, Meninos, Pais Bastos,
 * Brownie) e a vida de algumas pessoas: o mapa sub-area -> pessoas fica em
 * settings ('familia_pessoas'), para nao mexer na tabela das areas.
 *
 * O cofre guarda o que identifica um cartao ou um documento. De um cartao
 * bancario so o banco, os ultimos 4 digitos e a validade: o servidor corta
 * o resto, venha o que vier. So o abrem os adultos da casa com conta no
 * Farol (e o administrador).
 */
const fs = require('fs');
const path = require('path');
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;
const limpar = (v) => { if (v === undefined || v === null) return null; const s = String(v).trim(); return s ? s : null; };
const dia = (v) => (limpar(v) && /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? String(v).trim() : null);
const MAX_FOTO = 1500 * 1024;
const HORIZONTES = ['ano', 'cinco', 'vida'];

function erro(status, msg) { const e = new Error(msg); e.status = status; return e; }
function falha(res, err, onde) {
  if (err && err.status) return res.status(err.status).json({ error: err.message });
  console.error('[farol] familia ' + onde + ':', err && err.message);
  return res.status(500).json({ error: 'Não foi possível ' + onde + '.' });
}

async function preparar() {
  await query(fs.readFileSync(path.join(__dirname, '..', 'db', 'familia.sql'), 'utf8'));
  console.log('[farol] familia: tabelas prontas.');
}

async function mapaPessoas() {
  const r = await all("SELECT value FROM settings WHERE key = 'familia_pessoas'");
  try { return r.length ? JSON.parse(r[0].value) || {} : {}; } catch (e) { return {}; }
}

function instalar(app, { sessao, ehAdmin, authAtiva }) {
  /* Quem pode abrir o cofre: com o login desligado (desenvolvimento) toda a
     gente; senao o administrador e os adultos da casa com conta no Farol. */
  async function podeCofre(req) {
    if (!authAtiva()) return true;
    const s = sessao(req);
    if (!s || !s.email) return false;
    if (ehAdmin(s.email)) return true;
    const p = await all("SELECT 1 FROM people WHERE lower(conta_email) = lower($1) AND kind = 'adulto' AND active", [s.email]);
    return p.length > 0;
  }
  async function exigeCofre(req) { if (!(await podeCofre(req))) throw erro(403, 'O cofre só abre para os adultos da casa.'); }

  app.get('/api/familia', async (req, res) => {
    try { res.json({ pessoas: await mapaPessoas(), cofre: await podeCofre(req) }); }
    catch (e) { falha(res, e, 'ler a família'); }
  });

  app.put('/api/familia/pessoas', async (req, res) => {
    try {
      const b = req.body || {};
      const ctx = Number(b.context_id);
      if (!ctx) throw erro(400, 'Falta a sub-área.');
      const ids = [...new Set((Array.isArray(b.pessoas) ? b.pessoas : []).map(Number).filter(Boolean))];
      const m = await mapaPessoas();
      if (ids.length) m[ctx] = ids; else delete m[ctx];
      await query(`INSERT INTO settings (key, value) VALUES ('familia_pessoas', $1)
                   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(m)]);
      res.json({ pessoas: m });
    } catch (e) { falha(res, e, 'gravar as pessoas da sub-área'); }
  });

  /* ---------------- cofre ---------------- */
  const COFRE_SQL = `SELECT c.id, c.person_id, c.tipo, c.nome, c.entidade, c.ultimos4, c.numero,
                            to_char(c.validade, 'YYYY-MM-DD') AS validade, c.document_id, c.nota,
                            d.name AS documento, (SELECT l.inbox_id FROM inbox_links l WHERE l.target_type = 'documento' AND l.target_id = d.id ORDER BY l.inbox_id LIMIT 1) AS ficheiro
                       FROM fam_cofre c LEFT JOIN documents d ON d.id = c.document_id`;

  function corpoCofre(b, parcial) {
    const o = {};
    const tipo = b.tipo === 'banco' ? 'banco' : 'id';
    if (!parcial || b.tipo !== undefined) o.tipo = tipo;
    if (!parcial || b.nome !== undefined) { o.nome = limpar(b.nome); if (!o.nome) throw erro(400, 'Falta o nome.'); }
    if (b.entidade !== undefined) o.entidade = limpar(b.entidade);
    if (b.validade !== undefined) o.validade = dia(b.validade);
    if (b.document_id !== undefined) o.document_id = Number(b.document_id) || null;
    if (b.nota !== undefined) o.nota = limpar(b.nota);
    /* Os digitos de um cartao: so os ultimos 4, sempre. */
    if (b.ultimos4 !== undefined) {
      const dig = String(b.ultimos4 || '').replace(/\D/g, '');
      o.ultimos4 = dig ? dig.slice(-4) : null;
    }
    if (b.numero !== undefined) o.numero = limpar(b.numero);
    if ((o.tipo || b.tipo) === 'banco') o.numero = null;
    return o;
  }

  app.get('/api/cofre', async (req, res) => {
    try {
      await exigeCofre(req);
      const ids = String(req.query.pessoas || '').split(',').map(Number).filter(Boolean);
      const linhas = ids.length
        ? await all(COFRE_SQL + ' WHERE c.person_id = ANY($1::int[]) ORDER BY c.tipo, c.nome', [ids])
        : await all(COFRE_SQL + ' ORDER BY c.person_id, c.tipo, c.nome');
      res.json({ itens: linhas });
    } catch (e) { falha(res, e, 'abrir o cofre'); }
  });

  app.post('/api/cofre', async (req, res) => {
    try {
      await exigeCofre(req);
      const b = req.body || {};
      const pid = Number(b.person_id);
      if (!pid) throw erro(400, 'Falta a pessoa.');
      const o = corpoCofre(b, false);
      const r = await all(`INSERT INTO fam_cofre (person_id, tipo, nome, entidade, ultimos4, numero, validade, document_id, nota)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [pid, o.tipo, o.nome, o.entidade || null, o.ultimos4 || null, o.numero || null, o.validade || null, o.document_id || null, o.nota || null]);
      res.json({ id: r[0].id });
    } catch (e) { falha(res, e, 'guardar no cofre'); }
  });

  app.patch('/api/cofre/:id(\\d+)', async (req, res) => {
    try {
      await exigeCofre(req);
      const o = corpoCofre(req.body || {}, true);
      const k = Object.keys(o);
      if (k.length) {
        const vals = k.map((x) => o[x]);
        vals.push(Number(req.params.id));
        await query('UPDATE fam_cofre SET ' + k.map((x, i) => x + ' = $' + (i + 1)).join(', ') + ' WHERE id = $' + vals.length, vals);
      }
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'gravar no cofre'); }
  });

  app.delete('/api/cofre/:id(\\d+)', async (req, res) => {
    try { await exigeCofre(req); await query('DELETE FROM fam_cofre WHERE id = $1', [Number(req.params.id)]); res.json({ ok: true }); }
    catch (e) { falha(res, e, 'apagar do cofre'); }
  });

  /* ---------------- sonhos ---------------- */
  app.get('/api/sonhos', async (req, res) => {
    try {
      const sonhos = await all(`SELECT id, tipo, titulo, texto, horizonte, quem, autor_id, project_id, conta_id, meta::float AS meta,
                                       cor, (foto IS NOT NULL) AS tem_foto, ordem, cumprido
                                  FROM fam_sonhos ORDER BY cumprido, ordem, id`);
      const passos = await all(`SELECT id, sonho_id, texto, quando, feito, task_id, ordem FROM fam_sonho_passos ORDER BY sonho_id, ordem, id`);
      sonhos.forEach((s) => { s.passos = passos.filter((p) => p.sonho_id === s.id); });
      res.json({ sonhos });
    } catch (e) { falha(res, e, 'ler os sonhos'); }
  });

  function corpoSonho(b) {
    const o = {};
    if (b.tipo !== undefined) o.tipo = b.tipo === 'pensamento' ? 'pensamento' : 'sonho';
    ['titulo', 'texto', 'quem', 'cor'].forEach((k) => { if (b[k] !== undefined) o[k] = limpar(b[k]); });
    if (b.horizonte !== undefined) o.horizonte = HORIZONTES.indexOf(b.horizonte) >= 0 ? b.horizonte : 'cinco';
    ['autor_id', 'project_id', 'conta_id', 'ordem'].forEach((k) => { if (b[k] !== undefined) o[k] = Number(b[k]) || null; });
    if (b.meta !== undefined) { const n = Number(String(b.meta || '').replace(/\s/g, '').replace(',', '.')); o.meta = isFinite(n) && n > 0 ? n : null; }
    if (b.cumprido !== undefined) o.cumprido = Boolean(b.cumprido);
    return o;
  }

  app.post('/api/sonhos', async (req, res) => {
    try {
      const o = corpoSonho(Object.assign({ tipo: 'sonho', horizonte: 'cinco' }, req.body || {}));
      if (o.tipo === 'sonho' && !o.titulo) throw erro(400, 'Falta o nome do sonho.');
      if (o.tipo === 'pensamento' && !o.texto) throw erro(400, 'Falta o pensamento.');
      const k = Object.keys(o);
      const r = await all('INSERT INTO fam_sonhos (' + k.join(', ') + ') VALUES (' + k.map((x, i) => '$' + (i + 1)).join(', ') + ') RETURNING id', k.map((x) => o[x]));
      res.json({ id: r[0].id });
    } catch (e) { falha(res, e, 'guardar o sonho'); }
  });

  app.patch('/api/sonhos/:id(\\d+)', async (req, res) => {
    try {
      const o = corpoSonho(req.body || {});
      const k = Object.keys(o);
      if (k.length) {
        const vals = k.map((x) => o[x]); vals.push(Number(req.params.id));
        await query('UPDATE fam_sonhos SET ' + k.map((x, i) => x + ' = $' + (i + 1)).join(', ') + ' WHERE id = $' + vals.length, vals);
      }
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'gravar o sonho'); }
  });

  app.delete('/api/sonhos/:id(\\d+)', async (req, res) => {
    try { await query('DELETE FROM fam_sonhos WHERE id = $1', [Number(req.params.id)]); res.json({ ok: true }); }
    catch (e) { falha(res, e, 'apagar o sonho'); }
  });

  /* A fotografia chega ja encolhida pelo browser, como data URL. */
  app.post('/api/sonhos/:id(\\d+)/foto', async (req, res) => {
    try {
      const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String((req.body || {}).foto || ''));
      if (!m) throw erro(400, 'Isso não é uma imagem que eu saiba ler.');
      const bytes = Buffer.from(m[2], 'base64');
      if (bytes.length > MAX_FOTO) throw erro(400, 'A fotografia é grande de mais.');
      await query('UPDATE fam_sonhos SET foto = $2, foto_tipo = $3 WHERE id = $1', [Number(req.params.id), bytes, m[1]]);
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'guardar a fotografia'); }
  });

  app.get('/api/sonhos/:id(\\d+)/foto', async (req, res) => {
    try {
      const r = await all('SELECT foto, foto_tipo FROM fam_sonhos WHERE id = $1', [Number(req.params.id)]);
      if (!r.length || !r[0].foto) return res.status(404).end();
      res.set('Content-Type', r[0].foto_tipo || 'image/jpeg');
      res.set('Cache-Control', 'private, max-age=60');
      res.send(r[0].foto);
    } catch (e) { falha(res, e, 'ler a fotografia'); }
  });

  app.post('/api/sonhos/:id(\\d+)/passos', async (req, res) => {
    try {
      const b = req.body || {};
      const t = limpar(b.texto);
      if (!t) throw erro(400, 'Falta o passo.');
      const r = await all(`INSERT INTO fam_sonho_passos (sonho_id, texto, quando, ordem)
                           VALUES ($1, $2, $3, COALESCE((SELECT max(ordem) + 1 FROM fam_sonho_passos WHERE sonho_id = $1), 0)) RETURNING id`,
        [Number(req.params.id), t, limpar(b.quando)]);
      res.json({ id: r[0].id });
    } catch (e) { falha(res, e, 'guardar o passo'); }
  });

  app.patch('/api/sonhos/passos/:id(\\d+)', async (req, res) => {
    try {
      const b = req.body || {}; const sets = [], vals = [];
      if (b.texto !== undefined) { vals.push(limpar(b.texto)); sets.push('texto = $' + vals.length); }
      if (b.quando !== undefined) { vals.push(limpar(b.quando)); sets.push('quando = $' + vals.length); }
      if (b.feito !== undefined) { vals.push(Boolean(b.feito)); sets.push('feito = $' + vals.length); }
      if (b.task_id !== undefined) { vals.push(Number(b.task_id) || null); sets.push('task_id = $' + vals.length); }
      if (sets.length) { vals.push(Number(req.params.id)); await query('UPDATE fam_sonho_passos SET ' + sets.join(', ') + ' WHERE id = $' + vals.length, vals); }
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'gravar o passo'); }
  });

  app.delete('/api/sonhos/passos/:id(\\d+)', async (req, res) => {
    try { await query('DELETE FROM fam_sonho_passos WHERE id = $1', [Number(req.params.id)]); res.json({ ok: true }); }
    catch (e) { falha(res, e, 'apagar o passo'); }
  });
}

module.exports = { instalar, preparar };
