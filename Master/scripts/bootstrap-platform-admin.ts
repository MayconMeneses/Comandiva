import "dotenv/config";
import { ENV } from "../server/_core/env";
import { bootstrapFirstPlatformAdmin } from "../server/_core/platformBootstrap";

/**
 * Bootstrap do primeiro Super Admin — roda a cada boot (infra/entrypoint.sh),
 * mas só cria a conta quando não existe NENHUM admin; depois disso nunca
 * altera conta existente. Detalhes e motivo em server/_core/platformBootstrap.ts.
 */
async function main() {
  const result = await bootstrapFirstPlatformAdmin({
    name: ENV.bootstrapSuperadminName,
    email: ENV.bootstrapSuperadminEmail,
    password: ENV.bootstrapSuperadminPassword,
  });
  if (result === "created") console.info(`[bootstrap-platform-admin] Super Admin inicial criado: ${ENV.bootstrapSuperadminEmail.trim().toLowerCase()}`);
  else if (result === "admin-already-exists") console.info("[bootstrap-platform-admin] Já existe Super Admin; nada a fazer.");
  else console.info("[bootstrap-platform-admin] BOOTSTRAP_SUPERADMIN_* não definido; nada a fazer.");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("[bootstrap-platform-admin] Falhou:", error);
    process.exit(1);
  });
