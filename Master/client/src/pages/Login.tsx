import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import { trpc } from "@/lib/trpc";
import { useNoIndex } from "@/lib/useNoIndex";
import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Login() {
  useNoIndex();
  const { admin, loading } = usePlatformAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Passo 2 (só contas com verificação em duas etapas): o servidor devolve um
  // token temporário depois da senha, e o código é conferido separadamente.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  useEffect(() => {
    if (!loading && admin) setLocation(admin.mustSetupTotp ? "/seguranca" : "/");
  }, [loading, admin, setLocation]);

  const login = trpc.masterPanel.auth.login.useMutation({
    onSuccess: async result => {
      if (result.requiresTotp) {
        setPendingToken(result.pendingToken);
        return;
      }
      await utils.masterPanel.auth.me.invalidate();
      setLocation("/");
    },
  });

  const verifyTotp = trpc.masterPanel.auth.verifyTotp.useMutation({
    onSuccess: async result => {
      await utils.masterPanel.auth.me.invalidate();
      // Poucos códigos de recuperação sobrando: leva direto pra tela Segurança, onde o aviso aparece.
      setLocation(result.recoveryCodesRemaining !== null ? "/seguranca" : "/");
    },
  });

  function submitCredentials(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (pendingToken) verifyTotp.mutate({ pendingToken, code });
  }

  function backToCredentials() {
    setPendingToken(null);
    setCode("");
    setUseRecoveryCode(false);
    setPassword("");
    verifyTotp.reset();
    login.reset();
  }

  return (
    <div className="grid min-h-screen place-items-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-paper-raised p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">Área restrita</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Painel Master</h1>

        {pendingToken ? (
          <form onSubmit={submitCode}>
            <p className="mt-1 text-sm text-ink-soft">
              {useRecoveryCode
                ? "Digite um dos códigos de recuperação que você guardou. Cada código só funciona uma vez."
                : "Abra o app autenticador no celular e digite o código de 6 números que aparece para o Painel Master."}
            </p>
            <div className="mt-5">
              <label htmlFor="code" className="text-sm font-medium text-ink">{useRecoveryCode ? "Código de recuperação" : "Código de 6 números"}</label>
              <Input
                id="code"
                required
                autoFocus
                autoComplete="one-time-code"
                inputMode={useRecoveryCode ? "text" : "numeric"}
                maxLength={useRecoveryCode ? 16 : 6}
                placeholder={useRecoveryCode ? "XXXXX-XXXXX" : "000000"}
                value={code}
                onChange={event => setCode(event.target.value)}
                className="mt-1.5 tracking-widest"
              />
            </div>
            {verifyTotp.error ? <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{verifyTotp.error.message}</p> : null}
            <Button type="submit" disabled={verifyTotp.isPending} className="mt-5 w-full">{verifyTotp.isPending ? "Conferindo…" : "Entrar"}</Button>
            <button
              type="button"
              onClick={() => { setUseRecoveryCode(value => !value); setCode(""); verifyTotp.reset(); }}
              className="mt-3 w-full text-center text-sm font-medium text-accent hover:underline"
            >
              {useRecoveryCode ? "Usar o código do app autenticador" : "Perdi o celular — usar código de recuperação"}
            </button>
            <button type="button" onClick={backToCredentials} className="mt-2 w-full text-center text-sm text-ink-soft hover:underline">Voltar</button>
          </form>
        ) : (
          <form onSubmit={submitCredentials}>
            <p className="mt-1 text-sm text-ink-soft">Acesso exclusivo do proprietário da plataforma.</p>
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
            {login.error ? <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{login.error.message}</p> : null}
            <Button type="submit" disabled={login.isPending} className="mt-5 w-full">{login.isPending ? "Entrando…" : "Entrar"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
