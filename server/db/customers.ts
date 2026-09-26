import { desc, eq } from "drizzle-orm";
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
  // As 4 escritas numa transação só — uma falha no meio deixando só o
  // `customers` anonimizado, mas os `orders` antigos ainda com nome/telefone/
  // endereço reais, seria justamente o cenário que essa função existe pra
  // evitar (exclusão LGPD "completa" que na prática ficou pela metade).
  await db.transaction(async tx => {
    await tx.update(customers).set({ name: "Cliente removido", phone: anonPhone, phoneVerifiedAt: null, updatedAt: now }).where(eq(customers.id, customerId));
    await tx.delete(customerAddresses).where(eq(customerAddresses.customerId, customerId));
    await tx.delete(customerChangeLogs).where(eq(customerChangeLogs.customerId, customerId));
    await tx
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
  });
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

/**
 * Chamado a partir de checkout público (order.create) e rodada de mesa via QR
 * (table.addRound) — nenhum dos dois tem sessão/login, só o telefone que a
 * própria pessoa digitou. Por isso, achado de segurança (auditoria desta
 * sessão): NUNCA atualiza nome/endereço de um telefone que já tem cadastro —
 * antes disso, qualquer um sabendo o telefone de um cliente real (vazamento
 * comum: nota fiscal, WhatsApp) conseguia sobrescrever o nome e o endereço
 * PADRÃO daquele telefone só fazendo um pedido, sem nenhuma prova de posse.
 * Esse endereço sobrescrito seria depois usado pra pré-preencher o checkout
 * da PRÓXIMA compra legítima da vítima — um jeito silencioso de desviar uma
 * entrega futura pro endereço do atacante.
 *
 * O pedido em si nunca dependeu disso: `customerName`/endereço gravados em
 * cada `orders` sempre vêm direto do que a pessoa digitou NESSA compra (ver
 * order.ts/table.ts), nunca do valor devolvido aqui — então parar de
 * sobrescrever não muda o que aparece no pedido atual, só impede que ele
 * "vaze" pro perfil salvo de outra pessoa. Só telefone NOVO (sem cadastro
 * ainda) grava nome/endereço — nesse caso não existe ninguém pra ter o
 * cadastro corrompido.
 */
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
  const found = await getCustomerByPhone(input.phone);
  if (found) return found;

  const now = Date.now();
  const result = await db.insert(customers).values({
    phone: input.phone,
    name: input.name,
    createdAt: now,
    updatedAt: now,
  });
  const customerId = Number(result[0].insertId);
  await db.insert(customerChangeLogs).values({
    customerId,
    changeType: "PROFILE_CREATED",
    details: JSON.stringify({ source: "checkout" }),
    createdAt: now,
  });

  if (input.address) {
    const address = input.address;
    await db.insert(customerAddresses).values({
      customerId,
      label: "Principal",
      isDefault: true,
      recipientName: input.name,
      postalCode: address.postalCode || null,
      street: address.street,
      number: address.number,
      complement: address.complement || null,
      neighborhood: address.neighborhood,
      city: address.city,
      state: address.state,
      reference: address.reference || null,
      createdAt: now,
      updatedAt: now,
    });
  }
  return getCustomerByPhone(input.phone);
}
