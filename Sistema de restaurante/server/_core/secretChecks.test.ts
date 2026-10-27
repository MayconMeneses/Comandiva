import { describe, expect, it } from "vitest";
import { checkSecrets } from "./secretChecks";

const strong = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
const base = { cookieSecret: strong, supportSessionSecret: strong, dataEncryptionKey: strong, saasCoreUrl: "https://mmsystem.tech", isProduction: true };

describe("checkSecrets", () => {
  it("segredos fortes: sem problema", () => {
    expect(checkSecrets(base)).toEqual({ fatal: [], warnings: [] });
  });

  it("JWT_SECRET ausente, curto ou com texto de exemplo impede o boot", () => {
    expect(checkSecrets({ ...base, cookieSecret: "" }).fatal[0]).toContain("JWT_SECRET ausente");
    expect(checkSecrets({ ...base, cookieSecret: "curto" }).fatal[0]).toContain("fraco");
    const placeholder = checkSecrets({ ...base, cookieSecret: "gere-um-segredo-aleatorio-com-pelo-menos-32-caracteres" });
    expect(placeholder.fatal[0]).toContain("texto de exemplo");
  });

  it("SUPPORT_SESSION_SECRET vazio é permitido (recurso desligado), mas preenchido precisa ser forte", () => {
    expect(checkSecrets({ ...base, supportSessionSecret: "" }).fatal).toEqual([]);
    expect(checkSecrets({ ...base, supportSessionSecret: "abc123" }).fatal[0]).toContain("SUPPORT_SESSION_SECRET fraco");
  });

  it("avisa (sem travar) quando o app fala com o saas-core por http:// pela internet", () => {
    const warned = checkSecrets({ ...base, saasCoreUrl: "http://203.0.113.10:8080" });
    expect(warned.fatal).toEqual([]);
    expect(warned.warnings[0]).toContain("http://");
    expect(checkSecrets({ ...base, saasCoreUrl: "http://localhost:4000" }).warnings).toEqual([]);
    expect(checkSecrets({ ...base, saasCoreUrl: "http://saas-core:4000" }).warnings).toEqual([]);
    expect(checkSecrets({ ...base, saasCoreUrl: "http://203.0.113.10:8080", isProduction: false }).warnings).toEqual([]);
  });

  it("DATA_ENCRYPTION_KEY é obrigatória em produção (impede o boot); fora dela segue opcional", () => {
    const semChave = checkSecrets({ ...base, dataEncryptionKey: "" });
    expect(semChave.fatal[0]).toContain("DATA_ENCRYPTION_KEY ausente");
    expect(checkSecrets({ ...base, dataEncryptionKey: undefined }).fatal[0]).toContain("DATA_ENCRYPTION_KEY ausente");
    expect(checkSecrets({ ...base, dataEncryptionKey: "", isProduction: false })).toEqual({ fatal: [], warnings: [] });
  });

  it("DATA_ENCRYPTION_KEY preenchida e fraca ou com texto de exemplo impede o boot em qualquer ambiente", () => {
    expect(checkSecrets({ ...base, dataEncryptionKey: "curta" }).fatal[0]).toContain("DATA_ENCRYPTION_KEY fraco");
    expect(checkSecrets({ ...base, dataEncryptionKey: "curta", isProduction: false }).fatal[0]).toContain("DATA_ENCRYPTION_KEY fraco");
    expect(checkSecrets({ ...base, dataEncryptionKey: "gere-um-segredo-aleatorio-com-pelo-menos-32-caracteres" }).fatal[0]).toContain("texto de exemplo");
  });
});
