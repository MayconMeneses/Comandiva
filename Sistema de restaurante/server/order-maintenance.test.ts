import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const regularUserContext = {
  user: { id: 2, openId: "regular-user", name: "Usuário", email: null, loginMethod: "local", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: { protocol: "https", headers: {} },
  res: {},
} as TrpcContext;

describe("manutenção administrativa dos pedidos", () => {
  it("mantém a edição de informações do pedido restrita ao administrador", async () => {
    const caller = appRouter.createCaller(regularUserContext);
    await expect(caller.admin.updateOrderInfo({ orderId: 1, customerName: "Cliente", customerPhone: "85999991234" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("mantém anexos e arquivamento de pedidos restritos ao administrador", async () => {
    const caller = appRouter.createCaller(regularUserContext);
    await expect(caller.admin.deleteOrderAttachment({ orderId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.clearOrderNotes({ orderId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.archiveOrder({ orderId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("mantém o registro de estorno restrito ao administrador", async () => {
    const caller = appRouter.createCaller(regularUserContext);
    await expect(caller.admin.markPaymentRefunded({ orderId: 1, reason: "Teste" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
