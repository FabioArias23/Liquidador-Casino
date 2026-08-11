"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import {
  CheckIcon,
  XIcon,
  ShieldCheckIcon,
  BanknoteIcon,
} from "lucide-react";

import {
  accionAprobarRetiro,
  accionPagarPremio,
  accionRechazarRetiro,
  accionValidarRetiro,
} from "@/app/actions/retiros";
import { Button } from "@/components/ui/button";

interface AccionesProps {
  tenantSlug: string;
  retiroId: string;
  estado: EstadoRetiro;
  montoCents: number;
  validadaPor: string | null;
  aprobadaPor: string | null;
  pagadaPor: string | null;
  rechazadaPor: string | null;
  actorId: string;
  actorEmail: string;
  actorRol: "operador" | "supervisor" | "tenant_admin" | "superadmin";
}

type EstadoRetiro =
  | "pending"
  | "validated"
  | "awaiting_approval"
  | "approved"
  | "paying"
  | "paid"
  | "rejected"
  | "failed";

/**
 * Cuatro-ojos visible:
 * - El actor actual NO puede validar si ya registró el retiro (lo permitimos pero queda registrado).
 * - El actor actual NO puede APROBAR si fue quien validó.
 * - El actor actual NO puede PAGAR si fue quien aprobó.
 * El state machine no valida cuatro-ojos; este componente avisa al usuario y al server action
 * también se lo valida (defensa en profundidad).
 */
