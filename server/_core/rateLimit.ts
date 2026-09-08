const attempts = new Map<string, { count: number; firstAttemptAt: number }>();

const WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_ATTEMPTS = 8;

// Evita crescimento infinito do mapa em memória ao longo do tempo.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, entry] of attempts) {
    if (entry.firstAttemptAt < cutoff) attempts.delete(key);
  }
}, WINDOW_MS).unref();

/**
 * Limitador simples por chave (ex.: IP + usuário) para reduzir o risco de
 * força bruta em login. Não substitui um WAF/serviço dedicado, mas é uma
 * proteção básica sem precisar de infraestrutura extra (Redis etc.) para um
 * sistema de porte pequeno/médio como este.
 */
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

const distinctAttempts = new Map<string, { values: Set<string>; firstAttemptAt: number }>();

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [key, entry] of distinctAttempts) {
    if (entry.firstAttemptAt < cutoff) distinctAttempts.delete(key);
  }
}, WINDOW_MS).unref();

/**
 * Como checkRateLimit, mas o limite é sobre quantos *valores diferentes*
 * (telefones, tokens de mesa) uma mesma chave (normalmente IP) tentou — não
 * sobre o total de requisições. Existe pra impedir alguém de varrer vários
 * telefones/tokens em sequência (enumeração), sem punir quem fica com a
 * própria página de acompanhamento aberta consultando o mesmo valor em loop
 * automático: repetir o mesmo valor nunca conta contra o limite.
 */
export function checkDistinctRateLimit(bucketKey: string, value: string, maxDistinct: number): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = distinctAttempts.get(bucketKey);

  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    distinctAttempts.set(bucketKey, { values: new Set([value]), firstAttemptAt: now });
    return { allowed: true };
  }

  if (entry.values.has(value)) return { allowed: true };

  if (entry.values.size >= maxDistinct) {
    const retryAfterSeconds = Math.ceil((entry.firstAttemptAt + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }

  entry.values.add(value);
  return { allowed: true };
}
