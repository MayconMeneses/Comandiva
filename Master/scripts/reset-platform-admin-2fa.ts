import "dotenv/config";
import { recordPlatformAuditLog } from "../server/db/auditLog";
import { getPlatformAdminByEmail } from "../server/db/platformAdmins";
import { disablePlatformAdminTotp } from "../server/db/platformAdminSecurity";
import { buildTotpResetCliMessage, sendTelegramMessage } from "../server/_core/telegramService";

/**
 * Saída de emergência do 2FA do Painel Master (celular perdido E códigos de
 * recuperação perdidos): desliga o 2FA da conta, apaga segredo e códigos e
 * derruba todas as sessões. Só roda com acesso ao servidor (nenhuma rota HTTP
 * chama isto) e fica registrado no log de auditoria como "cli:reset-2fa".
 *
 * Uso (na VPS, de dentro da pasta saas-core):
 *   docker compose -f docker-compose.saas-core.yml exec app node_modules/.bin/tsx scripts/reset-platform-admin-2fa.ts email@do-admin.com
 * Depois a pessoa entra só com e-mail+senha e ativa o 2FA de novo em Segurança.
 */
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Uso: tsx scripts/reset-platform-admin-2fa.ts <email-do-admin>");
    process.exit(1);
  }

  const admin = await getPlatformAdminByEmail(email);
  if (!admin) {
    console.error(`Nenhum Super Admin encontrado com o e-mail ${email}.`);
    process.exit(1);
  }

  await disablePlatformAdminTotp(admin.id);
  await recordPlatformAuditLog({
    actorAdminId: null,
    actorLabel: "cli:reset-2fa",
    action: "admin.totp_reset_cli",
    entityType: "platform_admin",
    entityId: admin.id,
    after: { email: admin.email },
    ip: "cli",
  });
  // Aguardado (o processo encerra logo depois): ação de alto risco, sempre avisa o dono.
  await sendTelegramMessage(buildTotpResetCliMessage({ email: admin.email }));
  console.log(`2FA desligado para ${admin.email}. Todas as sessões dessa conta foram encerradas.`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("[reset-platform-admin-2fa] Falhou:", error);
    process.exit(1);
  });
