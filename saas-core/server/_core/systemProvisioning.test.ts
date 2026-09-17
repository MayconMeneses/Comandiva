import { describe, expect, it } from "vitest";
import { computeDeploymentPorts, slugifyRestaurantName } from "./systemProvisioning";

describe("slugifyRestaurantName", () => {
  it("minúsculas, sem acento, espaços viram hífen", () => {
    expect(slugifyRestaurantName("Restaurante da Maria", 7)).toBe("restaurante-da-maria-7");
  });

  it("remove caracteres especiais", () => {
    expect(slugifyRestaurantName("Pizzaria & Cia. Ltda!", 3)).toBe("pizzaria-cia-ltda-3");
  });

  it("nome vazio ainda gera um slug válido", () => {
    expect(slugifyRestaurantName("", 9)).toBe("restaurante-9");
  });

  it("dois restaurantes com o mesmo nome social geram slugs diferentes (sufixo do id)", () => {
    const a = slugifyRestaurantName("Bar do João", 1);
    const b = slugifyRestaurantName("Bar do João", 2);
    expect(a).not.toBe(b);
  });

  it("nome muito longo é truncado antes do sufixo do id", () => {
    const slug = slugifyRestaurantName("A".repeat(100), 5);
    expect(slug.endsWith("-5")).toBe(true);
    expect(slug.length).toBeLessThan(50);
  });
});

describe("computeDeploymentPorts", () => {
  it("é determinístico — mesmo id sempre gera as mesmas portas", () => {
    expect(computeDeploymentPorts(7)).toEqual(computeDeploymentPorts(7));
  });

  it("ids diferentes nunca colidem", () => {
    const a = computeDeploymentPorts(1);
    const b = computeDeploymentPorts(2);
    expect(a.appPort).not.toBe(b.appPort);
    expect(a.mysqlPort).not.toBe(b.mysqlPort);
  });

  it("fica bem longe das portas já usadas nesta máquina (3000/3011/3306/3308/4000/5173/9000/9013)", () => {
    const ports = computeDeploymentPorts(1);
    expect(ports.appPort).toBeGreaterThanOrEqual(5010);
  });

  it("mysqlPort/s3Port/s3ConsolePort nunca colidem entre si pro mesmo id", () => {
    const ports = computeDeploymentPorts(4);
    const values = [ports.appPort, ports.mysqlPort, ports.s3Port, ports.s3ConsolePort];
    expect(new Set(values).size).toBe(values.length);
  });
});
