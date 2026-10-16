'use strict';
/* Pesquisa global (16 out 2026).
 *
 * Uma palavra procura em tudo o que o Farol guarda: tarefas e pagamentos,
 * eventos, documentos, movimentos, pessoas, projetos, areas e bens. Sem
 * acentos e sem maiusculas; varias palavras tem de aparecer todas; um numero
 * procura tambem os valores (275 encontra 275,00 EUR).
 *
 * GET /api/pesquisa?q=…&tipo=…&limite=…
 *   limite: quantos de cada tipo (a lista do menu pede 3, a pagina 60).
 *   tipo:   so um tipo (a pagina, quando se escolhe um).
 * Devolve { q, total, tipos: [{ tipo, n, itens: [...] }] }.
 */
const { query } = require('./db');
const all = async (sql, p) => (await query(sql, p)).rows;

const DE = 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ';
const PARA = 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn';
const N = (expr) => `lower(translate(coalesce(${expr},''), '${DE}', '${PARA}'))`;

function semAcentos(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* As palavras da procura, cada uma um LIKE sobre o texto todo do item. */
function palavras(q) {
  return semAcentos(q).replace(/[%_\\]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 6);
}

/* «275», «275,5», «1.250,00» ou «-50» tambem sao valores. */
function numero(q) {
  const s = String(q || '').trim().replace(/\s|€/g, '');
  if (!/^-?[\d.]+(,\d{1,2})?$|^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  let v = s.replace(/^-/, '');
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '');
  return /^\d+(\.\d+)?$/.test(v) ? v : null;
}

/* Cada tipo: o texto onde se procura, a coluna do valor (se tiver) e a
   consulta que devolve a linha ja pronta para mostrar. */
const TIPOS = {
  tarefas: {
    texto: ['t.title', 't.notes', 't.payee', 't.payment_ref', 'c.name', "array_to_string(t.tags, ' ')"],
    valor: 't.amount',
    sql: (w) => `
      SELECT t.id, t.title AS titulo, t.tipo, t.status, t.done,
             to_char(t.due_on,'YYYY-MM-DD') AS data, t.amount AS valor, t.payee,
             t.context_id, c.name AS area, pc.name AS area_pai,
             count(*) OVER () AS n
        FROM tasks t
        LEFT JOIN contexts c ON c.id = t.context_id
        LEFT JOIN contexts pc ON pc.id = c.parent_id
       WHERE t.origin = 'real' AND ${w}
       ORDER BY (t.done OR t.status IN ('concluida','cancelada')), t.due_on DESC NULLS LAST, t.id DESC`
  },
  eventos: {
    texto: ['e.title', 'e.detail', 'e.location', 'c.name'],
    sql: (w) => `
      SELECT e.id, e.title AS titulo, to_char(e.day,'YYYY-MM-DD') AS data, e.at AS hora, e.location,
             e.context_id, c.name AS area, pc.name AS area_pai,
             count(*) OVER () AS n
        FROM events e
        LEFT JOIN contexts c ON c.id = e.context_id
        LEFT JOIN contexts pc ON pc.id = c.parent_id
       WHERE e.origin = 'real' AND ${w}
       ORDER BY (e.day < CURRENT_DATE), abs(e.day - CURRENT_DATE), e.id`
  },
  documentos: {
    texto: ['d.name', 'd.entity', 'd.kind', 'd.note', 'c.name',
      `(SELECT string_agg(concat_ws(' ', i.file_name, i.ai_json->>'resumo'), ' ')
          FROM inbox_links l JOIN inbox_items i ON i.id = l.inbox_id
         WHERE l.target_type = 'documento' AND l.target_id = d.id)`],
    sql: (w) => `
      SELECT d.id, d.name AS titulo, d.entity, d.kind, d.aprovado,
             to_char(COALESCE(d.issued_on, d.valid_on),'YYYY-MM-DD') AS data,
             d.context_id, c.name AS area, pc.name AS area_pai,
             count(*) OVER () AS n
        FROM documents d
        LEFT JOIN contexts c ON c.id = d.context_id
        LEFT JOIN contexts pc ON pc.id = c.parent_id
       WHERE d.origin = 'real' AND ${w}
       ORDER BY d.issued_on DESC NULLS LAST, d.id DESC`
  },
  movimentos: {
    texto: ['m.descricao', 'm.titulo', 'm.entidade', 'm.nota', 'k.nome', 'cat.nome'],
    valor: 'm.valor',
    sql: (w) => `
      SELECT m.id, COALESCE(NULLIF(m.titulo,''), m.descricao) AS titulo, m.descricao, m.entidade,
             to_char(m.data,'YYYY-MM-DD') AS data, m.valor, k.nome AS conta, cat.nome AS categoria,
             m.context_id, c.name AS area, pc.name AS area_pai,
             count(*) OVER () AS n
        FROM fin_movimentos m
        JOIN fin_contas k ON k.id = m.conta_id
        LEFT JOIN fin_categorias cat ON cat.id = m.categoria_id
        LEFT JOIN contexts c ON c.id = m.context_id
        LEFT JOIN contexts pc ON pc.id = c.parent_id
       WHERE ${w}
       ORDER BY m.data DESC, m.id DESC`
  },
  pessoas: {
    texto: ['p.name', 'p.full_name', 'p.role', 'p.note', 'p.email', 'p.phone'],
    sql: (w) => `
      SELECT p.id, COALESCE(NULLIF(p.full_name,''), p.name) AS titulo, p.name, p.role, p.kind,
             count(*) OVER () AS n
        FROM people p
       WHERE p.origin = 'real' AND p.active AND ${w}
       ORDER BY p.in_household DESC, p.sort, p.name`
  },
  projetos: {
    texto: ['pr.name', 'pr.description', 'pr.milestone', 'c.name'],
    sql: (w) => `
      SELECT pr.id, pr.name AS titulo, pr.tipo, pr.status, pr.context_id, c.name AS area, pc.name AS area_pai,
             count(*) OVER () AS n
        FROM projects pr
        LEFT JOIN contexts c ON c.id = pr.context_id
        LEFT JOIN contexts pc ON pc.id = c.parent_id
       WHERE pr.origin = 'real' AND ${w}
       ORDER BY (pr.status <> 'ativo'), pr.sort, pr.name`
  },
  areas: {
    texto: ['c.name', 'c.note', 'pc.name'],
    sql: (w) => `
      SELECT c.id, c.name AS titulo, c.parent_id, pc.name AS area_pai, c.name AS area,
             count(*) OVER () AS n
        FROM contexts c
        LEFT JOIN contexts pc ON pc.id = c.parent_id
       WHERE c.active AND ${w}
       ORDER BY (c.parent_id IS NOT NULL), c.sort, c.name`
  },
  bens: {
    texto: ['b.nome', 'b.nota', 'c.name'],
    valor: 'b.valor',
    sql: (w) => `
      SELECT b.id, b.nome AS titulo, b.lado, b.classe, b.valor, to_char(b.valor_em,'YYYY-MM-DD') AS data,
             b.context_id, c.name AS area, pc.name AS area_pai,
             count(*) OVER () AS n
        FROM fin_bens b
        LEFT JOIN contexts c ON c.id = b.context_id
        LEFT JOIN contexts pc ON pc.id = c.parent_id
       WHERE b.ativo AND ${w}
       ORDER BY b.nome`
  }
};
const ORDEM = ['tarefas', 'eventos', 'documentos', 'movimentos', 'pessoas', 'projetos', 'areas', 'bens'];

async function procurar(q, o) {
  o = o || {};
  const ps = palavras(q);
  const num = numero(q);
  const limite = Math.max(1, Math.min(200, Number(o.limite) || 3));
  const tipos = o.tipo && TIPOS[o.tipo] ? [o.tipo] : ORDEM;
  if (!ps.length) return { q: q || '', total: 0, tipos: [] };
  const res = await Promise.all(tipos.map(async (tipo) => {
    const T = TIPOS[tipo];
    const v = [];
    const texto = N(`concat_ws(' ', ${T.texto.join(', ')})`);
    const conds = ps.map((p) => { v.push('%' + p + '%'); return `${texto} LIKE $${v.length}`; });
    let w = '(' + conds.join(' AND ') + ')';
    if (num && T.valor) {
      v.push(num + '%');
      w = `(${w} OR to_char(abs(${T.valor}),'FM9999999990.00') LIKE $${v.length})`;
    }
    v.push(limite);
    try {
      const rows = await all(T.sql(w) + ` LIMIT $${v.length}`, v);
      const n = rows.length ? Number(rows[0].n) : 0;
      rows.forEach((r) => { delete r.n; if (r.valor != null) r.valor = Number(r.valor); });
      return { tipo, n, itens: rows };
    } catch (e) {
      console.error('[farol] pesquisa ' + tipo + ':', e.message);
      return { tipo, n: 0, itens: [], erro: true };
    }
  }));
  const tiposOk = res.filter((r) => r.n > 0 || o.tipo);
  return { q, total: res.reduce((t, r) => t + r.n, 0), tipos: tiposOk };
}

function instalar(app) {
  app.get('/api/pesquisa', async (req, res) => {
    try {
      res.json(await procurar(String(req.query.q || '').slice(0, 120),
        { tipo: req.query.tipo, limite: req.query.limite }));
    } catch (e) {
      console.error('[farol] GET /api/pesquisa:', e.message);
      res.status(500).json({ error: 'Não foi possível procurar.' });
    }
  });
}

module.exports = { instalar, procurar, palavras, numero };
