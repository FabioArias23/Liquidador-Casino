import { PlugIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { auth, repos } from "@/lib/server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CasinoPage({ params }: PageProps) {
  const { slug } = await params;
  const sesion = await auth().obtenerSesion();
  if (!sesion) return null;

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(slug);
  if (!tenant) return null;

  // Permiso: solo tenant_admin (o superadmin) configura credenciales del casino.
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
          <h1 className="text-2xl font-semibold tracking-tight">Casino</h1>
          <p className="text-sm text-muted-foreground">
            Configuración del adapter para traer cargas y retiros del casino.
          </p>
        </div>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={PlugIcon}
          title="Configuración del casino en construcción"
          description="Acá vas a ver el adapter configurado, la URL base, y vas a poder cargar la API key (cifrada en reposo) y el webhook secret. El test de conexión contra el endpoint configurado ya está implementado."
        />
      </div>
    </div>
  );
}
