import Link from "next/link";

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
        eyebrow="Catalog"
        title="Lots / Serials"
        actions={<ButtonLink href="/admin/products" variant="outline">Products</ButtonLink>}
      />

      <section className="rounded-lg border border-border bg-card">
        <TrackingTable rows={rows} />
      </section>
    </PageShell>
  );
}

function TrackingTable({ rows }: { rows: ProductTrackingListRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Reference</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3 text-right">On Hand</th>
            <th className="px-4 py-3 text-right">Landed Cost</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.kind}-${row.id}`} className="border-t border-border">
              <td className="px-4 py-3 capitalize">{row.kind}</td>
              <td className="px-4 py-3 font-medium">{row.referenceNo}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/products/${row.productId}`} className="text-primary underline-offset-4 hover:underline">
                  {row.sku}
                </Link>
                <div className="text-xs text-muted-foreground">{row.productName}</div>
              </td>
              <td className="px-4 py-3 capitalize">{row.status.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">{row.currentLocationCode ?? "-"}</td>
              <td className="px-4 py-3 text-right">{displayQuantity(row.quantityOnHand)}</td>
              <td className="px-4 py-3 text-right">
                {row.landedUnitCostMinor === null ? "-" : minorToDisplay(row.landedUnitCostMinor)}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                No lots or serials found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
