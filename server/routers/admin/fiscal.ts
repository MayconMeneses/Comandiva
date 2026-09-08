import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { fiscalEnvironmentValues, regimeTributarioValues } from "../../../drizzle/schema";
import { isValidCnpjChecksum } from "../../../shared/fiscal";
import {
  assignProductFiscalCategory,
  countProductsWithoutFiscalCategory,
  deactivateFiscalTaxCategory,
  getFiscalSettings,
  listFiscalTaxCategories,
  saveFiscalCadastralData,
  saveFiscalCertificate,
  saveFiscalCscToken,
  saveFiscalTaxCategory,
} from "../../db";
import { adminOnlyProcedure, router } from "../../_core/trpc";
import { optionalId } from "./shared";

const cnpjSchema = z.string().transform(value => value.replace(/\D/g, "")).refine(isValidCnpjChecksum, "CNPJ inválido — confira os números digitados.");

// adminOnlyProcedure (não adminProcedure/restaurantProcedureFor) de propósito
// — CNPJ, regime tributário e o certificado digital ficam fora do Modo
// Suporte e de qualquer permissão de staff, mesmo raciocínio de
// paymentGateways.ts: assumir a identidade fiscal do restaurante é tão
// sensível quanto assumir o Pix dele.
export const adminFiscalRouter = router({
  fiscalSettings: adminOnlyProcedure.query(() => getFiscalSettings()),

  saveFiscalCadastral: adminOnlyProcedure
    .input(
      z.object({
        cnpj: cnpjSchema,
        inscricaoEstadual: z.string().trim().min(1).max(20),
        regimeTributario: z.enum(regimeTributarioValues),
        environment: z.enum(fiscalEnvironmentValues),
        nfceSeries: z.number().int().min(1).max(999),
        nfceNextNumber: z.number().int().min(1).max(999999999),
      }),
    )
    .mutation(async ({ input }) => {
      await saveFiscalCadastralData(input);
      return { success: true };
    }),

  uploadFiscalCertificate: adminOnlyProcedure
    .input(z.object({ filename: z.string().min(1).max(255), dataBase64: z.string().min(8), password: z.string().min(1).max(255) }))
    .mutation(async ({ input }) => {
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 20_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Isso não parece um certificado .pfx/.p12 válido (arquivo grande ou vazio demais)." });
      try {
        await saveFiscalCertificate({ base64: input.dataBase64, filename: input.filename, password: input.password });
      } catch (error) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Falha ao salvar o certificado." });
      }
      return { success: true };
    }),

  saveFiscalCscToken: adminOnlyProcedure.input(z.object({ cscId: z.string().trim().min(1).max(40), token: z.string().trim().min(1).max(255) })).mutation(async ({ input }) => {
    try {
      await saveFiscalCscToken(input);
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Falha ao salvar o token CSC." });
    }
    return { success: true };
  }),

  // Categorias fiscais (CST/CSOSN/alíquota por grupo de produtos) — estrutura
  // pronta pra receber os números reais do contador, sem calcular/inventar
  // nada aqui. Ver drizzle/schema.ts::fiscalTaxCategories.
  fiscalTaxCategories: adminOnlyProcedure.query(async () => ({
    categories: await listFiscalTaxCategories(),
    productsWithoutCategory: await countProductsWithoutFiscalCategory(),
  })),

  saveFiscalTaxCategory: adminOnlyProcedure
    .input(
      z.object({
        id: optionalId,
        name: z.string().trim().min(2).max(120),
        notes: z.string().trim().max(500).optional(),
        csosn: z.string().trim().max(3).optional(),
        cst: z.string().trim().max(2).optional(),
        // Alíquota em pontos-base (1800 = 18,00%) — nunca float, mesmo padrão de preço em centavos.
        icmsRateBasisPoints: z.number().int().min(0).max(10000).optional(),
        pisRateBasisPoints: z.number().int().min(0).max(10000).optional(),
        cofinsRateBasisPoints: z.number().int().min(0).max(10000).optional(),
        cfop: z.string().trim().max(4).optional(),
        active: z.boolean().default(true),
      }),
    )
    .mutation(({ input }) => saveFiscalTaxCategory(input)),

  deactivateFiscalTaxCategory: adminOnlyProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deactivateFiscalTaxCategory(input.id)),

  assignProductFiscalCategory: adminOnlyProcedure.input(z.object({ productId: z.number().int().positive(), fiscalCategoryId: z.number().int().positive().nullable() })).mutation(({ input }) => assignProductFiscalCategory(input.productId, input.fiscalCategoryId)),
});
