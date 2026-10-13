import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Achado da auditoria de segurança: sem SMS_PROVIDER configurado (padrão),
 * sendSms logava a MENSAGEM COMPLETA (que inclui o código de verificação de
 * 6 dígitos do autoatendimento LGPD) em texto puro — em produção, qualquer
 * operador/ferramenta com acesso ao log conseguia gerar+ler o código de
 * qualquer telefone e disparar dataRights.myData/deleteMyData pra outro
 * cliente. Correção: em produção (ENV.isProduction), nunca loga o código;
 * em dev, continua logando de propósito (permite testar o fluxo sem Twilio).
 */
const mocks = vi.hoisted(() => ({ ENV: { smsProvider: "none", isProduction: false, twilioAccountSid: "", twilioAuthToken: "", twilioFromNumber: "" } }));
vi.mock("./_core/env", () => ({ ENV: mocks.ENV }));

import { sendSms } from "./_core/sms";

describe("sendSms — sem provedor configurado, nunca vaza o código em produção", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => warnSpy.mockRestore());

  it("em produção: NÃO loga o código de verificação", async () => {
    mocks.ENV.isProduction = true;
    await sendSms("85999991234", "Comandiva: seu código de verificação é 482913. Válido por 10 minutos.");

    const loggedText = warnSpy.mock.calls.map(call => call.join(" ")).join("\n");
    expect(loggedText).not.toContain("482913");
  });

  it("fora de produção: continua logando o código de propósito (permite testar sem Twilio)", async () => {
    mocks.ENV.isProduction = false;
    await sendSms("85999991234", "Comandiva: seu código de verificação é 482913. Válido por 10 minutos.");

    const loggedText = warnSpy.mock.calls.map(call => call.join(" ")).join("\n");
    expect(loggedText).toContain("482913");
  });
});
