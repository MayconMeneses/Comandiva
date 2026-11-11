import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMERCIAL_PAGE_META } from "../shared/commercialPageMeta";

// Regra do dono: preço anunciado = preço cobrado. O preço inicial do plano de
// entrada nasce em scripts/seed-plans.ts (o seed é um script que executa ao ser
// importado, por isso é lido como texto). Estes testes pegam divergência no
// texto da meta de /comercial/planos e na constante do site de venda.
const root = resolve(import.meta.dirname, "..");
const seed = readFileSync(resolve(root, "scripts/seed-plans.ts"), "utf8");
const seedEntryCents = Number(/key: "essencial"[^}]*priceCents: (\d+)/.exec(seed)?.[1]);
const brl = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;

const sitePricingPath = resolve(root, "../Site comercial futurista/src/data/pricing.ts");

describe("preço de entrada anunciado = preço do seed do plano de entrada", () => {
  it("lê o preço do plano essencial no seed", () => {
    expect(Number.isInteger(seedEntryCents) && seedEntryCents > 0).toBe(true);
  });

  it("a meta description de /comercial/planos usa o mesmo valor", () => {
    expect(COMMERCIAL_PAGE_META["/comercial/planos"].description).toContain(`A partir de ${brl(seedEntryCents)}/mês`);
  });

  // O site de venda fica fora do contexto de build do Master em produção; o teste só roda no monorepo.
  it.skipIf(!existsSync(sitePricingPath))("ENTRY_PRICE_CENTS do site de venda é igual ao do seed", () => {
    const siteCents = Number(/ENTRY_PRICE_CENTS = (\d+)/.exec(readFileSync(sitePricingPath, "utf8"))?.[1]);
    expect(siteCents).toBe(seedEntryCents);
  });
});
