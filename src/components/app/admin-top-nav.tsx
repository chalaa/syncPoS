"use client";

import { ChevronDownIcon, LogOutIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

import { logout } from "@/app/login/actions";
import { filterAdminMenuItems } from "@/components/app/admin-navigation";
import type { AdminSubMenuItem } from "@/components/app/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ShopOption } from "@/server/locations/shop-options";
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

function getActiveSubmenuLabel(
  items: AdminSubMenuItem[],
  currentHref: string,
  pathname: string,
) {
  for (const item of items) {
    if (currentHref === item.href) {
      return item.label;
    }

    const activeChild = item.children?.find((child) => {
      if (currentHref === child.href) {
        return true;
      }

      const childPath = hrefPath(child.href);

      return !child.href.includes("?") && pathname.startsWith(`${childPath}/`);
    });

    if (activeChild) {
      return `${item.label} / ${activeChild.label}`;
    }
  }

  return items[0]?.label ?? "Menu";
}

export function AdminShell({
  username,
  permissionCodes,
  shopLocations,
  children,
}: {
  username: string;
  permissionCodes: string[];
  shopLocations: ShopOption[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const adminNavOpen = useAppStore((state) => state.adminNavOpen);
  const setAdminNavOpen = useAppStore((state) => state.setAdminNavOpen);
  const toggleAdminNav = useAppStore((state) => state.toggleAdminNav);
  const selectedLocationId = useAppStore((state) => state.selectedLocationId);
  const setSelectedLocationId = useAppStore((state) => state.setSelectedLocationId);
  const syncStatus = useAppStore((state) => state.syncStatus);
  const [openSubmenuHref, setOpenSubmenuHref] = useState<string | null>(null);
  const [mobileOpenSubmenuHref, setMobileOpenSubmenuHref] = useState<string | null>(null);
  const adminMenuItems = filterAdminMenuItems(permissionCodes);
  const activeMenu = getActiveMenu(pathname, adminMenuItems);
  const queryString = searchParams.toString();
  const currentHref = queryString ? `${pathname}?${queryString}` : pathname;
  const activeSubmenuLabel = activeMenu
    ? getActiveSubmenuLabel(activeMenu.submenus, currentHref, pathname)
    : "Menu";

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setAdminNavOpen(false);
    }
  }, [pathname, setAdminNavOpen]);

  useEffect(() => {
    if (!shopLocations.length) {
      if (selectedLocationId) {
        setSelectedLocationId(null);
      }
      return;
    }

    const selectedShopIsAvailable = shopLocations.some((shop) => shop.id === selectedLocationId);

    if (!selectedShopIsAvailable) {
      setSelectedLocationId(shopLocations[0]?.id ?? null);
    }
  }, [selectedLocationId, setSelectedLocationId, shopLocations]);

  function closeMobileSubmenu(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

  return (
    <div className="flex min-h-screen items-stretch bg-background text-foreground">
      {adminNavOpen ? (
        <button
          type="button"
          aria-label="Close main menu"
          className="fixed inset-0 z-40 bg-foreground/20 md:hidden"
          onClick={toggleAdminNav}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh flex-col border-r border-border bg-card text-card-foreground transition-[transform,width] md:sticky md:top-0 md:z-auto md:h-auto md:min-h-screen md:self-stretch",
          adminNavOpen ? "w-64 translate-x-0" : "-translate-x-full md:w-20 md:translate-x-0",
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

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
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

        <form action={logout} className="border-t border-border p-3 md:hidden">
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{syncStatus}</span>
            <span className="truncate text-muted-foreground">{username}</span>
          </div>
          <Button variant="outline" size="sm" className="w-full justify-center">
            <LogOutIcon data-icon="inline-start" />
            Sign out
          </Button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center justify-between gap-2 border-b border-border bg-card px-3 py-3 text-sm text-card-foreground sm:gap-3 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Open main menu"
            className="md:hidden"
            onClick={toggleAdminNav}
          >
            <MenuIcon />
          </Button>

          <div className="relative min-w-0 flex-1 lg:hidden">
            <details className="group">
              <summary className="flex h-9 min-w-0 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span className="truncate">
                  {activeMenu?.label}
                  <span className="mx-2 text-muted-foreground">/</span>
                  <span className="font-medium text-muted-foreground">{activeSubmenuLabel}</span>
                </span>
                <ChevronDownIcon className="size-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                {activeMenu?.submenus.map((item) => {
                  const isActive = isSubmenuActive(item, currentHref, pathname);

                  return (
                    <div key={item.href}>
                      {item.children?.length ? (
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none",
                            isActive && "bg-accent text-accent-foreground",
                          )}
                          onClick={() =>
                            setMobileOpenSubmenuHref((current) => (current === item.href ? null : item.href))
                          }
                        >
                          <span>{item.label}</span>
                          <ChevronDownIcon
                            className={cn(
                              "size-4 transition-transform",
                              mobileOpenSubmenuHref === item.href && "rotate-180",
                            )}
                          />
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={closeMobileSubmenu}
                          className={cn(
                            "block rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none",
                            isActive && "bg-accent text-accent-foreground",
                          )}
                        >
                          {item.label}
                        </Link>
                      )}
                      {item.children?.length ? (
                        <div
                          className={cn(
                            "ml-3 border-l border-border pl-2",
                            mobileOpenSubmenuHref !== item.href && "hidden",
                          )}
                        >
                          {item.children.map((child) => {
                            const childPath = hrefPath(child.href);
                            const isChildActive =
                              currentHref === child.href ||
                              (!child.href.includes("?") && pathname.startsWith(`${childPath}/`));

                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                onClick={closeMobileSubmenu}
                                className={cn(
                                  "block rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none",
                                  isChildActive && "bg-accent text-accent-foreground",
                                )}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </details>
          </div>

          <nav className="hidden min-w-0 flex-1 items-center gap-2 overflow-visible whitespace-nowrap lg:flex">
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
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={openSubmenuHref === item.href}
                      onMouseEnter={() => setOpenSubmenuHref(item.href)}
                      onFocus={() => setOpenSubmenuHref(item.href)}
                      onClick={() =>
                        setOpenSubmenuHref((current) => (current === item.href ? null : item.href))
                      }
                    >
                      {item.label}
                      <ChevronDownIcon data-icon="inline-end" />
                    </Button>
                    <div
                      className={cn(
                        "absolute left-0 top-full z-50 min-w-48 pt-2 transition",
                        openSubmenuHref === item.href ? "visible opacity-100" : "invisible opacity-0",
                      )}
                      onMouseEnter={() => setOpenSubmenuHref(item.href)}
                      onMouseLeave={() => setOpenSubmenuHref(null)}
                    >
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
                              onClick={() => setOpenSubmenuHref(null)}
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

          <div className="shrink-0">
            <ShopSelector
              locations={shopLocations}
              selectedLocationId={selectedLocationId}
              onChange={setSelectedLocationId}
            />
          </div>

          <form action={logout} className="hidden shrink-0 items-center gap-3 md:flex">
            <span className="text-muted-foreground">
              {syncStatus}
            </span>
            <span className="text-muted-foreground">{username}</span>
            <Button variant="outline" size="sm" aria-label="Sign out">
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

function ShopSelector({
  locations,
  selectedLocationId,
  onChange,
}: {
  locations: ShopOption[];
  selectedLocationId: string | null;
  onChange: (locationId: string | null) => void;
}) {
  if (locations.length === 0) {
    return null;
  }

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span className="hidden xl:inline">Shop</span>
      <select
        aria-label="Default sales shop"
        value={selectedLocationId ?? locations[0]?.id ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-9 w-28 rounded-md border border-input bg-background px-2 text-xs text-foreground sm:w-40 lg:w-48"
      >
        {locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.code} / {location.name}
          </option>
        ))}
      </select>
    </label>
  );
}
