import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import { COMPARISON } from "../data/home";
import { SectionHeading } from "./ui/SectionHeading";
import { reveal } from "../lib/motion";
import { asset } from "../lib/asset";
import { SearchIcon } from "./ui/Icons";
import { Marked } from "./ui/Kw";

const NEIGHBORS = ["Pizzaria vizinha", "Hamburgueria ao lado", "Seu restaurante", "Japonês da esquina", "Lanchonete da rua"];

/** Vitrine genérica de app de entrega (ilustração, sem marca real). */
function MarketplaceMock() {
  return (
    <div className="absolute inset-0 flex flex-col bg-[#e9e7e4] p-3 pt-12 text-[#3b3936] sm:p-5 sm:pt-14">
      <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs text-[#66615b] sm:text-xs"><SearchIcon /> Buscar restaurantes</div>
      <div className="mt-3 grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {NEIGHBORS.map(name => {
          const you = name === "Seu restaurante";
          return (
            <div key={name} className={`flex flex-col rounded-xl bg-white p-2 sm:p-3 ${you ? "ring-2 ring-[#66615b]" : ""}`}>
              <div className="h-6 rounded bg-[#d9d5cf] sm:h-12" />
              <p className="mt-1.5 truncate text-xs font-semibold sm:text-sm">{name}</p>
              <p className="text-[9px] text-[#66615b] sm:text-xs">{you ? "taxa de até 30% por pedido" : "patrocinado"}</p>
            </div>
          );
        })}
        <div className="hidden rounded-xl border-2 border-dashed border-[#c9c4bd] sm:block" />
      </div>
    </div>
  );
}

/**
 * "Sistema próprio x aplicativo de entrega" com divisória arrastável
 * (referências: Side By Side Slide e Compare Slider, 21st.dev). Por baixo,
 * o print real do cardápio; por cima, a vitrine genérica de app. Ao entrar
 * na tela a divisória faz uma varrida curta para mostrar que dá para arrastar.
 * A varrida não acontece com movimento reduzido.
 * Teclado: o controle é um input range com as setas.
 */
export function CompareSlider() {
  const frame = useRef<HTMLDivElement>(null);
  const inView = useInView(frame, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const pos = useMotionValue(50);
  const [value, setValue] = useState(50);
  const clip = useTransform(pos, v => `inset(0 ${100 - v}% 0 0)`);
  const left = useTransform(pos, v => `${v}%`);
  useMotionValueEvent(pos, "change", v => setValue(Math.round(v)));

  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(pos, [50, 22, 78, 50], { duration: 2.4, ease: "easeInOut", delay: 0.3 });
    return () => c.stop();
  }, [inView, pos, reduce]);

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
        title={<Marked text="Na vitrine do app, você é mais um. No seu sistema, é o único." phrase="No seu sistema, é o único." />}
        lead="Nada contra os apps. Só que quem carrega o restaurante no ombro é você. Arraste para comparar."
      />

      <motion.div {...reveal(0.1)} className="mx-auto mt-14 max-w-6xl">
        <div className="rounded-2xl border border-line bg-bg-raised">
          <div
            ref={frame}
            className="group/frame relative aspect-[4/3] cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-2xl sm:aspect-[1352/633]"
            onPointerDown={e => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              fromPointer(e.clientX);
            }}
            onPointerMove={e => e.buttons === 1 && fromPointer(e.clientX)}
          >
            <img
              src={asset("/assets/cardapio-pizzas.webp")}
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

            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 font-mono text-xs text-white">
              App de entrega
            </span>
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-accent-strong px-3 py-1 font-mono text-xs text-white">
              Seu cardápio
            </span>

            <motion.div style={{ left }} className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white">
              <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-sm font-semibold text-bg group-has-[:focus-visible]/frame:ring-4 group-has-[:focus-visible]/frame:ring-accent-strong group-has-[:focus-visible]/frame:ring-offset-2 group-has-[:focus-visible]/frame:ring-offset-bg">
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
        <p className="mt-3 text-center font-mono text-xs text-ink-soft">
          À direita, print real do cardápio · à esquerda, ilustração de um app genérico
        </p>

        <dl className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {COMPARISON.map(row => (
            <div key={row.label} className="bg-bg-raised p-5">
              <dt className="font-mono text-xs text-ink-soft">{row.label}</dt>
              <dd className="mt-3">
                <span className={"block font-display text-lg " + (row.win ? "font-extrabold text-ok" : "font-semibold text-ink")}>{row.us}</span>
                <span className="mt-1 block text-sm text-late line-through decoration-late">{row.them}</span>
              </dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </section>
  );
}
