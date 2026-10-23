"use client";

import Link from "next/link";
import { ArrowRight, Calendar, ChevronRight, Coins, CreditCard, ShoppingBag, Truck, User } from "lucide-react";

import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { TableFilterBar } from "@/components/ui/table-filter-bar";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { displaySalesMoney } from "@/lib/catalog-utils";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { DirectVendorSaleListRow } from "@/server/direct-vendor-sales/types";

export function DirectVendorSaleList({ sales }: { sales: DirectVendorSaleListRow[] }) {
  const { t } = useTranslation();

  const statusOptions = [
    { value: "draft", label: t("inventory.draft", "Draft") },
    { value: "posted", label: t("inventory.posted", "Posted") },
    { value: "cancelled", label: t("inventory.cancelled", "Cancelled") },
  ];

  const paymentTermOptions = [
    { value: "cash", label: t("common.cash", "Cash") },
    { value: "credit", label: t("common.credit", "Credit") },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      {/* Responsive Filter Bar */}
      <TableFilterBar
        searchPlaceholder={t("directVendor.searchPlaceholder", "Search sale #, customer, or vendor...")}
        filterParamNames={["status", "customerPaymentTerm", "vendorPaymentTerm"]}
      >
        <TableFilterSelect
          paramName="status"
          label={t("sales.col.status", "Status")}
          options={statusOptions}
          allLabel={t("common.allStatuses", "All Statuses")}
        />
        <TableFilterSelect
          paramName="customerPaymentTerm"
          label="Customer Term"
          options={paymentTermOptions}
          allLabel="All Terms"
        />
        <TableFilterSelect
          paramName="vendorPaymentTerm"
          label="Vendor Term"
          options={paymentTermOptions}
          allLabel="All Terms"
        />
      </TableFilterBar>

      {/* Mobile Card List (visible on screens < md) */}
      <div className="divide-y divide-border/60 md:hidden">
        {sales.map((sale) => (
          <div
            key={sale.id}
            className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 active:bg-muted/50"
          >
            {/* Header: Sale No, Status, Date */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link
                  href={`/admin/sales/direct-vendor/${sale.id}`}
                  className="font-mono text-sm font-bold text-primary hover:underline"
                >
                  {sale.saleNo}
                </Link>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="size-3 text-muted-foreground/70" />
                  <span>{sale.saleDate}</span>
                </div>
              </div>
              <StatusBadge status={sale.status} />
            </div>

            {/* Parties: Customer & Vendor */}
            <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-xs space-y-1.5">
              <div className="flex items-center gap-2">
                <User className="size-3.5 text-primary shrink-0" />
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-semibold text-foreground truncate">{sale.customerName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="size-3.5 text-blue-500 shrink-0" />
                <span className="text-muted-foreground">Vendor:</span>
                <span className="font-medium text-foreground truncate">{sale.vendorName}</span>
              </div>
            </div>

            {/* Financials Grid */}
            <div className="grid grid-cols-3 gap-2 text-center rounded-xl border border-border/60 bg-card p-2.5 shadow-2xs">
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Sale Total</span>
                <span className="font-mono text-xs font-bold text-foreground mt-0.5">
                  {displaySalesMoney(sale.customerTotalMinor, sale.currencyCode)}
                </span>
              </div>
              <div className="flex flex-col items-center border-x border-border/60 px-1">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Vendor Cost</span>
                <span className="font-mono text-xs text-muted-foreground mt-0.5">
                  {displaySalesMoney(sale.vendorCostTotalMinor, sale.currencyCode)}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">Margin</span>
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {displaySalesMoney(sale.marginMinor, sale.currencyCode)}
                </span>
              </div>
            </div>

            {/* Terms and Action Footer */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                <span className="rounded-md bg-muted px-2 py-0.5 font-medium">
                  Cust: <span className="capitalize font-semibold text-foreground">{sale.customerPaymentTerm}</span>
                </span>
                <span className="rounded-md bg-muted px-2 py-0.5 font-medium">
                  Vend: <span className="capitalize font-semibold text-foreground">{sale.vendorPaymentTerm}</span>
                </span>
              </div>

              <ButtonLink
                href={`/admin/sales/direct-vendor/${sale.id}`}
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 px-3 text-xs font-semibold"
              >
                <span>Details</span>
                <ChevronRight className="size-3.5" />
              </ButtonLink>
            </div>
          </div>
        ))}

        {sales.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <ShoppingBag className="mx-auto size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">No direct vendor sales found</p>
            <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or search terms.</p>
          </div>
        ) : null}
      </div>

      {/* Desktop Table View (visible on screens >= md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">{t("sales.col.orderNo", "Sale No")}</th>
              <th className="px-4 py-3">{t("sales.col.customer", "Customer")}</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">{t("sales.col.status", "Status")}</th>
              <th className="px-4 py-3">{t("sales.col.date", "Date")}</th>
              <th className="px-4 py-3 text-right">Sale Total</th>
              <th className="px-4 py-3 text-right">Vendor Cost</th>
              <th className="px-4 py-3 text-right">Margin</th>
              <th className="px-4 py-3">Payments</th>
              <th className="px-4 py-3 text-right">{t("action.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sales.map((sale) => (
              <ClickableTableRow key={sale.id} href={`/admin/sales/direct-vendor/${sale.id}`}>
                <td className="px-4 py-3.5">
                  <Link
                    href={`/admin/sales/direct-vendor/${sale.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-xs font-bold text-primary transition-all hover:bg-primary/10 hover:border-primary/40"
                  >
                    {sale.saleNo}
                  </Link>
                </td>
                <td className="px-4 py-3.5 font-medium text-foreground">{sale.customerName}</td>
                <td className="px-4 py-3.5 text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Truck className="size-3 text-blue-500/70" />
                    <span>{sale.vendorName}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={sale.status} />
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{sale.saleDate}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                  {displaySalesMoney(sale.customerTotalMinor, sale.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">
                  {displaySalesMoney(sale.vendorCostTotalMinor, sale.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {displaySalesMoney(sale.marginMinor, sale.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">
                  <div>
                    Cust:{" "}
                    <span className="font-semibold capitalize text-foreground">{sale.customerPaymentTerm}</span>
                    {sale.customerPaymentName ? ` / ${sale.customerPaymentName}` : ""}
                  </div>
                  <div>
                    Vend:{" "}
                    <span className="font-semibold capitalize text-foreground">{sale.vendorPaymentTerm}</span>
                    {sale.vendorPaymentName ? ` / ${sale.vendorPaymentName}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink
                    href={`/admin/sales/direct-vendor/${sale.id}`}
                    size="sm"
                    variant="outline"
                    className="h-8 px-2.5 text-xs font-medium"
                  >
                    {t("action.details", "Details")}
                  </ButtonLink>
                </td>
              </ClickableTableRow>
            ))}
            {sales.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <ShoppingBag className="size-8 text-muted-foreground/40" />
                    <p className="font-medium text-foreground">No direct vendor sales recorded yet</p>
                    <p className="text-xs">Create a new direct sale to record drop-shipment transactions.</p>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
