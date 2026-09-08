import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-9 w-full rounded-lg border border-border bg-paper-raised px-3 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent ${className}`}
      {...props}
    />
  );
}
