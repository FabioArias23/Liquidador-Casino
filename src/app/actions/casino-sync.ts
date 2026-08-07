"use server";

import { revalidatePath } from "next/cache";

import { registrarCargaDesdeCasino } from "@/application/cargas/registrar-carga-desde-casino";
import { fetchCargasDeCasino } from "@/infrastructure/casino/configurable-http-adapter";
import { tenantId as toTenantId } from "@/domain/ids";
import { auth, repos } from "@/lib/server";

/**
 * Trae las cargas del casino para el tenant activo.
 * Idempotente: si una carga ya existe (por external_ref), se ignora silenciosamente.
 * Devuelve un resumen para mostrar al operador (toasts los dispara el cliente).
 */
export async function accionTraerCargasDelCasino(tenantSlug: string): Promise<{
  ok: boolean;
  traidas: number;
  duplicadas: number;
  error?: string;
}> {
  const sesion = await auth().obtenerSesion();
  if (!sesion) {
    return { ok: false, traidas: 0, duplicadas: 0, error: "Sin sesión." };
  }

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) {
    return { ok: false, traidas: 0, duplicadas: 0, error: "Tenant no existe." };
  }

  const tid = toTenantId(tenant.id);

  const fetchResult = await fetchCargasDeCasino(null, {
    baseUrlOverride: `/api/casino-mock/${tenantSlug}`,
  });

  if (!fetchResult.ok) {
    return {
      ok: false,
      traidas: 0,
      duplicadas: 0,
      error: fetchResult.error ?? "Error desconocido del casino.",
    };
  }

  // Para distinguir nuevas vs duplicadas: contamos cuántas NO estaban antes.
  // (Optimizable: registrarCargaDesdeCasino podría devolver un flag, pero
  // hoy lo determinamos comparando contra el estado pre-fetch.)
  const antes = new Set(
    (await r.cargas.listarPorTenant(tid))
      .map((c) => c.externalRef)
      .filter((x): x is string => x !== null),
  );

  let traidas = 0;
  let duplicadas = 0;
  for (const externa of fetchResult.cargas) {
    const r2 = await registrarCargaDesdeCasino(r, tid, externa);
    if (!r2.ok) continue;
    if (antes.has(externa.externalRef)) {
      duplicadas++;
    } else {
      traidas++;
    }
  }

  revalidatePath(`/backoffice/${tenantSlug}/cargas`);

  return { ok: true, traidas, duplicadas };
}