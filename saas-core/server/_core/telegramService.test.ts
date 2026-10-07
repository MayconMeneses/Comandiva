import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cobre as mesmas garantias do emailService.test.ts: em branco = desligado
 * sem chamar o provedor, nunca lança (o chamador nunca precisa de
 * try/catch), e HTML de variáveis do cliente é escapado antes de ir pro
 * parse_mode "HTML" do Telegram.
 */
const mocks = vi.hoisted(() => ({ env: { telegramBotToken: "", telegramChatId: "" } }));
vi.mock("./env", () => ({ ENV: mocks.env }));

const {
  sendTelegramMessage,
  sendTelegramDocument,
  buildNewPaidSignupMessage,
  buildRestaurantDeliveredMessage,
  buildMenuReferenceCaption,
  buildLeadMessage,
  buildProvisionCommandMessage,
  buildSystemErrorMessage,
  buildSubscriptionRenewedMessage,
  buildSubscriptionPastDueMessage,
  buildSubscriptionRecoveredMessage,
  buildSubscriptionPastDueGraceExpiredMessage,
  buildSubscriptionCanceledMessage,
} = await import("./telegramService");

describe("telegramService.sendTelegramMessage", () => {
  beforeEach(() => {
    mocks.env.telegramBotToken = "";
    mocks.env.telegramChatId = "";
    global.fetch = vi.fn();
  });

  it("sem TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID: não chama a API, retorna sent:false", async () => {
    const result = await sendTelegramMessage("teste");
    expect(result).toEqual({ sent: false, reason: "not-configured" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("configurado: envia pro chat certo", async () => {
    mocks.env.telegramBotToken = "bot-token-teste";
    mocks.env.telegramChatId = "12345";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    const result = await sendTelegramMessage("olá");

    expect(result).toEqual({ sent: true });
    const [url, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.telegram.org/botbot-token-teste/sendMessage");
    const body = JSON.parse(requestInit.body);
    expect(body).toMatchObject({ chat_id: "12345", text: "olá", parse_mode: "HTML" });
  });

  it("Telegram recusa (status != 2xx): retorna sent:false, nunca lança", async () => {
    mocks.env.telegramBotToken = "bot-token-teste";
    mocks.env.telegramChatId = "12345";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 400, text: async () => "chat not found" });

    const result = await sendTelegramMessage("olá");
    expect(result.sent).toBe(false);
  });

  it("nunca lança — mesmo com fetch rejeitando (falha de rede)", async () => {
    mocks.env.telegramBotToken = "bot-token-teste";
    mocks.env.telegramChatId = "12345";
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("rede fora do ar"));

    await expect(sendTelegramMessage("olá")).resolves.toMatchObject({ sent: false });
  });
});

describe("telegramService — mensagens", () => {
  it("buildNewPaidSignupMessage escapa HTML do nome do restaurante/contato", () => {
    const message = buildNewPaidSignupMessage({
      restaurantId: 42,
      restaurantName: "<b>Restaurante</b>",
      planName: "Profissional",
      contactName: "<script>alert(1)</script>",
      contactEmail: "cliente@teste.com",
      amountCents: 15000,
      apiKey: "rk_live_teste",
    });
    expect(message).not.toContain("<script>");
    expect(message).toContain("&lt;script&gt;");
    expect(message).toContain("#42");
    expect(message).toContain("R$");
  });

  it("buildRestaurantDeliveredMessage inclui o nome do restaurante e a data de término do teste", () => {
    const trialEndsAt = new Date("2026-10-10T00:00:00Z").getTime();
    const message = buildRestaurantDeliveredMessage({ restaurantId: 7, restaurantName: "Restaurante Teste", trialEndsAt });
    expect(message).toContain("Restaurante Teste");
    expect(message).toContain("#7");
  });

  it("buildMenuReferenceCaption escapa HTML do nome do restaurante", () => {
    const caption = buildMenuReferenceCaption({ restaurantId: 3, restaurantName: "<i>Teste</i>" });
    expect(caption).not.toContain("<i>Teste</i>");
    expect(caption).toContain("#3");
  });

  it("buildMenuReferenceCaption inclui as observações do cliente quando informadas", () => {
    const caption = buildMenuReferenceCaption({ restaurantId: 3, restaurantName: "Restaurante Teste", notes: "Abrimos das 18h às 23h, sextas até meia-noite." });
    expect(caption).toContain("Observações do cliente");
    expect(caption).toContain("Abrimos das 18h às 23h");
  });

  it("buildMenuReferenceCaption não adiciona seção de observações quando não informadas ou só espaço em branco", () => {
    expect(buildMenuReferenceCaption({ restaurantId: 3, restaurantName: "Restaurante Teste" })).not.toContain("Observações");
    expect(buildMenuReferenceCaption({ restaurantId: 3, restaurantName: "Restaurante Teste", notes: "   " })).not.toContain("Observações");
  });

  it("buildMenuReferenceCaption escapa HTML nas observações do cliente", () => {
    const caption = buildMenuReferenceCaption({ restaurantId: 3, restaurantName: "Restaurante Teste", notes: "<script>alert(1)</script>" });
    expect(caption).not.toContain("<script>alert(1)</script>");
    expect(caption).toContain("&lt;script&gt;");
  });

  it("buildProvisionCommandMessage inclui o comando pronto pra rodar na VPS", () => {
    const message = buildProvisionCommandMessage({
      restaurantId: 5,
      restaurantName: "Restaurante Teste",
      command: "CLIENT_SLUG=restaurante-teste-5 APP_PORT=5050 node scripts/provision-client.mjs",
    });
    expect(message).toContain("CLIENT_SLUG=restaurante-teste-5");
    expect(message).toContain("node scripts/provision-client.mjs");
    expect(message).toContain("#5");
  });

  it("buildSystemErrorMessage inclui o assunto e o detalhe do erro", () => {
    const message = buildSystemErrorMessage({ subject: "Erro não tratado — servidor pode reiniciar", detail: "TypeError: Cannot read properties of undefined" });
    expect(message).toContain("Erro não tratado");
    expect(message).toContain("Cannot read properties of undefined");
  });

  it("buildSystemErrorMessage escapa HTML do detalhe (stack trace pode conter < >)", () => {
    const message = buildSystemErrorMessage({ subject: "teste", detail: "<script>alert(1)</script>" });
    expect(message).not.toContain("<script>alert(1)</script>");
    expect(message).toContain("&lt;script&gt;");
  });

  it("buildSystemErrorMessage nunca vaza segredo (token/senha) mesmo se vier no detalhe", () => {
    const message = buildSystemErrorMessage({ subject: "teste", detail: "Authorization: Bearer sk_live_abcdef123456\npassword=minhaSenhaSecreta123" });
    expect(message).not.toContain("sk_live_abcdef123456");
    expect(message).not.toContain("minhaSenhaSecreta123");
    expect(message).toContain("[REDACTED]");
  });

  it("buildSystemErrorMessage trunca detalhe muito longo (limite do Telegram)", () => {
    const message = buildSystemErrorMessage({ subject: "teste", detail: "x".repeat(5000) });
    expect(message.length).toBeLessThan(4096);
  });

  it("buildSubscriptionRenewedMessage inclui o valor cobrado", () => {
    const message = buildSubscriptionRenewedMessage({ restaurantId: 9, restaurantName: "Restaurante Teste", amountCents: 24990 });
    expect(message).toContain("#9");
    expect(message).toContain("R$");
  });

  it("buildSubscriptionPastDueMessage explica o prazo de 5 dias", () => {
    const message = buildSubscriptionPastDueMessage({ restaurantId: 9, restaurantName: "Restaurante Teste" });
    expect(message).toContain("5 dias");
  });

  it("buildSubscriptionRecoveredMessage e buildSubscriptionCanceledMessage identificam o restaurante", () => {
    expect(buildSubscriptionRecoveredMessage({ restaurantId: 9, restaurantName: "Restaurante Teste" })).toContain("#9");
    expect(buildSubscriptionCanceledMessage({ restaurantId: 9, restaurantName: "Restaurante Teste" })).toContain("#9");
  });

  it("buildSubscriptionPastDueGraceExpiredMessage menciona o bloqueio", () => {
    const message = buildSubscriptionPastDueGraceExpiredMessage({ restaurantId: 9, restaurantName: "Restaurante Teste" });
    expect(message).toContain("bloqueado");
  });
});

describe("telegramService.sendTelegramDocument", () => {
  beforeEach(() => {
    mocks.env.telegramBotToken = "";
    mocks.env.telegramChatId = "";
    global.fetch = vi.fn();
  });

  it("sem TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID: não chama a API, retorna sent:false", async () => {
    const result = await sendTelegramDocument({ fileBuffer: Buffer.from("x"), fileName: "cardapio.pdf", mimeType: "application/pdf", caption: "teste" });
    expect(result).toEqual({ sent: false, reason: "not-configured" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("configurado: manda o arquivo como multipart/form-data", async () => {
    mocks.env.telegramBotToken = "bot-token-teste";
    mocks.env.telegramChatId = "12345";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });

    const result = await sendTelegramDocument({
      fileBuffer: Buffer.from("conteudo do arquivo"),
      fileName: "cardapio.pdf",
      mimeType: "application/pdf",
      caption: "Cardápio do Restaurante Teste",
    });

    expect(result).toEqual({ sent: true });
    const [url, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.telegram.org/botbot-token-teste/sendDocument");
    expect(requestInit.body).toBeInstanceOf(FormData);
    expect(requestInit.body.get("chat_id")).toBe("12345");
    expect(requestInit.body.get("caption")).toBe("Cardápio do Restaurante Teste");
  });

  it("nunca lança — mesmo com fetch rejeitando (falha de rede)", async () => {
    mocks.env.telegramBotToken = "bot-token-teste";
    mocks.env.telegramChatId = "12345";
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("rede fora do ar"));
    await expect(
      sendTelegramDocument({ fileBuffer: Buffer.from("x"), fileName: "cardapio.pdf", mimeType: "application/pdf", caption: "teste" }),
    ).resolves.toMatchObject({ sent: false });
  });
});

describe("telegramService.buildLeadMessage", () => {
  const base = { name: "Pizzaria do Zé", planName: "Profissional", contactEmail: "ze@exemplo.com", amountCents: 10000 };

  it("traz tudo que a pessoa preencheu e um link de WhatsApp com DDI 55", () => {
    const text = buildLeadMessage({ ...base, contactName: "José", contactPhone: "(88) 99940-1565" });
    expect(text).toContain("Possível cliente");
    expect(text).toContain("Pizzaria do Zé");
    expect(text).toContain("Profissional");
    expect(text).toContain("José");
    expect(text).toContain("ze@exemplo.com");
    expect(text).toContain("(88) 99940-1565");
    expect(text).toContain("https://wa.me/5588999401565");
    expect(text).toContain("Ainda não pagou");
  });

  it("não duplica o 55 quando o telefone já vem com DDI", () => {
    expect(buildLeadMessage({ ...base, contactPhone: "+55 88 99940-1565" })).toContain("https://wa.me/5588999401565");
  });

  it("sem telefone ou nome: omite essas linhas e o link", () => {
    const text = buildLeadMessage(base);
    expect(text).not.toContain("Telefone:");
    expect(text).not.toContain("Contato:");
    expect(text).not.toContain("wa.me");
  });

  it("telefone curto demais não gera link de WhatsApp quebrado", () => {
    expect(buildLeadMessage({ ...base, contactPhone: "12345" })).not.toContain("wa.me");
  });

  it("escapa HTML vindo do formulário público", () => {
    const text = buildLeadMessage({ ...base, name: "<b>X</b> & Cia", contactName: "<script>" });
    expect(text).not.toContain("<script>");
    expect(text).toContain("&lt;b&gt;X&lt;/b&gt; &amp; Cia");
  });
});
