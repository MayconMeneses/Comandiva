import { Button } from "@/components/ui/button";
import { CalendarClock, Lock } from "lucide-react";
import { useLocation } from "wouter";

/**
 * Faixa fixa no topo — aparece sempre que o dono entra no admin, a partir de
 * alguns dias antes do fim do teste grátis (ver DAY threshold em DashboardLayout.tsx).
 * Nunca é dispensável/lembrada em localStorage de propósito: o pedido foi
 * "aparecer sempre que ele entra no admin", não uma vez só por sessão.
 */
export function TrialEndingBanner({ daysLeft, periodEndLabel }: { daysLeft: number; periodEndLabel: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-2 border-b-2 border-amber-500 bg-amber-900 px-4 py-2.5 text-center text-sm font-semibold text-amber-50">
      <CalendarClock className="h-4 w-4 shrink-0" />
      <span>
        {daysLeft <= 0 ? <>Seu teste grátis termina hoje ({periodEndLabel}).</> : <>Faltam {daysLeft} {daysLeft === 1 ? "dia" : "dias"} pro fim do seu teste grátis ({periodEndLabel}).</>}{" "}
        Assine agora pra não perder o acesso.
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setLocation("/admin/plano")}
        className="h-7 shrink-0 border-amber-400 bg-transparent px-2.5 text-xs text-amber-50 hover:bg-amber-950/40"
      >
        Assinar agora
      </Button>
    </div>
  );
}

const ACCESS_BLOCKED_COPY: Record<string, { title: string; body: string }> = {
  ended: {
    title: "Seu teste grátis terminou",
    body: "Os 30 dias grátis do MM System Creator acabaram. Assine um plano pra continuar usando o painel — seus dados continuam salvos, nada foi perdido.",
  },
  canceled: {
    title: "Sua assinatura foi cancelada",
    body: "O acesso ao painel foi encerrado porque a assinatura chegou ao fim do período cancelado. Assine de novo pra voltar a usar o sistema — seus dados continuam salvos.",
  },
  suspended: {
    title: "Sua assinatura está suspensa",
    body: "A cobrança recorrente foi pausada no Mercado Pago. Verifique sua forma de pagamento por lá ou fale com a gente — seus dados continuam salvos.",
  },
};

/** Bloqueio total do conteúdo do admin quando a assinatura não está em dia (status 'ended'/'canceled'/'suspended') — só a tela "Meu plano" continua acessível, pra dar pro dono resolver. */
export function TrialEndedBlock({ status }: { status: string }) {
  const [, setLocation] = useLocation();
  const copy = ACCESS_BLOCKED_COPY[status] ?? ACCESS_BLOCKED_COPY.ended;
  return (
    <div className="grid min-h-[60vh] place-items-center p-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f3e2d8]">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.body}</p>
        <Button onClick={() => setLocation("/admin/plano")} className="mt-5 rounded-xl bg-primary hover:bg-primary-hover">
          Ver planos e assinar
        </Button>
      </div>
    </div>
  );
}
