"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { AlertCircleIcon, BanknoteIcon } from "lucide-react";

import {
  accionSolicitarRetiro,
  type FormState,
} from "@/app/actions/retiros";

const INITIAL: FormState = { ok: true };

export function SolicitarRetiroForm({ tenantSlug }: { tenantSlug: string }) {
  const bound = accionSolicitarRetiro.bind(null, tenantSlug);
  const [state, formAction] = useActionState<FormState, FormData>(bound, INITIAL);
  const [montoLocal, setMontoLocal] = useState("");

  return (
    <form
      action={async (formData: FormData) => {
        await formAction(formData);
        if (state.error) {
          toast.error(state.error.mensaje);
        } else {
          toast.success("Retiro solicitado");
          setMontoLocal("");
        }
      }}
      className="space-y-4"
    >
      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="font-medium">{state.error.codigo}</p>
            <p className="text-xs text-destructive/80">{state.error.mensaje}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="player_ref del jugador" required>
          <input
            type="text"
            name="playerRef"
            required
            placeholder="jugador-a3f9"
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm"
          />
        </Field>

        <Field label="Monto (ARS)" required>
          <input
            type="text"
            name="montoCents"
            required
            inputMode="decimal"
            value={montoLocal}
            onChange={(e) => setMontoLocal(e.target.value)}
            placeholder="10000.00"
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm tabular-nums"
          />
          <p className="text-xs text-muted-foreground">
            Se interpreta como decimal (punto o coma). Internamente se guarda en centavos.
          </p>
        </Field>

        <Field label="CBU destino (22 dígitos)" required>
          <input
            type="text"
            name="cbuDestino"
            required
            inputMode="numeric"
            placeholder="2850590940090418135201"
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm tabular-nums"
          />
          <p className="text-xs text-muted-foreground">
            Pasa el checksum oficial (BCRA). Si no, el sistema lo rechaza.
          </p>
        </Field>

        <Field label="Alias destino (opcional)">
          <input
            type="text"
            name="aliasDestino"
            placeholder="jugador.a3f9.mp"
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm"
          />
        </Field>

        <Field label="Titular destino" required>
          <input
            type="text"
            name="titularDestino"
            required
            placeholder="Juan Perez"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
        </Field>

        <Field label="Moneda">
          <input
            type="text"
            name="moneda"
            defaultValue="ARS"
            readOnly
            className="h-10 w-full rounded-md border border-border bg-sunken px-3 font-mono text-sm text-muted-foreground"
          />
        </Field>
      </div>

      <div className="flex justify-end border-t border-border pt-4">
        <SubmitButton />
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      <BanknoteIcon className="size-3.5" strokeWidth={1.75} />
      {pending ? "Solicitando..." : "Solicitar retiro"}
    </button>
  );
}
