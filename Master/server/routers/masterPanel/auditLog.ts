import { z } from "zod";
import { listPlatformAuditLog } from "../../db/auditLog";
import { platformAdminProcedureFor, router } from "../../_core/trpc";

export const masterPanelAuditLogRouter = router({
  list: platformAdminProcedureFor("auditoria")
    .input(
      z.object({
        action: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.number().int().positive().optional(),
        beforeId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(200).optional(),
      }).optional(),
    )
    .query(({ input }) => listPlatformAuditLog(input ?? {})),
});
