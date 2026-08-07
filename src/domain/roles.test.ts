import { describe, expect, it } from "vitest";
import { cuatroOjosCumple, tienePermiso } from "./roles";

describe("tienePermiso", () => {
  it("operador valida pero no aprueba ni paga", () => {
    expect(tienePermiso("operador", "cargas.validar")).toBe(true);
    expect(tienePermiso("operador", "retiros.validar")).toBe(true);
    expect(tienePermiso("operador", "retiros.aprobar")).toBe(false);
    expect(tienePermiso("operador", "pagos.ejecutar")).toBe(false);
    expect(tienePermiso("operador", "config.editar")).toBe(false);
  });

  it("supervisor aprueba y paga pero no configura", () => {
    expect(tienePermiso("supervisor", "retiros.aprobar")).toBe(true);
    expect(tienePermiso("supervisor", "pagos.ejecutar")).toBe(true);
    expect(tienePermiso("supervisor", "miembros.gestionar")).toBe(false);
  });

  it("tenant_admin tiene permisos de gestión", () => {
    expect(tienePermiso("tenant_admin", "miembros.gestionar")).toBe(true);
    expect(tienePermiso("tenant_admin", "config.editar")).toBe(true);
  });

  it("tenants.gestionar no lo tiene ningún rol de tenant (solo superadmin)", () => {
    expect(tienePermiso("tenant_admin", "tenants.gestionar")).toBe(false);
  });
});

describe("cuatroOjosCumple", () => {
  it("exige usuarios distintos y no vacíos", () => {
    expect(cuatroOjosCumple("user-a", "user-b")).toBe(true);
    expect(cuatroOjosCumple("user-a", "user-a")).toBe(false);
    expect(cuatroOjosCumple("", "user-b")).toBe(false);
    expect(cuatroOjosCumple("user-a", "")).toBe(false);
  });
});
