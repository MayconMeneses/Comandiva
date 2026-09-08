import { z } from "zod";
import { ORDER_STATUSES } from "../../../shared/orderDomain";
import { addressSchema, phoneSchema } from "../customer";

export const statusSchema = z.enum(ORDER_STATUSES);
export const optionalId = z.number().int().positive().optional();
export const sortOrder = z.number().int().min(0).max(999).default(0);
export const orderInfoSchema = z.object({
  orderId: z.number().int().positive(),
  customerName: z.string().trim().min(2).max(160),
  customerPhone: phoneSchema,
  customerNote: z.string().max(500).optional(),
  internalNote: z.string().max(500).optional(),
  deliveryRouteName: z.string().max(120).optional(),
  address: addressSchema.optional(),
});

export function startOfDay(daysAgo = 0) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return date.getTime();
}
