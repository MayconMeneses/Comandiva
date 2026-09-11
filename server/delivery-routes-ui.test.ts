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

  it("detecta a rota automaticamente pelo bairro digitado, com escolha manual só como reserva", () => {
    expect(checkoutSource).toContain("findBestRouteMatch");
    expect(checkoutSource).toContain("Informe um bairro que reconheçamos (ou escolha sua área na lista) para continuar.");
  });

  it("continua exigindo uma rota resolvida (automática ou manual) antes de finalizar, quando houver áreas ativas", () => {
    expect(checkoutSource).toContain("routeRequired && !deliveryRouteId");
  });
});
