import { useEffect } from "react";

/**
 * Injeta <meta name="robots" content="noindex, nofollow"> enquanto o
 * componente estiver montado, removendo ao desmontar. O `index.html` deste
 * app não tem noindex global de propósito — o mesmo HTML serve tanto o site
 * comercial público (precisa ser indexado) quanto o Painel Master (não
 * deve aparecer no Google) — então cada tela do Painel Master pede isso
 * individualmente, aqui.
 */
export function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);
}
