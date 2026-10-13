import { z } from "zod";
import { getMasterPanelSettings, setMasterPanelBackgroundColor } from "../../db/masterPanelSettings";
import { recordPlatformAuditLog } from "../../db/auditLog";
import { platformAdminProcedure, platformAdminProcedureFor, router } from "../../_core/trpc";

export const masterPanelSettingsRouter = router({
  // Leitura aberta a qualquer admin logado (owner ou member) — é a aparência
  // COMPARTILHADA do Painel Master, precisa aplicar pra todo mundo que entra,
  // não só pra quem tem a área "aparencia" liberada. Só a ESCRITA é travada.
  getAppearance: platformAdminProcedure.query(() => getMasterPanelSettings()),
  updateAppearance: platformAdminProcedureFor("aparencia")
    .input(z.object({ backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i).nullable() }))
    .mutation(async ({ input, ctx }) => {
      const normalized = input.backgroundColor ? input.backgroundColor.toLowerCase() : null;
      const result = await setMasterPanelBackgroundColor(normalized);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "appearance.updated",
        after: { backgroundColor: normalized },
        ip: ctx.req.ip,
      });
      return result;
    }),
});
