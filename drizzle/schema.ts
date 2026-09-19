import {
  bigint,
  boolean,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** Usuários autenticados do painel administrativo. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "staff", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/** Credenciais locais para a equipe operar somente a fila de pedidos. */
export const restaurantStaffCredentials = mysqlTable(
  "restaurant_staff_credentials",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    username: varchar("username", { length: 64 }).notNull(),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    active: boolean("active").notNull().default(true),
    // Áreas extras liberadas pra esta conta STAFF além do básico (pedidos/mesas,
    // sempre disponível) — JSON de string[] (ver server/_core/permissions.ts),
    // ou null = nenhuma área extra (comportamento de sempre, sem mudança pra
    // contas existentes). Nunca lido/usado pra contas admin (admin já tem tudo).
    permissions: text("permissions"),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
    lastSignedInAt: bigint("lastSignedInAt", { mode: "number", unsigned: true }),
  },
  table => [
    uniqueIndex("staff_credentials_username_unique").on(table.username),
    uniqueIndex("staff_credentials_user_unique").on(table.userId),
  ],
);

const orderStatusValues = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "CANCELLED",
] as const;

export const restaurantSettings = mysqlTable("restaurant_settings", {
  id: int("id").autoincrement().primaryKey(),
  storeName: varchar("storeName", { length: 120 }).notNull(),
  shortDescription: text("shortDescription"),
  phone: varchar("phone", { length: 24 }),
  address: text("address"),
  deliveryFeeCents: int("deliveryFeeCents").notNull().default(700),
  minimumOrderCents: int("minimumOrderCents").notNull().default(1500),
  estimatedDeliveryMin: int("estimatedDeliveryMin").notNull().default(30),
  estimatedDeliveryMax: int("estimatedDeliveryMax").notNull().default(50),
  isAcceptingOrders: boolean("isAcceptingOrders").notNull().default(true),
  openingHours: varchar("openingHours", { length: 255 }).default("Hoje, 18h às 23h"),
  logoUrl: varchar("logoUrl", { length: 500 }),
  pixKey: varchar("pixKey", { length: 255 }),
  pixQrCodeUrl: varchar("pixQrCodeUrl", { length: 500 }),
  lunchStartTime: varchar("lunchStartTime", { length: 5 }),
  lunchEndTime: varchar("lunchEndTime", { length: 5 }),
  dinnerStartTime: varchar("dinnerStartTime", { length: 5 }),
  dinnerEndTime: varchar("dinnerEndTime", { length: 5 }),
  promotionCategoryImageUrl: varchar("promotionCategoryImageUrl", { length: 500 }),
  aboutText: text("aboutText"),
  // Tema de cor da marca (site público + admin) — chave de shared/colorThemes.ts,
  // validada no router (não FK/enum de banco pra não exigir migration toda vez
  // que um tema novo for adicionado ao catálogo). "classico" é sempre o valor
  // que reproduz a aparência original (pré-seletor de tema).
  colorTheme: varchar("colorTheme", { length: 20 }).notNull().default("classico"),
  createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
});

export const regimeTributarioValues = ["SIMPLES_NACIONAL", "LUCRO_PRESUMIDO", "LUCRO_REAL", "MEI"] as const;
export const fiscalEnvironmentValues = ["HOMOLOGACAO", "PRODUCAO"] as const;

/**
 * Configuração fiscal (emissão de NFC-e direto com a SEFAZ-CE) — singleton,
 * mesmo padrão de restaurant_settings/subscription_cache. Segredos
 * (certificado digital A1 e token CSC) nunca ficam em texto puro — sempre
 * cifrados com FISCAL_ENCRYPTION_KEY (ver server/_core/fieldEncryption.ts),
 * e nunca voltam pro navegador depois de salvos — só um booleano indicando
 * se já foram configurados, mesmo padrão já usado pra credenciais de gateway
 * de pagamento (server/routers/admin/paymentGateways.ts).
 */
