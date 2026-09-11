import { getDb, type DbOrTx } from "../../db";
import { webhookEvents } from "../../../drizzle/schema";

/**
 * Idempotência de webhook — insere e deixa a unique constraint
 * (gateway, eventKey) decidir se já foi processado. Mesmo padrão já usado em
 * saas-core/server/db/webhookEvents.ts (esta é a versão do app principal,
 * pro webhook de pagamento de PEDIDO — domínios completamente separados,
 * nunca a mesma tabela).
 *
 * Aceita um `dbOrTx` opcional pra poder participar da MESMA transação que
 * aplica o efeito do pagamento (ver applyPaymentStatusNotification) — sem
 * isso, marcar "já processado" e aplicar o efeito são duas escritas
 * separadas: se a segunda falhar, a primeira já ficou commitada e a
 * confirmação de pagamento se perde pra sempre (nem o próprio Mercado Pago
 * reenvia, nem um reenvio manual funciona, porque bate na mesma chave já
 * marcada como processada).
 */
export async function markWebhookEventOnce(gateway: string, eventKey: string, dbOrTx?: DbOrTx): Promise<{ alreadyProcessed: boolean }> {
  const db = dbOrTx ?? (await getDb());
  if (!db) throw new Error("Banco de dados indisponível");
  try {
    await db.insert(webhookEvents).values({ gateway, eventKey, createdAt: Date.now() });
    return { alreadyProcessed: false };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "ER_DUP_ENTRY") return { alreadyProcessed: true };
    throw error;
  }
}
