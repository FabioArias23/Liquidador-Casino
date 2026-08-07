import {
  BuildingIcon,
  TicketIcon,
} from "lucide-react";

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
      items: [{ href: "/", label: "Inicio", icon: BuildingIcon }],
    },
  ];

  if (tenants.length > 0) {
    sections.push({
      label: "Operación",
      items: tenants.map((t) => ({
        href: `/backoffice/${t.slug}`,
        label: t.nombre,
        icon: TicketIcon,
      })),
    });
  }

  if (esSuperadmin) {
    sections.push({
      label: "Plataforma",
      items: [
        { href: "/superadmin/tenants", label: "Tenants", icon: TicketIcon },
      ],
    });
  }

  return (
    <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
      <SidebarNav sections={sections} />
    </aside>
  );
}