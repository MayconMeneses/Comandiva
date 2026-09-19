import { and, eq } from "drizzle-orm";
import { fiscalDocuments, fiscalSettings } from "../../drizzle/schema";
import { decryptField, encryptField } from "../_core/fieldEncryption";
import { ENV } from "../_core/env";
import { getDb } from "./client";
import { ensureDefaultFiscalTaxCategory } from "./fiscalTaxCategories";

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
 * Visão pública dos dados fiscais — segredos (certificado, token do
 * provedor) nunca saem daqui, só um booleano indicando se já foram
 * configurados. Mesmo padrão de credenciais de gateway de pagamento
 * (paymentGateways.ts).
 */
export async function getFiscalSettings() {
  const row = await getOrCreateFiscalSettingsRow();
  return {
    cnpj: row.cnpj,
    inscricaoEstadual: row.inscricaoEstadual,
    regimeTributario: row.regimeTributario,
    environment: row.environment,
    hasProviderApiToken: Boolean(row.providerApiTokenEncrypted),
    hasCertificate: Boolean(row.certificateEncrypted),
    certificateFilename: row.certificateFilename,
    certificateExpiresAt: row.certificateExpiresAt,
    // Só considera "pronto" quando todo o cadastral + os dois segredos existem.
    isReady: Boolean(row.cnpj && row.inscricaoEstadual && row.regimeTributario && row.providerApiTokenEncrypted && row.certificateEncrypted),
  };
}

export async function saveFiscalCadastralData(input: { cnpj: string; inscricaoEstadual: string; regimeTributario: (typeof fiscalSettings.$inferSelect)["regimeTributario"] }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const row = await getOrCreateFiscalSettingsRow();
  await db.update(fiscalSettings).set({ ...input, updatedAt: Date.now() }).where(eq(fiscalSettings.id, row.id));
  if (input.regimeTributario) await ensureDefaultFiscalTaxCategory(input.regimeTributario);
}

/**
 * Troca `environment` pra PRODUCAO — nunca editável livremente pelo dono
 * (não é um campo de formulário, ver Etapa 1/6 do plano de emissão). Exige
 * pelo menos 1 emissão de teste bem-sucedida em HOMOLOGACAO antes — checado
 * aqui no servidor (nunca só escondendo o botão no frontend, mesmo padrão
 * já usado no resto do sistema), pra nunca gerar nota "de verdade" sem
 * validar que a emissão funciona de ponta a ponta primeiro.
 */
export async function confirmFiscalProductionReady() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const row = await getOrCreateFiscalSettingsRow();
  const [tested] = await db.select({ id: fiscalDocuments.id }).from(fiscalDocuments).where(and(eq(fiscalDocuments.environment, "HOMOLOGACAO"), eq(fiscalDocuments.status, "AUTHORIZED"))).limit(1);
  if (!tested) throw new Error("Emita pelo menos uma nota de teste em homologação com sucesso antes de ativar a produção.");
  await db.update(fiscalSettings).set({ environment: "PRODUCAO", updatedAt: Date.now() }).where(eq(fiscalSettings.id, row.id));
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

export async function saveFiscalProviderToken(token: string) {
  if (!ENV.fiscalEncryptionKey) throw new Error("FISCAL_ENCRYPTION_KEY não está configurada no servidor — não é possível salvar o token com segurança.");
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const row = await getOrCreateFiscalSettingsRow();
  const providerApiTokenEncrypted = await encryptField(token, ENV.fiscalEncryptionKey);
  await db.update(fiscalSettings).set({ providerApiTokenEncrypted, updatedAt: Date.now() }).where(eq(fiscalSettings.id, row.id));
}

/**
 * Descriptografa os segredos pra uso interno (chamada à API do provedor de
 * emissão) — NUNCA chamar isso a partir de um procedure que devolve o
 * resultado direto pro cliente. Único consumidor: server/_core/nfceEmission.ts.
 */
export async function getFiscalCredentialsForEmission() {
  if (!ENV.fiscalEncryptionKey) throw new Error("FISCAL_ENCRYPTION_KEY não está configurada.");
  const row = await getOrCreateFiscalSettingsRow();
  if (!row.certificateEncrypted || !row.certificatePasswordEncrypted || !row.providerApiTokenEncrypted) {
    throw new Error("Certificado digital ou token do provedor de emissão ainda não configurados.");
  }
  if (!row.cnpj || !row.inscricaoEstadual || !row.regimeTributario) {
    throw new Error("Dados cadastrais (CNPJ/Inscrição Estadual/regime tributário) ainda não configurados.");
  }
  const [certificateBase64, certificatePassword, providerApiToken] = await Promise.all([
    decryptField(row.certificateEncrypted, ENV.fiscalEncryptionKey),
    decryptField(row.certificatePasswordEncrypted, ENV.fiscalEncryptionKey),
    decryptField(row.providerApiTokenEncrypted, ENV.fiscalEncryptionKey),
  ]);
  return { certificateBase64, certificatePassword, providerApiToken, cnpj: row.cnpj, inscricaoEstadual: row.inscricaoEstadual, regimeTributario: row.regimeTributario, environment: row.environment, nfceSeries: row.nfceSeries };
}

/** NFC-e de um pedido avulso (delivery/retirada/balcão) — usado pela tela de comprovante pra mostrar/imprimir o DANFE quando pronto. `undefined` se a emissão ainda nem foi disparada. */
export async function getFiscalDocumentByOrderId(orderId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [row] = await db.select().from(fiscalDocuments).where(eq(fiscalDocuments.orderId, orderId)).limit(1);
  return row;
}

/** NFC-e consolidada de uma comanda de mesa fechada — mesmo uso de `getFiscalDocumentByOrderId`, mas pelo `tableSessionId`. */
export async function getFiscalDocumentByTableSessionId(tableSessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [row] = await db.select().from(fiscalDocuments).where(eq(fiscalDocuments.tableSessionId, tableSessionId)).limit(1);
  return row;
}
