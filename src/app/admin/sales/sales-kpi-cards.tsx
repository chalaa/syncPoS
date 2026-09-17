"use client";

import { DollarSign, FileText, Send, CheckCircle } from "lucide-react";
import type { SalesOrderListRow } from "@/server/sales/types";

export function SalesKpiCards({
  orders,
}: {
  orders: SalesOrderListRow[];
}) {
  const totalOrdersCount = orders.length;
  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  const pendingDeliveries = activeOrders.filter(
    (o) => Number(o.quantityDelivered) < Number(o.quantityOrdered),
  ).length;

  const totalSalesVolumeMinor = activeOrders.reduce(
    (sum, o) => sum + (o.totalMinor || 0),
    0,
  );

  const settledCount = activeOrders.filter(
    (o) => o.residualAmountMinor === 0 || o.totalMinor === 0,
  ).length;

  const currencyCode = orders[0]?.currencyCode || "ETB";
  const formattedVolume = `${currencyCode} ${(totalSalesVolumeMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <>
      {/* Mobile View: Compact Micro-Metric Bar (sm:hidden) */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 py-1 no-scrollbar touch-pan-x snap-x snap-mandatory sm:hidden">
        {/* 1. Total Sales Volume */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-emerald-500/20 bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
            <DollarSign className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Volume</div>
            <div className="font-mono text-xs font-bold text-foreground">{formattedVolume}</div>
          </div>
        </div>

        {/* 2. Total Orders & Quotes */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
            <FileText className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Orders</div>
            <div className="font-mono text-xs font-bold text-foreground">
              {totalOrdersCount} <span className="text-[10px] font-normal text-blue-600">({orders.filter((o) => o.status === "draft" || o.status === "sent").length} draft)</span>
            </div>
          </div>
        </div>

        {/* 3. Pending Deliveries */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
            <Send className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pending Dispatch</div>
            <div className="font-mono text-xs font-bold text-foreground">{pendingDeliveries} Fulfillments</div>
          </div>
        </div>

        {/* 4. Settled Invoices */}
        <div className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 shadow-2xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
            <CheckCircle className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Settled</div>
            <div className="font-mono text-xs font-bold text-foreground">{settledCount} Paid Orders</div>
          </div>
        </div>
      </div>

      {/* Desktop/Tablet View (hidden on mobile) */}
      <div className="hidden mb-6 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-3">
        {/* 1. Total Sales Volume */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Sales Volume
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
              <DollarSign className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {formattedVolume}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              Across {activeOrders.length} active customer orders
            </p>
          </div>
          <div className="pointer-events-none absolute -bottom-6 -right-6 size-20 rounded-full bg-emerald-500/5 blur-xl" />
        </div>

        {/* 2. Total Orders & Quotations */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-blue-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Orders & Quotes
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400">
              <FileText className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {totalOrdersCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">Orders</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {orders.filter((o) => o.status === "draft" || o.status === "sent").length} draft/quotes
              </span>
            </p>
          </div>
        </div>

        {/* 3. Pending Deliveries */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pending Deliveries
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400">
              <Send className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {pendingDeliveries}{" "}
              <span className="text-xs font-normal text-muted-foreground">Fulfillments</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              Awaiting customer dispatch
            </p>
          </div>
        </div>

        {/* 4. Fully Settled Invoices */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Settled Invoices
            </span>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400">
              <CheckCircle className="size-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
              {settledCount}{" "}
              <span className="text-xs font-normal text-muted-foreground">Paid Orders</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              Customer billing completed
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
