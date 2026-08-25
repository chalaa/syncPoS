import Link from "next/link";
import { notFound } from "next/navigation";

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
          <Info label="Posted At" value={payment.postedAt ?? "-"} />
          <Info label="Cancelled At" value={payment.cancelledAt ?? "-"} />
          <Info label="Notes" value={payment.notes ?? "-"} />
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Related Document</p>
            {customerInvoiceId ? (
              <Link href={`/admin/sales/invoices/${customerInvoiceId}`} className="mt-1 block text-sm font-medium text-primary underline-offset-4 hover:underline">
                Open customer invoice
              </Link>
            ) : (
              <p className="mt-1 text-sm font-medium">-</p>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2">Invoice</th>
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
