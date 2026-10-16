import "dotenv/config";
import { recordPlatformAuditLog } from "../server/db/auditLog";
import { getPlatformAdminByEmail } from "../server/db/platformAdmins";
import { clearPlatformAdminSecurityAnswers } from "../server/db/platformAdminSecurity";
import { buildSecurityResetCliMessage, sendTelegramMessage } from "../server/_core/telegramService";

/**
 * Saída de emergência da verificação de segurança do Painel Master (esqueceu a
 * resposta da pergunta ou o código de 4 dígitos): apaga as respostas da conta e
 * derruba todas as sessões. Só roda com acesso ao servidor (nenhuma rota HTTP
 * chama isto) e fica registrado no log de auditoria como "cli:reset-2fa".
 *
 * Uso (na VPS, de dentro da pasta saas-core):
 *   docker compose -f docker-compose.saas-core.yml exec app node_modules/.bin/tsx scripts/reset-platform-admin-2fa.ts email@do-admin.com
 * Depois a pessoa entra só com e-mail+senha e cadastra a pergunta e o código de novo em Segurança.
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

  await clearPlatformAdminSecurityAnswers(admin.id);
  await recordPlatformAuditLog({
    actorAdminId: null,
    actorLabel: "cli:reset-2fa",
    action: "admin.security_reset_cli",
    entityType: "platform_admin",
    entityId: admin.id,
    after: { email: admin.email },
    ip: "cli",
  });
  // Aguardado (o processo encerra logo depois): ação de alto risco, sempre avisa o dono.
  await sendTelegramMessage(buildSecurityResetCliMessage({ email: admin.email }));
  console.log(`Verificação de segurança apagada para ${admin.email}. Todas as sessões dessa conta foram encerradas.`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("[reset-platform-admin-2fa] Falhou:", error);
    process.exit(1);
  });
