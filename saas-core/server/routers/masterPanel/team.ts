import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { GRANTABLE_MASTER_AREAS } from "../../_core/permissions";
import { createPlatformAdmin, getPlatformAdminById, listPlatformAdmins, setPlatformAdminActive, updatePlatformAdmin } from "../../db/platformAdmins";
import { recordPlatformAuditLog } from "../../db/auditLog";
import { platformAdminProcedureFor, router } from "../../_core/trpc";

const permissionsSchema = z.array(z.enum(GRANTABLE_MASTER_AREAS)).optional();
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
