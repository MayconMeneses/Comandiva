import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ ENV: { platformJwtSecret: "test-only-platform-secret-32-chars-min", operatorToken: "", requirePlatform2fa: false } }));
vi.mock("./env", () => env);

import type { TrpcContext } from "./context";
import { platformAdminProcedure, platformAdminProcedureFor, platformSecurityProcedure, router } from "./trpc";

const testRouter = router({
  painel: platformAdminProcedure.query(() => "ok"),
  area: platformAdminProcedureFor("planos").query(() => "ok"),
  seguranca: platformSecurityProcedure.query(() => "ok"),
});

function ctx(totpEnabled: boolean): TrpcContext {
  return { req: {}, res: {}, restaurant: null, platformAdmin: { id: 1, active: true, role: "owner", permissions: ["planos"], totpEnabled } } as unknown as TrpcContext;
}

beforeEach(() => {
  env.ENV.requirePlatform2fa = false;
});

describe("PLATFORM_REQUIRE_2FA", () => {
  it("desligado (padrão): conta sem 2FA usa o painel normalmente", async () => {
    const caller = testRouter.createCaller(ctx(false));
    await expect(caller.painel()).resolves.toBe("ok");
    await expect(caller.area()).resolves.toBe("ok");
  });

  it("ligado: conta SEM 2FA é barrada no servidor em todo o painel, mas passa na tela Segurança", async () => {
    env.ENV.requirePlatform2fa = true;
    const caller = testRouter.createCaller(ctx(false));
    await expect(caller.painel()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.area()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.seguranca()).resolves.toBe("ok");
  });

  it("ligado: conta COM 2FA usa tudo normalmente", async () => {
    env.ENV.requirePlatform2fa = true;
    const caller = testRouter.createCaller(ctx(true));
    await expect(caller.painel()).resolves.toBe("ok");
    await expect(caller.area()).resolves.toBe("ok");
  });

  it("Segurança continua exigindo sessão válida", async () => {
    const anonymous = { req: {}, res: {}, restaurant: null, platformAdmin: null } as unknown as TrpcContext;
    await expect(testRouter.createCaller(anonymous).seguranca()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
