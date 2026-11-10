"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronDown, ChevronRight, Package, Truck, User, CreditCard } from "lucide-react";
import { TableFilterBar } from "@/components/ui/table-filter-bar";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TableSortSelect, type TableSortOption } from "@/components/ui/table-sort-select";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { cn } from "@/lib/utils";
import { useViewMode } from "@/components/ui/view-mode-toggle";
import { useTranslation } from "@/lib/i18n/use-translation";
import { displayReturnMoney, displaySalesMoney } from "@/lib/catalog-utils";
import type { CustomerReturnListRow } from "@/server/returns/types";
import type { CustomerInvoiceListRow, DeliveryListRow, SalesOrderListRow } from "@/server/sales/types";
import type { PaymentListRow } from "@/server/payments/types";

export function CustomerReturnList({ returns }: { returns: CustomerReturnListRow[] }) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useViewMode("sales_returns", "table");

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder={t("sales.searchReturns", "Search return #, order #, or customer...")}
        filterParamNames={["status"]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
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
      </TableFilterBar>

      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {returns.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("sales.empty.noReturns", "No customer returns recorded yet.")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {returns.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/admin/sales/returns/${record.id}`}
                          className="font-mono text-sm font-bold text-primary hover:underline"
                        >
                          {record.returnNo}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="size-3 text-muted-foreground/70" />
                          <span>{record.returnDate}</span>
                        </div>
                      </div>
                      <StatusBadge status={record.status} />
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="size-3.5 text-primary shrink-0" />
                        <span className="font-semibold text-foreground truncate">{record.customerName}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {t("sales.col.salesOrder", "Sales Order")}: <span className="font-mono">{record.orderNo}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        {t("sales.col.refundAmount", "Refund Amount")}
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayReturnMoney(record.refundAmountMinor, record.currencyCode)}
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/sales/returns/${record.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span>{t("action.details", "Details")}</span>
                      <ChevronRight className="size-3.5" />
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div>
          {returns.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("sales.empty.noReturns", "No customer returns recorded yet.")}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {returns.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                    <div className="shrink-0">
                      <Link
                        href={`/admin/sales/returns/${record.id}`}
                        className="font-mono text-sm font-bold text-primary hover:underline"
                      >
                        {record.returnNo}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="size-3 text-muted-foreground/70" />
                        <span>{record.returnDate}</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-foreground truncate">{record.customerName}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>SO: {record.orderNo}</span>
                        <span>·</span>
                        <span>{record.lineCount} lines</span>
                        <StatusBadge status={record.status} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        {t("sales.col.refundAmount", "Refund Amount")}
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayReturnMoney(record.refundAmountMinor, record.currencyCode)}
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/sales/returns/${record.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span>{t("action.details", "Details")}</span>
                      <ChevronRight className="size-3.5" />
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
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
      )}
    </section>
  );
}

export function CustomerInvoiceList({ invoices }: { invoices: CustomerInvoiceListRow[] }) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useViewMode("sales_invoices", "table");

  const invoiceSortOptions: TableSortOption[] = [
    { value: "invoiceDate:desc", label: "sort.dateDesc" },
    { value: "invoiceDate:asc", label: "sort.dateAsc" },
    { value: "totalMinor:desc", label: "sort.amountDesc" },
    { value: "totalMinor:asc", label: "sort.amountAsc" },
    { value: "invoiceNo:asc", label: "sort.skuAsc" },
    { value: "customerName:asc", label: "sort.nameAsc" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder={t("sales.searchInvoices", "Search invoice #, customer name, or source ref...")}
        filterParamNames={["status", "paymentStatus"]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
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
        <TableSortSelect options={invoiceSortOptions} />
      </TableFilterBar>

      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {invoices.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("sales.empty.noInvoices", "No customer invoices recorded yet.")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/admin/sales/invoices/${invoice.id}`}
                          className="font-mono text-sm font-bold text-primary hover:underline"
                        >
                          {invoice.invoiceNo}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="size-3 text-muted-foreground/70" />
                          <span>{invoice.invoiceDate}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={invoice.status} />
                        <StatusBadge status={invoice.paymentStatus} />
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="size-3.5 text-primary shrink-0" />
                        <span className="font-semibold text-foreground truncate">{invoice.customerName}</span>
                      </div>
                      {invoice.orderNo ? (
                        <div className="text-muted-foreground">
                          {t("sales.col.salesOrder", "Order")}:{" "}
                          <Link href={`/admin/sales/${invoice.salesOrderId}`} className="font-mono text-primary hover:underline">
                            {invoice.orderNo}
                          </Link>
                        </div>
                      ) : null}
                      {invoice.dueDate ? (
                        <div className="text-muted-foreground">
                          {t("sales.col.dueDate", "Due")}: {invoice.dueDate}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        {t("sales.col.grandTotal", "Grand Total")}
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displaySalesMoney(invoice.totalMinor, invoice.currencyCode)}
                      </div>
                      {invoice.residualAmountMinor > 0 ? (
                        <div className="font-mono text-[11px] font-semibold text-destructive">
                          Due: {displaySalesMoney(invoice.residualAmountMinor, invoice.currencyCode)}
                        </div>
                      ) : null}
                    </div>

                    <ButtonLink
                      href={`/admin/sales/invoices/${invoice.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span>{t("action.details", "Details")}</span>
                      <ChevronRight className="size-3.5" />
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div>
          {invoices.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("sales.empty.noInvoices", "No customer invoices recorded yet.")}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                    <div className="shrink-0">
                      <Link
                        href={`/admin/sales/invoices/${invoice.id}`}
                        className="font-mono text-sm font-bold text-primary hover:underline"
                      >
                        {invoice.invoiceNo}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="size-3 text-muted-foreground/70" />
                        <span>{invoice.invoiceDate}</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-foreground truncate">{invoice.customerName}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {invoice.orderNo ? <span>SO: {invoice.orderNo}</span> : null}
                        <StatusBadge status={invoice.status} />
                        <StatusBadge status={invoice.paymentStatus} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        {t("sales.col.grandTotal", "Grand Total")}
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displaySalesMoney(invoice.totalMinor, invoice.currencyCode)}
                      </div>
                      {invoice.residualAmountMinor > 0 ? (
                        <div className="font-mono text-[11px] font-semibold text-destructive">
                          Due: {displaySalesMoney(invoice.residualAmountMinor, invoice.currencyCode)}
                        </div>
                      ) : null}
                    </div>

                    <ButtonLink
                      href={`/admin/sales/invoices/${invoice.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span>{t("action.details", "Details")}</span>
                      <ChevronRight className="size-3.5" />
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <SortableTableHead sortKey="invoiceNo" label={t("sales.col.invoiceNo", "Invoice No")} className="px-4 py-3" />
                <SortableTableHead sortKey="customerName" label={t("sales.col.customer", "Customer")} className="px-4 py-3" />
                <th className="px-4 py-3">{t("sales.col.sourceRef", "Source Ref")}</th>
                <SortableTableHead sortKey="status" label={t("sales.col.invoiceStatus", "Invoice Status")} className="px-4 py-3" />
                <th className="px-4 py-3">{t("sales.col.payment", "Payment")}</th>
                <SortableTableHead sortKey="invoiceDate" label={t("sales.col.invoiceDate", "Invoice Date")} className="px-4 py-3" />
                <SortableTableHead sortKey="dueDate" label={t("sales.col.dueDate", "Due Date")} className="px-4 py-3" />
                <th className="px-4 py-3">{t("sales.col.products", "Products")}</th>
                <SortableTableHead sortKey="totalMinor" label={t("sales.col.grandTotal", "Grand Total")} align="right" className="px-4 py-3" />
                <SortableTableHead sortKey="residualAmountMinor" label={t("sales.col.residual", "Residual")} align="right" className="px-4 py-3" />
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
      )}
    </section>
  );
}

export function CustomerPaymentList({ payments }: { payments: PaymentListRow[] }) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useViewMode("sales_payments", "table");

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder={t("sales.searchPayments", "Search payment #, customer, or reference...")}
        filterParamNames={["status"]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
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
      </TableFilterBar>

      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {payments.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("sales.empty.noPayments", "No customer payments recorded yet.")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/admin/sales/payments/${payment.id}`}
                          className="font-mono text-sm font-bold text-primary hover:underline"
                        >
                          {payment.paymentNo}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="size-3 text-muted-foreground/70" />
                          <span>{payment.paymentDate}</span>
                        </div>
                      </div>
                      <StatusBadge status={payment.status} />
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="size-3.5 text-primary shrink-0" />
                        <span className="font-semibold text-foreground truncate">{payment.partnerName ?? "-"}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {payment.paymentMethodName} · {payment.paymentAccountName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        {t("sales.col.amount", "Amount")}
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displaySalesMoney(payment.amountMinor, payment.currencyCode)}
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/sales/payments/${payment.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span>{t("action.details", "Details")}</span>
                      <ChevronRight className="size-3.5" />
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div>
          {payments.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("sales.empty.noPayments", "No customer payments recorded yet.")}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                    <div className="shrink-0">
                      <Link
                        href={`/admin/sales/payments/${payment.id}`}
                        className="font-mono text-sm font-bold text-primary hover:underline"
                      >
                        {payment.paymentNo}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="size-3 text-muted-foreground/70" />
                        <span>{payment.paymentDate}</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-foreground truncate">{payment.partnerName ?? "-"}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{payment.paymentMethodName}</span>
                        <span>·</span>
                        <span>{payment.paymentAccountName}</span>
                        <StatusBadge status={payment.status} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        {t("sales.col.amount", "Amount")}
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displaySalesMoney(payment.amountMinor, payment.currencyCode)}
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/sales/payments/${payment.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span>{t("action.details", "Details")}</span>
                      <ChevronRight className="size-3.5" />
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
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
      )}
    </section>
  );
}

export function DeliveryList({ deliveries }: { deliveries: DeliveryListRow[] }) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useViewMode("sales_deliveries", "table");

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder={t("sales.searchDeliveries", "Search delivery #, order #, or customer...")}
        filterParamNames={["status"]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
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
      </TableFilterBar>

      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {deliveries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("sales.empty.noDeliveries", "No deliveries recorded yet.")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/admin/sales/deliveries/${delivery.id}`}
                          className="font-mono text-sm font-bold text-primary hover:underline"
                        >
                          {delivery.deliveryNo}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="size-3 text-muted-foreground/70" />
                          <span>{delivery.deliveryDate}</span>
                        </div>
                      </div>
                      <StatusBadge status={delivery.status} />
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <User className="size-3.5 text-primary shrink-0" />
                        <span className="font-semibold text-foreground truncate">{delivery.customerName}</span>
                      </div>
                      <div className="text-muted-foreground">
                        {t("sales.col.orderRef", "Order")}:{" "}
                        <Link href={`/admin/sales/${delivery.salesOrderId}`} className="font-mono text-primary hover:underline">
                          {delivery.orderNo}
                        </Link>
                      </div>
                      <div className="text-muted-foreground">
                        {t("sales.col.sourceWarehouse", "Warehouse")}: {delivery.sourceLocationCode}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        {t("sales.col.quantity", "Delivered Qty")}
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {delivery.quantityDelivered} ({delivery.lineCount} lines)
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/sales/deliveries/${delivery.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span>{t("action.details", "Details")}</span>
                      <ChevronRight className="size-3.5" />
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div>
          {deliveries.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("sales.empty.noDeliveries", "No deliveries recorded yet.")}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {deliveries.map((delivery) => (
                <div
                  key={delivery.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                    <div className="shrink-0">
                      <Link
                        href={`/admin/sales/deliveries/${delivery.id}`}
                        className="font-mono text-sm font-bold text-primary hover:underline"
                      >
                        {delivery.deliveryNo}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="size-3 text-muted-foreground/70" />
                        <span>{delivery.deliveryDate}</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-foreground truncate">{delivery.customerName}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>SO: {delivery.orderNo}</span>
                        <span>·</span>
                        <span>{delivery.sourceLocationCode}</span>
                        <StatusBadge status={delivery.status} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        {t("sales.col.quantity", "Delivered")}
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {delivery.quantityDelivered}
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/sales/deliveries/${delivery.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span>{t("action.details", "Details")}</span>
                      <ChevronRight className="size-3.5" />
                    </ButtonLink>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
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
      )}
    </section>
  );
}

function SalesOrderProductLinesTable({ order }: { order: SalesOrderListRow }) {
  const lines = order.lines ?? [];
  const baseSubtotal = lines.reduce(
    (acc, l) => acc + Math.round((parseFloat(l.quantityOrdered) || 0) * l.unitPriceMinor),
    0
  );
  const totalDiscount = lines.reduce((acc, l) => acc + (l.discountMinor || 0), 0);
  const totalTax = lines.reduce((acc, l) => acc + (l.taxAmountMinor || 0), 0);

  return (
    <div className="p-4 bg-muted/20 border-l-4 border-l-primary/70 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="size-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Order Products & Price Calculation
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {lines.length} {lines.length === 1 ? "item" : "items"}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1 text-[11px] font-mono border border-border/80 text-muted-foreground shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-foreground/70">Formula:</span>
          <span>(Qty × Unit Price) - Discount + Tax = Line Total</span>
        </div>
      </div>

      {lines.length === 0 ? (
        <div className="py-4 text-center text-xs text-muted-foreground italic bg-background/50 rounded-lg border border-border/50">
          No product lines recorded for this order.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 w-10 text-center">#</th>
                <th className="px-3 py-2">Product Name</th>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2 text-right">Qty Ordered</th>
                <th className="px-3 py-2 text-right">Qty Delivered</th>
                <th className="px-3 py-2 text-right">Unit Price</th>
                <th className="px-3 py-2 text-right">Base (Qty × Price)</th>
                <th className="px-3 py-2 text-right">Discount</th>
                <th className="px-3 py-2 text-right">Tax</th>
                <th className="px-3 py-2 text-right font-bold text-foreground">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50 font-mono text-xs">
              {lines.map((line) => {
                const qty = parseFloat(line.quantityOrdered) || 0;
                const baseAmountMinor = Math.round(qty * line.unitPriceMinor);
                return (
                  <tr key={line.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 text-center text-muted-foreground">{line.lineNo}</td>
                    <td className="px-3 py-2 font-sans font-medium text-foreground">{line.productName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{line.sku || "-"}</td>
                    <td className="px-3 py-2 text-right font-medium text-foreground">{line.quantityOrdered}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{line.quantityDelivered}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{displaySalesMoney(line.unitPriceMinor, order.currencyCode)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{displaySalesMoney(baseAmountMinor, order.currencyCode)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {line.discountMinor > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">-{displaySalesMoney(line.discountMinor, order.currencyCode)}</span>
                      ) : "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {line.taxAmountMinor > 0 ? (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">+{displaySalesMoney(line.taxAmountMinor, order.currencyCode)}</span>
                      ) : "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-foreground">
                      {displaySalesMoney(line.lineTotalMinor, order.currencyCode)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-border/80 bg-muted/30 font-mono text-xs font-semibold">
              <tr>
                <td colSpan={6} className="px-3 py-2.5 text-right font-sans uppercase text-[10px] text-muted-foreground tracking-wider">
                  Total Order Price Calculation:
                </td>
                <td className="px-3 py-2.5 text-right text-muted-foreground">
                  {displaySalesMoney(baseSubtotal, order.currencyCode)}
                </td>
                <td className="px-3 py-2.5 text-right text-amber-600 dark:text-amber-400">
                  {totalDiscount > 0 ? `-${displaySalesMoney(totalDiscount, order.currencyCode)}` : "-"}
                </td>
                <td className="px-3 py-2.5 text-right text-blue-600 dark:text-blue-400">
                  {totalTax > 0 ? `+${displaySalesMoney(totalTax, order.currencyCode)}` : "-"}
                </td>
                <td className="px-3 py-2.5 text-right font-extrabold text-foreground text-sm">
                  {displaySalesMoney(order.totalMinor, order.currencyCode)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
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
  const [viewMode, setViewMode] = useViewMode("sales_orders", "table");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleRow(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

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

  const salesOrderSortOptions: TableSortOption[] = [
    { value: "orderDate:desc", label: "sort.dateDesc" },
    { value: "orderDate:asc", label: "sort.dateAsc" },
    { value: "totalMinor:desc", label: "sort.amountDesc" },
    { value: "totalMinor:asc", label: "sort.amountAsc" },
    { value: "orderNo:asc", label: "sort.skuAsc" },
    { value: "customerName:asc", label: "sort.nameAsc" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder="Search order #, customer name, ref, or FS #..."
        filterParamNames={["locationId", "status", "paymentTerm", "paymentStatus"]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
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
        <TableSortSelect options={salesOrderSortOptions} />
      </TableFilterBar>

      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {orders.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("sales.empty.noOrders", "No sales orders found.")}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((order) => {
                const isExpanded = expandedIds.has(order.id);
                return (
                  <div
                    key={order.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link
                            href={`/admin/sales/${order.id}`}
                            className="font-mono text-sm font-bold text-primary hover:underline"
                          >
                            {order.orderNo}
                          </Link>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <Calendar className="size-3 text-muted-foreground/70" />
                            <span>{order.orderDate}</span>
                          </div>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>

                      <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="size-3.5 text-primary shrink-0" />
                          <span className="font-semibold text-foreground truncate">{order.customerName}</span>
                        </div>
                        {order.sourceLocationCode ? (
                          <div className="text-muted-foreground">
                            {t("sales.col.sourceWarehouse", "Warehouse")}: {order.sourceLocationCode}
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="capitalize font-semibold text-foreground">
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
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-border/60 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                            {t("sales.col.grandTotal", "Grand Total")}
                          </div>
                          <div className="font-mono text-sm font-bold text-foreground">
                            {displaySalesMoney(order.totalMinor, order.currencyCode)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {order.quantityDelivered} / {order.quantityOrdered} delivered
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <ButtonLink
                            href={`/admin/sales/${order.id}`}
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 px-3 text-xs font-semibold"
                          >
                            <span>{t("action.details", "Details")}</span>
                            <ChevronRight className="size-3.5" />
                          </ButtonLink>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleRow(order.id)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-muted/30 py-1.5 text-xs font-semibold text-primary hover:bg-muted transition-colors cursor-pointer"
                      >
                        <ChevronDown className={cn("size-3.5 transition-transform duration-200", isExpanded && "rotate-180")} />
                        <span>{isExpanded ? "Hide products breakdown" : `View products (${order.lines?.length ?? order.lineCount})`}</span>
                      </button>

                      {isExpanded && (
                        <div className="pt-1">
                          <SalesOrderProductLinesTable order={order} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : viewMode === "list" ? (
        <div>
          {orders.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {t("sales.empty.noOrders", "No sales orders found.")}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {orders.map((order) => {
                const isExpanded = expandedIds.has(order.id);
                return (
                  <div key={order.id} className="p-4 transition-colors hover:bg-muted/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                        <div className="shrink-0 flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={isExpanded ? "Collapse products" : "Expand products"}
                            onClick={() => toggleRow(order.id)}
                            className="inline-flex size-7 items-center justify-center rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                          >
                            <ChevronDown className={cn("size-3.5 transition-transform duration-200", isExpanded && "rotate-180")} />
                          </button>
                          <div>
                            <Link
                              href={`/admin/sales/${order.id}`}
                              className="font-mono text-sm font-bold text-primary hover:underline"
                            >
                              {order.orderNo}
                            </Link>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                              <Calendar className="size-3 text-muted-foreground/70" />
                              <span>{order.orderDate}</span>
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="font-medium text-foreground truncate">{order.customerName}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <StatusBadge status={order.status} />
                            <span className="capitalize">{order.paymentTerm}</span>
                            {order.sourceLocationCode ? <span>· {order.sourceLocationCode}</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                        <div className="text-right">
                          <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                            {t("sales.col.grandTotal", "Grand Total")}
                          </div>
                          <div className="font-mono text-sm font-bold text-foreground">
                            {displaySalesMoney(order.totalMinor, order.currencyCode)}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {order.quantityDelivered} / {order.quantityOrdered}
                          </div>
                        </div>

                        <ButtonLink
                          href={`/admin/sales/${order.id}`}
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 px-3 text-xs font-semibold"
                        >
                          <span>{t("action.details", "Details")}</span>
                          <ChevronRight className="size-3.5" />
                        </ButtonLink>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <SalesOrderProductLinesTable order={order} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="w-10 px-2 py-3 text-center" aria-label="Expand row"></th>
                <SortableTableHead sortKey="orderNo" label={t("sales.col.orderNo", "Order No")} className="px-4 py-3" />
                <SortableTableHead sortKey="customerName" label={t("sales.col.customer", "Customer")} className="px-4 py-3" />
                <SortableTableHead sortKey="status" label={t("sales.col.orderStatus", "Order Status")} className="px-4 py-3" />
                <SortableTableHead sortKey="orderDate" label={t("sales.col.orderDate", "Order Date")} className="px-4 py-3" />
                <th className="px-4 py-3">{t("sales.col.paymentSettlement", "Payment Settlement")}</th>
                <th className="px-4 py-3">{t("sales.col.sourceWarehouse", "Source Warehouse")}</th>
                <th className="px-4 py-3 text-right">{t("sales.col.lines", "Lines")}</th>
                <SortableTableHead sortKey="orderedQuantity" label={t("sales.col.ordered", "Ordered")} align="right" className="px-4 py-3" />
                <SortableTableHead sortKey="deliveredQuantity" label={t("sales.col.delivered", "Delivered")} align="right" className="px-4 py-3" />
                <SortableTableHead sortKey="totalMinor" label={t("sales.col.grandTotal", "Grand Total")} align="right" className="px-4 py-3" />
                <th className="px-4 py-3 text-right">{t("action.actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {orders.map((order) => {
                const isExpanded = expandedIds.has(order.id);
                return (
                  <Fragment key={order.id}>
                    <ClickableTableRow href={`/admin/sales/${order.id}`}>
                      <td className="w-10 px-2 py-3.5 text-center">
                        <button
                          type="button"
                          aria-label={isExpanded ? "Collapse line items" : "Expand line items"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(order.id);
                          }}
                          className="inline-flex size-7 items-center justify-center rounded-lg border border-border/80 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                        >
                          <ChevronDown className={cn("size-3.5 transition-transform duration-200", isExpanded && "rotate-180")} />
                        </button>
                      </td>
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
                    {isExpanded && (
                      <tr className="bg-muted/15 border-b border-border/80">
                        <td colSpan={12} className="p-0">
                          <SalesOrderProductLinesTable order={order} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {t("sales.empty.noOrders", "No sales orders found.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
