/**
 * Chamada às MESMAS rotas públicas do Master usadas pelo site comercial atual
 * (tRPC sem transformer: o corpo é o próprio input em JSON).
 *
 * É o servidor do Master que avisa o dono no Telegram:
 * - public.signup               → mensagem com os dados do cadastro
 * - public.uploadMenuReference  → arquivo do cardápio anexado
 *
 * Dentro do Master a chamada é no mesmo endereço (/api/...). Rodando sozinho,
 * o Vite repassa /api para mmsystem.tech (vite.config.ts).
 */
export class ApiError extends Error {}

/** Mensagens de validação que o servidor devolve em inglês (zod), traduzidas. */
const PT: Record<string, string> = {
  "Invalid email address": "E-mail inválido. Confira e tente de novo.",
  "Invalid email": "E-mail inválido. Confira e tente de novo.",
};

export async function trpcMutation<T>(path: string, input: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/trpc/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new ApiError("Sem conexão com o servidor. Confira sua internet e tente de novo.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.error) {
    const msg: string | undefined = body?.error?.message ?? body?.error?.json?.message;
    // Erro de validação do zod vem como JSON cru; mostra uma frase humana no lugar.
    if (msg && PT[msg]) throw new ApiError(PT[msg]);
    throw new ApiError(msg && !msg.trim().startsWith("[") ? msg : "Confira os dados preenchidos e tente de novo.");
  }
  return (body?.result?.data?.json ?? body?.result?.data) as T;
}

export type SignupInput = {
  name: string;
  planKey: "essencial" | "profissional" | "premium";
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};
export type SignupResult = { restaurantId: number; uploadToken: string };

export const signup = (input: SignupInput) => trpcMutation<SignupResult>("public.signup", input);

export type MenuUploadInput = {
  restaurantId: number;
  uploadToken: string;
  fileName: string;
  mimeType: string;
  fileBase64: string;
  notes?: string;
};
export const uploadMenuReference = (input: MenuUploadInput) => trpcMutation<{ success: true }>("public.uploadMenuReference", input);
