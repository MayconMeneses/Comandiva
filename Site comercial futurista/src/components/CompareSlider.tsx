import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import { COMPARISON } from "../data/home";
import { SectionHeading } from "./ui/SectionHeading";
import { reveal } from "../lib/motion";

const NEIGHBORS = ["Pizzaria vizinha", "Hamburgueria ao lado", "Seu restaurante", "Japonês da esquina", "Lanchonete da rua"];

/** Vitrine genérica de app de entrega (ilustração, sem marca real). */
function MarketplaceMock() {
  return (
    <div className="absolute inset-0 flex flex-col bg-[#e9e7e4] p-3 text-[#3b3936] sm:p-5">
      <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[10px] text-[#66615b] sm:text-xs">⌕ Buscar restaurantes</div>
      <div className="mt-3 grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {NEIGHBORS.map(name => {
          const you = name === "Seu restaurante";
          return (
            <div key={name} className={`flex flex-col rounded-lg bg-white p-2 sm:p-3 ${you ? "ring-2 ring-[#66615b]" : ""}`}>
              <div className="h-6 rounded bg-[#d9d5cf] sm:h-12" />
              <p className="mt-1.5 truncate text-[10px] font-semibold sm:text-sm">{name}</p>
              <p className="text-[9px] text-[#66615b] sm:text-[11px]">{you ? "taxa de até 30% por pedido" : "patrocinado"}</p>
            </div>
          );
        })}
        <div className="hidden rounded-lg border-2 border-dashed border-[#c9c4bd] sm:block" />
      </div>
    </div>
  );
}

/**
 * "Sistema próprio x aplicativo de entrega" com divisória arrastável
 * (referências: Side By Side Slide e Compare Slider, 21st.dev). Por baixo,
 * o print real do cardápio; por cima, a vitrine genérica de app. Ao entrar
 * na tela a divisória faz uma varrida curta para mostrar que dá para arrastar.
 * Teclado: o controle é um input range com as setas.
 */
export function CompareSlider() {
  const frame = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(frame, { once: true, amount: 0.5 });
  const pos = useMotionValue(50);
  const [value, setValue] = useState(50);
  const clip = useTransform(pos, v => `inset(0 ${100 - v}% 0 0)`);
  const left = useTransform(pos, v => `${v}%`);
  useMotionValueEvent(pos, "change", v => setValue(Math.round(v)));

  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(pos, [50, 22, 78, 50], { duration: 2.4, ease: "easeInOut", delay: 0.3 });
    return () => c.stop();
  }, [inView, reduce, pos]);

  function fromPointer(clientX: number) {
    const r = frame.current?.getBoundingClientRect();
    if (!r) return;
    pos.set(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }

  return (
    <section className="px-4 py-28 sm:px-6" aria-labelledby="compare-home-title">
      <SectionHeading
        id="compare-home-title"
        eyebrow="Sistema próprio x app de entrega"
        title="Na vitrine do app, você é mais um. No seu sistema, é o único."
        lead="Nada contra os apps — só que quem carrega o restaurante no ombro é você. Arraste para comparar."
      />

      <motion.div {...reveal(0.1)} className="mx-auto mt-14 max-w-6xl">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5">
          <div
            ref={frame}
            className="relative aspect-[4/3] cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-[calc(2rem-0.375rem)] sm:aspect-[1352/633]"
            onPointerDown={e => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              fromPointer(e.clientX);
            }}
            onPointerMove={e => e.buttons === 1 && fromPointer(e.clientX)}
          >
            <img
              src="/assets/cardapio-pizzas.webp"
              width={1352}
              height={633}
              loading="lazy"
              decoding="async"
              alt="Cardápio próprio do restaurante no Comandiva, com fotos, descrições e preços"
              className="absolute inset-0 h-full w-full object-cover object-left-top"
              draggable={false}
            />
            <motion.div style={{ clipPath: clip }} className="absolute inset-0" aria-hidden="true">
              <MarketplaceMock />
            </motion.div>

            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white">
              App de entrega
            </span>
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-accent-strong px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white">
              Seu cardápio
            </span>

            <motion.div style={{ left }} className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,.2)]">
              <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-sm font-semibold text-bg shadow-lg">
                ⟷
              </span>
            </motion.div>

            <input
              type="range"
              min={0}
              max={100}
              value={value}
              onChange={e => pos.set(Number(e.target.value))}
              aria-label="Comparar vitrine do app de entrega com o cardápio próprio"
              className="peer absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            />
          </div>
        </div>
        <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-ink-soft">
          À direita, print real do cardápio · à esquerda, ilustração de um app genérico
        </p>

        <dl className="mt-12 grid gap-px overflow-hidden rounded-[1.5rem] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {COMPARISON.map(row => (
            <div key={row.label} className="bg-bg p-5">
              <dt className="font-mono text-[10px] uppercase tracking-wider text-ink-soft">{row.label}</dt>
              <dd className="mt-3">
                <span className="block font-display text-lg font-semibold text-ink">{row.us}</span>
                <span className="mt-1 block text-sm text-ink-soft line-through decoration-late/60">{row.them}</span>
              </dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </section>
  );
}
