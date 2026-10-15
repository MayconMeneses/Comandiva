import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Auditoria de segurança 2026-10-10: rotas PÚBLICAS devolvem o mínimo.
 *  - catalog.settings não entrega pixKey/pixQrCodeUrl (chave Pix pode ser CPF/celular do dono);
 *  - customer.lookupByPhone entrega nome + último endereço (reaberto por decisão do dono em 2026-10-15; nunca o histórico completo);
 *  - customer.saveProfile público (devolvia o cadastro completo e não tinha uso) deixou de existir;
 *  - a versão completa existe só pra equipe logada (admin.lookupCustomerByPhone).
 */
const mocks = vi.hoisted(() => ({
  getLicenseSnapshot: vi.fn(),
  getStoreSettingsCached: vi.fn(),
  getCustomerByPhone: vi.fn(),
}));
vi.mock("./_core/license", () => ({ getLicenseSnapshot: mocks.getLicenseSnapshot }));
vi.mock("./db", () => ({ getStoreSettingsCached: mocks.getStoreSettingsCached, getCustomerByPhone: mocks.getCustomerByPhone }));

import { appRouter } from "./routers";

const publicContext = { user: null, req: { ip: "203.0.113.90", protocol: "https", headers: {} }, res: {} } as unknown as TrpcContext;
const staffContext = {
  user: { id: 30, openId: "staff_balcao", name: "Balcão", email: null, loginMethod: "restaurant", role: "staff" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  supportSession: null,
  req: { ip: "203.0.113.91", protocol: "https", headers: {} },
  res: {},
} as unknown as TrpcContext;

const fullCustomer = {
  id: 7,
  name: "Maria Aparecida da Silva",
  phone: "85999991234",
  phoneVerifiedAt: null,
  addresses: [{ id: 1, street: "Rua das Flores", number: "100", neighborhood: "Centro", city: "Croatá", state: "CE", postalCode: "62390000", complement: null, reference: "Casa azul" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLicenseSnapshot.mockResolvedValue({ features: [] });
});

describe("catalog.settings (pública) não expõe a chave Pix", () => {
  it("remove pixKey e pixQrCodeUrl e mantém o resto", async () => {
    mocks.getStoreSettingsCached.mockResolvedValue({ id: 1, storeName: "Comandiva", isAcceptingOrders: true, pixKey: "123.456.789-00", pixQrCodeUrl: "https://x/qr.png", colorTheme: "classico" });
    const result = await appRouter.createCaller(publicContext).catalog.settings();
    expect(result).not.toHaveProperty("pixKey");
    expect(result).not.toHaveProperty("pixQrCodeUrl");
    expect(JSON.stringify(result)).not.toContain("123.456.789-00");
    expect(result).toMatchObject({ storeName: "Comandiva", isAcceptingOrders: true, colorTheme: "classico", offlineResilienceEnabled: false });
  });
});

describe("customer.lookupByPhone (pública) devolve o mínimo", () => {
  // Decisão do dono (2026-10-15): o checkout preenche nome e último endereço
  // pelo telefone, então a consulta voltou a devolvê-los — mas só isso.
  it("devolve nome e o último endereço para preencher o checkout — sem id, telefone nem histórico", async () => {
    mocks.getCustomerByPhone.mockResolvedValue({ ...fullCustomer, addresses: [...fullCustomer.addresses, { id: 2, street: "Rua Antiga", number: "5", neighborhood: "Baixio", city: "Croatá", state: "CE", postalCode: null, complement: null, reference: null }] });
    const result = await appRouter.createCaller(publicContext).customer.lookupByPhone({ phone: "85999991234" });
    expect(result).toEqual({
      firstName: "Maria",
      name: "Maria Aparecida da Silva",
      address: { postalCode: "62390000", street: "Rua das Flores", number: "100", complement: "", neighborhood: "Centro", city: "Croatá", state: "CE", reference: "Casa azul" },
    });
    const serialized = JSON.stringify(result);
    for (const leaked of ["Rua Antiga", "85999991234", "phoneVerifiedAt", "\"id\""]) expect(serialized).not.toContain(leaked);
  });

  it("cliente sem endereço salvo devolve só o nome", async () => {
    mocks.getCustomerByPhone.mockResolvedValue({ ...fullCustomer, addresses: [] });
    expect(await appRouter.createCaller(publicContext).customer.lookupByPhone({ phone: "85999991234" })).toEqual({ firstName: "Maria", name: "Maria Aparecida da Silva", address: undefined });
  });

  it("telefone sem cadastro continua devolvendo undefined", async () => {
    mocks.getCustomerByPhone.mockResolvedValue(undefined);
    expect(await appRouter.createCaller(publicContext).customer.lookupByPhone({ phone: "85999990000" })).toBeUndefined();
  });

  it("o saveProfile público não existe mais", () => {
    expect(Object.keys(appRouter._def.procedures)).not.toContain("customer.saveProfile");
    expect(Object.keys(appRouter._def.procedures)).toContain("customer.lookupByPhone");
  });
});

describe("admin.lookupCustomerByPhone (balcão)", () => {
  it("anônimo não consulta", async () => {
    await expect(appRouter.createCaller(publicContext).admin.lookupCustomerByPhone({ phone: "85999991234" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getCustomerByPhone).not.toHaveBeenCalled();
  });

  it("equipe logada recebe nome completo e endereços pra preencher o pedido", async () => {
    mocks.getCustomerByPhone.mockResolvedValue(fullCustomer);
    const result = await appRouter.createCaller(staffContext).admin.lookupCustomerByPhone({ phone: "85999991234" });
    expect(result?.name).toBe("Maria Aparecida da Silva");
    expect(result?.addresses[0]?.street).toBe("Rua das Flores");
  });
});
