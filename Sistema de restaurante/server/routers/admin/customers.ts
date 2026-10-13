import { TRPCError } from "@trpc/server";
import { desc, sql } from "drizzle-orm";
import { z } from "zod";
import { customers } from "../../../drizzle/schema";
import { getCustomerByPhone, getDb } from "../../db";
import { phoneSchema } from "../customer";
import { restaurantProcedure, restaurantProcedureFor, router } from "../../_core/trpc";

export const adminCustomersRouter = router({
  // Pedido de balcão (equipe logada): preenche nome e endereço do cliente que
  // já pediu antes. É a versão COMPLETA do que customer.lookupByPhone (público)
  // devolve só como primeiro nome. restaurantProcedure (não ...For("customers"))
  // porque o atendente do balcão precisa disso mesmo sem a permissão de ver a
  // lista de clientes — e só consulta um telefone por vez.
  lookupCustomerByPhone: restaurantProcedure.input(z.object({ phone: phoneSchema })).query(async ({ input }) => getCustomerByPhone(input.phone)),
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
