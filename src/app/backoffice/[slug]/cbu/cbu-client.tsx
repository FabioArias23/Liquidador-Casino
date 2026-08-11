"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { AlertCircleIcon, PlusIcon } from "lucide-react";

import {
  accionAgregarCBU,
  accionDesactivarCBU,
  type FormState,
} from "@/app/actions/cbu";
import { Button } from "@/components/ui/button";
import type { CbuAccount } from "@/domain/entities";

const INITIAL: FormState = { ok: true };

export function AgregarCBUForm({ tenantSlug }: { tenantSlug: string }) {
  const bound = accionAgregarCBU.bind(null, tenantSlug);
  const [state, formAction] = useActionState<FormState, FormData>(bound, INITIAL);
  const [cbuLocal, setCbuLocal] = useState("");

  return (
    <form
      action={async (formData: FormData) => {
        await formAction(formData);
        if (state.error) {
          toast.error(state.error.mensaje);
        } else {
          toast.success("CBU agregado");
          setCbuLocal("");
          (document.getElementById("form-cbu") as HTMLFormElement | null)?.reset();
        }
      }}
      id="form-cbu"
      className="space-y-3"
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
      <div className="grid gap-3 md:grid-cols-[1fr_2fr_1fr_auto]">
        <Field label="CBU (22 dígitos)" required>
          <input
            type="text"
            name="cbu"
            required
            inputMode="numeric"
            value={cbuLocal}
            onChange={(e) => setCbuLocal(e.target.value)}
            placeholder="0000000000000000000000"
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm tabular-nums"
          />
        </Field>
        <Field label="Titular" required>
          <input
            type="text"
            name="titular"
            required
            placeholder="Casino Demo S.A."
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          />
        </Field>
        <Field label="Alias (opcional)">
          <input
            type="text"
            name="alias"
            placeholder="casino.demo.ars"
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm"
          />
        </Field>
        <SubmitButton />
      </div>
    </form>
  );
}

export function CBUFila({
  cbu,
  tenantSlug,
  esAdminActual,
}: {
  cbu: CbuAccount;
  tenantSlug: string;
  esAdminActual: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <tr
      className={`border-b border-border/50 last:border-b-0 ${cbu.activa ? "hover:bg-sunken/60" : "bg-status-settled-bg/30 text-muted-foreground"}`}
    >
      <td className="px-3 py-2 font-mono text-xs tabular-nums">{cbu.cbu}</td>
      <td className="px-3 py-2 text-sm">{cbu.titular}</td>
      <td className="px-3 py-2 text-sm font-mono text-xs text-muted-foreground">
        {cbu.alias ?? "—"}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{cbu.moneda}</td>
      <td className="px-3 py-2">
        <span
          className={
            cbu.activa
              ? "inline-flex items-center gap-1.5 rounded-full bg-status-validated-bg px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-status-validated-fg"
              : "inline-flex items-center gap-1.5 rounded-full bg-status-settled-bg px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-status-settled-fg"
          }
        >
          {cbu.activa ? "activa" : "inactiva"}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        {esAdminActual && cbu.activa && (
          <>
            {!confirmando ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmando(true)}
              >
                Desactivar
              </Button>
            ) : (
              <div className="flex items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">¿Confirmás?</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
                  No
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    const r = await accionDesactivarCBU(tenantSlug, cbu.id);
                    if (!r.ok) toast.error(r.error?.mensaje ?? "Error");
                    else toast.success("CBU desactivado");
                    setConfirmando(false);
                  }}
                >
                  Sí, desactivar
                </Button>
              </div>
            )}
          </>
        )}
      </td>
    </tr>
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
      className="inline-flex h-10 items-center gap-1.5 self-end rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      <PlusIcon className="size-3.5" strokeWidth={2} />
      {pending ? "Agregando..." : "Agregar"}
    </button>
  );
}