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

/** Cookie separado da sessão — marca o navegador como confiável pro 2FA (ver server/_core/platformSession.ts::createTrustedDeviceToken). Vida bem mais longa de propósito: sobrevive a vários logout/login no mesmo dispositivo. */
export const TRUSTED_DEVICE_COOKIE_NAME = "platform_trusted_device";

export function getTrustedDeviceCookieOptions(req: Request, maxAgeMs: number): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure" | "maxAge"> {
  return { httpOnly: true, path: "/", sameSite: "lax", secure: req.protocol === "https", maxAge: maxAgeMs };
}
