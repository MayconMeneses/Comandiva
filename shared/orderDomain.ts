export const ORDER_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatusValue = (typeof ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<OrderStatusValue, string> = {
  PENDING: "Aguardando aceite",
  ACCEPTED: "Pedido aceito",
  PREPARING: "Em preparo",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  READY_FOR_PICKUP: "Pronto para retirada",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatusValue, OrderStatusValue[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["OUT_FOR_DELIVERY", "READY_FOR_PICKUP", "CANCELLED"],
  OUT_FOR_DELIVERY: ["COMPLETED"],
  READY_FOR_PICKUP: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function calculateCartTotal(
  items: Array<{ unitPriceCents: number; quantity: number }>,
  deliveryFeeCents: number,
) {
  const subtotalCents = items.reduce(
    (total, item) => total + item.unitPriceCents * item.quantity,
    0,
  );
  return {
    subtotalCents,
    deliveryFeeCents,
    totalCents: subtotalCents + deliveryFeeCents,
  };
}

const RESTAURANT_TIMEZONE = "America/Fortaleza";

/** Retorna "HH:MM" no horário local do restaurante (Croatá/CE), não importa em qual fuso o servidor está rodando. */
export function currentTimeInRestaurantTimezone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: RESTAURANT_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

/** true se `time` (HH:MM) está dentro do intervalo start–end. Lida com janelas que viram a meia-noite, por exemplo 22:00 às 02:00. */
function isTimeWithinWindow(time: string, start: string, end: string) {
  const t = timeToMinutes(time);
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  if (s === e) return true; // janela de 24h
  if (s < e) return t >= s && t < e;
  return t >= s || t < e; // janela que cruza a meia-noite
}

/**
 * Decide se uma categoria deve aparecer no cardápio público agora, com base
 * na regra de horário escolhida pelo admin (sempre, só almoço, só janta, ou
 * ambos) e nas janelas de almoço/janta configuradas. Categorias "ALWAYS" ou
 * sem janelas configuradas nunca são escondidas — a restrição só entra em
 * vigor quando o admin de fato configura os horários.
 */
export function isCategoryCurrentlyAvailable(
  category: { timeAvailability?: string | null },
  settings: { lunchStartTime?: string | null; lunchEndTime?: string | null; dinnerStartTime?: string | null; dinnerEndTime?: string | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  const rule = category.timeAvailability ?? "ALWAYS";
  if (rule === "ALWAYS") return true;

  const currentTime = currentTimeInRestaurantTimezone(now);
  const lunchWindowSet = Boolean(settings?.lunchStartTime && settings?.lunchEndTime);
  const dinnerWindowSet = Boolean(settings?.dinnerStartTime && settings?.dinnerEndTime);

  const withinLunch = lunchWindowSet && isTimeWithinWindow(currentTime, settings!.lunchStartTime!, settings!.lunchEndTime!);
  const withinDinner = dinnerWindowSet && isTimeWithinWindow(currentTime, settings!.dinnerStartTime!, settings!.dinnerEndTime!);

  if (rule === "LUNCH") return !lunchWindowSet || withinLunch;
  if (rule === "DINNER") return !dinnerWindowSet || withinDinner;
  if (rule === "LUNCH_AND_DINNER") return (!lunchWindowSet && !dinnerWindowSet) || withinLunch || withinDinner;
  return true;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Compara o bairro/cidade digitado pelo cliente com o nome e as observações da
 * rota de entrega escolhida. A sede do restaurante é em Croatá/CE, então essa
 * checagem existe para reduzir pedidos com endereço fora da área de entrega
 * selecionada. Usada tanto no checkout (aviso) quanto no servidor (bloqueio).
 */
export function addressMatchesRoute(
  route: { name: string; coverageNotes?: string | null } | undefined,
  address: { neighborhood?: string | null; city?: string | null },
) {
  if (!route) return true;
  const routeText = normalizeText(`${route.name} ${route.coverageNotes ?? ""}`);
  const neighborhood = normalizeText(address.neighborhood ?? "");
  const city = normalizeText(address.city ?? "");
  if (!neighborhood && !city) return true;
  const words = [...neighborhood.split(/\s+/), ...city.split(/\s+/)].filter(
    word => word.length > 2,
  );
  if (!words.length) return true;
  return words.some(word => routeText.includes(word));
}
