import type { AppRouter } from "../../../server/routers";
import type { inferRouterInputs } from "@trpc/server";
import { generateClientId } from "./randomId";

type RouterInputs = inferRouterInputs<AppRouter>;

export type PendingCheckoutEntry = {
  type: "order.create";
  screen: "checkout" | "counter";
  payload: RouterInputs["order"]["create"];
  createdAt: number;
  itemCount: number;
  schemaVersion: number;
};

export type PendingAddRoundEntry = {
  type: "table.addRound";
  token: string;
  payload: RouterInputs["table"]["addRound"];
  createdAt: number;
  itemCount: number;
  schemaVersion: number;
};

// Identidade por `tableId` (mesa autenticada), não por `token` (QR Code
// público) — contexto diferente do variant acima, por isso um tipo à parte
// em vez de sobrecarregar PendingAddRoundEntry com duas formas de
// identidade incompatíveis. Fase B do offline-first do admin, ver plano em
// C:\Users\maico\.claude\plans\curried-sprouting-wirth.md.
export type PendingAdminRoundEntry = {
  type: "admin.addManualRound";
  tableId: number;
  payload: RouterInputs["admin"]["addManualRound"];
  createdAt: number;
  itemCount: number;
  schemaVersion: number;
};

// Identidade por `orderId` — sem operationId de propósito: o dedupe aqui já
// vem de outro mecanismo (expectedStatus/CONFLICT em admin.updateOrderStatus,
// ver server/routers/admin/orders.ts), não de uma chave de idempotência.
// Reenviar o MESMO payload depois de reconectar é seguro pra qualquer
// intervalo de tempo — se já tiver sido aplicado, o servidor rejeita com
// CONFLICT (tratado como "já atualizado", não como falha real) em vez de
// duplicar nada. Fase C do offline-first, ver plano em
// C:\Users\maico\.claude\plans\curried-sprouting-wirth.md.
export type PendingOrderStatusEntry = {
  type: "admin.updateOrderStatus";
  orderId: number;
  payload: RouterInputs["admin"]["updateOrderStatus"];
  createdAt: number;
  itemCount: number;
  schemaVersion: number;
};

// Identidade por `tableSessionId` — dinheiro, por isso ganha fila de
// recuperação completa (não só retry em memória) igual às outras 2 entradas
// acima, ao contrário das ações de ciclo de vida da mesa (seatTable/
// closeSession/cancelSession/reopenSession/resolveServiceRequest), que são
// seguras por natureza e só precisam de retry, sem esse rastro.
export type PendingBillPaymentEntry = {
  type: "admin.recordBillPayment";
  tableSessionId: number;
  payload: RouterInputs["admin"]["recordBillPayment"];
  createdAt: number;
  itemCount: number;
  schemaVersion: number;
};

export type PendingQueueEntry = PendingCheckoutEntry | PendingAddRoundEntry | PendingAdminRoundEntry | PendingOrderStatusEntry | PendingBillPaymentEntry;

type PendingContext =
  | { type: "order.create"; screen: "checkout" | "counter" }
  | { type: "table.addRound"; token: string }
  | { type: "admin.addManualRound"; tableId: number }
  | { type: "admin.updateOrderStatus"; orderId: number }
  | { type: "admin.recordBillPayment"; tableSessionId: number };

// Janela curta de propósito: priceOrder (server/routers/order.ts) recalcula
// preço/disponibilidade/pedido mínimo do zero a cada order.create, sem
// nenhum "congelamento" do que o cliente viu — reenviar um pedido guardado
// horas depois arriscaria confirmar algo que ele não veria mais. 5min cobre
// o caso real (tela travou/sinal caiu por 1-3min) sem deixar a janela de
// descasamento de preço crescer.
export const PENDING_ORDER_WINDOW_MS = 5 * 60 * 1000;

// Sobe se o formato de checkoutSchema/addRoundSchema mudar de um jeito
// incompatível — uma entrada salva com versão antiga é descartada em vez de
// reenviada num formato que o backend atual não reconhece (mesmo padrão de
// CATALOG_CACHE_BUSTER da Fase 2).
export const PENDING_ORDER_SCHEMA_VERSION = 1;

const KEY_PREFIX = "mm-pending-order:";

function keyFor(context: PendingContext): string {
  if (context.type === "order.create") return `${KEY_PREFIX}order.create:${context.screen}`;
  if (context.type === "table.addRound") return `${KEY_PREFIX}table.addRound:${context.token}`;
  if (context.type === "admin.addManualRound") return `${KEY_PREFIX}admin.addManualRound:${context.tableId}`;
  if (context.type === "admin.updateOrderStatus") return `${KEY_PREFIX}admin.updateOrderStatus:${context.orderId}`;
  return `${KEY_PREFIX}admin.recordBillPayment:${context.tableSessionId}`;
}

