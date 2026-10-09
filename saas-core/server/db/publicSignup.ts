import { and, eq, gt } from "drizzle-orm";
import { getDb } from "./client";
import { restaurants, type SignupPayload } from "../../drizzle/schema";
import { createRestaurantWithSubscription, hasRestaurantForContact } from "./restaurants";
import { getPlanByKey } from "./plans";
import { recordPlatformAuditLog } from "./auditLog";
import { buildNewSignupMessage, sendTelegramMessageAsync } from "../_core/telegramService";

// Mesmo formulário reenviado (duplo clique, voltar e enviar de novo) dentro
// desta janela devolve o restaurante que já existe, em vez de criar outro e
// avisar o dono duas vezes.
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Cadastro público SEM pagamento: o formulário do site comercial cria o
 * restaurante direto (a taxa de implementação saiu do fluxo em 2026-10-09) e
 * avisa o dono no Telegram com tudo que a pessoa preencheu, pra ele chamar no
 * WhatsApp. O teste grátis de 7 dias só começa quando o ambiente é entregue
 * (ver markRestaurantDelivered) — este passo só registra o interesse.
 */
export async function createRestaurantFromPublicSignup(payload: SignupPayload) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const email = payload.contactEmail?.trim().toLowerCase();
  if (email) {
    const since = Date.now() - DUPLICATE_WINDOW_MS;
    const recent = await db
      .select({ id: restaurants.id, contactEmail: restaurants.contactEmail })
      .from(restaurants)
      .where(and(eq(restaurants.name, payload.name), gt(restaurants.createdAt, since)));
    const same = recent.find(row => row.contactEmail?.trim().toLowerCase() === email);
    if (same) return { restaurantId: same.id, duplicate: true as const };
  }

  // E-mail/telefone que já teve restaurante antes (mesmo cancelado/encerrado)
  // não ganha um novo trial de 7 dias — mesma regra de antes do fim da taxa.
  const isRepeatContact = await hasRestaurantForContact(payload.contactEmail, payload.contactPhone);
  const result = await createRestaurantWithSubscription({
    name: payload.name,
    planKey: payload.planKey,
    contactName: payload.contactName,
    contactEmail: payload.contactEmail,
    contactPhone: payload.contactPhone,
    actor: "public:signup",
    grantTrial: !isRepeatContact,
  });

  await recordPlatformAuditLog({
    actorLabel: payload.contactEmail ?? "visitante",
    action: "restaurant.public_signup",
    entityType: "restaurant",
    entityId: result.restaurantId,
    after: { planKey: result.planKey, status: result.status },
  });

  // Fogo-e-esquece: uma falha do Telegram nunca desfaz o cadastro.
  const plan = await getPlanByKey(payload.planKey);
  sendTelegramMessageAsync(
    buildNewSignupMessage({
      restaurantId: result.restaurantId,
      restaurantName: payload.name,
      planName: plan?.name ?? payload.planKey,
      contactName: payload.contactName,
      contactEmail: payload.contactEmail,
      contactPhone: payload.contactPhone,
      apiKey: result.apiKey,
      repeatContact: isRepeatContact,
    }),
  );

  return { restaurantId: result.restaurantId, duplicate: false as const };
}
