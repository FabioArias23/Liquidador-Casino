import { FlaskConicalIcon } from "lucide-react";

/**
 * Banner persistente de "DEMO — Datos sintéticos".
 * Se muestra SIEMPRE en este prototipo: el cliente tiene que ver en todo momento
 * que los datos son sintéticos. No es dismissable (es parte del producto demo).
 */
export function BannerDemo() {
  return (
    <div
      role="status"
      aria-label="Aviso de demo"
      className="flex items-center justify-center gap-2 border-b border-amber-300/60 bg-amber-100 px-4 py-1.5 text-xs font-medium text-amber-900"
    >
      <FlaskConicalIcon
        className="size-3.5 shrink-0"
        strokeWidth={1.75}
        aria-hidden
      />
      <span>
        <strong className="font-semibold uppercase tracking-wider">DEMO</strong>
        {" — "}Datos sintéticos. Esta instancia no procesa pagos reales.
      </span>
    </div>
  );
}
