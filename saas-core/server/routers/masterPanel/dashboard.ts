import { getDashboardSummary } from "../../db/dashboard";
import { platformAdminProcedure, router } from "../../_core/trpc";

export const masterPanelDashboardRouter = router({
  summary: platformAdminProcedure.query(() => getDashboardSummary()),
});
