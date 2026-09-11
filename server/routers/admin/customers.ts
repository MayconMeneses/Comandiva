import { TRPCError } from "@trpc/server";
import { desc, sql } from "drizzle-orm";
import { z } from "zod";
import { customers } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { restaurantProcedureFor, router } from "../../_core/trpc";

export const adminCustomersRouter = router({
  // `total` é a contagem real de clientes cadastrados, não o tamanho da
  // lista retornada (que fica limitada a `limit`) — a tela usa isso pra
  // mostrar a quantidade de verdade no cabeçalho, mesmo quando há mais
  // clientes do que o limite da página carregada.
  customers: restaurantProcedureFor("customers").input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    const [rows, [totalRow]] = await Promise.all([
      db.select().from(customers).orderBy(desc(customers.updatedAt)).limit(input?.limit ?? 50),
      db.select({ count: sql<number>`count(*)` }).from(customers),
    ]);
    return { rows, total: totalRow?.count ?? 0 };
  }),
});
