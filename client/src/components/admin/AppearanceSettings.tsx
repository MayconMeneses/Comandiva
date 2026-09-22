import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { applyColorTheme } from "@/lib/applyColorTheme";
import { trpc } from "@/lib/trpc";
import { COLOR_THEME_KEYS, COLOR_THEMES, DEFAULT_COLOR_THEME, type ColorThemeKey } from "@shared/colorThemes";
import { Check, Lock } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FeatureLockDot, LockedFeatureCard, UpgradeNudgeModal, type FeatureLockedInfo } from "./LockedFeature";

const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

type AppearanceSettingsProps = {
  settings: {
    isAcceptingOrders: boolean;
    deliveryFeeCents: number;
    minimumOrderCents: number;
    estimatedDeliveryMin: number;
    estimatedDeliveryMax: number;
    openingHours: string | null;
    colorTheme?: string | null;
    customBackgroundColor?: string | null;
  } | null | undefined;
};

/**
 * Fundo/tema do restaurante (site público + admin) — antes vivia dentro do
 * modal de OperationSettings, movido pra cá (SiteConfig, já uma página
 * dedicada) porque cresceu: além dos 7 presets, agora tem cor de fundo livre
 * com preview ao vivo. A própria página por trás do formulário já é o
 * preview — aplica direto via applyColorTheme, sem montar uma prévia falsa.
 */
