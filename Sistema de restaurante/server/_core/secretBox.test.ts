import { describe, expect, it } from "vitest";
import { createSecretBox, isEncryptedSecret } from "./secretBox";

const KEY = "chave-de-teste-com-mais-de-trinta-e-dois-caracteres-0123";

describe("secretBox", () => {
  it("cifra e decifra de volta o mesmo valor", () => {
    const box = createSecretBox(KEY);
    const stored = box.encrypt("APP_USR-1234567890-abcdef");
    expect(box.decrypt(stored)).toBe("APP_USR-1234567890-abcdef");
  });

  it("o valor gravado não contém o segredo e leva o prefixo de versão", () => {
    const stored = createSecretBox(KEY).encrypt("APP_USR-segredo");
    expect(stored.startsWith("enc:v1:")).toBe(true);
    expect(stored).not.toContain("APP_USR-segredo");
    expect(isEncryptedSecret(stored)).toBe(true);
  });

  it("usa IV novo a cada gravação (mesmo texto gera valores diferentes)", () => {
    const box = createSecretBox(KEY);
    expect(box.encrypt("igual")).not.toBe(box.encrypt("igual"));
  });

  it("texto puro antigo (sem prefixo) passa direto na leitura", () => {
    const box = createSecretBox(KEY);
    expect(box.decrypt("valor-antigo-em-texto-puro")).toBe("valor-antigo-em-texto-puro");
    expect(isEncryptedSecret("valor-antigo-em-texto-puro")).toBe(false);
  });

  it("chave errada não decifra", () => {
    const stored = createSecretBox(KEY).encrypt("segredo");
    expect(() => createSecretBox(KEY + "x").decrypt(stored)).toThrow(/descriptografar/);
  });

  it("valor adulterado é recusado (autenticação do GCM)", () => {
    const box = createSecretBox(KEY);
    const stored = box.encrypt("segredo");
    const raw = Buffer.from(stored.slice("enc:v1:".length), "base64");
    raw[raw.length - 1] ^= 0xff;
    expect(() => box.decrypt("enc:v1:" + raw.toString("base64"))).toThrow(/descriptografar/);
  });

  it("valor cifrado truncado é recusado", () => {
    expect(() => createSecretBox(KEY).decrypt("enc:v1:abcd")).toThrow(/inválido/);
  });

  it("recusa chave curta demais", () => {
    expect(() => createSecretBox("curta")).toThrow(/32 caracteres/);
  });

  it("aceita segredos com acentos e tamanho do limite do campo (500)", () => {
    const box = createSecretBox(KEY);
    const longo = "ç".repeat(250) + "a".repeat(250);
    expect(box.decrypt(box.encrypt(longo))).toBe(longo);
  });
});
