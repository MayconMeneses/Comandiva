import { and, asc, eq, gt, gte, inArray, lt, lte, ne } from "drizzle-orm";
import { tableReservations } from "../../drizzle/schema";
import { getDb, type DbOrTx } from "./client";
import { lockTableRow } from "./tableSessions";

/** Janela mínima entre duas reservas na mesma mesa — evita marcar duas reservas praticamente coladas. */
const RESERVATION_BUFFER_MS = 90 * 60 * 1000;

// Teto de segurança — mais apertado quando nem fromAt/toAt são informados
// (a tabela crescendo com o tempo, reservas antigas nunca arquivadas, virava
// uma query cada vez mais pesada sem que ninguém tivesse pedido "me traga
// tudo" de propósito); mais folgado quando já veio um período, só como
// defesa extra (achado da auditoria de escalabilidade 2026-09-19).
const MAX_RESERVATIONS_WITHOUT_RANGE = 500;
const MAX_RESERVATIONS_WITH_RANGE = 2000;

// ---- Reservas ----

export async function listReservations(filters: { fromAt?: number; toAt?: number } = {}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const conditions = [];
  if (filters.fromAt) conditions.push(gte(tableReservations.reservedFor, filters.fromAt));
  if (filters.toAt) conditions.push(lte(tableReservations.reservedFor, filters.toAt));
  return db
    .select()
    .from(tableReservations)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(tableReservations.reservedFor))
    .limit(conditions.length ? MAX_RESERVATIONS_WITH_RANGE : MAX_RESERVATIONS_WITHOUT_RANGE);
}

/** true se já existe outra reserva ativa nessa mesa dentro da janela de +-90min do horário pedido. Aceita `conn` opcional pra ler dentro da mesma transação que travou a mesa (ver createReservation/updateReservation). */
export async function hasReservationConflict(tableId: number, reservedFor: number, excludeReservationId?: number, conn?: DbOrTx) {
  const db = conn ?? (await getDb());
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
  const now = Date.now();
  // Trava a mesa (mesmo mutex de tableSessions.ts) ANTES de checar conflito
  // — sem isso, duas pessoas da equipe cadastrando/reagendando uma reserva
  // pra mesma mesa quase ao mesmo tempo (ex.: recepção + gerente) podiam
  // ambas passar pela checagem de conflito vendo "nenhuma reserva próxima"
  // e gravar duas reservas conflitantes na mesma mesa/horário (achado M4
  // da auditoria — mesma classe de corrida já corrigida em tableSessions.ts).
  const insertReservation = async (conn: DbOrTx) => {
    if (input.tableId && (await hasReservationConflict(input.tableId, input.reservedFor, undefined, conn))) {
      throw new Error("Já existe uma reserva próxima demais nessa mesa. Escolha outro horário ou outra mesa.");
    }
    const result = await conn.insert(tableReservations).values({
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
  };
  if (!input.tableId) return insertReservation(db);
  return db.transaction(async tx => {
    await lockTableRow(tx, input.tableId!);
    return insertReservation(tx);
  });
}

export async function updateReservation(id: number, input: Partial<{ status: "REQUESTED" | "CONFIRMED" | "SEATED" | "CANCELLED" | "NO_SHOW"; tableId: number | null; notes: string }>) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");
  const applyUpdate = async (conn: DbOrTx) => {
    if (input.tableId) {
      const [current] = await conn.select().from(tableReservations).where(eq(tableReservations.id, id)).limit(1);
      if (current && (await hasReservationConflict(input.tableId, current.reservedFor, id, conn))) {
        throw new Error("Já existe uma reserva próxima demais nessa mesa. Escolha outro horário ou outra mesa.");
      }
    }
    await conn.update(tableReservations).set({ ...input, updatedAt: Date.now() }).where(eq(tableReservations.id, id));
  };
  if (!input.tableId) return applyUpdate(db);
  return db.transaction(async tx => {
    await lockTableRow(tx, input.tableId!);
    return applyUpdate(tx);
  });
}
