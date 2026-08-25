import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getPaymentList } from "@/server/payments/payments";
import type { PaymentListRow } from "@/server/payments/types";
import { displayReturnMoney, getCustomerReturnList } from "@/server/returns/returns";
import type { CustomerReturnListRow } from "@/server/returns/types";
import { displaySalesMoney, getCustomerInvoiceList, getDeliveryList, getSalesOrderList } from "@/server/sales/sales";
import type { CustomerInvoiceListRow, DeliveryListRow, SalesOrderListRow } from "@/server/sales/types";

export const dynamic = "force-dynamic";

type SalesPageProps = {
  searchParams: Promise<{
    view?: string;
    salesOrderId?: string;
    customerInvoiceId?: string;
    partnerId?: string;
    notice?: string;
    error?: string;
  }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  await requirePermission("sales:orders:create");

  const params = await searchParams;
  const view = params.view ?? "orders";

  if (view === "deliveries") {
    const deliveries = await getDeliveryList({ salesOrderId: params.salesOrderId });

    return (
      <SalesLayout title="Deliveries" notice={params.notice} error={params.error}>
        <DeliveryList deliveries={deliveries} />
      </SalesLayout>
    );
  }

  if (view === "invoices") {
    const invoices = await getCustomerInvoiceList({
      salesOrderId: params.salesOrderId,
      customerInvoiceId: params.customerInvoiceId,
      customerId: params.partnerId,
    });

    return (
      <SalesLayout title="Customer Invoices" notice={params.notice} error={params.error}>
        <CustomerInvoiceList invoices={invoices} />
      </SalesLayout>
    );
  }

  if (view === "payments") {
    const payments = await getPaymentList({
      paymentType: "inbound",
      salesOrderId: params.salesOrderId,
      customerInvoiceId: params.customerInvoiceId,
    });

    return (
      <SalesLayout title="Customer Payments" notice={params.notice} error={params.error}>
        <CustomerPaymentList payments={payments} />
      </SalesLayout>
    );
  }

  if (view === "returns") {
    const returns = await getCustomerReturnList(params.salesOrderId);

    return (
      <SalesLayout
        title="Returns"
        notice={params.notice}
        error={params.error}
        actions={<ButtonLink href="/admin/sales/returns/new">New Return</ButtonLink>}
      >
        <CustomerReturnList returns={returns} />
      </SalesLayout>
    );
  }

  const orders = await getSalesOrderList();

  return (
    <SalesLayout
      title="Quotations / Orders"
      notice={params.notice}
      error={params.error}
      actions={<ButtonLink href="/admin/sales/new" variant="default">New Quotation</ButtonLink>}
    >
      <SalesOrderList orders={orders} />
    </SalesLayout>
  );
}

function SalesLayout({
  title,
  notice,
  error,
  actions,
  children,
}: {
  title: string;
  notice?: string;
  error?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PageShell>
      <PageHeader eyebrow="Sales" title={title} actions={actions} />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      {children}
    </PageShell>
  );
}

