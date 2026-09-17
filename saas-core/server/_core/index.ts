import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { sql } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerMercadoPagoBillingWebhook } from "./mercadoPagoWebhook";
import { registerMercadoPagoSignupWebhook } from "./mercadoPagoSignupWebhook";
import { registerMercadoPagoWebhookRoute } from "./mercadoPagoWebhookRoute";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";
import { getDb } from "../db/client";
import { readFileSync } from "fs";
import { join } from "path";

const APP_VERSION = (() => {
  try {
    return (JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as { version?: string }).version ?? "unknown";
  } catch {
    return "unknown";
  }
})();

process.on("uncaughtException", error => {
  console.error("[fatal] uncaughtException:", error);
  process.exit(1);
});

process.on("unhandledRejection", reason => {
  console.error("[fatal] unhandledRejection:", reason);
});

async function startServer() {
  if (!ENV.operatorToken || ENV.operatorToken.length < 32) {
    console.error(
      "[fatal] OPERATOR_TOKEN ausente ou fraco (precisa de pelo menos 32 caracteres). " +
        "Isso permitiria qualquer um criar/alterar restaurantes-cliente. Defina um OPERATOR_TOKEN forte no .env antes de iniciar.",
    );
    process.exit(1);
  }
  if (!ENV.platformJwtSecret || ENV.platformJwtSecret.length < 32) {
    console.error(
      "[fatal] PLATFORM_JWT_SECRET ausente ou fraco (precisa de pelo menos 32 caracteres). " +
        "Isso permitiria falsificar sessões do Painel Master. Defina um PLATFORM_JWT_SECRET forte no .env antes de iniciar.",
    );
    process.exit(1);
  }
  // Diferente dos segredos acima, este é aviso — não trava o boot (a própria
  // documentação em .env.example já chama de "opcional mas recomendada").
  // Risco é mitigado porque o handler do webhook sempre reconsulta a API
  // oficial do Mercado Pago antes de confiar em qualquer coisa; mesmo assim,
  // vale saber que a assinatura não está sendo validada em produção.
  if (ENV.mercadoPagoAccessToken && !ENV.mercadoPagoWebhookSecret) {
    console.warn(
      "[boot] MERCADO_PAGO_ACCESS_TOKEN configurado mas MERCADO_PAGO_WEBHOOK_SECRET está em branco — " +
        "notificações de cobrança não têm verificação de assinatura. Configure em Central de vendedores → Webhooks.",
    );
  }

  const app = express();
  const server = createServer(app);
  if (ENV.trustProxy) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    next();
  });
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
  // Readiness real: confirma que o banco responde antes de dizer "pronto"
  // (diferente do /healthz, que é deliberadamente cego a isso). Timeout curto
  // pra não deixar o healthcheck do Docker travado esperando uma conexão presa.
  app.get("/readyz", async (_req, res) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("Banco de dados não conectado");
      await Promise.race([
        db.execute(sql`SELECT 1`),
        new Promise((_resolve, reject) => setTimeout(() => reject(new Error("Timeout ao consultar o banco")), 2000)),
      ]);
      res.status(200).json({ ok: true });
    } catch (error) {
      console.warn("[readyz] Banco de dados indisponível:", error);
      res.status(503).json({ ok: false });
    }
  });
  app.get("/version", (_req, res) => res.status(200).json({ version: APP_VERSION, commit: process.env.GIT_COMMIT ?? "unknown" }));
  // 12mb — cobre o base64 de até 8MB de arquivo (public.uploadMenuReference,
  // ver server/routers/public.ts) mais a folga de ~33% que o base64 adiciona.
  app.use(express.json({ limit: "12mb" }));
  // Cobrança da mensalidade do SaaS (restaurante-cliente pagando a
  // plataforma) — rota HTTP simples, fora do tRPC, porque quem chama é o
  // Mercado Pago. /api/webhooks/mercadopago é a rota ÚNICA que deve ser
  // cadastrada no painel da MP (só aceita uma URL por app/ambiente) — ela
  // despacha internamente pros dois handlers abaixo pelo `type` do evento.
  // As duas rotas antigas continuam registradas por retrocompatibilidade,
  // mas nenhuma cobre o app inteiro sozinha.
  registerMercadoPagoWebhookRoute(app);
  registerMercadoPagoBillingWebhook(app);
  registerMercadoPagoSignupWebhook(app);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 4000;
  server.listen(port, () => console.log(`saas-core rodando em http://localhost:${port}/`));
}

startServer().catch(console.error);
