import type { InputHTMLAttributes } from "react";

/** Campo de formulário com rótulo visível (acessível) no visual do site. */
export function Field({ id, label, hint, ...props }: { id: string; label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {hint && <span className="ml-1 font-normal text-ink-soft">{hint}</span>}
      </label>
      <input
        id={id}
        name={id}
        {...props}
        className="mt-1.5 block h-12 w-full rounded-xl border border-line bg-bg px-4 text-ink placeholder:text-ink-soft/60 focus:border-accent-text focus:outline-none"
      />
    </div>
  );
}
