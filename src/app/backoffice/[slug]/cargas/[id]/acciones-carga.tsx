"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  accionAsentarCarga,
  accionRechazarCarga,
  accionValidarCarga,
} from "@/app/actions/cargas";
import { Button } from "@/components/ui/button";

interface AccionesProps {
  tenantSlug: string;
  cargaId: string;
  estado: "pending" | "validating" | "validated" | "settled" | "rejected";
  comprobanteUrl: string | null;
}

export function AccionesCarga({
  tenantSlug,
  cargaId,
  estado,
  comprobanteUrl,
}: AccionesProps) {
  const [modoRechazar, setModoRechazar] = useState(false);
  const [motivo, setMotivo] = useState("");

  if (estado === "settled" || estado === "rejected") {
    return (
      <p className="text-xs text-muted-foreground">
        Carga en estado terminal. Sin acciones disponibles.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          action={async () => {
            const r = await accionValidarCarga(
              tenantSlug,
              cargaId,
              comprobanteUrl ?? "",
            );
            if (r.ok) toast.success("Carga validada");
            else toast.error(r.error?.mensaje ?? "No se pudo validar");
          }}
        >
          <ButtonSubmitPending idleLabel="Validar" pendingLabel="Validando..." />
        </form>

        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setModoRechazar((v) => !v)}
        >
          {modoRechazar ? "Cancelar" : "Rechazar"}
        </Button>

        {estado === "validated" && (
          <form
            action={async () => {
              const r = await accionAsentarCarga(tenantSlug, cargaId);
              if (r.ok) toast.success("Carga asentada y registrada en ledger");
              else toast.error(r.error?.mensaje ?? "No se pudo asentar");
            }}
          >
            <ButtonSubmitPending idleLabel="Asentar" pendingLabel="Asentando..." />
          </form>
        )}
      </div>

      {modoRechazar && (
        <form
          action={async (formData: FormData) => {
            const m = String(formData.get("motivo") ?? "");
            if (m.trim().length < 3) {
              toast.error("El motivo debe tener al menos 3 caracteres.");
              return;
            }
            const r = await accionRechazarCarga(tenantSlug, cargaId, m);
            if (r.ok) {
              toast.success("Carga rechazada");
              setModoRechazar(false);
              setMotivo("");
            } else {
              toast.error(r.error?.mensaje ?? "No se pudo rechazar");
            }
          }}
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3"
        >
          <div className="flex-1 space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-destructive">
              Motivo del rechazo (requerido)
            </label>
            <input
              type="text"
              name="motivo"
              required
              minLength={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: CBU no coincide con titular"
              className="h-9 w-full rounded-md border border-destructive/40 bg-background px-3 text-sm"
            />
          </div>
          <button
            type="submit"
            className="mt-6 inline-flex h-9 items-center rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            Confirmar rechazo
          </button>
        </form>
      )}
    </div>
  );
}

function ButtonSubmitPending({
  idleLabel,
  pendingLabel,
}: {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}