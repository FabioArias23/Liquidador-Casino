import { PlusIcon, UsersIcon } from "lucide-react";

import { InvitarForm, MiembroFila } from "@/app/backoffice/[slug]/miembros/miembros-client";
import { EmptyState } from "@/components/ui/empty-state";
import { tenantId as toTenantId } from "@/domain/ids";
import { auth, repos } from "@/lib/server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function MiembrosPage({ params }: PageProps) {
  const { slug } = await params;
  const sesion = await auth().obtenerSesion();
  if (!sesion) return null;

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(slug);
  if (!tenant) return null;

  // Permiso: solo tenant_admin (o superadmin) gestiona miembros.
  let esAdminActual = sesion.profile.isSuperadmin;
  if (!esAdminActual) {
    const member = await r.members.obtenerPorUsuarioYTenant(tenant.id, sesion.userId);
    if (!member || member.estado !== "activo" || member.rol !== "tenant_admin") {
      return null;
    }
    esAdminActual = true;
  }

  const miembros = await r.members.listarPorTenant(toTenantId(tenant.id));
  // Activos primero, inactivos al final. Dentro de cada grupo, más recientes arriba.
  miembros.sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === "activo" ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Miembros</h1>
          <p className="text-sm text-muted-foreground">
            Usuarios con acceso al tenant y su rol (operador, supervisor, tenant_admin).
          </p>
        </div>
      </header>

      {esAdminActual && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Invitar nuevo miembro
          </h2>
          <InvitarForm tenantSlug={slug} />
        </section>
      )}

      <section className="rounded-xl border border-border bg-card">
        {miembros.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title="Sin miembros en el tenant"
            description="Acá vas a ver los usuarios del tenant con su email, rol y estado. El tenant_admin puede invitar, cambiar el rol o desactivar miembros."
            action={
              esAdminActual && (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground">
                  <PlusIcon className="size-3.5" strokeWidth={1.75} />
                  Usá el formulario de arriba
                </span>
              )
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-sunken/40 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium">Rol</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {miembros.map((m) => (
                <MiembroFila
                  key={m.id}
                  member={m}
                  tenantSlug={slug}
                  esAdminActual={esAdminActual}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
