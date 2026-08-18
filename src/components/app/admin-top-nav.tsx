"use client";

import { LogOutIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { logout } from "@/app/login/actions";
import { adminMenuItems } from "@/components/app/admin-navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

function getActiveMenu(pathname: string) {
  const matchingItems = adminMenuItems.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return matchingItems.toSorted((a, b) => b.href.length - a.href.length)[0] ?? adminMenuItems[0];
}

export function AdminShell({ username, children }: { username: string; children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const adminNavOpen = useAppStore((state) => state.adminNavOpen);
  const toggleAdminNav = useAppStore((state) => state.toggleAdminNav);
  const syncStatus = useAppStore((state) => state.syncStatus);
  const activeMenu = getActiveMenu(pathname);
  const queryString = searchParams.toString();
  const currentHref = queryString ? `${pathname}?${queryString}` : pathname;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "border-r border-border bg-card text-card-foreground transition-[width]",
          adminNavOpen ? "w-64" : "w-20",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Toggle main menu"
            onClick={toggleAdminNav}
          >
            <MenuIcon />
          </Button>
          <Link
            href="/"
            className={cn(
              "truncate text-base font-semibold",
              !adminNavOpen && "sr-only",
            )}
          >
            syncPoS
          </Link>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {adminMenuItems.map((item) => {
            const isActive = activeMenu.key === item.key && activeMenu.label === item.label;

            return (
              <Button
                key={`${item.key}-${item.label}`}
                asChild
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "justify-start",
                  !adminNavOpen && "justify-center px-0",
                )}
              >
                <Link href={item.href} title={item.label}>
                  <item.icon data-icon="inline-start" />
                  <span className={cn("truncate", !adminNavOpen && "sr-only")}>
                    {item.label}
                  </span>
                </Link>
              </Button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-6 py-3 text-sm text-card-foreground">
          <nav className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            <span className="shrink-0 font-semibold">{activeMenu.label}</span>
            <span className="text-muted-foreground">/</span>
            {activeMenu.submenus.map((item) => {
              const isActive = currentHref === item.href;

              return (
                <Button
                  key={item.href}
                  asChild
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              );
            })}
          </nav>

          <form action={logout} className="flex items-center gap-3">
            <span className="hidden text-muted-foreground sm:inline">
              {syncStatus}
            </span>
            <span className="text-muted-foreground">{username}</span>
            <Button variant="outline" size="sm">
              <LogOutIcon data-icon="inline-start" />
              Sign out
            </Button>
          </form>
        </header>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
