import Link from "next/link";
import { ArrowRightIcon, HistoryIcon } from "lucide-react";

import { listarAuditLog, type ListarAuditLogFiltros } from "@/application/audit/listar-audit-log";
import { EmptyState } from "@/components/ui/empty-state";
import { auth, repos } from "@/lib/server";
import { formatRelativeTime } from "@/lib/format";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    entidadTipo?: string;
    actorId?: string;
    desde?: string;
    hasta?: string;
  }>;
}

const TIPOS_ENTIDAD = ["carga", "retiro", "tenant", "member", "cbu", "casino_credentials"];

export default async function HistorialPage({ params, searchParams }: PageProps) {
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

  const filtros: ListarAuditLogFiltros = {};
  if (sp.entidadTipo && TIPOS_ENTIDAD.includes(sp.entidadTipo)) {
    filtros.entidadTipo = sp.entidadTipo;
  }
  if (sp.actorId) filtros.actorId = sp.actorId;
  if (sp.desde) {
    const d = new Date(sp.desde);
    if (!isNaN(d.getTime())) filtros.desde = d;
  }
  if (sp.hasta) {
    const d = new Date(sp.hasta);
    if (!isNaN(d.getTime())) filtros.hasta = d;
  }
  filtros.limit = 200;

  // Hidratamos emails de TODOS los miembros del tenant (para que el selector
  // de actor pueda listar todos los operadores/supervisores/admins).
  const miembros = await r.members.listarPorTenant(tenant.id);
  const profileIds = new Set(miembros.map((m) => m.userId));
  const todosLosPerfiles = await Promise.all(
    [...profileIds].map((id) => r.profiles.obtenerPorId(id)),
  );
  const todosLosActores = todosLosPerfiles
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => ({ id: p.id, email: p.email }))
    .sort((a, b) => a.email.localeCompare(b.email));

  const audits = await listarAuditLog(r, tenant.id, filtros);

  // Hidratamos los emails de los actores para mostrar algo legible (no UUIDs).
  const actorEmails = new Map<string, string>();
  for (const a of audits) {
    if (actorEmails.has(a.actorId)) continue;
    const profile = await r.profiles.obtenerPorId(a.actorId);
    if (profile) actorEmails.set(a.actorId, profile.email);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        <p className="text-sm text-muted-foreground">
          Auditoría inmutable de {tenant.nombre}. Append-only: nadie edita ni borra.
        </p>
      </header>

      <FiltrosLinea
        slug={slug}
        entidadTipoActual={sp.entidadTipo ?? ""}
        actorIdActual={sp.actorId ?? ""}
        desdeActual={sp.desde ?? ""}
        hastaActual={sp.hasta ?? ""}
        cantidad={audits.length}
        actores={todosLosActores}
      />

      {audits.length === 0 ? (
        <EmptyState
          icon={HistoryIcon}
          title="Sin movimientos con esos filtros"
          description="El historial muestra cada cambio de estado, alta o baja del tenant. Probá limpiar los filtros o generá una operación."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-sunken/40 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Cuándo</th>
                <th className="px-3 py-2 text-left font-medium">Actor</th>
                <th className="px-3 py-2 text-left font-medium">Acción</th>
                <th className="px-3 py-2 text-left font-medium">Entidad</th>
                <th className="px-3 py-2 text-left font-medium">Motivo</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {audits.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-border/50 last:border-b-0 hover:bg-sunken/60"
                >
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {formatRelativeTime(a.createdAt)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {actorEmails.get(a.actorId) ?? a.actorId}
                  </td>
                  <td className="px-3 py-2">
                    <code className="font-mono text-xs">{a.accion}</code>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-muted-foreground">{a.entidadTipo}</span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {a.entidadId.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {a.motivo ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    {(a.entidadTipo === "carga" || a.entidadTipo === "retiro") && (
                      <Link
                        href={
                          a.entidadTipo === "carga"
                            ? `/backoffice/${slug}/cargas/${a.entidadId}`
                            : `/backoffice/${slug}/retiros/${a.entidadId}`
                        }
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Ver detalle"
                      >
                        <ArrowRightIcon className="size-3.5" strokeWidth={1.75} />
                      </Link>
                    )}
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

function FiltrosLinea({
  slug,
  entidadTipoActual,
  actorIdActual,
  desdeActual,
  hastaActual,
  cantidad,
  actores,
}: {
  slug: string;
  entidadTipoActual: string;
  actorIdActual: string;
  desdeActual: string;
  hastaActual: string;
  cantidad: number;
  actores: { id: string; email: string }[];
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
        name="entidadTipo"
        defaultValue={entidadTipoActual}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">Todas las entidades</option>
        {TIPOS_ENTIDAD.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        name="actorId"
        defaultValue={actorIdActual}
        className="h-8 max-w-[220px] rounded-md border border-border bg-background px-2 text-sm"
      >
        <option value="">Todos los actores</option>
        {actores.map((a) => (
          <option key={a.id} value={a.id}>
            {a.email}
          </option>
        ))}
      </select>
      <input
        type="date"
        name="desde"
        defaultValue={desdeActual}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm"
      />
      <input
        type="date"
        name="hasta"
        defaultValue={hastaActual}
        className="h-8 rounded-md border border-border bg-background px-2 text-sm"
      />
      <button
        type="submit"
        className="h-8 rounded-md bg-secondary px-3 text-sm font-medium hover:bg-secondary/80"
      >
        Aplicar
      </button>
      {(entidadTipoActual || actorIdActual || desdeActual || hastaActual) && (
        <Link
          href={`/backoffice/${slug}/historial`}
          className="h-8 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Limpiar
        </Link>
      )}
      <span className="ml-auto px-2 text-xs text-muted-foreground tabular-nums">
        {cantidad} resultado{cantidad === 1 ? "" : "s"}
      </span>
    </form>
  );
}
