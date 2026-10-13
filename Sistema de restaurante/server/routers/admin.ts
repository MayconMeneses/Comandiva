// Barrel: `adminRouter` continua tendo os mesmos procedimentos no mesmo nível
// (trpc.admin.saveProduct, trpc.admin.dashboard, etc.), mas a implementação
// fica dividida por domínio em `server/routers/admin/*.ts` — evita um único
// arquivo "god file" com todo o painel administrativo junto.
import { mergeRouters } from "../_core/trpc";
import { adminAuditRouter } from "./admin/audit";
import { adminBillingRouter } from "./admin/billing";
import { adminCatalogRouter } from "./admin/catalog";
import { adminCustomersRouter } from "./admin/customers";
import { adminDeliveryRoutesRouter } from "./admin/deliveryRoutes";
import { adminEventsRouter } from "./admin/events";
import { adminFaqRouter } from "./admin/faq";
import { adminLicenseRouter } from "./admin/license";
import { adminOperationsRouter } from "./admin/operations";
import { adminOrdersRouter } from "./admin/orders";
import { adminPaymentGatewaysRouter } from "./admin/paymentGateways";
import { adminPromotionsRouter } from "./admin/promotions";
import { adminReportsRouter } from "./admin/reports";
import { adminSettingsRouter } from "./admin/settings";
import { adminTablesRouter } from "./admin/tables";

export const adminRouter = mergeRouters(
  adminAuditRouter,
  adminBillingRouter,
  adminOrdersRouter,
  adminOperationsRouter,
  adminCatalogRouter,
  adminPromotionsRouter,
  adminReportsRouter,
  adminDeliveryRoutesRouter,
  adminSettingsRouter,
  adminPaymentGatewaysRouter,
  adminEventsRouter,
  adminFaqRouter,
  adminCustomersRouter,
  adminTablesRouter,
  adminLicenseRouter,
);
