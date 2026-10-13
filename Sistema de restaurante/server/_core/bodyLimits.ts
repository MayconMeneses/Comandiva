import express, { type Express, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { SUPPORT_COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { sdk } from "./sdk";
import { verifySupportSessionToken } from "./supportSession";

/**
 * Limite do corpo das requisições (auditoria de segurança 2026-10-10).
 *
 * Antes, TODA rota — inclusive as públicas e os webhooks, antes de qualquer
 * login — aceitava corpo de até 150 MB lido inteiro em memória (o container
 * tem 768 MB): um anônimo derrubava o app por falta de memória com poucas
 * requisições. Agora o padrão é pequeno, e o limite grande só vale para as
 * mutations de upload de imagem (que mandam a imagem em base64 dentro do JSON),
 * e mesmo assim só para quem já está logado (equipe/admin ou Modo Suporte).
 */
export const DEFAULT_BODY_LIMIT = "1mb";
export const UPLOAD_BODY_LIMIT = "150mb";

// Os uploads são mutations tRPC cujo nome começa com "upload" (uploadLogo,
// uploadProductImage, uploadEventImage...). O tRPC em batch junta vários nomes
// separados por vírgula no caminho, por isso o teste é "algum segmento".
export function isUploadRequest(path: string): boolean {
  if (!path.startsWith("/api/trpc/")) return false;
  return path
    .slice("/api/trpc/".length)
    .split(",")
    .some(segment => /(^|\.)upload[A-Za-z]*$/.test(segment));
}

async function hasSession(req: Request): Promise<boolean> {
  try {
    await sdk.authenticateRequest(req);
    return true;
  } catch {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    return Boolean(await verifySupportSessionToken(cookies[SUPPORT_COOKIE_NAME]));
  }
}

export function registerBodyParsers(app: Express): void {
  const defaultJson = express.json({ limit: DEFAULT_BODY_LIMIT });
  const defaultUrlencoded = express.urlencoded({ limit: DEFAULT_BODY_LIMIT, extended: true });
  const uploadJson = express.json({ limit: UPLOAD_BODY_LIMIT });

  const uploadGate: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    hasSession(req)
      .then(allowed => {
        if (!allowed) {
          res.status(401).json({ error: "Faça login para enviar arquivos." });
          return;
        }
        uploadJson(req, res, next);
      })
      .catch(next);
  };

  app.use((req, res, next) => {
    if (isUploadRequest(req.path)) return uploadGate(req, res, next);
    return defaultJson(req, res, error => (error ? next(error) : defaultUrlencoded(req, res, next)));
  });
}
