import { useState } from "react";

/**
 * <img> com estado de carregamento (skeleton pulsante) e degradação graciosa
 * quando a URL falha — evita o ícone de imagem quebrada do navegador em
 * fotos de produto/categoria/promoção vindas do storage.
 */
export default function SmartImage({ src, alt, className = "" }: { src?: string | null; alt: string; className?: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  if (!src || status === "error") return <div className={`grid place-items-center bg-[#e6d9c7] text-2xl ${className}`} aria-hidden={status === "error"}>🍽</div>;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("error")}
      className={`bg-[#e6d9c7] transition-opacity duration-300 ${status === "loaded" ? "opacity-100" : "opacity-0 animate-pulse"} ${className}`}
    />
  );
}
