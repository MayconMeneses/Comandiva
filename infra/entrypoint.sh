#!/bin/sh
# Ponto único de entrada do Pub X.
# Este script roda dentro do container "app" e faz tudo sozinho, na ordem certa:
#   1. Espera o banco MySQL/MariaDB ficar pronto
#   2. Aplica as migrations do Drizzle
#   3. Roda o seed (é seguro rodar sempre — ele não duplica dados se já existirem)
#   4. Sobe o servidor
# Assim quem for usar o projeto só precisa rodar "docker compose up -d" uma vez.

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

echo "[entrypoint] Rodando seed (idempotente, seguro em qualquer reinício)..."
node_modules/.bin/tsx scripts/seed.ts || echo "[entrypoint] Seed retornou aviso; continuando (ele já verifica dados existentes)."

echo "[entrypoint] Iniciando o servidor..."
exec node dist/index.js
