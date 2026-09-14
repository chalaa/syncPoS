import Link from "next/link";
import { notFound } from "next/navigation";

import { verifyPaymentLine } from "@/app/admin/payments/actions";
import { cancelCustomerPayment, postCustomerPayment, updateCustomerPayment } from "@/app/admin/sales/actions";
import { PaymentFormDialog } from "@/components/app/payment-form-dialog";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
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

  return (
    <PageShell>
      <PageHeader
        eyebrow="Sales / Customer Payment"
        title={payment.paymentNo}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/sales?view=payments" variant="outline">Back to payments</ButtonLink>
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
                <Button>Post Payment</Button>
              </form>
            ) : null}
            {payment.status !== "cancelled" ? (
              <form action={cancelCustomerPayment}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <Button variant="danger">Cancel</Button>
              </form>
            ) : null}
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      {salesOrderId ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href={`/admin/sales/${salesOrderId}`}
            className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent"
          >
            <span className="block text-base font-semibold">
              {payment.allocations.find((allocation) => allocation.salesOrderId === salesOrderId)?.salesOrderNo ?? "Sales Order"}
            </span>
            <span className="text-muted-foreground">Sales Order</span>
          </Link>
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <Info label="Status" value={statusLabel(payment.status)} />
          <Info label="Type" value={statusLabel(payment.paymentType)} />
          <Info label="Customer" value={payment.partnerName ?? "-"} />
          <Info label="Amount" value={displayPaymentMoney(payment.amountMinor, payment.currencyCode)} />
          <Info label="Payment Date" value={payment.paymentDate} />
          <Info label="Method" value={payment.paymentMethodName} />
          <Info label="Account" value={payment.paymentAccountName} />
          <Info label="Reference" value={payment.reference ?? "-"} />
          <Info label="Verification Policy" value="Advisory; unverified lines can still post" />
          <Info label="Posted At" value={payment.postedAt ?? "-"} />
          <Info label="Cancelled At" value={payment.cancelledAt ?? "-"} />
          <Info label="Notes" value={payment.notes ?? "-"} />
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Related Document</p>
            {customerInvoiceId ? (
              <Link href={`/admin/sales/invoices/${customerInvoiceId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                Open customer invoice
              </Link>
            ) : salesOrderId ? (
              <Link href={`/admin/sales/${salesOrderId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                Open sales order
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
                <th className="px-3 py-2">Verification</th>
                <th className="px-3 py-2 text-right">Verified Amount</th>
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
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <VerificationStatus status={line.verificationStatus} message={line.verificationMessage} />
                      {payment.status === "draft" && line.verifyEtEnabled ? (
                        <form action={verifyPaymentLine}>
                          <input type="hidden" name="paymentLineId" value={line.id} />
                          <input type="hidden" name="returnPath" value={`/admin/sales/payments/${payment.id}`} />
                          <Button size="sm" variant="outline">Verify</Button>
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
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2 text-right">Allocated</th>
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
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
