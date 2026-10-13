import { PanelLayout } from "@/components/PanelLayout";
import { Button } from "@/components/ui/Button";
import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";

type VersionInfo = { version: string; commit: string };
type QaEntry = { question: string; answer?: string; error?: string };

// Página deliberadamente honesta sobre o que existe hoje — nada de botão de
// "deploy"/"rollback" fingindo funcionar. O Painel Master não tem hoje
// nenhum jeito de alcançar a VPS de produção remotamente; isso exige uma
// decisão de arquitetura (chave SSH guardada onde? um agente HTTP na VPS?)
// antes de virar código. Ver Playbook do Revendedor / docs/production-deploy.md
// pro processo real (ainda manual) de subir uma nova versão.
export default function Manutencao() {
  const [saasCoreVersion, setSaasCoreVersion] = useState<VersionInfo | "loading" | "error">("loading");
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<QaEntry[]>([]);
  const ask = trpc.masterPanel.maintenance.ask.useMutation();

  useEffect(() => {
    fetch("/version")
      .then(res => res.json())
      .then((data: VersionInfo) => setSaasCoreVersion(data))
      .catch(() => setSaasCoreVersion("error"));
  }, []);

  const handleAsk = () => {
    const trimmed = question.trim();
    if (!trimmed || ask.isPending) return;
    ask.mutate(
      { question: trimmed },
      {
        onSuccess: result => setHistory(previous => [...previous, { question: trimmed, answer: "answer" in result ? result.answer : undefined, error: "error" in result ? result.error : undefined }]),
        onError: error => setHistory(previous => [...previous, { question: trimmed, error: error.message }]),
        onSettled: () => setQuestion(""),
      },
    );
  };

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

      <div className="mt-4 rounded-xl border border-border bg-paper-raised p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Assistente de manutenção (IA) — só leitura</p>
        <p className="mt-1 text-sm text-ink-soft">
          Responde perguntas sobre o estado atual da plataforma (restaurantes, planos, auditoria recente) com base
          nos dados que o Painel Master já tem. Nunca executa nada nem altera dado nenhum — só analisa e explica.
        </p>

        {history.length ? (
          <div className="mt-3 space-y-2">
            {history.map((entry, index) => (
              <div key={index} className="rounded-lg border border-border bg-paper p-3">
                <p className="text-sm font-medium text-ink">{entry.question}</p>
                {entry.answer ? <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{entry.answer}</p> : null}
                {entry.error ? <p className="mt-1 text-sm text-red-700">{entry.error}</p> : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-start gap-2">
          <textarea
            className="min-h-[2.5rem] flex-1 rounded-lg border border-border bg-paper-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            placeholder="Ex.: quais restaurantes estão sem deployment configurado?"
            value={question}
            onChange={event => setQuestion(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleAsk();
              }
            }}
          />
          <Button disabled={!question.trim() || ask.isPending} onClick={handleAsk}>
            {ask.isPending ? "Perguntando…" : "Perguntar"}
          </Button>
        </div>
      </div>
    </PanelLayout>
  );
}