function contextOf(entry: PendingQueueEntry): PendingContext {
  if (entry.type === "order.create") return { type: "order.create", screen: entry.screen };
  if (entry.type === "table.addRound") return { type: "table.addRound", token: entry.token };
  if (entry.type === "admin.addManualRound") return { type: "admin.addManualRound", tableId: entry.tableId };
  if (entry.type === "admin.updateOrderStatus") return { type: "admin.updateOrderStatus", orderId: entry.orderId };
  return { type: "admin.recordBillPayment", tableSessionId: entry.tableSessionId };
}

export function isEntryExpired(entry: Pick<PendingQueueEntry, "createdAt">, now: number = Date.now()): boolean {
  return now - entry.createdAt > PENDING_ORDER_WINDOW_MS;
}

function isEntryValid(entry: unknown): entry is PendingQueueEntry {
  if (!entry || typeof entry !== "object") return false;
  const candidate = entry as Partial<PendingQueueEntry>;
  if (candidate.schemaVersion !== PENDING_ORDER_SCHEMA_VERSION) return false;
  if (typeof candidate.createdAt !== "number" || typeof candidate.itemCount !== "number" || !candidate.payload) return false;
  if (candidate.type === "order.create") return candidate.screen === "checkout" || candidate.screen === "counter";
  if (candidate.type === "table.addRound") return typeof candidate.token === "string" && candidate.token.length > 0;
  if (candidate.type === "admin.addManualRound") return typeof candidate.tableId === "number" && candidate.tableId > 0;
  if (candidate.type === "admin.updateOrderStatus") return typeof candidate.orderId === "number" && candidate.orderId > 0;
  if (candidate.type === "admin.recordBillPayment") return typeof candidate.tableSessionId === "number" && candidate.tableSessionId > 0;
  return false;
}

// localStorage pode falhar (modo privado antigo, quota) — nesses casos só se
// perde o lembrete de recuperação, nunca o pedido em si (mesmo padrão de
// degradação segura já usado em client/src/lib/deviceId.ts).
export function persistPendingOrder(entry: PendingQueueEntry): void {
  try {
    localStorage.setItem(keyFor(contextOf(entry)), JSON.stringify(entry));
  } catch {
    // sem persistência — a Fase 3 estrita (retry em memória) continua funcionando normalmente.
  }
}

export function clearPendingOrder(context: PendingContext): void {
  try {
    localStorage.removeItem(keyFor(context));
  } catch {
    // nada a fazer — pior caso é um lembrete velho que a expiração já cobre.
  }
}

// Varre só as chaves com o prefixo desta fila — não assume nenhuma lista de
// contextos conhecida de antemão (mesas usam token/tableId dinâmico na chave).
export function readValidPendingOrders(now: number = Date.now()): PendingQueueEntry[] {
  const entries: PendingQueueEntry[] = [];
  try {
    // Coleta as chaves ANTES de remover qualquer uma — localStorage.key(i) é
    // posicional; remover uma entrada expirada no meio do loop deslocaria os
    // índices das chaves seguintes e faria a varredura pular entradas
    // válidas (achado real testando o cenário de mistura válida+expirada).
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        localStorage.removeItem(key);
        continue;
      }
      if (!isEntryValid(parsed) || isEntryExpired(parsed, now)) {
        localStorage.removeItem(key);
        continue;
      }
      entries.push(parsed);
    }
  } catch {
    return entries;
  }
  return entries;
}

// Semente do operationIdRef nas telas: reusa o id de uma pendência válida do
// MESMO contexto em vez de sempre gerar um novo — sem isso, um F5 depois de
// um pedido pausado geraria um operationId novo, e um reenvio manual pela
// tela normal (não pelo banner) derrotaria o dedupe do servidor, arriscando
// duplicar um pedido que já tinha sido aceito antes da aba cair.
export function resumeOrCreateOperationId(context: PendingContext): string {
  const [existing] = readValidPendingOrders().filter(entry => {
    const entryContext = contextOf(entry);
    return entryContext.type === context.type && keyFor(entryContext) === keyFor(context);
  });
  // Uma entrada malformada (localStorage editado manualmente, payload sem
  // operationId) não pode virar um `operationId: undefined` enviado ao
  // servidor — isso falharia a validação Zod pra sempre até recarregar a
  // página. Só reusa quando o id salvo é de fato uma string usável. `in`
  // funciona como type guard aqui porque nem todo variant do payload tem
  // `operationId` (ex.: admin.updateOrderStatus, que não usa essa chave de
  // idempotência — dedupe lá é via expectedStatus/CONFLICT, não operationId).
  if (existing && "operationId" in existing.payload && typeof existing.payload.operationId === "string" && existing.payload.operationId.length > 0) return existing.payload.operationId;
  return generateClientId();
}
