'use strict';
/* Farol - tarefas, segunda versao.
 *
 * O que se aprendeu a olhar para o TickTick, onde a casa viveu ate aqui:
 *   - uma tarefa tem passos (lista de verificacao) e pode ter subtarefas;
 *   - as rotinas repetem-se por regra (todo o dia 25, todos os anos a 31 de
 *     dezembro, as tercas) e ao concluir anda-se para a proxima data, ficando
 *     uma copia concluida como historico;
 *   - ha lembretes, etiquetas livres, comentarios que servem de registo
 *     (o valor da luz deste mes) e o estado «a espera» de outra pessoa.
 *
 * Nada aqui sabe nomes de pessoas ou de projetos: o repositorio e publico.
 */
const { query } = require('./db');

const all = async (sql, params) => (await query(sql, params)).rows;
const limpar = (v) => (v === undefined || v === '' ? null : v);

const STATUS = ['aberta', 'em_curso', 'a_espera', 'concluida', 'cancelada'];
const TIPOS = ['tarefa', 'lembrete', 'nota', 'pagamento'];
const METODOS = ['transferência', 'débito direto', 'multibanco', 'mb way', 'cartão', 'numerário', 'cheque', 'outro'];
const PRIOS = ['baixa', 'normal', 'media', 'alta'];
const FECHADAS = ['concluida', 'cancelada'];
/* O papel de um documento numa tarefa. Fora destes quatro, nao ha nome que
   alguem consiga ler daqui a um ano: o que vier de fora fica «anexo». */
const PAPEIS = ['anexo', 'fatura', 'comprovativo', 'recibo'];

/* ------------------------------------------------------------------ *
 * Repeticao
 * ------------------------------------------------------------------ */

const DIAS_RRULE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const REPEAT_EVERY = { dia: 'FREQ=DAILY', semana: 'FREQ=WEEKLY', mes: 'FREQ=MONTHLY', ano: 'FREQ=YEARLY' };

function lerRegra(texto) {
  if (!texto) return null;
  const r = {};
  String(texto).replace(/^RRULE:/i, '').split(';').forEach((p) => {
    const [k, v] = p.split('=');
    if (k && v !== undefined) r[k.trim().toUpperCase()] = v.trim();
  });
  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(r.FREQ)) return null;
  r.INTERVAL = Math.max(1, parseInt(r.INTERVAL || '1', 10) || 1);
  return r;
}

function normalizarRegra(texto) {
  if (!texto) return null;
  if (REPEAT_EVERY[texto]) return REPEAT_EVERY[texto];
  const r = lerRegra(texto);
  if (!r) return null;
  return String(texto).replace(/^RRULE:/i, '');
}

/* Datas como dias de calendario, sem fuso: 'AAAA-MM-DD' <-> Date UTC. */
function dia(iso) { const [a, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); }
function iso(d) { return d.toISOString().slice(0, 10); }
function maisDias(d, n) { return new Date(d.getTime() + n * 86400000); }
function diasNoMes(a, m) { return new Date(Date.UTC(a, m + 1, 0)).getUTCDate(); }
function segunda(d) { return maisDias(d, -((d.getUTCDay() + 6) % 7)); }

function hojeLisboa() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon' }).format(new Date());
}

/* A data seguinte a `base`, segundo a regra. Devolve null quando a serie
   acabou (UNTIL ou repeat_until). */
