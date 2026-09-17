"use client";

import { Package, Layers, ShieldCheck, Tag } from "lucide-react";
import type { ProductListItem } from "./product-list-table";

export function ProductKpiCards({
  products,
  categoriesCount,
  brandsCount,
}: {
  products: ProductListItem[];
  categoriesCount: number;
  brandsCount: number;
}) {
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
      {/* Mobile View: Compact Micro-Metric Bar (sm:hidden) */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-1 no-scrollbar touch-pan-x snap-x snap-mandatory sm:hidden">
        {/* 1. Total Catalog Items */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-emerald-500/20 bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
            <Package className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Catalog</div>
            <div className="font-mono text-xs font-bold text-foreground">
              {totalCount} <span className="text-[10px] font-normal text-emerald-600">({activeCount} active)</span>
            </div>
          </div>
        </div>

        {/* 2. Taxonomy Coverage */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
            <Layers className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Categories</div>
            <div className="font-mono text-xs font-bold text-foreground">
              {categoriesCount} <span className="text-[10px] font-normal text-muted-foreground">({brandsCount} brands)</span>
            </div>
          </div>
        </div>

        {/* 3. Tracked Items */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
            <ShieldCheck className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tracked</div>
            <div className="font-mono text-xs font-bold text-foreground">{trackedCount} SKUs</div>
          </div>
        </div>

        {/* 4. Avg Catalog List Price */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
            <Tag className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Avg Price</div>
            <div className="font-mono text-xs font-bold text-foreground">{formattedAvgPrice}</div>
          </div>
        </div>
      </div>

      {/* Desktop/Tablet View (hidden on mobile) */}
      <div className="hidden mb-6 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
        {/* 1. Total Catalog Items */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Catalog Items
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
              <Package className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {totalCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">Products</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{activeCount} active</span> in catalog
            </p>
          </div>
          <div className="pointer-events-none absolute -bottom-6 -right-6 size-20 rounded-full bg-emerald-500/5 blur-xl" />
        </div>

        {/* 2. Taxonomy Coverage */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-blue-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Taxonomy & Brands
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400">
              <Layers className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {categoriesCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">Categories</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              Across <span className="font-semibold text-foreground">{brandsCount} distinct brands</span>
            </p>
          </div>
        </div>

        {/* 3. Tracked Items */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tracked SKUs
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
              <ShieldCheck className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {trackedCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">Serial / Lot</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              Strict tracking enabled
            </p>
          </div>
        </div>

        {/* 4. Avg Catalog List Price */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Avg Catalog Price
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
              <Tag className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {formattedAvgPrice}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              Average list price
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
