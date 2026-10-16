import { eq } from "drizzle-orm";
import { nowInSeconds } from "../_core/platformSession";
import { getDb } from "./client";
import { platformAdmins } from "../../drizzle/schema";

/**
 * Tudo que mexe nas respostas de segurança (pergunta + código de 4 dígitos) e na
 * revogação de sessão de platform_admins. Separado de platformAdmins.ts
 * (cadastro/equipe) de propósito: aqui entram hashes, então só os routers de
 * login/segurança e os scripts de CLI devem importar este arquivo. NADA daqui
 * vai direto numa resposta de tRPC.
 */

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  return db;
}

/** Registro COMPLETO (inclui hash de senha e hashes das respostas) — uso interno do login/segurança, nunca devolver ao cliente. */
export async function getPlatformAdminSecurityRecord(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [admin] = await db.select().from(platformAdmins).where(eq(platformAdmins.id, id)).limit(1);
  return admin;
}

/** Liga (ou troca) a verificação: grava só os HASHES das respostas e derruba as sessões antigas. */
export async function setPlatformAdminSecurityAnswers(id: number, hashes: { friendHash: string; pinHash: string }): Promise<void> {
  const db = await requireDb();
  await db
    .update(platformAdmins)
    .set({ securityEnabled: true, securityFriendHash: hashes.friendHash, securityPinHash: hashes.pinHash, sessionsValidAfter: nowInSeconds(), updatedAt: Date.now() })
    .where(eq(platformAdmins.id, id));
}

/** Desliga a verificação: apaga os hashes e derruba as sessões. Usado pela tela Segurança e pelo script de reset. */
export async function clearPlatformAdminSecurityAnswers(id: number): Promise<void> {
  const db = await requireDb();
  await db
    .update(platformAdmins)
    .set({ securityEnabled: false, securityFriendHash: null, securityPinHash: null, sessionsValidAfter: nowInSeconds(), updatedAt: Date.now() })
    .where(eq(platformAdmins.id, id));
}

/** "Sair de todos os dispositivos": toda sessão emitida até agora (segundos) deixa de valer. */
export async function revokeAllPlatformAdminSessions(id: number): Promise<void> {
  const db = await requireDb();
  await db.update(platformAdmins).set({ sessionsValidAfter: nowInSeconds(), updatedAt: Date.now() }).where(eq(platformAdmins.id, id));
}
