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
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Sales Volume */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Sales Order Volume
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
            <DollarSign className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            {formattedVolume}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Across {activeOrders.length} active customer orders
          </p>
        </div>
        <div className="absolute -bottom-6 -right-6 size-24 rounded-full bg-emerald-500/5 blur-xl pointer-events-none" />
      </div>

      {/* 2. Total Orders & Quotations */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-blue-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Orders & Quotations
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
            <FileText className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
            {totalOrdersCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">Sales Orders</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {orders.filter((o) => o.status === "draft" || o.status === "sent").length} draft/quotes
            </span>
          </p>
        </div>
      </div>

      {/* 3. Pending Deliveries */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pending Deliveries
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
            <Send className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
            {pendingDeliveries}{" "}
            <span className="text-xs font-normal text-muted-foreground">Fulfillments</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Awaiting customer dispatch
          </p>
        </div>
      </div>

      {/* 4. Fully Settled Invoices */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Settled Invoices
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
            <CheckCircle className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
            {settledCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">Paid Orders</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Customer billing completed
          </p>
        </div>
      </div>
    </div>
  );
}
