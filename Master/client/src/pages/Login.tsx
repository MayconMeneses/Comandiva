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
  // Passo 2 (só contas com a verificação cadastrada): o servidor devolve um token
  // temporário depois da senha, e a pergunta de segurança + o código de 4 números
  // são conferidos separadamente.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [friendAnswer, setFriendAnswer] = useState("");
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (!loading && admin) setLocation(admin.mustSetupSecurity ? "/seguranca" : "/");
  }, [loading, admin, setLocation]);

  const login = trpc.masterPanel.auth.login.useMutation({
    onSuccess: async result => {
      if (result.requiresSecurity) {
        setPendingToken(result.pendingToken);
        return;
      }
      await utils.masterPanel.auth.me.invalidate();
      setLocation("/");
    },
  });

  const verifySecurity = trpc.masterPanel.auth.verifySecurity.useMutation({
    onSuccess: async () => {
      await utils.masterPanel.auth.me.invalidate();
      setLocation("/");
    },
  });

  function submitCredentials(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  function submitAnswers(event: FormEvent) {
    event.preventDefault();
    if (pendingToken) verifySecurity.mutate({ pendingToken, friendAnswer, pin });
  }

  function backToCredentials() {
    setPendingToken(null);
    setFriendAnswer("");
    setPin("");
    setPassword("");
    verifySecurity.reset();
    login.reset();
  }

  return (
    <div className="grid min-h-screen place-items-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-paper-raised p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">Área restrita</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Painel Master</h1>

        {pendingToken ? (
          <form onSubmit={submitAnswers}>
            <p className="mt-1 text-sm text-ink-soft">Mais uma confirmação: responda a pergunta de segurança e digite o seu código de 4 números.</p>
            <div className="mt-5 space-y-3">
              <div>
                <label htmlFor="friend" className="text-sm font-medium text-ink">Quem é o seu melhor amigo de infância?</label>
                <Input id="friend" required autoFocus autoComplete="off" maxLength={80} value={friendAnswer} onChange={event => setFriendAnswer(event.target.value)} className="mt-1.5" />
              </div>
              <div>
                <label htmlFor="pin" className="text-sm font-medium text-ink">Código de 4 números</label>
                <Input id="pin" type="password" required autoComplete="off" inputMode="numeric" maxLength={4} placeholder="0000" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ""))} className="mt-1.5 w-32 tracking-widest" />
              </div>
            </div>
            {verifySecurity.error ? <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{verifySecurity.error.message}</p> : null}
            <Button type="submit" disabled={verifySecurity.isPending} className="mt-5 w-full">{verifySecurity.isPending ? "Conferindo…" : "Entrar"}</Button>
            <button type="button" onClick={backToCredentials} className="mt-3 w-full text-center text-sm text-ink-soft hover:underline">Voltar</button>
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
