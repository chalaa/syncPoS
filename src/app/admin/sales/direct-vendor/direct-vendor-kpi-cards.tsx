"use client";

import { CheckCircle2, DollarSign, FileText, TrendingUp, Truck } from "lucide-react";

import { useTranslation } from "@/lib/i18n/use-translation";
import type { DirectVendorSaleListRow } from "@/server/direct-vendor-sales/types";

export function DirectVendorKpiCards({ sales }: { sales: DirectVendorSaleListRow[] }) {
  const { t } = useTranslation();
  const totalCount = sales.length;
  const activeSales = sales.filter((s) => s.status !== "cancelled");
  const postedSales = sales.filter((s) => s.status === "posted");
  const draftSales = sales.filter((s) => s.status === "draft");

  const totalSalesVolumeMinor = activeSales.reduce((sum, s) => sum + (s.customerTotalMinor || 0), 0);
  const totalVendorCostMinor = activeSales.reduce((sum, s) => sum + (s.vendorCostTotalMinor || 0), 0);
  const totalMarginMinor = activeSales.reduce((sum, s) => sum + (s.marginMinor || 0), 0);

  const marginPercent =
    totalSalesVolumeMinor > 0 ? ((totalMarginMinor / totalSalesVolumeMinor) * 100).toFixed(1) : "0.0";

  const currencyCode = sales[0]?.currencyCode || "ETB";

  const formatMoney = (minor: number) =>
    `${currencyCode} ${(minor / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
      {/* 1. Total Direct Sales Volume */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-3 sm:p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            {t("directVendor.kpi.totalSales", "Total Sales Volume")}
          </span>
          <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400 sm:size-8">
            <DollarSign className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-1.5 min-w-0 sm:mt-2">
          <p className="truncate font-mono text-base font-extrabold tracking-tight text-foreground sm:text-2xl">
            {formatMoney(totalSalesVolumeMinor)}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-xs">
            {activeSales.length} {t("directVendor.kpi.activeSales", "active direct orders")}
          </p>
        </div>
        <div className="pointer-events-none absolute -bottom-6 -right-6 size-20 rounded-full bg-emerald-500/5 blur-xl" />
      </div>

      {/* 2. Net Gross Margin */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-background to-card p-3 sm:p-4 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            {t("directVendor.kpi.netMargin", "Net Sales Margin")}
          </span>
          <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400 sm:size-8">
            <TrendingUp className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-1.5 min-w-0 sm:mt-2">
          <p className="truncate font-mono text-base font-extrabold tracking-tight text-foreground sm:text-2xl">
            {formatMoney(totalMarginMinor)}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-xs">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{marginPercent}%</span>{" "}
            {t("directVendor.kpi.avgReturn", "average return")}
          </p>
        </div>
        <div className="pointer-events-none absolute -bottom-6 -right-6 size-20 rounded-full bg-amber-500/5 blur-xl" />
      </div>

      {/* 3. Vendor Procurement Cost */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-background to-card p-3 sm:p-4 shadow-xs transition-all hover:border-blue-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            {t("directVendor.kpi.vendorCost", "Vendor Sourcing Cost")}
          </span>
          <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400 sm:size-8">
            <Truck className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-1.5 min-w-0 sm:mt-2">
          <p className="truncate font-mono text-base font-extrabold tracking-tight text-foreground sm:text-2xl">
            {formatMoney(totalVendorCostMinor)}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-xs">
            {t("directVendor.kpi.fulfillment", "Direct vendor fulfillment")}
          </p>
        </div>
        <div className="pointer-events-none absolute -bottom-6 -right-6 size-20 rounded-full bg-blue-500/5 blur-xl" />
      </div>

      {/* 4. Total Orders & Status */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3 sm:p-4 shadow-xs transition-all hover:border-primary/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            {t("directVendor.kpi.orderStatus", "Direct Orders")}
          </span>
          <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 sm:size-8">
            <CheckCircle2 className="size-3.5 sm:size-4" />
          </div>
        </div>
        <div className="mt-1.5 min-w-0 sm:mt-2">
          <p className="truncate font-mono text-base font-extrabold tracking-tight text-foreground sm:text-2xl">
            {totalCount}{" "}
            <span className="text-[10px] font-normal text-muted-foreground sm:text-xs">
              {t("purchasing.col.orders", "Orders")}
            </span>
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-xs">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {postedSales.length} {t("inventory.posted", "posted")}
            </span>
            {" · "}
            <span className="text-amber-600 dark:text-amber-400">
              {draftSales.length} {t("inventory.draft", "draft")}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
