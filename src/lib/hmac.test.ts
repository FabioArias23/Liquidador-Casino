/**
 * Tests del helper de firma HMAC para webhooks del casino.
 *
 * La firma cubre: body + timestamp + nonce. Esto evita que un atacante
 * pueda reutilizar un webhook viejo cambiando solo el body.
 */

import { describe, expect, it } from "vitest";

import { calcularFirma, verificarFirma } from "@/lib/hmac";

const SECRET = "test-secret-32-chars-min-aaaa";
const BODY = '{"externalRef":"abc-123","montoCents":50000}';
const TIMESTAMP = "1700000000";
const NONCE = "nonce-uuid-1234";

describe("calcularFirma", () => {
  it("devuelve un string hex de 64 chars (SHA-256)", () => {
    const firma = calcularFirma(SECRET, BODY, TIMESTAMP, NONCE);
    expect(firma).toMatch(/^[a-f0-9]{64}$/);
  });

  it("es deterministica: misma entrada = misma firma", () => {
    const a = calcularFirma(SECRET, BODY, TIMESTAMP, NONCE);
    const b = calcularFirma(SECRET, BODY, TIMESTAMP, NONCE);
    expect(a).toBe(b);
  });

  it("cambia si cambia el body aunque cambie 1 byte", () => {
    const a = calcularFirma(SECRET, BODY, TIMESTAMP, NONCE);
    const b = calcularFirma(SECRET, BODY + " ", TIMESTAMP, NONCE);
    expect(a).not.toBe(b);
  });

  it("cambia si cambia el timestamp", () => {
    const a = calcularFirma(SECRET, BODY, TIMESTAMP, NONCE);
    const b = calcularFirma(SECRET, BODY, "1700000001", NONCE);
    expect(a).not.toBe(b);
  });

  it("cambia si cambia el nonce", () => {
    const a = calcularFirma(SECRET, BODY, TIMESTAMP, NONCE);
    const b = calcularFirma(SECRET, BODY, TIMESTAMP, "nonce-uuid-9999");
    expect(a).not.toBe(b);
  });

  it("cambia si cambia el secret", () => {
    const a = calcularFirma(SECRET, BODY, TIMESTAMP, NONCE);
    const b = calcularFirma("otro-secret-32-chars-min-bbbb", BODY, TIMESTAMP, NONCE);
    expect(a).not.toBe(b);
  });
});

describe("verificarFirma", () => {
  it("devuelve true cuando la firma coincide", () => {
    const firma = calcularFirma(SECRET, BODY, TIMESTAMP, NONCE);
    expect(verificarFirma(SECRET, BODY, firma, TIMESTAMP, NONCE)).toBe(true);
  });

  it("devuelve false cuando la firma no coincide (otro secret)", () => {
    const firma = calcularFirma(SECRET, BODY, TIMESTAMP, NONCE);
    expect(
      verificarFirma("otro-secret-32-chars-min-bbbb", BODY, firma, TIMESTAMP, NONCE),
    ).toBe(false);
  });

  it("devuelve false cuando cambia el body (signature no incluye body nuevo)", () => {
    const firma = calcularFirma(SECRET, BODY, TIMESTAMP, NONCE);
    expect(verificarFirma(SECRET, BODY + "x", firma, TIMESTAMP, NONCE)).toBe(false);
  });

  it("devuelve false cuando cambia el timestamp", () => {
    const firma = calcularFirma(SECRET, BODY, TIMESTAMP, NONCE);
    expect(verificarFirma(SECRET, BODY, firma, "9999999999", NONCE)).toBe(false);
  });

  it("devuelve false cuando cambia el nonce", () => {
    const firma = calcularFirma(SECRET, BODY, TIMESTAMP, NONCE);
    expect(verificarFirma(SECRET, BODY, firma, TIMESTAMP, "otro-nonce")).toBe(
      false,
    );
  });

  it("devuelve false con firma de longitud incorrecta", () => {
    expect(verificarFirma(SECRET, BODY, "corta", TIMESTAMP, NONCE)).toBe(false);
  });

  it("devuelve false con firma vacia", () => {
    expect(verificarFirma(SECRET, BODY, "", TIMESTAMP, NONCE)).toBe(false);
  });
});