export default function AppearanceSettings({ settings }: AppearanceSettingsProps) {
  const utils = trpc.useUtils();
  const [colorTheme, setColorTheme] = useState<ColorThemeKey>((settings?.colorTheme as ColorThemeKey) ?? DEFAULT_COLOR_THEME);
  const [customBackgroundColor, setCustomBackgroundColor] = useState<string | null>(settings?.customBackgroundColor ?? null);
  const [hexDraft, setHexDraft] = useState(settings?.customBackgroundColor ?? "");
  const [upgradeInfo, setUpgradeInfo] = useState<FeatureLockedInfo | null>(null);
  const snapshot = trpc.admin.mySnapshot.useQuery();
  const themeLocked = snapshot.data?.lockedFeatures.custom_theme;

  const update = trpc.admin.updateSettings.useMutation({
    onSuccess: () => { toast.success("Aparência salva."); void utils.admin.dashboard.invalidate(); void utils.catalog.settings.invalidate(); },
    onError: error => toast.error(error.message),
  });

  // Preview ao vivo: no máximo 1 recálculo por frame, mesmo que o <input
  // type="color"> dispare vários eventos durante o arraste — nenhuma chamada
  // de rede acontece aqui, só CSS variables locais (ver applyColorTheme.ts).
  const rafRef = useRef<number | null>(null);
  const applyLive = (theme: ColorThemeKey, background: string | null) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => { applyColorTheme(theme, background); rafRef.current = null; });
  };

  // "Cancelar" implícito: se a pessoa navegar pra outra tela sem salvar, o
  // preview aplicado ao vivo não pode ficar preso — volta pro que já está
  // salvo de verdade assim que este componente sai da tela. Só no
  // desmonte (deps vazias) — usa uma ref pra sempre ler o `settings` mais
  // recente sem precisar re-registrar o cleanup a cada refetch (o que
  // causaria um flash: reverter pro valor antigo sempre que a query mudar).
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    applyColorTheme(settingsRef.current?.colorTheme, settingsRef.current?.customBackgroundColor);
  }, []);

  if (!settings) return null;

  const save = () => {
    update.mutate({
      isAcceptingOrders: settings.isAcceptingOrders,
      deliveryFeeCents: settings.deliveryFeeCents,
      minimumOrderCents: settings.minimumOrderCents,
      estimatedDeliveryMin: settings.estimatedDeliveryMin,
      estimatedDeliveryMax: settings.estimatedDeliveryMax,
      openingHours: settings.openingHours ?? "",
      colorTheme,
      customBackgroundColor,
    });
  };

  const pickTheme = (key: ColorThemeKey) => {
    if (key !== "classico" && themeLocked) {
      setUpgradeInfo({ featureId: "custom_theme", requiredPlanKey: themeLocked.requiredPlanKey, requiredPlanName: themeLocked.requiredPlanName });
      return;
    }
    setColorTheme(key);
    applyLive(key, customBackgroundColor);
  };

  const pickBackground = (hex: string) => {
    setCustomBackgroundColor(hex);
    setHexDraft(hex);
    applyLive(colorTheme, hex);
  };

  const restoreDefault = () => {
    setCustomBackgroundColor(null);
    setHexDraft("");
    applyLive(colorTheme, null);
  };

  return <section className="rounded-2xl border border-border bg-card text-card-foreground p-6">
    <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Aparência</p>
    <h2 className="mt-1 font-display text-2xl font-bold">Cor de marca e fundo</h2>
    <p className="mt-1 text-sm text-muted-foreground">Aplica no cardápio público e no painel administrativo.</p>

    <div className="mt-5">
      <Label>Cor de marca</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {COLOR_THEME_KEYS.map(key => {
          const themeOption = COLOR_THEMES[key];
          const isSelected = colorTheme === key;
          const isLocked = key !== "classico" && Boolean(themeLocked);
          return <button key={key} type="button" title={themeOption.label} aria-label={themeOption.label} aria-pressed={isSelected} onClick={() => pickTheme(key)} className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-transform hover:scale-105 ${isSelected ? "border-[#2c1b14]" : "border-transparent"}`} style={{ backgroundColor: themeOption.primary }}>
            {isLocked ? <Lock className="h-4 w-4 text-white/90" /> : isSelected ? <Check className="h-4 w-4 text-white" /> : null}
          </button>;
        })}
      </div>
    </div>

    <div className="mt-5">
      <div className="flex items-center gap-1.5">
        <Label>Cor de fundo personalizada</Label>
        {themeLocked ? <FeatureLockDot title="Recurso do plano" onClick={() => setUpgradeInfo({ featureId: "custom_theme", requiredPlanKey: themeLocked.requiredPlanKey, requiredPlanName: themeLocked.requiredPlanName })} /> : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Muda o fundo do sistema de verdade — texto, superfícies e bordas se ajustam automaticamente pra continuar legíveis.</p>
      {themeLocked
        ? <div className="mt-3"><LockedFeatureCard title="Cor de fundo personalizada" requiredPlanName={themeLocked.requiredPlanName} featureId="custom_theme" /></div>
        : <div className="mt-3 flex flex-wrap items-center gap-3">
            <input type="color" value={HEX_PATTERN.test(hexDraft) ? hexDraft : (customBackgroundColor ?? "#f6f1e8")} onChange={event => pickBackground(event.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-border bg-card p-1" aria-label="Selecionar cor de fundo" />
            <Input
              value={hexDraft}
              onChange={event => {
                const value = event.target.value;
                setHexDraft(value);
                if (HEX_PATTERN.test(value)) pickBackground(value.toLowerCase());
              }}
              placeholder="#0b1220"
              className="h-11 w-32 rounded-xl bg-card font-mono uppercase"
              maxLength={7}
            />
            {customBackgroundColor ? <Button type="button" variant="outline" size="sm" onClick={restoreDefault} className="h-9 rounded-lg border-border bg-card text-xs">Restaurar padrão</Button> : null}
          </div>}
    </div>

    {update.error && <p className="mt-4 text-sm text-red-700">{update.error.message}</p>}
    <Button disabled={update.isPending} onClick={save} className="mt-6 h-11 rounded-xl bg-primary hover:bg-primary-hover">{update.isPending ? "Salvando…" : "Salvar aparência"}</Button>

    <UpgradeNudgeModal open={Boolean(upgradeInfo)} onOpenChange={openValue => { if (!openValue) setUpgradeInfo(null); }} info={upgradeInfo} />
  </section>;
}
