"use client";

import { LogInIcon } from "lucide-react";

import { accionIniciarSesionComo } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProfileLite {
  id: string;
  email: string;
  isSuperadmin: boolean;
}

export function SelectorUsuario({ perfiles, activoId }: { perfiles: ProfileLite[]; activoId: string | null }) {
  const activo = perfiles.find((p) => p.id === activoId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <LogInIcon className="size-4" />
          {activo ? (
            <span className="flex items-center gap-1.5">
              {activo.email}
              {activo.isSuperadmin && <span className="text-xs">👑</span>}
            </span>
          ) : (
            "Elegir usuario"
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs uppercase tracking-wide">
          MOCK — cambiá de usuario
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {perfiles.map((p) => (
          <form key={p.id} action={accionIniciarSesionComo}>
            <input type="hidden" name="userId" value={p.id} />
            <DropdownMenuItem asChild>
              <button type="submit" className="w-full cursor-pointer">
                <span className="flex w-full items-center justify-between">
                  <span className="truncate">{p.email}</span>
                  {p.isSuperadmin && (
                    <span className="text-xs text-muted-foreground">superadmin</span>
                  )}
                </span>
              </button>
            </DropdownMenuItem>
          </form>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
