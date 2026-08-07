/**
 * Server actions de Casino Credentials + TenantConfig (config del adapter).
 */

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { codigos } from "@/application/errors";
import { ErrorNegocio } from "@/domain/result";
import { tenantId as toTenantId } from "@/domain/ids";
import { auth, repos } from "@/lib/server";

export interface FormState {
  ok: boolean;
  error?: { codigo: string; mensaje: string };
}

const EMPTY: FormState = { ok: true };

const guardarSchema = z.object({
  adapterType: z.string().min(1),
  baseUrl: z.string().trim().min(1, "Falta URL del casino."),
  apiKeyCiphertext: z.string().trim().optional(),
  webhookSecret: z.string().trim().optional(),
});

export async function accionGuardarCasinoConfig(
  tenantSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, error: { codigo: "NO_AUTENTICADO", mensaje: "Sin sesión." } };

  const parsed = guardarSchema.safeParse({
    adapterType: formData.get("adapterType") || "configurable_http",
    baseUrl: formData.get("baseUrl"),
    apiKeyCiphertext: formData.get("apiKeyCiphertext") || undefined,
    webhookSecret: formData.get("webhookSecret") || undefined,
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

  const member = await r.members.obtenerPorUsuarioYTenant(toTenantId(tenant.id), sesion.userId);
  if (!member || member.rol !== "tenant_admin" || member.estado !== "activo") {
    return { ok: false, error: { codigo: codigos.PERMISO_DENEGADO, mensaje: "Solo tenant_admin puede configurar el casino." } };
  }

  try {
    await r.casinoCredentials.guardar(toTenantId(tenant.id), {
      adapterType: parsed.data.adapterType,
      baseUrl: parsed.data.baseUrl,
      apiKeyCiphertext: parsed.data.apiKeyCiphertext ?? null,
      webhookSecret: parsed.data.webhookSecret ?? null,
    }, { actor: sesion.userId });
  } catch (err) {
    if (err instanceof ErrorNegocio) {
      return { ok: false, error: { codigo: err.codigo, mensaje: err.mensaje } };
    }
    return { ok: false, error: { codigo: codigos.DESCONOCIDO, mensaje: "No se pudo guardar." } };
  }

  revalidatePath(`/backoffice/${tenantSlug}/casino`);
  return EMPTY;
}

/**
 * Test de conexión contra el endpoint configurado.
 * Llama al health check del adapter (hoy: mock local).
 */
export async function accionProbarConexionCasino(
  tenantSlug: string,
): Promise<{ ok: boolean; mensaje: string }> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return { ok: false, mensaje: "Sin sesión." };

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) return { ok: false, mensaje: "Tenant no existe." };

  // Llama al endpoint mock local. Mañana: al adapter real del casino.
  try {
    const response = await fetch(
      `/api/casino-mock/${tenantSlug}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      return { ok: false, mensaje: `Casino respondió ${response.status}` };
    }
    const json = (await response.json()) as { cargas?: unknown[] };
    return {
      ok: true,
      mensaje: `Conexión OK. El casino devolvió ${json.cargas?.length ?? 0} cargas en este lote.`,
    };
  } catch (err) {
    return {
      ok: false,
      mensaje: `Error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}