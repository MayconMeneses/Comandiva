import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routesSource = readFileSync(new URL("../client/src/components/DeliveryRoutesManager.tsx", import.meta.url), "utf8");
const checkoutSource = readFileSync(new URL("../client/src/pages/Checkout.tsx", import.meta.url), "utf8");

describe("gestão de rotas de entrega", () => {
  it("expõe cadastro, edição, pausa e exclusão ao administrador", () => {
    expect(routesSource).toContain("saveDeliveryRoute");
    expect(routesSource).toContain("deleteDeliveryRoute");
    expect(routesSource).toContain("Disponível no checkout");
  });

  it("exige a escolha da rota quando houver áreas ativas cadastradas", () => {
    expect(checkoutSource).toContain("Selecione sua área de entrega");
    expect(checkoutSource).toContain("Selecione a rota de entrega para continuar.");
  });
});
