import { and, desc, eq } from "drizzle-orm";
import { customerAddresses, customerChangeLogs, customers, orders } from "../../drizzle/schema";
import { getDb } from "./client";

/**
 * Anonimiza um cliente (LGPD, art. 15/16) — nome/telefone/endereço trocados
 * por um valor anônimo, mas o histórico financeiro dos pedidos (itens,
 * valores, datas, status de pagamento) é preservado, é a parte que o Fisco
 * pode exigir dentro do prazo de retenção (ver shared/legal.ts). Usada tanto
 * pela varredura automática de inatividade (scripts/anonymize-inactive-customers.ts)
 * quanto pelo pedido de exclusão sob demanda (server/routers/dataRights.ts)
 * — um único lugar pra essa lógica, pra nunca divergir entre os dois casos.
 */
export async function anonymizeCustomer(customerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const anonPhone = `anon-${customerId}`;
  const now = Date.now();
  await db.update(customers).set({ name: "Cliente removido", phone: anonPhone, phoneVerifiedAt: null, updatedAt: now }).where(eq(customers.id, customerId));
  await db.delete(customerAddresses).where(eq(customerAddresses.customerId, customerId));
  await db.delete(customerChangeLogs).where(eq(customerChangeLogs.customerId, customerId));
  await db
    .update(orders)
    .set({
      customerName: "Cliente removido",
      customerPhone: anonPhone,
      customerNote: null,
      internalNote: null,
      deliveryPostalCode: null,
      deliveryStreet: null,
      deliveryNumber: null,
      deliveryComplement: null,
      deliveryNeighborhood: null,
      deliveryCity: null,
      deliveryState: null,
      deliveryReference: null,
      updatedAt: now,
    })
    .where(eq(orders.customerId, customerId));
}

export async function getCustomerByPhone(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [customer] = await db.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  if (!customer) return undefined;
  const addresses = await db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customer.id))
    .orderBy(desc(customerAddresses.isDefault), desc(customerAddresses.updatedAt));
  return { ...customer, addresses };
}

export async function saveCustomerProfile(input: {
  phone: string;
  name: string;
  address?: {
    postalCode?: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    reference?: string;
  };
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  const found = await getCustomerByPhone(input.phone);
  let customerId: number;
  if (found) {
    customerId = found.id;
    await db.update(customers).set({ name: input.name, updatedAt: now }).where(eq(customers.id, customerId));
    await db.insert(customerChangeLogs).values({
      customerId,
      changeType: "PROFILE_UPDATED",
      details: JSON.stringify({ source: "checkout" }),
      createdAt: now,
    });
  } else {
    const result = await db.insert(customers).values({
      phone: input.phone,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    });
    customerId = Number(result[0].insertId);
    await db.insert(customerChangeLogs).values({
      customerId,
      changeType: "PROFILE_CREATED",
      details: JSON.stringify({ source: "checkout" }),
      createdAt: now,
    });
  }

  if (input.address) {
    const address = input.address;
    const [existing] = await db
      .select()
      .from(customerAddresses)
      .where(and(eq(customerAddresses.customerId, customerId), eq(customerAddresses.isDefault, true)))
      .limit(1);
    const values = {
      recipientName: input.name,
      postalCode: address.postalCode || null,
      street: address.street,
      number: address.number,
      complement: address.complement || null,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      reference: address.reference || null,
      updatedAt: now,
    };
    if (existing) {
      await db.update(customerAddresses).set(values).where(eq(customerAddresses.id, existing.id));
    } else {
      await db.insert(customerAddresses).values({
        customerId,
        label: "Principal",
        isDefault: true,
        createdAt: now,
        ...values,
      });
    }
  }
  return getCustomerByPhone(input.phone);
}
