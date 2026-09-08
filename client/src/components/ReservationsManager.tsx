import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CalendarClock, Plus } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = { REQUESTED: "Solicitada", CONFIRMED: "Confirmada", SEATED: "Sentou", CANCELLED: "Cancelada", NO_SHOW: "Não veio" };
const STATUS_TONE: Record<string, string> = { REQUESTED: "bg-amber-100 text-amber-800", CONFIRMED: "bg-sky-100 text-sky-800", SEATED: "bg-emerald-100 text-emerald-800", CANCELLED: "bg-stone-200 text-stone-700", NO_SHOW: "bg-red-100 text-red-800" };

function NewReservationForm() {
  const utils = trpc.useUtils();
  const [customerName, setCustomerName] = useState(""); const [customerPhone, setCustomerPhone] = useState(""); const [partySize, setPartySize] = useState("2"); const [dateTime, setDateTime] = useState(""); const [notes, setNotes] = useState("");
  const create = trpc.admin.createReservation.useMutation({
    onSuccess: () => { setCustomerName(""); setCustomerPhone(""); setPartySize("2"); setDateTime(""); setNotes(""); void utils.admin.reservations.invalidate(); toast.success("Reserva registrada."); },
    onError: error => toast.error(error.message),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const reservedFor = dateTime ? new Date(dateTime).getTime() : NaN;
    if (Number.isNaN(reservedFor)) { toast.error("Informe data e hora da reserva."); return; }
    create.mutate({ customerName, customerPhone: customerPhone.replace(/\D/g, ""), partySize: Number(partySize) || 1, reservedFor, notes: notes || undefined });
  };
  return <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-[#e2d5c5] bg-[#fbf6ee] p-4 sm:grid-cols-5">
    <div><Label className="text-xs">Nome</Label><Input required value={customerName} onChange={event => setCustomerName(event.target.value)} className="mt-1.5 h-10 rounded-xl bg-white" /></div>
    <div><Label className="text-xs">Telefone</Label><Input required value={customerPhone} onChange={event => setCustomerPhone(event.target.value)} placeholder="(85) 99999-9999" className="mt-1.5 h-10 rounded-xl bg-white" /></div>
    <div><Label className="text-xs">Pessoas</Label><Input type="number" min={1} value={partySize} onChange={event => setPartySize(event.target.value)} className="mt-1.5 h-10 rounded-xl bg-white" /></div>
    <div><Label className="text-xs">Data e hora</Label><Input required type="datetime-local" value={dateTime} onChange={event => setDateTime(event.target.value)} className="mt-1.5 h-10 rounded-xl bg-white" /></div>
    <div className="sm:col-span-5"><Label className="text-xs">Observação</Label><Input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Ex.: aniversário, mesa perto da janela…" className="mt-1.5 h-10 rounded-xl bg-white" /></div>
    <Button disabled={create.isPending} className="sm:col-span-5 h-10 rounded-xl bg-[#b4472d] hover:bg-[#943722]"><Plus className="mr-1.5 h-4 w-4" />{create.isPending ? "Registrando…" : "Registrar reserva"}</Button>
  </form>;
}

export default function ReservationsManager() {
  const utils = trpc.useUtils();
  const reservations = trpc.admin.reservations.useQuery({});
  const updateStatus = trpc.admin.updateReservation.useMutation({ onSuccess: () => void utils.admin.reservations.invalidate(), onError: error => toast.error(error.message) });
  const upcoming = (reservations.data ?? []).filter(reservation => reservation.status !== "CANCELLED" && reservation.status !== "NO_SHOW");
  const past = (reservations.data ?? []).filter(reservation => reservation.status === "CANCELLED" || reservation.status === "NO_SHOW");

  return <div className="space-y-4">
    <NewReservationForm />
    <div className="space-y-2">{upcoming.length ? upcoming.map(reservation => <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e4d8c8] bg-[#fffdf8] p-3"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f3e2d8] text-[#b4472d]"><CalendarClock className="h-4 w-4" /></span><div><p className="text-sm font-semibold">{reservation.customerName} · {reservation.partySize} pessoa(s)</p><p className="text-xs text-muted-foreground">{new Date(reservation.reservedFor).toLocaleString("pt-BR")} · {reservation.customerPhone}{reservation.notes ? ` · ${reservation.notes}` : ""}</p></div></div><div className="flex items-center gap-2"><Badge className={`border-0 ${STATUS_TONE[reservation.status]}`}>{STATUS_LABEL[reservation.status]}</Badge><select value={reservation.status} onChange={event => updateStatus.mutate({ id: reservation.id, status: event.target.value as typeof reservation.status })} className="h-8 rounded-lg border border-[#d9c9b4] bg-white px-2 text-xs">{Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>) : <p className="rounded-2xl border border-dashed border-[#d9cdbc] bg-[#fffdfa] p-6 text-center text-sm text-muted-foreground">Nenhuma reserva futura.</p>}</div>
    {past.length > 0 && <details className="rounded-2xl border border-[#e4d8c8] bg-[#fffdf8] p-3"><summary className="cursor-pointer text-sm font-semibold">Canceladas / não vieram ({past.length})</summary><div className="mt-2 space-y-1 text-xs text-muted-foreground">{past.map(reservation => <p key={reservation.id}>{reservation.customerName} · {new Date(reservation.reservedFor).toLocaleString("pt-BR")} · {STATUS_LABEL[reservation.status]}</p>)}</div></details>}
  </div>;
}
