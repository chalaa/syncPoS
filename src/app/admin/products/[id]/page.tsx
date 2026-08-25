import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import {
  formatProductType,
  getProductDetail,
  minorToDisplay,
} from "@/server/catalog/products";
import { displayMoneyMinor, displayQuantity } from "@/server/inventory/stock";

export const dynamic = "force-dynamic";

type ProductDetailPageProps = {
  params: Promise<{ id: string }>;
};

function trackingLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  await requirePermission("product.view");

  const { id } = await params;
  const product = await getProductDetail(id);

  if (!product) {
    notFound();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Product"
        title={product.name}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/products" variant="outline">
              Back
            </ButtonLink>
            <ButtonLink href={`/admin/products/${product.id}/edit`} variant="default">
              Edit
            </ButtonLink>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1 text-sm">
          <div className="text-xl font-semibold">{product.sku}</div>
          <div className="text-muted-foreground">
            {[product.brandName, product.categoryName, product.model].filter(Boolean).join(" / ") || "No category"}
          </div>
          <div className="flex flex-wrap gap-2 pt-2 text-xs">
            <span className="rounded-md border border-border bg-muted px-2 py-1 capitalize">
              {formatProductType(product.productType)}
            </span>
            <span className="rounded-md border border-border bg-muted px-2 py-1">
              Tracking: {trackingLabel(product.trackingMode)}
            </span>
            <span className="rounded-md border border-border bg-muted px-2 py-1">
              UoM: {product.unitCode}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href="#inventory" className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{displayQuantity(product.quantityOnHand)}</span>
            <span className="text-muted-foreground">On Hand</span>
          </a>
          <a href="#inventory" className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{displayQuantity(product.incomingQuantity)}</span>
            <span className="text-muted-foreground">Incoming</span>
          </a>
          <a href="#tracking" className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{product.trackingRows.length}</span>
            <span className="text-muted-foreground">Lots / Serials</span>
          </a>
          <a href="#moves" className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{product.movementCount}</span>
            <span className="text-muted-foreground">Moves</span>
          </a>
          <a href={`/admin/purchasing?view=receipts`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{product.receiptCount}</span>
            <span className="text-muted-foreground">Receipts</span>
          </a>
        </div>
      </div>

      <Notebook
        defaultValue="general"
        items={[
          {
            value: "general",
            label: "General Information",
            content: (
              <div className="grid gap-5 md:grid-cols-2">
                <section className="grid gap-3 text-sm">
                  <InfoRow label="Barcode" value={product.barcode ?? "-"} />
                  <InfoRow label="Product Type" value={formatProductType(product.productType)} />
                  <InfoRow label="Category" value={product.categoryName ?? "-"} />
                  <InfoRow label="Brand" value={product.brandName ?? "-"} />
                  <InfoRow label="Unit" value={`${product.unitCode} / ${product.unitName}`} />
                  <InfoRow label="Status" value={product.isActive ? "Active" : "Inactive"} />
                </section>
                <section className="grid gap-3 text-sm">
                  <InfoRow label="Tracking" value={trackingLabel(product.trackingMode)} />
                  <InfoRow label="Model" value={product.model ?? "-"} />
                  <InfoRow label="Description" value={product.description ?? "-"} />
                </section>
              </div>
            ),
          },
          {
            value: "sales",
            label: "Sales",
            content: (
              <section className="grid gap-3 text-sm md:grid-cols-2">
                <InfoRow label="Sales Unit Price" value={`${product.currencyCode} ${minorToDisplay(product.listPriceMinor)}`} />
                <InfoRow label="Customer Taxes" value={product.saleTaxNames || "-"} />
              </section>
            ),
          },
          {
            value: "purchase",
            label: "Purchase",
            content: (
              <section className="grid gap-3 text-sm md:grid-cols-2">
                <InfoRow label="Purchase Unit Cost" value={`${product.currencyCode} ${minorToDisplay(product.standardCostMinor)}`} />
                <InfoRow label="Vendor Taxes" value={product.purchaseTaxNames || "-"} />
              </section>
            ),
          },
          {
            value: "inventory",
            label: "Inventory",
            content: (
              <section id="inventory" className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Metric label="On hand" value={displayQuantity(product.quantityOnHand)} />
                  <Metric label="Reserved" value={displayQuantity(product.quantityReserved)} />
                  <Metric label="Available" value={displayQuantity(product.quantityAvailable)} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[840px] text-left text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-3 py-2">Location</th>
                        <th className="px-3 py-2">Tracking</th>
                        <th className="px-3 py-2 text-right">On hand</th>
                        <th className="px-3 py-2 text-right">Reserved</th>
                        <th className="px-3 py-2 text-right">Available</th>
                        <th className="px-3 py-2 text-right">Average Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.stockRows.map((row) => (
                        <tr key={row.stockBalanceId} className="border-b border-border/70">
                          <td className="px-3 py-3">
                            <div className="font-medium">{row.locationCode}</div>
                            <div className="text-xs text-muted-foreground">{row.locationName}</div>
                          </td>
                          <td className="px-3 py-3">{row.serialNo ?? row.lotNo ?? "Bulk"}</td>
                          <td className="px-3 py-3 text-right">{displayQuantity(row.quantityOnHand)}</td>
                          <td className="px-3 py-3 text-right">{displayQuantity(row.quantityReserved)}</td>
                          <td className="px-3 py-3 text-right">{displayQuantity(row.quantityAvailable)}</td>
                          <td className="px-3 py-3 text-right">{displayMoneyMinor(row.averageCostMinor, row.currencyCode)}</td>
                        </tr>
                      ))}
                      {product.stockRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                            No stock balances yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            ),
          },
          {
            value: "tracking",
            label: "Lots / Serials",
            content: (
              <section id="tracking" className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2 text-right">Quantity</th>
                      <th className="px-3 py-2 text-right">Landed Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.trackingRows.map((row) => (
                      <tr key={`${row.kind}-${row.id}`} className="border-b border-border/70">
                        <td className="px-3 py-3 capitalize">{row.kind}</td>
                        <td className="px-3 py-3 font-medium">{row.referenceNo}</td>
                        <td className="px-3 py-3 capitalize">{trackingLabel(row.status)}</td>
                        <td className="px-3 py-3">{row.currentLocationCode ?? "-"}</td>
                        <td className="px-3 py-3 text-right">{displayQuantity(row.quantityOnHand)}</td>
                        <td className="px-3 py-3 text-right">
                          {row.landedUnitCostMinor === null ? "-" : displayMoneyMinor(row.landedUnitCostMinor, product.currencyCode)}
                        </td>
                      </tr>
                    ))}
                    {product.trackingRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                          No lots or serials yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>
            ),
          },
          {
            value: "moves",
            label: "Moves",
            content: (
              <section id="moves" className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2">Movement</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">From</th>
                      <th className="px-3 py-2">To</th>
                      <th className="px-3 py-2">Tracking</th>
                      <th className="px-3 py-2 text-right">Quantity</th>
                      <th className="px-3 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.movementRows.map((row) => (
                      <tr key={`${row.movementId}-${row.serialNo ?? row.lotNo ?? row.quantity}`} className="border-b border-border/70">
                        <td className="px-3 py-3">
                          <div className="font-medium">{row.movementNo}</div>
                          <div className="text-xs text-muted-foreground">
                            {trackingLabel(row.movementType)} / {row.sourceNo ?? "-"}
                          </div>
                        </td>
                        <td className="px-3 py-3">{row.movementDate.toLocaleDateString()}</td>
                        <td className="px-3 py-3">{row.fromLocationCode ?? "-"}</td>
                        <td className="px-3 py-3">{row.toLocationCode ?? "-"}</td>
                        <td className="px-3 py-3">{row.serialNo ?? row.lotNo ?? "Bulk"}</td>
                        <td className="px-3 py-3 text-right">{displayQuantity(row.quantity)}</td>
                        <td className="px-3 py-3 text-right">{displayMoneyMinor(row.totalCostMinor, row.currencyCode)}</td>
                      </tr>
                    ))}
                    {product.movementRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                          No stock moves yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>
            ),
          },
        ]}
      />
    </PageShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border/70 pb-2">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
