/**
 * GET /api/cierre-pdf/[slug]
 *
 * Genera un PDF con el cierre diario del tenant (cargas liquidadas +
 * retiros pagados del dia en curso) y lo sirve como descarga.
 *
 * Replica la logica de la pagina `/backoffice/[slug]/cierre` pero
 * devuelve el archivo en vez de renderizar HTML.
 */

import { NextResponse } from "next/server";

import { listarCargas } from "@/application/cargas/listar-cargas";
import { listarRetiros } from "@/application/retiros/listar-retiros";
import { calcularCierreDiario } from "@/application/cierre/calcular-cierre";
import { tenantId as toTenantId } from "@/domain/ids";
import { generarCierrePDF, type CierrePDFData } from "@/lib/cierre-pdf";
import { auth, repos } from "@/lib/server";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { slug } = await params;

  const sesion = await auth().obtenerSesion();
  if (!sesion) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(slug);
  if (!tenant) {
    return new NextResponse("Tenant no encontrado", { status: 404 });
  }

  if (!sesion.profile.isSuperadmin) {
    const member = await r.members.obtenerPorUsuarioYTenant(
      tenant.id,
      sesion.userId,
    );
    if (!member || member.estado !== "activo") {
      return new NextResponse("Sin acceso al tenant", { status: 403 });
    }
  }

  const inicioDelDia = new Date();
  inicioDelDia.setHours(0, 0, 0, 0);
  const finDelDia = new Date();

  const [cargas, retiros] = await Promise.all([
    listarCargas(r, toTenantId(tenant.id)),
    listarRetiros(r, toTenantId(tenant.id)),
  ]);

  const cierre = calcularCierreDiario({
    cargas,
    retiros,
    inicio: inicioDelDia,
    fin: finDelDia,
  });

  const data: CierrePDFData = {
    tenantNombre: tenant.nombre,
    tenantSlug: tenant.slug,
    fecha: new Date(),
    inicioDelDia: cierre.inicio,
    totalCargasFormateado: cierre.totalCargasFormateado,
    totalRetirosFormateado: cierre.totalRetirosFormateado,
    netoFormateado: cierre.netoFormateado,
    cantidadCargas: cierre.cantidadCargas,
    cantidadRetiros: cierre.cantidadRetiros,
    operaciones: cierre.operaciones,
  };

  const buffer = generarCierrePDF(data);
  const filename = `cierre-${tenant.slug}-${inicioDelDia.toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": buffer.length.toString(),
    },
  });
}
