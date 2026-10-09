// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CART_STORAGE_KEY, loadStoredCart, saveStoredCart } from "./cartStorage";

describe("carrinho salvo no navegador", () => {
  beforeEach(() => localStorage.clear());

  it("grava e lê de volta o mesmo carrinho", () => {
    saveStoredCart(DEFAULT_CART_STORAGE_KEY, [{ id: "a", productId: 1 }]);
    expect(loadStoredCart(DEFAULT_CART_STORAGE_KEY)).toEqual([{ id: "a", productId: 1 }]);
  });

  it("usa a chave da Comandiva e ignora a chave antiga do nome anterior", () => {
    expect(DEFAULT_CART_STORAGE_KEY).toBe("comandiva-cart-v1");
    localStorage.setItem("mm-system-creator-cart-v1", JSON.stringify([{ id: "velho" }]));
    expect(loadStoredCart(DEFAULT_CART_STORAGE_KEY)).toEqual([]);
  });

  it("carrinhos de contextos diferentes (site x mesa) não se misturam", () => {
    saveStoredCart(DEFAULT_CART_STORAGE_KEY, [{ id: "site" }]);
    saveStoredCart("mm-table-cart-abc", [{ id: "mesa" }]);
    expect(loadStoredCart(DEFAULT_CART_STORAGE_KEY)).toEqual([{ id: "site" }]);
    expect(loadStoredCart("mm-table-cart-abc")).toEqual([{ id: "mesa" }]);
  });

  it("JSON corrompido ou que não é lista vira carrinho vazio", () => {
    localStorage.setItem(DEFAULT_CART_STORAGE_KEY, "{nao-e-json");
    expect(loadStoredCart(DEFAULT_CART_STORAGE_KEY)).toEqual([]);
    localStorage.setItem(DEFAULT_CART_STORAGE_KEY, "{\"a\":1}");
    expect(loadStoredCart(DEFAULT_CART_STORAGE_KEY)).toEqual([]);
  });
});
