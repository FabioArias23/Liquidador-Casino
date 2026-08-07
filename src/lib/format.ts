/**
 * Helpers de formato para UI.
 * - formatCentavos: wrapper sobre `formatear()` de money.ts (mantiene una sola fuente)
 * - formatRelativeTime: tiempo relativo en es-AR ("hace 3 minutos")
 */

import { formatear } from "@/domain/money";

export function formatCentavos(monto: number, moneda = "ARS"): string {
  return formatear(monto, moneda);
}

const NOW_THRESHOLDS = [
  { ms: 60_000, divisor: 1_000, suffix: "ahora" },
  { ms: 3_600_000, divisor: 60_000, suffix: "minuto" },
  { ms: 86_400_000, divisor: 3_600_000, suffix: "hora" },
  { ms: 604_800_000, divisor: 86_400_000, suffix: "día" },
] as const;

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < 0) return "recién";
  if (diff < 60_000) return "hace segundos";

  for (const t of NOW_THRESHOLDS) {
    if (diff < t.ms) {
      const n = Math.floor(diff / t.divisor);
      const plural = n === 1 ? "" : "s";
      return `hace ${n} ${t.suffix}${plural}`;
    }
  }
  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `hace ${days} día${days === 1 ? "" : "s"}`;

  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}