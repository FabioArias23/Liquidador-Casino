/**
 * Códigos de error de aplicación (negocio, no técnicos).
 * Se serializan a través del límite cliente/servidor con códigos estables.
 * Ver PLAN-TECNICO.md §8 (Result pattern).
 *
 * Uso:
 *   const error = errorNegocio(codigos.PERMISO_DENEGADO, "No podés aprobar pagos");
 */

import { ErrorNegocio } from "@/domain/result";

export const codigos = {
  // Genéricos
  DESCONOCIDO: "DESCONOCIDO",

  // Auth / sesión
  NO_AUTENTICADO: "NO_AUTENTICADO",
  SESION_EXPIRADA: "SESION_EXPIRADA",

  // Autorización
  PERMISO_DENEGADO: "PERMISO_DENEGADO",

  // Tenants
  TENANT_NO_ENCONTRADO: "TENANT_NO_ENCONTRADO",
  TENANT_SLUG_DUPLICADO: "TENANT_SLUG_DUPLICADO",
  TENANT_SUSPENDIDO: "TENANT_SUSPENDIDO",

  // Profiles
  PROFILE_NO_ENCONTRADO: "PROFILE_NO_ENCONTRADO",
  EMAIL_DUPLICADO: "EMAIL_DUPLICADO",

  // Members
  MIEMBRO_NO_ENCONTRADO: "MIEMBRO_NO_ENCONTRADO",
  MIEMBRO_DUPLICADO: "MIEMBRO_DUPLICADO",

  // CBU
  CBU_INVALIDO: "CBU_INVALIDO",
  CBU_DUPLICADO: "CBU_DUPLICADO",

  // Casino credentials
  CREDENCIALES_NO_ENCONTRADAS: "CREDENCIALES_NO_ENCONTRADAS",

  // Cargas (state machine + validaciones de input)
  TRANSICION_INVALIDA: "TRANSICION_INVALIDA",
  COMPROBANTE_REQUERIDO: "COMPROBANTE_REQUERIDO",
  MOTIVO_REQUERIDO: "MOTIVO_REQUERIDO",

  // Ledger
  ASIENTO_DESBALANCEADO: "ASIENTO_DESBALANCEADO",
  MOVIMIENTOS_INVALIDOS: "MOVIMIENTOS_INVALIDOS",

  // Idempotencia
  DUPLICADO_POR_EXTERNAL_REF: "DUPLICADO_POR_EXTERNAL_REF",

  // TenantConfig (jsonb validado por Zod)
  TENANT_CONFIG_INVALIDA: "TENANT_CONFIG_INVALIDA",

  // Cargas (entidad)
  CARGA_NO_ENCONTRADA: "CARGA_NO_ENCONTRADA",
  CONCURRENCIA: "CONCURRENCIA",

  // Retiros (entidad)
  RETIRO_NO_ENCONTRADO: "RETIRO_NO_ENCONTRADO",

  // Input
  INPUT_INVALIDO: "INPUT_INVALIDO",
} as const;

export type CodigoError = (typeof codigos)[keyof typeof codigos];

export function errorNegocio(
  codigo: CodigoError,
  mensaje: string,
): ErrorNegocio {
  return new ErrorNegocio(codigo, mensaje);
}
