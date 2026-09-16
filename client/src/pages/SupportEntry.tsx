import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

/** Troca o token de handoff (vindo do Painel Master) por uma sessão local de suporte — link de uso único. */
export default function SupportEntry() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);
  const enter = trpc.support.enter.useMutation({
    // Modo Suporte agora tem acesso completo via o Admin real — não existe
    // mais uma tela /suporte separada só de leitura.
    onSuccess: () => setLocation("/admin"),
    onError: mutationError => setError(mutationError.message),
  });

  useEffect(() => {
    if (attempted.current) return; // token é de uso único — nunca reenviar automaticamente (StrictMode/reload)
    attempted.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setError("Link de suporte inválido."); return; }
    enter.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold">Link de suporte inválido</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
