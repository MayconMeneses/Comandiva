import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { ENV } from "./env";

/**
 * Chaves derivadas de PLATFORM_JWT_SECRET por HKDF-SHA256, cada uma com um
 * rótulo fixo — assim o segredo do 2FA e o HMAC dos códigos de recuperação
 * nunca usam a mesma chave do JWT de sessão. SEM fallback: se o segredo
 * faltar/for curto, lança erro (o boot em index.ts já recusa subir antes).
 * Consequência a lembrar: trocar PLATFORM_JWT_SECRET invalida todos os 2FA
 * já cadastrados (use scripts/reset-platform-admin-2fa.ts pra cada conta).
 */
function deriveKey(label: string): Buffer {
  if (!ENV.platformJwtSecret || ENV.platformJwtSecret.length < 32) {
    throw new Error("PLATFORM_JWT_SECRET ausente ou fraco — não dá pra proteger segredos de 2FA.");
  }
  return Buffer.from(hkdfSync("sha256", ENV.platformJwtSecret, "", label, 32));
}

const TOTP_SECRET_LABEL = "totp-secret-v1";
const RECOVERY_CODE_LABEL = "recovery-code-hmac-v1";

/** AES-256-GCM → "v1:iv:tag:cipher" (base64). O GCM autentica: chave errada ou dado adulterado falha ao decifrar. */
export function encryptTotpSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(TOTP_SECRET_LABEL), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptTotpSecret(stored: string): string {
  const [version, iv, tag, cipherText] = stored.split(":");
  if (version !== "v1" || !iv || !tag || !cipherText) throw new Error("Segredo de 2FA em formato desconhecido.");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(TOTP_SECRET_LABEL), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(cipherText, "base64")), decipher.final()]).toString("utf8");
}

// Sem 0/O/1/I (confundem na hora de digitar). 32 símbolos = 5 bits cada;
// 10 símbolos por código = 50 bits — suficiente com rate limit + uso único.
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECOVERY_GROUP_LENGTH = 5;
export const RECOVERY_CODE_COUNT = 10;

function randomRecoveryCode(): string {
  const bytes = randomBytes(RECOVERY_GROUP_LENGTH * 2);
  // 256 é múltiplo de 32, então "byte % 32" não tem viés.
  const chars = Array.from(bytes, byte => RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length]).join("");
  return `${chars.slice(0, RECOVERY_GROUP_LENGTH)}-${chars.slice(RECOVERY_GROUP_LENGTH)}`;
}

export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) codes.add(randomRecoveryCode());
  return [...codes];
}

/** Aceita minúsculas, espaços e código sem o hífen; devolve null se não tiver o formato XXXXX-XXXXX. */
export function normalizeRecoveryCode(input: string): string | null {
  const compact = input.replace(/[\s-]/g, "").toUpperCase();
  if (compact.length !== RECOVERY_GROUP_LENGTH * 2 || ![...compact].every(char => RECOVERY_ALPHABET.includes(char))) return null;
  return `${compact.slice(0, RECOVERY_GROUP_LENGTH)}-${compact.slice(RECOVERY_GROUP_LENGTH)}`;
}

/** Só o HASH vai pro banco (HMAC-SHA256 com chave derivada) — um vazamento do banco sozinho não entrega códigos usáveis. */
export function hashRecoveryCode(normalizedCode: string): string {
  return createHmac("sha256", deriveKey(RECOVERY_CODE_LABEL)).update(normalizedCode).digest("hex");
}
