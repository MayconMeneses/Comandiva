import { beforeEach, describe, expect, it, vi } from "vitest";
import { categories, orderItems, orders, products } from "../drizzle/schema";

// Fake db: cada tabela tem sua própria FILA de resultados — a N-ésima vez que
// uma tabela é consultada devolve o N-ésimo item da fila dela. Reflete a
// ordem real de chamadas em server/db/reports.ts (ex.: `orders` é consultada
// primeiro pro período atual, depois pro período anterior).
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/client", () => ({ getDb: mocks.getDb }));

function fakeDb(queues: Map<unknown, unknown[][]>) {
  const callIndexByTable = new Map<unknown, number>();
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => {
          const index = callIndexByTable.get(table) ?? 0;
          callIndexByTable.set(table, index + 1);
          const queue = queues.get(table) ?? [];
          return queue[index] ?? [];
        },
      }),
    }),
  };
}

const DAY = 24 * 60 * 60 * 1000;
// 2026-09-10 12:00 America/Fortaleza (UTC-3) — meio do dia evita cair no dia
// errado por causa do fuso em qualquer um dos testes.
const T0 = Date.UTC(2026, 8, 10, 15, 0, 0);

describe("getReportsComplete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("agrupa faturamento por forma de pagamento/atendimento e calcula produtos mais vendidos", async () => {
    const currentOrders = [
      { id: 1, createdAt: T0, totalCents: 5000, discountCents: 0, paymentMethod: "PIX", fulfillmentType: "DELIVERY", customerId: 1 },
      { id: 2, createdAt: T0 + 3600_000, totalCents: 3000, discountCents: 0, paymentMethod: "CASH", fulfillmentType: "PICKUP", customerId: 2 },
      { id: 3, createdAt: T0 + 7200_000, totalCents: 2000, discountCents: 0, paymentMethod: null, fulfillmentType: "DINE_IN", customerId: 3 },
    ];
    const previousOrders = [{ id: 99, createdAt: T0 - 5 * DAY, totalCents: 4000, discountCents: 0, paymentMethod: "PIX", fulfillmentType: "DELIVERY", customerId: 9 }];
    const items = [
      { productId: 10, productName: "X-Burguer", quantity: 2, lineTotalCents: 4000 },
      { productId: 10, productName: "X-Burguer", quantity: 1, lineTotalCents: 2000 },
      { productId: 20, productName: "Refrigerante", quantity: 3, lineTotalCents: 1500 },
    ];
    const productRows = [{ id: 10, categoryId: 100 }, { id: 20, categoryId: 200 }];
    const categoryRows = [{ id: 100, name: "Hambúrgueres" }, { id: 200, name: "Bebidas" }];

    mocks.getDb.mockResolvedValue(
      fakeDb(
        new Map<unknown, unknown[][]>([
          [orders, [currentOrders, previousOrders]],
          [orderItems, [items]],
          [products, [productRows]],
          [categories, [categoryRows]],
        ]),
      ),
    );

    const { getReportsComplete } = await import("./db/reports");
    const result = await getReportsComplete(T0 - DAY, T0 + DAY);

    const pixBucket = result.byPaymentMethod.find(entry => entry.method === "PIX");
    expect(pixBucket).toMatchObject({ revenueCents: 5000, orderCount: 1 });
    const tableBucket = result.byPaymentMethod.find(entry => entry.method === "—");
    expect(tableBucket).toMatchObject({ label: "Fechamento de comanda (mesa)", revenueCents: 2000 });

    const dineInBucket = result.byFulfillmentType.find(entry => entry.type === "DINE_IN");
    expect(dineInBucket).toMatchObject({ revenueCents: 2000, orderCount: 1 });

    expect(result.topProducts[0]).toMatchObject({ name: "X-Burguer", quantity: 3, revenueCents: 6000 });
    expect(result.topCategories.find(category => category.name === "Hambúrgueres")).toMatchObject({ revenueCents: 6000 });

    // Faturamento atual (10000) vs anterior (4000) — comparação período-a-período.
    expect(result.comparison.currentRevenueCents).toBe(10000);
    expect(result.comparison.previousRevenueCents).toBe(4000);
    expect(result.comparison.revenueChangePct).toBeCloseTo(150, 5);
  });

  it("sem pedido nenhum no período, devolve zeros em vez de dividir por zero", async () => {
    mocks.getDb.mockResolvedValue(fakeDb(new Map([[orders, [[], []]]])));
    const { getReportsComplete } = await import("./db/reports");
    const result = await getReportsComplete(T0, T0 + DAY);
    expect(result.comparison.currentAvgTicketCents).toBe(0);
    expect(result.comparison.revenueChangePct).toBeNull();
    expect(result.topProducts).toEqual([]);
  });
});

