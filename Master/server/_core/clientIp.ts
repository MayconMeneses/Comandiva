import type { Request } from "express";

/** IP de quem fez a requisição — nunca vazio, pra auditoria e limites sempre terem uma chave (atrás do proxy precisa de TRUST_PROXY=true). */
export function getClientIp(req: Pick<Request, "ip"> & { socket?: { remoteAddress?: string } }): string {
  return req.ip || req.socket?.remoteAddress || "desconhecido";
}
