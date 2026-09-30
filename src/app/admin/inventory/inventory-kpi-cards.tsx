"use client";

import { AlertTriangle, Boxes, CheckCircle2, DollarSign, Lock, PackageCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import type { InventorySummaryMetrics } from "@/server/inventory/stock-types";
import { useTranslation } from "@/lib/i18n/use-translation";

export function InventoryKpiCards({
  metrics,
  activeStatus,
}: {
  metrics: InventorySummaryMetrics;
  activeStatus?: string;
}) {
  const { t } = useTranslation();
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
    <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
      {/* 1. Total Valuation */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-3 sm:p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {t("kpi.totalValuation", "Total Valuation")}
          </span>
          <div className="flex size-6 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
            <DollarSign className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-1.5 sm:mt-2 min-w-0">
          <p className="font-mono text-base sm:text-2xl font-extrabold tracking-tight text-foreground truncate">
            {formattedValuation}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground truncate">
            <Boxes className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            {t("kpi.assetValueOfStock", "Asset value of stock")}
          </p>
        </div>
        <div className="pointer-events-none absolute -bottom-6 -right-6 size-20 rounded-full bg-emerald-500/5 blur-xl" />
      </div>

      {/* 2. Tracked SKUs on Hand */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {t("kpi.activeSkusInStock", "Active SKUs In Stock")}
          </span>
          <div className="flex size-6 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400">
            <PackageCheck className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-1.5 sm:mt-2 min-w-0">
          <p className="font-mono text-base sm:text-2xl font-extrabold tracking-tight text-foreground truncate">
            {metrics.totalSkusOnHand}{" "}
            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">{t("kpi.products", "Products")}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground truncate">
            <CheckCircle2 className="size-3 text-blue-600 dark:text-blue-400 shrink-0" />
            {t("kpi.positiveStockCount", "Positive stock count")}
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
          "group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border p-3 sm:p-4 shadow-xs transition-all hover:shadow-md",
          activeStatus === "low_stock" || activeStatus === "out_of_stock"
            ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20"
            : "border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-background to-card hover:border-amber-500/50",
        )}
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 truncate">
            {t("kpi.stockAlerts", "Stock Alerts")}
          </span>
          <div className="flex size-6 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 transition-transform group-hover:scale-110 dark:text-amber-400">
            <AlertTriangle className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-1.5 sm:mt-2 min-w-0">
          <div className="flex items-baseline gap-1 sm:gap-1.5 truncate">
            <p className="font-mono text-base sm:text-2xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
              {metrics.lowStockCount}
            </p>
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">{t("kpi.low", "Low")}</span>
            <span className="text-muted-foreground/50">•</span>
            <p className="font-mono text-sm sm:text-lg font-bold text-destructive">
              {metrics.outOfStockCount}
            </p>
            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">{t("kpi.out", "Out")}</span>
          </div>
          <p className="mt-0.5 text-[10px] sm:text-xs text-amber-800/80 truncate group-hover:underline dark:text-amber-400/80">
            {t("kpi.filterLowStock", "Filter low stock items →")}
          </p>
        </div>
      </div>

      {/* 4. Reserved / In Transit */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-xs transition-all hover:border-indigo-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {t("kpi.reservedStock", "Reserved Stock")}
          </span>
          <div className="flex size-6 sm:size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 ring-1 ring-indigo-500/20 dark:text-indigo-400">
            <Lock className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-1.5 sm:mt-2 min-w-0">
          <p className="font-mono text-base sm:text-2xl font-extrabold tracking-tight text-foreground truncate">
            {Number(metrics.totalReservedQuantity).toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
            <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">{t("kpi.units", "Units")}</span>
          </p>
          <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground truncate">
            {t("kpi.allocatedPendingOrders", "Allocated for pending orders")}
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
