import { describe, it, expect } from "vitest";
import { plural } from "../../src/domain/model";

describe("plural", () => {
  it("usa el singular solo con una unidad", () => {
    expect(plural(1, "pedido")).toBe("1 pedido");
    expect(plural(2, "pedido")).toBe("2 pedidos");
    expect(plural(0, "pedido")).toBe("0 pedidos");
  });

  it("aplica la regla básica del español sin forma plural explícita", () => {
    expect(plural(3, "día")).toBe("3 días");
    expect(plural(2, "unidad")).toBe("2 unidades");
    expect(plural(2, "lápiz")).toBe("2 lápices");
  });

  it("respeta la forma plural indicada para frases y acentos", () => {
    expect(plural(1, "cotización", "cotizaciones")).toBe("1 cotización");
    expect(plural(4, "cotización", "cotizaciones")).toBe("4 cotizaciones");
    expect(plural(1, "listo para iniciar", "listos para iniciar")).toBe("1 listo para iniciar");
  });

  it("separa los miles en formato de México", () => {
    expect(plural(1000, "pieza")).toBe("1,000 piezas");
  });
});
