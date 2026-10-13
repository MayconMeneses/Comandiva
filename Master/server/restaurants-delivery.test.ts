import { describe, expect, it } from "vitest";
import { addBusinessDays } from "./db/restaurants";

describe("addBusinessDays", () => {
  it("pula fim de semana ao contar dias úteis", () => {
    // Segunda-feira 2026-01-05 12:00 (horário de Brasília, UTC-3)
    const monday = new Date("2026-01-05T12:00:00-03:00").getTime();
    // +5 dias úteis a partir de segunda = a segunda seguinte (pula sáb/dom no meio).
    const result = new Date(addBusinessDays(monday, 5));
    expect(result.getUTCDay()).toBe(1); // segunda-feira
    expect(result.toISOString().slice(0, 10)).toBe("2026-01-12");
  });

  it("nunca cai num sábado ou domingo, não importa o dia de partida", () => {
    for (let offset = 0; offset < 7; offset += 1) {
      const start = new Date("2026-01-05T12:00:00-03:00").getTime() + offset * 24 * 60 * 60 * 1000;
      const result = new Date(addBusinessDays(start, 10));
      expect([0, 6]).not.toContain(result.getDay());
    }
  });

  it("10 dias úteis a partir de uma sexta-feira cai duas semanas e meia depois", () => {
    // Sexta-feira 2026-01-02
    const friday = new Date("2026-01-02T09:00:00-03:00").getTime();
    const result = new Date(addBusinessDays(friday, 10));
    expect(result.toISOString().slice(0, 10)).toBe("2026-01-16");
  });
});
