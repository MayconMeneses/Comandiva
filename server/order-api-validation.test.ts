import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { checkoutSchema } from "./routers/order";

const publicContext = {
  user: null,
  req: { protocol: "https", headers: {} },
  res: {},
} as TrpcContext;

describe("API de criação de pedidos", () => {
  it("rejeita um pedido sem itens antes de tentar consultar o banco", async () => {
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.order.create({
      items: [],
      fulfillmentType: "PICKUP",
      paymentMethod: "PIX",
      customer: { name: "Cliente", phone: "85999991234" },
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejeita telefone inválido antes de consultar pedidos em andamento", async () => {
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.order.track({ phone: "123" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("aceita telefone com DDD para a consulta de pedidos em andamento", async () => {
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.order.track({ phone: "(85) 99999-9999" })).rejects.not.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("aceita uma rota de entrega válida no contrato do checkout", () => {
    const result = checkoutSchema.safeParse({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentType: "DELIVERY",
      paymentMethod: "PIX",
      customer: { name: "Cliente", phone: "85999991234" },
      deliveryRouteId: 1,
      address: { street: "Rua Principal", number: "100", neighborhood: "Centro", city: "Fortaleza", state: "CE" },
    });
    expect(result.success).toBe(true);
  });

  it("rejeita identificador de rota inválido antes de calcular o pedido", () => {
    const result = checkoutSchema.safeParse({
      items: [{ productId: 1, quantity: 1 }],
      fulfillmentType: "DELIVERY",
      paymentMethod: "PIX",
      customer: { name: "Cliente", phone: "85999991234" },
      deliveryRouteId: 0,
      address: { street: "Rua Principal", number: "100", neighborhood: "Centro", city: "Fortaleza", state: "CE" },
    });
    expect(result.success).toBe(false);
  });

  it("aplica rate limit em order.create por IP — a 41ª tentativa em pouco tempo é rejeitada", async () => {
    const context = { user: null, req: { ip: "203.0.113.77", protocol: "https", headers: {} }, res: {} } as TrpcContext;
    // Precisa passar na validação do Zod (fora do controle do rate limit) pra
    // chegar no resolver — o produto inexistente falha depois, dentro do
    // handler, o que já é o suficiente pra provar que o rate limit foi consultado.
    const input = { items: [{ productId: 999999, quantity: 1 }], fulfillmentType: "PICKUP" as const, paymentMethod: "PIX" as const, customer: { name: "Cliente", phone: "85999991234" } };
    // 40 é o limite real do endpoint (subiu do padrão de força bruta de 8 na
    // auditoria de escalabilidade 2026-09-19 — muitos clientes legítimos
    // atrás do mesmo IP em horário de pico não podem ser barrados como
    // abuso, ver order.ts).
    for (let attempt = 0; attempt < 40; attempt++) {
      const caller = appRouter.createCaller(context);
      await caller.order.create(input).catch(() => {});
    }
    await expect(appRouter.createCaller(context).order.create(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("aplica rate limit em order.createCardPayment por IP — a 9ª tentativa em pouco tempo é rejeitada", async () => {
    const context = { user: null, req: { ip: "203.0.113.78", protocol: "https", headers: {} }, res: {} } as TrpcContext;
    // publicCode + customerPhone (não mais orderId cru) — precisa passar na
    // validação do Zod pra chegar no resolver; o pedido inexistente falha
    // depois, dentro do handler, o que já é suficiente pra provar que o rate
    // limit foi consultado.
    const input = { publicCode: "PX-0000000", customerPhone: "85999991234" };
    for (let attempt = 0; attempt < 8; attempt++) {
      const caller = appRouter.createCaller(context);
      await caller.order.createCardPayment(input).catch(() => {});
    }
    await expect(appRouter.createCaller(context).order.createCardPayment(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
