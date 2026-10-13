import { bigint, boolean, index, int, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const restaurantStatusValues = ["active", "suspended", "cancelled"] as const;
export type RestaurantStatus = (typeof restaurantStatusValues)[number];

/**
 * Registro de clientes (restaurantes) do SaaS. Guarda só o necessário pra
 * cobrança/plano — nunca cardápio, pedidos ou clientes do restaurante, que
 * continuam 100% no deployment próprio de cada um.
 */
export const restaurants = mysqlTable(
  "restaurants",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    contactName: varchar("contactName", { length: 160 }),
    contactEmail: varchar("contactEmail", { length: 320 }),
    contactPhone: varchar("contactPhone", { length: 24 }),
    // A API key em si nunca é armazenada — só o hash (sha256) e um prefixo
    // curto pra identificação em telas/logs (ex.: "rk_live_a1b2...").
    apiKeyHash: varchar("apiKeyHash", { length: 64 }).notNull(),
    apiKeyPrefix: varchar("apiKeyPrefix", { length: 16 }).notNull(),
    status: mysqlEnum("status", restaurantStatusValues).notNull().default("active"),
    // URL pública do deployment deste restaurante (ex.: https://mmsystemcreator.exemplo.com) —
    // usada só pelo Modo Suporte pra montar o link de handoff. Nula até ser
    // configurada (restaurante recém-criado pode não ter URL de produção ainda).
    deploymentUrl: varchar("deploymentUrl", { length: 500 }),
    // Prazo combinado com o cliente pra terminar a configuração (organizar
    // cardápio etc.) — calculado em dias úteis a partir do cadastro, só pra
    // exibição/cobrança de prazo no Painel Master. `deliveredAt` nulo = ainda
    // não entregue; o teste grátis só começa a contar quando isso é marcado
    // (ver server/db/restaurants.ts::markRestaurantDelivered).
    deliveryDueAt: bigint("deliveryDueAt", { mode: "number", unsigned: true }),
    deliveredAt: bigint("deliveredAt", { mode: "number", unsigned: true }),
    // Nasceu durante a janela da promoção de lançamento (20% de desconto nos
    // 2 primeiros meses de mensalidade) — ver server/db/restaurants.ts::LAUNCH_PROMO_ACTIVE
    // e server/db/subscriptions.ts::startOrChangePlan.
    promoEligible: boolean("promoEligible").notNull().default(false),
    notes: text("notes"),
    // Quando o status virou "cancelled" pela última vez — null se nunca foi
    // cancelado, ou se foi reativado depois (ver server/db/restaurants.ts::
    // setRestaurantStatus). Usado só pra ocultar da lista principal do
    // Painel Master 10 dias após o cancelamento (nunca apaga o registro —
    // segue o mesmo padrão de archivedAt em products/orders no app
    // principal, preservando assinatura/pagamentos/auditoria).
    cancelledAt: bigint("cancelledAt", { mode: "number", unsigned: true }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [
    uniqueIndex("restaurants_api_key_hash_unique").on(table.apiKeyHash),
    index("restaurants_status_idx").on(table.status),
  ],
);

export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = typeof restaurants.$inferInsert;
