import { createHash, randomBytes } from "node:crypto";

const API_KEY_PREFIX = "rk_live_";

/**
 * Gera uma API key nova pra um restaurante. A key em si nunca é guardada —
 * só devolvida uma vez pro operador (igual token de bootstrap/senha
 * provisória em outras partes do sistema) — o banco guarda apenas o hash.
 * SHA-256 simples (não scrypt): é um token de alta entropia gerado por nós,
 * não uma senha de baixa entropia escolhida por humano, então não há
 * benefício de segurança em pagar o custo computacional de um hash lento
 * aqui — e essa checagem roda a cada sincronização de cada restaurante.
 */
export function generateApiKey(): { apiKey: string; apiKeyHash: string; apiKeyPrefix: string } {
  const apiKey = `${API_KEY_PREFIX}${randomBytes(32).toString("hex")}`;
  return { apiKey, apiKeyHash: hashApiKey(apiKey), apiKeyPrefix: apiKey.slice(0, 12) };
}

export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}
