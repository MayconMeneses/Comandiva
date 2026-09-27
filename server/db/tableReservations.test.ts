import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, gte } from "drizzle-orm";
import { tableReservations } from "../../drizzle/schema";

/**
 * Achado de auditoria: sem fromAt/toAt (a única forma que o admin chama
 * isso, ver ReservationsManager.tsx), a query não tinha piso de data e
 * ordenava ASCENDENTE limitando a 500 linhas — como a tabela nunca é
 * arquivada, depois que o restaurante acumula mais de 500 reservas no
 * histórico, a tela do admin passava a mostrar só reservas PASSADAS,
 * escondendo TODAS as futuras, sem erro nenhum (risco de overbooking
 * silencioso). Corrigido: sem fromAt explícito, aplica um piso de "agora
 * menos 24h" em vez de nenhum piso.
 */
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), where: vi.fn(), limit: vi.fn(async () => []) }));
vi.mock("./client", () => ({ getDb: mocks.getDb }));

import { listReservations } from "./tableReservations";

function makeFakeDb() {
  return {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          mocks.where(condition);
          return { orderBy: () => ({ limit: mocks.limit }) };
        },
      }),
    }),
  };
}

describe("listReservations — reservas futuras nunca somem por causa do histórico acumulado (achado de auditoria)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(makeFakeDb());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T12:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("sem filtro nenhum: aplica piso de 24h atrás em vez de buscar a tabela sem fronteira de data", async () => {
    await listReservations();

    const expectedFloor = Date.now() - 24 * 60 * 60 * 1000;
    expect(mocks.where).toHaveBeenCalledWith(and(gte(tableReservations.reservedFor, expectedFloor)));
    // Sem período explícito, mantém o teto mais apertado (500) — só o piso mudou.
    expect(mocks.limit).toHaveBeenCalledWith(500);
  });

  it("com fromAt explícito: usa o valor pedido (não o piso automático) e o teto maior de período explícito", async () => {
    await listReservations({ fromAt: 1000 });

    expect(mocks.where).toHaveBeenCalledWith(and(gte(tableReservations.reservedFor, 1000)));
    expect(mocks.limit).toHaveBeenCalledWith(2000);
  });
});
