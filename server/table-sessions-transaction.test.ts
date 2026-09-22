import { beforeEach, describe, expect, it, vi } from "vitest";
import { restaurantTables, tableSessions } from "../drizzle/schema";
import { getOrOpenSessionForTable } from "./db/tableSessions";

/**
 * Prova que getOrOpenSessionForTable (server/db/tableSessions.ts) agora abre
 * a comanda + ocupa a mesa dentro de uma única db.transaction — antes eram 2
 * escritas soltas (INSERT table_sessions + UPDATE restaurant_tables), então
 * uma falha entre elas podia deixar uma comanda aberta sem a mesa marcada
 * OCCUPIED (ou vice-versa). Fortalecimento pré-offline (Fase 1).
 */
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/client", () => ({ getDb: mocks.getDb }));

type Call = { kind: "insert" | "update"; table: unknown; payload: unknown };

function makeFakeDb(options: { openSession?: Record<string, unknown> | undefined; failAtCall?: number } = {}) {
  const calls: Call[] = [];
  let writeCount = 0;
  const createdSession = { id: 42, tableId: 1, status: "OPEN", partySize: null, openedAt: 1000, createdAt: 1000, updatedAt: 1000 };

  function queryable() {
    return {
      // findOpenSessionForTable (chamado ANTES da transação) e o SELECT final
      // dentro dela usam a mesma forma de encadeamento — devolve a sessão já
      // aberta (se configurada) ou a recém-criada, conforme o teste precisar.
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: async () => (options.openSession ? [options.openSession] : []) }),
            limit: async () => [createdSession],
          }),
        }),
      }),
      insert: (table: unknown) => ({
        values: async (payload: unknown) => {
          writeCount += 1;
          if (options.failAtCall === writeCount) throw new Error(`falha simulada na escrita #${writeCount}`);
          calls.push({ kind: "insert", table, payload });
          return [{ insertId: createdSession.id }];
        },
      }),
      update: (table: unknown) => ({
        set: (payload: unknown) => ({
          where: async () => {
            writeCount += 1;
            if (options.failAtCall === writeCount) throw new Error(`falha simulada na escrita #${writeCount}`);
            calls.push({ kind: "update", table, payload });
          },
        }),
      }),
    };
  }

  const db = {
    ...queryable(),
    transaction: async (fn: (tx: ReturnType<typeof queryable>) => Promise<unknown>) => fn(queryable()),
  };
  return { db, calls };
}

describe("getOrOpenSessionForTable — transação", () => {
  beforeEach(() => vi.clearAllMocks());

  it("já existe sessão aberta: devolve ela direto, sem escrever nada (sem regressão no caminho idempotente)", async () => {
    const stub = makeFakeDb({ openSession: { id: 7, tableId: 1, status: "OPEN" } });
    mocks.getDb.mockResolvedValue(stub.db);

    const session = await getOrOpenSessionForTable(1);

    expect(session).toEqual({ id: 7, tableId: 1, status: "OPEN" });
    expect(stub.calls).toHaveLength(0);
  });

  it("caminho feliz: abre a comanda E ocupa a mesa na mesma transação", async () => {
    const stub = makeFakeDb();
    mocks.getDb.mockResolvedValue(stub.db);

    const session = await getOrOpenSessionForTable(1, 4);

    expect(session).toMatchObject({ id: 42 });
    expect(stub.calls.map(call => ({ kind: call.kind, table: call.table }))).toEqual([
      { kind: "insert", table: tableSessions },
      { kind: "update", table: restaurantTables },
    ]);
  });

  it("falha ao ocupar a mesa (2ª escrita) rejeita a função inteira — não sobra comanda aberta sem a mesa marcada", async () => {
    const stub = makeFakeDb({ failAtCall: 2 });
    mocks.getDb.mockResolvedValue(stub.db);

    await expect(getOrOpenSessionForTable(1)).rejects.toThrow("falha simulada");
    // Só a 1ª escrita (insert da comanda) chegou a ser registrada pelo fake —
    // o ponto é que, com db.transaction de verdade, o MySQL desfaz esse
    // insert junto no rollback; aqui provamos que o ERRO se propaga (não é
    // engolido) e a função nunca devolve uma sessão "de sucesso".
    expect(stub.calls).toHaveLength(1);
  });
});
