import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * KpiCard — una métrica grande, label, delta opcional.
 * Estructura: label (uppercase xs) + value (mono, tabular-nums, semibold 2xl) + delta opcional.
 * - Si recibe `href`, renderiza como <a> clickeable.
 * - Si no, renderiza como <div>.
 */
export interface KpiCardProps {
  label: string;
  value: string;
  delta?: {
    value: string;
    direction: "up" | "down" | "flat";
  };
  icon?: LucideIcon;
  href?: string;
  className?: string;
}

const BASE_CLASSES =
  "group/kpi-card flex flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-colors";

function KpiCardBody({
  label,
  value,
  delta,
  icon: Icon,
}: Omit<KpiCardProps, "href" | "className">) {
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <Icon
            aria-hidden
            strokeWidth={1.75}
            className="size-4 text-muted-foreground/70"
          />
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "text-xs font-mono tabular-nums",
              delta.direction === "up" && "text-status-validated-fg",
              delta.direction === "down" && "text-status-rejected-fg",
              delta.direction === "flat" && "text-muted-foreground",
            )}
          >
            {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "■"}{" "}
            {delta.value}
          </span>
        )}
      </div>
    </>
  );
}

function KpiCard(props: KpiCardProps) {
  const { href, className, ...bodyProps } = props;

  if (href) {
    return (
      <a
        data-slot="kpi-card"
        href={href}
        className={cn(BASE_CLASSES, "hover:bg-sunken cursor-pointer", className)}
      >
        <KpiCardBody {...bodyProps} />
      </a>
    );
  }

  return (
    <div data-slot="kpi-card" className={cn(BASE_CLASSES, className)}>
      <KpiCardBody {...bodyProps} />
    </div>
  );
}

export { KpiCard };