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
const ia = require('./ia');

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
/* O modelo devolve datas com cauda: «2031-08-03Portal do Cidadao / Cartao...».
   Uma coluna DATE rejeita isso e a catalogacao morre calada. Fica so a data
   se ela estiver la ao principio; se nao estiver, fica vazio. */
function soData(v) {
  const m = /^\s*(\d{4}-\d{2}-\d{2})/.exec(String(v == null ? '' : v));
  return m ? m[1] : null;
}

const CRIAR = {
  async tarefa(d) {
    const title = String(d.title || '').trim();
    if (!title) throw new Error('A tarefa precisa de um título.');
    const rows = await all(
      `INSERT INTO tasks (title, notes, context_id, project_id, owner_id, status, priority,
                          starts_on, due_on, due_time, done, origin, scope)
       VALUES ($1,$2,$3,$4,$5,'aberta',$6,CURRENT_DATE,$7,$8,FALSE,'real',NULL) RETURNING id`,
      [title, limpar(d.notes), limpar(d.context_id), limpar(d.project_id), limpar(d.owner_id),
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
    /* valid_until era o rotulo antigo, texto solto; fica igual ao valid_on para
       os ecras que ainda o leem. A data do documento tem coluna propria. */
    const rows = await all(
      `INSERT INTO documents (name, entity, kind, context_id, issued_on, valid_on,
                              valid_until, person_id, origin, aprovado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'real',FALSE) RETURNING id`,
      [name, limpar(d.entity), limpar(d.kind), limpar(d.context_id),
       soData(d.issued_on), soData(d.valid_on), soData(d.valid_on), limpar(d.person_id)]);
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
                             context_id, person_id, project_id, note, origin, aprovado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'real',FALSE) RETURNING id`,
      [description, Number(d.amount), soData(d.spent_on) || new Date(), limpar(d.merchant),
       limpar(d.category), limpar(d.context_id), limpar(d.person_id),
       limpar(d.project_id), limpar(d.note)]);
    return rows[0].id;
  }
};

/* O que precisa de uma aprovacao antes de aparecer nos ecras, e onde mora. */
const APROVAVEIS = { documento: 'documents', despesa: 'expenses' };

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */
const SELECT_ITEM = `
  SELECT i.id, i.kind, i.title, i.note, i.file_name, i.mime_type, i.byte_size, i.store, i.ai_status, i.ai_json, i.ai_erro,
         i.person_id, i.captured_by, to_char(i.captured_at,'YYYY-MM-DD"T"HH24:MI') AS captured_at,
         i.status, to_char(i.resolved_at,'YYYY-MM-DD"T"HH24:MI') AS resolved_at,
         to_char(i.approved_at,'YYYY-MM-DD"T"HH24:MI') AS approved_at
    FROM inbox_items i`;

async function carregar(estado) {
  const where = estado && estado !== 'todos' ? 'WHERE i.status = $1' : '';
  const itens = await all(`${SELECT_ITEM} ${where} ORDER BY i.captured_at DESC, i.id DESC`,
    where ? [estado] : []);
  const [{ n }] = await all("SELECT count(*)::int AS n FROM inbox_items WHERE status = 'por_triar'");
  /* Duas filas, dois numeros: o que ainda ninguem leu e o que ja esta lido a
     espera de uma decisao. */
  const [{ a }] = await all(
    "SELECT count(*)::int AS a FROM inbox_items WHERE status = 'catalogado' AND approved_at IS NULL");
  if (!itens.length) return { itens: [], porTriar: n, porAprovar: a };
  const ligacoes = await all(
    'SELECT inbox_id, target_type, target_id FROM inbox_links WHERE inbox_id = ANY($1)',
    [itens.map((i) => i.id)]);
  itens.forEach((i) => {
    i.links = ligacoes.filter((l) => l.inbox_id === i.id)
      .map((l) => ({ tipo: l.target_type, id: l.target_id }));
  });
  return { itens, porTriar: n, porAprovar: a };
}

/* ------------------------------------------------------------------ *
 * Rotas
 * ------------------------------------------------------------------ */
/* O mesmo caminho serve a triagem à mão e a automática: há uma só maneira de
   um item da caixa se transformar em coisas. */
async function executarTriagem(id, destinos) {
  for (const d of destinos) {
    if (!TIPOS.includes(d.tipo)) throw new Error('Destino desconhecido: ' + d.tipo);
  }
  await query('BEGIN');
  try {
    const linhas = await all(
      'SELECT id, file_path, mime_type, store FROM inbox_items WHERE id = $1 FOR UPDATE', [id]);
    if (!linhas.length) throw new Error('Item não encontrado.');
    const item = linhas[0];

    const criados = [];
    for (const d of destinos) {
      const novoId = await CRIAR[d.tipo](d.dados || {});
      await query(
        `INSERT INTO inbox_links (inbox_id, target_type, target_id) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`, [id, d.tipo, novoId]);
      criados.push({ tipo: d.tipo, id: novoId });
    }
    await query("UPDATE inbox_items SET status = 'catalogado', resolved_at = now() WHERE id = $1", [id]);
    /* So documentos e despesas esperam por uma aprovacao. Uma tarefa ou um
       evento sao para agir agora: ficam aprovados a nascenca, senao o numero
       no menu passava a vida a pedir uma decisao que nao existe. */
    if (!criados.some((c) => APROVAVEIS[c.tipo])) {
      await query('UPDATE inbox_items SET approved_at = now() WHERE id = $1', [id]);
    }
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
    return criados;
  } catch (err) {
    await query('ROLLBACK').catch(() => {});
    throw err;
  }
}

/* ---------------- catalogação automática ---------------- */
/* Só avança sozinho quando o modelo diz que leu, não quando deduziu. Um
   destino de confiança média, ou a que falte o essencial, fica por triar:
   mais vale dar trabalho a alguém do que escrever uma despesa errada em
   silêncio. */
const CAMPOS_MINIMOS = {
  tarefa: (x) => Boolean(x.title),
  evento: (x) => Boolean(x.title && x.day),
  /* A entidade continua a ser metade do que se procura num papel velho, mas
     deixou de travar a catalogacao: agora ha um passo de aprovacao, e um
     documento sem entidade chega la marcado como incompleto em vez de ficar
     preso na caixa sem ninguem perceber porque. */
  documento: (x) => Boolean(x.name),
  despesa: (x) => Boolean(x.description) && x.amount !== undefined && x.amount !== null && x.amount !== ''
};

/* Acentos e maiusculas nao podem decidir de quem e um papel. */
function semAcentos(s) {
  return String(s || '').normalize('NFD').split('')
    .filter((c) => { const n = c.charCodeAt(0); return n < 768 || n > 879; })
    .join('').toLowerCase().trim();
}

/* O papel diz «Ana Lúcia Garcia»; aqui dentro a pessoa chama-se «Ana Lúcia».
   Por isso compara-se nos dois sentidos, e ganha o encontro mais longo: assim
   «Maria» nunca rouba o lugar a quem tenha Maria no meio do nome. */
async function pessoaPorNome(nome) {
  const alvo = semAcentos(nome);
  if (alvo.length < 3) return null;
  const pessoas = await all('SELECT id, name, full_name FROM people WHERE active');
  let melhor = null;
  for (const p of pessoas) {
    for (const cru of [p.name, p.full_name]) {
      const c = semAcentos(cru);
      if (c.length < 3) continue;
      if (c === alvo || alvo.indexOf(c) >= 0 || c.indexOf(alvo) >= 0) {
        if (!melhor || c.length > melhor.tamanho) melhor = { id: p.id, tamanho: c.length };
      }
    }
  }
  return melhor ? melhor.id : null;
}

/* A area vem como texto, as vezes com o pai a frente («Patrimonio > Carro»).
   Compara-se so a ultima parte, sem acentos, contra os nomes que existem. */
async function contextoPorNome(nome) {
  const cru = String(nome || '').split('>').pop();
  const alvo = semAcentos(cru);
  if (alvo.length < 3) return null;
  const areas = await all('SELECT id, name FROM contexts WHERE active');
  let melhor = null;
  for (const c of areas) {
    const n = semAcentos(c.name);
    if (n.length < 3) continue;
    if (n === alvo || alvo.indexOf(n) >= 0 || n.indexOf(alvo) >= 0) {
      if (!melhor || n.length > melhor.tamanho) melhor = { id: c.id, tamanho: n.length };
    }
  }
  return melhor ? melhor.id : null;
}

async function nomeDaPessoa(pid) {
  if (!pid) return null;
  const rows = await all('SELECT name FROM people WHERE id = $1', [pid]);
  return rows.length ? rows[0].name : null;
}

/* O nome de quem e faz parte do titulo: e assim que se encontra um papel seis
   meses depois, sem abrir nada. So se junta se ainda la nao estiver. */
function comPessoa(titulo, pessoa) {
  const t = String(titulo || '').trim();
  if (!t || !pessoa) return t;
  if (semAcentos(t).indexOf(semAcentos(pessoa)) >= 0) return t;
  return (t + ' \u2014 ' + pessoa).slice(0, 160);
}

/* O modelo devolve um nome de pessoa e notas; as tabelas querem ids e outros
   nomes de campo. É aqui que se faz a tradução. */
async function paraDestino(d) {
  const dados = Object.assign({}, d.dados || {});
  const cid = await contextoPorNome(dados.area);
  if (cid) dados.context_id = cid;
  delete dados.area;
  const pid = await pessoaPorNome(dados.pessoa);
  if (pid) {
    if (d.tipo === 'documento' || d.tipo === 'despesa') dados.person_id = pid;
    if (d.tipo === 'tarefa') dados.subjects = [pid];
  }
  if (d.tipo === 'despesa' && dados.notes && !dados.note) dados.note = dados.notes;
  if (d.tipo === 'evento' && dados.notes && !dados.detail) dados.detail = dados.notes;
  delete dados.pessoa;
  return { tipo: d.tipo, dados: dados };
}

function tituloDaProposta(proposta) {
  const d = (proposta.destinos || [])[0];
  const x = (d && d.dados) || {};
  const t = x.name || x.title || x.description || proposta.resumo || '';
  return String(t).trim().slice(0, 120) || null;
}

async function autoCatalogar(id, proposta) {
  if (!proposta || !Array.isArray(proposta.destinos) || !proposta.destinos.length) return null;

  /* Ler outra vez um item ja catalogado serve para melhorar a proposta, nao
     para arrumar tudo de novo: sem esta guarda nascia um documento duplicado
     a cada leitura. */
  const estado = await all('SELECT status FROM inbox_items WHERE id = $1', [id]);
  if (!estado.length || estado[0].status !== 'por_triar') {
    console.log('[farol] item', id, 'ja estava triado: a proposta fica guardada, mais nada');
    return null;
  }

  /* O nome do ficheiro em bruto deixa de ser o título, mesmo que o item fique
     por triar. Só se escreve se ninguém tiver escrito um. */
  /* De quem e o ficheiro. O modelo escreve um nome; aqui vira uma pessoa da
     casa, fica agarrada ao item e entra no titulo. */
  const nomeLido = proposta.destinos
    .map((d) => (d && d.dados && d.dados.pessoa) || '')
    .filter(Boolean)[0] || null;
  const pid = await pessoaPorNome(nomeLido);
  const pessoa = await nomeDaPessoa(pid);
  if (pid) {
    await query('UPDATE inbox_items SET person_id = COALESCE(person_id, $2) WHERE id = $1',
      [id, pid]).catch(() => {});
  }

  const titulo = comPessoa(tituloDaProposta(proposta), pessoa);
  if (titulo) {
    await query("UPDATE inbox_items SET title = COALESCE(NULLIF(title, ''), $2) WHERE id = $1",
      [id, titulo]).catch(() => {});
  }

  const bons = proposta.destinos.filter((d) =>
    d && d.confianca === 'alta' && TIPOS.includes(d.tipo) && CAMPOS_MINIMOS[d.tipo](d.dados || {}));
  if (!bons.length || bons.length !== proposta.destinos.length) {
    console.log('[farol] item', id, 'fica por triar: confiança ou campos em falta');
    return null;
  }

  try {
    const destinos = [];
    for (const d of bons) destinos.push(await paraDestino(d));
    const criados = await executarTriagem(id, destinos);
    console.log('[farol] item', id, 'catalogado sozinho:', criados.map((c) => c.tipo).join(', '));
    return criados;
  } catch (err) {
    console.warn('[farol] item', id, 'não deu para catalogar sozinho:', err.message);
    return null;
  }
}

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
                                  byte_size, checksum, captured_by, store, ai_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'inbox',$10) RETURNING id`,
        [f ? 'ficheiro' : 'nota', limpar(b.title), limpar(b.note), chave,
         f ? f.originalname : null, f ? f.mimetype : null, f ? f.size : null,
         checksum, limpar(b.captured_by), (f && ia.ativa()) ? 'pendente' : 'nenhum']);
      // A analise corre a seguir a resposta, nao antes: quem envia uma foto
      // nao deve esperar pelo modelo. O ecra mostra 'a analisar' e actualiza.
      if (f) {
        ia.analisarItem(rows[0].id, f.buffer, f.mimetype, f.originalname)
          .then((proposta) => autoCatalogar(rows[0].id, proposta))
          .catch((e) => console.warn('[farol] análise e catalogação:', e.message));
      }

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
  /* A análise pode falhar por carga do modelo, e nesse caso não é preciso
     voltar a carregar o ficheiro: ele continua no balde. */
  app.post('/api/inbox/:id/analisar', async (req, res) => {
    const id = Number(req.params.id);
    try {
      if (!ia.ativa()) return res.status(400).json({ error: 'A leitura automática está desligada.' });
      const linhas = await all(
        'SELECT id, file_path, file_name, mime_type, store FROM inbox_items WHERE id = $1', [id]);
      if (!linhas.length) return res.status(404).json({ error: 'Item não encontrado.' });
      const it = linhas[0];
      if (!it.file_path) return res.status(400).json({ error: 'Este item não tem ficheiro para ler.' });

      await query("UPDATE inbox_items SET ai_status = 'pendente', ai_erro = NULL WHERE id = $1", [id]);
      const obj = await ler(it.store || 'inbox', it.file_path);
      const buffer = await bytes(obj.Body);
      ia.analisarItem(id, buffer, it.mime_type, it.file_name)
        .then((proposta) => autoCatalogar(id, proposta))
        .catch((e) => console.warn('[farol] nova análise:', e.message));

      res.json(await carregar(req.query.estado || 'por_triar'));
    } catch (err) {
      console.error('[farol] POST analisar:', err.message);
      res.status(400).json({ error: err.message || 'Não foi possível tentar outra vez.' });
    }
  });

  /* Relacionar o ficheiro com uma pessoa a mao, quando a leitura automatica
     nao chegou la. Arruma o item, o titulo e o que ja nasceu dele: sem esta
     ultima parte o documento ficava orfao no ecra dos Documentos. */
  app.patch('/api/inbox/:id/pessoa', async (req, res) => {
    const id = Number(req.params.id);
    const corpo = req.body || {};
    const pid = corpo.person_id ? Number(corpo.person_id) : null;
    try {
      const item = await all('SELECT id, title FROM inbox_items WHERE id = $1', [id]);
      if (!item.length) return res.status(404).json({ error: 'Item nao encontrado.' });
      const pessoa = await nomeDaPessoa(pid);
      if (pid && !pessoa) return res.status(404).json({ error: 'Essa pessoa nao existe.' });

      await query('UPDATE inbox_items SET person_id = $2 WHERE id = $1', [id, pid]);
      if (pessoa && item[0].title) {
        await query('UPDATE inbox_items SET title = $2 WHERE id = $1',
          [id, comPessoa(item[0].title, pessoa)]);
      }

      const links = await all(
        'SELECT target_type, target_id FROM inbox_links WHERE inbox_id = $1', [id]);
      for (const l of links) {
        if (l.target_type === 'documento') {
          await query('UPDATE documents SET person_id = $2 WHERE id = $1', [l.target_id, pid]);
        } else if (l.target_type === 'despesa') {
          await query('UPDATE expenses SET person_id = $2 WHERE id = $1', [l.target_id, pid]);
        } else if (l.target_type === 'tarefa' && pid) {
          await query('INSERT INTO task_subjects (task_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [l.target_id, pid]);
        }
      }

      res.json(await carregar(req.query.estado || 'por_triar'));
    } catch (err) {
      console.error('[farol] PATCH pessoa:', err.message);
      res.status(400).json({ error: 'Nao foi possivel relacionar a pessoa.' });
    }
  });

  app.post('/api/inbox/:id/triagem', async (req, res) => {
    const id = Number(req.params.id);
    const destinos = (req.body || {}).destinos;
    if (!Array.isArray(destinos) || !destinos.length) {
      return res.status(400).json({ error: 'Diz pelo menos no que se transforma.' });
    }
    try {
      const criados = await executarTriagem(id, destinos);
      res.json({ criados, ...(await carregar(req.query.estado || 'por_triar')) });
    } catch (err) {
      console.error('[farol] POST triagem:', err.message);
      res.status(400).json({ error: err.message || 'Não foi possível catalogar.' });
    }
  });
  /* Catalogar e um palpite da maquina; aprovar e uma decisao de quem manda.
     So aqui e que o documento passa a existir para o resto da app. */
  app.post('/api/inbox/:id/aprovar', async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Falta dizer o que aprovar.' });
    try {
      const item = await all(
        "SELECT status, approved_at FROM inbox_items WHERE id = $1", [id]);
      if (!item.length) return res.status(404).json({ error: 'Item nao encontrado.' });
      if (item[0].status !== 'catalogado') {
        return res.status(400).json({ error: 'So se aprova o que ja foi catalogado.' });
      }

      const ligados = await all(
        'SELECT target_type, target_id FROM inbox_links WHERE inbox_id = $1', [id]);
      for (const l of ligados) {
        const tabela = APROVAVEIS[l.target_type];
        if (tabela) {
          await query('UPDATE ' + tabela + ' SET aprovado = TRUE WHERE id = $1', [l.target_id]);
        }
      }
      await query('UPDATE inbox_items SET approved_at = now() WHERE id = $1', [id]);
      console.log('[farol] item', id, 'aprovado:', ligados.map((l) => l.target_type).join(', '));
      res.json({ ok: true, id, ...(await carregar(req.query.estado || 'catalogado')) });
    } catch (err) {
      console.error('[farol] POST aprovar:', err.message);
      res.status(500).json({ error: 'Nao foi possivel aprovar.' });
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
