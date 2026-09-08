import type { CookieOptions, Request } from "express";

function isSecureRequest(req: Request) {
  // req.protocol já reflete X-Forwarded-Proto quando `trust proxy` está
  // habilitado (TRUST_PROXY=true no .env) — não reler o header manualmente
  // aqui, senão qualquer cliente poderia forjar X-Forwarded-Proto: https
  // numa instalação sem proxy confiável na frente (TRUST_PROXY=false) e
  // enganar o servidor sobre se a conexão é HTTPS de verdade.
  return req.protocol === "https";
}

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const secure = isSecureRequest(req);

  // O front e a API sempre são servidos do mesmo domínio nesta instalação
  // (um único container), e X-Frame-Options: DENY já impede que o site seja
  // aberto dentro de um iframe de outro domínio — então não há motivo pra
  // usar SameSite=None (que abriria mão da proteção contra CSRF que o Lax
  // já dá de graça). Lax funciona igual em HTTP local e em HTTPS.
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
  };
}
