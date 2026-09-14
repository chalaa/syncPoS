"use client";

import { ShoppingBag, Truck, Receipt, CreditCard } from "lucide-react";
import type { PurchaseOrderListRow } from "@/server/purchasing/types";

export function PurchasingKpiCards({
  orders,
}: {
  orders: PurchaseOrderListRow[];
}) {
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
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Committed Volume */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-4 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Total Purchase Volume
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
            <ShoppingBag className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            {formattedVolume}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Across {activeOrders.length} active purchase orders
          </p>
        </div>
        <div className="absolute -bottom-6 -right-6 size-24 rounded-full bg-emerald-500/5 blur-xl pointer-events-none" />
      </div>

      {/* 2. Active Orders & RFQs */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-blue-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Procurement Orders
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20">
            <Receipt className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
            {totalOrdersCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">Orders</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {orders.filter((o) => o.status === "draft" || o.status === "sent").length} draft/sent
            </span>
          </p>
        </div>
      </div>

      {/* 3. Pending Goods Receipts */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pending Receipts
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
            <Truck className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
            {pendingReceipts}{" "}
            <span className="text-xs font-normal text-muted-foreground">Shipments</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Awaiting full intake receipt
          </p>
        </div>
      </div>

      {/* 4. Payment Settlement Status */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-purple-500/40 hover:shadow-md">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Settled Invoices
          </span>
          <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-1 ring-purple-500/20">
            <CreditCard className="size-4.5" />
          </div>
        </div>
        <div className="mt-2.5">
          <p className="font-mono text-2xl font-extrabold tracking-tight text-foreground">
            {settledCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">Paid POs</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Fully settled vendor bills
          </p>
        </div>
      </div>
    </div>
  );
}
