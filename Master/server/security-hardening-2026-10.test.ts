import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { GRANTABLE_MASTER_AREAS } from "./_core/permissions";

/**
 * Auditoria de segurança 2026-10-10 (saas-core):
 *  - membro só concede áreas que já tem e não edita as próprias permissões;
 *  - trocar deploymentUrl / rotacionar chave só pelo owner;
 *  - envio de cardápio exige token assinado e confere os bytes do arquivo;
 *  - corpo de requisição pequeno por padrão.
 */
const mocks = vi.hoisted(() => ({
  createPlatformAdmin: vi.fn(),
  getPlatformAdminById: vi.fn(),
  updatePlatformAdmin: vi.fn(),
  recordPlatformAuditLog: vi.fn().mockResolvedValue(undefined),
  getRestaurantById: vi.fn(),
  setRestaurantDeploymentUrl: vi.fn(),
  rotateApiKey: vi.fn(),
}));

vi.mock("./_core/env", () => ({ ENV: { platformJwtSecret: "x".repeat(40), operatorToken: "", isProduction: false } }));
vi.mock("./db/platformAdmins", () => ({
  createPlatformAdmin: mocks.createPlatformAdmin,
  getPlatformAdminById: mocks.getPlatformAdminById,
  listPlatformAdmins: vi.fn(),
  setPlatformAdminActive: vi.fn(),
  updatePlatformAdmin: mocks.updatePlatformAdmin,
}));
vi.mock("./db/auditLog", () => ({ recordPlatformAuditLog: mocks.recordPlatformAuditLog }));
vi.mock("./db/restaurants", () => ({
  createRestaurantWithSubscription: vi.fn(),
  getRestaurantById: mocks.getRestaurantById,
  getRestaurantDetailForPanel: vi.fn(),
  listRestaurantsForPanel: vi.fn(),
  markRestaurantDelivered: vi.fn(),
  rotateApiKey: mocks.rotateApiKey,
  setRestaurantDeploymentUrl: mocks.setRestaurantDeploymentUrl,
  setRestaurantStatus: vi.fn(),
  updateRestaurantContact: vi.fn(),
}));
vi.mock("./db/subscriptions", () => ({ assignPlan: vi.fn(), getSubscriptionForRestaurant: vi.fn(), listSubscriptionEventsForRestaurant: vi.fn(), updateSubscriptionStatus: vi.fn() }));
vi.mock("./_core/remoteLicenseSync", () => ({ triggerRemoteLicenseSync: vi.fn() }));

import { masterPanelTeamRouter } from "./routers/masterPanel/team";
import { masterPanelRestaurantsRouter } from "./routers/masterPanel/restaurants";
import { createMenuUploadToken, fileMatchesDeclaredType, MENU_UPLOAD_TOKEN_TTL_MS, verifyMenuUploadToken } from "./_core/menuUpload";
import { DEFAULT_BODY_LIMIT, isMenuUploadRequest, registerBodyParsers } from "./_core/bodyLimits";

function adminContext(admin: { id: number; email: string; role: "owner" | "member"; permissions: string[] }): TrpcContext {
  return { platformAdmin: { ...admin, active: true }, req: { ip: "203.0.113.9" }, res: {} } as unknown as TrpcContext;
}
const OWNER = adminContext({ id: 1, email: "dono@x.com", role: "owner", permissions: [...GRANTABLE_MASTER_AREAS] });
const MEMBER_EQUIPE = adminContext({ id: 2, email: "membro@x.com", role: "member", permissions: ["equipe"] });
const MEMBER_RESTAURANTES = adminContext({ id: 3, email: "rest@x.com", role: "member", permissions: ["restaurantes"] });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createPlatformAdmin.mockResolvedValue({ id: 9 });
  mocks.getPlatformAdminById.mockResolvedValue({ id: 5, name: "Outro", role: "member", permissions: [] });
  mocks.getRestaurantById.mockResolvedValue({ id: 11, deploymentUrl: null });
  mocks.rotateApiKey.mockResolvedValue({ apiKey: "rk_live_new" });
});

