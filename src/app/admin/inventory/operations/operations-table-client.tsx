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
import { cn } from "@/lib/utils";
import {
  displayMoneyMinor,
  displayQuantity,
  type InventoryOperationDetail,
  type InventoryOperationFormOptions,
  type InventoryOperationListRow,
  type InventoryOperationView,
} from "@/server/inventory/stock-types";

const viewTabs: { key: InventoryOperationView; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All Operations", icon: Boxes },
  { key: "receipts", label: "Receipts", icon: ArrowDownLeft },
  { key: "deliveries", label: "Deliveries", icon: ArrowUpRight },
  { key: "transfers", label: "Internal Transfers", icon: ArrowLeftRight },
  { key: "adjustments", label: "Adjustments", icon: Sliders },
  { key: "scrap", label: "Scrap & Waste", icon: PackageMinus },
  { key: "returns", label: "Returns", icon: RotateCcw },
];

function MovementTypeBadge({ type }: { type: string }) {
  const normalized = type.toLowerCase();
  if (normalized.includes("receipt") || normalized.includes("in")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <ArrowDownLeft className="size-3" />
        Receipt
      </span>
    );
  }
  if (normalized.includes("delivery") || normalized.includes("out")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
        <ArrowUpRight className="size-3" />
        Delivery
      </span>
    );
  }
  if (normalized.includes("transfer")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
        <ArrowLeftRight className="size-3" />
        Transfer
      </span>
    );
  }
  if (normalized.includes("adjust")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
        <Sliders className="size-3" />
        Adjustment
      </span>
    );
  }
  if (normalized.includes("scrap")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
        <Trash2 className="size-3" />
        Scrap
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
                  {tab.label}
                </Link>
              );
            })}
          </div>

          {/* Search form */}
          <form method="GET" className="flex items-center gap-3">
            <input type="hidden" name="view" value={view} />
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Search movement number, source document reference, or notes..."
                className="h-10 w-full rounded-xl border border-border/80 bg-background pl-9 pr-4 text-xs outline-none focus:border-[#0B5D4B] focus:ring-2 focus:ring-[#0B5D4B]/20 transition-all font-medium"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="h-10 px-4 text-xs font-semibold border-border/80"
            >
              Filter
            </Button>
            {query && (
              <Button asChild variant="ghost" size="sm" className="h-10 px-3 text-xs text-muted-foreground">
                <Link href={view === "all" ? "/admin/inventory/operations" : `/admin/inventory/operations?view=${view}`}>
                  Reset
                </Link>
              </Button>
            )}
          </form>
        </div>

        {/* Operations Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border/80 bg-muted/30 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3.5">Movement No</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Origin</th>
                <th className="px-4 py-3.5">Destination</th>
                <th className="px-4 py-3.5 text-right">Lines</th>
                <th className="px-4 py-3.5 text-right">Total Qty</th>
                <th className="px-4 py-3.5 text-right">Valuation</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedOperationId(row.id)}
                  className="group transition-colors hover:bg-[#0B5D4B]/5 dark:hover:bg-[#0B5D4B]/10 cursor-pointer"
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
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                      <Boxes className="size-6" />
                    </div>
                    <p className="font-bold text-sm text-foreground">No operations recorded</p>
                    <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                      No inventory movements found for this view. Use the actions above to record a transfer, adjustment, or scrap.
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
