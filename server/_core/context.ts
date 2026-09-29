import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { SUPPORT_COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { verifySupportSessionToken, type SupportSessionPayload } from "./supportSession";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  // Canal totalmente separado de `user` acima — nunca populado a partir da
  // mesma sessão (mesmo espírito de restaurant/platformAdmin nunca se
  // misturarem no context.ts do saas-core). Ver server/routers/support.ts.
  supportSession: SupportSessionPayload | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  const cookies = parseCookieHeader(opts.req.headers.cookie ?? "");
  const supportSession = await verifySupportSessionToken(cookies[SUPPORT_COOKIE_NAME]);

  return {
    req: opts.req,
    res: opts.res,
    user,
    supportSession,
  };
}
