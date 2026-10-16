import { describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({ ENV: { platformJwtSecret: "test-only-platform-secret-32-chars-min" } }));

import { hashSecurityAnswers, isValidPin, normalizeFriendAnswer, verifySecurityAnswers } from "./securityAnswers";

describe("normalizeFriendAnswer", () => {
  it("ignora maiúsculas, acentos e espaços repetidos", () => {
    expect(normalizeFriendAnswer("  JOSÉ   da  Conceição ")).toBe("jose da conceicao");
  });
});

describe("isValidPin", () => {
  it("só aceita exatamente 4 números", () => {
    expect(isValidPin("0123")).toBe(true);
    for (const bad of ["123", "12345", "12a4", "", " 123"]) expect(isValidPin(bad)).toBe(false);
  });
});

describe("hash das respostas de segurança", () => {
  it("guarda só hash: nada do texto original aparece, e o mesmo valor gera hashes diferentes (sal)", async () => {
    const first = await hashSecurityAnswers("Carlos Eduardo", "4821");
    const second = await hashSecurityAnswers("Carlos Eduardo", "4821");
    for (const value of [first.friendHash, first.pinHash]) {
      expect(value).toMatch(/^v1:[0-9a-f]{32}:[0-9a-f]{128}$/);
      expect(value.toLowerCase()).not.toContain("carlos");
      expect(value).not.toContain("4821");
    }
    expect(first.friendHash).not.toBe(second.friendHash);
    expect(first.pinHash).not.toBe(second.pinHash);
    expect(first.friendHash).not.toBe(first.pinHash);
  });

  it("aceita a resposta certa mesmo com acento/caixa diferentes e o código certo", async () => {
    const stored = await hashSecurityAnswers("José Antônio", "0042");
    expect(await verifySecurityAnswers(stored, "  JOSE   antonio ", "0042")).toBe(true);
  });

  it("recusa se QUALQUER uma das duas estiver errada", async () => {
    const stored = await hashSecurityAnswers("José Antônio", "0042");
    expect(await verifySecurityAnswers(stored, "Outro Nome", "0042")).toBe(false);
    expect(await verifySecurityAnswers(stored, "José Antônio", "0043")).toBe(false);
    expect(await verifySecurityAnswers(stored, "Outro Nome", "9999")).toBe(false);
  });

  it("sem nada cadastrado, recusa sempre (e não estoura erro)", async () => {
    expect(await verifySecurityAnswers({ friendHash: null, pinHash: null }, "qualquer", "1234")).toBe(false);
  });

  it("hash adulterado ou de outro formato é recusado", async () => {
    const stored = await hashSecurityAnswers("Ana", "1111");
    expect(await verifySecurityAnswers({ friendHash: "v2:abc:def", pinHash: stored.pinHash }, "Ana", "1111")).toBe(false);
    expect(await verifySecurityAnswers({ friendHash: stored.friendHash.slice(0, -2) + "00", pinHash: stored.pinHash }, "Ana", "1111")).toBe(false);
  });
});
