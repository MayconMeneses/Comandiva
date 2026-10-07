import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Teste de fiação: o aviso de possível cliente precisa sair DEPOIS de o
// checkout existir (attachMpPreference), sem await (nunca segura o pagamento)
// e antes do return — e nunca antes das validações que podem recusar o cadastro.
const source = readFileSync(new URL("./routers/public.ts", import.meta.url), "utf8");
const signupBlock = source.slice(source.indexOf("signup: publicProcedure"), source.indexOf("signupStatus:"));

describe("signup → notificação de possível cliente", () => {
  it("dispara sem await, só depois de anexar a preferência do Mercado Pago", () => {
    const attach = signupBlock.indexOf("await attachMpPreference");
    const notify = signupBlock.indexOf("sendTelegramMessageAsync(");
    const ret = signupBlock.indexOf("return { checkoutUrl");
    expect(attach).toBeGreaterThan(-1);
    expect(notify).toBeGreaterThan(attach);
    expect(ret).toBeGreaterThan(notify);
    expect(signupBlock).not.toMatch(/awaits+sendTelegramMessageAsync/);
  });

  it("não vem antes do rate limit, da checagem de plano ativo nem da checagem do token do MP", () => {
    const notify = signupBlock.indexOf("sendTelegramMessageAsync(");
    expect(signupBlock.indexOf("checkRateLimit")).toBeLessThan(notify);
    expect(signupBlock.indexOf("Plano indisponível")).toBeLessThan(notify);
    expect(signupBlock.indexOf("mercadoPagoAccessToken")).toBeLessThan(notify);
  });

  it("envia todos os campos preenchidos pelo visitante", () => {
    for (const field of ["name: input.name", "contactName: input.contactName", "contactEmail: input.contactEmail", "contactPhone: input.contactPhone"]) {
      expect(signupBlock).toContain(field);
    }
  });
});
