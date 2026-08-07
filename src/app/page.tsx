import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth, repos } from "@/lib/server";
import { listarTenants } from "@/application/tenants/listar-tenants";

export default async function Home() {
  const sesion = await auth().obtenerSesion();

  if (!sesion) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Bienvenido al Liquidador de Casino</CardTitle>
            <CardDescription>
              MOCK: todavía no hay sesión. Elegí un usuario en el header arriba a la derecha
              para empezar (cualquiera de los 4 perfiles seed).
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p className="mb-2">
              Cuando esté listo Supabase real, este paso se reemplaza por un login con email + password + TOTP opcional.
            </p>
            <p>
              El selector está arriba a la derecha, marcado con un candado (🔒).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const r = await listarTenants(await repos(), sesion.userId);
  if (!r.ok) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{r.error.mensaje}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { tenants, esSuperadmin } = r.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hola, {sesion.profile.email}</h1>
        <p className="text-sm text-muted-foreground">
          {esSuperadmin
            ? "Sos superadmin: ves todos los tenants."
            : `Sos miembro de ${tenants.length} tenant${tenants.length === 1 ? "" : "s"}.`}
        </p>
      </div>

      {esSuperadmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Tenants</span>
              <Link
                href="/superadmin/tenants"
                className="text-sm font-normal text-primary hover:underline"
              >
                gestionar →
              </Link>
            </CardTitle>
            <CardDescription>Vista de superadmin. Click en un tenant para entrar al backoffice.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tenants.map((t) => (
              <Link
                key={t.id}
                href={`/backoffice/${t.slug}`}
                className="flex items-center justify-between rounded-md border px-4 py-3 transition-colors hover:bg-accent"
              >
                <div>
                  <div className="font-medium">{t.nombre}</div>
                  <div className="text-xs text-muted-foreground">/{t.slug}</div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    t.estado === "activo"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {t.estado}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {!esSuperadmin && tenants.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sin tenants asignados</CardTitle>
            <CardDescription>
              No sos miembro activo de ningún tenant todavía. Pedile a un admin que te invite.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!esSuperadmin &&
        tenants.map((t) => (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle>{t.nombre}</CardTitle>
              <CardDescription>/{t.slug}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href={`/backoffice/${t.slug}`}
                className="text-sm text-primary hover:underline"
              >
                Entrar al backoffice →
              </Link>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
