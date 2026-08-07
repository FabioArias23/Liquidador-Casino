import { Building2Icon } from "lucide-react";

import { accionCerrarSesion } from "@/app/actions/auth";
import { SelectorUsuario } from "@/components/selector-usuario";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/server";

export async function Header() {
  const [sesion, perfiles] = await Promise.all([
    auth().obtenerSesion(),
    auth().listarPerfilesParaSelector(),
  ]);

  // Cast único de serialización: Profile (con UserId brand) → string para el client component.
  const perfilesLite = perfiles.map((p) => ({
    id: p.id as unknown as string,
    email: p.email,
    isSuperadmin: p.isSuperadmin,
  }));

  return (
    <header className="h-14 shrink-0 border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-2.5">
          <Building2Icon className="size-4 text-primary" strokeWidth={2} />
          <span className="text-sm font-semibold tracking-tight">
            Liquidador de Casino
          </span>
          <Separator
            orientation="vertical"
            className="mx-2 h-4"
          />
          <span className="text-xs text-muted-foreground">
            Multi-tenant · liquidación diaria
          </span>
        </div>

        <div className="flex items-center gap-2">
          <SelectorUsuario
            perfiles={perfilesLite}
            activoId={sesion?.userId as unknown as string ?? null}
          />
          {sesion && (
            <form action={accionCerrarSesion}>
              <Button type="submit" variant="ghost" size="sm">
                Cerrar sesión
              </Button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}