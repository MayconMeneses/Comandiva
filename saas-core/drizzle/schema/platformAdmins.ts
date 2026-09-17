import { bigint, boolean, int, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

// "owner" = acesso completo sempre, nunca restringível por permissions
// (mesmo raciocínio de user.role "admin" no app principal). "member" = só as
// áreas marcadas em `permissions` (ver shared/permissions.ts::GRANTABLE_MASTER_AREAS).
export const platformAdminRoleValues = ["owner", "member"] as const;
export type PlatformAdminRole = (typeof platformAdminRoleValues)[number];

/**
 * Contas de acesso ao Painel Master (Super Admin) — sistema de autenticação
 * completamente separado das contas de restaurante (users/restaurant_staff_credentials,
 * no app de cada restaurante) e da API key de restaurante (restaurants.apiKeyHash,
 * acima). Só quem opera a PLATAFORMA tem conta aqui.
 */
export const platformAdmins = mysqlTable(
  "platform_admins",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    role: mysqlEnum("role", platformAdminRoleValues).notNull().default("owner"),
    // Só relevante quando role="member" — serializado (JSON de MasterPermissionArea[]),
    // nulo/vazio = nenhuma área extra. Mesmo formato de
    // restaurant_staff_credentials.permissions no app principal.
    permissions: text("permissions"),
    active: boolean("active").notNull().default(true),
    // 2FA (TOTP) do Painel Master — totpSecret só existe depois que a conta
    // gera um QR code de configuração (ver server/routers/masterPanel/auth.ts).
    // totpEnabled=false + totpSecret preenchido = setup gerado mas ainda não
    // confirmado (login gera um segredo novo a cada tentativa até confirmar).
    totpSecret: varchar("totpSecret", { length: 64 }),
    totpEnabled: boolean("totpEnabled").notNull().default(false),
    lastSignedInAt: bigint("lastSignedInAt", { mode: "number", unsigned: true }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [uniqueIndex("platform_admins_email_unique").on(table.email)],
);

export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type InsertPlatformAdmin = typeof platformAdmins.$inferInsert;