function proximaData(regraTexto, baseIso, ateIso) {
  const r = lerRegra(regraTexto);
  if (!r || !baseIso) return null;
  const base = dia(baseIso);
  let prox;

  if (r.FREQ === 'DAILY') {
    prox = maisDias(base, r.INTERVAL);
  } else if (r.FREQ === 'WEEKLY') {
    const dias = (r.BYDAY || '').split(',').map((x) => DIAS_RRULE.indexOf(x.trim().slice(-2))).filter((x) => x >= 0);
    if (!dias.length) {
      prox = maisDias(base, 7 * r.INTERVAL);
    } else {
      const s0 = segunda(base).getTime();
      for (let i = 1; i <= 7 * r.INTERVAL + 7; i += 1) {
        const c = maisDias(base, i);
        const semanas = Math.round((segunda(c).getTime() - s0) / (7 * 86400000));
        if (dias.includes(c.getUTCDay()) && semanas % r.INTERVAL === 0) { prox = c; break; }
      }
    }
  } else if (r.FREQ === 'MONTHLY') {
    let a = base.getUTCFullYear(), m = base.getUTCMonth() + r.INTERVAL;
    a += Math.floor(m / 12); m %= 12;
    let d = r.BYMONTHDAY ? parseInt(r.BYMONTHDAY, 10) : base.getUTCDate();
    if (d < 0) d = diasNoMes(a, m) + d + 1;
    prox = new Date(Date.UTC(a, m, Math.min(d, diasNoMes(a, m))));
  } else {
    const a = base.getUTCFullYear() + r.INTERVAL;
    const m = r.BYMONTH ? parseInt(r.BYMONTH, 10) - 1 : base.getUTCMonth();
    const d = r.BYMONTHDAY ? parseInt(r.BYMONTHDAY, 10) : base.getUTCDate();
    prox = new Date(Date.UTC(a, m, Math.min(d, diasNoMes(a, m))));
  }
  if (!prox) return null;

  const fim = [ateIso, r.UNTIL && r.UNTIL.replace(/^(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3')]
    .filter(Boolean).sort()[0];
  if (fim && iso(prox) > fim) return null;
  return iso(prox);
}

function descreverRegra(texto) {
  const r = lerRegra(texto);
  if (!r) return '';
  const cada = r.INTERVAL > 1 ? 'a cada ' + r.INTERVAL + ' ' : '';
  const NOMES = { MO: 'seg', TU: 'ter', WE: 'qua', TH: 'qui', FR: 'sex', SA: 'sáb', SU: 'dom' };
  if (r.FREQ === 'DAILY') return cada ? cada + 'dias' : 'todos os dias';
  if (r.FREQ === 'WEEKLY') {
    const d = (r.BYDAY || '').split(',').filter(Boolean);
    if (d.length === 5 && !d.includes('SA') && !d.includes('SU')) return 'dias úteis';
    return (cada ? cada + 'semanas' : 'todas as semanas') + (d.length ? ' (' + d.map((x) => NOMES[x] || x).join(', ') + ')' : '');
  }
  if (r.FREQ === 'MONTHLY') return (cada ? cada + 'meses' : 'todos os meses') + (r.BYMONTHDAY ? ', dia ' + r.BYMONTHDAY : '');
  return cada ? cada + 'anos' : 'todos os anos';
}

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */

const CAMPOS = `t.id, t.title, t.notes, t.area, t.context_id, t.project_id, t.owner_id, t.status, t.priority, t.tipo,
  to_char(t.starts_on,'YYYY-MM-DD') AS starts_on,
  to_char(t.due_on,'YYYY-MM-DD') AS due_on, to_char(t.due_time,'HH24:MI') AS due_time,
  t.repeat_every, t.repeat_rule, t.repeat_from, to_char(t.repeat_until,'YYYY-MM-DD') AS repeat_until,
  t.reminders, t.tags, t.section, t.sort_order, t.parent_id, t.series_id, t.done,
  t.completed_at, t.created_at,
  t.amount, t.payee, t.payment_ref, t.payment_method, t.paid_amount, t.expense_id,
  to_char(t.paid_on,'YYYY-MM-DD') AS paid_on`;

async function completar(tasks) {
  if (!tasks.length) return tasks;
  const ids = tasks.map((t) => t.id);
  const [subjects, anexos, itens, coms] = await Promise.all([
    all('SELECT task_id, person_id FROM task_subjects WHERE task_id = ANY($1::int[])', [ids]),
    all('SELECT task_id, document_id, papel FROM task_documents WHERE task_id = ANY($1::int[])', [ids]),
    all('SELECT id, task_id, title, done, sort FROM task_items WHERE task_id = ANY($1::int[]) ORDER BY sort, id', [ids]),
    all('SELECT task_id, count(*)::int AS n FROM task_comments WHERE task_id = ANY($1::int[]) GROUP BY task_id', [ids])
  ]);
  const por = (lista, campo) => {
    const m = new Map();
    lista.forEach((x) => { if (!m.has(x.task_id)) m.set(x.task_id, []); m.get(x.task_id).push(campo ? x[campo] : x); });
    return m;
  };
  const S = por(subjects, 'person_id'), A = por(anexos), I = por(itens);
  const C = new Map(coms.map((c) => [c.task_id, c.n]));
  tasks.forEach((t) => {
    t.subjects = S.get(t.id) || [];
    /* documents guarda so os ids (e o que os ecras antigos esperam); papeis
       diz qual deles e a fatura, o comprovativo e o recibo. */
    t.papeis = (A.get(t.id) || []).map((x) => ({ id: x.document_id, papel: x.papel || 'anexo' }));
    t.documents = t.papeis.map((x) => x.id);
    t.items = (I.get(t.id) || []).map((i) => ({ id: i.id, title: i.title, done: i.done, sort: i.sort }));
    t.comments = C.get(t.id) || 0;
    t.repeat_label = descreverRegra(t.repeat_rule);
  });
  return tasks;
}

/* O que o ecra precisa de ter a mao: tudo o que esta aberto, mais o que se
   fechou nos ultimos 14 dias. O resto do historico pede-se a parte. */
async function tarefasParaGestao() {
  const rows = await all(
    `SELECT ${CAMPOS} FROM tasks t
      WHERE t.origin = 'real'
        AND (t.status NOT IN ('concluida','cancelada')
             OR t.completed_at >= now() - INTERVAL '14 days')
      ORDER BY (t.due_on IS NULL), t.due_on, t.due_time NULLS FIRST, t.sort_order, t.id`);
  return completar(rows);
}

async function umaTarefa(id) {
  const rows = await all(`SELECT ${CAMPOS} FROM tasks t WHERE t.id = $1 AND t.origin = 'real'`, [id]);
  return rows.length ? (await completar(rows))[0] : null;
}

/* ------------------------------------------------------------------ *
 * Escrita
 * ------------------------------------------------------------------ */

async function gravarAssuntos(taskId, subjects) {
  await query('DELETE FROM task_subjects WHERE task_id = $1', [taskId]);
  for (const pid of subjects || []) {
    await query('INSERT INTO task_subjects (task_id, person_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [taskId, Number(pid)]);
  }
}
/* Um documento agarrado a uma tarefa tem um papel: e a fatura que se vai
   pagar, o comprovativo de quem pagou, o recibo de quem recebeu, ou so um
   papel que a tarefa precisa de ter a mao. */
function umDocumento(d) {
  const id = Number(d && d.id !== undefined ? d.id : d);
  if (!Number.isInteger(id)) return null;
  const papel = d && d.papel;
  return { id, papel: PAPEIS.includes(papel) ? papel : 'anexo' };
}

async function juntarDocumentos(taskId, documents) {
  for (const x of documents || []) {
    const d = umDocumento(x);
    if (!d) continue;
    await query(`INSERT INTO task_documents (task_id, document_id, papel) VALUES ($1,$2,$3)
                 ON CONFLICT (task_id, document_id) DO UPDATE SET papel = EXCLUDED.papel`,
    [taskId, d.id, d.papel]);
  }
}

async function gravarDocumentos(taskId, documents) {
  await query('DELETE FROM task_documents WHERE task_id = $1', [taskId]);
  await juntarDocumentos(taskId, documents);
}
async function gravarItens(taskId, itens) {
  await query('DELETE FROM task_items WHERE task_id = $1', [taskId]);
  let n = 0;
  for (const it of itens || []) {
    const titulo = String(it.title || '').trim();
    if (!titulo) continue;
    n += 1;
    await query(
      'INSERT INTO task_items (task_id, title, done, sort, completed_at) VALUES ($1,$2,$3,$4,$5)',
      [taskId, titulo, Boolean(it.done), it.sort != null ? Number(it.sort) : n, it.done ? (it.completed_at || new Date()) : null]);
  }
}

/* O valor chega da app com virgula ou com ponto, e as vezes com o euro
   colado. Aqui vira numero ou nada. */
function valor(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function lembretes(v) {
  if (!Array.isArray(v)) return null;
  return JSON.stringify(v.map((x) => ({ min: Math.round(Number(x.min)) })).filter((x) => Number.isFinite(x.min)));
}
function etiquetas(v) {
  if (!Array.isArray(v)) return null;
  return [...new Set(v.map((x) => String(x).trim().toLowerCase()).filter(Boolean))];
}

/* Concluir (ou «nao farei») uma tarefa. Se for uma rotina, fica uma copia
   fechada como historico e a rotina anda para a proxima data, com os passos
   todos por fazer outra vez. */
async function fechar(id, estado) {
  const t = (await all(
    `SELECT id, repeat_rule, repeat_from, to_char(repeat_until,'YYYY-MM-DD') AS repeat_until,
            to_char(due_on,'YYYY-MM-DD') AS due_on, to_char(starts_on,'YYYY-MM-DD') AS starts_on
       FROM tasks WHERE id = $1 AND origin = 'real'`, [id]))[0];
  if (!t) return false;
  const hoje = hojeLisboa();
  const base = t.repeat_from === 'conclusao' ? hoje : (t.due_on || hoje);
  const prox = t.repeat_rule ? proximaData(t.repeat_rule, base, t.repeat_until) : null;

  if (!prox) {
    await query(
      `UPDATE tasks SET status = $2, done = ($2 = 'concluida'), completed_at = now(), updated_at = now()
        WHERE id = $1`, [id, estado]);
    return true;
  }

  const copia = (await all(
    `INSERT INTO tasks (tipo, title, notes, area, context_id, project_id, owner_id, status, priority,
                        starts_on, due_on, due_time, tags, section, sort_order, series_id,
                        amount, payee, payment_ref, payment_method, paid_on, paid_amount, expense_id,
                        done, completed_at, origin, scope)
     SELECT tipo, title, notes, area, context_id, project_id, owner_id, $2, priority,
            starts_on, due_on, due_time, tags, section, sort_order, id,
            amount, payee, payment_ref, payment_method, paid_on, paid_amount, expense_id,
            ($2 = 'concluida'), now(), 'real', NULL
       FROM tasks WHERE id = $1
     RETURNING id`, [id, estado]))[0];
  await query('INSERT INTO task_subjects (task_id, person_id) SELECT $2, person_id FROM task_subjects WHERE task_id = $1', [id, copia.id]);
  /* A prova do pagamento fica com a vez que foi paga, nao com a rotina: o
     comprovativo de setembro nao serve para outubro. A fatura de origem, essa,
     fica nos dois. */
  await query(
    `INSERT INTO task_documents (task_id, document_id, papel)
     SELECT $2, document_id, papel FROM task_documents WHERE task_id = $1`, [id, copia.id]);
  await query(
    "DELETE FROM task_documents WHERE task_id = $1 AND papel IN ('comprovativo','recibo')", [id]);
  await query(
    `INSERT INTO task_items (task_id, title, done, sort, completed_at)
     SELECT $2, title, done, sort, completed_at FROM task_items WHERE task_id = $1`, [id, copia.id]);

  let novoInicio = null;
  if (t.starts_on && t.due_on) {
    novoInicio = iso(maisDias(dia(prox), Math.round((dia(t.starts_on) - dia(t.due_on)) / 86400000)));
  }
  await query(
    `UPDATE tasks SET due_on = $2, starts_on = COALESCE($3::date, starts_on), status = 'aberta', done = FALSE,
            completed_at = NULL, paid_on = NULL, paid_amount = NULL, payment_method = NULL,
            expense_id = NULL, updated_at = now() WHERE id = $1`, [id, prox, novoInicio]);
  await query('UPDATE task_items SET done = FALSE, completed_at = NULL WHERE task_id = $1', [id]);
  return true;
}

/* O terceiro nivel e a tarefa, e ela vive dentro de um projeto. Um programa e
   o nivel de cima: guarda projetos, nao trabalho. Sem esta guarda a hierarquia
   ficava com tres niveis no desenho e quatro na pratica. */
async function verificarProjeto(projectId) {
  if (projectId === undefined || projectId === null || projectId === '') return;
  const pr = (await all('SELECT tipo, name FROM projects WHERE id = $1', [Number(projectId)]))[0];
  if (!pr) return;
  if (pr.tipo === 'programa') {
    const e = new Error('\u00ab' + pr.name + '\u00bb e um programa: uma tarefa entra num dos projetos dele.');
    e.status = 400;
    throw e;
  }
}

async function criar(b) {
  const title = String(b.title || '').trim();
  if (!title) { const e = new Error('A tarefa precisa de um título.'); e.status = 400; throw e; }
  const status = STATUS.includes(b.status) ? b.status : 'aberta';
  const priority = PRIOS.includes(b.priority) ? b.priority : 'normal';
  const tipo = TIPOS.includes(b.tipo) ? b.tipo : 'tarefa';
  const regra = normalizarRegra(b.repeat_rule || b.repeat_every);
  await verificarProjeto(b.project_id);
  const rows = await all(
    `INSERT INTO tasks (tipo, title, notes, area, context_id, project_id, owner_id, status, priority,
                        starts_on, due_on, due_time, repeat_every, repeat_rule, repeat_from, repeat_until,
                        reminders, tags, section, sort_order, parent_id,
                        repeat_count, done, completed_at, amount, payee, payment_ref, origin, scope)
     VALUES ($23,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
             COALESCE($16::jsonb,'[]'::jsonb), COALESCE($17::text[],'{}'), $18,
             COALESCE($19, (SELECT COALESCE(min(sort_order),0) - 1 FROM tasks)), $20,
             1, $21, $22, $24, $25, $26, 'real', NULL)
     RETURNING id`,
    [title, limpar(b.notes), limpar(b.area), limpar(b.context_id), limpar(b.project_id),
     limpar(b.owner_id), status, priority, limpar(b.starts_on), limpar(b.due_on), limpar(b.due_time),
     limpar(b.repeat_every), regra, b.repeat_from === 'conclusao' ? 'conclusao' : 'prazo', limpar(b.repeat_until),
     lembretes(b.reminders), etiquetas(b.tags), limpar(b.section), b.sort_order != null ? Number(b.sort_order) : null,
     limpar(b.parent_id), status === 'concluida', FECHADAS.includes(status) ? new Date() : null, tipo,
     valor(b.amount), limpar(b.payee), limpar(b.payment_ref)]);
  const id = rows[0].id;
  await gravarAssuntos(id, b.subjects);
  await gravarDocumentos(id, b.documents);
  if (Array.isArray(b.items)) await gravarItens(id, b.items);
  return id;
}

async function alterar(id, b) {
  await verificarProjeto(b.project_id);
  const campos = [], valores = [];
  const por = (c, v) => { campos.push(c + ' = $' + (campos.length + 1)); valores.push(v); };
  ['title', 'notes', 'area', 'context_id', 'project_id', 'owner_id', 'starts_on', 'due_on', 'due_time',
   'repeat_until', 'section', 'parent_id'].forEach((c) => { if (b[c] !== undefined) por(c, limpar(b[c])); });
  if (b.priority !== undefined && PRIOS.includes(b.priority)) por('priority', b.priority);
  if (b.tipo !== undefined && TIPOS.includes(b.tipo)) por('tipo', b.tipo);
  ['payee', 'payment_ref'].forEach(function (c) { if (b[c] !== undefined) por(c, limpar(b[c])); });
  if (b.amount !== undefined) por('amount', valor(b.amount));
  if (b.repeat_rule !== undefined || b.repeat_every !== undefined) {
    por('repeat_rule', normalizarRegra(b.repeat_rule !== undefined ? b.repeat_rule : b.repeat_every));
  }
  if (b.repeat_from !== undefined) por('repeat_from', b.repeat_from === 'conclusao' ? 'conclusao' : 'prazo');
  if (b.reminders !== undefined) { campos.push('reminders = $' + (campos.length + 1) + '::jsonb'); valores.push(lembretes(b.reminders) || '[]'); }
  if (b.tags !== undefined) por('tags', etiquetas(b.tags) || []);
  if (b.sort_order !== undefined) por('sort_order', Number(b.sort_order) || 0);

  const fecha = b.status !== undefined && FECHADAS.includes(b.status);
  if (b.status !== undefined && STATUS.includes(b.status) && !fecha) {
    por('status', b.status); por('done', false); por('completed_at', null);
  }
  if (campos.length) {
    campos.push('updated_at = now()');
    valores.push(id);
    const rows = await all(
      `UPDATE tasks SET ${campos.join(', ')} WHERE id = $${valores.length} AND origin = 'real' RETURNING id`, valores);
    if (!rows.length) return false;
  }
  if (Array.isArray(b.subjects)) await gravarAssuntos(id, b.subjects);
  if (Array.isArray(b.documents)) await gravarDocumentos(id, b.documents);
  if (Array.isArray(b.items)) await gravarItens(id, b.items);
  if (fecha) return fechar(id, b.status);
  return true;
}

/* ------------------------------------------------------------------ *
 * Importacao (TickTick ou outra origem): o mapeamento faz-se fora; aqui
 * chegam ja ids do Farol. Tudo por external_id, para poder repetir.
 * ------------------------------------------------------------------ */

async function idPorExterno(tabela, ext) {
  if (!ext) return null;
  const r = await all(`SELECT id FROM ${tabela} WHERE external_id = $1`, [ext]);
  return r.length ? r[0].id : null;
}

async function importar(corpo) {
  const out = { projetos: 0, tarefas: 0, novas: 0, comentarios: 0, documentos: 0, erros: [] };

  for (const p of corpo.projects || []) {
    try {
      const existe = await idPorExterno('projects', p.external_id);
      if (existe) {
        await query(`UPDATE projects SET name=$2, description=$3, context_id=$4, status=$5 WHERE id=$1`,
          [existe, p.name, limpar(p.description), limpar(p.context_id), p.status || 'ativo']);
      } else {
        const r = await all(
          `INSERT INTO projects (name, description, context_id, status, sort, origin, progress, external_id)
           VALUES ($1,$2,$3,$4,(SELECT COALESCE(max(sort),0)+1 FROM projects),'real',0,$5) RETURNING id`,
          [p.name, limpar(p.description), limpar(p.context_id), p.status || 'ativo', p.external_id]);
        for (const m of p.members || []) {
          await query(`INSERT INTO project_members (project_id, person_id, member_role) VALUES ($1,$2,$3)
                       ON CONFLICT DO NOTHING`, [r[0].id, m.person_id, m.member_role || 'participante']);
        }
      }
      out.projetos += 1;
    } catch (err) { out.erros.push('projeto ' + p.external_id + ': ' + err.message); }
  }

  for (const t of corpo.tasks || []) {
    try {
      const projectId = t.project_id || await idPorExterno('projects', t.project_ext);
      const parentId = await idPorExterno('tasks', t.parent_ext);
      const seriesId = await idPorExterno('tasks', t.series_ext);
      const status = STATUS.includes(t.status) ? t.status : 'aberta';
      const vals = [
        t.title, limpar(t.notes), limpar(t.context_id), projectId, limpar(t.owner_id), status,
        PRIOS.includes(t.priority) ? t.priority : 'normal', limpar(t.starts_on), limpar(t.due_on), limpar(t.due_time),
        normalizarRegra(t.repeat_rule), t.repeat_from === 'conclusao' ? 'conclusao' : 'prazo', limpar(t.repeat_until),
        lembretes(t.reminders) || '[]', etiquetas(t.tags) || [], limpar(t.section), Number(t.sort_order) || 0,
        parentId, seriesId, status === 'concluida', limpar(t.completed_at), t.created_at || new Date(), t.external_id
      ];
      const existe = await idPorExterno('tasks', t.external_id);
      let id;
      if (existe) {
        id = existe;
        await query(
          `UPDATE tasks SET title=$1, notes=$2, context_id=$3, project_id=$4, owner_id=$5, status=$6, priority=$7,
                  starts_on=$8, due_on=$9, due_time=$10, repeat_rule=$11, repeat_from=$12, repeat_until=$13,
                  reminders=$14::jsonb, tags=$15, section=$16, sort_order=$17, parent_id=$18, series_id=$19,
                  done=$20, completed_at=$21, created_at=$22, updated_at=now()
            WHERE external_id = $23`, vals);
      } else {
        id = (await all(
          `INSERT INTO tasks (title, notes, context_id, project_id, owner_id, status, priority,
                              starts_on, due_on, due_time, repeat_rule, repeat_from, repeat_until,
                              reminders, tags, section, sort_order, parent_id, series_id,
                              done, completed_at, created_at, external_id, repeat_count, origin, scope)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18,$19,$20,$21,$22,$23,1,'real',NULL)
           RETURNING id`, vals))[0].id;
        out.novas += 1;
      }
      await gravarAssuntos(id, t.subjects);
      await gravarItens(id, t.items);
      for (const c of t.comments || []) {
        await query(
          `INSERT INTO task_comments (task_id, body, author, created_at, external_id) VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO UPDATE SET body = EXCLUDED.body`,
          [id, c.body, limpar(c.author), c.created_at || new Date(), c.external_id]);
        out.comentarios += 1;
      }
      out.tarefas += 1;
    } catch (err) { out.erros.push('tarefa ' + t.external_id + ': ' + err.message); }
  }

  for (const d of corpo.documents || []) {
    try {
      const existe = await idPorExterno('documents', d.external_id);
      const vals = [d.name, limpar(d.entity), limpar(d.person_id), limpar(d.kind), limpar(d.context_id),
        limpar(d.issued_on), limpar(d.valid_on), limpar(d.note), d.external_id];
      if (existe) {
        await query(`UPDATE documents SET name=$1, entity=$2, person_id=$3, kind=$4, context_id=$5,
                            issued_on=$6, valid_on=$7, note=$8 WHERE external_id=$9`, vals);
      } else {
        await query(`INSERT INTO documents (name, entity, person_id, kind, context_id, issued_on, valid_on, note,
                                            external_id, origin, aprovado, sort)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'real',TRUE,0)`, vals);
      }
      out.documentos += 1;
    } catch (err) { out.erros.push('documento ' + d.external_id + ': ' + err.message); }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Rotas
 * ------------------------------------------------------------------ */

function instalar(app, { carregarGestao, quem, ehAdmin }) {
  const falha = (res, err, onde) => {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[farol] ' + onde + ':', err.message);
    return res.status(500).json({ error: 'Não foi possível gravar.' });
  };

  app.post('/api/gestao/tarefas', async (req, res) => {
    try { await criar(req.body || {}); res.status(201).json(await carregarGestao()); }
    catch (err) { falha(res, err, 'POST tarefa'); }
  });

  app.patch('/api/gestao/tarefas/:id', async (req, res) => {
    try {
      const ok = await alterar(Number(req.params.id), req.body || {});
      if (!ok) return res.status(404).json({ error: 'Tarefa não encontrada.' });
      res.json(await carregarGestao());
    } catch (err) { falha(res, err, 'PATCH tarefa'); }
  });

  app.delete('/api/gestao/tarefas/:id', async (req, res) => {
    try {
      const rows = await all("DELETE FROM tasks WHERE id = $1 AND origin = 'real' RETURNING id", [Number(req.params.id)]);
      if (!rows.length) return res.status(404).json({ error: 'Tarefa não encontrada.' });
      res.json(await carregarGestao());
    } catch (err) { falha(res, err, 'DELETE tarefa'); }
  });

  /* Pagar e fechar com prova: fica a data, o valor e o metodo, juntam-se o
     comprovativo e o recibo, e a despesa escreve-se sozinha nas Financas. Se
     faltar a prova o pagamento fica pago na mesma, marcado como «falta
     comprovativo» - a vida real nao espera pelo PDF. */
  app.post('/api/tarefas/:id(\\d+)/pagar', async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    try {
      const t = (await all(
        `SELECT id, tipo, title, amount, payee, context_id, project_id, owner_id, repeat_rule
           FROM tasks WHERE id = $1 AND origin = 'real'`, [id]))[0];
      if (!t) return res.status(404).json({ error: 'Pagamento não encontrado.' });

      const pago = valor(b.paid_amount) !== null ? valor(b.paid_amount) : (t.amount !== null ? Number(t.amount) : null);
      const quando = limpar(b.paid_on) || hojeLisboa();
      const metodo = METODOS.includes(String(b.payment_method || '').toLowerCase())
        ? String(b.payment_method).toLowerCase() : limpar(b.payment_method);

      let despesaId = null;
      if (b.criar_despesa !== false && pago !== null) {
        const pessoa = limpar(b.person_id) || t.owner_id;
        const linhas = await all(
          `INSERT INTO expenses (description, amount, spent_on, merchant, category, person_id,
                                 project_id, context_id, note, origin, aprovado)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'real',TRUE) RETURNING id`,
          [t.title, pago, quando, limpar(t.payee), limpar(b.category), pessoa,
           t.project_id, t.context_id, limpar(b.note)]);
        despesaId = linhas[0].id;
      }

      await query(
        `UPDATE tasks SET paid_on = $2, paid_amount = $3, payment_method = COALESCE($4, payment_method),
                expense_id = COALESCE($5, expense_id), updated_at = now()
          WHERE id = $1`, [id, quando, pago, metodo, despesaId]);
      await juntarDocumentos(id, b.documentos);

      const ok = await fechar(id, 'concluida');
      if (!ok) return res.status(404).json({ error: 'Pagamento não encontrado.' });
      res.json(await carregarGestao());
    } catch (err) { falha(res, err, 'POST pagar'); }
  });

  app.get('/api/tarefas/:id(\\d+)', async (req, res) => {
    try {
      const t = await umaTarefa(Number(req.params.id));
      if (!t) return res.status(404).json({ error: 'Tarefa não encontrada.' });
      t.comentarios = await all(
        `SELECT id, body, author, created_at FROM task_comments WHERE task_id = $1 ORDER BY created_at, id`, [t.id]);
      t.historico = await all(
        `SELECT id, status, to_char(due_on,'YYYY-MM-DD') AS due_on, completed_at
           FROM tasks WHERE series_id = $1 ORDER BY completed_at DESC NULLS LAST LIMIT 24`, [t.id]);
      res.json(t);
    } catch (err) { falha(res, err, 'GET tarefa'); }
  });

  /* Pagos sem prova: pagou-se, mas nao ha comprovativo nem recibo agarrado.
     E a lista que evita a caca ao PDF em janeiro. */
  app.get('/api/tarefas/pagamentos/sem-prova', async (_req, res) => {
    try {
      const rows = await all(
        `SELECT ${CAMPOS} FROM tasks t
          WHERE t.origin = 'real' AND t.tipo = 'pagamento' AND t.paid_on IS NOT NULL
            AND t.paid_on >= CURRENT_DATE - INTERVAL '18 months'
            AND NOT EXISTS (SELECT 1 FROM task_documents d
                             WHERE d.task_id = t.id AND d.papel IN ('comprovativo','recibo'))
          ORDER BY t.paid_on DESC, t.id DESC LIMIT 200`);
      res.json(await completar(rows));
    } catch (err) { falha(res, err, 'GET sem-prova'); }
  });

  /* O historico completo: concluidas e «nao farei», mais recentes primeiro. */
  app.get('/api/tarefas/historico', async (req, res) => {
    const cond = ["t.origin = 'real'", "t.status IN ('concluida','cancelada')"], vals = [];
    const p = (v) => { vals.push(v); return '$' + vals.length; };
    if (req.query.pessoa) {
      const x = p(Number(req.query.pessoa));
      cond.push(`(t.owner_id = ${x} OR EXISTS (SELECT 1 FROM task_subjects s WHERE s.task_id = t.id AND s.person_id = ${x}))`);
    }
    if (req.query.estado === 'concluida' || req.query.estado === 'cancelada') cond.push('t.status = ' + p(req.query.estado));
    if (TIPOS.includes(req.query.tipo)) cond.push('t.tipo = ' + p(req.query.tipo));
    /* Filtrar por um programa traz o que esta nos projetos dele: e o que a
       pessoa quer dizer quando carrega no nome do programa. */
    if (req.query.projeto) {
      const x = p(Number(req.query.projeto));
      cond.push(`(t.project_id = ${x} OR t.project_id IN
                   (SELECT id FROM projects WHERE parent_id = ${x}))`);
    }
    if (req.query.q) cond.push('t.title ILIKE ' + p('%' + req.query.q + '%'));
    if (req.query.antes) cond.push('t.completed_at < ' + p(req.query.antes));
    const limite = Math.min(200, Number(req.query.limite) || 60);
    try {
      const rows = await all(
        `SELECT ${CAMPOS} FROM tasks t WHERE ${cond.join(' AND ')}
          ORDER BY t.completed_at DESC NULLS LAST, t.id DESC LIMIT ${limite}`, vals);
      res.json(await completar(rows));
    } catch (err) { falha(res, err, 'GET historico'); }
  });

  /* Passos da lista de verificacao, um a um: riscar um passo nao obriga a
     reenviar a tarefa inteira. */
  app.post('/api/tarefas/:id(\\d+)/itens', async (req, res) => {
    const titulo = String((req.body || {}).title || '').trim();
    if (!titulo) return res.status(400).json({ error: 'O passo precisa de texto.' });
    try {
      await query(`INSERT INTO task_items (task_id, title, sort)
                   VALUES ($1, $2, (SELECT COALESCE(max(sort),0)+1 FROM task_items WHERE task_id = $1))`,
      [Number(req.params.id), titulo]);
      res.status(201).json(await umaTarefa(Number(req.params.id)));
    } catch (err) { falha(res, err, 'POST item'); }
  });

  app.patch('/api/tarefas/itens/:id(\\d+)', async (req, res) => {
    const b = req.body || {};
    try {
      const r = await all(
        `UPDATE task_items SET title = COALESCE($2, title),
                done = COALESCE($3, done),
                completed_at = CASE WHEN $3 IS TRUE THEN now() WHEN $3 IS FALSE THEN NULL ELSE completed_at END,
                sort = COALESCE($4, sort)
          WHERE id = $1 RETURNING task_id`,
        [Number(req.params.id), limpar(b.title), typeof b.done === 'boolean' ? b.done : null,
         b.sort != null ? Number(b.sort) : null]);
      if (!r.length) return res.status(404).json({ error: 'Passo não encontrado.' });
      res.json(await umaTarefa(r[0].task_id));
    } catch (err) { falha(res, err, 'PATCH item'); }
  });

  app.delete('/api/tarefas/itens/:id(\\d+)', async (req, res) => {
    try {
      const r = await all('DELETE FROM task_items WHERE id = $1 RETURNING task_id', [Number(req.params.id)]);
      if (!r.length) return res.status(404).json({ error: 'Passo não encontrado.' });
      res.json(await umaTarefa(r[0].task_id));
    } catch (err) { falha(res, err, 'DELETE item'); }
  });

  app.post('/api/tarefas/:id(\\d+)/comentarios', async (req, res) => {
    const texto = String((req.body || {}).body || '').trim();
    if (!texto) return res.status(400).json({ error: 'O comentário está vazio.' });
    try {
      await query('INSERT INTO task_comments (task_id, body, author) VALUES ($1,$2,$3)',
        [Number(req.params.id), texto, quem(req)]);
      const lista = await all(`SELECT id, body, author, created_at FROM task_comments WHERE task_id = $1
                                ORDER BY created_at, id`, [Number(req.params.id)]);
      res.status(201).json(lista);
    } catch (err) { falha(res, err, 'POST comentario'); }
  });

  app.delete('/api/tarefas/comentarios/:id(\\d+)', async (req, res) => {
    try {
      await query('DELETE FROM task_comments WHERE id = $1', [Number(req.params.id)]);
      res.json({ ok: true });
    } catch (err) { falha(res, err, 'DELETE comentario'); }
  });

  /* Arrumar as mesmas coisas em muitas linhas de uma vez: mudar o tipo de
     cinquenta notas nao pode obrigar a cinquenta pedidos. So mexe nos campos
     de arrumacao - nada de datas nem de estados. */
  app.patch('/api/tarefas/lote', async (req, res) => {
    const b = req.body || {};
    const ids = (b.ids || []).map(Number).filter(Number.isInteger);
    if (!ids.length) return res.status(400).json({ error: 'Faltam as tarefas.' });
    const campos = [], valores = [];
    const por = (c, v) => { campos.push(c + ' = $' + (campos.length + 1)); valores.push(v); };
    if (TIPOS.includes(b.tipo)) por('tipo', b.tipo);
    if (b.context_id !== undefined) por('context_id', limpar(b.context_id));
    if (b.project_id !== undefined) por('project_id', limpar(b.project_id));
    /* O lote escreve direto na base e nao passa pelo criar/alterar, por isso a
       regra dos tres niveis tem de ser repetida aqui: sem isto, mudar cinquenta
       tarefas de uma vez era a porta de servico para as pendurar num programa. */
    if (b.project_id !== undefined) {
      try { await verificarProjeto(b.project_id); }
      catch (err) { return res.status(err.status || 400).json({ error: err.message }); }
    }
    if (b.owner_id !== undefined) por('owner_id', limpar(b.owner_id));
    if (PRIOS.includes(b.priority)) por('priority', b.priority);
    if (b.section !== undefined) por('section', limpar(b.section));
    if (Array.isArray(b.tags)) por('tags', etiquetas(b.tags) || []);
    if (Array.isArray(b.tirar_tags)) {
      campos.push('tags = (SELECT COALESCE(array_agg(x), \'{}\') FROM unnest(tags) x WHERE x <> ALL($' + (campos.length + 1) + '::text[]))');
      valores.push(etiquetas(b.tirar_tags) || []);
    }
    if (!campos.length) return res.status(400).json({ error: 'Nada para mudar.' });
    try {
      valores.push(ids);
      const rows = await all(
        `UPDATE tasks SET ${campos.join(', ')}, updated_at = now()
          WHERE id = ANY($${valores.length}::int[]) AND origin = 'real' RETURNING id`, valores);
      res.json({ alteradas: rows.length });
    } catch (err) { falha(res, err, 'PATCH lote'); }
  });

  app.post('/api/tarefas/importar', async (req, res) => {
    if (!ehAdmin(req)) return res.status(403).json({ error: 'Só o administrador importa.' });
    try { res.json(await importar(req.body || {})); }
    catch (err) { falha(res, err, 'importar'); }
  });
}

module.exports = { instalar, tarefasParaGestao, importar, criar, alterar, fechar, umaTarefa, proximaData, descreverRegra, STATUS, PRIOS, TIPOS, PAPEIS };
