import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { ComercialHeader } from "./ComercialHeader";

/**
 * Tela de retorno do checkout da taxa de implementação. NUNCA confia no
 * simples fato de o Mercado Pago ter mandado o cliente de volta pra cá —
 * fica consultando o servidor (que só sabe "restaurant_created" depois do
 * webhook confirmar o pagamento de verdade) até ter certeza.
 */
export default function Confirmando() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const signupPaymentId = Number(new URLSearchParams(search).get("ref"));

  const statusQuery = trpc.public.signupStatus.useQuery(
    { signupPaymentId },
    { enabled: Number.isFinite(signupPaymentId) && signupPaymentId > 0, refetchInterval: query => (query.state.data?.status === "restaurant_created" ? false : 3000) },
  );

  useEffect(() => {
    if (statusQuery.data?.status === "restaurant_created") {
      const restaurantId = statusQuery.data.restaurantId;
      setLocation(restaurantId ? `/comercial/cadastro/sucesso?ref=${restaurantId}` : "/comercial/cadastro/sucesso");
    }
  }, [statusQuery.data?.status, statusQuery.data?.restaurantId, setLocation]);

  return (
    <div className="comercial-dark min-h-screen bg-paper text-ink">
      <ComercialHeader showNav={false} />
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-paper-raised p-6 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
          <h1 className="mt-4 text-xl font-bold text-ink">Confirmando seu pagamento...</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Isso pode levar alguns instantes. Não feche esta página — o cadastro só é concluído quando o
            Mercado Pago confirma o pagamento pra gente.
          </p>
          {!Number.isFinite(signupPaymentId) || signupPaymentId <= 0 ? (
            <p className="mt-3 text-sm text-red-400">Não encontramos a referência do seu pagamento.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
