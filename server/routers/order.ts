import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import {
  addonGroups,
  addonOptions,
  deliveryRoutes,
  orderItemAddons,
  orderItems,
  orders,
  orderStatusHistory,
  payments,
  paymentGateways,
  printJobs,
  products,
  promotionProducts,
  promotions,
} from "../../drizzle/schema";
import { addressMatchesRoute, calculateCartTotal, formatCurrency, normalizePhone } from "../../shared/orderDomain";
import { CURRENT_TERMS_VERSION } from "../../shared/legal";
import { getActiveOrdersByPhone, getDb, getOrderWithDetails, getStoreSettings, saveCustomerProfile } from "../db";
import { createMercadoPagoCheckout } from "../_core/mercadoPago";
import { ENV } from "../_core/env";
import { checkDistinctRateLimit, checkRateLimit } from "../_core/rateLimit";
import { publicProcedure, router } from "../_core/trpc";
import { addressSchema, phoneSchema } from "./customer";

const itemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20),
  addonOptionIds: z.array(z.number().int().positive()).default([]),
  note: z.string().max(500).optional(),
});

const checkoutSchema = z.object({
  items: z.array(itemSchema).min(1, "Adicione pelo menos um item ao pedido."),
  fulfillmentType: z.enum(["DELIVERY", "PICKUP"]),
  paymentMethod: z.enum(["PIX", "CASH", "CARD_ON_DELIVERY", "CARD_ONLINE"]),
  customer: z.object({
    name: z.string().min(2).max(160),
    phone: phoneSchema,
  }),
  address: addressSchema.optional(),
  deliveryRouteId: z.number().int().positive().optional(),
  customerNote: z.string().max(500).optional(),
  changeForCents: z.number().int().positive().optional(),
  // Só tem efeito quando quem chama está autenticado como equipe (ver
  // handler abaixo) — um cliente anônimo não consegue se marcar como
  // "pedido de balcão" só por mandar esse campo no corpo da requisição.
  origin: z.enum(["SITE", "BALCAO"]).optional(),
}).superRefine((value, context) => {
  if (value.fulfillmentType === "DELIVERY" && !value.address) {
    context.addIssue({ code: "custom", path: ["address"], message: "O endereço é obrigatório para delivery." });
  }
  if (value.paymentMethod === "CASH" && value.changeForCents !== undefined && value.changeForCents <= 0) {
    context.addIssue({ code: "custom", path: ["changeForCents"], message: "Informe um valor de troco válido." });
  }
});

type CheckoutInput = z.infer<typeof checkoutSchema>;

type FulfillmentType = "DELIVERY" | "PICKUP" | "DINE_IN";

export type ComboDefinition = { promotionId: number; promoPriceCents: number; productIds: number[]; productPriceCentsById: Record<number, number> };

/**
 * Desconto de combo (promoção com mais de um produto vinculado) — nunca
 * confia no que o cliente diz que colocou no carrinho "por causa de uma
 * promoção": só olha as quantidades reais e decide sozinho se elas fecham um
 * ou mais combos. Se dois combos disputam o mesmo produto, o de maior
 * desconto é aplicado primeiro (o cliente fica com o melhor negócio possível,
 * nunca o pior). Uma promoção mal cadastrada (preço "promocional" maior que
 * a soma dos produtos) nunca gera desconto negativo.
 */
export function computeComboDiscountCents(cartQuantityByProductId: Record<number, number>, combos: ComboDefinition[]): number {
  const remaining = { ...cartQuantityByProductId };
  const withDiscount = combos
    .map(combo => ({ combo, regularSum: combo.productIds.reduce((sum, id) => sum + (combo.productPriceCentsById[id] ?? 0), 0) }))
    .map(({ combo, regularSum }) => ({ combo, perBundleDiscount: regularSum - combo.promoPriceCents }))
    .filter(({ perBundleDiscount }) => perBundleDiscount > 0)
    .sort((a, b) => b.perBundleDiscount - a.perBundleDiscount);

  let discount = 0;
  for (const { combo, perBundleDiscount } of withDiscount) {
    if (!combo.productIds.length) continue;
    const multiplier = Math.min(...combo.productIds.map(id => remaining[id] ?? 0));
    if (multiplier <= 0) continue;
    discount += multiplier * perBundleDiscount;
    for (const id of combo.productIds) remaining[id] = (remaining[id] ?? 0) - multiplier;
  }
  return discount;
}

