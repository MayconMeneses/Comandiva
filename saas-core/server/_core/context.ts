import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import type { Restaurant } from "../../drizzle/schema";
import { getRestaurantByApiKeyHash, hashApiKey } from "../db/restaurants";
import { getPlatformAdminById } from "../db/platformAdmins";
import { verifyPlatformSessionToken } from "./platformSession";
import { ENV } from "./env";

type PlatformAdminContext = Awaited<ReturnType<typeof getPlatformAdminById>>;

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  restaurant: Restaurant | null;
  platformAdmin: PlatformAdminContext | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  // Identidade de restaurante sempre resolvida a partir da API key enviada —
  // nunca de um restaurantId que o próprio chamador poderia informar no
  // corpo/query.
  const header = opts.req.headers.authorization;
  const apiKey = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : undefined;
  const restaurant = apiKey ? (await getRestaurantByApiKeyHash(hashApiKey(apiKey))) ?? null : null;

  // Identidade de Super Admin resolvida a partir de um canal totalmente
  // diferente (cookie de sessão, não o header Authorization) — os dois
  // sistemas de autenticação nunca se misturam: uma API key de restaurante
  // nunca preenche platformAdmin, e a sessão do Painel Master nunca preenche
  // restaurant.
  const cookies = parseCookieHeader(opts.req.headers.cookie ?? "");
  const session = await verifyPlatformSessionToken(cookies[ENV.platformSessionCookieName]);
  const platformAdmin = session ? (await getPlatformAdminById(session.adminId)) ?? null : null;

  return { req: opts.req, res: opts.res, restaurant, platformAdmin };
}
