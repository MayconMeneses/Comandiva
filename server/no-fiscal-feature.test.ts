import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { adminRouter } from "./routers/admin";

// Decisão do dono (2026-10-07): restaurante não emite nota fiscal, então
// nenhuma parte do produto pode oferecer, chamar ou prometer isso.
const read = (path: string) => readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

describe("nota fiscal fora do produto", () => {
  it("o roteador admin não expõe nenhum procedimento fiscal/NFC-e", () => {
    const names = Object.keys(adminRouter._def.procedures);
    expect(names.filter(name => /fiscal|nfce|danfe/i.test(name))).toEqual([]);
  });

  it("menu do admin, página Admin e comprovante não citam nota fiscal", () => {
    for (const file of ["client/src/components/DashboardLayout.tsx", "client/src/pages/Admin.tsx", "client/src/App.tsx", "client/src/components/admin/Receipt.tsx"]) {
      expect(read(file), file).not.toMatch(/fiscal|nfc-?e|danfe/i);
    }
  });

  it("política de privacidade e termos de uso não prometem documento fiscal", () => {
    for (const file of ["client/src/pages/PrivacyPolicy.tsx", "client/src/pages/TermsOfUse.tsx"]) {
      expect(read(file), file).not.toMatch(/documento fiscal|nfc-?e|nf-e/i);
    }
  });

  it("o pedido não dispara emissão em nenhum ponto (pagamento, entrega, mesa)", () => {
    for (const file of ["server/payments/paymentService.ts", "server/routers/admin/orders.ts", "server/routers/admin/tables.ts", "server/routers/admin/catalog.ts"]) {
      expect(read(file), file).not.toMatch(/nfce|fiscal/i);
    }
  });

  it("o seed de planos do saas-core aposenta o recurso 'fiscal' em vez de oferecê-lo", () => {
    const seed = read("saas-core/scripts/seed-plans.ts");
    expect(seed).not.toMatch(/featureId: "fiscal"/);
    expect(seed).toContain('RETIRED_FEATURE_IDS = ["fiscal"]');
  });

  it("o site comercial não menciona nota fiscal", () => {
    for (const file of ["saas-core/client/src/pages/comercial/Home.tsx", "saas-core/client/src/pages/comercial/Planos.tsx", "saas-core/client/public/llms.txt"]) {
      expect(read(file), file).not.toMatch(/nota fiscal|nfc-?e|fiscal/i);
    }
  });
});