describe("getReportsAdvanced", () => {
  beforeEach(() => vi.clearAllMocks());

  it("classifica cliente novo x recorrente pela data do primeiro pedido em toda a história", async () => {
    const currentOrders = [
      { id: 1, createdAt: T0, totalCents: 5000, discountCents: 500, paymentMethod: "PIX", fulfillmentType: "DELIVERY", customerId: 1 }, // cliente 1: primeiro pedido é este mesmo (novo)
      { id: 2, createdAt: T0 + 1000, totalCents: 3000, discountCents: 0, paymentMethod: "CASH", fulfillmentType: "PICKUP", customerId: 2 }, // cliente 2: já tinha pedido antes (recorrente)
    ];
    const previousOrders: unknown[] = [];
    // getReportsAdvanced consulta `orders` na ordem: atual, anterior, histórico
    // completo dos clientes (pra achar o primeiro pedido de cada um), depois
    // cancelados do período, depois total do período (incluindo cancelados).
    const customerHistory = [
      { customerId: 1, createdAt: T0 }, // único pedido do cliente 1 é o de agora → novo
      { customerId: 2, createdAt: T0 - 10 * DAY }, // cliente 2 já pediu antes → recorrente
      { customerId: 2, createdAt: T0 + 1000 },
    ];
    const cancelledInPeriod = [{ id: 50 }];
    const totalIncludingCancelled = [{ id: 1 }, { id: 2 }, { id: 50 }];

    mocks.getDb.mockResolvedValue(
      fakeDb(
        new Map<unknown, unknown[][]>([
          [orders, [currentOrders, previousOrders, customerHistory, cancelledInPeriod, totalIncludingCancelled]],
          [orderItems, [[], []]],
          [products, [[], []]],
          [categories, [[], []]],
        ]),
      ),
    );

    const { getReportsAdvanced } = await import("./db/reports");
    const result = await getReportsAdvanced(T0, T0 + DAY);

    expect(result.newVsReturning).toMatchObject({ newCustomers: 1, returningCustomers: 1, newRevenueCents: 5000, returningRevenueCents: 3000 });
    expect(result.purchaseFrequency).toMatchObject({ distinctCustomers: 2, totalOrders: 2 });
    expect(result.cancellation).toMatchObject({ cancelledCount: 1, totalOrdersIncludingCancelled: 3 });
    expect(result.cancellation.cancelledRatePct).toBeCloseTo((1 / 3) * 100, 5);
    expect(result.discounts.totalDiscountCents).toBe(500);
    expect(result.discounts.ordersWithDiscountCount).toBe(1);
  });

  it("produto novo (sem venda no período anterior) aparece no TOPO do productTrend, não atrás de quedas grandes", async () => {
    const currentOrders = [{ id: 1, createdAt: T0, totalCents: 400, discountCents: 0, paymentMethod: "PIX", fulfillmentType: "DELIVERY", customerId: 1 }];
    const previousOrders = [{ id: 99, createdAt: T0 - 5 * DAY, totalCents: 1000, discountCents: 0, paymentMethod: "PIX", fulfillmentType: "DELIVERY", customerId: 9 }];
    // Produto 10 vendia bem e caiu -90% (1000 -> 100). Produto 20 é novo:
    // zero venda no período anterior, 300 no atual — mesmo sem "%" calculável
    // (changePct null), é o destaque de crescimento e precisa vir ANTES do
    // produto em queda, não depois.
    const currentItems = [
      { productId: 10, productName: "Produto em Queda", quantity: 1, lineTotalCents: 100 },
      { productId: 20, productName: "Produto Novo", quantity: 1, lineTotalCents: 300 },
    ];
    const previousItems = [{ productId: 10, productName: "Produto em Queda", quantity: 1, lineTotalCents: 1000 }];
    const productRowsCurrent = [{ id: 10, categoryId: 100 }, { id: 20, categoryId: 100 }];
    const productRowsPrevious = [{ id: 10, categoryId: 100 }];
    const categoryRows = [{ id: 100, name: "Categoria" }];
    const customerHistory = [{ customerId: 1, createdAt: T0 }];
    const cancelledInPeriod: unknown[] = [];
    const totalIncludingCancelled = [{ id: 1 }];

    mocks.getDb.mockResolvedValue(
      fakeDb(
        new Map<unknown, unknown[][]>([
          [orders, [currentOrders, previousOrders, customerHistory, cancelledInPeriod, totalIncludingCancelled]],
          [orderItems, [currentItems, previousItems]],
          [products, [productRowsCurrent, productRowsPrevious]],
          [categories, [categoryRows, categoryRows]],
        ]),
      ),
    );

    const { getReportsAdvanced } = await import("./db/reports");
    const result = await getReportsAdvanced(T0, T0 + DAY);

    expect(result.productTrend[0]).toMatchObject({ name: "Produto Novo", changePct: null, currentRevenueCents: 300, previousRevenueCents: 0 });
    expect(result.productTrend[1]).toMatchObject({ name: "Produto em Queda", changePct: -90 });
  });
});

describe("reportsAdvancedToCsv", () => {
  it("serializa cada bloco do relatório avançado em seções CSV, escapando texto com vírgula", async () => {
    const { reportsAdvancedToCsv } = await import("./db/reports");
    const csv = reportsAdvancedToCsv({
      newVsReturning: { newCustomers: 3, returningCustomers: 7, newRevenueCents: 15000, returningRevenueCents: 42000 },
      purchaseFrequency: { averageOrdersPerCustomer: 1.4, distinctCustomers: 10, totalOrders: 14 },
      byWeekday: [{ weekday: 0, label: "Domingo, feriado", revenueCents: 1000, orderCount: 1 }],
      productTrend: [{ productId: "1", name: "X-Tudo", currentRevenueCents: 2000, previousRevenueCents: 1000, changePct: 100 }],
      cancellation: { cancelledCount: 2, totalOrdersIncludingCancelled: 20, cancelledRatePct: 10 },
      discounts: { totalDiscountCents: 500, ordersWithDiscountCount: 3, discountRatePct: 5 },
    });
    expect(csv).toContain("novos,3,15000");
    expect(csv).toContain('"Domingo, feriado",1000,1');
    expect(csv).toContain("X-Tudo,2000,1000,100.0");
    expect(csv).toContain("2,20,10.0");
  });
});
