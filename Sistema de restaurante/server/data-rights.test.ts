import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

/**
 * Camada de roteamento do autoatendimento LGPD (server/routers/dataRights.ts)
 * — a camada de banco (geração/checagem real do código, hash, token JWT) já
 * foi verificada ao vivo contra o banco real nesta sessão (script descartável,
 * não fica no repo). Aqui testamos o que o router faz por cima disso:
 * validação de input, mapeamento de erro genérico (nunca revela qual dos
 * motivos específicos falhou) e a exigência de token válido em myData/deleteMyData.
 */
const mocks = vi.hoisted(() => ({
  createPhoneVerificationCode: vi.fn(),
  verifyPhoneVerificationCode: vi.fn(),
  getCustomerByPhone: vi.fn(),
  getOrdersSummaryByPhone: vi.fn(),
  anonymizeCustomer: vi.fn(),
  getDb: vi.fn(),
  sendSms: vi.fn(),
  createDataRightsToken: vi.fn(),
  verifyDataRightsToken: vi.fn(),
}));

vi.mock("./db", () => mocks);
vi.mock("./_core/sms", () => ({ sendSms: mocks.sendSms }));
vi.mock("./_core/dataRightsToken", () => ({ createDataRightsToken: mocks.createDataRightsToken, verifyDataRightsToken: mocks.verifyDataRightsToken }));

import { appRouter } from "./routers";

const publicContext = { user: null, supportSession: null, req: { ip: `203.0.113.${Math.floor(Math.random() * 250) + 1}` }, res: {} } as unknown as TrpcContext;
const PHONE = "11987654321";

describe("dataRights — autoatendimento LGPD", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requestCode rejeita telefone mal formatado antes de gerar código", async () => {
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.dataRights.requestCode({ phone: "123" })).rejects.toThrow();
    expect(mocks.createPhoneVerificationCode).not.toHaveBeenCalled();
  });

  it("requestCode gera código e tenta enviar por SMS", async () => {
    mocks.createPhoneVerificationCode.mockResolvedValue("123456");
    mocks.sendSms.mockResolvedValue({ sent: true });
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.dataRights.requestCode({ phone: PHONE })).resolves.toEqual({ sent: true });
    expect(mocks.sendSms).toHaveBeenCalledWith(`+55${PHONE}`, expect.stringContaining("123456"));
  });

  it("verifyCode com código errado devolve erro genérico (não revela o motivo específico)", async () => {
    mocks.verifyPhoneVerificationCode.mockResolvedValue({ ok: false, reason: "wrong_code" });
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.dataRights.verifyCode({ phone: PHONE, code: "000000" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("Código inválido ou expirado") });
    expect(mocks.createDataRightsToken).not.toHaveBeenCalled();
  });

  it("verifyCode com código certo emite token", async () => {
    mocks.verifyPhoneVerificationCode.mockResolvedValue({ ok: true });
    mocks.getDb.mockResolvedValue(null); // sem cliente cadastrado ainda — não deve quebrar
    mocks.createDataRightsToken.mockResolvedValue("token-valido");
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.dataRights.verifyCode({ phone: PHONE, code: "654321" })).resolves.toEqual({ token: "token-valido" });
  });

  it("myData exige token válido pro telefone informado", async () => {
    mocks.verifyDataRightsToken.mockResolvedValue(false);
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.dataRights.myData({ phone: PHONE, token: "token-invalido-ou-de-outro-telefone" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getCustomerByPhone).not.toHaveBeenCalled();
  });

  it("myData com token válido devolve cliente e pedidos", async () => {
    mocks.verifyDataRightsToken.mockResolvedValue(true);
    mocks.getCustomerByPhone.mockResolvedValue({ id: 1, name: "Cliente Teste" });
    mocks.getOrdersSummaryByPhone.mockResolvedValue([{ id: 1, publicCode: "PX-TESTE" }]);
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.dataRights.myData({ phone: PHONE, token: "token-valido" })).resolves.toEqual({ customer: { id: 1, name: "Cliente Teste" }, orders: [{ id: 1, publicCode: "PX-TESTE" }] });
  });

  it("deleteMyData exige token válido antes de anonimizar qualquer coisa", async () => {
    mocks.verifyDataRightsToken.mockResolvedValue(false);
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.dataRights.deleteMyData({ phone: PHONE, token: "token-invalido" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.anonymizeCustomer).not.toHaveBeenCalled();
  });

  it("deleteMyData com token válido anonimiza o cliente encontrado", async () => {
    mocks.verifyDataRightsToken.mockResolvedValue(true);
    mocks.getCustomerByPhone.mockResolvedValue({ id: 42, name: "Cliente Teste" });
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.dataRights.deleteMyData({ phone: PHONE, token: "token-valido" })).resolves.toEqual({ success: true });
    expect(mocks.anonymizeCustomer).toHaveBeenCalledWith(42);
  });

  it("deleteMyData com token válido mas telefone sem cadastro não erra (nada pra apagar)", async () => {
    mocks.verifyDataRightsToken.mockResolvedValue(true);
    mocks.getCustomerByPhone.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.dataRights.deleteMyData({ phone: PHONE, token: "token-valido" })).resolves.toEqual({ success: true });
    expect(mocks.anonymizeCustomer).not.toHaveBeenCalled();
  });
});
