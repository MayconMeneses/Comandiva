import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

/**
 * Mesmo raciocínio do server/_core/cookies.ts do app principal: front e API
 * do Painel Master são servidos do mesmo domínio (um container só), então
 * SameSite=Lax já basta — sem abrir mão da proteção contra CSRF com um
 * SameSite=None desnecessário. `COOKIE_SECURE=true` força "Secure" mesmo se o
 * proxy não repassar que a conexão original era https.
 */
export function getPlatformSessionCookieOptions(req: Request): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  return { httpOnly: true, path: "/", sameSite: "lax", secure: ENV.cookieSecure || req.protocol === "https" };
}
