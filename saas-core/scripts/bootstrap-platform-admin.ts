import "dotenv/config";
import { ENV } from "../server/_core/env";
import { createPlatformAdmin, getPlatformAdminByEmail } from "../server/db/platformAdmins";

/**
 * Bootstrap idempotente do primeiro Super Admin — mesmo padrão de
 * BOOTSTRAP_ADMIN_* já usado em scripts/seed.ts do app principal: só age se
 * as 3 variáveis estiverem definidas, e nunca duplica se a conta já existir.
 */
async function main() {
  const name = ENV.bootstrapSuperadminName.trim();
  const email = ENV.bootstrapSuperadminEmail.trim().toLowerCase();
  const password = ENV.bootstrapSuperadminPassword;

  if (!name || !email || !password) {
    console.info("[bootstrap-platform-admin] BOOTSTRAP_SUPERADMIN_* não definido; nada a fazer.");
    return;
  }
  const existing = await getPlatformAdminByEmail(email);
  if (existing) {
    console.info(`[bootstrap-platform-admin] Já existe: ${email}`);
    return;
  }
  await createPlatformAdmin({ name, email, password });
  console.info(`[bootstrap-platform-admin] Super Admin inicial criado: ${email}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("[bootstrap-platform-admin] Falhou:", error);
    process.exit(1);
  });
