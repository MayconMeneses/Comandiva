import { bigint, int, mysqlTable, varchar } from "drizzle-orm/mysql-core";

/**
 * Aparência do próprio Painel Master (fundo personalizado que o dono da
 * plataforma escolhe pro seu painel) — linha única (singleton), criada sob
 * demanda na primeira leitura. Nada a ver com o tema de cada
 * restaurante-cliente (isso continua isolado, um deployment por restaurante).
 */
export const masterPanelSettings = mysqlTable("master_panel_settings", {
  id: int("id").autoincrement().primaryKey(),
  // Hex #rrggbb, NULL = paleta padrão clara (--paper #f8fafc, ver index.css).
  backgroundColor: varchar("backgroundColor", { length: 7 }),
  updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
});

export type MasterPanelSettings = typeof masterPanelSettings.$inferSelect;
