import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { orderChangeLogs, orderStatusHistory, orders, payments, printJobs } from "../../../drizzle/schema";
import { ALLOWED_STATUS_TRANSITIONS, STATUS_LABELS, endOfDayInRestaurantTimezone, startOfDayInRestaurantTimezone } from "../../../shared/orderDomain";
import { getAdminOrders, getDashboardMetrics, getDb, getFiscalDocumentByOrderId, getOrderWithDetails, getRevenueTrend, getStoreSettings } from "../../db";
import { emitNfceForOrder, retryNfceForOrder } from "../../_core/nfceEmission";
import { adminProcedure, restaurantProcedure, restaurantProcedureFor, router } from "../../_core/trpc";
import { assertRealImageMatchesDeclaredType, keyFromPublicUrl, storageGetSignedUrl, storagePut } from "../../storage";
import { orderInfoSchema, statusSchema } from "./shared";

export const adminOrdersRouter = router({
  // Recebe só a INTENÇÃO do período ("hoje"/"7 dias"/"30 dias"/uma data
  // específica) e calcula startAt/endAt aqui, sempre no fuso do restaurante
  // (America/Fortaleza) — nunca aceita startAt/endAt prontos do cliente, que
  // dependia do fuso de quem estivesse com o navegador aberto (ver auditoria
  // V-25: um admin em Modo Suporte ou o dono viajando em outro fuso via um
  // "hoje" errado).
  dashboard: restaurantProcedureFor("reports").input(z.object({ range: z.enum(["today", "7days", "30days", "custom"]).default("today"), customDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional()).query(async ({ input }) => {
    const range = input?.range ?? "today";
    const now = Date.now();
    const { startAt, endAt } = range === "custom" && input?.customDate
      ? { startAt: startOfDayInRestaurantTimezone(0, new Date(`${input.customDate}T12:00:00Z`)), endAt: endOfDayInRestaurantTimezone(input.customDate) }
      : { startAt: startOfDayInRestaurantTimezone(range === "today" ? 0 : range === "7days" ? 7 : 30), endAt: now };
    const [metrics, recentOrders, rawSettings] = await Promise.all([
      getDashboardMetrics(startAt, endAt),
      getAdminOrders({ limit: 10 }),
      getStoreSettings(),
    ]);
    // dashboard só exige a permissão "reports" (e também é lido em Modo
    // Suporte) — chave/QR Pix não podem viajar nessa resposta; quem precisa
    // deles de verdade (tela de Conta) usa admin.getAccountSettings, que exige
    // adminOnlyProcedure de verdade (nunca staff, nunca Modo Suporte).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring só pra EXCLUIR essas 2 chaves do resto (ver comentário acima), não são "esquecidas"
    const settings = rawSettings ? (({ pixKey: _pixKey, pixQrCodeUrl: _pixQrCodeUrl, ...safeSettings }) => safeSettings)(rawSettings) : rawSettings;
    return { ...metrics, recentOrders, settings, startAt, endAt };
  }),
  revenueTrend: restaurantProcedureFor("reports").input(z.object({ granularity: z.enum(["week", "month", "year"]).default("week") })).query(async ({ input }) => getRevenueTrend(input.granularity)),
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
    await assertRealImageMatchesDeclaredType(bytes, input.contentType);
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
  // Mesma classe de corrida já fechada em updateOrderStatus (ver comentário
  // detalhado logo abaixo): antes, o SELECT que determinava `payment` rodava
  // FORA da transação — duas chamadas quase simultâneas (duplo clique, ou
  // duas abas) podiam ambas ler status "PAID", ambas passar pela checagem e
  // ambas escrever, duplicando a linha de auditoria em `orderChangeLogs`
  // (não duplica reembolso de dinheiro de verdade — nenhuma API de gateway é
  // chamada aqui, só registro interno). Agora a leitura+checagem+escrita
  // inteira roda dentro de UMA transação com a linha do pagamento travada
  // (SELECT...FOR UPDATE), mesmo padrão de updateOrderStatus.
  markPaymentRefunded: adminProcedure.input(z.object({ orderId: z.number().int().positive(), reason: z.string().trim().min(3, "Descreva o motivo do estorno.").max(500) })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    await db.transaction(async tx => {
      const [payment] = await tx.select().from(payments).where(eq(payments.orderId, input.orderId)).limit(1).for("update");
      if (!payment) throw new TRPCError({ code: "NOT_FOUND", message: "Pagamento não encontrado para este pedido." });
      if (payment.status !== "PAID") throw new TRPCError({ code: "BAD_REQUEST", message: `Só é possível marcar como reembolsado um pagamento com status "Pago" (status atual: ${payment.status}).` });
      const now = Date.now();
      await tx.update(payments).set({ status: "REFUNDED", refundedAt: now, refundedByUserId: ctx.user?.id ?? null, refundReason: input.reason, updatedAt: now }).where(eq(payments.id, payment.id));
      await tx.insert(orderChangeLogs).values({ orderId: input.orderId, changedByUserId: ctx.user?.id ?? null, changeType: "PAYMENT_REFUNDED", details: JSON.stringify({ amountCents: payment.amountCents, reason: input.reason }), createdAt: now });
    });
    return getOrderWithDetails(input.orderId);
  }),
  // Mesma corrida/mesmo fix de markPaymentRefunded acima: SELECT+checagem+
  // escrita dentro de uma única transação, com a linha do pedido travada —
  // sem isso, duas chamadas quase simultâneas pra arquivar o mesmo pedido
  // podiam ambas passar pela checagem "ainda não arquivado" e ambas
  // escrever, duplicando a linha de auditoria ORDER_ARCHIVED.
  archiveOrder: adminProcedure.input(z.object({ orderId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    await db.transaction(async tx => {
      const [current] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).limit(1).for("update");
      if (!current || current.archivedAt) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
      if (current.status !== "COMPLETED" && current.status !== "CANCELLED") throw new TRPCError({ code: "BAD_REQUEST", message: "Conclua ou cancele o pedido antes de removê-lo da lista." });
      const now = Date.now();
      await tx.update(orders).set({ archivedAt: now, updatedAt: now }).where(eq(orders.id, input.orderId));
      await tx.insert(orderChangeLogs).values({ orderId: input.orderId, changedByUserId: ctx.user?.id ?? null, changeType: "ORDER_ARCHIVED", details: JSON.stringify({ status: current.status }), createdAt: now });
    });
    return { success: true };
  }),
  updateOrderStatus: restaurantProcedure.input(z.object({
    orderId: z.number().int().positive(),
    status: statusSchema,
    note: z.string().max(500).optional(),
    // Os dois campos abaixo são opcionais de propósito (retrocompatíveis —
    // nenhum chamador antigo/externo quebra por não enviá-los). Fase 4
    // offline-first (painel da equipe): ver auditoria de corrida de escrita
    // logo abaixo.
    expectedStatus: statusSchema.optional(),
    deviceId: z.string().min(8).max(64).regex(/^[a-zA-Z0-9-]+$/).optional(),
  })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    // Toda a leitura+validação+escrita roda dentro de UMA transação, com a
    // linha do pedido travada (SELECT...FOR UPDATE, mesmo padrão de
    // lockLicenseSingletonRow em server/db/license.ts) — antes, o SELECT que
    // determinava `current` rodava FORA da transação, então duas chamadas
    // quase simultâneas (dois dispositivos da equipe no mesmo pedido, ex.:
    // celular na cozinha + tablet no balcão) liam o mesmo status "atual",
    // ambas validavam a transição contra ele, e ambas escreviam — a última
    // vencia silenciosamente. Cenário real: dispositivo A aceita e já inicia
    // o preparo (PENDING→ACCEPTED→PREPARING); dispositivo B, com a tela
    // ainda desatualizada mostrando PENDING, manda CANCELLED — como CANCELLED
    // é alcançável de PENDING/ACCEPTED/PREPARING, o cancelamento passava e
    // cancelava silenciosamente um pedido que já estava em preparo.
    const current = await db.transaction(async tx => {
      const [row] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).limit(1).for("update");
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
      // expectedStatus é o status que a TELA do dispositivo achava que o
      // pedido tinha antes de mandar a mutação. Se divergir do que está
      // travado agora no banco, outro dispositivo já mudou o pedido nesse
      // meio-tempo — rejeita como conflito em vez de aplicar a transição
      // cegamente em cima de uma tela desatualizada. Só rejeita quando o
      // chamador manda o campo (retrocompatível) e quando o divergente é de
      // fato OUTRO valor — um resubmit do mesmo dispositivo com o mesmo
      // expectedStatus, se ainda não tiver sido processado, segue normal.
      // Texto neutro de propósito (não presume "outra pessoa"/"outro
      // dispositivo"): depois de uma reconexão (Fase C offline-first, ver
      // plano em C:\Users\maico\.claude\plans\curried-sprouting-wirth.md),
      // este CONFLICT pode ser a PRÓPRIA tentativa anterior deste mesmo
      // dispositivo que na verdade já tinha dado certo (só a resposta se
      // perdeu na queda) — não uma corrida real com outro dispositivo.
      if (input.expectedStatus && input.expectedStatus !== row.status) {
        throw new TRPCError({ code: "CONFLICT", message: `Esse pedido já foi atualizado — o status atual é "${STATUS_LABELS[row.status]}".` });
      }
      if (!ALLOWED_STATUS_TRANSITIONS[row.status].includes(input.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Não é possível alterar de “${STATUS_LABELS[row.status]}” para “${STATUS_LABELS[input.status]}”.` });
      }
      // Pra delivery/retirada, "concluído" e "pago" costumam coincidir (recebe = paga na hora).
      // Numa mesa isso não vale: servir um prato não fecha a comanda, então o pagamento dela
      // só é marcado quando a conta é de fato fechada (ver server/db/tables.ts, closeTableSession).
      const autoMarksPaid = input.status === "COMPLETED" && row.fulfillmentType !== "DINE_IN";
      // Capturado só aqui (depois do lock), não antes de entrar na transação —
      // mesmo padrão de todas as funções de server/db/tableSessions.ts. Sob
      // contenção real (o cenário que este lock existe pra fechar), uma
      // chamada que ficou esperando o lock não deve carimbar o registro com
      // um instante anterior a quando ela de fato escreveu.
      const now = Date.now();
      await tx.update(orders).set({
        status: input.status,
        updatedAt: now,
        paymentStatus: autoMarksPaid ? "PAID" : row.paymentStatus,
        acceptedAt: input.status === "ACCEPTED" ? now : row.acceptedAt,
        preparingAt: input.status === "PREPARING" ? now : row.preparingAt,
        completedAt: input.status === "COMPLETED" ? now : row.completedAt,
        cancelledAt: input.status === "CANCELLED" ? now : row.cancelledAt,
      }).where(eq(orders.id, input.orderId));
      if (input.status === "COMPLETED") await tx.update(payments).set({ status: "PAID", paidAt: now, updatedAt: now }).where(eq(payments.orderId, input.orderId));
      if (input.status === "CANCELLED") await tx.update(payments).set({ status: "CANCELLED", updatedAt: now }).where(eq(payments.orderId, input.orderId));
      await tx.insert(orderStatusHistory).values({ orderId: input.orderId, status: input.status, note: input.note ?? null, changedByUserId: ctx.user?.id ?? null, deviceId: input.deviceId ?? null, createdAt: now });
      if (input.status === "ACCEPTED") {
        const fullOrder = await getOrderWithDetails(input.orderId, tx);
        await tx.insert(printJobs).values({ orderId: input.orderId, status: "PENDING", receiptPayload: JSON.stringify(fullOrder), attempts: 0, createdAt: now, updatedAt: now });
      }
      return row;
    });
    // Dinheiro/cartão na entrega: o valor já está fechado desde o aceite
    // (não muda mais), então emite a NFC-e aqui — no momento em que o pedido
    // sai fisicamente do restaurante — em vez de esperar o "concluído" que só
    // acontece quando volta/confirma a entrega (tarde demais pro DANFE viajar
    // junto com o entregador). Pix/cartão online já emite antes disso, no
    // pagamento (ver paymentService.ts); chamar de novo aqui não duplica —
    // emitNfceForOrder é idempotente pra pedido já AUTHORIZED. Ver "Quando
    // emitir" no plano de emissão de NFC-e.
    if ((input.status === "OUT_FOR_DELIVERY" || input.status === "READY_FOR_PICKUP") && (current.paymentMethod === "CASH" || current.paymentMethod === "CARD_ON_DELIVERY")) {
      void emitNfceForOrder(input.orderId).catch(error => console.warn("[nfce] Falha ao emitir NFC-e ao sair para entrega/retirada:", error));
    }
    return getOrderWithDetails(input.orderId);
  }),
  // Usadas pela tela de comprovante (Receipt.tsx) pra mostrar/imprimir o
  // DANFE quando pronto, e pelo botão "Tentar emitir nota de novo".
  fiscalDocumentForOrder: restaurantProcedure.input(z.object({ orderId: z.number().int().positive() })).query(({ input }) => getFiscalDocumentByOrderId(input.orderId)),
  retryNfceForOrder: adminProcedure.input(z.object({ orderId: z.number().int().positive() })).mutation(async ({ input }) => {
    await retryNfceForOrder(input.orderId);
    return getFiscalDocumentByOrderId(input.orderId);
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
