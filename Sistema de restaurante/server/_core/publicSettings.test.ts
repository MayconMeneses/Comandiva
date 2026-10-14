import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { withoutPixFields } from "./publicSettings";

describe("withoutPixFields", () => {
  it("remove a chave Pix e o QR e mantém o resto", () => {
    const result = withoutPixFields({ id: 1, storeName: "Comandiva", pixKey: "123.456.789-00", pixQrCodeUrl: "https://x/qr.png", deliveryFeeCents: 500 });
    expect(result).toEqual({ id: 1, storeName: "Comandiva", deliveryFeeCents: 500 });
    expect(JSON.stringify(result)).not.toContain("123.456.789-00");
  });

  it("não quebra quando os campos já não existem", () => {
    expect(withoutPixFields({ id: 1 })).toEqual({ id: 1 });
  });
});

describe("rotas públicas que devolvem as configurações usam withoutPixFields", () => {
  // order.preview devolvia a linha inteira de restaurant_settings (com pixKey) para qualquer visitante.
  const read = (path: string) => readFileSync(resolve(import.meta.dirname, "..", "..", path), "utf8");
  it("order.preview", () => {
    const src = read("server/routers/order.ts");
    const preview = src.slice(src.indexOf("preview: publicProcedure"), src.indexOf("create: publicProcedure"));
    expect(preview).toContain("withoutPixFields(priced.settings)");
  });
  it("catalog.settings", () => {
    expect(read("server/routers/catalog.ts")).toContain("withoutPixFields(settings)");
  });
});
