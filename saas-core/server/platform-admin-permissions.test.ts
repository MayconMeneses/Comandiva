import { describe, expect, it, vi } from "vitest";
import { parseMasterPermissions, serializeMasterPermissions } from "./_core/permissions";

describe("parseMasterPermissions / serializeMasterPermissions", () => {
  it("serializa e desserializa de volta pro mesmo array (sem duplicatas)", () => {
    const serialized = serializeMasterPermissions(["planos", "auditoria", "planos"]);
    expect(serialized).toBe(JSON.stringify(["planos", "auditoria"]));
    expect(parseMasterPermissions(serialized)).toEqual(["planos", "auditoria"]);
  });

  it("array vazio ou undefined serializa pra null (nenhuma área extra)", () => {
    expect(serializeMasterPermissions([])).toBeNull();
    expect(serializeMasterPermissions(undefined)).toBeNull();
  });

  it("nunca aceita uma área que não está em GRANTABLE_MASTER_AREAS, mesmo se vier de um JSON manipulado", () => {
    expect(parseMasterPermissions(JSON.stringify(["planos", "algo_inventado", "equipe"]))).toEqual(["planos", "equipe"]);
  });

  it("JSON quebrado ou não-array nunca derruba a aplicação — vira lista vazia", () => {
    expect(parseMasterPermissions("{isso não é json válido")).toEqual([]);
    expect(parseMasterPermissions(JSON.stringify({ not: "an array" }))).toEqual([]);
    expect(parseMasterPermissions(null)).toEqual([]);
    expect(parseMasterPermissions(undefined)).toEqual([]);
  });
});

// platformAdminProcedureFor em si é testado indiretamente (é middleware tRPC
// puro sem I/O) — a lógica real que importa está coberta acima (parse/serialize)
// e em withParsedPermissions (db/platformAdmins.ts), testado a seguir.
const dbMocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db/client", () => ({ getDb: dbMocks.getDb }));

import { getPlatformAdminById } from "./db/platformAdmins";

describe("getPlatformAdminById — owner vs member", () => {
  it("owner sempre recebe todas as áreas, mesmo que a coluna permissions esteja vazia", async () => {
    dbMocks.getDb.mockResolvedValue({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 1, name: "Dono", email: "a@a.com", passwordHash: "x", role: "owner", permissions: null, active: true, lastSignedInAt: null, createdAt: 0, updatedAt: 0 }] }) }) }),
    });
    const admin = await getPlatformAdminById(1);
    expect(admin?.permissions).toEqual(["restaurantes", "planos", "auditoria", "modo_suporte", "billing", "equipe"]);
  });

  it("member só recebe as áreas realmente salvas na coluna permissions", async () => {
    dbMocks.getDb.mockResolvedValue({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 2, name: "Membro", email: "b@b.com", passwordHash: "x", role: "member", permissions: JSON.stringify(["planos"]), active: true, lastSignedInAt: null, createdAt: 0, updatedAt: 0 }] }) }) }),
    });
    const admin = await getPlatformAdminById(2);
    expect(admin?.permissions).toEqual(["planos"]);
  });

  it("member sem nenhuma permissions salva (null) não recebe área nenhuma", async () => {
    dbMocks.getDb.mockResolvedValue({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 3, name: "Membro vazio", email: "c@c.com", passwordHash: "x", role: "member", permissions: null, active: true, lastSignedInAt: null, createdAt: 0, updatedAt: 0 }] }) }) }),
    });
    const admin = await getPlatformAdminById(3);
    expect(admin?.permissions).toEqual([]);
  });
});
