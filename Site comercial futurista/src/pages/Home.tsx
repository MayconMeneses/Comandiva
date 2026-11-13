import { Hero } from "../components/Hero";
import { Suspense, lazy, useRef } from "react";
import { usePageMeta, publicUrl, SITE_ORIGIN } from "../lib/seo";
import { StickyCta } from "../components/StickyCta";
import { HeroTickets } from "../components/hero/HeroTickets";
import { FAQ } from "../data/home";
import { ENTRY_PRICE_DECIMAL } from "../data/pricing";

const HomeBelowFold = lazy(() => import("./HomeBelowFold"));

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Comandiva",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description:
        "Sistema para restaurante com cardápio digital, pedidos online, entregas e pagamento por Pix e cartão, sem comissão por pedido. Teste grátis.",
      offers: { "@type": "Offer", price: ENTRY_PRICE_DECIMAL, priceCurrency: "BRL", url: publicUrl("/planos") },
      author: { "@type": "Person", name: "Maycon Meneses" },
    },
    { "@type": "Organization", name: "Comandiva", url: publicUrl("/"), logo: `${SITE_ORIGIN}/comandiva-logo-horizontal-dark.png` },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(item => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
    },
  ],
};

export default function Home({ ready }: { ready: boolean }) {
  usePageMeta("/", { jsonLd: STRUCTURED_DATA });
  const heroRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={heroRef}>
        <Hero ready={ready} />
      </div>
      <HeroTickets ready={ready} />
      <Suspense fallback={<div className="min-h-[100dvh]" />}>
        <HomeBelowFold />
      </Suspense>
      <StickyCta heroRef={heroRef} />
    </>
  );
}
