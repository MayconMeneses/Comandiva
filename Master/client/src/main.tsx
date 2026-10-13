import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import App from "./App";
import { API_URL } from "./const";
import "./index.css";

const queryClient = new QueryClient();

// Sem transformer (superjson): o servidor (server/_core/trpc.ts) não usa
// superjson de propósito — cliente e servidor precisam concordar.
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: API_URL,
      fetch(input, init) {
        return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });
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
