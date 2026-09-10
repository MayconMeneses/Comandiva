import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { planKeyValues, restaurantStatusValues, subscriptionStatusValues } from "../../../drizzle/schema";
import {
  createRestaurantWithSubscription,
  getRestaurantById,
  getRestaurantDetailForPanel,
  listRestaurantsForPanel,
  markRestaurantDelivered,
  rotateApiKey as rotateApiKeyDb,
  setRestaurantDeploymentUrl,
  setRestaurantStatus,
  updateRestaurantContact,
} from "../../db/restaurants";
import { assignPlan, getSubscriptionForRestaurant, listSubscriptionEventsForRestaurant, updateSubscriptionStatus } from "../../db/subscriptions";
import { recordPlatformAuditLog } from "../../db/auditLog";
import { platformAdminProcedureFor, router } from "../../_core/trpc";

const restaurantsProcedure = platformAdminProcedureFor("restaurantes");

export const masterPanelRestaurantsRouter = router({
  create: restaurantsProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(160),
        planKey: z.enum(planKeyValues),
        contactName: z.string().trim().max(160).optional(),
        contactEmail: z.string().trim().email().optional(),
        contactPhone: z.string().trim().max(24).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const actor = `platform_admin:${ctx.platformAdmin.email}`;
      const result = await createRestaurantWithSubscription({ ...input, actor });
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "restaurant.created",
        entityType: "restaurant",
        entityId: result.restaurantId,
        after: { name: input.name, planKey: input.planKey },
        ip: ctx.req.ip,
      });
      return result;
    }),

  list: restaurantsProcedure
    .input(z.object({ status: z.enum(restaurantStatusValues).optional(), planKey: z.enum(planKeyValues).optional() }).optional())
    .query(({ input }) => listRestaurantsForPanel(input ?? {})),

  detail: restaurantsProcedure.input(z.object({ restaurantId: z.number().int().positive() })).query(async ({ input }) => {
    const detail = await getRestaurantDetailForPanel(input.restaurantId);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });
    return detail;
  }),

  subscriptionEvents: restaurantsProcedure
    .input(z.object({ restaurantId: z.number().int().positive() }))
    .query(({ input }) => listSubscriptionEventsForRestaurant(input.restaurantId)),

  assignPlan: restaurantsProcedure
    .input(z.object({ restaurantId: z.number().int().positive(), planKey: z.enum(planKeyValues) }))
    .mutation(async ({ input, ctx }) => {
      if (!(await getRestaurantById(input.restaurantId))) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });
      const before = await getSubscriptionForRestaurant(input.restaurantId);
      const actor = `platform_admin:${ctx.platformAdmin.email}`;
      const result = await assignPlan({ restaurantId: input.restaurantId, planKey: input.planKey, actor });
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "restaurant.plan_changed",
        entityType: "restaurant",
        entityId: input.restaurantId,
        before: { planKey: before?.plan.key },
        after: { planKey: input.planKey },
        ip: ctx.req.ip,
      });
      return result;
    }),

  updateSubscriptionStatus: restaurantsProcedure
    .input(z.object({ restaurantId: z.number().int().positive(), status: z.enum(subscriptionStatusValues) }))
    .mutation(async ({ input, ctx }) => {
      if (!(await getRestaurantById(input.restaurantId))) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });
      const before = await getSubscriptionForRestaurant(input.restaurantId);
      const actor = `platform_admin:${ctx.platformAdmin.email}`;
      const result = await updateSubscriptionStatus({ restaurantId: input.restaurantId, status: input.status, actor });
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "restaurant.subscription_status_changed",
        entityType: "restaurant",
        entityId: input.restaurantId,
        before: { status: before?.subscription.status },
        after: { status: input.status },
        ip: ctx.req.ip,
      });
      return result;
    }),

  updateDeploymentUrl: restaurantsProcedure
    .input(z.object({ restaurantId: z.number().int().positive(), deploymentUrl: z.string().trim().url().max(500).nullable() }))
    .mutation(async ({ input, ctx }) => {
      const before = await getRestaurantById(input.restaurantId);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });
      await setRestaurantDeploymentUrl(input.restaurantId, input.deploymentUrl);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "restaurant.deployment_url_changed",
        entityType: "restaurant",
        entityId: input.restaurantId,
        before: { deploymentUrl: before?.deploymentUrl ?? null },
        after: { deploymentUrl: input.deploymentUrl },
        ip: ctx.req.ip,
      });
      return { success: true };
    }),

  updateContact: restaurantsProcedure
    .input(
      z.object({
        restaurantId: z.number().int().positive(),
        name: z.string().trim().min(2).max(160).optional(),
        contactName: z.string().trim().max(160).optional(),
        contactEmail: z.string().trim().email().optional(),
        contactPhone: z.string().trim().max(24).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { restaurantId, ...contactInput } = input;
      const before = await getRestaurantById(restaurantId);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });
      await updateRestaurantContact(restaurantId, contactInput);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "restaurant.contact_updated",
        entityType: "restaurant",
        entityId: restaurantId,
        before: { name: before?.name, contactName: before?.contactName, contactEmail: before?.contactEmail, contactPhone: before?.contactPhone },
        after: contactInput,
        ip: ctx.req.ip,
      });
      return { success: true };
    }),

  setStatus: restaurantsProcedure
    .input(z.object({ restaurantId: z.number().int().positive(), status: z.enum(restaurantStatusValues) }))
    .mutation(async ({ input, ctx }) => {
      const before = await getRestaurantById(input.restaurantId);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });
      const result = await setRestaurantStatus(input.restaurantId, input.status);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "restaurant.status_changed",
        entityType: "restaurant",
        entityId: input.restaurantId,
        before: { status: before?.status },
        after: { status: input.status },
        ip: ctx.req.ip,
      });
      return result;
    }),

  markDelivered: restaurantsProcedure
    .input(z.object({ restaurantId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (!(await getRestaurantById(input.restaurantId))) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });
      const actor = `platform_admin:${ctx.platformAdmin.email}`;
      const result = await markRestaurantDelivered(input.restaurantId, actor);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "restaurant.marked_delivered",
        entityType: "restaurant",
        entityId: input.restaurantId,
        after: { trialEndsAt: result.trialEndsAt },
        ip: ctx.req.ip,
      });
      return result;
    }),

  rotateApiKey: restaurantsProcedure
    .input(z.object({ restaurantId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      if (!(await getRestaurantById(input.restaurantId))) throw new TRPCError({ code: "NOT_FOUND", message: "Restaurante não encontrado." });
      const result = await rotateApiKeyDb(input.restaurantId);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "restaurant.api_key_rotated",
        entityType: "restaurant",
        entityId: input.restaurantId,
        ip: ctx.req.ip,
      });
      return result;
    }),
});
