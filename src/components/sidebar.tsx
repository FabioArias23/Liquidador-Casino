import { auth, repos } from "@/lib/server";
import { listarTenants } from "@/application/tenants/listar-tenants";

export async function Sidebar() {
  const sesion = await auth().obtenerSesion();
  if (!sesion) return null;

  const r = await listarTenants(await repos(), sesion.userId);

  const items: { href: string; label: string; emoji: string }[] = [
    { href: "/", label: "Inicio", emoji: "🏠" },
  ];

  if (r.ok && r.data.esSuperadmin) {
    items.push({ href: "/superadmin/tenants", label: "Tenants", emoji: "🏢" });
  }

  if (r.ok && r.data.tenants.length > 0) {
    for (const t of r.data.tenants) {
      items.push({
        href: `/backoffice/${t.slug}`,
        label: t.nombre,
        emoji: "🎰",
      });
    }
  }

  return (
    <aside className="w-60 shrink-0 border-r bg-card/30">
      <nav className="flex flex-col gap-1 p-4">
        {items.map((it) => (
          <a
            key={it.href}
            href={it.href}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <span>{it.emoji}</span>
            <span>{it.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
}
