import { SavingsReceipt } from "../components/SavingsReceipt";
import { CompareSlider } from "../components/CompareSlider";
import { Rotina } from "../components/Rotina";
import { ParaQuem } from "../components/ParaQuem";
import { Modulos } from "../components/Modulos";
import { KitchenBoard } from "../components/KitchenBoard";
import { LiveBento } from "../components/bento/LiveBento";
import { PanelShowcase } from "../components/PanelShowcase";
import { ScreenStack } from "../components/ScreenStack";
import { HowItWorks } from "../components/HowItWorks";
import { SupportFounder } from "../components/SupportFounder";
import { Faq } from "../components/Faq";
import { FinalCta } from "../components/FinalCta";

/** Tudo abaixo da primeira dobra: carregado em um pedaço separado (lazy) para o hero aparecer antes. */
export default function HomeBelowFold() {
  return (
    <>
      <SavingsReceipt />
      <Rotina />
      <ParaQuem />
      <CompareSlider />
      <KitchenBoard />
      <LiveBento />
      <Modulos />
      <PanelShowcase />
      <ScreenStack />
      <HowItWorks />
      <SupportFounder />
      <Faq />
      <FinalCta />
    </>
  );
}
