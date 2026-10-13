import { z } from "zod";
import { planKeyValues } from "../../../drizzle/schema";
import { listAllFeatures, listPlansWithFeaturesAndLimits, saveFeature, savePlan, setPlanFeature, setPlanLimit } from "../../db/plans";
import { recordPlatformAuditLog } from "../../db/auditLog";
import { platformAdminProcedureFor, router } from "../../_core/trpc";

const plansProcedure = platformAdminProcedureFor("planos");

export const masterPanelPlansRouter = router({
  list: plansProcedure.query(async () => ({ plans: await listPlansWithFeaturesAndLimits(), features: await listAllFeatures() })),

  savePlan: plansProcedure
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        key: z.enum(planKeyValues).optional(),
        name: z.string().trim().min(1).max(80),
        priceCents: z.number().int().nonnegative(),
        currency: z.string().trim().length(3).optional(),
        position: z.number().int().positive(),
        active: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!input.id && !input.key) throw new Error("key é obrigatório para criar um novo plano");
      const result = await savePlan(input);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "plan.updated",
        entityType: "plan",
        entityId: result.id,
        after: input,
        ip: ctx.req.ip,
      });
      return result;
    }),

  saveFeature: plansProcedure
    .input(
      z.object({
        featureId: z.string().trim().min(1).max(60),
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(500).optional(),
        category: z.string().trim().max(60).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await saveFeature(input);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "plan.feature_updated",
        entityType: "feature",
        after: input,
        ip: ctx.req.ip,
      });
      return result;
    }),

  setPlanFeature: plansProcedure
    .input(z.object({ planId: z.number().int().positive(), featureId: z.string().trim().min(1).max(60), enabled: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const result = await setPlanFeature(input.planId, input.featureId, input.enabled);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "plan.feature_toggled",
        entityType: "plan",
        entityId: input.planId,
        after: { featureId: input.featureId, enabled: input.enabled },
        ip: ctx.req.ip,
      });
      return result;
    }),

  setPlanLimit: plansProcedure
    .input(z.object({ planId: z.number().int().positive(), resourceKey: z.string().trim().min(1).max(60), limitValue: z.number().int().nonnegative().nullable() }))
    .mutation(async ({ input, ctx }) => {
      const result = await setPlanLimit(input.planId, input.resourceKey, input.limitValue);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "plan.limit_updated",
        entityType: "plan",
        entityId: input.planId,
        after: { resourceKey: input.resourceKey, limitValue: input.limitValue },
        ip: ctx.req.ip,
      });
      return result;
    }),
});
