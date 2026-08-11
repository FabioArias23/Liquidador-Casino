import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { SolicitarRetiroForm } from "@/app/backoffice/[slug]/retiros/nuevo/form-retiro";
import { auth, repos } from "@/lib/server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function NuevoRetiroPage({ params }: PageProps) {
  const { slug } = await params;
  const sesion = await auth().obtenerSesion();
  if (!sesion) return null;

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(slug);
  if (!tenant) return null;

  if (!sesion.profile.isSuperadmin) {
    const member = await r.members.obtenerPorUsuarioYTenant(tenant.id, sesion.userId);
    if (!member || member.estado !== "activo") return null;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <Link
          href={`/backoffice/${slug}/retiros`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" strokeWidth={1.75} />
          Volver a Retiros
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Solicitar retiro</h1>
          <p className="text-sm text-muted-foreground">
            Registrá un retiro manual. Queda en estado <code className="font-mono">pending</code> hasta que un operador lo valide.
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-5">
        <SolicitarRetiroForm tenantSlug={slug} />
      </section>
    </div>
  );
}
