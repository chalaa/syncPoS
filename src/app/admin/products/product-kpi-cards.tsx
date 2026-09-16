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
    <div className="-mx-4 mb-6 flex gap-2.5 overflow-x-auto px-4 pb-2 pt-0.5 no-scrollbar snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 sm:pb-0 lg:grid-cols-4">
      {/* 1. Total Catalog Items */}
      <div className="relative flex w-[75vw] min-w-[210px] max-w-[260px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-3.5 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            Catalog Items
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400 sm:size-8">
            <Package className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="font-mono text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
            {totalCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">Products</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate sm:text-xs">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{activeCount} active</span> in catalog
          </p>
        </div>
        <div className="pointer-events-none absolute -bottom-6 -right-6 size-20 rounded-full bg-emerald-500/5 blur-xl" />
      </div>

      {/* 2. Taxonomy Coverage */}
      <div className="relative flex w-[75vw] min-w-[210px] max-w-[260px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all hover:border-blue-500/40 hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            Taxonomy & Brands
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400 sm:size-8">
            <Layers className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="font-mono text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
            {categoriesCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">Categories</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate sm:text-xs">
            Across <span className="font-semibold text-foreground">{brandsCount} distinct brands</span>
          </p>
        </div>
      </div>

      {/* 3. Tracked Items */}
      <div className="relative flex w-[75vw] min-w-[210px] max-w-[260px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            Tracked SKUs
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400 sm:size-8">
            <ShieldCheck className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="font-mono text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
            {trackedCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">Serial / Lot</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate sm:text-xs">
            Strict tracking enabled
          </p>
        </div>
      </div>

      {/* 4. Avg Catalog List Price */}
      <div className="relative flex w-[75vw] min-w-[210px] max-w-[260px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            Avg Catalog Price
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400 sm:size-8">
            <Tag className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="font-mono text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
            {formattedAvgPrice}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate sm:text-xs">
            Average list price
          </p>
        </div>
      </div>
    </div>
  );
}
