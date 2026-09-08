import { TRPCError } from "@trpc/server";
import { getLicenseSnapshot, getLicenseUsage } from "./license";

const RESOURCE_LABELS: Record<string, string> = { users: "contas de equipe", tables: "mesas" };

/**
 * Bloqueia CRIAR mais um recurso quando o plano atual já está no limite —
 * nunca apaga nem desativa nada existente (um downgrade pode deixar o
 * restaurante acima do limite; ele continua com tudo que já tinha, só não
 * cria mais até fazer upgrade ou reduzir por conta própria).
 */
export async function assertWithinPlanLimit(resourceKey: "users" | "tables") {
  const [snapshot, usage] = await Promise.all([getLicenseSnapshot(), getLicenseUsage()]);
  const limit = snapshot.limits[resourceKey];
  if (limit == null) return; // sem limite configurado pro plano atual = ilimitado
  const current = usage[resourceKey as keyof typeof usage] ?? 0;
  if (current >= limit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Seu plano atual (${snapshot.planName}) permite até ${limit} ${RESOURCE_LABELS[resourceKey]}. Você já tem ${current}. Faça upgrade em "Meu plano" para adicionar mais, ou desative algum(a) existente antes.`,
    });
  }
}
