import { fetchPlanCatalog, forceSyncLicense, getLicenseSnapshot, getLicenseUsage } from "../../_core/license";
import { adminProcedure, router } from "../../_core/trpc";

// adminProcedure (não restaurantProcedure): confirmado em client/src/pages/Admin.tsx
// que todo o DashboardLayout/sidebar já é 100% restrito a role === "admin" —
// staff nunca vê essa UI, então não há motivo pra abrir mais que isso aqui.
export const adminLicenseRouter = router({
  mySnapshot: adminProcedure.query(async () => ({ ...(await getLicenseSnapshot()), usage: await getLicenseUsage() })),
  forceSync: adminProcedure.mutation(() => forceSyncLicense()),
  plans: adminProcedure.query(() => fetchPlanCatalog()),
});
