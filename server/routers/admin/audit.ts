import { z } from "zod";
import { getRecentAuditEntries, listAccountAuditEntries } from "../../db";
import { adminProcedure, requireFeature, router } from "../../_core/trpc";

// adminProcedure (não restaurantProcedureFor) de propósito: essa tela existe
// justamente pro dono acompanhar o que a EQUIPE fez — não faz sentido
// liberar por permissão pra um staff se auto-auditar. Ver shared/permissions.ts.
// Recurso de plano (Premium) desde a reestruturação de planos, 2026-09-11 —
// mesmo padrão já usado em admin/promotions.ts/events.ts.
const auditProcedure = adminProcedure.use(requireFeature("audit"));

export const adminAuditRouter = router({
  recent: auditProcedure.input(z.object({ limit: z.number().int().min(1).max(200).default(100) }).optional()).query(({ input }) => getRecentAuditEntries(input?.limit ?? 100)),
  // Ações administrativas sensíveis (equipe/permissões, gateway de
  // pagamento, chave Pix) — trilha separada da de pedidos acima (achado M1
  // da auditoria de segurança, ver drizzle/schema.ts::accountAuditLog).
  recentAccountActions: auditProcedure.input(z.object({ limit: z.number().int().min(1).max(200).default(100) }).optional()).query(({ input }) => listAccountAuditEntries(input?.limit ?? 100)),
});
