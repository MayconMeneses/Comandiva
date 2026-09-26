import WhatsAppButton from "@/components/WhatsAppButton";
import { trpc } from "@/lib/trpc";
import { applyColorTheme } from "@/lib/applyColorTheme";
import { isMarcaBackground, MARCA_GRADIENT } from "@shared/colorThemes";
import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function FAQ() {
  const [, setLocation] = useLocation();
  const settings = trpc.catalog.settings.useQuery();
  const marca = isMarcaBackground(settings.data?.customBackgroundColor);
  useEffect(() => { applyColorTheme(settings.data?.colorTheme, settings.data?.customBackgroundColor); }, [settings.data?.colorTheme, settings.data?.customBackgroundColor]);
  const routes = trpc.catalog.deliveryRoutes.useQuery();
  const onlineCard = trpc.order.onlineCardAvailable.useQuery();
  const customFaq = trpc.catalog.faqItems.useQuery();
  const activeRoutes = routes.data ?? [];

  const paymentMethods = ["Pix", "Dinheiro", "Cartão na entrega ou retirada", ...(onlineCard.data?.available ? ["Cartão online (pago antes, pelo site)"] : [])];

  return (
    <div className="min-h-screen bg-background" style={marca ? { background: MARCA_GRADIENT } : undefined}>
      <header className="border-b bg-[#fffdf8] text-[#231d18]">
        <div className="page-shell flex h-16 items-center justify-between">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Voltar ao cardápio</button>
          <span className="font-display text-xl font-bold">MM System Creator</span>
          <span className="w-32" />
        </div>
      </header>
      <main className="page-shell max-w-3xl py-10">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">Ajuda</p>
        <h1 className="mt-2 font-display text-4xl font-bold">Perguntas frequentes</h1>
        <p className="mt-2 text-sm text-muted-foreground">Tudo o que você precisa saber antes de pedir.</p>

        <div className="mt-8 space-y-6">
          <section className="rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)]">
            <h2 className="font-display text-xl font-bold">Qual o horário de funcionamento?</h2>
            <p className="mt-2 text-sm leading-6 text-[#4a3d30]">{settings.data?.openingHours || "Consulte o horário exibido na página inicial do site."} Fora do horário de atendimento, o cardápio se ajusta automaticamente para mostrar apenas o que está disponível no momento (ex.: cardápio de almoço ou de janta).</p>
          </section>

          <section className="rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)]">
            <h2 className="font-display text-xl font-bold">Para onde vocês entregam?</h2>
            {activeRoutes.length ? (
              <div className="mt-3 space-y-2">
                {activeRoutes.map(route => (
                  <div key={route.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e5d9c8] bg-[#fffaf5] px-4 py-2.5 text-sm">
                    <span className="font-medium">{route.name}</span>
                    <span className="text-[#8d3e27]">{money(route.deliveryFeeCents)} · {route.estimatedDeliveryMin}–{route.estimatedDeliveryMax} min</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm leading-6 text-[#4a3d30]">A área e a taxa de entrega são calculadas no checkout a partir do endereço informado. Se preferir, você também pode retirar seu pedido no balcão.</p>
            )}
            {settings.data?.minimumOrderCents ? <p className="mt-3 text-sm leading-6 text-[#4a3d30]">Pedido mínimo para entrega: <strong>{money(settings.data.minimumOrderCents)}</strong>.</p> : null}
          </section>

          <section className="rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)]">
            <h2 className="font-display text-xl font-bold">Quais formas de pagamento são aceitas?</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[#4a3d30]">
              {paymentMethods.map(method => <li key={method}>{method}</li>)}
            </ul>
          </section>

          <section className="rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)]">
            <h2 className="font-display text-xl font-bold">Posso acompanhar meu pedido?</h2>
            <p className="mt-2 text-sm leading-6 text-[#4a3d30]">Sim. Depois de finalizar, acesse <button onClick={() => setLocation("/acompanhar")} className="font-semibold text-primary underline underline-offset-2">Acompanhar pedido</button> e informe o mesmo telefone usado no checkout para ver o status em tempo real, do aceite até a entrega ou retirada.</p>
          </section>

          <section className="rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)]">
            <h2 className="font-display text-xl font-bold">O item veio errado ou fora do esperado. E agora?</h2>
            <p className="mt-2 text-sm leading-6 text-[#4a3d30]">Fale com a gente pelo WhatsApp (botão no canto da tela ou no rodapé do site) assim que perceber o problema, informando o número do seu pedido. Avaliamos cada caso — troca, reembolso ou correção — o mais rápido possível.</p>
          </section>

          <section className="rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)]">
            <h2 className="font-display text-xl font-bold">Posso personalizar meu pedido (tirar ingrediente, pedir à parte)?</h2>
            <p className="mt-2 text-sm leading-6 text-[#4a3d30]">Sim. Ao adicionar um item ao carrinho, há um campo de observação para pedidos como "sem cebola" ou "molho à parte". Detalhes importantes (alergias, por exemplo) também podem ser escritos na observação geral do pedido, na tela de finalização.</p>
          </section>

          {customFaq.data?.map(item => (
            <section key={item.id} className="rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)]">
              <h2 className="font-display text-xl font-bold">{item.question}</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#4a3d30]">{item.answer}</p>
            </section>
          ))}
        </div>
      </main>
      <WhatsAppButton phone={settings.data?.phone} />
    </div>
  );
}
