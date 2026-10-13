import { bigint, boolean, int, mysqlEnum, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const planKeyValues = ["essencial", "profissional", "premium"] as const;
export type PlanKey = (typeof planKeyValues)[number];

export const plans = mysqlTable(
  "plans",
  {
    id: int("id").autoincrement().primaryKey(),
    key: mysqlEnum("key", planKeyValues).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    priceCents: int("priceCents").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("BRL"),
    // Ordem de comparação (1 = mais barato) — usada pra achar o plano mais
    // barato que libera uma feature bloqueada no plano atual.
    position: int("position").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [
    uniqueIndex("plans_key_unique").on(table.key),
    uniqueIndex("plans_position_unique").on(table.position),
  ],
);

/**
 * featureId é a chave estável referenciada direto pelo código de cada
 * deployment (ex.: featureProcedure("extra_rounds")) — não um id numérico
 * gerado, pra nunca depender de qual linha foi inserida quando.
 */
export const features = mysqlTable("features", {
  featureId: varchar("featureId", { length: 60 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 500 }),
  category: varchar("category", { length: 60 }),
  createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
});

export const planFeatures = mysqlTable(
  "plan_features",
  {
    id: int("id").autoincrement().primaryKey(),
    planId: int("planId").notNull(),
    featureId: varchar("featureId", { length: 60 }).notNull(),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [uniqueIndex("plan_features_unique").on(table.planId, table.featureId)],
);

/** limitValue nulo = sem limite (ilimitado). */
export const planLimits = mysqlTable(
  "plan_limits",
  {
    id: int("id").autoincrement().primaryKey(),
    planId: int("planId").notNull(),
    resourceKey: varchar("resourceKey", { length: 60 }).notNull(),
    limitValue: int("limitValue"),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [uniqueIndex("plan_limits_unique").on(table.planId, table.resourceKey)],
);

export type Plan = typeof plans.$inferSelect;
export type Feature = typeof features.$inferSelect;
export type PlanFeature = typeof planFeatures.$inferSelect;
export type PlanLimit = typeof planLimits.$inferSelect;
