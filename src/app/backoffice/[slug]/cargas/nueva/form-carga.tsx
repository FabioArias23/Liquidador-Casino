"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircleIcon, ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import {
  accionRegistrarCargaManual,
  type FormState,
} from "@/app/actions/cargas";

const INITIAL: FormState = { ok: true };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      {pending ? "Registrando..." : "Registrar carga"}
    </button>
  );
}

export function FormCargaManual({ tenantSlug }: { tenantSlug: string }) {
  const bound = accionRegistrarCargaManual.bind(null, tenantSlug);
  const [state, formAction] = useActionState<FormState, FormData>(bound, INITIAL);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="font-medium">{traducirCodigo(state.error.codigo)}</p>
            {state.error.mensaje && (
              <p className="text-xs text-destructive/80">{state.error.mensaje}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Player ref" required>
          <input
            type="text"
            name="playerRef"
            required
            placeholder="jugador-001"
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm"
          />
        </Field>

        <Field label="Monto (es-AR)" required>
          <input
            type="text"
            name="montoCents"
            required
            placeholder="1.234,56 o 1234.56"
            inputMode="decimal"
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm tabular-nums"
          />
          <p className="text-xs text-muted-foreground">
            Acepta formato es-AR (&quot;1.234,56&quot;) o inglés (&quot;1234.56&quot;).
          </p>
        </Field>

        <Field label="Moneda" required>
          <select
            name="moneda"
            defaultValue="ARS"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </Field>

        <Field label="Método" required>
          <select
            name="metodo"
            defaultValue="transferencia"
            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="efectivo">Efectivo</option>
            <option value="cripto">Cripto</option>
          </select>
        </Field>

        <Field label="URL del comprobante" required full>
          <input
            type="url"
            name="comprobanteUrl"
            required
            placeholder="/uploads/comprobante-001.jpg"
            className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Mock: en producción esto sube a Supabase Storage.
          </p>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <Link
          href={`/backoffice/${tenantSlug}/cargas`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" strokeWidth={1.75} />
          Volver a la lista
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  full,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      {children}
    </label>
  );
}

function traducirCodigo(codigo: string): string {
  switch (codigo) {
    case "INPUT_INVALIDO":
      return "Datos inválidos";
    case "PERMISO_DENEGADO":
      return "Sin permiso";
    case "PROFILE_NO_ENCONTRADO":
      return "Usuario no encontrado";
    case "TENANT_NO_ENCONTRADO":
      return "Tenant no encontrado";
    case "NO_AUTENTICADO":
      return "Sin sesión";
    default:
      return codigo;
  }
}