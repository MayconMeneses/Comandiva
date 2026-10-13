import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";
import { useLocation } from "wouter";

type SupportSession = { restaurantName: string; platformAdminEmail: string; expiresAt: number };

/** Faixa fixa e inconfundível — nunca deixar parecer que é o próprio restaurante logado normalmente. */
export function SupportModeBanner({ session, onExit, exiting }: { session: SupportSession; onExit: () => Promise<unknown>; exiting: boolean }) {
  const [, setLocation] = useLocation();
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b-2 border-amber-500 bg-amber-950 px-4 py-2.5 text-amber-50">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Wrench className="h-4 w-4 shrink-0" />
        <span>
          Modo Suporte ativo — visualizando <strong>{session.restaurantName}</strong> como <strong>{session.platformAdminEmail}</strong> · expira às{" "}
          {new Date(session.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={exiting}
        onClick={() => { void onExit().then(() => setLocation("/")); }}
        className="h-8 border-amber-400 bg-transparent text-xs text-amber-50 hover:bg-amber-900"
      >
        {exiting ? "Saindo…" : "Sair do modo suporte"}
      </Button>
    </div>
  );
}
