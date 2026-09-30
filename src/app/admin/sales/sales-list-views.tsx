"use client";

import Link from "next/link";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { useTranslation } from "@/lib/i18n/use-translation";
import { displayReturnMoney, displaySalesMoney } from "@/lib/catalog-utils";
import type { CustomerReturnListRow } from "@/server/returns/types";
import type { CustomerInvoiceListRow, DeliveryListRow, SalesOrderListRow } from "@/server/sales/types";
import type { PaymentListRow } from "@/server/payments/types";

export function CustomerReturnList({ returns }: { returns: CustomerReturnListRow[] }) {
  const { t } = useTranslation();

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <TableSearchInput placeholder={t("sales.searchReturns", "Search return #, order #, or customer...")} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TableFilterSelect
            paramName="status"
            label="Status"
            options={[
              { value: "draft", label: t("inventory.draft", "Draft") },
              { value: "posted", label: t("inventory.posted", "Posted") },
              { value: "cancelled", label: t("inventory.cancelled", "Cancelled") },
            ]}
            allLabel="All Statuses"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">{t("sales.col.returnNo", "Return No")}</th>
              <th className="px-4 py-3">{t("sales.col.salesOrder", "Sales Order")}</th>
              <th className="px-4 py-3">{t("sales.col.customer", "Customer")}</th>
              <th className="px-4 py-3">{t("sales.col.status", "Status")}</th>
              <th className="px-4 py-3">{t("sales.col.date", "Date")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.lines", "Lines")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.refundAmount", "Refund Amount")}</th>
              <th className="px-4 py-3 text-right">{t("action.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {returns.map((record) => (
              <ClickableTableRow key={record.id} href={`/admin/sales/returns/${record.id}`}>
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
                  <ButtonLink href={`/admin/sales/returns/${record.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                    {t("action.details", "Details")}
                  </ButtonLink>
                </td>
              </ClickableTableRow>
            ))}
            {returns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {t("sales.empty.noReturns", "No customer returns recorded yet.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CustomerInvoiceList({ invoices }: { invoices: CustomerInvoiceListRow[] }) {
  const { t } = useTranslation();

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <TableSearchInput placeholder={t("sales.searchInvoices", "Search invoice #, customer name, or source ref...")} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TableFilterSelect
            paramName="status"
            label="Status"
            options={[
              { value: "draft", label: t("inventory.draft", "Draft") },
              { value: "posted", label: t("inventory.posted", "Posted") },
              { value: "cancelled", label: t("inventory.cancelled", "Cancelled") },
            ]}
            allLabel="All Statuses"
          />
          <TableFilterSelect
            paramName="paymentStatus"
            label="Payment"
            options={[
              { value: "fully_paid", label: t("purchasing.fullyPaid", "Fully Paid") },
              { value: "partially_paid", label: t("purchasing.partiallyPaid", "Partially Paid") },
              { value: "not_paid", label: t("status.unpaid", "Not Paid") },
            ]}
            allLabel="All Payments"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">{t("sales.col.invoiceNo", "Invoice No")}</th>
              <th className="px-4 py-3">{t("sales.col.customer", "Customer")}</th>
              <th className="px-4 py-3">{t("sales.col.sourceRef", "Source Ref")}</th>
              <th className="px-4 py-3">{t("sales.col.invoiceStatus", "Invoice Status")}</th>
              <th className="px-4 py-3">{t("sales.col.payment", "Payment")}</th>
              <th className="px-4 py-3">{t("sales.col.invoiceDate", "Invoice Date")}</th>
              <th className="px-4 py-3">{t("sales.col.dueDate", "Due Date")}</th>
              <th className="px-4 py-3">{t("sales.col.products", "Products")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.grandTotal", "Grand Total")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.residual", "Residual")}</th>
              <th className="px-4 py-3 text-right">{t("action.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {invoices.map((invoice) => (
              <ClickableTableRow key={invoice.id} href={`/admin/sales/invoices/${invoice.id}`}>
                <td className="px-4 py-3.5">
                  <Link href={`/admin/sales/invoices/${invoice.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                    {invoice.invoiceNo}
                  </Link>
                  {invoice.customerReference ? (
                    <div className="text-xs text-muted-foreground">{t("purchasing.ref", "Ref")}: {invoice.customerReference}</div>
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
                  <ButtonLink href={`/admin/sales/invoices/${invoice.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                    {t("action.details", "Details")}
                  </ButtonLink>
                </td>
              </ClickableTableRow>
            ))}
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {t("sales.empty.noInvoices", "No customer invoices recorded yet.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CustomerPaymentList({ payments }: { payments: PaymentListRow[] }) {
  const { t } = useTranslation();

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <TableSearchInput placeholder={t("sales.searchPayments", "Search payment #, customer, or reference...")} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TableFilterSelect
            paramName="status"
            label="Status"
            options={[
              { value: "draft", label: t("inventory.draft", "Draft") },
              { value: "posted", label: t("inventory.posted", "Posted") },
              { value: "cancelled", label: t("inventory.cancelled", "Cancelled") },
            ]}
            allLabel="All Statuses"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">{t("sales.col.paymentNo", "Payment No")}</th>
              <th className="px-4 py-3">{t("sales.col.customer", "Customer")}</th>
              <th className="px-4 py-3">{t("sales.col.status", "Status")}</th>
              <th className="px-4 py-3">{t("sales.col.date", "Date")}</th>
              <th className="px-4 py-3">{t("sales.col.method", "Method")}</th>
              <th className="px-4 py-3">{t("sales.col.account", "Account")}</th>
              <th className="px-4 py-3">{t("sales.col.reference", "Reference")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.amount", "Amount")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.allocated", "Allocated")}</th>
              <th className="px-4 py-3 text-right">{t("action.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {payments.map((payment) => (
              <ClickableTableRow key={payment.id} href={`/admin/sales/payments/${payment.id}`}>
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
                  <ButtonLink href={`/admin/sales/payments/${payment.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                    {t("action.details", "Details")}
                  </ButtonLink>
                </td>
              </ClickableTableRow>
            ))}
            {payments.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {t("sales.empty.noPayments", "No customer payments recorded yet.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function DeliveryList({ deliveries }: { deliveries: DeliveryListRow[] }) {
  const { t } = useTranslation();

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <TableSearchInput placeholder={t("sales.searchDeliveries", "Search delivery #, order #, or customer...")} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TableFilterSelect
            paramName="status"
            label="Status"
            options={[
              { value: "draft", label: t("inventory.draft", "Draft") },
              { value: "confirmed", label: t("inventory.confirmed", "Confirmed") },
              { value: "done", label: t("inventory.done", "Done") },
              { value: "cancelled", label: t("inventory.cancelled", "Cancelled") },
            ]}
            allLabel="All Statuses"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">{t("sales.col.deliveryNo", "Delivery No")}</th>
              <th className="px-4 py-3">{t("sales.col.orderRef", "Order Ref")}</th>
              <th className="px-4 py-3">{t("sales.col.customer", "Customer")}</th>
              <th className="px-4 py-3">{t("sales.col.status", "Status")}</th>
              <th className="px-4 py-3">{t("sales.col.date", "Date")}</th>
              <th className="px-4 py-3">{t("sales.col.sourceWarehouse", "Source Warehouse")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.lines", "Lines")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.quantity", "Quantity")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.totalCost", "Total Cost")}</th>
              <th className="px-4 py-3 text-right">{t("action.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {deliveries.map((delivery) => (
              <ClickableTableRow key={delivery.id} href={`/admin/sales/deliveries/${delivery.id}`}>
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
                  <ButtonLink href={`/admin/sales/deliveries/${delivery.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                    {t("action.details", "Details")}
                  </ButtonLink>
                </td>
              </ClickableTableRow>
            ))}
            {deliveries.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {t("sales.empty.noDeliveries", "No deliveries recorded yet.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SalesOrderList({
  orders,
  locations = [],
}: {
  orders: SalesOrderListRow[];
  locations?: { id: string; code: string; name: string }[];
}) {
  const { t } = useTranslation();

  const statusOptions = [
    { value: "quotation", label: t("status.quotation", "Quotation") },
    { value: "confirmed", label: t("status.confirmed", "Confirmed") },
    { value: "partially_delivered", label: t("status.partially_delivered", "Partially Delivered") },
    { value: "delivered", label: t("status.delivered", "Delivered") },
    { value: "invoiced", label: t("status.invoiced", "Invoiced") },
    { value: "cancelled", label: t("status.cancelled", "Cancelled") },
  ];

  const paymentTermOptions = [
    { value: "cash", label: t("common.cash", "Cash") },
    { value: "credit", label: t("common.credit", "Credit") },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <TableSearchInput
            placeholder="Search order #, customer name, ref, or FS #..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {locations.length > 0 ? (
            <TableFilterSelect
              paramName="locationId"
              label="Warehouse"
              options={locations.map((loc) => ({ value: loc.id, label: `${loc.code} - ${loc.name}` }))}
              allLabel="All Locations"
            />
          ) : null}
          <TableFilterSelect
            paramName="status"
            label="Status"
            options={statusOptions}
            allLabel="All Statuses"
          />
          <TableFilterSelect
            paramName="paymentTerm"
            label="Term"
            options={paymentTermOptions}
            allLabel="All Terms"
          />
          <TableFilterSelect
            paramName="paymentStatus"
            label="Payment"
            options={[
              { value: "fully_paid", label: t("purchasing.fullyPaid", "Fully Paid") },
              { value: "partially_paid", label: t("purchasing.partiallyPaid", "Partially Paid") },
              { value: "not_paid", label: t("status.unpaid", "Not Paid") },
            ]}
            allLabel="All Payments"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">{t("sales.col.orderNo", "Order No")}</th>
              <th className="px-4 py-3">{t("sales.col.customer", "Customer")}</th>
              <th className="px-4 py-3">{t("sales.col.orderStatus", "Order Status")}</th>
              <th className="px-4 py-3">{t("sales.col.orderDate", "Order Date")}</th>
              <th className="px-4 py-3">{t("sales.col.paymentSettlement", "Payment Settlement")}</th>
              <th className="px-4 py-3">{t("sales.col.sourceWarehouse", "Source Warehouse")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.lines", "Lines")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.ordered", "Ordered")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.delivered", "Delivered")}</th>
              <th className="px-4 py-3 text-right">{t("sales.col.grandTotal", "Grand Total")}</th>
              <th className="px-4 py-3 text-right">{t("action.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {orders.map((order) => (
              <ClickableTableRow key={order.id} href={`/admin/sales/${order.id}`}>
                <td className="px-4 py-3.5">
                  <Link href={`/admin/sales/${order.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-xs font-bold text-primary transition-all hover:bg-primary/10 hover:border-primary/40">
                    {order.orderNo}
                  </Link>
                  {order.customerReference ? (
                    <div className="text-xs text-muted-foreground">{t("purchasing.ref", "Ref")}: {order.customerReference}</div>
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
                    <span className="text-xs font-semibold capitalize text-foreground">
                      {order.paymentTerm === "cash" ? t("common.cash", "Cash") : order.paymentTerm === "credit" ? t("common.credit", "Credit") : order.paymentTerm}
                    </span>
                    {order.residualAmountMinor === 0 || order.totalMinor === 0 ? (
                      <StatusBadge status="paid" label={t("purchasing.fullyPaid", "Fully Paid")} />
                    ) : order.residualAmountMinor < order.totalMinor ? (
                      <StatusBadge
                        status="partially_paid"
                        label={`${t("purchasing.due", "Due")} ${displaySalesMoney(order.residualAmountMinor, order.currencyCode)}`}
                      />
                    ) : (
                      <StatusBadge
                        status="unpaid"
                        label={`${t("Unpaid", "Unpaid")} ${displaySalesMoney(order.residualAmountMinor, order.currencyCode)}`}
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
                  <ButtonLink href={`/admin/sales/${order.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                    {t("action.details", "Details")}
                  </ButtonLink>
                </td>
              </ClickableTableRow>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {t("sales.empty.noOrders", "No sales orders found.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
