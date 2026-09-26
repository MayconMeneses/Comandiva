import { and, desc, eq, gte } from "drizzle-orm";
import { getDb } from "./client";
import { billingPayments, features, planFeatures, planLimits, plans, restaurants, subscriptionEvents, subscriptions, type SubscriptionStatus } from "../../drizzle/schema";
import { createSubscriptionPreapproval, updateSubscriptionPreapproval } from "../_core/mercadoPagoBilling";
import { ENV, commercialHomeUrl } from "../_core/env";
import { getPlanByKey } from "./plans";
import { PLATFORM_NAME } from "../../shared/branding";
import { sendEmailAsync } from "../_core/emailService";
import {
  buildSubscriptionCanceledMessage,
  buildSubscriptionPastDueGraceExpiredMessage,
  buildSubscriptionPastDueMessage,
  buildSubscriptionRecoveredMessage,
  buildSubscriptionRenewedMessage,
  sendTelegramMessageAsync,
} from "../_core/telegramService";

/** Só o necessário pra endereçar um e-mail — sem contactEmail, sem envio (nada quebra, só não manda). */
export async function getRestaurantContact(restaurantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select({ name: restaurants.name, contactName: restaurants.contactName, contactEmail: restaurants.contactEmail, deploymentUrl: restaurants.deploymentUrl }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1);
  return row;
}

const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
// Prazo dado ao cliente pra regularizar uma cobrança recusada antes de
// bloquear o acesso — o Mercado Pago já tenta cobrar de novo sozinho por até
// 10 dias (4 tentativas) antes de cancelar a assinatura definitivamente;
// esses 5 dias são um alerta ANTES disso, não substituem o cancelamento
// automático deles (ver markSubscriptionPastDue/enforcePastDueGracePeriod).
const PAST_DUE_GRACE_DAYS = 5;
const PAST_DUE_GRACE_MS = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;

// Promoção de lançamento: 20% de desconto na mensalidade nos 2 primeiros
// ciclos de cobrança, pra restaurantes que nasceram com
// restaurants.promoEligible (ver server/db/restaurants.ts::LAUNCH_PROMO_ACTIVE).
const LAUNCH_PROMO_DISCOUNT_RATE = 0.2;
const LAUNCH_PROMO_CYCLES = 2;

/** Ausência de linha (ex.: harness de teste sem stub de `restaurants`) conta como não-elegível — preço cheio. */
async function isRestaurantPromoEligible(restaurantId: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const [row] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1);
  return row?.promoEligible ?? false;
}

export async function getSubscriptionForRestaurant(restaurantId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db
    .select({ subscription: subscriptions, plan: plans })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.restaurantId, restaurantId))
    .limit(1);
  return row;
}

async function recordEvent(subscriptionId: number, eventType: string, before: unknown, after: unknown, actor?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(subscriptionEvents).values({
    subscriptionId,
    eventType,
    beforeJson: JSON.stringify(before),
    afterJson: JSON.stringify(after),
    actor,
    createdAt: Date.now(),
  });
}

export async function assignPlan(input: { restaurantId: number; planKey: string; actor?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const current = await getSubscriptionForRestaurant(input.restaurantId);
  if (!current) throw new Error("Restaurante sem assinatura cadastrada.");
  const nextPlan = await getPlanByKey(input.planKey);
  if (!nextPlan) throw new Error(`Plano "${input.planKey}" não encontrado.`);

  await db.update(subscriptions).set({ planId: nextPlan.id, updatedAt: Date.now() }).where(eq(subscriptions.id, current.subscription.id));
  await recordEvent(current.subscription.id, "plan_changed", { planKey: current.plan.key }, { planKey: nextPlan.key }, input.actor ?? "operator:cli");
  return { success: true };
}

export async function updateSubscriptionStatus(input: { restaurantId: number; status: SubscriptionStatus; actor?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const current = await getSubscriptionForRestaurant(input.restaurantId);
  if (!current) throw new Error("Restaurante sem assinatura cadastrada.");

  await db.update(subscriptions).set({ status: input.status, updatedAt: Date.now() }).where(eq(subscriptions.id, current.subscription.id));
  await recordEvent(current.subscription.id, "status_changed", { status: current.subscription.status }, { status: input.status }, input.actor ?? "operator:cli");
  return { success: true };
}

/** Histórico de cobranças da assinatura SaaS. */
export async function listBillingPaymentsForSubscription(subscriptionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(billingPayments).where(eq(billingPayments.subscriptionId, subscriptionId)).orderBy(desc(billingPayments.createdAt));
}

// Histórico de mudanças de plano/status de UM restaurante — já era gravado
// corretamente por recordEvent() em toda mudança (self-service, webhook ou
// operador), só nunca teve leitura por restaurante exposta (só existia
// agregado, em db/dashboard.ts). Resolve restaurantId -> subscriptionId
// primeiro porque subscription_events é indexado por subscriptionId.
export async function listSubscriptionEventsForRestaurant(restaurantId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const current = await getSubscriptionForRestaurant(restaurantId);
  if (!current) return [];
  return db.select().from(subscriptionEvents).where(eq(subscriptionEvents.subscriptionId, current.subscription.id)).orderBy(desc(subscriptionEvents.createdAt)).limit(limit);
}

export async function getSubscriptionByGatewaySubscriptionId(gatewaySubscriptionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.gatewaySubscriptionId, gatewaySubscriptionId)).limit(1);
  return row;
}

