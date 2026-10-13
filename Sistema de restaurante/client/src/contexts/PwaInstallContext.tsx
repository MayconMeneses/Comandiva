import { createContext, ReactNode, useContext, useEffect, useState } from "react";

// Tipagem mínima do evento — não faz parte do lib.dom.d.ts padrão do TS ainda.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari/iOS antigo expõe isso direto na `navigator`, sem display-mode.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

type PwaInstallState = {
  canInstall: boolean;
  isStandalone: boolean;
  install: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

const PwaInstallContext = createContext<PwaInstallState | null>(null);

/**
 * Captura `beforeinstallprompt`/`appinstalled` aqui, montado o mais cedo
 * possível (App.tsx, fora do Router, em toda rota) — o evento só dispara UMA
 * vez por sessão, sob critério do próprio navegador (engajamento, manifest
 * válido, HTTPS). Se a escuta só existisse dentro da tela de configuração
 * (Admin → Instalador do app), corríamos o risco de perder o evento pra
 * sempre se ele já tivesse disparado antes da pessoa navegar até lá (ex.:
 * durante o carregamento inicial do /painel-pedidos). A UI que mostra o
 * botão (client/src/components/admin/PwaInstallAdmin.tsx) só CONSOME esse
 * estado via `usePwaInstall()`, nunca escuta o evento ela mesma.
 */
export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(isStandalone);

  useEffect(() => {
    if (standalone) return; // já instalado/rodando como app — nada a escutar

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferredPrompt(null);
      setStandalone(true);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [standalone]);

  async function install(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!deferredPrompt) return "unavailable";
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // Aceitando ou recusando, o mesmo evento não pode ser reusado — o
    // navegador só dispara `beforeinstallprompt` de novo depois.
    setDeferredPrompt(null);
    return outcome;
  }

  return <PwaInstallContext.Provider value={{ canInstall: Boolean(deferredPrompt), isStandalone: standalone, install }}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall(): PwaInstallState {
  const ctx = useContext(PwaInstallContext);
  if (!ctx) throw new Error("usePwaInstall precisa estar dentro de PwaInstallProvider");
  return ctx;
}
