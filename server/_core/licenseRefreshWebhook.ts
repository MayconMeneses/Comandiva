import type { Express, Request, Response } from "express";
import { checkRateLimit } from "./rateLimit";
import { forceSyncLicense } from "./license";

/**
 * Permite ao Painel Master (saas-core) pedir uma sincronização imediata de
 * plano/features deste restaurante, em vez de esperar o próximo tick do
 * polling (LICENSE_SYNC_INTERVAL_MS, default 5min) — usado pelo botão
 * "Forçar sincronização" na tela do restaurante no Painel Master.
 *
 * Sem autenticação de propósito: o único efeito possível aqui é antecipar
 * exatamente a mesma sincronização que já aconteceria sozinha em minutos —
 * `syncLicenseOnce` sempre busca o estado real via SAAS_CORE_API_KEY já
 * configurada neste deployment, nunca aceita nenhum dado do chamador. Não há
 * bypass de autorização possível, só uma chamada de rede a mais; o rate
 * limit abaixo existe só pra evitar abuso/flood, não pra proteger dado.
 */
async function handleLicenseRefresh(req: Request, res: Response) {
  const limit = checkRateLimit(`license-refresh:${req.ip}`, { maxAttempts: 5, windowMs: 60_000 });
  if (!limit.allowed) {
    res.status(429).json({ ok: false, retryAfterSeconds: limit.retryAfterSeconds });
    return;
  }
  const snapshot = await forceSyncLicense();
  res.status(200).json({ ok: true, lastSyncOk: snapshot.lastSyncOk, syncedAt: snapshot.syncedAt });
}

export function registerLicenseRefreshWebhook(app: Express) {
  app.post("/api/webhooks/license-refresh", (req, res) => {
    void handleLicenseRefresh(req, res);
  });
}
