import { PlugIcon } from "lucide-react";

import { CasinoConfigForm } from "@/app/backoffice/[slug]/casino/casino-client";
import { tenantId as toTenantId } from "@/domain/ids";
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
  let esAdminActual = sesion.profile.isSuperadmin;
  if (!esAdminActual) {
    const member = await r.members.obtenerPorUsuarioYTenant(tenant.id, sesion.userId);
    if (!member || member.estado !== "activo" || member.rol !== "tenant_admin") {
      return null;
    }
    esAdminActual = true;
  }

  const creds = await r.casinoCredentials.obtenerPorTenant(toTenantId(tenant.id));
  const initial = creds
    ? {
        adapterType: creds.adapterType,
        baseUrl: creds.baseUrl,
        tieneApiKey: creds.apiKeyCiphertext !== null,
        tieneWebhookSecret: creds.webhookSecret !== null,
      }
    : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Casino</h1>
        <p className="text-sm text-muted-foreground">
          Configuración del adapter para traer cargas y retiros del casino.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <header className="mb-4 flex items-center gap-2">
          <PlugIcon className="size-4 text-muted-foreground" strokeWidth={1.75} />
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Adapter y credenciales
          </h2>
        </header>
        <CasinoConfigForm tenantSlug={slug} initial={initial} />
      </section>
    </div>
  );
}
