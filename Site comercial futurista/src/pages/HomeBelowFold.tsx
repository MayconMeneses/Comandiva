import type { ReactNode } from "react";
import { SavingsReceipt } from "../components/SavingsReceipt";
import { CompareSlider } from "../components/CompareSlider";
import { Rotina } from "../components/Rotina";
import { ParaQuem } from "../components/ParaQuem";
import { Modulos } from "../components/Modulos";
import { PedidoSlot } from "../components/pedido/PedidoSlot";
import { LiveBento } from "../components/bento/LiveBento";
import { PanelShowcase } from "../components/PanelShowcase";
import { ScreenStack } from "../components/ScreenStack";
import { HowItWorks } from "../components/HowItWorks";
import { SupportFounder } from "../components/SupportFounder";
import { PlansTeaser } from "../components/plans/PlansTeaser";
import { Faq } from "../components/Faq";
import { FinalCta } from "../components/FinalCta";

/** Tudo abaixo da primeira dobra: carregado em um pedaço separado (lazy) para o hero aparecer antes. */
/** Fundo de uma zona de seções: alterna --bg (padrão da página) e --bg-alt para dar ritmo. */
function Alt({ children }: { children: ReactNode }) {
  return <div className="bg-bg-alt">{children}</div>;
}

export default function HomeBelowFold() {
  return (
    <>
      <Alt>
        <SavingsReceipt />
      </Alt>
      <Rotina />
      <Alt>
        <ParaQuem />
      </Alt>
      <CompareSlider />
      <PedidoSlot />
      <Alt>
        <LiveBento />
      </Alt>
      <Modulos />
      <Alt>
        <PanelShowcase />
        <ScreenStack />
      </Alt>
      <HowItWorks />
      <Alt>
        <SupportFounder />
      </Alt>
      <PlansTeaser />
      <Faq />
      <FinalCta />
    </>
  );
}
