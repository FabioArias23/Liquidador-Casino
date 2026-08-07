import { LandmarkIcon, PlusIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
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
  if (!sesion.profile.isSuperadmin) {
    const member = await r.members.obtenerPorUsuarioYTenant(tenant.id, sesion.userId);
    if (!member || member.estado !== "activo" || member.rol !== "tenant_admin") {
      return null;
    }
  }

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

      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={LandmarkIcon}
          title="Listado de CBUs en construcción"
          description="Acá vas a ver las cuentas cargadas, su CBU validado, titular y alias. El alta y la baja las hace el tenant_admin con validación de checksum oficial (BCRA)."
          action={
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground opacity-50"
            >
              <PlusIcon className="size-3.5" strokeWidth={1.75} />
              Agregar CBU (próximamente)
            </button>
          }
        />
      </div>
    </div>
  );
}
