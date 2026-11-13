import type { ReactNode } from "react";

export type KwTone = "brand" | "ok" | "band";

const TONE: Record<KwTone, string> = { brand: "", ok: "kw-ok", band: "kw-band" };

/** Palavra-chave de título: cor de marca e marca-texto mostarda (estilos em index.css). */
export function Kw({ tone = "brand", children }: { tone?: KwTone; children: ReactNode }) {
  return <mark className={("kw " + TONE[tone]).trim()}>{children}</mark>;
}

/** Destaca `phrase` dentro de `text`; se a frase não estiver no texto, devolve o texto puro. */
export function Marked({ text, phrase, tone }: { text: string; phrase: string; tone?: KwTone }) {
  const at = text.indexOf(phrase);
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <Kw tone={tone}>{phrase}</Kw>
      {text.slice(at + phrase.length)}
    </>
  );
}
