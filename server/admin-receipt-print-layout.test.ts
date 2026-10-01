import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Bug real reportado ao vivo pelo usuário com foto (2026-10-01): imprimindo
 * um comprovante de pedido como ADMIN, o menu lateral do painel
 * (DashboardLayout) saía junto na impressão — DashboardLayout não tem CSS
 * de impressão pra se esconder. Causa: `Admin()` só pulava o
 * DashboardLayout pra `/admin/comprovante/:id` quando o usuário era staff
 * SEM permissão extra (`user.role === "staff" && isReceiptRoute`); um admin
 * de verdade caía direto no `return <DashboardLayout>...` de baixo. A
 * própria Receipt.tsx já tem seu botão "Voltar aos pedidos" (print:hidden),
 * então o layout nunca fazia falta ali pra nenhum papel — corrigido
 * verificando `isReceiptRoute` ANTES de qualquer checagem de papel, pra
 * todo mundo.
 */
const adminSource = readFileSync(resolve(import.meta.dirname, "../client/src/pages/Admin.tsx"), "utf8");

describe("Admin.tsx — comprovante nunca renderiza dentro do DashboardLayout, pra nenhum papel", () => {
  it("isReceiptRoute é checado (e retorna) antes de qualquer checagem de papel/permissão", () => {
    const receiptCheckIndex = adminSource.indexOf("if (isReceiptRoute) return");
    const roleCheckIndex = adminSource.indexOf("if (user.role !== \"admin\"");
    const dashboardLayoutIndex = adminSource.indexOf("return <DashboardLayout>");
    expect(receiptCheckIndex).toBeGreaterThan(-1);
    expect(receiptCheckIndex).toBeLessThan(roleCheckIndex);
    expect(receiptCheckIndex).toBeLessThan(dashboardLayoutIndex);
  });

  it("não sobrou nenhum bypass condicionado só a staff (regressão: admin caía no DashboardLayout)", () => {
    expect(adminSource).not.toContain('if (user.role === "staff" && isReceiptRoute)');
  });

  it("AdminContent não trata mais \"comprovante\" (rota já interceptada antes de chegar lá — código morto removido)", () => {
    expect(adminSource).not.toContain('if (page === "comprovante")');
  });
});
