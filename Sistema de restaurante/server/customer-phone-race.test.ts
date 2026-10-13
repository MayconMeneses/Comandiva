import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Achado M2 da auditoria: saveCustomerProfile fazia check-then-act sem tratar
 * a corrida (customers.phone tem unique index) — dois checkouts quase
 * simultâneos pro mesmo telefone (duplo clique, duas abas) podiam colidir no
 * insert, e o erro cru de banco (ER_DUP_ENTRY) subia sem tratamento até o
 * cliente final, em vez de reaproveitar o registro que o outro acabou de
 * criar. Mesmo padrão de tratamento já usado em insertPricedOrder
 * (server/routers/order.ts).
 */
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/client", () => ({ getDb: mocks.getDb }));

import { saveCustomerProfile } from "./db/customers";

const DUP_ENTRY_ERROR = Object.assign(new Error("Duplicate entry"), { cause: { code: "ER_DUP_ENTRY" } });

function dbStub() {
  let selectCallCount = 0;
  const updateSet = vi.fn(() => ({ where: vi.fn() }));
  const insertValues = vi.fn().mockRejectedValue(DUP_ENTRY_ERROR);
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          // getCustomerByPhone chama isto (select from customers .where .limit) —
          // 1ª vez (antes do insert): telefone ainda não existe. 2ª vez (depois
          // do ER_DUP_ENTRY, buscando quem venceu a corrida): já existe.
          limit: async () => {
            selectCallCount++;
            if (selectCallCount === 1) return [];
            return [{ id: 42, phone: "85999991234", name: "Quem Chegou Primeiro", createdAt: 0, updatedAt: 0 }];
          },
          // getCustomerByPhone também consulta customerAddresses depois de achar
          // o cliente — sem where/limit encadeado dessa vez, direto orderBy.
          orderBy: async () => [],
        }),
      }),
    }),
    insert: () => ({ values: insertValues }),
    update: () => ({ set: updateSet }),
    updateSet,
    insertValues,
  };
}

describe("saveCustomerProfile — corrida de criação por telefone (ER_DUP_ENTRY)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("quando o insert colide (outro checkout venceu a corrida), reaproveita o cliente existente em vez de propagar o erro cru", async () => {
    const db = dbStub();
    mocks.getDb.mockResolvedValue(db);

    const result = await saveCustomerProfile({ phone: "85999991234", name: "Cliente Novo" });

    expect(result).toMatchObject({ id: 42 });
    // Reaproveitou o registro do vencedor da corrida (update, não insert de novo).
    expect(db.updateSet).toHaveBeenCalledWith(expect.objectContaining({ name: "Cliente Novo" }));
  });

  it("um erro de banco que NÃO é ER_DUP_ENTRY continua propagando normalmente (não vira reaproveitamento silencioso de qualquer falha)", async () => {
    const db = dbStub();
    db.insertValues.mockRejectedValue(new Error("conexão perdida"));
    mocks.getDb.mockResolvedValue(db);

    await expect(saveCustomerProfile({ phone: "85999991234", name: "Cliente Novo" })).rejects.toThrow("conexão perdida");
  });
});
