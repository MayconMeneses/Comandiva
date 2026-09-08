import { describe, expect, it } from "vitest";
import { checkoutSchema } from "./routers/order";

const baseInput = {
  items: [{ productId: 1, quantity: 1, addonOptionIds: [] }],
  fulfillmentType: "DELIVERY" as const,
  paymentMethod: "PIX" as const,
  customer: { name: "Cliente de Teste", phone: "(85) 99999-1234" },
};

describe("validação do checkout", () => {
  it("exige endereço quando o pedido é delivery", () => {
    const result = checkoutSchema.safeParse(baseInput);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some(issue => issue.path[0] === "address")).toBe(true);
  });

  it("aceita retirada sem endereço e normaliza o telefone", () => {
    const result = checkoutSchema.safeParse({ ...baseInput, fulfillmentType: "PICKUP" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.customer.phone).toBe("85999991234");
  });

  it("aceita delivery completo com uma cópia do endereço do pedido", () => {
    const result = checkoutSchema.safeParse({
      ...baseInput,
      address: {
        postalCode: "60000-000",
        street: "Rua do Mercado",
        number: "120",
        neighborhood: "Centro",
        city: "Fortaleza",
        state: "ce",
      },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.address?.state).toBe("CE");
  });
});
