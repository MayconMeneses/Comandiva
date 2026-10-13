import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { askMaintenanceAssistant } from "../../_core/maintenanceAssistant";
import { checkRateLimit } from "../../_core/rateLimit";
import { platformAdminProcedureFor, router } from "../../_core/trpc";
import { recordPlatformAuditLog } from "../../db/auditLog";

const maintenanceProcedure = platformAdminProcedureFor("manutencao");

export const masterPanelMaintenanceRouter = router({
  ask: maintenanceProcedure
    .input(z.object({ question: z.string().trim().min(3).max(2000) }))
    .mutation(async ({ input, ctx }) => {
      // Reaproveita o limitador pensado pra força bruta de login só como teto
      // de custo/abuso (cada pergunta custa uma chamada à API da Anthropic) —
      // o controle de acesso em si já é garantido pela área "manutencao" acima.
      const limit = checkRateLimit(`maintenance-assistant:${ctx.platformAdmin.id}`);
      if (!limit.allowed) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas perguntas em pouco tempo — tente de novo em ${limit.retryAfterSeconds}s.` });
      }

      const result = await askMaintenanceAssistant(input.question);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "maintenance_assistant.asked",
        after: { question: input.question },
        ip: ctx.req.ip,
      });
      return result;
    }),
});
