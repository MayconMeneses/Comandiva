import { beforeEach, describe, expect, it, vi } from "vitest";
import { customerAddresses, customerChangeLogs, customers } from "../drizzle/schema";

/**
 * Achado de segurança (auditoria desta sessão, P1): `saveCustomerProfile`
 * sobrescrevia incondicionalmente nome + endereço padrão de um telefone já
 * cadastrado, sem nenhuma verificação de posse — chamado a partir de
 * `order.create` e `table.addRound`, os dois SEM sessão/login. Um atacante
 * sabendo o telefone de um cliente real (vazamento comum: nota fiscal,
 * WhatsApp) conseguia plantar um endereço próprio como o endereço PADRÃO
 * daquele telefone, silenciosamente, só fazendo um pedido — endereço esse
 * reaproveitado depois pra pré-preencher o checkout da PRÓXIMA compra
 * legítima da vítima.
 *
 * Corrigido: `saveCustomerProfile` (server/db/customers.ts) só grava
 * nome/endereço quando o telefone é NOVO; telefone já cadastrado nunca é
 * alterado por essa função (ver server/order-create-customer-name.test.ts
 * pela outra metade da correção: o pedido em si sempre usa o que foi
 * digitado nesta compra, nunca o valor devolvido daqui).
 */
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/client", () => ({ getDb: mocks.getDb }));

import { saveCustomerProfile } from "./db/customers";

function makeFakeDb() {
  const customerRows: { id: number; phone: string; name: string; createdAt: number; updatedAt: number }[] = [];
  let nextCustomerId = 1;
  let nextAddressId = 1;

  const db = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          // Simplificação deliberada: cada teste usa um único telefone/cliente
          // por vez nesta fake db, então devolver "tudo que existe na tabela"
          // equivale a filtrar pelo telefone de verdade.
          limit: async () => (table === customers ? customerRows.slice(0, 1) : []),
          orderBy: async () => [],
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: async (payload: Record<string, unknown>) => {
        if (table === customers) {
          const id = nextCustomerId++;
          customerRows.push({ id, phone: payload.phone as string, name: payload.name as string, createdAt: payload.createdAt as number, updatedAt: payload.updatedAt as number });
          return [{ insertId: id }];
        }
        if (table === customerAddresses) return [{ insertId: nextAddressId++ }];
        if (table === customerChangeLogs) return [{ insertId: 1 }];
        throw new Error(`insert inesperado na tabela ${String(table)}`);
      },
    }),
    update: (table: unknown) => ({
      set: () => ({
        where: async () => {
          if (table === customers) throw new Error("REGRESSÃO: saveCustomerProfile tentou UPDATE em customers já existente — exatamente a falha do achado P1 (sobrescrita sem prova de posse).");
          if (table === customerAddresses) throw new Error("REGRESSÃO: saveCustomerProfile tentou UPDATE em customerAddresses de cliente já existente — mesma falha do achado P1.");
        },
      }),
    }),
  };
  return { db, customerRows };
}

describe("saveCustomerProfile — nunca sobrescreve um telefone já cadastrado (regressão do achado P1)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("telefone novo: cria cliente normalmente", async () => {
    const { db } = makeFakeDb();
    mocks.getDb.mockResolvedValue(db);

    const result = await saveCustomerProfile({
      phone: "85999990001",
      name: "Cliente Legítimo",
      address: { street: "Rua A", number: "10", neighborhood: "Centro", city: "Croatá", state: "CE" },
    });

    expect(result?.name).toBe("Cliente Legítimo");
  });

  it("telefone já cadastrado: mantém o nome original mesmo quando chamado de novo com um nome diferente", async () => {
    const { db, customerRows } = makeFakeDb();
    mocks.getDb.mockResolvedValue(db);

    await saveCustomerProfile({ phone: "85999990002", name: "Cliente Real", address: { street: "Rua da Vítima", number: "1", neighborhood: "Bairro", city: "Croatá", state: "CE" } });
    expect(customerRows).toHaveLength(1);
    expect(customerRows[0].name).toBe("Cliente Real");

    // "Ataque": alguém que só sabe o telefone tenta sobrescrever nome/endereço.
    // Se saveCustomerProfile chamasse .update() aqui, o mock acima lançaria erro.
    const attackResult = await saveCustomerProfile({
      phone: "85999990002",
      name: "Nome do Atacante",
      address: { street: "Endereço do Atacante", number: "666", neighborhood: "Outro Bairro", city: "Outra Cidade", state: "SP" },
    });

    expect(customerRows).toHaveLength(1); // nenhum segundo cliente criado
    expect(customerRows[0].name).toBe("Cliente Real"); // nome original intacto
    expect(attackResult?.name).toBe("Cliente Real");
  });
});
