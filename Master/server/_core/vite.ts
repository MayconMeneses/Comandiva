import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { injectCommercialPageMeta, injectRootCanonical } from "./commercialMeta";
import { resolveSpaStatus } from "../../shared/commercialRoutes";

/**
 * Preload do hero da Home (/comercial) — medido via trace de performance
 * (2026-09-30): sem isso, o LCP fica em ~4,9s porque o navegador só
 * "descobre" a <img> depois que o bundle JS inteiro baixa e o React
 * renderiza (LCPDiscovery insight: "Request discoverable in initial
 * document: FAILED"). Com o preload no HTML cru, o download começa em
 * paralelo ao JS, sem esperar hidratação — mesma imagem/srcset/sizes já
 * usados no <img> real de Home.tsx, pra o navegador reaproveitar o
 * download em vez de baixar duas vezes.
 */
function injectHeroPreload(html: string, url: string): string {
  const requestPath = url.split("?")[0]?.split("#")[0] ?? url;
  if (requestPath !== "/comercial") return html;
  const preload =
    '<link rel="preload" as="image" href="/assets/hero/hero-banner-1600.jpg" imagesrcset="/assets/hero/hero-banner-640.jpg 640w, /assets/hero/hero-banner-1200.jpg 1200w, /assets/hero/hero-banner-1600.jpg 1600w" imagesizes="100vw" fetchpriority="high" />\n  </head>';
  return html.replace("</head>", preload);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(import.meta.dirname, "../..", "client", "index.html");
      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      const page = injectHeroPreload(injectCommercialPageMeta(await vite.transformIndexHtml(url, template), url), url);
      res.status(resolveSpaStatus(url)).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = process.env.NODE_ENV === "development" ? path.resolve(import.meta.dirname, "../..", "dist", "public") : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(`Could not find the build directory: ${distPath}, make sure to build the client first`);
  }

  app.use("/assets", express.static(path.join(distPath, "assets"), { maxAge: "1y", immutable: true }));
  // index:false — o HTML da raiz (/) também sai pela rota abaixo, senão o static
  // entregaria o index.html sem a canônica/meta injetadas.
  app.use(express.static(distPath, { index: false }));

  // Não usa res.sendFile aqui de propósito — precisa ler o conteúdo pra
  // poder injetar o meta por rota (ver injectCommercialPageMeta em commercialMeta.ts)
  // antes de responder. O HTML de entrada da SPA nunca deve ser cacheado
  // de qualquer forma (referencia os assets com hash do build atual).
  app.use("*", async (req, res, next) => {
    try {
      const template = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf-8");
      res.status(resolveSpaStatus(req.originalUrl)).set({ "Content-Type": "text/html" }).end(injectHeroPreload(injectRootCanonical(injectCommercialPageMeta(template, req.originalUrl), req.originalUrl), req.originalUrl));
    } catch (e) {
      next(e);
    }
  });
}
