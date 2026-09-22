import { router } from "../../_core/trpc";
import { masterPanelAuthRouter } from "./auth";
import { masterPanelDashboardRouter } from "./dashboard";
import { masterPanelRestaurantsRouter } from "./restaurants";
import { masterPanelPlansRouter } from "./plans";
import { masterPanelAuditLogRouter } from "./auditLog";
import { masterPanelSupportRouter } from "./support";
import { masterPanelBillingRouter } from "./billing";
import { masterPanelTeamRouter } from "./team";
import { masterPanelMaintenanceRouter } from "./maintenance";
import { masterPanelSettingsRouter } from "./settings";

export const masterPanelRouter = router({
  auth: masterPanelAuthRouter,
  dashboard: masterPanelDashboardRouter,
  restaurants: masterPanelRestaurantsRouter,
  plans: masterPanelPlansRouter,
  auditLog: masterPanelAuditLogRouter,
  support: masterPanelSupportRouter,
  billing: masterPanelBillingRouter,
  team: masterPanelTeamRouter,
  maintenance: masterPanelMaintenanceRouter,
  settings: masterPanelSettingsRouter,
});
