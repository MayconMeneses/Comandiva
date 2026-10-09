import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { track } from "@/lib/track";
import { FormEvent, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ComercialHeader } from "./ComercialHeader";

const PLAN_LABELS: Record<string, string> = { essencial: "Entrada", profissional: "Profissional", premium: "Premium" };

export default function Cadastro() {
  const { planKey } = useParams<{ planKey: string }>();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  // Funil: "start" no primeiro foco em qualquer campo, "step" ao chegar no último (WhatsApp).
  const startedRef = useRef(false);
  const stepRef = useRef(false);

  const signup = trpc.public.signup.useMutation({
    // Sem taxa de implementação: o envio das informações já conclui o cadastro
    // e leva direto pra tela de "Cadastro recebido" (com o envio do cardápio).
    onSuccess: data => setLocation(`/comercial/cadastro/sucesso?ref=${data.restaurantId}`),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    track("signup_submit");
    signup.mutate({
      name,
      planKey: planKey as "essencial" | "profissional" | "premium",
      contactName,
      contactEmail,
      contactPhone,
    });
  };

  const planLabel = PLAN_LABELS[planKey ?? ""] ?? planKey;

  return (
    <div className="comercial-dark min-h-screen bg-paper text-ink">
      <ComercialHeader showNav={false} />
      <div className="mx-auto max-w-md px-6 py-12">
        <Link href="/comercial/planos" className="text-sm text-ink-soft hover:text-ink">
          ← Voltar para os planos
        </Link>

        <form
          onSubmit={submit}
          onFocus={event => {
            if (!startedRef.current) {
              startedRef.current = true;
              track("signup_start");
            }
            if (!stepRef.current && (event.target as HTMLElement).id === "contactPhone") {
              stepRef.current = true;
              track("signup_step");
            }
          }}
          className="mt-6 rounded-2xl border border-border bg-paper-raised p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-accent-text">Assinar {planLabel}</p>
          <h1 className="mt-2 text-2xl font-bold text-ink">Cadastre seu restaurante</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Nossa equipe organiza seu cardápio e sua configuração em até 10 dias úteis — podendo ser
            antes. Só depois de tudo pronto é que seu teste grátis de 7 dias começa a valer.
          </p>

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

          {signup.error ? (
            <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-sm text-red-400">{signup.error.message}</p>
          ) : null}

          <Button
            type="submit"
            disabled={signup.isPending}
            className="mt-5 w-full !bg-gradient-to-r !from-[#008cfe] !to-[#6146fd] shadow-lg shadow-[#6146fd]/20 transition-all duration-200 hover:!brightness-110"
          >
            {signup.isPending ? "Enviando..." : "Enviar informações"}
          </Button>
        </form>
      </div>
    </div>
  );
}
