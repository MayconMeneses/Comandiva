import { bigint, index, int, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Ciclo de vida de um handoff de Modo Suporte: o Painel Master emite (issued),
 * o deployment do restaurante resgata uma única vez (used) e, mais tarde,
 * encerra (ended). Um relógio só (expiresAt) cobre resgate E duração da
 * sessão — o Painel Master abre a aba na hora, não há necessidade de uma
 * janela de resgate separada da duração da sessão.
 */
export const supportSessions = mysqlTable(
  "support_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    restaurantId: int("restaurantId").notNull(),
    platformAdminId: int("platformAdminId").notNull(),
    // SHA-256 do token bruto — o token em si nunca é persistido (mesmo
    // raciocínio de restaurants.apiKeyHash).
    tokenHash: varchar("tokenHash", { length: 64 }).notNull(),
    issuedAt: bigint("issuedAt", { mode: "number", unsigned: true }).notNull(),
    expiresAt: bigint("expiresAt", { mode: "number", unsigned: true }).notNull(),
    usedAt: bigint("usedAt", { mode: "number", unsigned: true }),
    endedAt: bigint("endedAt", { mode: "number", unsigned: true }),
    // IP de quem clicou "Entrar em modo suporte" no Painel Master — capturado
    // na emissão porque, no resgate/término, ctx.req.ip já é o IP do SERVIDOR
    // do restaurante chamando de volta, não mais o do admin.
    issuedFromIp: varchar("issuedFromIp", { length: 64 }),
  },
  table => [
    uniqueIndex("support_sessions_token_hash_unique").on(table.tokenHash),
    index("support_sessions_restaurant_idx").on(table.restaurantId, table.issuedAt),
  ],
);

export type SupportSession = typeof supportSessions.$inferSelect;