export function AccionesRetiro({
  tenantSlug,
  retiroId,
  estado,
  montoCents: _montoCents,
  validadaPor,
  aprobadaPor,
  pagadaPor: _pagadaPor,
  rechazadaPor: _rechazadaPor,
  actorId,
  actorEmail,
  actorRol,
}: AccionesProps) {
  const [modoRechazar, setModoRechazar] = useState(false);
  const [modoPagar, setModoPagar] = useState(false);
  const [motivo, setMotivo] = useState("");

  const mismoValidada = validadaPor === actorId;
  const mismoAprobada = aprobadaPor === actorId;
  const terminal = estado === "paid" || estado === "rejected" || estado === "failed" || estado === "paying";

  if (terminal) {
    return (
      <p className="text-xs text-muted-foreground">
        Retiro en estado terminal. Sin acciones disponibles.
      </p>
    );
  }

  const puedeValidar =
    (estado === "pending") &&
    (actorRol === "operador" || actorRol === "supervisor" || actorRol === "tenant_admin" || actorRol === "superadmin");

  const puedeAprobar =
    (estado === "validated" || estado === "awaiting_approval") &&
    (actorRol === "supervisor" || actorRol === "tenant_admin" || actorRol === "superadmin") &&
    !mismoValidada;

  const puedePagar =
    estado === "approved" &&
    (actorRol === "operador" || actorRol === "supervisor" || actorRol === "tenant_admin" || actorRol === "superadmin") &&
    !mismoAprobada;

  const puedeRechazar =
    (estado === "pending" || estado === "validated" || estado === "awaiting_approval") &&
    (actorRol === "operador" || actorRol === "supervisor" || actorRol === "tenant_admin" || actorRol === "superadmin");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {puedeValidar && (
          <form
            action={async () => {
              const r = await accionValidarRetiro(tenantSlug, retiroId);
              if (r.ok) toast.success("Retiro validado");
              else toast.error(r.error?.mensaje ?? "No se pudo validar");
            }}
          >
            <ButtonSubmitPending idleLabel="Validar" pendingLabel="Validando..." icon={<CheckIcon className="size-3.5" strokeWidth={2} />} />
          </form>
        )}

        {puedeAprobar && (
          <form
            action={async () => {
              const r = await accionAprobarRetiro(tenantSlug, retiroId);
              if (r.ok) toast.success("Retiro aprobado");
              else toast.error(r.error?.mensaje ?? "No se pudo aprobar");
            }}
          >
            <ButtonSubmitPending idleLabel="Aprobar (cuatro-ojos)" pendingLabel="Aprobando..." icon={<ShieldCheckIcon className="size-3.5" strokeWidth={2} />} />
          </form>
        )}

        {puedePagar && !modoPagar && (
          <Button
            type="button"
            size="sm"
            onClick={() => setModoPagar(true)}
          >
            <BanknoteIcon className="size-3.5" strokeWidth={2} />
            Pagar premio
          </Button>
        )}

        {puedeRechazar && !modoRechazar && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setModoRechazar(true)}
          >
            <XIcon className="size-3.5" strokeWidth={2} />
            Rechazar
          </Button>
        )}
      </div>

      {/* Banner de cuatro-ojos cuando hay acción bloqueada por actor */}
      {(estado === "awaiting_approval" || estado === "validated") && mismoValidada && (actorRol === "supervisor" || actorRol === "tenant_admin" || actorRol === "superadmin") && (
        <BannerCuatroOjos mensaje="Vos validaste este retiro. La aprobación la tiene que hacer otra persona (cuatro-ojos)." />
      )}
      {estado === "approved" && mismoAprobada && (
        <BannerCuatroOjos mensaje="Vos aprobaste este retiro. El pago lo tiene que ejecutar otra persona (cuatro-ojos)." />
      )}

      {/* Form de rechazo */}
      {modoRechazar && (
        <form
          action={async (formData: FormData) => {
            const m = String(formData.get("motivo") ?? "").trim();
            if (m.length < 3) {
              toast.error("El motivo debe tener al menos 3 caracteres.");
              return;
            }
            const r = await accionRechazarRetiro(tenantSlug, retiroId, m);
            if (r.ok) {
              toast.success("Retiro rechazado");
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
          <button
            type="button"
            onClick={() => {
              setModoRechazar(false);
              setMotivo("");
            }}
            className="mt-6 inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-sunken"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Form de pago con comprobante + idempotency key */}
      {modoPagar && (
        <form
          action={async (formData: FormData) => {
            const comprobanteUrl = String(formData.get("comprobanteUrl") ?? "").trim();
            const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();
            if (!comprobanteUrl || !idempotencyKey) {
              toast.error("Falta URL de comprobante o clave de idempotencia.");
              return;
            }
            const r = await accionPagarPremio(tenantSlug, retiroId, comprobanteUrl, idempotencyKey);
            if (r.ok) toast.success("Premio pagado y registrado en ledger");
            else toast.error(r.error?.mensaje ?? "No se pudo pagar");
          }}
          className="space-y-3 rounded-md border border-border bg-sunken/40 p-3"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Pago manual con comprobante
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <Field label="URL del comprobante" required>
              <input
                type="url"
                name="comprobanteUrl"
                required
                placeholder="https://banco.com/comprobante/X"
                className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-xs"
              />
            </Field>
            <Field label="Clave de idempotencia" required>
              <input
                type="text"
                name="idempotencyKey"
                required
                placeholder="pago-<id>-<timestamp> (sugerencia: usá un identificador único por intento)"
                className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Si el sistema recibe la misma key, devuelve el mismo resultado sin error.
              </p>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModoPagar(false)}
              className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-sunken"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <BanknoteIcon className="size-3.5" strokeWidth={2} />
              Confirmar pago
            </button>
          </div>
        </form>
      )}

      {/* Hint para que el operador sepa que está logueado y con qué rol */}
      <p className="text-xs text-muted-foreground">
        Estás operando como <span className="font-mono">{actorEmail}</span> ({actorRol}).
        {mismoValidada && " Cuatro-ojos: aprobá con otro usuario."}
        {mismoAprobada && " Cuatro-ojos: pagá con otro usuario."}
      </p>
    </div>
  );
}

function ButtonSubmitPending({
  idleLabel,
  pendingLabel,
  icon,
}: {
  idleLabel: string;
  pendingLabel: string;
  icon: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
    >
      {icon}
      {pending ? pendingLabel : idleLabel}
    </button>
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

function BannerCuatroOjos({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-status-validated/40 bg-status-validated-bg/30 p-3 text-sm text-status-validated-fg">
      <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <div>
        <p className="font-medium">Cuatro-ojos</p>
        <p className="text-xs">{mensaje}</p>
      </div>
    </div>
  );
}
