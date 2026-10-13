import { describe, expect, it } from "vitest";
import { redactSecrets } from "./alerts";

describe("redactSecrets (alertas ao dono)", () => {
  it("esconde os valores (params) do erro de query do Drizzle — dado de cliente não vai pro Telegram", () => {
    const text = "Failed query: insert into `customers` (`phone`, `name`) values (?, ?)\nparams: 85999991234,Maria da Silva\n    at server/db/customers.ts:97:10";
    const out = redactSecrets(text);
    expect(out).not.toContain("85999991234");
    expect(out).not.toContain("Maria da Silva");
    expect(out).toContain("params: [REDACTED]");
    expect(out).toContain("server/db/customers.ts:97:10");
  });

  it("continua escondendo Bearer, chave de API e senha", () => {
    expect(redactSecrets("Authorization: Bearer abc123def456")).toContain("[REDACTED]");
    expect(redactSecrets("api_key=rk_live_abcdef123456")).not.toContain("abcdef123456");
    expect(redactSecrets("password: hunter22hunter")).not.toContain("hunter22hunter");
  });
});
