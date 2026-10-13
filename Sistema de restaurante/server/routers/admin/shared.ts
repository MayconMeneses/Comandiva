import { z } from "zod";
import { ORDER_STATUSES, endOfDayInRestaurantTimezone, startOfDayInRestaurantTimezone } from "../../../shared/orderDomain";
import { addressSchema, phoneSchema, safeText } from "../customer";

export const statusSchema = z.enum(ORDER_STATUSES);

/** Mesmo contrato de admin/orders.ts::dashboard — recebe só a INTENÇÃO do período, nunca startAt/endAt prontos do cliente (ver auditoria V-25). Reaproveitado pelos relatórios completo/avançado pra não duplicar essa regra. */
export const reportPeriodSchema = z.object({ range: z.enum(["today", "7days", "30days", "custom"]).default("today"), customDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional();
export function resolveReportPeriod(input?: z.infer<typeof reportPeriodSchema>) {
  const range = input?.range ?? "today";
  const now = Date.now();
  return range === "custom" && input?.customDate
    ? { startAt: startOfDayInRestaurantTimezone(0, new Date(`${input.customDate}T12:00:00Z`)), endAt: endOfDayInRestaurantTimezone(input.customDate) }
    : { startAt: startOfDayInRestaurantTimezone(range === "today" ? 0 : range === "7days" ? 7 : 30), endAt: now };
}
export const optionalId = z.number().int().positive().optional();
export const sortOrder = z.number().int().min(0).max(999).default(0);
export const orderInfoSchema = z.object({
  orderId: z.number().int().positive(),
  customerName: safeText(z.string().trim().min(2).max(160)),
  customerPhone: phoneSchema,
  customerNote: safeText(z.string().max(500)).optional(),
  internalNote: z.string().max(500).optional(),
  deliveryRouteName: z.string().max(120).optional(),
  address: addressSchema.optional(),
});
