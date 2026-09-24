import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  create: vi.fn().mockResolvedValue({ id: 10, userId: 20, name: "Novo Admin", username: "novo.admin", role: "admin", active: true }),
  authenticate: vi.fn().mockResolvedValue({ user: { openId: "restaurant_admin_test", name: "Novo Admin", role: "admin" }, credential: { id: 10, username: "novo.admin" } }),
  list: vi.fn().mockResolvedValue([{ id: 10, userId: 20, name: "Novo Admin", username: "novo.admin", role: "admin", active: true, isOwner: false }]),
  update: vi.fn().mockResolvedValue({ success: true }),
  setActive: vi.fn().mockResolvedValue({ success: true }),
  remove: vi.fn().mockResolvedValue({ success: true }),
  session: vi.fn().mockResolvedValue("session-token"),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, createRestaurantAccessAccount: mocks.create, authenticateRestaurantAccount: mocks.authenticate, listRestaurantAccessAccounts: mocks.list, updateRestaurantAccessAccount: mocks.update, setRestaurantAccessAccountActive: mocks.setActive, deleteRestaurantAccessAccount: mocks.remove };
});

vi.mock("./_core/sdk", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/sdk")>();
  return { ...actual, sdk: { ...actual.sdk, createSessionToken: mocks.session } };
});

const { appRouter } = await import("./routers");

const adminContext = { user: { id: 1, openId: "owner", name: "ADM principal", email: "owner@mmsystemcreator.test", loginMethod: "local", role: "admin" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} }, res: { cookie: vi.fn() } } as unknown as TrpcContext;
const publicContext = { user: null, req: { protocol: "https", headers: {} }, res: { cookie: vi.fn() } } as unknown as TrpcContext;

describe("administradores adicionais", () => {
  it("cria uma conta com acesso administrativo completo", async () => {
    const result = await appRouter.createCaller(adminContext).team.create({ name: "Novo Admin", username: "novo.admin", password: "senha-segura", role: "admin" });
    expect(result.role).toBe("admin");
    // Segundo argumento (tx) vem de assertWithinPlanLimitAndInsert (ver
    // auditoria V-24): é `undefined` quando o restaurante não tem limite de
    // plano configurado pra "users", ou uma transação de verdade quando tem
    // — depende de dado ambiente (o snapshot de licença real), não de nada
    // que este teste controla, então não fixamos um valor aqui. Esse mesmo
    // mecanismo (com/sem limite, com/sem tx) já tem cobertura dedicada em
    // server/plan-limits.test.ts; aqui só interessa que o PAYLOAD certo
    // chega em createRestaurantAccessAccount.
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0]?.[0]).toEqual({ name: "Novo Admin", username: "novo.admin", password: "senha-segura", role: "admin" });
  });

  it("autentica o administrador local e cria uma sessão válida", async () => {
    const result = await appRouter.createCaller(publicContext).team.login({ username: "novo.admin", password: "senha-segura" });
    expect(result.role).toBe("admin");
    expect(mocks.authenticate).toHaveBeenCalledWith("novo.admin", "senha-segura");
    expect(mocks.session).toHaveBeenCalledWith("restaurant_admin_test", { name: "Novo Admin" });
    expect((publicContext.res as { cookie: ReturnType<typeof vi.fn> }).cookie).toHaveBeenCalled();
  });

  it("permite ao administrador listar, editar, pausar e remover contas adicionais", async () => {
    const caller = appRouter.createCaller(adminContext);
    await expect(caller.team.list()).resolves.toHaveLength(1);
    await expect(caller.team.update({ accountId: 10, name: "Admin Atualizado", password: "nova-senha" })).resolves.toEqual({ success: true });
    await expect(caller.team.setActive({ accountId: 10, active: false })).resolves.toEqual({ success: true });
    await expect(caller.team.delete({ accountId: 10 })).resolves.toEqual({ success: true });
    expect(mocks.update).toHaveBeenCalledWith({ accountId: 10, name: "Admin Atualizado", password: "nova-senha" });
    expect(mocks.setActive).toHaveBeenCalledWith(10, false, 1);
    expect(mocks.remove).toHaveBeenCalledWith(10, 1);
  });
});
