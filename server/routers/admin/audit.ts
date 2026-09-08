import { z } from "zod";
import { getRecentAuditEntries } from "../../db";
import { adminProcedure, router } from "../../_core/trpc";

// adminProcedure (não restaurantProcedureFor) de propósito: essa tela existe
// justamente pro dono acompanhar o que a EQUIPE fez — não faz sentido
// liberar por permissão pra um staff se auto-auditar. Ver shared/permissions.ts.
export const adminAuditRouter = router({
  recent: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(200).default(100) }).optional()).query(({ input }) => getRecentAuditEntries(input?.limit ?? 100)),
});
