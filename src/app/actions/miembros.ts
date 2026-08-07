/**
 * Server actions de Miembros.
 *
 * El tenant_admin puede invitar usuarios al tenant, cambiar roles, y desactivar.
 * Patrón: cada acción toma (tenantSlug, ...) y devuelve FormState.
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ROLES } from "@/domain/roles";
import { codigos } from "@/application/errors";
import { ErrorNegocio } from "@/domain/result";
import { tenantId as toTenantId } from "@/domain/ids";
import { auth, repos } from "@/lib/server";

export interface FormState {
  ok: boolean;
  error?: { codigo: string; mensaje: string };
}

const EMPTY: FormState = { ok: true };

const invitarSchema = z.object({
  email: z.string().trim().email("Email inválido."),
  rol: z.enum(ROLES),
});

export async function accionInvitarMiembro(
  tenantSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };

  const parsed = invitarSchema.safeParse({
    email: formData.get("email"),
    rol: formData.get("rol"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: { codigo: codigos.INPUT_INVALIDO, mensaje: parsed.error.issues[0]?.message ?? "Input inválido." },
    };
  }

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: codigos.TENANT_NO_ENCONTRADO, mensaje: "Tenant no existe." } };

  // El actor debe ser tenant_admin activo.
  const member = await r.members.obtenerPorUsuarioYTenant(toTenantId(tenant.id), sesion.userId);
  if (!member || member.rol !== "tenant_admin" || member.estado !== "activo") {
    return { ok: false, error: { codigo: codigos.PERMISO_DENEGADO, mensaje: "Solo tenant_admin puede invitar." } };
  }

  try {
    await r.members.invitar(toTenantId(tenant.id), parsed.data, { actor: sesion.userId });
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return { ok: false, error: { codigo: err.codigo, mensaje: err.mensaje } };
    }
    return { ok: false, error: { codigo: codigos.DESCONOCIDO, mensaje: "No se pudo invitar." } };
  }

  revalidatePath(`/backoffice/${tenantSlug}/miembros`);
  return EMPTY;
}

export async function accionCambiarRolMiembro(
  tenantSlug: string,
  memberId: string,
  nuevoRol: typeof ROLES[number],
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: codigos.TENANT_NO_ENCONTRADO, mensaje: "Tenant no existe." } };

  const member = await r.members.obtenerPorUsuarioYTenant(toTenantId(tenant.id), sesion.userId);
  if (!member || member.rol !== "tenant_admin" || member.estado !== "activo") {
    return { ok: false, error: { codigo: codigos.PERMISO_DENEGADO, mensaje: "Solo tenant_admin puede cambiar roles." } };
  }

  try {
    await r.members.cambiarRol(memberId as never, nuevoRol, { actor: sesion.userId });
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return { ok: false, error: { codigo: err.codigo, mensaje: err.mensaje } };
    }
    return { ok: false, error: { codigo: codigos.DESCONOCIDO, mensaje: "No se pudo cambiar el rol." } };
  }

  revalidatePath(`/backoffice/${tenantSlug}/miembros`);
  return EMPTY;
}

export async function accionDesactivarMiembro(
  tenantSlug: string,
  memberId: string,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, error: { codigo: codigos.TENANT_NO_ENCONTRADO, mensaje: "Tenant no existe." } };

  const member = await r.members.obtenerPorUsuarioYTenant(toTenantId(tenant.id), sesion.userId);
  if (!member || member.rol !== "tenant_admin" || member.estado !== "activo") {
    return { ok: false, error: { codigo: codigos.PERMISO_DENEGADO, mensaje: "Solo tenant_admin puede desactivar." } };
  }

  try {
    await r.members.desactivar(memberId as never, { actor: sesion.userId });
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return { ok: false, error: { codigo: err.codigo, mensaje: err.mensaje } };
    }
    return { ok: false, error: { codigo: codigos.DESCONOCIDO, mensaje: "No se pudo desactivar." } };
  }

  revalidatePath(`/backoffice/${tenantSlug}/miembros`);
  return EMPTY;
}