'use strict';
/**
 * Farol — ligacao ao Splitwise (primeiro passo: so leitura).
 *
 * A chave pessoal (SPLITWISE_API_KEY) cola-a o Marco nas Variables do
 * Railway; nunca se escreve no codigo. Da acesso total a conta dele, por isso
 * estas rotas ficam atras do login como todo o /api.
 *
 * GET /api/splitwise/grupos devolve os grupos (id, nome, membros e saldos)
 * para confirmar que a chave funciona antes de se ligar a sincronizacao
 * nos dois sentidos.
 */
const BASE = 'https://secure.splitwise.com/api/v3.0';

const chave = () => (process.env.SPLITWISE_API_KEY || '').trim();

async function pedir(caminho) {
  const r = await fetch(BASE + caminho, {
    headers: { Authorization: 'Bearer ' + chave(), Accept: 'application/json' }
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error((corpo && (corpo.error || (corpo.errors && JSON.stringify(corpo.errors)))) || ('HTTP ' + r.status));
    e.status = r.status;
    throw e;
  }
  return corpo;
}

const nomePessoa = (u) => [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.email || ('#' + u.id);

function instalar(app) {
  app.get('/api/splitwise/grupos', async (_req, res) => {
    if (!chave()) return res.status(503).json({ error: 'Falta a SPLITWISE_API_KEY nas Variables do Railway.' });
    try {
      const [eu, dados] = await Promise.all([pedir('/get_current_user'), pedir('/get_groups')]);
      const grupos = (dados.groups || []).map((g) => ({
        id: g.id,
        nome: g.name,
        tipo: g.group_type || null,
        atualizado: g.updated_at || null,
        membros: (g.members || []).map((m) => ({
          id: m.id,
          nome: nomePessoa(m),
          saldo: (m.balance || []).map((b) => b.amount + ' ' + b.currency_code)
        }))
      }));
      res.json({ ligado_como: nomePessoa(eu.user || {}), total: grupos.length, grupos });
    } catch (err) {
      console.error('[farol] splitwise grupos:', err.status || '', err.message);
      /* 502 e nao 401: um 401 do Farol quer dizer «sessao do Farol caiu». */
      res.status(502).json({
        error: err.status === 401
          ? 'O Splitwise recusou a chave (401). Confirma a SPLITWISE_API_KEY.'
          : 'Não foi possível ler o Splitwise: ' + err.message
      });
    }
  });
}

module.exports = { instalar, ativo: () => Boolean(chave()) };
