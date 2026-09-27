import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Achado de segurança (auditoria desta sessão, baixa severidade):
 * `uploadMenuReference` aceitava um `restaurantId` sequencial simples, sem
 * nenhuma prova de posse, e não tinha limite por restaurante — dava pra
 * mandar arquivo/spam "em nome de" QUALQUER restaurante (inclusive um já
 * entregue e ativo há anos) indefinidamente, usando IPs diferentes pra
 * escapar do rate limit por IP. Corrigido: bloqueia depois de `deliveredAt`
 * (o propósito real do endpoint é só a janela de onboarding) e adiciona
 * rate limit por `restaurantId`, além do já existente por IP.
 */
const mocks = vi.hoisted(() => ({
  getRestaurantById: vi.fn(),
  sendTelegramDocumentAsync: vi.fn(),
  buildMenuReferenceCaption: vi.fn(() => "caption"),
}));

vi.mock("./db/restaurants", () => ({ getRestaurantById: mocks.getRestaurantById }));
vi.mock("./_core/telegramService", () => ({ sendTelegramDocumentAsync: mocks.sendTelegramDocumentAsync, buildMenuReferenceCaption: mocks.buildMenuReferenceCaption }));

import { publicRouter } from "./routers/public";

function caller(ip: string) {
  return publicRouter.createCaller({ req: { ip }, res: {} } as never);
}

const BASE_INPUT = { restaurantId: 1, fileName: "cardapio.pdf", mimeType: "application/pdf", fileBase64: Buffer.from("conteudo").toString("base64") };

describe("public.uploadMenuReference — proteção contra abuso (achado de auditoria)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restaurante já entregue: rejeita o upload (janela de onboarding já passou)", async () => {
    mocks.getRestaurantById.mockResolvedValue({ id: 1, name: "Restaurante Já Ativo", deliveredAt: Date.now() - 1000 });

    await expect(caller(`203.0.113.${Math.floor(Math.random() * 250) + 1}`).uploadMenuReference({ ...BASE_INPUT, restaurantId: 101 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.sendTelegramDocumentAsync).not.toHaveBeenCalled();
  });

  it("restaurante ainda não entregue: aceita normalmente (uso legítimo preservado)", async () => {
    mocks.getRestaurantById.mockResolvedValue({ id: 102, name: "Restaurante Novo", deliveredAt: null });

    const result = await caller(`203.0.113.${Math.floor(Math.random() * 250) + 1}`).uploadMenuReference({ ...BASE_INPUT, restaurantId: 102 });

    expect(result).toEqual({ success: true });
    expect(mocks.sendTelegramDocumentAsync).toHaveBeenCalledTimes(1);
  });

  it("rate limit por restaurantId: várias tentativas contra o MESMO restaurante, de IPs DIFERENTES, ainda é limitado", async () => {
    const restaurantId = 999;
    mocks.getRestaurantById.mockResolvedValue({ id: restaurantId, name: "Alvo", deliveredAt: null });

    // 8 tentativas (limite da janela) de 8 IPs diferentes — antes da correção,
    // rate limit só por IP deixaria passar todas indefinidamente.
    for (let i = 0; i < 8; i++) {
      await caller(`198.51.100.${i}`).uploadMenuReference({ ...BASE_INPUT, restaurantId });
    }
    await expect(caller("198.51.100.250").uploadMenuReference({ ...BASE_INPUT, restaurantId })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
