import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce), (max-width: 360px)";

/** Movimento reduzido ou tela muito estreita: sem cena presa na rolagem, só a sequência em lista. */
export function useStaticMode() {
  const [on, setOn] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const update = () => setOn(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return on;
}
