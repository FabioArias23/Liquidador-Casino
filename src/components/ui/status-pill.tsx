import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * StatusPill — el semáforo fijo del producto (DESIGN.md).
 * Cinco colores de operación, sin excepciones. Cualquier Carga/Retiro/Pago/Member
 * con un `estado` se muestra acá.
 */
const statusPillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider font-mono whitespace-nowrap transition-colors",
  {
    variants: {
      variant: {
        pending:
          "bg-status-pending-bg text-status-pending-fg",
        validating:
          "bg-status-validating-bg text-status-validating-fg",
        validated:
          "bg-status-validated-bg text-status-validated-fg",
        settled:
          "bg-status-settled-bg text-status-settled-fg",
        rejected:
          "bg-status-rejected-bg text-status-rejected-fg",
        neutral:
          "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface StatusPillProps
  extends Omit<React.ComponentProps<"span">, "children">,
    VariantProps<typeof statusPillVariants> {
  children: React.ReactNode;
}

function StatusPill({ className, variant, children, ...props }: StatusPillProps) {
  return (
    <span
      data-slot="status-pill"
      data-variant={variant}
      className={cn(statusPillVariants({ variant }), className)}
      {...props}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full bg-current opacity-80"
      />
      {children}
    </span>
  );
}

export { StatusPill, statusPillVariants };