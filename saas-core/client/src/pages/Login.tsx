import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import { trpc } from "@/lib/trpc";
import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";

type Step = "credentials" | "totp-setup" | "totp-verify";

export default function Login() {
  const { admin, loading } = usePlatformAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && admin) setLocation("/");
  }, [loading, admin, setLocation]);

  async function onFullyAuthenticated() {
    await utils.masterPanel.auth.me.invalidate();
    setLocation("/");
  }

  const login = trpc.masterPanel.auth.login.useMutation({
    onSuccess: data => {
      if ("requiresTotpSetup" in data && data.requiresTotpSetup) {
        setPendingToken(data.pendingToken);
        setQrCodeDataUrl(data.qrCodeDataUrl);
        setStep("totp-setup");
        return;
      }
      if ("requiresTotpToken" in data && data.requiresTotpToken) {
        setPendingToken(data.pendingToken);
        setStep("totp-verify");
        return;
      }
      void onFullyAuthenticated();
    },
  });

  const confirmTotpSetup = trpc.masterPanel.auth.confirmTotpSetup.useMutation({
    onSuccess: () => void onFullyAuthenticated(),
  });

  function submitCredentials(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  function submitTotpVerify(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password, totpToken: code });
  }

  function submitTotpSetup(event: FormEvent) {
    event.preventDefault();
    if (!pendingToken) return;
    confirmTotpSetup.mutate({ pendingToken, code });
  }

  const error = login.error ?? confirmTotpSetup.error;

  return (
    <div className="grid min-h-screen place-items-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-paper-raised p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">Área restrita</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Painel Master</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {step === "credentials" && "Acesso exclusivo do proprietário da plataforma."}
          {step === "totp-verify" && "Digite o código do seu aplicativo autenticador."}
          {step === "totp-setup" && "Configure a autenticação em duas etapas pra continuar."}
        </p>

        {step === "credentials" && (
          <form onSubmit={submitCredentials}>
            <div className="mt-5 space-y-3">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-ink">E-mail</label>
                <Input id="email" type="email" required autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} className="mt-1.5" />
              </div>
              <div>
                <label htmlFor="password" className="text-sm font-medium text-ink">Senha</label>
                <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5" />
              </div>
            </div>
            {error ? <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error.message}</p> : null}
            <Button type="submit" disabled={login.isPending} className="mt-5 w-full">{login.isPending ? "Entrando…" : "Entrar"}</Button>
          </form>
        )}

        {step === "totp-verify" && (
          <form onSubmit={submitTotpVerify}>
            <div className="mt-5">
              <label htmlFor="code" className="text-sm font-medium text-ink">Código de 6 dígitos</label>
              <Input id="code" inputMode="numeric" autoFocus maxLength={6} required value={code} onChange={event => setCode(event.target.value)} className="mt-1.5" />
            </div>
            {error ? <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error.message}</p> : null}
            <Button type="submit" disabled={login.isPending} className="mt-5 w-full">{login.isPending ? "Confirmando…" : "Confirmar"}</Button>
          </form>
        )}

        {step === "totp-setup" && (
          <form onSubmit={submitTotpSetup}>
            <p className="mt-4 text-sm text-ink-soft">
              Escaneie o QR code com um aplicativo autenticador (Google Authenticator, Authy, 1Password) e digite o código gerado.
            </p>
            {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="QR code para configurar a autenticação em duas etapas" className="mx-auto mt-4" />}
            <div className="mt-4">
              <label htmlFor="setupCode" className="text-sm font-medium text-ink">Código de 6 dígitos</label>
              <Input id="setupCode" inputMode="numeric" autoFocus maxLength={6} required value={code} onChange={event => setCode(event.target.value)} className="mt-1.5" />
            </div>
            {error ? <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error.message}</p> : null}
            <Button type="submit" disabled={confirmTotpSetup.isPending} className="mt-5 w-full">
              {confirmTotpSetup.isPending ? "Confirmando…" : "Ativar 2FA e entrar"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
