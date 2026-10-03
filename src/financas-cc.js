'use strict';
/**
 * Farol - contas correntes com as pessoas.
 *
 * Com quem se divide dinheiro, quanto deve cada um. Quem esta no Splitwise
 * acerta-se sozinho ao fim do dia: o Farol le as despesas de todos os grupos e,
 * de cada uma, o que cada pessoa deve ao Marco ou ele a ela (os «repayments»
 * que o proprio Splitwise calcula por despesa). Quem nao esta no Splitwise - a
 * empresa, os pais - tem lancamentos a mao. E um movimento do banco pode ir
 * para a conta corrente de alguem (uma transferencia que acerta contas).
 *
 * As contas pequenas (um jantar pago pelo Marco e dividido) nao passam pelo
 * Splitwise: o movimento divide-se no Farol, a parte de cada um fica na conta
 * corrente dele (origem 'partilha') e a transferencia com que devolve liga-se
 * como reembolso (origem 'reembolso'). Estas contam sempre, tambem para quem
 * esta no Splitwise, porque o Splitwise nunca as viu.
 *
 * valor com sinal, do lado do Marco: positivo, a pessoa deve-lhe; negativo,
 * deve ele.
 */
const { query, pool } = require('./db');
const splitwise = require('./splitwise');

const all = async (sql, params) => (await query(sql, params)).rows;
const cent = (v) => Math.round(Number(v || 0) * 100) / 100;
function erro(codigo, msg) { const e = new Error(msg); e.status = codigo; return e; }
const nomeDe = (u) => [u && u.first_name, u && u.last_name].filter(Boolean).join(' ').trim() || (u && u.email) || ('#' + (u && u.id));

