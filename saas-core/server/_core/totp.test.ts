import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import { buildTotpQrCodeDataUrl, generateTotpSecret, verifyTotpToken } from "./totp";

function currentCodeFor(secret: string, email: string): string {
  const totp = new OTPAuth.TOTP({ issuer: "MM System Creator", label: email, algorithm: "SHA1", digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(secret) });
  return totp.generate();
}

describe("generateTotpSecret", () => {
  it("gera segredos diferentes a cada chamada", () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe("verifyTotpToken", () => {
  it("aceita o código correto do momento atual", () => {
    const secret = generateTotpSecret();
    const code = currentCodeFor(secret, "dono@mmsystemcreator.com.br");
    expect(verifyTotpToken(code, secret, "dono@mmsystemcreator.com.br")).toBe(true);
  });

  it("rejeita um código de 6 dígitos que não bate com o segredo", () => {
    const secret = generateTotpSecret();
    const wrongCode = currentCodeFor(generateTotpSecret(), "dono@mmsystemcreator.com.br");
    expect(verifyTotpToken(wrongCode, secret, "dono@mmsystemcreator.com.br")).toBe(false);
  });

  it("rejeita entrada que não é 6 dígitos (nem chega a consultar o algoritmo)", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpToken("12345", secret, "a@b.com")).toBe(false);
    expect(verifyTotpToken("abcdef", secret, "a@b.com")).toBe(false);
    expect(verifyTotpToken("", secret, "a@b.com")).toBe(false);
  });

  it("rejeita quando o segredo está vazio (conta sem 2FA configurado ainda)", () => {
    expect(verifyTotpToken("123456", "", "a@b.com")).toBe(false);
  });
});

describe("buildTotpQrCodeDataUrl", () => {
  it("gera uma data URL de imagem PNG", async () => {
    const secret = generateTotpSecret();
    const dataUrl = await buildTotpQrCodeDataUrl("dono@mmsystemcreator.com.br", secret);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
