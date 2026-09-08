import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { registerMercadoPagoBillingWebhook } from "./mercadoPagoWebhook";
import { serveStatic, setupVite } from "./vite";
import { ENV } from "./env";

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
  app.use(express.json({ limit: "1mb" }));
  // Cobrança da mensalidade do SaaS (restaurante-cliente pagando a
  // plataforma) — rota HTTP simples, fora do tRPC, porque quem chama é o
  // Mercado Pago.
  registerMercadoPagoBillingWebhook(app);
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
