// Upgrade do Pub X (restaurantId=1) pro plano Premium — pedido do dono,
// 2026-09-10, pra apresentar o sistema completo (Eventos/Fiscal/sem
// limites) pra um cliente. Usa a mesma função assignPlan já usada pelo
// masterPanel.restaurants.assignPlan (Painel Master), não escrita SQL crua.
import { assignPlan } from "../server/db/subscriptions";

async function main() {
  const result = await assignPlan({ restaurantId: 1, planKey: "premium", actor: "owner:apresentacao-cliente" });
  console.log("Resultado:", result);
  process.exit(0);
}

main().catch(error => {
  console.error("FALHOU:", error);
  process.exit(1);
});
