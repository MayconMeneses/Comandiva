import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFiscalCredentialsForEmission: vi.fn(),
  getOrderWithDetails: vi.fn(),
  getSessionWithOrders: vi.fn(),
}));

vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  getFiscalCredentialsForEmission: mocks.getFiscalCredentialsForEmission,
  getOrderWithDetails: mocks.getOrderWithDetails,
  getSessionWithOrders: mocks.getSessionWithOrders,
}));

import { fiscalDocuments, fiscalTaxCategories, products } from "../drizzle/schema";
import { emitNfceForOrder, emitNfceForTableSession } from "./_core/nfceEmission";

const CREDENTIALS = { certificateBase64: "cert", certificatePassword: "pw", providerApiToken: "token-abc", cnpj: "12345678000199", inscricaoEstadual: "123", regimeTributario: "SIMPLES_NACIONAL", environment: "HOMOLOGACAO" as const, nfceSeries: 1 };

const CATEGORY = { id: 1, name: "Padrão", notes: null, csosn: "102", cst: null, icmsRateBasisPoints: null, pisRateBasisPoints: null, cofinsRateBasisPoints: null, cfop: "5102", active: true, createdAt: 0, updatedAt: 0 };

function product(overrides: Partial<typeof products.$inferSelect> = {}) {
  return { id: 1, categoryId: 1, name: "X-Bacon", description: null, imageUrl: null, priceCents: 1500, preparationMinutes: 20, available: true, featured: false, onPromotion: false, sortOrder: 0, ncm: "21069090", fiscalCategoryId: 1, archivedAt: null, createdAt: 0, updatedAt: 0, ...overrides };
}

function orderItem(overrides: Partial<{ productId: number | null; productName: string; quantity: number; unitPriceCents: number; addons: { addonOptionName: string }[] }> = {}) {
  return { id: 1, orderId: 1, productId: 1, productName: "X-Bacon", quantity: 1, unitPriceCents: 1500, lineTotalCents: 1500, note: null, addons: [], ...overrides };
}

function order(overrides: Record<string, unknown> = {}) {
  return { id: 1, status: "OUT_FOR_DELIVERY", fulfillmentType: "DELIVERY", customerName: "Ana", paymentMethod: "CASH", totalCents: 1500, items: [orderItem()], ...overrides };
}

/** Stub de banco dispatched por tabela — mesmo padrão já usado nos outros arquivos de teste do projeto (ver trial-expiry.test.ts do saas-core). */
function buildDbStub(options: { existingDocument?: Record<string, unknown> | null; productRows?: Record<string, unknown>[]; categoryRows?: Record<string, unknown>[] } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const productRows = options.productRows ?? [product()];
  const categoryRows = options.categoryRows ?? [CATEGORY];
  const db = {
    select() {
      return {
        from(table: unknown) {
          const chain = {
            where: () => chain,
            limit: async () => {
              if (table === fiscalDocuments) return options.existingDocument ? [options.existingDocument] : [];
              if (table === products) return productRows;
              if (table === fiscalTaxCategories) return categoryRows;
              return [];
            },
            then: (resolve: (value: unknown[]) => void) => {
              if (table === products) return Promise.resolve(productRows).then(resolve);
              if (table === fiscalTaxCategories) return Promise.resolve(categoryRows).then(resolve);
              return Promise.resolve([]).then(resolve);
            },
          };
          return chain;
        },
      };
    },
    insert: () => ({ values: async (values: Record<string, unknown>) => { inserts.push(values); return [{ insertId: inserts.length }]; } }),
    update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => { updates.push(values); } }) }),
  };
  return { db, inserts, updates };
}

vi.mock("./db/client", async importOriginal => ({
  ...(await importOriginal<typeof import("./db/client")>()),
  getDb: vi.fn(),
}));
import { getDb } from "./db/client";

