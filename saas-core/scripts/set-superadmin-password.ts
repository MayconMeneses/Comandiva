import "dotenv/config";
import { parseArgs } from "node:util";
import { getPlatformAdminByEmail, updatePlatformAdminPassword } from "../server/db/platformAdmins";

/**
 * Troca a senha de um Super Admin já existente — bootstrap-platform-admin.ts
 * é idempotente e nunca mexe numa conta que já existe, então esse é o
 * caminho pra resetar senha sem apagar/recriar a conta.
 *
 * Uso:
 *   pnpm set-superadmin-password --email dono@exemplo.com --password "nova senha"
 */
async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, password: { type: "string" } } });
  if (!values.email || !values.password) {
    console.error('Uso: tsx scripts/set-superadmin-password.ts --email "..." --password "..."');
    process.exit(1);
  }

  const admin = await getPlatformAdminByEmail(values.email);
  if (!admin) {
    console.error(`Nenhum Super Admin encontrado com o e-mail ${values.email}.`);
    process.exit(1);
  }

  await updatePlatformAdminPassword(admin.id, values.password);
  console.log(`Senha atualizada para ${admin.email}.`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("[set-superadmin-password] Falhou:", error);
    process.exit(1);
  });
