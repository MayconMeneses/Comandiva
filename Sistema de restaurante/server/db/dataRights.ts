import { randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { orders, phoneVerificationCodes } from "../../drizzle/schema";
import { getDb } from "./client";

const scrypt = promisify(scryptCallback);
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function hashCode(code: string) {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(code, salt, 32)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function verifyCodeHash(code: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;
  const actualHash = (await scrypt(code, salt, 32)) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actualHash.length && timingSafeEqual(expected, actualHash);
}

/** Gera e grava um código de 6 dígitos pro telefone — retorna o código em texto puro (só o chamador que envia por SMS vê isso; nunca fica salvo assim). */
export async function createPhoneVerificationCode(phone: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const now = Date.now();
  await db.insert(phoneVerificationCodes).values({ phone, codeHash: await hashCode(code), attempts: 0, expiresAt: now + CODE_TTL_MS, createdAt: now });
  return code;
}

/**
 * Confirma o código mais recente ainda válido pro telefone. Compare-and-swap
 * simples via `attempts` pra impedir força bruta no código de 6 dígitos
 * (5 tentativas erradas invalida o código, não trava a conta — só pede um
 * código novo).
 */
export async function verifyPhoneVerificationCode(phone: string, code: string): Promise<{ ok: true } | { ok: false; reason: "not_found" | "expired" | "too_many_attempts" | "wrong_code" }> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const now = Date.now();
  const [pending] = await db
    .select()
    .from(phoneVerificationCodes)
    .where(and(eq(phoneVerificationCodes.phone, phone), isNull(phoneVerificationCodes.consumedAt), gt(phoneVerificationCodes.expiresAt, now)))
    .orderBy(desc(phoneVerificationCodes.createdAt))
    .limit(1);
  if (!pending) return { ok: false, reason: "not_found" };
  if (pending.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "too_many_attempts" };

  const matches = await verifyCodeHash(code, pending.codeHash);
  if (!matches) {
    await db.update(phoneVerificationCodes).set({ attempts: pending.attempts + 1 }).where(eq(phoneVerificationCodes.id, pending.id));
    return { ok: false, reason: "wrong_code" };
  }
  await db.update(phoneVerificationCodes).set({ consumedAt: now }).where(eq(phoneVerificationCodes.id, pending.id));
  return { ok: true };
}

/** Pedidos de um telefone, resumidos pro autoatendimento (não retorna itens/endereço completos — só o essencial pro cliente reconhecer o próprio histórico). */
export async function getOrdersSummaryByPhone(phone: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  return db
    .select({ id: orders.id, publicCode: orders.publicCode, status: orders.status, totalCents: orders.totalCents, fulfillmentType: orders.fulfillmentType, createdAt: orders.createdAt })
    .from(orders)
    .where(eq(orders.customerPhone, phone))
    .orderBy(desc(orders.createdAt))
    .limit(200);
}
