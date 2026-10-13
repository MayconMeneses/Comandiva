import { PanelLayout } from "@/components/PanelLayout";
import { RecoveryCodesPanel } from "@/components/RecoveryCodesPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { FormEvent, useState } from "react";
import { useLocation } from "wouter";

const LOW_CODES = 2;

/** Cada admin cuida do próprio 2FA e das próprias sessões — sem área de permissão, todo mundo logado vê esta tela. */
export default function Seguranca() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const status = trpc.masterPanel.security.status.useQuery();

  const [password, setPassword] = useState("");
  const [setup, setSetup] = useState<{ qrCodeDataUrl: string; manualKey: string } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  // Códigos mostrados uma única vez (depois de ativar ou de gerar uma lista nova).
  const [shownCodes, setShownCodes] = useState<string[] | null>(null);
  const [manage, setManage] = useState<"regenerate" | "disable" | null>(null);
  const [managePassword, setManagePassword] = useState("");
  const [manageCode, setManageCode] = useState("");
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const refresh = async () => {
    await Promise.all([utils.masterPanel.security.status.invalidate(), utils.masterPanel.auth.me.invalidate()]);
  };

  const startSetup = trpc.masterPanel.security.startTotpSetup.useMutation({
    onSuccess: result => { setSetup(result); setPassword(""); },
  });
  const confirmSetup = trpc.masterPanel.security.confirmTotpSetup.useMutation({
    onSuccess: async result => {
      setSetup(null);
      setConfirmCode("");
      setShownCodes(result.recoveryCodes);
      await refresh();
    },
  });
  const disable = trpc.masterPanel.security.disableTotp.useMutation({
    onSuccess: async () => { closeManage(); await refresh(); },
  });
  const regenerate = trpc.masterPanel.security.regenerateRecoveryCodes.useMutation({
    onSuccess: async result => { closeManage(); setShownCodes(result.recoveryCodes); await refresh(); },
  });
  const revokeAll = trpc.masterPanel.security.revokeAllSessions.useMutation({
    onSuccess: () => {
      // O servidor já apagou o cookie: limpa o "quem sou eu" local e volta pro login.
      utils.masterPanel.auth.me.setData(undefined, null);
      setLocation("/login");
    },
  });

  function closeManage() {
    setManage(null); setManagePassword(""); setManageCode("");
    disable.reset(); regenerate.reset();
  }

  function submitStart(event: FormEvent) {
    event.preventDefault();
    startSetup.mutate({ password });
  }
  function submitConfirm(event: FormEvent) {
    event.preventDefault();
    confirmSetup.mutate({ code: confirmCode });
  }
  function submitManage(event: FormEvent) {
    event.preventDefault();
    if (manage === "disable") disable.mutate({ password: managePassword, code: manageCode });
    else regenerate.mutate({ password: managePassword, code: manageCode });
  }

  const data = status.data;
  const manageError = disable.error ?? regenerate.error;
  const managePending = disable.isPending || regenerate.isPending;

  return (
    <PanelLayout>
      <h1 className="text-xl font-bold text-ink">Segurança</h1>
      <p className="mt-1 text-sm text-ink-soft">Proteja o seu acesso ao Painel Master com a verificação em duas etapas e controle onde a sua conta está conectada.</p>

      <section className="mt-5 max-w-xl rounded-xl border border-border bg-paper-raised p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">Verificação em duas etapas</h2>
          {data ? <Badge status={data.totpEnabled ? "active" : "payment_pending"}>{data.totpEnabled ? "Ativa" : "Desativada"}</Badge> : null}
        </div>

        {data?.totpRequired && !data.totpEnabled ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900">Este painel exige a verificação em duas etapas. Ative abaixo para voltar a usar as outras telas.</p>
        ) : null}

        {shownCodes ? (
          <div className="mt-3"><RecoveryCodesPanel codes={shownCodes} onDone={() => setShownCodes(null)} /></div>
        ) : null}

        {data && !data.totpEnabled && !setup ? (
          <form onSubmit={submitStart} className="mt-3">
            <p className="text-sm text-ink-soft">
              Além da senha, você passa a digitar um código de 6 números gerado por um app no celular (Google Authenticator, Microsoft Authenticator, Authy…). Mesmo que descubram a sua senha, não conseguem entrar sem o seu celular.
            </p>
            <label htmlFor="start-password" className="mt-3 block text-sm font-medium text-ink">Confirme a sua senha atual para começar</label>
            <Input id="start-password" type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5" />
            {startSetup.error ? <p className="mt-2 text-sm text-red-600">{startSetup.error.message}</p> : null}
            <Button type="submit" disabled={startSetup.isPending} className="mt-3">{startSetup.isPending ? "Preparando…" : "Ativar verificação em duas etapas"}</Button>
          </form>
        ) : null}

        {setup ? (
          <form onSubmit={submitConfirm} className="mt-3">
            <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
              <li>No celular, abra o app autenticador e escolha "adicionar conta" / "ler QR code".</li>
              <li>Aponte a câmera para o QR code abaixo.</li>
              <li>Digite aqui o código de 6 números que o app mostrar.</li>
            </ol>
            <img src={setup.qrCodeDataUrl} alt="QR code para o app autenticador" className="mt-3 h-48 w-48 rounded-lg border border-border bg-white" />
            <p className="mt-2 text-xs text-ink-soft">Sem câmera? Digite esta chave no app (tipo "baseada em tempo"):</p>
            <p className="mt-1 select-all break-all rounded-lg bg-paper p-2 font-mono text-sm tracking-wider text-ink">{setup.manualKey}</p>
            <label htmlFor="confirm-code" className="mt-3 block text-sm font-medium text-ink">Código de 6 números</label>
            <Input id="confirm-code" required autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={confirmCode} onChange={event => setConfirmCode(event.target.value)} className="mt-1.5 w-40 tracking-widest" />
            {confirmSetup.error ? <p className="mt-2 text-sm text-red-600">{confirmSetup.error.message}</p> : null}
            <div className="mt-3 flex gap-2">
              <Button type="submit" disabled={confirmSetup.isPending}>{confirmSetup.isPending ? "Conferindo…" : "Confirmar e ativar"}</Button>
              <Button type="button" variant="ghost" onClick={() => { setSetup(null); setConfirmCode(""); confirmSetup.reset(); }}>Cancelar</Button>
            </div>
          </form>
        ) : null}

        {data?.totpEnabled && !shownCodes ? (
          <div className="mt-3">
            <p className="text-sm text-ink-soft">Códigos de recuperação restantes: <strong className="text-ink">{data.recoveryCodesRemaining}</strong></p>
            {data.recoveryCodesRemaining <= LOW_CODES ? (
              <p className="mt-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900">
                {data.recoveryCodesRemaining === 0 ? "Você não tem mais códigos de recuperação." : `Restam só ${data.recoveryCodesRemaining} código(s) de recuperação.`} Gere uma lista nova antes de precisar.
              </p>
            ) : null}
            {manage ? (
              <form onSubmit={submitManage} className="mt-3 space-y-3 rounded-lg border border-border bg-paper p-3">
                <p className="text-sm font-medium text-ink">{manage === "disable" ? "Desativar a verificação em duas etapas" : "Gerar uma nova lista de códigos de recuperação"}</p>
                <p className="text-xs text-ink-soft">Confirme com a sua senha e com um código do app (ou um código de recuperação).{manage === "regenerate" ? " Os códigos antigos deixam de funcionar." : ""}</p>
                <div>
                  <label htmlFor="manage-password" className="text-xs font-medium text-ink-soft">Senha atual</label>
                  <Input id="manage-password" type="password" required autoComplete="current-password" value={managePassword} onChange={event => setManagePassword(event.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="manage-code" className="text-xs font-medium text-ink-soft">Código do app ou de recuperação</label>
                  <Input id="manage-code" required autoComplete="one-time-code" maxLength={16} value={manageCode} onChange={event => setManageCode(event.target.value)} className="mt-1 tracking-widest" />
                </div>
                {manageError ? <p className="text-sm text-red-600">{manageError.message}</p> : null}
                <div className="flex gap-2">
                  <Button type="submit" variant={manage === "disable" ? "danger" : "primary"} disabled={managePending}>{managePending ? "Aplicando…" : manage === "disable" ? "Desativar" : "Gerar novos códigos"}</Button>
                  <Button type="button" variant="ghost" onClick={closeManage}>Cancelar</Button>
                </div>
              </form>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setManage("regenerate")}>Gerar novos códigos de recuperação</Button>
                {!data.totpRequired ? <Button variant="outline" onClick={() => setManage("disable")}>Desativar</Button> : null}
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="mt-5 max-w-xl rounded-xl border border-border bg-paper-raised p-4">
        <h2 className="font-semibold text-ink">Sessões</h2>
        <p className="mt-1 text-sm text-ink-soft">Desconecta a sua conta de todos os computadores e celulares, inclusive este. Use se perdeu um aparelho ou desconfia de acesso indevido. A sessão dura no máximo 12 horas.</p>
        <Button variant="outline" className="mt-3" onClick={() => setConfirmingRevoke(true)}>Sair de todos os dispositivos</Button>
        {revokeAll.error ? <p className="mt-2 text-sm text-red-600">{revokeAll.error.message}</p> : null}
      </section>

      <ConfirmDialog
        open={confirmingRevoke}
        title="Sair de todos os dispositivos"
        description="Você será desconectado aqui e em todos os outros aparelhos, e precisará entrar de novo."
        confirmLabel="Sair de todos"
        danger
        pending={revokeAll.isPending}
        onCancel={() => setConfirmingRevoke(false)}
        onConfirm={() => revokeAll.mutate()}
      />
    </PanelLayout>
  );
}
