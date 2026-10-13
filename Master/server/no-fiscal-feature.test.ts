import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Decisão do dono (2026-10-07): restaurante não emite nota fiscal, então nenhuma
// parte do produto pode oferecer, chamar ou prometer isso. (Os testes do app dos
// restaurantes ficam em Sistema de restaurante/server/no-fiscal-feature.test.ts.)
const read = (path: string) => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

describe("nota fiscal fora do produto (Master e site comercial)", () => {
  it("o seed de planos aposenta o recurso 'fiscal' em vez de oferecê-lo", () => {
    const seed = read("scripts/seed-plans.ts");
    expect(seed).not.toMatch(/featureId: "fiscal"/);
    expect(seed).toContain('RETIRED_FEATURE_IDS = ["fiscal"]');
  });

  it("o site comercial não menciona nota fiscal", () => {
    for (const file of ["client/src/site-comercial/pages/Home.tsx", "client/src/site-comercial/pages/Planos.tsx", "client/public/llms.txt"]) {
      expect(read(file), file).not.toMatch(/nota fiscal|nfc-?e|fiscal/i);
    }
  });
});
