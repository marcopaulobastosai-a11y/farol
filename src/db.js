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

async function isEmpty() {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM people WHERE origin = 'qualidade'");
  return rows[0].n === 0;
}

async function seed() {
  await pool.query(sqlFile('seed.sql'));
}

module.exports = { pool, query, ensureSchema, isEmpty, seed };
