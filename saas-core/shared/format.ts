/** Mesma convenção do app principal: preço sempre em centavos (nunca float), formatado só na borda de exibição. */
export function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Data no fuso de Fortaleza — mesma convenção do app principal (shared/orderDomain.ts), pra bater com o que o cliente vê no resto do sistema. */
export function formatDate(epochMs: number): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(epochMs));
}
