"use client";

import { ChevronDownIcon, LogOutIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { logout } from "@/app/login/actions";
import { filterAdminMenuItems } from "@/components/app/admin-navigation";
import type { AdminSubMenuItem } from "@/components/app/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";

function getActiveMenu(pathname: string, menuItems: ReturnType<typeof filterAdminMenuItems>) {
  const matchingItems = menuItems.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return matchingItems.toSorted((a, b) => b.href.length - a.href.length)[0] ?? menuItems[0];
}

function hrefPath(href: string) {
  return href.split("?")[0] ?? href;
}

function isSubmenuActive(item: AdminSubMenuItem, currentHref: string, pathname: string) {
  if (currentHref === item.href) {
    return true;
  }

  return (
    item.children?.some((child) => {
      if (currentHref === child.href) {
        return true;
      }

      const childPath = hrefPath(child.href);

      return !child.href.includes("?") && pathname.startsWith(`${childPath}/`);
    }) ?? false
  );
}

export function AdminShell({
  username,
  permissionCodes,
  children,
}: {
  username: string;
  permissionCodes: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const adminNavOpen = useAppStore((state) => state.adminNavOpen);
  const toggleAdminNav = useAppStore((state) => state.toggleAdminNav);
  const syncStatus = useAppStore((state) => state.syncStatus);
  const adminMenuItems = filterAdminMenuItems(permissionCodes);
  const activeMenu = getActiveMenu(pathname, adminMenuItems);
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
                <Link href={item.submenus[0]?.href ?? item.href} title={item.label}>
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
          <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {activeMenu ? (
              <>
                <span className="shrink-0 font-semibold">{activeMenu.label}</span>
                <span className="text-muted-foreground">/</span>
              </>
            ) : null}
            {activeMenu?.submenus.map((item) => {
              const isActive = isSubmenuActive(item, currentHref, pathname);

              if (item.children?.length) {
                return (
                  <div key={item.href} className="group relative">
                    <Button
                      asChild
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                    >
                      <Link href={item.href} aria-haspopup="menu">
                        {item.label}
                        <ChevronDownIcon data-icon="inline-end" />
                      </Link>
                    </Button>
                    <div className="invisible absolute left-0 top-full z-50 min-w-48 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                      <div className="rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                        {item.children.map((child) => {
                          const childPath = hrefPath(child.href);
                          const isChildActive =
                            currentHref === child.href ||
                            (!child.href.includes("?") && pathname.startsWith(`${childPath}/`));

                          return (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                "block rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none",
                                isChildActive && "bg-accent text-accent-foreground",
                              )}
                              role="menuitem"
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }

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
