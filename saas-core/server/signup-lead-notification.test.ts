import { beforeEach, describe, expect, it, vi } from "vitest";

// Comportamento real da rota pública `signup` (com banco, Mercado Pago e Telegram
// substituídos): o aviso de possível cliente sai com os dados preenchidos, só em
// caso de sucesso, e uma falha do Telegram nunca derruba o checkout.
const mocks = vi.hoisted(() => ({
  env: { mercadoPagoAccessToken: "TEST-token", implementationFeeCents: 10000 },
  notify: vi.fn(),
  createPreference: vi.fn(),
  rateLimit: vi.fn(),
  plans: vi.fn(),
}));

vi.mock("./_core/env", () => ({ ENV: mocks.env }));
vi.mock("./_core/rateLimit", () => ({ checkRateLimit: mocks.rateLimit }));
vi.mock("./db/plans", () => ({
  listPlansWithFeaturesAndLimits: mocks.plans,
  listPlansWithFeaturesAndLimitsCached: vi.fn(),
  listAllFeatures: vi.fn(),
}));
vi.mock("./db/signupPayments", () => ({
  createSignupPayment: vi.fn(async () => ({ id: 77 })),
  attachMpPreference: vi.fn(async () => undefined),
  getSignupPaymentById: vi.fn(),
}));
vi.mock("./db/restaurants", () => ({ getRestaurantById: vi.fn() }));
vi.mock("./_core/mercadoPagoCheckout", () => ({ createImplementationFeePreference: mocks.createPreference }));
vi.mock("./_core/telegramService", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/telegramService")>();
  return { ...actual, sendTelegramMessageAsync: mocks.notify, sendTelegramDocumentAsync: vi.fn() };
});

const { publicRouter } = await import("./routers/public");

const input = {
  name: "Pizzaria do Zé",
  planKey: "profissional" as const,
  contactName: "José",
  contactEmail: "ze@exemplo.com",
  contactPhone: "(88) 99940-1565",
  returnOrigin: "https://mmsystem.tech",
};
const caller = () => publicRouter.createCaller({ req: { ip: "203.0.113.9" } } as never);

describe("public.signup → notificação de possível cliente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimit.mockReturnValue({ allowed: true });
    mocks.plans.mockResolvedValue([{ key: "profissional", name: "Profissional", active: true }]);
    mocks.createPreference.mockResolvedValue({ id: "pref-1", initPoint: "https://mp.example/checkout" });
    mocks.env.mercadoPagoAccessToken = "TEST-token";
  });

  it("avisa o dono com todos os dados e devolve o checkout normalmente", async () => {
    const result = await caller().signup(input);
    expect(result).toEqual({ checkoutUrl: "https://mp.example/checkout", signupPaymentId: 77 });
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    const text = mocks.notify.mock.calls[0][0] as string;
    for (const part of ["Pizzaria do Zé", "Profissional", "José", "ze@exemplo.com", "(88) 99940-1565", "https://wa.me/5588999401565", "R$"]) {
      expect(text).toContain(part);
    }
  });

  it("não avisa quando o cadastro é recusado (rate limit, plano inativo, MP sem token, checkout falhou)", async () => {
    mocks.rateLimit.mockReturnValueOnce({ allowed: false, retryAfterSeconds: 60 });
    await expect(caller().signup(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    mocks.plans.mockResolvedValueOnce([{ key: "profissional", name: "Profissional", active: false }]);
    await expect(caller().signup(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });

    mocks.env.mercadoPagoAccessToken = "";
    await expect(caller().signup(input)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    mocks.env.mercadoPagoAccessToken = "TEST-token";
    mocks.createPreference.mockRejectedValueOnce(new Error("MP fora do ar"));
    await expect(caller().signup(input)).rejects.toThrow("MP fora do ar");

    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("e-mail inválido é recusado antes de qualquer aviso", async () => {
    await expect(caller().signup({ ...input, contactEmail: "nao-e-email" })).rejects.toThrow();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("sem telefone nem nome de contato: avisa mesmo assim, sem link de WhatsApp", async () => {
    await caller().signup({ ...input, contactName: undefined, contactPhone: undefined });
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.notify.mock.calls[0][0]).not.toContain("wa.me");
  });
});
