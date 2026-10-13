import { getSiteStats } from "../../db/siteEvents";
import { getDashboardSummary } from "../../db/dashboard";
import { platformAdminProcedureFor, router } from "../../_core/trpc";

// MRR, distribuição de planos e tendência de cadastros são dado de negócio
// sensível — igual a billing/planos/auditoria, gateado por área (achado M4
// da auditoria: antes usava platformAdminProcedure puro, então um "member"
// sem nenhuma área concedida ainda via faturamento da plataforma inteira).
export const masterPanelDashboardRouter = router({
  summary: platformAdminProcedureFor("billing").query(() => getDashboardSummary()),
  // Medição anônima do site comercial — mesmo gate do resto do dashboard.
  siteStats: platformAdminProcedureFor("billing").query(() => getSiteStats()),
});
