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

    /* Cada grupo e uma conta corrente, com os membros dele (menos o Marco). */
    for (const g of ((gr && gr.groups) || [])) {
      if (!Number(g.id)) continue;
      const c = (await all(
        `INSERT INTO fin_cc_contas (nome, splitwise_grupo_id) VALUES ($1, $2)
         ON CONFLICT (splitwise_grupo_id) DO UPDATE SET nome = EXCLUDED.nome RETURNING id`, [g.name || ('Grupo ' + g.id), Number(g.id)]))[0];
      for (const mb of (g.members || [])) {
        if (Number(mb.id) === meu) continue;
        const pid = await quem(Number(mb.id), mb);
        await query('INSERT INTO fin_cc_membros (conta_id, pessoa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.id, pid]);
      }
    }

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
    await organizarContas();
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
  setTimeout(() => { garantirCabecalhos().then(organizarContas).catch((e) => console.error('[farol] contas partilhadas (arranque):', e.message)); }, 5000);
  setTimeout(async () => {
    try {
      const u = await lerSetting('fin_cc_sync_em');
      if (!u || Date.now() - new Date(u).getTime() > 20 * 3600 * 1000) await sincronizar();
    } catch (e) { console.error('[farol] contas correntes (arranque):', e.message); }
  }, 90 * 1000);
}

