import { describe, expect, it } from "vitest";
import { ALLOWED_STATUS_TRANSITIONS, calculateCartTotal, endOfDayInRestaurantTimezone, isCategoryCurrentlyAvailable, normalizePhone, startOfDayInRestaurantTimezone } from "../shared/orderDomain";

describe("regras de pedidos", () => {
  it("normaliza telefones brasileiros removendo pontuação e código 55", () => {
    expect(normalizePhone("+55 (85) 99999-1234")).toBe("85999991234");
    expect(normalizePhone("(85) 3333-2222")).toBe("8533332222");
  });

  it("calcula subtotal, taxa e total sem arredondamentos monetários indevidos", () => {
    expect(calculateCartTotal([
      { unitPriceCents: 1500, quantity: 2 },
      { unitPriceCents: 700, quantity: 1 },
    ], 700)).toEqual({ subtotalCents: 3700, deliveryFeeCents: 700, totalCents: 4400 });
  });

  it("permite os caminhos operacionais previstos e bloqueia reversões", () => {
    expect(ALLOWED_STATUS_TRANSITIONS.PENDING).toContain("ACCEPTED");
    expect(ALLOWED_STATUS_TRANSITIONS.PREPARING).toContain("READY_FOR_PICKUP");
    expect(ALLOWED_STATUS_TRANSITIONS.COMPLETED).toHaveLength(0);
    expect(ALLOWED_STATUS_TRANSITIONS.CANCELLED).toHaveLength(0);
  });
});

/**
 * Cobertura que faltava (auditoria V-14): a janela de horário que cruza a
 * meia-noite é a ramificação mais fácil de inverter por engano, e o CI roda
 * em UTC (3h de diferença do fuso real do restaurante) — sem teste, uma
 * regressão passaria despercebida. America/Fortaleza é UTC-3 fixo (sem
 * horário de verão desde 2019), então os instantes UTC abaixo são só
 * "horário local + 3h", calculados à mão pra deixar claro o que cada um
 * representa.
 */
describe("isCategoryCurrentlyAvailable — janela de horário", () => {
  it("ALWAYS sempre aparece, mesmo sem nenhum horário configurado", () => {
    expect(isCategoryCurrentlyAvailable({ timeAvailability: "ALWAYS" }, null)).toBe(true);
  });

  it("LUNCH/DINNER/LUNCH_AND_DINNER sem janela configurada nunca ficam escondidas", () => {
    const noWindows = { lunchStartTime: null, lunchEndTime: null, dinnerStartTime: null, dinnerEndTime: null };
    expect(isCategoryCurrentlyAvailable({ timeAvailability: "LUNCH" }, noWindows)).toBe(true);
    expect(isCategoryCurrentlyAvailable({ timeAvailability: "DINNER" }, noWindows)).toBe(true);
    expect(isCategoryCurrentlyAvailable({ timeAvailability: "LUNCH_AND_DINNER" }, noWindows)).toBe(true);
  });

  it("janela que cruza a meia-noite (22:00–02:00): fora um minuto antes do início", () => {
    const settings = { dinnerStartTime: "22:00", dinnerEndTime: "02:00" };
    const oneMinuteBeforeStart = new Date(Date.UTC(2026, 0, 16, 0, 59)); // 21:59 em Fortaleza (UTC-3)
    expect(isCategoryCurrentlyAvailable({ timeAvailability: "DINNER" }, settings, oneMinuteBeforeStart)).toBe(false);
  });

  it("janela que cruza a meia-noite: dentro bem no início (22:00)", () => {
    const settings = { dinnerStartTime: "22:00", dinnerEndTime: "02:00" };
    const atStart = new Date(Date.UTC(2026, 0, 16, 1, 0)); // 22:00 em Fortaleza
    expect(isCategoryCurrentlyAvailable({ timeAvailability: "DINNER" }, settings, atStart)).toBe(true);
  });

  it("janela que cruza a meia-noite: dentro um minuto antes do fim (01:59)", () => {
    const settings = { dinnerStartTime: "22:00", dinnerEndTime: "02:00" };
    const oneMinuteBeforeEnd = new Date(Date.UTC(2026, 0, 16, 4, 59)); // 01:59 em Fortaleza, já no dia seguinte local
    expect(isCategoryCurrentlyAvailable({ timeAvailability: "DINNER" }, settings, oneMinuteBeforeEnd)).toBe(true);
  });

  it("janela que cruza a meia-noite: fora bem no fim (02:00, limite exclusivo)", () => {
    const settings = { dinnerStartTime: "22:00", dinnerEndTime: "02:00" };
    const atEnd = new Date(Date.UTC(2026, 0, 16, 5, 0)); // 02:00 em Fortaleza
    expect(isCategoryCurrentlyAvailable({ timeAvailability: "DINNER" }, settings, atEnd)).toBe(false);
  });
});

/**
 * Auditoria V-25: o dashboard/relatórios do admin calculava "hoje" no fuso
 * de quem tinha o navegador aberto — agora sempre no fuso do restaurante,
 * calculado no servidor. Testes abaixo fixam a data em vez de usar "agora"
 * (senão o teste ficaria dependente do dia em que roda).
 */
describe("startOfDayInRestaurantTimezone / endOfDayInRestaurantTimezone", () => {
  it("meia-noite em Fortaleza (UTC-3) é 03:00 UTC do mesmo dia", () => {
    const someInstantOn15th = new Date(Date.UTC(2026, 0, 15, 18, 0)); // 15:00 em Fortaleza, ainda dia 15 local
    expect(startOfDayInRestaurantTimezone(0, someInstantOn15th)).toBe(Date.UTC(2026, 0, 15, 3, 0, 0, 0));
  });

  it("N dias atrás conta em dias de calendário no fuso do restaurante, não em 24h corridas", () => {
    const someInstantOn15th = new Date(Date.UTC(2026, 0, 15, 18, 0));
    expect(startOfDayInRestaurantTimezone(7, someInstantOn15th)).toBe(Date.UTC(2026, 0, 8, 3, 0, 0, 0));
  });

  it("fim do dia é exatamente 1ms antes do início do dia seguinte", () => {
    const start = startOfDayInRestaurantTimezone(0, new Date(Date.UTC(2026, 0, 15, 18, 0)));
    expect(endOfDayInRestaurantTimezone("2026-01-15")).toBe(start + 24 * 60 * 60 * 1000 - 1);
  });
});
