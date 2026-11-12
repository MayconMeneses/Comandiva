import { useEffect } from "react";
import { ENTRY_PRICE_BRL } from "../data/pricing";

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

/** Vitrine principal: o portfólio. A home de /comercial é secundária e aponta para ele. */
export const PORTFOLIO_URL = "https://www.mmsystem.tech/sistemas/comandiva";

/** Canonical/og:url por rota (padrão: a própria URL pública). */
const canonicalFor = (route: string) => (route === "/" ? PORTFOLIO_URL : publicUrl(route));

/** Rotas que ficam fora do índice mesmo sem pedido da página (home e planos são vitrine secundária). */
const NOINDEX_ROUTES = new Set(["/", "/planos"]);

/** Títulos (~60 caracteres) e descrições (~155) — os mesmos do site atual (shared/commercialPageMeta.ts). */
export const PAGE_META: Record<string, { title: string; description: string }> = {
  "/": {
    title: "Sistema para Restaurante sem Comissão | Comandiva",
    description:
      "Sistema para restaurante com cardápio digital, pedidos online e Pix, sem comissão por venda. Teste 7 dias grátis, sem cartão. Cadastre-se agora.",
  },
  "/cadastro": {
    title: "Cadastro de Restaurante | Comandiva",
    description: "Cadastre seu restaurante no Comandiva: nossa equipe organiza seu cardápio e sua configuração. 7 dias grátis, sem cartão. Comece agora.",
  },
  "/cadastro/sucesso": {
    title: "Cadastro recebido | Comandiva",
    description: "Cadastro recebido. Nossa equipe entra em contato em breve para organizar o cardápio e a configuração do seu restaurante.",
  },
  "/cadastro/cardapio": {
    title: "Envie seu Cardápio Digital | Comandiva",
    description: "Envie o cardápio do seu restaurante em PDF, Word ou foto e adiante a configuração do seu sistema. É rápido: escolha o arquivo e envie.",
  },
  "/termos": {
    title: "Termos de Uso | Comandiva",
    description: "Termos de uso do Comandiva: como funciona a assinatura mensal, o que está incluído e as condições de uso do sistema para restaurantes.",
  },
  "/privacidade": {
    title: "Política de Privacidade e LGPD | Comandiva",
    description: "Política de privacidade do Comandiva: quais dados coletamos, para que usamos, como protegemos e como exercer seus direitos pela LGPD.",
  },
  "/cadastro/confirmando": {
    title: "Confirmando pagamento | Comandiva",
    description: "Estamos confirmando o pagamento do seu cadastro no Comandiva. Aguarde alguns instantes, não feche esta página.",
  },
  "/planos": {
    title: "Planos e Preços do Sistema para Restaurante | Comandiva",
    description:
      `Compare os planos do Comandiva: cardápio digital, pedidos e mesas com QR Code. A partir de ${ENTRY_PRICE_BRL}/mês, sem comissão. 7 dias grátis, sem cartão. Veja os planos.`,
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
  const meta = PAGE_META[route] ?? { title: "Página não encontrada | Comandiva", description: "A página que você procurou não existe ou mudou de endereço. Volte ao início do Comandiva ou veja os planos." };
  const known = route in PAGE_META;
  const noindex = opts.noindex || NOINDEX_ROUTES.has(route);
  const { jsonLd } = opts;
  const json = jsonLd ? JSON.stringify(jsonLd).replace(/</g, "\\u003c") : "";

  useEffect(() => {
    document.title = meta.title;
    setMeta("name", "description", meta.description);
    setMeta("property", "og:title", meta.title);
    setMeta("property", "og:description", meta.description);
    if (known) setMeta("property", "og:url", canonicalFor(route));
    else document.head.querySelector('meta[property="og:url"]')?.remove();
    setMeta("name", "twitter:title", meta.title);
    setMeta("name", "twitter:description", meta.description);
    setMeta("name", "robots", noindex ? "noindex, follow" : "index, follow");
    if (known) {
      upsert<HTMLLinkElement>('link[rel="canonical"]', () => {
        const l = document.createElement("link");
        l.rel = "canonical";
        return l;
      }).href = canonicalFor(route);
    } else {
      document.head.querySelector('link[rel="canonical"]')?.remove(); // 404: sem canonical, só noindex
    }

    let script: HTMLScriptElement | null = null;
    if (json) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = json;
      document.head.appendChild(script);
    }
    return () => script?.remove();
  }, [route, known, meta.title, meta.description, noindex, json]);
}