/* ---------------- leitura ---------------- */
async function resumo() {
  await organizarContas().catch((e) => console.error('[farol] contas correntes (organizar):', e.message));
  const ps = await all(
    `SELECT p.id, p.nome, p.person_id, p.tipo AS natureza, p.splitwise_id::text AS splitwise_id, p.saldo_splitwise, p.por_grupo,
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
  /* As contas divididas no Farol de cada pessoa: para se ver, ao lado do
     nome, de que contas e o que deve (o jantar, as viagens de Uber). */
  const contas = await all(
    `SELECT c.pessoa_id, to_char(c.data,'YYYY-MM-DD') AS data, c.descricao, c.valor, c.total, pt.movimento_id
       FROM fin_cc_mov c LEFT JOIN fin_mov_partes pt ON pt.id = c.parte_id
      WHERE c.origem = 'partilha' AND NOT c.apagado ORDER BY c.data DESC, c.id DESC`);
  pessoas.forEach((p) => {
    p.tipo = p.splitwise_id ? 'splitwise' : 'farol';
    /* `tipo` ja queria dizer de onde vem a conta: pessoa ou empresa vai a parte. */
    p.empresa = p.natureza === 'empresa';
    p.contas = contas.filter((c) => c.pessoa_id === p.id).slice(0, 6)
      .map((c) => ({ data: c.data, descricao: c.descricao, valor: cent(c.valor), total: c.total == null ? null : cent(c.total), movimento_id: c.movimento_id }));
    /* Em aberto: ha saldo por acertar. Saldada: ja nao deve nem se lhe deve. */
    p.estado = Math.abs(p.saldo) >= 0.01 ? 'aberta' : 'saldada';
  });
  /* Despesas de representacao: o que esta por apresentar e por receber le-se
     do proprio movimento (serve as pagas do bolso e as do cartao da empresa). */
  const rep = await all(
    `SELECT m.repres_empresa_id AS id,
            (c.empresa_id IS NOT NULL AND c.empresa_id = m.repres_empresa_id) AS cartao,
            COALESCE(m.repres_estado,'') AS estado, SUM(abs(m.valor)) AS total, COUNT(*)::int AS n,
            to_char(MIN(m.data),'YYYY-MM-DD') AS primeiro
       FROM fin_movimentos m LEFT JOIN fin_contas c ON c.id = m.conta_id
      WHERE m.repres_empresa_id IS NOT NULL GROUP BY 1, 2, 3`);
  pessoas.forEach((p) => {
    const meus = rep.filter((r) => r.id === p.id);
    const soma = (f) => cent(meus.filter(f).reduce((s, r) => s + Number(r.total), 0));
    p.rep_bolso = soma((r) => !r.cartao);
    p.rep_cartao = soma((r) => r.cartao);
    p.por_apresentar = soma((r) => ['adiantado', 'registada', ''].indexOf(r.estado) >= 0);
    p.por_receber = soma((r) => !r.cartao && ['adiantado', 'apresentado', ''].indexOf(r.estado) >= 0);
    const velhos = meus.filter((r) => ['adiantado', 'registada', ''].indexOf(r.estado) >= 0 && r.primeiro)
      .map((r) => r.primeiro).sort();
    p.por_apresentar_desde = velhos[0] || null;
  });
  const ativos = pessoas.filter((p) => p.ativo);
  const contasCc = await lerContas(pessoas);
  const nPart = await all('SELECT pessoa_id, COUNT(DISTINCT partilha_id) AS n FROM fin_mov_partes WHERE pessoa_id IS NOT NULL AND partilha_id IS NOT NULL GROUP BY pessoa_id');
  pessoas.forEach((p) => {
    p.contas_correntes = contasCc.filter((c) => c.membros.some((m) => m.pessoa_id === p.id))
      .map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo, direta: c.direta, saldo: (c.membros.find((m) => m.pessoa_id === p.id) || {}).saldo || 0 }));
    p.n_partilhas = Number((nPart.find((x) => x.pessoa_id === p.id) || {}).n || 0);
  });
  return {
    pessoas,
    contas: contasCc,
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
  instalarContas(app, falha);
  app.get('/api/financas/cc', async (req, res) => {
    try { res.json(await resumo()); } catch (e) { falha(res, e, 'cc'); }
  });

  app.get('/api/financas/cc/:id(\\d+)', async (req, res) => {
    try {
      const p = (await all('SELECT id, nome, person_id, splitwise_id::text AS splitwise_id, saldo_splitwise, por_grupo, nota FROM fin_cc_pessoas WHERE id = $1', [req.params.id]))[0];
      if (!p) return res.status(404).json({ error: 'Pessoa não encontrada.' });
      const movs = await all(
        `SELECT c.id, to_char(c.data,'YYYY-MM-DD') AS data, c.descricao, c.valor, c.origem, c.grupo, c.total, c.pagamento,
                COALESCE(c.movimento_id, pt.movimento_id) AS movimento_id, c.conta_id, CASE WHEN cc.pessoa_direta_id IS NULL THEN cc.nome END AS conta, pt.partilha_id
           FROM fin_cc_mov c LEFT JOIN fin_mov_partes pt ON pt.id = c.parte_id LEFT JOIN fin_cc_contas cc ON cc.id = c.conta_id
          WHERE c.pessoa_id = $1 AND NOT c.apagado ORDER BY c.data DESC, c.id DESC LIMIT 1000`, [p.id]);
      res.json({ pessoa: p, movimentos: movs.map((m) => Object.assign({}, m, { valor: cent(m.valor), total: m.total == null ? null : cent(m.total) })) });
    } catch (e) { falha(res, e, 'cc pessoa'); }
  });

  app.post('/api/financas/cc/pessoas', async (req, res) => {
    try {
      const nome = String((req.body && req.body.nome) || '').trim();
      if (!nome) return res.status(400).json({ error: 'Falta o nome.' });
      const r = (await all('INSERT INTO fin_cc_pessoas (nome, person_id, nota, tipo) VALUES ($1, $2, $3, $4) RETURNING id',
        [nome, req.body.person_id || null, req.body.nota || null, req.body.tipo === 'empresa' ? 'empresa' : 'pessoa']))[0];
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
      /* Passar uma conta corrente a de empresa (ou de volta a de pessoa). */
      if (b.tipo !== undefined) { vals.push(b.tipo === 'empresa' ? 'empresa' : 'pessoa'); campos.push('tipo = $' + vals.length); }
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
        `INSERT INTO fin_cc_mov (pessoa_id, data, descricao, valor, origem, conta_id)
         VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, 'tu', $5) RETURNING id`,
        [req.params.id, b.data || null, String(b.descricao || 'Acerto').trim(), valor, b.conta_id ? Number(b.conta_id) : await contaDireta(Number(req.params.id))]))[0];
      res.json({ id: r.id });
    } catch (e) { falha(res, e, 'cc lancamento'); }
  });

  /* Em que pe esta uma despesa adiantada. */
  app.patch('/api/financas/cc/mov/:id(\\d+)/estado', async (req, res) => {
    try {
      const e = String((req.body && req.body.estado) || '');
      if (['adiantado', 'apresentado', 'reembolsado'].indexOf(e) < 0) throw erro(400, 'Estado desconhecido.');
      const r = await all('UPDATE fin_cc_mov SET estado = $1 WHERE id = $2 RETURNING id', [e, Number(req.params.id)]);
      if (!r.length) throw erro(404, 'Entrada não encontrada.');
      res.json({ ok: true, estado: e });
    } catch (e) { falha(res, e, 'o estado da despesa'); }
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
async function ligarMovimento(movimentoId, pessoaId, opcoes) {
  const o = opcoes || {};
  if (!pessoaId) {
    /* Desligar: o pagamento que o Farol tinha posto no Splitwise sai de la. */
    const v = (await all('SELECT sw_pagamento_id::text AS sw, sw_criado FROM fin_cc_mov WHERE movimento_id = $1', [movimentoId]))[0];
    if (v && v.sw && v.sw_criado && splitwise.pedir) {
      try { await splitwise.pedir('/delete_expense/' + v.sw, { metodo: 'POST' }); } catch (e) { console.error('[farol] splitwise apagar pagamento:', e.message); }
    }
    await query('DELETE FROM fin_cc_mov WHERE movimento_id = $1', [movimentoId]);
    return;
  }
  const m = (await all('SELECT id, data, descricao, valor FROM fin_movimentos WHERE id = $1', [movimentoId]))[0];
  if (!m) return;
  let origem = 'banco';
  if (o.origem) origem = o.origem;
  else if (Number(m.valor) > 0) {
    const ab = (await all(
      `SELECT COALESCE(SUM(valor), 0) AS s FROM fin_cc_mov
        WHERE pessoa_id = $1 AND NOT apagado AND origem IN ('partilha', 'reembolso') AND movimento_id IS DISTINCT FROM $2`,
      [pessoaId, movimentoId]))[0];
    if (Number(ab.s) > 0.005) origem = 'reembolso';
  }
  await query(
    `INSERT INTO fin_cc_mov (pessoa_id, data, descricao, valor, origem, movimento_id, conta_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (movimento_id) WHERE movimento_id IS NOT NULL
     DO UPDATE SET pessoa_id = EXCLUDED.pessoa_id, data = EXCLUDED.data, descricao = EXCLUDED.descricao,
       valor = EXCLUDED.valor, origem = EXCLUDED.origem, conta_id = EXCLUDED.conta_id`,
    [pessoaId, m.data, m.descricao, cent(-Number(m.valor)), origem, m.id, o.conta_id || null]);
}

/* Um acerto de contas (alguem paga-me o que devia) ou um emprestimo que
   devolvo (alguem pagou por mim): o movimento do banco liga-se a pessoa, na
   conta corrente escolhida. Numa conta do Splitwise pode ir tambem para la,
   como pagamento - mas primeiro ve-se se ja la esta. */
async function registarAcerto(movimentoId, b) {
  const m = (await all("SELECT id, to_char(data,'YYYY-MM-DD') AS data, descricao, valor FROM fin_movimentos WHERE id = $1", [movimentoId]))[0];
  if (!m) throw erro(404, 'Movimento não encontrado.');
  const pessoaId = b.pessoa_id ? Number(b.pessoa_id) : await resolverPessoa(String(b.nome || '').trim().slice(0, 120) || pagador(m.descricao) || 'Sem nome');
  const p = (await all('SELECT id, nome, splitwise_id::text AS splitwise_id FROM fin_cc_pessoas WHERE id = $1', [pessoaId]))[0];
  if (!p) throw erro(404, 'Pessoa não encontrada.');
  let contaId = b.conta_id ? Number(b.conta_id) : null;
  const sw = Boolean(b.splitwise);
  if (contaId) {
    const ok = (await all('SELECT 1 FROM fin_cc_membros WHERE conta_id = $1 AND pessoa_id = $2', [contaId, pessoaId]))[0];
    if (!ok) throw erro(400, p.nome + ' não está nessa conta corrente.');
  } else contaId = await contaDireta(pessoaId);
  const c = (await all('SELECT id, nome, COALESCE(splitwise_grupo_id, 0)::text AS grupo FROM fin_cc_contas WHERE id = $1', [contaId]))[0];
  if (sw && !p.splitwise_id) throw erro(400, p.nome + ' não está no Splitwise.');
  /* No Farol, conta sempre (reembolso); no Splitwise, quem conta e o pagamento de la. */
  await ligarMovimento(m.id, pessoaId, { conta_id: contaId, origem: sw ? 'banco' : 'reembolso' });
  const out = { pessoa: p.nome, conta: c ? c.nome : '', splitwise: null };
  if (sw) {
    try { out.splitwise = await pagamentoSplitwise(m, p, Number(c.grupo)); }
    catch (e) { out.splitwise = { erro: e.message }; }
  }
  return out;
}

/* O pagamento no Splitwise: quem pagou a quem, o valor, a data. Se ja la
   esta um pagamento igual (as mesmas duas pessoas, o mesmo valor, uns dias
   antes ou depois), liga-se a esse. */
async function pagamentoSplitwise(m, p, grupo) {
  if (!(await splitwise.ativo().catch(() => false))) return { erro: 'O Splitwise não está ligado.' };
  const eu = Number((await splitwise.quemSou()).id);
  const ele = Number(p.splitwise_id);
  const valor = cent(Math.abs(Number(m.valor)));
  /* Entrada: ele pagou-me. Saida: eu paguei-lhe. */
  const paga = Number(m.valor) > 0 ? ele : eu, recebe = paga === eu ? ele : eu;
  const filtro = grupo ? 'group_id=' + grupo : 'friend_id=' + ele;
  const j = await splitwise.pedir('/get_expenses?' + filtro + '&dated_after=' + somaDias(m.data, -7) + '&dated_before=' + somaDias(m.data, 8) + '&limit=200');
  const usados = new Set((await all('SELECT sw_pagamento_id::text AS s FROM fin_cc_mov WHERE sw_pagamento_id IS NOT NULL AND movimento_id <> $1', [m.id])).map((x) => x.s));
  const igual = ((j && j.expenses) || []).find((e) => {
    if (e.deleted_at || !e.payment || usados.has(String(e.id))) return false;
    if (Math.abs(cent(e.cost) - valor) > 0.005) return false;
    const us = (e.users || []).map((u) => ({ id: Number(u.user_id || (u.user && u.user.id)), pago: Number(u.paid_share) }));
    const pg = us.find((u) => u.pago > 0.005);
    return pg && pg.id === paga && us.some((u) => u.id === recebe);
  });
  if (igual) {
    await query('UPDATE fin_cc_mov SET sw_pagamento_id = $1, sw_criado = FALSE WHERE movimento_id = $2', [Number(igual.id), m.id]);
    return { existente: Number(igual.id) };
  }
  const corpo = { cost: valor.toFixed(2), description: 'Pagamento', payment: true, date: m.data + 'T12:00:00Z', currency_code: 'EUR', group_id: grupo || 0,
    details: 'Registado pelo Farol: ' + m.descricao,
    users__0__user_id: paga, users__0__paid_share: valor.toFixed(2), users__0__owed_share: '0.00',
    users__1__user_id: recebe, users__1__paid_share: '0.00', users__1__owed_share: valor.toFixed(2) };
  const r = await splitwise.pedir('/create_expense', { metodo: 'POST', corpo });
  const feita = (r && r.expenses && r.expenses[0]) || null;
  if (!feita) throw new Error('O Splitwise não devolveu o pagamento criado.');
  await query('UPDATE fin_cc_mov SET sw_pagamento_id = $1, sw_criado = TRUE WHERE movimento_id = $2', [Number(feita.id), m.id]);
  sincronizar().catch((e) => console.error('[farol] contas correntes (depois do acerto):', e.message));
  return { criado: Number(feita.id) };
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
  /* Numa despesa adiantada a uma empresa a categoria real interessa (almocos
     de equipa, lavagens): guarda-se. Como o movimento fica dividido, a analise
     passa a contar pelas partes, por isso nao conta como gasto do Marco. */
  const categoria = minha > 0.005 ? (b.categoria_id ? Number(b.categoria_id) : null)
    : (b.manter_categoria ? null : (acertos ? acertos.id : null));
  /* adiantado | apresentado | reembolsado - so nas contas de empresa. */
  const estado = ['adiantado', 'apresentado', 'reembolsado'].indexOf(String(b.estado || '')) >= 0 ? String(b.estado) : null;

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
        `INSERT INTO fin_cc_mov (pessoa_id, data, descricao, valor, origem, total, parte_id, estado)
         VALUES ($1, $2, $3, $4, 'partilha', $5, $6, $7)`, [Number(pid), m.data, descricao, porPessoa[pid], total, pt.id, estado]);
    }
    if (categoria) {
      await cli.query(`UPDATE fin_movimentos SET categoria_id = $1, categoria_fonte = 'tu', categoria_em = now() WHERE id = $2`, [categoria, m.id]);
    }
    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { cli.release(); }
  await garantirCabecalhos();
  await organizarContas();
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
  /* Repartido por varias categorias, cada parte fica com a sua. */
  await query(`UPDATE fin_mov_partes SET categoria_id = $1 WHERE movimento_id = $2 AND pessoa_id IS NULL
                 AND (SELECT COUNT(*) FROM fin_mov_partes x WHERE x.movimento_id = $2 AND x.pessoa_id IS NULL) = 1`, [categoriaId || null, movimentoId]);
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
   pagou, sem nada registado antes: procura-se um pagamento nos 12 dias antes (ou ate 10 dias depois, no cartao)
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
      WHERE valor < 0 AND data BETWEEN $1::date - 12 AND $2::date + 10
        AND conta_id IN (SELECT id FROM fin_contas WHERE pessoal)`, [de, ate]);
  const pts = await all(
    `SELECT p.movimento_id, p.valor, p.pessoa_id, cp.nome FROM fin_mov_partes p LEFT JOIN fin_cc_pessoas cp ON cp.id = p.pessoa_id
      WHERE p.movimento_id = ANY($1::int[])`, [debs.map((d) => d.id)]);
  const vizinhos = (await all(
    `SELECT id, to_char(data,'YYYY-MM-DD') AS data, descricao, valor FROM fin_movimentos m
      WHERE valor > 0 AND data BETWEEN $1::date - 12 AND $2::date + 14
        AND conta_id IN (SELECT id FROM fin_contas WHERE pessoal)
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
      /* O cartao lanca a compra ate uns dias depois da transferencia. */
      if (dd < -10 || dd > 12) continue;
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
      conf = Math.max(0, conf - 0.02 * Math.abs(dd));
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
      WHERE origem = 'partilha' AND NOT apagado AND data >= CURRENT_DATE - 400`);
  return ps.filter((p) => Number(p.aberto) > 0.005).map((p) => ({
    id: p.id, nome: p.nome, aberto: cent(p.aberto),
    nomes: norm(p.nome).split(' ').filter((t) => t.length >= 3 && !NAO_NOMES.has(t)),
    partes: partes.filter((x) => x.pessoa_id === p.id).map((x) => ({ data: x.data, descricao: x.descricao, valor: cent(x.valor) }))
  }));
}

function somaDias(iso, n) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* As contas divididas que ainda tem alguem por pagar, cada uma com as pessoas
   e a parte de cada uma: para ligar uma entrada a uma conta que ja existe.
   Uma pessoa conta como «por pagar» enquanto o saldo dela fora do Splitwise
   for positivo. */
async function contasEmAberto() {
  const ab = {};
  (await abertos()).forEach((p) => { ab[p.id] = p.aberto; });
  const linhas = await all(
    `SELECT pt.movimento_id, c.pessoa_id, p.nome, to_char(m.data,'YYYY-MM-DD') AS data, c.descricao, c.valor, c.total
       FROM fin_cc_mov c JOIN fin_mov_partes pt ON pt.id = c.parte_id
       JOIN fin_movimentos m ON m.id = pt.movimento_id JOIN fin_cc_pessoas p ON p.id = c.pessoa_id
      WHERE c.origem = 'partilha' AND NOT c.apagado AND m.data >= CURRENT_DATE - 400
      ORDER BY m.data DESC, pt.movimento_id, p.nome`);
  const porMov = new Map();
  linhas.forEach((l) => {
    if (!porMov.has(l.movimento_id)) porMov.set(l.movimento_id, { movimento_id: l.movimento_id, data: l.data, descricao: l.descricao, total: cent(l.total), pessoas: [] });
    porMov.get(l.movimento_id).pessoas.push({ pessoa_id: l.pessoa_id, nome: l.nome, valor: cent(l.valor), deve: cent(ab[l.pessoa_id] || 0) });
  });
  return Array.from(porMov.values()).filter((c) => c.pessoas.some((p) => p.deve > 0.005)).slice(0, 40);
}

/* Uma entrada de alguem com quem ainda nao ha conta corrente: cria-se (ou
   reaproveita-se, se o nome ja existir) e a entrada liga-se a ela.
   - 'parte': a parte dela numa conta que o Marco pagou fora do Farol (em
     dinheiro, noutra conta): lanca-se o que devia e a entrada acerta-o.
   - 'adiantou': emprestou ou adiantou dinheiro; fica o Marco a dever. */
async function novaComEntrada(movimentoId, b) {
  const m = (await all("SELECT id, to_char(data,'YYYY-MM-DD') AS data, descricao, valor FROM fin_movimentos WHERE id = $1", [movimentoId]))[0];
  if (!m) throw erro(404, 'Movimento não encontrado.');
  if (!(Number(m.valor) > 0)) throw erro(400, 'Só para dinheiro que entrou.');
  const nome = String((b && b.nome) || pagador(m.descricao) || '').trim().slice(0, 120);
  if (!nome) throw erro(400, 'Falta o nome.');
  const tipo = b && b.tipo === 'adiantou' ? 'adiantou' : 'parte';
  const pessoaId = await resolverPessoa(nome);
  if (tipo === 'parte') {
    const desc = String((b && b.descricao) || '').trim().slice(0, 200) || ('Parte de uma conta · ' + m.descricao);
    await query(`INSERT INTO fin_cc_mov (pessoa_id, data, descricao, valor, origem) VALUES ($1, $2, $3, $4, 'tu')`, [pessoaId, m.data, desc, cent(m.valor)]);
  }
  await ligarMovimento(m.id, pessoaId);
  /* A parte lancada e o acerto dela contam os dois, tambem para quem esta no
     Splitwise (o Splitwise nunca os viu). */
  if (tipo === 'parte') await query(`UPDATE fin_cc_mov SET origem = 'reembolso' WHERE movimento_id = $1`, [m.id]);
  return { pessoa_id: pessoaId, nome, tipo };
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
    /* O cartao de credito lanca a compra uns dias depois: a parte pode ter
       data posterior a da transferencia com que a pessoa a devolveu. */
    const igual = p.partes.find((x) => Math.abs(x.valor - v) < 0.006 && x.data <= somaDias(m.data, 10));
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

/* ======================= contas correntes por grupo ======================= */
/* Cada pessoa sem grupo (ou com dividas fora dos grupos) tem a sua conta
   direta; e os lancamentos ficam na conta certa: os do Splitwise no grupo de
   onde vem, os outros (a mao, do banco, das contas partilhadas) na conta
   direta, se nao disserem outra. */
async function organizarContas() {
  await query(
    `INSERT INTO fin_cc_contas (nome, pessoa_direta_id)
     SELECT p.nome, p.id FROM fin_cc_pessoas p
      WHERE NOT EXISTS (SELECT 1 FROM fin_cc_contas c WHERE c.pessoa_direta_id = p.id)
        AND (NOT EXISTS (SELECT 1 FROM fin_cc_membros mb WHERE mb.pessoa_id = p.id)
             OR EXISTS (SELECT 1 FROM fin_cc_mov m WHERE m.pessoa_id = p.id AND (m.origem <> 'splitwise' OR COALESCE(m.grupo_id, 0) = 0))
             OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p.por_grupo) = 'array' THEN p.por_grupo ELSE '[]'::jsonb END) g
                         WHERE COALESCE((g->>'id')::bigint, 0) = 0))
     ON CONFLICT DO NOTHING`);
  await query(
    `INSERT INTO fin_cc_membros (conta_id, pessoa_id)
     SELECT id, pessoa_direta_id FROM fin_cc_contas WHERE pessoa_direta_id IS NOT NULL ON CONFLICT DO NOTHING`);
  await query(
    `UPDATE fin_cc_mov m SET conta_id = c.id FROM fin_cc_contas c
      WHERE m.origem = 'splitwise' AND COALESCE(m.grupo_id, 0) <> 0 AND c.splitwise_grupo_id = m.grupo_id
        AND m.conta_id IS DISTINCT FROM c.id`);
  await query(
    `UPDATE fin_cc_mov m SET conta_id = c.id FROM fin_cc_contas c
      WHERE c.pessoa_direta_id = m.pessoa_id AND m.conta_id IS NULL
        AND (m.origem <> 'splitwise' OR COALESCE(m.grupo_id, 0) = 0)`);
  /* A parte de cada pessoa sabe em que conta corrente esta. */
  await query(
    `UPDATE fin_mov_partes p SET cc_conta_id = c.conta_id FROM fin_cc_mov c
      WHERE c.parte_id = p.id AND p.cc_conta_id IS NULL AND c.conta_id IS NOT NULL`);
}

async function contaDireta(pessoaId) {
  await organizarContas();
  const c = (await all('SELECT id FROM fin_cc_contas WHERE pessoa_direta_id = $1', [pessoaId]))[0];
  if (c) return c.id;
  const n = (await all(
    `INSERT INTO fin_cc_contas (nome, pessoa_direta_id) SELECT nome, id FROM fin_cc_pessoas WHERE id = $1 RETURNING id`, [pessoaId]))[0];
  await query('INSERT INTO fin_cc_membros (conta_id, pessoa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [n.id, pessoaId]);
  return n.id;
}

/* O que cada pessoa deve em cada conta corrente. A parte do Splitwise vem do
   saldo que ele da por grupo (o que nao e de grupo nenhum e a conta direta);
   a do Farol soma os lancamentos a mao, as contas partilhadas e os
   reembolsos (e, para quem nao esta no Splitwise, os acertos do banco). */
async function lerContas(pessoas) {
  const contas = await all(
    `SELECT c.id, c.nome, c.splitwise_grupo_id::text AS splitwise_grupo_id, c.pessoa_direta_id, c.ativo, c.nota,
            to_char((SELECT MAX(m.data) FROM fin_cc_mov m WHERE m.conta_id = c.id AND NOT m.apagado), 'YYYY-MM-DD') AS ultimo,
            (SELECT COUNT(*) FROM fin_cc_mov m WHERE m.conta_id = c.id AND NOT m.apagado) AS n
       FROM fin_cc_contas c ORDER BY c.splitwise_grupo_id IS NULL, c.nome`);
  const membros = await all('SELECT conta_id, pessoa_id FROM fin_cc_membros');
  const farol = await all(
    `SELECT m.conta_id, m.pessoa_id, SUM(m.valor) AS s FROM fin_cc_mov m JOIN fin_cc_pessoas p ON p.id = m.pessoa_id
      WHERE NOT m.apagado AND m.conta_id IS NOT NULL
        AND (m.origem IN ('tu', 'partilha', 'reembolso') OR (m.origem = 'banco' AND p.splitwise_id IS NULL))
      GROUP BY m.conta_id, m.pessoa_id`);
  const porP = {};
  pessoas.forEach((p) => { porP[p.id] = p; });
  const fs = {};
  farol.forEach((f) => { fs[f.conta_id + ':' + f.pessoa_id] = cent(f.s); });
  return contas.map((c) => {
    const grupo = c.splitwise_grupo_id ? Number(c.splitwise_grupo_id) : 0;
    const ms = membros.filter((x) => x.conta_id === c.id).map((x) => {
      const p = porP[x.pessoa_id];
      if (!p) return null;
      let sw = 0;
      if (p.splitwise_id) {
        const pg = Array.isArray(p.por_grupo) ? p.por_grupo : [];
        if (grupo) sw = cent((pg.find((g) => Number(g.id) === grupo) || {}).saldo || 0);
        else if (c.pessoa_direta_id === p.id) sw = cent((p.saldo_splitwise || 0) - pg.filter((g) => Number(g.id) !== 0).reduce((t, g) => t + Number(g.saldo || 0), 0));
      }
      const fa = fs[c.id + ':' + p.id] || 0;
      return { pessoa_id: p.id, nome: p.nome, splitwise: Boolean(p.splitwise_id), saldo_splitwise: sw, saldo_farol: fa, saldo: cent(sw + fa) };
    }).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome));
    const direta = c.pessoa_direta_id ? porP[c.pessoa_direta_id] : null;
    const tipo = grupo ? 'splitwise' : (direta && direta.splitwise_id ? 'splitwise' : 'farol');
    const saldo = cent(ms.reduce((t, x) => t + x.saldo, 0));
    return {
      id: c.id, nome: c.nome, tipo, grupo: grupo || null, direta: Boolean(c.pessoa_direta_id), pessoa_direta_id: c.pessoa_direta_id,
      ativo: c.ativo && (!direta || direta.ativo), nota: c.nota, ultimo: c.ultimo, n: Number(c.n), membros: ms, saldo,
      estado: ms.some((x) => Math.abs(x.saldo) >= 0.01) ? 'aberta' : 'saldada'
    };
  });
}

/* ======================= contas partilhadas ======================= */
/* As partes antigas (de antes de haver contas partilhadas) e as que o
   caminho das sugestoes cria ganham o cabecalho que lhes falta; e o
   cabecalho acompanha as partes (total, a parte do Marco). */
async function garantirCabecalhos() {
  await query(
    `INSERT INTO fin_partilhas (movimento_id, descricao, data, total, minha, categoria_id)
     SELECT m.id,
            COALESCE((SELECT c.descricao FROM fin_cc_mov c JOIN fin_mov_partes p2 ON p2.id = c.parte_id WHERE p2.movimento_id = m.id ORDER BY c.id LIMIT 1), m.descricao),
            m.data, -m.valor, 0,
            (SELECT p3.categoria_id FROM fin_mov_partes p3 WHERE p3.movimento_id = m.id AND p3.pessoa_id IS NULL ORDER BY p3.id LIMIT 1)
       FROM fin_movimentos m
      WHERE EXISTS (SELECT 1 FROM fin_mov_partes p WHERE p.movimento_id = m.id AND p.partilha_id IS NULL AND p.pessoa_id IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM fin_partilhas f WHERE f.movimento_id = m.id)`);
  await query(
    `UPDATE fin_mov_partes p SET partilha_id = f.id FROM fin_partilhas f
      WHERE f.movimento_id = p.movimento_id AND p.partilha_id IS NULL`);
  await query(
    `UPDATE fin_partilhas f SET
        minha = COALESCE((SELECT -SUM(p.valor) FROM fin_mov_partes p WHERE p.partilha_id = f.id AND p.pessoa_id IS NULL), 0),
        total = COALESCE((SELECT -SUM(m.valor) FROM fin_movimentos m WHERE m.id IN (SELECT p.movimento_id FROM fin_mov_partes p WHERE p.partilha_id = f.id)), f.total)
      WHERE EXISTS (SELECT 1 FROM fin_mov_partes p WHERE p.partilha_id = f.id)`);
  /* Sem partes nenhuma (desfeita pelo caminho antigo), so fica se tiver uma
     despesa no Splitwise por apagar. */
  await query(
    `DELETE FROM fin_partilhas f WHERE NOT EXISTS (SELECT 1 FROM fin_mov_partes p WHERE p.partilha_id = f.id)
        AND (f.splitwise IS NULL OR f.splitwise = '{}'::jsonb)`);
}

function alocar(valor, pesos) {
  const cents = Math.round(valor * 100), soma = pesos.reduce((t, p) => t + p, 0);
  if (!soma) return pesos.map(() => 0);
  const brutos = pesos.map((p) => cents * p / soma);
  const out = brutos.map(Math.floor);
  let falta = cents - out.reduce((t, x) => t + x, 0);
  brutos.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (falta > 0) { out[i]++; falta--; } });
  return out.map((x) => x / 100);
}

