export const DEFAULT_CART_STORAGE_KEY = "comandiva-cart-v1";

/** Lê o carrinho salvo no navegador; qualquer coisa inválida vira carrinho vazio. */
export function loadStoredCart<T>(storageKey: string): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredCart(storageKey: string, items: unknown[]): void {
  localStorage.setItem(storageKey, JSON.stringify(items));
}
