import { getReportsAdvanced, getReportsComplete, reportsAdvancedToCsv } from "../../db";
import { requireFeature, restaurantProcedureFor, router } from "../../_core/trpc";
import { reportPeriodSchema, resolveReportPeriod } from "./shared";

// Mesma área de staff do relatório básico ("reports") — permissão de staff é
// ortogonal a plano; quem já pode ver Relatórios pode tentar ver as camadas
// completa/avançada, mas só recebe dado de verdade se o PLANO liberar
// (requireFeature depois de restaurantProcedureFor, mesma ordem já usada em
// admin/events.ts/admin/promotions.ts).
const reportsCompleteProcedure = restaurantProcedureFor("reports").use(requireFeature("reports_complete"));
const reportsAdvancedProcedure = restaurantProcedureFor("reports").use(requireFeature("reports_advanced"));

export const adminReportsRouter = router({
  reportsComplete: reportsCompleteProcedure.input(reportPeriodSchema).query(async ({ input }) => {
    const { startAt, endAt } = resolveReportPeriod(input);
    return getReportsComplete(startAt, endAt);
  }),
  reportsAdvanced: reportsAdvancedProcedure.input(reportPeriodSchema).query(async ({ input }) => {
    const { startAt, endAt } = resolveReportPeriod(input);
    return getReportsAdvanced(startAt, endAt);
  }),
  exportReportsAdvanced: reportsAdvancedProcedure.input(reportPeriodSchema).query(async ({ input }) => {
    const { startAt, endAt } = resolveReportPeriod(input);
    const report = await getReportsAdvanced(startAt, endAt);
    return { csv: reportsAdvancedToCsv(report) };
  }),
});
