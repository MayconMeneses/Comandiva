import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Decisão do dono (2026-10-16): o Painel Master manda nos planos (preço, mesas,
// recursos, manutenção) e o site comercial reflete. O seed roda em TODO boot do
// container, então ele não pode sobrescrever o que foi editado no painel.
const read = (path: string) => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

describe("seed de planos respeita o que foi editado no Painel Master", () => {
  const seed = read("scripts/seed-plans.ts");

  it("só cria o que falta: nenhum upsert que reescreva preço, nome, posição ou limite", () => {
    expect(seed).not.toMatch(/onDuplicateKeyUpdate\(\{ set: \{[^}]*(priceCents|name|position|limitValue|maintenanceCents)/);
    expect(seed).toContain("existingPlanKeys");
    expect(seed).toContain("existingLimits");
  });

  it("não remove vínculos de recurso marcados no painel (só os recursos aposentados)", () => {
    expect(seed).not.toContain("allowedFeatureIds");
    expect(seed).toContain("RETIRED_FEATURE_IDS");
  });

  it("recurso novo só entra nos planos quando é criado (newFeatures)", () => {
    expect(seed).toContain("newFeatures");
  });

  it("Entrada começa com manutenção de R$ 50 e os demais incluem (nulo)", () => {
    expect(seed).toMatch(/key: "essencial".*maintenanceCents: 5000/);
    expect(seed).toMatch(/key: "profissional".*maintenanceCents: null/);
    expect(seed).toMatch(/key: "premium".*maintenanceCents: null/);
  });
});

describe("manutenção do plano editável no Painel Master e exposta ao site", () => {
  it("a coluna existe no schema e na migration (com o valor inicial do Entrada)", () => {
    expect(read("drizzle/schema/plans.ts")).toContain('maintenanceCents: int("maintenanceCents")');
    const sql = read("drizzle/0014_plans_maintenance.sql");
    expect(sql).toContain("ADD `maintenanceCents` int");
    expect(sql).toContain("SET `maintenanceCents` = 5000 WHERE `key` = 'essencial'");
  });

  it("o painel envia e o servidor aceita maintenanceCents (nulo = inclusa)", () => {
    expect(read("server/routers/masterPanel/plans.ts")).toContain("maintenanceCents: z.number().int().nonnegative().nullable().optional()");
    expect(read("server/db/plans.ts")).toContain("input.maintenanceCents !== undefined");
    expect(read("client/src/pages/Plans.tsx")).toContain("maintenanceCents");
  });

  it("a API pública devolve o plano inteiro (inclui maintenanceCents) para o site", () => {
    expect(read("server/routers/public.ts")).toContain("...plan, featureNames");
  });
});
