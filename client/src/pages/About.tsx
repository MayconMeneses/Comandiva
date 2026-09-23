import WhatsAppButton from "@/components/WhatsAppButton";
import { trpc } from "@/lib/trpc";
import { applyColorTheme } from "@/lib/applyColorTheme";
import { isMarcaBackground, MARCA_GRADIENT } from "@shared/colorThemes";
import { ArrowLeft, Clock3, MapPin, Phone } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function About() {
  const [, setLocation] = useLocation();
  const settings = trpc.catalog.settings.useQuery();
  const marca = isMarcaBackground(settings.data?.customBackgroundColor);
  useEffect(() => { applyColorTheme(settings.data?.colorTheme, settings.data?.customBackgroundColor); }, [settings.data?.colorTheme, settings.data?.customBackgroundColor]);

  return (
    <div className="min-h-screen bg-background" style={marca ? { background: MARCA_GRADIENT } : undefined}>
      <header className="border-b bg-[#fffdf8] text-[#231d18]">
        <div className="page-shell flex h-16 items-center justify-between">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />Voltar ao cardápio</button>
          <span className="font-display text-xl font-bold">MM System Creator</span>
          <span className="w-32" />
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-[#15120f] text-[#fffaf3]">
        <div className="absolute inset-0 opacity-60"><img src="/assets/pubx/hero-brand-burger.jpg" alt="" aria-hidden="true" className="h-full w-full object-cover object-[78%_22%]" /></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#15120f] via-[#15120f]/85 to-[#15120f]/30" />
        <div className="page-shell relative py-16 sm:py-24">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-[#e9c98f]">Nossa história</p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold leading-tight sm:text-5xl">Sobre o MM System Creator</h1>
        </div>
      </section>

      <main className="page-shell max-w-3xl py-10">
        <div className={`space-y-6 whitespace-pre-line text-sm leading-7 ${marca ? "text-[#e4e9f5]" : "text-[#3a2f25]"}`}>
          {settings.data?.aboutText ? settings.data.aboutText : (
            <>
              <p>O <strong>MM System Creator</strong> nasceu da vontade de servir comida boa, feita com atenção aos detalhes, num ambiente descontraído — o tipo de lugar para relaxar depois de um dia cheio, reunir os amigos ou simplesmente pedir aquele hambúrguer que você está com vontade. Estamos em Croatá/CE, preparando cada prato na hora, para chegar até você (ou até a sua mesa) com a mesma qualidade de quem come no salão.</p>

              <p>Nosso cardápio reúne hambúrgueres artesanais, pizzas de massa bem trabalhada, porções para dividir e bebidas geladas — sempre com ingredientes selecionados e um olho atento ao ponto certo de cada preparo. Trabalhamos com entrega e retirada no balcão, para você escolher o jeito mais prático de aproveitar.</p>

              <p>Por trás de cada pedido tem uma equipe que acompanha da cozinha até a sua porta — do aceite do pedido até a entrega, você consegue acompanhar cada etapa pelo site, com o mesmo cuidado que colocamos no preparo.</p>
            </>
          )}
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)]">
            <Clock3 className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold">Funcionamento</h3>
            <p className="mt-1 text-sm leading-5 text-[#8a7a68]">{settings.data?.openingHours || "Consulte a página inicial"}</p>
          </div>
          <div className="rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)]">
            <MapPin className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold">Onde estamos</h3>
            <p className="mt-1 text-sm leading-5 text-[#8a7a68]">{settings.data?.address || "Croatá/CE"}</p>
          </div>
          <div className="rounded-2xl bg-[#fffdf8] p-5 text-[#231d18] shadow-[0_8px_22px_rgba(53,34,17,.06)]">
            <Phone className="h-5 w-5 text-primary" />
            <h3 className="mt-3 font-semibold">Fale com a gente</h3>
            <p className="mt-1 text-sm leading-5 text-[#8a7a68]">{settings.data?.phone || "Veja o contato na página inicial"}</p>
          </div>
        </div>
      </main>
      <WhatsAppButton phone={settings.data?.phone} />
    </div>
  );
}
