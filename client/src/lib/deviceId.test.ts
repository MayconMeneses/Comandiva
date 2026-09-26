// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDeviceId } from "./deviceId";

const STORAGE_KEY = "mm-system-creator-device-id-v1";
// Mesmo padrão exigido pelo servidor pra esse campo (deviceId em
// updateOrderStatus, server/routers/admin/orders.ts): z.string().min(8).max(64).regex(/^[a-zA-Z0-9-]+$/).
const DEVICE_ID_SHAPE = /^[a-zA-Z0-9-]{8,64}$/;

describe("getDeviceId — Fase 6 (teste de caos): sobrevive a reload de verdade?", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("primeira chamada gera um id no formato esperado pelo servidor e grava em localStorage", () => {
    const id = getDeviceId();
    expect(id).toMatch(DEVICE_ID_SHAPE);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(id);
  });

  it("chamadas seguintes (mesmo 'aparelho', sem limpar o storage) devolvem o MESMO id — é isso que sobrevive a um reload de página, já que a função não guarda nada em memória, só lê localStorage a cada chamada", () => {
    const first = getDeviceId();
    const second = getDeviceId();
    const third = getDeviceId();
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("localStorage limpo (ex.: outro navegador/aparelho, ou storage apagado) gera um id DIFERENTE do anterior", () => {
    const first = getDeviceId();
    localStorage.clear();
    const second = getDeviceId();
    expect(second).not.toBe(first);
  });

  it("localStorage indisponível (modo privado bloqueando getItem/setItem): não lança erro, ainda devolve um id válido — só não persiste entre chamadas", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("blocked"); });

    const first = getDeviceId();
    const second = getDeviceId();
    expect(first).toMatch(DEVICE_ID_SHAPE);
    expect(second).toMatch(DEVICE_ID_SHAPE);
    // Sem storage de verdade, cada chamada gera um novo — degradação
    // aceitável (perde persistência entre telas), não uma falha da função.
    expect(second).not.toBe(first);
  });
});
