import { mutationErrorMessage } from "@/lib/mutationErrorMessage";

/** Ver client/src/lib/mutationErrorMessage.ts pro racional completo. */
export function MutationErrorNotice({ error, className }: { error: unknown; className?: string }) {
  const message = mutationErrorMessage(error);
  if (!message) return null;
  return <p className={className}>{message}</p>;
}
