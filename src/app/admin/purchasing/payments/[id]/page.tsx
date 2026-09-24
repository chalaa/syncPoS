import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyPaymentLine } from "@/app/admin/payments/actions";
import {
  cancelSupplierPayment,
  postSupplierPayment,
  updateSupplierPayment,
} from "@/app/admin/purchasing/payments/actions";
import { PaymentFormDialog } from "@/components/app/payment-form-dialog";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
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
            <ButtonLink href="/admin/purchasing?view=payments" variant="outline"><T k="purchasing.backToPayments" fallback="Back to payments" /></ButtonLink>
            {isSupplierPayment && payment.status === "draft" ? (
              <PaymentFormDialog
                title="Edit Supplier Payment"
                description={`Update draft payment ${payment.paymentNo}.`}
                descriptionVariant="updateDraft"
                documentNo={payment.paymentNo}
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
                verifyAction={verifyPaymentLine}
                returnPath={`/admin/purchasing/payments/${payment.id}`}
              />
            ) : null}
            {isSupplierPayment && payment.status === "draft" ? (
              <form action={postSupplierPayment}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <Button><T k="Post Payment" /></Button>
              </form>
            ) : null}
            {isSupplierPayment && payment.status !== "cancelled" ? (
              <form action={cancelSupplierPayment}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <Button variant="danger"><T k="action.cancel" /></Button>
              </form>
            ) : null}
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2.5">
          {purchaseOrderId ? (
            <Link
              href={`/admin/purchasing/${purchaseOrderId}`}
              className="group flex flex-col rounded-lg border border-border bg-card px-4 py-2 text-sm shadow-xs transition-all hover:border-primary/50 hover:bg-secondary/40"
            >
              <span className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                {payment.allocations.find((allocation) => allocation.purchaseOrderId === purchaseOrderId)?.purchaseOrderNo ?? <T k="Purchase Order" />}
              </span>
              <span className="text-xs font-medium text-muted-foreground"><T k="Purchase Order" /></span>
            </Link>
          ) : null}
        </div>
        <StatusBadge status={payment.status} size="lg" />
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="field.status" /></p>
            <div className="mt-1">
              <StatusBadge status={payment.status} size="sm" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="field.type" fallback="Type" /></p>
            <p className="mt-1 text-sm font-medium capitalize"><T k={`status.${payment.paymentType}`} fallback={statusLabel(payment.paymentType)} /></p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="Supplier" /></p>
            <p className="mt-1 text-sm font-medium">{payment.partnerName ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="field.amount" fallback="Amount" /></p>
            <p className="mt-1 text-sm font-medium">{displayPaymentMoney(payment.amountMinor, payment.currencyCode)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="purchasing.paymentDateField" fallback="Payment Date" /></p>
            <p className="mt-1 text-sm font-medium">{payment.paymentDate}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="payment.method" fallback="Method" /></p>
            <p className="mt-1 text-sm font-medium">{payment.paymentMethodName}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="field.account" fallback="Account" /></p>
            <p className="mt-1 text-sm font-medium">{payment.paymentAccountName}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="Reference" /></p>
            <p className="mt-1 text-sm font-medium">{payment.reference ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="purchasing.verificationPolicy" fallback="Verification Policy" /></p>
            <p className="mt-1 text-sm font-medium"><T k="purchasing.verificationPolicyHint" fallback="Advisory; unverified lines can still post" /></p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="purchasing.postedAt" fallback="Posted At" /></p>
            <p className="mt-1 text-sm font-medium">{payment.postedAt ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="purchasing.cancelledAt" fallback="Cancelled At" /></p>
            <p className="mt-1 text-sm font-medium">{payment.cancelledAt ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="field.notes" fallback="Notes" /></p>
            <p className="mt-1 text-sm font-medium">{payment.notes ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="purchasing.relatedDocument" fallback="Related Document" /></p>
            {vendorBillId ? (
              <Link href={`/admin/purchasing/vendor-bills/vendor_bill/${vendorBillId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                <T k="purchasing.openVendorBill" fallback="Open vendor bill" />
              </Link>
            ) : purchaseOrderId ? (
              <Link href={`/admin/purchasing/${purchaseOrderId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                <T k="purchasing.openPurchaseOrder" fallback="Open purchase order" />
              </Link>
            ) : expenseId ? (
              <Link href={`/admin/operations/expenses/${expenseId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                <T k="purchasing.openExpense" fallback="Open expense" />
              </Link>
            ) : customerInvoiceId ? (
              <Link href={`/admin/sales/invoices/${customerInvoiceId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                <T k="purchasing.openCustomerInvoice" fallback="Open customer invoice" />
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
                <th className="px-3 py-2"><T k="payment.method" fallback="Method" /></th>
                <th className="px-3 py-2"><T k="field.account" fallback="Account" /></th>
                <th className="px-3 py-2"><T k="Reference" /></th>
                <th className="px-3 py-2"><T k="Note" /></th>
                <th className="px-3 py-2"><T k="payment.verification" fallback="Verification" /></th>
                <th className="px-3 py-2 text-right"><T k="purchasing.verifiedAmount" fallback="Verified Amount" /></th>
                <th className="px-3 py-2 text-right"><T k="field.amount" fallback="Amount" /></th>
              </tr>
            </thead>
            <tbody>
              {payment.lines.map((line) => (
                <tr key={line.id} className="border-b border-border/70">
                  <td className="px-3 py-3">{line.paymentMethodName}</td>
                  <td className="px-3 py-3">{line.paymentAccountName}</td>
                  <td className="px-3 py-3">{line.reference ?? "-"}</td>
                  <td className="px-3 py-3">{line.note ?? "-"}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <VerificationStatus status={line.verificationStatus} message={line.verificationMessage} />
                      {payment.status === "draft" && line.verifyEtEnabled ? (
                        <form action={verifyPaymentLine}>
                          <input type="hidden" name="paymentLineId" value={line.id} />
                          <input type="hidden" name="returnPath" value={`/admin/purchasing/payments/${payment.id}`} />
                          <Button size="sm" variant="outline"><T k="purchasing.verify" fallback="Verify" /></Button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {line.verifiedAmountMinor !== null
                      ? displayPaymentMoney(line.verifiedAmountMinor, line.verifiedCurrencyCode ?? line.currencyCode)
                      : "-"}
                  </td>
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
                <th className="px-3 py-2"><T k="purchasing.document" fallback="Document" /></th>
                <th className="px-3 py-2 text-right"><T k="report.allocated" fallback="Allocated" /></th>
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

function VerificationStatus({
  status,
  message,
}: {
  status: string;
  message: string | null;
}) {
  const fallbackLabel = status.replace(/_/g, " ");
  const className = status === "verified"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "failed"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : "border-border bg-muted/40 text-muted-foreground";

  return (
    <span title={message ?? undefined} className={`rounded-md border px-2 py-1 text-xs font-medium capitalize ${className}`}>
      <T k={`status.${status}`} fallback={fallbackLabel} />
    </span>
  );
}
