"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils";

const productTabs = [
  { key: "Products Catalog", label: "Products Catalog", href: "/admin/products" },
  { key: "Categories", label: "Categories", href: "/admin/products/categories" },
  { key: "Brands", label: "Brands", href: "/admin/products/brands" },
  { key: "Units", label: "Units", href: "/admin/products/units" },
  { key: "Taxes", label: "Taxes", href: "/admin/products/taxes" },
  { key: "Price Lists", label: "Price Lists", href: "/admin/products/price-lists" },
  { key: "Lots / Serials", label: "Lots / Serials", href: "/admin/products/tracking" },
];

export function ProductNavTabs({ currentHref }: { currentHref?: string }) {
  const pathname = usePathname();
  const activeHref = currentHref ?? pathname;
  const { t } = useTranslation();

  return (
    <nav className="mb-6 flex items-center gap-1 overflow-x-auto no-scrollbar touch-pan-x border-b border-border pb-px">
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
            {t(tab.key, tab.label)}
          </Link>
        );
      })}
    </nav>
  );
}
