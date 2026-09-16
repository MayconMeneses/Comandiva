import { describe, expect, it } from "vitest";
import { assertSafeDeploymentUrl } from "./urlSafety";

describe("assertSafeDeploymentUrl", () => {
  it("aceita uma URL https pública normal", () => {
    expect(() => assertSafeDeploymentUrl("https://pubx.exemplo.com")).not.toThrow();
  });

  it("rejeita http (exige https)", () => {
    expect(() => assertSafeDeploymentUrl("http://pubx.exemplo.com")).toThrow(/https/);
  });

  it("rejeita localhost e endereços de loopback/rede privada", () => {
    expect(() => assertSafeDeploymentUrl("https://localhost:3000")).toThrow();
    expect(() => assertSafeDeploymentUrl("https://127.0.0.1")).toThrow();
    expect(() => assertSafeDeploymentUrl("https://10.0.0.5")).toThrow();
    expect(() => assertSafeDeploymentUrl("https://172.17.0.1")).toThrow();
    expect(() => assertSafeDeploymentUrl("https://192.168.1.10")).toThrow();
    expect(() => assertSafeDeploymentUrl("https://169.254.169.254")).toThrow();
  });

  it("rejeita URL malformada", () => {
    expect(() => assertSafeDeploymentUrl("não é uma url")).toThrow();
  });

  it("não confunde host público com prefixo parecido (ex.: 172.200.x não é rede privada)", () => {
    expect(() => assertSafeDeploymentUrl("https://172.200.0.1")).not.toThrow();
  });
});
