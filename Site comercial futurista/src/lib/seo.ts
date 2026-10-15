import { useEffect } from "react";

/**
 * Endereço público onde este site vai morar. Hoje o site comercial fica em
 * mmsystem.tech/comercial; ao publicar em outro domínio, troque só aqui
 * (e em public/robots.txt + public/sitemap.xml).
 */
export const SITE_ORIGIN = "https://mmsystem.tech";
export const SITE_BASE = "/comercial";

/** Rota interna ("/", "/planos") → caminho público ("/comercial", "/comercial/planos"). */
export const publicPath = (route: string) => (route === "/" ? SITE_BASE : `${SITE_BASE}${route}`);
export const publicUrl = (route: string) => `${SITE_ORIGIN}${publicPath(route)}`;

/** Títulos (~60 caracteres) e descrições (~155) — os mesmos do site atual (shared/commercialPageMeta.ts). */
export const PAGE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Sistema para Restaurante sem Comissão | Comandiva",
    description:
      "Sistema para restaurante com cardápio digital, pedidos online e Pix, sem comissão por venda. Teste 7 dias grátis, sem cartão de crédito.",
  },
  "/cadastro": {
    title: "Cadastro — Comandiva",
    description: "Cadastre seu restaurante no Comandiva: nossa equipe organiza seu cardápio e sua configuração. 7 dias grátis, sem cartão.",
  },
  "/cadastro/sucesso": {
    title: "Cadastro recebido — Comandiva",
    description: "Cadastro recebido. Nossa equipe entra em contato para organizar o cardápio e a configuração do seu restaurante.",
  },
  "/cadastro/cardapio": {
    title: "Envie seu cardápio — Comandiva",
    description: "Envie o cardápio do seu restaurante (PDF, Word ou foto) para adiantar a configuração do sistema.",
  },
  "/planos": {
    title: "Planos e Preços — Sistema para Restaurante | Comandiva",
    description:
      "Compare os planos do Comandiva: cardápio digital, pedidos e mesas com QR Code. A partir de R$ 99,90/mês, sem comissão. 7 dias grátis.",
  },
};

function upsert<T extends HTMLElement>(selector: string, build: () => T): T {
  let el = document.head.querySelector<T>(selector);
  if (!el) {
    el = build();
    document.head.appendChild(el);
  }
  return el;
}

function setMeta(attr: "name" | "property", key: string, value: string) {
  upsert(`meta[${attr}="${key}"]`, () => {
    const m = document.createElement("meta");
    m.setAttribute(attr, key);
    return m;
  }).content = value;
}

/**
 * Título, descrição, canonical, Open Graph/Twitter, robots e JSON-LD por
 * página. Atualiza as tags estáticas do index.html (sem duplicar), mesmo
 * padrão do usePageMeta do Master.
 */
export function usePageMeta(route: string, opts: { noindex?: boolean; jsonLd?: object } = {}) {
  const meta = PAGE_META[route] ?? { title: "Página não encontrada | Comandiva", description: PAGE_META["/"].description };
  const { noindex = false, jsonLd } = opts;
  const json = jsonLd ? JSON.stringify(jsonLd).replace(/</g, "\\u003c") : "";

  useEffect(() => {
    document.title = meta.title;
    setMeta("name", "description", meta.description);
    setMeta("property", "og:title", meta.title);
    setMeta("property", "og:description", meta.description);
    setMeta("property", "og:url", publicUrl(route));
    setMeta("name", "twitter:title", meta.title);
    setMeta("name", "twitter:description", meta.description);
    setMeta("name", "robots", noindex ? "noindex, follow" : "index, follow");
    upsert<HTMLLinkElement>('link[rel="canonical"]', () => {
      const l = document.createElement("link");
      l.rel = "canonical";
      return l;
    }).href = publicUrl(route);

    let script: HTMLScriptElement | null = null;
    if (json) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = json;
      document.head.appendChild(script);
    }
    return () => script?.remove();
  }, [route, meta.title, meta.description, noindex, json]);
}
