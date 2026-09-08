import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { API_URL } from "./const";
import "./index.css";

// staleTime padrão: sem isso (staleTime: 0), toda vez que o admin volta o
// foco pra aba, TODAS as queries ativas da tela (várias, com DashboardLayout
// montando vários sub-paineis de uma vez) refazem fetch simultaneamente,
// mesmo que os dados tenham menos de 1 segundo. Telas que precisam de dado
// mais fresco (ex.: refetchInterval do kanban/painel de mesas) continuam
// atualizando no intervalo configurado normalmente — refetchInterval não é
// afetado por staleTime. Overrides pontuais (ex.: DashboardLayout `mySnapshot`)
// continuam valendo por cima deste padrão.
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000 } } });

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: API_URL,
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>,
);
