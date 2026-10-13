import { getStaffPermissionsByUserId } from "../db/users";
import type { TrpcContext } from "./context";

/**
 * Janela de pedidos visível ao ATENDENTE (staff) sem a permissão "relatórios"
 * (auditoria de segurança 2026-10-10, decisão do dono: últimas 24 horas).
 *
 * Antes qualquer atendente listava pedidos de qualquer data (até 100 por
 * consulta) e, somando, deduzia o faturamento e coletava nome, telefone e
 * endereço de todos os clientes — contornando as permissões "relatórios" e
 * "clientes". O dia a dia (aceitar, preparar, entregar) só precisa dos pedidos
 * recentes. Admin, Modo Suporte e staff COM "relatórios" continuam vendo tudo.
 */
export const STAFF_ORDER_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Instante (ms) a partir do qual o chamador pode ver pedidos; `undefined` = sem limite de histórico. */
export async function getOrderHistoryFloor(ctx: Pick<TrpcContext, "user" | "supportSession">, now = Date.now()): Promise<number | undefined> {
  if (ctx.user?.role === "admin" || ctx.supportSession) return undefined;
  if (ctx.user?.role === "staff") {
    const areas = await getStaffPermissionsByUserId(ctx.user.id);
    if (areas.includes("reports")) return undefined;
    return now - STAFF_ORDER_WINDOW_MS;
  }
  // Qualquer outro papel nunca chega aqui (restaurantProcedure já barrou), mas por segurança limita.
  return now - STAFF_ORDER_WINDOW_MS;
}
