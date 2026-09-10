"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const inventoryTabs = [
  { label: "Stock Overview", href: "/admin/inventory" },
  { label: "Operations & Transfers", href: "/admin/inventory/operations" },
  { label: "Stock Card", href: "/admin/inventory/stock-card" },
  { label: "Serial History", href: "/admin/inventory/serial-history" },
  { label: "Locations", href: "/admin/inventory/locations" },
  { label: "Opening Stock", href: "/admin/inventory/opening-stock" },
];

export function InventoryNavTabs({ currentHref }: { currentHref?: string }) {
  const pathname = usePathname();
  const activeHref = currentHref ?? pathname;

  return (
    <nav className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-border pb-px">
      {inventoryTabs.map((tab) => {
        const isActive = activeHref === tab.href || (tab.href !== "/admin/inventory" && activeHref.startsWith(tab.href));

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {isActive ? (
              <span className="size-1.5 rounded-full bg-gold inline-block" />
            ) : null}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
