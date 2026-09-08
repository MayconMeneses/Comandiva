import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { FormEvent, useState } from "react";

/**
 * Formulário de login da equipe/administrador, compartilhado entre o painel
 * de pedidos (/painel-pedidos) e o painel administrativo (/admin) — ambos
 * autenticam pela mesma mutation `team.login`, só muda o texto de contexto.
 */
export default function TeamLoginCard({ title, subtitle, submitLabel = "Entrar" }: { title: string; subtitle: string; submitLabel?: string }) {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [visible, setVisible] = useState(false);
  const login = trpc.team.login.useMutation({ onSuccess: () => window.location.reload() });
  const submit = (event: FormEvent) => { event.preventDefault(); login.mutate({ username, password }); };
  return <div className="w-full max-w-md rounded-3xl border border-[#e2d5c5] bg-[#fffdf8] p-6 text-left shadow-[0_18px_50px_rgba(53,34,17,.10)] sm:p-8">
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f3e2d8] text-[#b4472d]"><KeyRound className="h-6 w-6" /></div>
    <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-[#b4472d]">Área restrita</p>
    <h1 className="mt-2 font-display text-4xl font-bold">{title}</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">{subtitle}</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div><Label htmlFor="staff-username">Usuário</Label><Input id="staff-username" required autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} placeholder="Ex.: cozinha.pubx" className="mt-2 h-11 rounded-xl bg-[#fffdfa]" /></div>
      <div><Label htmlFor="staff-password">Senha</Label><div className="relative mt-2"><Input id="staff-password" required type={visible ? "text" : "password"} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Sua senha" className="h-11 rounded-xl bg-[#fffdfa] pr-11" /><button type="button" onClick={() => setVisible(value => !value)} className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground hover:bg-[#f1e7da]" aria-label={visible ? "Ocultar senha" : "Mostrar senha"}>{visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
      {login.error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{login.error.message}</p> : null}
      <Button disabled={login.isPending} className="h-11 w-full rounded-xl bg-[#b4472d] hover:bg-[#943722]">{login.isPending ? "Entrando…" : submitLabel}</Button>
    </form>
    <p className="mt-6 border-t border-[#e9ddce] pt-5 text-center text-xs text-muted-foreground">Acesso realizado exclusivamente com usuário e senha locais cadastrados pelo administrador.</p>
  </div>;
}
