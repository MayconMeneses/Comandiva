import { desc, eq, inArray } from "drizzle-orm";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { InsertUser, restaurantStaffCredentials, users } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { parseStaffPermissions, serializeStaffPermissions, type StaffPermissionArea } from "../_core/permissions";
import { getDb, type DbOrTx } from "./client";

const scrypt = promisify(scryptCallback);

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.primaryAdminOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

async function hashStaffPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function verifyStaffPassword(password: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const actualHash = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actualHash.length && timingSafeEqual(expected, actualHash);
}

type RestaurantAccessRole = "staff" | "admin";

export async function createRestaurantAccessAccount(input: { name: string; username: string; password: string; role: RestaurantAccessRole; permissions?: StaffPermissionArea[] | null }, conn?: DbOrTx) {
  const db = conn ?? await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const username = input.username.trim().toLowerCase();
  const [existing] = await db.select().from(restaurantStaffCredentials).where(eq(restaurantStaffCredentials.username, username)).limit(1);
  if (existing) throw new Error("Este usuário de acesso já está em uso.");
  const now = Date.now();
  const openId = `restaurant_${input.role}_${randomBytes(18).toString("hex")}`;
  const createdUser = await db.insert(users).values({ openId, name: input.name.trim(), email: null, loginMethod: "restaurant", role: input.role, lastSignedIn: new Date(now) });
  const userId = Number(createdUser[0].insertId);
  // Permissões extras só fazem sentido pra staff — admin já tem tudo, nunca gravamos nada pra ele.
  const permissions = input.role === "staff" ? serializeStaffPermissions(input.permissions) : null;
  const credential = await db.insert(restaurantStaffCredentials).values({ userId, username, passwordHash: await hashStaffPassword(input.password), active: true, permissions, createdAt: now, updatedAt: now });
  return { id: Number(credential[0].insertId), userId, name: input.name.trim(), username, role: input.role, active: true };
}

/** Áreas extras liberadas pra uma conta staff — [] pra admin (não precisa, já tem tudo) ou conta não encontrada. */
export async function getStaffPermissionsByUserId(userId: number): Promise<StaffPermissionArea[]> {
  const db = await getDb();
  if (!db) return [];
  const [credential] = await db.select({ permissions: restaurantStaffCredentials.permissions }).from(restaurantStaffCredentials).where(eq(restaurantStaffCredentials.userId, userId)).limit(1);
  return parseStaffPermissions(credential?.permissions);
}

/**
 * `active` da credencial de acesso (staff/admin) desse usuário — checado a
 * cada request autenticado (ver server/_core/sdk.ts::authenticateRequest)
 * pra revogar sessões já emitidas quando a conta é pausada (team.setActive)
 * ou trocada de senha, já que o JWT em si não sabe disso (mesmo padrão do
 * saas-core: ctx.platformAdmin.active recarregado do banco a cada request,
 * ver saas-core/server/_core/trpc.ts). `undefined` = sem credencial
 * cadastrada pra esse userId (não deve acontecer pra role staff/admin, já
 * que a única forma de logar é authenticateRestaurantAccount, que sempre
 * exige uma linha em restaurant_staff_credentials — mas não é tratado como
 * revogação pra não travar login por um dado legado/inconsistente).
 */
export async function getStaffCredentialActiveStatus(userId: number): Promise<boolean | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const [credential] = await db.select({ active: restaurantStaffCredentials.active }).from(restaurantStaffCredentials).where(eq(restaurantStaffCredentials.userId, userId)).limit(1);
  return credential?.active;
}

export async function createRestaurantStaffAccount(input: { name: string; username: string; password: string }) {
  return createRestaurantAccessAccount({ ...input, role: "staff" });
}

export async function authenticateRestaurantAccount(usernameInput: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const username = usernameInput.trim().toLowerCase();
  const [credential] = await db.select().from(restaurantStaffCredentials).where(eq(restaurantStaffCredentials.username, username)).limit(1);
  if (!credential?.active || !(await verifyStaffPassword(password, credential.passwordHash))) return undefined;
  const [user] = await db.select().from(users).where(eq(users.id, credential.userId)).limit(1);
  if (!user || (user.role !== "staff" && user.role !== "admin")) return undefined;
  const now = Date.now();
  await db.update(restaurantStaffCredentials).set({ lastSignedInAt: now, updatedAt: now }).where(eq(restaurantStaffCredentials.id, credential.id));
  return { user, credential: { id: credential.id, username: credential.username } };
}

