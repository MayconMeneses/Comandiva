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
import { assertWithinPlanLimit, assertWithinPlanLimitAndInsert } from "../../_core/planLimits";
import { adminProcedure, requireFeature, restaurantProcedure, router } from "../../_core/trpc";
import { phoneSchema, safeText } from "../customer";
import { addRoundToTable, roundItemSchema } from "../table";
import { sortOrder } from "./shared";

const reservationStatusSchema = z.enum(["REQUESTED", "CONFIRMED", "SEATED", "CANCELLED", "NO_SHOW"]);
const billMethodSchema = z.enum(["PIX", "CASH", "CARD_ON_DELIVERY", "CARD_ONLINE"]);

// A tela /admin/mesas inteira fica trancada no frontend atrás de tables_qr
// (TablesAdmin.tsx), mas isso sozinho não bloqueia nada — quem já está
// autenticado consegue chamar essas mutations direto por fora da UI. Todo
// procedure deste router precisa do mesmo gate no backend, não só o de
// criar mesa (que já tinha assertWithinPlanLimit, mas isso é limite de
// quantidade, não a feature em si — ver server/routers/table.ts:71-96, que
// já faz esse cuidado do lado público e chama esse tipo de furo pelo nome).
const tablesRestaurantProcedure = restaurantProcedure.use(requireFeature("tables_qr"));
const tablesAdminProcedure = adminProcedure.use(requireFeature("tables_qr"));

export const adminTablesRouter = router({
  tables: tablesRestaurantProcedure.query(() => listTablesWithOpenSessions()),
  seatTable: tablesRestaurantProcedure.input(z.object({ tableId: z.number().int().positive(), partySize: z.number().int().min(1).max(50).optional() })).mutation(async ({ input }) => {
    const session = await getOrOpenSessionForTable(input.tableId, input.partySize);
    return { sessionId: session.id };
  }),
  sessionDetail: tablesRestaurantProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(async ({ input }) => {
    const detail = await getSessionWithOrders(input.sessionId);
    if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "Comanda não encontrada." });
    return detail;
  }),
  createTable: tablesAdminProcedure
    .input(z.object({ label: z.string().trim().min(1).max(60), sector: z.string().trim().max(60).default(""), capacity: z.number().int().min(1).max(50).default(4), sortOrder }))
    .mutation(async ({ input }) => {
      return { id: await assertWithinPlanLimitAndInsert("tables", tx => createTable(input, tx)) };
    }),
  updateTable: tablesAdminProcedure
    .input(z.object({ id: z.number().int().positive(), label: z.string().trim().min(1).max(60).optional(), sector: z.string().trim().max(60).optional(), capacity: z.number().int().min(1).max(50).optional(), sortOrder: sortOrder.optional(), active: z.boolean().optional() }))
    .mutation(async ({ input: { id, ...rest } }) => {
      if (rest.active) await assertWithinPlanLimit("tables"); // reativar mesa desativada também conta contra o limite do plano
      await updateTable(id, rest);
      return { success: true };
    }),
  regenerateQr: tablesAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => ({ qrToken: await regenerateTableQrToken(input.id) })),
  addManualRound: tablesRestaurantProcedure
    .use(requireFeature("extra_rounds"))
    .input(z.object({ tableId: z.number().int().positive(), items: z.array(roundItemSchema).min(1), customerNote: safeText(z.string().max(500)).optional(), customer: z.object({ name: safeText(z.string().min(2).max(160)), phone: phoneSchema }).optional() }))
    .mutation(({ input }) => addRoundToTable({ tableId: input.tableId, items: input.items, customerNote: input.customerNote, customer: input.customer, historyNote: "Rodada lançada pela equipe", origin: "GARCOM" })),
  pendingServiceRequests: tablesRestaurantProcedure.query(() => listPendingServiceRequests()),
  resolveServiceRequest: tablesRestaurantProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["ACKNOWLEDGED", "DONE", "CANCELLED"]) })).mutation(async ({ input, ctx }) => {
    await resolveServiceRequest(input.id, input.status, ctx.user?.id ?? null);
    return { success: true };
  }),
  recordBillPayment: tablesRestaurantProcedure
    .input(z.object({ sessionId: z.number().int().positive(), method: billMethodSchema, amountCents: z.number().int().positive(), payerLabel: z.string().max(60).optional() }))
    .mutation(async ({ input }) => {
      await recordBillPayment(input.sessionId, input);
      return getSessionWithOrders(input.sessionId);
    }),
  closeSession: tablesRestaurantProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    try {
      return await closeTableSession(input.sessionId, ctx.user?.id ?? null);
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível fechar a comanda." });
    }
  }),
  cancelSession: tablesRestaurantProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ input }) => {
    await cancelTableSession(input.sessionId);
    return { success: true };
  }),
  recentClosedSessions: tablesAdminProcedure.query(() => listRecentClosedSessions()),
  reopenSession: tablesAdminProcedure.input(z.object({ sessionId: z.number().int().positive() })).mutation(async ({ input }) => {
    try {
      await reopenTableSession(input.sessionId);
      return { success: true };
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível reabrir a comanda." });
    }
  }),
  reservations: tablesRestaurantProcedure.input(z.object({ fromAt: z.number().optional(), toAt: z.number().optional() }).optional()).query(({ input }) => listReservations(input ?? {})),
  createReservation: tablesRestaurantProcedure
    .input(z.object({ customerName: safeText(z.string().trim().min(2).max(160)), customerPhone: phoneSchema, partySize: z.number().int().min(1).max(50), reservedFor: z.number().int().positive(), tableId: z.number().int().positive().optional(), notes: safeText(z.string().max(500)).optional() }))
    .mutation(async ({ input }) => {
      try {
        return { id: await createReservation(input) };
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível criar a reserva." });
      }
    }),
  updateReservation: tablesRestaurantProcedure
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
