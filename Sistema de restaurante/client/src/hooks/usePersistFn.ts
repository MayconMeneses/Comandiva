import { useRef } from "react";

// `any` de propósito aqui: é a restrição de generic mais permissiva possível
// pra "qualquer função" — trocar por `unknown[]`/`unknown` quebraria a
// inferência do tipo concreto de T em `usePersistFn<T extends noop>`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type noop = (...args: any[]) => any;

/**
 * usePersistFn instead of useCallback to reduce cognitive load
 */
export function usePersistFn<T extends noop>(fn: T) {
  const fnRef = useRef<T>(fn);
  fnRef.current = fn;

  const persistFn = useRef<T>(null);
  if (!persistFn.current) {
    persistFn.current = function (this: unknown, ...args) {
      return fnRef.current!.apply(this, args);
    } as T;
  }

  return persistFn.current!;
}
