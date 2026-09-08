import ReservationsManager from "@/components/ReservationsManager";
import TableConfigManager from "@/components/TableConfigManager";
import TableMapManager from "@/components/TableMapManager";
import { Header, Loading } from "@/components/admin/shared";
import { LockedFeatureFullPage } from "@/components/admin/LockedFeature";
import { trpc } from "@/lib/trpc";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

function CollapsibleSection({ title, description, count, children }: { title: string; description: string; count?: number; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return <section className="overflow-hidden rounded-2xl border border-[#e4d8c8] bg-[#fffdf8]">
    <button type="button" onClick={() => setIsOpen(value => !value)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-[#f6ede0]">
      <div className="min-w-0"><h3 className="font-display text-2xl font-bold">{title}{typeof count === "number" ? ` (${count})` : ""}</h3><p className="text-sm text-muted-foreground">{description}</p></div>
      <ChevronDown className={`h-5 w-5 shrink-0 text-[#8a5c3f] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
    </button>
    <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}><div className="overflow-hidden"><div className="border-t border-[#eee5d9] p-4">{children}</div></div></div>
  </section>;
}

export default function TablesAdmin() {
  const snapshot = trpc.admin.mySnapshot.useQuery();
  if (snapshot.isLoading) return <Loading />;
  const locked = snapshot.data?.lockedFeatures.tables_qr;
  if (locked) return <LockedFeatureFullPage requiredPlanName={locked.requiredPlanName} />;
  return <div className="space-y-6">
    <Header eyebrow="Salão" title="Mesas" description="Acompanhe as comandas abertas, cadastre mesas e gerencie reservas." />
    <TableMapManager />
    <CollapsibleSection title="Configurar mesas" description="Cadastrar, ativar/desativar e gerar QR Code por mesa.">
      <TableConfigManager />
    </CollapsibleSection>
    <CollapsibleSection title="Reservas" description="Registro de reservas feitas por telefone/WhatsApp.">
      <ReservationsManager />
    </CollapsibleSection>
  </div>;
}
