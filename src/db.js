'use strict';
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[farol] DATABASE_URL não definido. Liga o serviço Postgres ao serviço da app.');
}

// O Postgres do Railway usa TLS com certificado próprio na ligação pública.
const needsSsl = /sslmode=require/.test(connectionString || '') ||
                 /proxy\.rlwy\.net|\.railway\.app/.test(connectionString || '');

const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000
});

pool.on('error', (err) => console.error('[farol] erro inesperado no pool:', err.message));

async function query(text, params) {
  return pool.query(text, params);
}

function sqlFile(name) {
  return fs.readFileSync(path.join(__dirname, '..', 'db', name), 'utf8');
}

async function ensureSchema() {
  await pool.query(sqlFile('schema.sql'));
}

/* A maqueta foi apagada em 19 set 2026 e o seed.sql foi com ela. Ficava uma
   arma carregada: bastava alguem correr `npm run seed` para a casa voltar a
   encher-se de contas, habitos e avarias que nunca existiram, no meio de
   dados reais. Os dados entram pela app. */

module.exports = { pool, query, ensureSchema };
