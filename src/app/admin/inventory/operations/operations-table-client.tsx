"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Boxes,
  Eye,
  PackageMinus,
  RotateCcw,
  Search,
  Sliders,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { NewInventoryOperationModal } from "@/app/admin/inventory/operations/new-operation-modal";
import { OperationDetailModal } from "@/app/admin/inventory/operations/operation-detail-modal";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { TableFilterBar } from "@/components/ui/table-filter-bar";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { useViewMode } from "@/components/ui/view-mode-toggle";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  displayMoneyMinor,
  displayQuantity,
  type InventoryOperationDetail,
  type InventoryOperationFormOptions,
  type InventoryOperationListRow,
  type InventoryOperationView,
} from "@/server/inventory/stock-types";

const viewTabs: { key: InventoryOperationView; labelKey: string; defaultLabel: string; icon: React.ElementType }[] = [
  { key: "all", labelKey: "inventory.allOperations", defaultLabel: "All Operations", icon: Boxes },
  { key: "receipts", labelKey: "inventory.receipts", defaultLabel: "Receipts", icon: ArrowDownLeft },
  { key: "deliveries", labelKey: "inventory.deliveries", defaultLabel: "Deliveries", icon: ArrowUpRight },
  { key: "transfers", labelKey: "inventory.internalTransfers", defaultLabel: "Internal Transfers", icon: ArrowLeftRight },
  { key: "adjustments", labelKey: "inventory.adjustments", defaultLabel: "Adjustments", icon: Sliders },
  { key: "scrap", labelKey: "inventory.scrapAndWaste", defaultLabel: "Scrap & Waste", icon: PackageMinus },
  { key: "returns", labelKey: "inventory.returns", defaultLabel: "Returns", icon: RotateCcw },
];

function MovementTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  const normalized = type.toLowerCase();
  if (normalized.includes("receipt") || normalized.includes("in")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <ArrowDownLeft className="size-3" />
        {t("inventory.receipts", "Receipt")}
      </span>
    );
  }
  if (normalized.includes("delivery") || normalized.includes("out")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
        <ArrowUpRight className="size-3" />
        {t("inventory.deliveries", "Delivery")}
      </span>
    );
  }
  if (normalized.includes("transfer")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
        <ArrowLeftRight className="size-3" />
        {t("inventory.internalTransfers", "Transfer")}
      </span>
    );
  }
  if (normalized.includes("adjust")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
        <Sliders className="size-3" />
        {t("inventory.adjustments", "Adjustment")}
      </span>
    );
  }
  if (normalized.includes("scrap")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
        <Trash2 className="size-3" />
        {t("inventory.scrapAndWaste", "Scrap")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground capitalize">
      {type.replace(/_/g, " ")}
    </span>
  );
}

export type OperationsTableClientProps = {
  rows: InventoryOperationListRow[];
  view: InventoryOperationView;
  query: string;
  formOptions: InventoryOperationFormOptions & { balances: any[] };
  initialSelectedId?: string;
};

