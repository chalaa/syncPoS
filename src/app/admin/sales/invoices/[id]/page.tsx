import Link from "next/link";
import { notFound } from "next/navigation";

import { postCustomerInvoice, registerCustomerPayment } from "@/app/admin/sales/actions";
import { PaymentFormDialog } from "@/components/app/payment-form-dialog";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { DetailStatCard } from "@/components/ui/detail-stat-card";
import { requirePermission } from "@/server/auth/session";
import { getActivePaymentAccounts } from "@/server/payments/payments";
import { displaySalesMoney, getCustomerInvoiceDetail } from "@/server/sales/sales";

export const dynamic = "force-dynamic";

type CustomerInvoicePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function CustomerInvoicePage({ params, searchParams }: CustomerInvoicePageProps) {
  await requirePermission("sales:orders:create");

  const [{ id }, query, paymentAccounts] = await Promise.all([
    params,
    searchParams,
    getActivePaymentAccounts("inbound"),
  ]);
  const invoice = await getCustomerInvoiceDetail(id);

  if (!invoice) {
    notFound();
  }

  const canRegisterPayment = invoice.status === "posted" && invoice.paymentStatus !== "paid" && invoice.residualAmountMinor > 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Sales / Customer Invoice"
        title={invoice.invoiceNo}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/sales?view=invoices" variant="outline">Back to invoices</ButtonLink>
            {invoice.status === "draft" ? (
              <form action={postCustomerInvoice}>
                <input type="hidden" name="customerInvoiceId" value={invoice.id} />
                <Button>Post Invoice</Button>
              </form>
            ) : null}
            {canRegisterPayment ? (
              <PaymentFormDialog
                title="Register Customer Payment"
                description={`Register and post payment for ${invoice.invoiceNo}.`}
                triggerLabel="Register Payment"
                submitLabel="Post Payment"
                action={registerCustomerPayment}
                hiddenFieldName="customerInvoiceId"
                hiddenFieldValue={invoice.id}
                paymentAccounts={paymentAccounts}
                currencyCode={invoice.currencyCode}
                amountMinor={invoice.residualAmountMinor}
              />
            ) : null}
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <div className="mb-6 flex flex-wrap gap-2.5">
        {invoice.salesOrderId ? (
          <DetailStatCard
            href={`/admin/sales/${invoice.salesOrderId}`}
            count={invoice.orderNo}
            label="Sales Order"
          />
        ) : null}
        {invoice.deliveryId ? (
          <DetailStatCard
            href={`/admin/sales/deliveries/${invoice.deliveryId}`}
            count={invoice.deliveryNo}
            label="Deliveries"
          />
        ) : null}
        <DetailStatCard
          href={`/admin/sales?view=payments&customerInvoiceId=${invoice.id}`}
          count={invoice.paymentCount}
          label="Payments"
        />
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card p-6 shadow-xs">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Customer" value={invoice.customerName} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={invoice.status} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Status</p>
            <div className="mt-1">
              <StatusBadge status={invoice.paymentStatus} />
            </div>
          </div>
          <Info label="Invoice Date" value={invoice.invoiceDate} />
          <Info label="Due Date" value={invoice.dueDate ?? "—"} />
          {invoice.taxAmountMinor > 0 ? (
            <>
              <Info label="Untaxed" value={displaySalesMoney(invoice.untaxedAmountMinor, invoice.currencyCode)} />
              <Info label="Tax" value={displaySalesMoney(invoice.taxAmountMinor, invoice.currencyCode)} />
            </>
          ) : (
            <Info label="Subtotal" value={displaySalesMoney(invoice.untaxedAmountMinor, invoice.currencyCode)} />
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Amount</p>
            <p className="mt-1 font-mono text-base font-bold text-foreground">
              {displaySalesMoney(invoice.totalMinor, invoice.currencyCode)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Residual Due</p>
            <p className={`mt-1 font-mono text-base font-bold ${invoice.residualAmountMinor > 0 ? "text-destructive" : "text-primary"}`}>
              {displaySalesMoney(invoice.residualAmountMinor, invoice.currencyCode)}
            </p>
          </div>
        </div>

        {(() => {
          const hasTaxInLines = invoice.lines.some((l) => Boolean(l.taxNames && l.taxNames !== "-"));
          return (
            <Notebook
              defaultValue="invoice-lines"
              items={[
                {
                  value: "invoice-lines",
                  label: "Invoice Lines",
                  content: (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[940px] text-left text-sm">
                        <thead className="text-xs uppercase text-muted-foreground">
                          <tr className="border-b border-border">
                            <th className="px-2 py-2">Product</th>
                            <th className="px-2 py-2">Description</th>
                            <th className="px-2 py-2 text-right">Quantity</th>
                            <th className="px-2 py-2 text-right">Unit Price</th>
                            <th className="px-2 py-2 text-right">Discount</th>
                            {hasTaxInLines ? <th className="px-2 py-2">Taxes</th> : null}
                            <th className="px-2 py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoice.lines.map((line) => (
                            <tr key={line.id} className="border-b border-border/70">
                              <td className="px-2 py-3">
                                <div className="font-medium">{line.productName ?? "-"}</div>
                                <div className="text-xs text-muted-foreground">{line.sku ?? "-"}</div>
                              </td>
                              <td className="px-2 py-3">{line.description}</td>
                              <td className="px-2 py-3 text-right">{line.quantity}</td>
                              <td className="px-2 py-3 text-right">{displaySalesMoney(line.unitPriceMinor, line.currencyCode)}</td>
                              <td className="px-2 py-3 text-right">{displaySalesMoney(line.discountMinor, line.currencyCode)}</td>
                              {hasTaxInLines ? <td className="px-2 py-3">{line.taxNames ?? "-"}</td> : null}
                              <td className="px-2 py-3 text-right">{displaySalesMoney(line.lineTotalMinor, line.currencyCode)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ),
                },
                {
                  value: "other-information",
                  label: "Other Information",
                  content: <p className="text-sm text-muted-foreground">{invoice.notes || "No notes"}</p>,
                },
              ]}
            />
          );
        })()}
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
