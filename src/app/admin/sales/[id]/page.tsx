import { notFound } from "next/navigation";

import {
  confirmSalesOrder,
  createCustomerInvoiceFromSalesOrder,
  createDeliveryFromSalesOrder,
  updateSalesOrder,
} from "@/app/admin/sales/actions";
import { SalesOrderForm } from "@/app/admin/sales/sales-order-form";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requireUser } from "@/server/auth/session";
import {
  displaySalesMoney,
  getSalesFormOptions,
  getSalesOrderDetail,
} from "@/server/sales/sales";

export const dynamic = "force-dynamic";

type SalesOrderDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function SalesOrderDetailPage({ params, searchParams }: SalesOrderDetailPageProps) {
  await requireUser();

  const [{ id }, query, options] = await Promise.all([
    params,
    searchParams,
    getSalesFormOptions(),
  ]);
  const order = await getSalesOrderDetail(id);

  if (!order) {
    notFound();
  }

  const isQuotation = order.status === "quotation";
  const canCreateDelivery = order.status === "confirmed" || order.status === "partially_delivered";
  const canCreateInvoice = order.status === "confirmed" || order.status === "partially_delivered" || order.status === "delivered";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Sales"
        title={order.orderNo}
        actions={<ButtonLink href="/admin/sales" variant="outline">Back to sales</ButtonLink>}
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <a href={`/admin/sales?view=deliveries&salesOrderId=${order.id}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{order.deliveryCount}</span>
            <span className="text-muted-foreground">Deliveries</span>
          </a>
          <a href={`/admin/sales?view=invoices&salesOrderId=${order.id}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{order.invoiceCount}</span>
            <span className="text-muted-foreground">Invoices</span>
          </a>
          <a href={`/admin/sales?view=payments&salesOrderId=${order.id}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{order.paymentCount}</span>
            <span className="text-muted-foreground">Payments</span>
          </a>
          <a href={`/admin/sales?view=returns&salesOrderId=${order.id}`} className="rounded-md border border-border bg-card px-4 py-3 text-sm hover:bg-accent">
            <span className="block text-lg font-semibold">{order.returnCount}</span>
            <span className="text-muted-foreground">Returns</span>
          </a>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-md border border-border bg-muted px-3 py-2 text-sm capitalize">
            {statusLabel(order.status)}
          </span>
          {isQuotation ? (
            <form action={confirmSalesOrder}>
              <input type="hidden" name="salesOrderId" value={order.id} />
              <input type="hidden" name="returnPath" value={`/admin/sales/${order.id}`} />
              <Button>Confirm Quotation</Button>
            </form>
          ) : null}
          {canCreateDelivery ? (
            <form action={createDeliveryFromSalesOrder}>
              <input type="hidden" name="salesOrderId" value={order.id} />
              <Button>Create Delivery</Button>
            </form>
          ) : null}
          {canCreateInvoice ? (
            <form action={createCustomerInvoiceFromSalesOrder}>
              <input type="hidden" name="salesOrderId" value={order.id} />
              <Button variant="outline">Create Invoice</Button>
            </form>
          ) : null}
        </div>
      </div>

      {isQuotation ? (
        <SalesOrderForm
          action={updateSalesOrder}
          customers={options.customers}
          products={options.products}
          locations={options.locations}
          taxes={options.taxes}
          error={query.error}
          order={order}
          submitLabel="Save Quotation"
        />
      ) : (
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="mb-5 grid gap-4 md:grid-cols-4">
            <Info label="Customer" value={order.customerName} />
            <Info label="Customer Reference" value={order.customerReference ?? "-"} />
            <Info label="Order Date" value={order.orderDate} />
            <Info label="Expected Delivery" value={order.expectedDeliveryDate ?? "-"} />
            <Info label="Subtotal" value={displaySalesMoney(order.subtotalMinor, order.currencyCode)} />
            <Info label="Tax" value={displaySalesMoney(order.taxAmountMinor, order.currencyCode)} />
            <Info label="Total" value={displaySalesMoney(order.totalMinor, order.currencyCode)} />
            <Info label="Reserve Policy" value={order.reserveOnConfirm ? "Reserve on confirm" : "No reservation"} />
          </div>

          <Notebook
            defaultValue="order-lines"
            items={[
              {
                value: "order-lines",
                label: "Order Lines",
                content: (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left text-sm">
                      <thead className="text-xs uppercase text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-2 py-2">Product</th>
                          <th className="px-2 py-2 text-right">Ordered</th>
                          <th className="px-2 py-2 text-right">Reserved</th>
                          <th className="px-2 py-2 text-right">Delivered</th>
                          <th className="px-2 py-2 text-right">Invoiced</th>
                          <th className="px-2 py-2 text-right">Unit Price</th>
                          <th className="px-2 py-2 text-right">Tax</th>
                          <th className="px-2 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.lines.map((line) => (
                          <tr key={line.id} className="border-b border-border/70">
                            <td className="px-2 py-3">
                              <div className="font-medium">{line.productName}</div>
                              <div className="text-xs text-muted-foreground">
                                {line.sku} / {line.trackingMode} / Taxes {line.taxNames ?? "-"}
                              </div>
                            </td>
                            <td className="px-2 py-3 text-right">{line.quantityOrdered}</td>
                            <td className="px-2 py-3 text-right">{line.quantityReserved}</td>
                            <td className="px-2 py-3 text-right">{line.quantityDelivered}</td>
                            <td className="px-2 py-3 text-right">{line.quantityInvoiced}</td>
                            <td className="px-2 py-3 text-right">{displaySalesMoney(line.unitPriceMinor, line.currencyCode)}</td>
                            <td className="px-2 py-3 text-right">{displaySalesMoney(line.taxAmountMinor, line.currencyCode)}</td>
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
                content: <p className="text-sm text-muted-foreground">{order.notes || "No notes"}</p>,
              },
            ]}
          />
        </section>
      )}
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