export function OperationsTableClient({
  rows,
  view,
  query,
  formOptions,
  initialSelectedId,
}: OperationsTableClientProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useViewMode("inventory_operations", "table");
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(initialSelectedId ?? null);

  const renderEmptyState = () => (
    <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
        <Boxes className="size-6" />
      </div>
      <p className="font-bold text-sm text-foreground">{t("inventory.noOperationsRecorded", "No operations recorded")}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("inventory.noOperationsFound", "No inventory movements found for this view. Use the actions above to record a transfer, adjustment, or scrap.")}
      </p>
    </div>
  );

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
        {/* Filter Toolbar */}
        <div className="border-b border-border/80 bg-card p-4 space-y-3.5">
          {/* Segmented Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            {viewTabs.map((tab) => {
              const Icon = tab.icon;
              const isSelected = view === tab.key;
              const href = tab.key === "all" ? "/admin/inventory/operations" : `/admin/inventory/operations?view=${tab.key}`;

              return (
                <Link
                  key={tab.key}
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap",
                    isSelected
                      ? "bg-[#0B5D4B] text-white shadow-xs"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50",
                  )}
                >
                  <Icon className={cn("size-3.5", isSelected ? "text-emerald-200" : "text-muted-foreground")} />
                  {t(tab.labelKey, tab.defaultLabel)}
                </Link>
              );
            })}
          </div>

          <TableFilterBar
            searchPlaceholder={t("inventory.searchOperationsPlaceholder", "Search movement number, source document reference, or notes...")}
            filterParamNames={["locationId", "status"]}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          >
            <TableFilterSelect
              paramName="locationId"
              label={t("status.warehouse", "Warehouse")}
              options={formOptions.locations.map((loc) => ({
                value: loc.id,
                label: `${loc.code} - ${loc.name}`,
              }))}
              allLabel={t("action.allLocations", "All Locations")}
            />
            <TableFilterSelect
              paramName="status"
              label={t("table.status", "Status")}
              options={[
                { value: "draft", label: t("inventory.draft", "Draft") },
                { value: "confirmed", label: t("inventory.confirmed", "Confirmed") },
                { value: "done", label: t("inventory.done", "Done") },
                { value: "cancelled", label: t("inventory.cancelled", "Cancelled") },
              ]}
              allLabel={t("action.allStatuses", "All Statuses")}
            />
          </TableFilterBar>
        </div>

        {/* Operations Content */}
        {viewMode === "grid" ? (
          <div className="p-4 sm:p-5">
            {rows.length === 0 ? (
              renderEmptyState()
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    onClick={() => setSelectedOperationId(row.id)}
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md cursor-pointer"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOperationId(row.id);
                            }}
                            className="font-mono text-sm font-bold text-primary hover:underline text-left cursor-pointer"
                          >
                            {row.movementNo}
                          </button>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {new Date(row.movementDate).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge status={row.status} />
                          <MovementTypeBadge type={row.movementType} />
                        </div>
                      </div>

                      <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">From:</span>
                          <span className="font-semibold text-foreground">{row.fromLocationCode ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">To:</span>
                          <span className="font-semibold text-foreground">{row.toLocationCode ?? "—"}</span>
                        </div>
                        {row.sourceNo ? (
                          <div className="text-muted-foreground pt-1 border-t border-border/50">
                            Ref: <span className="font-mono">{row.sourceNo}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                          {t("table.totalQty", "Total Qty")}
                        </div>
                        <div className="font-mono text-sm font-bold text-foreground">
                          {displayQuantity(row.totalQuantity)} ({row.lineCount} lines)
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOperationId(row.id);
                        }}
                        className="h-8 gap-1 px-3 text-xs font-semibold"
                      >
                        <Eye className="size-3.5" />
                        <span>{t("action.view", "View")}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : viewMode === "list" ? (
          <div>
            {rows.length === 0 ? (
              renderEmptyState()
            ) : (
              <div className="divide-y divide-border/60">
                {rows.map((row) => (
                  <div
                    key={row.id}
                    onClick={() => setSelectedOperationId(row.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30 cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                      <div className="shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOperationId(row.id);
                          }}
                          className="font-mono text-sm font-bold text-primary hover:underline text-left cursor-pointer"
                        >
                          {row.movementNo}
                        </button>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(row.movementDate).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <MovementTypeBadge type={row.movementType} />
                          <StatusBadge status={row.status} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{row.fromLocationCode ?? "—"} → {row.toLocationCode ?? "—"}</span>
                          {row.sourceNo ? <span>· Ref: {row.sourceNo}</span> : null}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                          {t("table.totalQty", "Total Qty")}
                        </div>
                        <div className="font-mono text-sm font-bold text-foreground">
                          {displayQuantity(row.totalQuantity)}
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOperationId(row.id);
                        }}
                        className="h-8 gap-1 px-3 text-xs font-semibold"
                      >
                        <Eye className="size-3.5" />
                        <span>{t("action.view", "View")}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3.5">{t("table.movementNo", "Movement No")}</th>
                  <th className="px-4 py-3.5">{t("table.type", "Type")}</th>
                  <th className="px-4 py-3.5">{t("table.status", "Status")}</th>
                  <th className="px-4 py-3.5">{t("table.date", "Date")}</th>
                  <th className="px-4 py-3.5">{t("table.origin", "Origin")}</th>
                  <th className="px-4 py-3.5">{t("table.destination", "Destination")}</th>
                  <th className="px-4 py-3.5 text-right">{t("table.lines", "Lines")}</th>
                  <th className="px-4 py-3.5 text-right">{t("table.totalQty", "Total Qty")}</th>
                  <th className="px-4 py-3.5 text-right">{t("table.valuation", "Valuation")}</th>
                  <th className="px-4 py-3.5 text-right">{t("table.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => (
                  <ClickableTableRow
                    key={row.id}
                    onClickRow={() => setSelectedOperationId(row.id)}
                  >
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOperationId(row.id);
                        }}
                        className="font-mono text-xs font-bold text-primary group-hover:underline text-left cursor-pointer"
                      >
                        {row.movementNo}
                      </button>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{row.sourceNo ?? row.sourceType ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <MovementTypeBadge type={row.movementType} />
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium">
                      {new Date(row.movementDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-foreground text-xs">{row.fromLocationCode ?? "—"}</td>
                    <td className="px-4 py-3.5 font-medium text-foreground text-xs">{row.toLocationCode ?? "—"}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">{row.lineCount}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                      {displayQuantity(row.totalQuantity)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">
                      {row.currencyCode ? displayMoneyMinor(row.totalCostMinor, row.currencyCode) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOperationId(row.id);
                        }}
                        className="h-8 gap-1 px-2.5 text-xs font-semibold"
                      >
                        <Eye className="size-3" />
                        {t("action.view", "View")}
                      </Button>
                    </td>
                  </ClickableTableRow>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center">
                      {renderEmptyState()}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Operation Detail Modal */}
      <OperationDetailModal
        operationId={selectedOperationId}
        onClose={() => setSelectedOperationId(null)}
        returnPath={`/admin/inventory/operations${view !== "all" ? `?view=${view}` : ""}`}
      />
    </>
  );
}