export const fiscalSettings = mysqlTable("fiscal_settings", {
  id: int("id").autoincrement().primaryKey(),
  cnpj: varchar("cnpj", { length: 14 }),
  inscricaoEstadual: varchar("inscricaoEstadual", { length: 20 }),
  regimeTributario: mysqlEnum("regimeTributario", regimeTributarioValues),
  environment: mysqlEnum("environment", fiscalEnvironmentValues).notNull().default("HOMOLOGACAO"),
  nfceSeries: int("nfceSeries").notNull().default(1),
  nfceNextNumber: int("nfceNextNumber").notNull().default(1),
  cscId: varchar("cscId", { length: 40 }),
  cscTokenEncrypted: text("cscTokenEncrypted"),
  // Token da conta do restaurante no provedor de emissão (Focus NFe) — ver
  // server/_core/nfceEmission.ts. Substitui cscId/cscTokenEncrypted (pensados
  // pra integração direta com a SEFAZ, que este projeto não faz) como
  // credencial de emissão; os dois campos antigos ficam sem uso mas não são
  // removidos (dado já gravado não quebra nada continuando ali).
  providerApiTokenEncrypted: text("providerApiTokenEncrypted"),
  certificateEncrypted: text("certificateEncrypted"),
  certificatePasswordEncrypted: text("certificatePasswordEncrypted"),
  certificateFilename: varchar("certificateFilename", { length: 255 }),
  certificateExpiresAt: bigint("certificateExpiresAt", { mode: "number", unsigned: true }),
  createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
});

export const fiscalDocumentStatusValues = ["PENDING", "AUTHORIZED", "REJECTED", "CANCELLED", "CONTINGENCY", "ERROR"] as const;

/**
 * Uma NFC-e por pedido AVULSO (delivery/retirada/balcão) OU uma por COMANDA
 * DE MESA fechada (consolidando todas as rodadas) — nunca as duas coisas ao
 * mesmo tempo. Exatamente um entre `orderId`/`tableSessionId` é preenchido
 * (regra de aplicação, não expressável como CHECK simples no MySQL); pra
 * mesa, `consolidatedOrderIds` guarda quais pedidos entraram naquela nota.
 * Nunca UPDATE em cima de um documento já autorizado — cancelamento/
 * inutilização são eventos novos, não edição (mesmo raciocínio de
 * order_status_history ser append-only).
 */
export const fiscalDocuments = mysqlTable(
  "fiscal_documents",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId"),
    tableSessionId: int("tableSessionId"),
    consolidatedOrderIds: text("consolidatedOrderIds"),
    status: mysqlEnum("status", fiscalDocumentStatusValues).notNull().default("PENDING"),
    environment: mysqlEnum("environment", fiscalEnvironmentValues).notNull(),
    chaveAcesso: varchar("chaveAcesso", { length: 44 }),
    numero: int("numero"),
    serie: int("serie"),
    protocoloAutorizacao: varchar("protocoloAutorizacao", { length: 40 }),
    xmlUrl: varchar("xmlUrl", { length: 2048 }),
    qrCodeUrl: varchar("qrCodeUrl", { length: 2048 }),
    danfeUrl: varchar("danfeUrl", { length: 2048 }),
    rejectionReason: text("rejectionReason"),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
    authorizedAt: bigint("authorizedAt", { mode: "number", unsigned: true }),
  },
  table => [
    uniqueIndex("fiscal_documents_order_unique").on(table.orderId),
    uniqueIndex("fiscal_documents_table_session_unique").on(table.tableSessionId),
    index("fiscal_documents_status_idx").on(table.status, table.createdAt),
  ],
);

/**
 * Categoria fiscal — o "de-para" entre um grupo de produtos do cardápio e o
 * tratamento tributário que ELES têm (CST/CSOSN, alíquota, CFOP). Existe
 * separado de `products.ncm` de propósito: o NCM classifica O QUE o produto
 * é (uma tabela nacional, igual pra qualquer empresa); a categoria fiscal
 * descreve como ESTE restaurante, no SEU regime, tributa aquele grupo — só o
 * contador sabe os valores reais. Nenhum valor é preenchido por padrão aqui
 * (tudo nulo até ser confirmado) — ver server/db/fiscalTaxCategories.ts.
 * Alíquotas em pontos-base (1800 = 18,00%) pelo mesmo motivo de preço em
 * centavos no resto do sistema: nunca usar float pra dinheiro/imposto.
 */
export const fiscalTaxCategories = mysqlTable(
  "fiscal_tax_categories",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    notes: varchar("notes", { length: 500 }),
    // CSOSN é usado quando regimeTributario = SIMPLES_NACIONAL; CST nos
    // demais regimes — nunca os dois ao mesmo tempo, mas guardar ambos deixa
    // a categoria pronta pra continuar válida se o regime mudar no futuro.
    csosn: varchar("csosn", { length: 3 }),
    cst: varchar("cst", { length: 2 }),
    icmsRateBasisPoints: int("icmsRateBasisPoints"),
    pisRateBasisPoints: int("pisRateBasisPoints"),
    cofinsRateBasisPoints: int("cofinsRateBasisPoints"),
    cfop: varchar("cfop", { length: 4 }),
    active: boolean("active").notNull().default(true),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("fiscal_tax_categories_active_idx").on(table.active)],
);

