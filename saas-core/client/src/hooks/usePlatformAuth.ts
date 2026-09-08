import { trpc } from "@/lib/trpc";

/** Mesmo formato de client/src/_core/hooks/useAuth.ts do app principal, simplificado (sem redirect embutido — cada página decide). */
export function usePlatformAuth() {
  const utils = trpc.useUtils();
  const meQuery = trpc.masterPanel.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const logoutMutation = trpc.masterPanel.auth.logout.useMutation({
    onSuccess: () => utils.masterPanel.auth.me.setData(undefined, null),
  });

  return {
    admin: meQuery.data ?? null,
    loading: meQuery.isLoading || logoutMutation.isPending,
    logout: () => logoutMutation.mutateAsync(),
  };
}
