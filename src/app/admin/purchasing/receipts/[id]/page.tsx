import Link from "next/link";
import { notFound } from "next/navigation";

import { createVendorBillFromReceipt } from "@/app/admin/purchasing/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import {
  displayPurchaseMoney,
  getPurchaseReceiptDetail,
} from "@/server/purchasing/purchasing";

export const dynamic = "force-dynamic";

type ReceiptDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function ReceiptDetailPage({ params, searchParams }: ReceiptDetailPageProps) {
  await requirePermission("inventory.receive");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const receipt = await getPurchaseReceiptDetail(id);

  if (!receipt) {
    notFound();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Purchasing / Receipt"
        title={receipt.receiptNo}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/purchasing?view=receipts" variant="outline">Back to receipts</ButtonLink>
            <ButtonLink href={`/admin/purchasing?view=landed-costs&purchaseOrderId=${receipt.purchaseOrderId}`} variant="outline">
              Landed Costs {receipt.landedCostCount}
            </ButtonLink>
            <ButtonLink href={`/admin/purchasing/landed-costs/new?receiptId=${receipt.id}`} variant="outline">Add Landed Cost</ButtonLink>
            {receipt.existingVendorBillId ? (
              <ButtonLink href={`/admin/purchasing/vendor-bills/vendor_bill/${receipt.existingVendorBillId}`}>Open Vendor Bill</ButtonLink>
            ) : (
              <form action={createVendorBillFromReceipt}>
                <input type="hidden" name="receiptId" value={receipt.id} />
                <Button>Create Vendor Bill</Button>
              </form>
            )}
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Purchase Order</p>
            <Link href={`/admin/purchasing/${receipt.purchaseOrderId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
              {receipt.orderNo}
            </Link>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Supplier</p>
            <p className="mt-1 text-sm font-medium">{receipt.supplierName}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium capitalize">{statusLabel(receipt.status)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Total</p>
            <p className="mt-1 text-sm font-medium">{displayPurchaseMoney(receipt.totalMinor, receipt.currencyCode)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Receipt Date</p>
            <p className="mt-1 text-sm font-medium">{receipt.receiptDate}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Location</p>
            <p className="mt-1 text-sm font-medium">{receipt.locationCode ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Supplier Invoice</p>
            <p className="mt-1 text-sm font-medium">{receipt.supplierInvoiceNo ?? "-"}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">Quantity</th>
                <th className="px-3 py-2">Tracking</th>
                <th className="px-3 py-2 text-right">Unit Cost</th>
                <th className="px-3 py-2 text-right">Landed Cost</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((line) => (
                <tr key={line.id} className="border-b border-border/70">
                  <td className="px-3 py-3">
                    <div className="font-medium">{line.productName}</div>
                    <div className="text-xs text-muted-foreground">{line.sku}</div>
                  </td>
                  <td className="px-3 py-3 text-right">{line.quantityReceived}</td>
                  <td className="px-3 py-3">{line.serialNo ?? line.lotNo ?? "-"}</td>
                  <td className="px-3 py-3 text-right">{displayPurchaseMoney(line.unitCostMinor, line.currencyCode)}</td>
                  <td className="px-3 py-3 text-right">{displayPurchaseMoney(line.landedUnitCostMinor, line.currencyCode)}</td>
                  <td className="px-3 py-3 text-right">{displayPurchaseMoney(line.lineTotalMinor, line.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
