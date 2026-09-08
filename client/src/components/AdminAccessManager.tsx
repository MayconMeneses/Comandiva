import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { GRANTABLE_STAFF_AREAS, STAFF_AREA_LABELS, type StaffPermissionArea } from "@shared/permissions";
import { Pencil, Plus, ShieldCheck, Trash2, UserCog, UserRoundCheck, UserRoundX } from "lucide-react";
import React, { FormEvent, useState } from "react";

type AccountRole = "admin" | "staff";
type Account = { id: number; userId: number; name: string; username: string; role: AccountRole; active: boolean; permissions: StaffPermissionArea[]; createdAt: number; lastSignedInAt: number | null; isOwner: boolean };

const roleLabel: Record<AccountRole, string> = { admin: "Administrador", staff: "Operação" };

export default function AdminAccessManager({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AccountRole>("admin");
  const [permissions, setPermissions] = useState<StaffPermissionArea[]>([]);
  const accounts = trpc.team.list.useQuery(undefined, { enabled: open });
  const create = trpc.team.create.useMutation({ onSuccess: () => { resetForm(); void accounts.refetch(); } });
  const update = trpc.team.update.useMutation({ onSuccess: () => { resetForm(); void accounts.refetch(); } });
  const setActive = trpc.team.setActive.useMutation({ onSuccess: () => void accounts.refetch() });
  const remove = trpc.team.delete.useMutation({ onSuccess: () => void accounts.refetch() });
  const saving = create.isPending || update.isPending;

  function resetForm() {
    setEditing(null); setName(""); setUsername(""); setPassword(""); setRole("admin"); setPermissions([]);
  }

  function beginEdit(account: Account) {
    setEditing(account); setName(account.name); setUsername(account.username); setPassword(""); setRole(account.role); setPermissions(account.permissions);
  }

  function toggleArea(area: StaffPermissionArea) {
    setPermissions(current => current.includes(area) ? current.filter(item => item !== area) : [...current, area]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (editing) update.mutate({ accountId: editing.id, name, password: password || undefined, permissions: editing.role === "staff" ? permissions : undefined });
    else create.mutate({ name, username, password, role, permissions: role === "staff" ? permissions : undefined });
  }

  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)} aria-label="Gerenciar acessos administrativos" className={`border-[#d8c7b0] bg-[#fffdf8] text-[#5b4639] hover:bg-[#f3e5d6] ${collapsed ? "h-10 w-10 p-0" : "h-10 w-full justify-start"}`}>
      <ShieldCheck className="h-4 w-4 shrink-0 text-[#b4472d]" />
      {!collapsed ? <span className="ml-2 truncate">Acessos administrativos</span> : null}
    </Button>
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) resetForm(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl bg-[#fffdf8] sm:max-w-3xl">
        <DialogHeader>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[#b4472d]">Permissões do painel</p>
          <DialogTitle className="font-display text-3xl">Acessos administrativos</DialogTitle>
          <DialogDescription className="text-sm leading-6">Cadastre quantos administradores forem necessários, sem limite artificial. Administradores podem acessar e alterar clientes, cardápio, pedidos, rotas, relatórios e configurações.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="mt-5 grid gap-3 rounded-2xl border border-[#e2d5c5] bg-[#fbf6ee] p-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center justify-between gap-3"><div><p className="font-semibold">{editing ? "Editar acesso" : "Novo acesso"}</p><p className="text-xs text-muted-foreground">{editing ? `Usuário ${editing.username}` : "Escolha o tipo de permissão para a nova pessoa."}</p></div>{editing ? <Button type="button" variant="ghost" onClick={resetForm} className="h-8 text-xs">Cancelar edição</Button> : null}</div>
          <div><Label htmlFor="admin-access-name">Nome da pessoa</Label><Input id="admin-access-name" required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Maria - Administrativo" className="mt-2 h-10 rounded-xl bg-white" /></div>
          <div><Label htmlFor="admin-access-username">Usuário de acesso</Label><Input id="admin-access-username" required={!editing} disabled={Boolean(editing)} value={username} onChange={event => setUsername(event.target.value)} placeholder="Ex.: maria.pubx" className="mt-2 h-10 rounded-xl bg-white" /></div>
          <div><Label htmlFor="admin-access-password">{editing ? "Nova senha (opcional)" : "Senha"}</Label><Input id="admin-access-password" required={!editing} minLength={8} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={editing ? "Deixe em branco para manter" : "Mínimo de 8 caracteres"} className="mt-2 h-10 rounded-xl bg-white" /></div>
          {!editing ? <div><Label htmlFor="admin-access-role">Tipo de acesso</Label><select id="admin-access-role" value={role} onChange={event => setRole(event.target.value as AccountRole)} className="mt-2 h-10 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#b4472d]"><option value="admin">Administrador — acesso completo</option><option value="staff">Operação — somente pedidos</option></select></div> : <div className="flex items-end"><div className="rounded-xl border border-[#e6d8c7] bg-white px-3 py-2 text-xs text-muted-foreground">Permissão atual: <strong className="text-[#5b4639]">{roleLabel[editing.role]}</strong></div></div>}
          {(editing ? editing.role === "staff" : role === "staff") ? (
            <div className="sm:col-span-2 rounded-xl border border-[#e6d8c7] bg-white p-3">
              <p className="text-xs font-semibold text-[#5b4639]">Áreas extras liberadas (além de pedidos e mesas)</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {GRANTABLE_STAFF_AREAS.map(area => (
                  <label key={area} className="flex items-center gap-2 text-sm text-[#5b4639]">
                    <input type="checkbox" checked={permissions.includes(area)} onChange={() => toggleArea(area)} className="h-4 w-4 rounded border-input accent-[#b4472d]" />
                    {STAFF_AREA_LABELS[area]}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {(create.error || update.error) ? <p className="sm:col-span-2 text-sm text-red-700">{create.error?.message || update.error?.message}</p> : null}
          <Button disabled={saving} className="sm:col-span-2 h-10 rounded-xl bg-[#b4472d] hover:bg-[#943722]"><Plus className="mr-1.5 h-4 w-4" />{saving ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar acesso"}</Button>
        </form>
        <section className="mt-6">
          <div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Pessoas com acesso</h3><p className="mt-1 text-xs text-muted-foreground">O administrador principal não pode ser removido nem pausado.</p></div><UserCog className="h-5 w-5 text-[#b4472d]" /></div>
          {accounts.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Carregando acessos…</p> : accounts.error ? <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{accounts.error.message}</p> : accounts.data?.length ? <div className="mt-3 space-y-2">{accounts.data.map(account => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e7dbcc] bg-white p-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{account.name}</p><Badge className={`border-0 ${account.role === "admin" ? "bg-[#f3e2d8] text-[#9e3f29]" : "bg-slate-100 text-slate-700"}`}>{roleLabel[account.role]}</Badge><Badge className={`border-0 ${account.active ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>{account.active ? "Ativo" : "Pausado"}</Badge>{account.isOwner ? <Badge className="border-0 bg-amber-100 text-amber-800">Principal</Badge> : null}</div><p className="mt-1 truncate text-xs text-muted-foreground">Usuário: {account.username}{account.lastSignedInAt ? ` · último acesso em ${new Date(account.lastSignedInAt).toLocaleString("pt-BR")}` : " · ainda não acessou"}</p></div><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => beginEdit(account)} className="h-8 px-2 text-[#76533e]" aria-label={`Editar acesso de ${account.name}`}><Pencil className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="sm" disabled={account.isOwner || setActive.isPending} onClick={() => setActive.mutate({ accountId: account.id, active: !account.active })} className="h-8 px-2 text-[#76533e]" aria-label={`${account.active ? "Pausar" : "Reativar"} acesso de ${account.name}`}>{account.active ? <UserRoundX className="h-3.5 w-3.5" /> : <UserRoundCheck className="h-3.5 w-3.5" />}</Button><Button type="button" variant="ghost" size="sm" disabled={account.isOwner || remove.isPending} onClick={() => { if (window.confirm(`Remover o acesso de ${account.name}?`)) remove.mutate({ accountId: account.id }); }} className="h-8 px-2 text-red-700 hover:text-red-800" aria-label={`Remover acesso de ${account.name}`}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-[#d9cdbc] p-4 text-sm text-muted-foreground">Nenhum acesso local cadastrado ainda.</p>}
        </section>
      </DialogContent>
    </Dialog>
  </>;
}
