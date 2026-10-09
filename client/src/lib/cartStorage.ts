export const DEFAULT_CART_STORAGE_KEY = "comandiva-cart-v1";
// Chave antiga (antes da renomeação do produto): carrinho em andamento de quem
// já tinha o site aberto não pode sumir com a atualização.
export const LEGACY_CART_STORAGE_KEY = "mm-system-creator-cart-v1";

/** Lê o carrinho salvo; só o carrinho padrão do site migra da chave antiga. */
export function loadStoredCart<T>(storageKey: string): T[] {
  try {
    const stored = localStorage.getItem(storageKey) ?? (storageKey === DEFAULT_CART_STORAGE_KEY ? localStorage.getItem(LEGACY_CART_STORAGE_KEY) : null);
    const parsed = JSON.parse(stored ?? "[]");
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredCart(storageKey: string, items: unknown[]): void {
  localStorage.setItem(storageKey, JSON.stringify(items));
  if (storageKey === DEFAULT_CART_STORAGE_KEY) localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
}
