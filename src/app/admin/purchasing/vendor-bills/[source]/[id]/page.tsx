import Link from "next/link";
import { notFound } from "next/navigation";

import { cancelVendorBill, postVendorBill } from "@/app/admin/purchasing/actions";
import { registerSupplierPayment } from "@/app/admin/purchasing/payments/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getActivePaymentAccounts } from "@/server/payments/payments";
import {
  displayPurchaseMoney,
  getPurchaseVendorBillDetail,
} from "@/server/purchasing/purchasing";

export const dynamic = "force-dynamic";

type VendorBillDetailPageProps = {
  params: Promise<{
    source: string;
    id: string;
  }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function minorToInputValue(value: number) {
  return (value / 100).toFixed(2);
}

export default async function VendorBillDetailPage({ params, searchParams }: VendorBillDetailPageProps) {
  await requirePermission("inventory.receive");

  const [{ source, id }, query, outboundAccounts] = await Promise.all([
    params,
    searchParams,
    getActivePaymentAccounts("outbound"),
  ]);

  if (source !== "vendor_bill" && source !== "placeholder") {
    notFound();
  }

  const bill = await getPurchaseVendorBillDetail(source, id);

  if (!bill) {
    notFound();
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Purchasing / Vendor Bill"
        title={bill.billNo}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/purchasing?view=supplier-bills" variant="outline">Back to vendor bills</ButtonLink>
            {bill.source === "vendor_bill" ? (
              <ButtonLink href={`/admin/purchasing?view=payments&vendorBillId=${bill.id}`} variant="outline">
                Payments {bill.paymentCount}
              </ButtonLink>
            ) : null}
            {bill.source === "vendor_bill" && bill.status === "draft" ? (
              <form action={postVendorBill}>
                <input type="hidden" name="vendorBillId" value={bill.id} />
                <Button>Post Bill</Button>
              </form>
            ) : null}
            {bill.source === "vendor_bill" && bill.status !== "cancelled" ? (
              <form action={cancelVendorBill}>
                <input type="hidden" name="vendorBillId" value={bill.id} />
                <Button variant="danger">Cancel</Button>
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
            <p className="text-xs font-medium uppercase text-muted-foreground">Purchase Order</p>
            {bill.purchaseOrderId ? (
              <Link href={`/admin/purchasing/${bill.purchaseOrderId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                {bill.orderNo}
              </Link>
            ) : (
              <p className="mt-1 text-sm font-medium">-</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Supplier</p>
            <p className="mt-1 text-sm font-medium">{bill.supplierName}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium capitalize">{statusLabel(bill.status)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Total</p>
            <p className="mt-1 text-sm font-medium">{displayPurchaseMoney(bill.totalMinor, bill.currencyCode)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Residual</p>
            <p className="mt-1 text-sm font-medium">{displayPurchaseMoney(bill.residualAmountMinor, bill.currencyCode)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Payment Status</p>
            <p className="mt-1 text-sm font-medium capitalize">{statusLabel(bill.paymentStatus)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Bill Date</p>
            <p className="mt-1 text-sm font-medium">{bill.billDate}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Due Date</p>
            <p className="mt-1 text-sm font-medium">{bill.dueDate ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Vendor Reference</p>
            <p className="mt-1 text-sm font-medium">{bill.vendorReference ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Source</p>
            <p className="mt-1 text-sm font-medium">{bill.source === "placeholder" ? "Receipt placeholder" : "Vendor bill"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Receipt</p>
            {bill.goodsReceiptId ? (
              <Link href={`/admin/purchasing/receipts/${bill.goodsReceiptId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                {bill.receiptNo}
              </Link>
            ) : (
              <p className="mt-1 text-sm font-medium">-</p>
            )}
          </div>
        </div>

        {bill.lines.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2">Line</th>
                  <th className="px-3 py-2 text-right">Quantity</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2">Taxes</th>
                  <th className="px-3 py-2 text-right">Tax</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.lines.map((line) => (
                  <tr key={line.id} className="border-b border-border/70">
                    <td className="px-3 py-3">
                      <div className="font-medium">{line.productName ?? line.description}</div>
                      <div className="text-xs text-muted-foreground">{line.sku ?? line.description}</div>
                    </td>
                    <td className="px-3 py-3 text-right">{line.quantity}</td>
                    <td className="px-3 py-3 text-right">{displayPurchaseMoney(line.unitPriceMinor, line.currencyCode)}</td>
                    <td className="px-3 py-3">{line.taxNames ?? "-"}</td>
                    <td className="px-3 py-3 text-right">{displayPurchaseMoney(line.taxAmountMinor, line.currencyCode)}</td>
                    <td className="px-3 py-3 text-right">{displayPurchaseMoney(line.totalMinor, line.currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-2 border-t border-border pt-4 text-sm md:grid-cols-3">
            <div>
              <span className="text-muted-foreground">Untaxed </span>
              <span className="font-medium">{displayPurchaseMoney(bill.untaxedAmountMinor, bill.currencyCode)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Tax </span>
              <span className="font-medium">{displayPurchaseMoney(bill.taxAmountMinor, bill.currencyCode)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total </span>
              <span className="font-medium">{displayPurchaseMoney(bill.totalMinor, bill.currencyCode)}</span>
            </div>
          </div>
        )}
      </section>

      {bill.source === "vendor_bill" && bill.status === "posted" && bill.residualAmountMinor > 0 ? (
        <section className="mt-5 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Register Supplier Payment</h2>
          <form action={registerSupplierPayment} className="grid gap-4">
            <input type="hidden" name="vendorBillId" value={bill.id} />
            <div className="grid gap-4 md:grid-cols-4">
              <label className="flex flex-col gap-1 text-sm font-medium">
                Payment Account
                <select name="paymentAccountId" required className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select account</option>
                  {outboundAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} / {account.name} / {account.currencyCode}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Amount
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  defaultValue={minorToInputValue(bill.residualAmountMinor)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Reference
                <input name="reference" className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Notes
                <input name="notes" className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
              </label>
            </div>
            <div className="flex justify-end">
              <Button>Register Draft Payment</Button>
            </div>
          </form>
        </section>
      ) : null}
    </PageShell>
  );
}
