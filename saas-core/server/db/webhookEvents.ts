import { getDb } from "./client";
import { webhookEvents } from "../../drizzle/schema";

/**
 * Idempotência de webhook — insere e deixa a unique constraint
 * (gateway, gatewayEventId) decidir se já foi processado, mesmo raciocínio
 * de compare-and-swap já usado em support_sessions. Notificações de gateway
 * de pagamento podem chegar mais de uma vez; processar a mesma duas vezes
 * nunca pode gerar duas cobranças/eventos.
 */
export async function markWebhookEventOnce(input: { gateway: string; gatewayEventId: string; result: string }): Promise<{ alreadyProcessed: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  try {
    await db.insert(webhookEvents).values({ gateway: input.gateway, gatewayEventId: input.gatewayEventId, processedAt: Date.now(), result: input.result });
    return { alreadyProcessed: false };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "ER_DUP_ENTRY") return { alreadyProcessed: true };
    throw error;
  }
}
