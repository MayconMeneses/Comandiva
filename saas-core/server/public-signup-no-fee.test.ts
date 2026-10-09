import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRestaurantFromPublicSignup } from "./db/publicSignup";

/**
 * Cadastro público SEM taxa de implementação (2026-10-09): o formulário do
 * site comercial cria o restaurante direto e avisa o dono no Telegram. Cobre
 * a regra de negócio (db), a rota pública e que nenhuma tela/texto do site
 * comercial ainda cobra ou cita a taxa.
 */
const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  createRestaurantWithSubscription: vi.fn(),
  hasRestaurantForContact: vi.fn(),
  getPlanByKey: vi.fn(),
  audit: vi.fn(),
  notify: vi.fn(),
  rateLimit: vi.fn(),
  plans: vi.fn(),
  createFromSignup: vi.fn(),
}));

vi.mock("./db/client", () => ({ getDb: mocks.getDb, cached: (_ttl: number, fn: () => unknown) => fn, PLANS_CACHE_TTL_MS: 30_000 }));
vi.mock("./db/restaurants", () => ({ createRestaurantWithSubscription: mocks.createRestaurantWithSubscription, hasRestaurantForContact: mocks.hasRestaurantForContact, getRestaurantById: vi.fn() }));
vi.mock("./db/plans", () => ({ getPlanByKey: mocks.getPlanByKey, listPlansWithFeaturesAndLimits: mocks.plans, listPlansWithFeaturesAndLimitsCached: vi.fn(), listAllFeatures: vi.fn() }));
vi.mock("./db/auditLog", () => ({ recordPlatformAuditLog: mocks.audit }));
vi.mock("./_core/rateLimit", () => ({ checkRateLimit: mocks.rateLimit }));
vi.mock("./_core/env", () => ({ ENV: { mercadoPagoAccessToken: "", implementationFeeCents: 10000 } }));
vi.mock("./_core/telegramService", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/telegramService")>();
  return { ...actual, sendTelegramMessageAsync: mocks.notify, sendTelegramDocumentAsync: vi.fn() };
});

const payload = { name: "Pizzaria do Zé", planKey: "profissional", contactName: "José", contactEmail: "Ze@Exemplo.com", contactPhone: "(88) 99940-1565" };
const created = { restaurantId: 42, planKey: "profissional", status: "trialing", apiKey: "rk_live_abc" };

function dbWithRecent(rows: unknown[]) {
  const chain = { where: () => Promise.resolve(rows) };
  return { select: () => ({ from: () => chain }) };
}

describe("createRestaurantFromPublicSignup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(dbWithRecent([]));
    mocks.hasRestaurantForContact.mockResolvedValue(false);
    mocks.createRestaurantWithSubscription.mockResolvedValue(created);
    mocks.getPlanByKey.mockResolvedValue({ name: "Profissional" });
  });

  it("cria o restaurante direto (sem pagamento), com teste grátis, e avisa o dono com todos os dados", async () => {
    const result = await createRestaurantFromPublicSignup(payload);
    expect(result).toEqual({ restaurantId: 42, duplicate: false });
    expect(mocks.createRestaurantWithSubscription).toHaveBeenCalledWith(expect.objectContaining({ name: "Pizzaria do Zé", planKey: "profissional", actor: "public:signup", grantTrial: true }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "restaurant.public_signup", entityId: 42 }));
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    const text = mocks.notify.mock.calls[0][0] as string;
    for (const part of ["Novo cadastro", "Pizzaria do Zé", "#42", "Profissional", "José", "Ze@Exemplo.com", "https://wa.me/5588999401565", "rk_live_abc"]) expect(text).toContain(part);
    expect(text).not.toMatch(/taxa|pago|R\$/i);
  });

  it("contato que já teve restaurante: cria mesmo assim, sem teste grátis, e sinaliza no aviso", async () => {
    mocks.hasRestaurantForContact.mockResolvedValue(true);
    await createRestaurantFromPublicSignup(payload);
    expect(mocks.createRestaurantWithSubscription).toHaveBeenCalledWith(expect.objectContaining({ grantTrial: false }));
    expect(mocks.notify.mock.calls[0][0]).toContain("Contato repetido");
  });

  it("mesmo formulário reenviado em 10 minutos devolve o restaurante existente, sem criar outro nem avisar de novo", async () => {
    mocks.getDb.mockResolvedValue(dbWithRecent([{ id: 7, contactEmail: "ze@exemplo.com" }]));
    const result = await createRestaurantFromPublicSignup(payload);
    expect(result).toEqual({ restaurantId: 7, duplicate: true });
    expect(mocks.createRestaurantWithSubscription).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });

  it("restaurante recente com outro e-mail não conta como duplicado", async () => {
    mocks.getDb.mockResolvedValue(dbWithRecent([{ id: 7, contactEmail: "outra@pessoa.com" }]));
    expect((await createRestaurantFromPublicSignup(payload)).duplicate).toBe(false);
  });
});

