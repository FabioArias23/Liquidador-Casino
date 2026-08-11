"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { AlertCircleIcon, UserPlusIcon } from "lucide-react";

import {
  accionCambiarRolMiembro,
  accionDesactivarMiembro,
  accionInvitarMiembro,
  type FormState,
} from "@/app/actions/miembros";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/domain/roles";
import type { Member } from "@/domain/entities";

const INITIAL: FormState = { ok: true };

export function InvitarForm({ tenantSlug }: { tenantSlug: string }) {
  const bound = accionInvitarMiembro.bind(null, tenantSlug);
  const [state, formAction] = useActionState<FormState, FormData>(bound, INITIAL);

  return (
    <form
      action={async (formData: FormData) => {
        await formAction(formData);
        if (state.error) toast.error(state.error.mensaje);
      }}
      className="grid items-end gap-3 md:grid-cols-[1fr_180px_auto]"
    >
      {state.error && (
        <div role="alert" className="md:col-span-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
          <div>
            <p className="font-medium">{state.error.codigo}</p>
            <p className="text-xs text-destructive/80">{state.error.mensaje}</p>
          </div>
        </div>
      )}
      <Field label="Email" required>
        <input
          type="email"
          name="email"
          required
          placeholder="usuario@casino.example"
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        />
      </Field>
      <Field label="Rol" required>
        <select
          name="rol"
          defaultValue="operador"
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </Field>
      <SubmitButton />
    </form>
  );
}

export function MiembroFila({
  member,
  tenantSlug,
  esAdminActual,
}: {
  member: Member;
  tenantSlug: string;
  esAdminActual: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <tr
      className={`border-b border-border/50 last:border-b-0 ${member.estado === "inactivo" ? "bg-status-settled-bg/30 text-muted-foreground" : "hover:bg-sunken/60"}`}
    >
      <td className="px-3 py-2 text-sm">{member.email}</td>
      <td className="px-3 py-2">
        {esAdminActual ? (
          <select
            defaultValue={member.rol}
            onChange={async (e) => {
              const nuevo = e.target.value as typeof ROLES[number];
              if (nuevo === member.rol) return;
              const r = await accionCambiarRolMiembro(tenantSlug, member.id, nuevo);
              if (!r.ok) {
                toast.error(r.error?.mensaje ?? "Error");
                e.target.value = member.rol;
              } else {
                toast.success(`Rol cambiado a ${nuevo}`);
              }
            }}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm">{member.rol}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span
          className={
            member.estado === "activo"
              ? "inline-flex items-center gap-1.5 rounded-full bg-status-validated-bg px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-status-validated-fg"
              : "inline-flex items-center gap-1.5 rounded-full bg-status-settled-bg px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-status-settled-fg"
          }
        >
          {member.estado}
        </span>
      </td>
      <td className="px-3 py-2 text-right">
        {esAdminActual && member.estado === "activo" && (
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmando(false)}
                >
                  No
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    const r = await accionDesactivarMiembro(tenantSlug, member.id);
                    if (!r.ok) toast.error(r.error?.mensaje ?? "Error");
                    else toast.success("Miembro desactivado");
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
      className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      <UserPlusIcon className="size-3.5" strokeWidth={2} />
      {pending ? "Invitando..." : "Invitar"}
    </button>
  );
}