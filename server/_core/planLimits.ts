import { TRPCError } from "@trpc/server";
import { getDb, type DbOrTx } from "../db/client";
import { getLocalUsageCounts, lockLicenseSingletonRow } from "../db/license";
import { getLicenseSnapshot, getLicenseUsage } from "./license";

const RESOURCE_LABELS: Record<string, string> = { users: "contas de equipe", tables: "mesas" };

function limitError(planName: string, resourceKey: "users" | "tables", limit: number, current: number) {
  return new TRPCError({
    code: "FORBIDDEN",
    message: `Seu plano atual (${planName}) permite até ${limit} ${RESOURCE_LABELS[resourceKey]}. Você já tem ${current}. Faça upgrade em "Meu plano" para adicionar mais, ou desative algum(a) existente antes.`,
  });
}

/**
 * Bloqueia CRIAR mais um recurso quando o plano atual já está no limite —
 * nunca apaga nem desativa nada existente (um downgrade pode deixar o
 * restaurante acima do limite; ele continua com tudo que já tinha, só não
 * cria mais até fazer upgrade ou reduzir por conta própria).
 *
 * Sozinha, tem uma corrida check-then-act benigna sob concorrência genuína
 * (duas requisições simultâneas no limite-1 podem ambas passar aqui) — pra
 * telas que só precisam de uma checagem informativa antes de mostrar um erro
 * amigável, isso é aceitável. Pra CRIAR de verdade, use
 * `assertWithinPlanLimitAndInsert` abaixo, que fecha essa corrida.
 */
export async function assertWithinPlanLimit(resourceKey: "users" | "tables") {
  const [snapshot, usage] = await Promise.all([getLicenseSnapshot(), getLicenseUsage()]);
  const limit = snapshot.limits[resourceKey];
  if (limit == null) return; // sem limite configurado pro plano atual = ilimitado
  const current = usage[resourceKey as keyof typeof usage] ?? 0;
  if (current >= limit) throw limitError(snapshot.planName, resourceKey, limit, current);
}

/**
 * Versão sem corrida de `assertWithinPlanLimit`: checagem + inserção rodam
 * dentro da MESMA transação, serializadas por `lockLicenseSingletonRow` (ver
 * auditoria V-24). Duas chamadas concorrentes pro mesmo restaurante agora
 * disputam o lock sequencialmente — a segunda só recontа depois que a
 * primeira já commitou (ou não), então nunca as duas passam com o mesmo
 * "current" desatualizado.
 */
export async function assertWithinPlanLimitAndInsert<T>(resourceKey: "users" | "tables", insert: (tx?: DbOrTx) => Promise<T>): Promise<T> {
  const snapshot = await getLicenseSnapshot();
  const limit = snapshot.limits[resourceKey];
  if (limit == null) return insert(); // sem limite configurado pro plano atual = ilimitado, não precisa nem abrir transação

  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  return db.transaction(async tx => {
    await lockLicenseSingletonRow(tx);
    const usage = await getLocalUsageCounts(tx);
    const current = usage[resourceKey] ?? 0;
    if (current >= limit) throw limitError(snapshot.planName, resourceKey, limit, current);
    return insert(tx);
  });
}
