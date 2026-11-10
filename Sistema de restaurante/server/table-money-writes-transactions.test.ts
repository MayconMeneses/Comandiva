import { beforeEach, describe, expect, it, vi } from "vitest";

// Sem banco real e sem alertas/Telegram: tudo é mockado (getDb) e nenhum módulo
// de alerta é importado por estes caminhos.
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/client", () => ({ getDb: mocks.getDb }));

import { recordBillPayment } from "./db/tableSessions";
import { createServiceRequest } from "./db/tableServiceRequests";

/** Fake de db: select() consome a fila de resultados na ordem; registra transação, insert e travas (.for). */
function makeDb(selectResults: unknown[][]) {
  const queue = [...selectResults];
  const log = { transactions: 0, inserts: [] as unknown[], locks: 0, txSelectsBeforeInsert: 0 };
  const makeSelect = (insideTx: boolean) => () => {
    const result = queue.shift() ?? [];
    const chain: Record<string, unknown> = {};
    for (const name of ["from", "where", "orderBy", "limit"]) chain[name] = () => chain;
    chain.for = () => { log.locks++; return chain; };
    chain.then = (resolve: (v: unknown) => void) => resolve(result);
    void insideTx;
    return chain;
  };
  const tx = {
    select: makeSelect(true),
    insert: () => ({ values: async (v: unknown) => { log.inserts.push(v); return [{ insertId: 77 }]; } }),
  };
  const db = {
    select: makeSelect(false),
    transaction: async (fn: (t: typeof tx) => Promise<unknown>) => { log.transactions++; return fn(tx); },
  };
  return { db, log };
}

beforeEach(() => vi.clearAllMocks());

describe("recordBillPayment — comanda precisa estar aberta", () => {
  const input = { method: "PIX" as const, amountCents: 1000, clientOperationId: "op-12345678" };

  it("recusa pagamento em comanda fechada ou cancelada, sem inserir nada", async () => {
    for (const status of ["CLOSED", "CANCELLED"]) {
      // select 1: mesa da comanda; 2: trava da mesa; 3: duplicado (nenhum); 4: status da comanda
      const { db, log } = makeDb([[{ tableId: 3 }], [{ id: 3 }], [], [{ status }]]);
      mocks.getDb.mockResolvedValue(db);
      await expect(recordBillPayment(10, input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(log.inserts).toHaveLength(0);
      expect(log.transactions).toBe(1);
    }
  });

  it("aceita em OPEN e AWAITING_PAYMENT, dentro de transação com a mesa travada", async () => {
    for (const status of ["OPEN", "AWAITING_PAYMENT"]) {
      const { db, log } = makeDb([[{ tableId: 3 }], [{ id: 3 }], [], [{ status }]]);
      mocks.getDb.mockResolvedValue(db);
      await recordBillPayment(10, input);
      expect(log.inserts).toHaveLength(1);
      expect(log.locks).toBe(1);
    }
  });

  it("retry com o mesmo operationId vira sucesso sem inserir, mesmo com a comanda já fechada", async () => {
    const { db, log } = makeDb([[{ tableId: 3 }], [{ id: 3 }], [{ id: 5 }]]);
    mocks.getDb.mockResolvedValue(db);
    await expect(recordBillPayment(10, input)).resolves.toBeUndefined();
    expect(log.inserts).toHaveLength(0);
  });

  it("comanda inexistente: NOT_FOUND", async () => {
    const { db } = makeDb([[]]);
    mocks.getDb.mockResolvedValue(db);
    await expect(recordBillPayment(10, input)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("createServiceRequest — check-then-insert sob trava da mesa", () => {
  it("cria o chamado dentro de transação com a mesa travada", async () => {
    // 1: mesa da comanda; 2: trava; 3: pendente existente (nenhum)
    const { db, log } = makeDb([[{ tableId: 3 }], [{ id: 3 }], []]);
    mocks.getDb.mockResolvedValue(db);
    await expect(createServiceRequest(10)).resolves.toBe(77);
    expect(log.transactions).toBe(1);
    expect(log.locks).toBe(1);
    expect(log.inserts).toHaveLength(1);
  });

  it("devolve o chamado pendente existente sem inserir outro", async () => {
    const { db, log } = makeDb([[{ tableId: 3 }], [{ id: 3 }], [{ id: 41 }]]);
    mocks.getDb.mockResolvedValue(db);
    await expect(createServiceRequest(10)).resolves.toBe(41);
    expect(log.inserts).toHaveLength(0);
  });
});
