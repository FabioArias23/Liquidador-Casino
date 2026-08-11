import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightIcon,
  BanknoteIcon,
  HistoryIcon,
  PlugIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react";

import { listarCargas } from "@/application/cargas/listar-cargas";
import { listarRetiros } from "@/application/retiros/listar-retiros";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { formatear } from "@/domain/money";
import { auth, repos } from "@/lib/server";

export default async function BackofficePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sesion = await auth().obtenerSesion();
  if (!sesion) notFound();

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(slug);
  if (!tenant) notFound();

  const esSuper = sesion.profile.isSuperadmin;
  const membresia = esSuper
    ? null
    : await r.members.obtenerPorUsuarioYTenant(tenant.id, sesion.userId);

  if (!esSuper && (!membresia || membresia.estado !== "activo")) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Sin acceso</CardTitle>
            <CardDescription>
              No sos miembro activo de <strong>{tenant.nombre}</strong>.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const esAdmin = membresia?.rol === "tenant_admin";
  const [cargas, retiros] = await Promise.all([
    listarCargas(r, tenant.id),
    listarRetiros(r, tenant.id),
  ]);

  const inicioDelDia = new Date();
  inicioDelDia.setHours(0, 0, 0, 0);

  const cargasHoy = cargas.filter((c) => c.createdAt >= inicioDelDia).length;
  const retirosPendientes = retiros.filter(
    (r) => r.estado === "pending" || r.estado === "validated" || r.estado === "awaiting_approval",
  ).length;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {tenant.nombre}
          </h1>
          <Badge variant={tenant.estado === "activo" ? "default" : "secondary"}>
            {tenant.estado}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Estás en <code className="font-mono">/{tenant.slug}</code> · {membresia ? `rol ${membresia.rol}` : "superadmin"}
        </p>
      </header>

      {/* KPIs del día */}
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Cargas hoy"
          value={cargasHoy.toString()}
          href={`/backoffice/${tenant.slug}/cargas`}
        />
        <KpiCard
          label="Cargas pendientes"
          value={cargas.filter((c) => c.estado === "pending" || c.estado === "validating").length.toString()}
          href={`/backoffice/${tenant.slug}/cargas?estado=pending`}
        />
        <KpiCard
          label="Retiros pendientes"
          value={retirosPendientes.toString()}
          href={`/backoffice/${tenant.slug}/retiros`}
        />
        <KpiCard
          label="Pagos del día"
          value={retiros.filter((r) => r.estado === "paid" && r.updatedAt >= inicioDelDia).length.toString()}
        />
      </section>

      {/* Módulos */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Operación
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <ModuloCard
            href={`/backoffice/${tenant.slug}/cargas`}
            icon={TicketIcon}
            titulo="Cargas"
            descripcion="Depósitos de jugadores. Pendientes, validadas, asentadas y rechazadas."
            badge={cargas.filter((c) => c.estado === "pending").toString()}
          />
          <ModuloCard
            href={`/backoffice/${tenant.slug}/retiros`}
            icon={BanknoteIcon}
            titulo="Retiros"
            descripcion="Pagos a jugadores. Validación, aprobación y ejecución con cuatro-ojos."
            badge={retirosPendientes.toString()}
          />
          <ModuloCard
            href={`/backoffice/${tenant.slug}/historial`}
            icon={HistoryIcon}
            titulo="Historial"
            descripcion="Auditoría inmutable de cada cambio de estado, alta o baja."
          />
        </div>
      </section>

      {esAdmin && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Administración
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            <ModuloCard
              href={`/backoffice/${tenant.slug}/miembros`}
              icon={UsersIcon}
              titulo="Miembros"
              descripcion="Operadores, supervisores y admins del tenant."
            />
            <ModuloCard
              href={`/backoffice/${tenant.slug}/cbu`}
              icon={BanknoteIcon}
              titulo="CBU"
              descripcion="Cuentas donde se acreditan los premios."
            />
            <ModuloCard
              href={`/backoffice/${tenant.slug}/casino`}
              icon={PlugIcon}
              titulo="Casino"
              descripcion="Adapter, URL y credenciales del casino."
            />
          </div>
        </section>
      )}

      {/* Footer con monto liquidado — el dinero siempre al final */}
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Liquidado hoy
            </p>
            <p className="mt-1 font-mono text-2xl tabular-nums">
              {formatear(
                retiros
                  .filter((r) => r.estado === "paid" && r.updatedAt >= inicioDelDia)
                  .reduce((acc, r) => acc + r.montoCents, 0),
                "ARS",
              )}
            </p>
          </div>
          <Link
            href={`/backoffice/${tenant.slug}/cargas?estado=settled`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Ver detalle
            <ArrowRightIcon className="size-3.5" strokeWidth={1.75} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function ModuloCard({
  href,
  icon: Icon,
  titulo,
  descripcion,
  badge,
}: {
  href: string;
  icon: typeof TicketIcon;
  titulo: string;
  descripcion: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group/modulo flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-sunken"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary/8 text-primary">
          <Icon className="size-4" strokeWidth={1.75} />
        </div>
        <div>
          <div className="font-medium">{titulo}</div>
          <p className="mt-0.5 text-xs text-muted-foreground">{descripcion}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {badge !== undefined && badge !== "0" && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium tabular-nums text-amber-800">
            {badge}
          </span>
        )}
        <ArrowRightIcon
          strokeWidth={1.75}
          className="size-4 text-muted-foreground transition-transform group-hover/modulo:translate-x-0.5"
        />
      </div>
    </Link>
  );
}