describe("equipe: membro só concede o que já tem", () => {
  it("member com só 'equipe' não cria conta com billing/modo_suporte", async () => {
    await expect(
      masterPanelTeamRouter.createCaller(MEMBER_EQUIPE).create({ name: "Amigo", email: "a@x.com", password: "senha1234", role: "member", permissions: ["billing", "modo_suporte"] }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createPlatformAdmin).not.toHaveBeenCalled();
  });

  it("member não dá a si mesmo novas permissões via update — nem reenviando as mesmas", async () => {
    mocks.getPlatformAdminById.mockResolvedValue({ id: 2, name: "Eu", role: "member", permissions: ["equipe"] });
    const caller = masterPanelTeamRouter.createCaller(MEMBER_EQUIPE);
    await expect(caller.update({ adminId: 2, name: "Eu", permissions: ["equipe", "billing"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.update({ adminId: 2, name: "Eu", permissions: ["equipe"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updatePlatformAdmin).not.toHaveBeenCalled();
  });

  it("member pode mudar o próprio nome/senha (sem tocar nas permissões)", async () => {
    mocks.getPlatformAdminById.mockResolvedValue({ id: 2, name: "Eu", role: "member", permissions: ["equipe"] });
    await expect(masterPanelTeamRouter.createCaller(MEMBER_EQUIPE).update({ adminId: 2, name: "Eu Mesmo" })).resolves.toEqual({ success: true });
  });

  it("member não promove OUTRO member a áreas que ele não tem", async () => {
    await expect(masterPanelTeamRouter.createCaller(MEMBER_EQUIPE).update({ adminId: 5, name: "Outro", permissions: ["planos"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.updatePlatformAdmin).not.toHaveBeenCalled();
  });

  it("owner continua concedendo qualquer área", async () => {
    await expect(masterPanelTeamRouter.createCaller(OWNER).update({ adminId: 5, name: "Outro", permissions: ["billing", "modo_suporte"] })).resolves.toEqual({ success: true });
    expect(mocks.updatePlatformAdmin).toHaveBeenCalledOnce();
  });
});

describe("restaurantes: deploymentUrl e chave de API só pelo owner", () => {
  it("member com a área 'restaurantes' é barrado nas duas", async () => {
    const caller = masterPanelRestaurantsRouter.createCaller(MEMBER_RESTAURANTES);
    await expect(caller.updateDeploymentUrl({ restaurantId: 11, deploymentUrl: "https://atacante.example.com" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.rotateApiKey({ restaurantId: 11 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.setRestaurantDeploymentUrl).not.toHaveBeenCalled();
    expect(mocks.rotateApiKey).not.toHaveBeenCalled();
  });

  it("owner continua conseguindo", async () => {
    const caller = masterPanelRestaurantsRouter.createCaller(OWNER);
    await caller.updateDeploymentUrl({ restaurantId: 11, deploymentUrl: "https://cliente.mmsystem.tech" });
    await caller.rotateApiKey({ restaurantId: 11 });
    expect(mocks.setRestaurantDeploymentUrl).toHaveBeenCalledOnce();
    expect(mocks.rotateApiKey).toHaveBeenCalledOnce();
  });
});

describe("token de envio de cardápio", () => {
  it("vale só pro restaurante e dentro do prazo", () => {
    const now = 1_800_000_000_000;
    const token = createMenuUploadToken(11, now);
    expect(verifyMenuUploadToken(11, token, now + 1000)).toBe(true);
    expect(verifyMenuUploadToken(12, token, now + 1000)).toBe(false);
    expect(verifyMenuUploadToken(11, token, now + MENU_UPLOAD_TOKEN_TTL_MS + 1)).toBe(false);
  });

  it("recusa token adulterado, vazio ou malformado", () => {
    const now = 1_800_000_000_000;
    const token = createMenuUploadToken(11, now);
    const [expires, signature] = token.split(".");
    const bads = ["", "abc", `${expires}.`, `${Number(expires) + 1}.${signature}`, `${expires}.${signature}.extra`, `${expires}.${"0".repeat(signature.length)}`];
    for (const bad of bads) expect(verifyMenuUploadToken(11, bad, now), bad).toBe(false);
  });
});

describe("conteúdo do arquivo de cardápio", () => {
  const pdf = Buffer.from("%PDF-1.7 conteudo");
  const exe = Buffer.from("MZ\x90\x00 programa");

  it("aceita quando os bytes batem com o tipo declarado", () => {
    expect(fileMatchesDeclaredType(pdf, "application/pdf")).toBe(true);
    expect(fileMatchesDeclaredType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), "image/jpeg")).toBe(true);
    expect(fileMatchesDeclaredType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png")).toBe(true);
    expect(fileMatchesDeclaredType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]), "image/webp")).toBe(true);
  });

  it("recusa executável disfarçado e tipo desconhecido", () => {
    expect(fileMatchesDeclaredType(exe, "application/pdf")).toBe(false);
    expect(fileMatchesDeclaredType(exe, "image/png")).toBe(false);
    expect(fileMatchesDeclaredType(pdf, "application/x-msdownload")).toBe(false);
  });
});

describe("limite do corpo das requisições", () => {
  let server: Server;
  let base: string;
  const big = JSON.stringify({ data: "A".repeat(2 * 1024 * 1024) });

  beforeAll(async () => {
    const app = express();
    registerBodyParsers(app);
    app.post("/api/trpc/:proc", (_req, res) => res.json({ ok: true }));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((error: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(error.status ?? 500).json({ error: true }));
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

  const post = (path: string, body: string) => fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body });

  it("padrão é pequeno e só o envio de cardápio aceita corpo grande", { timeout: 30_000 }, async () => {
    expect(DEFAULT_BODY_LIMIT).toBe("1mb");
    expect(isMenuUploadRequest("/api/trpc/public.uploadMenuReference")).toBe(true);
    expect(isMenuUploadRequest("/api/trpc/public.signup")).toBe(false);
    expect((await post("/api/trpc/public.signup", big)).status).toBe(413);
    expect((await post("/api/trpc/public.signup", JSON.stringify({ a: 1 }))).status).toBe(200);
    expect((await post("/api/trpc/public.uploadMenuReference", big)).status).toBe(200);
  });
});