/** Vincula a assinatura de um restaurante a uma preapproval recém-criada no Mercado Pago. */
export async function attachMercadoPagoPreapproval(input: { restaurantId: number; preapprovalId: string; actor: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const current = await getSubscriptionForRestaurant(input.restaurantId);
  if (!current) throw new Error("Restaurante sem assinatura cadastrada.");
  await db.update(subscriptions).set({ gateway: "MERCADO_PAGO", gatewaySubscriptionId: input.preapprovalId, updatedAt: Date.now() }).where(eq(subscriptions.id, current.subscription.id));
  await recordEvent(current.subscription.id, "mercadopago_preapproval_created", { gateway: current.subscription.gateway }, { gateway: "MERCADO_PAGO", preapprovalId: input.preapprovalId }, input.actor);
  return { success: true };
}

const PREAPPROVAL_STATUS_TO_SUBSCRIPTION_STATUS: Record<string, SubscriptionStatus> = {
  pending: "payment_pending",
  authorized: "active",
  paused: "suspended",
  cancelled: "canceled",
};

/**
 * Aplica o estado de uma preapproval do Mercado Pago (vindo do webhook
 * `subscription_preapproval`) na assinatura correspondente — idempotente,
 * chamar de novo com o mesmo estado não gera evento duplicado no histórico.
 * Quando a preapproval vira "authorized" pela primeira vez e havia um plano
 * agendado (self-service: cliente escolheu o plano antes de pagar, ver
 * startOrChangePlan), é esse o momento — confirmado pelo Mercado Pago, não
 * pelo frontend — em que o plano de fato muda.
 */
export async function applyPreapprovalStatus(input: { preapprovalId: string; mpStatus: string; payerId?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const subscription = await getSubscriptionByGatewaySubscriptionId(input.preapprovalId);
  if (!subscription) return { found: false as const };
  const nextStatus = PREAPPROVAL_STATUS_TO_SUBSCRIPTION_STATUS[input.mpStatus];
  if (!nextStatus) return { found: true as const, applied: false as const };
  const activating = nextStatus === "active" && subscription.status !== "active" && subscription.scheduledPlanId;
  if (subscription.status === nextStatus && !activating) return { found: true as const, applied: false as const };

  const wasPastDue = subscription.status === "past_due";
  const updates: Partial<typeof subscriptions.$inferInsert> = { status: nextStatus, gatewayCustomerId: input.payerId != null ? String(input.payerId) : subscription.gatewayCustomerId, updatedAt: Date.now() };
  if (activating) {
    updates.planId = subscription.scheduledPlanId!;
    updates.scheduledPlanId = null;
  }
  // Sai de past_due sempre que o Mercado Pago confirma a preapproval como
  // "authorized" de novo — é o sinal mais confiável de recuperação (mais
  // confiável que o webhook de cobrança individual, cujo status "processed"
  // é ambíguo entre sucesso e falha definitiva, ver markSubscriptionPastDue).
  if (wasPastDue && nextStatus === "active") updates.pastDueSince = null;
  await db.update(subscriptions).set(updates).where(eq(subscriptions.id, subscription.id));
  await recordEvent(subscription.id, activating ? "plan_activated_from_payment" : "mercadopago_status_changed", { status: subscription.status, planId: subscription.planId }, { status: nextStatus, mpStatus: input.mpStatus, planId: updates.planId ?? subscription.planId }, "mercadopago:webhook");

  const contact = await getRestaurantContact(subscription.restaurantId);
  const restaurantName = contact?.name ?? `#${subscription.restaurantId}`;
  if (wasPastDue && nextStatus === "active") {
    sendTelegramMessageAsync(buildSubscriptionRecoveredMessage({ restaurantId: subscription.restaurantId, restaurantName }));
    if (contact?.contactEmail) {
      const [plan] = await db.select().from(plans).where(eq(plans.id, updates.planId ?? subscription.planId)).limit(1);
      sendEmailAsync(contact.contactEmail, "paymentRecovered", { customerName: contact.contactName || contact.name, restaurantName, amountCents: plan?.priceCents ?? 0, actionUrl: contact.deploymentUrl || commercialHomeUrl });
    }
  } else if (nextStatus === "canceled" && subscription.status !== "canceled") {
    sendTelegramMessageAsync(buildSubscriptionCanceledMessage({ restaurantId: subscription.restaurantId, restaurantName }));
  }
  return { found: true as const, applied: true as const, restaurantId: subscription.restaurantId };
}

/**
 * Uma cobrança recorrente falhou e o Mercado Pago está tentando de novo
 * automaticamente ("recycling", status inequívoco — diferente de
 * "processed", que pode significar sucesso OU falha definitiva depois de 4
 * tentativas, ver comentário em recordBillingPayment). Marca a assinatura
 * como past_due SEM adiantar currentPeriodEnd (diferente do fluxo normal em
 * applyDueScheduledChanges) — o cliente não pode ganhar acesso de graça só
 * porque o cartão recusou. Idempotente: chamar de novo enquanto já está
 * past_due não reinicia a contagem dos 5 dias de prazo.
 */
export async function markSubscriptionPastDue(subscriptionId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
  if (!subscription || subscription.status !== "active") return;
  const now = Date.now();
  await db.update(subscriptions).set({ status: "past_due", pastDueSince: now, updatedAt: now }).where(eq(subscriptions.id, subscriptionId));
  await recordEvent(subscriptionId, "payment_recycling", { status: "active" }, { status: "past_due" }, "mercadopago:webhook");
  const contact = await getRestaurantContact(subscription.restaurantId);
  sendTelegramMessageAsync(buildSubscriptionPastDueMessage({ restaurantId: subscription.restaurantId, restaurantName: contact?.name ?? `#${subscription.restaurantId}` }));
  if (contact?.contactEmail) {
    const [plan] = await db.select().from(plans).where(eq(plans.id, subscription.planId)).limit(1);
    sendEmailAsync(contact.contactEmail, "paymentOverdue", {
      customerName: contact.contactName || contact.name,
      restaurantName: contact.name,
      planName: plan?.name ?? "",
      amountCents: plan?.priceCents ?? 0,
      dueDate: now,
      graceDays: PAST_DUE_GRACE_DAYS,
      actionUrl: contact.deploymentUrl || commercialHomeUrl,
    });
  }
}

/**
 * Roda em todo computeSnapshotForRestaurant (abaixo) — se passou do prazo de
 * 5 dias em past_due, bloqueia o acesso (reaproveita o mesmo mecanismo de
 * "trial vencido sem pagamento": zera as features no snapshot) e avisa uma
 * única vez (checa o histórico de eventos antes de mandar de novo, mesmo
 * raciocínio de markWebhookEventOnce — sem coluna nova só pra isso).
 */
export async function isPastDueGraceExpired(subscription: { id: number; status: SubscriptionStatus; pastDueSince: number | null; restaurantId: number }): Promise<boolean> {
  if (subscription.status !== "past_due" || !subscription.pastDueSince) return false;
  const expired = Date.now() - subscription.pastDueSince > PAST_DUE_GRACE_MS;
  if (!expired) return false;

  const db = await getDb();
  if (!db) return true;
  const [existingNotification] = await db
    .select({ id: subscriptionEvents.id })
    .from(subscriptionEvents)
    .where(and(eq(subscriptionEvents.subscriptionId, subscription.id), eq(subscriptionEvents.eventType, "past_due_grace_expired"), gte(subscriptionEvents.createdAt, subscription.pastDueSince!)))
    .limit(1);
  const alreadyNotifiedThisEpisode = Boolean(existingNotification);
  if (!alreadyNotifiedThisEpisode) {
    await recordEvent(subscription.id, "past_due_grace_expired", { status: "past_due" }, { status: "past_due", blocked: true }, "system:reconciliation");
    const contact = await getRestaurantContact(subscription.restaurantId);
    sendTelegramMessageAsync(buildSubscriptionPastDueGraceExpiredMessage({ restaurantId: subscription.restaurantId, restaurantName: contact?.name ?? `#${subscription.restaurantId}` }));
    if (contact?.contactEmail) {
      sendEmailAsync(contact.contactEmail, "subscriptionAccessSuspended", {
        customerName: contact.contactName || contact.name,
        restaurantName: contact.name,
        graceDaysUsed: PAST_DUE_GRACE_DAYS,
        actionUrl: contact.deploymentUrl || commercialHomeUrl,
      });
    }
  }
  return true;
}

/**
 * Avisa (Telegram + e-mail do cliente) que uma renovação mensal foi
 * confirmada — chamado pelo webhook só quando a assinatura JÁ estava
 * "active" antes (evita notificar a primeira ativação, que já tem seu
 * próprio e-mail de boas-vindas em confirmSignupPaymentAndCreateRestaurant).
 */
export async function notifySubscriptionRenewed(subscriptionId: number, amountCents: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
  if (!subscription) return;
  const contact = await getRestaurantContact(subscription.restaurantId);
  const restaurantName = contact?.name ?? `#${subscription.restaurantId}`;
  sendTelegramMessageAsync(buildSubscriptionRenewedMessage({ restaurantId: subscription.restaurantId, restaurantName, amountCents }));
  if (contact?.contactEmail) {
    const [plan] = await db.select().from(plans).where(eq(plans.id, subscription.planId)).limit(1);
    sendEmailAsync(contact.contactEmail, "subscriptionRenewed", {
      customerName: contact.contactName || contact.name,
      restaurantName,
      planName: plan?.name ?? "",
      amountCents,
      renewalDate: Date.now(),
      nextBillingDate: subscription.currentPeriodEnd,
      actionUrl: contact.deploymentUrl || commercialHomeUrl,
    });
  }
}

/**
 * Roda a cada vez que o ciclo atual pode ter vencido — aplica downgrade
 * agendado ou finaliza cancelamento agendado. Chamada tanto no polling
 * periódico de cada deployment (computeSnapshotForRestaurant, abaixo) quanto
 * assim que um pagamento real de renovação chega pelo webhook — nenhum
 * worker/cron novo precisou ser criado pra isso. Idempotente: se nada está
 * agendado ou o ciclo ainda não venceu, não faz nada.
 */
export async function applyDueScheduledChanges(subscriptionId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).limit(1);
  if (!subscription || Date.now() < subscription.currentPeriodEnd) return;
  const now = Date.now();

  if (subscription.status === "cancel_at_period_end") {
    await db.update(subscriptions).set({ status: "canceled", canceledAt: now, updatedAt: now }).where(eq(subscriptions.id, subscription.id));
    await recordEvent(subscription.id, "cancellation_finalized", { status: subscription.status }, { status: "canceled" }, "system:reconciliation");
    if (subscription.gatewaySubscriptionId && ENV.mercadoPagoAccessToken) {
      await updateSubscriptionPreapproval({ accessToken: ENV.mercadoPagoAccessToken, preapprovalId: subscription.gatewaySubscriptionId, status: "cancelled" }).catch(error => console.warn("[billing] Falha ao cancelar preapproval no Mercado Pago:", error));
    }
    const contact = await getRestaurantContact(subscription.restaurantId);
    if (contact?.contactEmail) {
      sendEmailAsync(contact.contactEmail, "subscriptionCancelEffective", {
        customerName: contact.contactName || contact.name,
        restaurantName: contact.name,
        actionUrl: commercialHomeUrl,
      });
    }
    return;
  }

  // Trial vencido — sem isso, o restaurante ficava com acesso completo
  // indefinidamente após os 7 dias grátis, porque nada mais reavaliava esse
  // estado (ver auditoria que motivou esta mudança). Reaproveita 'ended',
  // valor do enum que antes nunca era atribuído por nenhum código —
  // computeSnapshotForRestaurant abaixo zera as features quando vê esse
  // status, bloqueando o acesso até o dono assinar de verdade (billing/login
  // continuam liberados, porque não passam por nenhum feature-gate).
  //
  // Checa `status === "trial"` sozinho, SEM olhar scheduledPlanId (achado
  // M2 da auditoria) — antes, um checkout iniciado mas nunca confirmado pelo
  // Mercado Pago (scheduledPlanId setado, status ainda "trial") caía no
  // branch de scheduledPlanId logo abaixo, que promove o plano pago sem
  // exigir confirmação de pagamento nenhuma: um mês inteiro de graça. Se o
  // status ainda é "trial", o Mercado Pago nunca confirmou nada — não importa
  // se existe um scheduledPlanId pendente, o acesso deve ser bloqueado do
  // mesmo jeito. Uma confirmação tardia continua funcionando normalmente:
  // applyPreapprovalStatus (chamada direto pelo webhook, não daqui) ativa o
  // plano assim que o Mercado Pago confirmar, seja qual for o status atual.
  if (subscription.status === "trial") {
    if (ENV.internalDemoRestaurantIds.includes(subscription.restaurantId)) {
      // Restaurante de uso interno/demonstração (ver ENV.internalDemoRestaurantIds)
      // — em vez de bloquear, renova o período de 30 dias a partir de agora.
      // Continua em 'trial', então o aviso "faltam N dias" (TrialEndingBanner)
      // segue aparecendo com a data sempre fresca, mas o bloqueio total
      // (TrialEndedBlock) nunca é acionado pra esses restaurantes.
      await db.update(subscriptions).set({ currentPeriodStart: now, currentPeriodEnd: now + ONE_MONTH_MS, updatedAt: now }).where(eq(subscriptions.id, subscription.id));
      await recordEvent(subscription.id, "trial_renewed_internal_demo", { currentPeriodEnd: subscription.currentPeriodEnd }, { currentPeriodEnd: now + ONE_MONTH_MS }, "system:reconciliation");
      return;
    }
    await db.update(subscriptions).set({ status: "ended", updatedAt: now }).where(eq(subscriptions.id, subscription.id));
    await recordEvent(subscription.id, "trial_ended", { status: "trial" }, { status: "ended" }, "system:reconciliation");
    return;
  }

  if (subscription.scheduledPlanId) {
    const newPeriodStart = subscription.currentPeriodEnd;
    const newPeriodEnd = newPeriodStart + ONE_MONTH_MS;
    const targetPlanId = subscription.scheduledPlanId;
    await db.update(subscriptions).set({ planId: targetPlanId, scheduledPlanId: null, currentPeriodStart: newPeriodStart, currentPeriodEnd: newPeriodEnd, updatedAt: now }).where(eq(subscriptions.id, subscription.id));
    await recordEvent(subscription.id, "downgrade_applied", { planId: subscription.planId }, { planId: targetPlanId }, "system:reconciliation");
    if (subscription.gatewaySubscriptionId && ENV.mercadoPagoAccessToken) {
      const [targetPlan] = await db.select().from(plans).where(eq(plans.id, targetPlanId)).limit(1);
      if (targetPlan) {
        await updateSubscriptionPreapproval({ accessToken: ENV.mercadoPagoAccessToken, preapprovalId: subscription.gatewaySubscriptionId, amountCents: targetPlan.priceCents }).catch(error => console.warn("[billing] Falha ao atualizar valor da preapproval no Mercado Pago:", error));
      }
    }
    return;
  }

  // Nada agendado — só rola o período pra frente. A data exata de cobrança
  // de verdade é sempre do Mercado Pago; isto é uma aproximação (30 dias) só
  // pra saber quando reavaliar de novo, nunca usada pra cobrar ninguém.
  if (subscription.status === "active") {
    const newPeriodStart = subscription.currentPeriodEnd;
    const updates: Partial<typeof subscriptions.$inferInsert> = { currentPeriodStart: newPeriodStart, currentPeriodEnd: newPeriodStart + ONE_MONTH_MS, updatedAt: now };

    // Cada ciclo que rola é uma renovação cobrada — decrementa a promoção de
    // lançamento e, ao esgotar, volta o valor da preapproval pro preço cheio
    // do plano atual (nunca inventamos cobrança proporcional aqui, só
    // atualizamos o valor da PRÓXIMA cobrança, mesmo raciocínio de upgrade).
    if (subscription.promoDiscountCyclesRemaining != null) {
      const remaining = subscription.promoDiscountCyclesRemaining - 1;
      if (remaining <= 0) {
        updates.promoDiscountCyclesRemaining = null;
        if (subscription.gatewaySubscriptionId && ENV.mercadoPagoAccessToken) {
          const [currentPlan] = await db.select().from(plans).where(eq(plans.id, subscription.planId)).limit(1);
          if (currentPlan) {
            await updateSubscriptionPreapproval({ accessToken: ENV.mercadoPagoAccessToken, preapprovalId: subscription.gatewaySubscriptionId, amountCents: currentPlan.priceCents }).catch(error =>
              console.warn("[billing] Falha ao restaurar preço cheio após promoção de lançamento:", error),
            );
          }
        }
      } else {
        updates.promoDiscountCyclesRemaining = remaining;
      }
    }

    await db.update(subscriptions).set(updates).where(eq(subscriptions.id, subscription.id));
  }
}

/**
 * Ponto de entrada único do self-service (ver saas-core/server/routers/billing.ts):
 * o restaurante escolhe um plano, este decide sozinho se é primeira
 * assinatura (checkout novo), upgrade (libera na hora, valor novo só na
 * próxima cobrança — Mercado Pago não tem cobrança proporcional pra
 * preapproval, então nenhuma é inventada aqui) ou downgrade (agendado pro
 * fim do ciclo atual, dados/acesso do plano atual preservados até lá).
 */
export async function startOrChangePlan(input: { restaurantId: number; planKey: string; payerEmail: string; backUrl: string; actor: string; deviceId?: string }): Promise<{ checkoutUrl: string } | { scheduled: true; effectiveAt: number; planKey: string } | { applied: true }> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const current = await getSubscriptionForRestaurant(input.restaurantId);
  if (!current) throw new Error("Restaurante sem assinatura cadastrada.");
  const targetPlan = await getPlanByKey(input.planKey);
  if (!targetPlan) throw new Error(`Plano "${input.planKey}" não encontrado.`);
  if (!ENV.mercadoPagoAccessToken) throw new Error("Cobrança automática não está configurada.");

  if (targetPlan.id === current.plan.id) {
    if (current.subscription.scheduledPlanId) {
      await db.update(subscriptions).set({ scheduledPlanId: null, updatedAt: Date.now() }).where(eq(subscriptions.id, current.subscription.id));
      await recordEvent(current.subscription.id, "downgrade_cancelled", { scheduledPlanId: current.subscription.scheduledPlanId }, { scheduledPlanId: null }, input.actor);
    }
    return { applied: true };
  }

  const hasGoodStandingSubscription = current.subscription.status === "active" && Boolean(current.subscription.gatewaySubscriptionId);

  if (!hasGoodStandingSubscription) {
    // Primeira assinatura de verdade (ou recuperando de um estado ruim) — cria
    // a preapproval; o plano só muda quando o Mercado Pago confirmar via
    // webhook (applyPreapprovalStatus acima), nunca antes.
    const promoEligible = await isRestaurantPromoEligible(input.restaurantId);
    const amountCents = promoEligible ? Math.round(targetPlan.priceCents * (1 - LAUNCH_PROMO_DISCOUNT_RATE)) : targetPlan.priceCents;
    const preapproval = await createSubscriptionPreapproval({
      accessToken: ENV.mercadoPagoAccessToken,
      reason: `Assinatura ${PLATFORM_NAME} — plano ${targetPlan.name}`,
      externalReference: `restaurant:${input.restaurantId}`,
      payerEmail: input.payerEmail,
      backUrl: input.backUrl,
      amountCents,
      deviceId: input.deviceId,
    });
    await db
      .update(subscriptions)
      .set({
        gateway: "MERCADO_PAGO",
        gatewaySubscriptionId: preapproval.id,
        scheduledPlanId: targetPlan.id,
        promoDiscountCyclesRemaining: promoEligible ? LAUNCH_PROMO_CYCLES : null,
        updatedAt: Date.now(),
      })
      .where(eq(subscriptions.id, current.subscription.id));
    await recordEvent(
      current.subscription.id,
      "checkout_started",
      { planKey: current.plan.key },
      { scheduledPlanKey: targetPlan.key, preapprovalId: preapproval.id, amountCents, promoApplied: promoEligible },
      input.actor,
    );
    return { checkoutUrl: preapproval.initPoint };
  }

  if (targetPlan.position > current.plan.position) {
    await updateSubscriptionPreapproval({ accessToken: ENV.mercadoPagoAccessToken, preapprovalId: current.subscription.gatewaySubscriptionId!, amountCents: targetPlan.priceCents });
    await db.update(subscriptions).set({ planId: targetPlan.id, scheduledPlanId: null, updatedAt: Date.now() }).where(eq(subscriptions.id, current.subscription.id));
    await recordEvent(current.subscription.id, "plan_upgraded", { planKey: current.plan.key }, { planKey: targetPlan.key }, input.actor);
    const contact = await getRestaurantContact(input.restaurantId);
    if (contact?.contactEmail) {
      sendEmailAsync(contact.contactEmail, "subscriptionUpgraded", {
        customerName: contact.contactName || contact.name,
        restaurantName: contact.name,
        previousPlanName: current.plan.name,
        newPlanName: targetPlan.name,
        actionUrl: contact.deploymentUrl || commercialHomeUrl,
      });
    }
    return { applied: true };
  }

  await db.update(subscriptions).set({ scheduledPlanId: targetPlan.id, updatedAt: Date.now() }).where(eq(subscriptions.id, current.subscription.id));
  await recordEvent(current.subscription.id, "downgrade_scheduled", { planKey: current.plan.key }, { scheduledPlanKey: targetPlan.key, effectiveAt: current.subscription.currentPeriodEnd }, input.actor);
  const downgradeContact = await getRestaurantContact(input.restaurantId);
  if (downgradeContact?.contactEmail) {
    sendEmailAsync(downgradeContact.contactEmail, "subscriptionDowngraded", {
      customerName: downgradeContact.contactName || downgradeContact.name,
      restaurantName: downgradeContact.name,
      previousPlanName: current.plan.name,
      newPlanName: targetPlan.name,
      effectiveDate: current.subscription.currentPeriodEnd,
      actionUrl: downgradeContact.deploymentUrl || commercialHomeUrl,
    });
  }
  return { scheduled: true, effectiveAt: current.subscription.currentPeriodEnd, planKey: targetPlan.key };
}

