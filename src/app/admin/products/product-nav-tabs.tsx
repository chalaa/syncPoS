"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const productTabs = [
  { label: "Products Catalog", href: "/admin/products" },
  { label: "Categories", href: "/admin/products/categories" },
  { label: "Brands", href: "/admin/products/brands" },
  { label: "Units", href: "/admin/products/units" },
  { label: "Taxes", href: "/admin/products/taxes" },
  { label: "Price Lists", href: "/admin/products/price-lists" },
  { label: "Lots / Serials", href: "/admin/products/tracking" },
];

export function ProductNavTabs({ currentHref }: { currentHref?: string }) {
  const pathname = usePathname();
  const activeHref = currentHref ?? pathname;

  return (
    <nav className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-border pb-px">
      {productTabs.map((tab) => {
        const isActive = activeHref === tab.href;

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
