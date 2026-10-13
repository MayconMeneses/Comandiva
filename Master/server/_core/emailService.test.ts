import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cobre as garantias que mais importam no EmailService (ver prompt do dono):
 * nunca manda e-mail real fora de produção sem destinatário de teste
 * explícito (#37), faz retry limitado sem loop infinito (#29), e nunca
 * lança — todo chamador recebe um resultado, nunca precisa de try/catch
 * (#30, e-mail não pode derrubar o fluxo de pagamento).
 */
const mocks = vi.hoisted(() => ({ env: { isProduction: false, resendApiKey: "re_test", emailFrom: "no-reply@teste.com", emailFromName: "Teste", emailDevRecipient: "" } }));
vi.mock("./env", () => ({ ENV: mocks.env }));

const { sendEmail } = await import("./emailService");

const WELCOME_VARS = { customerName: "Maria", restaurantName: "Restaurante Teste", planName: "Profissional", actionUrl: "https://painel.teste.com" };

describe("emailService.sendEmail — modo desenvolvimento", () => {
  beforeEach(() => {
    mocks.env.isProduction = false;
    mocks.env.emailDevRecipient = "";
    global.fetch = vi.fn();
  });

  it("sem EMAIL_DEV_RECIPIENT: não chama o provedor, retorna sent:false", async () => {
    const result = await sendEmail("cliente-real@exemplo.com", "welcome", WELCOME_VARS);
    expect(result).toEqual({ sent: false, reason: "dev-mode-no-recipient" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("com EMAIL_DEV_RECIPIENT: redireciona o envio pro destinatário de teste, nunca pro real", async () => {
    mocks.env.emailDevRecipient = "dev@teste.com";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ id: "msg_1" }) });

    const result = await sendEmail("cliente-real@exemplo.com", "welcome", WELCOME_VARS);

    expect(result).toEqual({ sent: true, providerMessageId: "msg_1" });
    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(requestInit.body);
    expect(body.to).toEqual(["dev@teste.com"]);
  });
});

describe("emailService.sendEmail — produção", () => {
  beforeEach(() => {
    mocks.env.isProduction = true;
    global.fetch = vi.fn();
  });

  it("envia pro destinatário real", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ id: "msg_2" }) });
    const result = await sendEmail("cliente-real@exemplo.com", "welcome", WELCOME_VARS);
    expect(result).toEqual({ sent: true, providerMessageId: "msg_2" });
    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(requestInit.body).to).toEqual(["cliente-real@exemplo.com"]);
  });

  it("retry: falha 2 vezes, sucede na 3ª — resultado final é sucesso", async () => {
    vi.useFakeTimers();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "erro 1" })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "erro 2" })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "msg_3" }) });

    const promise = sendEmail("cliente@exemplo.com", "welcome", WELCOME_VARS);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ sent: true, providerMessageId: "msg_3" });
    expect(global.fetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("falha nas 3 tentativas: para de tentar (sem loop infinito), retorna sent:false", async () => {
    vi.useFakeTimers();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, text: async () => "sempre falha" });

    const promise = sendEmail("cliente@exemplo.com", "welcome", WELCOME_VARS);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.sent).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("nunca lança — mesmo com fetch rejeitando (falha de rede)", async () => {
    vi.useFakeTimers();
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("rede fora do ar"));
    const promise = sendEmail("cliente@exemplo.com", "welcome", WELCOME_VARS);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toMatchObject({ sent: false });
    vi.useRealTimers();
  });

  it("escapa HTML de variáveis do cliente (defesa em profundidade, mesmo padrão da auditoria V-39 do app principal)", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ id: "msg_4" }) });
    await sendEmail("cliente@exemplo.com", "welcome", { ...WELCOME_VARS, customerName: "<img src=x onerror=alert(1)>" });
    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const html = JSON.parse(requestInit.body).html as string;
    expect(html).not.toContain("<img src=x onerror");
    expect(html).toContain("&lt;img src=x onerror");
  });
});
