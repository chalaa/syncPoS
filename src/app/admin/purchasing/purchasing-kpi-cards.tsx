"use client";

import { ShoppingBag, Truck, Receipt, CreditCard } from "lucide-react";
import type { PurchaseOrderListRow } from "@/server/purchasing/types";
import { useTranslation } from "@/lib/i18n/use-translation";

export function PurchasingKpiCards({
  orders,
}: {
  orders: PurchaseOrderListRow[];
}) {
  const { t } = useTranslation();
  const totalOrdersCount = orders.length;
  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  const pendingReceipts = activeOrders.filter(
    (o) => Number(o.quantityReceived) < Number(o.quantityOrdered),
  ).length;

  const totalPurchaseVolumeMinor = activeOrders.reduce(
    (sum, o) => sum + (o.totalMinor || 0),
    0,
  );

  const settledCount = activeOrders.filter(
    (o) => o.residualAmountMinor === 0 || o.totalMinor === 0,
  ).length;

  const currencyCode = orders[0]?.currencyCode || "ETB";
  const formattedVolume = `${currencyCode} ${(totalPurchaseVolumeMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <>
      {/* Mobile View: Compact Micro-Metric Bar (sm:hidden) */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-1 no-scrollbar touch-pan-x snap-x snap-mandatory sm:hidden">
        {/* 1. Total Volume */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-emerald-500/20 bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
            <ShoppingBag className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("kpi.volume", "Volume")}</div>
            <div className="font-mono text-xs font-bold text-foreground">{formattedVolume}</div>
          </div>
        </div>

        {/* 2. Procurement Orders */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
            <Receipt className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("kpi.orders", "Orders")}</div>
            <div className="font-mono text-xs font-bold text-foreground">
              {totalOrdersCount} <span className="text-[10px] font-normal text-blue-600">({orders.filter((o) => o.status === "draft" || o.status === "sent").length} {t("kpi.draft", "draft")})</span>
            </div>
          </div>
        </div>

        {/* 3. Pending Receipts */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
            <Truck className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("kpi.pendingIntake", "Pending Intake")}</div>
            <div className="font-mono text-xs font-bold text-foreground">{pendingReceipts} {t("kpi.shipments", "Shipments")}</div>
          </div>
        </div>

        {/* 4. Settled Invoices */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-purple-500/10 text-purple-600">
            <CreditCard className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("kpi.settled", "Settled")}</div>
            <div className="font-mono text-xs font-bold text-foreground">{settledCount} {t("kpi.paidPos", "Paid POs")}</div>
          </div>
        </div>
      </div>

      {/* Desktop/Tablet View (hidden on mobile) */}
      <div className="hidden mb-6 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
        {/* 1. Total Committed Volume */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("kpi.totalPurchaseVolume", "Total Purchase Volume")}
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
              <ShoppingBag className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {formattedVolume}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {t("kpi.across", "Across")} {activeOrders.length} {t("kpi.activePurchaseOrders", "active purchase orders")}
            </p>
          </div>
          <div className="pointer-events-none absolute -bottom-6 -right-6 size-20 rounded-full bg-emerald-500/5 blur-xl" />
        </div>

        {/* 2. Active Orders & RFQs */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-blue-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("kpi.procurementOrders", "Procurement Orders")}
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400">
              <Receipt className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {totalOrdersCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">{t("kpi.orders", "Orders")}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {orders.filter((o) => o.status === "draft" || o.status === "sent").length} {t("kpi.draftSent", "draft/sent")}
              </span>
            </p>
          </div>
        </div>

        {/* 3. Pending Goods Receipts */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("kpi.pendingReceipts", "Pending Receipts")}
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
              <Truck className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {pendingReceipts}{" "}
              <span className="text-xs font-normal text-muted-foreground">{t("kpi.shipments", "Shipments")}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {t("kpi.awaitingFullReceipt", "Awaiting full intake receipt")}
            </p>
          </div>
        </div>

        {/* 4. Payment Settlement Status */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-purple-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("kpi.settledInvoices", "Settled Invoices")}
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 ring-1 ring-purple-500/20 dark:text-purple-400">
              <CreditCard className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {settledCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">{t("kpi.paidPos", "Paid POs")}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {t("kpi.fullySettledVendorBills", "Fully settled vendor bills")}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
