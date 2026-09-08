import { bigint, index, int, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Log append-only de mudanças de assinatura (troca de plano, status,
 * override manual do operador etc.) — nunca editado/apagado, só inserido.
 */
export const subscriptionEvents = mysqlTable(
  "subscription_events",
  {
    id: int("id").autoincrement().primaryKey(),
    subscriptionId: int("subscriptionId").notNull(),
    eventType: varchar("eventType", { length: 80 }).notNull(),
    beforeJson: text("beforeJson"),
    afterJson: text("afterJson"),
    actor: varchar("actor", { length: 160 }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("subscription_events_subscription_idx").on(table.subscriptionId, table.createdAt)],
);

/**
 * Ledger de idempotência de webhooks — schema já criado agora pra a
 * Milestone 2 (cobrança real via Mercado Pago) não precisar de uma migração
 * nova só pra isso. Inerte nesta milestone: nenhum código grava aqui ainda.
 */
export const webhookEvents = mysqlTable(
  "webhook_events",
  {
    id: int("id").autoincrement().primaryKey(),
    gateway: varchar("gateway", { length: 40 }).notNull(),
    gatewayEventId: varchar("gatewayEventId", { length: 160 }).notNull(),
    processedAt: bigint("processedAt", { mode: "number", unsigned: true }).notNull(),
    result: varchar("result", { length: 40 }).notNull(),
  },
  table => [uniqueIndex("webhook_events_gateway_event_unique").on(table.gateway, table.gatewayEventId)],
);

/**
 * Log de auditoria GERAL do Painel Master — mais amplo que subscription_events
 * acima (que só cobre o ciclo de vida de UMA assinatura). Aqui entram login/
 * logout do Super Admin e qualquer ação de escrita feita através da UI do
 * Painel Master, qualquer que seja a entidade afetada. Append-only.
 */
export const platformAuditLog = mysqlTable(
  "platform_audit_log",
  {
    id: int("id").autoincrement().primaryKey(),
    // Nulo em "admin.login_failed" (não sabemos qual admin é, só o e-mail
    // tentado, guardado em actorLabel) ou em ações de sistema/bootstrap.
    actorAdminId: int("actorAdminId"),
    actorLabel: varchar("actorLabel", { length: 160 }).notNull(),
    action: varchar("action", { length: 80 }).notNull(),
    entityType: varchar("entityType", { length: 40 }),
    entityId: int("entityId"),
    beforeJson: text("beforeJson"),
    afterJson: text("afterJson"),
    ip: varchar("ip", { length: 64 }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [
    index("platform_audit_log_created_idx").on(table.createdAt),
    index("platform_audit_log_action_idx").on(table.action, table.createdAt),
    index("platform_audit_log_entity_idx").on(table.entityType, table.entityId, table.createdAt),
  ],
);

export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;
export type PlatformAuditLogEntry = typeof platformAuditLog.$inferSelect;
