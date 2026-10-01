"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { displaySalesMoney } from "@/lib/catalog-utils";
import type { DirectVendorSaleListRow } from "@/server/direct-vendor-sales/types";

export function DirectVendorSaleList({ sales }: { sales: DirectVendorSaleListRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <TableSearchInput placeholder="Search sale #, customer, or vendor..." />
        </div>
        <TableFilterSelect
          paramName="status"
          label="Status"
          options={[
            { value: "draft", label: "Draft" },
            { value: "posted", label: "Posted" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          allLabel="All Statuses"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Sale No</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Sale Total</th>
              <th className="px-4 py-3 text-right">Vendor Cost</th>
              <th className="px-4 py-3 text-right">Margin</th>
              <th className="px-4 py-3">Payments</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {sales.map((sale) => (
              <ClickableTableRow key={sale.id} href={`/admin/sales/direct-vendor/${sale.id}`}>
                <td className="px-4 py-3.5">
                  <Link href={`/admin/sales/direct-vendor/${sale.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                    {sale.saleNo}
                  </Link>
                </td>
                <td className="px-4 py-3.5 font-medium text-foreground">{sale.customerName}</td>
                <td className="px-4 py-3.5 text-muted-foreground">{sale.vendorName}</td>
                <td className="px-4 py-3.5"><StatusBadge status={sale.status} /></td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{sale.saleDate}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-bold">{displaySalesMoney(sale.customerTotalMinor, sale.currencyCode)}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs">{displaySalesMoney(sale.vendorCostTotalMinor, sale.currencyCode)}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-bold">{displaySalesMoney(sale.marginMinor, sale.currencyCode)}</td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">
                  <div>Customer: <span className="font-semibold capitalize text-foreground">{sale.customerPaymentTerm}</span>{sale.customerPaymentName ? ` / ${sale.customerPaymentName}` : ""}</div>
                  <div>Vendor: <span className="font-semibold capitalize text-foreground">{sale.vendorPaymentTerm}</span>{sale.vendorPaymentName ? ` / ${sale.vendorPaymentName}` : ""}</div>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink href={`/admin/sales/direct-vendor/${sale.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                    Details
                  </ButtonLink>
                </td>
              </ClickableTableRow>
            ))}
            {sales.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No direct vendor sales recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
