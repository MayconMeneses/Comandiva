import { z } from "zod";
import { ORDER_STATUSES } from "../../../shared/orderDomain";
import { addressSchema, phoneSchema, safeText } from "../customer";

export const statusSchema = z.enum(ORDER_STATUSES);
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
