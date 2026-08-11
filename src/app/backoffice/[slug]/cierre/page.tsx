import Link from "next/link";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BanknoteIcon,
  CalendarIcon,
  CircleDollarSignIcon,
  DownloadIcon,
  HistoryIcon,
  ScaleIcon,
  TicketIcon,
} from "lucide-react";

import { listarCargas } from "@/application/cargas/listar-cargas";
import { listarRetiros } from "@/application/retiros/listar-retiros";
import { calcularCierreDiario } from "@/application/cierre/calcular-cierre";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusPill } from "@/components/ui/status-pill";
import { tenantId as toTenantId } from "@/domain/ids";
import { formatear } from "@/domain/money";
import { auth, repos } from "@/lib/server";
import { formatRelativeTime } from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CierreDiarioPage({ params }: PageProps) {
  const { slug } = await params;
  const sesion = await auth().obtenerSesion();
  if (!sesion) return null;

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(slug);
  if (!tenant) return null;

  if (!sesion.profile.isSuperadmin) {
    const member = await r.members.obtenerPorUsuarioYTenant(tenant.id, sesion.userId);
    if (!member || member.estado !== "activo") return null;
  }

  // Cierre: desde medianoche de hoy hasta ahora.
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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cierre diario</h1>
          <p className="text-sm text-muted-foreground">
            Resumen de operaciones liquidadas hoy en <strong>{tenant.nombre}</strong>.
            {" "}
            <span className="font-mono">
              {inicioDelDia.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </p>
        </div>
        <a
          href={`/api/cierre-pdf/${slug}`}
          download={`cierre-${tenant.slug}-${inicioDelDia.toISOString().slice(0, 10)}.pdf`}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <DownloadIcon className="size-3.5" strokeWidth={2} />
          Descargar cierre PDF
        </a>
      </header>

      {/* KPIs del día */}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Cargas liquidadas"
          value={cierre.cantidadCargas.toString()}
          icon={TicketIcon}
        />
        <KpiCard
          label="Total cargas"
          value={cierre.totalCargasFormateado}
          icon={ArrowUpIcon}
        />
        <KpiCard
          label="Retiros pagados"
          value={cierre.cantidadRetiros.toString()}
          icon={BanknoteIcon}
        />
        <KpiCard
          label="Total retiros"
          value={cierre.totalRetirosFormateado}
          icon={ArrowDownIcon}
        />
      </section>

      {/* Neto del día */}
      <section className="rounded-xl border border-border bg-card p-5">
        <header className="mb-3 flex items-center gap-2">
          <ScaleIcon className="size-4 text-muted-foreground" strokeWidth={1.75} />
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Neto del día
          </h2>
        </header>
        <p
          className={`font-mono text-4xl font-semibold tabular-nums ${
            cierre.netoCents >= 0 ? "text-status-validated-fg" : "text-status-rejected-fg"
          }`}
        >
          {cierre.netoFormateado}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {cierre.netoCents >= 0
            ? "Total cargas liquidadas menos total retiros pagados."
            : "El casino pagó más de lo que recibió hoy. Revisá los retiros."}
        </p>
      </section>

      {/* Operaciones detalladas */}
      <section className="rounded-xl border border-border bg-card">
        <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-muted-foreground" strokeWidth={1.75} />
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Operaciones liquidadas hoy
            </h2>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {cierre.operaciones.length} operacion{cierre.operaciones.length === 1 ? "" : "es"}
          </span>
        </header>

        {cierre.operaciones.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
            <CircleDollarSignIcon className="size-8 text-muted-foreground/50" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">
              Sin operaciones liquidadas hoy. Esperá a que se asienten cargas o se paguen retiros.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-sunken/40 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Tipo</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-left font-medium">Jugador</th>
                <th className="px-3 py-2 text-right font-medium">Monto</th>
                <th className="px-3 py-2 text-left font-medium">Cuándo</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {cierre.operaciones.map((op) => (
                <tr
                  key={`${op.tipo}-${op.id}`}
                  className="border-b border-border/50 last:border-b-0 hover:bg-sunken/60"
                >
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider font-mono ${
                        op.tipo === "carga"
                          ? "bg-status-validated-bg text-status-validated-fg"
                          : "bg-status-settled-bg text-status-settled-fg"
                      }`}
                    >
                      {op.tipo}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill variant={op.tipo === "carga" ? "settled" : "settled"}>
                      {op.estado}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{op.playerRef}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatear(op.montoCents, op.moneda)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatRelativeTime(op.updatedAt)}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={
                        op.tipo === "carga"
                          ? `/backoffice/${slug}/cargas/${op.id}`
                          : `/backoffice/${slug}/retiros/${op.id}`
                      }
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Ver detalle"
                    >
                      <HistoryIcon className="size-3.5" strokeWidth={1.75} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