/** Cancelamento self-service — agendado pro fim do ciclo pago atual, nunca imediato (o cliente já pagou por esse período). */
export async function scheduleCancellation(input: { restaurantId: number; reason?: string; actor: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const current = await getSubscriptionForRestaurant(input.restaurantId);
  if (!current) throw new Error("Restaurante sem assinatura cadastrada.");
  if (current.subscription.status === "canceled" || current.subscription.status === "cancel_at_period_end") return { effectiveAt: current.subscription.currentPeriodEnd };
  await db.update(subscriptions).set({ status: "cancel_at_period_end", cancelReason: input.reason ?? null, scheduledPlanId: null, updatedAt: Date.now() }).where(eq(subscriptions.id, current.subscription.id));
  await recordEvent(current.subscription.id, "cancellation_scheduled", { status: current.subscription.status }, { status: "cancel_at_period_end", effectiveAt: current.subscription.currentPeriodEnd }, input.actor);
  const contact = await getRestaurantContact(input.restaurantId);
  if (contact?.contactEmail) {
    sendEmailAsync(contact.contactEmail, "subscriptionCancelRequested", {
      customerName: contact.contactName || contact.name,
      restaurantName: contact.name,
      accessUntil: current.subscription.currentPeriodEnd,
      actionUrl: contact.deploymentUrl || commercialHomeUrl,
    });
  }
  return { effectiveAt: current.subscription.currentPeriodEnd };
}

/** Desfaz um cancelamento agendado que ainda não se efetivou — não existe "reativar" depois que já cancelou de verdade (precisa assinar de novo). */
export async function reactivateScheduledCancellation(input: { restaurantId: number; actor: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const current = await getSubscriptionForRestaurant(input.restaurantId);
  if (!current) throw new Error("Restaurante sem assinatura cadastrada.");
  if (current.subscription.status !== "cancel_at_period_end") throw new Error("Não há cancelamento agendado para desfazer.");
  await db.update(subscriptions).set({ status: "active", cancelReason: null, updatedAt: Date.now() }).where(eq(subscriptions.id, current.subscription.id));
  await recordEvent(current.subscription.id, "cancellation_undone", { status: "cancel_at_period_end" }, { status: "active" }, input.actor);
  return { success: true };
}

/**
 * Registra uma cobrança individual (o webhook `subscription_authorized_payment`
 * só avisa o id — o valor/estado sempre vêm de reconsultar o Mercado Pago,
 * nunca do corpo do webhook). Idempotente via billing_payments.gatewayPaymentId.
 */
export async function recordBillingPayment(input: { preapprovalId: string; gatewayPaymentId: string; amountCents: number | null; mpStatus: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const subscription = await getSubscriptionByGatewaySubscriptionId(input.preapprovalId);
  if (!subscription) return { found: false as const };
  const [existing] = await db.select().from(billingPayments).where(eq(billingPayments.gatewayPaymentId, input.gatewayPaymentId)).limit(1);
  if (existing) return { found: true as const, duplicate: true as const };
  // "processed" do Mercado Pago pode significar tanto "cobrado com sucesso"
  // quanto "esgotou as tentativas e falhou definitivamente" — ambíguo demais
  // pra marcar como "paid" sem confirmação. Fica "pending" até validação
  // manual a primeira vez que uma cobrança real acontecer (ver pendência).
  const status = input.mpStatus === "processed" ? "pending" : input.mpStatus === "recycling" ? "failed" : "pending";
  await db.insert(billingPayments).values({
    subscriptionId: subscription.id,
    gateway: "mercadopago",
    gatewayPaymentId: input.gatewayPaymentId,
    amountCents: input.amountCents ?? 0,
    status,
    paidAt: null,
    createdAt: Date.now(),
  });
  return { found: true as const, duplicate: false as const };
}

export type LicenseSnapshot = {
  restaurantId: number;
  planKey: string;
  planName: string;
  status: string;
  features: string[];
  limits: Record<string, number | null>;
  lockedFeatures: Record<string, { requiredPlanKey: string; requiredPlanName: string }>;
  currentPeriodEnd: number;
  syncedAt: number;
  // Downgrade agendado (self-service, ver startOrChangePlan) — o plano/entitlements
  // atuais continuam valendo até currentPeriodEnd; isto é só pra UI avisar o
  // que vai mudar e quando (nunca usado pra decidir acesso agora).
  scheduledPlanKey: string | null;
  scheduledPlanName: string | null;
};

/**
 * O cálculo central do serviço: pra um restaurante, quais features o plano
 * atual libera, quais ficam bloqueadas (e qual o plano mais barato que as
 * libera), e quais são os limites de uso do plano atual.
 */
export async function computeSnapshotForRestaurant(restaurantId: number): Promise<LicenseSnapshot> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  let current = await getSubscriptionForRestaurant(restaurantId);
  if (!current) throw new Error("Restaurante sem assinatura cadastrada.");
  // Aplica downgrade/cancelamento agendado que já venceu antes de calcular o
  // snapshot — é assim que a troca "acontece de verdade" pro cliente, sem
  // precisar de cron/worker: todo deployment já consulta isto periodicamente.
  if (Date.now() >= current.subscription.currentPeriodEnd) {
    await applyDueScheduledChanges(current.subscription.id);
    current = await getSubscriptionForRestaurant(restaurantId);
    if (!current) throw new Error("Restaurante sem assinatura cadastrada.");
  }
  const { subscription, plan } = current;

  const [allPlans, allFeatures, allPlanFeatures, currentPlanLimits] = await Promise.all([
    db.select().from(plans).orderBy(plans.position),
    db.select().from(features),
    db.select().from(planFeatures),
    db.select().from(planLimits).where(eq(planLimits.planId, plan.id)),
  ]);

  const plansById = new Map(allPlans.map(candidate => [candidate.id, candidate]));
  // Bloqueia TODAS as features quando a assinatura não está em dia — trial
  // encerrado sem pagamento ('ended'), assinatura cancelada ('canceled',
  // fim do ciclo pago já passou), preapproval pausada no Mercado Pago
  // ('suspended') ou mensalidade recusada há mais de 5 dias sem regularizar
  // (ver markSubscriptionPastDue/isPastDueGraceExpired). Antes desta
  // auditoria, só 'ended'/past_due-vencido bloqueavam — uma assinatura
  // cancelada ou suspensa pelo Mercado Pago continuava com acesso total
  // pra sempre, porque nada mais reavaliava esse estado (achado H1). O laço
  // abaixo joga toda feature bloqueada em lockedFeatures automaticamente,
  // sem duplicar lógica.
  const isTrialExpiredUnpaid = subscription.status === "ended";
  const isSubscriptionInactive = subscription.status === "canceled" || subscription.status === "suspended";
  const isPastDueBlocked = await isPastDueGraceExpired(subscription);
  const currentPlanFeatureIds = isTrialExpiredUnpaid || isSubscriptionInactive || isPastDueBlocked ? new Set<string>() : new Set(allPlanFeatures.filter(row => row.planId === plan.id).map(row => row.featureId));

  const includedFeatures: string[] = [];
  const lockedFeatures: LicenseSnapshot["lockedFeatures"] = {};

  for (const feature of allFeatures) {
    if (currentPlanFeatureIds.has(feature.featureId)) {
      includedFeatures.push(feature.featureId);
      continue;
    }
    // Entre os planos que incluem esta feature, o de menor `position` é o
    // mais barato que a libera — é o que mostramos no convite de upgrade.
    const plansWithFeature = allPlanFeatures
      .filter(row => row.featureId === feature.featureId)
      .map(row => plansById.get(row.planId))
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
      .sort((a, b) => a.position - b.position);
    const cheapest = plansWithFeature[0];
    if (cheapest) lockedFeatures[feature.featureId] = { requiredPlanKey: cheapest.key, requiredPlanName: cheapest.name };
  }

  const limits = Object.fromEntries(currentPlanLimits.map(row => [row.resourceKey, row.limitValue]));
  const scheduledPlan = subscription.scheduledPlanId ? plansById.get(subscription.scheduledPlanId) : undefined;

  return {
    restaurantId,
    planKey: plan.key,
    planName: plan.name,
    status: subscription.status,
    features: includedFeatures,
    limits,
    lockedFeatures,
    currentPeriodEnd: subscription.currentPeriodEnd,
    syncedAt: Date.now(),
    scheduledPlanKey: scheduledPlan?.key ?? null,
    scheduledPlanName: scheduledPlan?.name ?? null,
  };
}