function CustomerReturnList({ returns }: { returns: CustomerReturnListRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Return</th>
              <th className="px-4 py-3">Sales Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Refund</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((record) => (
              <tr key={record.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/admin/sales/returns/${record.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {record.returnNo}
                  </Link>
                </td>
                <td className="px-4 py-3">{record.orderNo}</td>
                <td className="px-4 py-3">{record.customerName}</td>
                <td className="px-4 py-3 capitalize">{statusLabel(record.status)}</td>
                <td className="px-4 py-3">{record.returnDate}</td>
                <td className="px-4 py-3 text-right">{record.lineCount}</td>
                <td className="px-4 py-3 text-right">{displayReturnMoney(record.refundAmountMinor, record.currencyCode)}</td>
                <td className="px-4 py-3 text-right">
                  <ButtonLink href={`/admin/sales/returns/${record.id}`} size="sm">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {returns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No customer returns found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomerInvoiceList({ invoices }: { invoices: CustomerInvoiceListRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Invoice Date</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Residual</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/admin/sales/invoices/${invoice.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {invoice.invoiceNo}
                  </Link>
                  <div className="text-xs text-muted-foreground">{invoice.customerReference ?? "-"}</div>
                </td>
                <td className="px-4 py-3">{invoice.customerName}</td>
                <td className="px-4 py-3">
                  {invoice.orderNo ? (
                    <Link href={`/admin/sales/${invoice.salesOrderId}`} className="text-primary underline-offset-4 hover:underline">
                      {invoice.orderNo}
                    </Link>
                  ) : invoice.deliveryNo ? (
                    invoice.deliveryNo
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3 capitalize">{statusLabel(invoice.status)}</td>
                <td className="px-4 py-3 capitalize">{statusLabel(invoice.paymentStatus)}</td>
                <td className="px-4 py-3">{invoice.invoiceDate}</td>
                <td className="px-4 py-3">{invoice.dueDate ?? "-"}</td>
                <td className="px-4 py-3">{invoice.productSummary ?? "-"}</td>
                <td className="px-4 py-3 text-right">{displaySalesMoney(invoice.totalMinor, invoice.currencyCode)}</td>
                <td className="px-4 py-3 text-right">{displaySalesMoney(invoice.residualAmountMinor, invoice.currencyCode)}</td>
                <td className="px-4 py-3 text-right">
                  <ButtonLink href={`/admin/sales/invoices/${invoice.id}`} size="sm">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                  No customer invoices found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CustomerPaymentList({ payments }: { payments: PaymentListRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Allocated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/admin/sales/payments/${payment.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {payment.paymentNo}
                  </Link>
                </td>
                <td className="px-4 py-3">{payment.partnerName ?? "-"}</td>
                <td className="px-4 py-3 capitalize">{statusLabel(payment.status)}</td>
                <td className="px-4 py-3">{payment.paymentDate}</td>
                <td className="px-4 py-3">{payment.paymentMethodName}</td>
                <td className="px-4 py-3">{payment.paymentAccountName}</td>
                <td className="px-4 py-3">{payment.reference ?? "-"}</td>
                <td className="px-4 py-3 text-right">{displaySalesMoney(payment.amountMinor, payment.currencyCode)}</td>
                <td className="px-4 py-3 text-right">{displaySalesMoney(payment.allocatedAmountMinor, payment.currencyCode)}</td>
                <td className="px-4 py-3 text-right">
                  <ButtonLink href={`/admin/sales/payments/${payment.id}`} size="sm">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {payments.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  No customer payments found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function DeliveryList({ deliveries }: { deliveries: DeliveryListRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Delivery</th>
              <th className="px-4 py-3">Sales Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((delivery) => (
              <tr key={delivery.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/admin/sales/deliveries/${delivery.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {delivery.deliveryNo}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/admin/sales/${delivery.salesOrderId}`} className="text-primary underline-offset-4 hover:underline">
                    {delivery.orderNo}
                  </Link>
                </td>
                <td className="px-4 py-3">{delivery.customerName}</td>
                <td className="px-4 py-3 capitalize">{statusLabel(delivery.status)}</td>
                <td className="px-4 py-3">{delivery.deliveryDate}</td>
                <td className="px-4 py-3">{delivery.sourceLocationCode}</td>
                <td className="px-4 py-3 text-right">{delivery.lineCount}</td>
                <td className="px-4 py-3 text-right">{delivery.quantityDelivered}</td>
                <td className="px-4 py-3 text-right">{displaySalesMoney(delivery.totalCostMinor, delivery.currencyCode)}</td>
                <td className="px-4 py-3 text-right">
                  <ButtonLink href={`/admin/sales/deliveries/${delivery.id}`} size="sm">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  No deliveries found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SalesOrderList({ orders }: { orders: SalesOrderListRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Order Date</th>
              <th className="px-4 py-3">Valid Until</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Ordered</th>
              <th className="px-4 py-3 text-right">Delivered</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/admin/sales/${order.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {order.orderNo}
                  </Link>
                  <div className="text-xs text-muted-foreground">{order.customerReference ?? "-"}</div>
                </td>
                <td className="px-4 py-3">{order.customerName}</td>
                <td className="px-4 py-3 capitalize">{statusLabel(order.status)}</td>
                <td className="px-4 py-3">{order.orderDate}</td>
                <td className="px-4 py-3">{order.validUntil ?? "-"}</td>
                <td className="px-4 py-3">{order.sourceLocationCode ?? "-"}</td>
                <td className="px-4 py-3 text-right">{order.lineCount}</td>
                <td className="px-4 py-3 text-right">{order.quantityOrdered}</td>
                <td className="px-4 py-3 text-right">{order.quantityDelivered}</td>
                <td className="px-4 py-3 text-right">{displaySalesMoney(order.totalMinor, order.currencyCode)}</td>
                <td className="px-4 py-3 text-right">
                  <ButtonLink href={`/admin/sales/${order.id}`} size="sm">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                  No sales orders found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
