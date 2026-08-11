import { headers } from "next/headers";

import { listarTenants } from "@/application/tenants/listar-tenants";
import { auth, repos } from "@/lib/server";

import { SidebarNav, type SidebarSection } from "./sidebar-nav";

export async function Sidebar() {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return null;

  const r = await listarTenants(await repos(), sesion.userId);
  if (!r.ok) return null;
  const { tenants, esSuperadmin } = r.data;

  // El middleware (src/middleware.ts) setea `x-tenant-slug` cuando la URL
  // está adentro de /backoffice/[slug]/*. Si no, no hay tenant activo.
  const h = await headers();
  const activeSlug = h.get("x-tenant-slug") ?? null;
  const activeTenant = activeSlug
    ? tenants.find((t) => t.slug === activeSlug) ?? null
    : null;

  const sections: SidebarSection[] = [];

  // ── Navegación ──────────────────────────────────────────────────────────
  const navItems: SidebarSection["items"] = [
    { href: "/", label: "Inicio", iconKey: "building" },
  ];
  if (activeTenant) {
    navItems.push({
      href: `/backoffice/${activeTenant.slug}`,
      label: `Inicio · ${activeTenant.nombre}`,
      iconKey: "ticket",
      exactMatch: true,
    });
  }
  sections.push({ label: "Navegación", items: navItems });

  // ── Tenants (solo si NO hay tenant activo) ───────────────────────────────
  if (!activeTenant) {
    if (tenants.length > 0) {
      sections.push({
        label: "Tus accesos",
        items: tenants.map((t) => ({
          href: `/backoffice/${t.slug}`,
          label: t.nombre,
          iconKey: "ticket" as const,
        })),
      });
    }
  } else {
    // ── Operación (del tenant activo) ────────────────────────────────────
    sections.push({
      label: "Operación",
      items: [
        {
          href: `/backoffice/${activeTenant.slug}/cargas`,
          label: "Cargas",
          iconKey: "ticket" as const,
        },
        {
          href: `/backoffice/${activeTenant.slug}/retiros`,
          label: "Retiros",
          iconKey: "banknote" as const,
        },
        {
          href: `/backoffice/${activeTenant.slug}/historial`,
          label: "Historial",
          iconKey: "history" as const,
        },
      ],
    });

    // ── Administración (del tenant activo) ──────────────────────────────
    // El chequeo fino de permiso se hace en cada page.
    sections.push({
      label: "Administración",
      items: [
        {
          href: `/backoffice/${activeTenant.slug}/miembros`,
          label: "Miembros",
          iconKey: "users" as const,
        },
        {
          href: `/backoffice/${activeTenant.slug}/cbu`,
          label: "CBU",
          iconKey: "bank" as const,
        },
        {
          href: `/backoffice/${activeTenant.slug}/casino`,
          label: "Casino",
          iconKey: "plug" as const,
        },
      ],
    });
  }

  if (esSuperadmin) {
    sections.push({
      label: "Plataforma",
      items: [
        { href: "/superadmin/tenants", label: "Tenants", iconKey: "ticket" },
      ],
    });
  }

  return (
    <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
      <SidebarNav sections={sections} />
    </aside>
  );
}
