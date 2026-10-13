// Porta local de server/_core/rateLimit.ts do app principal — saas-core é um
// workspace/processo separado, não pode importar aquele arquivo diretamente.

// Cada entrada guarda a PRÓPRIA janela: o login do Painel Master usa janelas
// de 10min, 15min e 1h ao mesmo tempo. Antes, a limpeza periódica usava uma
// janela fixa de 10min e apagava contadores de 1h cedo demais (o limite
// "por hora" na prática virava "por 10 minutos").
const attempts = new Map<string, { count: number; firstAttemptAt: number; windowMs: number }>();

const WINDOW_MS = 10 * 60 * 1000; // 10 minutos
const MAX_ATTEMPTS = 8;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (now - entry.firstAttemptAt > entry.windowMs) attempts.delete(key);
  }
}, 60 * 1000).unref();

/** Limitador simples por chave (ex.: IP + e-mail) — proteção básica contra força bruta no login do Super Admin. */
export function checkRateLimit(
  key: string,
  options: { windowMs?: number; maxAttempts?: number } = {},
): { allowed: boolean; retryAfterSeconds?: number } {
  const windowMs = options.windowMs ?? WINDOW_MS;
  const maxAttempts = options.maxAttempts ?? MAX_ATTEMPTS;
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.firstAttemptAt > windowMs) {
    attempts.set(key, { count: 1, firstAttemptAt: now, windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxAttempts) {
    const retryAfterSeconds = Math.ceil((entry.firstAttemptAt + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }

  entry.count += 1;
  return { allowed: true };
}

/** Limpa as tentativas de uma chave (chamar após login bem-sucedido). */
export function clearRateLimit(key: string) {
  attempts.delete(key);
}

/** Devolve 1 tentativa à chave (ex.: contador por IP não deve punir quem acertou a senha). */
export function refundRateLimit(key: string) {
  const entry = attempts.get(key);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count <= 0) attempts.delete(key);
}

/** Só conta (sem bloquear): usado pra alertar quando um e-mail acumula muitas falhas. Devolve o total na janela. */
export function incrementCounter(key: string, windowMs: number): number {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAttemptAt > windowMs) {
    attempts.set(key, { count: 1, firstAttemptAt: now, windowMs });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}
