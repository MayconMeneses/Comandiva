import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

/**
 * Criptografia de campo genérica (AES-256-GCM, chave derivada por scrypt) —
 * mesmo algoritmo já usado pra criptografar o arquivo de backup
 * (scripts/backup-db.mjs), aplicado a valores individuais no banco. Usada
 * hoje só pelos segredos fiscais (certificado digital A1, token CSC — ver
 * server/db/fiscal.ts), que nunca podem ficar em texto puro no banco: um
 * certificado vazado permite emitir nota fiscal em nome do restaurante.
 */
export async function encryptField(plaintext: string, key: string): Promise<string> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const derivedKey = (await scrypt(key, salt, 32)) as Buffer;
  const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, authTag, encrypted]).toString("base64");
}

export async function decryptField(payload: string, key: string): Promise<string> {
  const buf = Buffer.from(payload, "base64");
  const salt = buf.subarray(0, 16);
  const iv = buf.subarray(16, 28);
  const authTag = buf.subarray(28, 44);
  const encrypted = buf.subarray(44);
  const derivedKey = (await scrypt(key, salt, 32)) as Buffer;
  const decipher = createDecipheriv("aes-256-gcm", derivedKey, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
