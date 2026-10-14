import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { ENV } from "./env";

/**
 * Criptografia de segredos guardados no banco (chaves de gateway de pagamento).
 *
 * AES-256-GCM com a chave derivada de DATA_ENCRYPTION_KEY (HKDF-SHA256). Cada
 * valor leva um IV aleatório próprio e um tag de autenticação: qualquer
 * alteração no texto cifrado faz a leitura falhar em vez de devolver lixo.
 *
 * Formato gravado: `enc:v1:` + base64(iv[12] | tag[16] | texto cifrado).
 * Valores SEM esse prefixo são tratados como texto puro antigo (gravados antes
 * da criptografia existir) e continuam funcionando — nada quebra no upgrade; o
 * script `scripts/encrypt-gateway-keys.ts` converte os antigos de uma vez.
 */
const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;
export const MIN_DATA_KEY_LENGTH = 32;

export function isEncryptedSecret(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "comandiva-secret-box", "data-encryption-key-v1", 32));
}

export function createSecretBox(secret: string) {
  if (secret.length < MIN_DATA_KEY_LENGTH) {
    throw new Error(`DATA_ENCRYPTION_KEY precisa de pelo menos ${MIN_DATA_KEY_LENGTH} caracteres.`);
  }
  const key = deriveKey(secret);
  return {
    encrypt(plain: string): string {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
      return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64");
    },
    decrypt(stored: string): string {
      if (!isEncryptedSecret(stored)) return stored;
      const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
      if (raw.length < IV_BYTES + TAG_BYTES) throw new Error("Segredo criptografado inválido.");
      const decipher = createDecipheriv("aes-256-gcm", key, raw.subarray(0, IV_BYTES));
      decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
      try {
        return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
      } catch {
        // Chave errada ou valor adulterado: mensagem única, sem detalhe do motivo.
        throw new Error("Não foi possível descriptografar o segredo (chave DATA_ENCRYPTION_KEY errada ou valor alterado).");
      }
    },
  };
}

let warnedNoKey = false;

/**
 * Grava um segredo. Sem DATA_ENCRYPTION_KEY configurada, mantém o valor em texto
 * puro (comportamento antigo) e avisa uma vez no log — o boot em produção também
 * avisa (secretChecks). Com a chave, sempre cifra.
 */
export function encryptSecret(plain: string): string {
  if (!ENV.dataEncryptionKey) {
    if (!warnedNoKey) {
      warnedNoKey = true;
      console.warn("[secretBox] DATA_ENCRYPTION_KEY não configurada: chaves de gateway ficam em texto puro no banco.");
    }
    return plain;
  }
  return createSecretBox(ENV.dataEncryptionKey).encrypt(plain);
}

/** Lê um segredo. Texto puro antigo passa direto; valor cifrado exige a chave. */
export function decryptSecret(stored: string): string {
  if (!isEncryptedSecret(stored)) return stored;
  if (!ENV.dataEncryptionKey) {
    throw new Error("Há segredo criptografado no banco, mas DATA_ENCRYPTION_KEY não está configurada.");
  }
  return createSecretBox(ENV.dataEncryptionKey).decrypt(stored);
}
