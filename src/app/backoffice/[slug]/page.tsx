import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth, repos } from "@/lib/server";

export default async function BackofficePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sesion = await auth().obtenerSesion();
  if (!sesion) notFound();

  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(slug);
  if (!tenant) notFound();

  // Verificar membresía (o superadmin)
  const esSuper = sesion.profile.isSuperadmin;
  const membresia = esSuper
    ? null
    : await r.members.obtenerPorUsuarioYTenant(tenant.id, sesion.userId);

  if (!esSuper && (!membresia || membresia.estado !== "activo")) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card>
          <CardHeader>
            <CardTitle>Sin acceso</CardTitle>
            <CardDescription>
              No sos miembro activo de <strong>{tenant.nombre}</strong>.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const [cbus, casinoCreds] = await Promise.all([
    r.cbuAccounts.listarPorTenant(tenant.id),
    r.casinoCredentials.obtenerPorTenant(tenant.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{tenant.nombre}</h1>
            <Badge variant={tenant.estado === "activo" ? "default" : "secondary"}>
              {tenant.estado}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">/{tenant.slug}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CBU cargados</CardTitle>
            <CardDescription>{cbus.length} cuenta(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {cbus.length === 0 && <p className="text-muted-foreground">Ninguno todavía.</p>}
            {cbus.map((c) => (
              <div key={c.id} className="flex items-center justify-between">
                <span className="font-mono text-xs">{c.cbu}</span>
                <span className="text-muted-foreground">{c.titular}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Casino (integración)</CardTitle>
            <CardDescription>
              {casinoCreds ? casinoCreds.adapterType : "sin configurar"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {casinoCreds && (
              <>
                <div>
                  <span className="text-muted-foreground">Base URL: </span>
                  <code className="text-xs">{casinoCreds.baseUrl}</code>
                </div>
                <div>
                  <span className="text-muted-foreground">API key: </span>
                  {casinoCreds.apiKeyCiphertext ? (
                    <span className="text-xs">cifrada</span>
                  ) : (
                    <span className="text-xs text-amber-600">no configurada</span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Próximamente</CardTitle>
          <CardDescription>
            Esto es Fase 1. Próximas: gestión de miembros, configurar creds del casino,
            y las pantallas de cargas / retiros / pagos (Fase 2 y 3).
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
