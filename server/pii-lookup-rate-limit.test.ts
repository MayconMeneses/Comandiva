import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFromIp(ip: string): TrpcContext {
  return { user: null, req: { ip, protocol: "https", headers: {} }, res: {} } as TrpcContext;
}

describe("limite de tentativas em consultas públicas por telefone", () => {
  it("bloqueia customer.lookupByPhone após muitas tentativas do mesmo IP", async () => {
    const ip = "203.0.113.10";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const caller = appRouter.createCaller(contextFromIp(ip));
      await caller.customer.lookupByPhone({ phone: "85999991234" }).catch(() => undefined);
    }
    const caller = appRouter.createCaller(contextFromIp(ip));
    await expect(caller.customer.lookupByPhone({ phone: "85999995678" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  // order.track é consultado automaticamente pela própria página de
  // acompanhamento a cada 15s — o limite precisa ser sobre telefones
  // *diferentes* tentados, nunca sobre repetir o mesmo telefone, senão o
  // cliente acompanhando o próprio pedido acaba bloqueado sozinho.
  it("não bloqueia repetir o mesmo telefone em order.track (auto-atualização da página de acompanhamento)", async () => {
    const ip = "203.0.113.20";
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const caller = appRouter.createCaller(contextFromIp(ip));
      const error = await caller.order.track({ phone: "85999991234" }).catch(caught => caught);
      expect(error).not.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    }
  });

  it("bloqueia order.track ao tentar muitos telefones diferentes vindos do mesmo IP", async () => {
    const ip = "203.0.113.21";
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const caller = appRouter.createCaller(contextFromIp(ip));
      await caller.order.track({ phone: `859999${String(attempt).padStart(5, "0")}` }).catch(() => undefined);
    }
    const caller = appRouter.createCaller(contextFromIp(ip));
    await expect(caller.order.track({ phone: "85988887777" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("não bloqueia telefones distintos vindos de IPs diferentes", async () => {
    const caller = appRouter.createCaller(contextFromIp("198.51.100.1"));
    await expect(caller.customer.lookupByPhone({ phone: "85999991234" })).rejects.not.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
