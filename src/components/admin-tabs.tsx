"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Pilotage" },
  { href: "/admin/utilisateurs", label: "Familles" },
  { href: "/admin/import", label: "Historique" },
  { href: "/admin/journal", label: "Journal d'audit" },
];

/** Sous-navigation de l'administration (spec section 8). */
export function AdminTabs() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors",
            isActive(t.href)
              ? "border-foreground text-foreground font-medium"
              : "text-muted-foreground hover:text-foreground border-transparent",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
