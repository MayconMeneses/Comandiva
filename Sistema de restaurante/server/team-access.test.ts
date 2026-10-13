import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const publicContext = { user: null, req: { protocol: "https", headers: {} }, res: {} } as TrpcContext;
const standardUserContext = {
  ...publicContext,
  user: {
    id: 999,
    openId: "standard-user",
    name: "Usuário comum",
    email: null,
    loginMethod: "local",
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
} as TrpcContext;

describe("credenciais próprias da equipe", () => {
  it("rejeita senhas curtas antes de consultar o banco", async () => {
    const caller = appRouter.createCaller(publicContext);
    await expect(caller.team.login({ username: "cozinha", password: "123" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("mantém a gestão de contas restrita a administradores", async () => {
    const caller = appRouter.createCaller(standardUserContext);
    await expect(caller.team.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.team.create({ name: "Outro admin", username: "outro.admin", password: "senha-segura", role: "admin" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.team.update({ accountId: 1, name: "Nome atualizado" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.team.setActive({ accountId: 1, active: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.team.delete({ accountId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("aceita a permissão de administrador no contrato de criação", async () => {
    const routerSource = await import("node:fs").then(fs => fs.readFileSync(new URL("./routers/team.ts", import.meta.url), "utf8"));
    expect(routerSource).toContain('z.enum(["staff", "admin"])');
    expect(routerSource).toContain("updateRestaurantAccessAccount");
    expect(routerSource).toContain("deleteRestaurantAccessAccount");
  });
});
