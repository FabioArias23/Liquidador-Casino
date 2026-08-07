import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth, repos } from "@/lib/server";

export default async function SuperadminTenantsPage() {
  const sesion = await auth().obtenerSesion();

  // Solo superadmin puede ver esta página
  if (!sesion || !sesion.profile.isSuperadmin) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Acceso restringido</CardTitle>
            <CardDescription>
              Esta página es solo para superadmins. Cambiá de usuario arriba a la derecha
              para usar <code>superadmin@liquidador.local</code>.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const r = await repos();
  const tenants = await r.tenants.listar();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            {tenants.length} tenant{tenants.length === 1 ? "" : "s"} en la plataforma.
          </p>
        </div>
        <Button disabled>Crear tenant (próximamente)</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>
            Click en un tenant para ver detalle (próximamente).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {tenants.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium">{t.nombre}</div>
                  <div className="text-xs text-muted-foreground">/{t.slug}</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={t.estado === "activo" ? "default" : "secondary"}>
                    {t.estado}
                  </Badge>
                  <Link
                    href={`/backoffice/${t.slug}`}
                    className="text-sm text-primary hover:underline"
                  >
                    entrar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
