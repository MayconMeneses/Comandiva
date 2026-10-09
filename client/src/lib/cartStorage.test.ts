// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CART_STORAGE_KEY, LEGACY_CART_STORAGE_KEY, loadStoredCart, saveStoredCart } from "./cartStorage";

describe("carrinho salvo — migração da chave antiga (renomeação para Comandiva)", () => {
  beforeEach(() => localStorage.clear());

  it("carrinho na chave antiga é lido pelo carrinho padrão do site", () => {
    localStorage.setItem(LEGACY_CART_STORAGE_KEY, JSON.stringify([{ id: "a", productId: 1 }]));
    expect(loadStoredCart(DEFAULT_CART_STORAGE_KEY)).toEqual([{ id: "a", productId: 1 }]);
  });

  it("ao salvar, grava na chave nova e apaga a antiga", () => {
    localStorage.setItem(LEGACY_CART_STORAGE_KEY, "[]");
    saveStoredCart(DEFAULT_CART_STORAGE_KEY, [{ id: "b" }]);
    expect(JSON.parse(localStorage.getItem(DEFAULT_CART_STORAGE_KEY)!)).toEqual([{ id: "b" }]);
    expect(localStorage.getItem(LEGACY_CART_STORAGE_KEY)).toBeNull();
  });

  it("a chave nova tem prioridade sobre a antiga", () => {
    localStorage.setItem(LEGACY_CART_STORAGE_KEY, JSON.stringify([{ id: "velho" }]));
    localStorage.setItem(DEFAULT_CART_STORAGE_KEY, JSON.stringify([{ id: "novo" }]));
    expect(loadStoredCart(DEFAULT_CART_STORAGE_KEY)).toEqual([{ id: "novo" }]);
  });

  it("carrinho de mesa (outra chave) nunca puxa o carrinho antigo do site", () => {
    localStorage.setItem(LEGACY_CART_STORAGE_KEY, JSON.stringify([{ id: "site" }]));
    expect(loadStoredCart("mm-table-cart-abc")).toEqual([]);
  });

  it("JSON corrompido ou que não é lista vira carrinho vazio", () => {
    localStorage.setItem(DEFAULT_CART_STORAGE_KEY, "{nao-e-json");
    expect(loadStoredCart(DEFAULT_CART_STORAGE_KEY)).toEqual([]);
    localStorage.setItem(DEFAULT_CART_STORAGE_KEY, "{\"a\":1}");
    expect(loadStoredCart(DEFAULT_CART_STORAGE_KEY)).toEqual([]);
  });
});
