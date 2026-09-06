import Link from "next/link";
import { notFound } from "next/navigation";

import {
  cancelSupplierPayment,
  postSupplierPayment,
  updateSupplierPayment,
} from "@/app/admin/purchasing/payments/actions";
import { PaymentFormDialog } from "@/components/app/payment-form-dialog";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { displayPaymentMoney, getActivePaymentAccounts, getPaymentDetail } from "@/server/payments/payments";

export const dynamic = "force-dynamic";

type PaymentDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function PaymentDetailPage({ params, searchParams }: PaymentDetailPageProps) {
  await requirePermission("inventory.receive");

  const [{ id }, query, paymentAccounts] = await Promise.all([
    params,
    searchParams,
    getActivePaymentAccounts("outbound"),
  ]);
  const payment = await getPaymentDetail(id);

  if (!payment) {
    notFound();
  }

  const vendorBillId = payment.allocations.find((allocation) => allocation.vendorBillId)?.vendorBillId;
  const purchaseOrderId = payment.allocations.find((allocation) => allocation.purchaseOrderId)?.purchaseOrderId;
  const expenseId = payment.allocations.find((allocation) => allocation.expenseId)?.expenseId;
  const customerInvoiceId = payment.allocations.find((allocation) => allocation.customerInvoiceId)?.customerInvoiceId;
  const isSupplierPayment = Boolean(vendorBillId || purchaseOrderId);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Purchasing / Supplier Payment"
        title={payment.paymentNo}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/purchasing?view=payments" variant="outline">Back to payments</ButtonLink>
            {isSupplierPayment && payment.status === "draft" ? (
              <PaymentFormDialog
                title="Edit Supplier Payment"
                description={`Update draft payment ${payment.paymentNo}.`}
                triggerLabel="Edit Payment"
                submitLabel="Save Payment"
                action={updateSupplierPayment}
                hiddenFieldName="paymentId"
                hiddenFieldValue={payment.id}
                paymentAccounts={paymentAccounts}
                currencyCode={payment.currencyCode}
                amountMinor={payment.amountMinor}
                paymentAccountId={payment.paymentAccountId}
                reference={payment.reference}
                notes={payment.notes}
                paymentLines={payment.lines}
              />
            ) : null}
            {isSupplierPayment && payment.status === "draft" ? (
              <form action={postSupplierPayment}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <Button>Post Payment</Button>
              </form>
            ) : null}
            {isSupplierPayment && payment.status !== "cancelled" ? (
              <form action={cancelSupplierPayment}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <Button variant="danger">Cancel</Button>
              </form>
            ) : null}
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      {purchaseOrderId ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/admin/purchasing/${purchaseOrderId}`}
            className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent"
          >
            <span className="block text-base font-semibold">
              {payment.allocations.find((allocation) => allocation.purchaseOrderId === purchaseOrderId)?.purchaseOrderNo ?? "Purchase Order"}
            </span>
            <span className="text-muted-foreground">Purchase Order</span>
          </Link>
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-medium capitalize">{statusLabel(payment.status)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Type</p>
            <p className="mt-1 text-sm font-medium capitalize">{statusLabel(payment.paymentType)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Supplier</p>
            <p className="mt-1 text-sm font-medium">{payment.partnerName ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Amount</p>
            <p className="mt-1 text-sm font-medium">{displayPaymentMoney(payment.amountMinor, payment.currencyCode)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Payment Date</p>
            <p className="mt-1 text-sm font-medium">{payment.paymentDate}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Method</p>
            <p className="mt-1 text-sm font-medium">{payment.paymentMethodName}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Account</p>
            <p className="mt-1 text-sm font-medium">{payment.paymentAccountName}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Reference</p>
            <p className="mt-1 text-sm font-medium">{payment.reference ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Posted At</p>
            <p className="mt-1 text-sm font-medium">{payment.postedAt ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Cancelled At</p>
            <p className="mt-1 text-sm font-medium">{payment.cancelledAt ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Notes</p>
            <p className="mt-1 text-sm font-medium">{payment.notes ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Related Document</p>
            {vendorBillId ? (
              <Link href={`/admin/purchasing/vendor-bills/vendor_bill/${vendorBillId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                Open vendor bill
              </Link>
            ) : purchaseOrderId ? (
              <Link href={`/admin/purchasing/${purchaseOrderId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                Open purchase order
              </Link>
            ) : expenseId ? (
              <Link href={`/admin/operations/expenses/${expenseId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                Open expense
              </Link>
            ) : customerInvoiceId ? (
              <Link href={`/admin/sales/invoices/${customerInvoiceId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                Open customer invoice
              </Link>
            ) : (
              <p className="mt-1 text-sm font-medium">-</p>
            )}
          </div>
        </div>

        <div className="mb-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Note</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payment.lines.map((line) => (
                <tr key={line.id} className="border-b border-border/70">
                  <td className="px-3 py-3">{line.paymentMethodName}</td>
                  <td className="px-3 py-3">{line.paymentAccountName}</td>
                  <td className="px-3 py-3">{line.reference ?? "-"}</td>
                  <td className="px-3 py-3">{line.note ?? "-"}</td>
                  <td className="px-3 py-3 text-right">{displayPaymentMoney(line.amountMinor, line.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2 text-right">Allocated</th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((allocation) => (
                <tr key={allocation.id} className="border-b border-border/70">
                  <td className="px-3 py-3">
                    {allocation.vendorBillId ? (
                      <Link href={`/admin/purchasing/vendor-bills/vendor_bill/${allocation.vendorBillId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        {allocation.billNo}
                      </Link>
                    ) : allocation.purchaseOrderId ? (
                      <Link href={`/admin/purchasing/${allocation.purchaseOrderId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        {allocation.purchaseOrderNo}
                      </Link>
                    ) : allocation.expenseId ? (
                      <Link href={`/admin/operations/expenses/${allocation.expenseId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        {allocation.expenseNo}
                      </Link>
                    ) : allocation.customerInvoiceId ? (
                      <Link href={`/admin/sales/invoices/${allocation.customerInvoiceId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        {allocation.invoiceNo}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">{displayPaymentMoney(allocation.amountMinor, allocation.currencyCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
