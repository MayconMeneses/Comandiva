import { eq, inArray } from "drizzle-orm";
import { fiscalDocuments, fiscalTaxCategories, products } from "../../drizzle/schema";
import { getDb, getFiscalCredentialsForEmission, getOrderWithDetails, getSessionWithOrders } from "../db";

/**
 * Integração com a API da Focus NFe (focusnfe.com.br) — provedor especializado
 * que fala com a SEFAZ em nome do restaurante (assina o XML com o
 * certificado dele, trata contingência automaticamente), em vez deste
 * projeto reimplementar o protocolo direto com a SEFAZ (ver "Provedor
 * escolhido" no plano de emissão de NFC-e). Cada restaurante-cliente tem sua
 * própria conta/token lá — nunca uma conta compartilhada da plataforma.
 * Isolado neste módulo de propósito: se um dia precisar trocar de provedor,
 * só este arquivo muda.
 */

const FOCUS_NFE_BASE_URL = { HOMOLOGACAO: "https://homologacao.focusnfe.com.br", PRODUCAO: "https://api.focusnfe.com.br" } as const;

// Presença do comprador (tabela SEFAZ) — "4" existe especificamente pra
// "NFC-e em operação com entrega a domicílio", por isso delivery usa um
// código diferente de mesa/retirada (presencial).
function presencaCompradorFor(fulfillmentType: "DELIVERY" | "PICKUP" | "DINE_IN") {
  return fulfillmentType === "DELIVERY" ? "4" : "1";
}

// Forma de pagamento (tabela SEFAZ) — só os métodos que este sistema aceita.
const PAYMENT_CODE: Record<string, string> = { CASH: "01", CARD_ON_DELIVERY: "03", CARD_ONLINE: "03", PIX: "17" };

type OrderWithDetails = NonNullable<Awaited<ReturnType<typeof getOrderWithDetails>>>;
type FiscalCategoryRow = typeof fiscalTaxCategories.$inferSelect;
type ProductRow = typeof products.$inferSelect;

// productId nulo acontece quando o produto original foi apagado depois do
// pedido (order_items guarda snapshot de nome/preço, não FK obrigatória) —
// nesse caso não tem como saber NCM/categoria fiscal daquele item, então
// sempre bloqueia a emissão (mesmo caminho de "produto sem categoria").
type LineItemSource = { productId: number | null; productName: string; quantity: number; unitPriceCents: number; addonNames: string[] };

/** Extrai os itens (achatando addons na descrição) de um pedido já carregado com `getOrderWithDetails`/`getSessionWithOrders`. */
function itemsFromOrder(order: OrderWithDetails): LineItemSource[] {
  return order.items.map(item => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    addonNames: item.addons.map(addon => addon.addonOptionName),
  }));
}

async function loadFiscalDataForProducts(productIds: (number | null)[]) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const uniqueIds = [...new Set(productIds.filter((id): id is number => id != null))];
  const productRows = uniqueIds.length ? await db.select().from(products).where(inArray(products.id, uniqueIds)) : [];
  const categoryIds = productRows.map(product => product.fiscalCategoryId).filter((id): id is number => id != null);
  const categoryRows = categoryIds.length ? await db.select().from(fiscalTaxCategories).where(inArray(fiscalTaxCategories.id, [...new Set(categoryIds)])) : [];
  const productById = new Map(productRows.map(product => [product.id, product]));
  const categoryById = new Map(categoryRows.map(category => [category.id, category]));
  return { productById, categoryById };
}

/** Produto apagado, sem NCM, ou sem categoria fiscal completa (CFOP + CSOSN/CST) — não dá pra montar o item da nota. Nome pra aparecer numa mensagem clara pro admin. */
function findBlockingProduct(items: LineItemSource[], productById: Map<number, ProductRow>, categoryById: Map<number, FiscalCategoryRow>): string | null {
  for (const item of items) {
    const product = item.productId != null ? productById.get(item.productId) : undefined;
    if (!product?.ncm) return item.productName;
    const category = product.fiscalCategoryId ? categoryById.get(product.fiscalCategoryId) : undefined;
    if (!category?.cfop || !(category.csosn || category.cst)) return item.productName;
  }
  return null;
}

