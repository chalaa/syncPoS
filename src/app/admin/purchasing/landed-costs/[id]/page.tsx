import Link from "next/link";
import { notFound } from "next/navigation";

import { postLandedCost } from "@/app/admin/purchasing/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import {
  displayPurchaseMoney,
  getPurchaseLandedCostDetail,
} from "@/server/purchasing/purchasing";

export const dynamic = "force-dynamic";

type LandedCostDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function LandedCostDetailPage({ params, searchParams }: LandedCostDetailPageProps) {
  await requirePermission("inventory.receive");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const cost = await getPurchaseLandedCostDetail(id);

  if (!cost) {
    notFound();
  }
  const allocationTotalMinor = cost.allocations.reduce((sum, allocation) => sum + allocation.allocatedAmountMinor, 0);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Purchasing / Landed Cost"
        title={cost.costNo}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/purchasing?view=landed-costs" variant="outline">Back to landed costs</ButtonLink>
            {cost.status !== "posted" && cost.status !== "cancelled" ? (
              <ButtonLink href={`/admin/purchasing/landed-costs/${cost.id}/edit`} variant="outline">Edit</ButtonLink>
            ) : null}
            {cost.status === "allocated" ? (
              <form action={postLandedCost}>
                <input type="hidden" name="landedCostId" value={cost.id} />
                <Button>Post to Inventory</Button>
              </form>
            ) : null}
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium capitalize">{statusLabel(cost.status)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Type</p>
            <p className="mt-1 text-sm font-medium capitalize">{statusLabel(cost.costType)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Allocation</p>
            <p className="mt-1 text-sm font-medium capitalize">{statusLabel(cost.allocationMethod)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Amount</p>
            <p className="mt-1 text-sm font-medium">{displayPurchaseMoney(cost.amountMinor, cost.currencyCode)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Purchase Order</p>
            {cost.purchaseOrderId ? (
              <Link href={`/admin/purchasing/${cost.purchaseOrderId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                {cost.orderNo}
              </Link>
            ) : (
              <p className="mt-1 text-sm font-medium">-</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Receipt</p>
            {cost.goodsReceiptId ? (
              <Link href={`/admin/purchasing/receipts/${cost.goodsReceiptId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                {cost.receiptNo}
              </Link>
            ) : (
              <p className="mt-1 text-sm font-medium">-</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Vendor</p>
            <p className="mt-1 text-sm font-medium">{cost.vendorName ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Notes</p>
            <p className="mt-1 text-sm font-medium">{cost.notes ?? "-"}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Receipt Cost</th>
                <th className="px-3 py-2 text-right">Current Landed</th>
                <th className="px-3 py-2 text-right">Basis</th>
                <th className="px-3 py-2 text-right">Allocated</th>
              </tr>
            </thead>
            <tbody>
              {cost.allocations.map((allocation) => (
                <tr key={allocation.id} className="border-b border-border/70">
                  <td className="px-3 py-3">
                    <div className="font-medium">{allocation.productName}</div>
                    <div className="text-xs text-muted-foreground">{allocation.sku}</div>
                  </td>
                  <td className="px-3 py-3 text-right">{allocation.quantityReceived}</td>
                  <td className="px-3 py-3 text-right">{displayPurchaseMoney(allocation.unitCostMinor, allocation.currencyCode)}</td>
                  <td className="px-3 py-3 text-right">{displayPurchaseMoney(allocation.landedUnitCostMinor, allocation.currencyCode)}</td>
                  <td className="px-3 py-3 text-right">{allocation.allocationBasis ?? "-"}</td>
                  <td className="px-3 py-3 text-right">{displayPurchaseMoney(allocation.allocatedAmountMinor, allocation.currencyCode)}</td>
                </tr>
              ))}
              <tr className="border-t border-border bg-muted/40 font-semibold">
                <td colSpan={5} className="px-3 py-3 text-right">Allocation Total</td>
                <td className="px-3 py-3 text-right">{displayPurchaseMoney(allocationTotalMinor, cost.currencyCode)}</td>
              </tr>
              {cost.allocations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No receipt lines allocated.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
