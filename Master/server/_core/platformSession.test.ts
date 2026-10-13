import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";

vi.mock("./env", () => ({ ENV: { platformJwtSecret: "test-only-platform-secret-32-chars-min" } }));

import { createPlatformSessionToken, isSessionRevoked, signPendingTotpToken, verifyPendingTotpToken, verifyPlatformSessionToken } from "./platformSession";

const SECRET = new TextEncoder().encode("test-only-platform-secret-32-chars-min");

function decodePayload(token: string) {
  return JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
}

describe("sessão de 12 horas com iat", () => {
  it("o token tem iat e expira em 12h (absolutas)", async () => {
    const payload = decodePayload(await createPlatformSessionToken(1, "a@b.com"));
    expect(typeof payload.iat).toBe("number");
    expect(payload.exp - payload.iat).toBe(12 * 60 * 60);
  });
});

describe("token pendente de 2FA x token de sessão", () => {
  it("token pendente NÃO vale como sessão (tem o claim purpose)", async () => {
    await expect(verifyPlatformSessionToken(await signPendingTotpToken(1, "a@b.com"))).resolves.toBeNull();
  });

  it("qualquer JWT com o mesmo segredo mas com purpose é recusado como sessão", async () => {
    const token = await new SignJWT({ adminId: 1, email: "a@b.com", purpose: "outra-coisa" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(SECRET);
    await expect(verifyPlatformSessionToken(token)).resolves.toBeNull();
  });

  it("token de sessão NÃO vale como token pendente", async () => {
    await expect(verifyPendingTotpToken(await createPlatformSessionToken(1, "a@b.com"))).resolves.toBeNull();
  });

  it("token pendente válido é aceito e expira em 5 minutos", async () => {
    const pending = await signPendingTotpToken(7, "a@b.com");
    await expect(verifyPendingTotpToken(pending)).resolves.toMatchObject({ purpose: "totp-verify", adminId: 7, email: "a@b.com" });
    const payload = decodePayload(pending);
    expect(payload.exp - payload.iat).toBe(300);
  });

  it("token pendente com outro purpose é recusado", async () => {
    const token = await new SignJWT({ adminId: 1, email: "a@b.com", purpose: "totp-setup" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("5m").sign(SECRET);
    await expect(verifyPendingTotpToken(token)).resolves.toBeNull();
  });
});

describe("isSessionRevoked", () => {
  it("revoga só quando iat < sessionsValidAfter (estrito, em segundos)", () => {
    expect(isSessionRevoked(99, 100)).toBe(true);
    expect(isSessionRevoked(100, 100)).toBe(false);
    expect(isSessionRevoked(101, 100)).toBe(false);
  });

  it("sem sessionsValidAfter nada é revogado", () => {
    expect(isSessionRevoked(1, null)).toBe(false);
    expect(isSessionRevoked(1, undefined)).toBe(false);
  });
});
