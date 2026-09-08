import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  cancelTableSession,
  closeTableSession,
  createReservation,
  createTable,
  getOrOpenSessionForTable,
  getSessionWithOrders,
  listPendingServiceRequests,
  listRecentClosedSessions,
  listReservations,
  listTablesWithOpenSessions,
  recordBillPayment,
  regenerateTableQrToken,
  reopenTableSession,
  resolveServiceRequest,
  updateReservation,
  updateTable,
} from "../../db";
import { assertWithinPlanLimit } from "../../_core/planLimits";
import { adminProcedure, requireFeature, restaurantProcedure, router } from "../../_core/trpc";
import { phoneSchema } from "../customer";
import { addRoundToTable, roundItemSchema } from "../table";
import { sortOrder } from "./shared";

const reservationStatusSchema = z.enum(["REQUESTED", "CONFIRMED", "SEATED", "CANCELLED", "NO_SHOW"]);
const billMethodSchema = z.enum(["PIX", "CASH", "CARD_ON_DELIVERY", "CARD_ONLINE"]);

export const adminTablesRouter = router({
  tables: restaurantProcedure.query(() => listTablesWithOpenSessions()),
  seatTable: restaurantProcedure.input(z.object({ tableId: z.number().int().positive(), partySize: z.number().int().min(1).max(50).optional() })).mutation(async ({ input }) => {
    const session = await getOrOpenSessionForTable(input.tableId, input.partySize);
    return { sessionId: session.id };
  }),
  sessionDetail: restaurantProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(async ({ input }) => {
    const detail = await getSessionWithOrders(input.sessionId);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Comanda não encontrada." });
    return detail;
  }),
  createTable: adminProcedure
    .input(z.object({ label: z.string().trim().min(1).max(60), sector: z.string().trim().max(60).default(""), capacity: z.number().int().min(1).max(50).default(4), sortOrder }))
    .mutation(async ({ input }) => {
      await assertWithinPlanLimit("tables");
      return { id: await createTable(input) };
    }),
  updateTable: adminProcedure
    .input(z.object({ id: z.number().int().positive(), label: z.string().trim().min(1).max(60).optional(), sector: z.string().trim().max(60).optional(), capacity: z.number().int().min(1).max(50).optional(), sortOrder: sortOrder.optional(), active: z.boolean().optional() }))
    .mutation(async ({ input: { id, ...rest } }) => {
      if (rest.active) await assertWithinPlanLimit("tables"); // reativar mesa desativada também conta contra o limite do plano
      await updateTable(id, rest);
      return { success: true };
    }),
  regenerateQr: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ qrToken: await regenerateTableQrToken(input.id) })),
  addManualRound: restaurantProcedure
    .use(requireFeature("extra_rounds"))
    .input(z.object({ tableId: z.number().int().positive(), items: z.array(roundItemSchema).min(1), customerNote: z.string().max(500).optional(), customer: z.object({ name: z.string().min(2).max(160), phone: phoneSchema }).optional() }))
    .mutation(({ input }) => addRoundToTable({ tableId: input.tableId, items: input.items, customerNote: input.customerNote, customer: input.customer, historyNote: "Rodada lançada pela equipe", origin: "GARCOM" })),
  pendingServiceRequests: restaurantProcedure.query(() => listPendingServiceRequests()),
  resolveServiceRequest: restaurantProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["ACKNOWLEDGED", "DONE", "CANCELLED"]) })).mutation(async ({ input, ctx }) => {
    await resolveServiceRequest(input.id, input.status, ctx.user?.id ?? null);
    return { success: true };
  }),
  recordBillPayment: restaurantProcedure
    .input(z.object({ sessionId: z.number().int().positive(), method: billMethodSchema, amountCents: z.number().int().positive(), payerLabel: z.string().max(60).optional() }))
    .mutation(async ({ input }) => {
      await recordBillPayment(input.sessionId, input);
      return getSessionWithOrders(input.sessionId);
    }),
  closeSession: restaurantProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    try {
      return await closeTableSession(input.sessionId, ctx.user?.id ?? null);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível fechar a comanda." });
    }
  }),
  cancelSession: restaurantProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ input }) => {
    await cancelTableSession(input.sessionId);
    return { success: true };
  }),
  recentClosedSessions: adminProcedure.query(() => listRecentClosedSessions()),
  reopenSession: adminProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ input }) => {
    try {
      await reopenTableSession(input.sessionId);
      return { success: true };
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível reabrir a comanda." });
    }
  }),
  reservations: restaurantProcedure.input(z.object({ fromAt: z.number().optional(), toAt: z.number().optional() }).optional()).query(({ input }) => listReservations(input ?? {})),
  createReservation: restaurantProcedure
    .input(z.object({ customerName: z.string().trim().min(2).max(160), customerPhone: phoneSchema, partySize: z.number().int().min(1).max(50), reservedFor: z.number().int().positive(), tableId: z.number().int().positive().optional(), notes: z.string().max(500).optional() }))
    .mutation(async ({ input }) => {
      try {
        return { id: await createReservation(input) };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível criar a reserva." });
      }
    }),
  updateReservation: restaurantProcedure
    .input(z.object({ id: z.number().int().positive(), status: reservationStatusSchema.optional(), tableId: z.number().int().positive().nullable().optional(), notes: z.string().max(500).optional() }))
    .mutation(async ({ input: { id, ...rest } }) => {
      try {
        await updateReservation(id, rest);
        return { success: true };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível atualizar a reserva." });
      }
    }),
});
