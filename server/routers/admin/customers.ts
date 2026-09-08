import { TRPCError } from "@trpc/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { customers } from "../../../drizzle/schema";
import { getDb } from "../../db";
import { restaurantProcedureFor, router } from "../../_core/trpc";

export const adminCustomersRouter = router({
  customers: restaurantProcedureFor("customers").input(z.object({ limit: z.number().int().min(1).max(100).default(50) }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
    return db.select().from(customers).orderBy(desc(customers.updatedAt)).limit(input?.limit ?? 50);
  }),
});
