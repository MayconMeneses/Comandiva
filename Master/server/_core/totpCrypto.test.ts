import { describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ ENV: { platformJwtSecret: "test-only-platform-secret-32-chars-min" } }));
vi.mock("./env", () => env);

import { decryptTotpSecret, encryptTotpSecret, generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from "./totpCrypto";

const GOOD_SECRET = "test-only-platform-secret-32-chars-min";

describe("criptografia do segredo do 2FA", () => {
  it("ida e volta devolve o mesmo segredo, no formato v1:iv:tag:cipher", () => {
    const encrypted = encryptTotpSecret("JBSWY3DPEHPK3PXP");
    expect(encrypted.split(":")).toHaveLength(4);
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(encrypted).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptTotpSecret(encrypted)).toBe("JBSWY3DPEHPK3PXP");
    expect(encrypted.length).toBeLessThanOrEqual(255); // cabe na coluna totpSecret
  });

  it("cifra diferente a cada vez (iv aleatório)", () => {
    expect(encryptTotpSecret("ABC")).not.toBe(encryptTotpSecret("ABC"));
  });

  it("falha ao decifrar com a chave errada (PLATFORM_JWT_SECRET trocado)", () => {
    const encrypted = encryptTotpSecret("JBSWY3DPEHPK3PXP");
    env.ENV.platformJwtSecret = "outro-segredo-completamente-diferente-32+";
    try {
      expect(() => decryptTotpSecret(encrypted)).toThrow();
    } finally {
      env.ENV.platformJwtSecret = GOOD_SECRET;
    }
  });

  it("detecta adulteração do conteúdo", () => {
    const [version, iv, tag, cipher] = encryptTotpSecret("JBSWY3DPEHPK3PXP").split(":");
    const tampered = Buffer.from(cipher!, "base64");
    tampered[0] = tampered[0]! ^ 1;
    expect(() => decryptTotpSecret([version, iv, tag, tampered.toString("base64")].join(":"))).toThrow();
  });

  it("sem fallback: segredo ausente ou curto lança erro em vez de usar chave fraca", () => {
    env.ENV.platformJwtSecret = "";
    try {
      expect(() => encryptTotpSecret("X")).toThrow(/PLATFORM_JWT_SECRET/);
      expect(() => hashRecoveryCode("AAAAA-BBBBB")).toThrow(/PLATFORM_JWT_SECRET/);
    } finally {
      env.ENV.platformJwtSecret = GOOD_SECRET;
    }
  });

  it("rejeita formato desconhecido", () => {
    expect(() => decryptTotpSecret("JBSWY3DPEHPK3PXP")).toThrow();
  });
});

describe("códigos de recuperação", () => {
  it("gera 10 códigos únicos XXXXX-XXXXX sem caracteres ambíguos", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
  });

  it("normaliza minúsculas/espaços/sem hífen e rejeita lixo", () => {
    expect(normalizeRecoveryCode("abcde fghjk")).toBe("ABCDE-FGHJK");
    expect(normalizeRecoveryCode("ABCDEFGHJK")).toBe("ABCDE-FGHJK");
    expect(normalizeRecoveryCode("ABCDE-FGHJ")).toBeNull();
    expect(normalizeRecoveryCode("ABCDE-FGHJ0")).toBeNull(); // 0 não existe no alfabeto
    expect(normalizeRecoveryCode("")).toBeNull();
  });

  it("hash é determinístico, hex de 64 chars e não contém o código", () => {
    const hash = hashRecoveryCode("ABCDE-FGHJK");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(hashRecoveryCode("ABCDE-FGHJK"));
    expect(hash).not.toBe(hashRecoveryCode("ABCDE-FGHJL"));
  });
});
