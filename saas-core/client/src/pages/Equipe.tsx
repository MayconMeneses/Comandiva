import { PanelLayout } from "@/components/PanelLayout";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { usePlatformAuth } from "@/hooks/usePlatformAuth";
import { trpc } from "@/lib/trpc";
import { GRANTABLE_MASTER_AREAS, MASTER_AREA_LABELS, type MasterPermissionArea } from "@shared/permissions";
import { FormEvent, useState } from "react";

type Role = "owner" | "member";
type Admin = { id: number; name: string; email: string; role: Role; permissions: MasterPermissionArea[]; active: boolean; lastSignedInAt: number | null };

const ROLE_LABEL: Record<Role, string> = { owner: "Owner — acesso completo", member: "Membro — só as áreas marcadas" };

export default function Equipe() {
  const { admin: currentAdmin } = usePlatformAuth();
  const utils = trpc.useUtils();
  const list = trpc.masterPanel.team.list.useQuery();
  const [editing, setEditing] = useState<Admin | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [permissions, setPermissions] = useState<MasterPermissionArea[]>([]);
  const [pendingToggle, setPendingToggle] = useState<Admin | null>(null);

  const refresh = () => void utils.masterPanel.team.list.invalidate();
  const create = trpc.masterPanel.team.create.useMutation({ onSuccess: () => { resetForm(); refresh(); } });
  const update = trpc.masterPanel.team.update.useMutation({ onSuccess: () => { resetForm(); refresh(); } });
  const setActive = trpc.masterPanel.team.setActive.useMutation({ onSuccess: () => { setPendingToggle(null); refresh(); } });

  function resetForm() {
    setCreating(false); setEditing(null); setName(""); setEmail(""); setPassword(""); setRole("member"); setPermissions([]);
  }
  function beginCreate() {
    resetForm(); setCreating(true);
  }
  function beginEdit(a: Admin) {
    setCreating(false); setEditing(a); setName(a.name); setEmail(a.email); setPassword(""); setRole(a.role); setPermissions(a.permissions);
  }
  function toggleArea(area: MasterPermissionArea) {
    setPermissions(current => (current.includes(area) ? current.filter(item => item !== area) : [...current, area]));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (editing) update.mutate({ adminId: editing.id, name, password: password || undefined, permissions: editing.role === "member" ? permissions : undefined });
    else create.mutate({ name, email, password, role, permissions: role === "member" ? permissions : undefined });
  }

  const saving = create.isPending || update.isPending;
  const showPermissions = editing ? editing.role === "member" : role === "member";

  return (
    <PanelLayout>
      <h1 className="text-xl font-bold text-ink">Equipe</h1>
      <p className="mt-1 text-sm text-ink-soft">Cadastre outras contas do Painel Master. "Owner" tem acesso total; "Membro" só vê/edita as áreas marcadas abaixo.</p>

      {!creating && !editing ? (
        <Button className="mt-4" onClick={beginCreate}>Novo acesso</Button>
      ) : (
        <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-border bg-paper-raised p-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center justify-between">
            <p className="font-semibold text-ink">{editing ? `Editar acesso de ${editing.name}` : "Novo acesso"}</p>
            <Button type="button" variant="ghost" onClick={resetForm}>Cancelar</Button>
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">Nome</label>
            <Input required value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: Ana" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">E-mail (login)</label>
            <Input required type="email" disabled={Boolean(editing)} value={email} onChange={event => setEmail(event.target.value)} placeholder="ana@exemplo.com" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-soft">{editing ? "Nova senha (opcional)" : "Senha"}</label>
            <Input required={!editing} minLength={8} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder={editing ? "Deixe em branco para manter" : "Mínimo de 8 caracteres"} className="mt-1" />
          </div>
          {!editing ? (
            <div>
              <label className="text-xs font-medium text-ink-soft">Tipo de acesso</label>
              <select value={role} onChange={event => setRole(event.target.value as Role)} className="mt-1 h-9 w-full rounded-lg border border-border bg-paper-raised px-2 text-sm text-ink">
                <option value="owner">{ROLE_LABEL.owner}</option>
                <option value="member">{ROLE_LABEL.member}</option>
              </select>
            </div>
          ) : (
            <div className="flex items-end text-xs text-ink-soft">Papel atual: <strong className="ml-1 text-ink">{ROLE_LABEL[editing.role]}</strong></div>
          )}
          {showPermissions ? (
            <div className="sm:col-span-2 rounded-lg border border-border bg-paper p-3">
              <p className="text-xs font-semibold text-ink">Áreas liberadas</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {GRANTABLE_MASTER_AREAS.map(area => (
                  <label key={area} className="flex items-center gap-2 text-sm text-ink-soft">
                    <input type="checkbox" checked={permissions.includes(area)} onChange={() => toggleArea(area)} className="h-4 w-4 rounded border-border accent-accent" />
                    {MASTER_AREA_LABELS[area]}
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          {(create.error || update.error) ? <p className="sm:col-span-2 text-sm text-red-600">{create.error?.message || update.error?.message}</p> : null}
          <Button type="submit" disabled={saving} className="sm:col-span-2">{saving ? "Salvando…" : editing ? "Salvar alterações" : "Cadastrar acesso"}</Button>
        </form>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-paper-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-ink-soft">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Último acesso</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.data?.map(a => (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{a.name}</p>
                  <p className="text-xs text-ink-soft">{a.email}</p>
                </td>
                <td className="px-4 py-3"><Badge status={a.role === "owner" ? "active" : "trial"}>{ROLE_LABEL[a.role]}</Badge></td>
                <td className="px-4 py-3"><Badge status={a.active ? "active" : "cancelled"}>{a.active ? "Ativo" : "Pausado"}</Badge></td>
                <td className="px-4 py-3 text-ink-soft">{a.lastSignedInAt ? new Date(a.lastSignedInAt).toLocaleString("pt-BR") : "ainda não acessou"}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" onClick={() => beginEdit(a)}>Editar</Button>
                  <Button variant="ghost" disabled={a.id === currentAdmin?.id} onClick={() => setPendingToggle(a)}>{a.active ? "Pausar" : "Reativar"}</Button>
                </td>
              </tr>
            ))}
            {list.data && !list.data.length ? <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-soft">Nenhum acesso cadastrado ainda.</td></tr> : null}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(pendingToggle)}
        title={pendingToggle?.active ? "Pausar acesso" : "Reativar acesso"}
        description={`${pendingToggle?.active ? "Pausar" : "Reativar"} o acesso de ${pendingToggle?.name} ao Painel Master?`}
        danger={pendingToggle?.active}
        pending={setActive.isPending}
        onCancel={() => setPendingToggle(null)}
        onConfirm={() => pendingToggle && setActive.mutate({ adminId: pendingToggle.id, active: !pendingToggle.active })}
      />
    </PanelLayout>
  );
}
