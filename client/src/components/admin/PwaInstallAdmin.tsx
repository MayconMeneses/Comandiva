import { Button } from "@/components/ui/button";
import { FeatureLockDot, UpgradeNudgeModal } from "@/components/admin/LockedFeature";
import { usePwaInstall } from "@/contexts/PwaInstallContext";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Download, Smartphone } from "lucide-react";
import { useState } from "react";

export default function PwaInstallAdmin() {
  const { canInstall, isStandalone, install } = usePwaInstall();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  // Mesmo padrão já usado em RestaurantOrders.tsx (licenseSnapshot): mySnapshot
  // é admin-only no backend (adminProcedure) — pra uma conta staff, a consulta
  // erra e `teamAppLocked` fica undefined, então o botão aparece sem o aviso
  // de plano pra ela. Sem problema de segurança: "App da equipe" é recurso de
  // plano (Profissional+) só visual — instalar é 100% local do navegador, sem
  // nenhum dado criado/alterado, por isso não há (nem precisa haver)
  // validação nenhuma no backend pra este gate.
  const snapshot = trpc.admin.mySnapshot.useQuery();
  const teamAppLocked = snapshot.data?.lockedFeatures.team_app;

  async function handleInstall() {
    if (teamAppLocked) { setUpgradeModalOpen(true); return; }
    await install();
  }

  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Configuração</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-foreground">Instalador do app</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Instale o MM System Creator como aplicativo neste dispositivo — fica com ícone próprio e abre em tela cheia, sem a barra do navegador. Útil pra deixar fixado numa tablet ou no computador do balcão/cozinha.</p>
      </header>
      <div className="rounded-2xl border border-border bg-card p-6">
        {isStandalone ? (
          <div className="flex items-center gap-3 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Este dispositivo já está rodando o app instalado.
          </div>
        ) : canInstall ? (
          <>
            <div className="flex items-center gap-3">
              <Smartphone className="h-8 w-8 shrink-0 text-primary" />
              <p className="text-sm leading-6 text-muted-foreground">Seu navegador já liberou a instalação. Clique no botão abaixo pra confirmar.</p>
            </div>
            {/* FeatureLockDot fica FORA do Button de propósito — os dois
                renderizam <button>, e HTML não permite <button> aninhado
                (causa aviso de hidratação e pode confundir o clique). */}
            <div className="mt-4 flex items-center gap-2">
              <Button onClick={handleInstall} className="rounded-xl bg-primary hover:bg-primary-hover">
                <Download className="mr-1.5 h-4 w-4" />
                Instalar app
              </Button>
              {teamAppLocked ? <FeatureLockDot title="Disponível no plano Profissional" onClick={() => setUpgradeModalOpen(true)} /> : null}
            </div>
          </>
        ) : (
          // O evento beforeinstallprompt (Chrome/Edge/Android) só dispara sob
          // critério do próprio navegador (algum engajamento com o site) — no
          // iOS Safari nunca existe (lá a instalação é manual: Compartilhar →
          // "Adicionar à Tela de Início"). Não tem como forçar isso pelo app.
          <p className="text-sm leading-6 text-muted-foreground">Este navegador ainda não liberou a instalação — geralmente aparece depois de algum uso do site, ou pode não estar disponível (ex.: iOS/Safari não tem esse recurso nativo). Volte aqui depois de usar o site normalmente por alguns minutos.</p>
        )}
      </div>
      <UpgradeNudgeModal open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen} info={teamAppLocked ? { featureId: "team_app", requiredPlanKey: teamAppLocked.requiredPlanKey, requiredPlanName: teamAppLocked.requiredPlanName } : null} />
    </div>
  );
}
