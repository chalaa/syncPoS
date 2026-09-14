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
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Valuation */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Valuation
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
            <DollarSign className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            {formattedValuation}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Boxes className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            Asset value of all items in stock
          </p>
        </div>
        <div className="absolute -bottom-6 -right-6 size-24 rounded-full bg-emerald-500/5 blur-xl pointer-events-none" />
      </div>

      {/* 2. Tracked SKUs on Hand */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Active SKUs In Stock
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
            <PackageCheck className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            {metrics.totalSkusOnHand}{" "}
            <span className="text-sm font-normal text-muted-foreground">Products</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-blue-600 dark:text-blue-400" />
            Positive quantity available
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
          "group relative cursor-pointer overflow-hidden rounded-2xl border p-4 shadow-xs transition-all hover:shadow-md",
          activeStatus === "low_stock" || activeStatus === "out_of_stock"
            ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20"
            : "border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-card hover:border-amber-500/50",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Stock Alerts
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20 transition-transform group-hover:scale-110">
            <AlertTriangle className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <div className="flex items-baseline gap-2">
            <p className="font-mono text-xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400 sm:text-2xl">
              {metrics.lowStockCount}
            </p>
            <span className="text-xs font-medium text-muted-foreground">Low</span>
            <span className="text-muted-foreground/50">•</span>
            <p className="font-mono text-lg font-bold text-destructive">
              {metrics.outOfStockCount}
            </p>
            <span className="text-xs font-medium text-muted-foreground">Out</span>
          </div>
          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-400/80 group-hover:underline">
            Click to view low stock items &rarr;
          </p>
        </div>
      </div>

      {/* 4. Reserved / In Transit */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-indigo-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reserved Stock
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/20">
            <Lock className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            {Number(metrics.totalReservedQuantity).toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
            <span className="text-sm font-normal text-muted-foreground">Units</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Allocated for pending orders
          </p>
        </div>
      </div>
    </div>
  );
}
