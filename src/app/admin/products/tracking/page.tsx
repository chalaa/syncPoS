import Link from "next/link";

import { ProductNavTabs } from "@/app/admin/products/product-nav-tabs";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getProductTrackingRows, minorToDisplay } from "@/server/catalog/products";
import type { ProductTrackingListRow } from "@/server/catalog/types";
import { displayQuantity } from "@/server/inventory/stock";

export const dynamic = "force-dynamic";

export default async function ProductTrackingPage() {
  await requirePermission("product.view");

  const rows = await getProductTrackingRows();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog Management"
        title="Lots & Serial Tracking"
        description="Trace serialized machinery and batch-tracked components across locations."
        actions={<ButtonLink href="/admin/products" variant="outline">Back to Products</ButtonLink>}
      />

      <ProductNavTabs currentHref="/admin/products/tracking" />

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <TrackingTable rows={rows} />
      </section>
    </PageShell>
  );
}

function TrackingTable({ rows }: { rows: ProductTrackingListRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Tracking Mode</th>
            <th className="px-4 py-3">Reference / Serial</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Current Location</th>
            <th className="px-4 py-3 text-right">On Hand</th>
            <th className="px-4 py-3 text-right">Landed Cost</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr
              key={`${row.kind}-${row.id}`}
              className="transition-colors hover:bg-[rgba(235,239,234,0.45)] dark:hover:bg-muted/30"
            >
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded border border-border bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-secondary-foreground">
                  {row.kind}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                {row.referenceNo}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/admin/products/${row.productId}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {row.sku}
                </Link>
                <div className="text-xs text-muted-foreground">{row.productName}</div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3 text-foreground font-medium">
                {row.currentLocationCode ?? "—"}
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-foreground">
                {displayQuantity(row.quantityOnHand)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                {row.landedUnitCostMinor === null
                  ? "—"
                  : `ETB ${minorToDisplay(row.landedUnitCostMinor)}`}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                No lots or serials tracked in inventory yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
