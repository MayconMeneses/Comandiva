#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createDecipheriv, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { parse } from "node:url";

const scrypt = promisify(scryptCallback);

const databaseUrl = process.env.DATABASE_URL;
const input = process.argv[2];
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória");
if (!input) throw new Error("Uso: node scripts/restore-db.mjs backups/arquivo.sql[.enc]");
await access(input);
const parsed = parse(databaseUrl);
if (!parsed.hostname || !parsed.pathname) throw new Error("DATABASE_URL inválida");

const stamp = Date.now();
const workDir = `backups/restore-tmp-${stamp}`;

let dumpFile = input;
if (input.endsWith(".enc")) {
  const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("Este backup está criptografado — defina BACKUP_ENCRYPTION_KEY antes de restaurar.");
  await mkdir(workDir, { recursive: true });
  console.log("[restore] Descriptografando...");
  const raw = await readFile(input);
  const salt = raw.subarray(0, 16);
  const iv = raw.subarray(16, 28);
  const authTag = raw.subarray(raw.length - 16);
  const ciphertext = raw.subarray(28, raw.length - 16);
  const derivedKey = await scrypt(encryptionKey, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", derivedKey, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  dumpFile = `${workDir}/database.sql`;
  await writeFile(dumpFile, decrypted);
}

console.log("[restore] Restaurando banco de dados do saas-core...");
const args = ["--protocol=TCP", `--host=${parsed.hostname}`, `--port=${parsed.port ?? "3306"}`, `--user=${decodeURIComponent(parsed.auth?.split(":")[0] ?? "")}`, parsed.pathname.slice(1)];
const env = { ...process.env, MYSQL_PWD: decodeURIComponent(parsed.auth?.split(":").slice(1).join(":") ?? "") };
const sql = await readFile(dumpFile);
await new Promise((resolve, reject) => {
  const child = spawn("mysql", args, { env, stdio: ["pipe", "inherit", "inherit"] });
  child.on("error", reject);
  child.on("close", code => (code === 0 ? resolve() : reject(new Error(`mysql encerrou com código ${code}`))));
  child.stdin.end(sql);
});
console.log("[restore] Banco restaurado.");

await rm(workDir, { recursive: true, force: true });
console.log(`[restore] Restauração concluída a partir de ${input}`);
