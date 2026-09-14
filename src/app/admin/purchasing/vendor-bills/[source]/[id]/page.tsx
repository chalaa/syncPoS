import Link from "next/link";
import { notFound } from "next/navigation";

import { cancelVendorBill, postVendorBill } from "@/app/admin/purchasing/actions";
import { registerSupplierPayment } from "@/app/admin/purchasing/payments/actions";
import { PaymentFormDialog } from "@/components/app/payment-form-dialog";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
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
            {bill.source === "vendor_bill" && bill.status === "posted" && bill.residualAmountMinor > 0 ? (
              <PaymentFormDialog
                title="Register Supplier Payment"
                description={`Register and post payment for ${bill.billNo}.`}
                triggerLabel="Register Payment"
                submitLabel="Post Payment"
                action={registerSupplierPayment}
                hiddenFieldName="vendorBillId"
                hiddenFieldValue={bill.id}
                paymentAccounts={outboundAccounts}
                currencyCode={bill.currencyCode}
                amountMinor={bill.residualAmountMinor}
              />
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

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2.5">
          {bill.purchaseOrderId ? (
            <Link
              href={`/admin/purchasing/${bill.purchaseOrderId}`}
              className="group flex flex-col rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-xs transition-all hover:border-primary/50 hover:bg-secondary/40"
            >
              <span className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                {bill.orderNo}
              </span>
              <span className="text-xs font-medium text-muted-foreground">Purchase Order</span>
            </Link>
          ) : null}
          {bill.goodsReceiptId ? (
            <Link
              href={`/admin/purchasing/receipts/${bill.goodsReceiptId}`}
              className="group flex flex-col rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-xs transition-all hover:border-primary/50 hover:bg-secondary/40"
            >
              <span className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                {bill.receiptNo}
              </span>
              <span className="text-xs font-medium text-muted-foreground">Receipt</span>
            </Link>
          ) : null}
          {bill.source === "vendor_bill" ? (
            <Link
              href={`/admin/purchasing?view=payments&vendorBillId=${bill.id}`}
              className="group flex flex-col rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-xs transition-all hover:border-primary/50 hover:bg-secondary/40"
            >
              <span className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                {bill.paymentCount}
              </span>
              <span className="text-xs font-medium text-muted-foreground">Payments</span>
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge status={bill.status} size="lg" />
          <StatusBadge status={bill.paymentStatus} size="lg" />
        </div>
      </div>

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
            <div className="mt-1">
              <StatusBadge status={bill.status} size="sm" />
            </div>
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
            <div className="mt-1">
              <StatusBadge status={bill.paymentStatus} size="sm" />
            </div>
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
          (() => {
            const hasTaxInLines = bill.lines.some((l) => (l.taxAmountMinor ?? 0) > 0 || Boolean(l.taxNames && l.taxNames !== "-"));
            return (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2">Line</th>
                      <th className="px-3 py-2 text-right">Quantity</th>
                      <th className="px-3 py-2 text-right">Unit Price</th>
                      {hasTaxInLines ? <th className="px-3 py-2">Taxes</th> : null}
                      {hasTaxInLines ? <th className="px-3 py-2 text-right">Tax</th> : null}
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
                        {hasTaxInLines ? <td className="px-3 py-3">{line.taxNames ?? "-"}</td> : null}
                        {hasTaxInLines ? <td className="px-3 py-3 text-right">{displayPurchaseMoney(line.taxAmountMinor, line.currencyCode)}</td> : null}
                        <td className="px-3 py-3 text-right">{displayPurchaseMoney(line.totalMinor, line.currencyCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()
        ) : (
          <div className="grid gap-2 border-t border-border pt-4 text-sm md:grid-cols-3">
            <div>
              <span className="text-muted-foreground">{bill.taxAmountMinor > 0 ? "Untaxed " : "Subtotal "}</span>
              <span className="font-medium">{displayPurchaseMoney(bill.untaxedAmountMinor, bill.currencyCode)}</span>
            </div>
            {bill.taxAmountMinor > 0 ? (
              <div>
                <span className="text-muted-foreground">Tax </span>
                <span className="font-medium">{displayPurchaseMoney(bill.taxAmountMinor, bill.currencyCode)}</span>
              </div>
            ) : null}
            <div>
              <span className="text-muted-foreground">Total </span>
              <span className="font-medium">{displayPurchaseMoney(bill.totalMinor, bill.currencyCode)}</span>
            </div>
          </div>
        )}
      </section>

    </PageShell>
  );
}
