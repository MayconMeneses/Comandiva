import { PanelLayout } from "@/components/PanelLayout";
import { useEffect, useState } from "react";

type VersionInfo = { version: string; commit: string };

// Página deliberadamente honesta sobre o que existe hoje — nada de botão de
// "deploy"/"rollback" fingindo funcionar. O Painel Master não tem hoje
// nenhum jeito de alcançar a VPS de produção remotamente; isso exige uma
// decisão de arquitetura (chave SSH guardada onde? um agente HTTP na VPS?)
// antes de virar código. Ver Playbook do Revendedor / docs/production-deploy.md
// pro processo real (ainda manual) de subir uma nova versão.
export default function Manutencao() {
  const [saasCoreVersion, setSaasCoreVersion] = useState<VersionInfo | "loading" | "error">("loading");

  useEffect(() => {
    fetch("/version")
      .then(res => res.json())
      .then((data: VersionInfo) => setSaasCoreVersion(data))
      .catch(() => setSaasCoreVersion("error"));
  }, []);

  return (
    <PanelLayout>
      <h1 className="text-xl font-bold text-ink">Manutenção</h1>
      <p className="mt-1 text-sm text-ink-soft">Versão do código rodando agora e o estado real do processo de deploy.</p>

      <div className="mt-6 rounded-xl border border-border bg-paper-raised p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Painel Master (este serviço)</p>
        {saasCoreVersion === "loading" ? (
          <p className="mt-2 text-sm text-ink-soft">Carregando…</p>
        ) : saasCoreVersion === "error" ? (
          <p className="mt-2 text-sm text-red-700">Não foi possível consultar /version.</p>
        ) : (
          <p className="mt-2 font-mono text-sm text-ink">
            v{saasCoreVersion.version} · commit <code className="rounded bg-paper px-1.5 py-0.5">{saasCoreVersion.commit}</code>
          </p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-paper-raised p-4 text-sm text-ink-soft">
        <p className="font-semibold text-ink">O que já existe</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Repositório Git local (sem remoto ainda) — todo deploy parte de um commit identificável.</li>
          <li>Health check real no Docker (<code className="rounded bg-paper px-1 py-0.5">/healthz</code>), com restart automático se o processo travar.</li>
          <li>Backup + restore testados ponta a ponta (banco, e storage no app principal).</li>
        </ul>
        <p className="mt-4 font-semibold text-ink">O que ainda é manual</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Deploy continua sendo SSH + <code className="rounded bg-paper px-1 py-0.5">docker compose up -d --build</code> na VPS, feito à mão.</li>
          <li>Não existe staging separado de produção nem pipeline de CI.</li>
          <li>Rollback é restaurar um backup — não existe rollback de um clique ainda.</li>
        </ul>
        <p className="mt-4">Disparar deploy/rollback direto por aqui exige o Master conseguir alcançar a VPS com segurança (uma credencial nova guardada em algum lugar) — decisão que ainda não foi tomada, de propósito.</p>
      </div>
    </PanelLayout>
  );
}
