import { Suspense, lazy, useRef } from "react";
import { useInView } from "motion/react";
import { StaticSequence } from "./StaticSequence";
import { useStaticMode } from "./useStaticMode";

const PedidoScene = lazy(() => import("./PedidoScene"));

/** Mesma altura e mesmo id da cena real: o lugar fica reservado (sem salto de layout) e o #por-dentro já existe. */
function Placeholder() {
  return <div id="por-dentro" aria-hidden="true" className="h-[400vh] max-[768px]:h-[260vh]" />;
}

/** Monta a cena (carregada sob demanda) quando ela chega perto da tela. Sem movimento ou em tela mínima: lista estática. */
export function PedidoSlot() {
  const staticMode = useStaticMode();
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, amount: "some", margin: "800px 0px 800px 0px" });
  if (staticMode) return <StaticSequence />;
  return (
    <div ref={ref}>
      {near ? (
        <Suspense fallback={<Placeholder />}>
          <PedidoScene />
        </Suspense>
      ) : (
        <Placeholder />
      )}
    </div>
  );
}
