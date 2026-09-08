import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { PWA_BRANDING } from "./pwa.config";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Precacheia o app shell (JS/CSS/HTML já com hash do Vite) só —
      // fotos de produto (.jpg) ficam de fora de propósito, ver
      // `runtimeCaching` abaixo (cacheadas sob demanda, não no install).
      registerType: "autoUpdate",
      includeAssets: ["pubx-logo.svg"],
      manifest: {
        name: PWA_BRANDING.name,
        short_name: PWA_BRANDING.shortName,
        description: PWA_BRANDING.description,
        theme_color: PWA_BRANDING.themeColor,
        background_color: PWA_BRANDING.backgroundColor,
        display: "standalone",
        start_url: "/",
        scope: "/",
        lang: "pt-BR",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          // Mesmo desenho do icon-512, mas marcado "maskable" — os sistemas
          // operacionais que recortam o ícone (círculo/squircle) usam esta
          // versão em vez da normal. Gerado com margem de sobra ao redor do
          // símbolo justamente pra sobreviver a esse recorte.
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      // Ativa o Service Worker também no `pnpm dev` (por padrão só existe no
      // build de produção) — necessário pra poder verificar manifest/SW/
      // cache offline localmente, sem precisar de um build completo.
      devOptions: { enabled: true, type: "module" },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["**/*.{js,css,html,svg,ico,png,woff2}"],
        // Cardápio é uma SPA (wouter) — toda navegação cai no mesmo
        // index.html; nunca deixar isso interceptar chamadas de API.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // --- Cardápio público (tRPC `catalog.*`) -----------------------
          // O cliente tRPC (client/src/main.tsx, httpBatchLink) manda
          // queries como GET, agrupando vários procedimentos na mesma URL
          // (`/api/trpc/catalog.list,catalog.promotions?batch=1&...`). Só
          // entra nesta regra quando TODOS os procedimentos do lote são do
          // router "catalog" (menu, promoções, eventos, horários, config
          // da loja) — dado público, seguro de servir com stale-enquanto-
          // revalida pra abrir instantâneo mesmo em conexão ruim. Se
          // qualquer outro procedimento aparecer misturado no mesmo lote,
          // esta regra não bate e a regra "NetworkOnly" logo abaixo assume.
          {
            urlPattern: ({ url }) => {
              if (!url.pathname.startsWith("/api/trpc/")) return false;
              const batch = url.pathname.slice("/api/trpc/".length);
              const procedures = batch.split(",");
              return procedures.length > 0 && procedures.every(p => p.startsWith("catalog."));
            },
            handler: "StaleWhileRevalidate",
            method: "GET",
            options: {
              cacheName: "pubx-catalog-api",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // --- Todo o resto da API — pedido, checkout, admin, painel ----
          // operacional, mesas, dados de cliente/LGPD, suporte. NUNCA
          // cacheado, nem como fallback offline: dado teimosamente sempre
          // fresco é o requisito de segurança aqui (status de pedido
          // errado ou carrinho desatualizado tem custo real). Regra
          // redundante de propósito com "não registrar nada" — deixa a
          // intenção explícita no código em vez de depender do
          // comportamento padrão do Workbox (não interceptar o que não
          // bate em nenhuma rota).
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/trpc/"),
            handler: "NetworkOnly",
          },
          // --- Imagens de produto/categoria -------------------------------
          // Mesma origem (client/public/assets) ou origem separada (MinIO,
          // via S3_PUBLIC_BASE_URL) — cache-first, porque upload novo troca
          // de nome de arquivo (hash aleatório, ver server/storage.ts:
          // appendHashSuffix), então o mesmo nome nunca muda de conteúdo.
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "pubx-images",
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
