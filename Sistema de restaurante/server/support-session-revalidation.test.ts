import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Modo Suporte: o app confirma com o Painel Master (saas-core) que a sessão
 * continua ativa — encerrar no master, ou pausar o admin que a abriu, derruba o
 * acesso no restaurante na hora (com cache curto), não só quando o JWT expira.
 * Falha fechada: sem resposta confiável do master, sem suporte.
 */
vi.mock("./_core/env", () => ({ ENV: { saasCoreUrl: "https://painel.exemplo.com/", saasCoreApiKey: "rk_live_teste", supportSessionSecret: "s".repeat(40) } }));

import { SUPPORT_STATUS_CACHE_MS, clearSupportStatusCache, isSupportSessionStillActive } from "./_core/supportSession";

const fetchMock = vi.fn();

function answer(data: unknown, ok = true) {
  fetchMock.mockResolvedValueOnce({ ok, json: async () => ({ result: { data } }) });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  clearSupportStatusCache();
});
afterEach(() => vi.unstubAllGlobals());

describe("isSupportSessionStillActive", () => {
  it("consulta o master com a chave de API do restaurante e aceita quando active=true", async () => {
    answer({ active: true });
    await expect(isSupportSessionStillActive(7, 1_000)).resolves.toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://painel.exemplo.com/api/trpc/support.checkSession");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer rk_live_teste");
    expect(JSON.parse(init.body)).toEqual({ supportSessionId: 7 });
  });

  it("usa cache curto e consulta de novo depois que ele vence", async () => {
    answer({ active: true });
    await isSupportSessionStillActive(7, 1_000);
    await isSupportSessionStillActive(7, 1_000 + SUPPORT_STATUS_CACHE_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    answer({ active: false });
    await expect(isSupportSessionStillActive(7, 1_000 + SUPPORT_STATUS_CACHE_MS + 1)).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sessão encerrada no master (active=false) não vale", async () => {
    answer({ active: false });
    await expect(isSupportSessionStillActive(8, 1_000)).resolves.toBe(false);
  });

  it("falha fechada: erro HTTP, resposta estranha ou rede fora = sem suporte", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    await expect(isSupportSessionStillActive(1, 1_000)).resolves.toBe(false);

    answer({ active: "true" });
    await expect(isSupportSessionStillActive(2, 1_000)).resolves.toBe(false);

    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(isSupportSessionStillActive(3, 1_000)).resolves.toBe(false);
  });
});
