import { beforeEach, describe, expect, it, vi } from "vitest";
import { GRANTABLE_STAFF_AREAS } from "@shared/permissions";
import type { TrpcContext } from "./_core/context";

/**
 * Prova a matriz de acesso do Modo Suporte: uma sessão de suporte (sem login
 * real nenhum) alcança leitura E a maioria das escritas do admin real — mas
 * nunca os pontos que ficam de fora por design (credenciais de gateway de
 * pagamento, gestão de outras contas admin/staff, chave Pix), que rejeitam
 * exatamente como um contexto anônimo rejeitaria. Mesmo padrão de
 * admin-role-access.test.ts (createCaller direto, sem servidor rodando).
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getStoreSettings: vi.fn(),
  listTablesWithOpenSessions: vi.fn().mockResolvedValue([{ id: 1, label: "01" }]),
  createRestaurantAccessAccount: vi.fn(),
}));

vi.mock("./db", () => ({
  ...mocks,
  // admin.tables agora exige requireFeature("tables_qr"), que consulta a
  // licença — sem linha nenhuma, buildSnapshot() cai no PERMISSIVE_DEFAULT
  // (mesmo comportamento de fail-open já coberto em license.test.ts).
  getOrCreateLicenseCache: vi.fn().mockResolvedValue(null),
  getAdminOrders: vi.fn(),
  getDashboardMetrics: vi.fn(),
  getOrderWithDetails: vi.fn(),
  cancelTableSession: vi.fn(),
  closeTableSession: vi.fn(),
  createReservation: vi.fn(),
  createTable: vi.fn(),
  getOrOpenSessionForTable: vi.fn(),
  getSessionWithOrders: vi.fn(),
  listPendingServiceRequests: vi.fn(),
  listRecentClosedSessions: vi.fn(),
  listReservations: vi.fn(),
  recordBillPayment: vi.fn(),
  regenerateTableQrToken: vi.fn(),
  reopenTableSession: vi.fn(),
  resolveServiceRequest: vi.fn(),
  updateReservation: vi.fn(),
  updateTable: vi.fn(),
  authenticateRestaurantAccount: vi.fn(),
  listRestaurantAccessAccounts: vi.fn(),
  updateRestaurantAccessAccount: vi.fn(),
  setRestaurantAccessAccountActive: vi.fn(),
  deleteRestaurantAccessAccount: vi.fn(),
}));

import { appRouter } from "./routers";

const now = Date.now();
const SUPPORT_SESSION = { supportSessionId: 1, restaurantName: "MM System Creator (teste)", platformAdminEmail: "dono@plataforma.com", expiresAt: now + 60_000 };
const REAL_ADMIN = { id: 7, role: "admin", name: "Dono", username: "dono", email: "dono@mmsystemcreator.com" } as unknown as TrpcContext["user"];

function contextWith(overrides: { user?: TrpcContext["user"]; supportSession?: TrpcContext["supportSession"] }): TrpcContext {
  return { user: overrides.user ?? null, supportSession: overrides.supportSession ?? null, req: { ip: "203.0.113.30" }, res: {} } as unknown as TrpcContext;
}

const supportOnlyContext = contextWith({ supportSession: SUPPORT_SESSION });
const anonymousContext = contextWith({});

describe("Modo Suporte — leitura e escrita liberadas, exceto credenciais/pagamento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listTablesWithOpenSessions.mockResolvedValue([{ id: 1, label: "01" }]);
  });

  it("sessão de suporte alcança leitura curada (admin.tables, admin.customers)", async () => {
    const rows = [{ id: 9, name: "Cliente teste" }];
    const listQuery = { orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue(rows) })) };
    // admin.customers agora roda duas consultas em paralelo (lista + contagem
    // total) — a 1ª chamada de select() (síncrona, antes do Promise.all
    // resolver) é sempre a lista, a 2ª é a contagem, então um contador simples
    // decide qual resposta cada uma recebe.
    let selectCall = 0;
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => { selectCall++; const call = selectCall; return { from: vi.fn(() => (call === 1 ? listQuery : Promise.resolve([{ count: rows.length }]))) }; }) });

    const caller = appRouter.createCaller(supportOnlyContext);
    await expect(caller.admin.tables()).resolves.toEqual([{ id: 1, label: "01" }]);
    await expect(caller.admin.customers({ limit: 10 })).resolves.toEqual({ rows, total: rows.length });
  });

  it("sem sessão nenhuma (nem admin, nem suporte) é rejeitado nos mesmos endpoints", async () => {
    const caller = appRouter.createCaller(anonymousContext);
    await expect(caller.admin.tables()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.customers({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sessão de suporte AGORA consegue escrever numa mutation comum (setProductAvailability)", async () => {
    const whereMock = vi.fn();
    mocks.getDb.mockResolvedValue({ update: vi.fn(() => ({ set: vi.fn(() => ({ where: whereMock })) })) });

    const caller = appRouter.createCaller(supportOnlyContext);
    await expect(caller.admin.setProductAvailability({ productId: 1, available: false })).resolves.toEqual({ success: true });
    expect(whereMock).toHaveBeenCalled();
  });

  it("contexto anônimo continua rejeitado na mesma mutation", async () => {
    const caller = appRouter.createCaller(anonymousContext);
    await expect(caller.admin.setProductAvailability({ productId: 1, available: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("sessão de suporte é bloqueada em gateway de pagamento (adminOnlyProcedure)", async () => {
    const caller = appRouter.createCaller(supportOnlyContext);
    await expect(caller.admin.savePaymentGateway({ provider: "MERCADO_PAGO", label: "Cartão" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("sessão de suporte é bloqueada em gestão de contas admin/staff (team.create)", async () => {
    const caller = appRouter.createCaller(supportOnlyContext);
    await expect(caller.team.create({ name: "Novo", username: "novo123", password: "senhaforte1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.createRestaurantAccessAccount).not.toHaveBeenCalled();
  });

  it("sessão de suporte é bloqueada ao tentar mudar a chave Pix via updateSettings", async () => {
    const caller = appRouter.createCaller(supportOnlyContext);
    await expect(
      caller.admin.updateSettings({ isAcceptingOrders: true, deliveryFeeCents: 500, minimumOrderCents: 0, estimatedDeliveryMin: 10, estimatedDeliveryMax: 30, openingHours: "18:00-23:00", pixKey: "nova-chave" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("sessão de suporte consegue mudar campos não-sensíveis de updateSettings (sem tocar em pixKey)", async () => {
    const whereMock = vi.fn();
    mocks.getDb.mockResolvedValue({ update: vi.fn(() => ({ set: vi.fn(() => ({ where: whereMock })) })) });
    mocks.getStoreSettings.mockResolvedValue({ id: 1 });

    const caller = appRouter.createCaller(supportOnlyContext);
    await expect(
      caller.admin.updateSettings({ isAcceptingOrders: false, deliveryFeeCents: 500, minimumOrderCents: 0, estimatedDeliveryMin: 10, estimatedDeliveryMax: 30, openingHours: "18:00-23:00" }),
    ).resolves.toEqual({ success: true });
    expect(whereMock).toHaveBeenCalled();
  });

  it("auth.me devolve identidade sintética de admin pra sessão de suporte; login real tem prioridade; sem nenhuma das duas devolve null", async () => {
    const supportIdentity = await appRouter.createCaller(supportOnlyContext).auth.me();
    expect(supportIdentity).toMatchObject({ role: "admin", email: "dono@plataforma.com", viaSupportSession: true, supportRestaurantName: "MM System Creator (teste)" });

    const bothContext = contextWith({ user: REAL_ADMIN, supportSession: SUPPORT_SESSION });
    await expect(appRouter.createCaller(bothContext).auth.me()).resolves.toEqual({ ...REAL_ADMIN, permissions: [...GRANTABLE_STAFF_AREAS] });

    await expect(appRouter.createCaller(anonymousContext).auth.me()).resolves.toBeNull();
  });
});
