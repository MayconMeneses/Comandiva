#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rm } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createCipheriv, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { parse } from "node:url";
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const execFileAsync = promisify(execFile);
const scrypt = promisify(scryptCallback);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL é obrigatória");
const parsed = parse(databaseUrl);
if (!parsed.hostname || !parsed.pathname) throw new Error("DATABASE_URL inválida");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const workDir = `backups/tmp-${stamp}`;
await mkdir(workDir, { recursive: true });

// 1) Banco de dados — mesmo mysqldump de sempre.
console.log("[backup] Exportando banco de dados...");
const username = decodeURIComponent(parsed.auth?.split(":")[0] ?? "");
const password = decodeURIComponent(parsed.auth?.split(":").slice(1).join(":") ?? "");
const dumpFile = `${workDir}/database.sql`;
await execFileAsync(
  "mysqldump",
  ["--protocol=TCP", `--host=${parsed.hostname}`, `--port=${parsed.port ?? "3306"}`, `--user=${username}`, "--databases", parsed.pathname.slice(1), "--single-transaction", "--routines", "--triggers", "--events", `--result-file=${dumpFile}`],
  { env: { ...process.env, MYSQL_PWD: password } },
);

// 2) Storage (imagens no MinIO/S3) — sem isso, perder a VPS também perdia
// toda foto de produto/evento/comprovante, mesmo com o banco salvo à parte.
const { s3Bucket, s3AccessKeyId, s3SecretAccessKey, s3Endpoint, s3Region } = {
  s3Bucket: process.env.S3_BUCKET,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  s3Endpoint: process.env.S3_ENDPOINT,
  s3Region: process.env.S3_REGION || "us-east-1",
};
let storageFileCount = 0;
if (s3Bucket && s3AccessKeyId && s3SecretAccessKey) {
  console.log("[backup] Baixando arquivos do storage (S3/MinIO)...");
  const client = new S3Client({ region: s3Region, endpoint: s3Endpoint || undefined, forcePathStyle: Boolean(s3Endpoint), credentials: { accessKeyId: s3AccessKeyId, secretAccessKey: s3SecretAccessKey } });
  const storageDir = `${workDir}/storage`;
  let continuationToken;
  try {
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket: s3Bucket, ContinuationToken: continuationToken }));
      for (const object of page.Contents ?? []) {
        if (!object.Key) continue;
        const destPath = `${storageDir}/${object.Key}`;
        await mkdir(destPath.slice(0, destPath.lastIndexOf("/")), { recursive: true });
        const got = await client.send(new GetObjectCommand({ Bucket: s3Bucket, Key: object.Key }));
        await pipeline(got.Body, createWriteStream(destPath));
        storageFileCount++;
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    console.log(`[backup] ${storageFileCount} arquivo(s) de storage baixado(s).`);
  } catch (error) {
    if (error?.Code === "NoSuchBucket" || error?.name === "NoSuchBucket") {
      // Bucket só é criado no primeiro upload de imagem (ver server/storage.ts) — instalação
      // nova sem nenhuma imagem enviada ainda não é uma falha, só não há nada pra baixar.
      console.log("[backup] Bucket de storage ainda não existe (nenhuma imagem enviada até agora) — pulando, backup segue só com o banco.");
    } else {
      throw error;
    }
  }
} else {
  console.warn("[backup] S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY não configurados — backup não incluirá as imagens do storage.");
}

// 3) Empacota banco + storage num único .tar.gz.
const bundlePath = process.argv[2] ?? `backups/backup-${stamp}.tar.gz`;
await mkdir("backups", { recursive: true });
console.log("[backup] Compactando...");
await execFileAsync("tar", ["-czf", bundlePath, "-C", workDir, "."]);

// 4) Criptografia (opcional, mas fortemente recomendada em produção) — AES-256-GCM
// com chave derivada por scrypt, mesmo algoritmo de derivação já usado pra
// senha de admin/staff neste projeto. Sem BACKUP_ENCRYPTION_KEY configurada,
// o arquivo final fica sem criptografia (comportamento antigo preservado).
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

await rm(workDir, { recursive: true, force: true });
console.log(`[backup] Pronto: ${finalPath}`);

// 5) Cópia externa (opcional) — sem isso, perder a VPS inteira também perde
// o backup que estava só nela. Qualquer destino compatível com S3 serve
// (Backblaze B2, outra conta AWS, etc.), bastando preencher as variáveis.
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
