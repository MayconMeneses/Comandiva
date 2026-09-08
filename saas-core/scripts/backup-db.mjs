#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rm } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createCipheriv, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { parse } from "node:url";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const execFileAsync = promisify(execFile);
const scrypt = promisify(scryptCallback);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória");
const parsed = parse(databaseUrl);
if (!parsed.hostname || !parsed.pathname) throw new Error("DATABASE_URL inválida");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");

// saas-core não guarda nenhum arquivo (sem MinIO/S3 próprio) — só o banco
// (restaurantes/planos/assinaturas/auditoria). Diferente do backup do app
// principal (scripts/backup-db.mjs na raiz), que também empacota storage.
console.log("[backup] Exportando banco de dados do saas-core...");
const username = decodeURIComponent(parsed.auth?.split(":")[0] ?? "");
const password = decodeURIComponent(parsed.auth?.split(":").slice(1).join(":") ?? "");
const bundlePath = process.argv[2] ?? `backups/backup-${stamp}.sql`;
await mkdir("backups", { recursive: true });
await execFileAsync(
  "mysqldump",
  ["--protocol=TCP", `--host=${parsed.hostname}`, `--port=${parsed.port ?? "3306"}`, `--user=${username}`, "--databases", parsed.pathname.slice(1), "--single-transaction", "--routines", "--triggers", "--events", `--result-file=${bundlePath}`],
  { env: { ...process.env, MYSQL_PWD: password } },
);

// Criptografia (opcional, mas fortemente recomendada em produção) — mesmo
// esquema AES-256-GCM + scrypt do backup do app principal, chave própria
// (BACKUP_ENCRYPTION_KEY deste .env, não precisa ser a mesma do outro serviço).
const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
let finalPath = bundlePath;
if (encryptionKey) {
  console.log("[backup] Criptografando...");
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const derivedKey = await scrypt(encryptionKey, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
  finalPath = `${bundlePath}.enc`;
  const output = createWriteStream(finalPath);
  output.write(salt);
  output.write(iv);
  await pipeline(createReadStream(bundlePath), cipher, output, { end: false });
  output.write(cipher.getAuthTag());
  output.end();
  await new Promise((resolve, reject) => output.on("finish", resolve).on("error", reject));
  await rm(bundlePath);
} else {
  console.warn("[backup] BACKUP_ENCRYPTION_KEY não configurada — backup salvo sem criptografia.");
}

console.log(`[backup] Pronto: ${finalPath}`);

// Cópia externa (opcional) — sem isso, perder a VPS do saas-core também perde
// todo o histórico de cobrança/planos/auditoria de todos os restaurantes-clientes.
const offsiteBucket = process.env.BACKUP_OFFSITE_S3_BUCKET;
const offsiteKeyId = process.env.BACKUP_OFFSITE_S3_ACCESS_KEY_ID;
const offsiteSecret = process.env.BACKUP_OFFSITE_S3_SECRET_ACCESS_KEY;
if (offsiteBucket && offsiteKeyId && offsiteSecret) {
  console.log("[backup] Enviando cópia para o destino externo...");
  const offsiteClient = new S3Client({
    region: process.env.BACKUP_OFFSITE_S3_REGION || "us-east-1",
    endpoint: process.env.BACKUP_OFFSITE_S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.BACKUP_OFFSITE_S3_ENDPOINT),
    credentials: { accessKeyId: offsiteKeyId, secretAccessKey: offsiteSecret },
  });
  const key = finalPath.split("/").pop();
  await offsiteClient.send(new PutObjectCommand({ Bucket: offsiteBucket, Key: key, Body: createReadStream(finalPath) }));
  console.log(`[backup] Cópia externa enviada: ${key}`);
} else {
  console.warn("[backup] BACKUP_OFFSITE_S3_* não configurado — backup ficou só nesta VPS. Configure pra ter cópia fora daqui.");
}
