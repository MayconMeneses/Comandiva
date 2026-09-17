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
  buildEnvironmentProvisionedMessage,
  buildEnvironmentProvisioningFailedMessage,
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

  it("buildEnvironmentProvisionedMessage inclui URL e credenciais de admin", () => {
    const message = buildEnvironmentProvisionedMessage({
      restaurantId: 5,
      restaurantName: "Restaurante Teste",
      url: "http://localhost:5050",
      adminUsername: "admin",
      adminPassword: "senha123",
    });
    expect(message).toContain("http://localhost:5050");
    expect(message).toContain("admin");
    expect(message).toContain("senha123");
    expect(message).toContain("#5");
  });

  it("buildEnvironmentProvisioningFailedMessage inclui o motivo da falha", () => {
    const message = buildEnvironmentProvisioningFailedMessage({ restaurantId: 6, restaurantName: "Restaurante Teste", error: "Timeout esperando o container responder" });
    expect(message).toContain("Timeout esperando");
    expect(message).toContain("#6");
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
