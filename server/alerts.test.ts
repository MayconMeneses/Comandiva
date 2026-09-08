import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  ENV: {
    isProduction: false,
    smtpHost: "", smtpUser: "", smtpPassword: "", smtpPort: 587, smtpFrom: "Pub X <noreply@example.com>",
    alertEmailTo: "", alertWebhookUrl: "",
    telegramBotToken: "", telegramChatId: "",
  },
}));

vi.mock("./_core/env", () => mockEnv);
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn() } }));

import { sendOwnerAlert } from "./_core/alerts";

describe("alertas do dono (e-mail/webhook/Telegram)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
    Object.assign(mockEnv.ENV, { telegramBotToken: "", telegramChatId: "", alertWebhookUrl: "", alertEmailTo: "" });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("não chama o Telegram quando não está configurado", async () => {
    await sendOwnerAlert("Assunto", "Mensagem", "kind-sem-telegram");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia para o Telegram com o token e chat configurados", async () => {
    mockEnv.ENV.telegramBotToken = "123:ABC";
    mockEnv.ENV.telegramChatId = "999";
    await sendOwnerAlert("Erro grave", "Algo quebrou", "kind-telegram-ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
    const body = JSON.parse((options as RequestInit).body as string);
    expect(body.chat_id).toBe("999");
    expect(body.text).toContain("Erro grave");
    expect(body.text).toContain("Algo quebrou");
  });

  it("mascara segredos antes de enviar para qualquer canal", async () => {
    mockEnv.ENV.telegramBotToken = "123:ABC";
    mockEnv.ENV.telegramChatId = "999";
    await sendOwnerAlert("Falha", "Authorization: Bearer sk-real-secret-value senha: minhaSenha123", "kind-redact");
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.text).not.toContain("sk-real-secret-value");
    expect(body.text).not.toContain("minhaSenha123");
    expect(body.text).toContain("[REDACTED]");
  });

  it("não propaga erro quando o Telegram falha (resiliência)", async () => {
    mockEnv.ENV.telegramBotToken = "123:ABC";
    mockEnv.ENV.telegramChatId = "999";
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(sendOwnerAlert("Falha", "Mensagem", "kind-telegram-fail")).resolves.toBeUndefined();
  });

  it("respeita o cooldown: não reenvia o mesmo tipo antes de 10 minutos", async () => {
    mockEnv.ENV.telegramBotToken = "123:ABC";
    mockEnv.ENV.telegramChatId = "999";
    await sendOwnerAlert("Falha", "Primeira", "kind-cooldown");
    await sendOwnerAlert("Falha", "Segunda", "kind-cooldown");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("usa severidade INFO para o teste e ERROR por padrão para tipos desconhecidos", async () => {
    mockEnv.ENV.telegramBotToken = "123:ABC";
    mockEnv.ENV.telegramChatId = "999";
    await sendOwnerAlert("Teste de notificação", "ok", "test");
    const infoBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(infoBody.text).toContain("🟢 INFO");

    await sendOwnerAlert("Algo estranho", "detalhe", "kind-desconhecido");
    const errorBody = JSON.parse(fetchMock.mock.calls[1]![1].body as string);
    expect(errorBody.text).toContain("🟠 ERROR");
  });
});
