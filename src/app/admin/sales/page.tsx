import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { cn } from "@/lib/utils";
import { requirePermission, getUserPermissionCodes } from "@/server/auth/session";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";
import { getPaymentList } from "@/server/payments/payments";
import type { PaymentListRow } from "@/server/payments/types";
import { displayReturnMoney, getCustomerReturnList } from "@/server/returns/returns";
import type { CustomerReturnListRow } from "@/server/returns/types";
import { NewSalesOrderModal } from "@/app/admin/sales/new-sales-order-modal";
import { SalesKpiCards } from "@/app/admin/sales/sales-kpi-cards";
import { displaySalesMoney, getCustomerInvoiceList, getDeliveryList, getSalesFormOptions, getSalesOrderList } from "@/server/sales/sales";
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
    new?: string;
  }>;
};

function todayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Addis_Ababa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const user = await requirePermission(PERMISSIONS.SALES.ORDERS_VIEW);
  const userPerms = await getUserPermissionCodes(user.id);
  const canCreate = userHasPermission(userPerms, PERMISSIONS.SALES.CREATE);
  const canManageReturns = userHasPermission(userPerms, PERMISSIONS.SALES.RETURNS_MANAGE);

  const params = await searchParams;
  const view = params.view ?? "orders";

  const allOrders = await getSalesOrderList();

  if (view === "deliveries") {
    const deliveries = await getDeliveryList({ salesOrderId: params.salesOrderId });

    return (
      <SalesLayout currentView={view} title="Deliveries" orders={allOrders} notice={params.notice} error={params.error}>
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
      <SalesLayout currentView={view} title="Customer Invoices" orders={allOrders} notice={params.notice} error={params.error}>
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
      <SalesLayout currentView={view} title="Customer Payments" orders={allOrders} notice={params.notice} error={params.error}>
        <CustomerPaymentList payments={payments} />
      </SalesLayout>
    );
  }

  if (view === "returns") {
    const returns = await getCustomerReturnList(params.salesOrderId);

    return (
      <SalesLayout
        currentView={view}
        title="Returns"
        orders={allOrders}
        notice={params.notice}
        error={params.error}
        actions={canManageReturns ? <ButtonLink href="/admin/sales/returns/new">New Return</ButtonLink> : undefined}
      >
        <CustomerReturnList returns={returns} />
      </SalesLayout>
    );
  }

  const formOptions = await getSalesFormOptions();

  return (
    <SalesLayout
      currentView={view}
      title="Quotations / Orders"
      orders={allOrders}
      notice={params.notice}
      error={params.error}
      actions={
        canCreate ? (
          <NewSalesOrderModal
            customers={formOptions.customers}
            owners={formOptions.owners}
            products={formOptions.products}
            productCategories={formOptions.productCategories}
            productBrands={formOptions.productBrands}
            productUnits={formOptions.productUnits}
            locations={formOptions.locations}
            taxes={formOptions.taxes}
            availableStock={formOptions.availableStock}
            initialOpen={params.new === "1" || params.new === "true"}
            defaultDate={todayDate()}
          />
        ) : undefined
      }
    >
      <SalesOrderList orders={allOrders} />
    </SalesLayout>
  );
}

const salesTabs = [
  { label: "Quotations & Orders", href: "/admin/sales", key: "orders" },
  { label: "Deliveries", href: "/admin/sales?view=deliveries", key: "deliveries" },
  { label: "Invoices", href: "/admin/sales?view=invoices", key: "invoices" },
  { label: "Payments", href: "/admin/sales?view=payments", key: "payments" },
  { label: "Returns", href: "/admin/sales?view=returns", key: "returns" },
];

function SalesLayout({
  title,
  currentView = "orders",
  orders,
  notice,
  error,
  actions,
  children,
}: {
  title: string;
  currentView?: string;
  orders: SalesOrderListRow[];
  notice?: string;
  error?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Sales Workspace"
        title={title}
        description="Streamlined order management, customer invoicing, delivery fulfillment, and revenue tracking."
        actions={actions}
      />

      <SalesKpiCards orders={orders} />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      {children}
    </PageShell>
  );
}

