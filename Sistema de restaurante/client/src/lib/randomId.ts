// crypto.randomUUID só existe em contexto seguro (HTTPS ou localhost) — em
// HTTP puro (ex.: acesso direto por IP, sem domínio/certificado ainda) o
// navegador não expõe a função, e chamar quebra o carrinho/checkout inteiro.
// Usado tanto pra chave de item do carrinho (CartContext) quanto pra chave
// de idempotência de pedido (Checkout/NewCounterOrder/TableSession) — em
// nenhum dos dois usos precisa ser criptograficamente forte, só único o
// suficiente pra não colidir na prática, então o fallback é seguro.
export function generateClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
