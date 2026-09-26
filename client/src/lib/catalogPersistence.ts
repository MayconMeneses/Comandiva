import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import type { Query } from "@tanstack/react-query";
import { del, get, set } from "idb-keyval";

/**
 * Fase 2 do offline-first (ver plano em C:\Users\maico\.claude\plans\lovely-purring-dusk.md):
 * espelho local só do cardápio público (`trpc.catalog.*`) — pedidos, mesas e tudo do
 * admin continuam de propósito fora daqui, mesmo raciocínio de segurança que já faz o
 * Service Worker (vite.config.ts) tratar o resto da API como NetworkOnly.
 */

// idb-keyval expõe get/set/del; o persister do React Query espera getItem/setItem/
// removeItem — só um adapter de nomes, os dois já são baseados em IndexedDB por baixo.
const idbStorage = {
  getItem: (key: string) => get<string>(key),
  setItem: (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key),
};

export const catalogPersister: Persister = createAsyncStoragePersister({
  storage: idbStorage,
  key: "mm-catalog-cache",
});

/**
 * Menor que o padrão da lib (24h) de propósito: `catalog.settings` carrega horário de
 * funcionamento/`isAcceptingOrders`, e `catalog.list` filtra categoria por janela de
 * horário (LUNCH/DINNER) — um cache muito velho pode mostrar a loja "aberta" quando já
 * fechou, ou esconder uma categoria que acabou de abrir. 6h cobre o caso que essa fase
 * resolve de verdade (dar uma tela pra pintar instantânea logo depois de abrir o app de
 * novo), sem deixar um cache de ontem passar por atual.
 */
export const CATALOG_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * Sobe sempre que o formato do retorno de `fetchCatalog`/`catalog.*` mudar de um jeito
 * que uma versão antiga do cache não teria — evita hidratar um bundle novo com um
 * formato de dado velho. Comentário-lembrete: mudar isso ao mudar o schema do payload.
 */
export const CATALOG_CACHE_BUSTER = "v1";

/**
 * Chave do tRPC v11 pra uma query é `[caminhoDividido, {input?, type?}]` — ex.:
 * `[["catalog","list"], {type:"query"}]`. Só persiste o que começa em "catalog"; tudo o
 * mais (pedido, mesa, admin) nunca deve ir pro IndexedDB, mesmo se um dia virar query
 * ativa no mesmo QueryClient.
 */
export function shouldDehydrateCatalogQuery(query: Query): boolean {
  const [path] = query.queryKey as [unknown, ...unknown[]];
  return Array.isArray(path) && path[0] === "catalog" && query.state.status === "success";
}

export type { PersistedClient };
