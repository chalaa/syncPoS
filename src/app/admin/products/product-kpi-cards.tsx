"use client";

import { Package, Layers, ShieldCheck, Tag } from "lucide-react";
import type { ProductListItem } from "./product-list-table";
import { useTranslation } from "@/lib/i18n/use-translation";

export function ProductKpiCards({
  products,
  categoriesCount,
  brandsCount,
}: {
  products: ProductListItem[];
  categoriesCount: number;
  brandsCount: number;
}) {
  const { t } = useTranslation();
  const totalCount = products.length;
  const activeCount = products.filter((p) => p.isActive && !p.deletedAt).length;
  const trackedCount = products.filter((p) => p.trackingMode && p.trackingMode !== "none").length;

  const validPrices = products
    .map((p) => p.listPriceMinor)
    .filter((price) => typeof price === "number" && price > 0);
  const avgPriceMinor = validPrices.length > 0
    ? validPrices.reduce((sum, val) => sum + val, 0) / validPrices.length
    : 0;

  const currencyCode = products[0]?.currencyCode || "ETB";
  const formattedAvgPrice = `${currencyCode} ${(avgPriceMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <>
    <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
      {/* 1. Total Catalog Items */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-3 sm:p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {t("kpi.catalogItems", "Catalog Items")}
          </span>
          <div className="flex size-6 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
            <Package className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-1.5 sm:mt-2 min-w-0">
          <p className="font-mono text-base sm:text-2xl font-extrabold tracking-tight text-foreground truncate">
            {totalCount}{" "}
            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">{t("kpi.products", "Products")}</span>
          </p>
          <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground truncate">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{activeCount} {t("kpi.active", "active")}</span> {t("kpi.inCatalog", "in catalog")}
          </p>
        </div>
        <div className="pointer-events-none absolute -bottom-6 -right-6 size-20 rounded-full bg-emerald-500/5 blur-xl" />
      </div>

      {/* 2. Taxonomy Coverage */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-xs transition-all hover:border-blue-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {t("kpi.taxonomyBrands", "Taxonomy & Brands")}
          </span>
          <div className="flex size-6 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400">
            <Layers className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-1.5 sm:mt-2 min-w-0">
          <p className="font-mono text-base sm:text-2xl font-extrabold tracking-tight text-foreground truncate">
            {categoriesCount}{" "}
            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">{t("kpi.categories", "Categories")}</span>
          </p>
          <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground truncate">
            {t("kpi.across", "Across")} <span className="font-semibold text-foreground">{brandsCount} {t("kpi.distinctBrands", "brands")}</span>
          </p>
        </div>
      </div>

      {/* 3. Tracked Items */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {t("kpi.trackedSkus", "Tracked SKUs")}
          </span>
          <div className="flex size-6 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
            <ShieldCheck className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-1.5 sm:mt-2 min-w-0">
          <p className="font-mono text-base sm:text-2xl font-extrabold tracking-tight text-foreground truncate">
            {trackedCount}{" "}
            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">{t("kpi.serialLot", "Serial / Lot")}</span>
          </p>
          <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground truncate">
            {t("kpi.strictTracking", "Strict tracking enabled")}
          </p>
        </div>
      </div>

      {/* 4. Avg Catalog List Price */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {t("kpi.avgPrice", "Avg Catalog Price")}
          </span>
          <div className="flex size-6 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
            <Tag className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-1.5 sm:mt-2 min-w-0">
          <p className="font-mono text-base sm:text-2xl font-extrabold tracking-tight text-foreground truncate">
            {formattedAvgPrice}
          </p>
          <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground truncate">
            {t("kpi.avgListPrice", "Average list price")}
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
