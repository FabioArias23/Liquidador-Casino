"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { AlertCircleIcon, PlugIcon, RefreshCwIcon } from "lucide-react";

import {
  accionGuardarCasinoConfig,
  accionProbarConexionCasino,
  type FormState,
} from "@/app/actions/casino-config";

const INITIAL: FormState = { ok: true };

export function CasinoConfigForm({
  tenantSlug,
  initial,
}: {
  tenantSlug: string;
  initial?: {
    adapterType: string;
    baseUrl: string;
    tieneApiKey: boolean;
    tieneWebhookSecret: boolean;
  };
}) {
  const bound = accionGuardarCasinoConfig.bind(null, tenantSlug);
  const [state, formAction] = useActionState<FormState, FormData>(bound, INITIAL);
  const [probando, setProbando] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  async function probar() {
    setProbando(true);
    setTestMsg(null);
    const r = await accionProbarConexionCasino(tenantSlug);
    setProbando(false);
    setTestMsg(r.mensaje);
    if (r.ok) toast.success("Conexión OK");
    else toast.error(r.mensaje);
  }

  return (
    <div className="space-y-6">
      <form
        action={async (formData: FormData) => {
          await formAction(formData);
          if (state.error) toast.error(state.error.mensaje);
          else toast.success("Configuración guardada");
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
          <Field label="Tipo de adapter" required>
            <select
              name="adapterType"
              defaultValue={initial?.adapterType ?? "configurable_http"}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              <option value="configurable_http">configurable_http (mapping declarativo)</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Mañana se agregan adapters específicos por casino.
            </p>
          </Field>

          <Field label="Base URL del casino" required>
            <input
              type="url"
              name="baseUrl"
              required
              defaultValue={initial?.baseUrl ?? ""}
              placeholder="https://api.casino.example.com"
              className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-xs"
            />
          </Field>

          <Field label="API key (cifrada en reposo)">
            <input
              type="password"
              name="apiKeyCiphertext"
              placeholder={initial?.tieneApiKey ? "(dejar vacío para no cambiar)" : "sk_live_…"}
              className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Mock: se guarda como string opaco. Producción: AES-GCM con key en env.
            </p>
          </Field>

          <Field label="Webhook secret">
            <input
              type="password"
              name="webhookSecret"
              placeholder={initial?.tieneWebhookSecret ? "(dejar vacío para no cambiar)" : "whsec_…"}
              className="h-10 w-full rounded-md border border-border bg-background px-3 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Para verificar firma HMAC en webhooks entrantes (Phase 5).
            </p>
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={probar}
            disabled={probando}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-sunken disabled:opacity-60"
          >
            <RefreshCwIcon
              className={`size-3.5 ${probando ? "animate-spin" : ""}`}
              strokeWidth={1.75}
            />
            {probando ? "Probando..." : "Probar conexión"}
          </button>
          <SubmitButton />
        </div>

        {testMsg && (
          <p
            className={`rounded-md border p-3 text-sm ${
              testMsg.startsWith("Conexión OK")
                ? "border-status-validated/40 bg-status-validated-bg/30 text-status-validated-fg"
                : "border-destructive/40 bg-destructive/5 text-destructive"
            }`}
          >
            {testMsg}
          </p>
        )}
      </form>
    </div>
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
      <PlugIcon className="size-3.5" strokeWidth={1.75} />
      {pending ? "Guardando..." : "Guardar"}
    </button>
  );
}