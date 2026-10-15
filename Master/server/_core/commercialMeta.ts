import { COMMERCIAL_PAGE_META } from "../../shared/commercialPageMeta";

/*
 * Título/descrição/OG por rota do site comercial, aplicado no HTML cru antes de
 * responder. Usado pelos dois sites (legado em vite.ts e futurista em
 * commercialFuturista.ts) — saiu de vite.ts em 2026-10-15 sem mudar a lógica.
 */

/** Imagem de compartilhamento do site legado (o futurista passa a dele). */
export const LEGACY_OG_IMAGE_URL = "https://mmsystem.tech/og-comercial.png";

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
export function injectCommercialPageMeta(html: string, url: string, ogImageUrl: string = LEGACY_OG_IMAGE_URL): string {
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
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${ogImageUrl}$2`)
    .replace(/(<meta name="twitter:image" content=")[^"]*(")/, `$1${ogImageUrl}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${ogUrl}$2`);
}
