#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const url = process.env.MIGRATION_DATABASE_URL;
if (!url) throw new Error("Defina MIGRATION_DATABASE_URL apontando para uma base independente e vazia.");
const sql = await readFile("drizzle/migrations/0000_initial_pubx.sql", "utf8");
const connection = await mysql.createConnection(url);
try {
  await connection.query(sql);
  const [rows] = await connection.query("SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE()");
  console.log(`Migration inicial aplicada; tabelas encontradas: ${rows[0].total}`);
} finally {
  await connection.end();
}
