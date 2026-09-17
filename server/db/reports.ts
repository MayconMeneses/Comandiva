import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { categories, orderItems, orders, products } from "../../drizzle/schema";
import { getDb } from "./client";

/**
 * Relatórios completo/avançado (recursos de plano — ver server/_core/license.ts
 * FEATURE_IDS "reports_complete"/"reports_advanced"). Arquivo próprio, separado
 * de server/db/orders.ts (que já tem 270+ linhas), mesma disciplina de "sem god
 * file" já seguida no projeto — getDashboardMetrics/getRevenueTrend (relatório
 * básico, universal em todo plano) continuam lá, intocados.
 *
 * Todo cálculo aqui reaproveita o mesmo padrão já usado em getRevenueTrend:
 * busca as linhas cruas do período (nunca uma janela maior que o pedido) e
 * agrupa em JS usando Intl.DateTimeFormat no fuso do restaurante — evita
 * depender de configuração de timezone do MySQL, mesma razão documentada lá.
 */

const dayKey = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
const dayLabel = (ms: number) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", weekday: "short", day: "2-digit", month: "2-digit" }).format(ms);
const hourOf = (ms: number) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Fortaleza", hour: "2-digit", hourCycle: "h23" }).format(ms));
const weekdayIndex = (ms: number) => {
  // "en-CA" com weekday:"short" não dá índice numérico — deriva a partir da
  // data já normalizada pro fuso do restaurante (dayKey), sem depender de
  // qual dia é "hoje" em outro fuso (evita o mesmo bug de fuso já corrigido
  // em getDashboardMetrics — auditoria V-25).
  const [year, month, day] = dayKey(ms).split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
};
const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const PAYMENT_METHOD_LABELS: Record<string, string> = { PIX: "Pix", CASH: "Dinheiro", CARD_ON_DELIVERY: "Cartão na entrega", CARD_ONLINE: "Cartão online" };
const FULFILLMENT_LABELS: Record<string, string> = { DELIVERY: "Entrega", PICKUP: "Retirada", DINE_IN: "Mesa" };