describe("nfceEmission — emitNfceForOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFiscalCredentialsForEmission.mockResolvedValue(CREDENTIALS);
  });

  it("nota autorizada: reserva a linha (PENDING) antes do provedor, depois grava chaveAcesso/danfeUrl/qrCodeUrl com status AUTHORIZED", async () => {
    mocks.getOrderWithDetails.mockResolvedValue(order());
    const stub = buildDbStub();
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "autorizado", chave_nfe: "chave-123", numero: "1", serie: "1", caminho_danfe: "https://focusnfe/danfe.pdf", qrcode_url: "https://focusnfe/qr" }) }));

    await emitNfceForOrder(1);

    // Sem nota anterior, o 1º INSERT é a reserva da linha (status PENDING,
    // achado de revisão — ver comentário em nfceEmission.ts::emit), ANTES de
    // chamar o provedor; o resultado real chega depois, por UPDATE.
    expect(stub.inserts).toHaveLength(1);
    expect(stub.inserts[0]).toMatchObject({ status: "PENDING" });
    expect(stub.updates).toHaveLength(1);
    expect(stub.updates[0]).toMatchObject({ status: "AUTHORIZED", chaveAcesso: "chave-123", danfeUrl: "https://focusnfe/danfe.pdf", qrCodeUrl: "https://focusnfe/qr" });
    vi.unstubAllGlobals();
  });

  it("nota rejeitada pela SEFAZ: grava status REJECTED com o motivo, sem lançar erro", async () => {
    mocks.getOrderWithDetails.mockResolvedValue(order());
    const stub = buildDbStub();
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "erro_autorizacao", mensagem_sefaz: "CNPJ do emitente não habilitado" }) }));

    await expect(emitNfceForOrder(1)).resolves.toBeUndefined();

    expect(stub.updates[0]).toMatchObject({ status: "REJECTED", rejectionReason: "CNPJ do emitente não habilitado" });
    vi.unstubAllGlobals();
  });

  it("produto sem categoria fiscal bloqueia a emissão SEM chamar a API do provedor", async () => {
    mocks.getOrderWithDetails.mockResolvedValue(order());
    const stub = buildDbStub({ productRows: [product({ fiscalCategoryId: null })] });
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await emitNfceForOrder(1);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(stub.updates[0]).toMatchObject({ status: "ERROR" });
    expect(String(stub.updates[0].rejectionReason)).toContain("X-Bacon");
    vi.unstubAllGlobals();
  });

  it("produto sem NCM bloqueia a emissão SEM chamar a API do provedor", async () => {
    mocks.getOrderWithDetails.mockResolvedValue(order());
    const stub = buildDbStub({ productRows: [product({ ncm: null })] });
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await emitNfceForOrder(1);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(stub.updates[0]).toMatchObject({ status: "ERROR" });
    vi.unstubAllGlobals();
  });

  it("provedor fora do ar (fetch lança): grava status ERROR e NUNCA propaga o erro pra quem chamou", async () => {
    mocks.getOrderWithDetails.mockResolvedValue(order());
    const stub = buildDbStub();
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(emitNfceForOrder(1)).resolves.toBeUndefined();

    expect(stub.updates[0]).toMatchObject({ status: "ERROR" });
    vi.unstubAllGlobals();
  });

  it("duas emissões de primeira vez pro MESMO pedido ao mesmo tempo: só uma chama o provedor, a outra desiste sem lançar erro (achado de revisão)", async () => {
    mocks.getOrderWithDetails.mockResolvedValue(order());
    // As duas chamadas veem "nenhuma nota ainda" (existingDocument nulo,
    // padrão de buildDbStub) — exatamente o cenário da corrida: o gatilho
    // automático e o botão manual "Tentar emitir de novo" quase juntos,
    // antes de qualquer um dos dois ter reservado a linha.
    const stub = buildDbStub();
    let insertAttempts = 0;
    const realInsert = stub.db.insert;
    stub.db.insert = ((table: unknown) => {
      const real = realInsert(table);
      return {
        values: async (values: Record<string, unknown>) => {
          insertAttempts++;
          if (insertAttempts > 1) {
            const error = new Error("Duplicate entry for key 'fiscal_documents_order_unique'") as Error & { cause?: { code?: string } };
            error.cause = { code: "ER_DUP_ENTRY" };
            throw error;
          }
          return real.values(values);
        },
      };
    }) as typeof stub.db.insert;
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "autorizado", chave_nfe: "chave-123" }) });
    vi.stubGlobal("fetch", fetchMock);

    // Promise.all (não sequencial) — se a segunda chamada lançasse sem
    // tratamento (o bug original), isto rejeitaria e o teste falharia.
    await expect(Promise.all([emitNfceForOrder(1), emitNfceForOrder(1)])).resolves.toBeDefined();

    expect(fetchMock).toHaveBeenCalledTimes(1); // nunca duas notas reais autorizadas pro mesmo pedido
    vi.unstubAllGlobals();
  });

  it("já autorizada anteriormente: não emite de novo (idempotente)", async () => {
    mocks.getOrderWithDetails.mockResolvedValue(order());
    const stub = buildDbStub({ existingDocument: { id: 9, orderId: 1, status: "AUTHORIZED" } });
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await emitNfceForOrder(1);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(stub.inserts).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it("pedido cancelado: não tenta emitir", async () => {
    mocks.getOrderWithDetails.mockResolvedValue(order({ status: "CANCELLED" }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await emitNfceForOrder(1);

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("nfceEmission — emitNfceForTableSession (consolidação de mesa)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFiscalCredentialsForEmission.mockResolvedValue(CREDENTIALS);
  });

  it("consolida os itens de 2 pedidos (rodadas) da mesma comanda numa única nota", async () => {
    const round1 = order({ id: 10, items: [orderItem({ productId: 1, quantity: 1 })] });
    const round2 = order({ id: 11, items: [orderItem({ productId: 1, quantity: 2 })] });
    mocks.getSessionWithOrders.mockResolvedValue({ session: { id: 5 }, orders: [round1, round2], totalCents: 4500 });
    const stub = buildDbStub();
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    let capturedBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string);
        return { ok: true, json: async () => ({ status: "autorizado", chave_nfe: "chave-mesa", numero: "2", serie: "1" }) };
      }),
    );

    await emitNfceForTableSession(5);

    expect(capturedBody?.items).toHaveLength(2); // 1 item por rodada, não 1 nota por rodada
    expect(stub.inserts).toHaveLength(1); // uma única linha em fiscal_documents (a reserva PENDING)
    expect(stub.updates[0]).toMatchObject({ tableSessionId: 5, status: "AUTHORIZED" });
    expect(JSON.parse(String(stub.updates[0].consolidatedOrderIds))).toEqual([10, 11]);
    vi.unstubAllGlobals();
  });

  it("rodada cancelada não entra na nota consolidada", async () => {
    const round1 = order({ id: 10, items: [orderItem({ productId: 1, quantity: 1 })] });
    const cancelledRound = order({ id: 11, status: "CANCELLED", items: [orderItem({ productId: 1, quantity: 5 })] });
    mocks.getSessionWithOrders.mockResolvedValue({ session: { id: 5 }, orders: [round1, cancelledRound], totalCents: 1500 });
    const stub = buildDbStub();
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    let capturedBody: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
        capturedBody = JSON.parse(init.body as string);
        return { ok: true, json: async () => ({ status: "autorizado", chave_nfe: "chave-mesa" }) };
      }),
    );

    await emitNfceForTableSession(5);

    expect(capturedBody?.items).toHaveLength(1);
    expect(JSON.parse(String(stub.updates[0].consolidatedOrderIds))).toEqual([10]);
    vi.unstubAllGlobals();
  });
});
