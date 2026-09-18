import { afterEach, describe, expect, it, vi } from "vitest";
import { createImplementationFeePreference } from "./mercadoPagoCheckout";

/**
 * Prova a correção do bug de produção (2026-09-17): botão de pagar travava
 * no checkout hospedado do Mercado Pago (Safari/iPhone) porque o Device ID
 * do security.js nunca era enviado na criação da preferência. Sem o header
 * X-meli-session-id, o motor de risco deles não associa o fingerprint do
 * dispositivo a essa transação específica.
 */
const BASE_PARAMS = {
  accessToken: "token-teste",
  title: "Taxa de implementação",
  externalReference: "42",
  amountCents: 100,
  payerEmail: "dono@teste.com",
  successUrl: "https://exemplo.com/ok",
  failureUrl: "https://exemplo.com/falhou",
  pendingUrl: "https://exemplo.com/pendente",
  notificationUrl: "https://exemplo.com/api/webhooks/mercadopago",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createImplementationFeePreference — header X-meli-session-id", () => {
  it("inclui o header quando deviceId é informado", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "pref-1", init_point: "https://mp.example/checkout/pref-1" }) });
    vi.stubGlobal("fetch", fetchMock);

    await createImplementationFeePreference({ ...BASE_PARAMS, deviceId: "device-abc-123" });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["X-meli-session-id"]).toBe("device-abc-123");
  });

  it("não inclui o header quando deviceId não é informado (script pode não ter carregado a tempo)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "pref-1", init_point: "https://mp.example/checkout/pref-1" }) });
    vi.stubGlobal("fetch", fetchMock);

    await createImplementationFeePreference({ ...BASE_PARAMS });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["X-meli-session-id"]).toBeUndefined();
  });
});

describe("createImplementationFeePreference — notification_url", () => {
  it("envia notification_url no corpo da preferência (2026-09-17: não dá pra depender só da URL cadastrada no painel do Mercado Pago)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "pref-1", init_point: "https://mp.example/checkout/pref-1" }) });
    vi.stubGlobal("fetch", fetchMock);

    await createImplementationFeePreference({ ...BASE_PARAMS });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.notification_url).toBe("https://exemplo.com/api/webhooks/mercadopago");
  });
});