function pctChange(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

// changePct é null quando o período anterior foi <=0 (pctChange não consegue
// calcular variação percentual sobre zero). Pra ordenação de "em alta/em
// queda", isso precisa virar DOIS casos diferentes, não um só:
// - produto novo (sem venda no período anterior) que já vendeu no período
//   atual: é o maior crescimento possível, vai pro TOPO da lista de "em
//   alta" — não pro fim, atrás até de produtos em queda de -90%.
// - sem venda em nenhum dos dois períodos: não é "alta" nenhuma; mantém o
//   comportamento antigo de ir pro fim. Na prática nunca ocorre aqui, porque
//   productTrend só inclui produtos que tiveram receita no período atual
//   (vem de getTopProductsAndCategories sobre os pedidos do período atual),
//   mas o fallback fica por segurança caso essa premissa mude no futuro.
const NEW_PRODUCT_GROWTH_RANK = Number.MAX_SAFE_INTEGER;
const NO_DATA_GROWTH_RANK = Number.MIN_SAFE_INTEGER;

function productTrendSortRank({ changePct, currentRevenueCents }: { changePct: number | null; currentRevenueCents: number }): number {
  if (changePct !== null) return changePct;
  return currentRevenueCents > 0 ? NEW_PRODUCT_GROWTH_RANK : NO_DATA_GROWTH_RANK;
}

function sumBy<T>(rows: T[], keyOf: (row: T) => string | null, valueOf: (row: T) => number) {
  const map = new Map<string, { key: string; revenueCents: number; orderCount: number }>();
  for (const row of rows) {
    const key = keyOf(row) ?? "—";
    const entry = map.get(key) ?? { key, revenueCents: 0, orderCount: 0 };
    entry.revenueCents += valueOf(row);
    entry.orderCount += 1;
    map.set(key, entry);
  }
  return map;
}

type CompletedOrderRow = { id: number; createdAt: number; totalCents: number; discountCents: number; paymentMethod: string | null; fulfillmentType: string; customerId: number };

async function fetchCompletedOrders(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, startAt: number, endAt: number): Promise<CompletedOrderRow[]> {
  return db
    .select({ id: orders.id, createdAt: orders.createdAt, totalCents: orders.totalCents, discountCents: orders.discountCents, paymentMethod: orders.paymentMethod, fulfillmentType: orders.fulfillmentType, customerId: orders.customerId })
    .from(orders)
    .where(and(eq(orders.status, "COMPLETED"), gte(orders.createdAt, startAt), lte(orders.createdAt, endAt)));
}

/**
 * Relatório completo (Profissional+): responde "quanto vendi e o que está
 * vendendo" — faturamento detalhado por dia/hora/pagamento/atendimento,
 * produtos e categorias mais vendidos, comparação com o período anterior.
 */
export async function getReportsComplete(startAt: number, endAt: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const current = await fetchCompletedOrders(db, startAt, endAt);
  const previousStart = startAt - (endAt - startAt + 1);
  const previousEnd = startAt - 1;
  const previous = await fetchCompletedOrders(db, previousStart, previousEnd);

  const byDayMap = sumBy(current, row => dayKey(row.createdAt), row => row.totalCents);
  const byDay = [...byDayMap.values()].sort((a, b) => a.key.localeCompare(b.key)).map(entry => {
    const sampleRow = current.find(row => dayKey(row.createdAt) === entry.key)!;
    return { date: entry.key, label: dayLabel(sampleRow.createdAt), revenueCents: entry.revenueCents, orderCount: entry.orderCount };
  });

  const byHourMap = sumBy(current, row => String(hourOf(row.createdAt)).padStart(2, "0"), row => row.totalCents);
  const byHour = [...byHourMap.values()].sort((a, b) => a.key.localeCompare(b.key)).map(entry => ({ hour: entry.key, label: `${entry.key}h`, revenueCents: entry.revenueCents, orderCount: entry.orderCount }));

  const byPaymentMethodMap = sumBy(current, row => row.paymentMethod, row => row.totalCents);
  const byPaymentMethod = [...byPaymentMethodMap.values()].sort((a, b) => b.revenueCents - a.revenueCents).map(entry => ({ method: entry.key, label: entry.key === "—" ? "Fechamento de comanda (mesa)" : (PAYMENT_METHOD_LABELS[entry.key] ?? entry.key), revenueCents: entry.revenueCents, orderCount: entry.orderCount }));

  const byFulfillmentTypeMap = sumBy(current, row => row.fulfillmentType, row => row.totalCents);
  const byFulfillmentType = [...byFulfillmentTypeMap.values()].sort((a, b) => b.revenueCents - a.revenueCents).map(entry => ({ type: entry.key, label: FULFILLMENT_LABELS[entry.key] ?? entry.key, revenueCents: entry.revenueCents, orderCount: entry.orderCount }));

  const { topProducts, topCategories } = await getTopProductsAndCategories(db, current.map(row => row.id));

  const currentRevenueCents = current.reduce((sum, row) => sum + row.totalCents, 0);
  const previousRevenueCents = previous.reduce((sum, row) => sum + row.totalCents, 0);
  const currentAvgTicketCents = current.length ? Math.round(currentRevenueCents / current.length) : 0;
  const previousAvgTicketCents = previous.length ? Math.round(previousRevenueCents / previous.length) : 0;

  return {
    byDay,
    byHour,
    byPaymentMethod,
    byFulfillmentType,
    topProducts,
    topCategories,
    comparison: {
      currentRevenueCents, previousRevenueCents, revenueChangePct: pctChange(currentRevenueCents, previousRevenueCents),
      currentOrderCount: current.length, previousOrderCount: previous.length, orderCountChangePct: pctChange(current.length, previous.length),
      currentAvgTicketCents, previousAvgTicketCents, avgTicketChangePct: pctChange(currentAvgTicketCents, previousAvgTicketCents),
    },
  };
}

async function getTopProductsAndCategories(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, orderIds: number[], limit = 10) {
  if (!orderIds.length) return { topProducts: [], topCategories: [] };
  const items = await db
    .select({ productId: orderItems.productId, productName: orderItems.productName, quantity: orderItems.quantity, lineTotalCents: orderItems.lineTotalCents })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));

  const productIds = [...new Set(items.map(item => item.productId).filter((id): id is number => id != null))];
  const productRows = productIds.length
    ? await db.select({ id: products.id, categoryId: products.categoryId }).from(products).where(inArray(products.id, productIds))
    : [];
  const categoryIdByProductId = new Map(productRows.map(row => [row.id, row.categoryId]));
  const categoryIds = [...new Set(productRows.map(row => row.categoryId))];
  const categoryRows = categoryIds.length ? await db.select({ id: categories.id, name: categories.name }).from(categories).where(inArray(categories.id, categoryIds)) : [];
  const categoryNameById = new Map(categoryRows.map(row => [row.id, row.name]));

  const productMap = new Map<string, { key: string; name: string; quantity: number; revenueCents: number }>();
  const categoryMap = new Map<string, { key: string; name: string; quantity: number; revenueCents: number }>();
  for (const item of items) {
    const productKey = item.productId != null ? String(item.productId) : `nome:${item.productName}`;
    const productEntry = productMap.get(productKey) ?? { key: productKey, name: item.productName, quantity: 0, revenueCents: 0 };
    productEntry.quantity += item.quantity;
    productEntry.revenueCents += item.lineTotalCents;
    productMap.set(productKey, productEntry);

    const categoryId = item.productId != null ? categoryIdByProductId.get(item.productId) : undefined;
    const categoryKey = categoryId != null ? String(categoryId) : "sem-categoria";
    const categoryName = categoryId != null ? (categoryNameById.get(categoryId) ?? "Categoria removida") : "Sem categoria";
    const categoryEntry = categoryMap.get(categoryKey) ?? { key: categoryKey, name: categoryName, quantity: 0, revenueCents: 0 };
    categoryEntry.quantity += item.quantity;
    categoryEntry.revenueCents += item.lineTotalCents;
    categoryMap.set(categoryKey, categoryEntry);
  }

  const topProducts = [...productMap.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, limit).map(entry => ({ productId: entry.key, name: entry.name, quantity: entry.quantity, revenueCents: entry.revenueCents }));
  const topCategories = [...categoryMap.values()].sort((a, b) => b.revenueCents - a.revenueCents).slice(0, limit).map(entry => ({ categoryId: entry.key, name: entry.name, quantity: entry.quantity, revenueCents: entry.revenueCents }));
  return { topProducts, topCategories };
}

