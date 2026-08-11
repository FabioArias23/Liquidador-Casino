/**
 * Server actions de Retiros.
 *
 * Cinco acciones: solicitar, validar, aprobar, pagar, rechazar.
 * Patrón: cada acción toma (tenantSlug, ...) y devuelve FormState.
 * revalidatePath se llama cuando la acción tiene éxito.
 */

"use server";

import { revalidatePath } from "next/cache";

import { aprobarRetiro } from "@/application/retiros/aprobar-retiro";
import { pagarPremio } from "@/application/retiros/pagar-premio";
import { rechazarRetiro } from "@/application/retiros/rechazar-retiro";
import { solicitarRetiro } from "@/application/retiros/solicitar-retiro";
import { validarRetiro } from "@/application/retiros/validar-retiro";
import { codigos } from "@/application/errors";
import { tenantConfigDefault } from "@/domain/schemas/tenant-config";
import { ErrorNegocio } from "@/domain/result";
import { auth, repos } from "@/lib/server";

export interface FormState {
  ok: boolean;
  error?: { codigo: string; mensaje: string };
}

const EMPTY: FormState = { ok: true };

export async function accionSolicitarRetiro(
  tenantSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: codigos.TENANT_NO_ENCONTRADO, mensaje: "Tenant no existe." } };

  const montoStr = String(formData.get("montoCents") ?? "");
  const montoCents = parsearMontoAcentavos(montoStr);

  try {
    const resultado = await solicitarRetiro(
      { retiros: r.retiros, audit: r.audit, members: r.members },
      sesion.userId,
      {
        tenantId: tenant.id,
        playerRef: String(formData.get("playerRef") ?? ""),
        montoCents,
        moneda: String(formData.get("moneda") ?? "ARS"),
        cbuDestino: String(formData.get("cbuDestino") ?? ""),
        aliasDestino: String(formData.get("aliasDestino") ?? "") || null,
        titularDestino: String(formData.get("titularDestino") ?? ""),
      },
    );
    if (!resultado.ok) {
      return { ok: false, error: { codigo: resultado.error.codigo, mensaje: resultado.error.mensaje } };
    }
    revalidatePath(`/backoffice/${tenantSlug}/retiros`);
    return EMPTY;
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return { ok: false, error: { codigo: err.codigo, mensaje: err.mensaje } };
    }
    return { ok: false, error: { codigo: codigos.DESCONOCIDO, mensaje: "No se pudo solicitar el retiro." } };
  }
}

export async function accionValidarRetiro(
  tenantSlug: string,
  retiroId: string,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };
  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: codigos.TENANT_NO_ENCONTRADO, mensaje: "Tenant no existe." } };

  const umbral = tenantConfigDefault().umbralDobleAprobacionsCents;

  try {
    const resultado = await validarRetiro(
      { retiros: r.retiros, audit: r.audit, members: r.members },
      sesion.userId,
      { tenantId: tenant.id, retiroId, umbralDobleAprobacionCents: umbral },
    );
    if (!resultado.ok) {
      return { ok: false, error: { codigo: resultado.error.codigo, mensaje: resultado.error.mensaje } };
    }
    revalidatePath(`/backoffice/${tenantSlug}/retiros`);
    revalidatePath(`/backoffice/${tenantSlug}/retiros/${retiroId}`);
    return EMPTY;
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return { ok: false, error: { codigo: err.codigo, mensaje: err.mensaje } };
    }
    return { ok: false, error: { codigo: codigos.DESCONOCIDO, mensaje: "No se pudo validar el retiro." } };
  }
}

export async function accionAprobarRetiro(
  tenantSlug: string,
  retiroId: string,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };
  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: codigos.TENANT_NO_ENCONTRADO, mensaje: "Tenant no existe." } };

  try {
    const resultado = await aprobarRetiro(
      { retiros: r.retiros, audit: r.audit, members: r.members },
      sesion.userId,
      { tenantId: tenant.id, retiroId },
    );
    if (!resultado.ok) {
      return { ok: false, error: { codigo: resultado.error.codigo, mensaje: resultado.error.mensaje } };
    }
    revalidatePath(`/backoffice/${tenantSlug}/retiros`);
    revalidatePath(`/backoffice/${tenantSlug}/retiros/${retiroId}`);
    return EMPTY;
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return { ok: false, error: { codigo: err.codigo, mensaje: err.mensaje } };
    }
    return { ok: false, error: { codigo: codigos.DESCONOCIDO, mensaje: "No se pudo aprobar el retiro." } };
  }
}

export async function accionPagarPremio(
  tenantSlug: string,
  retiroId: string,
  comprobanteUrl: string,
  idempotencyKey: string,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };
  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: codigos.TENANT_NO_ENCONTRADO, mensaje: "Tenant no existe." } };

  try {
    const resultado = await pagarPremio(
      { retiros: r.retiros, audit: r.audit, members: r.members },
      sesion.userId,
      { tenantId: tenant.id, retiroId, comprobanteUrl, idempotencyKey },
    );
    if (!resultado.ok) {
      return { ok: false, error: { codigo: resultado.error.codigo, mensaje: resultado.error.mensaje } };
    }
    revalidatePath(`/backoffice/${tenantSlug}/retiros`);
    revalidatePath(`/backoffice/${tenantSlug}/retiros/${retiroId}`);
    return EMPTY;
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return { ok: false, error: { codigo: err.codigo, mensaje: err.mensaje } };
    }
    return { ok: false, error: { codigo: codigos.DESCONOCIDO, mensaje: "No se pudo pagar el premio." } };
  }
}

export async function accionRechazarRetiro(
  tenantSlug: string,
  retiroId: string,
  motivo: string,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };
  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: codigos.TENANT_NO_ENCONTRADO, mensaje: "Tenant no existe." } };

  try {
    const resultado = await rechazarRetiro(
      { retiros: r.retiros, audit: r.audit, members: r.members },
      sesion.userId,
      { tenantId: tenant.id, retiroId, motivo },
    );
    if (!resultado.ok) {
      return { ok: false, error: { codigo: resultado.error.codigo, mensaje: resultado.error.mensaje } };
    }
    revalidatePath(`/backoffice/${tenantSlug}/retiros`);
    revalidatePath(`/backoffice/${tenantSlug}/retiros/${retiroId}`);
    return EMPTY;
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return { ok: false, error: { codigo: err.codigo, mensaje: err.mensaje } };
    }
    return { ok: false, error: { codigo: codigos.DESCONOCIDO, mensaje: "No se pudo rechazar el retiro." } };
  }
}

function parsearMontoAcentavos(input: string): number {
  // Acepta "1234.56" o "1.234,56" o "1234" (centavos enteros).
  const limpio = input.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(limpio);
  if (Number.isNaN(parsed)) return Number.NaN;
  return Math.round(parsed * 100);
}
