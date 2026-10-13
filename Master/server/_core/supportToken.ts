import { createHash, randomBytes } from "node:crypto";

const SUPPORT_TOKEN_PREFIX = "sup_";

/**
 * Token de handoff do Modo Suporte — deliberadamente um helper próprio, não
 * reaproveitando apiKey.ts: são segredos de natureza diferente (credencial
 * permanente de restaurante vs. handoff de curta duração e uso único), e
 * misturar os dois deixaria os call sites confusos sobre qual segredo é qual.
 */
export function generateSupportToken(): { token: string; tokenHash: string } {
  const token = `${SUPPORT_TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  return { token, tokenHash: hashSupportToken(token) };
}

export function hashSupportToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