/**
 * Relatório avançado (Premium): responde "por que estou vendendo assim e
 * onde posso melhorar" — clientes novos x recorrentes, frequência de compra,
 * dia da semana de maior movimento, produtos em crescimento/queda,
 * indicadores de cancelamento, resumo de desconto aplicado.
 *
 * Duas limitações conhecidas (documentadas, não escondidas): não há campo de
 * MOTIVO de cancelamento estruturado hoje (só um `note` livre e opcional em
 * orderStatusHistory), então "indicadores de cancelamento" é só
 * contagem/taxa/tendência, sem motivo. Atribuição de receita por PROMOÇÃO
 * específica não é possível — orders.discountCents é só o total do pedido,
 * sem link pra qual promoção causou o desconto (precisaria de uma coluna
 * nova, ex. promotionId em orderItems — fora do escopo desta etapa).
 */
export async function getReportsAdvanced(startAt: number, endAt: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const current = await fetchCompletedOrders(db, startAt, endAt);
  const previousStart = startAt - (endAt - startAt + 1);
  const previousEnd = startAt - 1;
  const previous = await fetchCompletedOrders(db, previousStart, previousEnd);

  // Clientes novos x recorrentes: pra cada cliente que comprou no período,
  // olha a data do PRIMEIRO pedido dele em toda a história (não só dentro do
  // período) — se caiu dentro do período, é cliente novo; senão, recorrente.
  const customerIds = [...new Set(current.map(row => row.customerId))];
  const firstOrderRows = customerIds.length
    ? await db.select({ customerId: orders.customerId, createdAt: orders.createdAt }).from(orders).where(inArray(orders.customerId, customerIds))
    : [];
  const firstOrderAtByCustomer = new Map<number, number>();
  for (const row of firstOrderRows) {
    const existing = firstOrderAtByCustomer.get(row.customerId);
    if (existing == null || row.createdAt < existing) firstOrderAtByCustomer.set(row.customerId, row.createdAt);
  }
  let newCustomers = 0, returningCustomers = 0, newRevenueCents = 0, returningRevenueCents = 0;
  const seenInPeriod = new Set<number>();
  for (const row of current) {
    const firstOrderAt = firstOrderAtByCustomer.get(row.customerId);
    const isNew = firstOrderAt != null && firstOrderAt >= startAt;
    if (isNew) newRevenueCents += row.totalCents; else returningRevenueCents += row.totalCents;
    if (!seenInPeriod.has(row.customerId)) {
      seenInPeriod.add(row.customerId);
      if (isNew) newCustomers += 1; else returningCustomers += 1;
    }
  }

  const distinctCustomers = seenInPeriod.size;
  const averageOrdersPerCustomer = distinctCustomers ? current.length / distinctCustomers : 0;

  const byWeekdayMap = sumBy(current, row => String(weekdayIndex(row.createdAt)), row => row.totalCents);
  const byWeekday = [0, 1, 2, 3, 4, 5, 6].map(index => {
    const entry = byWeekdayMap.get(String(index));
    return { weekday: index, label: WEEKDAY_LABELS[index]!, revenueCents: entry?.revenueCents ?? 0, orderCount: entry?.orderCount ?? 0 };
  });

  const [{ topProducts: currentTopProducts }, { topProducts: previousTopProducts }] = await Promise.all([
    getTopProductsAndCategories(db, current.map(row => row.id), 100),
    getTopProductsAndCategories(db, previous.map(row => row.id), 100),
  ]);
  const previousRevenueByProduct = new Map(previousTopProducts.map(product => [product.productId, product.revenueCents]));
  const productTrend = currentTopProducts
    .map(product => {
      const previousRevenueCents = previousRevenueByProduct.get(product.productId) ?? 0;
      return { productId: product.productId, name: product.name, currentRevenueCents: product.revenueCents, previousRevenueCents, changePct: pctChange(product.revenueCents, previousRevenueCents) };
    })
    .sort((a, b) => productTrendSortRank(b) - productTrendSortRank(a))
    .slice(0, 20);

  const [cancelledCurrent, totalIncludingCancelled] = await Promise.all([
    db.select({ id: orders.id }).from(orders).where(and(eq(orders.status, "CANCELLED"), gte(orders.createdAt, startAt), lte(orders.createdAt, endAt))),
    db.select({ id: orders.id }).from(orders).where(and(gte(orders.createdAt, startAt), lte(orders.createdAt, endAt))),
  ]);
  const cancelledCount = cancelledCurrent.length;
  const cancellation = { cancelledCount, totalOrdersIncludingCancelled: totalIncludingCancelled.length, cancelledRatePct: totalIncludingCancelled.length ? (cancelledCount / totalIncludingCancelled.length) * 100 : 0 };

  const totalDiscountCents = current.reduce((sum, row) => sum + row.discountCents, 0);
  const ordersWithDiscountCount = current.filter(row => row.discountCents > 0).length;
  const currentRevenueCents = current.reduce((sum, row) => sum + row.totalCents, 0);
  const discounts = { totalDiscountCents, ordersWithDiscountCount, discountRatePct: currentRevenueCents > 0 ? (totalDiscountCents / (currentRevenueCents + totalDiscountCents)) * 100 : 0 };

  return {
    newVsReturning: { newCustomers, returningCustomers, newRevenueCents, returningRevenueCents },
    purchaseFrequency: { averageOrdersPerCustomer, distinctCustomers, totalOrders: current.length },
    byWeekday,
    productTrend,
    cancellation,
    discounts,
  };
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serializa o relatório avançado em CSV simples (uma seção por bloco, separadas por linha em branco) — sem dependência nova, exportação pedida na regra 19/CSV da reestruturação de planos. */
export function reportsAdvancedToCsv(report: Awaited<ReturnType<typeof getReportsAdvanced>>): string {
  const lines: string[] = [];
  lines.push("Clientes novos x recorrentes");
  lines.push("tipo,clientes,faturamento_centavos");
  lines.push(`novos,${report.newVsReturning.newCustomers},${report.newVsReturning.newRevenueCents}`);
  lines.push(`recorrentes,${report.newVsReturning.returningCustomers},${report.newVsReturning.returningRevenueCents}`);
  lines.push("");
  lines.push("Frequência de compra");
  lines.push("clientes_distintos,pedidos_totais,media_pedidos_por_cliente");
  lines.push(`${report.purchaseFrequency.distinctCustomers},${report.purchaseFrequency.totalOrders},${report.purchaseFrequency.averageOrdersPerCustomer.toFixed(2)}`);
  lines.push("");
  lines.push("Faturamento por dia da semana");
  lines.push("dia,faturamento_centavos,pedidos");
  for (const row of report.byWeekday) lines.push(`${csvEscape(row.label)},${row.revenueCents},${row.orderCount}`);
  lines.push("");
  lines.push("Produtos em crescimento/queda (vs. período anterior)");
  lines.push("produto,faturamento_atual_centavos,faturamento_anterior_centavos,variacao_pct");
  for (const row of report.productTrend) lines.push(`${csvEscape(row.name)},${row.currentRevenueCents},${row.previousRevenueCents},${row.changePct == null ? "" : row.changePct.toFixed(1)}`);
  lines.push("");
  lines.push("Cancelamentos");
  lines.push("pedidos_cancelados,total_pedidos,taxa_cancelamento_pct");
  lines.push(`${report.cancellation.cancelledCount},${report.cancellation.totalOrdersIncludingCancelled},${report.cancellation.cancelledRatePct.toFixed(1)}`);
  lines.push("");
  lines.push("Descontos aplicados");
  lines.push("total_desconto_centavos,pedidos_com_desconto,taxa_desconto_pct");
  lines.push(`${report.discounts.totalDiscountCents},${report.discounts.ordersWithDiscountCount},${report.discounts.discountRatePct.toFixed(1)}`);
  return lines.join("\n");
}
