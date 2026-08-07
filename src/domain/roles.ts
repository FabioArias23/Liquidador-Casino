export const ROLES = ["tenant_admin", "supervisor", "operador"] as const;
export type Rol = (typeof ROLES)[number];

export const PERMISOS = [
  "cargas.registrar",
  "cargas.validar",
  "retiros.validar",
  "retiros.aprobar",
  "pagos.ejecutar",
  "miembros.gestionar",
  "config.editar",
  "tenants.gestionar", // solo superadmin (flag global, no rol de tenant)
] as const;
export type Permiso = (typeof PERMISOS)[number];

export const PERMISOS_POR_ROL: Record<Rol, readonly Permiso[]> = {
  operador: ["cargas.registrar", "cargas.validar", "retiros.validar"],
  supervisor: [
    "cargas.registrar",
    "cargas.validar",
    "retiros.validar",
    "retiros.aprobar",
    "pagos.ejecutar",
  ],
  tenant_admin: [
    "cargas.registrar",
    "cargas.validar",
    "retiros.validar",
    "retiros.aprobar",
    "pagos.ejecutar",
    "miembros.gestionar",
    "config.editar",
  ],
};

export function tienePermiso(rol: Rol, permiso: Permiso): boolean {
  return PERMISOS_POR_ROL[rol].includes(permiso);
}

/** Cuatro ojos: quien aprueba no puede ser quien paga. */
export function cuatroOjosCumple(aprobadoPor: string, pagadoPor: string): boolean {
  return aprobadorDistinto(aprobadoPor, pagadoPor);
}

function aprobadorDistinto(a: string, b: string): boolean {
  return a.length > 0 && b.length > 0 && a !== b;
}

export const ESTADOS_TENANT = ["activo", "suspendido"] as const;
export type EstadoTenant = (typeof ESTADOS_TENANT)[number];
