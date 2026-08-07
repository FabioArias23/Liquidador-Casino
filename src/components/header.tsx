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

  // perfiles viene tipado por Profile (con UserId brand), pero el client component
  // espera strings. Hacemos el cast explícito acá (única capa de serialización).
  const perfilesLite = perfiles.map((p) => ({
    id: p.id as unknown as string,
    email: p.email,
    isSuperadmin: p.isSuperadmin,
  }));

  return (
    <header className="border-b bg-card">
      <div className="flex h-14 items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Building2Icon className="size-5 text-primary" />
          <span className="font-semibold tracking-tight">Liquidador de Casino</span>
          <Separator orientation="vertical" className="mx-3 h-5" />
          <span className="text-xs text-muted-foreground">multi-tenant · mock-first</span>
        </div>

        <div className="flex items-center gap-2">
          <SelectorUsuario perfiles={perfilesLite} activoId={sesion?.userId as unknown as string ?? null} />
          {sesion && (
            <form action={accionCerrarSesion}>
              <Button type="submit" variant="ghost" size="sm">
                Salir
              </Button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
