import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cobre as garantias que mais importam no assistente de manutenção: nunca
 * chama a API sem chave configurada, nunca lança (falha de rede/API sempre
 * vira um erro amigável, nunca derruba a mutation), e nunca manda dado
 * pessoal de contato (e-mail/telefone) pra fora — só o que é necessário pra
 * responder sobre o estado operacional da plataforma.
 */
const mocks = vi.hoisted(() => ({
  env: { anthropicApiKey: "" },
  listRestaurantsForPanel: vi.fn(),
  listPlatformAuditLog: vi.fn(),
}));

vi.mock("./env", () => ({ ENV: mocks.env }));
vi.mock("../db/restaurants", () => ({ listRestaurantsForPanel: mocks.listRestaurantsForPanel }));
vi.mock("../db/auditLog", () => ({ listPlatformAuditLog: mocks.listPlatformAuditLog }));

const { askMaintenanceAssistant } = await import("./maintenanceAssistant");

describe("askMaintenanceAssistant", () => {
  beforeEach(() => {
    mocks.env.anthropicApiKey = "";
    mocks.listRestaurantsForPanel.mockReset().mockResolvedValue({ restaurants: [], total: 0 });
    mocks.listPlatformAuditLog.mockReset().mockResolvedValue([]);
    global.fetch = vi.fn();
  });

  it("sem ANTHROPIC_API_KEY configurada: não chama a API, devolve erro amigável", async () => {
    const result = await askMaintenanceAssistant("quantos restaurantes existem?");
    expect(result.error).toContain("ANTHROPIC_API_KEY");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("com a chave configurada, devolve o texto respondido pela API", async () => {
    mocks.env.anthropicApiKey = "sk-ant-teste";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: "Há 3 restaurantes ativos." }] }),
    });

    const result = await askMaintenanceAssistant("quantos restaurantes existem?");
    expect(result).toEqual({ answer: "Há 3 restaurantes ativos." });
  });

  it("manda os dados agregados no corpo da requisição, sem contactEmail/contactPhone", async () => {
    mocks.env.anthropicApiKey = "sk-ant-teste";
    mocks.listRestaurantsForPanel.mockResolvedValue({
      restaurants: [
        {
          id: 1,
          name: "Restaurante Teste",
          contactEmail: "dono@teste.com",
          contactPhone: "11999990000",
          status: "active",
          deploymentUrl: "https://x.exemplo.com",
          cancelledAt: null,
          subscription: { status: "active", currentPeriodEnd: 123 },
          plan: { key: "profissional" },
        },
      ],
      total: 1,
    });
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: "text", text: "ok" }] }) });

    await askMaintenanceAssistant("pergunta de teste");

    const [, requestInit] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(requestInit.body);
    const userMessage = body.messages[0].content as string;
    expect(userMessage).toContain("Restaurante Teste");
    expect(userMessage).not.toContain("dono@teste.com");
    expect(userMessage).not.toContain("11999990000");
  });

  it("resposta não-ok da API: devolve erro amigável, não lança", async () => {
    mocks.env.anthropicApiKey = "sk-ant-teste";
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500, text: async () => "erro interno" });

    const result = await askMaintenanceAssistant("pergunta de teste");
    expect(result.error).toContain("não conseguiu responder");
  });

  it("falha de rede: nunca lança, devolve erro amigável", async () => {
    mocks.env.anthropicApiKey = "sk-ant-teste";
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("rede fora do ar"));

    const result = await askMaintenanceAssistant("pergunta de teste");
    expect(result.error).toContain("não conseguiu responder");
  });
});
