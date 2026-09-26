import { PanelLayout } from "@/components/PanelLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { applyPanelTheme } from "@/lib/applyPanelTheme";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef, useState } from "react";

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;
const DEFAULT_PAPER = "#f8fafc";

/**
 * Fundo do próprio Painel Master — mesma ideia de Admin → Aparência no app
 * principal (cor de fundo livre + motor de contraste automático), mas aqui é
 * uma preferência única da plataforma, sem trava de plano (é a ferramenta do
 * próprio dono, não um recurso vendido a restaurante-cliente).
 */
export default function Aparencia() {
  const utils = trpc.useUtils();
  const appearance = trpc.masterPanel.settings.getAppearance.useQuery();
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);
  const [hexDraft, setHexDraft] = useState("");
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current && appearance.data) {
      initialized.current = true;
      setBackgroundColor(appearance.data.backgroundColor);
      setHexDraft(appearance.data.backgroundColor ?? "");
    }
  }, [appearance.data]);

  const update = trpc.masterPanel.settings.updateAppearance.useMutation({
    onSuccess: () => { void utils.masterPanel.settings.getAppearance.invalidate(); },
  });

  // Preview ao vivo — no máximo 1 recálculo por frame, sem nenhuma chamada de
  // rede (a mutation só dispara no clique em "Salvar").
  const rafRef = useRef<number | null>(null);
  const applyLive = (color: string | null) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => { applyPanelTheme(color); rafRef.current = null; });
  };

  // "Cancelar" implícito: saindo da tela sem salvar, volta pro que já está
  // salvo. Só no desmonte (deps vazias) — usa uma ref pra sempre ler o valor
  // mais recente sem re-registrar o cleanup a cada refetch.
  const appearanceDataRef = useRef(appearance.data);
  appearanceDataRef.current = appearance.data;
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    applyPanelTheme(appearanceDataRef.current?.backgroundColor);
  }, []);

  const pick = (hex: string) => {
    setBackgroundColor(hex);
    setHexDraft(hex);
    applyLive(hex);
  };

  const restoreDefault = () => {
    setBackgroundColor(null);
    setHexDraft("");
    applyLive(null);
  };

  return (
    <PanelLayout>
      <p className="text-xs font-bold uppercase tracking-wider text-accent">Aparência</p>
      <h1 className="mt-1 text-2xl font-bold text-ink">Fundo do Painel Master</h1>
      <p className="mt-1 text-sm text-ink-soft">Muda o fundo do painel de verdade — texto, superfícies e bordas se ajustam automaticamente pra continuar legíveis. O indigo de marca (navegação, botões) permanece fixo.</p>

      <div className="mt-6 max-w-md rounded-xl border border-border bg-paper-raised p-5">
        <label className="text-sm font-semibold text-ink">Cor de fundo</label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={HEX_PATTERN.test(hexDraft) ? hexDraft : (backgroundColor ?? DEFAULT_PAPER)}
            onChange={event => pick(event.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-paper p-1"
            aria-label="Selecionar cor de fundo"
          />
          <Input
            value={hexDraft}
            onChange={event => {
              const value = event.target.value;
              setHexDraft(value);
              if (HEX_PATTERN.test(value)) pick(value.toLowerCase());
            }}
            placeholder={DEFAULT_PAPER}
            className="w-32 font-mono uppercase"
            maxLength={7}
          />
          {backgroundColor ? <Button variant="outline" onClick={restoreDefault}>Restaurar padrão</Button> : null}
        </div>

        {update.error ? <p className="mt-3 text-sm text-red-600">{update.error.message}</p> : null}
        <Button
          disabled={update.isPending}
          onClick={() => update.mutate({ backgroundColor })}
          className="mt-4"
        >
          {update.isPending ? "Salvando…" : update.isSuccess ? "Salvo!" : "Salvar aparência"}
        </Button>
      </div>
    </PanelLayout>
  );
}
