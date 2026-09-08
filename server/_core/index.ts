import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sendOwnerAlert } from "./alerts";
import { registerMercadoPagoWebhook } from "./mercadoPagoWebhook";
import { ENV } from "./env";

process.on("uncaughtException", error => {
  console.error("[fatal] uncaughtException:", error);
  void sendOwnerAlert("Erro grave no servidor", `O servidor encontrou um erro não tratado e pode reiniciar:\n\n${error.stack ?? error.message}`, "uncaughtException").finally(() => {
    process.exit(1);
  });
});

process.on("unhandledRejection", reason => {
  console.error("[fatal] unhandledRejection:", reason);
  void sendOwnerAlert("Erro grave no servidor", `Uma operação falhou sem tratamento:\n\n${String(reason)}`, "unhandledRejection");
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) {
    console.error(
      "[fatal] JWT_SECRET ausente ou fraco (precisa de pelo menos 32 caracteres). " +
      "Isso permitiria falsificar sessões de administrador. Defina um JWT_SECRET forte no .env antes de iniciar.",
    );
    process.exit(1);
  }

  const app = express();
  const server = createServer(app);
  if (ENV.trustProxy) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  // Cabeçalhos básicos de segurança (sem depender de pacote externo)
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    // Só envia HSTS quando a requisição já chegou como HTTPS (direto ou via
    // reverse proxy com TRUST_PROXY=true) — nunca em HTTP puro/local.
    if (req.secure) {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }
    next();
  });
  // Healthcheck simples para Docker/monitoramento — sem autenticação, sem tocar no banco.
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "150mb" }));
  app.use(express.urlencoded({ limit: "150mb", extended: true }));
  // Webhook do Mercado Pago (confirmação automática de pagamento online) —
  // rota HTTP simples, fora do tRPC, porque quem chama é o Mercado Pago.
  registerMercadoPagoWebhook(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
