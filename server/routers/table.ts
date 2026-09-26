import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createServiceRequest, getDb, getOrCreateWalkInCustomer, getOrOpenSessionForTable, getSessionWithOrders, findTableByToken, requestSessionBill } from "../db";
import { checkDistinctRateLimit, checkRateLimit } from "../_core/rateLimit";
import { getLicenseSnapshot } from "../_core/license";
import { featureProcedure, publicProcedure, router } from "../_core/trpc";
import { insertPricedOrder, priceOrder } from "./order";
import { phoneSchema, safeText } from "./customer";
import { saveCustomerProfile } from "../db/customers";

export const roundItemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20),
  addonOptionIds: z.array(z.number().int().positive()).default([]),
  note: safeText(z.string().max(500)).optional(),
});

const addRoundSchema = z.object({
  token: z.string().min(6).max(24),
  items: z.array(roundItemSchema).min(1, "Adicione pelo menos um item ao pedido."),
  customerNote: safeText(z.string().max(500)).optional(),
  customer: z.object({ name: safeText(z.string().min(2).max(160)), phone: phoneSchema }).optional(),
  // Chave de idempotência gerada pelo cliente — mesmo raciocínio de
  // `operationId` em checkoutSchema (server/routers/order.ts), pra uma mesa
  // que manda várias rodadas na mesma sessão não correr o risco de uma
  // rodada resubmetida virar pedido duplicado.
  operationId: z.string().min(8).max(64).regex(/^[a-zA-Z0-9-]+$/),
});

/**
 * Resolve a mesa por token, garante que exista uma comanda aberta e grava uma
 * nova rodada (um `orders` normal, com fulfillmentType=DINE_IN) vinculada a
 * ela. Compartilhado entre o pedido público pelo QR Code (`table.addRound`) e
 * o lançamento manual da equipe pelo admin (`admin.tables.addManualRound`) —
 * a única diferença entre os dois é quem chama e a nota de histórico.
 */
export async function addRoundToTable(params: {
  tableId: number;
  items: z.infer<typeof roundItemSchema>[];
  customerNote?: string;
  customer?: { name: string; phone: string };
  historyNote: string;
  origin: "GARCOM" | "QR_CODE";
  clientOperationId?: string;
}) {
  const priced = await priceOrder({ items: params.items, fulfillmentType: "DINE_IN" });
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  const session = await getOrOpenSessionForTable(params.tableId);
  const customer = params.customer
    ? await saveCustomerProfile({ phone: params.customer.phone, name: params.customer.name })
    : await getOrCreateWalkInCustomer();
  if (!customer) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível registrar o cliente." });
  // Mesmo raciocínio de order.ts::create: saveCustomerProfile não sobrescreve mais
  // nome de telefone já cadastrado, então o nome gravado NESTA rodada é sempre o que
  // foi digitado agora (params.customer), nunca o valor antigo devolvido por ela.
  const customerName = params.customer?.name ?? customer.name;
  const customerPhone = params.customer?.phone ?? customer.phone;
  // orders + orderItems + orderItemAddons + orderStatusHistory numa
  // transação só — mesmo raciocínio de order.create em ./order.ts.
  const { orderId, code } = await db.transaction(tx => insertPricedOrder({
    db: tx,
    priced,
    fulfillmentType: "DINE_IN",
    origin: params.origin,
    paymentMethod: null, // decidido no fechamento da comanda (table_bill_payments), não por rodada
    customerId: customer.id,
    customerName,
    customerPhone,
    customerNote: params.customerNote,
    tableSessionId: session.id,
    historyNote: params.historyNote,
    clientOperationId: params.clientOperationId,
    now: Date.now(),
  }));
  return { orderId, code, sessionId: session.id, totalCents: priced.totalCents };
}

