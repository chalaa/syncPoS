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
    <div className="-mx-4 mb-6 flex gap-2.5 overflow-x-auto px-4 pb-2 pt-0.5 no-scrollbar snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 sm:pb-0 lg:grid-cols-4">
      {/* 1. Total Valuation */}
      <div className="relative flex w-[75vw] min-w-[210px] max-w-[260px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-3.5 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            Total Valuation
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400 sm:size-8">
            <DollarSign className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="font-mono text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
            {formattedValuation}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground truncate sm:text-xs">
            <Boxes className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            Asset value of stock
          </p>
        </div>
        <div className="pointer-events-none absolute -bottom-6 -right-6 size-20 rounded-full bg-emerald-500/5 blur-xl" />
      </div>

      {/* 2. Tracked SKUs on Hand */}
      <div className="relative flex w-[75vw] min-w-[210px] max-w-[260px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            Active SKUs In Stock
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400 sm:size-8">
            <PackageCheck className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="font-mono text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
            {metrics.totalSkusOnHand}{" "}
            <span className="text-xs font-normal text-muted-foreground">Products</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground truncate sm:text-xs">
            <CheckCircle2 className="size-3 text-blue-600 dark:text-blue-400 shrink-0" />
            Positive stock count
          </p>
        </div>
      </div>

      {/* 3. Low & Out of Stock Alerts (Interactive) */}
      <div
        onClick={() => handleFilterClick("low_stock")}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleFilterClick("low_stock")}
        className={cn(
          "group relative flex w-[75vw] min-w-[210px] max-w-[260px] shrink-0 snap-start cursor-pointer flex-col justify-between overflow-hidden rounded-xl border p-3.5 shadow-xs transition-all hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4",
          activeStatus === "low_stock" || activeStatus === "out_of_stock"
            ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20"
            : "border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-card hover:border-amber-500/50",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 sm:text-xs">
            Stock Alerts
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 transition-transform group-hover:scale-110 dark:text-amber-400 sm:size-8">
            <AlertTriangle className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="flex items-baseline gap-1.5">
            <p className="font-mono text-lg font-extrabold tracking-tight text-amber-600 dark:text-amber-400 sm:text-2xl">
              {metrics.lowStockCount}
            </p>
            <span className="text-[11px] font-medium text-muted-foreground">Low</span>
            <span className="text-muted-foreground/50">•</span>
            <p className="font-mono text-base font-bold text-destructive sm:text-lg">
              {metrics.outOfStockCount}
            </p>
            <span className="text-[11px] font-medium text-muted-foreground">Out</span>
          </div>
          <p className="mt-0.5 text-[11px] text-amber-800/80 truncate group-hover:underline dark:text-amber-400/80 sm:text-xs">
            Filter low stock items &rarr;
          </p>
        </div>
      </div>

      {/* 4. Reserved / In Transit */}
      <div className="relative flex w-[75vw] min-w-[210px] max-w-[260px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all hover:border-indigo-500/40 hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            Reserved Stock
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20 dark:text-indigo-400 sm:size-8">
            <Lock className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="font-mono text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
            {Number(metrics.totalReservedQuantity).toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
            <span className="text-xs font-normal text-muted-foreground">Units</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate sm:text-xs">
            Allocated for pending orders
          </p>
        </div>
      </div>
    </div>
  );
}
