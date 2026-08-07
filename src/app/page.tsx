import Link from "next/link";
import { ArrowRightIcon, BuildingIcon, LogInIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { listarTenants } from "@/application/tenants/listar-tenants";
import { auth, repos } from "@/lib/server";

export default async function Home() {
  const sesion = await auth().obtenerSesion();

  if (!sesion) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <EmptyState
          icon={LogInIcon}
          title="Elegí un usuario para empezar"
          description="El selector arriba a la derecha te permite cambiar entre los perfiles seed del demo (operador, supervisor, tenant admin, superadmin)."
        />
      </div>
    );
  }

  const r = await listarTenants(await repos(), sesion.userId);
  if (!r.ok) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Error al cargar tenants</CardTitle>
            <CardDescription>{r.error.mensaje}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { tenants, esSuperadmin } = r.data;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Hola, {sesion.profile.email.split("@")[0]}
          </h1>
          {esSuperadmin && (
            <StatusPill variant="validating">superadmin</StatusPill>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {esSuperadmin
            ? `Ves los ${tenants.length} tenant${tenants.length === 1 ? "" : "s"} de la plataforma.`
            : tenants.length === 0
              ? "No sos miembro activo de ningún tenant todavía."
              : `Sos miembro de ${tenants.length} tenant${tenants.length === 1 ? "" : "s"}.`}
        </p>
      </header>

      {tenants.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={BuildingIcon}
              title="Sin tenants asignados"
              description="Pedile a un admin de plataforma que te invite a un tenant para empezar a operar."
            />
          </CardContent>
        </Card>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              {esSuperadmin ? "Tus tenants" : "Tus accesos"}
            </h2>
            {esSuperadmin && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/superadmin/tenants">
                  Gestionar tenants
                  <ArrowRightIcon className="size-3.5" />
                </Link>
              </Button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {tenants.map((t) => (
              <Link
                key={t.id}
                href={`/backoffice/${t.slug}`}
                data-slot="tenant-card"
                className="group/tenant-card flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-sunken"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-md bg-primary/8 text-primary">
                    <BuildingIcon className="size-4" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="font-medium">{t.nombre}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      /{t.slug}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill
                    variant={t.estado === "activo" ? "validated" : "settled"}
                  >
                    {t.estado}
                  </StatusPill>
                  <ArrowRightIcon
                    strokeWidth={1.75}
                    className="size-4 text-muted-foreground transition-transform group-hover/tenant-card:translate-x-0.5"
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}