function CustomerReturnList({ returns }: { returns: CustomerReturnListRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Return No</th>
              <th className="px-4 py-3">Sales Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Refund Amount</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {returns.map((record) => (
              <tr key={record.id} className="group transition-colors hover:bg-muted/30">
                <td className="px-4 py-3.5">
                  <Link href={`/admin/sales/returns/${record.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                    {record.returnNo}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">{record.orderNo}</td>
                <td className="px-4 py-3.5 font-medium text-foreground">{record.customerName}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={record.status} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{record.returnDate}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs">{record.lineCount}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                  {displayReturnMoney(record.refundAmountMinor, record.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink href={`/admin/sales/returns/${record.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {returns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No customer returns recorded yet.
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
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Invoice No</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Source Ref</th>
              <th className="px-4 py-3">Invoice Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Invoice Date</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Products</th>
              <th className="px-4 py-3 text-right">Grand Total</th>
              <th className="px-4 py-3 text-right">Residual</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="group transition-colors hover:bg-muted/30">
                <td className="px-4 py-3.5">
                  <Link href={`/admin/sales/invoices/${invoice.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                    {invoice.invoiceNo}
                  </Link>
                  {invoice.customerReference ? (
                    <div className="text-xs text-muted-foreground">Ref: {invoice.customerReference}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3.5 font-medium text-foreground">{invoice.customerName}</td>
                <td className="px-4 py-3.5">
                  {invoice.orderNo ? (
                    <Link href={`/admin/sales/${invoice.salesOrderId}`} className="font-mono text-xs text-primary hover:underline">
                      {invoice.orderNo}
                    </Link>
                  ) : invoice.deliveryNo ? (
                    <span className="font-mono text-xs text-muted-foreground">{invoice.deliveryNo}</span>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={invoice.status} />
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={invoice.paymentStatus} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{invoice.invoiceDate}</td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{invoice.dueDate ?? "-"}</td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground max-w-[200px] truncate">{invoice.productSummary ?? "-"}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                  {displaySalesMoney(invoice.totalMinor, invoice.currencyCode)}
                </td>
                <td className={`px-4 py-3.5 text-right font-mono text-xs font-bold ${invoice.residualAmountMinor > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {displaySalesMoney(invoice.residualAmountMinor, invoice.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink href={`/admin/sales/invoices/${invoice.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No customer invoices recorded yet.
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
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Payment No</th>
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
          <tbody className="divide-y divide-border/60">
            {payments.map((payment) => (
              <tr key={payment.id} className="group transition-colors hover:bg-muted/30">
                <td className="px-4 py-3.5">
                  <Link href={`/admin/sales/payments/${payment.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                    {payment.paymentNo}
                  </Link>
                </td>
                <td className="px-4 py-3.5 font-medium text-foreground">{payment.partnerName ?? "-"}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={payment.status} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{payment.paymentDate}</td>
                <td className="px-4 py-3.5 text-xs font-medium text-foreground">{payment.paymentMethodName}</td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{payment.paymentAccountName}</td>
                <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">{payment.reference ?? "-"}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                  {displaySalesMoney(payment.amountMinor, payment.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-xs text-primary font-semibold">
                  {displaySalesMoney(payment.allocatedAmountMinor, payment.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink href={`/admin/sales/payments/${payment.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {payments.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No customer payments recorded yet.
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
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Delivery No</th>
              <th className="px-4 py-3">Order Ref</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Source Warehouse</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Quantity</th>
              <th className="px-4 py-3 text-right">Total Cost</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {deliveries.map((delivery) => (
              <tr key={delivery.id} className="group transition-colors hover:bg-muted/30">
                <td className="px-4 py-3.5">
                  <Link href={`/admin/sales/deliveries/${delivery.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                    {delivery.deliveryNo}
                  </Link>
                </td>
                <td className="px-4 py-3.5">
                  <Link href={`/admin/sales/${delivery.salesOrderId}`} className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline">
                    {delivery.orderNo}
                  </Link>
                </td>
                <td className="px-4 py-3.5 font-medium text-foreground">{delivery.customerName}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={delivery.status} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{delivery.deliveryDate}</td>
                <td className="px-4 py-3.5 text-xs font-medium text-muted-foreground">{delivery.sourceLocationCode}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">{delivery.lineCount}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">{delivery.quantityDelivered}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                  {displaySalesMoney(delivery.totalCostMinor, delivery.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink href={`/admin/sales/deliveries/${delivery.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No deliveries recorded yet.
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
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Order No</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Order Status</th>
              <th className="px-4 py-3">Order Date</th>
              <th className="px-4 py-3">Payment Settlement</th>
              <th className="px-4 py-3">Source Warehouse</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Ordered</th>
              <th className="px-4 py-3 text-right">Delivered</th>
              <th className="px-4 py-3 text-right">Grand Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {orders.map((order) => (
              <tr key={order.id} className="group transition-colors hover:bg-muted/30">
                <td className="px-4 py-3.5">
                  <Link href={`/admin/sales/${order.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-xs font-bold text-primary transition-all hover:bg-primary/10 hover:border-primary/40">
                    {order.orderNo}
                  </Link>
                  {order.customerReference ? (
                    <div className="text-xs text-muted-foreground">Ref: {order.customerReference}</div>
                  ) : null}
                  {order.fsNumber ? <div className="text-[11px] font-mono text-muted-foreground">FS: {order.fsNumber}</div> : null}
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{order.customerName}</div>
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{order.orderDate}</td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold capitalize text-foreground">{order.paymentTerm}</span>
                    {order.residualAmountMinor === 0 || order.totalMinor === 0 ? (
                      <StatusBadge status="paid" label="Fully Paid" />
                    ) : order.residualAmountMinor < order.totalMinor ? (
                      <StatusBadge
                        status="partially_paid"
                        label={`Due ${displaySalesMoney(order.residualAmountMinor, order.currencyCode)}`}
                      />
                    ) : (
                      <StatusBadge
                        status="unpaid"
                        label={`Unpaid ${displaySalesMoney(order.residualAmountMinor, order.currencyCode)}`}
                      />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-xs font-medium text-muted-foreground">{order.sourceLocationCode ?? "-"}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">{order.lineCount}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">{order.quantityOrdered}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">{order.quantityDelivered}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-extrabold text-foreground">
                  {displaySalesMoney(order.totalMinor, order.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink href={`/admin/sales/${order.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-sm text-muted-foreground">
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
