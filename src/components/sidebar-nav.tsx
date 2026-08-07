"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { HomeIcon, ShieldCheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SidebarItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface SidebarSection {
  label: string;
  items: SidebarItem[];
}

export interface SidebarNavProps {
  sections: SidebarSection[];
  className?: string;
}

export function SidebarNav({ sections, className }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav
      data-slot="sidebar-nav"
      aria-label="Navegación principal"
      className={cn("flex flex-col gap-5 p-4", className)}
    >
      {sections.map((section) => (
        <SidebarSectionView
          key={section.label}
          section={section}
          pathname={pathname}
        />
      ))}
    </nav>
  );
}

function SidebarSectionView({
  section,
  pathname,
}: {
  section: SidebarSection;
  pathname: string;
}) {
  return (
    <div data-slot="sidebar-section" className="flex flex-col gap-1">
      <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
        {section.label}
      </p>
      {section.items.map((item) => (
        <SidebarItemView
          key={item.href}
          item={item}
          isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
        />
      ))}
    </div>
  );
}

function SidebarItemView({
  item,
  isActive,
}: {
  item: SidebarItem;
  isActive: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      data-slot="sidebar-item"
      data-active={isActive}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group/sidebar-item relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-primary/8 text-primary font-medium"
          : "text-foreground/80 hover:bg-sunken hover:text-foreground",
      )}
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full bg-primary"
        />
      )}
      <Icon
        strokeWidth={isActive ? 2 : 1.75}
        className="size-4 shrink-0"
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export const SIDEBAR_ICONS = {
  HomeIcon,
  ShieldCheckIcon,
} as const;