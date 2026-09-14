"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  Filter,
  Layers,
  MapPin,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";

import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  displayMoneyMinor,
  displayQuantity,
  type InventoryOperationFormOptions,
  type StockByLocationRow,
  type StockFilterOption,
  type StockStatusOption,
} from "@/server/inventory/stock-types";
import { StockProductDrawer } from "./stock-product-drawer";

const STATUS_PILLS: { key: StockStatusOption; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All Items", icon: Boxes },
  { key: "in_stock", label: "In Stock", icon: CheckCircle2 },
  { key: "low_stock", label: "Low Stock (≤5)", icon: AlertTriangle },
  { key: "out_of_stock", label: "Out of Stock", icon: XCircle },
  { key: "reserved", label: "Reserved", icon: Layers },
];

export function StockFilters({
  query,
  locationId,
  status,
  asOfDate,
  locations,
}: {
  query: string;
  locationId: string;
  status: StockStatusOption;
  asOfDate: string;
  locations: StockFilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/admin/inventory?${params.toString()}`);
  }

  function handleReset() {
    router.push("/admin/inventory");
  }

  const hasActiveFilters = Boolean(query || locationId || (status && status !== "all") || asOfDate);

  return (
    <div className="border-b border-border/80 bg-card p-4 space-y-3.5">
      {/* Segmented Status Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
        {STATUS_PILLS.map((pill) => {
          const Icon = pill.icon;
          const isSelected = status === pill.key || (!status && pill.key === "all");

          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => updateParam("status", pill.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap",
                isSelected
                  ? "bg-[#0B5D4B] text-white shadow-xs"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50",
              )}
            >
              <Icon className={cn("size-3.5", isSelected ? "text-emerald-200" : "text-muted-foreground")} />
              {pill.label}
            </button>
          );
        })}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors ml-auto cursor-pointer"
          >
            <RotateCcw className="size-3" />
            Reset
          </button>
        )}
      </div>

      {/* Inputs Form */}
      <form
        method="GET"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end"
      >
        <input type="hidden" name="status" value={status} />

        {/* Search */}
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>Search Product / Serial</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={query}
              placeholder="Item code, SKU, serial, name..."
              className="h-9.5 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B] transition-colors"
            />
          </div>
        </label>

        {/* Location Select */}
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>Location</span>
          <select
            name="locationId"
            defaultValue={locationId}
            className="h-9.5 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B] transition-colors"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.code} · {loc.name}
              </option>
            ))}
          </select>
        </label>

        {/* As of Date */}
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>As Of Date (Historical)</span>
          <input
            name="asOfDate"
            type="date"
            defaultValue={asOfDate}
            className="h-9.5 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5D4B]/30 focus-visible:border-[#0B5D4B] transition-colors"
          />
        </label>

        {/* Filter Action */}
        <Button
          type="submit"
          className="h-9.5 gap-2 rounded-xl bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-xs shadow-[#0B5D4B]/20 hover:brightness-110 active:scale-[0.99] transition-all"
        >
          <Filter className="size-3.5 text-emerald-200" />
          Apply Filter
        </Button>
      </form>
    </div>
  );
}

export function StockByLocationTable({
  rows,
  formOptions,
}: {
  rows: StockByLocationRow[];
  formOptions?: InventoryOperationFormOptions & { balances: any[] };
}) {
  const [selectedRow, setSelectedRow] = useState<StockByLocationRow | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Product & SKU</th>
              <th className="px-4 py-3.5">Location</th>
              <th className="px-4 py-3.5">Owner</th>
              <th className="px-4 py-3.5">Tracking</th>
              <th className="px-4 py-3.5 text-right">On Hand</th>
              <th className="px-4 py-3.5 text-right">Reserved</th>
              <th className="px-4 py-3.5 text-right">Available</th>
              <th className="px-4 py-3.5 text-right">Avg Cost</th>
              <th className="px-4 py-3.5 text-right">Valuation</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => {
              const availableNum = Number(row.quantityAvailable);
              const onHandNum = Number(row.quantityOnHand);
              const isOut = availableNum <= 0;
              const isLow = availableNum > 0 && availableNum <= 5;
              const trackingType = row.serialNo ? "Serial" : row.lotNo ? "Lot" : "Bulk";
              const valuationMinor = Math.round(onHandNum * row.averageCostMinor);

              return (
                <tr
                  key={row.stockBalanceId}
                  onClick={() => setSelectedRow(row)}
                  className="group cursor-pointer transition-colors hover:bg-[#0B5D4B]/5 dark:hover:bg-[#0B5D4B]/10"
                >
                  {/* Status Indicator Dot */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0 ring-2",
                          isOut
                            ? "bg-destructive ring-destructive/20"
                            : isLow
                              ? "bg-amber-500 ring-amber-500/20"
                              : "bg-emerald-500 ring-emerald-500/20",
                        )}
                        title={isOut ? "Out of Stock" : isLow ? "Low Stock" : "In Stock"}
                      />
                      <span className="text-xs font-semibold text-muted-foreground">
                        {isOut ? "Out" : isLow ? "Low" : "OK"}
                      </span>
                    </div>
                  </td>

                  {/* Product & SKU */}
                  <td className="px-4 py-3.5">
                    <div className="font-mono text-xs font-bold text-primary group-hover:underline">
                      {row.sku}
                    </div>
                    <div className="text-xs font-medium text-foreground truncate max-w-xs mt-0.5">
                      {row.productName}
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <MapPin className="size-3 text-muted-foreground" />
                      {row.locationCode}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                      {row.locationName}
                    </div>
                  </td>

                  {/* Owner */}
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">
                    {row.ownerName ?? "—"}
                  </td>

                  {/* Tracking */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center rounded-md border border-border/80 bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {trackingType}
                      </span>
                      {(row.serialNo || row.lotNo) && (
                        <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                          {row.serialNo ?? row.lotNo}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* On Hand */}
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                    {displayQuantity(row.quantityOnHand)}
                  </td>

                  {/* Reserved */}
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                    {Number(row.quantityReserved) > 0 ? (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {displayQuantity(row.quantityReserved)}
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>

                  {/* Available */}
                  <td className="px-4 py-3.5 text-right font-mono text-xs">
                    {isOut ? (
                      <span className="font-bold text-destructive">0</span>
                    ) : (
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {displayQuantity(row.quantityAvailable)}
                      </span>
                    )}
                  </td>

                  {/* Avg Cost */}
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                    {displayMoneyMinor(row.averageCostMinor, row.currencyCode)}
                  </td>

                  {/* Valuation */}
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">
                    {displayMoneyMinor(valuationMinor, row.currencyCode)}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedRow(row)}
                        className="h-8 gap-1 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="size-3.5" />
                        Inspect
                      </Button>
                      <Button asChild variant="outline" size="sm" className="h-8 px-2.5 text-xs font-semibold">
                        <Link href={`/admin/inventory/stock-card?productId=${row.productId}`}>
                          <FileSpreadsheet className="size-3.5 mr-1 text-emerald-600" />
                          Ledger
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-16 text-center">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                    <Boxes className="size-6" />
                  </div>
                  <p className="font-bold text-sm text-foreground">No stock balance records found</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    No active balances match your search criteria. Try selecting another location or clearing active filters.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Slide-over Inspect Drawer */}
      <StockProductDrawer row={selectedRow} onClose={() => setSelectedRow(null)} formOptions={formOptions} />
    </>
  );
}