/** Áreas de entrega cadastradas pelo restaurante, cada uma com taxa e prazo próprios. */
export const deliveryRoutes = mysqlTable(
  "delivery_routes",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    coverageNotes: varchar("coverageNotes", { length: 255 }),
    deliveryFeeCents: int("deliveryFeeCents").notNull(),
    estimatedDeliveryMin: int("estimatedDeliveryMin").notNull().default(30),
    estimatedDeliveryMax: int("estimatedDeliveryMax").notNull().default(50),
    active: boolean("active").notNull().default(true),
    sortOrder: int("sortOrder").notNull().default(0),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("delivery_routes_active_sort_idx").on(table.active, table.sortOrder)],
);

export const categoryTimeAvailabilityValues = ["ALWAYS", "LUNCH", "DINNER", "LUNCH_AND_DINNER"] as const;

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    description: varchar("description", { length: 255 }),
    imageUrl: varchar("imageUrl", { length: 500 }),
    timeAvailability: mysqlEnum("timeAvailability", categoryTimeAvailabilityValues).notNull().default("ALWAYS"),
    sortOrder: int("sortOrder").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("categories_active_sort_idx").on(table.active, table.sortOrder)],
);

export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    categoryId: int("categoryId").notNull(),
    name: varchar("name", { length: 140 }).notNull(),
    description: text("description"),
    imageUrl: varchar("imageUrl", { length: 2048 }),
    priceCents: int("priceCents").notNull(),
    preparationMinutes: int("preparationMinutes").notNull().default(20),
    available: boolean("available").notNull().default(true),
    featured: boolean("featured").notNull().default(false),
    onPromotion: boolean("onPromotion").notNull().default(false),
    sortOrder: int("sortOrder").notNull().default(0),
    // Classificação fiscal (NFC-e) — nulo até ser preenchido; a emissão real
    // não é possível pra um produto sem NCM. Ver server/db/fiscal.ts.
    ncm: varchar("ncm", { length: 8 }),
    // Vínculo com fiscal_tax_categories (CST/CSOSN/alíquota) — nulo até o
    // contador confirmar em qual categoria este produto se encaixa.
    fiscalCategoryId: int("fiscalCategoryId"),
    archivedAt: bigint("archivedAt", { mode: "number", unsigned: true }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [
    index("products_category_idx").on(table.categoryId, table.sortOrder),
    index("products_available_idx").on(table.available),
  ],
);

export const promotions = mysqlTable(
  "promotions",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 140 }).notNull(),
    description: varchar("description", { length: 500 }),
    // badge/priceLabel/imageUrl/linkedProductId (mais abaixo): campos legados
    // — a promoção passou a sempre se vincular a produto(s) reais via
    // promotion_products, usando a imagem e o preço deles automaticamente.
    // As colunas continuam aqui (não removidas — sem migration destrutiva),
    // só não são mais lidas nem escritas pelo código atual.
    badge: varchar("badge", { length: 80 }),
    priceLabel: varchar("priceLabel", { length: 60 }),
    // Preço promocional em centavos — comparado automaticamente contra a
    // soma do preço dos produtos vinculados (promotion_products).
    promoPriceCents: int("promoPriceCents"),
    objective: mysqlEnum("objective", [
      "INCREASE_SALES",
      "INCREASE_AVERAGE_TICKET",
      "ATTRACT_NEW_CUSTOMERS",
      "BOOST_LOW_DAY",
      "BOOST_LOW_HOUR",
      "BOOST_DELIVERY",
      "REDUCE_STOCK",
      "PROMOTE_PRODUCT",
      "LOYALTY",
    ]),
    imageUrl: varchar("imageUrl", { length: 2048 }),
    validDays: varchar("validDays", { length: 160 }),
    linkedProductId: int("linkedProductId"),
    active: boolean("active").notNull().default(true),
    sortOrder: int("sortOrder").notNull().default(0),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("promotions_active_sort_idx").on(table.active, table.sortOrder)],
);

