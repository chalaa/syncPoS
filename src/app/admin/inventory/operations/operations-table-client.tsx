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
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(initialSelectedId ?? null);

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

        {/* Operations Table */}
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
                    <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                      <Boxes className="size-6" />
                    </div>
                    <p className="font-bold text-sm text-foreground">{t("inventory.noOperationsRecorded", "No operations recorded")}</p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                      {t("inventory.noOperationsFound", "No inventory movements found for this view. Use the actions above to record a transfer, adjustment, or scrap.")}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
