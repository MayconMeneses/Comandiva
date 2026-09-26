import { beforeEach, describe, expect, it, vi } from "vitest";

// A suíte de server/mercadopago-webhook.test.ts sempre mocka
// markWebhookEventOnce inteiro — nenhum teste do repositório exercitava a
// lógica real (insert + catch de ER_DUP_ENTRY da unique constraint). Este
// arquivo testa server/payments/repositories/webhookEvents.ts diretamente,
// contra uma unique constraint simulada.
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../../db", () => ({ getDb: mocks.getDb }));

import { markWebhookEventOnce } from "./webhookEvents";

function dbWithUniqueConstraint() {
  const seen = new Set<string>();
  return {
    insert: () => ({
      values: async (row: { gateway: string; eventKey: string }) => {
        const key = `${row.gateway}:${row.eventKey}`;
        if (seen.has(key)) {
          // Formato real do drizzle-orm 0.45.x: o `code` do driver mysql2 vem
          // em `error.cause`, não no erro em si (confirmado rodando contra
          // MySQL de verdade — ver server/order-idempotency-real-db.test.ts).
          // Um mock com `error.code` direto (formato antigo deste teste)
          // deixava passar um bug real: markWebhookEventOnce nunca detectava
          // duplicata de verdade, então todo webhook duplicado do Mercado
          // Pago lançava um erro cru em vez de ser ignorado graciosamente.
          const error = new Error("Duplicate entry") as Error & { cause?: { code: string } };
          error.cause = { code: "ER_DUP_ENTRY" };
          throw error;
        }
        seen.add(key);
      },
    }),
  };
}

describe("markWebhookEventOnce", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("primeira vez com essa chave: insere e reporta alreadyProcessed:false", async () => {
    mocks.getDb.mockResolvedValue(dbWithUniqueConstraint());
    await expect(markWebhookEventOnce("MERCADO_PAGO", "payment:123:PAID")).resolves.toEqual({ alreadyProcessed: false });
  });

  it("mesma chave (gateway + eventKey) de novo: reporta alreadyProcessed:true, sem lançar", async () => {
    const db = dbWithUniqueConstraint();
    mocks.getDb.mockResolvedValue(db);
    await markWebhookEventOnce("MERCADO_PAGO", "payment:123:PAID");
    await expect(markWebhookEventOnce("MERCADO_PAGO", "payment:123:PAID")).resolves.toEqual({ alreadyProcessed: true });
  });

  it("mesmo eventKey em gateway diferente não é tratado como duplicata", async () => {
    const db = dbWithUniqueConstraint();
    mocks.getDb.mockResolvedValue(db);
    await markWebhookEventOnce("MERCADO_PAGO", "payment:123:PAID");
    await expect(markWebhookEventOnce("OUTRO_GATEWAY", "payment:123:PAID")).resolves.toEqual({ alreadyProcessed: false });
  });

  it("o mesmo id de pagamento com status diferente (pending→approved→refunded) não é tratado como duplicata", async () => {
    const db = dbWithUniqueConstraint();
    mocks.getDb.mockResolvedValue(db);
    await markWebhookEventOnce("MERCADO_PAGO", "payment:123:PAID");
    await expect(markWebhookEventOnce("MERCADO_PAGO", "payment:123:REFUNDED")).resolves.toEqual({ alreadyProcessed: false });
  });

  it("erro de banco que não é de duplicidade sobe normalmente (não é engolido como se fosse duplicata)", async () => {
    mocks.getDb.mockResolvedValue({
      insert: () => ({
        values: async () => {
          throw new Error("conexão com o banco perdida");
        },
      }),
    });
    await expect(markWebhookEventOnce("MERCADO_PAGO", "payment:123:PAID")).rejects.toThrow("conexão com o banco perdida");
  });

  it("aceita um `tx` opcional em vez de chamar getDb() de novo — participa de uma transação externa", async () => {
    const tx = dbWithUniqueConstraint();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await markWebhookEventOnce("MERCADO_PAGO", "payment:123:PAID", tx as any);
    expect(result).toEqual({ alreadyProcessed: false });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
});
