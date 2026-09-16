import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import QRCode from "qrcode";
import { Loader2, Plus, QrCode as QrCodeIcon, RefreshCw, RotateCcw } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

function RecentClosedSessions() {
  const utils = trpc.useUtils();
  const closed = trpc.admin.recentClosedSessions.useQuery();
  const reopen = trpc.admin.reopenSession.useMutation({
    onSuccess: () => { void utils.admin.recentClosedSessions.invalidate(); void utils.admin.tables.invalidate(); void utils.admin.operationalSnapshot.invalidate(); toast.success("Comanda reaberta."); },
    onError: error => toast.error(error.message),
  });
  if (!closed.data?.length) return null;
  return <div className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-4">
    <h3 className="text-sm font-semibold">Comandas fechadas recentemente</h3>
    <p className="text-xs text-muted-foreground">Fechou por engano? Reabra aqui — só funciona se a mesa não tiver sido ocupada de novo.</p>
    <div className="mt-3 space-y-2">{closed.data.map(({ session, tableLabel }) => <div key={session.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#eee5d9] p-2.5 text-sm"><div><span className="font-medium">{tableLabel}</span><span className="ml-2 text-xs text-muted-foreground">{session.closedAt ? new Date(session.closedAt).toLocaleString("pt-BR") : ""}</span></div><Button variant="outline" size="sm" disabled={reopen.isPending} onClick={() => reopen.mutate({ sessionId: session.id })} className="h-8 rounded-lg text-xs"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reabrir</Button></div>)}</div>
  </div>;
}

function TableQrDialog({ table, onClose }: { table: { id: number; label: string; qrToken: string }; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const url = `${window.location.origin}/mesa/${table.qrToken}`;
  const regenerate = trpc.admin.regenerateQr.useMutation({ onSuccess: () => { void utils.admin.tables.invalidate(); void utils.admin.operationalSnapshot.invalidate(); }, onError: error => toast.error(error.message) });
  useEffect(() => { void QRCode.toDataURL(url, { width: 320, margin: 1 }).then(setDataUrl); }, [url]);
  return <Dialog open onOpenChange={value => { if (!value) onClose(); }}><DialogContent className="rounded-2xl bg-[#fffdf8] sm:max-w-sm">
    <DialogHeader><DialogTitle className="font-display text-2xl">QR Code — {table.label}</DialogTitle><p className="text-sm text-muted-foreground">Imprima e cole na mesa. O cliente escaneia e pede direto por ela.</p></DialogHeader>
    <div className="mt-4 grid place-items-center gap-3">
      {dataUrl ? <img src={dataUrl} alt={`QR Code da ${table.label}`} className="h-64 w-64 rounded-xl border border-[#e4d8c8] bg-white p-2" /> : <div className="grid h-64 w-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
      <code className="w-full truncate rounded-lg bg-[#f3ece1] px-2 py-1.5 text-center text-xs">{url}</code>
      <div className="flex gap-2"><Button variant="outline" onClick={() => window.print()} className="h-9 rounded-lg text-xs">Imprimir</Button><Button variant="outline" disabled={regenerate.isPending} onClick={() => { if (window.confirm("Gerar um novo código para esta mesa? O QR Code impresso atual deixará de funcionar.")) regenerate.mutate({ id: table.id }); }} className="h-9 rounded-lg text-xs"><RefreshCw className="mr-1.5 h-3.5 w-3.5" />{regenerate.isPending ? "Gerando…" : "Gerar novo código"}</Button></div>
    </div>
  </DialogContent></Dialog>;
}

function NewTableForm() {
  const utils = trpc.useUtils();
  const [label, setLabel] = useState(""); const [sector, setSector] = useState(""); const [capacity, setCapacity] = useState("4");
  const create = trpc.admin.createTable.useMutation({ onSuccess: () => { setLabel(""); setCapacity("4"); void utils.admin.tables.invalidate(); void utils.admin.operationalSnapshot.invalidate(); }, onError: error => toast.error(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ label, sector, capacity: Number(capacity) || 4 }); };
  return <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-[#e2d5c5] bg-[#fbf6ee] p-4 sm:grid-cols-4">
    <div><Label className="text-xs">Nome da mesa</Label><Input required value={label} onChange={event => setLabel(event.target.value)} placeholder="Ex.: Mesa 12" className="mt-1.5 h-10 rounded-xl bg-white" /></div>
    <div><Label className="text-xs">Setor</Label><Input value={sector} onChange={event => setSector(event.target.value)} placeholder="Ex.: Varanda" className="mt-1.5 h-10 rounded-xl bg-white" /></div>
    <div><Label className="text-xs">Lugares</Label><Input type="number" min={1} value={capacity} onChange={event => setCapacity(event.target.value)} className="mt-1.5 h-10 rounded-xl bg-white" /></div>
    <Button disabled={create.isPending} className="mt-auto h-10 rounded-xl bg-primary hover:bg-primary-hover"><Plus className="mr-1.5 h-4 w-4" />{create.isPending ? "Criando…" : "Adicionar mesa"}</Button>
  </form>;
}

export default function TableConfigManager() {
  const utils = trpc.useUtils();
  const tables = trpc.admin.tables.useQuery();
  const [qrTable, setQrTable] = useState<{ id: number; label: string; qrToken: string } | null>(null);
  const updateTable = trpc.admin.updateTable.useMutation({ onSuccess: () => { void utils.admin.tables.invalidate(); void utils.admin.operationalSnapshot.invalidate(); }, onError: error => toast.error(error.message) });

  return <div className="space-y-4">
    <NewTableForm />
    <RecentClosedSessions />
    <div className="overflow-hidden rounded-2xl border border-[#e4d8c8] bg-[#fffdf8]"><div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-[#f8f1e7] text-xs font-bold uppercase tracking-[.1em] text-[#786c60]"><tr><th className="px-4 py-3">Mesa</th><th className="px-4 py-3">Setor</th><th className="px-4 py-3">Lugares</th><th className="px-4 py-3">Ativa</th><th className="px-4 py-3 text-right">QR Code</th></tr></thead><tbody>{(tables.data ?? []).map(row => <tr key={row.table.id} className="border-t border-[#eee5d9]"><td className="px-4 py-3 font-semibold">{row.table.label}</td><td className="px-4 py-3">{row.table.sector || "—"}</td><td className="px-4 py-3">{row.table.capacity}</td><td className="px-4 py-3"><Switch checked={row.table.active} onCheckedChange={active => updateTable.mutate({ id: row.table.id, active })} /></td><td className="px-4 py-3 text-right"><Button variant="outline" size="sm" onClick={() => setQrTable(row.table)} className="h-8 rounded-lg text-xs"><QrCodeIcon className="mr-1.5 h-3.5 w-3.5" />Ver QR</Button></td></tr>)}</tbody></table></div>{!tables.data?.length && <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma mesa cadastrada ainda.</p>}</div>
    {qrTable && <TableQrDialog table={qrTable} onClose={() => setQrTable(null)} />}
  </div>;
}
