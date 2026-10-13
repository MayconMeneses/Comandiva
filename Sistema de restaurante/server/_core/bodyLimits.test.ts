import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Corpo grande (150 MB) só em upload de imagem e só pra quem está logado;
 * qualquer outra rota — pública, webhook, tRPC comum — recusa corpo grande
 * logo de cara (auditoria de segurança 2026-10-10, risco de derrubar o app
 * por falta de memória antes mesmo do login).
 */
const mocks = vi.hoisted(() => ({ authenticateRequest: vi.fn(), verifySupportSessionToken: vi.fn() }));
vi.mock("./sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./supportSession", () => ({ verifySupportSessionToken: mocks.verifySupportSessionToken }));

import { DEFAULT_BODY_LIMIT, isUploadRequest, registerBodyParsers } from "./bodyLimits";

function makeApp() {
  const app = express();
  registerBodyParsers(app);
  app.post("/api/trpc/:proc", (req, res) => res.json({ bytes: JSON.stringify(req.body ?? {}).length }));
  app.post("/api/webhooks/mercadopago", (req, res) => res.json({ ok: true, body: req.body }));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status ?? 500).json({ error: true }));
  return app;
}

const bigBody = { dataBase64: "A".repeat(2 * 1024 * 1024) }; // ~2 MB > limite padrão (1 MB)

describe("isUploadRequest", () => {
  it.each([
    ["/api/trpc/admin.uploadLogo", true],
    ["/api/trpc/admin.uploadEventImage", true],
    ["/api/trpc/admin.uploadProductImage,admin.dashboard", true],
    ["/api/trpc/admin.dashboard", false],
    ["/api/trpc/order.create", false],
    ["/api/webhooks/mercadopago", false],
  ])("%s → %s", (path, expected) => expect(isUploadRequest(path)).toBe(expected));
});

describe("registerBodyParsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateRequest.mockRejectedValue(new Error("Sessão inválida"));
    mocks.verifySupportSessionToken.mockResolvedValue(null);
  });

  it("rota comum recusa corpo acima do limite padrão (413) e aceita corpo pequeno", async () => {
    const app = makeApp();
    expect(DEFAULT_BODY_LIMIT).toBe("1mb");
    await request(app).post("/api/trpc/order.create").send(bigBody).expect(413);
    await request(app).post("/api/trpc/order.create").send({ a: 1 }).expect(200);
  });

  it("webhook também recusa corpo grande", async () => {
    await request(makeApp()).post("/api/webhooks/mercadopago").send(bigBody).expect(413);
  });

  it("upload sem sessão: 401 antes de ler o corpo", async () => {
    await request(makeApp()).post("/api/trpc/admin.uploadLogo").send(bigBody).expect(401);
  });

  it("upload com sessão de equipe aceita corpo grande", async () => {
    mocks.authenticateRequest.mockResolvedValue({ id: 1 });
    await request(makeApp()).post("/api/trpc/admin.uploadLogo").send(bigBody).expect(200);
  });

  it("upload em Modo Suporte (sem sessão normal) também passa", async () => {
    mocks.verifySupportSessionToken.mockResolvedValue({ adminId: 1 });
    await request(makeApp()).post("/api/trpc/admin.uploadLogo").send(bigBody).expect(200);
  });
});
