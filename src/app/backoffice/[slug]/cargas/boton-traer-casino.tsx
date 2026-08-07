"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { DownloadCloudIcon } from "lucide-react";
import { toast } from "sonner";

import { accionTraerCargasDelCasino } from "@/app/actions/casino-sync";

export function BotonTraerDelCasino({ tenantSlug }: { tenantSlug: string }) {
  const [running, setRunning] = useState(false);

  return (
    <form
      action={async () => {
        setRunning(true);
        try {
          const r = await accionTraerCargasDelCasino(tenantSlug);
          if (!r.ok) {
            toast.error(r.error ?? "Error al traer del casino");
          } else if (r.traidas > 0) {
            toast.success(
              `${r.traidas} carga${r.traidas === 1 ? "" : "s"} traída${r.traidas === 1 ? "" : "s"} del casino` +
                (r.duplicadas > 0 ? ` (${r.duplicadas} ya existían)` : ""),
            );
          } else if (r.duplicadas > 0) {
            toast.info(`Las ${r.duplicadas} cargas del casino ya estaban registradas`);
          } else {
            toast.info("El casino no devolvió cargas nuevas");
          }
        } finally {
          setRunning(false);
        }
      }}
    >
      <ButtonPending running={running} />
    </form>
  );
}

function ButtonPending({ running }: { running: boolean }) {
  // useFormStatus necesita estar dentro de un <form>. El padre ya lo está.
  const { pending } = useFormStatus();
  const disabled = running || pending;
  return (
    <button
      type="submit"
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-sunken disabled:opacity-60"
    >
      <DownloadCloudIcon
        className={`size-3.5 ${disabled ? "animate-pulse" : ""}`}
        strokeWidth={1.75}
      />
      {disabled ? "Trayendo..." : "Traer del casino"}
    </button>
  );
}