import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { orderChangeLogs, orderStatusHistory, orders, payments, printJobs } from "../../../drizzle/schema";
import { ALLOWED_STATUS_TRANSITIONS, STATUS_LABELS } from "../../../shared/orderDomain";
import { getAdminOrders, getDashboardMetrics, getDb, getOrderWithDetails, getStoreSettings } from "../../db";
import { adminProcedure, restaurantProcedure, restaurantProcedureFor, router } from "../../_core/trpc";
import { keyFromPublicUrl, storageGetSignedUrl, storagePut } from "../../storage";
import { orderInfoSchema, startOfDay, statusSchema } from "./shared";

export const adminOrdersRouter = router({
  dashboard: restaurantProcedureFor("reports").input(z.object({ startAt: z.number().optional(), endAt: z.number().optional() }).optional()).query(async ({ input }) => {
    const endAt = input?.endAt ?? Date.now();
    const startAt = input?.startAt ?? startOfDay();
    const [metrics, recentOrders, rawSettings] = await Promise.all([
      getDashboardMetrics(startAt, endAt),
      getAdminOrders({ limit: 10 }),
      getStoreSettings(),
    ]);
    // dashboard só exige a permissão "reports" (e também é lido em Modo
    // Suporte) — chave/QR Pix não podem viajar nessa resposta; quem precisa
    // deles de verdade (tela de Conta) usa admin.getAccountSettings, que exige
    // adminOnlyProcedure de verdade (nunca staff, nunca Modo Suporte).
    const settings = rawSettings ? (({ pixKey: _pixKey, pixQrCodeUrl: _pixQrCodeUrl, ...safeSettings }) => safeSettings)(rawSettings) : rawSettings;
    return { ...metrics, recentOrders, settings, startAt, endAt };
  }),
  orders: restaurantProcedure.input(z.object({ status: statusSchema.optional(), startAt: z.number().optional(), endAt: z.number().optional(), limit: z.number().int().min(1).max(100).default(50) }).optional()).query(async ({ input }) =>
    getAdminOrders({ limit: input?.limit ?? 50, status: input?.status, startAt: input?.startAt, endAt: input?.endAt }),
  ),
  orderDetail: restaurantProcedure.input(z.object({ orderId: z.number().int().positive() })).query(async ({ input }) => {
    const order = await getOrderWithDetails(input.orderId);
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    return order;
  }),
  updateOrderInfo: adminProcedure.input(orderInfoSchema).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const [current] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
    if (!current || current.archivedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    const now = Date.now();
    const address = input.address;
    await db.update(orders).set({
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerNote: input.customerNote?.trim() || null,
      internalNote: input.internalNote?.trim() || null,
      deliveryRouteName: input.deliveryRouteName?.trim() || null,
      ...(address ? {
        deliveryPostalCode: address.postalCode || null,
        deliveryStreet: address.street,
        deliveryNumber: address.number,
        deliveryComplement: address.complement || null,
        deliveryNeighborhood: address.neighborhood,
        deliveryCity: address.city,
        deliveryState: address.state,
        deliveryReference: address.reference || null,
      } : {}),
      updatedAt: now,
    }).where(eq(orders.id, input.orderId));
    await db.insert(orderChangeLogs).values({ orderId: input.orderId, changedByUserId: ctx.user?.id ?? null, changeType: "ORDER_INFO_UPDATED", details: JSON.stringify({ fields: ["cliente", "telefone", "observações", "endereço", "rota"] }), createdAt: now });
    return getOrderWithDetails(input.orderId);
  }),
  // Anexo de pedido (ex.: comprovante de pagamento) fica num prefixo do
  // bucket que NÃO é público (ver server/storage.ts) — a URL salva em
  // orders.adminAttachmentUrl não é mais acessível direto, só via link
  // assinado de curta duração, gerado sob demanda pra quem já está
  // autenticado como admin.
  getAttachmentSignedUrl: adminProcedure.input(z.object({ orderId: z.number().int().positive() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const [current] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
    if (!current?.adminAttachmentUrl) return null;
    return { url: await storageGetSignedUrl(keyFromPublicUrl(current.adminAttachmentUrl)) };
  }),
  uploadOrderAttachment: adminProcedure.input(z.object({ orderId: z.number().int().positive(), filename: z.string().min(1).max(160), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), dataBase64: z.string().min(8).max(3_000_000) })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const [current] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
    if (!current || current.archivedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 2_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Envie uma imagem de até 2 MB." });
    const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const stored = await storagePut(`orders/${input.orderId}/${Date.now()}-${safeFilename}`, bytes, input.contentType);
    const now = Date.now();
    await db.update(orders).set({ adminAttachmentUrl: stored.url, adminAttachmentLabel: input.filename.slice(0, 160), updatedAt: now }).where(eq(orders.id, input.orderId));
    await db.insert(orderChangeLogs).values({ orderId: input.orderId, changedByUserId: ctx.user?.id ?? null, changeType: "ATTACHMENT_UPDATED", details: JSON.stringify({ filename: input.filename.slice(0, 160) }), createdAt: now });
    return getOrderWithDetails(input.orderId);
  }),
  deleteOrderAttachment: adminProcedure.input(z.object({ orderId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const [current] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
    if (!current || current.archivedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    const now = Date.now();
    await db.update(orders).set({ adminAttachmentUrl: null, adminAttachmentLabel: null, updatedAt: now }).where(eq(orders.id, input.orderId));
    await db.insert(orderChangeLogs).values({ orderId: input.orderId, changedByUserId: ctx.user?.id ?? null, changeType: "ATTACHMENT_REMOVED", details: JSON.stringify({}), createdAt: now });
    return getOrderWithDetails(input.orderId);
  }),
  clearOrderNotes: adminProcedure.input(z.object({ orderId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const [current] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
    if (!current || current.archivedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    const now = Date.now();
    await db.update(orders).set({ customerNote: null, internalNote: null, updatedAt: now }).where(eq(orders.id, input.orderId));
    await db.insert(orderChangeLogs).values({ orderId: input.orderId, changedByUserId: ctx.user?.id ?? null, changeType: "ORDER_NOTES_CLEARED", details: JSON.stringify({ fields: ["customerNote", "internalNote"] }), createdAt: now });
    return getOrderWithDetails(input.orderId);
  }),
  // Registro manual de estorno — o dinheiro em si é devolvido fora do sistema
  // (painel do gateway/Pix na mão); aqui fica o rastro de quem/quando/motivo,
  // e o status do pagamento passa a refletir a realidade (evita mostrar um
  // pagamento estornado como "pago" pro resto da equipe).
  markPaymentRefunded: adminProcedure.input(z.object({ orderId: z.number().int().positive(), reason: z.string().trim().min(3, "Descreva o motivo do estorno.").max(500) })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const [payment] = await db.select().from(payments).where(eq(payments.orderId, input.orderId)).limit(1);
    if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "Pagamento não encontrado para este pedido." });
    if (payment.status !== "PAID") throw new TRPCError({ code: "BAD_REQUEST", message: `Só é possível marcar como reembolsado um pagamento com status "Pago" (status atual: ${payment.status}).` });
    const now = Date.now();
    await db.update(payments).set({ status: "REFUNDED", refundedAt: now, refundedByUserId: ctx.user?.id ?? null, refundReason: input.reason, updatedAt: now }).where(eq(payments.id, payment.id));
    await db.insert(orderChangeLogs).values({ orderId: input.orderId, changedByUserId: ctx.user?.id ?? null, changeType: "PAYMENT_REFUNDED", details: JSON.stringify({ amountCents: payment.amountCents, reason: input.reason }), createdAt: now });
    return getOrderWithDetails(input.orderId);
  }),
  archiveOrder: adminProcedure.input(z.object({ orderId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const [current] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
    if (!current || current.archivedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    if (current.status !== "COMPLETED" && current.status !== "CANCELLED") throw new TRPCError({ code: "BAD_REQUEST", message: "Conclua ou cancele o pedido antes de removê-lo da lista." });
    const now = Date.now();
    await db.update(orders).set({ archivedAt: now, updatedAt: now }).where(eq(orders.id, input.orderId));
    await db.insert(orderChangeLogs).values({ orderId: input.orderId, changedByUserId: ctx.user?.id ?? null, changeType: "ORDER_ARCHIVED", details: JSON.stringify({ status: current.status }), createdAt: now });
    return { success: true };
  }),
  updateOrderStatus: restaurantProcedure.input(z.object({ orderId: z.number().int().positive(), status: statusSchema, note: z.string().max(500).optional() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const [current] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    if (!ALLOWED_STATUS_TRANSITIONS[current.status].includes(input.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Não é possível alterar de “${STATUS_LABELS[current.status]}” para “${STATUS_LABELS[input.status]}”.` });
    }
    const now = Date.now();
    // Pra delivery/retirada, "concluído" e "pago" costumam coincidir (recebe = paga na hora).
    // Numa mesa isso não vale: servir um prato não fecha a comanda, então o pagamento dela
    // só é marcado quando a conta é de fato fechada (ver server/db/tables.ts, closeTableSession).
    const autoMarksPaid = input.status === "COMPLETED" && current.fulfillmentType !== "DINE_IN";
    await db.update(orders).set({
      status: input.status,
      updatedAt: now,
      paymentStatus: autoMarksPaid ? "PAID" : current.paymentStatus,
      acceptedAt: input.status === "ACCEPTED" ? now : current.acceptedAt,
      preparingAt: input.status === "PREPARING" ? now : current.preparingAt,
      completedAt: input.status === "COMPLETED" ? now : current.completedAt,
      cancelledAt: input.status === "CANCELLED" ? now : current.cancelledAt,
    }).where(eq(orders.id, input.orderId));
    if (input.status === "COMPLETED") await db.update(payments).set({ status: "PAID", paidAt: now, updatedAt: now }).where(eq(payments.orderId, input.orderId));
    if (input.status === "CANCELLED") await db.update(payments).set({ status: "CANCELLED", updatedAt: now }).where(eq(payments.orderId, input.orderId));
    await db.insert(orderStatusHistory).values({ orderId: input.orderId, status: input.status, note: input.note ?? null, changedByUserId: ctx.user?.id ?? null, createdAt: now });
    if (input.status === "ACCEPTED") {
      const fullOrder = await getOrderWithDetails(input.orderId);
      await db.insert(printJobs).values({ orderId: input.orderId, status: "PENDING", receiptPayload: JSON.stringify(fullOrder), attempts: 0, createdAt: now, updatedAt: now });
    }
    return getOrderWithDetails(input.orderId);
  }),
  pendingPrintJobs: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    return db.select().from(printJobs).where(eq(printJobs.status, "PENDING")).orderBy(printJobs.createdAt).limit(50);
  }),
  confirmPrintJob: adminProcedure.input(z.object({ printJobId: z.number().int().positive(), status: z.enum(["PRINTED", "FAILED"]), lastError: z.string().max(500).optional() })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const now = Date.now();
    await db.update(printJobs).set({ status: input.status, lastError: input.lastError ?? null, attempts: sql`${printJobs.attempts} + 1`, printedAt: input.status === "PRINTED" ? now : null, updatedAt: now }).where(eq(printJobs.id, input.printJobId));
    return { success: true };
  }),
});