export async function priceOrder(input: { items: CheckoutInput["items"]; fulfillmentType: FulfillmentType; deliveryRouteId?: number }) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  const productIds = Array.from(new Set(input.items.map(item => item.productId)));
  const productRows = await db.select().from(products).where(inArray(products.id, productIds));
  if (productRows.length !== productIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Um item do cardápio não foi encontrado." });
  const unavailable = productRows.find(product => !product.available);
  if (unavailable) throw new TRPCError({ code: "BAD_REQUEST", message: `${unavailable.name} está indisponível no momento.` });

  const groups = await db.select().from(addonGroups).where(inArray(addonGroups.productId, productIds));
  const groupIds = groups.map(group => group.id);
  const options = groupIds.length ? await db.select().from(addonOptions).where(inArray(addonOptions.groupId, groupIds)) : [];

  const items = input.items.map(item => {
    const product = productRows.find(row => row.id === item.productId)!;
    const productGroups = groups.filter(group => group.productId === product.id && group.active);
    const selectedOptions = item.addonOptionIds.map(optionId => options.find(option => option.id === optionId));
    if (selectedOptions.some(option => !option || !option.available || !productGroups.some(group => group.id === option.groupId))) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Os adicionais de ${product.name} não são válidos.` });
    }
    productGroups.forEach(group => {
      const count = selectedOptions.filter(option => option?.groupId === group.id).length;
      if (count < group.minSelections || count > group.maxSelections) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${group.name}: selecione entre ${group.minSelections} e ${group.maxSelections} opções.` });
      }
    });
    const addons = selectedOptions.filter(Boolean) as typeof options;
    const unitPriceCents = product.priceCents + addons.reduce((total, addon) => total + addon.priceCents, 0);
    return { product, quantity: item.quantity, note: item.note, addons, unitPriceCents, lineTotalCents: unitPriceCents * item.quantity };
  });

  const settings = await getStoreSettings();
  if (!settings?.isAcceptingOrders) throw new TRPCError({ code: "BAD_REQUEST", message: "O restaurante não está recebendo pedidos no momento." });
  const activeRoutes = input.fulfillmentType === "DELIVERY" ? await db.select().from(deliveryRoutes).where(eq(deliveryRoutes.active, true)) : [];
  const selectedRoute = input.deliveryRouteId ? activeRoutes.find(route => route.id === input.deliveryRouteId) : undefined;
  if (input.fulfillmentType === "DELIVERY" && activeRoutes.length && !selectedRoute) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma rota de entrega disponível." });
  }
  const deliveryFeeCents = input.fulfillmentType === "DELIVERY" ? (selectedRoute?.deliveryFeeCents ?? settings.deliveryFeeCents) : 0;
  const rawTotals = calculateCartTotal(items.map(item => ({ unitPriceCents: item.unitPriceCents, quantity: item.quantity })), deliveryFeeCents);

  // Combos de promoção: nunca lidos do carrinho enviado pelo cliente, só das
  // quantidades reais dos itens contra o que está cadastrado e ativo agora.
  const comboRows = await db
    .select({ promotionId: promotions.id, promoPriceCents: promotions.promoPriceCents, productId: promotionProducts.productId, priceCents: products.priceCents })
    .from(promotionProducts)
    .innerJoin(promotions, eq(promotionProducts.promotionId, promotions.id))
    .innerJoin(products, eq(promotionProducts.productId, products.id))
    .where(and(eq(promotions.active, true), isNotNull(promotions.promoPriceCents)));
  const combosById = new Map<number, ComboDefinition>();
  for (const row of comboRows) {
    const combo = combosById.get(row.promotionId) ?? { promotionId: row.promotionId, promoPriceCents: row.promoPriceCents!, productIds: [], productPriceCentsById: {} };
    combo.productIds.push(row.productId);
    combo.productPriceCentsById[row.productId] = row.priceCents;
    combosById.set(row.promotionId, combo);
  }
  const combos = [...combosById.values()].filter(combo => combo.productIds.length > 1); // combo = mais de um produto; promoção de 1 produto só destaca, não desconta
  const cartQuantityByProductId: Record<number, number> = {};
  for (const item of input.items) cartQuantityByProductId[item.productId] = (cartQuantityByProductId[item.productId] ?? 0) + item.quantity;
  const discountCents = Math.min(computeComboDiscountCents(cartQuantityByProductId, combos), rawTotals.subtotalCents);
  const totals = { subtotalCents: rawTotals.subtotalCents - discountCents, deliveryFeeCents: rawTotals.deliveryFeeCents, totalCents: rawTotals.totalCents - discountCents, discountCents };

  if (totals.subtotalCents < settings.minimumOrderCents) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `O pedido mínimo é de ${formatCurrency(settings.minimumOrderCents)}.` });
  }
  return { items, settings, deliveryRoute: selectedRoute, estimatedDeliveryMin: selectedRoute?.estimatedDeliveryMin ?? settings.estimatedDeliveryMin, estimatedDeliveryMax: selectedRoute?.estimatedDeliveryMax ?? settings.estimatedDeliveryMax, ...totals };
}

const publicCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 7);

type PricedOrder = Awaited<ReturnType<typeof priceOrder>>;

/**
 * Insere o pedido (orders + orderItems + orderItemAddons + histórico PENDING)
 * a partir de um resultado de `priceOrder`. Extraído de `order.create` pra ser
 * reaproveitado pelas rodadas de mesa (`server/db/tables.ts`) sem duplicar a
 * lógica de gravação — a única diferença entre um checkout público e uma
 * rodada de mesa é *quem* dispara a criação e se existe endereço/comprovante
 * de pagamento próprio, não como o pedido em si é gravado.
 */
export async function insertPricedOrder(params: {
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  priced: PricedOrder;
  fulfillmentType: FulfillmentType;
  origin: "SITE" | "BALCAO" | "GARCOM" | "QR_CODE";
  // Nulo só é válido para DINE_IN — pagamento decidido no fechamento da comanda, não por rodada.
  paymentMethod: "PIX" | "CASH" | "CARD_ON_DELIVERY" | "CARD_ONLINE" | null;
  customerId: number;
  customerName: string;
  customerPhone: string;
  changeForCents?: number | null;
  customerNote?: string | null;
  address?: CheckoutInput["address"];
  tableSessionId?: number | null;
  historyNote?: string;
  now: number;
}) {
  const { db, priced, now } = params;
  const code = `PX-${publicCode()}`;
  const orderResult = await db.insert(orders).values({
    publicCode: code,
    customerId: params.customerId,
    customerName: params.customerName,
    customerPhone: params.customerPhone,
    fulfillmentType: params.fulfillmentType,
    origin: params.origin,
    paymentMethod: params.paymentMethod,
    subtotalCents: priced.subtotalCents,
    deliveryFeeCents: priced.deliveryFeeCents,
    discountCents: priced.discountCents,
    totalCents: priced.totalCents,
    termsVersion: CURRENT_TERMS_VERSION,
    changeForCents: params.changeForCents ?? null,
    customerNote: params.customerNote ?? null,
    deliveryRouteId: priced.deliveryRoute?.id ?? null,
    deliveryRouteName: priced.deliveryRoute?.name ?? null,
    tableSessionId: params.tableSessionId ?? null,
    deliveryPostalCode: params.address?.postalCode ?? null,
    deliveryStreet: params.address?.street ?? null,
    deliveryNumber: params.address?.number ?? null,
    deliveryComplement: params.address?.complement ?? null,
    deliveryNeighborhood: params.address?.neighborhood ?? null,
    deliveryCity: params.address?.city ?? null,
    deliveryState: params.address?.state ?? null,
    deliveryReference: params.address?.reference ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const orderId = Number(orderResult[0].insertId);
  for (const pricedItem of priced.items) {
    const inserted = await db.insert(orderItems).values({
      orderId,
      productId: pricedItem.product.id,
      productName: pricedItem.product.name,
      quantity: pricedItem.quantity,
      unitPriceCents: pricedItem.unitPriceCents,
      lineTotalCents: pricedItem.lineTotalCents,
      note: pricedItem.note ?? null,
      createdAt: now,
    });
    const orderItemId = Number(inserted[0].insertId);
    for (const addon of pricedItem.addons) {
      const group = (await db.select().from(addonGroups).where(eq(addonGroups.id, addon.groupId)).limit(1))[0];
      await db.insert(orderItemAddons).values({
        orderItemId,
        addonGroupName: group?.name ?? "Adicional",
        addonOptionName: addon.name,
        unitPriceCents: addon.priceCents,
        quantity: 1,
        createdAt: now,
      });
    }
  }
  await db.insert(orderStatusHistory).values({ orderId, status: "PENDING", note: params.historyNote ?? "Pedido criado pelo cliente", createdAt: now });
  return { orderId, code };
}

export const orderRouter = router({
  preview: publicProcedure.input(z.object({ items: z.array(itemSchema).min(1), fulfillmentType: z.enum(["DELIVERY", "PICKUP"]), deliveryRouteId: z.number().int().positive().optional() })).query(async ({ input }) => {
    const priced = await priceOrder(input);
    return {
      ...priced,
      items: priced.items.map(item => ({
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        lineTotalCents: item.lineTotalCents,
        addons: item.addons.map(addon => ({ id: addon.id, name: addon.name, priceCents: addon.priceCents })),
      })),
    };
  }),
  create: publicProcedure.input(checkoutSchema).mutation(async ({ input, ctx }) => {
    const limit = checkRateLimit(`order-create:${ctx.req.ip}`);
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitos pedidos em pouco tempo. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    const priced = await priceOrder(input);
    if (input.fulfillmentType === "DELIVERY" && priced.deliveryRoute && !addressMatchesRoute(priced.deliveryRoute, input.address ?? {})) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "O bairro/cidade informado não coincide com a rota de entrega selecionada. Corrija o endereço ou escolha a rota correta." });
    }
    const isStaff = ctx.user?.role === "admin" || ctx.user?.role === "staff";
    const origin = input.origin === "BALCAO" && isStaff ? "BALCAO" as const : "SITE" as const;
    const customer = await saveCustomerProfile({ phone: input.customer.phone, name: input.customer.name, address: input.address });
    if (!customer) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível registrar o cliente." });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const now = Date.now();
    const { orderId, code } = await insertPricedOrder({
      db,
      priced,
      fulfillmentType: input.fulfillmentType,
      origin,
      paymentMethod: input.paymentMethod,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      changeForCents: input.changeForCents,
      customerNote: input.customerNote,
      address: input.address,
      now,
    });
    await db.insert(payments).values({
      orderId,
      method: input.paymentMethod,
      status: "PENDING",
      amountCents: priced.totalCents,
      metadata: JSON.stringify({ changeForCents: input.changeForCents ?? null }),
      createdAt: now,
      updatedAt: now,
    });
    return { publicCode: code, orderId, estimatedDeliveryMin: priced.estimatedDeliveryMin, estimatedDeliveryMax: priced.estimatedDeliveryMax };
  }),
  // Consulta pública por telefone — limitada por telefones *diferentes*
  // tentados pelo mesmo IP (não pelo total de consultas), pra impedir
  // alguém de varrer números em sequência e descobrir quem tem pedido em
  // andamento agora (e quanto está gastando), sem punir o cliente que fica
  // com a própria página de acompanhamento aberta (ela consulta o mesmo
  // telefone automaticamente a cada 15s). Mesmo raciocínio do customer.lookupByPhone.
  track: publicProcedure.input(z.object({ phone: phoneSchema })).query(async ({ input, ctx }) => {
    const limit = checkDistinctRateLimit(`order-track:${ctx.req.ip}`, input.phone, 20);
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas consultas. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    const orders = await getActiveOrdersByPhone(input.phone);
    if (!orders.length) throw new TRPCError({ code: "NOT_FOUND", message: "Não encontramos pedido em andamento para este telefone." });
    return orders.map(order => ({
      id: order.id,
      status: order.status,
      fulfillmentType: order.fulfillmentType,
      paymentMethod: order.paymentMethod,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      items: order.items.map(item => ({
        id: item.id,
        productName: item.productName,
        quantity: item.quantity,
        lineTotalCents: item.lineTotalCents,
      })),
      history: order.history.map(entry => ({
        id: entry.id,
        status: entry.status,
        createdAt: entry.createdAt,
      })),
    }));
  }),
  onlineCardAvailable: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { available: false };
    const [gateway] = await db.select({ provider: paymentGateways.provider }).from(paymentGateways).where(eq(paymentGateways.active, true)).limit(1);
    return { available: Boolean(gateway) && gateway.provider === "MERCADO_PAGO" };
  }),
  createCardPayment: publicProcedure.input(z.object({ orderId: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
    const limit = checkRateLimit(`order-card-payment:${ctx.req.ip}`);
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas tentativas de pagamento. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const order = await getOrderWithDetails(input.orderId);
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    const [gateway] = await db.select().from(paymentGateways).where(eq(paymentGateways.active, true)).limit(1);
    if (!gateway || !gateway.apiKey) throw new TRPCError({ code: "BAD_REQUEST", message: "Pagamento online não está configurado no momento. Escolha outra forma de pagamento." });
    if (gateway.provider !== "MERCADO_PAGO") throw new TRPCError({ code: "BAD_REQUEST", message: `A cobrança automática para ${gateway.label} ainda não foi conectada. Escolha outra forma de pagamento ou fale com o restaurante.` });
    try {
      const redirectUrl = await createMercadoPagoCheckout({
        accessToken: gateway.apiKey,
        orderPublicCode: order.publicCode,
        items: order.items.map(item => ({ title: item.productName, quantity: item.quantity, unit_price: item.lineTotalCents / item.quantity / 100 })),
        backUrl: `${ENV.frontendUrl}/acompanhar?pedido=${order.publicCode}`,
      });
      return { redirectUrl };
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Falha ao iniciar o pagamento online." });
    }
  }),
});

export { checkoutSchema };
