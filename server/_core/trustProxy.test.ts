import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { configureTrustProxy } from "./trustProxy";

/**
 * Cobertura que faltava (auditoria V-26): todo teste do resto do projeto
 * chama o router tRPC direto via `createCaller`, sem subir o Express de
 * verdade — a resolução real de `req.ip`/`req.secure` por trás de proxy
 * nunca era exercitada, mesmo sendo exatamente o que o rate limit de login
 * usa como chave (server/_core/rateLimit.ts) e o que decide se o HSTS é
 * enviado (server/_core/index.ts). Usa supertest pra bater numa instância
 * Express de verdade (porta real, requisição HTTP de verdade), não um mock.
 */
function buildTestApp(trustProxy: boolean) {
  const app = express();
  configureTrustProxy(app, trustProxy);
  app.get("/whoami", (req, res) => {
    res.json({ ip: req.ip, secure: req.secure });
  });
  return app;
}

describe("configureTrustProxy — resolução de IP/HTTPS por trás de proxy", () => {
  it("TRUST_PROXY=false (padrão, sem proxy confiável na frente): ignora X-Forwarded-For forjado", async () => {
    const app = buildTestApp(false);
    const response = await request(app)
      .get("/whoami")
      .set("X-Forwarded-For", "203.0.113.99")
      .set("X-Forwarded-Proto", "https");

    // Sem trust proxy, Express usa o IP da conexão TCP real (supertest bate
    // localmente), nunca o header — um atacante não consegue se passar por
    // outro IP nem forjar "vim de HTTPS" só mandando esses headers.
    expect(response.body.ip).not.toBe("203.0.113.99");
    expect(response.body.secure).toBe(false);
  });

  it("TRUST_PROXY=true (atrás de reverse proxy de fato confiável): reflete X-Forwarded-For/Proto de verdade", async () => {
    const app = buildTestApp(true);
    const response = await request(app)
      .get("/whoami")
      .set("X-Forwarded-For", "203.0.113.99")
      .set("X-Forwarded-Proto", "https");

    // Com trust proxy ligado, esses headers passam a ser a fonte da
    // verdade — é assim que o rate limit por IP e o HSTS continuam
    // funcionando certo quando o Caddy (reverse proxy real) está na frente.
    expect(response.body.ip).toBe("203.0.113.99");
    expect(response.body.secure).toBe(true);
  });

  it("TRUST_PROXY=true sem nenhum header forjado: continua resolvendo o IP normal da conexão", async () => {
    const app = buildTestApp(true);
    const response = await request(app).get("/whoami");

    expect(response.body.ip).toBeTruthy();
    expect(response.body.secure).toBe(false);
  });
});
