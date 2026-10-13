import type { TrpcContext } from "./context";
import { ENV } from "./env";
import { getPlatformSessionCookieOptions } from "./platformCookies";
import { createPlatformSessionToken } from "./platformSession";

/** Grava o cookie de sessão (JWT de 12h) pra esta conta — usado ao fechar o login e ao trocar o estado do 2FA. */
export async function issueSession(ctx: Pick<TrpcContext, "req" | "res">, adminId: number, email: string) {
  const sessionToken = await createPlatformSessionToken(adminId, email);
  ctx.res.cookie(ENV.platformSessionCookieName, sessionToken, getPlatformSessionCookieOptions(ctx.req));
}
