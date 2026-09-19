import { useEffect } from "react";

const OG_IMAGE = "https://mmsystem.tech/mm-logo-full.png";

type PageMeta = {
  title: string;
  description: string;
  /** Caminho absoluto (ex.: "/comercial/planos") usado pra montar a og:url — nunca a URL inteira vinda de fora, mesmo raciocínio de segurança do resto do site comercial. */
  path: string;
};

function upsertMeta(selector: string, build: () => HTMLMetaElement) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = build();
    document.head.appendChild(el);
  }
  return el;
}

/**
 * Título + meta description + Open Graph por página do site comercial —
 * como é uma SPA de página única (ver comentário no index.html), sem isso
 * toda página pública mostrava o mesmo título genérico de admin
 * ("Painel Master"), o que arruinava tanto o SEO quanto a prévia ao
 * compartilhar o link no WhatsApp. Reverte pro título/descrição padrão ao
 * desmontar, mesmo padrão do useNoIndex.ts.
 */
export function usePageMeta({ title, description, path }: PageMeta) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const descriptionMeta = upsertMeta('meta[name="description"]', () => {
      const meta = document.createElement("meta");
      meta.name = "description";
      return meta;
    });
    const previousDescription = descriptionMeta.content;
    descriptionMeta.content = description;

    const ogTags: Array<[string, string]> = [
      ["og:type", "website"],
      ["og:site_name", "MM System Creator"],
      ["og:title", title],
      ["og:description", description],
      ["og:image", OG_IMAGE],
      ["og:url", `https://mmsystem.tech${path}`],
      ["twitter:card", "summary_large_image"],
    ];
    const createdOgTags = ogTags.map(([property, content]) => {
      const meta = document.createElement("meta");
      if (property.startsWith("og:")) meta.setAttribute("property", property);
      else meta.setAttribute("name", property);
      meta.content = content;
      document.head.appendChild(meta);
      return meta;
    });

    return () => {
      document.title = previousTitle;
      descriptionMeta.content = previousDescription;
      createdOgTags.forEach(meta => document.head.removeChild(meta));
    };
  }, [title, description, path]);
}
