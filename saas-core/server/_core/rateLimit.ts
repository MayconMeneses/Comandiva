// Porta local de server/_core/rateLimit.ts do app principal — saas-core é um
// workspace/processo separado, não pode importar aquele arquivo diretamente.

const attempts = new Map<string, { count: number; firstAttemptAt: number }>();

const WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_ATTEMPTS = 8;

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, entry] of attempts) {
    if (entry.firstAttemptAt < cutoff) attempts.delete(key);
  }
}, WINDOW_MS).unref();

/** Limitador simples por chave (ex.: IP + e-mail) — proteção básica contra força bruta no login do Super Admin. */
export function checkRateLimit(key: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now });
    return { allowed: true };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((entry.firstAttemptAt + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }

  entry.count += 1;
  return { allowed: true };
}

/** Limpa as tentativas de uma chave (chamar após login bem-sucedido). */
export function clearRateLimit(key: string) {
  attempts.delete(key);
}
