import { describe, expect, it } from "vitest";
import { calcularDigito, normalizarCBU, validarCBU } from "./cbu";

function cbuValido(cuerpo1 = "0720000", cuerpo2 = "0000000000001"): string {
  const bloque1 = cuerpo1 + String(calcularDigito(cuerpo1));
  const bloque2 = cuerpo2 + String(calcularDigito(cuerpo2));
  return bloque1 + bloque2;
}

describe("validarCBU", () => {
  it("acepta un CBU con dígitos verificadores correctos", () => {
    expect(validarCBU(cbuValido())).toBe(true);
    expect(validarCBU(cbuValido("1234567", "9876543210123"))).toBe(true);
  });

  it("rechaza un dígito verificador incorrecto", () => {
    const cbu = cbuValido();
    const mal = cbu.slice(0, 7) + String((Number(cbu[7]) + 1) % 10) + cbu.slice(8);
    expect(validarCBU(mal)).toBe(false);
  });

  it("detecta la corrupción de cualquier dígito del cuerpo", () => {
    const cbu = cbuValido("2850590", "1234567890123");
    for (let i = 0; i < 22; i++) {
      const corrompido =
        cbu.slice(0, i) + String((Number(cbu[i]) + 1) % 10) + cbu.slice(i + 1);
      expect(validarCBU(corrompido), `posición ${i}`).toBe(false);
    }
  });

  it("rechaza largos incorrectos, letras y vacíos", () => {
    expect(validarCBU("")).toBe(false);
    expect(validarCBU("123456789012345678901")).toBe(false); // 21
    expect(validarCBU("12345678901234567890123")).toBe(false); // 23
    expect(validarCBU("a".repeat(22))).toBe(false);
    expect(validarCBU("072000071000000000001X")).toBe(false);
  });
});

describe("normalizarCBU", () => {
  it("quita espacios y guiones antes de validar", () => {
    const cbu = cbuValido();
    expect(normalizarCBU(` ${cbu.slice(0, 8)} ${cbu.slice(8)} `)).toBe(cbu);
    expect(normalizarCBU(`${cbu.slice(0, 8)}-${cbu.slice(8)}`)).toBe(cbu);
  });

  it("devuelve null si es inválido", () => {
    expect(normalizarCBU("123")).toBeNull();
  });
});
