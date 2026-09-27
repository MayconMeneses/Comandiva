import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { useMercadoPagoSecurity } from "@/lib/useMercadoPagoSecurity";
import { FormEvent, useState } from "react";
import { Link, useParams } from "wouter";
import { ComercialHeader } from "./ComercialHeader";

const PLAN_LABELS: Record<string, string> = { essencial: "Entrada", profissional: "Profissional", premium: "Premium" };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function Cadastro() {
  useMercadoPagoSecurity();
  const { planKey } = useParams<{ planKey: string }>();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const plansQuery = trpc.public.plans.useQuery();
  const implementationFeeCents = plansQuery.data?.implementationFeeCents ?? 15000;

  const signup = trpc.public.signup.useMutation({
    onSuccess: data => {
      // Nunca navega pro "sucesso" direto — o cadastro só vira restaurante de
      // verdade depois que o webhook confirmar o pagamento (nunca só pelo
      // retorno da URL). O Mercado Pago é quem manda de volta pra
      // /comercial/cadastro/confirmando quando o cliente terminar por lá.
      window.location.href = data.checkoutUrl;
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // window.MP_DEVICE_SESSION_ID é setado pelo security.js (ver
    // useMercadoPagoSecurity, importado acima) — sem mandar isso pro
    // backend, que repassa pro Mercado Pago via header X-meli-session-id
    // na criação da preferência, o checkout hospedado deles pode travar o
    // botão de pagar (visto em produção no Safari/iPhone).
    const deviceId = (window as unknown as { MP_DEVICE_SESSION_ID?: string }).MP_DEVICE_SESSION_ID;
    signup.mutate({
      name,
      planKey: planKey as "essencial" | "profissional" | "premium",
      contactName,
      contactEmail,
      contactPhone,
      returnOrigin: window.location.origin,
      deviceId,
    });
  };

  const planLabel = PLAN_LABELS[planKey ?? ""] ?? planKey;

  return (
    <div className="comercial-dark min-h-screen bg-paper text-ink">
      <ComercialHeader showNav={false} />
      <div className="mx-auto max-w-md px-6 py-12">
        <Link
          href="/comercial/planos"
          className="rounded text-sm text-ink-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          ← Voltar para os planos
        </Link>

        <form onSubmit={submit} className="mt-6 rounded-2xl border border-border bg-paper-raised p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">Assinar {planLabel}</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">Cadastre seu restaurante</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Nossa equipe organiza seu cardápio e sua configuração em até 10 dias úteis — podendo ser
            antes. Só depois de tudo pronto é que seu teste grátis de 7 dias começa a valer.
          </p>

          <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-3 text-sm">
            <p className="font-semibold text-ink">Taxa de implementação: {money(implementationFeeCents)}</p>
            <p className="mt-1 text-ink-soft">
              Cobre a configuração completa do seu sistema. Cobrada agora, ao confirmar o cadastro, via
              Mercado Pago.
            </p>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label htmlFor="name" className="text-sm font-medium text-ink">
                Nome do restaurante
              </label>
              <Input id="name" required value={name} onChange={event => setName(event.target.value)} className="mt-1.5" />
            </div>
            <div>
              <label htmlFor="contactName" className="text-sm font-medium text-ink">
                Seu nome
              </label>
              <Input
                id="contactName"
                required
                value={contactName}
                onChange={event => setContactName(event.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <label htmlFor="contactEmail" className="text-sm font-medium text-ink">
                E-mail
              </label>
              <Input
                id="contactEmail"
                type="email"
                required
                value={contactEmail}
                onChange={event => setContactEmail(event.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <label htmlFor="contactPhone" className="text-sm font-medium text-ink">
                WhatsApp
              </label>
              <Input
                id="contactPhone"
                required
                value={contactPhone}
                onChange={event => setContactPhone(event.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          <div aria-live="polite">
            {signup.error ? (
              <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-sm text-red-400">{signup.error.message}</p>
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={signup.isPending}
            className="mt-5 w-full !bg-gradient-to-r !from-[#008cfe] !to-[#6146fd] shadow-lg shadow-[#6146fd]/20 transition-all duration-200 hover:!brightness-110"
          >
            {signup.isPending ? "Enviando..." : `Pagar ${money(implementationFeeCents)} e continuar`}
          </Button>
        </form>
      </div>
    </div>
  );
}
