// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { QueryClient } from "@tanstack/react-query";
import { persistQueryClientRestore, persistQueryClientSave } from "@tanstack/query-persist-client-core";
import type { Query } from "@tanstack/react-query";
import { del } from "idb-keyval";
import { beforeEach, describe, expect, it } from "vitest";
import { CATALOG_CACHE_BUSTER, CATALOG_CACHE_MAX_AGE_MS, catalogPersister, shouldDehydrateCatalogQuery } from "../client/src/lib/catalogPersistence";

/**
 * Fase 2 do offline-first — espelho local só do cardápio (ver plano em
 * C:\Users\maico\.claude\plans\lovely-purring-dusk.md). O teste que mais importa aqui é
 * `shouldDehydrateCatalogQuery`: ele é a fronteira que impede pedido/mesa/admin (hoje
 * NetworkOnly de propósito, ver vite.config.ts) de vazar pro IndexedDB.
 */
function fakeQuery(path: unknown[], status: "success" | "pending" | "error"): Query {
  return { queryKey: [path, { type: "query" }], state: { status } } as unknown as Query;
}

describe("shouldDehydrateCatalogQuery — fronteira de segurança do espelho local", () => {
  it("aceita queries de catalog.* já resolvidas com sucesso", () => {
    expect(shouldDehydrateCatalogQuery(fakeQuery(["catalog", "list"], "success"))).toBe(true);
    expect(shouldDehydrateCatalogQuery(fakeQuery(["catalog", "settings"], "success"))).toBe(true);
    expect(shouldDehydrateCatalogQuery(fakeQuery(["catalog", "promotions"], "success"))).toBe(true);
    expect(shouldDehydrateCatalogQuery(fakeQuery(["catalog", "product"], "success"))).toBe(true);
  });

  it("rejeita qualquer coisa fora de catalog.* — pedido, mesa, admin", () => {
    expect(shouldDehydrateCatalogQuery(fakeQuery(["table", "resolve"], "success"))).toBe(false);
    expect(shouldDehydrateCatalogQuery(fakeQuery(["order", "track"], "success"))).toBe(false);
    expect(shouldDehydrateCatalogQuery(fakeQuery(["admin", "operationalSnapshot"], "success"))).toBe(false);
    expect(shouldDehydrateCatalogQuery(fakeQuery(["auth", "me"], "success"))).toBe(false);
  });

  it("rejeita catalog.* que ainda não terminou de carregar ou que falhou", () => {
    expect(shouldDehydrateCatalogQuery(fakeQuery(["catalog", "list"], "pending"))).toBe(false);
    expect(shouldDehydrateCatalogQuery(fakeQuery(["catalog", "list"], "error"))).toBe(false);
  });
});

describe("catalogPersister — ida e volta pelo IndexedDB de verdade (fake-indexeddb)", () => {
  beforeEach(async () => {
    await del("mm-catalog-cache");
  });

  it("uma query de catalog.list sobrevive ao ciclo completo dehydrate → persistir → restaurar → hydrate", async () => {
    const client = new QueryClient();
    // Chave no formato real do tRPC v11 ([caminhoDividido, {input?, type?}]) —
    // uma chave "achatada" não bateria com shouldDehydrateCatalogQuery.
    client.setQueryData([["catalog", "list"], { type: "query" }], [{ id: 1, name: "Bebidas" }]);
    // Simula uma query de mesa/pedido ativa no mesmo QueryClient — não pode sobreviver.
    client.setQueryData([["table", "resolve"], { type: "query" }], { id: 99, label: "Mesa 5" });

    await persistQueryClientSave({
      queryClient: client,
      persister: catalogPersister,
      buster: CATALOG_CACHE_BUSTER,
      dehydrateOptions: { shouldDehydrateQuery: shouldDehydrateCatalogQuery },
    });

    const freshClient = new QueryClient();
    await persistQueryClientRestore({
      queryClient: freshClient,
      persister: catalogPersister,
      maxAge: CATALOG_CACHE_MAX_AGE_MS,
      buster: CATALOG_CACHE_BUSTER,
    });

    expect(freshClient.getQueryData([["catalog", "list"], { type: "query" }])).toEqual([{ id: 1, name: "Bebidas" }]);
    expect(freshClient.getQueryData([["table", "resolve"], { type: "query" }])).toBeUndefined();
  });
});

describe("expiração e buster — cache velho nunca volta como se fosse válido", () => {
  beforeEach(async () => {
    await del("mm-catalog-cache");
  });

  it("cache mais velho que CATALOG_CACHE_MAX_AGE_MS é descartado, não hidratado", async () => {
    await catalogPersister.persistClient({
      timestamp: Date.now() - (CATALOG_CACHE_MAX_AGE_MS + 60_000),
      buster: CATALOG_CACHE_BUSTER,
      clientState: { queries: [{ queryHash: JSON.stringify([["catalog", "list"], { type: "query" }]), queryKey: [["catalog", "list"], { type: "query" }], state: { data: [{ id: 1, name: "Bebidas" }], status: "success", dataUpdateCount: 1, dataUpdatedAt: Date.now(), error: null, errorUpdateCount: 0, errorUpdatedAt: 0, fetchFailureCount: 0, fetchFailureReason: null, fetchMeta: null, isInvalidated: false, fetchStatus: "idle" } }], mutations: [] },
    });

    const client = new QueryClient();
    await persistQueryClientRestore({ queryClient: client, persister: catalogPersister, maxAge: CATALOG_CACHE_MAX_AGE_MS, buster: CATALOG_CACHE_BUSTER });

    expect(client.getQueryData([["catalog", "list"], { type: "query" }])).toBeUndefined();
  });

  it("cache com buster diferente (deploy que mudou o formato do payload) é descartado", async () => {
    const client = new QueryClient();
    client.setQueryData([["catalog", "list"], { type: "query" }], [{ id: 1, name: "Bebidas" }]);
    await persistQueryClientSave({ queryClient: client, persister: catalogPersister, buster: "v0-formato-antigo", dehydrateOptions: { shouldDehydrateQuery: shouldDehydrateCatalogQuery } });

    const freshClient = new QueryClient();
    await persistQueryClientRestore({ queryClient: freshClient, persister: catalogPersister, maxAge: CATALOG_CACHE_MAX_AGE_MS, buster: CATALOG_CACHE_BUSTER });

    expect(freshClient.getQueryData([["catalog", "list"], { type: "query" }])).toBeUndefined();
  });
});
