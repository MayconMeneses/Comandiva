import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regras de plataforma_admins que não dependem de MySQL de verdade: o banco é
 * trocado por um falso que registra o que foi gravado.
 */
const h = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  updates: [] as Record<string, unknown>[],
  dummySpy: vi.fn(),
}));

vi.mock("./client", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => Object.assign(Promise.resolve(h.rows), { where: () => ({ limit: async () => h.rows }) }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        h.updates.push(values);
        return { where: async () => [{ affectedRows: 1 }] };
      },
    }),
  }),
}));
vi.mock("../_core/platformPassword", async importOriginal => {
  const actual = await importOriginal<typeof import("../_core/platformPassword")>();
  return {
    ...actual,
    verifyAgainstDummyPasswordHash: async (password: string) => {
      h.dummySpy();
      return actual.verifyAgainstDummyPasswordHash(password);
    },
  };
});

import { hashPlatformPassword } from "../_core/platformPassword";
import { authenticatePlatformAdmin, getPlatformAdminById, listPlatformAdmins, setPlatformAdminActive, updatePlatformAdmin, updatePlatformAdminPassword } from "./platformAdmins";

const baseRow = {
  id: 1,
  name: "Dono",
  email: "dono@exemplo.com",
  passwordHash: "segredo-do-hash",
  role: "owner",
  permissions: null,
  active: true,
  totpSecret: "v1:iv:tag:cifra",
  totpEnabled: true,
  totpLastStep: 12345,
  sessionsValidAfter: 1700000000,
  lastSignedInAt: null,
  createdAt: 0,
  updatedAt: 0,
};

beforeEach(() => {
  h.rows = [{ ...baseRow }];
  h.updates = [];
  h.dummySpy.mockClear();
});

describe("segredos nunca saem nas respostas de equipe", () => {
  it("listPlatformAdmins remove hash de senha, segredo do 2FA, passo e marco de sessão — mantém só o booleano totpEnabled", async () => {
    const [admin] = await listPlatformAdmins();
    expect(admin).toMatchObject({ id: 1, totpEnabled: true });
    for (const key of ["passwordHash", "totpSecret", "totpLastStep", "sessionsValidAfter"]) expect(admin).not.toHaveProperty(key);
    expect(JSON.stringify(admin)).not.toContain("segredo-do-hash");
    expect(JSON.stringify(admin)).not.toContain("cifra");
  });

  it("getPlatformAdminById (contexto de sessão) remove os segredos mas mantém sessionsValidAfter pro context.ts", async () => {
    const admin = await getPlatformAdminById(1);
    for (const key of ["passwordHash", "totpSecret", "totpLastStep"]) expect(admin).not.toHaveProperty(key);
    expect(admin).toHaveProperty("sessionsValidAfter", 1700000000);
  });
});

describe("sessões são derrubadas no servidor (sessionsValidAfter em segundos)", () => {
  const nowSeconds = () => Math.floor(Date.now() / 1000);

  it("updatePlatformAdmin COM senha grava sessionsValidAfter; sem senha não", async () => {
    await updatePlatformAdmin(1, { name: "Dono", password: "nova-senha-123" });
    expect(h.updates[0]).toHaveProperty("passwordHash");
    expect(h.updates[0]!.sessionsValidAfter).toBeGreaterThanOrEqual(nowSeconds() - 1);

    await updatePlatformAdmin(1, { name: "Só o nome" });
    expect(h.updates[1]).not.toHaveProperty("sessionsValidAfter");
  });

  it("updatePlatformAdminPassword grava sessionsValidAfter", async () => {
    await updatePlatformAdminPassword(1, "outra-senha-123");
    expect(h.updates[0]!.sessionsValidAfter).toBeGreaterThanOrEqual(nowSeconds() - 1);
  });

  it("pausar a conta grava sessionsValidAfter; reativar NÃO mexe (e portanto não ressuscita sessões antigas)", async () => {
    await setPlatformAdminActive(1, false);
    expect(h.updates[0]).toMatchObject({ active: false });
    expect(h.updates[0]!.sessionsValidAfter).toBeGreaterThanOrEqual(nowSeconds() - 1);

    await setPlatformAdminActive(1, true);
    expect(h.updates[1]).toMatchObject({ active: true });
    expect(h.updates[1]).not.toHaveProperty("sessionsValidAfter");
  });
});

describe("authenticatePlatformAdmin — mesmo trabalho (scrypt) em qualquer falha", () => {
  it("e-mail inexistente executa o scrypt dummy e responde como falha", async () => {
    h.rows = [];
    await expect(authenticatePlatformAdmin("ninguem@exemplo.com", "qualquer")).resolves.toEqual({ ok: false, knownAdmin: null });
    expect(h.dummySpy).toHaveBeenCalledTimes(1);
  });

  it("conta pausada executa o scrypt dummy, mesmo com a senha certa", async () => {
    h.rows = [{ ...baseRow, active: false, passwordHash: await hashPlatformPassword("senha-certa") }];
    await expect(authenticatePlatformAdmin("dono@exemplo.com", "senha-certa")).resolves.toMatchObject({ ok: false });
    expect(h.dummySpy).toHaveBeenCalledTimes(1);
  });

  it("senha certa de conta ativa: ok, sem dummy, e sem vazar hash/segredo", async () => {
    h.rows = [{ ...baseRow, passwordHash: await hashPlatformPassword("senha-certa") }];
    const result = await authenticatePlatformAdmin("dono@exemplo.com", "senha-certa");
    expect(result).toEqual({ ok: true, admin: { id: 1, name: "Dono", email: "dono@exemplo.com", totpEnabled: true } });
    expect(h.dummySpy).not.toHaveBeenCalled();
  });

  it("senha errada de conta ativa: falha identificando a conta só pra auditoria interna", async () => {
    h.rows = [{ ...baseRow, passwordHash: await hashPlatformPassword("senha-certa") }];
    await expect(authenticatePlatformAdmin("dono@exemplo.com", "errada")).resolves.toEqual({ ok: false, knownAdmin: { id: 1, email: "dono@exemplo.com" } });
  });
});
