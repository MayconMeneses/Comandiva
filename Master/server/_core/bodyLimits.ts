import express, { type Express } from "express";

/**
 * Limite do corpo das requisições (auditoria de segurança 2026-10-10).
 *
 * Antes TODA rota aceitava 12 MB lidos em memória antes de qualquer
 * validação (o container tem 768 MB — muitas conexões simultâneas derrubavam
 * o serviço). Agora o padrão é pequeno e o limite de 12 MB vale só para o
 * único endpoint que recebe arquivo: o envio de cardápio do cadastro público
 * (até 8 MB de arquivo + ~33% do base64).
 */
export const DEFAULT_BODY_LIMIT = "1mb";
export const MENU_UPLOAD_BODY_LIMIT = "12mb";

export function isMenuUploadRequest(path: string): boolean {
  if (!path.startsWith("/api/trpc/")) return false;
  return path
    .slice("/api/trpc/".length)
    .split(",")
    .some(segment => segment === "public.uploadMenuReference");
}

export function registerBodyParsers(app: Express): void {
  const defaultJson = express.json({ limit: DEFAULT_BODY_LIMIT });
  const menuUploadJson = express.json({ limit: MENU_UPLOAD_BODY_LIMIT });
  app.use((req, res, next) => (isMenuUploadRequest(req.path) ? menuUploadJson : defaultJson)(req, res, next));
}
