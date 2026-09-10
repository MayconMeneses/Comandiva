import type { Express } from "express";

/**
 * `req.ip`/`req.secure` só refletem `X-Forwarded-For`/`X-Forwarded-Proto` de
 * verdade quando o Express está configurado pra confiar num proxy na frente
 * — sem isso, QUALQUER cliente pode forjar esses headers e se passar por
 * outro IP (furando rate limit por IP) ou por HTTPS. `trustProxy` só deve
 * ser `true` atrás de um reverse proxy de fato confiável (ver
 * docs/production-deploy.md, Etapa 6) — nunca em HTTP direto sem proxy
 * nenhum, senão vira o problema oposto (spoofing). Extraído do arquivo de
 * boot do servidor (server/_core/index.ts) pra dar pra testar essa decisão
 * isoladamente sem disparar `startServer()` inteiro (ver auditoria V-26 —
 * nenhum teste do projeto subia o Express de verdade, então essa resolução
 * nunca era exercitada).
 */
export function configureTrustProxy(app: Express, trustProxy: boolean): void {
  if (trustProxy) app.set("trust proxy", 1);
}
