// Criptografa, no banco, as chaves de gateway de pagamento que ainda estão em
// texto puro (gravadas antes da DATA_ENCRYPTION_KEY existir). Seguro de rodar
// mais de uma vez: valores já criptografados (prefixo "enc:v1:") são ignorados.
//
// Roda em "dry-run" por padrão (só mostra o que faria). Use --apply para gravar.
// Exige DATA_ENCRYPTION_KEY no .env (mínimo 32 caracteres).
//
// Como rodar (com os containers no ar):
//   docker compose -f docker-compose.independent.yml exec app node_modules/.bin/tsx scripts/encrypt-gateway-keys.ts
//   docker compose -f docker-compose.independent.yml exec app node_modules/.bin/tsx scripts/encrypt-gateway-keys.ts --apply

import { eq } from "drizzle-orm";
import { paymentGateways } from "../drizzle/schema";
import { getDb } from "../server/db";
import { ENV } from "../server/_core/env";
import { createSecretBox, isEncryptedSecret } from "../server/_core/secretBox";

const apply = process.argv.includes("--apply");

if (!ENV.dataEncryptionKey) {
  console.error("DATA_ENCRYPTION_KEY não está configurada no .env — nada foi alterado.");
  process.exit(1);
}
const box = createSecretBox(ENV.dataEncryptionKey);

const db = await getDb();
if (!db) throw new Error("Banco de dados indisponível");

const rows = await db.select({ id: paymentGateways.id, label: paymentGateways.label, apiKey: paymentGateways.apiKey, secretKey: paymentGateways.secretKey }).from(paymentGateways);
let converted = 0;
for (const row of rows) {
  const values: { apiKey?: string; secretKey?: string } = {};
  if (row.apiKey && !isEncryptedSecret(row.apiKey)) values.apiKey = box.encrypt(row.apiKey);
  if (row.secretKey && !isEncryptedSecret(row.secretKey)) values.secretKey = box.encrypt(row.secretKey);
  if (!Object.keys(values).length) continue;
  converted++;
  console.log(`${apply ? "Criptografando" : "[dry-run] criptografaria"} gateway #${row.id} (${row.label}): ${Object.keys(values).join(", ")}`);
  if (apply) await db.update(paymentGateways).set(values).where(eq(paymentGateways.id, row.id));
}
console.log(`${rows.length} gateway(s) no banco; ${converted} ${apply ? "convertido(s)" : "a converter"}.${apply || !converted ? "" : " Rode de novo com --apply para gravar."}`);
process.exit(0);
