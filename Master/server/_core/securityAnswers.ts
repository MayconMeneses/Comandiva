import { createHmac, hkdfSync, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ENV } from "./env";

const scrypt = promisify(scryptCallback);

/**
 * Segundo passo do login do Painel Master: pergunta de segurança + código de
 * 4 dígitos (substitui o código de 6 números do app autenticador).
 *
 * As respostas NUNCA ficam em texto puro nem reversíveis: só o hash. Cada uma
 * passa por (1) HMAC-SHA256 com uma chave secreta do servidor (derivada de
 * PLATFORM_JWT_SECRET, "pimenta") e (2) scrypt com sal aleatório. Um código de
 * 4 dígitos tem só 10 mil combinações — sem a chave do servidor, quem roubasse
 * o banco conseguiria testá-las todas offline; com ela, não. Consequência a
 * lembrar: trocar PLATFORM_JWT_SECRET invalida as respostas já cadastradas
 * (use scripts/reset-platform-admin-2fa.ts e cadastre de novo).
 */
export const SECURITY_QUESTION = "Quem é o seu melhor amigo de infância?";
export const FRIEND_ANSWER_MIN = 2;
export const FRIEND_ANSWER_MAX = 80;

const FRIEND_LABEL = "security-friend-answer-v1";
const PIN_LABEL = "security-pin-v1";

function pepper(label: string): Buffer {
  if (!ENV.platformJwtSecret || ENV.platformJwtSecret.length < 32) {
    throw new Error("PLATFORM_JWT_SECRET ausente ou fraco — não dá pra proteger as respostas de segurança.");
  }
  return Buffer.from(hkdfSync("sha256", ENV.platformJwtSecret, "", label, 32));
}

/** Ignora maiúsculas, acentos e espaços repetidos: "  José  da Silva " vale "jose da silva". */
export function normalizeFriendAnswer(input: string): string {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

async function hashSecret(label: string, normalized: string): Promise<string> {
  const salt = randomBytes(16);
  const peppered = createHmac("sha256", pepper(label)).update(normalized).digest();
  const key = (await scrypt(peppered, salt, 64)) as Buffer;
  return `v1:${salt.toString("hex")}:${key.toString("hex")}`;
}

async function verifySecret(label: string, normalized: string, stored: string | null): Promise<boolean> {
  // Sem hash guardado, roda um scrypt do mesmo custo — o tempo de resposta não revela o que falta.
  const [version, saltHex, keyHex] = (stored ?? "v1:00000000000000000000000000000000:").split(":");
  const peppered = createHmac("sha256", pepper(label)).update(normalized).digest();
  const actual = (await scrypt(peppered, Buffer.from(saltHex ?? "", "hex"), 64)) as Buffer;
  if (!stored || version !== "v1" || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Hash das duas respostas, prontas pra gravar. Quem chama valida o formato antes (isValidPin, tamanho da resposta). */
export async function hashSecurityAnswers(friendAnswer: string, pin: string): Promise<{ friendHash: string; pinHash: string }> {
  return { friendHash: await hashSecret(FRIEND_LABEL, normalizeFriendAnswer(friendAnswer)), pinHash: await hashSecret(PIN_LABEL, pin) };
}

/**
 * Confere as DUAS respostas. Sempre avalia as duas (sem parar na primeira que
 * erra) e devolve um único sim/não — quem erra não descobre qual das duas foi.
 */
export async function verifySecurityAnswers(stored: { friendHash: string | null; pinHash: string | null }, friendAnswer: string, pin: string): Promise<boolean> {
  const friendOk = await verifySecret(FRIEND_LABEL, normalizeFriendAnswer(friendAnswer), stored.friendHash);
  const pinOk = await verifySecret(PIN_LABEL, pin.trim(), stored.pinHash);
  return friendOk && pinOk;
}
