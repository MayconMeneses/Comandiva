import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartAddon = { id: number; groupId: number; groupName: string; name: string; priceCents: number };
export type CartItem = {
  id: string;
  productId: number;
  name: string;
  imageUrl?: string | null;
  basePriceCents: number;
  quantity: number;
  note?: string;
  addons: CartAddon[];
};
type CartContextValue = {
  items: CartItem[];
  subtotalCents: number;
  itemCount: number;
  addItem: (item: Omit<CartItem, "id">) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateItem: (id: string, item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const DEFAULT_STORAGE_KEY = "pub-x-cart-v1";

/**
 * `storageKey` isola o carrinho por contexto: o pedido delivery/retirada do
 * site (provider único na raiz do app) não pode se misturar com o carrinho
 * de uma comanda de mesa (aberto pelo QR Code) — são fluxos diferentes que,
 * no mesmo navegador do cliente, não devem compartilhar itens pendentes.
 */
export function CartProvider({ children, storageKey = DEFAULT_STORAGE_KEY }: { children: React.ReactNode; storageKey?: string }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) ?? "[]") as CartItem[]; }
    catch { return []; }
  });

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(items)); }, [items, storageKey]);
  const value = useMemo<CartContextValue>(() => {
    const subtotalCents = items.reduce((total, item) => {
      const unit = item.basePriceCents + item.addons.reduce((sum, addon) => sum + addon.priceCents, 0);
      return total + unit * item.quantity;
    }, 0);
    return {
      items,
      subtotalCents,
      itemCount: items.reduce((total, item) => total + item.quantity, 0),
      addItem: input => {
        setItems(current => {
          const fingerprint = `${input.productId}:${input.addons.map(addon => addon.id).sort().join(",")}:${input.note ?? ""}`;
          const existing = current.find(item => `${item.productId}:${item.addons.map(addon => addon.id).sort().join(",")}:${item.note ?? ""}` === fingerprint);
          return existing ? current.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + input.quantity } : item) : [...current, { ...input, id: crypto.randomUUID() }];
        });
        window.dispatchEvent(new CustomEvent("pubx:cart-updated", { detail: { name: input.name } }));
      },
      updateQuantity: (id, quantity) => setItems(current => quantity > 0 ? current.map(item => item.id === id ? { ...item, quantity } : item) : current.filter(item => item.id !== id)),
      updateItem: (id, item) => {
        setItems(current => current.map(currentItem => currentItem.id === id ? { ...item, id } : currentItem));
        window.dispatchEvent(new CustomEvent("pubx:cart-updated", { detail: { name: item.name } }));
      },
      removeItem: id => setItems(current => current.filter(item => item.id !== id)),
      clearCart: () => setItems([]),
    };
  }, [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart deve ser utilizado dentro de CartProvider");
  return value;
}
