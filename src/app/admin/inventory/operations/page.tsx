import Link from "next/link";

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
  all: "Operations",
  receipts: "Receipts",
  deliveries: "Deliveries",
  transfers: "Internal Transfers",
  adjustments: "Adjustments",
  scrap: "Scrap",
  returns: "Returns",
};

export default async function InventoryOperationsPage({ searchParams }: InventoryOperationsPageProps) {
  await requirePermission("inventory.view");

  const params = await searchParams;
  const view = parseInventoryOperationView(params.view);
  const query = params.q ?? "";
  const rows = await getInventoryOperationList({ view, query });
  const canCreateManualOperation = view !== "receipts" && view !== "deliveries";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory"
        title={viewLabels[view]}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/inventory" variant="outline">Stock</ButtonLink>
            {canCreateManualOperation ? (
              <ButtonLink href="/admin/inventory/operations/new">New Operation</ButtonLink>
            ) : null}
          </div>
        }
      />

      <section className="rounded-lg border border-border bg-card">
        <form className="flex flex-wrap items-end gap-3 border-b border-border p-4">
          <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm font-medium">
            Search
            <input
              name="q"
              defaultValue={query}
              placeholder="Operation, source, or notes"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="flex min-w-48 flex-col gap-1 text-sm font-medium">
            Operation
            <select name="view" defaultValue={view} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="all">All</option>
              <option value="receipts">Receipts</option>
              <option value="deliveries">Deliveries</option>
              <option value="transfers">Internal Transfers</option>
              <option value="adjustments">Adjustments</option>
              <option value="scrap">Scrap</option>
              <option value="returns">Returns</option>
            </select>
          </label>
          <Button>Apply</Button>
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
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Operation</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">From</th>
            <th className="px-4 py-3">To</th>
            <th className="px-4 py-3 text-right">Lines</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Value</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-4 py-3">
                <Link href={`/admin/inventory/operations/${row.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                  {row.movementNo}
                </Link>
                <div className="text-xs text-muted-foreground">{row.sourceNo ?? row.sourceType ?? "-"}</div>
              </td>
              <td className="px-4 py-3 capitalize">{row.movementType.replace(/_/g, " ")}</td>
              <td className="px-4 py-3 capitalize">{row.status}</td>
              <td className="px-4 py-3">{new Date(row.movementDate).toLocaleDateString()}</td>
              <td className="px-4 py-3">{row.fromLocationCode ?? "-"}</td>
              <td className="px-4 py-3">{row.toLocationCode ?? "-"}</td>
              <td className="px-4 py-3 text-right">{row.lineCount}</td>
              <td className="px-4 py-3 text-right">{displayQuantity(row.totalQuantity)}</td>
              <td className="px-4 py-3 text-right">
                {row.currencyCode ? displayMoneyMinor(row.totalCostMinor, row.currencyCode) : "-"}
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end">
                  <ButtonLink href={`/admin/inventory/operations/${row.id}`} size="sm">
                    Open
                  </ButtonLink>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                No inventory operations found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
