import Link from "next/link";
import { ArrowRightIcon, FilterIcon, PlusIcon } from "lucide-react";

import { listarCargas } from "@/application/cargas/listar-cargas";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import {
  type EstadoCarga,
  ESTADOS_CARGA,
} from "@/domain/cargas";
import { formatear } from "@/domain/money";
import { auth, repos } from "@/lib/server";
import { formatRelativeTime } from "@/lib/format";

import { BotonTraerDelCasino } from "./boton-traer-casino";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    estado?: string;
    playerRef?: string;
  }>;
}

export default async function CargasPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const sesion = await auth().obtenerSesion();
  if (!sesion) return null;

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(slug);
  if (!tenant) return null;

  // Permiso: el usuario debe ser miembro activo del tenant (o superadmin).
  if (!sesion.profile.isSuperadmin) {
    const member = await r.members.obtenerPorUsuarioYTenant(tenant.id, sesion.userId);
    if (!member || member.estado !== "activo") return null;
  }

  // Filtros validados (estado debe ser un estado válido).
  const filtros: Parameters<typeof listarCargas>[2] = {};
  if (sp.estado && (ESTADOS_CARGA as readonly string[]).includes(sp.estado)) {
    filtros.estado = sp.estado as EstadoCarga;
  }
  if (sp.playerRef) filtros.playerRef = sp.playerRef;

  const cargas = await listarCargas(r, tenant.id, filtros);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cargas</h1>
          <p className="text-sm text-muted-foreground">
            {cargas.length === 0
              ? "Sin cargas registradas."
              : `${cargas.length} carga${cargas.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BotonTraerDelCasino tenantSlug={slug} />
          <Link
            href={`/backoffice/${slug}/cargas/nueva`}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <PlusIcon className="size-3.5" strokeWidth={2} />
            Nueva carga manual
          </Link>
        </div>
      </header>

      {/* Filtros: hoy URL-based; cuando agreguemos más, los movemos a componente client */}
      <FiltrosLinea
        slug={slug}
        estadoActual={sp.estado ?? ""}
        playerRefActual={sp.playerRef ?? ""}
        cantidadCargas={cargas.length}
      />

      {cargas.length === 0 ? (
        <EmptyState
          icon={FilterIcon}
          title="Sin cargas con esos filtros"
          description={
            sp.estado || sp.playerRef
              ? "Probá limpiar los filtros o registrar una carga manual."
              : "Registrá la primera carga manual para empezar."
          }
          action={
            <Link
              href={`/backoffice/${slug}/cargas/nueva`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-sunken"
            >
              <PlusIcon className="size-3.5" strokeWidth={1.75} />
              Registrar carga
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-sunken/40 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-left font-medium">Jugador</th>
                <th className="px-3 py-2 text-right font-medium">Monto</th>
                <th className="px-3 py-2 text-left font-medium">Método</th>
                <th className="px-3 py-2 text-left font-medium">Origen</th>
                <th className="px-3 py-2 text-left font-medium">Cuándo</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {cargas.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border/50 last:border-b-0 hover:bg-sunken/60"
                >
                  <td className="px-3 py-2">
                    <StatusPill variant={estadoAVariant(c.estado)}>
                      {c.estado}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{c.playerRef}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatear(c.montoCents, c.moneda)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{c.metodo}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {c.origen}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatRelativeTime(c.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/backoffice/${slug}/cargas/${c.id}`}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Ver detalle"
                    >
                      <ArrowRightIcon className="size-3.5" strokeWidth={1.75} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function FiltrosLinea({
  slug,
  estadoActual,
  playerRefActual,
  cantidadCargas,
}: {
  slug: string;
  estadoActual: string;
  playerRefActual: string;
  cantidadCargas: number;
}) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2 text-sm"
    >
      <span className="px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Filtros
      </span>
      <select
        name="estado"
        defaultValue={estadoActual}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">Todos los estados</option>
        {ESTADOS_CARGA.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>
      <input
        type="text"
        name="playerRef"
        defaultValue={playerRefActual}
        placeholder="player_ref"
        className="h-8 w-40 rounded-md border border-border bg-background px-2 font-mono text-xs"
      />
      <button
        type="submit"
        className="h-8 rounded-md bg-secondary px-3 text-sm font-medium hover:bg-secondary/80"
      >
        Aplicar
      </button>
      {(estadoActual || playerRefActual) && (
        <a
          href={`/backoffice/${slug}/cargas`}
          className="h-8 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Limpiar
        </a>
      )}
      <span className="ml-auto px-2 text-xs text-muted-foreground tabular-nums">
        {cantidadCargas} resultado{cantidadCargas === 1 ? "" : "s"}
      </span>
    </form>
  );
}