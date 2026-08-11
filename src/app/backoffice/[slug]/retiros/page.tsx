import Link from "next/link";
import { ArrowRightIcon, FilterIcon, PlusIcon } from "lucide-react";

import { listarRetiros, type ListarRetirosFiltros } from "@/application/retiros/listar-retiros";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { formatear } from "@/domain/money";
import { type EstadoRetiro, ESTADOS_RETIRO } from "@/domain/retiros";
import { tenantId as toTenantId } from "@/domain/ids";
import { auth, repos } from "@/lib/server";
import { formatRelativeTime } from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    estado?: string;
    playerRef?: string;
  }>;
}

export default async function RetirosPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const sesion = await auth().obtenerSesion();
  if (!sesion) return null;

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(slug);
  if (!tenant) return null;

  if (!sesion.profile.isSuperadmin) {
    const member = await r.members.obtenerPorUsuarioYTenant(tenant.id, sesion.userId);
    if (!member || member.estado !== "activo") return null;
  }

  const filtros: ListarRetirosFiltros = {};
  if (sp.estado && (ESTADOS_RETIRO as readonly string[]).includes(sp.estado)) {
    filtros.estado = sp.estado as EstadoRetiro;
  }
  if (sp.playerRef) filtros.playerRef = sp.playerRef;

  const retiros = await listarRetiros(r, toTenantId(tenant.id), filtros);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Retiros</h1>
          <p className="text-sm text-muted-foreground">
            {retiros.length === 0
              ? "Sin retiros registrados."
              : `${retiros.length} retiro${retiros.length === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Link
          href={`/backoffice/${slug}/retiros/nuevo`}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <PlusIcon className="size-3.5" strokeWidth={2} />
          Solicitar retiro
        </Link>
      </header>

      <FiltrosLinea
        slug={slug}
        estadoActual={sp.estado ?? ""}
        playerRefActual={sp.playerRef ?? ""}
        cantidad={retiros.length}
      />

      {retiros.length === 0 ? (
        <EmptyState
          icon={FilterIcon}
          title="Sin retiros con esos filtros"
          description={
            sp.estado || sp.playerRef
              ? "Probá limpiar los filtros o registrar un retiro manual."
              : "Registrá el primer retiro manual para empezar."
          }
          action={
            <Link
              href={`/backoffice/${slug}/retiros/nuevo`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-sunken"
            >
              <PlusIcon className="size-3.5" strokeWidth={1.75} />
              Solicitar retiro
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
                <th className="px-3 py-2 text-left font-medium">CBU destino</th>
                <th className="px-3 py-2 text-left font-medium">Origen</th>
                <th className="px-3 py-2 text-left font-medium">Cuándo</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {retiros.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/50 last:border-b-0 hover:bg-sunken/60"
                >
                  <td className="px-3 py-2">
                    <StatusPill variant={estadoAVariant(r.estado)}>
                      {r.estado}
                    </StatusPill>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.playerRef}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {formatear(r.montoCents, r.moneda)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground tabular-nums">
                    {r.cbuDestino.slice(0, 8)}…{r.cbuDestino.slice(-4)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {r.origen}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatRelativeTime(r.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/backoffice/${slug}/retiros/${r.id}`}
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

function FiltrosLinea({
  slug,
  estadoActual,
  playerRefActual,
  cantidad,
}: {
  slug: string;
  estadoActual: string;
  playerRefActual: string;
  cantidad: number;
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
        {ESTADOS_RETIRO.map((e) => (
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
          href={`/backoffice/${slug}/retiros`}
          className="h-8 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Limpiar
        </a>
      )}
      <span className="ml-auto px-2 text-xs text-muted-foreground tabular-nums">
        {cantidad} resultado{cantidad === 1 ? "" : "s"}
      </span>
    </form>
  );
}
