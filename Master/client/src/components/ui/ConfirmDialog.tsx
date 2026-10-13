import { useEffect } from "react";
import { Button } from "./Button";

/** Modal de confirmação feito à mão (sem lib) — pra um painel interno de um usuário só, um overlay simples basta. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  danger,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-paper-raised p-5 shadow-xl" onClick={event => event.stopPropagation()}>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={pending}>Cancelar</Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={pending}>{pending ? "Aplicando…" : confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