// Só chamada depois de `findBlockingProduct` confirmar que todo item tem
// productId + produto + categoria fiscal completa — os "!" abaixo refletem
// essa garantia já verificada pelo chamador, não uma suposição nova.
function buildFocusNfeItems(items: LineItemSource[], productById: Map<number, ProductRow>, categoryById: Map<number, FiscalCategoryRow>) {
  return items.map((item, index) => {
    const product = productById.get(item.productId!)!;
    const category = categoryById.get(product.fiscalCategoryId!)!;
    const unitValue = item.unitPriceCents / 100;
    const description = item.addonNames.length ? `${item.productName} (${item.addonNames.join(", ")})` : item.productName;
    return {
      numero_item: index + 1,
      codigo_produto: String(product.id),
      descricao: description.slice(0, 120),
      codigo_ncm: product.ncm,
      cfop: category.cfop,
      unidade_comercial: "UN",
      quantidade_comercial: item.quantity,
      valor_unitario_comercial: unitValue,
      unidade_tributavel: "UN",
      quantidade_tributavel: item.quantity,
      valor_unitario_tributavel: unitValue,
      valor_bruto: Math.round(unitValue * item.quantity * 100) / 100,
      icms_origem: "0",
      icms_situacao_tributaria: category.csosn || category.cst,
    };
  });
}

type EmitParams = {
  fiscalDocumentKey: { orderId: number } | { tableSessionId: number };
  fulfillmentType: "DELIVERY" | "PICKUP" | "DINE_IN";
  customerName: string;
  paymentMethod: string | null;
  totalCents: number;
  items: LineItemSource[];
  consolidatedOrderIds?: number[];
};

/**
 * Núcleo comum de emissão (achatado por `emitNfceForOrder`/
 * `emitNfceForTableSession`) — monta o payload, chama a Focus NFe, grava o
 * resultado em `fiscal_documents`. Nunca lança erro pra quem chama: toda
 * falha (produto sem categoria, provedor fora do ar, rejeição da SEFAZ) vira
 * uma linha `ERROR`/`REJECTED` em `fiscal_documents`, nunca derruba o fluxo
 * de pedido/pagamento que disparou a emissão (mesmo padrão de alertas/
 * e-mails assíncronos já usado no projeto).
 */
