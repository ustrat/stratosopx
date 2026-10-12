"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { sections } from "@/lib/sections";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="sidebar-nav">
      {sections.map((s) => {
        const href = s.slug ? `/dashboard/${s.slug}` : "/dashboard";
        const active = s.slug ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;
        return (
          <Link key={href} href={href} className="sidebar-link" aria-current={active ? "page" : undefined}>
            <Icon name={s.icon} />
            {s.label}
            {s.count !== undefined && <span className="pill pill-count count tone-warning">{s.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
