import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "wouter";
import { PLANS, type PlanKey } from "../data/plans";
import { signup, ApiError } from "../lib/api";
import { track } from "../lib/track";
import { usePageMeta } from "../lib/seo";
import { Field } from "../components/ui/Field";

/**
 * Cadastro do restaurante. Chama `public.signup` no Master — é o servidor
 * que cria o restaurante e AVISA O DONO NO TELEGRAM com os dados
 * preenchidos. Mesmo fluxo e mesmos campos do site comercial atual.
 */
export default function Cadastro() {
  usePageMeta("/cadastro", { noindex: true });
  const { planKey } = useParams<{ planKey: string }>();
  const [, navigate] = useLocation();
  const plan = PLANS.find(p => p.key === planKey);

  const [form, setForm] = useState({ name: "", contactName: "", contactEmail: "", contactPhone: "" });
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // Funil: "start" no primeiro foco, "step" ao chegar no WhatsApp (mesmos eventos do site atual).
  const started = useRef(false);
  const stepped = useRef(false);

  if (!plan) {
    return (
      <section className="mx-auto max-w-md px-4 py-28 text-center">
        <h1 className="font-display text-3xl font-semibold">Plano não encontrado</h1>
        <Link href="/planos" className="mt-6 inline-block text-accent-text underline">
          Ver os planos
        </Link>
      </section>
    );
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    setError(null);
    setSending(true);
    track("signup_submit");
    try {
      // Mesmos limites do servidor (public.signup no Master): espaços das pontas fora.
      const r = await signup({
        name: form.name.trim(),
        contactName: form.contactName.trim(),
        contactEmail: form.contactEmail.trim(),
        contactPhone: form.contactPhone.trim(),
        planKey: plan!.key as PlanKey,
      });
      navigate(`/cadastro/sucesso?ref=${r.restaurantId}&t=${encodeURIComponent(r.uploadToken)}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível enviar agora. Tente de novo em instantes.");
      setSending(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg px-4 pb-24 pt-14 sm:px-6" aria-labelledby="cadastro-title">
      <Link href="/planos" className="text-sm text-ink-soft hover:text-ink">
        ← Voltar para os planos
      </Link>

      <form
        onSubmit={submit}
        onFocus={e => {
          if (!started.current) {
            started.current = true;
            track("signup_start");
          }
          if (!stepped.current && (e.target as HTMLElement).id === "contactPhone") {
            stepped.current = true;
            track("signup_step");
          }
        }}
        className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5"
      >
        <div className="rounded-[calc(2rem-0.375rem)] bg-bg-raised p-6 sm:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-text">Assinar {plan.name}</p>
          <h1 id="cadastro-title" className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Cadastre seu restaurante
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Nossa equipe organiza seu cardápio e sua configuração em até 10 dias úteis — podendo ser antes. Só depois de tudo pronto é que
            seu teste grátis de 7 dias começa a valer.
          </p>

          <div className="mt-6 space-y-4">
            <Field id="name" label="Nome do restaurante" required minLength={2} maxLength={160} autoComplete="organization" value={form.name} onChange={set("name")} />
            <Field id="contactName" label="Seu nome" required maxLength={160} autoComplete="name" value={form.contactName} onChange={set("contactName")} />
            <Field id="contactEmail" label="E-mail" type="email" required maxLength={254} autoComplete="email" value={form.contactEmail} onChange={set("contactEmail")} />
            <Field
              id="contactPhone"
              label="WhatsApp"
              type="tel"
              required
              maxLength={24}
              autoComplete="tel"
              inputMode="tel"
              placeholder="(85) 9 9999-9999"
              value={form.contactPhone}
              onChange={set("contactPhone")}
            />
          </div>

          <div className="mt-5 flex items-start gap-3">
            <input
              id="consent"
              name="consent"
              type="checkbox"
              required
              className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-[#0a84ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text"
            />
            <label htmlFor="consent" className="text-sm leading-relaxed text-ink-soft">
              Li e concordo com os{" "}
              <Link href="/termos" className="text-accent-text underline underline-offset-2">
                Termos de uso
              </Link>{" "}
              e a{" "}
              <Link href="/privacidade" className="text-accent-text underline underline-offset-2">
                Política de privacidade
              </Link>
              , e autorizo o uso do meu nome, e-mail e WhatsApp para configurar meu sistema e falar comigo.
            </label>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-xl border border-[#ff7a7a]/30 bg-[#ff7a7a]/10 p-3 text-sm text-[#ff9a9a]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-accent-strong font-semibold text-white transition-colors hover:bg-[#0076e0] disabled:opacity-60"
          >
            {sending ? "Enviando…" : "Enviar informações"}
          </button>
          <p className="mt-3 text-center text-xs text-ink-soft">Sem cartão de crédito. Pedimos só o necessário e explicamos o uso na Política de privacidade.</p>
        </div>
      </form>
    </section>
  );
}
