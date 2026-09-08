import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

// Afordância de instalação do PWA. O evento `beforeinstallprompt` só existe
// no Chrome/Edge/Android — no iOS Safari não existe API de prompt nenhuma
// (instalação lá é manual: Compartilhar → "Adicionar à Tela de Início"), então
// nesses navegadores o evento nunca dispara e este componente simplesmente
// nunca aparece. Não tem UI nenhuma pra tentar imitar o fluxo do iOS — seria
// complexidade sem necessidade pra v1 (ver CLAUDE.md/tarefa: nada fancy aqui).
const DISMISSED_KEY = "pwa-install-dismissed";

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

export default function PwaInstallButton() {
  // Instalar o app é uma ação de equipe (ex.: fixar o painel operacional
  // como app numa tablet do balcão) — cliente do cardápio público nunca vê
  // este botão, mesmo em navegadores que disparariam o prompt nativo pra
  // qualquer visitante (por isso capturamos e sempre damos preventDefault()
  // no evento abaixo, admin ou não).
  const { user } = useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // já instalado/rodando como app — nada a fazer
    try {
      if (localStorage.getItem(DISMISSED_KEY) === "1") setDismissed(true);
    } catch {
      // localStorage indisponível (modo privado etc.) — só não lembra a
      // recusa entre sessões, sem quebrar nada.
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferredPrompt || dismissed || user?.role !== "admin") return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    // Aceitando ou recusando, o mesmo evento não pode ser reusado — o
    // navegador só dispara `beforeinstallprompt` de novo depois.
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // sem persistência — só reaparece na próxima visita, sem problema.
    }
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background px-3 py-2 shadow-lg">
      <Button size="sm" className="rounded-full" onClick={handleInstall}>
        <Download />
        Instalar app
      </Button>
      <button
        type="button"
        aria-label="Dispensar"
        onClick={handleDismiss}
        className="rounded-full p-1 text-muted-foreground hover:bg-accent"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
