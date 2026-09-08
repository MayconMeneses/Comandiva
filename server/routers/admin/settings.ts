import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { restaurantSettings } from "../../../drizzle/schema";
import { sendOwnerAlert } from "../../_core/alerts";
import { getDb, getStoreSettings } from "../../db";
import { adminOnlyProcedure, adminProcedure, router } from "../../_core/trpc";
import { storagePut } from "../../storage";

export const adminSettingsRouter = router({
  // Só o essencial pra tela de Conta (Pix) — admin.dashboard (reports, e
  // acessível em Modo Suporte) NÃO pode incluir pixKey/pixQrCodeUrl, mesmo
  // raciocínio de credencial sensível já aplicado a paymentGateways.ts/team.ts.
  getAccountSettings: adminOnlyProcedure.query(async () => {
    const settings = await getStoreSettings();
    if (!settings) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Configurações indisponíveis" });
    return settings;
  }),
  sendTestAlert: adminProcedure.mutation(async () => {
    await sendOwnerAlert("Teste de notificação", "Se você recebeu esta mensagem, os alertas do MM System Creator estão funcionando corretamente.", "test");
    return { success: true };
  }),
  updateSettings: adminProcedure.input(z.object({ isAcceptingOrders: z.boolean(), deliveryFeeCents: z.number().int().min(0).max(999999), minimumOrderCents: z.number().int().min(0).max(9999999), estimatedDeliveryMin: z.number().int().min(1).max(240), estimatedDeliveryMax: z.number().int().min(1).max(360), openingHours: z.string().min(2).max(255), logoUrl: z.string().url().or(z.string().startsWith("/")).or(z.literal("")).optional(), pixKey: z.string().max(255).optional(), pixQrCodeUrl: z.string().url().or(z.string().startsWith("/")).or(z.literal("")).optional(), lunchStartTime: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(), lunchEndTime: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(), dinnerStartTime: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(), dinnerEndTime: z.string().regex(/^\d{2}:\d{2}$/).or(z.literal("")).optional(), promotionCategoryImageUrl: z.string().url().or(z.string().startsWith("/")).or(z.literal("")).optional(), address: z.string().max(2000).optional(), phone: z.string().max(24).optional(), aboutText: z.string().max(5000).optional() }).superRefine((value, context) => {
    if (value.estimatedDeliveryMin > value.estimatedDeliveryMax) context.addIssue({ code: "custom", path: ["estimatedDeliveryMin"], message: "O tempo mínimo deve ser menor ou igual ao máximo." });
  })).mutation(async ({ input, ctx }) => {
    // Chave Pix fica de fora do Modo Suporte mesmo com escrita liberada no
    // resto (mesma categoria de credenciais de pagamento em paymentGateways.ts)
    // — updateSettings mistura campos sensíveis e não-sensíveis num único
    // endpoint, então a guarda é por campo, não pelo procedure inteiro.
    if (!ctx.user && (input.pixKey !== undefined || input.pixQrCodeUrl !== undefined)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "A chave Pix não pode ser alterada em Modo Suporte." });
    }
    const db = await getDb();
    const settings = await getStoreSettings();
    if (!db || !settings) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Configurações indisponíveis" });
    const { logoUrl, pixKey, pixQrCodeUrl, lunchStartTime, lunchEndTime, dinnerStartTime, dinnerEndTime, promotionCategoryImageUrl, address, phone, aboutText, ...rest } = input;
    const pixUpdates: Record<string, unknown> = {};
    if (pixKey !== undefined) pixUpdates.pixKey = pixKey ? pixKey : null;
    if (pixQrCodeUrl !== undefined) pixUpdates.pixQrCodeUrl = pixQrCodeUrl ? pixQrCodeUrl : null;
    if (lunchStartTime !== undefined) pixUpdates.lunchStartTime = lunchStartTime ? lunchStartTime : null;
    if (lunchEndTime !== undefined) pixUpdates.lunchEndTime = lunchEndTime ? lunchEndTime : null;
    if (dinnerStartTime !== undefined) pixUpdates.dinnerStartTime = dinnerStartTime ? dinnerStartTime : null;
    if (dinnerEndTime !== undefined) pixUpdates.dinnerEndTime = dinnerEndTime ? dinnerEndTime : null;
    if (promotionCategoryImageUrl !== undefined) pixUpdates.promotionCategoryImageUrl = promotionCategoryImageUrl ? promotionCategoryImageUrl : null;
    if (address !== undefined) pixUpdates.address = address ? address : null;
    if (phone !== undefined) pixUpdates.phone = phone ? phone : null;
    if (aboutText !== undefined) pixUpdates.aboutText = aboutText ? aboutText : null;
    await db.update(restaurantSettings).set({ ...rest, logoUrl: logoUrl ? logoUrl : null, ...pixUpdates, updatedAt: Date.now() }).where(eq(restaurantSettings.id, settings.id));
    return { success: true };
  }),
  uploadLogo: adminProcedure.input(z.object({ filename: z.string().min(1).max(160), contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]), dataBase64: z.string().min(8).max(70_000_000) })).mutation(async ({ input }) => {
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 45_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Envie uma imagem de até 45 MB." });
    const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const stored = await storagePut(`branding/logo/${Date.now()}-${safeFilename}`, bytes, input.contentType);
    return { url: stored.url };
  }),
  uploadPixQr: adminOnlyProcedure.input(z.object({ filename: z.string().min(1).max(160), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]), dataBase64: z.string().min(8).max(70_000_000) })).mutation(async ({ input }) => {
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 45_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Envie uma imagem de até 45 MB." });
    const safeFilename = input.filename.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
    const stored = await storagePut(`branding/pix/${Date.now()}-${safeFilename}`, bytes, input.contentType);
    return { url: stored.url };
  }),
});
