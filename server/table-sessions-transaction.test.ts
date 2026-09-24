import { beforeEach, describe, expect, it, vi } from "vitest";
import { restaurantTables, tableSessions } from "../drizzle/schema";
import { getOrOpenSessionForTable } from "./db/tableSessions";

/**
 * Prova que getOrOpenSessionForTable (server/db/tableSessions.ts) agora abre
 * a comanda + ocupa a mesa dentro de uma única db.transaction — antes eram 2
 * escritas soltas (INSERT table_sessions + UPDATE restaurant_tables), então
 * uma falha entre elas podia deixar uma comanda aberta sem a mesa marcada
 * OCCUPIED (ou vice-versa). Fortalecimento pré-offline (Fase 1).
 *
 * Fase 4 (auditoria de corrida em mais mutations, depois de updateOrderStatus):
 * getOrOpenSessionForTable agora TAMBÉM trava a linha da mesa
 * (lockTableRow/FOR UPDATE) antes de checar "já tem comanda aberta?" — sem
 * isso, duas chamadas quase simultâneas (dois celulares escaneando o QR da
 * mesma mesa) liam "nenhuma aberta" ao mesmo tempo e abriam DUAS comandas
 * pra mesma mesa, dividindo os pedidos (uma ficava órfã, nunca cobrada). O
 * mock aqui só prova a ORDEM/lógica (trava antes de checar, mesma ressalva
 * de plan-limits.test.ts: o lock de verdade é garantia do MySQL) — quem
 * prova o lock contra um banco real é table-sessions-lock-real-db.test.ts.
 */
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/client", () => ({ getDb: mocks.getDb }));

type Call = { kind: "insert" | "update" | "lock"; table: unknown; payload: unknown };

function makeFakeDb(options: { openSession?: Record<string, unknown> | undefined; failAtCall?: number } = {}) {
  const calls: Call[] = [];
  let writeCount = 0;
  const createdSession = { id: 42, tableId: 1, status: "OPEN", partySize: null, openedAt: 1000, createdAt: 1000, updatedAt: 1000 };

  function queryable() {
    return {
      // findOpenSessionForTable (via .orderBy().limit()) e o SELECT final
      // dentro da transação (via .limit() bare) usam a mesma forma de
      // encadeamento — devolve a sessão já aberta (se configurada) ou a
      // recém-criada. .limit() também precisa suportar .for("update")
      // encadeado (lockTableRow) — por isso devolve algo "thenable" (funciona
      // com await direto) E com .for() (registra a chamada de lock, sem
      // afetar o restante do fluxo).
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: async () => (options.openSession ? [options.openSession] : []) }),
            limit: () => {
              const rows = [createdSession];
              return {
                for: async () => { calls.push({ kind: "lock", table: restaurantTables, payload: undefined }); return rows; },
                then: (resolve: (value: unknown) => void, reject?: (error: unknown) => void) => Promise.resolve(rows).then(resolve, reject),
              };
            },
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

  it("já existe sessão aberta: trava a mesa, confirma, devolve ela direto sem escrever nada (sem regressão no caminho idempotente)", async () => {
    const stub = makeFakeDb({ openSession: { id: 7, tableId: 1, status: "OPEN" } });
    mocks.getDb.mockResolvedValue(stub.db);

    const session = await getOrOpenSessionForTable(1);

    expect(session).toEqual({ id: 7, tableId: 1, status: "OPEN" });
    // A trava acontece (mutex), mas nenhuma escrita — o único efeito é ler.
    expect(stub.calls.map(call => call.kind)).toEqual(["lock"]);
  });

  it("caminho feliz: trava a mesa ANTES de checar/abrir a comanda, abre e ocupa a mesa na mesma transação", async () => {
    const stub = makeFakeDb();
    mocks.getDb.mockResolvedValue(stub.db);

    const session = await getOrOpenSessionForTable(1, 4);

    expect(session).toMatchObject({ id: 42 });
    expect(stub.calls.map(call => ({ kind: call.kind, table: call.table }))).toEqual([
      { kind: "lock", table: restaurantTables },
      { kind: "insert", table: tableSessions },
      { kind: "update", table: restaurantTables },
    ]);
  });

  it("falha ao ocupar a mesa (2ª escrita) rejeita a função inteira — não sobra comanda aberta sem a mesa marcada", async () => {
    const stub = makeFakeDb({ failAtCall: 2 });
    mocks.getDb.mockResolvedValue(stub.db);

    await expect(getOrOpenSessionForTable(1)).rejects.toThrow("falha simulada");
    // A trava (lock) + só a 1ª escrita (insert da comanda) chegaram a ser
    // registradas pelo fake — o ponto é que, com db.transaction de verdade,
    // o MySQL desfaz esse insert junto no rollback; aqui provamos que o ERRO
    // se propaga (não é engolido) e a função nunca devolve uma sessão "de
    // sucesso".
    expect(stub.calls.map(call => call.kind)).toEqual(["lock", "insert"]);
  });
});
