'use strict';
/**
 * Farol — Inbox (caixa de entrada)
 *
 * Captura sem decidir: entra um ficheiro ou uma nota, fica «por triar» até
 * alguém dizer o que é. A triagem transforma o item em tarefa, evento,
 * documento ou despesa — podendo ser mais do que um ao mesmo tempo.
 *
 * Dois buckets:
 *   farol-inbox    — o que ainda não foi triado. Volátil por natureza.
 *   farol-arquivo  — o que já foi catalogado e passou a valer alguma coisa.
 * A coluna inbox_items.store diz onde está o objecto neste momento.
 *
 * Tudo vive debaixo de /api, que é onde o auth.js instala o guarda da sessão.
 * Um endpoint de ficheiro fora de /api ficaria aberto ao mundo.
 */
const crypto = require('crypto');
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;
const limpar = (v) => (v === undefined || v === '' ? null : v);

const MAX_BYTES = 25 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });

const TIPOS = ['tarefa', 'evento', 'documento', 'despesa'];

/* ------------------------------------------------------------------ *
 * Buckets
 * ------------------------------------------------------------------ */
function config(prefixo) {
  return {
    bucket: process.env[prefixo + '_BUCKET_NAME'],
    endpoint: process.env[prefixo + '_BUCKET_ENDPOINT'],
    region: process.env[prefixo + '_BUCKET_REGION'] || 'auto',
    keyId: process.env[prefixo + '_BUCKET_KEY_ID'],
    secret: process.env[prefixo + '_BUCKET_SECRET']
  };
}

const CFG = { inbox: config('INBOX'), arquivo: config('ARQUIVO') };
const clientes = {};

const pronto = (qual) => {
  const c = CFG[qual];
  return Boolean(c && c.bucket && c.endpoint && c.keyId && c.secret);
};
const bucketPronto = () => pronto('inbox');

function cliente(qual) {
  if (!clientes[qual]) {
    const c = CFG[qual];
    clientes[qual] = new S3Client({
      region: c.region,
      endpoint: c.endpoint,
      // Os buckets do Railway usam URLs virtual-hosted (o nome do bucket vai
      // no subdomínio). Forçar path-style aqui partia todos os pedidos.
      credentials: { accessKeyId: c.keyId, secretAccessKey: c.secret }
    });
  }
  return clientes[qual];
}

// Nunca usar o nome original no caminho: evita colisões e evita ter dados
// pessoais escritos na chave do objecto.
function caminho(nomeOriginal) {
  const d = new Date();
  const ext = (nomeOriginal || '').includes('.')
    ? '.' + nomeOriginal.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
    : '';
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'),
    crypto.randomUUID() + ext].join('/');
}

async function guardar(qual, chave, buffer, mime) {
  await cliente(qual).send(new PutObjectCommand({
    Bucket: CFG[qual].bucket, Key: chave, Body: buffer, ContentType: mime || 'application/octet-stream'
  }));
}

async function ler(qual, chave) {
  return cliente(qual).send(new GetObjectCommand({ Bucket: CFG[qual].bucket, Key: chave }));
}

async function apagar(qual, chave) {
  await cliente(qual).send(new DeleteObjectCommand({ Bucket: CFG[qual].bucket, Key: chave }));
}

const bytes = async (stream) => {
  const partes = [];
  for await (const p of stream) partes.push(p);
  return Buffer.concat(partes);
};

/**
 * Passa o objecto do bucket temporário para o de arquivo.
 *
 * Não uso CopyObject: cada bucket tem credenciais próprias e a cópia
 * servidor-a-servidor precisaria que uma delas visse os dois. Lê e volta a
 * escrever, que com ficheiros até 25 MB é irrelevante.
 */
async function arquivar(chave, mime) {
  if (!pronto('arquivo')) return false;
  const obj = await ler('inbox', chave);
  await guardar('arquivo', chave, await bytes(obj.Body), mime);
  await apagar('inbox', chave).catch((e) => console.warn('[farol] temporário não limpo:', e.message));
  return true;
}

