"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Barcode,
  Boxes,
  Eye,
  MapPin,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { cn } from "@/lib/utils";
import {
  displayMoneyMinor,
  displayQuantity,
  type ProductStockCardRow,
  type SerialHistoryRow,
  type StockFilterOption,
} from "@/server/inventory/stock-types";

function MovementBadge({ type }: { type: string }) {
  const normalized = type.toLowerCase();
  const isInbound =
    normalized.includes("receipt") ||
    normalized.includes("in") ||
    normalized.includes("found");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold border",
        isInbound
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
      )}
    >
      {isInbound ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
      <span className="capitalize">{type.replace(/_/g, " ")}</span>
    </span>
  );
}

export function ProductStockCardFilters({
  query,
  productId,
  asOfDate,
  products,
}: {
  query: string;
  productId: string;
  asOfDate: string;
  products: StockFilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/admin/inventory/stock-card?${params.toString()}`);
  }

  return (
    <div className="border-b border-border/80 bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
        {/* Search */}
        <div className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>Search Movements</span>
          <TableSearchInput defaultValue={query} placeholder="Movement no, source doc..." />
        </div>

        {/* Product Select */}
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>Product Ledger</span>
          <select
            name="productId"
            defaultValue={productId}
            onChange={(e) => updateParam("productId", e.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </select>
        </label>

        {/* As of Date */}
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>As Of Date</span>
          <input
            name="asOfDate"
            type="date"
            defaultValue={asOfDate}
            onChange={(e) => updateParam("asOfDate", e.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
          />
        </label>
      </div>
    </div>
  );
}

export function ProductStockCardTable({ rows }: { rows: ProductStockCardRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead>
          <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3.5">Date</th>
            <th className="px-4 py-3.5">Movement No</th>
            <th className="px-4 py-3.5">Type</th>
            <th className="px-4 py-3.5">Owner</th>
            <th className="px-4 py-3.5">From</th>
            <th className="px-4 py-3.5">To</th>
            <th className="px-4 py-3.5">Serial</th>
            <th className="px-4 py-3.5 text-right">Quantity</th>
            <th className="px-4 py-3.5 text-right">Total Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((row) => {
            const qtyNum = Number(row.quantity);
            const isInbound = qtyNum > 0;

            return (
              <tr
                key={row.movementLineId}
                className="group transition-colors hover:bg-[#0B5D4B]/5 dark:hover:bg-[#0B5D4B]/10"
              >
                <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium">
                  {row.movementDate.toLocaleDateString()}
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-mono text-xs font-bold text-primary">{row.movementNo}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{row.sourceNo ?? row.notes ?? "—"}</div>
                </td>
                <td className="px-4 py-3.5">
                  <MovementBadge type={row.movementType} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{row.ownerName ?? "—"}</td>
                <td className="px-4 py-3.5 text-xs font-medium text-foreground">{row.fromLocationCode ?? "—"}</td>
                <td className="px-4 py-3.5 text-xs font-medium text-foreground">{row.toLocationCode ?? "—"}</td>
                <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{row.serialNo ?? "—"}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs">
                  <span
                    className={cn(
                      "font-bold",
                      isInbound ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
                    )}
                  >
                    {isInbound ? `+${displayQuantity(row.quantity)}` : displayQuantity(row.quantity)}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">
                  {displayMoneyMinor(row.totalCostMinor, "ETB")}
                </td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-16 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                  <Boxes className="size-6" />
                </div>
                <p className="font-bold text-sm text-foreground">No stock card movements found</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Try selecting a specific product from the dropdown above to view its chronological ledger.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SerialHistoryFilters({
  serialQuery,
  asOfDate,
}: {
  serialQuery: string;
  asOfDate: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/admin/inventory/serial-history?${params.toString()}`);
  }

  return (
    <div className="border-b border-border/80 bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
        {/* Serial input */}
        <div className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground sm:col-span-2 lg:col-span-1">
          <span>Serial or Machine Tag</span>
          <TableSearchInput
            paramName="serial"
            defaultValue={serialQuery}
            placeholder="Serial number, engine, chassis..."
          />
        </div>

        {/* As of Date */}
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>As Of Date</span>
          <input
            name="asOfDate"
            type="date"
            defaultValue={asOfDate}
            onChange={(e) => updateParam("asOfDate", e.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
          />
        </label>
      </div>
    </div>
  );
}

export function SerialHistoryTable({ rows }: { rows: SerialHistoryRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead>
          <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-3.5">Serial / Tag</th>
            <th className="px-4 py-3.5">Product</th>
            <th className="px-4 py-3.5">Current Location</th>
            <th className="px-4 py-3.5">Owner</th>
            <th className="px-4 py-3.5">Date</th>
            <th className="px-4 py-3.5">Movement</th>
            <th className="px-4 py-3.5">From</th>
            <th className="px-4 py-3.5">To</th>
            <th className="px-4 py-3.5 text-right">Quantity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {rows.map((row) => (
            <tr
              key={row.movementLineId}
              className="group transition-colors hover:bg-[#0B5D4B]/5 dark:hover:bg-[#0B5D4B]/10"
            >
              <td className="px-4 py-3.5">
                <span className="font-mono text-xs font-bold text-primary">{row.serialNo}</span>
              </td>
              <td className="px-4 py-3.5">
                <div className="font-mono text-xs font-bold text-foreground">{row.sku}</div>
                <div className="text-[11px] text-muted-foreground truncate max-w-xs">{row.productName}</div>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <MapPin className="size-3 text-muted-foreground" />
                  {row.currentLocationCode ?? "—"}
                </div>
                <div className="mt-1">
                  <StatusBadge status={row.serialStatus} size="sm" />
                </div>
              </td>
              <td className="px-4 py-3.5 text-xs text-muted-foreground">{row.ownerName ?? "—"}</td>
              <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium">
                {row.movementDate.toLocaleDateString()}
              </td>
              <td className="px-4 py-3.5 font-mono text-xs font-semibold text-foreground">
                {row.movementNo}
              </td>
              <td className="px-4 py-3.5 text-xs font-medium text-foreground">{row.fromLocationCode ?? "—"}</td>
              <td className="px-4 py-3.5 text-xs font-medium text-foreground">{row.toLocationCode ?? "—"}</td>
              <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                {displayQuantity(row.quantity)}
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-16 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                  <Barcode className="size-6" />
                </div>
                <p className="font-bold text-sm text-foreground">No serial history found</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                  Enter a serial number or machine tag above to inspect its provenance lifecycle.
                </p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
