import { MARQUEE_ITEMS } from "../content";

function Row({ reverse = false }: { reverse?: boolean }) {
  // A lista é duplicada para o loop não ter emenda; a cópia é só visual.
  return (
    <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
      <div className="marquee-track flex w-max shrink-0" data-reverse={reverse || undefined}>
        {[0, 1].map(copy => (
          <ul key={copy} className="flex shrink-0 items-center" aria-hidden={copy === 1 || undefined}>
            {MARQUEE_ITEMS.map(item => (
              <li key={item} className="flex items-center whitespace-nowrap px-6 font-mono text-sm uppercase tracking-wider text-ink-soft">
                <span className="mr-6 text-accent-text" aria-hidden="true">
                  ✱
                </span>
                {item}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

/**
 * Faixa que corre com o que o sistema entrega (referências: "Blurred
 * Marquee" e "Marquee" da 21st.dev). Bordas tracejadas lembram o picote
 * da comanda. Pausa com o mouse em cima e para com movimento reduzido.
 */
export function Marquee() {
  return (
    <section aria-label="O que vem no sistema" className="marquee border-y border-dashed border-line py-5">
      <Row />
      <div className="mt-4 hidden sm:block">
        <Row reverse />
      </div>
    </section>
  );
}
