import "fake-indexeddb/auto";
import { del } from "idb-keyval";
import { beforeEach, describe, expect, it } from "vitest";
import { OPERATIONAL_SNAPSHOT_MAX_AGE_MS, clearOperationalSnapshot, loadOperationalSnapshot, saveOperationalSnapshot, type OperationalSnapshot } from "./operationalSnapshotCache";

const KEY = "mm-operational-snapshot";
const SNAPSHOT: OperationalSnapshot = { orders: [], tables: [], pendingServiceRequests: [] };

describe("operationalSnapshotCache — Fase A do offline-first do painel", () => {
  beforeEach(async () => {
    await del(KEY);
  });

  it("save → load: devolve o mesmo snapshot salvo, com savedAt", async () => {
    const before = Date.now();
    await saveOperationalSnapshot(SNAPSHOT);
    const result = await loadOperationalSnapshot();
    expect(result?.snapshot).toEqual(SNAPSHOT);
    expect(result?.savedAt).toBeGreaterThanOrEqual(before);
  });

  it("sem nada salvo ainda: load devolve null", async () => {
    expect(await loadOperationalSnapshot()).toBeNull();
  });

  it("cache mais velho que OPERATIONAL_SNAPSHOT_MAX_AGE_MS (2h): descartado, load devolve null", async () => {
    await saveOperationalSnapshot(SNAPSHOT);
    const farFuture = Date.now() + OPERATIONAL_SNAPSHOT_MAX_AGE_MS + 60_000;
    expect(await loadOperationalSnapshot(farFuture)).toBeNull();
  });

  it("cache dentro da janela de 2h: continua válido", async () => {
    await saveOperationalSnapshot(SNAPSHOT);
    const almostExpired = Date.now() + OPERATIONAL_SNAPSHOT_MAX_AGE_MS - 60_000;
    expect(await loadOperationalSnapshot(almostExpired)).not.toBeNull();
  });

  it("clearOperationalSnapshot: remove o cache, load volta a devolver null", async () => {
    await saveOperationalSnapshot(SNAPSHOT);
    await clearOperationalSnapshot();
    expect(await loadOperationalSnapshot()).toBeNull();
  });
});
