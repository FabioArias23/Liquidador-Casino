import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";
import { type EstadoCarga } from "@/domain/cargas";
import { formatear } from "@/domain/money";
import { auth, repos } from "@/lib/server";
import { formatRelativeTime } from "@/lib/format";

import { AccionesCarga } from "./acciones-carga";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function CargaDetallePage({ params }: PageProps) {
  const { slug, id } = await params;
  const sesion = await auth().obtenerSesion();
  if (!sesion) notFound();

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(slug);
  if (!tenant) notFound();

  // La carga no se cross-tenant: el repo filtra por tenantId.
  // Hacemos un fetch por (tenant, id) — necesitamos el tenantId para llamar el repo.
  const carga = await r.cargas.obtenerPorId(tenant.id, id as never);
  if (!carga) notFound();

  const audit = await r.audit.listarPorTenant(tenant.id, {
    entidadTipo: "carga",
    entidadId: carga.id,
  });
  const ledger = await r.ledger.listarPorOperacion(tenant.id, "carga", carga.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-3">
        <Link
          href={`/backoffice/${slug}/cargas`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" strokeWidth={1.75} />
          Volver a Cargas
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusPill variant={estadoAVariant(carga.estado)}>
                {carga.estado}
              </StatusPill>
              <span className="font-mono text-xs text-muted-foreground">
                {carga.id.slice(0, 8)}…
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatear(carga.montoCents, carga.moneda)}
            </h1>
            <p className="text-sm text-muted-foreground">
              Jugador <span className="font-mono">{carga.playerRef}</span> · {carga.metodo} · origen {carga.origen}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Acciones */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Acciones
            </h2>
            <AccionesCarga
              tenantSlug={slug}
              cargaId={carga.id}
              estado={carga.estado}
              comprobanteUrl={carga.comprobanteUrl}
            />
          </section>

          {/* Comprobante */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Comprobante
            </h2>
            {carga.comprobanteUrl ? (
              <a
                href={carga.comprobanteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
              >
                {carga.comprobanteUrl}
                <ExternalLinkIcon className="size-3" strokeWidth={1.75} />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">Sin comprobante adjunto.</p>
            )}
          </section>

          {/* Motivo de rechazo */}
          {carga.motivoRechazo && (
            <section className="rounded-xl border border-status-rejected/40 bg-status-rejected-bg/40 p-5">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-status-rejected-fg">
                Motivo del rechazo
              </h2>
              <p className="text-sm text-status-rejected-fg">{carga.motivoRechazo}</p>
            </section>
          )}

          {/* Ledger */}
          {ledger.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Asiento contable
              </h2>
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 text-left font-medium">Tipo</th>
                    <th className="py-2 text-left font-medium">Cuenta</th>
                    <th className="py-2 text-right font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id} className="border-b border-border/50 last:border-b-0">
                      <td className="py-2">
                        <span
                          className={
                            e.tipo === "debito"
                              ? "text-xs font-medium uppercase tracking-wider text-status-validated-fg"
                              : "text-xs font-medium uppercase tracking-wider text-status-pending-fg"
                          }
                        >
                          {e.tipo}
                        </span>
                      </td>
                      <td className="py-2 font-mono text-xs">{e.cuenta}</td>
                      <td className="py-2 text-right font-mono">
                        {formatear(e.montoCents, e.moneda)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">
                Asiento {ledger[0]?.asientoId.slice(0, 16)}…
              </p>
            </section>
          )}
        </div>

        {/* Sidebar: metadata */}
        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Metadata
            </h2>
            <dl className="space-y-3 text-sm">
              <Meta label="ID">{carga.id}</Meta>
              <Meta label="Tenant">{tenant.nombre}</Meta>
              <Meta label="Versión">{carga.version}</Meta>
              <Meta label="Creada">{formatRelativeTime(carga.createdAt)}</Meta>
              <Meta label="Actualizada">{formatRelativeTime(carga.updatedAt)}</Meta>
              {carga.externalRef && (
                <Meta label="External ref">
                  <span className="font-mono text-xs">{carga.externalRef}</span>
                </Meta>
              )}
              {carga.validadaPor && (
                <Meta label="Validada por">
                  <span className="font-mono text-xs">{carga.validadaPor.slice(0, 8)}…</span>
                </Meta>
              )}
              {carga.asentadaPor && (
                <Meta label="Asentada por">
                  <span className="font-mono text-xs">{carga.asentadaPor.slice(0, 8)}…</span>
                </Meta>
              )}
              {carga.rechazadaPor && (
                <Meta label="Rechazada por">
                  <span className="font-mono text-xs">{carga.rechazadaPor.slice(0, 8)}…</span>
                </Meta>
              )}
            </dl>
          </section>

          {/* Audit log */}
          {audit.length > 0 && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Historial
              </h2>
              <ol className="space-y-3">
                {audit.map((a) => (
                  <li key={a.id} className="text-xs">
                    <p className="font-medium">{traducirAccion(a.accion)}</p>
                    <p className="text-muted-foreground">
                      {formatRelativeTime(a.createdAt)}
                      {a.motivo && (
                        <span className="block italic">&ldquo;{a.motivo}&rdquo;</span>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

function estadoAVariant(estado: EstadoCarga) {
  switch (estado) {
    case "pending":
      return "pending" as const;
    case "validating":
      return "validating" as const;
    case "validated":
      return "validated" as const;
    case "settled":
      return "settled" as const;
    case "rejected":
      return "rejected" as const;
  }
}

function traducirAccion(accion: string): string {
  return accion
    .replace(/^carga\./, "")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}