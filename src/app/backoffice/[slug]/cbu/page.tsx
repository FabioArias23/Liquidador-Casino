import { LandmarkIcon, PlusIcon } from "lucide-react";

import { AgregarCBUForm, CBUFila } from "@/app/backoffice/[slug]/cbu/cbu-client";
import { EmptyState } from "@/components/ui/empty-state";
import { tenantId as toTenantId } from "@/domain/ids";
import { auth, repos } from "@/lib/server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CbuPage({ params }: PageProps) {
  const { slug } = await params;
  const sesion = await auth().obtenerSesion();
  if (!sesion) return null;

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(slug);
  if (!tenant) return null;

  // Permiso: solo tenant_admin (o superadmin) configura CBUs.
  let esAdminActual = sesion.profile.isSuperadmin;
  if (!esAdminActual) {
    const member = await r.members.obtenerPorUsuarioYTenant(tenant.id, sesion.userId);
    if (!member || member.estado !== "activo" || member.rol !== "tenant_admin") {
      return null;
    }
    esAdminActual = true;
  }

  const cbus = await r.cbuAccounts.listarPorTenant(toTenantId(tenant.id));
  // Activas primero, inactivas al final. Dentro de cada grupo, más recientes arriba.
  cbus.sort((a, b) => {
    if (a.activa !== b.activa) return a.activa ? -1 : 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">CBU</h1>
          <p className="text-sm text-muted-foreground">
            Cuentas bancarias del tenant donde se acreditan los pagos a jugadores.
          </p>
        </div>
      </header>

      {esAdminActual && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Agregar nueva CBU
          </h2>
          <AgregarCBUForm tenantSlug={slug} />
        </section>
      )}

      <section className="rounded-xl border border-border bg-card">
        {cbus.length === 0 ? (
          <EmptyState
            icon={LandmarkIcon}
            title="Sin CBUs cargadas"
            description="Acá vas a ver las cuentas cargadas, su CBU validado, titular y alias. La validación de checksum oficial (BCRA) corre al dar el alta."
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
                <th className="px-3 py-2 text-left font-medium">CBU</th>
                <th className="px-3 py-2 text-left font-medium">Titular</th>
                <th className="px-3 py-2 text-left font-medium">Alias</th>
                <th className="px-3 py-2 text-left font-medium">Moneda</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {cbus.map((c) => (
                <CBUFila
                  key={c.id}
                  cbu={c}
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
