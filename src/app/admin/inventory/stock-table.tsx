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
import { TableSearchInput } from "@/components/ui/table-search-input";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  displayMoneyMinor,
  displayQuantity,
  type InventoryOperationFormOptions,
  type StockByLocationRow,
  type StockFilterOption,
  type StockStatusOption,
} from "@/server/inventory/stock-types";
import { StockProductDrawer } from "./stock-product-drawer";

const STATUS_PILLS: { key: StockStatusOption; labelKey: string; defaultLabel: string; icon: React.ElementType }[] = [
  { key: "all", labelKey: "inventory.allItems", defaultLabel: "All Items", icon: Boxes },
  { key: "in_stock", labelKey: "inventory.inStock", defaultLabel: "In Stock", icon: CheckCircle2 },
  { key: "low_stock", labelKey: "inventory.lowStock", defaultLabel: "Low Stock (≤5)", icon: AlertTriangle },
  { key: "out_of_stock", labelKey: "inventory.outOfStock", defaultLabel: "Out of Stock", icon: XCircle },
  { key: "reserved", labelKey: "inventory.reserved", defaultLabel: "Reserved", icon: Layers },
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
  const { t } = useTranslation();
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
              {t(pill.labelKey, pill.defaultLabel)}
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
            {t("inventory.reset", "Reset")}
          </button>
        )}
      </div>

      {/* Inputs Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 items-end">
        {/* Search */}
        <div className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>{t("field.search", "Search Product / Serial")}</span>
          <TableSearchInput defaultValue={query} placeholder={t("inventory.searchPlaceholder", "Item code, SKU, serial, name...")} />
        </div>

        {/* Location Select */}
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>{t("field.location", "Location")}</span>
          <select
            name="locationId"
            defaultValue={locationId}
            onChange={(e) => updateParam("locationId", e.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
          >
            <option value="">{t("inventory.allLocations", "All Locations")}</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.code} · {loc.name}
              </option>
            ))}
          </select>
        </label>

        {/* As of Date */}
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          <span>{t("inventory.asOfDate", "As Of Date (Historical)")}</span>
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

export function StockByLocationTable({
  rows,
  formOptions,
}: {
  rows: StockByLocationRow[];
  formOptions?: InventoryOperationFormOptions & { balances: any[] };
}) {
  const { t } = useTranslation();
  const [selectedRow, setSelectedRow] = useState<StockByLocationRow | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3.5">{t("field.status", "Status")}</th>
              <th className="px-4 py-3.5">{t("sales.col.product", "Product & SKU")}</th>
              <th className="px-4 py-3.5">{t("field.location", "Location")}</th>
              <th className="px-4 py-3.5">{t("field.stockOwner", "Owner")}</th>
              <th className="px-4 py-3.5">{t("field.trackingMode", "Tracking")}</th>
              <th className="px-4 py-3.5 text-right">{t("inventory.onHand", "On Hand")}</th>
              <th className="px-4 py-3.5 text-right">{t("inventory.reserved", "Reserved")}</th>
              <th className="px-4 py-3.5 text-right">{t("inventory.available", "Available")}</th>
              <th className="px-4 py-3.5 text-right">{t("inventory.avgCost", "Avg Cost")}</th>
              <th className="px-4 py-3.5 text-right">{t("inventory.valuation", "Valuation")}</th>
              <th className="px-4 py-3.5 text-right">{t("action.actions", "Actions")}</th>
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
                        title={isOut ? t("inventory.outOfStock", "Out of Stock") : isLow ? t("inventory.lowStock", "Low Stock") : t("inventory.inStock", "In Stock")}
                      />
                      <span className="text-xs font-semibold text-muted-foreground">
                        {isOut ? t("kpi.out", "Out") : isLow ? t("kpi.low", "Low") : "OK"}
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
                        {t("inventory.inspect", "Inspect")}
                      </Button>
                      <Button asChild variant="outline" size="sm" className="h-8 px-2.5 text-xs font-semibold">
                        <Link href={`/admin/inventory/stock-card?productId=${row.productId}`}>
                          <FileSpreadsheet className="size-3.5 mr-1 text-emerald-600" />
                          {t("inventory.ledger", "Ledger")}
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
                  <p className="font-bold text-sm text-foreground">{t("inventory.noStockRecords", "No stock balance records found")}</p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                    {t("inventory.noStockHint", "No active balances match your search criteria. Try selecting another location or clearing active filters.")}
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
