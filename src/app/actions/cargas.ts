/**
 * Server actions de Cargas.
 *
 * Patrón: cada acción toma (tenantSlug, formData) y devuelve { ok, error?, data? }
 * para que el cliente use useActionState (React 19). revalidatePath se llama
 * cuando la acción tiene éxito para refrescar las vistas server-rendered.
 *
 * "use server" — solo se invocan desde el cliente vía <form action={...}>
 * o useActionState.
 */

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { asentarCarga } from "@/application/cargas/asentar-carga";
import { rechazarCarga } from "@/application/cargas/rechazar-carga";
import { registrarCargaManual } from "@/application/cargas/registrar-carga-manual";
import { validarCarga } from "@/application/cargas/validar-carga";
import { desdeDecimalString } from "@/domain/money";
import { auth, repos } from "@/lib/server";

export interface FormState {
  ok: boolean;
  error?: { codigo: string; mensaje: string };
}

const EMPTY_STATE: FormState = { ok: true };

export async function accionRegistrarCargaManual(
  tenantSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: "TENANT_NO_ENCONTRADO", mensaje: "Tenant no existe." } };

  const montoStr = String(formData.get("montoCents") ?? "");
  const montoCents = parsearMontoAcentavos(montoStr);

  const resultado = await registrarCargaManual(r, sesion.userId, {
    tenantId: tenant.id,
    playerRef: String(formData.get("playerRef") ?? ""),
    montoCents,
    moneda: String(formData.get("moneda") ?? "ARS"),
    metodo: String(formData.get("metodo") ?? ""),
    comprobanteUrl: String(formData.get("comprobanteUrl") ?? ""),
  });

  if (!resultado.ok) {
    return { ok: false, error: { codigo: resultado.error.codigo, mensaje: resultado.error.mensaje } };
  }

  revalidatePath(`/backoffice/${tenantSlug}/cargas`);
  redirect(`/backoffice/${tenantSlug}/cargas/${resultado.data.id}`);
}

export async function accionValidarCarga(
  tenantSlug: string,
  cargaId: string,
  comprobanteUrl: string,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: "TENANT_NO_ENCONTRADO", mensaje: "Tenant no existe." } };

  const resultado = await validarCarga(r, sesion.userId, {
    tenantId: tenant.id,
    cargaId,
    comprobanteUrl,
  });

  if (!resultado.ok) {
    return { ok: false, error: { codigo: resultado.error.codigo, mensaje: resultado.error.mensaje } };
  }

  revalidatePath(`/backoffice/${tenantSlug}/cargas`);
  revalidatePath(`/backoffice/${tenantSlug}/cargas/${cargaId}`);
  return EMPTY_STATE;
}

export async function accionRechazarCarga(
  tenantSlug: string,
  cargaId: string,
  motivo: string,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: "TENANT_NO_ENCONTRADO", mensaje: "Tenant no existe." } };

  const resultado = await rechazarCarga(r, sesion.userId, {
    tenantId: tenant.id,
    cargaId,
    motivo,
  });

  if (!resultado.ok) {
    return { ok: false, error: { codigo: resultado.error.codigo, mensaje: resultado.error.mensaje } };
  }

  revalidatePath(`/backoffice/${tenantSlug}/cargas`);
  revalidatePath(`/backoffice/${tenantSlug}/cargas/${cargaId}`);
  return EMPTY_STATE;
}

export async function accionAsentarCarga(
  tenantSlug: string,
  cargaId: string,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: "TENANT_NO_ENCONTRADO", mensaje: "Tenant no existe." } };

  const resultado = await asentarCarga(r, sesion.userId, {
    tenantId: tenant.id,
    cargaId,
  });

  if (!resultado.ok) {
    return { ok: false, error: { codigo: resultado.error.codigo, mensaje: resultado.error.mensaje } };
  }

  revalidatePath(`/backoffice/${tenantSlug}/cargas`);
  revalidatePath(`/backoffice/${tenantSlug}/cargas/${cargaId}`);
  return EMPTY_STATE;
}

/**
 * Parsea "1.234,56" o "1234.56" a centavos (entero).
 * Delega a domain/money.demedeDecimalString que ya tiene tests.
 */
function parsearMontoAcentavos(input: string): number {
  try {
    return desdeDecimalString(input);
  } catch {
    return Number.NaN;
  }
}