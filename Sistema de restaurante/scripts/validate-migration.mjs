#!/usr/bin/env node
// Aplica TODAS as migrations atuais (drizzle/meta/_journal.json, na ordem) numa
// base vazia e confere se o número de tabelas bate com o drizzle/schema.ts.
// Antes o script aplicava só o snapshot antigo (19 tabelas) e dava falsa
// segurança; agora o esperado vem do schema vivo. Interface inalterada:
// MIGRATION_DATABASE_URL apontando para uma base independente e vazia.
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("Defina MIGRATION_DATABASE_URL apontando para uma base independente e vazia.");

// Conta só definições reais ("= mysqlTable("), ignorando menções em comentários.
const schemaSource = await readFile("drizzle/schema.ts", "utf8");
const expectedTables = (schemaSource.match(/=\s*mysqlTable\(/g) ?? []).length;
if (expectedTables === 0) throw new Error("Nenhuma definição mysqlTable( encontrada em drizzle/schema.ts.");

const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
const connection = await mysql.createConnection(url);
try {
  const [before] = await connection.query("SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()");
  if (Number(before[0].total) !== 0) throw new Error(`A base não está vazia (${before[0].total} tabelas); use uma base descartável.`);

  for (const entry of journal.entries) {
    const sql = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
    // O drizzle-kit separa os comandos de cada arquivo por este marcador.
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await connection.query(statement);
    }
  }

  const [rows] = await connection.query("SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'");
  const found = Number(rows[0].total);
  console.log(`Migrations aplicadas: ${journal.entries.length}; tabelas encontradas: ${found}; esperadas pelo schema: ${expectedTables}`);
  if (found !== expectedTables) {
    console.error("FALHA: o número de tabelas das migrations difere do drizzle/schema.ts.");
    process.exitCode = 1;
  }
} finally {
  await connection.end();
}