export async function authenticateRestaurantStaff(usernameInput: string, password: string) {
  return authenticateRestaurantAccount(usernameInput, password);
}

export async function listRestaurantAccessAccounts() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const credentials = await db.select().from(restaurantStaffCredentials).orderBy(desc(restaurantStaffCredentials.createdAt));
  if (!credentials.length) return [];
  const userIds = [...new Set(credentials.map(credential => credential.userId))];
  const userRows = await db.select().from(users).where(inArray(users.id, userIds));
  const userById = new Map(userRows.map(user => [user.id, user]));
  const result = credentials.map(credential => {
    const user = userById.get(credential.userId);
    return user && (user.role === "staff" || user.role === "admin")
      ? { id: credential.id, userId: user.id, name: user.name ?? "Equipe MM System Creator", username: credential.username, role: user.role, active: credential.active, permissions: parseStaffPermissions(credential.permissions), createdAt: credential.createdAt, lastSignedInAt: credential.lastSignedInAt, isOwner: user.openId === ENV.primaryAdminOpenId }
      : undefined;
  });
  return result.filter((account): account is NonNullable<typeof account> => Boolean(account));
}

export async function listRestaurantStaffAccounts() {
  return listRestaurantAccessAccounts();
}

async function getRestaurantAccessAccount(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [credential] = await db.select().from(restaurantStaffCredentials).where(eq(restaurantStaffCredentials.id, accountId)).limit(1);
  if (!credential) throw new Error("Acesso não encontrado.");
  const [user] = await db.select().from(users).where(eq(users.id, credential.userId)).limit(1);
  if (!user || (user.role !== "staff" && user.role !== "admin")) throw new Error("Acesso não encontrado.");
  return { db, credential, user };
}

export async function updateRestaurantAccessAccount(input: { accountId: number; name: string; password?: string; permissions?: StaffPermissionArea[] | null }) {
  const { db, credential, user } = await getRestaurantAccessAccount(input.accountId);
  await db.update(users).set({ name: input.name.trim(), updatedAt: new Date() }).where(eq(users.id, user.id));
  const updates: { updatedAt: number; passwordHash?: string; permissions?: string | null } = { updatedAt: Date.now() };
  if (input.password) updates.passwordHash = await hashStaffPassword(input.password);
  // Permissões extras só fazem sentido pra staff — pra uma conta admin, `permissions` nunca é lido em lugar nenhum, mas evitamos gravar lixo mesmo assim.
  if (input.permissions !== undefined) updates.permissions = user.role === "staff" ? serializeStaffPermissions(input.permissions) : null;
  await db.update(restaurantStaffCredentials).set(updates).where(eq(restaurantStaffCredentials.id, credential.id));
  return { success: true };
}

export async function setRestaurantAccessAccountActive(accountId: number, active: boolean, protectedUserId?: number) {
  const { db, user } = await getRestaurantAccessAccount(accountId);
  if (!active && (user.id === protectedUserId || user.openId === ENV.primaryAdminOpenId)) throw new Error("O administrador principal não pode ser pausado.");
  await db.update(restaurantStaffCredentials).set({ active, updatedAt: Date.now() }).where(eq(restaurantStaffCredentials.id, accountId));
  return { success: true };
}

export async function setRestaurantStaffAccountActive(accountId: number, active: boolean) {
  return setRestaurantAccessAccountActive(accountId, active);
}

export async function deleteRestaurantAccessAccount(accountId: number, protectedUserId?: number) {
  const { db, credential, user } = await getRestaurantAccessAccount(accountId);
  if (user.id === protectedUserId || user.openId === ENV.primaryAdminOpenId) throw new Error("O administrador principal não pode ser removido.");
  await db.delete(restaurantStaffCredentials).where(eq(restaurantStaffCredentials.id, credential.id));
  await db.delete(users).where(eq(users.id, user.id));
  return { success: true };
}
