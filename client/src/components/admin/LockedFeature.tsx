import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FEATURE_CATALOG } from "@/lib/featureCatalog";
import { TRPCClientError } from "@trpc/client";
import { Lock, Sparkles } from "lucide-react";
import React from "react";
import { useLocation } from "wouter";

/** Lista de benefícios — a "prévia controlada" do recurso bloqueado (regra 11 da reestruturação de planos): mostra o que o usuário ganharia, sem deixar usar de verdade. */
function BenefitsPreview({ featureId }: { featureId?: string }) {
  const benefits = featureId ? FEATURE_CATALOG[featureId]?.benefits : undefined;
  if (!benefits?.length) return null;
  return (
    <ul className="mt-4 space-y-1.5 text-left">
      {benefits.map(benefit => (
        <li key={benefit} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <span className="mt-0.5 text-[#b4472d]">✓</span>{benefit}
        </li>
      ))}
    </ul>
  );
}

export type FeatureLockedInfo = { featureId: string; requiredPlanKey: string | null; requiredPlanName: string | null };

/** Lê o erro `FEATURE_LOCKED` anexado pelo errorFormatter do backend (server/_core/trpc.ts), se houver. */
export function getFeatureLockedInfo(error: unknown): FeatureLockedInfo | null {
  if (!(error instanceof TRPCClientError)) return null;
  const featureLocked = (error.data as { featureLocked?: FeatureLockedInfo } | undefined)?.featureLocked;
  return featureLocked ?? null;
}

/** Selo pequeno de cadeado pra usar ao lado de um item de navegação — clicável, abre o convite de upgrade. */
export function FeatureLockDot({ title, onClick }: { title?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={event => { event.stopPropagation(); onClick?.(); }}
      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[#b4472d] transition-colors hover:bg-[#f3e2d8] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b4472d]"
      aria-label={title ?? "Recurso bloqueado pelo plano atual — clique para ver como liberar"}
    >
      <Lock className="h-3.5 w-3.5" />
    </button>
  );
}

/** Estado de página inteira bloqueada — substitui o conteúdo normal da página. */
export function LockedFeatureFullPage({ requiredPlanName, featureId }: { requiredPlanName?: string | null; featureId?: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="grid min-h-[60vh] place-items-center rounded-3xl border border-dashed border-[#d9cdbc] bg-[#fffdfa] p-10 text-center">
      <div className="mx-auto max-w-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#f3e2d8] text-[#b4472d]">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="mt-5 font-display text-2xl font-bold">Recurso não disponível no seu plano</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {requiredPlanName ? <>Esta área faz parte do plano <strong>{requiredPlanName}</strong>.</> : "Esta área não está disponível no seu plano atual."}
        </p>
        <BenefitsPreview featureId={featureId} />
        <Button onClick={() => setLocation("/admin/plano")} className="mt-5 rounded-xl bg-[#b4472d] hover:bg-[#943722]">
          <Sparkles className="mr-1.5 h-4 w-4" />Fazer upgrade
        </Button>
      </div>
    </div>
  );
}

/** Versão compacta de LockedFeatureFullPage — pra quando o recurso bloqueado é só uma SEÇÃO de uma página maior (ex.: Promoções dentro de Cardápio), não a tela inteira. */
export function LockedFeatureCard({ title, requiredPlanName, featureId }: { title: string; requiredPlanName?: string | null; featureId?: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#d9cdbc] bg-[#fffdfa] p-8 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f3e2d8] text-[#b4472d]">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {requiredPlanName ? <>Disponível a partir do plano <strong>{requiredPlanName}</strong>.</> : "Não disponível no seu plano atual."}
          </p>
          <BenefitsPreview featureId={featureId} />
        </div>
      </div>
      <Button onClick={() => setLocation("/admin/plano")} className="shrink-0 rounded-xl bg-[#b4472d] hover:bg-[#943722]">
        <Sparkles className="mr-1.5 h-4 w-4" />Fazer upgrade
      </Button>
    </div>
  );
}

/** Modal explicando o bloqueio, aberto quando uma ação concreta esbarra num FEATURE_LOCKED. */
export function UpgradeNudgeModal({ open, onOpenChange, info }: { open: boolean; onOpenChange: (open: boolean) => void; info: FeatureLockedInfo | null }) {
  const [, setLocation] = useLocation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl bg-[#fffdf8]">
        <DialogHeader>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#f3e2d8] text-[#b4472d]">
            <Lock className="h-5 w-5" />
          </div>
          <DialogTitle className="mt-3 font-display text-2xl">Recurso do plano {info?.requiredPlanName ?? "superior"}</DialogTitle>
          <p className="text-sm leading-6 text-muted-foreground">
            Esse recurso ainda não está liberado no seu plano atual. Acesse "Meu plano" no menu pra ver a comparação completa e liberar.
          </p>
          <BenefitsPreview featureId={info?.featureId} />
        </DialogHeader>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Agora não</Button>
          <Button onClick={() => { onOpenChange(false); setLocation("/admin/plano"); }} className="rounded-xl bg-[#b4472d] hover:bg-[#943722]">
            <Sparkles className="mr-1.5 h-4 w-4" />Ver planos
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
