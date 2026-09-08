import { describe, expect, it } from "vitest";
import { isValidCnpjChecksum } from "../shared/fiscal";

describe("isValidCnpjChecksum", () => {
  it("aceita um CNPJ real com dígitos verificadores corretos", () => {
    expect(isValidCnpjChecksum("11222333000181")).toBe(true);
  });

  it("rejeita o mesmo número com o último dígito trocado", () => {
    expect(isValidCnpjChecksum("11222333000180")).toBe(false);
  });

  it("rejeita o mesmo número com o penúltimo dígito trocado", () => {
    expect(isValidCnpjChecksum("11222333000171")).toBe(false);
  });

  it("rejeita todos os dígitos iguais (formato válido, mas nunca um CNPJ real)", () => {
    expect(isValidCnpjChecksum("11111111111111")).toBe(false);
  });

  it("rejeita tamanho errado", () => {
    expect(isValidCnpjChecksum("1122233300018")).toBe(false);
    expect(isValidCnpjChecksum("112223330001811")).toBe(false);
  });

  it("rejeita caracteres não numéricos", () => {
    expect(isValidCnpjChecksum("11.222.333/0001-81")).toBe(false);
  });
});
