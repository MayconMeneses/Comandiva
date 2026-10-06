import { int, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Medição própria do site comercial — contador AGREGADO por dia/página/evento.
 * Nenhuma linha identifica ninguém (sem IP, user agent, cookie nem sessão).
 * `day` é 'YYYY-MM-DD' no fuso America/Fortaleza.
 */
export const siteEvents = mysqlTable(
  "site_events",
  {
    id: int("id").autoincrement().primaryKey(),
    day: varchar("day", { length: 10 }).notNull(),
    path: varchar("path", { length: 120 }).notNull(),
    event: varchar("event", { length: 32 }).notNull(),
    count: int("count").notNull().default(0),
  },
  table => ({
    dayPathEventUnique: uniqueIndex("site_events_day_path_event_unique").on(table.day, table.path, table.event),
  }),
);

export type SiteEvent = typeof siteEvents.$inferSelect;
