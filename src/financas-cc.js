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
 * valor com sinal, do lado do Marco: positivo, a pessoa deve-lhe; negativo,
 * deve ele.
 */
const { query } = require('./db');
const splitwise = require('./splitwise');

const all = async (sql, params) => (await query(sql, params)).rows;
const cent = (v) => Math.round(Number(v || 0) * 100) / 100;
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
            COALESCE(SUM(m.valor) FILTER (WHERE NOT m.apagado AND m.origem = 'tu'), 0) AS saldo_tu,
            to_char(MAX(m.data) FILTER (WHERE NOT m.apagado), 'YYYY-MM-DD') AS ultimo,
            COUNT(m.id) FILTER (WHERE NOT m.apagado) AS n
       FROM fin_cc_pessoas p LEFT JOIN fin_cc_mov m ON m.pessoa_id = p.id
      GROUP BY p.id ORDER BY p.ativo DESC, p.nome`);
  const pessoas = ps.map((p) => {
    const x = Object.assign({}, p, {
      saldo: cent(p.saldo), saldo_fora: cent(p.saldo_fora), saldo_sw_lido: cent(p.saldo_sw_lido),
      saldo_splitwise: p.saldo_splitwise == null ? null : cent(p.saldo_splitwise), n: Number(p.n), saldo_tu: cent(p.saldo_tu)
    });
    /* O Splitwise e a referencia: se o que se leu despesa a despesa nao bate
       com o saldo que ele da, diz-se - e conta o dele. */
    if (x.splitwise_id && x.saldo_splitwise != null) {
      x.diferenca = cent(x.saldo_splitwise - x.saldo_sw_lido);
      /* Os acertos por transferencia registam-se no Splitwise; ligados tambem
         aqui contariam duas vezes. So os lancamentos a mao se somam. */
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
      WHERE NOT m.apagado AND p.ativo AND m.data <= $1`, [dataIso]))[0];
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
        `SELECT id, to_char(data,'YYYY-MM-DD') AS data, descricao, valor, origem, grupo, total, pagamento, movimento_id
           FROM fin_cc_mov WHERE pessoa_id = $1 AND NOT apagado ORDER BY data DESC, id DESC LIMIT 1000`, [p.id]);
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
      const r = await all("DELETE FROM fin_cc_mov WHERE id = $1 AND origem <> 'splitwise' RETURNING id", [req.params.id]);
      if (!r.length) return res.status(409).json({ error: 'Os lançamentos do Splitwise apagam-se lá.' });
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
   a pessoa aumenta o que ela lhe deve; o que entra diminui. */
async function ligarMovimento(movimentoId, pessoaId) {
  if (!pessoaId) { await query('DELETE FROM fin_cc_mov WHERE movimento_id = $1', [movimentoId]); return; }
  const m = (await all('SELECT id, data, descricao, valor FROM fin_movimentos WHERE id = $1', [movimentoId]))[0];
  if (!m) return;
  await query(
    `INSERT INTO fin_cc_mov (pessoa_id, data, descricao, valor, origem, movimento_id)
     VALUES ($1, $2, $3, $4, 'banco', $5)
     ON CONFLICT (movimento_id) WHERE movimento_id IS NOT NULL
     DO UPDATE SET pessoa_id = EXCLUDED.pessoa_id, data = EXCLUDED.data, descricao = EXCLUDED.descricao, valor = EXCLUDED.valor`,
    [pessoaId, m.data, m.descricao, cent(-Number(m.valor)), m.id]);
}

module.exports = { instalar, arrancar, sincronizar, resumo, saldoTotalEm, ligarMovimento };
