import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import type { TrpcContext } from "./_core/context";
import { GRANTABLE_MASTER_AREAS } from "./_core/permissions";

const mocks = vi.hoisted(() => ({
  recordSiteEvent: vi.fn().mockResolvedValue(undefined),
  getSiteStats: vi.fn().mockResolvedValue({ last7Days: {}, last30Days: {} }),
}));
vi.mock("./db/siteEvents", async importOriginal => ({
  ...(await importOriginal<typeof import("./db/siteEvents")>()),
  recordSiteEvent: mocks.recordSiteEvent,
  getSiteStats: mocks.getSiteStats,
}));
vi.mock("./db/dashboard", () => ({ getDashboardSummary: vi.fn() }));

import { handleSiteTrack } from "./_core/siteTrack";
import { summarizeSiteEvents } from "./db/siteEvents";
import { masterPanelDashboardRouter } from "./routers/masterPanel/dashboard";

let ipCounter = 0;
async function post(body: unknown, userAgent = "Mozilla/5.0 (iPhone) Safari", ip?: string) {
  const res = { status: vi.fn().mockReturnThis(), end: vi.fn() };
  const req = { body, ip: ip ?? `198.51.100.${++ipCounter}`, get: () => userAgent } as unknown as Request;
  await handleSiteTrack(req, res as unknown as Response);
  return res.status.mock.calls[0]?.[0] as number;
}

describe("POST /api/track", () => {
  beforeEach(() => mocks.recordSiteEvent.mockClear());

  it("grava evento válido e responde 204", async () => {
    expect(await post({ event: "page_view", path: "/comercial/planos" })).toBe(204);
    expect(mocks.recordSiteEvent).toHaveBeenCalledWith("/comercial/planos", "page_view");
  });

  it("rejeita evento fora do enum, path fora de /comercial, com query e campos extras", async () => {
    for (const body of [
      { event: "hack", path: "/comercial" },
      { event: "page_view", path: "/login" },
      { event: "page_view", path: "/comercial?x=1" },
      { event: "page_view", path: "/comercial/" + "a".repeat(120) },
      { event: "page_view", path: "/comercial", email: "a@b.com" },
      null,
    ]) {
      expect(await post(body)).toBe(400);
    }
    expect(mocks.recordSiteEvent).not.toHaveBeenCalled();
  });

  it("ignora bots com 204 sem gravar", async () => {
    expect(await post({ event: "page_view", path: "/comercial" }, "Googlebot/2.1")).toBe(204);
    expect(await post({ event: "page_view", path: "/comercial" }, "HeadlessChrome")).toBe(204);
    expect(mocks.recordSiteEvent).not.toHaveBeenCalled();
  });

  it("aplica rate limit por IP (120/min)", async () => {
    const ip = "203.0.113.77";
    let last = 0;
    for (let i = 0; i < 121; i++) last = await post({ event: "page_view", path: "/comercial" }, undefined, ip);
    expect(last).toBe(429);
    expect(mocks.recordSiteEvent).toHaveBeenCalledTimes(120);
  });

  it("falha no banco nunca vira erro pra página", async () => {
    mocks.recordSiteEvent.mockRejectedValueOnce(new Error("db down"));
    expect(await post({ event: "page_view", path: "/comercial" })).toBe(204);
  });
});

describe("summarizeSiteEvents — funil", () => {
  it("soma visitas por página, CTAs e calcula conversões", () => {
    const stats = summarizeSiteEvents([
      { path: "/comercial", event: "page_view", count: 10 },
      { path: "/comercial/planos", event: "page_view", count: 30 },
      { path: "/comercial", event: "cta_click", count: 4 },
      { path: "/comercial/planos", event: "cta_click", count: 6 },
      { path: "/comercial/cadastro/premium", event: "signup_start", count: 8 },
      { path: "/comercial/cadastro/premium", event: "signup_submit", count: 4 },
      { path: "/comercial/cadastro/sucesso", event: "signup_success", count: 1 },
    ]);
    expect(stats.pageViewsByPath).toEqual([
      { path: "/comercial/planos", views: 30 },
      { path: "/comercial", views: 10 },
    ]);
    expect(stats.totalPageViews).toBe(40);
    expect(stats.ctaClicks).toBe(10);
    expect(stats.funnel).toMatchObject({ start: 8, submit: 4, success: 1, submitRatePct: 50, successRatePct: 25, overallRatePct: 12.5 });
  });

  it("sem dados não divide por zero", () => {
    expect(summarizeSiteEvents([]).funnel).toMatchObject({ start: 0, submitRatePct: null, overallRatePct: null });
  });
});

describe("masterPanel.dashboard.siteStats — gate", () => {
  const ctx = (role: "owner" | "member", permissions: string[]) =>
    ({ platformAdmin: { id: 2, email: "x@y.com", role, permissions, active: true }, req: { ip: "203.0.113.9" }, res: {} }) as unknown as TrpcContext;

  it("member sem área é barrado; com billing e owner passam", async () => {
    await expect(masterPanelDashboardRouter.createCaller(ctx("member", [])).siteStats()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(masterPanelDashboardRouter.createCaller(ctx("member", ["billing"])).siteStats()).resolves.toBeDefined();
    await expect(masterPanelDashboardRouter.createCaller(ctx("owner", [...GRANTABLE_MASTER_AREAS])).siteStats()).resolves.toBeDefined();
  });
});
