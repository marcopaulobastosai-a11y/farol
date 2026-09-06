'use strict';
const { ensureSchema, seed, isEmpty, pool } = require('./db');

(async () => {
  const force = process.argv.includes('--force');
  await ensureSchema();
  if (!force && !(await isEmpty())) {
    console.log('[farol] base de dados já tem dados — nada a fazer (usa --force para repor).');
  } else {
    await seed();
    console.log('[farol] dados de qualidade repostos.');
  }
  await pool.end();
})().catch((err) => { console.error(err); process.exit(1); });
