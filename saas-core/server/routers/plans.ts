import { listPlansWithFeaturesAndLimits } from "../db/plans";
import { operatorProcedure, router } from "../_core/trpc";

export const plansRouter = router({
  list: operatorProcedure.query(() => listPlansWithFeaturesAndLimits()),
});
