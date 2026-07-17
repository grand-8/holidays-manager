"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, LogOut, Palmtree, Mail } from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";

export type NavUser = {
  nomAffiche: string;
  email: string;
  isAdmin: boolean;
};

const BASE_TABS = [
  { href: "/tableau-de-bord", label: "Tableau de bord" },
  { href: "/preferences", label: "Préférences" },
  { href: "/vote", label: "Vote" },
  { href: "/historique", label: "Historique" },
];

/** Coque applicative : barre de navigation persistante (spec section 8). */
export function AppShell({
  user,
  children,
}: {
  user: NavUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tabs = user?.isAdmin
    ? [...BASE_TABS, { href: "/admin", label: "Admin" }]
    : BASE_TABS;

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <header className="bg-background/85 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link
            href="/tableau-de-bord"
            className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
          >
            <span className="bg-foreground text-background grid size-7 place-items-center rounded-md">
              <Palmtree className="size-4" />
            </span>
            <span className="hidden sm:inline">holidays</span>
          </Link>

          {user && (
            <nav className="flex flex-1 items-center gap-0.5 overflow-x-auto">
              {tabs.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className={cn(
                    "hover:bg-accent hover:text-foreground relative shrink-0 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    isActive(t.href)
                      ? "text-foreground font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  {t.label}
                  {isActive(t.href) && (
                    <span className="bg-foreground absolute inset-x-2.5 -bottom-[9px] h-0.5 rounded-full" />
                  )}
                </Link>
              ))}
            </nav>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            {user && <UserMenu user={user} />}
          </div>
        </div>
      </header>
      {children}
    </>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Icônes basculées en CSS (via la classe .dark) pour éviter tout décalage
  // d'hydratation sans passer par un état monté.
  return (
    <button
      type="button"
      aria-label="Basculer le thème"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="border-border bg-card text-muted-foreground hover:text-foreground hover:border-input grid size-8 place-items-center rounded-md border"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}

function UserMenu({ user }: { user: NavUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  const initials = user.nomAffiche.trim().slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border-border bg-card hover:border-input flex items-center gap-2 rounded-md border py-1 pr-2 pl-1 text-sm"
      >
        <span className="bg-foreground text-background grid size-6 place-items-center rounded-[5px] text-[11px] font-semibold">
          {initials}
        </span>
        <span className="hidden max-w-28 truncate sm:inline">
          {user.nomAffiche}
        </span>
      </button>
      {open && (
        <div className="bg-popover absolute right-0 top-11 w-60 rounded-xl border p-1.5 shadow-lg">
          <div className="text-muted-foreground border-b px-2.5 py-2 text-xs">
            {user.email}
          </div>
          <Link
            href="/compte"
            onClick={() => setOpen(false)}
            className="hover:bg-accent mt-1 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm"
          >
            <Mail className="size-4" />
            Modifier mon e-mail
          </Link>
          <form action={logout} className="mt-0.5">
            <button
              type="submit"
              className="text-destructive hover:bg-accent flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm"
            >
              <LogOut className="size-4" />
              Se déconnecter
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
