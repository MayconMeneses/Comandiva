import { and, count, eq, isNull, lt, or } from "drizzle-orm";
import { nowInSeconds } from "../_core/platformSession";
import { getDb } from "./client";
import { platformAdminRecoveryCodes, platformAdmins } from "../../drizzle/schema";

/**
 * Tudo que mexe em 2FA / códigos de recuperação / revogação de sessão de
 * platform_admins. Separado de platformAdmins.ts (cadastro/equipe) de
 * propósito: aqui entram segredos, então só os routers de login/segurança e
 * os scripts de CLI devem importar este arquivo. NADA daqui vai direto numa
 * resposta de tRPC.
 */

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  return db;
}

/** Registro COMPLETO (inclui hash de senha e segredo criptografado) — uso interno do login/segurança, nunca devolver ao cliente. */
export async function getPlatformAdminSecurityRecord(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, id)).limit(1);
  return admin;
}

/** Guarda o segredo (já CRIPTOGRAFADO) de um setup ainda não confirmado. Recusa se o 2FA já está ativo. */
export async function storePendingTotpSecret(id: number, encryptedSecret: string): Promise<boolean> {
  const db = await requireDb();
  const result = await db
    .update(platformAdmins)
    .set({ totpSecret: encryptedSecret, totpLastStep: null, updatedAt: Date.now() })
    .where(and(eq(platformAdmins.id, id), eq(platformAdmins.totpEnabled, false)));
  return result[0].affectedRows === 1;
}

/**
 * Anti-replay: só aceita o passo se for MAIOR que o último já usado. A
 * condição vai no próprio UPDATE (atômico) — dois logins simultâneos com o
 * mesmo código não passam os dois.
 */
export async function claimTotpStep(id: number, step: number): Promise<boolean> {
  const db = await requireDb();
  const result = await db
    .update(platformAdmins)
    .set({ totpLastStep: step })
    .where(and(eq(platformAdmins.id, id), or(isNull(platformAdmins.totpLastStep), lt(platformAdmins.totpLastStep, step))));
  return result[0].affectedRows === 1;
}

/** Ativa o 2FA: marca ligado, grava o passo do primeiro código, troca os códigos de recuperação e derruba sessões — tudo numa transação. */
export async function enablePlatformAdminTotp(id: number, step: number, recoveryCodeHashes: string[]): Promise<boolean> {
  const db = await requireDb();
  return db.transaction(async tx => {
    const result = await tx
      .update(platformAdmins)
      .set({ totpEnabled: true, totpLastStep: step, sessionsValidAfter: nowInSeconds(), updatedAt: Date.now() })
      .where(and(eq(platformAdmins.id, id), eq(platformAdmins.totpEnabled, false)));
    if (result[0].affectedRows !== 1) return false;
    await tx.delete(platformAdminRecoveryCodes).where(eq(platformAdminRecoveryCodes.adminId, id));
    await tx.insert(platformAdminRecoveryCodes).values(recoveryCodeHashes.map(codeHash => ({ adminId: id, codeHash, createdAt: Date.now() })));
    return true;
  });
}

/** Desliga o 2FA: zera segredo, passo e códigos de recuperação e derruba as sessões. Usado pela tela Segurança e pelo script de reset. */
export async function disablePlatformAdminTotp(id: number): Promise<void> {
  const db = await requireDb();
  await db.transaction(async tx => {
    await tx
      .update(platformAdmins)
      .set({ totpEnabled: false, totpSecret: null, totpLastStep: null, sessionsValidAfter: nowInSeconds(), updatedAt: Date.now() })
      .where(eq(platformAdmins.id, id));
    await tx.delete(platformAdminRecoveryCodes).where(eq(platformAdminRecoveryCodes.adminId, id));
  });
}

export async function replacePlatformAdminRecoveryCodes(id: number, recoveryCodeHashes: string[]): Promise<void> {
  const db = await requireDb();
  await db.transaction(async tx => {
    await tx.delete(platformAdminRecoveryCodes).where(eq(platformAdminRecoveryCodes.adminId, id));
    await tx.insert(platformAdminRecoveryCodes).values(recoveryCodeHashes.map(codeHash => ({ adminId: id, codeHash, createdAt: Date.now() })));
  });
}

/** Uso único: o UPDATE só acerta se usedAt ainda é NULL — duas tentativas simultâneas com o mesmo código, só uma passa. */
export async function consumeRecoveryCode(adminId: number, codeHash: string): Promise<boolean> {
  const db = await requireDb();
  const result = await db
    .update(platformAdminRecoveryCodes)
    .set({ usedAt: Date.now() })
    .where(and(eq(platformAdminRecoveryCodes.adminId, adminId), eq(platformAdminRecoveryCodes.codeHash, codeHash), isNull(platformAdminRecoveryCodes.usedAt)));
  return result[0].affectedRows === 1;
}

export async function countUnusedRecoveryCodes(adminId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ total: count() })
    .from(platformAdminRecoveryCodes)
    .where(and(eq(platformAdminRecoveryCodes.adminId, adminId), isNull(platformAdminRecoveryCodes.usedAt)));
  return Number(row?.total ?? 0);
}

/** "Sair de todos os dispositivos": toda sessão emitida até agora (segundos) deixa de valer. */
export async function revokeAllPlatformAdminSessions(id: number): Promise<void> {
  const db = await requireDb();
  await db.update(platformAdmins).set({ sessionsValidAfter: nowInSeconds(), updatedAt: Date.now() }).where(eq(platformAdmins.id, id));
}
