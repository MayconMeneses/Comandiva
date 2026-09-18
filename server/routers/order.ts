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
  printJobs,
  products,
  promotionProducts,
  promotions,
} from "../../drizzle/schema";
import { addressMatchesRoute, calculateCartTotal, formatCurrency, normalizePhone } from "../../shared/orderDomain";
import { CURRENT_TERMS_VERSION } from "../../shared/legal";
import { getActiveOrdersByPhone, getDb, getOrderByTrackingCode, getStoreSettings, saveCustomerProfile, savePixChargeForOrder, type DbOrTx } from "../db";
import { getActiveGatewayAndProvider, PaymentConfigError } from "../payments/paymentService";
import { ENV } from "../_core/env";
import { checkDistinctRateLimit, checkRateLimit } from "../_core/rateLimit";
import { publicProcedure, router } from "../_core/trpc";
import { addressSchema, phoneSchema, safeText } from "./customer";

const itemSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(20),
  addonOptionIds: z.array(z.number().int().positive()).default([]),
  note: safeText(z.string().max(500)).optional(),
});

const checkoutSchema = z.object({
  items: z.array(itemSchema).min(1, "Adicione pelo menos um item ao pedido."),
  fulfillmentType: z.enum(["DELIVERY", "PICKUP"]),
  paymentMethod: z.enum(["PIX", "CASH", "CARD_ON_DELIVERY", "CARD_ONLINE"]),
  customer: z.object({
    name: safeText(z.string().min(2).max(160)),
    phone: phoneSchema,
  }),
  address: addressSchema.optional(),
  deliveryRouteId: z.number().int().positive().optional(),
  customerNote: safeText(z.string().max(500)).optional(),
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
 * desconto é aplicado primeiro — guloso, não um solver exato: com 3+ combos
 * ativos compartilhando produto entre si (fora do catálogo real hoje), o
 * resultado pode ficar um pouco abaixo do matematicamente ótimo, nunca
 * abaixo do que o cliente já viu no checkout. Uma promoção mal cadastrada
 * (preço "promocional" maior que a soma dos produtos) nunca gera desconto
 * negativo.
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
    // Nome do grupo já resolvido aqui (a partir de `groups`, já carregado em
    // bloco acima) — evita insertPricedOrder ter que fazer um SELECT em
    // addonGroups por adicional dentro do loop de itens.
    const addons = (selectedOptions.filter(Boolean) as typeof options).map(option => ({
      ...option,
      groupName: groups.find(group => group.id === option.groupId)?.name ?? "Adicional",
    }));
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
  db: DbOrTx;
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
      await db.insert(orderItemAddons).values({
        orderItemId,
        addonGroupName: addon.groupName,
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
    if (input.paymentMethod === "CASH" && input.changeForCents !== undefined && input.changeForCents < priced.totalCents) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `O valor para troco precisa ser igual ou maior que o total do pedido (${formatCurrency(priced.totalCents)}).` });
    }
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
    // orders + orderItems + orderItemAddons + orderStatusHistory + payments
    // numa transação só — sem isso, um travamento no meio (conexão caindo,
    // processo reiniciando em deploy) podia deixar um pedido cobrado sem
    // nenhuma linha em `payments`, e o webhook do Mercado Pago confirmando o
    // pagamento depois não encontra o que atualizar (UPDATE sem WHERE match).
    const { orderId, code } = await db.transaction(async tx => {
      const insertedOrder = await insertPricedOrder({
        db: tx,
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
      await tx.insert(payments).values({
        orderId: insertedOrder.orderId,
        method: input.paymentMethod,
        status: "PENDING",
        amountCents: priced.totalCents,
        metadata: JSON.stringify({ changeForCents: input.changeForCents ?? null }),
        createdAt: now,
        updatedAt: now,
      });
      return insertedOrder;
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
    return orders.map(order => {
      // Só entrega o Pix pra tela enquanto ele ainda faz sentido pro cliente
      // pagar — pagamento já resolvido (de um jeito ou de outro) ou cobrança
      // vencida não deve mais mostrar um QR/copia-e-cola morto.
      let pixCharge: { pixCopyPaste: string; expiresAt: number } | null = null;
      if (order.paymentMethod === "PIX" && order.payment?.status === "PENDING" && order.payment.metadata) {
        try {
          const saved = JSON.parse(order.payment.metadata) as { pixCopyPaste?: string; pixExpiresAt?: number };
          if (saved.pixCopyPaste && saved.pixExpiresAt && saved.pixExpiresAt > Date.now()) pixCharge = { pixCopyPaste: saved.pixCopyPaste, expiresAt: saved.pixExpiresAt };
        } catch { /* metadata sem Pix (ex.: {changeForCents} de outro método) — sem problema, só não mostra */ }
      }
      return {
      id: order.id,
      status: order.status,
      fulfillmentType: order.fulfillmentType,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.payment?.status ?? null,
      pixCharge,
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
      };
    });
  }),
  // Checkout dinâmico (ver PaymentProvider.getCapabilities): nunca mostrar ao
  // cliente uma forma de pagamento que o gateway configurado não sabe
  // processar. `onlineCardAvailable` continua existindo só pra não quebrar
  // nenhum outro lugar que ainda leia especificamente essa query (FAQ.tsx).
  paymentCapabilities: publicProcedure.query(async () => {
    try {
      const { provider } = await getActiveGatewayAndProvider();
      return provider.getCapabilities();
    } catch {
      return { pix: false, card: false, installments: false };
    }
  }),
  onlineCardAvailable: publicProcedure.query(async () => {
    try {
      const { provider } = await getActiveGatewayAndProvider();
      return { available: provider.getCapabilities().card };
    } catch {
      return { available: false };
    }
  }),
  // Exige publicCode + customerPhone (mesmo padrão de getOrderByTrackingCode,
  // usado em order.track) — nunca aceitar um orderId numérico cru vindo do
  // cliente aqui: um visitante anônimo conseguiria enumerar pedidos de outras
  // pessoas e disparar geração de link de pagamento pra pedidos que não são
  // dele.
  createCardPayment: publicProcedure.input(z.object({ publicCode: z.string().min(4).max(16), customerPhone: phoneSchema })).mutation(async ({ input, ctx }) => {
    const limit = checkRateLimit(`order-card-payment:${ctx.req.ip}`);
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas tentativas de pagamento. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    const order = await getOrderByTrackingCode(input.publicCode, input.customerPhone);
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    // Pedido cancelado pela equipe não pode gerar cobrança nova: o guard de
    // markOrderPaymentPaidByPublicCode (server/db/orders.ts) nunca reverte
    // payments.status de volta de CANCELLED pra PAID de propósito (proteção
    // contra reviver um estorno) — então, se deixássemos chegar até aqui e o
    // cliente pagasse de verdade, o pagamento aconteceria no Mercado Pago mas
    // o sistema nunca conseguiria refletir isso.
    if (order.status === "CANCELLED") throw new TRPCError({ code: "BAD_REQUEST", message: "Este pedido foi cancelado e não aceita mais pagamento." });
    // Sem isso, chamar esse endpoint duas vezes pro mesmo pedido (ex.: usuário
    // volta pra página de acompanhamento e aciona de novo) gera uma segunda
    // preferência de cobrança inteira pro mesmo pedido já pago — como
    // payments tem índice único por orderId, o segundo webhook aprovado
    // sobrescreveria o providerReference do primeiro sem deixar rastro de
    // que duas cobranças reais aconteceram.
    if (order.payment?.status === "PAID") throw new TRPCError({ code: "BAD_REQUEST", message: "Este pedido já está pago." });
    try {
      const { gateway, provider } = await getActiveGatewayAndProvider();
      if (!provider.createCardCheckout) throw new PaymentConfigError(`A cobrança automática para ${gateway.label} ainda não foi conectada. Escolha outra forma de pagamento ou fale com o restaurante.`);
      const { redirectUrl } = await provider.createCardCheckout({
        accessToken: gateway.apiKey,
        orderPublicCode: order.publicCode,
        // Total JÁ com frete somado e desconto de combo aplicado — nunca
        // reconstruir a partir de order.items[].lineTotalCents, que é sempre
        // o preço CHEIO por item, calculado antes do desconto de combo
        // existir e sem o frete (ver server/db/orders.ts). Cobrar a soma dos
        // itens direto sub-cobrava o frete em toda entrega e sobre-cobrava o
        // cliente em todo pedido com promoção ativa.
        amountCents: order.totalCents,
        description: `Pedido ${order.publicCode}`,
        backUrl: `${ENV.frontendUrl}/acompanhar?pedido=${order.publicCode}`,
        notificationUrl: `${ENV.backendUrl.replace(/\/+$/, "")}/api/webhooks/mercadopago`,
        // Muda a cada NOVA tentativa de cobrança pro mesmo pedido (baseada no
        // providerReference anterior, se houver) — protege contra duplo
        // clique/retry de rede dentro da MESMA tentativa (mesma chave) sem
        // travar uma tentativa genuinamente nova mais tarde.
        idempotencyKey: `card:${order.publicCode}:${order.payment?.providerReference ?? "initial"}`,
      });
      return { redirectUrl };
    } catch (error) {
      if (error instanceof PaymentConfigError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      console.error(`[createCardPayment] Falha ao criar pagamento para o pedido ${order.publicCode}:`, error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível iniciar o pagamento online. Tente novamente ou escolha outra forma de pagamento." });
    }
  }),
  // Pix automático via API do gateway — substitui o antigo Pix por imagem
  // estática (ver CLAUDE.md/histórico): o cliente nunca digita nada, o QR
  // Code e o "copia e cola" vêm prontos do gateway, específicos daquela
  // cobrança (rastreável, com expiração real). CPF é exigido aqui, não no
  // checkout geral (order.create) — só a criação da cobrança em si precisa
  // dele, mesmo padrão de createCardPayment (endpoint separado, chamado
  // depois do pedido já existir).
  createPixPayment: publicProcedure.input(z.object({
    publicCode: z.string().min(4).max(16),
    customerPhone: phoneSchema,
    payerCpf: z.string().regex(/^\d{11}$/, "Informe um CPF válido (11 dígitos)."),
  })).mutation(async ({ input, ctx }) => {
    const limit = checkRateLimit(`order-pix-payment:${ctx.req.ip}`);
    if (!limit.allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Muitas tentativas de pagamento. Tente novamente em ${Math.ceil((limit.retryAfterSeconds ?? 60) / 60)} minuto(s).` });
    const order = await getOrderByTrackingCode(input.publicCode, input.customerPhone);
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido não encontrado." });
    // Ver o mesmo guard/comentário em createCardPayment logo acima.
    if (order.status === "CANCELLED") throw new TRPCError({ code: "BAD_REQUEST", message: "Este pedido foi cancelado e não aceita mais pagamento." });
    if (order.payment?.status === "PAID") throw new TRPCError({ code: "BAD_REQUEST", message: "Este pedido já está pago." });
    // Já existe uma cobrança Pix em aberto pra este pedido (cliente atualizou
    // a página, ou clicou de novo) — devolve a mesma em vez de gerar outra:
    // o índice único em payments.orderId de qualquer forma impede duas
    // cobranças reais em paralelo, mas reaproveitar evita criar uma segunda
    // cobrança "órfã" direto no Mercado Pago que nunca seria reconciliada.
    if (order.payment?.method === "PIX" && order.payment.providerReference && order.payment.metadata) {
      const saved = JSON.parse(order.payment.metadata) as { pixCopyPaste?: string; pixExpiresAt?: number };
      if (saved.pixCopyPaste && saved.pixExpiresAt && saved.pixExpiresAt > Date.now()) {
        return { pixCopyPaste: saved.pixCopyPaste, expiresAt: saved.pixExpiresAt };
      }
    }
    try {
      const { gateway, provider } = await getActiveGatewayAndProvider();
      if (!provider.createPixPayment) throw new PaymentConfigError(`Pix automático não está disponível para ${gateway.label} no momento. Escolha outra forma de pagamento.`);
      const charge = await provider.createPixPayment({
        accessToken: gateway.apiKey,
        orderPublicCode: order.publicCode,
        amountCents: order.totalCents,
        description: `Pedido ${order.publicCode}`,
        // Mercado Pago exige e-mail do pagador mesmo pra Pix — o checkout não
        // coleta e-mail do cliente (fricção desnecessária pra delivery), então
        // usamos um endereço sintético ligado ao telefone só pra satisfazer o
        // campo obrigatório da API; nunca é usado pra contato de verdade.
        payerEmail: `${order.customerPhone}@pix.cliente.mmsystemcreator.com.br`,
        payerCpf: input.payerCpf,
        notificationUrl: `${ENV.backendUrl.replace(/\/+$/, "")}/api/webhooks/mercadopago`,
        expiresInMinutes: 30,
        // Muda a cada NOVA cobrança Pix pro mesmo pedido (baseada no
        // providerReference anterior, se houver) — essencial aqui: sem isso,
        // regenerar um Pix depois que o anterior venceu reenviava a MESMA
        // chave de idempotência de antes, e o Mercado Pago devolvia de volta
        // o Pix antigo (já vencido de verdade) só que com um prazo novo
        // calculado aqui, deixando o cliente com um QR "válido" impagável.
        idempotencyKey: `pix:${order.publicCode}:${order.payment?.providerReference ?? "initial"}`,
      });
      await savePixChargeForOrder(order.id, { providerReference: charge.providerPaymentId, pixCopyPaste: charge.pixCopyPaste, expiresAt: charge.expiresAt });
      return { pixCopyPaste: charge.pixCopyPaste, expiresAt: charge.expiresAt };
    } catch (error) {
      if (error instanceof PaymentConfigError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      console.error(`[createPixPayment] Falha ao criar Pix para o pedido ${order.publicCode}:`, error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível gerar o Pix agora. Tente novamente ou escolha outra forma de pagamento." });
    }
  }),
});

export { checkoutSchema };
