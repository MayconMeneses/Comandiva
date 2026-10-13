import { useEffect } from "react";

type PageMeta = {
  title: string;
  description: string;
  /** Caminho absoluto (ex.: "/comercial/planos") usado pra montar a og:url — nunca a URL inteira vinda de fora, mesmo raciocínio de segurança do resto do site comercial. */
  path: string;
};

function upsertEl<T extends HTMLElement>(selector: string, build: () => T): T {
  let el = document.head.querySelector<T>(selector);
  if (!el) {
    el = build();
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Título + meta description + Open Graph/Twitter por página do site
 * comercial — como é uma SPA de página única (ver comentário no
 * index.html), sem isso toda página pública mostrava o mesmo título
 * genérico de admin ("Painel Master"), o que arruinava tanto o SEO quanto
 * a prévia ao compartilhar o link no WhatsApp.
 *
 * Faz UPSERT (acha e atualiza, não cria duplicata) em cada tag — o
 * index.html já vem com tags og: e twitter: estáticas (fallback pra
 * crawler sem JS, ver server/_core/vite.ts), então criar tags novas em vez
 * de reaproveitar deixava DUAS tags og:title/og:description coexistindo, e
 * o crawler pega a primeira que encontra (a estática, errada). Reverte pro
 * valor anterior (estático) ao desmontar, mesmo padrão do useNoIndex.ts.
 */
export function usePageMeta({ title, description, path }: PageMeta) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const restore: Array<() => void> = [() => { document.title = previousTitle; }];

    function setMeta(attr: "name" | "property", name: string, value: string) {
      const el = upsertEl(`meta[${attr}="${name}"]`, () => {
        const meta = document.createElement("meta");
        meta.setAttribute(attr, name);
        return meta;
      });
      const previous = el.content;
      el.content = value;
      restore.push(() => { el.content = previous; });
    }

    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", `https://mmsystem.tech${path}`);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    // og:type, og:site_name, og:image, og:locale, twitter:card, twitter:image
    // não variam por página — o valor estático do index.html já serve.

    const canonical = upsertEl<HTMLLinkElement>('link[rel="canonical"]', () => {
      const link = document.createElement("link");
      link.rel = "canonical";
      return link;
    });
    const previousCanonical = canonical.href;
    canonical.href = `https://mmsystem.tech${path}`;
    restore.push(() => { canonical.href = previousCanonical; });

    return () => restore.forEach(fn => fn());
  }, [title, description, path]);
}
