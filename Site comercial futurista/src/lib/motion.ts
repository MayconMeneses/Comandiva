export const EASE = [0.32, 0.72, 0, 1] as const;

/** Entrada padrão ao rolar: sobe e aparece (uma vez). Sem desfoque: filtro animado pesa na rolagem. */
export const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.9, delay, ease: EASE },
});
