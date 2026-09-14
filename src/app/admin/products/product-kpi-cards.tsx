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
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Catalog Items */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Catalog Items
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
            <Package className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
            {totalCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">Products</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{activeCount} active</span> in catalog
          </p>
        </div>
        <div className="absolute -bottom-6 -right-6 size-24 rounded-full bg-emerald-500/5 blur-xl pointer-events-none" />
      </div>

      {/* 2. Taxonomy Coverage */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-blue-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Taxonomy & Brands
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
            <Layers className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
            {categoriesCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">Categories</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Across <span className="font-semibold text-foreground">{brandsCount} distinct brands</span>
          </p>
        </div>
      </div>

      {/* 3. Tracked Items */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Tracked SKUs
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
            <ShieldCheck className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
            {trackedCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">Serial / Lot SKUs</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Strict serial or lot tracking enabled
          </p>
        </div>
      </div>

      {/* 4. Avg Catalog List Price */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Avg Catalog Price
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
            <Tag className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            {formattedAvgPrice}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Average standard list price
          </p>
        </div>
      </div>
    </div>
  );
}
