import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Achado de auditoria: hasRestaurantForContact carregava a tabela
 * restaurants INTEIRA em memória (select().from(restaurants) sem WHERE nem
 * LIMIT) só pra testar um e-mail/telefone com Array.prototype.some — exatamente
 * o mesmo padrão de full table scan que este PR corrigiu em outros pontos, só
 * que aqui bem no caminho crítico de todo cadastro público pago
 * (confirmSignupPaymentAndCreateRestaurant chama isso pra decidir trial).
 * Corrigido: filtra no banco (WHERE lower(trim(email))=... OR trim(phone)=...)
 * e para no primeiro resultado (LIMIT 1).
 */
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), where: vi.fn(), limit: vi.fn(async () => [] as unknown[]) }));
vi.mock("./client", async importOriginal => ({ ...(await importOriginal<object>()), getDb: mocks.getDb }));

import { hasRestaurantForContact } from "./restaurants";

function makeFakeDb() {
  return {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          mocks.where(condition);
          return { limit: mocks.limit };
        },
      }),
    }),
  };
}

describe("hasRestaurantForContact — filtra no banco em vez de carregar a tabela inteira (achado de auditoria)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(makeFakeDb());
  });

  it("nem e-mail nem telefone informados: nunca chega a consultar o banco", async () => {
    const result = await hasRestaurantForContact(undefined, undefined);

    expect(result).toBe(false);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("encontra alguém pelo e-mail: passa por WHERE + LIMIT(1), não busca tudo antes de filtrar em memória", async () => {
    mocks.limit.mockResolvedValueOnce([{ id: 42 }]);

    const result = await hasRestaurantForContact("Dono@Exemplo.com", undefined);

    expect(result).toBe(true);
    // A prova de que isto filtra no banco (e não faz .from(restaurants) sem
    // WHERE, contando com Array.prototype.some depois): a query só é
    // considerada respondida depois de passar por .where(...).limit(1).
    expect(mocks.where).toHaveBeenCalledTimes(1);
    expect(mocks.limit).toHaveBeenCalledWith(1);
  });

  it("ninguém bate: false, sem trazer nenhuma linha extra pra filtrar depois", async () => {
    const result = await hasRestaurantForContact("ninguem@exemplo.com", "85999990000");

    expect(result).toBe(false);
    expect(mocks.where).toHaveBeenCalledTimes(1);
    expect(mocks.limit).toHaveBeenCalledWith(1);
  });
});
