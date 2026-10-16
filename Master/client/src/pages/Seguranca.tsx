import { PanelLayout } from "@/components/PanelLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { FormEvent, useState } from "react";
import { useLocation } from "wouter";

type Mode = "setup" | "change" | "disable" | null;

/** Cada admin cuida da própria verificação (pergunta de segurança + código de 4 números) e das próprias sessões — sem área de permissão, todo mundo logado vê esta tela. */
export default function Seguranca() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const status = trpc.masterPanel.security.status.useQuery();

  const [mode, setMode] = useState<Mode>(null);
  const [password, setPassword] = useState("");
  const [friendAnswer, setFriendAnswer] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [currentFriend, setCurrentFriend] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  const refresh = async () => {
    await Promise.all([utils.masterPanel.security.status.invalidate(), utils.masterPanel.auth.me.invalidate()]);
  };
  function close() {
    setMode(null); setPassword(""); setFriendAnswer(""); setPin(""); setPinConfirm(""); setCurrentFriend(""); setCurrentPin(""); setLocalError(null);
    setAnswers.reset(); disable.reset();
  }

  const setAnswers = trpc.masterPanel.security.setAnswers.useMutation({
    onSuccess: async () => { const wasChange = mode === "change"; close(); setSaved(wasChange ? "Pergunta e código trocados." : "Verificação ativada. No próximo login, depois da senha, o painel vai pedir a resposta e o código."); await refresh(); },
  });
  const disable = trpc.masterPanel.security.disable.useMutation({
    onSuccess: async () => { close(); setSaved("Verificação desativada."); await refresh(); },
  });
  const revokeAll = trpc.masterPanel.security.revokeAllSessions.useMutation({
    onSuccess: () => {
      // O servidor já apagou o cookie: limpa o "quem sou eu" local e volta pro login.
      utils.masterPanel.auth.me.setData(undefined, null);
      setLocation("/login");
    },
  });

  const data = status.data;
  const enabled = Boolean(data?.securityEnabled);

  function submit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    setSaved(null);
    if (mode === "disable") {
      disable.mutate({ password, current: { friendAnswer: currentFriend, pin: currentPin } });
      return;
    }
    if (pin !== pinConfirm) { setLocalError("Os dois códigos de 4 números não são iguais."); return; }
    setAnswers.mutate({ password, friendAnswer, pin, current: mode === "change" ? { friendAnswer: currentFriend, pin: currentPin } : undefined });
  }

  const error = localError ?? setAnswers.error?.message ?? disable.error?.message ?? null;
  const pending = setAnswers.isPending || disable.isPending;
  const askCurrent = mode === "change" || mode === "disable";
  const askNew = mode === "setup" || mode === "change";

  return (
    <PanelLayout>
      <h1 className="text-xl font-bold text-ink">Segurança</h1>
      <p className="mt-1 text-sm text-ink-soft">Proteja o seu acesso ao Painel Master com uma pergunta de segurança e um código de 4 números, e controle onde a sua conta está conectada.</p>

      <section className="mt-5 max-w-xl rounded-xl border border-border bg-paper-raised p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">Pergunta de segurança + código</h2>
          {data ? <Badge status={enabled ? "active" : "payment_pending"}>{enabled ? "Ativa" : "Desativada"}</Badge> : null}
        </div>

        {data?.securityRequired && !enabled ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-900">Este painel exige a verificação. Cadastre abaixo para voltar a usar as outras telas.</p>
        ) : null}
        {saved ? <p className="mt-3 rounded-lg bg-green-50 p-2.5 text-sm text-green-800">{saved}</p> : null}

        {!mode ? (
          <div className="mt-3">
            <p className="text-sm text-ink-soft">
              {enabled
                ? "Depois da senha, o login pede a resposta da pergunta e o seu código de 4 números. As respostas ficam guardadas só como hash (nem o servidor consegue ler)."
                : "Depois de cadastrar, o login passa a pedir, além da senha, a resposta da pergunta e um código de 4 números. As respostas ficam guardadas só como hash (nem o servidor consegue ler)."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {enabled ? (
                <>
                  <Button variant="outline" onClick={() => { setSaved(null); setMode("change"); }}>Trocar resposta e código</Button>
                  {!data?.securityRequired ? <Button variant="outline" onClick={() => { setSaved(null); setMode("disable"); }}>Desativar</Button> : null}
                </>
              ) : (
                <Button onClick={() => { setSaved(null); setMode("setup"); }}>Cadastrar pergunta e código</Button>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-3">
            <p className="text-sm font-medium text-ink">{mode === "setup" ? "Cadastrar pergunta e código" : mode === "change" ? "Trocar resposta e código" : "Desativar a verificação"}</p>
            <div>
              <label htmlFor="sec-password" className="text-xs font-medium text-ink-soft">Senha atual</label>
              <Input id="sec-password" type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1" />
            </div>
            {askCurrent ? (
              <div className="space-y-3 rounded-lg border border-border bg-paper p-3">
                <p className="text-xs text-ink-soft">Confirme com a resposta e o código que valem hoje.</p>
                <div>
                  <label htmlFor="sec-cur-friend" className="text-xs font-medium text-ink-soft">{data?.question ?? "Quem é o seu melhor amigo de infância?"}</label>
                  <Input id="sec-cur-friend" required autoComplete="off" maxLength={80} value={currentFriend} onChange={event => setCurrentFriend(event.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="sec-cur-pin" className="text-xs font-medium text-ink-soft">Código de 4 números atual</label>
                  <Input id="sec-cur-pin" type="password" required autoComplete="off" inputMode="numeric" maxLength={4} value={currentPin} onChange={event => setCurrentPin(event.target.value.replace(/\D/g, ""))} className="mt-1 w-32 tracking-widest" />
                </div>
              </div>
            ) : null}
            {askNew ? (
              <div className="space-y-3 rounded-lg border border-border bg-paper p-3">
                <div>
                  <label htmlFor="sec-friend" className="text-xs font-medium text-ink-soft">{data?.question ?? "Quem é o seu melhor amigo de infância?"}{mode === "change" ? " (nova resposta)" : ""}</label>
                  <Input id="sec-friend" required autoComplete="off" minLength={2} maxLength={80} value={friendAnswer} onChange={event => setFriendAnswer(event.target.value)} className="mt-1" />
                  <p className="mt-1 text-xs text-ink-soft">Maiúsculas, acentos e espaços a mais não fazem diferença na hora de entrar.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label htmlFor="sec-pin" className="text-xs font-medium text-ink-soft">Código de 4 números{mode === "change" ? " (novo)" : ""}</label>
                    <Input id="sec-pin" type="password" required autoComplete="off" inputMode="numeric" maxLength={4} minLength={4} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ""))} className="mt-1 w-32 tracking-widest" />
                  </div>
                  <div>
                    <label htmlFor="sec-pin2" className="text-xs font-medium text-ink-soft">Repita o código</label>
                    <Input id="sec-pin2" type="password" required autoComplete="off" inputMode="numeric" maxLength={4} minLength={4} value={pinConfirm} onChange={event => setPinConfirm(event.target.value.replace(/\D/g, ""))} className="mt-1 w-32 tracking-widest" />
                  </div>
                </div>
              </div>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" variant={mode === "disable" ? "danger" : "primary"} disabled={pending}>{pending ? "Aplicando…" : mode === "disable" ? "Desativar" : "Salvar"}</Button>
              <Button type="button" variant="ghost" onClick={close}>Cancelar</Button>
            </div>
          </form>
        )}
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
