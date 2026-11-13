/** Ícones SVG simples (herdam a cor do texto). */
export function CheckIcon({ className = "h-[1em] w-[1em]" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={"inline-block align-[-0.125em] " + className}>
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

export function ArrowIcon({ className = "h-[1em] w-[1em]" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={"inline-block align-[-0.125em] " + className}>
      <path d="M2.5 8h11M9 3.5 13.5 8 9 12.5" />
    </svg>
  );
}

export function SearchIcon({ className = "h-[1em] w-[1em]" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={"inline-block align-[-0.125em] " + className}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  );
}