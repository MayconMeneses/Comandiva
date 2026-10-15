import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpcQuery } from "../lib/api";
import { usePageMeta } from "../lib/seo";

type SignupStatus = { status: string; restaurantId: number | null };

/**
 * Retorno do checkout do Mercado Pago (fluxo com taxa de implementação, que
 * saiu em 2026-10-09 — o endereço ainda é gerado em Master/server/db/
 * signupPayments.ts, então a página continua existindo). Mesma lógica do site
 * atual: NUNCA confia só no retorno do Mercado Pago; consulta
 * `public.signupStatus` a cada 3s até o servidor confirmar o pagamento.
 */
export default function Confirmando() {
  usePageMeta("/cadastro/confirmando", { noindex: true });
  const [, navigate] = useLocation();
  const signupPaymentId = Number(new URLSearchParams(useSearch()).get("ref"));
  const valid = Number.isFinite(signupPaymentId) && signupPaymentId > 0;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const r = await trpcQuery<SignupStatus>("public.signupStatus", { signupPaymentId });
        if (!alive) return;
        if (r.status === "restaurant_created") {
          navigate(r.restaurantId ? `/cadastro/sucesso?ref=${r.restaurantId}` : "/cadastro/sucesso");
          return;
        }
      } catch {
        if (!alive) return;
        setFailed(true);
      }
      timer = setTimeout(check, 3000);
    };
    check();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [valid, signupPaymentId, navigate]);

  return (
    <section className="grid min-h-[70dvh] place-items-center px-4 py-24" aria-labelledby="confirmando-title">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5 text-center">
        <div className="rounded-[calc(2rem-0.375rem)] bg-bg-raised p-8">
          <div aria-hidden="true" className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent motion-reduce:animate-none" />
          <h1 id="confirmando-title" className="mt-5 font-display text-2xl font-semibold">
            Confirmando seu pagamento…
          </h1>
          <p className="mt-2 text-sm text-ink-soft" role="status">
            Isso pode levar alguns instantes. Não feche esta página — o cadastro só é concluído quando o Mercado Pago confirma o pagamento
            pra gente.
          </p>
          {!valid && (
            <p role="alert" className="mt-4 text-sm text-[#ff9a9a]">
              Não encontramos a referência do seu pagamento.
            </p>
          )}
          {valid && failed && (
            <p className="mt-4 text-xs text-ink-soft">Conexão instável — continuamos tentando automaticamente.</p>
          )}
        </div>
      </div>
    </section>
  );
}
