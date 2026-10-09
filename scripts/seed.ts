import { addonGroups, addonOptions, categories, products, restaurantSettings } from "../drizzle/schema";
import { createRestaurantAccessAccount, getDb, listRestaurantAccessAccounts } from "../server/db";
import { ENV } from "../server/_core/env";

const now = Date.now();

async function createCategory(name: string, description: string, sortOrder: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const result = await db.insert(categories).values({ name, description, sortOrder, active: true, createdAt: now, updatedAt: now });
  return Number(result[0].insertId);
}

async function createProduct(input: {
  categoryId: number;
  name: string;
  description: string;
  imageUrl: string;
  priceCents: number;
  featured?: boolean;
  sortOrder: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const result = await db.insert(products).values({
    ...input,
    available: true,
    preparationMinutes: 20,
    featured: input.featured ?? false,
    createdAt: now,
    updatedAt: now,
  });
  return Number(result[0].insertId);
}

async function createAddonGroup(productId: number, name: string, minSelections: number, maxSelections: number, sortOrder: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const result = await db.insert(addonGroups).values({
    productId,
    name,
    required: minSelections > 0,
    minSelections,
    maxSelections,
    sortOrder,
    active: true,
    createdAt: now,
    updatedAt: now,
  });
  return Number(result[0].insertId);
}

async function createAddonOptions(groupId: number, options: Array<{ name: string; priceCents: number }>) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    await db.insert(addonOptions).values({
      groupId,
      name: option.name,
      priceCents: option.priceCents,
      available: true,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function seed() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [existing] = await db.select().from(restaurantSettings).limit(1);
  if (existing) {
    console.info("Seed já aplicado; nenhum dado foi alterado.");
    return;
  }

  await db.insert(restaurantSettings).values({
    storeName: "Comandiva",
    shortDescription: "Hambúrgueres artesanais, pizzas e porções para aproveitar o melhor da noite.",
    phone: "85999999999",
    address: "Rua do Mercado, 120 — Centro",
    deliveryFeeCents: 700,
    minimumOrderCents: 1500,
    estimatedDeliveryMin: 30,
    estimatedDeliveryMax: 50,
    isAcceptingOrders: true,
    openingHours: "Hoje, 18h às 23h",
    createdAt: now,
    updatedAt: now,
  });

  const burgers = await createCategory("Hambúrgueres", "Artesanais, feitos na brasa e preparados na hora.", 1);
  const pizzas = await createCategory("Pizzas", "Massa de fermentação lenta, ingredientes selecionados.", 2);
  const portions = await createCategory("Porções", "Para dividir — ou não.", 3);
  const drinks = await createCategory("Bebidas", "Geladas para acompanhar.", 4);
  const desserts = await createCategory("Sobremesas", "Um final intenso e memorável.", 5);

  const pxBacon = await createProduct({ categoryId: burgers, name: "Bacon da Casa", description: "Blend bovino de 160g, cheddar cremoso, bacon crocante, picles e molho da casa.", imageUrl: "/assets/pubx/burger-gourmet_4ec4cce8.jpg", priceCents: 3990, featured: true, sortOrder: 1 });
  await createProduct({ categoryId: burgers, name: "Duplo da Casa", description: "Dois blends de 120g, queijo prato, cebola caramelizada e maionese defumada.", imageUrl: "/assets/pubx/burger-fries_0ef75416.jpeg", priceCents: 4590, featured: true, sortOrder: 2 });
  await createProduct({ categoryId: burgers, name: "Veggie Brasa", description: "Burger vegetal, queijo, cogumelos grelhados, rúcula e aioli de limão.", imageUrl: "/assets/pubx/hero-burger-pizza_ec8acda5.jpeg", priceCents: 3590, sortOrder: 3 });
  await createProduct({ categoryId: pizzas, name: "Marguerita", description: "Molho de tomate, mozzarella, manjericão fresco e azeite extravirgem. 8 fatias.", imageUrl: "/assets/pubx/hero-burger-pizza_ec8acda5.jpeg", priceCents: 5490, featured: true, sortOrder: 1 });
  await createProduct({ categoryId: pizzas, name: "Calabresa Artesanal", description: "Calabresa artesanal, cebola roxa, mozzarella e orégano. 8 fatias.", imageUrl: "/assets/pubx/hero-burger-pizza_ec8acda5.jpeg", priceCents: 5790, sortOrder: 2 });
  await createProduct({ categoryId: portions, name: "Fritas da Casa", description: "Batatas rústicas, páprica defumada e maionese de ervas.", imageUrl: "/assets/pubx/burger-fries_0ef75416.jpeg", priceCents: 1890, sortOrder: 1 });
  await createProduct({ categoryId: portions, name: "Croquetes de Costela", description: "Seis croquetes cremosos de costela bovina com barbecue artesanal.", imageUrl: "/assets/pubx/burger-fries_0ef75416.jpeg", priceCents: 2490, sortOrder: 2 });
  await createProduct({ categoryId: drinks, name: "Coca-Cola 350ml", description: "Lata gelada.", imageUrl: "/assets/pubx/hero-burger-pizza_ec8acda5.jpeg", priceCents: 700, sortOrder: 1 });
  await createProduct({ categoryId: drinks, name: "Guaraná Zero 350ml", description: "Lata gelada, sem açúcar.", imageUrl: "/assets/pubx/hero-burger-pizza_ec8acda5.jpeg", priceCents: 700, sortOrder: 2 });
  await createProduct({ categoryId: desserts, name: "Brownie Intenso", description: "Chocolate 70%, calda quente e uma colher de creme gelado.", imageUrl: "/assets/pubx/burger-gourmet_4ec4cce8.jpg", priceCents: 1490, sortOrder: 1 });

  const burgerExtras = await createAddonGroup(pxBacon, "Deixe do seu jeito", 0, 3, 1);
  await createAddonOptions(burgerExtras, [
    { name: "Bacon extra", priceCents: 500 },
    { name: "Queijo extra", priceCents: 350 },
    { name: "Cebola crispy", priceCents: 250 },
  ]);
  const burgerPoint = await createAddonGroup(pxBacon, "Ponto da carne", 1, 1, 2);
  await createAddonOptions(burgerPoint, [
    { name: "Ao ponto", priceCents: 0 },
    { name: "Bem passada", priceCents: 0 },
  ]);

  const bootstrapName = ENV.bootstrapAdminName.trim();
  const bootstrapUsername = ENV.bootstrapAdminUsername.trim().toLowerCase();
  const bootstrapPassword = ENV.bootstrapAdminPassword;
  if (bootstrapName && bootstrapUsername && bootstrapPassword) {
    const existing = await listRestaurantAccessAccounts();
    if (!existing.some(account => account.username === bootstrapUsername)) {
      await createRestaurantAccessAccount({ name: bootstrapName, username: bootstrapUsername, password: bootstrapPassword, role: "admin" });
      console.info(`Administrador local inicial criado: ${bootstrapUsername}`);
    } else {
      console.info(`Administrador local já existe: ${bootstrapUsername}`);
    }
  }
  console.info("Seed do cardápio concluído.");
}

seed()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
