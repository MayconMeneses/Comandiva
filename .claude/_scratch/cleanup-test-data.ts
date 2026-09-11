// Limpeza dos dados de teste deixados pela rodada de teste de invasão ao vivo
// (10/09/2026) — pedido PX-N7L6YH2 (teste de manipulação de preço) e cliente
// do telefone 85999482913 (teste de XSS). Roda dentro do container de
// produção via tsx, chamando as MESMAS funções que o admin real usaria
// (nunca UPDATE cru inventado na hora) — anonymizeCustomer já existe e é
// testada; a transição de status/arquivamento replica exatamente
// server/routers/admin/orders.ts::updateOrderStatus + archiveOrder.
import { eq } from "drizzle-orm";
import { getDb } from "../server/db/client";
import { orders, payments, orderStatusHistory, orderChangeLogs, customers } from "../drizzle/schema";
import { anonymizeCustomer } from "../server/db/customers";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();

  const [order] = await db.select().from(orders).where(eq(orders.publicCode, "PX-N7L6YH2")).limit(1);
  if (!order) {
    console.log("Pedido PX-N7L6YH2 não encontrado — já foi limpo antes.");
  } else if (order.archivedAt) {
    console.log(`Pedido PX-N7L6YH2 (id ${order.id}) já está arquivado, nada a fazer.`);
  } else {
    console.log(`Pedido PX-N7L6YH2 encontrado: id=${order.id} status=${order.status}`);
    if (order.status !== "CANCELLED" && order.status !== "COMPLETED") {
      await db.update(orders).set({ status: "CANCELLED", updatedAt: now, cancelledAt: now }).where(eq(orders.id, order.id));
      await db.update(payments).set({ status: "CANCELLED", updatedAt: now }).where(eq(payments.orderId, order.id));
      await db.insert(orderStatusHistory).values({ orderId: order.id, status: "CANCELLED", note: "Limpeza de dado de teste (rodada de teste de invasão, auditoria de segurança)", changedByUserId: null, createdAt: now });
      console.log(`Pedido ${order.id} cancelado.`);
    }
    await db.update(orders).set({ archivedAt: now, updatedAt: now }).where(eq(orders.id, order.id));
    await db.insert(orderChangeLogs).values({ orderId: order.id, changedByUserId: null, changeType: "ORDER_ARCHIVED", details: JSON.stringify({ reason: "Limpeza de dado de teste — auditoria de segurança" }), createdAt: now });
    console.log(`Pedido ${order.id} arquivado.`);
  }

  const [customer] = await db.select().from(customers).where(eq(customers.phone, "85999482913")).limit(1);
  if (!customer) {
    console.log("Cliente 85999482913 não encontrado — já foi limpo antes.");
  } else {
    await anonymizeCustomer(customer.id);
    console.log(`Cliente ${customer.id} (telefone 85999482913) anonimizado — mesmo caminho de exclusão LGPD já usado no resto do sistema.`);
  }

  console.log("OK");
  process.exit(0);
}

main().catch(error => {
  console.error("FALHOU:", error);
  process.exit(1);
});