/* ------------------------------------------------------------------ *
 * Triagem — cada destino sabe criar-se a si próprio
 * ------------------------------------------------------------------ */
const CRIAR = {
  async tarefa(d) {
    const title = String(d.title || '').trim();
    if (!title) throw new Error('A tarefa precisa de um título.');
    const rows = await all(
      `INSERT INTO tasks (title, notes, area, project_id, owner_id, status, priority,
                          due_on, due_time, done, origin, scope)
       VALUES ($1,$2,$3,$4,$5,'aberta',$6,$7,$8,FALSE,'real',NULL) RETURNING id`,
      [title, limpar(d.notes), limpar(d.area), limpar(d.project_id), limpar(d.owner_id),
       d.priority || 'normal', limpar(d.due_on), limpar(d.due_time)]);
    for (const pid of d.subjects || []) {
      await query('INSERT INTO task_subjects (task_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [rows[0].id, Number(pid)]);
    }
    return rows[0].id;
  },

  async evento(d) {
    const title = String(d.title || '').trim();
    if (!title) throw new Error('O evento precisa de um título.');
    if (!d.day) throw new Error('O evento precisa de uma data.');
    // events.calendar é NOT NULL e aponta para calendars(code). Garantimos um
    // calendário próprio para o que é real, sem depender dos do seed.
    await query(
      `INSERT INTO calendars (code, name, color, sort) VALUES ('farol','Farol','var(--c1)',99)
       ON CONFLICT (code) DO NOTHING`);
    const rows = await all(
      `INSERT INTO events (day, at, title, calendar, detail, origin)
       VALUES ($1,$2,$3,$4,$5,'real') RETURNING id`,
      [d.day, limpar(d.at), title, d.calendar || 'farol', limpar(d.detail)]);
    return rows[0].id;
  },

  async documento(d) {
    const name = String(d.name || '').trim();
    if (!name) throw new Error('O documento precisa de um nome.');
    const rows = await all(
      `INSERT INTO documents (name, entity, valid_on, valid_until, person_id, origin)
       VALUES ($1,$2,$3,$4,$5,'real') RETURNING id`,
      [name, limpar(d.entity), limpar(d.valid_on), limpar(d.valid_on), limpar(d.person_id)]);
    return rows[0].id;
  },

  async despesa(d) {
    const description = String(d.description || '').trim();
    if (!description) throw new Error('A despesa precisa de uma descrição.');
    if (d.amount === undefined || d.amount === null || d.amount === '') {
      throw new Error('A despesa precisa de um valor.');
    }
    const rows = await all(
      `INSERT INTO expenses (description, amount, spent_on, merchant, category,
                             person_id, project_id, note, origin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'real') RETURNING id`,
      [description, Number(d.amount), d.spent_on || new Date(), limpar(d.merchant),
       limpar(d.category), limpar(d.person_id), limpar(d.project_id), limpar(d.note)]);
    return rows[0].id;
  }
};

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */
const SELECT_ITEM = `
  SELECT i.id, i.kind, i.title, i.note, i.file_name, i.mime_type, i.byte_size, i.store,
         i.captured_by, to_char(i.captured_at,'YYYY-MM-DD"T"HH24:MI') AS captured_at,
         i.status, to_char(i.resolved_at,'YYYY-MM-DD"T"HH24:MI') AS resolved_at
    FROM inbox_items i`;

async function carregar(estado) {
  const where = estado && estado !== 'todos' ? 'WHERE i.status = $1' : '';
  const itens = await all(`${SELECT_ITEM} ${where} ORDER BY i.captured_at DESC, i.id DESC`,
    where ? [estado] : []);
  const [{ n }] = await all("SELECT count(*)::int AS n FROM inbox_items WHERE status = 'por_triar'");
  if (!itens.length) return { itens: [], porTriar: n };
  const ligacoes = await all(
    'SELECT inbox_id, target_type, target_id FROM inbox_links WHERE inbox_id = ANY($1)',
    [itens.map((i) => i.id)]);
  itens.forEach((i) => {
    i.links = ligacoes.filter((l) => l.inbox_id === i.id)
      .map((l) => ({ tipo: l.target_type, id: l.target_id }));
  });
  return { itens, porTriar: n };
}

/* ------------------------------------------------------------------ *
 * Rotas
 * ------------------------------------------------------------------ */
function instalar(app) {
  app.get('/api/inbox', async (req, res) => {
    try {
      res.json(await carregar(req.query.estado || 'por_triar'));
    } catch (err) {
      console.error('[farol] GET /api/inbox:', err.message);
      res.status(500).json({ error: 'Não foi possível ler a caixa de entrada.' });
    }
  });

  app.post('/api/inbox', upload.single('ficheiro'), async (req, res) => {
    const b = req.body || {};
    const f = req.file;
    if (!f && !String(b.note || '').trim() && !String(b.title || '').trim()) {
      return res.status(400).json({ error: 'Envia um ficheiro ou escreve alguma coisa.' });
    }
    if (f && !bucketPronto()) {
      return res.status(503).json({ error: 'O armazenamento de ficheiros ainda não está configurado.' });
    }
    try {
      let chave = null, checksum = null;
      if (f) {
        checksum = crypto.createHash('sha256').update(f.buffer).digest('hex');
        const repetido = await all(
          "SELECT id FROM inbox_items WHERE checksum = $1 AND status <> 'descartado' LIMIT 1", [checksum]);
        if (repetido.length) {
          return res.status(409).json({ error: 'Este ficheiro já está na caixa de entrada.', id: repetido[0].id });
        }
        chave = caminho(f.originalname);
        await guardar('inbox', chave, f.buffer, f.mimetype);
      }
      const rows = await all(
        `INSERT INTO inbox_items (kind, title, note, file_path, file_name, mime_type,
                                  byte_size, checksum, captured_by, store)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'inbox') RETURNING id`,
        [f ? 'ficheiro' : 'nota', limpar(b.title), limpar(b.note), chave,
         f ? f.originalname : null, f ? f.mimetype : null, f ? f.size : null,
         checksum, limpar(b.captured_by)]);
      const { itens } = await carregar('todos');
      res.status(201).json(itens.find((i) => i.id === rows[0].id));
    } catch (err) {
      console.error('[farol] POST /api/inbox:', err.message);
      res.status(500).json({ error: 'Não foi possível guardar.' });
    }
  });

  // Debaixo de /api de propósito: herda o guarda da sessão do auth.js.
  app.get('/api/inbox/:id/ficheiro', async (req, res) => {
    try {
      const rows = await all(
        'SELECT file_path, file_name, mime_type, store FROM inbox_items WHERE id = $1',
        [Number(req.params.id)]);
      if (!rows.length || !rows[0].file_path) return res.status(404).json({ error: 'Sem ficheiro.' });
      const obj = await ler(rows[0].store || 'inbox', rows[0].file_path);
      res.setHeader('Content-Type', rows[0].mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition',
        'inline; filename="' + encodeURIComponent(rows[0].file_name || 'ficheiro') + '"');
      res.setHeader('Cache-Control', 'private, max-age=0, no-store');
      obj.Body.pipe(res);
    } catch (err) {
      console.error('[farol] GET ficheiro:', err.message);
      res.status(500).json({ error: 'Não foi possível ler o ficheiro.' });
    }
  });

  app.patch('/api/inbox/:id', async (req, res) => {
    const b = req.body || {};
    const campos = [], valores = [];
    ['title', 'note'].forEach((c) => {
      if (b[c] !== undefined) { campos.push(c + ' = $' + (campos.length + 1)); valores.push(limpar(b[c])); }
    });
    if (b.status === 'descartado' || b.status === 'por_triar') {
      campos.push('status = $' + (campos.length + 1)); valores.push(b.status);
    }
    if (!campos.length) return res.status(400).json({ error: 'Nada para alterar.' });
    try {
      valores.push(Number(req.params.id));
      const rows = await all(
        `UPDATE inbox_items SET ${campos.join(', ')} WHERE id = $${valores.length} RETURNING id`, valores);
      if (!rows.length) return res.status(404).json({ error: 'Item não encontrado.' });
      res.json(await carregar(req.query.estado || 'por_triar'));
    } catch (err) {
      console.error('[farol] PATCH /api/inbox:', err.message);
      res.status(500).json({ error: 'Não foi possível gravar.' });
    }
  });

  /**
   * Triagem. Corpo:
   *   { destinos: [ { tipo: 'despesa',   dados: { description, amount, spent_on } },
   *                 { tipo: 'documento', dados: { name, valid_on } } ] }
   *
   * A parte da base de dados é uma transacção: ou o item fica catalogado com
   * todos os destinos criados, ou não muda nada. Meia triagem seria pior do
   * que nenhuma.
   *
   * A mudança de bucket fica FORA da transacção, e de propósito. Se falhar, o
   * ficheiro continua no bucket temporário e o store diz isso — é recuperável.
   * Se estivesse dentro, uma falha do S3 desfazia uma triagem já correcta.
   */
  app.post('/api/inbox/:id/triagem', async (req, res) => {
    const id = Number(req.params.id);
    const destinos = (req.body || {}).destinos;
    if (!Array.isArray(destinos) || !destinos.length) {
      return res.status(400).json({ error: 'Diz pelo menos no que se transforma.' });
    }
    for (const d of destinos) {
      if (!TIPOS.includes(d.tipo)) return res.status(400).json({ error: 'Destino desconhecido: ' + d.tipo });
    }
    let item;
    try {
      await query('BEGIN');
      const linhas = await all(
        'SELECT id, file_path, mime_type, store FROM inbox_items WHERE id = $1 FOR UPDATE', [id]);
      if (!linhas.length) { await query('ROLLBACK'); return res.status(404).json({ error: 'Item não encontrado.' }); }
      item = linhas[0];

      const criados = [];
      for (const d of destinos) {
        const novoId = await CRIAR[d.tipo](d.dados || {});
        await query(
          `INSERT INTO inbox_links (inbox_id, target_type, target_id) VALUES ($1,$2,$3)
           ON CONFLICT DO NOTHING`, [id, d.tipo, novoId]);
        criados.push({ tipo: d.tipo, id: novoId });
      }
      await query("UPDATE inbox_items SET status = 'catalogado', resolved_at = now() WHERE id = $1", [id]);
      await query('COMMIT');

      if (item.file_path && item.store === 'inbox') {
        try {
          if (await arquivar(item.file_path, item.mime_type)) {
            await query("UPDATE inbox_items SET store = 'arquivo' WHERE id = $1", [id]);
          }
        } catch (e) {
          console.warn('[farol] item', id, 'catalogado mas não arquivado:', e.message);
        }
      }
      res.json({ criados, ...(await carregar(req.query.estado || 'por_triar')) });
    } catch (err) {
      await query('ROLLBACK').catch(() => {});
      console.error('[farol] POST triagem:', err.message);
      res.status(400).json({ error: err.message || 'Não foi possível catalogar.' });
    }
  });

  app.delete('/api/inbox/:id', async (req, res) => {
    try {
      const rows = await all(
        'DELETE FROM inbox_items WHERE id = $1 RETURNING file_path, store', [Number(req.params.id)]);
      if (!rows.length) return res.status(404).json({ error: 'Item não encontrado.' });
      const { file_path: chave, store } = rows[0];
      if (chave && pronto(store || 'inbox')) {
        await apagar(store || 'inbox', chave).catch((e) => console.warn('[farol] objecto não apagado:', e.message));
      }
      res.json(await carregar(req.query.estado || 'por_triar'));
    } catch (err) {
      console.error('[farol] DELETE /api/inbox:', err.message);
      res.status(500).json({ error: 'Não foi possível apagar.' });
    }
  });
}

module.exports = { instalar, bucketPronto, arquivoPronto: () => pronto('arquivo') };
