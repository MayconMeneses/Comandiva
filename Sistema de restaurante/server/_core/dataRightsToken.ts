import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env";

// Prova de posse do telefone (autoatendimento LGPD) — curto (15min), só pra
// cobrir a sessão de uma página (o cliente confirma o código e já usa a
// tela); nunca vira cookie/sessão persistente. Reaproveita JWT_SECRET (já
// validado no boot com mínimo de 32 caracteres, server/_core/index.ts) em
// vez de criar mais um segredo obrigatório pra um recurso opcional.
const TOKEN_TTL_MS = 15 * 60 * 1000;

function getSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function createDataRightsToken(phone: string): Promise<string> {
  return new SignJWT({ phone, purpose: "data_rights" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor((Date.now() + TOKEN_TTL_MS) / 1000))
    .sign(getSecret());
}

export async function verifyDataRightsToken(token: string, expectedPhone: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return payload.purpose === "data_rights" && payload.phone === expectedPhone;
  } catch {
    return false;
  }
}
