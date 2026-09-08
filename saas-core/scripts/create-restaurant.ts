import "dotenv/config";
import { parseArgs } from "node:util";
import { createRestaurantWithSubscription } from "../server/db/restaurants";

/**
 * Cadastra um restaurante-cliente novo + assinatura inicial, e imprime a API
 * key gerada UMA ÚNICA VEZ (o banco só guarda o hash dela). É o caminho
 * principal do operador nesta milestone — mais rápido que subir um endpoint
 * HTTP novo pra proteger, mesmo padrão de scripts/seed-cardapio-pubx.ts.
 *
 * Uso:
 *   pnpm create-restaurant --name "Pub X" --plan essencial --contact-email dono@exemplo.com
 */
async function main() {
  const { values } = parseArgs({
    options: {
      name: { type: "string" },
      plan: { type: "string" },
      "contact-name": { type: "string" },
      "contact-email": { type: "string" },
      "contact-phone": { type: "string" },
    },
  });

  if (!values.name || !values.plan) {
    console.error('Uso: tsx scripts/create-restaurant.ts --name "Pub X" --plan essencial [--contact-email ...] [--contact-name ...] [--contact-phone ...]');
    console.error("Planos válidos: essencial, profissional, premium");
    process.exit(1);
  }

  const result = await createRestaurantWithSubscription({
    name: values.name,
    planKey: values.plan,
    contactName: values["contact-name"],
    contactEmail: values["contact-email"],
    contactPhone: values["contact-phone"],
    actor: "operator:cli",
  });

  console.log("");
  console.log("Restaurante cadastrado com sucesso.");
  console.log(`  restaurantId: ${result.restaurantId}`);
  console.log(`  plano:        ${result.planKey}`);
  console.log(`  status:       ${result.status}`);
  console.log("");
  console.log("Copie a API key abaixo AGORA — ela não será mostrada de novo:");
  console.log("");
  console.log(`  ${result.apiKey}`);
  console.log("");
  console.log("Configure no .env do deployment deste restaurante:");
  console.log(`  SAAS_CORE_URL=<endereço deste saas-core>`);
  console.log(`  SAAS_CORE_API_KEY=${result.apiKey}`);
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("[create-restaurant] Falhou:", error);
    process.exit(1);
  });
