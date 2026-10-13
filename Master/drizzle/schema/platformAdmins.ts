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
    // 2FA (TOTP) do Painel Master — totpSecret é o segredo CRIPTOGRAFADO
    // (AES-256-GCM, formato "v1:iv:tag:cipher", ver server/_core/totpCrypto.ts),
    // nunca em texto puro. totpEnabled=false + totpSecret preenchido = setup
    // iniciado mas ainda não confirmado com o primeiro código.
    totpSecret: varchar("totpSecret", { length: 255 }),
    totpEnabled: boolean("totpEnabled").notNull().default(false),
    // Último "passo" de 30s do TOTP já aceito — impede reusar o mesmo código.
    totpLastStep: bigint("totpLastStep", { mode: "number", unsigned: true }),
    // Sessões (JWT) emitidas ANTES deste instante (segundos unix) são
    // recusadas — é assim que se derruba sessão no servidor (troca de senha,
    // conta pausada, 2FA ligado/desligado, "sair de todos os dispositivos").
    sessionsValidAfter: bigint("sessionsValidAfter", { mode: "number", unsigned: true }),
    lastSignedInAt: bigint("lastSignedInAt", { mode: "number", unsigned: true }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [uniqueIndex("platform_admins_email_unique").on(table.email)],
);

export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type InsertPlatformAdmin = typeof platformAdmins.$inferInsert;

/**
 * Códigos de recuperação do 2FA (uso único). Só o HASH (HMAC-SHA256) é
 * guardado; o texto do código aparece uma única vez, na tela de ativação.
 * usedAt preenchido = já gasto.
 */
export const platformAdminRecoveryCodes = mysqlTable(
  "platform_admin_recovery_codes",
  {
    id: int("id").autoincrement().primaryKey(),
    adminId: int("adminId").notNull(),
    codeHash: varchar("codeHash", { length: 64 }).notNull(),
    usedAt: bigint("usedAt", { mode: "number", unsigned: true }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [uniqueIndex("platform_admin_recovery_codes_admin_hash_unique").on(table.adminId, table.codeHash)],
);

export type PlatformAdminRecoveryCode = typeof platformAdminRecoveryCodes.$inferSelect;
