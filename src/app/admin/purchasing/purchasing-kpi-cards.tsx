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
    <div className="-mx-4 mb-6 flex gap-2.5 overflow-x-auto px-4 pb-2 pt-0.5 no-scrollbar snap-x snap-mandatory sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 sm:pb-0 lg:grid-cols-4">
      {/* 1. Total Committed Volume */}
      <div className="relative flex w-[75vw] min-w-[210px] max-w-[260px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-background to-card p-3.5 shadow-xs transition-all hover:border-emerald-500/40 hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            Total Purchase Volume
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 dark:text-emerald-400 sm:size-8">
            <ShoppingBag className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="font-mono text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
            {formattedVolume}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate sm:text-xs">
            Across {activeOrders.length} active purchase orders
          </p>
        </div>
        <div className="pointer-events-none absolute -bottom-6 -right-6 size-20 rounded-full bg-emerald-500/5 blur-xl" />
      </div>

      {/* 2. Active Orders & RFQs */}
      <div className="relative flex w-[75vw] min-w-[210px] max-w-[260px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all hover:border-blue-500/40 hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            Procurement Orders
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 dark:text-blue-400 sm:size-8">
            <Receipt className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="font-mono text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
            {totalOrdersCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">Orders</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate sm:text-xs">
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {orders.filter((o) => o.status === "draft" || o.status === "sent").length} draft/sent
            </span>
          </p>
        </div>
      </div>

      {/* 3. Pending Goods Receipts */}
      <div className="relative flex w-[75vw] min-w-[210px] max-w-[260px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all hover:border-amber-500/40 hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            Pending Receipts
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 dark:text-amber-400 sm:size-8">
            <Truck className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="font-mono text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
            {pendingReceipts}{" "}
            <span className="text-xs font-normal text-muted-foreground">Shipments</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate sm:text-xs">
            Awaiting full intake receipt
          </p>
        </div>
      </div>

      {/* 4. Payment Settlement Status */}
      <div className="relative flex w-[75vw] min-w-[210px] max-w-[260px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-xl border border-border/80 bg-card p-3.5 shadow-xs transition-all hover:border-purple-500/40 hover:shadow-md sm:w-auto sm:min-w-0 sm:max-w-none sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">
            Settled Invoices
          </span>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 ring-1 ring-purple-500/20 dark:text-purple-400 sm:size-8">
            <CreditCard className="size-4" />
          </div>
        </div>
        <div className="mt-2">
          <p className="font-mono text-lg font-extrabold tracking-tight text-foreground sm:text-2xl">
            {settledCount}{" "}
            <span className="text-xs font-normal text-muted-foreground">Paid POs</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground truncate sm:text-xs">
            Fully settled vendor bills
          </p>
        </div>
      </div>
    </div>
  );
}
