import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { resolveSpaStatus } from "../../shared/commercialRoutes";
import { injectCommercialPageMeta } from "./commercialMeta";

/**
 * Site comercial "futurista" (projeto irmão `Site comercial futurista`):
 * um app separado, já compilado, servido em /comercial quando
 * COMMERCIAL_SITE=futurista no .env. Com `legado` (padrão), nada disto é
 * registrado e o site antigo (client/src/site-comercial) continua igual.
 *
 * - Pasta: client/comercial-futurista (cópia do `dist` do futurista feita por
 *   scripts/sync-site-comercial.mjs; vai junto no deploy, como o legado).
 * - Mesmas regras do legado: 200/404 por shared/commercialRoutes.ts e
 *   título/OG por rota (commercialMeta.ts), com a imagem de compartilhamento nova.
 * - CSS/JS do futurista ficam em /comercial/assets — não colidem com os do
 *   Painel Master (/assets).
 */
export const FUTURISTA_DIR = path.resolve(process.cwd(), "client", "comercial-futurista");
export const FUTURISTA_OG_IMAGE_URL = "https://mmsystem.tech/comercial/og-comandiva.png";

export function registerCommercialFuturista(app: Express, dir: string = FUTURISTA_DIR): boolean {
  const indexPath = path.join(dir, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error(`[comercial] COMMERCIAL_SITE=futurista, mas ${indexPath} não existe — servindo o site legado.`);
    return false;
  }

  // Arquivos com hash no nome: cache longo. index:false/redirect:false — o HTML
  // sai sempre pela rota abaixo (status + meta por rota), nunca pelo static.
  app.use("/comercial/assets", express.static(path.join(dir, "assets"), { maxAge: "1y", immutable: true, index: false, redirect: false }));
  app.use("/comercial", express.static(dir, { index: false, redirect: false }));

  app.get(["/comercial", "/comercial/*"], async (req, res, next) => {
    try {
      const template = await fs.promises.readFile(indexPath, "utf-8");
      res
        .status(resolveSpaStatus(req.originalUrl))
        .set({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" })
        .end(injectCommercialPageMeta(template, req.originalUrl, FUTURISTA_OG_IMAGE_URL));
    } catch (e) {
      next(e);
    }
  });

  console.log("[comercial] Servindo o site comercial futurista em /comercial.");
  return true;
}
