import { isTRPCClientError } from "@trpc/client";

// Só tenta de novo sozinho um erro que É de rede — nunca um erro de negócio
// (Zod/BAD_REQUEST, TOO_MANY_REQUESTS, NOT_FOUND, etc.), que vai falhar de
// novo do mesmo jeito. O errorFormatter (server/_core/trpc.ts) sempre devolve
// `data` populado (code/httpStatus/path) pra qualquer TRPCError lançado pelos
// routers; quando o fetch em si rejeita (conexão caiu em voo) ou a resposta
// não é um JSON-RPC válido, TRPCClientError.from nunca popula `data`. É essa
// ausência que usamos como sinal de "erro de transporte", não o texto da
// mensagem.
export function isNetworkError(error: unknown): boolean {
  if (!isTRPCClientError(error)) return false;
  if (error.data) return false;
  if (error.cause instanceof DOMException && error.cause.name === "AbortError") return false;
  return true;
}

// Só 2 tentativas extras, com backoff curto: cobre uma queda de rede rápida
// (handoff de wifi, troca de torre). Se a queda for prolongada de verdade, o
// próprio retryer do React Query pausa a mutation (isPaused) em vez de
// continuar tentando e falhar — o auto-resume nativo (já ativo via
// PersistQueryClientProvider em main.tsx) assume dali.
export function shouldRetryOrderMutation(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && isNetworkError(error);
}

export function orderMutationRetryDelay(failureCount: number): number {
  return Math.min(500 * 2 ** failureCount, 2000);
}

// Sinal único pra UI: cobre tanto "pausada esperando internet voltar" quanto
// "tentando de novo depois de uma falha de rede, ainda no backoff" — mesma
// mensagem simples pros dois casos, sem tela cheia de status.
export function isRetryingOffline(mutation: { isPaused: boolean; isPending: boolean; failureCount: number }): boolean {
  return mutation.isPaused || (mutation.isPending && mutation.failureCount > 0);
}
