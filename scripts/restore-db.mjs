#!/usr/bin/env node
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createDecipheriv, scrypt as scryptCallback } from "node:crypto";
import { parse } from "node:url";
import { join, relative, sep } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const execFileAsync = promisify(execFile);
const scrypt = promisify(scryptCallback);

const databaseUrl = process.env.DATABASE_URL;
const input = process.argv[2];
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória");
if (!input) throw new Error("Uso: node scripts/restore-db.mjs backups/arquivo.tar.gz[.enc]");
await access(input);
const parsed = parse(databaseUrl);
if (!parsed.hostname || !parsed.pathname) throw new Error("DATABASE_URL inválida");

const stamp = Date.now();
const workDir = `backups/restore-tmp-${stamp}`;
await mkdir(workDir, { recursive: true });

// Aceita o formato antigo (.sql puro, pra restaurar backups feitos antes desta
// mudança) e o novo (.tar.gz ou .tar.gz.enc com banco + storage juntos).
let dumpFile;
if (input.endsWith(".sql")) {
  dumpFile = input;
} else {
  let bundlePath = input;
  if (input.endsWith(".enc")) {
    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
    if (!encryptionKey) throw new Error("Este backup está criptografado — defina BACKUP_ENCRYPTION_KEY antes de restaurar.");
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
    bundlePath = `${workDir}/bundle.tar.gz`;
    await writeFile(bundlePath, decrypted);
  }
  console.log("[restore] Descompactando...");
  await execFileAsync("tar", ["-xzf", bundlePath, "-C", workDir]);
  dumpFile = `${workDir}/database.sql`;
}

console.log("[restore] Restaurando banco de dados...");
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

// Storage (se o bundle trouxer uma pasta storage/) — reenvia pro S3/MinIO
// configurado neste ambiente. Se o backup era só .sql (formato antigo) ou
// não tinha storage configurado na hora do backup, não há nada pra reenviar.
const storageDir = `${workDir}/storage`;
const hasStorage = await stat(storageDir).then(() => true).catch(() => false);
if (hasStorage) {
  const { S3_BUCKET: s3Bucket, S3_ACCESS_KEY_ID: s3AccessKeyId, S3_SECRET_ACCESS_KEY: s3SecretAccessKey, S3_ENDPOINT: s3Endpoint, S3_REGION: s3Region } = process.env;
  if (s3Bucket && s3AccessKeyId && s3SecretAccessKey) {
    console.log("[restore] Reenviando arquivos de storage...");
    const client = new S3Client({ region: s3Region || "us-east-1", endpoint: s3Endpoint || undefined, forcePathStyle: Boolean(s3Endpoint), credentials: { accessKeyId: s3AccessKeyId, secretAccessKey: s3SecretAccessKey } });
    let count = 0;
    async function walk(dir) {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) await walk(fullPath);
        else {
          const key = relative(storageDir, fullPath).split(sep).join("/");
          await client.send(new PutObjectCommand({ Bucket: s3Bucket, Key: key, Body: createReadStream(fullPath) }));
          count++;
        }
      }
    }
    await walk(storageDir);
    console.log(`[restore] ${count} arquivo(s) de storage reenviado(s).`);
  } else {
    console.warn("[restore] Backup contém arquivos de storage, mas S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY não estão configurados aqui — arquivos não foram reenviados.");
  }
}

await rm(workDir, { recursive: true, force: true });
console.log(`[restore] Restauração concluída a partir de ${input}`);
