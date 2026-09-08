import { and, eq, inArray } from "drizzle-orm";
import { addonGroups, addonOptions, categories, products } from "../drizzle/schema";
import { getDb } from "../server/db";

const now = Date.now();
const burgerImage = "/assets/pubx/burger-gourmet_4ec4cce8.jpg";
const foodImage = "/assets/pubx/burger-fries_0ef75416.jpeg";
const pizzaImage = "/assets/pubx/hero-burger-pizza_ec8acda5.jpeg";

async function category(name: string, previousName?: string) {
  const db = await getDb(); if (!db) throw new Error("Banco indisponível");
  const [found] = await db.select().from(categories).where(eq(categories.name, previousName ?? name)).limit(1);
  if (found) { await db.update(categories).set({ name, active: true, updatedAt: now }).where(eq(categories.id, found.id)); return found.id; }
  const created = await db.insert(categories).values({ name, sortOrder: 10, active: true, createdAt: now, updatedAt: now }); return Number(created[0].insertId);
}

async function product(categoryId: number, name: string, priceCents: number, imageUrl: string, description: string, sortOrder: number) {
  const db = await getDb(); if (!db) throw new Error("Banco indisponível");
  const [found] = await db.select().from(products).where(and(eq(products.categoryId, categoryId), eq(products.name, name))).limit(1);
  const values = { name, priceCents, imageUrl, description, available: true, preparationMinutes: 20, sortOrder, updatedAt: now };
  if (found) { await db.update(products).set(values).where(eq(products.id, found.id)); return found.id; }
  const created = await db.insert(products).values({ categoryId, featured: false, createdAt: now, ...values }); return Number(created[0].insertId);
}

async function options(productId: number, name: string, entries: Array<[string, number]>) {
  const db = await getDb(); if (!db) throw new Error("Banco indisponível");
  const [found] = await db.select().from(addonGroups).where(and(eq(addonGroups.productId, productId), eq(addonGroups.name, name))).limit(1);
  const groupId = found?.id ?? Number((await db.insert(addonGroups).values({ productId, name, required: true, minSelections: 1, maxSelections: 1, sortOrder: 0, active: true, createdAt: now, updatedAt: now }))[0].insertId);
  for (let index = 0; index < entries.length; index += 1) { const [label, priceCents] = entries[index]; const [option] = await db.select().from(addonOptions).where(and(eq(addonOptions.groupId, groupId), eq(addonOptions.name, label))).limit(1); const values = { priceCents, available: true, sortOrder: index, updatedAt: now }; if (option) await db.update(addonOptions).set(values).where(eq(addonOptions.id, option.id)); else await db.insert(addonOptions).values({ groupId, name: label, createdAt: now, ...values }); }
}

async function run() {
  const db = await getDb(); if (!db) throw new Error("Banco indisponível");
  const specialBurgers = await category("Hambúrgueres Especiais"); const petiscos = await category("Petiscos", "Porções"); const espetinhos = await category("Espetinhos"); const pizzasSpecial = await category("Pizzas Especiais"); const pizzasSweet = await category("Pizzas Doces"); const desserts = await category("Sobremesas");
  const burgerItems = [["Vamos fugir", 1500], ["Uma brasileira", 1600], ["Natasha", 1600], ["Romance Ideal", 1600], ["Homem Primata", 1600], ["Súplica Cearense", 1500], ["Double Bacon", 2200], ["Vento Ventania", 1400], ["Piano bar", 1500], ["Puro êxtase", 1500], ["Como eu quero", 1500]] as const;
  for (let index = 0; index < burgerItems.length; index += 1) await product(specialBurgers, burgerItems[index][0], burgerItems[index][1], burgerImage, "Hambúrguer artesanal especial do Pub X.", index + 1);
  const snacks = [["Batata simples", 1500, 2000], ["Batata cheddar e bacon", 1800, 2600], ["Calabresa acebolada", 1500, 2000], ["Calabresa c/ fritas", 1800, 2500], ["Contra filé", 2500, 4000], ["Contra filé c/ fritas", 3000, 4500], ["Frango a passarinho", 1800, 2500], ["Gurjão de frango", 1800, 2500], ["Gurjão de peixe", 1800, 2800], ["Camarão alho e óleo", 2500, 4000], ["Picanha na chapa", 4500, 8000]] as const;
  for (let index = 0; index < snacks.length; index += 1) { const [name, half, whole] = snacks[index]; const id = await product(petiscos, name, half, foodImage, "Petisco do cardápio oficial do Pub X.", index + 1); await options(id, "Tamanho da porção", [["½ porção", 0], ["Porção inteira", whole - half]]); }
  const skewers = [["Espetinho de Alcatra", 900], ["Espetinho de Filé de frango", 700], ["Espetinho de Paleta suína", 700], ["Espetinho de Calabresa", 700], ["Espetinho de Linguiça Dalia", 800], ["Espetinho de Coração", 800], ["Espetinho de Tulipa", 800]] as const;
  for (let index = 0; index < skewers.length; index += 1) await product(espetinhos, skewers[index][0], skewers[index][1], foodImage, "Espetinho do cardápio oficial do Pub X.", index + 1);
  const specialty = [["Palmito", 3000, 3500, 4000], ["Pub-X", 3500, 4000, 4500], ["Peito de Peru", 3500, 4000, 5000], ["Camarão", 3500, 4000, 5000], ["Camarão c/ Catupiry", 4000, 4500, 6000]] as const;
  for (let index = 0; index < specialty.length; index += 1) { const [name, medium, large, family] = specialty[index]; const id = await product(pizzasSpecial, name, medium, pizzaImage, "Pizza especial do cardápio oficial do Pub X.", index + 1); await options(id, "Tamanho", [["Média", 0], ["Grande", large - medium], ["Família", family - medium]]); }
  const sweet = ["Chocolate", "Choco c/ Morango", "Choco c/ Banana", "Prestígio", "Romeu e Julieta"] as const;
  for (let index = 0; index < sweet.length; index += 1) { const id = await product(pizzasSweet, sweet[index], 3000, pizzaImage, "Pizza doce do cardápio oficial do Pub X.", index + 1); await options(id, "Tamanho", [["Média", 0], ["Grande", 500], ["Família", 1500]]); }
  const sweets = [["Pudim", "Tradicional, doce de leite ou Nutella."], ["Brownie", "Ninho ou Nutella."], ["Torta de limão", "Sobremesa do cardápio oficial."]] as const;
  for (let index = 0; index < sweets.length; index += 1) await product(desserts, sweets[index][0], 1000, foodImage, sweets[index][1], index + 1);
  const legacy = ["PX Bacon", "Duplo da Casa", "Veggie Brasa", "Calabresa Artesanal", "Fritas da Casa", "Croquetes de Costela", "Coca-Cola 350ml", "Guaraná Zero 350ml", "Brownie Intenso"];
  await db.delete(products).where(inArray(products.name, legacy));
  const [beverages] = await db.select().from(categories).where(eq(categories.name, "Bebidas")).limit(1); if (beverages) await db.update(categories).set({ active: false, updatedAt: now }).where(eq(categories.id, beverages.id));
  console.info("Conciliação do cardápio oficial concluída.");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
