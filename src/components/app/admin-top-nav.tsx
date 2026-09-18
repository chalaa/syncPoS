"use client";

import { ChevronDownIcon, LogOutIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { logout } from "@/app/login/actions";
import { filterAdminMenuItems } from "@/components/app/admin-navigation";
import type { AdminSubMenuItem } from "@/components/app/types";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { useTranslation } from "@/lib/i18n/use-translation";
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
  t: (key: string, fallback?: string) => string,
) {
  for (const item of items) {
    if (currentHref === item.href) {
      return t(item.label, item.label);
    }

    const activeChild = item.children?.find((child) => {
      if (currentHref === child.href) {
        return true;
      }

      const childPath = hrefPath(child.href);

      return !child.href.includes("?") && pathname.startsWith(`${childPath}/`);
    });

    if (activeChild) {
      return `${t(item.label, item.label)} / ${t(activeChild.label, activeChild.label)}`;
    }
  }

  return items[0] ? t(items[0].label, items[0].label) : t("nav.menu", "Menu");
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
  const { t } = useTranslation();
  const activeMenuLabel = activeMenu ? t(`nav.${activeMenu.key}`, activeMenu.label) : t("nav.menu", "Menu");
  const activeSubmenuLabel = activeMenu
    ? getActiveSubmenuLabel(activeMenu.submenus, currentHref, pathname, t)
    : t("nav.menu", "Menu");

  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(useAppStore.persist.hasHydrated());
    const unsub = useAppStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });
    return () => {
      unsub();
    };
  }, []);

  const mobileDetailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function handleClickOutside(event: Event) {
      if (
        mobileDetailsRef.current &&
        mobileDetailsRef.current.open &&
        !mobileDetailsRef.current.contains(event.target as Node)
      ) {
        mobileDetailsRef.current.open = false;
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (mobileDetailsRef.current) {
      mobileDetailsRef.current.open = false;
    }
    if (window.matchMedia("(max-width: 767px)").matches) {
      setAdminNavOpen(false);
    }
  }, [pathname, currentHref, setAdminNavOpen]);

  useEffect(() => {
    if (!isHydrated) return;

    if (!shopLocations.length) {
      if (selectedLocationId) {
        setSelectedLocationId(null);
      }
      return;
    }

    let activeId = selectedLocationId;

    if (!activeId && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("syncpos-selected-location");
        if (stored && shopLocations.some((shop) => shop.id === stored)) {
          activeId = stored;
          setSelectedLocationId(stored);
          return;
        }
      } catch {}
    }

    const selectedShopIsAvailable = shopLocations.some((shop) => shop.id === activeId);

    if (!selectedShopIsAvailable) {
      const defaultId = shopLocations[0]?.id ?? null;
      setSelectedLocationId(defaultId);
      if (typeof window !== "undefined" && defaultId) {
        try {
          localStorage.setItem("syncpos-selected-location", defaultId);
        } catch {}
      }
    }
  }, [isHydrated, selectedLocationId, setSelectedLocationId, shopLocations]);

  function closeMobileSubmenu(event: MouseEvent<HTMLAnchorElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

  return (
    <div className="flex h-dvh items-stretch overflow-hidden bg-background text-foreground">
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
          "fixed inset-y-0 left-0 z-50 flex h-dvh flex-col border-r border-border bg-card text-card-foreground transition-[transform,width] md:sticky md:top-0 md:z-40 md:self-stretch",
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
              "flex items-center gap-2 truncate text-base font-bold tracking-tight text-foreground",
              !adminNavOpen && "sr-only",
            )}
          >
            <span className="size-2.5 rounded-full bg-gold inline-block shrink-0 shadow-xs" />
            <span>Mesud Machinery</span>
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {adminMenuItems.map((item) => {
            const isActive = activeMenu.key === item.key && activeMenu.label === item.label;
            const itemLabel = t(`nav.${item.key}`, item.label);

            return (
              <Button
                key={`${item.key}-${item.label}`}
                asChild
                variant={isActive ? "secondary" : "ghost"}
                className={cn(
                  "justify-start transition-all",
                  !adminNavOpen && "justify-center px-0",
                  isActive && "bg-secondary text-secondary-foreground font-semibold border-l-3 border-primary shadow-xs",
                )}
              >
                <Link href={item.submenus[0]?.href ?? item.href} title={itemLabel}>
                  <item.icon data-icon="inline-start" />
                  <span className={cn("truncate", !adminNavOpen && "sr-only")}>
                    {itemLabel}
                  </span>
                </Link>
              </Button>
            );
          })}
        </nav>

        <form action={logout} className="border-t border-border p-3 md:hidden">
          <div className="mb-3 flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-2 rounded-full", syncStatus === "online" ? "bg-primary" : "bg-gold animate-pulse")} />
              <span className="capitalize">{t(`status.${syncStatus}`, syncStatus)}</span>
            </span>
            <span className="truncate text-xs font-medium text-foreground">{username}</span>
          </div>
          <Button variant="outline" size="sm" className="w-full justify-center">
            <LogOutIcon data-icon="inline-start" />
            {t("user.signOut")}
          </Button>
        </form>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-3 text-sm text-card-foreground sm:gap-3 sm:px-6">
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
            <details ref={mobileDetailsRef} className="group">
              <summary className="flex h-9 min-w-0 cursor-pointer list-none items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                <span className="truncate">
                  {activeMenuLabel}
                  <span className="mx-2 text-muted-foreground">/</span>
                  <span className="font-medium text-muted-foreground">{activeSubmenuLabel}</span>
                </span>
                <ChevronDownIcon className="size-4 shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md">
                {activeMenu?.submenus.map((item) => {
                  const isActive = isSubmenuActive(item, currentHref, pathname);
                  const translatedLabel = t(item.label, item.label);

                  return (
                    <div key={item.href}>
                      {item.children?.length ? (
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/80 hover:text-foreground focus:bg-secondary/80 focus:outline-none",
                            isActive && "bg-primary/10 font-semibold text-primary",
                          )}
                          onClick={() =>
                            setMobileOpenSubmenuHref((current) => (current === item.href ? null : item.href))
                          }
                        >
                          <span>{translatedLabel}</span>
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
                            "block rounded-sm px-3 py-2 text-sm transition-colors hover:bg-secondary/80 hover:text-foreground focus:bg-secondary/80 focus:outline-none",
                            isActive && "bg-primary/10 font-semibold text-primary",
                          )}
                        >
                          {translatedLabel}
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
                                  "block rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground focus:bg-secondary/80 focus:outline-none",
                                  isChildActive && "bg-primary/10 font-semibold text-primary",
                                )}
                              >
                                {t(child.label, child.label)}
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
                <span className="shrink-0 font-semibold">{t(`nav.${activeMenu.key}`, activeMenu.label)}</span>
                <span className="text-muted-foreground">/</span>
              </>
            ) : null}
            {activeMenu?.submenus.map((item) => {
              const isActive = isSubmenuActive(item, currentHref, pathname);
              const translatedLabel = t(item.label, item.label);

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
                      {translatedLabel}
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
                                "block rounded-sm px-3 py-2 text-sm transition-colors hover:bg-secondary/80 hover:text-foreground focus:bg-secondary/80 focus:outline-none",
                                isChildActive && "bg-primary/10 font-semibold text-primary",
                              )}
                              role="menuitem"
                            >
                              {t(child.label, child.label)}
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
                  <Link href={item.href}>{translatedLabel}</Link>
                </Button>
              );
            })}
          </nav>

          <div className="shrink-0 flex items-center gap-2">
            <ShopSelector
              locations={shopLocations}
              selectedLocationId={selectedLocationId}
              onChange={setSelectedLocationId}
            />
            <LanguageSwitcher />
          </div>

          <form action={logout} className="hidden shrink-0 items-center gap-3 md:flex">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground">
              <span className={cn("size-2 rounded-full", syncStatus === "online" ? "bg-primary" : "bg-gold animate-pulse")} />
              <span className="capitalize">{t(`status.${syncStatus}`, syncStatus)}</span>
            </span>
            <span className="text-xs font-medium text-foreground">{username}</span>
            <Button variant="outline" size="sm" aria-label={t("user.signOut")}>
              <LogOutIcon data-icon="inline-start" />
              {t("user.signOut")}
            </Button>
          </form>
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</div>
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
  const { t } = useTranslation();

  if (locations.length === 0) {
    return null;
  }

  function handleSelect(nextValue: string) {
    const nextId = nextValue || null;
    onChange(nextId);
    if (typeof window !== "undefined") {
      try {
        if (nextId) {
          localStorage.setItem("syncpos-selected-location", nextId);
        } else {
          localStorage.removeItem("syncpos-selected-location");
        }
      } catch {}
    }
  }

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <span className="hidden xl:inline">{t("shop.label")}</span>
      <select
        aria-label={t("shop.defaultSelect")}
        value={selectedLocationId ?? locations[0]?.id ?? ""}
        onChange={(event) => handleSelect(event.target.value)}
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
