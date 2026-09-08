import type { CookieOptions, Request } from "express";

/**
 * Mesmo raciocínio do server/_core/cookies.ts do app principal: front e API
 * do Painel Master são servidos do mesmo domínio (um container só), então
 * SameSite=Lax já basta — sem abrir mão da proteção contra CSRF com um
 * SameSite=None desnecessário.
 */
export function getPlatformSessionCookieOptions(req: Request): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  return { httpOnly: true, path: "/", sameSite: "lax", secure: req.protocol === "https" };
}
