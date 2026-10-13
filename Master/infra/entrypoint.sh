#!/bin/sh
# Ponto único de entrada do saas-core. Mesmo formato do entrypoint.sh do app
# principal: espera o banco, aplica migrations, roda o seed (idempotente),
# sobe o servidor.

set -e

echo "[entrypoint] Aguardando o banco de dados ficar disponível..."

node -e "
const mysql = require('mysql2/promise');
const url = process.env.DATABASE_URL;
if (!url) { console.error('[entrypoint] DATABASE_URL não definida.'); process.exit(1); }

const maxTries = 30;
let attempt = 0;

async function wait() {
  while (attempt < maxTries) {
    attempt++;
    try {
      const conn = await mysql.createConnection(url);
      await conn.query('SELECT 1');
      await conn.end();
      console.log('[entrypoint] Banco de dados pronto.');
      return;
    } catch (err) {
      console.log('[entrypoint] Banco ainda não respondeu (tentativa ' + attempt + '/' + maxTries + '). Aguardando...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error('[entrypoint] O banco de dados não respondeu a tempo.');
  process.exit(1);
}

wait();
"

echo "[entrypoint] Aplicando migrations..."
node_modules/.bin/drizzle-kit migrate

echo "[entrypoint] Sincronizando planos/features (idempotente)..."
node_modules/.bin/tsx scripts/seed-plans.ts

echo "[entrypoint] Verificando Super Admin inicial (idempotente)..."
node_modules/.bin/tsx scripts/bootstrap-platform-admin.ts

echo "[entrypoint] Iniciando o servidor..."
exec node dist/index.js
