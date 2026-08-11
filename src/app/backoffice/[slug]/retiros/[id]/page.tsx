import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon, ShieldCheckIcon } from "lucide-react";

import { AccionesRetiro } from "@/app/backoffice/[slug]/retiros/[id]/acciones-retiro";
import { StatusPill } from "@/components/ui/status-pill";
import { formatear } from "@/domain/money";
import { type EstadoRetiro } from "@/domain/retiros";
import { tenantId as toTenantId } from "@/domain/ids";
import { auth, repos } from "@/lib/server";
import { formatRelativeTime } from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function RetiroDetallePage({ params }: PageProps) {
  const { slug, id } = await params;
  const sesion = await auth().obtenerSesion();
  if (!sesion) notFound();

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(slug);
  if (!tenant) notFound();

  const retiro = await r.retiros.obtenerPorId(toTenantId(tenant.id), id);
  if (!retiro) notFound();

  // Permisos: miembro activo del tenant (o superadmin).
  let rolActual: "operador" | "supervisor" | "tenant_admin" | "superadmin" = "superadmin";
  if (!sesion.profile.isSuperadmin) {
    const member = await r.members.obtenerPorUsuarioYTenant(tenant.id, sesion.userId);
    if (!member || member.estado !== "activo") notFound();
    rolActual = member.rol;
  }

  // Hidratamos emails de TODOS los actores del retiro (no UUIDs en UI).
  const actorIds = new Set<string>();
  if (retiro.registradaPor) actorIds.add(retiro.registradaPor);
  if (retiro.validadaPor) actorIds.add(retiro.validadaPor);
  if (retiro.rechazadaPor) actorIds.add(retiro.rechazadaPor);
  if (retiro.aprobadaPor) actorIds.add(retiro.aprobadaPor);
  if (retiro.rechazadaAprobacionPor) actorIds.add(retiro.rechazadaAprobacionPor);
  if (retiro.pagadaPor) actorIds.add(retiro.pagadaPor);
  const actorEmails = new Map<string, string>();
  for (const aid of actorIds) {
    const profile = await r.profiles.obtenerPorId(aid as never);
    if (profile) actorEmails.set(aid, profile.email);
  }

  const audit = await r.audit.listarPorTenant(toTenantId(tenant.id), {
    entidadTipo: "retiro",
    entidadId: retiro.id,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-3">
        <Link
          href={`/backoffice/${slug}/retiros`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" strokeWidth={1.75} />
          Volver a Retiros
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusPill variant={estadoAVariant(retiro.estado)}>
                {retiro.estado}
              </StatusPill>
              <span className="font-mono text-xs text-muted-foreground">
                {retiro.id.slice(0, 8)}…
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatear(retiro.montoCents, retiro.moneda)}
            </h1>
            <p className="text-sm text-muted-foreground">
              Jugador <span className="font-mono">{retiro.playerRef}</span> · origen {retiro.origen}
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
            <AccionesRetiro
              tenantSlug={slug}
              retiroId={retiro.id}
              estado={retiro.estado}
              montoCents={retiro.montoCents}
              validadaPor={retiro.validadaPor}
              aprobadaPor={retiro.aprobadaPor}
              pagadaPor={retiro.pagadaPor}
              rechazadaPor={retiro.rechazadaPor}
              actorId={sesion.userId}
              actorEmail={sesion.profile.email}
              actorRol={rolActual}
            />
          </section>

          {/* CBU destino + titular + alias */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Destino del pago
            </h2>
            <dl className="space-y-3 text-sm">
              <Meta label="CBU">
                <span className="font-mono text-xs tabular-nums">{retiro.cbuDestino}</span>
              </Meta>
              <Meta label="Titular">{retiro.titularDestino}</Meta>
              {retiro.aliasDestino && (
                <Meta label="Alias">
                  <span className="font-mono text-xs">{retiro.aliasDestino}</span>
                </Meta>
              )}
              <Meta label="Moneda">{retiro.moneda}</Meta>
            </dl>
          </section>

          {/* Comprobante */}
          {retiro.comprobanteUrl && (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Comprobante
              </h2>
              <a
                href={retiro.comprobanteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
              >
                {retiro.comprobanteUrl}
                <ExternalLinkIcon className="size-3" strokeWidth={1.75} />
              </a>
              {retiro.idempotencyKey && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Idempotencia: <span className="font-mono">{retiro.idempotencyKey}</span>
                </p>
              )}
            </section>
          )}

          {/* Motivo de rechazo */}
          {retiro.motivoRechazo && (
            <section className="rounded-xl border border-status-rejected/40 bg-status-rejected-bg/40 p-5">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-status-rejected-fg">
                Motivo del rechazo
              </h2>
              <p className="text-sm text-status-rejected-fg">{retiro.motivoRechazo}</p>
            </section>
          )}
        </div>

        {/* Sidebar: cuatro-ojos + metadata + audit */}
        <aside className="space-y-6">
          {/* Panel cuatro-ojos: lo más vistoso del producto */}
          <section className="rounded-xl border border-status-validated/40 bg-status-validated-bg/30 p-5">
            <header className="mb-3 flex items-center gap-2">
              <ShieldCheckIcon className="size-4 text-status-validated-fg" strokeWidth={1.75} />
              <h2 className="text-xs font-medium uppercase tracking-wider text-status-validated-fg">
                Cuatro-ojos
              </h2>
            </header>
            <ol className="space-y-3 text-xs">
              <CuatroOjosLinea
                rol="Registrado por"
                actorId={retiro.registradaPor}
                actorEmails={actorEmails}
              />
              <CuatroOjosLinea
                rol="Validado por"
                actorId={retiro.validadaPor}
                actorEmails={actorEmails}
              />
              <CuatroOjosLinea
                rol="Aprobado por"
                actorId={retiro.aprobadaPor}
                actorEmails={actorEmails}
              />
              <CuatroOjosLinea
                rol="Pagado por"
                actorId={retiro.pagadaPor}
                actorEmails={actorEmails}
              />
            </ol>
            {retiro.validadaPor && retiro.aprobadaPor && retiro.validadaPor === retiro.aprobadaPor && (
              <p className="mt-3 text-xs font-medium text-status-rejected-fg">
                Inconsistencia: misma persona validó y aprobó.
              </p>
            )}
            {retiro.aprobadaPor && retiro.pagadaPor && retiro.aprobadaPor === retiro.pagadaPor && (
              <p className="mt-3 text-xs font-medium text-status-rejected-fg">
                Inconsistencia: misma persona aprobó y pagó.
              </p>
            )}
          </section>

          {/* Metadata */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Metadata
            </h2>
            <dl className="space-y-3 text-sm">
              <Meta label="ID">
                <span className="font-mono text-xs">{retiro.id}</span>
              </Meta>
              <Meta label="Tenant">{tenant.nombre}</Meta>
              <Meta label="Versión">{retiro.version}</Meta>
              <Meta label="Creada">{formatRelativeTime(retiro.createdAt)}</Meta>
              <Meta label="Actualizada">{formatRelativeTime(retiro.updatedAt)}</Meta>
              {retiro.externalRef && (
                <Meta label="External ref">
                  <span className="font-mono text-xs">{retiro.externalRef}</span>
                </Meta>
              )}
              {retiro.rechazadaPor && (
                <Meta label="Rechazada por">
                  <span className="font-mono text-xs">
                    {actorEmails.get(retiro.rechazadaPor) ?? retiro.rechazadaPor.slice(0, 8)}
                  </span>
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
                    <p className="font-medium">{traducirAccionRetiro(a.accion)}</p>
                    <p className="text-muted-foreground">
                      {actorEmails.get(a.actorId) ?? a.actorId.slice(0, 8)} · {formatRelativeTime(a.createdAt)}
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

function CuatroOjosLinea({
  rol,
  actorId,
  actorEmails,
}: {
  rol: string;
  actorId: string | null;
  actorEmails: Map<string, string>;
}) {
  return (
    <li className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{rol}</span>
      <span className="text-right">
        {actorId ? (
          <span className="font-mono">
            {actorEmails.get(actorId) ?? actorId.slice(0, 8)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
    </li>
  );
}

function estadoAVariant(estado: EstadoRetiro) {
  switch (estado) {
    case "pending":
      return "pending" as const;
    case "validated":
      return "validated" as const;
    case "awaiting_approval":
      return "validating" as const;
    case "approved":
      return "validated" as const;
    case "paying":
      return "validating" as const;
    case "paid":
      return "settled" as const;
    case "rejected":
      return "rejected" as const;
    case "failed":
      return "rejected" as const;
  }
}

function traducirAccionRetiro(accion: string): string {
  return accion
    .replace(/^retiro\./, "")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}
