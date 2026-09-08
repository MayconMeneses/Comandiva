import { eq } from "drizzle-orm";
import { fiscalSettings } from "../../drizzle/schema";
import { decryptField, encryptField } from "../_core/fieldEncryption";
import { ENV } from "../_core/env";
import { getDb } from "./client";

/** Sempre existe exatamente 1 linha (singleton), igual restaurant_settings/subscription_cache — criada na primeira leitura se ainda não houver nenhuma. */
async function getOrCreateFiscalSettingsRow() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [existing] = await db.select().from(fiscalSettings).limit(1);
  if (existing) return existing;
  const now = Date.now();
  await db.insert(fiscalSettings).values({ environment: "HOMOLOGACAO", nfceSeries: 1, nfceNextNumber: 1, createdAt: now, updatedAt: now });
  const [created] = await db.select().from(fiscalSettings).limit(1);
  return created!;
}

/**
 * Visão pública dos dados fiscais — segredos (certificado, token CSC) nunca
 * saem daqui, só um booleano indicando se já foram configurados. Mesmo
 * padrão de credenciais de gateway de pagamento (paymentGateways.ts).
 */
export async function getFiscalSettings() {
  const row = await getOrCreateFiscalSettingsRow();
  return {
    cnpj: row.cnpj,
    inscricaoEstadual: row.inscricaoEstadual,
    regimeTributario: row.regimeTributario,
    environment: row.environment,
    nfceSeries: row.nfceSeries,
    nfceNextNumber: row.nfceNextNumber,
    cscId: row.cscId,
    hasCscToken: Boolean(row.cscTokenEncrypted),
    hasCertificate: Boolean(row.certificateEncrypted),
    certificateFilename: row.certificateFilename,
    certificateExpiresAt: row.certificateExpiresAt,
    // Só considera "pronto" quando todo o cadastral + os dois segredos existem.
    isReady: Boolean(row.cnpj && row.inscricaoEstadual && row.regimeTributario && row.cscId && row.cscTokenEncrypted && row.certificateEncrypted),
  };
}

export async function saveFiscalCadastralData(input: { cnpj: string; inscricaoEstadual: string; regimeTributario: (typeof fiscalSettings.$inferSelect)["regimeTributario"]; environment: (typeof fiscalSettings.$inferSelect)["environment"]; nfceSeries: number; nfceNextNumber: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const row = await getOrCreateFiscalSettingsRow();
  await db.update(fiscalSettings).set({ ...input, updatedAt: Date.now() }).where(eq(fiscalSettings.id, row.id));
}

export async function saveFiscalCertificate(input: { base64: string; filename: string; password: string; expiresAt?: number }) {
  if (!ENV.fiscalEncryptionKey) throw new Error("FISCAL_ENCRYPTION_KEY não está configurada no servidor — não é possível salvar o certificado com segurança.");
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const row = await getOrCreateFiscalSettingsRow();
  const [certificateEncrypted, certificatePasswordEncrypted] = await Promise.all([
    encryptField(input.base64, ENV.fiscalEncryptionKey),
    encryptField(input.password, ENV.fiscalEncryptionKey),
  ]);
  await db.update(fiscalSettings).set({ certificateEncrypted, certificatePasswordEncrypted, certificateFilename: input.filename, certificateExpiresAt: input.expiresAt ?? null, updatedAt: Date.now() }).where(eq(fiscalSettings.id, row.id));
}

export async function saveFiscalCscToken(input: { cscId: string; token: string }) {
  if (!ENV.fiscalEncryptionKey) throw new Error("FISCAL_ENCRYPTION_KEY não está configurada no servidor — não é possível salvar o token com segurança.");
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const row = await getOrCreateFiscalSettingsRow();
  const cscTokenEncrypted = await encryptField(input.token, ENV.fiscalEncryptionKey);
  await db.update(fiscalSettings).set({ cscId: input.cscId, cscTokenEncrypted, updatedAt: Date.now() }).where(eq(fiscalSettings.id, row.id));
}

/**
 * Descriptografa os segredos pra uso interno (assinatura/QR Code da NFC-e) —
 * NUNCA chamar isso a partir de um procedure que devolve o resultado direto
 * pro cliente. Só pro futuro serviço de emissão (ainda não implementado —
 * falta CNPJ/regime tributário reais do restaurante pra calcular imposto).
 */
export async function getFiscalSecretsForSigning() {
  if (!ENV.fiscalEncryptionKey) throw new Error("FISCAL_ENCRYPTION_KEY não está configurada.");
  const row = await getOrCreateFiscalSettingsRow();
  if (!row.certificateEncrypted || !row.certificatePasswordEncrypted || !row.cscTokenEncrypted) {
    throw new Error("Certificado digital ou token CSC ainda não configurados.");
  }
  const [certificateBase64, certificatePassword, cscToken] = await Promise.all([
    decryptField(row.certificateEncrypted, ENV.fiscalEncryptionKey),
    decryptField(row.certificatePasswordEncrypted, ENV.fiscalEncryptionKey),
    decryptField(row.cscTokenEncrypted, ENV.fiscalEncryptionKey),
  ]);
  return { certificateBase64, certificatePassword, cscId: row.cscId, cscToken };
}
