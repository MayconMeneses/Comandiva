import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { GRANTABLE_MASTER_AREAS, type MasterPermissionArea } from "../../_core/permissions";
import { createPlatformAdmin, getPlatformAdminById, listPlatformAdmins, setPlatformAdminActive, updatePlatformAdmin } from "../../db/platformAdmins";
import { recordPlatformAuditLog } from "../../db/auditLog";
import { platformAdminProcedureFor, router } from "../../_core/trpc";

const permissionsSchema = z.array(z.enum(GRANTABLE_MASTER_AREAS)).optional();
// Escalação de privilégio (auditoria 2026-10-10): quem não é "owner" só pode
// conceder áreas que ELE MESMO tem — senão um "member" com só a área "equipe"
// dava a si mesmo (ou a um amigo) billing, modo_suporte, restaurantes etc.
function assertCanGrantAreas(actor: { role: string; permissions: MasterPermissionArea[] }, areas: MasterPermissionArea[] | undefined) {
  if (actor.role === "owner" || !areas?.length) return;
  const notOwned = areas.filter(area => !actor.permissions.includes(area));
  if (notOwned.length) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode conceder áreas que a sua própria conta já tem." });
  }
}

// Escalação lateral entre "members" (auditoria): quem não é owner só mexe
// (senha, nome, permissões, pausar/reativar) em conta cujas permissões sejam
// um SUBCONJUNTO das suas. Sem isso, um member com a área "equipe" trocava a
// senha de outro member com mais áreas e assumia o acesso dele. Owner pode tudo.
function assertCanManageTarget(actor: { role: string; permissions: MasterPermissionArea[] }, target: { permissions: MasterPermissionArea[] }) {
  if (actor.role === "owner") return;
  if (!target.permissions.every(area => actor.permissions.includes(area))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode alterar contas cujas permissões sejam um subconjunto das suas." });
  }
}

const passwordSchema = z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(128);

// Área "equipe" — gerenciar quem mais entra no Painel Master é tão sensível
// quanto gerenciar acessos administrativos no app principal (adminOnlyProcedure
// lá); aqui o equivalente é platformAdminProcedureFor("equipe").
export const masterPanelTeamRouter = router({
  list: platformAdminProcedureFor("equipe").query(() => listPlatformAdmins()),

  create: platformAdminProcedureFor("equipe")
    .input(
      z.object({
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().email(),
        password: passwordSchema,
        role: z.enum(["owner", "member"]),
        permissions: permissionsSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Escalação de privilégio: só quem já é "owner" pode criar outra conta
      // "owner" (acesso total irrestrito) — um "member" com a área "equipe"
      // liberada só pode criar/gerenciar outras contas "member".
      if (input.role === "owner" && ctx.platformAdmin.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Só uma conta owner pode criar outra conta owner." });
      }
      assertCanGrantAreas(ctx.platformAdmin, input.permissions);
      const result = await createPlatformAdmin(input);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "team.admin_created",
        entityType: "platform_admin",
        entityId: result.id,
        after: { email: input.email, role: input.role, permissions: input.role === "member" ? input.permissions ?? [] : undefined },
        ip: ctx.req.ip,
      });
      return result;
    }),

  update: platformAdminProcedureFor("equipe")
    .input(z.object({ adminId: z.number().int().positive(), name: z.string().trim().min(2).max(160), password: passwordSchema.optional(), permissions: permissionsSchema }))
    .mutation(async ({ input, ctx }) => {
      const before = await getPlatformAdminById(input.adminId);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Conta não encontrada." });
      // Mesma regra de create: só uma conta "owner" pode alterar outra conta
      // "owner" (nome/senha) — senão um "member" com a área "equipe" liberada
      // conseguiria trocar a senha do dono real da plataforma.
      if (before.role === "owner" && ctx.platformAdmin.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Só uma conta owner pode alterar outra conta owner." });
      }
      assertCanManageTarget(ctx.platformAdmin, before);
      // Um "member" também não edita as PRÓPRIAS permissões (nome/senha continuam livres).
      if (ctx.platformAdmin.role !== "owner" && input.adminId === ctx.platformAdmin.id && input.permissions !== undefined) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Só uma conta owner pode alterar as próprias permissões." });
      }
      assertCanGrantAreas(ctx.platformAdmin, input.permissions);
      await updatePlatformAdmin(input.adminId, { name: input.name, password: input.password, permissions: before.role === "member" ? input.permissions : undefined });
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: "team.admin_updated",
        entityType: "platform_admin",
        entityId: input.adminId,
        before: { name: before.name, permissions: before.permissions },
        after: { name: input.name, permissions: before.role === "member" ? input.permissions ?? [] : undefined },
        ip: ctx.req.ip,
      });
      return { success: true };
    }),

  setActive: platformAdminProcedureFor("equipe")
    .input(z.object({ adminId: z.number().int().positive(), active: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      if (input.adminId === ctx.platformAdmin.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Você não pode pausar sua própria conta." });
      const before = await getPlatformAdminById(input.adminId);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Conta não encontrada." });
      // Mesma regra de create/update: um "member" não pode pausar/reativar
      // uma conta "owner" — senão vira vetor de lockout do dono real.
      if (before.role === "owner" && ctx.platformAdmin.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Só uma conta owner pode pausar ou reativar outra conta owner." });
      }
      assertCanManageTarget(ctx.platformAdmin, before);
      await setPlatformAdminActive(input.adminId, input.active);
      await recordPlatformAuditLog({
        actorAdminId: ctx.platformAdmin.id,
        actorLabel: ctx.platformAdmin.email,
        action: input.active ? "team.admin_reactivated" : "team.admin_paused",
        entityType: "platform_admin",
        entityId: input.adminId,
        ip: ctx.req.ip,
      });
      return { success: true };
    }),
});