describe("public.signup (rota)", () => {
  const input = { name: "Pizzaria do Zé", planKey: "profissional" as const, contactName: "José", contactEmail: "ze@exemplo.com", contactPhone: "(88) 99940-1565" };
  const caller = async () => {
    vi.doMock("./db/publicSignup", () => ({ createRestaurantFromPublicSignup: mocks.createFromSignup }));
    vi.resetModules();
    const { publicRouter } = await import("./routers/public");
    return publicRouter.createCaller({ req: { ip: "203.0.113.9" } } as never);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimit.mockReturnValue({ allowed: true });
    mocks.plans.mockResolvedValue([{ key: "profissional", name: "Profissional", active: true }]);
    mocks.createFromSignup.mockResolvedValue({ restaurantId: 42, duplicate: false });
  });

  it("devolve só o id do restaurante — sem checkout, sem Mercado Pago, sem token configurado", async () => {
    const result = await (await caller()).signup(input);
    expect(result).toEqual({ restaurantId: 42 });
    expect(mocks.createFromSignup).toHaveBeenCalledWith({ name: "Pizzaria do Zé", planKey: "profissional", contactName: "José", contactEmail: "ze@exemplo.com", contactPhone: "(88) 99940-1565" });
  });

  it("recusa por limite de tentativas, plano inativo ou e-mail inválido, sem criar nada", async () => {
    mocks.rateLimit.mockReturnValueOnce({ allowed: false, retryAfterSeconds: 60 });
    await expect((await caller()).signup(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    mocks.plans.mockResolvedValueOnce([{ key: "profissional", name: "Profissional", active: false }]);
    await expect((await caller()).signup(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect((await caller()).signup({ ...input, contactEmail: "nao-e-email" })).rejects.toThrow();
    expect(mocks.createFromSignup).not.toHaveBeenCalled();
  });

  it("o código da rota pública não usa mais taxa de implementação nem checkout do Mercado Pago", () => {
    const source = readFileSync(new URL("./routers/public.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/implementationFeeCents|createImplementationFeePreference|createSignupPayment/);
  });
});

describe("site comercial sem taxa de implementação", () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

  it("formulário de cadastro não cobra, não cita a taxa e envia direto", () => {
    const cadastro = read("../client/src/pages/comercial/Cadastro.tsx");
    expect(cadastro).not.toMatch(/Taxa de implementação|implementationFee|Pagar |checkoutUrl|useMercadoPagoSecurity/);
    expect(cadastro).toContain("Enviar informações");
    expect(cadastro).toContain("/comercial/cadastro/sucesso?ref=");
  });

  it("planos, FAQ e termos não falam mais em taxa de implementação", () => {
    for (const file of ["Planos.tsx", "Home.tsx", "Termos.tsx"]) {
      expect(read(`../client/src/pages/comercial/${file}`), file).not.toMatch(/taxa de implementação/i);
    }
  });
});
