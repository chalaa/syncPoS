import Link from "next/link";
import { notFound } from "next/navigation";

import { postCustomerInvoice, registerCustomerPayment } from "@/app/admin/sales/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requireUser } from "@/server/auth/session";
import { getActivePaymentAccounts } from "@/server/payments/payments";
import { displaySalesMoney, getCustomerInvoiceDetail } from "@/server/sales/sales";

export const dynamic = "force-dynamic";

type CustomerInvoicePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function inputClass() {
  return "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary";
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function CustomerInvoicePage({ params, searchParams }: CustomerInvoicePageProps) {
  await requireUser();

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
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <div className="mb-5 flex flex-wrap gap-2">
        {invoice.salesOrderId ? (
          <Link href={`/admin/sales/${invoice.salesOrderId}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{invoice.orderNo}</span>
            <span className="text-muted-foreground">Sales Order</span>
          </Link>
        ) : null}
        {invoice.deliveryId ? (
          <Link href={`/admin/sales/deliveries/${invoice.deliveryId}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{invoice.deliveryNo}</span>
            <span className="text-muted-foreground">Delivery</span>
          </Link>
        ) : null}
        <Link href={`/admin/sales?view=payments&customerInvoiceId=${invoice.id}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
          <span className="block text-lg font-semibold">{invoice.paymentCount}</span>
          <span className="text-muted-foreground">Payments</span>
        </Link>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <Info label="Customer" value={invoice.customerName} />
          <Info label="Status" value={statusLabel(invoice.status)} />
          <Info label="Payment" value={statusLabel(invoice.paymentStatus)} />
          <Info label="Invoice Date" value={invoice.invoiceDate} />
          <Info label="Due Date" value={invoice.dueDate ?? "-"} />
          <Info label="Untaxed" value={displaySalesMoney(invoice.untaxedAmountMinor, invoice.currencyCode)} />
          <Info label="Tax" value={displaySalesMoney(invoice.taxAmountMinor, invoice.currencyCode)} />
          <Info label="Total" value={displaySalesMoney(invoice.totalMinor, invoice.currencyCode)} />
          <Info label="Residual" value={displaySalesMoney(invoice.residualAmountMinor, invoice.currencyCode)} />
        </div>

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
                        <th className="px-2 py-2">Taxes</th>
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
                          <td className="px-2 py-3">{line.taxNames ?? "-"}</td>
                          <td className="px-2 py-3 text-right">{displaySalesMoney(line.lineTotalMinor, line.currencyCode)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ),
            },
            {
              value: "payment",
              label: "Register Payment",
              content: canRegisterPayment ? (
                <form action={registerCustomerPayment} className="grid gap-4 md:grid-cols-4">
                  <input type="hidden" name="customerInvoiceId" value={invoice.id} />
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">Payment Account</span>
                    <select name="paymentAccountId" required className={inputClass()} defaultValue="">
                      <option value="" disabled>Select account</option>
                      {paymentAccounts
                        .filter((account) => account.currencyCode === invoice.currencyCode)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Amount</span>
                    <input name="amount" required defaultValue={(invoice.residualAmountMinor / 100).toFixed(2)} className={inputClass()} />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Reference</span>
                    <input name="reference" className={inputClass()} />
                  </label>
                  <label className="space-y-1 md:col-span-4">
                    <span className="text-xs font-medium text-muted-foreground">Notes</span>
                    <input name="notes" className={inputClass()} />
                  </label>
                  <div className="md:col-span-4">
                    <Button type="submit">Register Payment</Button>
                  </div>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">No payment can be registered for this invoice.</p>
              ),
            },
            {
              value: "other-information",
              label: "Other Information",
              content: <p className="text-sm text-muted-foreground">{invoice.notes || "No notes"}</p>,
            },
          ]}
        />
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
