import { isNetworkError } from "./offlineRetry";

/**
 * Função pura separada do componente (MutationErrorNotice.tsx) só porque
 * `vitest.config.ts` cobre `client/src/lib/**` mas não `client/src/components/**`
 * — mesmo racional já usado em `resolveAuthState.ts` pra isolar a lógica
 * testável sem alargar a config de teste.
 *
 * Escolhe a mensagem pro erro FINAL de uma mutation de pedido/rodada/
 * pagamento que já esgotou as tentativas automáticas (`isRetryingOffline`
 * já é falso nesse ponto — não está mais pausada/retryando, só falhou de
 * vez). Sem essa distinção, um erro de transporte mostrava o texto cru do
 * fetch ("Failed to fetch"), lido pela equipe como "não dá pra fazer o
 * pedido" — relatado ao vivo testando o balcão offline de propósito.
 * `navigator.onLine` nem sempre reflete a conexão real do aparelho (gotcha
 * conhecido), então o React Query às vezes tenta de verdade em vez de
 * pausar, esgota as poucas tentativas curtas (`shouldRetryOrderMutation`) e
 * cai aqui — mas o botão continua liberado pra tentar de novo manualmente,
 * nada foi perdido.
 */
export function mutationErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (isNetworkError(error)) return "Sem conexão — as tentativas automáticas não conseguiram enviar. Toque no botão de novo quando a internet voltar.";
  return error instanceof Error ? error.message : String(error);
}
