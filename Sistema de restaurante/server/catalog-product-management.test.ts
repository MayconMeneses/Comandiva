import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(new URL("./routers/admin/catalog.ts", import.meta.url), "utf8");
const catalogSource = readFileSync(new URL("../client/src/components/CatalogProductAvailability.tsx", import.meta.url), "utf8");

describe("manutenção de produtos do catálogo", () => {
  it("remove itens por arquivamento para preservar pedidos históricos", () => {
    expect(routerSource).toContain('deleteProduct: restaurantProcedureFor("catalog")');
    expect(routerSource).toContain("archivedAt: now");
    expect(routerSource).toContain("where(isNull(products.archivedAt))");
  });

  it("oferece edição e exclusão explícitas em cada cartão de produto", () => {
    expect(catalogSource).toContain(">Editar<");
    expect(catalogSource).toContain(">Excluir<");
    expect(catalogSource).toContain("Manutenção de produto");
    expect(catalogSource).toContain("Produto atualizado com sucesso.");
    expect(catalogSource).toContain("Produto removido do cardápio.");
  });
});