// Produtos reais do cardápio vinculados a uma promoção (combo = vários
// produtos na mesma promoção). Substitui promotions.linkedProductId, que
// só suportava um produto por vez.
export const promotionProducts = mysqlTable(
  "promotion_products",
  {
    id: int("id").autoincrement().primaryKey(),
    promotionId: int("promotionId").notNull(),
    productId: int("productId").notNull(),
    sortOrder: int("sortOrder").notNull().default(0),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [
    uniqueIndex("promotion_products_unique").on(table.promotionId, table.productId),
    index("promotion_products_promotion_idx").on(table.promotionId),
  ],
);

/**
 * Como um adicional obrigatório de um produto do combo deve ser resolvido ao
 * adicionar a promoção inteira com um clique: ADMIN_DEFAULT usa uma opção fixa
 * escolhida pelo admin (ok pra coisas como tamanho, onde qualquer padrão
 * serve); CUSTOMER_CHOICE obriga abrir a personalização pro cliente escolher
 * (obrigatório pra preferência real, tipo ponto da carne). Chave por
 * (promotionId, productId, addonGroupId) — não por promotion_products.id,
 * que é recriado a cada vez que a promoção é salva (ver savePromotion).
 */
export const promotionAddonDefaults = mysqlTable(
  "promotion_addon_defaults",
  {
    id: int("id").autoincrement().primaryKey(),
    promotionId: int("promotionId").notNull(),
    productId: int("productId").notNull(),
    addonGroupId: int("addonGroupId").notNull(),
    mode: mysqlEnum("mode", ["ADMIN_DEFAULT", "CUSTOMER_CHOICE"]).notNull().default("CUSTOMER_CHOICE"),
    defaultOptionId: int("defaultOptionId"),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [
    uniqueIndex("promotion_addon_defaults_unique").on(table.promotionId, table.productId, table.addonGroupId),
    index("promotion_addon_defaults_promotion_idx").on(table.promotionId),
  ],
);

export const addonGroups = mysqlTable(
  "addon_groups",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("productId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    required: boolean("required").notNull().default(false),
    minSelections: int("minSelections").notNull().default(0),
    maxSelections: int("maxSelections").notNull().default(5),
    sortOrder: int("sortOrder").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("addon_groups_product_idx").on(table.productId, table.sortOrder)],
);

export const addonOptions = mysqlTable(
  "addon_options",
  {
    id: int("id").autoincrement().primaryKey(),
    groupId: int("groupId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    priceCents: int("priceCents").notNull().default(0),
    available: boolean("available").notNull().default(true),
    sortOrder: int("sortOrder").notNull().default(0),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("addon_options_group_idx").on(table.groupId, table.sortOrder)],
);

export const customers = mysqlTable(
  "customers",
  {
    id: int("id").autoincrement().primaryKey(),
    phone: varchar("phone", { length: 24 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    phoneVerifiedAt: bigint("phoneVerifiedAt", { mode: "number", unsigned: true }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [uniqueIndex("customers_phone_unique").on(table.phone)],
);

export const customerAddresses = mysqlTable(
  "customer_addresses",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    label: varchar("label", { length: 50 }).notNull().default("Principal"),
    recipientName: varchar("recipientName", { length: 160 }).notNull(),
    postalCode: varchar("postalCode", { length: 12 }),
    street: varchar("street", { length: 180 }).notNull(),
    number: varchar("number", { length: 30 }).notNull(),
    complement: varchar("complement", { length: 120 }),
    neighborhood: varchar("neighborhood", { length: 120 }).notNull(),
    city: varchar("city", { length: 120 }).notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    reference: varchar("reference", { length: 255 }),
    isDefault: boolean("isDefault").notNull().default(true),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("customer_addresses_customer_idx").on(table.customerId, table.isDefault)],
);

export const customerChangeLogs = mysqlTable(
  "customer_change_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull(),
    changeType: varchar("changeType", { length: 80 }).notNull(),
    details: text("details").notNull(),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("customer_change_customer_idx").on(table.customerId, table.createdAt)],
);

/**
 * Código de verificação de posse de telefone (autoatendimento LGPD — ver
 * server/routers/dataRights.ts). Código nunca guardado em texto puro, só o
 * hash (mesmo scrypt já usado pra senha de admin/staff, server/db/users.ts).
 * Uma linha por pedido de código; expira sozinha, sem limpeza automática (é
 * pouco volume — um pedido de acesso/exclusão de dados é raro).
 */
export const phoneVerificationCodes = mysqlTable(
  "phone_verification_codes",
  {
    id: int("id").autoincrement().primaryKey(),
    phone: varchar("phone", { length: 24 }).notNull(),
    codeHash: varchar("codeHash", { length: 255 }).notNull(),
    attempts: int("attempts").notNull().default(0),
    consumedAt: bigint("consumedAt", { mode: "number", unsigned: true }),
    expiresAt: bigint("expiresAt", { mode: "number", unsigned: true }).notNull(),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("phone_verification_codes_phone_idx").on(table.phone, table.createdAt)],
);

export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    publicCode: varchar("publicCode", { length: 16 }).notNull(),
    customerId: int("customerId").notNull(),
    customerName: varchar("customerName", { length: 160 }).notNull(),
    customerPhone: varchar("customerPhone", { length: 24 }).notNull(),
    fulfillmentType: mysqlEnum("fulfillmentType", ["DELIVERY", "PICKUP", "DINE_IN"]).notNull(),
    // Quem/como criou o pedido — eixo independente de fulfillmentType (uma
    // retirada pode ter sido pedida pelo cliente no site OU lançada pela
    // equipe no balcão; uma mesa pode ter sido pedida pelo garçom OU pelo
    // próprio cliente via QR Code). Sem isso os dois casos ficam indistinguíveis.
    origin: mysqlEnum("origin", ["SITE", "BALCAO", "GARCOM", "QR_CODE"]).notNull().default("SITE"),
    tableSessionId: int("tableSessionId"),
    status: mysqlEnum("status", orderStatusValues).notNull().default("PENDING"),
    // Nulo só acontece em rodadas de mesa (fulfillmentType=DINE_IN): o método
    // de pagamento é decidido uma vez, no fechamento da comanda inteira
    // (table_bill_payments), não por rodada — ver server/routers/table.ts.
    paymentMethod: mysqlEnum("paymentMethod", ["PIX", "CASH", "CARD_ON_DELIVERY", "CARD_ONLINE"]),
    paymentStatus: mysqlEnum("paymentStatus", ["PENDING", "PAID"]).notNull().default("PENDING"),
    subtotalCents: int("subtotalCents").notNull(),
    deliveryFeeCents: int("deliveryFeeCents").notNull().default(0),
    // Soma dos combos de promoção aplicados (ver priceOrder em server/routers/order.ts) — sempre recalculado no servidor, nunca enviado pelo cliente.
    discountCents: int("discountCents").notNull().default(0),
    totalCents: int("totalCents").notNull(),
    // Rastro de consentimento LGPD: qual versão da Política de Privacidade/Termos
    // estava vigente quando o cliente fez o pedido (ver shared/legal.ts) — o
    // próprio ato de pedir já é o consentimento, conforme o texto dos Termos.
    termsVersion: varchar("termsVersion", { length: 20 }),
    changeForCents: int("changeForCents"),
    customerNote: varchar("customerNote", { length: 500 }),
    internalNote: varchar("internalNote", { length: 500 }),
    deliveryRouteId: int("deliveryRouteId"),
    deliveryRouteName: varchar("deliveryRouteName", { length: 120 }),
    adminAttachmentUrl: varchar("adminAttachmentUrl", { length: 2048 }),
    adminAttachmentLabel: varchar("adminAttachmentLabel", { length: 160 }),
    archivedAt: bigint("archivedAt", { mode: "number", unsigned: true }),
    deliveryPostalCode: varchar("deliveryPostalCode", { length: 12 }),
    deliveryStreet: varchar("deliveryStreet", { length: 180 }),
    deliveryNumber: varchar("deliveryNumber", { length: 30 }),
    deliveryComplement: varchar("deliveryComplement", { length: 120 }),
    deliveryNeighborhood: varchar("deliveryNeighborhood", { length: 120 }),
    deliveryCity: varchar("deliveryCity", { length: 120 }),
    deliveryState: varchar("deliveryState", { length: 2 }),
    deliveryReference: varchar("deliveryReference", { length: 255 }),
    acceptedAt: bigint("acceptedAt", { mode: "number", unsigned: true }),
    // Marca a entrada em PREPARING — dá ao card seu próprio cronômetro de
    // produção (20/40min), separado do tempo entre aceite e início do preparo.
    preparingAt: bigint("preparingAt", { mode: "number", unsigned: true }),
    completedAt: bigint("completedAt", { mode: "number", unsigned: true }),
    cancelledAt: bigint("cancelledAt", { mode: "number", unsigned: true }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [
    uniqueIndex("orders_public_code_unique").on(table.publicCode),
    index("orders_status_created_idx").on(table.status, table.createdAt),
    // Substitui orders_customer_created_idx (customerId): nenhuma consulta do
    // sistema filtra orders por customerId — todo o fluxo de rastreio de
    // pedido/pedidos ativos filtra por customerPhone (server/db/orders.ts),
    // caminho público consultado a cada 15s por quem está acompanhando um
    // pedido. O índice antigo só custava escrita sem beneficiar leitura nenhuma.
    index("orders_customer_phone_created_idx").on(table.customerPhone, table.createdAt),
    index("orders_table_session_idx").on(table.tableSessionId),
    // Serve ORDER BY createdAt DESC sem filtro de status (admin.operationalSnapshot /
    // getAdminOrders, consultado a cada 10s por cada aba do painel operacional) — os
    // índices compostos acima começam por status/customerPhone e não servem essa ordenação.
    index("orders_created_idx").on(table.createdAt),
  ],
);

export const orderItems = mysqlTable(
  "order_items",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId").notNull(),
    productId: int("productId"),
    productName: varchar("productName", { length: 140 }).notNull(),
    quantity: int("quantity").notNull(),
    unitPriceCents: int("unitPriceCents").notNull(),
    lineTotalCents: int("lineTotalCents").notNull(),
    note: varchar("note", { length: 500 }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("order_items_order_idx").on(table.orderId)],
);

export const orderItemAddons = mysqlTable(
  "order_item_addons",
  {
    id: int("id").autoincrement().primaryKey(),
    orderItemId: int("orderItemId").notNull(),
    addonGroupName: varchar("addonGroupName", { length: 120 }).notNull(),
    addonOptionName: varchar("addonOptionName", { length: 120 }).notNull(),
    unitPriceCents: int("unitPriceCents").notNull(),
    quantity: int("quantity").notNull(),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("order_item_addons_item_idx").on(table.orderItemId)],
);

export const orderStatusHistory = mysqlTable(
  "order_status_history",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId").notNull(),
    status: mysqlEnum("status", orderStatusValues).notNull(),
    note: varchar("note", { length: 500 }),
    changedByUserId: int("changedByUserId"),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [
    index("order_status_history_order_idx").on(table.orderId, table.createdAt),
    // Serve getRecentAuditEntries (tela de Auditoria): ORDER BY createdAt DESC global,
    // sem orderId fixo — o índice composto acima (orderId, createdAt) não serve essa consulta.
    index("order_status_history_created_idx").on(table.createdAt),
  ],
);

/** Auditoria das correções administrativas efetuadas em pedidos recebidos. */
export const orderChangeLogs = mysqlTable(
  "order_change_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId").notNull(),
    changedByUserId: int("changedByUserId"),
    changeType: varchar("changeType", { length: 80 }).notNull(),
    details: text("details").notNull(),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [
    index("order_change_logs_order_idx").on(table.orderId, table.createdAt),
    // Mesmo motivo do índice acima em order_status_history: getRecentAuditEntries
    // ordena globalmente por createdAt sem orderId fixo.
    index("order_change_logs_created_idx").on(table.createdAt),
  ],
);

export const printJobs = mysqlTable(
  "print_jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId").notNull(),
    status: mysqlEnum("status", ["PENDING", "SENT", "PRINTED", "FAILED"]).notNull().default("PENDING"),
    receiptPayload: text("receiptPayload").notNull(),
    attempts: int("attempts").notNull().default(0),
    lastError: varchar("lastError", { length: 500 }),
    printedAt: bigint("printedAt", { mode: "number", unsigned: true }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("print_jobs_status_idx").on(table.status, table.createdAt)],
);

export const payments = mysqlTable(
  "payments",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("orderId").notNull(),
    method: mysqlEnum("method", ["PIX", "CASH", "CARD_ON_DELIVERY", "CARD_ONLINE"]).notNull(),
    status: mysqlEnum("status", ["PENDING", "PAID", "CANCELLED", "REFUNDED", "EXPIRED"]).notNull().default("PENDING"),
    amountCents: int("amountCents").notNull(),
    providerReference: varchar("providerReference", { length: 160 }),
    // JSON — hoje guarda {changeForCents} (troco em dinheiro) e, pra Pix
    // automático, {pixCopyPaste, pixExpiresAt}. Só o "copia e cola" é
    // persistido (o QR visual é gerado no cliente a partir dele) — evita
    // guardar uma imagem base64 grande no banco por uma cobrança que expira
    // em minutos/horas.
    metadata: text("metadata"),
    paidAt: bigint("paidAt", { mode: "number", unsigned: true }),
    // Registro manual de estorno (ver server/routers/admin/orders.ts::markPaymentRefunded) —
    // o dinheiro em si é devolvido fora do sistema (painel do gateway/Pix na mão);
    // aqui só fica o rastro de auditoria de quem/quando/por quê.
    refundedAt: bigint("refundedAt", { mode: "number", unsigned: true }),
    refundedByUserId: int("refundedByUserId"),
    refundReason: varchar("refundReason", { length: 500 }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [uniqueIndex("payments_order_unique").on(table.orderId), index("payments_status_created_idx").on(table.status, table.createdAt)],
);

export const paymentGateways = mysqlTable(
  "payment_gateways",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: mysqlEnum("provider", ["MERCADO_PAGO", "PAGSEGURO", "STRIPE", "CIELO", "REDE", "GETNET", "PAYPAL", "OUTRO"]).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    apiKey: varchar("apiKey", { length: 500 }),
    secretKey: varchar("secretKey", { length: 500 }),
    extra: varchar("extra", { length: 1000 }),
    active: boolean("active").notNull().default(false),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
);

/**
 * Idempotência real de webhook de pagamento — sem tabela dedicada, a mesma
 * notificação reenviada (comportamento normal do Mercado Pago, at-least-once)
 * podia ser processada mais de uma vez. `eventKey` inclui o status
 * (ex.: "payment:123456:approved"), não só o id do evento — o mesmo
 * providerPaymentId gera notificações diferentes em cada mudança de status
 * (pending→approved→refunded), e sem o status na chave a segunda notificação
 * de verdade seria descartada como duplicata da primeira (mesmo padrão já
 * usado em saas-core/server/db/webhookEvents.ts).
 */
export const webhookEvents = mysqlTable(
  "webhook_events",
  {
    id: int("id").autoincrement().primaryKey(),
    gateway: varchar("gateway", { length: 40 }).notNull(),
    eventKey: varchar("eventKey", { length: 200 }).notNull(),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [uniqueIndex("webhook_events_gateway_key_unique").on(table.gateway, table.eventKey)],
);

export const events = mysqlTable(
  "events",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 140 }).notNull(),
    description: varchar("description", { length: 1000 }),
    imageUrl: varchar("imageUrl", { length: 500 }),
    eventDate: varchar("eventDate", { length: 60 }),
    active: boolean("active").notNull().default(true),
    sortOrder: int("sortOrder").notNull().default(0),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
);

/** Perguntas frequentes cadastradas pelo restaurante, exibidas em /faq. */
export const faqItems = mysqlTable(
  "faq_items",
  {
    id: int("id").autoincrement().primaryKey(),
    question: varchar("question", { length: 300 }).notNull(),
    answer: text("answer").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: int("sortOrder").notNull().default(0),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
);

/** Mesas físicas do salão, cada uma com um token opaco de QR Code para pedido pelo cliente. */
export const restaurantTables = mysqlTable(
  "restaurant_tables",
  {
    id: int("id").autoincrement().primaryKey(),
    label: varchar("label", { length: 60 }).notNull(),
    sector: varchar("sector", { length: 60 }).notNull().default(""),
    capacity: int("capacity").notNull().default(4),
    qrToken: varchar("qrToken", { length: 24 }).notNull(),
    status: mysqlEnum("status", ["FREE", "OCCUPIED", "AWAITING_PAYMENT", "RESERVED", "INACTIVE"]).notNull().default("FREE"),
    sortOrder: int("sortOrder").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [uniqueIndex("restaurant_tables_qr_token_unique").on(table.qrToken), index("restaurant_tables_sector_idx").on(table.sector, table.sortOrder)],
);

/**
 * Comanda: agrupa uma ou mais rodadas de pedidos (linhas em `orders` com
 * fulfillmentType=DINE_IN) numa mesma mesa, do momento em que a mesa é
 * ocupada até o fechamento da conta. Cada rodada continua sendo um pedido
 * normal, com seu próprio ciclo de status/impressão — a comanda só agrega.
 */
export const tableSessions = mysqlTable(
  "table_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    tableId: int("tableId").notNull(),
    status: mysqlEnum("status", ["OPEN", "AWAITING_PAYMENT", "CLOSED", "CANCELLED"]).notNull().default("OPEN"),
    partySize: int("partySize"),
    customerId: int("customerId"),
    notes: varchar("notes", { length: 500 }),
    billRequestedAt: bigint("billRequestedAt", { mode: "number", unsigned: true }),
    openedAt: bigint("openedAt", { mode: "number", unsigned: true }).notNull(),
    closedAt: bigint("closedAt", { mode: "number", unsigned: true }),
    closedByUserId: int("closedByUserId"),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("table_sessions_table_status_idx").on(table.tableId, table.status), index("table_sessions_status_idx").on(table.status)],
);

/** Chamado de "chamar garçom" feito pelo cliente na mesa (via QR Code). */
export const tableServiceRequests = mysqlTable(
  "table_service_requests",
  {
    id: int("id").autoincrement().primaryKey(),
    tableSessionId: int("tableSessionId").notNull(),
    status: mysqlEnum("status", ["PENDING", "ACKNOWLEDGED", "DONE", "CANCELLED"]).notNull().default("PENDING"),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    resolvedAt: bigint("resolvedAt", { mode: "number", unsigned: true }),
    resolvedByUserId: int("resolvedByUserId"),
  },
  table => [index("table_service_requests_session_status_idx").on(table.tableSessionId, table.status)],
);

/**
 * Pagamento(s) usados para fechar a conta de uma comanda. Uma comanda com
 * conta dividida gera várias linhas (uma por pessoa/parte); uma conta paga
 * de uma vez só gera uma linha. Desacoplado de `payments` (que é 1:1 com um
 * único pedido) porque uma comanda soma N pedidos/rodadas.
 */
export const tableBillPayments = mysqlTable(
  "table_bill_payments",
  {
    id: int("id").autoincrement().primaryKey(),
    tableSessionId: int("tableSessionId").notNull(),
    method: mysqlEnum("method", ["PIX", "CASH", "CARD_ON_DELIVERY", "CARD_ONLINE"]).notNull(),
    payerLabel: varchar("payerLabel", { length: 60 }),
    amountCents: int("amountCents").notNull(),
    status: mysqlEnum("status", ["PENDING", "PAID", "CANCELLED"]).notNull().default("PENDING"),
    paidAt: bigint("paidAt", { mode: "number", unsigned: true }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("table_bill_payments_session_idx").on(table.tableSessionId)],
);

/** Reservas de mesa registradas pela equipe (telefone/WhatsApp), não um formulário público. */
export const tableReservations = mysqlTable(
  "table_reservations",
  {
    id: int("id").autoincrement().primaryKey(),
    customerName: varchar("customerName", { length: 160 }).notNull(),
    customerPhone: varchar("customerPhone", { length: 24 }).notNull(),
    partySize: int("partySize").notNull(),
    reservedFor: bigint("reservedFor", { mode: "number", unsigned: true }).notNull(),
    tableId: int("tableId"),
    status: mysqlEnum("status", ["REQUESTED", "CONFIRMED", "SEATED", "CANCELLED", "NO_SHOW"]).notNull().default("REQUESTED"),
    notes: varchar("notes", { length: 500 }),
    createdAt: bigint("createdAt", { mode: "number", unsigned: true }).notNull(),
    updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
  },
  table => [index("table_reservations_reserved_for_idx").on(table.reservedFor), index("table_reservations_status_idx").on(table.status)],
);

/**
 * Snapshot cacheado da última sincronização com o saas-core (serviço central
 * de planos/assinatura) — singleton (1 linha), lido com select().limit(1)
 * como restaurantSettings. planKey/status são varchar (não enum): o
 * saas-core evolui como um serviço separado deste app, e um enum rejeitaria
 * um valor novo que ele passe a mandar antes deste app ser atualizado.
 * Ausência total de linha (ou SAAS_CORE_URL/SAAS_CORE_API_KEY em branco) =
 * camada de licenciamento desativada — nunca bloqueia por falta dela.
 */
export const subscriptionCache = mysqlTable("subscription_cache", {
  id: int("id").autoincrement().primaryKey(),
  planKey: varchar("planKey", { length: 40 }).notNull().default("essencial"),
  planName: varchar("planName", { length: 80 }).notNull().default("Essencial"),
  status: varchar("status", { length: 40 }).notNull().default("trial"),
  featuresJson: text("featuresJson"),
  limitsJson: text("limitsJson"),
  lockedFeaturesJson: text("lockedFeaturesJson"),
  currentPeriodEnd: bigint("currentPeriodEnd", { mode: "number", unsigned: true }),
  // Downgrade agendado (self-service) — só informativo pra UI, nunca usado
  // pra decidir acesso (o plano/entitlements atuais valem até currentPeriodEnd).
  scheduledPlanKey: varchar("scheduledPlanKey", { length: 40 }),
  scheduledPlanName: varchar("scheduledPlanName", { length: 80 }),
  lastSyncOk: boolean("lastSyncOk").notNull().default(false),
  syncedAt: bigint("syncedAt", { mode: "number", unsigned: true }),
  updatedAt: bigint("updatedAt", { mode: "number", unsigned: true }).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SubscriptionCache = typeof subscriptionCache.$inferSelect;
export type OrderStatus = (typeof orderStatusValues)[number];