async function lerSetting(k) {
  const r = (await all('SELECT value FROM settings WHERE key = $1', [k]))[0];
  return r ? r.value : null;
}
async function gravarSetting(k, v) {
  await query(`INSERT INTO settings (key, value) VALUES ($1, $2)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [k, v]);
}

/* ---------------- Splitwise ---------------- */
let A_CORRER = null;
async function sincronizar(opcoes) {
  if (A_CORRER) return A_CORRER;
  A_CORRER = (async () => {
    if (!splitwise.pedir || !(await splitwise.ativo())) return { ok: false, motivo: 'O Splitwise não está ligado.' };
    const tudo = opcoes && opcoes.tudo;
    const eu = await splitwise.pedir('/get_current_user');
    const meu = Number(eu && eu.user && eu.user.id);
    if (!meu) throw new Error('O Splitwise não disse quem és.');

    /* Os nomes dos grupos, para dizer de onde vem cada divida. */
    const gr = await splitwise.pedir('/get_groups');
    const nomesGrupo = {};
    ((gr && gr.groups) || []).forEach((g) => { nomesGrupo[Number(g.id)] = g.id === 0 ? 'Sem grupo' : g.name; });

    /* Os amigos trazem o saldo de cada um, que e a referencia. */
    const fr = await splitwise.pedir('/get_friends');
    const pessoas = {};
    for (const f of ((fr && fr.friends) || [])) {
      const saldo = cent((f.balance || []).filter((b) => b.currency_code === 'EUR').reduce((s, b) => s + Number(b.amount), 0));
      const porGrupo = (f.groups || []).map((g) => ({
        id: Number(g.group_id), nome: nomesGrupo[Number(g.group_id)] || ('#' + g.group_id),
        saldo: cent((g.balance || []).filter((b) => b.currency_code === 'EUR').reduce((s, b) => s + Number(b.amount), 0))
      })).filter((g) => Math.abs(g.saldo) >= 0.01);
      const r = (await all(
        `INSERT INTO fin_cc_pessoas (nome, splitwise_id, saldo_splitwise, por_grupo, lido_em)
         VALUES ($1, $2, $3, $4::jsonb, now())
         ON CONFLICT (splitwise_id) DO UPDATE SET saldo_splitwise = EXCLUDED.saldo_splitwise,
           por_grupo = EXCLUDED.por_grupo, lido_em = now()
         RETURNING id`, [nomeDe(f), Number(f.id), saldo, JSON.stringify(porGrupo)]))[0];
      pessoas[Number(f.id)] = r.id;
    }

    const quem = async (uid, u) => {
      if (pessoas[uid]) return pessoas[uid];
      const r = (await all(
        `INSERT INTO fin_cc_pessoas (nome, splitwise_id, saldo_splitwise, lido_em) VALUES ($1, $2, 0, now())
         ON CONFLICT (splitwise_id) DO UPDATE SET lido_em = now() RETURNING id`, [nomeDe(u || { id: uid }), uid]))[0];
      pessoas[uid] = r.id;
      return r.id;
    };

    /* As despesas: da primeira vez todas, depois so as que mudaram desde a
       ultima leitura (um dia de folga, para nao perder nada no limite). */
    const ultima = tudo ? null : await lerSetting('fin_cc_sync_em');
    let desde = '';
    if (ultima) { const d = new Date(ultima); d.setDate(d.getDate() - 1); desde = '&updated_after=' + encodeURIComponent(d.toISOString()); }
    let lidas = 0, offset = 0;
    for (;;) {
      const j = await splitwise.pedir('/get_expenses?limit=200&offset=' + offset + desde);
      const lista = (j && j.expenses) || [];
      for (const e of lista) {
        lidas++;
        if (e.currency_code && e.currency_code !== 'EUR') continue;
        const usuarios = {};
        (e.users || []).forEach((u) => { usuarios[Number(u.user_id || (u.user && u.user.id))] = u.user; });
        const porPessoa = {};
        for (const r of (e.repayments || [])) {
          const de = Number(r.from), para = Number(r.to), v = cent(r.amount);
          if (para === meu && de !== meu) porPessoa[de] = cent((porPessoa[de] || 0) + v);
          else if (de === meu && para !== meu) porPessoa[para] = cent((porPessoa[para] || 0) - v);
        }
        const tocados = [];
        for (const uid of Object.keys(porPessoa)) {
          const pid = await quem(Number(uid), usuarios[uid]);
          tocados.push(pid);
          await query(
            `INSERT INTO fin_cc_mov (pessoa_id, data, descricao, valor, origem, splitwise_expense_id, grupo, grupo_id, total, pagamento, apagado)
             VALUES ($1, $2, $3, $4, 'splitwise', $5, $6, $7, $8, $9, $10)
             ON CONFLICT (pessoa_id, splitwise_expense_id) WHERE splitwise_expense_id IS NOT NULL
             DO UPDATE SET data = EXCLUDED.data, descricao = EXCLUDED.descricao, valor = EXCLUDED.valor,
               grupo = EXCLUDED.grupo, grupo_id = EXCLUDED.grupo_id, total = EXCLUDED.total,
               pagamento = EXCLUDED.pagamento, apagado = EXCLUDED.apagado`,
            [pid, String(e.date || e.created_at).slice(0, 10), e.description || (e.payment ? 'Pagamento' : 'Despesa'),
              porPessoa[uid], Number(e.id), nomesGrupo[Number(e.group_id || 0)] || null, e.group_id ? Number(e.group_id) : null,
              cent(e.cost), Boolean(e.payment), Boolean(e.deleted_at)]);
        }
        /* Quem deixou de fazer parte da despesa (ou a despesa apagada) deixa
           de contar. */
        await query(
          `UPDATE fin_cc_mov SET apagado = TRUE
            WHERE splitwise_expense_id = $1 AND NOT (pessoa_id = ANY($2::int[]))`, [Number(e.id), tocados]);
        if (e.deleted_at) await query('UPDATE fin_cc_mov SET apagado = TRUE WHERE splitwise_expense_id = $1', [Number(e.id)]);
      }
      if (lista.length < 200) break;
      offset += 200;
      if (offset > 20000) break;
    }
    await gravarSetting('fin_cc_sync_em', new Date().toISOString());
    console.log('[farol] contas correntes: Splitwise lido,', lidas, 'despesas');
    return { ok: true, lidas };
  })();
  try { return await A_CORRER; } finally { A_CORRER = null; }
}

/* Ao fim do dia (23:30 em Lisboa) e, ao arrancar, se a ultima leitura ja tem
   mais de vinte horas. */
function msAte2330() {
  const agora = new Date();
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .formatToParts(agora).reduce((o, x) => { o[x.type] = x.value; return o; }, {});
  const segAgora = (+p.hour % 24) * 3600 + (+p.minute) * 60 + (+p.second);
  let falta = 23 * 3600 + 30 * 60 - segAgora;
  if (falta <= 60) falta += 24 * 3600;
  return falta * 1000;
}
function agendar() {
  setTimeout(async () => {
    try { await sincronizar(); } catch (e) { console.error('[farol] contas correntes (fim do dia):', e.message); }
    agendar();
  }, msAte2330());
}
async function arrancar() {
  agendar();
  setTimeout(async () => {
    try {
      const u = await lerSetting('fin_cc_sync_em');
      if (!u || Date.now() - new Date(u).getTime() > 20 * 3600 * 1000) await sincronizar();
    } catch (e) { console.error('[farol] contas correntes (arranque):', e.message); }
  }, 90 * 1000);
}

/* ---------------- leitura ---------------- */
async function resumo() {
  const ps = await all(
    `SELECT p.id, p.nome, p.person_id, p.splitwise_id::text AS splitwise_id, p.saldo_splitwise, p.por_grupo,
            to_char(p.lido_em AT TIME ZONE 'Europe/Lisbon','YYYY-MM-DD HH24:MI') AS lido_em, p.ativo, p.nota,
            COALESCE(SUM(m.valor) FILTER (WHERE NOT m.apagado), 0) AS saldo,
            COALESCE(SUM(m.valor) FILTER (WHERE NOT m.apagado AND m.origem = 'splitwise'), 0) AS saldo_sw_lido,
            COALESCE(SUM(m.valor) FILTER (WHERE NOT m.apagado AND m.origem <> 'splitwise'), 0) AS saldo_fora,
            COALESCE(SUM(m.valor) FILTER (WHERE NOT m.apagado AND m.origem IN ('tu', 'partilha', 'reembolso')), 0) AS saldo_tu,
            COALESCE(SUM(m.valor) FILTER (WHERE NOT m.apagado AND m.origem IN ('partilha', 'reembolso')), 0) AS saldo_partilhas,
            to_char(MAX(m.data) FILTER (WHERE NOT m.apagado), 'YYYY-MM-DD') AS ultimo,
            COUNT(m.id) FILTER (WHERE NOT m.apagado) AS n
       FROM fin_cc_pessoas p LEFT JOIN fin_cc_mov m ON m.pessoa_id = p.id
      GROUP BY p.id ORDER BY p.ativo DESC, p.nome`);
  const pessoas = ps.map((p) => {
    const x = Object.assign({}, p, {
      saldo: cent(p.saldo), saldo_fora: cent(p.saldo_fora), saldo_sw_lido: cent(p.saldo_sw_lido),
      saldo_splitwise: p.saldo_splitwise == null ? null : cent(p.saldo_splitwise), n: Number(p.n), saldo_tu: cent(p.saldo_tu),
      saldo_partilhas: cent(p.saldo_partilhas)
    });
    /* O Splitwise e a referencia: se o que se leu despesa a despesa nao bate
       com o saldo que ele da, diz-se - e conta o dele. */
    if (x.splitwise_id && x.saldo_splitwise != null) {
      x.diferenca = cent(x.saldo_splitwise - x.saldo_sw_lido);
      /* Os acertos por transferencia registam-se no Splitwise; ligados tambem
         aqui contariam duas vezes. So se somam os lancamentos a mao e as
         contas divididas no Farol (com os reembolsos delas). */
      x.saldo = cent(x.saldo_splitwise + cent(p.saldo_tu));
    }
    return x;
  });
  const ativos = pessoas.filter((p) => p.ativo);
  return {
    pessoas,
    a_receber: cent(ativos.filter((p) => p.saldo > 0).reduce((s, p) => s + p.saldo, 0)),
    a_pagar: cent(ativos.filter((p) => p.saldo < 0).reduce((s, p) => s + p.saldo, 0)),
    sync_em: await lerSetting('fin_cc_sync_em'),
    splitwise: Boolean(splitwise.ativo && await splitwise.ativo().catch(() => false))
  };
}

/* O saldo de uma pessoa num dia: para a evolucao do patrimonio. */
async function saldoTotalEm(dataIso) {
  const r = (await all(
    `SELECT COALESCE(SUM(m.valor), 0) AS s FROM fin_cc_mov m JOIN fin_cc_pessoas p ON p.id = m.pessoa_id
      WHERE NOT m.apagado AND p.ativo AND m.data <= $1
        AND NOT (p.splitwise_id IS NOT NULL AND m.origem = 'banco')`, [dataIso]))[0];
  return cent(r.s);
}

/* ---------------- rotas ---------------- */
function instalar(app, falha) {
  app.get('/api/financas/cc', async (req, res) => {
    try { res.json(await resumo()); } catch (e) { falha(res, e, 'cc'); }
  });

  app.get('/api/financas/cc/:id(\\d+)', async (req, res) => {
    try {
      const p = (await all('SELECT id, nome, person_id, splitwise_id::text AS splitwise_id, saldo_splitwise, por_grupo, nota FROM fin_cc_pessoas WHERE id = $1', [req.params.id]))[0];
      if (!p) return res.status(404).json({ error: 'Pessoa não encontrada.' });
      const movs = await all(
        `SELECT c.id, to_char(c.data,'YYYY-MM-DD') AS data, c.descricao, c.valor, c.origem, c.grupo, c.total, c.pagamento,
                COALESCE(c.movimento_id, pt.movimento_id) AS movimento_id
           FROM fin_cc_mov c LEFT JOIN fin_mov_partes pt ON pt.id = c.parte_id
          WHERE c.pessoa_id = $1 AND NOT c.apagado ORDER BY c.data DESC, c.id DESC LIMIT 1000`, [p.id]);
      res.json({ pessoa: p, movimentos: movs.map((m) => Object.assign({}, m, { valor: cent(m.valor), total: m.total == null ? null : cent(m.total) })) });
    } catch (e) { falha(res, e, 'cc pessoa'); }
  });

  app.post('/api/financas/cc/pessoas', async (req, res) => {
    try {
      const nome = String((req.body && req.body.nome) || '').trim();
      if (!nome) return res.status(400).json({ error: 'Falta o nome.' });
      const r = (await all('INSERT INTO fin_cc_pessoas (nome, person_id, nota) VALUES ($1, $2, $3) RETURNING id',
        [nome, req.body.person_id || null, req.body.nota || null]))[0];
      res.json({ id: r.id });
    } catch (e) { falha(res, e, 'cc nova pessoa'); }
  });

  app.patch('/api/financas/cc/pessoas/:id(\\d+)', async (req, res) => {
    try {
      const b = req.body || {};
      const campos = [], vals = [];
      ['nome', 'person_id', 'ativo', 'nota'].forEach((k) => {
        if (b[k] !== undefined) { vals.push(b[k] === '' ? null : b[k]); campos.push(k + ' = $' + vals.length); }
      });
      if (!campos.length) return res.json({ ok: true });
      vals.push(req.params.id);
      await query('UPDATE fin_cc_pessoas SET ' + campos.join(', ') + ' WHERE id = $' + vals.length, vals);
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'cc pessoa'); }
  });

  app.post('/api/financas/cc/:id(\\d+)/mov', async (req, res) => {
    try {
      const b = req.body || {};
      const valor = cent(String(b.valor).replace(',', '.'));
      if (!valor) return res.status(400).json({ error: 'Falta o valor.' });
      const r = (await all(
        `INSERT INTO fin_cc_mov (pessoa_id, data, descricao, valor, origem)
         VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, 'tu') RETURNING id`,
        [req.params.id, b.data || null, String(b.descricao || 'Acerto').trim(), valor]))[0];
      res.json({ id: r.id });
    } catch (e) { falha(res, e, 'cc lancamento'); }
  });

  app.delete('/api/financas/cc/mov/:id(\\d+)', async (req, res) => {
    try {
      const x = (await all('SELECT origem FROM fin_cc_mov WHERE id = $1', [req.params.id]))[0];
      if (x && x.origem === 'splitwise') return res.status(409).json({ error: 'Os lançamentos do Splitwise apagam-se lá.' });
      if (x && x.origem === 'partilha') return res.status(409).json({ error: 'Vem de uma conta dividida: altera-a ou desfá-la no movimento do banco.' });
      await query('DELETE FROM fin_cc_mov WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'cc apagar'); }
  });

  app.post('/api/financas/cc/sincronizar', async (req, res) => {
    try {
      const r = await sincronizar({ tudo: Boolean(req.body && req.body.tudo) });
      if (!r.ok) return res.status(409).json({ error: r.motivo });
      res.json(r);
    } catch (e) { falha(res, e, 'cc sincronizar'); }
  });
}

/* Um movimento do banco que acerta contas com alguem: o que sai do Marco para
   a pessoa aumenta o que ela lhe deve; o que entra diminui. Uma entrada de
   quem tem contas divididas por pagar e um reembolso: conta mesmo para quem
   esta no Splitwise (o Splitwise nao sabe destas contas). */
async function ligarMovimento(movimentoId, pessoaId) {
  if (!pessoaId) { await query('DELETE FROM fin_cc_mov WHERE movimento_id = $1', [movimentoId]); return; }
  const m = (await all('SELECT id, data, descricao, valor FROM fin_movimentos WHERE id = $1', [movimentoId]))[0];
  if (!m) return;
  let origem = 'banco';
  if (Number(m.valor) > 0) {
    const ab = (await all(
      `SELECT COALESCE(SUM(valor), 0) AS s FROM fin_cc_mov
        WHERE pessoa_id = $1 AND NOT apagado AND origem IN ('partilha', 'reembolso') AND movimento_id IS DISTINCT FROM $2`,
      [pessoaId, movimentoId]))[0];
    if (Number(ab.s) > 0.005) origem = 'reembolso';
  }
  await query(
    `INSERT INTO fin_cc_mov (pessoa_id, data, descricao, valor, origem, movimento_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (movimento_id) WHERE movimento_id IS NOT NULL
     DO UPDATE SET pessoa_id = EXCLUDED.pessoa_id, data = EXCLUDED.data, descricao = EXCLUDED.descricao,
       valor = EXCLUDED.valor, origem = EXCLUDED.origem`,
    [pessoaId, m.data, m.descricao, cent(-Number(m.valor)), origem, m.id]);
}

/* ---------------- contas divididas ---------------- */
/* Divide um movimento que saiu da conta: a parte do Marco (categoria) e a de
   cada pessoa, que fica a dever-lha. Refazer substitui a divisao anterior. */
async function dividir(movimentoId, b) {
  const m = (await all("SELECT id, to_char(data,'YYYY-MM-DD') AS data, descricao, valor FROM fin_movimentos WHERE id = $1", [movimentoId]))[0];
  if (!m) throw erro(404, 'Movimento não encontrado.');
  const total = cent(-Number(m.valor));
  if (!(total > 0)) throw erro(400, 'Só se divide um movimento que saiu da conta.');
  const lidos = (b.outros || []).map((o) => ({
    pessoa_id: o.pessoa_id ? Number(o.pessoa_id) : null,
    nome: String(o.nome || '').trim().slice(0, 120),
    valor: cent(String(o.valor == null ? '' : o.valor).replace(/\s/g, '').replace(',', '.'))
  })).filter((o) => o.valor > 0 && (o.pessoa_id || o.nome));
  if (!lidos.length) throw erro(400, 'Falta com quem dividir e quanto.');
  if (cent(lidos.reduce((t, o) => t + o.valor, 0)) > total + 0.005) throw erro(400, 'A parte dos outros passa o valor do movimento.');
  /* Cada nome e uma pessoa da conta corrente: a que ja existe, ou uma nova. */
  for (const o of lidos) { if (!o.pessoa_id) o.pessoa_id = await resolverPessoa(o.nome); }
  const porPessoa = {};
  lidos.forEach((o) => { porPessoa[o.pessoa_id] = cent((porPessoa[o.pessoa_id] || 0) + o.valor); });
  const soma = cent(Object.values(porPessoa).reduce((s, v) => s + v, 0));
  if (soma > total + 0.005) throw erro(400, 'A parte dos outros passa o valor do movimento.');
  const minha = cent(total - soma);
  const descricao = String(b.descricao || '').trim().slice(0, 200) || m.descricao;
  const acertos = (await all("SELECT id FROM fin_categorias WHERE natureza = 'transferencia' AND nome ILIKE '%acerto%' ORDER BY id LIMIT 1"))[0];
  const categoria = minha > 0.005 ? (b.categoria_id ? Number(b.categoria_id) : null) : (acertos ? acertos.id : null);

  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    await cli.query('DELETE FROM fin_mov_partes WHERE movimento_id = $1', [m.id]);
    /* Um movimento dividido deixa de ser, ele proprio, um acerto com alguem. */
    await cli.query('DELETE FROM fin_cc_mov WHERE movimento_id = $1', [m.id]);
    if (minha > 0.005) {
      await cli.query('INSERT INTO fin_mov_partes (movimento_id, valor, categoria_id) VALUES ($1, $2, $3)', [m.id, -minha, categoria]);
    }
    for (const pid of Object.keys(porPessoa)) {
      const pt = (await cli.query('INSERT INTO fin_mov_partes (movimento_id, valor, pessoa_id) VALUES ($1, $2, $3) RETURNING id',
        [m.id, -porPessoa[pid], Number(pid)])).rows[0];
      await cli.query(
        `INSERT INTO fin_cc_mov (pessoa_id, data, descricao, valor, origem, total, parte_id)
         VALUES ($1, $2, $3, $4, 'partilha', $5, $6)`, [Number(pid), m.data, descricao, porPessoa[pid], total, pt.id]);
    }
    if (categoria) {
      await cli.query(`UPDATE fin_movimentos SET categoria_id = $1, categoria_fonte = 'tu', categoria_em = now() WHERE id = $2`, [categoria, m.id]);
    }
    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { cli.release(); }
  return { minha, outros: soma, pessoas: Object.keys(porPessoa).length };
}

/* A pessoa da conta corrente com este nome: o mesmo nome, ou um nome que
   contem o outro («PAULA CRISTINA» do banco e «Paula Cristina Silva» do
   Splitwise sao a mesma). Se nao ha, cria-se. */
async function resolverPessoa(nome) {
  const ex = (await all('SELECT id, ativo FROM fin_cc_pessoas WHERE lower(nome) = lower($1) ORDER BY ativo DESC, id LIMIT 1', [nome]))[0];
  if (ex) { if (!ex.ativo) await query('UPDATE fin_cc_pessoas SET ativo = TRUE WHERE id = $1', [ex.id]); return ex.id; }
  if (nomesDe(nome).length >= 2) {
    const ps = (await all('SELECT id, nome, ativo FROM fin_cc_pessoas ORDER BY ativo DESC, id')).filter((p) => mesmaPessoa(p.nome, nome));
    if (ps.length === 1) { if (!ps[0].ativo) await query('UPDATE fin_cc_pessoas SET ativo = TRUE WHERE id = $1', [ps[0].id]); return ps[0].id; }
  }
  return (await all('INSERT INTO fin_cc_pessoas (nome) VALUES ($1) RETURNING id', [nome]))[0].id;
}

async function desfazerDivisao(movimentoId) {
  await query('DELETE FROM fin_mov_partes WHERE movimento_id = $1', [movimentoId]);
}

/* Muda a categoria da parte do Marco quando a do movimento muda. */
async function categoriaDaMinhaParte(movimentoId, categoriaId) {
  await query('UPDATE fin_mov_partes SET categoria_id = $1 WHERE movimento_id = $2 AND pessoa_id IS NULL', [categoriaId || null, movimentoId]);
}

/* ---------------- reembolsos ---------------- */
function norm(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const NAO_NOMES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'mb', 'way', 'trf', 'transf', 'transferencia', 'sr', 'sra']);
const nomesDe = (s) => norm(s).split(' ').filter((t) => t.length >= 3 && !NAO_NOMES.has(t));

function mesmaPessoa(a, b) {
  if (norm(a) === norm(b)) return true;
  const x = nomesDe(a), y = nomesDe(b);
  return (x.length >= 2 && x.every((t) => y.indexOf(t) >= 0)) || (y.length >= 2 && y.every((t) => x.indexOf(t) >= 0));
}

/* Quem mandou o dinheiro, quando o banco o diz: «IPS/R3162839641-PAULA
   CRISTINA» (transferencia imediata), «MB WAY DE ...», «TRF ... DE ...».
   Empresas e o Estado nao sao pessoas a quem se divide um jantar. */
function pagador(desc) {
  const s = String(desc || '').trim();
  const m = s.match(/^IPS\/R?\d*[-\s]+(.+)$/i) ||
    s.match(/\bMB ?WAY\b.*?\b(?:DE|DO|DA)\s+(.+)$/i) ||
    s.match(/\b(?:TRF|TRANSF|TRANSFERENCIA|TRANSFER\u00caNCIA)\b\.?\s*(?:IMEDIATA\s+|SEPA\+?\s+|RECEBIDA\s+)*(?:DE|DO|DA)\s+(.+)$/i);
  if (!m) return null;
  const n = m[1].replace(/\d{4,}.*$/, '').replace(/[^A-Za-z\u00C0-\u00FF?' .-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (n.replace(/[^A-Za-z\u00C0-\u00FF]/g, '').length < 3) return null;
  if (/\b(LDA|S\.?A|UNIPESSOAL|BANCO|SGPS|CRL|ACE|SEGUROS?|SEGURANCA|AUTORIDADE|TRIBUTARIA|ESTADO|MUNICIPIO|CAMARA|SA)\b/i.test(n)) return null;
  return n.toLowerCase().replace(/(^|[\s'-])([a-z\u00e0-\u00ff])/g, (x, a, b) => a + b.toUpperCase());
}

/* Uma entrada de uma pessoa que pode ser a parte dela numa conta que o Marco
   pagou, sem nada registado antes: procura-se um pagamento nos 12 dias antes
   cujo valor seja um multiplo exato do que entrou (jantar de 38,70 EUR, tres
   pessoas, 12,90 cada), contando quem mais mandou o mesmo valor por esses
   dias. Se o pagamento ja esta dividido com partes iguais, sugere juntar a
   pessoa. */
async function sugerirDivisoes(creditos) {
  const cs = creditos.map((c) => Object.assign({}, c, { valor: cent(c.valor), quem: pagador(c.descricao) })).filter((c) => c.quem && c.valor > 0);
  const out = {};
  if (!cs.length) return out;
  const datas = cs.map((c) => c.data).sort();
  const de = datas[0], ate = datas[datas.length - 1];
  const debs = await all(
    `SELECT id, to_char(data,'YYYY-MM-DD') AS data, descricao, valor, categoria_id, ia_categoria_id FROM fin_movimentos
      WHERE valor < 0 AND data BETWEEN $1::date - 12 AND $2::date + 1`, [de, ate]);
  const pts = await all(
    `SELECT p.movimento_id, p.valor, p.pessoa_id, cp.nome FROM fin_mov_partes p LEFT JOIN fin_cc_pessoas cp ON cp.id = p.pessoa_id
      WHERE p.movimento_id = ANY($1::int[])`, [debs.map((d) => d.id)]);
  const vizinhos = (await all(
    `SELECT id, to_char(data,'YYYY-MM-DD') AS data, descricao, valor FROM fin_movimentos m
      WHERE valor > 0 AND data BETWEEN $1::date - 12 AND $2::date + 14
        AND NOT EXISTS (SELECT 1 FROM fin_cc_mov c WHERE c.movimento_id = m.id)`, [de, ate]))
    .map((c) => Object.assign(c, { valor: cent(c.valor), quem: pagador(c.descricao) })).filter((c) => c.quem);
  const dias = (a, b) => Math.round((new Date(a) - new Date(b)) / 86400000);
  for (const c of cs) {
    /* Quem mais mandou o mesmo valor por esses dias (uma pessoa conta uma vez). */
    const grupo = {};
    vizinhos.filter((x) => Math.abs(x.valor - c.valor) < 0.006 && Math.abs(dias(x.data, c.data)) <= 7)
      .forEach((x) => { const k = norm(x.quem); if (!grupo[k] || x.id === c.id) grupo[k] = x; });
    grupo[norm(c.quem)] = c;
    const pagos = Object.values(grupo);
    let melhor = null;
    for (const d of debs) {
      const dd = dias(c.data, d.data);
      if (dd < -1 || dd > 12) continue;
      const total = cent(-Number(d.valor));
      const partes = pts.filter((p) => p.movimento_id === d.id);
      let conf, k, juntar = false, quem = pagos;
      if (partes.length) {
        /* Ja dividido: so se as partes dos outros sao deste valor e a do
           Marco ainda chega para mais esta. */
        const outros = partes.filter((p) => p.pessoa_id);
        const minha = cent(-partes.filter((p) => !p.pessoa_id).reduce((s, p) => s + Number(p.valor), 0));
        if (!outros.length || !outros.every((p) => Math.abs(-Number(p.valor) - c.valor) < 0.006)) continue;
        quem = pagos.filter((x) => !outros.some((p) => mesmaPessoa(p.nome, x.quem)));
        if (!quem.some((x) => x.id === c.id)) continue;
        /* A parte do Marco tem de continuar a chegar para a dele. */
        if (minha - c.valor * quem.length < c.valor - 0.005) continue;
        k = outros.length + quem.length + 1; juntar = true; conf = 0.85;
      } else {
        if (total <= c.valor + 0.005) continue;
        k = Math.round(total / c.valor);
        if (k < 2 || k > 12 || Math.abs(total - k * c.valor) > 0.011 * k) continue;
        if (k < pagos.length + 1) continue;
        conf = k === pagos.length + 1 ? (pagos.length >= 2 ? 0.92 : 0.78) : Math.max(0.5, 0.72 - 0.04 * (k - pagos.length - 1));
      }
      conf = Math.max(0, conf - 0.02 * Math.max(0, dd));
      if (!melhor || conf > melhor.confianca) {
        melhor = { movimento_id: d.id, descricao: d.descricao, data: d.data, total, parte: c.valor, pessoas: k, juntar,
          categoria_id: d.categoria_id || d.ia_categoria_id || null, confianca: cent(conf),
          pagos: quem.map((x) => ({ id: x.id, nome: x.quem, data: x.data })) };
      }
    }
    if (melhor && melhor.confianca >= 0.5) out[c.id] = melhor;
  }
  return out;
}

/* Quem deve dinheiro fora do Splitwise, e as partes que lhe cabem: le-se uma
   vez por pedido e serve para todas as entradas. */
async function abertos() {
  const ps = await all(
    `SELECT p.id, p.nome,
            COALESCE(SUM(m.valor) FILTER (WHERE m.origem IN ('partilha', 'reembolso', 'tu')
                                           OR (m.origem = 'banco' AND p.splitwise_id IS NULL)), 0) AS aberto
       FROM fin_cc_pessoas p JOIN fin_cc_mov m ON m.pessoa_id = p.id AND NOT m.apagado
      WHERE p.ativo GROUP BY p.id`);
  const partes = await all(
    `SELECT pessoa_id, to_char(data,'YYYY-MM-DD') AS data, descricao, valor FROM fin_cc_mov
      WHERE origem = 'partilha' AND NOT apagado AND data >= CURRENT_DATE - 240`);
  return ps.filter((p) => Number(p.aberto) > 0.005).map((p) => ({
    id: p.id, nome: p.nome, aberto: cent(p.aberto),
    nomes: norm(p.nome).split(' ').filter((t) => t.length >= 3 && !NAO_NOMES.has(t)),
    partes: partes.filter((x) => x.pessoa_id === p.id).map((x) => ({ data: x.data, descricao: x.descricao, valor: cent(x.valor) }))
  }));
}

/* Quem pode ter feito esta transferencia para devolver uma conta: o nome na
   descricao (o MB Way e as transferencias trazem-no) e o valor igual ao de
   uma parte por pagar. */
function reembolsoDe(m, lista) {
  const v = cent(m.valor);
  if (!(v > 0)) return [];
  const desc = ' ' + norm(m.descricao) + ' ';
  const out = [];
  for (const p of lista) {
    const nomes = p.nomes.filter((t) => desc.indexOf(' ' + t + ' ') >= 0);
    const igual = p.partes.find((x) => Math.abs(x.valor - v) < 0.006 && x.data <= m.data);
    let conf = 0;
    const porque = [];
    if (nomes.length) { conf += nomes.length >= 2 ? 0.62 : 0.3; porque.push(nomes.length >= 2 ? 'o nome está na descrição' : 'um dos nomes está na descrição'); }
    if (igual) { conf += 0.35; porque.push('o valor é o da parte de «' + igual.descricao + '»'); }
    if (v > p.aberto + 0.005) { if (!nomes.length) continue; conf -= 0.15; porque.push('é mais do que deve (' + p.aberto.toFixed(2).replace('.', ',') + ' €)'); }
    if (conf < 0.35) continue;
    out.push({ pessoa_id: p.id, nome: p.nome, aberto: p.aberto, confianca: Math.min(0.98, cent(conf)), motivo: porque.join(' e ') });
  }
  return out.sort((a, b) => b.confianca - a.confianca).slice(0, 3);
}

module.exports = { instalar, arrancar, sincronizar, resumo, saldoTotalEm, ligarMovimento,
  dividir, desfazerDivisao, categoriaDaMinhaParte, abertos, reembolsoDe, pagador, resolverPessoa, sugerirDivisoes };