async function emit(params: EmitParams): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = Date.now();
  const existingWhere = "orderId" in params.fiscalDocumentKey ? eq(fiscalDocuments.orderId, params.fiscalDocumentKey.orderId) : eq(fiscalDocuments.tableSessionId, params.fiscalDocumentKey.tableSessionId);
  const [existing] = await db.select().from(fiscalDocuments).where(existingWhere).limit(1);
  if (existing?.status === "AUTHORIZED") return; // já emitida — nunca duplica (retry só reprocessa ERROR/REJECTED/CONTINGENCY)

  let credentials: Awaited<ReturnType<typeof getFiscalCredentialsForEmission>>;
  try {
    credentials = await getFiscalCredentialsForEmission();
  } catch {
    return; // fiscal não configurado — sem erro visível, admin.fiscalSettings já mostra o que falta
  }

  const documentBase = {
    ...params.fiscalDocumentKey,
    consolidatedOrderIds: params.consolidatedOrderIds ? JSON.stringify(params.consolidatedOrderIds) : null,
    environment: credentials.environment,
    updatedAt: now,
  };

  const { productById, categoryById } = await loadFiscalDataForProducts(params.items.map(item => item.productId));
  const blockingProduct = findBlockingProduct(params.items, productById, categoryById);
  if (blockingProduct) {
    await upsertFiscalDocument(existing?.id, { ...documentBase, status: "ERROR", rejectionReason: `Produto "${blockingProduct}" está sem NCM ou categoria fiscal completa. Configure em Admin → Fiscal antes de emitir.`, createdAt: now });
    return;
  }

  const refCode = "orderId" in params.fiscalDocumentKey ? `pedido-${params.fiscalDocumentKey.orderId}` : `mesa-${params.fiscalDocumentKey.tableSessionId}`;
  const payload = {
    natureza_operacao: "Venda de mercadoria",
    data_emissao: new Date(now).toISOString(),
    presenca_comprador: presencaCompradorFor(params.fulfillmentType),
    modalidade_frete: "9",
    local_destino: "1",
    cnpj_emitente: credentials.cnpj,
    nome_destinatario: params.customerName,
    indicador_inscricao_estadual_destinatario: "9",
    items: buildFocusNfeItems(params.items, productById, categoryById),
    formas_pagamento: params.paymentMethod
      ? [{ forma_pagamento: PAYMENT_CODE[params.paymentMethod] ?? "99", valor_pagamento: Math.round(params.totalCents) / 100 }]
      : [{ forma_pagamento: "99", valor_pagamento: Math.round(params.totalCents) / 100 }],
  };

  try {
    const baseUrl = FOCUS_NFE_BASE_URL[credentials.environment];
    const response = await fetch(`${baseUrl}/v2/nfce?ref=${encodeURIComponent(refCode)}`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${credentials.providerApiToken}:`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !body) {
      await upsertFiscalDocument(existing?.id, { ...documentBase, status: "ERROR", rejectionReason: (body?.mensagem_sefaz as string) || (body?.mensagem as string) || `Provedor respondeu ${response.status}`, createdAt: now });
      return;
    }
    if (body.contingencia_offline) {
      await upsertFiscalDocument(existing?.id, { ...documentBase, status: "CONTINGENCY", rejectionReason: null, createdAt: now });
      return;
    }
    if (body.status === "autorizado") {
      await upsertFiscalDocument(existing?.id, {
        ...documentBase,
        status: "AUTHORIZED",
        chaveAcesso: (body.chave_nfe as string) ?? null,
        numero: body.numero ? Number(body.numero) : null,
        serie: body.serie ? Number(body.serie) : null,
        protocoloAutorizacao: (body.protocolo_autorizacao as string) ?? (body.protocolo as string) ?? null,
        xmlUrl: (body.caminho_xml_nota_fiscal as string) ?? null,
        qrCodeUrl: (body.qrcode_url as string) ?? null,
        danfeUrl: (body.caminho_danfe as string) ?? null,
        rejectionReason: null,
        createdAt: now,
        authorizedAt: now,
      });
      return;
    }
    await upsertFiscalDocument(existing?.id, { ...documentBase, status: "REJECTED", rejectionReason: (body.mensagem_sefaz as string) || "Rejeitada pela SEFAZ — verifique os dados fiscais.", createdAt: now });
  } catch (error) {
    await upsertFiscalDocument(existing?.id, { ...documentBase, status: "ERROR", rejectionReason: error instanceof Error ? error.message : "Falha de comunicação com o provedor de emissão.", createdAt: now });
  }
}

async function upsertFiscalDocument(existingId: number | undefined, values: Partial<typeof fiscalDocuments.$inferInsert> & { createdAt: number }) {
  const db = await getDb();
  if (!db) return;
  if (existingId) {
    await db.update(fiscalDocuments).set(values).where(eq(fiscalDocuments.id, existingId));
    return;
  }
  await db.insert(fiscalDocuments).values(values as typeof fiscalDocuments.$inferInsert);
}

/** Pedido avulso (delivery/retirada/balcão) — ver "Quando emitir" no plano: chamado no pagamento confirmado (Pix/cartão online) ou ao sair pra entrega/ficar pronto pra retirada (dinheiro/cartão na entrega), nunca no aceite. */
export async function emitNfceForOrder(orderId: number): Promise<void> {
  const order = await getOrderWithDetails(orderId);
  if (!order || order.status === "CANCELLED") return;
  await emit({
    fiscalDocumentKey: { orderId },
    fulfillmentType: order.fulfillmentType as "DELIVERY" | "PICKUP" | "DINE_IN",
    customerName: order.customerName,
    paymentMethod: order.paymentMethod,
    totalCents: order.totalCents,
    items: itemsFromOrder(order),
  });
}

/** Comanda de mesa fechada — consolida todos os pedidos/rodadas não cancelados numa única NFC-e (ver "Quando emitir" no plano). Chamado dentro de `closeTableSession`. */
export async function emitNfceForTableSession(tableSessionId: number): Promise<void> {
  const detail = await getSessionWithOrders(tableSessionId);
  if (!detail) return;
  const activeOrders = detail.orders.filter(order => order.status !== "CANCELLED");
  if (!activeOrders.length) return;
  const items = activeOrders.flatMap(itemsFromOrder);
  const customerName = activeOrders[0]?.customerName || "Cliente";
  await emit({
    fiscalDocumentKey: { tableSessionId },
    fulfillmentType: "DINE_IN",
    customerName,
    paymentMethod: null,
    totalCents: detail.totalCents,
    items,
    consolidatedOrderIds: activeOrders.map(order => order.id),
  });
}

/** Reprocessa uma emissão que ficou ERROR/REJECTED/CONTINGENCY — reaproveitada pelo botão manual "Tentar emitir de novo". Não faz nada se já estiver AUTHORIZED (idempotente). */
export async function retryNfceForOrder(orderId: number): Promise<void> {
  await emitNfceForOrder(orderId);
}

export async function retryNfceForTableSession(tableSessionId: number): Promise<void> {
  await emitNfceForTableSession(tableSessionId);
}
