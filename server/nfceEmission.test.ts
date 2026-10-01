import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getFiscalCredentialsForEmission: vi.fn(),
  getOrderWithDetails: vi.fn(),
  getSessionWithOrders: vi.fn(),
  sendOwnerAlert: vi.fn(),
}));

vi.mock("./db", async importOriginal => ({
  ...(await importOriginal<typeof import("./db")>()),
  getFiscalCredentialsForEmission: mocks.getFiscalCredentialsForEmission,
  getOrderWithDetails: mocks.getOrderWithDetails,
  getSessionWithOrders: mocks.getSessionWithOrders,
}));
// Falha ERROR (catch de comunicação com o provedor) dispara o alerta já
// existente pro dono (Telegram/e-mail) — ver Fase 4 do plano offline-first
// em C:\Users\maico\.claude\plans\lovely-purring-dusk.md. Mockado pra provar
// o disparo e os parâmetros (kind/area), não o comportamento do alerta em si
// (já coberto por alerts.test.ts).
vi.mock("./_core/alerts", () => ({ sendOwnerAlert: mocks.sendOwnerAlert }));

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
function buildDbStub(options: { existingDocument?: Record<string, unknown> | null; productRows?: Record<string, unknown>[]; categoryRows?: Record<string, unknown>[]; raceWinnerId?: number } = {}) {
  const inserts: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const productRows = options.productRows ?? [product()];
  const categoryRows = options.categoryRows ?? [CATEGORY];
  // raceWinnerId simula outra chamada de emit() concorrente que já inseriu o
  // documento fiscal primeiro — a 1ª leitura de fiscalDocuments (no início de
  // emit()) ainda devolve vazio (options.existingDocument), mas por baixo já
  // existe uma linha com esse id, achada só quando upsertFiscalDocument
  // reage ao ER_DUP_ENTRY do insert e reconsulta.
  let insertAttempts = 0;
  const db = {
    select() {
      return {
        from(table: unknown) {
          const chain = {
            where: () => chain,
            limit: async () => {
              if (table === fiscalDocuments) {
                if (options.raceWinnerId && insertAttempts > 0) return [{ id: options.raceWinnerId }];
                return options.existingDocument ? [options.existingDocument] : [];
              }
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
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        insertAttempts++;
        if (options.raceWinnerId && insertAttempts === 1) {
          throw Object.assign(new Error("Duplicate entry"), { cause: { code: "ER_DUP_ENTRY" } });
        }
        inserts.push(values);
      },
    }),
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

  it("nota autorizada: grava chaveAcesso/danfeUrl/qrCodeUrl com status AUTHORIZED", async () => {
    mocks.getOrderWithDetails.mockResolvedValue(order());
    const stub = buildDbStub();
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "autorizado", chave_nfe: "chave-123", numero: "1", serie: "1", caminho_danfe: "https://focusnfe/danfe.pdf", qrcode_url: "https://focusnfe/qr" }) }));

    await emitNfceForOrder(1);

    expect(stub.inserts).toHaveLength(1);
    expect(stub.inserts[0]).toMatchObject({ status: "AUTHORIZED", chaveAcesso: "chave-123", danfeUrl: "https://focusnfe/danfe.pdf", qrCodeUrl: "https://focusnfe/qr" });
    vi.unstubAllGlobals();
  });

  it("nota rejeitada pela SEFAZ: grava status REJECTED com o motivo, sem lançar erro, e NÃO dispara alerta pro dono (já visível/acionável pelo admin em Receipt.tsx)", async () => {
    mocks.getOrderWithDetails.mockResolvedValue(order());
    const stub = buildDbStub();
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "erro_autorizacao", mensagem_sefaz: "CNPJ do emitente não habilitado" }) }));

    await expect(emitNfceForOrder(1)).resolves.toBeUndefined();

    expect(stub.inserts[0]).toMatchObject({ status: "REJECTED", rejectionReason: "CNPJ do emitente não habilitado" });
    expect(mocks.sendOwnerAlert).not.toHaveBeenCalled();
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
    expect(stub.inserts[0]).toMatchObject({ status: "ERROR" });
    expect(String(stub.inserts[0].rejectionReason)).toContain("X-Bacon");
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
    expect(stub.inserts[0]).toMatchObject({ status: "ERROR" });
    vi.unstubAllGlobals();
  });

  it("provedor fora do ar (fetch lança): grava status ERROR, NUNCA propaga o erro pra quem chamou, e avisa o dono proativamente (Fase 4 — não fica visível só se alguém abrir o comprovante)", async () => {
    mocks.getOrderWithDetails.mockResolvedValue(order());
    const stub = buildDbStub();
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    await expect(emitNfceForOrder(1)).resolves.toBeUndefined();

    expect(stub.inserts[0]).toMatchObject({ status: "ERROR" });
    expect(mocks.sendOwnerAlert).toHaveBeenCalledTimes(1);
    const [subject, message, kind, , area] = mocks.sendOwnerAlert.mock.calls[0] as [string, string, string, unknown, string];
    expect(subject).toContain("NFC-e");
    expect(message).toContain("pedido 1");
    expect(message).toContain("ECONNREFUSED");
    expect(kind).toBe("nfceEmission");
    expect(area).toContain("NFC-e");
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

  it("duas emissões quase simultâneas pro mesmo pedido (ex.: 'saiu para entrega' + retry manual): a segunda não propaga erro cru de banco, reaproveita a linha que a primeira criou — achado M5 da auditoria", async () => {
    mocks.getOrderWithDetails.mockResolvedValue(order());
    const stub = buildDbStub({ raceWinnerId: 77 });
    vi.mocked(getDb).mockResolvedValue(stub.db as never);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "autorizado", chave_nfe: "chave-123", numero: "1", serie: "1" }) }));

    await expect(emitNfceForOrder(1)).resolves.toBeUndefined();

    // Insert falhou com ER_DUP_ENTRY e foi convertido num update na linha do vencedor da corrida (id 77), nunca propagou o erro.
    expect(stub.inserts).toHaveLength(0);
    expect(stub.updates).toHaveLength(1);
    expect(stub.updates[0]).toMatchObject({ status: "AUTHORIZED", chaveAcesso: "chave-123" });
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
    expect(stub.inserts).toHaveLength(1); // uma única linha em fiscal_documents
    expect(stub.inserts[0]).toMatchObject({ tableSessionId: 5, status: "AUTHORIZED" });
    expect(JSON.parse(String(stub.inserts[0].consolidatedOrderIds))).toEqual([10, 11]);
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
    expect(JSON.parse(String(stub.inserts[0].consolidatedOrderIds))).toEqual([10]);
    vi.unstubAllGlobals();
  });
});
