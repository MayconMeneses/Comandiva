import { count, eq } from "drizzle-orm";
import { hashPlatformPassword, verifyAgainstDummyPasswordHash, verifyPlatformPassword } from "../_core/platformPassword";
import { nowInSeconds } from "../_core/platformSession";
import { GRANTABLE_MASTER_AREAS, parseMasterPermissions, serializeMasterPermissions, type MasterPermissionArea } from "../_core/permissions";
import { getDb } from "./client";
import { platformAdmins, type PlatformAdminRole } from "../../drizzle/schema";

/**
 * Pra qualquer retorno que possa chegar ao cliente (contexto de sessão,
 * listagem de equipe) — nunca deixa vazar passwordHash, totpSecret (já
 * criptografado, mas mesmo assim) nem totpLastStep. `totpEnabled` (booleano)
 * continua passando: a tela de equipe mostra "2FA ativo".
 */
function stripAllSecrets<T extends { passwordHash: string; totpSecret: string | null; totpLastStep: number | null }>(admin: T): Omit<T, "passwordHash" | "totpSecret" | "totpLastStep"> {
  const { passwordHash, totpSecret, totpLastStep, ...rest } = admin;
  void [passwordHash, totpSecret, totpLastStep];
  return rest;
}

/** O marco de revogação é interno (só o context.ts usa) — não vai pra listas que chegam ao cliente. */
function omitSessionMarker<T extends { sessionsValidAfter: number | null }>(admin: T): Omit<T, "sessionsValidAfter"> {
  const { sessionsValidAfter, ...rest } = admin;
  void sessionsValidAfter;
  return rest;
}

/** owner sempre acesso total; member só as áreas em `permissions` — mesmo raciocínio de listRestaurantAccessAccounts no app principal. */
function withParsedPermissions<T extends { permissions: string | null; role: PlatformAdminRole }>(admin: T) {
  return { ...admin, permissions: admin.role === "owner" ? [...GRANTABLE_MASTER_AREAS] : parseMasterPermissions(admin.permissions) };
}

export async function createPlatformAdmin(input: { name: string; email: string; password: string; role?: PlatformAdminRole; permissions?: MasterPermissionArea[] }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const email = input.email.trim().toLowerCase();
  const now = Date.now();
  const passwordHash = await hashPlatformPassword(input.password);
  const role = input.role ?? "owner";
  const permissions = role === "member" ? serializeMasterPermissions(input.permissions) : null;
  const result = await db.insert(platformAdmins).values({ name: input.name.trim(), email, passwordHash, role, permissions, active: true, createdAt: now, updatedAt: now });
  return { id: Number(result[0].insertId), name: input.name.trim(), email };
}

/** Edita nome/senha(opcional)/permissions de uma conta já existente — nunca troca o e-mail (é a chave de login) nem o role (papel só se define na criação, evita alguém virar "owner" por engano depois). */
export async function updatePlatformAdmin(id: number, input: { name: string; password?: string; permissions?: MasterPermissionArea[] }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const values: { name: string; updatedAt: number; passwordHash?: string; sessionsValidAfter?: number; permissions?: string | null } = { name: input.name.trim(), updatedAt: Date.now() };
  if (input.password) {
    values.passwordHash = await hashPlatformPassword(input.password);
    // Trocar a senha derruba as sessões já abertas (quem tinha a senha antiga não continua dentro).
    values.sessionsValidAfter = nowInSeconds();
  }
  if (input.permissions !== undefined) values.permissions = serializeMasterPermissions(input.permissions);
  await db.update(platformAdmins).set(values).where(eq(platformAdmins.id, id));
}

export async function setPlatformAdminActive(id: number, active: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  // Pausar derruba as sessões abertas; reativar NÃO as ressuscita (o marco gravado ao pausar continua valendo).
  await db.update(platformAdmins).set({ active, updatedAt: Date.now(), ...(active ? {} : { sessionsValidAfter: nowInSeconds() }) }).where(eq(platformAdmins.id, id));
}

export async function getPlatformAdminByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.email, email.trim().toLowerCase())).limit(1);
  return admin;
}

export async function getPlatformAdminById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, id)).limit(1);
  // Mantém sessionsValidAfter de propósito: context.ts precisa dele pra recusar sessões revogadas (o `me` o remove antes de responder).
  return admin ? withParsedPermissions(stripAllSecrets(admin)) : undefined;
}

export async function listPlatformAdmins() {
  const db = await getDb();
  if (!db) return [];
  return (await db.select().from(platformAdmins)).map(stripAllSecrets).map(admin => omitSessionMarker(admin)).map(withParsedPermissions);
}

/** Reseta a senha de uma conta já existente — o bootstrap só cria o primeiro admin e nunca mexe em conta existente. Também derruba as sessões abertas dela. */
export async function updatePlatformAdminPassword(id: number, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const passwordHash = await hashPlatformPassword(password);
  await db.update(platformAdmins).set({ passwordHash, sessionsValidAfter: nowInSeconds(), updatedAt: Date.now() }).where(eq(platformAdmins.id, id));
}

/** Quantas contas de Super Admin existem — o bootstrap só cria a primeira se não houver nenhuma. */
export async function countPlatformAdmins(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [row] = await db.select({ total: count() }).from(platformAdmins);
  return Number(row?.total ?? 0);
}

/**
 * Confere e-mail + senha. Devolve só o necessário pro login (nunca hash nem
 * segredo). Em falha, `knownAdmin` diz se o e-mail existe (só pra auditoria
 * interna — nunca vai pro cliente). Quando o e-mail não existe ou a conta está pausada,
 * roda mesmo assim um scrypt "dummy" — o tempo de resposta fica igual ao de
 * "senha errada" e não dá pra descobrir e-mails válidos medindo a demora.
 * NÃO marca o login como concluído (com 2FA ainda falta o código):
 * quem fecha o login chama markPlatformAdminSignedIn.
 */
export async function authenticatePlatformAdmin(emailInput: string, password: string) {
  const admin = await getPlatformAdminByEmail(emailInput);
  if (!admin?.active) {
    await verifyAgainstDummyPasswordHash(password);
    return { ok: false as const, knownAdmin: admin ? { id: admin.id, email: admin.email } : null };
  }
  if (!(await verifyPlatformPassword(password, admin.passwordHash))) {
    return { ok: false as const, knownAdmin: { id: admin.id, email: admin.email } };
  }
  return { ok: true as const, admin: { id: admin.id, name: admin.name, email: admin.email, totpEnabled: admin.totpEnabled } };
}

export async function markPlatformAdminSignedIn(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(platformAdmins).set({ lastSignedInAt: Date.now(), updatedAt: Date.now() }).where(eq(platformAdmins.id, id));
}
