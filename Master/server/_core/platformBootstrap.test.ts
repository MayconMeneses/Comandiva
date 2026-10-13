import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countPlatformAdmins: vi.fn(),
  createPlatformAdmin: vi.fn(),
}));
vi.mock("../db/platformAdmins", () => ({ countPlatformAdmins: mocks.countPlatformAdmins, createPlatformAdmin: mocks.createPlatformAdmin }));

import { bootstrapFirstPlatformAdmin } from "./platformBootstrap";

const INPUT = { name: "Dono", email: "Dono@Exemplo.com", password: "senha-do-env-123" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("bootstrap do primeiro Super Admin", () => {
  it("cria a conta quando NÃO existe nenhum admin", async () => {
    mocks.countPlatformAdmins.mockResolvedValue(0);
    await expect(bootstrapFirstPlatformAdmin(INPUT)).resolves.toBe("created");
    expect(mocks.createPlatformAdmin).toHaveBeenCalledWith({ name: "Dono", email: "dono@exemplo.com", password: "senha-do-env-123" });
  });

  it("não cria nem altera NADA quando já existe qualquer admin (mesmo com e-mail diferente do .env)", async () => {
    mocks.countPlatformAdmins.mockResolvedValue(1);
    await expect(bootstrapFirstPlatformAdmin({ ...INPUT, email: "outro@exemplo.com" })).resolves.toBe("admin-already-exists");
    expect(mocks.createPlatformAdmin).not.toHaveBeenCalled();
  });

  it("avisa no log (sem imprimir a senha) quando a senha continua no .env e já existe admin", async () => {
    mocks.countPlatformAdmins.mockResolvedValue(1);
    await bootstrapFirstPlatformAdmin(INPUT);
    const warn = vi.mocked(console.warn);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("BOOTSTRAP_SUPERADMIN_PASSWORD");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("senha-do-env-123");
  });

  it("sem aviso quando a senha já foi removida do .env", async () => {
    mocks.countPlatformAdmins.mockResolvedValue(1);
    await bootstrapFirstPlatformAdmin({ ...INPUT, password: "" });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("variáveis em branco e nenhum admin: não faz nada", async () => {
    mocks.countPlatformAdmins.mockResolvedValue(0);
    await expect(bootstrapFirstPlatformAdmin({ name: "", email: "", password: "" })).resolves.toBe("not-configured");
    expect(mocks.createPlatformAdmin).not.toHaveBeenCalled();
  });
});
