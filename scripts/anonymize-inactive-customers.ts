// Anonimização de clientes inativos (LGPD, art. 15/16) — ver DATA_RETENTION_YEARS
// em shared/legal.ts para a fonte do prazo (CTN + Ajuste SINIEF nº 2/2025).
//
// Um cliente é "inativo" quando o pedido mais recente dele (ou, se nunca fez
// pedido, o próprio cadastro) já passou do prazo de retenção. A partir daí:
//   - customers: nome/telefone trocados por um valor anônimo, phoneVerifiedAt limpo
//   - customer_addresses: removidos (endereço de entrega não tem valor fiscal)
//   - customer_change_logs: removidos (texto livre, pode conter PII antiga)
//   - orders: nome/telefone/endereço de entrega/observações trocados por
//     anônimo, mas totais, itens, datas e status de pagamento ficam intactos —
//     é exatamente essa parte que o Fisco pode exigir dentro do prazo.
//
// Roda em modo "dry-run" por padrão (só mostra o que faria). Use --apply para
// executar de verdade.
//
// Como rodar (com os containers no ar):
//   docker compose -f docker-compose.independent.yml exec app node_modules/.bin/tsx scripts/anonymize-inactive-customers.ts
//   docker compose -f docker-compose.independent.yml exec app node_modules/.bin/tsx scripts/anonymize-inactive-customers.ts --apply

import { sql } from "drizzle-orm";
import { customers, orders } from "../drizzle/schema";
import { anonymizeCustomer, getDb } from "../server/db";
import { DATA_RETENTION_YEARS } from "../shared/legal";

const apply = process.argv.includes("--apply");
const cutoff = Date.now() - DATA_RETENTION_YEARS * 365.25 * 24 * 60 * 60 * 1000;

const db = await getDb();
if (!db) throw new Error("Banco de dados indisponível");

// Último pedido de cada cliente (quem nunca pediu não aparece aqui — usa a
// data de cadastro como referência nesse caso).
const lastOrderRows = await db.select({ customerId: orders.customerId, lastOrderAt: sql<number>`max(${orders.createdAt})` }).from(orders).groupBy(orders.customerId);
const lastOrderByCustomerId = new Map(lastOrderRows.map(row => [row.customerId, Number(row.lastOrderAt)]));

const allCustomers = await db.select({ id: customers.id, name: customers.name, phone: customers.phone, createdAt: customers.createdAt }).from(customers);
const inactive = allCustomers.filter(c => (lastOrderByCustomerId.get(c.id) ?? c.createdAt) < cutoff);

console.log(`[retenção] Prazo: ${DATA_RETENTION_YEARS} anos. Clientes analisados: ${allCustomers.length}. Inativos além do prazo: ${inactive.length}.`);

if (!inactive.length) {
  console.log("[retenção] Nada para anonimizar.");
  process.exit(0);
}

for (const customer of inactive) {
  const lastActivity = new Date(lastOrderByCustomerId.get(customer.id) ?? customer.createdAt).toISOString().slice(0, 10);
  console.log(`${apply ? "[retenção] Anonimizando" : "[retenção] (dry-run) Anonimizaria"} cliente #${customer.id} (${customer.name}) — última atividade em ${lastActivity}.`);
  if (!apply) continue;
  await anonymizeCustomer(customer.id);
}

console.log(apply ? `[retenção] Concluído: ${inactive.length} cliente(s) anonimizado(s).` : "[retenção] Dry-run concluído — nada foi alterado. Rode de novo com --apply para executar.");
process.exit(0);
