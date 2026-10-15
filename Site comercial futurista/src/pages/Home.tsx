import { Hero } from "../components/Hero";
import { Marquee } from "../components/Marquee";
import { Suspense, lazy } from "react";
import { usePageMeta, publicUrl, SITE_ORIGIN } from "../lib/seo";
import { FAQ } from "../data/home";

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
        "Sistema para restaurante com cardápio digital, pedidos online, entregas e pagamento por Pix e cartão — sem comissão por pedido, com a marca do seu restaurante.",
      offers: { "@type": "Offer", price: "99.90", priceCurrency: "BRL", url: publicUrl("/planos") },
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
  return (
    <>
      <Hero ready={ready} />
      <Marquee />
      <Suspense fallback={<div className="min-h-[100dvh]" />}>
        <HomeBelowFold />
      </Suspense>
    </>
  );
}
