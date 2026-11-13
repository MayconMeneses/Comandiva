import { useId, useState } from "react";
import { HERO } from "../../content";
import { MENU } from "../../data/pedido";
import { formatBRL } from "../../lib/format";

const MAX = 40;

/** Cardápio compacto no celular; o nome vem do campo, só em memória (nada é enviado, guardado ou medido). */
function Phone({ name }: { name: string }) {
  return (
    <div role="img" aria-label={`Prévia de demonstração do cardápio digital de ${name}`} className="mx-auto w-full max-w-[16.5rem] rounded-[2rem] border-[6px] border-ink bg-ink outline outline-4 outline-band-line">
      <div className="overflow-hidden rounded-[1.5rem] bg-[#fffaf3]" aria-hidden="true">
        <div className="flex min-h-14 items-center bg-[#17120e] px-3.5 pb-2 pt-4 text-[#fffaf3]">
          <span className="line-clamp-2 break-words font-display text-[15px] font-semibold leading-tight">{name}</span>
        </div>
        <ul>
          {MENU.map(item => (
            <li key={item.id} className="flex items-center justify-between gap-2 border-b border-[#efe6d8] px-3.5 py-2 last:border-b-0">
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-tight text-[#2b2118]">{item.name}</span>
                <span className="block truncate text-[10px] text-[#6b5b49]">{item.hint}</span>
              </span>
              <span className="font-mono text-[11px] text-[#2b2118]">{formatBRL(item.price)}</span>
            </li>
          ))}
        </ul>
        <div className="flex h-10 items-center justify-between bg-[#17120e] px-3.5 text-[11px] text-[#cdbfac]">
          <span>Carrinho vazio</span>
          <span className="rounded-full bg-[#e9c98f] px-2 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-[#241b16]">Demonstração</span>
        </div>
      </div>
    </div>
  );
}

export function RestaurantPreview() {
  const id = useId();
  const [value, setValue] = useState("");
  const name = value.trim() || HERO.previewEmpty;
  return (
    <div className="on-band rounded-3xl bg-band p-6 text-band-ink sm:p-7">
      <p className="font-display text-lg font-semibold">{HERO.previewTitle}</p>
      <label htmlFor={id} className="mt-3 block text-sm font-medium">
        {HERO.previewLabel}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={MAX}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="done"
        placeholder={HERO.previewPlaceholder}
        onChange={e => setValue(e.target.value.slice(0, MAX))}
        onKeyDown={e => e.key === "Enter" && e.preventDefault()}
        aria-describedby={`${id}-nota`}
        className="mt-1.5 block h-12 w-full rounded-xl border border-white bg-bg-raised px-4 text-ink placeholder:text-ink-soft focus:border-accent"
      />
      <p id={`${id}-nota`} className="mt-1.5 text-xs text-band-soft">
        {HERO.previewNote}
      </p>
      <div className="mt-4">
        <Phone name={name} />
      </div>
    </div>
  );
}