export const tableRouter = router({
  // A página da mesa consulta esse token automaticamente a cada 12s — repetir
  // o mesmo token nunca conta contra o limite (só tentar vários tokens
  // diferentes conta), senão o próprio cliente sentado na mesa acabaria
  // bloqueado sozinho depois de alguns minutos com a página aberta.
  resolve: publicProcedure.input(z.object({ token: z.string().min(6).max(24) })).query(async ({ input, ctx }) => {
    // Mesmo gate de plano das ações filhas (addRound/requestBill/callWaiter),
    // aplicado aqui manualmente (em vez de featureProcedure) só pra poder usar
    // uma mensagem apropriada pro cliente final escaneando o QR Code — o
    // texto padrão de requireFeature ("recurso não disponível no plano X")
    // vaza vocabulário de plano/assinatura que não faz sentido pra quem só
    // quer ver a comanda da mesa. Sem isso, uma mesa com QR já impresso
    // continuava abrindo normalmente mesmo depois de um downgrade que remove
    // "tables_qr", só travando nas sub-ações — confuso pro cliente e um furo
    // na garantia de bloqueio 100% backend. Snapshot de licença é único por
    // deployment (cada restaurante roda seu próprio container isolado, ver
    // CLAUDE.md), então não há restaurantId nenhum pra resolver aqui.
    const snapshot = await getLicenseSnapshot();
    if (!snapshot.features.includes("tables_qr")) {
      const required = snapshot.lockedFeatures.tables_qr;
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Mesa indisponível no momento. Peça ajuda à equipe.",
        cause: {
          featureLocked: {
            featureId: "tables_qr",
            requiredPlanKey: required?.requiredPlanKey ?? null,
            requiredPlanName: required?.requiredPlanName ?? null,
          },
        },
      });
    }
    const limit = checkDistinctRateLimit(`table-resolve:${ctx.req.ip}`, input.token, 20);
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um pouco." });
    const table = await findTableByToken(input.token);
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Mesa não encontrada. Peça ajuda à equipe." });
    const session = await getOrOpenSessionForTable(table.id);
    const detail = await getSessionWithOrders(session.id);
    return {
      table: { id: table.id, label: table.label, sector: table.sector },
      // Whitelist de campos, igual `orders`/`table` logo abaixo/acima — a
      // linha raw vinda do banco também carrega customerId, notes internas
      // e o id interno da própria comanda, sem necessidade pra essa tela
      // pública (client/src/pages/TableSession.tsx só lê session.status).
      session: { status: detail!.session.status, partySize: detail!.session.partySize, openedAt: detail!.session.openedAt },
      orders: detail!.orders.map(order => ({
        id: order.id,
        status: order.status,
        totalCents: order.totalCents,
        createdAt: order.createdAt,
        items: order.items.map(item => ({ id: item.id, productName: item.productName, quantity: item.quantity, lineTotalCents: item.lineTotalCents })),
      })),
      totalCents: detail!.totalCents,
      paidCents: detail!.paidCents,
      balanceDueCents: detail!.balanceDueCents,
      waiterRequested: detail!.waiterRequested,
    };
  }),
  addRound: featureProcedure("extra_rounds").input(addRoundSchema).mutation(async ({ input, ctx }) => {
    // Chave é por IP, não por mesa — várias mesas no mesmo wifi do
    // restaurante lançando rodadas ao longo de uma noite cheia somam pro
    // mesmo contador; 8/10min (padrão de força bruta) é baixo demais pra
    // isso (auditoria de escalabilidade 2026-09-19).
    const limit = checkRateLimit(`table-add-round:${ctx.req.ip}`, { maxAttempts: 30 });
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um pouco." });
    const table = await findTableByToken(input.token);
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Mesa não encontrada. Peça ajuda à equipe." });
    return addRoundToTable({
      tableId: table.id,
      items: input.items,
      customerNote: input.customerNote,
      customer: input.customer,
      historyNote: "Rodada pedida pela mesa via QR Code",
      origin: "QR_CODE",
      clientOperationId: input.operationId,
    });
  }),
  requestBill: featureProcedure("request_bill").input(z.object({ token: z.string().min(6).max(24) })).mutation(async ({ input, ctx }) => {
    const limit = checkRateLimit(`table-request-bill:${ctx.req.ip}`, { maxAttempts: 30 });
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um pouco." });
    const table = await findTableByToken(input.token);
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Mesa não encontrada. Peça ajuda à equipe." });
    const session = await getOrOpenSessionForTable(table.id);
    await requestSessionBill(session.id);
    return { success: true };
  }),
  callWaiter: featureProcedure("call_waiter").input(z.object({ token: z.string().min(6).max(24) })).mutation(async ({ input, ctx }) => {
    const limit = checkRateLimit(`table-call-waiter:${ctx.req.ip}`, { maxAttempts: 30 });
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um pouco." });
    const table = await findTableByToken(input.token);
    if (!table) throw new TRPCError({ code: "NOT_FOUND", message: "Mesa não encontrada. Peça ajuda à equipe." });
    const session = await getOrOpenSessionForTable(table.id);
    await createServiceRequest(session.id);
    return { success: true };
  }),
});
