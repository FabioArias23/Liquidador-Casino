import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { FormCargaManual } from "./form-carga";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function NuevaCargaPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-1">
        <Link
          href={`/backoffice/${slug}/cargas`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" strokeWidth={1.75} />
          Volver a Cargas
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva carga manual</h1>
        <p className="text-sm text-muted-foreground">
          Registrá una carga del jugador. Quedará en estado{" "}
          <span className="font-mono text-xs">pending</span> hasta que la valides
          con comprobante.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card p-6">
        <FormCargaManual tenantSlug={slug} />
      </div>
    </div>
  );
}