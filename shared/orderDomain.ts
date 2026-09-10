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

/** Deslocamento UTC (minutos, positivo = à frente de UTC) do fuso do restaurante perto de um instante — calculado via Intl em vez de fixo, pra continuar certo mesmo se a regra de fuso mudar no futuro. */
function restaurantUtcOffsetMinutes(atUtcMs: number): number {
  const offsetPart = new Intl.DateTimeFormat("en-US", { timeZone: RESTAURANT_TIMEZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(atUtcMs))
    .find(part => part.type === "timeZoneName")?.value ?? "GMT+00:00"; // ex.: "GMT-03:00"
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offsetPart);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/**
 * Início do dia (00:00:00.000) no fuso do restaurante, N dias atrás — usado
 * pelo dashboard/relatórios do admin (server/routers/admin/orders.ts) pra
 * calcular o período sempre no fuso de Croatá/CE, nunca no fuso de quem está
 * com o navegador aberto (ver auditoria V-25: um admin de Modo Suporte ou o
 * dono viajando em outro fuso via até então via um "hoje" errado).
 */
export function startOfDayInRestaurantTimezone(daysAgo = 0, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: RESTAURANT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const year = Number(parts.find(part => part.type === "year")!.value);
  const month = Number(parts.find(part => part.type === "month")!.value);
  const day = Number(parts.find(part => part.type === "day")!.value);
  // Y-M-D "hoje" no fuso do restaurante, com N dias subtraídos em aritmética
  // de calendário (o Date.UTC aqui é só um jeito de subtrair dias direito,
  // não representa um instante real ainda).
  const targetDayAsUtc = Date.UTC(year, month - 1, day - daysAgo, 0, 0, 0);
  return targetDayAsUtc - restaurantUtcOffsetMinutes(targetDayAsUtc) * 60_000;
}

/** Fim do dia (23:59:59.999) no fuso do restaurante pra uma data YYYY-MM-DD específica — usado pelo filtro "dia específico" dos relatórios. */
export function endOfDayInRestaurantTimezone(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  const start = startOfDayInRestaurantTimezone(0, new Date(Date.UTC(year, month - 1, day, 12))); // meio-dia UTC evita cair no dia errado por causa do fuso
  return start + 24 * 60 * 60 * 1000 - 1;
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
