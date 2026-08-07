import { listarTenants } from "@/application/tenants/listar-tenants";
import { auth, repos } from "@/lib/server";

import { SidebarNav, type SidebarSection } from "./sidebar-nav";

export async function Sidebar() {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return null;

  const r = await listarTenants(await repos(), sesion.userId);
  if (!r.ok) return null;
  const { tenants, esSuperadmin } = r.data;

  const sections: SidebarSection[] = [
    {
      label: "Navegación",
      items: [{ href: "/", label: "Inicio", iconKey: "building" }],
    },
  ];

  if (tenants.length > 0) {
    const operacionItems = tenants.flatMap((t) => [
      {
        href: `/backoffice/${t.slug}/cargas`,
        label: `Cargas · ${t.nombre}`,
        iconKey: "ticket" as const,
      },
      {
        href: `/backoffice/${t.slug}/historial`,
        label: `Historial · ${t.nombre}`,
        iconKey: "history" as const,
      },
    ]);
    sections.push({ label: "Operación", items: operacionItems });

    // Administración: visible solo si el usuario es tenant_admin de algún tenant.
    // Hoy asumimos que si tiene acceso al tenant, ve el bloque (chequeo fino en cada página).
    const adminItems = tenants.flatMap((t) => [
      {
        href: `/backoffice/${t.slug}/miembros`,
        label: `Miembros · ${t.nombre}`,
        iconKey: "users" as const,
      },
      {
        href: `/backoffice/${t.slug}/cbu`,
        label: `CBU · ${t.nombre}`,
        iconKey: "bank" as const,
      },
      {
        href: `/backoffice/${t.slug}/casino`,
        label: `Casino · ${t.nombre}`,
        iconKey: "plug" as const,
      },
    ]);
    sections.push({ label: "Administración", items: adminItems });
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