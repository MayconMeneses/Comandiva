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

  useEffect(() => {
    if (!loading && admin) setLocation("/");
  }, [loading, admin, setLocation]);

  const login = trpc.masterPanel.auth.login.useMutation({
    onSuccess: async () => {
      await utils.masterPanel.auth.me.invalidate();
      setLocation("/");
    },
  });

  function submitCredentials(event: FormEvent) {
    event.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-paper p-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-paper-raised p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">Área restrita</p>
        <h1 className="mt-2 text-2xl font-bold text-ink">Painel Master</h1>
        <p className="mt-1 text-sm text-ink-soft">Acesso exclusivo do proprietário da plataforma.</p>

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
          {login.error ? <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{login.error.message}</p> : null}
          <Button type="submit" disabled={login.isPending} className="mt-5 w-full">{login.isPending ? "Entrando…" : "Entrar"}</Button>
        </form>
      </div>
    </div>
  );
}
