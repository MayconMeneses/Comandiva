// Liga as fotos reais do cardápio (colocadas em assets/pubx/cardapio-fotos/,
// nomeadas pelo prato que retratam) aos produtos correspondentes no banco,
// substituindo fotos de banco de imagens/genéricas por fotos reais do Comandiva e
// preenchendo produtos que ainda não tinham nenhuma imagem. Sobe cada arquivo
// pro mesmo storage (MinIO) que o upload manual do Admin usa, só que em lote.
//
// Como rodar (com os containers no ar, na própria máquina — usa as portas
// publicadas em 127.0.0.1 pelo docker-compose.independent.yml):
//   node_modules/.bin/tsx scripts/link-cardapio-fotos.ts
//
// Seguro rodar de novo: cada execução só sobe as fotos listadas abaixo de
// novo e atualiza o imageUrl dos produtos listados — não mexe em mais nada.

import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { products } from "../drizzle/schema";
import { getDb } from "../server/db";
import { storagePut } from "../server/storage";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FOTOS_DIR = join(__dirname, "..", "assets", "pubx", "cardapio-fotos");

// arquivo -> ids dos produtos que devem usar essa foto (um arquivo pode
// valer pra mais de um produto quando o prato se repete, ex.: item normal +
// versão "Happy Hour" do mesmo prato).
const MAPPING: Array<{ file: string; productIds: number[] }> = [
  { file: "Arroz com legumes.jpg", productIds: [58] },
  { file: "Arroz à Grega.jpg", productIds: [53] },
  { file: "almoço com bife a cavalo.jpg", productIds: [65] },
  { file: "almoço com calabresa.jpg", productIds: [66] },
  { file: "almoço de contra file.jpg", productIds: [67] },
  { file: "almoço de figado.jpg", productIds: [68] },
  { file: "almoço de file de frango.jpg", productIds: [69] },
  { file: "arroz a piamontezi.jpg", productIds: [55] },
  { file: "arroz branco.jpg", productIds: [52] },
  { file: "arroz com Brócolis.jpg", productIds: [54] },
  { file: "batata com bacon.jpg", productIds: [29, 137] },
  { file: "browne.jpg", productIds: [131] },
  { file: "calabresa comm fritas.jpg", productIds: [31, 138] },
  { file: "calabresa.jpg", productIds: [45] },
  { file: "caldo de carne.jpg", productIds: [62] },
  { file: "caldo de mocoto.jpg", productIds: [63] },
  { file: "capirinha e caipvodka.jpg", productIds: [134, 144] },
  { file: "cerveja Eisenbahn.jpg", productIds: [133, 143] },
  { file: "drink de maçã verde.jpg", productIds: [135, 145] },
  { file: "espetinho de Linguiça.jpg", productIds: [46] },
  { file: "espetinho de contra file.jpg", productIds: [42] },
  { file: "espetinho de coração de galinha.jpg", productIds: [47] },
  { file: "espetinho de frango.jpg", productIds: [43] },
  { file: "espetinho de medalhão de frango.jpg", productIds: [49] },
  { file: "espetinho de sobrepaleta.jpg", productIds: [44] },
  { file: "feijão.jpg", productIds: [51] },
  { file: "fritas(batata).jpg", productIds: [28, 61, 136] },
  { file: "parmegiana.jpg", productIds: [79] },
  { file: "pizza de 4 queijos.jpg", productIds: [108] },
  { file: "pizza de Banana & Chocolate.jpg", productIds: [127] },
  { file: "pizza de calabresa.jpg", productIds: [114] },
  { file: "pizza de chocolate.jpg", productIds: [125] },
  { file: "pizza de marguerita.jpg", productIds: [103] },
  { file: "pizza de mussarela.jpg", productIds: [105] },
  { file: "pizza de prestigio.jpg", productIds: [128] },
  { file: "pizza mista.jpg", productIds: [104] },
  { file: "pizza portuguesa.jpg", productIds: [106] },
  { file: "pudim.jpg", productIds: [130] },
  { file: "tira de contra file.jpg", productIds: [32] },
  { file: "torta de limão.jpg", productIds: [132] },
];

function slugify(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");

  let updated = 0;
  for (const { file, productIds } of MAPPING) {
    const path = join(FOTOS_DIR, file);
    let bytes: Buffer;
    try {
      bytes = readFileSync(path);
    } catch {
      console.warn(`[pular] arquivo não encontrado: ${file}`);
      continue;
    }
    const slug = slugify(file.replace(/\.[^.]+$/, ""));
    const stored = await storagePut(`catalog/product-images/${Date.now()}-${slug}.jpg`, bytes, "image/jpeg");
    for (const productId of productIds) {
      await db.update(products).set({ imageUrl: stored.url, updatedAt: Date.now() }).where(eq(products.id, productId));
      updated += 1;
      console.log(`[ok] produto #${productId} <- ${file}`);
    }
  }
  console.log(`\nConcluído: ${updated} produto(s) atualizado(s).`);
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
