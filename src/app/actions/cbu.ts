/**
 * Server actions de CBU accounts.
 *
 * tenant_admin puede dar de alta CBUs (con validación de checksum) y desactivar.
 * Las desactivaciones son soft-delete (activa=false): la CBU queda en el
 * historial pero no se ofrece para nuevos pagos.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { codigos } from "@/application/errors";
import { normalizarCBU } from "@/domain/cbu";
import { ErrorNegocio } from "@/domain/result";
import { cbuAccountId, tenantId as toTenantId } from "@/domain/ids";
import { auth, repos } from "@/lib/server";

export interface FormState {
  ok: boolean;
  error?: { codigo: string; mensaje: string };
}

const EMPTY: FormState = { ok: true };

const agregarSchema = z.object({
  cbu: z.string().trim().min(22, "CBU incompleto."),
  titular: z.string().trim().min(3, "Titular debe tener al menos 3 caracteres."),
  alias: z.string().trim().optional(),
  moneda: z.literal("ARS").default("ARS"),
});

export async function accionAgregarCBU(
  tenantSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };

  const parsed = agregarSchema.safeParse({
    cbu: formData.get("cbu"),
    titular: formData.get("titular"),
    alias: formData.get("alias") || undefined,
    moneda: formData.get("moneda") || "ARS",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: { codigo: codigos.INPUT_INVALIDO, mensaje: parsed.error.issues[0]?.message ?? "Input inválido." },
    };
  }

  const cbuNormalizado = normalizarCBU(parsed.data.cbu);
  if (!cbuNormalizado) {
    return {
      ok: false,
      error: {
        codigo: codigos.CBU_INVALIDO,
        mensaje: "El CBU no pasa el checksum oficial (BCRA). Verificá los 22 dígitos.",
      },
    };
  }

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: codigos.TENANT_NO_ENCONTRADO, mensaje: "Tenant no existe." } };

  const member = await r.members.obtenerPorUsuarioYTenant(toTenantId(tenant.id), sesion.userId);
  if (!member || member.rol !== "tenant_admin" || member.estado !== "activo") {
    return { ok: false, error: { codigo: codigos.PERMISO_DENEGADO, mensaje: "Solo tenant_admin puede dar de alta CBUs." } };
  }

  // Verificar duplicado dentro del tenant.
  const existente = await r.cbuAccounts.obtenerPorTenantYCbu(toTenantId(tenant.id), cbuNormalizado);
  if (existente && existente.activa) {
    return { ok: false, error: { codigo: codigos.CBU_DUPLICADO, mensaje: "Este CBU ya está cargado y activo." } };
  }

  try {
    await r.cbuAccounts.agregar(toTenantId(tenant.id), {
      cbu: cbuNormalizado,
      titular: parsed.data.titular,
      alias: parsed.data.alias ?? null,
      moneda: parsed.data.moneda,
    }, { actor: sesion.userId });
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return { ok: false, error: { codigo: err.codigo, mensaje: err.mensaje } };
    }
    return { ok: false, error: { codigo: codigos.DESCONOCIDO, mensaje: "No se pudo agregar." } };
  }

  revalidatePath(`/backoffice/${tenantSlug}/cbu`);
  return EMPTY;
}

export async function accionDesactivarCBU(
  tenantSlug: string,
  cbuId: string,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: codigos.TENANT_NO_ENCONTRADO, mensaje: "Tenant no existe." } };

  const member = await r.members.obtenerPorUsuarioYTenant(toTenantId(tenant.id), sesion.userId);
  if (!member || member.rol !== "tenant_admin" || member.estado !== "activo") {
    return { ok: false, error: { codigo: codigos.PERMISO_DENEGADO, mensaje: "Solo tenant_admin puede desactivar CBUs." } };
  }

  try {
    await r.cbuAccounts.desactivar(cbuAccountId(cbuId), { actor: sesion.userId });
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return { ok: false, error: { codigo: err.codigo, mensaje: err.mensaje } };
    }
    return { ok: false, error: { codigo: codigos.DESCONOCIDO, mensaje: "No se pudo desactivar." } };
  }

  revalidatePath(`/backoffice/${tenantSlug}/cbu`);
  return EMPTY;
}