import { and, eq } from "drizzle-orm";
import { addonGroups, addonOptions, categories, products, restaurantSettings } from "../drizzle/schema";
import { getDb } from "../server/db";

const now = Date.now();
const burgerImage = "/assets/pubx/burger-gourmet_4ec4cce8.jpg";
const pizzaImage = "/assets/pubx/hero-burger-pizza_ec8acda5.jpeg";

type MenuProduct = { name: string; description: string; priceCents: number; imageUrl: string; featured?: boolean };

async function findCategoryId(name: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [category] = await db.select().from(categories).where(eq(categories.name, name)).limit(1);
  if (!category) throw new Error(`Categoria não encontrada: ${name}`);
  return category.id;
}

async function upsertProduct(categoryId: number, item: MenuProduct, sortOrder: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [found] = await db.select().from(products).where(and(eq(products.categoryId, categoryId), eq(products.name, item.name))).limit(1);
  const values = { name: item.name, description: item.description, priceCents: item.priceCents, imageUrl: item.imageUrl, featured: item.featured ?? false, available: true, preparationMinutes: 20, sortOrder, updatedAt: now };
  if (found) {
    await db.update(products).set(values).where(eq(products.id, found.id));
    return found.id;
  }
  const created = await db.insert(products).values({ categoryId, ...values, createdAt: now });
  return Number(created[0].insertId);
}

async function ensurePizzaSizes(productId: number, basePrice: number, largePrice: number, familyPrice: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const [found] = await db.select().from(addonGroups).where(and(eq(addonGroups.productId, productId), eq(addonGroups.name, "Tamanho"))).limit(1);
  const groupId = found?.id ?? Number((await db.insert(addonGroups).values({ productId, name: "Tamanho", required: true, minSelections: 1, maxSelections: 1, sortOrder: 0, active: true, createdAt: now, updatedAt: now }))[0].insertId);
  if (found) await db.update(addonGroups).set({ required: true, minSelections: 1, maxSelections: 1, active: true, updatedAt: now }).where(eq(addonGroups.id, groupId));
  const sizes = [
    { name: "Média", priceCents: 0, sortOrder: 1 },
    { name: "Grande", priceCents: largePrice - basePrice, sortOrder: 2 },
    { name: "Família", priceCents: familyPrice - basePrice, sortOrder: 3 },
  ];
  for (const size of sizes) {
    const [option] = await db.select().from(addonOptions).where(and(eq(addonOptions.groupId, groupId), eq(addonOptions.name, size.name))).limit(1);
    const values = { priceCents: size.priceCents, available: true, sortOrder: size.sortOrder, updatedAt: now };
    if (option) await db.update(addonOptions).set(values).where(eq(addonOptions.id, option.id));
    else await db.insert(addonOptions).values({ groupId, name: size.name, ...values, createdAt: now });
  }
}

async function run() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const burgersId = await findCategoryId("Hambúrgueres");
  const pizzasId = await findCategoryId("Pizzas");
  await db.update(restaurantSettings).set({ storeName: "MM System Creator", shortDescription: "Hambúrgueres, pizzas e petiscos para aproveitar a noite.", updatedAt: now });

  const burgers: MenuProduct[] = [
    { name: "X-Burguer", description: "Pão, carne artesanal 120g e queijo.", priceCents: 1200, imageUrl: burgerImage, featured: true },
    { name: "X-Egg", description: "Pão, carne artesanal 120g, queijo e ovo.", priceCents: 1400, imageUrl: burgerImage },
    { name: "X-Bacon", description: "Pão, carne artesanal 120g, queijo e bacon.", priceCents: 1500, imageUrl: burgerImage, featured: true },
    { name: "X-Salada", description: "Pão, carne artesanal 120g, queijo e salada.", priceCents: 1500, imageUrl: burgerImage },
    { name: "X-Tudo", description: "Pão, carne artesanal 120g, queijo, ovo, calabresa, bacon e salada.", priceCents: 2000, imageUrl: burgerImage, featured: true },
  ];
  for (let index = 0; index < burgers.length; index += 1) await upsertProduct(burgersId, burgers[index], index + 1);

  const pizzas = [
    ["Marguerita", "Molho de tomate, mussarela, manjericão, tomate e orégano.", 3000, 3500, 4500],
    ["Mista", "Molho de tomate, mussarela, presunto, calabresa e orégano.", 3000, 3500, 4500],
    ["Mussarela", "Molho de tomate, mussarela especial e azeitonas.", 3000, 3500, 4500],
    ["Portuguesa", "Molho de tomate, mussarela, presunto, calabresa, cebola, ervilha, ovos e orégano.", 3500, 4000, 5000],
    ["Toscana", "Molho de tomate, mussarela, calabresa, cebola, ovos, alho frito e orégano.", 3500, 4000, 5000],
    ["4 Queijos", "Molho de tomate, mussarela, provolone, gorgonzola e catupiry.", 3500, 4000, 5000],
    ["Atum", "Molho de tomate, mussarela, atum, cebola e orégano.", 3000, 3500, 4500],
    ["Atum c/ Catupiry", "Molho de tomate, mussarela, atum, cebola, orégano e catupiry.", 3500, 4000, 5000],
    ["Bacon", "Molho de tomate, mussarela, bacon e cebola.", 3000, 3500, 4000],
    ["Baiana", "Molho de tomate, mussarela, calabresa moída, cebola, ovo cozido e pimenta.", 3000, 3500, 4000],
    ["Caipira à Moda da Casa", "Molho de tomate, mussarela, frango, cebola, milho verde, bacon, catupiry e orégano.", 3500, 4000, 5000],
    ["Calabresa", "Molho de tomate, mussarela, calabresa, cebola e orégano.", 3000, 3500, 4500],
    ["Carne Seca", "Molho de tomate, mussarela, carne seca, cebola e orégano.", 3500, 4000, 5000],
    ["Carne Seca c/ Catupiry", "Molho de tomate, mussarela, carne seca, cebola, orégano e catupiry.", 3800, 4300, 5300],
    ["Frango", "Molho de tomate, mussarela, frango desfiado e orégano.", 3000, 3500, 4500],
    ["Frango c/ Catupiry", "Molho de tomate, mussarela, frango desfiado, catupiry e orégano.", 3500, 4000, 5000],
  ] as const;
  for (let index = 0; index < pizzas.length; index += 1) {
    const [name, description, medium, large, family] = pizzas[index];
    const id = await upsertProduct(pizzasId, { name, description, priceCents: medium, imageUrl: pizzaImage, featured: index < 2 }, index + 1);
    await ensurePizzaSizes(id, medium, large, family);
  }
  console.info("Cardápio oficial do MM System Creator importado com sucesso.");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
