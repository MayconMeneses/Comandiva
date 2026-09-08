import { eq } from "drizzle-orm";
import { hashPlatformPassword, verifyPlatformPassword } from "../_core/platformPassword";
import { GRANTABLE_MASTER_AREAS, parseMasterPermissions, serializeMasterPermissions, type MasterPermissionArea } from "../_core/permissions";
import { getDb } from "./client";
import { platformAdmins, type PlatformAdminRole } from "../../drizzle/schema";

function stripPasswordHash<T extends { passwordHash: string }>({ passwordHash: _passwordHash, ...rest }: T) {
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
  const values: { name: string; updatedAt: number; passwordHash?: string; permissions?: string | null } = { name: input.name.trim(), updatedAt: Date.now() };
  if (input.password) values.passwordHash = await hashPlatformPassword(input.password);
  if (input.permissions !== undefined) values.permissions = serializeMasterPermissions(input.permissions);
  await db.update(platformAdmins).set(values).where(eq(platformAdmins.id, id));
}

export async function setPlatformAdminActive(id: number, active: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  await db.update(platformAdmins).set({ active, updatedAt: Date.now() }).where(eq(platformAdmins.id, id));
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
  return admin ? withParsedPermissions(stripPasswordHash(admin)) : undefined;
}

export async function listPlatformAdmins() {
  const db = await getDb();
  if (!db) return [];
  return (await db.select().from(platformAdmins)).map(stripPasswordHash).map(withParsedPermissions);
}

/** Reseta a senha de uma conta já existente — bootstrap-platform-admin.ts é idempotente e nunca mexe numa conta que já existe. */
export async function updatePlatformAdminPassword(id: number, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const passwordHash = await hashPlatformPassword(password);
  await db.update(platformAdmins).set({ passwordHash, updatedAt: Date.now() }).where(eq(platformAdmins.id, id));
}

/** Devolve o admin (sem passwordHash) se a senha bater e a conta estiver ativa — undefined caso contrário. */
export async function authenticatePlatformAdmin(emailInput: string, password: string) {
  const admin = await getPlatformAdminByEmail(emailInput);
  if (!admin?.active || !(await verifyPlatformPassword(password, admin.passwordHash))) return undefined;
  const db = await getDb();
  if (db) await db.update(platformAdmins).set({ lastSignedInAt: Date.now(), updatedAt: Date.now() }).where(eq(platformAdmins.id, admin.id));
  return stripPasswordHash(admin);
}
