import Link from "next/link";
import { Search } from "lucide-react";

import { InventoryNavTabs } from "@/app/admin/inventory/inventory-nav-tabs";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import {
  displayMoneyMinor,
  displayQuantity,
  getInventoryOperationList,
  parseInventoryOperationView,
} from "@/server/inventory/stock";
import type { InventoryOperationListRow, InventoryOperationView } from "@/server/inventory/stock-types";

export const dynamic = "force-dynamic";

type InventoryOperationsPageProps = {
  searchParams: Promise<{
    view?: string;
    q?: string;
  }>;
};

const viewLabels: Record<InventoryOperationView, string> = {
  all: "Operations Ledger",
  receipts: "Receipt Movements",
  deliveries: "Delivery Movements",
  transfers: "Internal Transfers",
  adjustments: "Inventory Adjustments",
  scrap: "Scrap & Waste",
  returns: "Return Movements",
};

export default async function InventoryOperationsPage({ searchParams }: InventoryOperationsPageProps) {
  await requirePermission("inventory.view");

  const params = await searchParams;
  const view = parseInventoryOperationView(params.view);
  const query = params.q ?? "";
  const rows = await getInventoryOperationList({ view, query });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory Workspace"
        title={viewLabels[view]}
        description="Physical stock movement records, transfers, adjustments, and receipts."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/inventory/operations/internal-transfers/new" size="sm">
              New Transfer
            </ButtonLink>
            <ButtonLink href="/admin/inventory/operations/adjustments/new" variant="outline" size="sm">
              New Adjustment
            </ButtonLink>
            <ButtonLink href="/admin/inventory/operations/scrap/new" variant="outline" size="sm">
              New Scrap
            </ButtonLink>
          </div>
        }
      />

      <InventoryNavTabs currentHref="/admin/inventory/operations" />

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <form className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/20 p-4">
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Search Movements
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                name="q"
                defaultValue={query}
                placeholder="Movement number, source document, or notes..."
                className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm font-normal text-foreground"
              />
            </div>
          </label>
          <label className="flex min-w-48 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Movement Type
            <select
              name="view"
              defaultValue={view}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground"
            >
              <option value="all">All Operations</option>
              <option value="receipts">Receipts</option>
              <option value="deliveries">Deliveries</option>
              <option value="transfers">Internal Transfers</option>
              <option value="adjustments">Adjustments</option>
              <option value="scrap">Scrap</option>
              <option value="returns">Returns</option>
            </select>
          </label>
          <Button type="submit" className="h-10 px-4 font-semibold">
            Filter
          </Button>
        </form>

        <InventoryOperationList rows={rows} />
      </section>
    </PageShell>
  );
}

function InventoryOperationList({ rows }: { rows: InventoryOperationListRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Movement No</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Origin</th>
            <th className="px-4 py-3">Destination</th>
            <th className="px-4 py-3 text-right">Lines</th>
            <th className="px-4 py-3 text-right">Total Qty</th>
            <th className="px-4 py-3 text-right">Valuation</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={row.id}
              className="transition-colors hover:bg-[rgba(235,239,234,0.45)] dark:hover:bg-muted/30"
            >
              <td className="px-4 py-3.5">
                <Link
                  href={`/admin/inventory/operations/${row.id}`}
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {row.movementNo}
                </Link>
                <div className="text-xs text-muted-foreground">{row.sourceNo ?? row.sourceType ?? "—"}</div>
              </td>
              <td className="px-4 py-3.5 capitalize text-foreground">{row.movementType.replace(/_/g, " ")}</td>
              <td className="px-4 py-3.5">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3.5 text-xs text-muted-foreground">{new Date(row.movementDate).toLocaleDateString()}</td>
              <td className="px-4 py-3.5 font-medium text-foreground">{row.fromLocationCode ?? "—"}</td>
              <td className="px-4 py-3.5 font-medium text-foreground">{row.toLocationCode ?? "—"}</td>
              <td className="px-4 py-3.5 text-right font-mono text-xs text-foreground">{row.lineCount}</td>
              <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">{displayQuantity(row.totalQuantity)}</td>
              <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                {row.currencyCode ? displayMoneyMinor(row.totalCostMinor, row.currencyCode) : "—"}
              </td>
              <td className="px-4 py-3.5 text-right">
                <ButtonLink href={`/admin/inventory/operations/${row.id}`} size="sm" variant="outline" className="h-7 text-xs">
                  View
                </ButtonLink>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                No inventory operations found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
