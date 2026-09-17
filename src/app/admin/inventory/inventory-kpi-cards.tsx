"use client";

import { AlertTriangle, Boxes, CheckCircle2, DollarSign, Lock, PackageCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import type { InventorySummaryMetrics } from "@/server/inventory/stock-types";

export function InventoryKpiCards({
  metrics,
  activeStatus,
}: {
  metrics: InventorySummaryMetrics;
  activeStatus?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleFilterClick(statusKey: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (params.get("status") === statusKey) {
      params.delete("status");
    } else {
      params.set("status", statusKey);
    }
    router.push(`/admin/inventory?${params.toString()}`);
  }

  const formattedValuation = `${metrics.currencyCode} ${(metrics.totalValuationMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <>
      {/* Mobile View: Compact Micro-Metric Bar (sm:hidden) */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-1 no-scrollbar touch-pan-x snap-x snap-mandatory sm:hidden">
        {/* 1. Total Valuation */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-emerald-500/20 bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
            <DollarSign className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Valuation</div>
            <div className="font-mono text-xs font-bold text-foreground">{formattedValuation}</div>
          </div>
        </div>

        {/* 2. Active SKUs In Stock */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
            <PackageCheck className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">In Stock</div>
            <div className="font-mono text-xs font-bold text-foreground">{metrics.totalSkusOnHand} SKUs</div>
          </div>
        </div>

        {/* 3. Low & Out of Stock Alerts */}
        <div
          onClick={() => handleFilterClick("low_stock")}
          role="button"
          tabIndex={0}
          className={cn(
            "flex shrink-0 snap-start cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 shadow-2xs",
            activeStatus === "low_stock" || activeStatus === "out_of_stock"
              ? "border-amber-500 bg-amber-500/10"
              : "border-amber-500/30 bg-card",
          )}
        >
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
            <AlertTriangle className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Alerts</div>
            <div className="flex items-center gap-1 font-mono text-xs font-bold">
              <span className="text-amber-600">{metrics.lowStockCount} Low</span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-destructive">{metrics.outOfStockCount} Out</span>
            </div>
          </div>
        </div>

        {/* 4. Reserved Stock */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600">
            <Lock className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reserved</div>
            <div className="font-mono text-xs font-bold text-foreground">
              {Number(metrics.totalReservedQuantity).toLocaleString("en-US", { maximumFractionDigits: 2 })} Units
            </div>
          </div>
        </div>
      </div>

      {/* Desktop/Tablet View (hidden on mobile) */}
      <div className="hidden mb-6 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
        {/* 1. Total Valuation */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Valuation
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
              <DollarSign className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {formattedValuation}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground truncate">
              <Boxes className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              Asset value of stock
            </p>
          </div>
          <div className="pointer-events-none absolute -bottom-6 -right-6 size-20 rounded-full bg-emerald-500/5 blur-xl" />
        </div>

        {/* 2. Tracked SKUs on Hand */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active SKUs In Stock
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400">
              <PackageCheck className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {metrics.totalSkusOnHand}{" "}
              <span className="text-xs font-normal text-muted-foreground">Products</span>
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground truncate">
              <CheckCircle2 className="size-3 text-blue-600 dark:text-blue-400 shrink-0" />
              Positive stock count
            </p>
          </div>
        </div>

        {/* 3. Low & Out of Stock Alerts */}
        <div
          onClick={() => handleFilterClick("low_stock")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleFilterClick("low_stock")}
          className={cn(
            "group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border p-4 shadow-xs transition-all hover:shadow-md",
            activeStatus === "low_stock" || activeStatus === "out_of_stock"
              ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20"
              : "border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-card hover:border-amber-500/50",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Stock Alerts
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 transition-transform group-hover:scale-110 dark:text-amber-400">
              <AlertTriangle className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <p className="font-mono text-2xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
                {metrics.lowStockCount}
              </p>
              <span className="text-xs font-medium text-muted-foreground">Low</span>
              <span className="text-muted-foreground/50">•</span>
              <p className="font-mono text-lg font-bold text-destructive">
                {metrics.outOfStockCount}
              </p>
              <span className="text-xs font-medium text-muted-foreground">Out</span>
            </div>
            <p className="mt-0.5 text-xs text-amber-800/80 truncate group-hover:underline dark:text-amber-400/80">
              Filter low stock items &rarr;
            </p>
          </div>
        </div>

        {/* 4. Reserved / In Transit */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-indigo-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reserved Stock
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20 dark:text-indigo-400">
              <Lock className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {Number(metrics.totalReservedQuantity).toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
              <span className="text-xs font-normal text-muted-foreground">Units</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              Allocated for pending orders
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
