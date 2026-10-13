import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE_MS } from "../shared/const";

process.env.JWT_SECRET ||= "test-only-jwt-secret-com-pelo-menos-32-caracteres";

describe("duração do login do app", () => {
  it("é de 30 dias (antes 1 ano)", () => {
    expect(SESSION_MAX_AGE_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("o token de sessão novo expira em 30 dias, não em 1 ano", { timeout: 30_000 }, async () => {
    const { sdk } = await import("./_core/sdk");
    const token = await sdk.createSessionToken("open-1", { name: "Fulano" });
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()) as { iat: number; exp: number };
    expect(payload.exp - payload.iat).toBe(30 * 24 * 60 * 60);
  });
});
