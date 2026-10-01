import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyPaymentLine } from "@/app/admin/payments/actions";
import { cancelCustomerPayment, postCustomerPayment, updateCustomerPayment } from "@/app/admin/sales/actions";
import { PaymentFormDialog } from "@/components/app/payment-form-dialog";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
import { requirePermission } from "@/server/auth/session";
import { displayPaymentMoney, getActivePaymentAccounts, getPaymentDetail } from "@/server/payments/payments";

export const dynamic = "force-dynamic";

type CustomerPaymentPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function CustomerPaymentPage({ params, searchParams }: CustomerPaymentPageProps) {
  await requirePermission("sales:orders:create");

  const [{ id }, query, paymentAccounts] = await Promise.all([
    params,
    searchParams,
    getActivePaymentAccounts("inbound"),
  ]);
  const payment = await getPaymentDetail(id);

  if (!payment || payment.paymentType !== "inbound") {
    notFound();
  }

  const customerInvoiceId = payment.allocations.find((allocation) => allocation.customerInvoiceId)?.customerInvoiceId;
  const salesOrderId = payment.allocations.find((allocation) => allocation.salesOrderId)?.salesOrderId;
  const customerDirectVendorSaleId = payment.allocations.find((allocation) => allocation.customerDirectVendorSaleId)?.customerDirectVendorSaleId;

  return (
    <PageShell>
      <PageHeader
        eyebrow={<T k="header.eyebrow.Sales / Customer Payment">Sales / Customer Payment</T>}
        title={payment.paymentNo}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/sales?view=payments" variant="outline"><T k="action.backToPayments">Back to payments</T></ButtonLink>
            {payment.status === "draft" ? (
              <PaymentFormDialog
                title="Edit Customer Payment"
                description={`Update draft payment ${payment.paymentNo}.`}
                triggerLabel="Edit Payment"
                submitLabel="Save Payment"
                action={updateCustomerPayment}
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
                returnPath={`/admin/sales/payments/${payment.id}`}
              />
            ) : null}
            {payment.status === "draft" ? (
              <form action={postCustomerPayment}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <Button><T k="action.postPayment">Post Payment</T></Button>
              </form>
            ) : null}
            {payment.status !== "cancelled" ? (
              <form action={cancelCustomerPayment}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <Button variant="danger"><T k="action.cancel">Cancel</T></Button>
              </form>
            ) : null}
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      {salesOrderId || customerDirectVendorSaleId ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {salesOrderId ? (
            <Link
              href={`/admin/sales/${salesOrderId}`}
              className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent"
            >
              <span className="block text-base font-semibold">
                {payment.allocations.find((allocation) => allocation.salesOrderId === salesOrderId)?.salesOrderNo ?? "Sales Order"}
              </span>
              <span className="text-muted-foreground"><T k="sales.order">Sales Order</T></span>
            </Link>
          ) : null}
          {customerDirectVendorSaleId ? (
            <Link
              href={`/admin/sales/direct-vendor/${customerDirectVendorSaleId}`}
              className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent"
            >
              <span className="block text-base font-semibold">
                {payment.allocations.find((allocation) => allocation.customerDirectVendorSaleId === customerDirectVendorSaleId)?.customerDirectVendorSaleNo ?? "Direct Vendor Sale"}
              </span>
              <span className="text-muted-foreground">Direct Vendor Sale</span>
            </Link>
          ) : null}
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <Info label="Status" labelKey="field.status" value={statusLabel(payment.status)} />
          <Info label="Type" labelKey="field.type" value={statusLabel(payment.paymentType)} />
          <Info label="Customer" labelKey="field.customer" value={payment.partnerName ?? "-"} />
          <Info label="Amount" labelKey="sales.form.amount" value={displayPaymentMoney(payment.amountMinor, payment.currencyCode)} />
          <Info label="Payment Date" labelKey="field.paymentDate" value={payment.paymentDate} />
          <Info label="Method" labelKey="field.method" value={payment.paymentMethodName} />
          <Info label="Account" labelKey="field.account" value={payment.paymentAccountName} />
          <Info label="Reference" labelKey="sales.form.reference" value={payment.reference ?? "-"} />
          <Info label="Verification Policy" labelKey="field.verificationPolicy" value="Advisory; unverified lines can still post" />
          <Info label="Posted At" labelKey="field.postedAt" value={payment.postedAt ?? "-"} />
          <Info label="Cancelled At" labelKey="field.cancelledAt" value={payment.cancelledAt ?? "-"} />
          <Info label="Notes" labelKey="sales.form.notes" value={payment.notes ?? "-"} />
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground"><T k="field.relatedDocument">Related Document</T></p>
            {customerInvoiceId ? (
              <Link href={`/admin/sales/invoices/${customerInvoiceId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                <T k="field.openCustomerInvoice">Open customer invoice</T>
              </Link>
            ) : salesOrderId ? (
              <Link href={`/admin/sales/${salesOrderId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                <T k="field.openSalesOrder">Open sales order</T>
              </Link>
            ) : customerDirectVendorSaleId ? (
              <Link href={`/admin/sales/direct-vendor/${customerDirectVendorSaleId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                Open direct vendor sale
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
                <th className="px-3 py-2"><T k="field.method">Method</T></th>
                <th className="px-3 py-2"><T k="field.account">Account</T></th>
                <th className="px-3 py-2"><T k="sales.form.reference">Reference</T></th>
                <th className="px-3 py-2"><T k="sales.form.notes">Note</T></th>
                <th className="px-3 py-2"><T k="field.verification">Verification</T></th>
                <th className="px-3 py-2 text-right"><T k="field.verifiedAmount">Verified Amount</T></th>
                <th className="px-3 py-2 text-right"><T k="sales.form.amount">Amount</T></th>
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
                          <input type="hidden" name="returnPath" value={`/admin/sales/payments/${payment.id}`} />
                          <Button size="sm" variant="outline"><T k="action.verify">Verify</T></Button>
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
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2"><T k="field.document">Document</T></th>
                <th className="px-3 py-2 text-right"><T k="field.allocated">Allocated</T></th>
              </tr>
            </thead>
            <tbody>
              {payment.allocations.map((allocation) => (
                <tr key={allocation.id} className="border-b border-border/70">
                  <td className="px-3 py-3">
                    {allocation.customerInvoiceId ? (
                      <Link href={`/admin/sales/invoices/${allocation.customerInvoiceId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        {allocation.invoiceNo}
                      </Link>
                    ) : allocation.salesOrderId ? (
                      <Link href={`/admin/sales/${allocation.salesOrderId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        {allocation.salesOrderNo}
                      </Link>
                    ) : allocation.customerDirectVendorSaleId ? (
                      <Link href={`/admin/sales/direct-vendor/${allocation.customerDirectVendorSaleId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                        {allocation.customerDirectVendorSaleNo}
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

function Info({ label, labelKey, value }: { label: string; labelKey?: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground"><T k={labelKey ?? label}>{label}</T></p>
      <p className="mt-1 text-sm font-medium capitalize">{value}</p>
    </div>
  );
}

function VerificationStatus({
  status,
  message,
}: {
  status: string;
  message: string | null;
}) {
  const label = status.replace(/_/g, " ");
  const className = status === "verified"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "failed"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : "border-border bg-muted/40 text-muted-foreground";

  return (
    <span title={message ?? undefined} className={`rounded-md border px-2 py-1 text-xs font-medium capitalize ${className}`}>
      {label}
    </span>
  );
}