const numero = (v) => cent(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.'));

/* Guarda uma conta partilhada: os pagamentos (um ou mais), quanto paga o
   Marco e a linha de cada pessoa (com a conta corrente onde fica). Refazer
   substitui as partes, mas mantem a ligacao as despesas do Splitwise. */
async function guardarPartilha(b) {
  const ids = [...new Set((b.movimentos || []).map(Number).filter(Boolean))];
  if (!ids.length) throw erro(400, 'Faltam os pagamentos.');
  const debs = await all("SELECT id, to_char(data,'YYYY-MM-DD') AS data, descricao, valor FROM fin_movimentos WHERE id = ANY($1::int[]) ORDER BY data, id", [ids]);
  if (debs.length !== ids.length) throw erro(404, 'Algum pagamento já não existe.');
  if (debs.some((d) => !(Number(d.valor) < 0))) throw erro(400, 'Só se partilha dinheiro que saiu da conta.');
  const pesos = debs.map((d) => cent(-Number(d.valor)));
  const total = cent(pesos.reduce((t, x) => t + x, 0));
  const minha = numero(b.minha);
  if (minha < 0) throw erro(400, 'A tua parte não pode ser negativa.');
  let linhas = (b.linhas || []).map((l) => ({
    pessoa_id: l.pessoa_id ? Number(l.pessoa_id) : null, nome: String(l.nome || '').trim().slice(0, 120),
    valor: numero(l.valor), conta_id: l.conta_id ? Number(l.conta_id) : null, splitwise: Boolean(l.splitwise), entrada: l.entrada == null ? null : l.entrada
  })).filter((l) => (l.pessoa_id || l.nome) && l.valor > 0);
  if (!linhas.length && !(minha > 0)) throw erro(400, 'Falta com quem partilhar.');
  const soma = cent(minha + linhas.reduce((t, l) => t + l.valor, 0));
  if (Math.abs(soma - total) > 0.005) {
    throw erro(400, 'As partes somam ' + soma.toFixed(2).replace('.', ',') + ' € e o total é ' + total.toFixed(2).replace('.', ',') + ' €.');
  }
  for (const l of linhas) { if (!l.pessoa_id) l.pessoa_id = await resolverPessoa(l.nome); }
  /* O que se escreveu em cada linha (a percentagem, as porcoes...), por pessoa. */
  let entradas = null;
  if (b.metodo && b.metodo !== 'iguais' && b.metodo !== 'valores') {
    entradas = { eu: b.entrada_eu == null ? null : b.entrada_eu, p: {} };
    linhas.forEach((l) => { if (l.entrada != null) entradas.p[l.pessoa_id] = l.entrada; });
  }
  /* A conta corrente de cada linha: a escolhida (tem de ser uma onde a
     pessoa esta), ou a direta. */
  const membros = await all('SELECT conta_id, pessoa_id FROM fin_cc_membros WHERE pessoa_id = ANY($1::int[])', [linhas.map((l) => l.pessoa_id)]);
  for (const l of linhas) {
    if (l.conta_id && !membros.some((x) => x.conta_id === l.conta_id && x.pessoa_id === l.pessoa_id)) {
      const c = (await all('SELECT splitwise_grupo_id, pessoa_direta_id FROM fin_cc_contas WHERE id = $1', [l.conta_id]))[0];
      if (!c) throw erro(404, 'Essa conta corrente já não existe.');
      if (c.splitwise_grupo_id || c.pessoa_direta_id) throw erro(400, 'Essa pessoa não está nessa conta corrente.');
      await query('INSERT INTO fin_cc_membros (conta_id, pessoa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [l.conta_id, l.pessoa_id]);
    }
    if (!l.conta_id) l.conta_id = await contaDireta(l.pessoa_id);
  }
  /* A mesma pessoa na mesma conta e uma linha so. */
  const junta = {};
  linhas.forEach((l) => { const k = l.pessoa_id + ':' + l.conta_id + ':' + l.splitwise; if (junta[k]) junta[k].valor = cent(junta[k].valor + l.valor); else junta[k] = Object.assign({}, l); });
  linhas = Object.values(junta);
  const contas = await all(
    `SELECT c.id, c.splitwise_grupo_id::text AS grupo, c.pessoa_direta_id, p.splitwise_id::text AS direta_sw
       FROM fin_cc_contas c LEFT JOIN fin_cc_pessoas p ON p.id = c.pessoa_direta_id WHERE c.id = ANY($1::int[])`, [linhas.map((l) => l.conta_id)]);
  const contaSw = (cid) => { const c = contas.find((x) => x.id === cid); return Boolean(c && (c.grupo || c.direta_sw)); };
  /* So vai para o Splitwise a linha que o pede (numa conta do Splitwise); a
     que fica so no Farol, se estava num grupo, passa para a conta direta. */
  for (const l of linhas) {
    if (l.splitwise && !contaSw(l.conta_id)) throw erro(400, 'Essa conta corrente não é do Splitwise.');
    const c = contas.find((x) => x.id === l.conta_id);
    if (!l.splitwise && c && c.grupo) l.conta_id = await contaDireta(l.pessoa_id);
  }
  const daSw = (l) => l.splitwise;
  const pessoasSw = await all('SELECT id, nome, splitwise_id::text AS splitwise_id FROM fin_cc_pessoas WHERE id = ANY($1::int[])', [linhas.map((l) => l.pessoa_id)]);
  for (const l of linhas) {
    if (daSw(l) && !(pessoasSw.find((p) => p.id === l.pessoa_id) || {}).splitwise_id) {
      throw erro(400, (pessoasSw.find((p) => p.id === l.pessoa_id) || {}).nome + ' não está no Splitwise: escolhe outra conta corrente.');
    }
  }
  const descricao = String(b.descricao || '').trim().slice(0, 200) || (debs.length === 1 ? debs[0].descricao : debs.length + ' pagamentos');
  const acertos = (await all("SELECT id FROM fin_categorias WHERE natureza = 'transferencia' AND nome ILIKE '%acerto%' ORDER BY id LIMIT 1"))[0];
  const categoria = minha > 0.005 ? (b.categoria_id ? Number(b.categoria_id) : null) : (acertos ? acertos.id : null);

  const cli = await pool.connect();
  let pid = b.id ? Number(b.id) : null;
  try {
    await cli.query('BEGIN');
    if (pid) {
      const r = await cli.query(
        `UPDATE fin_partilhas SET movimento_id = $2, descricao = $3, data = $4, total = $5, minha = $6, iguais = $7, categoria_id = $8, nota = $9,
                metodo = $10, entradas = $11::jsonb
          WHERE id = $1 RETURNING id`, [pid, debs.length === 1 ? debs[0].id : null, descricao, debs[0].data, total, minha, Boolean(b.iguais), categoria, b.nota || null,
          b.metodo || null, entradas == null ? null : JSON.stringify(entradas)]);
      if (!r.rows.length) throw erro(404, 'Conta partilhada não encontrada.');
    } else {
      pid = (await cli.query(
        `INSERT INTO fin_partilhas (movimento_id, descricao, data, total, minha, iguais, categoria_id, nota, metodo, entradas)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb) RETURNING id`,
        [debs.length === 1 ? debs[0].id : null, descricao, debs[0].data, total, minha, Boolean(b.iguais), categoria, b.nota || null,
          b.metodo || null, entradas == null ? null : JSON.stringify(entradas)])).rows[0].id;
    }
    /* Um pagamento so pertence a uma conta partilhada: o que la havia sai. */
    await cli.query('DELETE FROM fin_mov_partes WHERE partilha_id = $1 OR movimento_id = ANY($2::int[])', [pid, ids]);
    await cli.query('DELETE FROM fin_cc_mov WHERE movimento_id = ANY($1::int[])', [ids]);
    await cli.query(
      `DELETE FROM fin_partilhas f WHERE f.id <> $1 AND NOT EXISTS (SELECT 1 FROM fin_mov_partes p WHERE p.partilha_id = f.id)
          AND (f.splitwise IS NULL OR f.splitwise = '{}'::jsonb)`, [pid]);
    const planos = linhas.map((l) => alocar(l.valor, pesos));
    for (let i = 0; i < debs.length; i++) {
      const d = debs[i];
      const outros = cent(planos.reduce((t, pl) => t + pl[i], 0));
      const aMinha = cent(pesos[i] - outros);
      if (aMinha > 0.005) {
        await cli.query('INSERT INTO fin_mov_partes (movimento_id, valor, categoria_id, partilha_id) VALUES ($1, $2, $3, $4)', [d.id, -aMinha, categoria, pid]);
      }
      for (let j = 0; j < linhas.length; j++) {
        const v = planos[j][i];
        if (!(v > 0)) continue;
        const l = linhas[j];
        const pt = (await cli.query(
          'INSERT INTO fin_mov_partes (movimento_id, valor, pessoa_id, partilha_id, cc_conta_id, sw) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [d.id, -v, l.pessoa_id, pid, l.conta_id, l.splitwise])).rows[0];
        /* No Splitwise a divida chega pela despesa de la; no Farol fica aqui. */
        if (!daSw(l)) {
          await cli.query(
            `INSERT INTO fin_cc_mov (pessoa_id, data, descricao, valor, origem, total, parte_id, conta_id)
             VALUES ($1, $2, $3, $4, 'partilha', $5, $6, $7)`,
            [l.pessoa_id, d.data, debs.length === 1 ? descricao : descricao + ' · ' + d.descricao, v, total, pt.id, l.conta_id]);
        }
      }
      if (categoria) await cli.query(`UPDATE fin_movimentos SET categoria_id = $1, categoria_fonte = 'tu', categoria_em = now() WHERE id = $2`, [categoria, d.id]);
    }
    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { cli.release(); }
  /* Ja dividida no Splitwise (pela despesa do Farol): liga-se a essa despesa,
     nao se cria outra. */
  if (b.splitwise_existente && typeof b.splitwise_existente === 'object') {
    const g = {};
    const antes = ((await all('SELECT splitwise FROM fin_partilhas WHERE id = $1', [pid]))[0] || {}).splitwise || {};
    for (const k of Object.keys(b.splitwise_existente)) {
      const novo = Number(b.splitwise_existente[k]);
      if (!novo) continue;
      g[k] = { expense_id: novo, criada: false, assinatura: null };
      /* A que o Farol tinha criado para esta conta deixa de servir: sai do Splitwise. */
      const v = antes[k];
      if (v && v.criada && v.expense_id && Number(v.expense_id) !== novo) {
        try { await splitwise.pedir('/delete_expense/' + v.expense_id, { metodo: 'POST' }); } catch (e) { console.error('[farol] splitwise apagar despesa:', e.message); }
      }
    }
    await query(`UPDATE fin_partilhas SET splitwise = COALESCE(splitwise, '{}'::jsonb) || $2::jsonb WHERE id = $1`, [pid, JSON.stringify(g)]);
  }
  let sw = { criadas: 0, existentes: 0, atualizadas: 0, apagadas: 0, erros: [] };
  try { sw = await partilhaNoSplitwise(pid); } catch (e) { sw.erros.push(e.message); }
  return { id: pid, minha, outros: cent(total - minha), total, pessoas: linhas.length, splitwise: sw };
}

/* As linhas de uma conta partilhada que vao para o Splitwise, por conta
   corrente (um grupo, ou a conta direta com um amigo, que e o grupo 0). */
async function linhasSplitwise(pid) {
  return all(
    `SELECT pt.cc_conta_id AS conta_id, c.nome AS conta, COALESCE(c.splitwise_grupo_id, 0)::text AS grupo,
            pt.pessoa_id, p.nome, p.splitwise_id::text AS splitwise_id, -SUM(pt.valor) AS valor,
            dp.splitwise_id::text AS direta_sw
       FROM fin_mov_partes pt
       JOIN fin_cc_contas c ON c.id = pt.cc_conta_id
       JOIN fin_cc_pessoas p ON p.id = pt.pessoa_id
       LEFT JOIN fin_cc_pessoas dp ON dp.id = c.pessoa_direta_id
      WHERE pt.partilha_id = $1 AND pt.pessoa_id IS NOT NULL AND pt.sw
        AND (c.splitwise_grupo_id IS NOT NULL OR dp.splitwise_id IS NOT NULL)
      GROUP BY pt.cc_conta_id, c.nome, c.splitwise_grupo_id, pt.pessoa_id, p.nome, p.splitwise_id, dp.splitwise_id
      ORDER BY pt.cc_conta_id, p.nome`, [pid]);
}

/* Leva a conta partilhada ao Splitwise. Antes de criar, procura-se la uma
   despesa que ja seja esta (o mesmo grupo ou amigo, o mesmo valor - so as
   partes dos outros ou o total -, a mesma gente, uns dias antes ou depois):
   se existir, liga-se a ela e nao se cria outra. As que o Farol criou e
   mudaram atualizam-se; as que deixaram de ter linhas apagam-se. */
async function partilhaNoSplitwise(pid) {
  const out = { criadas: 0, existentes: 0, atualizadas: 0, apagadas: 0, erros: [] };
  const f = (await all("SELECT id, descricao, to_char(data,'YYYY-MM-DD') AS data, total, minha, splitwise FROM fin_partilhas WHERE id = $1", [pid]))[0];
  if (!f) return out;
  const guardado = (f.splitwise && typeof f.splitwise === 'object') ? Object.assign({}, f.splitwise) : {};
  const ls = await linhasSplitwise(pid);
  const porConta = {};
  ls.forEach((l) => { (porConta[l.conta_id] = porConta[l.conta_id] || { conta_id: l.conta_id, conta: l.conta, grupo: Number(l.grupo), linhas: [] }).linhas.push(l); });
  const contas = Object.values(porConta);
  if (!contas.length && !Object.keys(guardado).length) return out;
  if (!(await splitwise.ativo().catch(() => false))) { out.erros.push('O Splitwise não está ligado: a parte de lá não foi lançada.'); return out; }
  const eu = Number((await splitwise.quemSou()).id);
  /* Todas as linhas do Splitwise numa conta so, e nenhuma fora: vai a conta
     inteira, com a parte do Marco. Senao, cada despesa leva so a parte dos
     outros. */
  const totalLinhas = cent(ls.reduce((t, l) => t + Number(l.valor), 0));
  const outrasFora = cent(Number(f.total) - Number(f.minha) - totalLinhas);
  const inteira = contas.length === 1 && Math.abs(outrasFora) < 0.005;
  const somaD = (iso, n) => somaDias(iso, n);
  for (const c of contas) {
    const custo = inteira ? cent(f.total) : cent(c.linhas.reduce((t, l) => t + Number(l.valor), 0));
    const minhaAqui = inteira ? cent(f.minha) : 0;
    const users = [{ id: eu, paid: custo, owed: minhaAqui }].concat(c.linhas.map((l) => ({ id: Number(l.splitwise_id), paid: 0, owed: cent(l.valor) })));
    const assinatura = JSON.stringify([c.grupo, f.descricao, f.data, custo, users.map((u) => [u.id, u.owed]).sort((a, b) => a[0] - b[0])]);
    const ja = guardado[c.conta_id];
    if (ja && ja.assinatura === assinatura) continue;
    const corpo = { cost: custo.toFixed(2), description: String(f.descricao).slice(0, 120), date: f.data + 'T12:00:00Z', currency_code: 'EUR', group_id: c.grupo,
      details: 'Conta partilhada no Farol' };
    users.forEach((u, i) => {
      corpo['users__' + i + '__user_id'] = u.id;
      corpo['users__' + i + '__paid_share'] = u.paid.toFixed(2);
      corpo['users__' + i + '__owed_share'] = u.owed.toFixed(2);
    });
    try {
      if (ja && ja.expense_id && ja.criada) {
        await splitwise.pedir('/update_expense/' + ja.expense_id, { metodo: 'POST', corpo });
        guardado[c.conta_id] = Object.assign({}, ja, { assinatura });
        out.atualizadas++;
        continue;
      }
      if (ja && ja.expense_id && !ja.criada) {
        /* Ligada a uma que ja la estava: essa e a referencia; nao se mexe. */
        guardado[c.conta_id] = Object.assign({}, ja, { assinatura });
        continue;
      }
      /* Ja esta la? */
      const filtro = c.grupo ? 'group_id=' + c.grupo : 'friend_id=' + c.linhas[0].splitwise_id;
      const j = await splitwise.pedir('/get_expenses?' + filtro + '&dated_after=' + somaD(f.data, -7) + '&dated_before=' + somaD(f.data, 8) + '&limit=200');
      const usados = new Set();
      (await all("SELECT splitwise FROM fin_partilhas WHERE id <> $1 AND splitwise IS NOT NULL", [pid])).forEach((x) => {
        Object.values(x.splitwise || {}).forEach((v) => { if (v && v.expense_id) usados.add(String(v.expense_id)); });
      });
      const quem = c.linhas.map((l) => Number(l.splitwise_id));
      const igual = ((j && j.expenses) || []).find((e) => {
        if (e.deleted_at || e.payment || usados.has(String(e.id))) return false;
        if (Number(e.group_id || 0) !== c.grupo) return false;
        const custoE = cent(e.cost);
        if (Math.abs(custoE - custo) > 0.005 && Math.abs(custoE - cent(f.total)) > 0.005 && Math.abs(custoE - cent(c.linhas.reduce((t, l) => t + Number(l.valor), 0))) > 0.005) return false;
        const nela = (e.users || []).map((u) => Number(u.user_id || (u.user && u.user.id)));
        return quem.every((q) => nela.indexOf(q) >= 0);
      });
      if (igual) {
        guardado[c.conta_id] = { expense_id: Number(igual.id), criada: false, assinatura, descricao: igual.description, data: String(igual.date || '').slice(0, 10) };
        out.existentes++;
        continue;
      }
      const r = await splitwise.pedir('/create_expense', { metodo: 'POST', corpo });
      const feita = (r && r.expenses && r.expenses[0]) || null;
      if (!feita) throw new Error('O Splitwise não devolveu a despesa criada.');
      guardado[c.conta_id] = { expense_id: Number(feita.id), criada: true, assinatura };
      out.criadas++;
    } catch (e) {
      out.erros.push(c.conta + ': ' + e.message);
    }
  }
  /* Contas que deixaram de ter linhas: a despesa que o Farol criou sai. */
  for (const k of Object.keys(guardado)) {
    if (porConta[k]) continue;
    const g = guardado[k];
    try {
      if (g && g.criada && g.expense_id) { await splitwise.pedir('/delete_expense/' + g.expense_id, { metodo: 'POST' }); out.apagadas++; }
      delete guardado[k];
    } catch (e) { out.erros.push(e.message); }
  }
  await query('UPDATE fin_partilhas SET splitwise = $2::jsonb WHERE id = $1', [pid, JSON.stringify(guardado)]);
  if (out.criadas || out.atualizadas || out.apagadas || out.existentes) {
    /* O saldo de quem esta no Splitwise vem de la: le-se ja, sem esperar pela noite. */
    sincronizar().catch((e) => console.error('[farol] contas correntes (depois da partilha):', e.message));
  }
  return out;
}

async function apagarPartilha(pid) {
  const f = (await all('SELECT id, splitwise FROM fin_partilhas WHERE id = $1', [pid]))[0];
  if (!f) throw erro(404, 'Conta partilhada não encontrada.');
  await query('DELETE FROM fin_mov_partes WHERE partilha_id = $1', [pid]);
  const r = await partilhaNoSplitwise(pid).catch((e) => ({ erros: [e.message], apagadas: 0 }));
  await query('DELETE FROM fin_partilhas WHERE id = $1', [pid]);
  return { ok: true, splitwise: r };
}

/* O que cada pessoa ja pagou, pelo mais antigo primeiro: o que entrou dela
   (reembolsos, acertos) vai abatendo as dividas pela ordem em que nasceram.
   So conta o que e do Farol; o do Splitwise acerta-se la. */
async function pagoPorParte() {
  const ms = await all(
    `SELECT m.id, m.pessoa_id, m.conta_id, m.valor, m.parte_id, m.data FROM fin_cc_mov m JOIN fin_cc_pessoas p ON p.id = m.pessoa_id
      WHERE NOT m.apagado AND (m.origem IN ('tu', 'partilha', 'reembolso') OR (m.origem = 'banco' AND p.splitwise_id IS NULL))
      ORDER BY m.data, m.id`);
  const porPessoa = {};
  ms.forEach((m) => { (porPessoa[m.pessoa_id] = porPessoa[m.pessoa_id] || []).push(Object.assign(m, { valor: cent(m.valor) })); });
  const pago = {};
  Object.values(porPessoa).forEach((lista) => {
    let credito = cent(-lista.filter((m) => m.valor < 0).reduce((t, m) => t + m.valor, 0));
    lista.filter((m) => m.valor > 0).forEach((m) => {
      const p = Math.min(credito, m.valor);
      credito = cent(credito - p);
      if (m.parte_id) pago[m.parte_id] = cent(p);
    });
  });
  return pago;
}

async function listarPartilhas(filtro) {
  const fi = filtro || {};
  const cab = await all(
    `SELECT f.id, f.movimento_id, f.descricao, to_char(f.data,'YYYY-MM-DD') AS data, f.total, f.minha, f.iguais, f.categoria_id, f.splitwise, f.nota,
            f.metodo, f.entradas
       FROM fin_partilhas f ${fi.id ? 'WHERE f.id = $1' : fi.pessoa ? 'WHERE EXISTS (SELECT 1 FROM fin_mov_partes x WHERE x.partilha_id = f.id AND x.pessoa_id = $1)' : ''}
      ORDER BY f.data DESC, f.id DESC LIMIT 2000`, fi.id ? [fi.id] : fi.pessoa ? [fi.pessoa] : []);
  if (!cab.length) return [];
  const ids = cab.map((f) => f.id);
  const partes = await all(
    `SELECT pt.id, pt.partilha_id, pt.movimento_id, pt.valor, pt.pessoa_id, pt.cc_conta_id, pt.categoria_id, p.nome, c.nome AS conta,
            pt.sw AS conta_sw
       FROM fin_mov_partes pt
       LEFT JOIN fin_cc_pessoas p ON p.id = pt.pessoa_id
       LEFT JOIN fin_cc_contas c ON c.id = pt.cc_conta_id
       LEFT JOIN fin_cc_pessoas dp ON dp.id = c.pessoa_direta_id
      WHERE pt.partilha_id = ANY($1::int[]) ORDER BY pt.id`, [ids]);
  const movs = await all(
    `SELECT m.id, to_char(m.data,'YYYY-MM-DD') AS data, m.descricao, m.valor, m.conta_id,
            m.repres_empresa_id, m.repres_estado, rp.nome AS repres_empresa,
            (ct.empresa_id IS NOT NULL AND ct.empresa_id = m.repres_empresa_id) AS repres_cartao
       FROM fin_movimentos m
       LEFT JOIN fin_cc_pessoas rp ON rp.id = m.repres_empresa_id
       LEFT JOIN fin_contas ct ON ct.id = m.conta_id
      WHERE m.id IN (SELECT movimento_id FROM fin_mov_partes WHERE partilha_id = ANY($1::int[]))`, [ids]);
  const pago = await pagoPorParte();
  return cab.map((f) => {
    const ps = partes.filter((p) => p.partilha_id === f.id);
    const linhas = {};
    ps.filter((p) => p.pessoa_id).forEach((p) => {
      const k = p.pessoa_id + ':' + p.cc_conta_id;
      const l = linhas[k] = linhas[k] || { pessoa_id: p.pessoa_id, nome: p.nome, conta_id: p.cc_conta_id, conta: p.conta, splitwise: Boolean(p.conta_sw), valor: 0, pago: 0 };
      l.valor = cent(l.valor - Number(p.valor));
      l.pago = cent(l.pago + (pago[p.id] || 0));
    });
    const ls = Object.values(linhas).map((l) => Object.assign(l, {
      estado: l.splitwise ? 'splitwise' : l.pago >= l.valor - 0.005 ? 'pago' : l.pago > 0.005 ? 'parcial' : 'por receber'
    }));
    const sw = (f.splitwise && typeof f.splitwise === 'object') ? f.splitwise : {};
    ls.forEach((l) => { const s = sw[l.conta_id]; if (s) l.splitwise_despesa = { id: s.expense_id, criada: s.criada }; });
    const mIds = [...new Set(ps.map((p) => p.movimento_id))];
    const minhaParte = ps.find((p) => !p.pessoa_id);
    return {
      id: f.id, descricao: f.descricao, data: f.data, total: cent(f.total), minha: cent(f.minha), iguais: f.iguais, nota: f.nota,
      metodo: f.metodo || (f.iguais ? 'iguais' : 'valores'), entradas: f.entradas || null,
      categoria_id: f.categoria_id || (minhaParte && minhaParte.categoria_id) || null,
      linhas: ls.sort((a, b) => a.nome.localeCompare(b.nome)),
      movimentos: movs.filter((m) => mIds.indexOf(m.id) >= 0).map((m) => Object.assign(m, { valor: cent(m.valor) })),
      /* Despesa de representacao: o pe vem do movimento. Com varios, vale o
         primeiro que esteja marcado - sao sempre da mesma empresa. */
      representacao: (() => {
        const r = movs.filter((m) => mIds.indexOf(m.id) >= 0 && m.repres_empresa_id)[0];
        return r ? { empresa_id: r.repres_empresa_id, empresa: r.repres_empresa, estado: r.repres_estado, cartao: Boolean(r.repres_cartao) } : null;
      })(),
      a_receber: cent(ls.filter((l) => !l.splitwise).reduce((t, l) => t + l.valor - l.pago, 0)),
      estado: ls.some((l) => l.estado === 'por receber' || l.estado === 'parcial') ? 'aberta' : 'saldada'
    };
  });
}

/* Junta duas pessoas que sao a mesma (o nome do banco e o do Splitwise):
   tudo passa para a que fica. Duas do Splitwise nao se juntam aqui. */
async function juntarPessoas(deId, paraId) {
  if (Number(deId) === Number(paraId)) throw erro(400, 'É a mesma pessoa.');
  const ps = await all('SELECT id, nome, person_id, splitwise_id::text AS splitwise_id FROM fin_cc_pessoas WHERE id = ANY($1::int[])', [[deId, paraId]]);
  const de = ps.find((p) => p.id === Number(deId)), para = ps.find((p) => p.id === Number(paraId));
  if (!de || !para) throw erro(404, 'Pessoa não encontrada.');
  if (de.splitwise_id && para.splitwise_id) throw erro(400, 'As duas estão no Splitwise: junta-as lá.');
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');
    const dDe = (await cli.query('SELECT id FROM fin_cc_contas WHERE pessoa_direta_id = $1', [de.id])).rows[0];
    let dPara = (await cli.query('SELECT id FROM fin_cc_contas WHERE pessoa_direta_id = $1', [para.id])).rows[0];
    if (dDe && !dPara) { await cli.query('UPDATE fin_cc_contas SET pessoa_direta_id = $1, nome = $2 WHERE id = $3', [para.id, para.nome, dDe.id]); dPara = dDe; }
    else if (dDe && dPara) {
      await cli.query('UPDATE fin_cc_mov SET conta_id = $1 WHERE conta_id = $2', [dPara.id, dDe.id]);
      await cli.query('UPDATE fin_mov_partes SET cc_conta_id = $1 WHERE cc_conta_id = $2', [dPara.id, dDe.id]);
      await cli.query('DELETE FROM fin_cc_contas WHERE id = $1', [dDe.id]);
    }
    await cli.query('INSERT INTO fin_cc_membros (conta_id, pessoa_id) SELECT conta_id, $1 FROM fin_cc_membros WHERE pessoa_id = $2 ON CONFLICT DO NOTHING', [para.id, de.id]);
    await cli.query('UPDATE fin_cc_mov SET pessoa_id = $1 WHERE pessoa_id = $2', [para.id, de.id]);
    await cli.query('UPDATE fin_mov_partes SET pessoa_id = $1 WHERE pessoa_id = $2', [para.id, de.id]);
    if (de.splitwise_id) {
      const x = (await cli.query('SELECT splitwise_id, saldo_splitwise, por_grupo, lido_em FROM fin_cc_pessoas WHERE id = $1', [de.id])).rows[0];
      await cli.query('UPDATE fin_cc_pessoas SET splitwise_id = NULL WHERE id = $1', [de.id]);
      await cli.query('UPDATE fin_cc_pessoas SET splitwise_id = $2, saldo_splitwise = $3, por_grupo = $4, lido_em = $5 WHERE id = $1',
        [para.id, x.splitwise_id, x.saldo_splitwise, x.por_grupo == null ? null : JSON.stringify(x.por_grupo), x.lido_em]);
    }
    if (!para.person_id && de.person_id) await cli.query('UPDATE fin_cc_pessoas SET person_id = $1 WHERE id = $2', [de.person_id, para.id]);
    await cli.query('DELETE FROM fin_cc_pessoas WHERE id = $1', [de.id]);
    await cli.query('COMMIT');
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { cli.release(); }
  await organizarContas();
  return { ok: true, id: para.id };
}

/* Uma despesa do Splitwise, para se ver no Farol: quem pagou, quanto e de
   cada um, o grupo. As pessoas aparecem com o nome que tem no Farol. */
async function despesaSplitwise(id) {
  const j = await splitwise.pedir('/get_expense/' + Number(id));
  const e = j && j.expense;
  if (!e) throw erro(404, 'O Splitwise não encontrou essa despesa.');
  const eu = Number((await splitwise.quemSou()).id);
  const ids = (e.users || []).map((u) => Number(u.user_id || (u.user && u.user.id)));
  const ps = await all('SELECT id, nome, splitwise_id::text AS sw FROM fin_cc_pessoas WHERE splitwise_id = ANY($1::bigint[])', [ids]);
  const grupo = Number(e.group_id || 0);
  const conta = grupo ? (await all('SELECT id, nome FROM fin_cc_contas WHERE splitwise_grupo_id = $1', [grupo]))[0] : null;
  return {
    id: Number(e.id), descricao: e.description, data: String(e.date || '').slice(0, 10), total: cent(e.cost), moeda: e.currency_code,
    grupo: grupo || null, grupo_nome: conta ? conta.nome : (grupo ? 'Grupo ' + grupo : 'Sem grupo'), conta_id: conta ? conta.id : null,
    apagada: Boolean(e.deleted_at), pagamento: Boolean(e.payment),
    pessoas: (e.users || []).map((u) => {
      const uid = Number(u.user_id || (u.user && u.user.id));
      const p = ps.find((x) => Number(x.sw) === uid);
      return { splitwise_id: uid, eu: uid === eu, pessoa_id: p ? p.id : null,
        nome: uid === eu ? 'Eu' : (p ? p.nome : nomeDe(u.user || { id: uid })), pagou: cent(u.paid_share), deve: cent(u.owed_share) };
    })
  };
}

/* Conta so a minha parte do movimento, como a despesa do Splitwise diz: fica
   uma despesa partilhada ligada a ela (sem criar outra no Splitwise). */
/* movimentoId pode ser uma lista: dois pagamentos que no Splitwise são uma
   despesa só (as poupanças da Sofia e da Maria, 50 + 50 = 100). */
async function partilhaDaDespesaSplitwise(movimentoId, expenseId, categoriaId) {
  const d = await despesaSplitwise(expenseId);
  const ids = [].concat(movimentoId).map(Number).filter(Boolean);
  const ms = await all('SELECT id, valor, categoria_id FROM fin_movimentos WHERE id = ANY($1::int[]) ORDER BY data, id', [ids]);
  if (!ms.length || ms.length !== ids.length) throw erro(404, 'Movimento não encontrado.');
  const m = Object.assign({}, ms[0], { valor: ms.reduce((t, x) => t + Number(x.valor), 0) });
  if (d.apagada) throw erro(400, 'Essa despesa foi apagada no Splitwise.');
  const total = cent(-Number(m.valor));
  if (Math.abs(d.total - total) > 0.005) throw erro(400, 'No Splitwise a despesa é de ' + d.total.toFixed(2).replace('.', ',') + ' € e o movimento de ' + total.toFixed(2).replace('.', ',') + ' €.');
  const minha = cent((d.pessoas.find((x) => x.eu) || {}).deve || 0);
  const linhas = [];
  const existente = {};
  for (const x of d.pessoas.filter((y) => !y.eu && y.deve > 0.005)) {
    let pid = x.pessoa_id;
    if (!pid) pid = (await all(
      `INSERT INTO fin_cc_pessoas (nome, splitwise_id) VALUES ($1, $2)
       ON CONFLICT (splitwise_id) DO UPDATE SET nome = fin_cc_pessoas.nome RETURNING id`, [x.nome, x.splitwise_id]))[0].id;
    let contaId = d.conta_id;
    if (!d.grupo) contaId = await contaDireta(pid);
    if (d.grupo && !contaId) throw erro(409, 'O grupo «' + d.grupo_nome + '» ainda não foi lido do Splitwise: carrega em «Ler o Splitwise agora» nas contas correntes.');
    await query('INSERT INTO fin_cc_membros (conta_id, pessoa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [contaId, pid]);
    linhas.push({ pessoa_id: pid, valor: x.deve, conta_id: contaId, splitwise: true });
    existente[contaId] = d.id;
  }
  if (!linhas.length) throw erro(400, 'No Splitwise esta despesa não está dividida com ninguém.');
  const atual = (await all('SELECT partilha_id FROM fin_mov_partes WHERE movimento_id = ANY($1::int[]) AND partilha_id IS NOT NULL LIMIT 1', [ids]))[0];
  return guardarPartilha({ id: atual ? atual.partilha_id : null, movimentos: ids, minha, metodo: 'valores', descricao: d.descricao,
    categoria_id: categoriaId || m.categoria_id, linhas, splitwise_existente: existente });
}

/* As despesas do Splitwise perto deste movimento (data +-30 dias), para
   escolher a que ja la esta: primeiro as do mesmo valor, depois as de data
   mais perto. As ja ligadas a outra despesa partilhada vem marcadas. */
async function despesasSplitwisePerto(movId, q, o) {
  o = o || {};
  const m = (await all("SELECT id, to_char(data,'YYYY-MM-DD') AS data, valor FROM fin_movimentos WHERE id = $1", [movId]))[0];
  if (!m) throw erro(404, 'Movimento não encontrado.');
  /* Para uma linha so (uma conta corrente do Splitwise): so as desse grupo ou
     amigo, e bate quando a parte dos outros (ou o total) e a da linha. */
  let conta = null;
  if (o.conta_id) {
    conta = (await all(
      `SELECT c.id, COALESCE(c.splitwise_grupo_id, 0)::text AS grupo, dp.splitwise_id::text AS amigo
         FROM fin_cc_contas c LEFT JOIN fin_cc_pessoas dp ON dp.id = c.pessoa_direta_id WHERE c.id = $1`, [Number(o.conta_id)]))[0];
    if (!conta) throw erro(404, 'Conta corrente não encontrada.');
  }
  const alvo = o.valor != null && o.valor !== '' ? cent(Number(String(o.valor).replace(',', '.'))) : null;
  const total = o.total != null && o.total !== '' ? cent(Number(String(o.total).replace(',', '.'))) : cent(-Number(m.valor));
  const j = await splitwise.pedir('/get_expenses?dated_after=' + somaDias(m.data, -30) + '&dated_before=' + somaDias(m.data, 31) + '&limit=500');
  const eu = Number((await splitwise.quemSou()).id);
  const ps = await all('SELECT id, nome, splitwise_id::text AS sw FROM fin_cc_pessoas WHERE splitwise_id IS NOT NULL');
  const grupos = await all('SELECT nome, splitwise_grupo_id::text AS g FROM fin_cc_contas WHERE splitwise_grupo_id IS NOT NULL');
  const usadas = {};
  (await all(
    `SELECT f.id, f.splitwise, (SELECT MIN(pt.movimento_id) FROM fin_mov_partes pt WHERE pt.partilha_id = f.id) AS mov
       FROM fin_partilhas f WHERE f.splitwise IS NOT NULL`)).forEach((x) => {
    if (Number(x.mov) === m.id) return;
    Object.values(x.splitwise || {}).forEach((v) => { if (v && v.expense_id) usadas[String(v.expense_id)] = x.mov || true; });
  });
  const tq = String(q || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const dias = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
  return ((j && j.expenses) || [])
    .filter((e) => !e.deleted_at && !e.payment)
    .filter((e) => !conta || (Number(e.group_id || 0) === Number(conta.grupo) &&
      (!conta.amigo || (e.users || []).some((u) => Number(u.user_id || (u.user && u.user.id)) === Number(conta.amigo)))))
    .filter((e) => !tq || String(e.description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(tq))
    .map((e) => {
      const data = String(e.date || '').slice(0, 10);
      const g = grupos.find((x) => Number(x.g) === Number(e.group_id || 0));
      const pessoas = (e.users || []).map((u) => {
        const uid = Number(u.user_id || (u.user && u.user.id));
        const p = ps.find((x) => Number(x.sw) === uid);
        return { eu: uid === eu, nome: uid === eu ? 'Eu' : (p ? p.nome : nomeDe(u.user || { id: uid })), pagou: cent(u.paid_share), deve: cent(u.owed_share) };
      });
      return {
        id: Number(e.id), descricao: e.description, data, total: cent(e.cost), dias: dias(data, m.data),
        grupo_nome: e.group_id ? (g ? g.nome : 'Grupo ' + e.group_id) : 'Sem grupo', pessoas,
        outros: cent(pessoas.filter((x) => !x.eu).reduce((t, x) => t + x.deve, 0)),
        igual: alvo != null
          ? (Math.abs(cent(e.cost) - alvo) < 0.006 || Math.abs(cent(pessoas.filter((x) => !x.eu).reduce((t, x) => t + x.deve, 0)) - alvo) < 0.006)
          : Math.abs(cent(e.cost) - total) < 0.006,
        usada: usadas[String(e.id)] || null
      };
    })
    .sort((a, b) => (b.igual ? 1 : 0) - (a.igual ? 1 : 0) || (a.usada ? 1 : 0) - (b.usada ? 1 : 0) || Math.abs(a.dias) - Math.abs(b.dias))
    .slice(0, 60);
}

function instalarContas(app, falha) {
  app.get('/api/financas/movimentos/:id(\\d+)/splitwise-despesas', async (req, res) => {
    try { res.json({ despesas: await despesasSplitwisePerto(Number(req.params.id), req.query.q, { conta_id: req.query.conta_id, valor: req.query.valor, total: req.query.total }) }); }
    catch (e) { falha(res, e, 'as despesas do Splitwise'); }
  });
  app.get('/api/financas/splitwise/despesas/:id(\\d+)', async (req, res) => {
    try { res.json({ despesa: await despesaSplitwise(req.params.id) }); } catch (e) { falha(res, e, 'a despesa do Splitwise'); }
  });
  app.post('/api/financas/movimentos/:id(\\d+)/partilha-splitwise', async (req, res) => {
    try {
      const b = req.body || {};
      const ids = Array.isArray(b.movimentos) && b.movimentos.length ? b.movimentos : [Number(req.params.id)];
      res.json(await partilhaDaDespesaSplitwise(ids, b.expense_id, b.categoria_id));
    }
    catch (e) { falha(res, e, 'a despesa partilhada'); }
  });
  app.get('/api/financas/cc/contas/:id(\\d+)', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const movs = await all(
        `SELECT c.id, to_char(c.data,'YYYY-MM-DD') AS data, c.descricao, c.valor, c.origem, c.grupo, c.total, c.pagamento, c.pessoa_id, p.nome AS pessoa,
                COALESCE(c.movimento_id, pt.movimento_id) AS movimento_id, pt.partilha_id
           FROM fin_cc_mov c JOIN fin_cc_pessoas p ON p.id = c.pessoa_id LEFT JOIN fin_mov_partes pt ON pt.id = c.parte_id
          WHERE c.conta_id = $1 AND NOT c.apagado ORDER BY c.data DESC, c.id DESC LIMIT 1500`, [id]);
      res.json({ movimentos: movs.map((m) => Object.assign(m, { valor: cent(m.valor), total: m.total == null ? null : cent(m.total) })) });
    } catch (e) { falha(res, e, 'conta corrente'); }
  });
  app.post('/api/financas/cc/contas', async (req, res) => {
    try {
      const b = req.body || {};
      const nome = String(b.nome || '').trim();
      if (!nome) return res.status(400).json({ error: 'Falta o nome.' });
      const c = (await all('INSERT INTO fin_cc_contas (nome, nota) VALUES ($1, $2) RETURNING id', [nome, b.nota || null]))[0];
      for (const pid of (b.membros || [])) await query('INSERT INTO fin_cc_membros (conta_id, pessoa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.id, Number(pid)]);
      res.json({ id: c.id });
    } catch (e) { falha(res, e, 'nova conta corrente'); }
  });
  app.patch('/api/financas/cc/contas/:id(\\d+)', async (req, res) => {
    try {
      const b = req.body || {}, id = Number(req.params.id);
      const c = (await all('SELECT splitwise_grupo_id, pessoa_direta_id FROM fin_cc_contas WHERE id = $1', [id]))[0];
      if (!c) return res.status(404).json({ error: 'Conta corrente não encontrada.' });
      if (b.nome !== undefined && !c.splitwise_grupo_id) await query('UPDATE fin_cc_contas SET nome = $1 WHERE id = $2', [String(b.nome).trim() || 'Conta', id]);
      if (b.ativo !== undefined) await query('UPDATE fin_cc_contas SET ativo = $1 WHERE id = $2', [Boolean(b.ativo), id]);
      if (b.nota !== undefined) await query('UPDATE fin_cc_contas SET nota = $1 WHERE id = $2', [b.nota || null, id]);
      if (Array.isArray(b.membros) && !c.splitwise_grupo_id && !c.pessoa_direta_id) {
        await query('DELETE FROM fin_cc_membros WHERE conta_id = $1 AND NOT (pessoa_id = ANY($2::int[]))', [id, b.membros.map(Number)]);
        for (const pid of b.membros) await query('INSERT INTO fin_cc_membros (conta_id, pessoa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, Number(pid)]);
      }
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'conta corrente'); }
  });

  app.get('/api/financas/partilhas', async (req, res) => {
    try { res.json({ partilhas: await listarPartilhas({ pessoa: req.query.pessoa ? Number(req.query.pessoa) : null }) }); }
    catch (e) { falha(res, e, 'contas partilhadas'); }
  });
  app.get('/api/financas/partilhas/:id(\\d+)', async (req, res) => {
    try {
      const p = (await listarPartilhas({ id: Number(req.params.id) }))[0];
      if (!p) return res.status(404).json({ error: 'Conta partilhada não encontrada.' });
      res.json({ partilha: p });
    } catch (e) { falha(res, e, 'conta partilhada'); }
  });
  app.post('/api/financas/partilhas', async (req, res) => {
    try { res.json(await guardarPartilha(req.body || {})); } catch (e) { falha(res, e, 'a conta partilhada'); }
  });
  app.put('/api/financas/partilhas/:id(\\d+)', async (req, res) => {
    try { res.json(await guardarPartilha(Object.assign({}, req.body || {}, { id: Number(req.params.id) }))); } catch (e) { falha(res, e, 'a conta partilhada'); }
  });
  app.delete('/api/financas/partilhas/:id(\\d+)', async (req, res) => {
    try { res.json(await apagarPartilha(Number(req.params.id))); } catch (e) { falha(res, e, 'a conta partilhada'); }
  });
  app.post('/api/financas/movimentos/:id(\\d+)/acerto', async (req, res) => {
    try { res.json(await registarAcerto(Number(req.params.id), req.body || {})); } catch (e) { falha(res, e, 'o acerto'); }
  });
  app.post('/api/financas/partilhas/:id(\\d+)/splitwise', async (req, res) => {
    try { res.json(await partilhaNoSplitwise(Number(req.params.id))); } catch (e) { falha(res, e, 'o Splitwise'); }
  });

  app.post('/api/financas/cc/pessoas/:id(\\d+)/juntar', async (req, res) => {
    try { res.json(await juntarPessoas(Number(req.params.id), Number((req.body || {}).em))); } catch (e) { falha(res, e, 'juntar pessoas'); }
  });
  app.delete('/api/financas/cc/pessoas/:id(\\d+)', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const n = (await all(
        `SELECT (SELECT COUNT(*) FROM fin_cc_mov WHERE pessoa_id = $1) + (SELECT COUNT(*) FROM fin_mov_partes WHERE pessoa_id = $1) AS n,
                (SELECT splitwise_id FROM fin_cc_pessoas WHERE id = $1) AS sw`, [id]))[0];
      if (Number(n.n) > 0 || n.sw) return res.status(409).json({ error: 'Tem movimentos (ou vem do Splitwise): esconde-a em vez de apagar.' });
      await query('DELETE FROM fin_cc_pessoas WHERE id = $1', [id]);
      res.json({ ok: true });
    } catch (e) { falha(res, e, 'apagar pessoa'); }
  });
}

module.exports = { instalar, arrancar, sincronizar, resumo, saldoTotalEm, ligarMovimento,
  dividir, desfazerDivisao, categoriaDaMinhaParte, abertos, reembolsoDe, pagador, resolverPessoa, sugerirDivisoes,
  contasEmAberto, novaComEntrada, registarAcerto, despesaSplitwise, partilhaDaDespesaSplitwise, organizarContas, garantirCabecalhos, guardarPartilha, apagarPartilha, listarPartilhas, contaDireta, lerContas };
