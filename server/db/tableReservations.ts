import { and, asc, eq, gt, gte, inArray, lt, lte, ne } from "drizzle-orm";
import { tableReservations } from "../../drizzle/schema";
import { getDb } from "./client";

/** Janela mínima entre duas reservas na mesma mesa — evita marcar duas reservas praticamente coladas. */
const RESERVATION_BUFFER_MS = 90 * 60 * 1000;

// Teto de segurança — mais apertado quando nem fromAt/toAt são informados
// (a tabela crescendo com o tempo, reservas antigas nunca arquivadas, virava
// uma query cada vez mais pesada sem que ninguém tivesse pedido "me traga
// tudo" de propósito); mais folgado quando já veio um período, só como
// defesa extra (achado da auditoria de escalabilidade 2026-09-19).
const MAX_RESERVATIONS_WITHOUT_RANGE = 500;
const MAX_RESERVATIONS_WITH_RANGE = 2000;

// Sem fromAt explícito (chamada real do admin: ReservationsManager.tsx pede
// só `{}`), a query pegava as 500 reservas mais ANTIGAS por ordem ascendente
// — como a tabela nunca é arquivada, depois que o restaurante acumula mais
// de 500 reservas no histórico, isso escondia TODAS as reservas futuras da
// tela do admin, sem erro nenhum (achado de auditoria). Sem período pedido,
// olha só a partir de um pouco antes de agora.
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000;

// ---- Reservas ----

export async function listReservations(filters: { fromAt?: number; toAt?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const hasExplicitRange = Boolean(filters.fromAt || filters.toAt);
  const fromAt = filters.fromAt ?? Date.now() - DEFAULT_LOOKBACK_MS;
  const conditions = [gte(tableReservations.reservedFor, fromAt)];
  if (filters.toAt) conditions.push(lte(tableReservations.reservedFor, filters.toAt));
  return db
    .select()
    .from(tableReservations)
    .where(and(...conditions))
    .orderBy(asc(tableReservations.reservedFor))
    .limit(hasExplicitRange ? MAX_RESERVATIONS_WITH_RANGE : MAX_RESERVATIONS_WITHOUT_RANGE);
}

/** true se já existe outra reserva ativa nessa mesa dentro da janela de +-90min do horário pedido. */
export async function hasReservationConflict(tableId: number, reservedFor: number, excludeReservationId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const conditions = [
    eq(tableReservations.tableId, tableId),
    inArray(tableReservations.status, ["REQUESTED", "CONFIRMED", "SEATED"]),
    gt(tableReservations.reservedFor, reservedFor - RESERVATION_BUFFER_MS),
    lt(tableReservations.reservedFor, reservedFor + RESERVATION_BUFFER_MS),
  ];
  if (excludeReservationId) conditions.push(ne(tableReservations.id, excludeReservationId));
  const [conflict] = await db.select().from(tableReservations).where(and(...conditions)).limit(1);
  return Boolean(conflict);
}

export async function createReservation(input: { customerName: string; customerPhone: string; partySize: number; reservedFor: number; tableId?: number; notes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  if (input.tableId && (await hasReservationConflict(input.tableId, input.reservedFor))) {
    throw new Error("Já existe uma reserva próxima demais nessa mesa. Escolha outro horário ou outra mesa.");
  }
  const now = Date.now();
  const result = await db.insert(tableReservations).values({
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    partySize: input.partySize,
    reservedFor: input.reservedFor,
    tableId: input.tableId ?? null,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return Number(result[0].insertId);
}

export async function updateReservation(id: number, input: Partial<{ status: "REQUESTED" | "CONFIRMED" | "SEATED" | "CANCELLED" | "NO_SHOW"; tableId: number | null; notes: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  if (input.tableId) {
    const [current] = await db.select().from(tableReservations).where(eq(tableReservations.id, id)).limit(1);
    if (current && (await hasReservationConflict(input.tableId, current.reservedFor, id))) {
      throw new Error("Já existe uma reserva próxima demais nessa mesa. Escolha outro horário ou outra mesa.");
    }
  }
  await db.update(tableReservations).set({ ...input, updatedAt: Date.now() }).where(eq(tableReservations.id, id));
}
