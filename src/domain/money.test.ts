import { describe, expect, it } from "vitest";
import {
  aDecimalString,
  centavos,
  desdeDecimalString,
  formatear,
  restar,
  sumar,
} from "./money";

describe("desdeDecimalString", () => {
  it("parsea decimales con punto", () => {
    expect(desdeDecimalString("1234.56")).toBe(123456);
    expect(desdeDecimalString("0.05")).toBe(5);
    expect(desdeDecimalString("100")).toBe(10000);
  });

  it("parsea formato es-AR (coma decimal, punto de miles)", () => {
    expect(desdeDecimalString("1234,56")).toBe(123456);
    expect(desdeDecimalString("1.234,56")).toBe(123456);
    expect(desdeDecimalString("12.345.678,90")).toBe(1234567890);
  });

  it("rechaza formatos inválidos", () => {
    expect(() => desdeDecimalString("")).toThrow();
    expect(() => desdeDecimalString("abc")).toThrow();
    expect(() => desdeDecimalString("12.345")).toThrow(); // 3 decimales = ambiguo
    expect(() => desdeDecimalString("1.234")).toThrow(); // miles sin coma = ambiguo
    expect(() => desdeDecimalString("-5")).toThrow();
    expect(() => desdeDecimalString("1,234")).toThrow(); // 3 decimales con coma
  });
});

describe("aDecimalString", () => {
  it("convierte centavos a string decimal", () => {
    expect(aDecimalString(123456)).toBe("1234.56");
    expect(aDecimalString(5)).toBe("0.05");
    expect(aDecimalString(0)).toBe("0.00");
  });
});

describe("centavos / aritmética", () => {
  it("rechaza no enteros", () => {
    expect(() => centavos(10.5)).toThrow();
    expect(() => centavos(NaN)).toThrow();
  });

  it("suma y resta manteniendo enteros", () => {
    expect(sumar(10050, 25)).toBe(10075);
    expect(restar(10050, 10075)).toBe(-25);
  });
});

describe("formatear", () => {
  it("formatea en es-AR", () => {
    const out = formatear(123456, "ARS");
    expect(out).toContain("1.234,56");
  });
});
