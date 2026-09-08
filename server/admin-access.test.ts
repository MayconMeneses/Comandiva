import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextWithRole(role: "user" | "admin" | null): TrpcContext {
  return {
    user: role ? {
      id: 1,
      openId: "operator-test",
      name: "Operador",
      email: "operator@example.com",
      loginMethod: "test",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("administração", () => {
  it("bloqueia consulta de pedidos sem sessão autenticada", async () => {
    const caller = appRouter.createCaller(contextWithRole(null));
    await expect(caller.admin.orders()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("protege a fila de impressão contra acesso sem autenticação administrativa", async () => {
    const caller = appRouter.createCaller(contextWithRole(null));
    await expect(caller.admin.pendingPrintJobs()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("bloqueia consulta de pedidos para usuários sem perfil administrativo", async () => {
    const caller = appRouter.createCaller(contextWithRole("user"));
    await expect(caller.admin.orders()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
