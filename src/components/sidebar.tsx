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
    // Sección "Operación": un sub-link por tenant (cargas + historial).
    // Cuando agreguemos retiros/pagos, se suman acá.
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