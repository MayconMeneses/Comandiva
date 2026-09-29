import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { COMMERCIAL_PAGE_META } from "../../shared/commercialPageMeta";

function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Substitui título/descrição/OG/Twitter direto no HTML antes de responder,
 * pras rotas listadas em shared/commercialPageMeta.ts — sem isso, um
 * crawler que não executa JavaScript de verdade (o preview de link do
 * WhatsApp/Instagram/LinkedIn, por exemplo) sempre via o texto genérico do
 * Painel Master, mesmo pra um link do site comercial. `usePageMeta.ts`
 * (client) já corrige isso pra quem executa JS; isto aqui é o mesmo
 * conteúdo, aplicado no HTML cru.
 */
function injectCommercialPageMeta(html: string, url: string): string {
  const requestPath = url.split("?")[0]?.split("#")[0] ?? url;
  const meta = COMMERCIAL_PAGE_META[requestPath];
  if (!meta) return html;
  const title = escapeHtmlAttr(meta.title);
  const description = escapeHtmlAttr(meta.description);
  const ogUrl = `https://mmsystem.tech${requestPath}`;
  return html
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${ogUrl}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`);
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
      const page = injectCommercialPageMeta(await vite.transformIndexHtml(url, template), url);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
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
  app.use(express.static(distPath));

  // Não usa res.sendFile aqui de propósito — precisa ler o conteúdo pra
  // poder injetar o meta por rota (ver injectCommercialPageMeta acima)
  // antes de responder. O HTML de entrada da SPA nunca deve ser cacheado
  // de qualquer forma (referencia os assets com hash do build atual).
  app.use("*", async (req, res, next) => {
    try {
      const template = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf-8");
      res.status(200).set({ "Content-Type": "text/html" }).end(injectCommercialPageMeta(template, req.originalUrl));
    } catch (e) {
      next(e);
    }
  });
}
