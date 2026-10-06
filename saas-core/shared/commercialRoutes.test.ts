import { describe, expect, it } from "vitest";
import { resolveSpaStatus } from "./commercialRoutes";

describe("resolveSpaStatus", () => {
  it("200 para as rotas comerciais válidas", () => {
    for (const p of ["/comercial", "/comercial/planos", "/comercial/termos", "/comercial/privacidade", "/comercial/cadastro/sucesso", "/comercial/cadastro/confirmando", "/comercial/cadastro/cardapio", "/comercial/cadastro/essencial"]) {
      expect(resolveSpaStatus(p)).toBe(200);
    }
  });

  it("ignora query string, hash e barra final", () => {
    expect(resolveSpaStatus("/comercial/planos?utm_source=x")).toBe(200);
    expect(resolveSpaStatus("/comercial/planos/")).toBe(200);
    expect(resolveSpaStatus("/comercial#diferenciais")).toBe(200);
  });

  it("404 para caminhos inexistentes sob /comercial", () => {
    expect(resolveSpaStatus("/comercial/qualquer-coisa")).toBe(404);
    expect(resolveSpaStatus("/comercial/cadastro")).toBe(404);
    expect(resolveSpaStatus("/comercial/cadastro/a/b")).toBe(404);
    expect(resolveSpaStatus("/comercial/planos/extra")).toBe(404);
  });

  it("não afeta rotas fora de /comercial", () => {
    for (const p of ["/", "/login", "/restaurantes/3", "/api/trpc/x", "/comercialx", "/qualquer"]) {
      expect(resolveSpaStatus(p)).toBe(200);
    }
  });
});
