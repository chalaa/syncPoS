import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getProductPriceListRows } from "@/server/catalog/products";
import type { ProductPriceListRow } from "@/server/catalog/types";

export const dynamic = "force-dynamic";

export default async function ProductPriceListsPage() {
  await requirePermission("product.view");

  const rows = await getProductPriceListRows();

  return (
    <PageShell>
      <PageHeader
        eyebrow="Catalog"
        title="Price Lists"
        actions={<ButtonLink href="/admin/products" variant="outline">Products</ButtonLink>}
      />

      <section className="rounded-lg border border-border bg-card">
        <PriceListTable rows={rows} />
      </section>
    </PageShell>
  );
}

function PriceListTable({ rows }: { rows: ProductPriceListRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3">Price List</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Currency</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3 text-right">Items</th>
            <th className="px-4 py-3">Validity</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{row.code}</td>
              <td className="px-4 py-3">{row.name}</td>
              <td className="px-4 py-3 capitalize">{row.priceListType.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">{row.currencyCode}</td>
              <td className="px-4 py-3">{row.locationCode ?? "-"}</td>
              <td className="px-4 py-3 text-right">{row.itemCount}</td>
              <td className="px-4 py-3">{row.validFrom ?? "-"} / {row.validTo ?? "-"}</td>
              <td className="px-4 py-3">{row.isActive ? "Active" : "Inactive"}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                No price lists found.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
