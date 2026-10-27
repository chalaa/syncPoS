"use client";

import Link from "next/link";
import { Calendar, ChevronRight, Package, Truck, User, DollarSign, Layers } from "lucide-react";

import { TableFilterBar } from "@/components/ui/table-filter-bar";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TableSortSelect, type TableSortOption } from "@/components/ui/table-sort-select";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { useViewMode } from "@/components/ui/view-mode-toggle";
import { useTranslation } from "@/lib/i18n/use-translation";
import { T } from "@/components/ui/t";
import {
  displayPaymentMoney,
  displayPurchaseMoney,
  displayReturnMoney,
} from "@/lib/catalog-utils";
import type {
  PurchaseLandedCostListRow,
  PurchaseOrderListRow,
  PurchaseReceiptListRow,
} from "@/server/purchasing/types";
import type { PaymentListRow } from "@/server/payments/types";
import type { SupplierReturnListRow } from "@/server/returns/types";

export function SupplierReturnList({ returns }: { returns: SupplierReturnListRow[] }) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useViewMode("purchasing_returns", "table");

  const statusOptions = [
    { value: "draft", label: t("inventory.draft", "Draft") },
    { value: "posted", label: t("inventory.posted", "Posted") },
    { value: "cancelled", label: t("inventory.cancelled", "Cancelled") },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder={t("purchasing.searchReturns", "Search return #, receipt #, or supplier...")}
        filterParamNames={["status"]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
        <TableFilterSelect paramName="status" label="Status" options={statusOptions} allLabel="All Statuses" />
      </TableFilterBar>

      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {returns.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <T k="purchasing.noReturnsYet" fallback="No supplier returns recorded yet." />
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
                          href={`/admin/purchasing/returns/${record.id}`}
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
                        <Truck className="size-3.5 text-blue-500 shrink-0" />
                        <span className="font-semibold text-foreground truncate">{record.supplierName}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Receipt: <span className="font-mono">{record.receiptNo}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        <T k="purchasing.vendorRefund" fallback="Vendor Refund" />
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayReturnMoney(record.refundAmountMinor, record.currencyCode)}
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/purchasing/returns/${record.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span><T k="action.details" fallback="Details" /></span>
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
              <T k="purchasing.noReturnsYet" fallback="No supplier returns recorded yet." />
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
                        href={`/admin/purchasing/returns/${record.id}`}
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
                      <div className="font-medium text-foreground truncate">{record.supplierName}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Receipt: {record.receiptNo}</span>
                        <span>·</span>
                        <span>{record.lineCount} lines</span>
                        <StatusBadge status={record.status} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        <T k="purchasing.vendorRefund" fallback="Vendor Refund" />
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayReturnMoney(record.refundAmountMinor, record.currencyCode)}
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/purchasing/returns/${record.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span><T k="action.details" fallback="Details" /></span>
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
                <th className="px-4 py-3"><T k="purchasing.returnNo" fallback="Return No" /></th>
                <th className="px-4 py-3"><T k="purchasing.receiptRef" fallback="Receipt Ref" /></th>
                <th className="px-4 py-3"><T k="Supplier" /></th>
                <th className="px-4 py-3"><T k="field.status" /></th>
                <th className="px-4 py-3"><T k="field.date" fallback="Date" /></th>
                <th className="px-4 py-3 text-right"><T k="purchasing.lines" fallback="Lines" /></th>
                <th className="px-4 py-3 text-right"><T k="purchasing.vendorRefund" fallback="Vendor Refund" /></th>
                <th className="px-4 py-3 text-right"><T k="action.actions" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {returns.map((record) => (
                <ClickableTableRow key={record.id} href={`/admin/purchasing/returns/${record.id}`}>
                  <td className="px-4 py-3.5">
                    <Link href={`/admin/purchasing/returns/${record.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                      {record.returnNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">{record.receiptNo}</td>
                  <td className="px-4 py-3.5 font-medium text-foreground">{record.supplierName}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={record.status} />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">{record.returnDate}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs">{record.lineCount}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                    {displayReturnMoney(record.refundAmountMinor, record.currencyCode)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <ButtonLink href={`/admin/purchasing/returns/${record.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs"><T k="action.details" fallback="Details" /></ButtonLink>
                  </td>
                </ClickableTableRow>
              ))}
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    <T k="purchasing.noReturnsYet" fallback="No supplier returns recorded yet." />
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

export function LandedCostList({ landedCosts }: { landedCosts: PurchaseLandedCostListRow[] }) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useViewMode("purchasing_landed_costs", "table");

  const statusOptions = [
    { value: "draft", label: "status.draft" },
    { value: "posted", label: "status.posted" },
    { value: "cancelled", label: "status.cancelled" },
  ];

  const costTypeOptions = [
    { value: "freight", label: "Freight" },
    { value: "customs", label: "Customs" },
    { value: "insurance", label: "Insurance" },
    { value: "duty", label: "Duty" },
    { value: "handling", label: "Handling" },
    { value: "other", label: "Other" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder="Search cost #, PO ref, receipt #, or vendor..."
        filterParamNames={["status", "costType"]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
        <TableFilterSelect paramName="status" label="Status" options={statusOptions} allLabel="All Statuses" />
        <TableFilterSelect paramName="costType" label="Cost Type" options={costTypeOptions} allLabel="All Types" />
      </TableFilterBar>

      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {landedCosts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <T k="purchasing.noLandedCostsYet" fallback="No landed costs recorded yet." />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {landedCosts.map((cost) => (
                <div
                  key={cost.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/admin/purchasing/landed-costs/${cost.id}`}
                          className="font-mono text-sm font-bold text-primary hover:underline"
                        >
                          {cost.costNo}
                        </Link>
                        <div className="text-xs text-muted-foreground uppercase font-medium mt-0.5">
                          <T k={`status.${cost.costType}`} fallback={cost.costType} />
                        </div>
                      </div>
                      <StatusBadge status={cost.status} />
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <Truck className="size-3.5 text-blue-500 shrink-0" />
                        <span className="font-semibold text-foreground truncate">{cost.vendorName ?? "-"}</span>
                      </div>
                      {cost.orderNo ? (
                        <div className="text-muted-foreground">
                          PO: <span className="font-mono">{cost.orderNo}</span>
                        </div>
                      ) : null}
                      <div className="text-muted-foreground capitalize">
                        Method: <T k={`status.${cost.allocationMethod}`} fallback={cost.allocationMethod} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        <T k="field.amount" fallback="Amount" />
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayPurchaseMoney(cost.amountMinor, cost.currencyCode)}
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/purchasing/landed-costs/${cost.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span><T k="action.details" fallback="Details" /></span>
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
          {landedCosts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <T k="purchasing.noLandedCostsYet" fallback="No landed costs recorded yet." />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {landedCosts.map((cost) => (
                <div
                  key={cost.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                    <div className="shrink-0">
                      <Link
                        href={`/admin/purchasing/landed-costs/${cost.id}`}
                        className="font-mono text-sm font-bold text-primary hover:underline"
                      >
                        {cost.costNo}
                      </Link>
                      <div className="text-xs text-muted-foreground uppercase font-medium mt-0.5">
                        <T k={`status.${cost.costType}`} fallback={cost.costType} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-foreground truncate">{cost.vendorName ?? "-"}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {cost.orderNo ? <span>PO: {cost.orderNo}</span> : null}
                        <StatusBadge status={cost.status} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        <T k="field.amount" fallback="Amount" />
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayPurchaseMoney(cost.amountMinor, cost.currencyCode)}
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/purchasing/landed-costs/${cost.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span><T k="action.details" fallback="Details" /></span>
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
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3"><T k="purchasing.costNo" fallback="Cost No" /></th>
                <th className="px-4 py-3"><T k="purchasing.costType" fallback="Cost Type" /></th>
                <th className="px-4 py-3"><T k="field.status" /></th>
                <th className="px-4 py-3"><T k="Purchase Order" /></th>
                <th className="px-4 py-3"><T k="purchasing.receipt" fallback="Receipt" /></th>
                <th className="px-4 py-3"><T k="purchasing.vendor" fallback="Vendor" /></th>
                <th className="px-4 py-3"><T k="purchasing.allocation" fallback="Allocation" /></th>
                <th className="px-4 py-3 text-right"><T k="purchasing.lines" fallback="Lines" /></th>
                <th className="px-4 py-3 text-right"><T k="field.amount" fallback="Amount" /></th>
                <th className="px-4 py-3 text-right"><T k="action.actions" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {landedCosts.map((cost) => (
                <ClickableTableRow key={cost.id} href={`/admin/purchasing/landed-costs/${cost.id}`}>
                  <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">{cost.costNo}</td>
                  <td className="px-4 py-3.5 text-xs font-medium uppercase tracking-wider text-muted-foreground"><T k={`status.${cost.costType}`} fallback={cost.costType} /></td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={cost.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    {cost.purchaseOrderId ? (
                      <Link href={`/admin/purchasing/${cost.purchaseOrderId}`} className="font-mono text-xs text-primary underline-offset-4 hover:underline">
                        {cost.orderNo}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">{cost.receiptNo ?? "-"}</td>
                  <td className="px-4 py-3.5 font-medium text-foreground">{cost.vendorName ?? "-"}</td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground capitalize"><T k={`status.${cost.allocationMethod}`} fallback={cost.allocationMethod} /></td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs">{cost.allocationCount}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                    {displayPurchaseMoney(cost.amountMinor, cost.currencyCode)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <ButtonLink href={`/admin/purchasing/landed-costs/${cost.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                      <T k="action.details" fallback="Details" />
                    </ButtonLink>
                  </td>
                </ClickableTableRow>
              ))}
              {landedCosts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    <T k="purchasing.noLandedCostsYet" fallback="No landed costs recorded yet." />
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

export function PurchaseOrderList({
  orders,
  locations,
}: {
  orders: PurchaseOrderListRow[];
  locations?: { id: string; code: string; name: string }[];
}) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useViewMode("purchasing_orders", "table");

  const statusOptions = [
    { value: "draft", label: "status.draft" },
    { value: "confirmed", label: "status.confirmed" },
    { value: "partially_received", label: "status.partially_received" },
    { value: "received", label: "status.received" },
    { value: "cancelled", label: "status.cancelled" },
  ];

  const paymentTermOptions = [
    { value: "cash", label: "status.cash" },
    { value: "credit", label: "status.credit" },
  ];

  const locationOptions = (locations ?? []).map((loc) => ({
    value: loc.id,
    label: `${loc.name} (${loc.code})`,
  }));

  const orderSortOptions: TableSortOption[] = [
    { value: "orderDate:desc", label: "sort.dateDesc" },
    { value: "orderDate:asc", label: "sort.dateAsc" },
    { value: "totalMinor:desc", label: "sort.amountDesc" },
    { value: "totalMinor:asc", label: "sort.amountAsc" },
    { value: "orderNo:asc", label: "sort.skuAsc" },
    { value: "supplierName:asc", label: "sort.nameAsc" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder="Search order #, supplier name, or ref..."
        filterParamNames={["status", "paymentTerm", "paymentStatus", "locationId"]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
        <TableFilterSelect
          paramName="status"
          label="Status"
          options={statusOptions}
          allLabel="All Statuses"
        />
        <TableFilterSelect
          paramName="paymentTerm"
          label="purchasing.term"
          options={paymentTermOptions}
          allLabel="All Terms"
        />
        <TableFilterSelect
          paramName="paymentStatus"
          label="purchasing.paymentSettlement"
          options={[
            { value: "fully_paid", label: "purchasing.fullyPaid" },
            { value: "partially_paid", label: "purchasing.partiallyPaid" },
            { value: "not_paid", label: "status.unpaid" },
          ]}
          allLabel="All Payments"
        />
        {locationOptions.length > 0 ? (
          <TableFilterSelect
            paramName="locationId"
            label="status.warehouse"
            options={locationOptions}
            allLabel="All Warehouses"
          />
        ) : null}
        <TableSortSelect options={orderSortOptions} />
      </TableFilterBar>

      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {orders.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <T k="purchasing.noOrdersYet" fallback="No purchase orders recorded yet." />{" "}
              <Link href="/admin/purchasing/new" className="font-semibold text-primary underline-offset-4 hover:underline">
                <T k="purchasing.createFirstPo" fallback="Create the first PO →" />
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/admin/purchasing/${order.id}`}
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
                        <Truck className="size-3.5 text-blue-500 shrink-0" />
                        <span className="font-semibold text-foreground truncate">{order.supplierName}</span>
                      </div>
                      {order.vendorReference ? (
                        <div className="text-muted-foreground">
                          Ref: <span className="font-mono">{order.vendorReference}</span>
                        </div>
                      ) : null}
                      {order.deliverToLocationCode ? (
                        <div className="text-muted-foreground">
                          Deliver To: {order.deliverToLocationCode}
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="capitalize font-semibold text-foreground">
                          <T k={`status.${order.paymentTerm}`} fallback={order.paymentTerm} />
                        </span>
                        {Number(order.totalMinor) === 0 || Number(order.residualAmountMinor) === 0 ? (
                          <StatusBadge status="paid" label={<T k="purchasing.fullyPaid" fallback="Fully Paid" />} />
                        ) : Number(order.residualAmountMinor) < Number(order.totalMinor) ? (
                          <StatusBadge
                            status="partially_paid"
                            label={
                              <>
                                <T k="purchasing.due" fallback="Due" /> {displayPurchaseMoney(order.residualAmountMinor, order.currencyCode)}
                              </>
                            }
                          />
                        ) : (
                          <StatusBadge
                            status="unpaid"
                            label={
                              <>
                                <T k="status.unpaid" /> {displayPurchaseMoney(order.residualAmountMinor, order.currencyCode)}
                              </>
                            }
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        <T k="purchasing.grandTotal" fallback="Grand Total" />
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayPurchaseMoney(order.totalMinor, order.currencyCode)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {order.quantityReceived} / {order.quantityOrdered} received
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/purchasing/${order.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span><T k="purchasing.open" fallback="Open" /></span>
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
          {orders.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <T k="purchasing.noOrdersYet" fallback="No purchase orders recorded yet." />{" "}
              <Link href="/admin/purchasing/new" className="font-semibold text-primary underline-offset-4 hover:underline">
                <T k="purchasing.createFirstPo" fallback="Create the first PO →" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                    <div className="shrink-0">
                      <Link
                        href={`/admin/purchasing/${order.id}`}
                        className="font-mono text-sm font-bold text-primary hover:underline"
                      >
                        {order.orderNo}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="size-3 text-muted-foreground/70" />
                        <span>{order.orderDate}</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-foreground truncate">{order.supplierName}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <StatusBadge status={order.status} />
                        <span className="capitalize">{order.paymentTerm}</span>
                        {order.deliverToLocationCode ? <span>· {order.deliverToLocationCode}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        <T k="purchasing.grandTotal" fallback="Grand Total" />
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayPurchaseMoney(order.totalMinor, order.currencyCode)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {order.quantityReceived} / {order.quantityOrdered}
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/purchasing/${order.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span><T k="purchasing.open" fallback="Open" /></span>
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
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <SortableTableHead sortKey="orderNo" label={<T k="purchasing.orderNo" fallback="Order No" />} className="px-4 py-3" />
                <SortableTableHead sortKey="supplierName" label={<T k="Supplier" />} className="px-4 py-3" />
                <SortableTableHead sortKey="status" label={<T k="purchasing.orderStatus" fallback="Order Status" />} className="px-4 py-3" />
                <SortableTableHead sortKey="orderDate" label={<T k="purchasing.orderDate" fallback="Order Date" />} className="px-4 py-3" />
                <th className="px-4 py-3"><T k="purchasing.paymentSettlement" fallback="Payment Settlement" /></th>
                <th className="px-4 py-3"><T k="purchasing.deliverTo" fallback="Deliver To" /></th>
                <SortableTableHead sortKey="orderedQuantity" label={<T k="purchasing.orderedQty" fallback="Ordered Qty" />} align="right" className="px-4 py-3" />
                <SortableTableHead sortKey="receivedQuantity" label={<T k="purchasing.receivedQty" fallback="Received Qty" />} align="right" className="px-4 py-3" />
                <SortableTableHead sortKey="totalMinor" label={<T k="purchasing.grandTotal" fallback="Grand Total" />} align="right" className="px-4 py-3" />
                <th className="px-4 py-3 text-right"><T k="action.actions" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {orders.map((order) => (
                <ClickableTableRow key={order.id} href={`/admin/purchasing/${order.id}`}>
                  <td className="px-4 py-3.5">
                    <Link href={`/admin/purchasing/${order.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-xs font-bold text-primary transition-all hover:bg-primary/10 hover:border-primary/40">
                      {order.orderNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{order.supplierName}</div>
                    {order.vendorReference ? (
                      <div className="text-xs text-muted-foreground"><T k="purchasing.ref" fallback="Ref" /> {order.vendorReference}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-xs text-muted-foreground">{order.orderDate}</div>
                    {order.paymentTerm === "credit" ? (
                      <div className="text-[11px] text-muted-foreground"><T k="purchasing.due" fallback="Due" /> {order.paymentDueDate ?? "-"}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold capitalize text-foreground"><T k={`status.${order.paymentTerm}`} fallback={order.paymentTerm} /></span>
                      {Number(order.totalMinor) === 0 || Number(order.residualAmountMinor) === 0 ? (
                        <StatusBadge status="paid" label={<T k="purchasing.fullyPaid" fallback="Fully Paid" />} />
                      ) : Number(order.residualAmountMinor) < Number(order.totalMinor) ? (
                        <StatusBadge
                          status="partially_paid"
                          label={
                            <>
                              <T k="purchasing.due" fallback="Due" /> {displayPurchaseMoney(order.residualAmountMinor, order.currencyCode)}
                            </>
                          }
                        />
                      ) : (
                        <StatusBadge
                          status="unpaid"
                          label={
                            <>
                              <T k="status.unpaid" /> {displayPurchaseMoney(order.residualAmountMinor, order.currencyCode)}
                            </>
                          }
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-medium text-muted-foreground">{order.deliverToLocationCode ?? "-"}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">{order.quantityOrdered}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">{order.quantityReceived}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-extrabold text-foreground">
                    {displayPurchaseMoney(order.totalMinor, order.currencyCode)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <ButtonLink href={`/admin/purchasing/${order.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                      <T k="purchasing.open" fallback="Open" />
                    </ButtonLink>
                  </td>
                </ClickableTableRow>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    <T k="purchasing.noOrdersYet" fallback="No purchase orders recorded yet." />{" "}
                    <Link href="/admin/purchasing/new" className="font-semibold text-primary underline-offset-4 hover:underline">
                      <T k="purchasing.createFirstPo" fallback="Create the first PO →" />
                    </Link>
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

export function ReceiptList({
  receipts,
  locations,
}: {
  receipts: PurchaseReceiptListRow[];
  locations?: { id: string; code: string; name: string }[];
}) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useViewMode("purchasing_receipts", "table");

  const statusOptions = [
    { value: "draft", label: "status.draft" },
    { value: "posted", label: "status.posted" },
    { value: "cancelled", label: "status.cancelled" },
  ];

  const locationOptions = (locations ?? []).map((loc) => ({
    value: loc.id,
    label: `${loc.name} (${loc.code})`,
  }));

  const receiptSortOptions: TableSortOption[] = [
    { value: "receiptDate:desc", label: "sort.dateDesc" },
    { value: "receiptDate:asc", label: "sort.dateAsc" },
    { value: "totalMinor:desc", label: "sort.amountDesc" },
    { value: "totalMinor:asc", label: "sort.amountAsc" },
    { value: "receiptNo:asc", label: "sort.skuAsc" },
    { value: "supplierName:asc", label: "sort.nameAsc" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder="Search receipt #, PO ref, supplier, or invoice..."
        filterParamNames={["status", "locationId"]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
        <TableFilterSelect
          paramName="status"
          label="Status"
          options={statusOptions}
          allLabel="All Statuses"
        />
        {locationOptions.length > 0 ? (
          <TableFilterSelect
            paramName="locationId"
            label="status.warehouse"
            options={locationOptions}
            allLabel="All Warehouses"
          />
        ) : null}
        <TableSortSelect options={receiptSortOptions} />
      </TableFilterBar>

      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {receipts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <T k="purchasing.noReceiptsYet" fallback="No goods receipts recorded yet." />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/admin/purchasing/receipts/${receipt.id}`}
                          className="font-mono text-sm font-bold text-primary hover:underline"
                        >
                          {receipt.receiptNo}
                        </Link>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="size-3 text-muted-foreground/70" />
                          <span>{receipt.receiptDate}</span>
                        </div>
                      </div>
                      <StatusBadge status={receipt.status} />
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <Truck className="size-3.5 text-blue-500 shrink-0" />
                        <span className="font-semibold text-foreground truncate">{receipt.supplierName}</span>
                      </div>
                      <div className="text-muted-foreground">
                        PO:{" "}
                        <Link href={`/admin/purchasing/${receipt.purchaseOrderId}`} className="font-mono text-primary hover:underline">
                          {receipt.orderNo}
                        </Link>
                      </div>
                      {receipt.locationCode ? (
                        <div className="text-muted-foreground">
                          Warehouse: {receipt.locationCode}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/60">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        <T k="purchasing.totalValue" fallback="Total Value" />
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayPurchaseMoney(receipt.totalMinor, receipt.currencyCode)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {receipt.quantityReceived} units ({receipt.lineCount} lines)
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/purchasing/receipts/${receipt.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span><T k="action.details" fallback="Details" /></span>
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
          {receipts.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <T k="purchasing.noReceiptsYet" fallback="No goods receipts recorded yet." />
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 flex-1 min-w-0">
                    <div className="shrink-0">
                      <Link
                        href={`/admin/purchasing/receipts/${receipt.id}`}
                        className="font-mono text-sm font-bold text-primary hover:underline"
                      >
                        {receipt.receiptNo}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="size-3 text-muted-foreground/70" />
                        <span>{receipt.receiptDate}</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="font-medium text-foreground truncate">{receipt.supplierName}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>PO: {receipt.orderNo}</span>
                        {receipt.locationCode ? <span>· {receipt.locationCode}</span> : null}
                        <StatusBadge status={receipt.status} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                        <T k="purchasing.totalValue" fallback="Total Value" />
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayPurchaseMoney(receipt.totalMinor, receipt.currencyCode)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {receipt.quantityReceived} units
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/purchasing/receipts/${receipt.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span><T k="action.details" fallback="Details" /></span>
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
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <SortableTableHead sortKey="receiptNo" label={<T k="purchasing.receiptNo" fallback="Receipt No" />} className="px-4 py-3" />
                <th className="px-4 py-3"><T k="purchasing.poRef" fallback="PO Ref" /></th>
                <SortableTableHead sortKey="supplierName" label={<T k="Supplier" />} className="px-4 py-3" />
                <SortableTableHead sortKey="status" label={<T k="field.status" />} className="px-4 py-3" />
                <SortableTableHead sortKey="receiptDate" label={<T k="field.date" fallback="Date" />} className="px-4 py-3" />
                <th className="px-4 py-3"><T k="status.warehouse" fallback="Warehouse" /></th>
                <th className="px-4 py-3 text-right"><T k="purchasing.lines" fallback="Lines" /></th>
                <SortableTableHead sortKey="quantityReceived" label={<T k="purchasing.receivedQty" fallback="Received Qty" />} align="right" className="px-4 py-3" />
                <SortableTableHead sortKey="totalMinor" label={<T k="purchasing.totalValue" fallback="Total Value" />} align="right" className="px-4 py-3" />
                <th className="px-4 py-3 text-right"><T k="action.actions" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {receipts.map((receipt) => (
                <ClickableTableRow key={receipt.id} href={`/admin/purchasing/receipts/${receipt.id}`}>
                  <td className="px-4 py-3.5">
                    <Link href={`/admin/purchasing/receipts/${receipt.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                      {receipt.receiptNo}
                    </Link>
                    {receipt.supplierInvoiceNo ? (
                      <div className="text-xs text-muted-foreground"><T k="purchasing.invAbbrev" fallback="Inv:" /> {receipt.supplierInvoiceNo}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5">
                    <Link href={`/admin/purchasing/${receipt.purchaseOrderId}`} className="font-mono text-xs text-muted-foreground hover:text-primary hover:underline">
                      {receipt.orderNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-foreground">{receipt.supplierName}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={receipt.status} />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted-foreground">{receipt.receiptDate}</td>
                  <td className="px-4 py-3.5 text-xs font-medium text-muted-foreground">{receipt.locationCode ?? "-"}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-muted-foreground">{receipt.lineCount}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-foreground">{receipt.quantityReceived}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                    {displayPurchaseMoney(receipt.totalMinor, receipt.currencyCode)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <ButtonLink href={`/admin/purchasing/receipts/${receipt.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                      <T k="action.details" fallback="Details" />
                    </ButtonLink>
                  </td>
                </ClickableTableRow>
              ))}
              {receipts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    <T k="purchasing.noReceiptsYet" fallback="No goods receipts recorded yet." />
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

export function PaymentList({ payments }: { payments: PaymentListRow[] }) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useViewMode("purchasing_payments", "table");

  const statusOptions = [
    { value: "draft", label: "status.draft" },
    { value: "posted", label: "status.posted" },
    { value: "cancelled", label: "status.cancelled" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder="Search payment #, supplier, or reference..."
        filterParamNames={["status"]}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      >
        <TableFilterSelect paramName="status" label="Status" options={statusOptions} allLabel="All Statuses" />
      </TableFilterBar>

      {viewMode === "grid" ? (
        <div className="p-4 sm:p-5">
          {payments.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <T k="purchasing.noPaymentsYet" fallback="No supplier payments recorded yet." />
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
                          href={`/admin/purchasing/payments/${payment.id}`}
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
                        <Truck className="size-3.5 text-blue-500 shrink-0" />
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
                        <T k="field.amount" fallback="Amount" />
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayPaymentMoney(payment.amountMinor, payment.currencyCode)}
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/purchasing/payments/${payment.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span><T k="action.details" fallback="Details" /></span>
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
              <T k="purchasing.noPaymentsYet" fallback="No supplier payments recorded yet." />
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
                        href={`/admin/purchasing/payments/${payment.id}`}
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
                        <T k="field.amount" fallback="Amount" />
                      </div>
                      <div className="font-mono text-sm font-bold text-foreground">
                        {displayPaymentMoney(payment.amountMinor, payment.currencyCode)}
                      </div>
                    </div>

                    <ButtonLink
                      href={`/admin/purchasing/payments/${payment.id}`}
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-3 text-xs font-semibold"
                    >
                      <span><T k="action.details" fallback="Details" /></span>
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
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3"><T k="purchasing.paymentNo" fallback="Payment No" /></th>
                <th className="px-4 py-3"><T k="Supplier" /></th>
                <th className="px-4 py-3"><T k="field.status" /></th>
                <th className="px-4 py-3"><T k="field.date" fallback="Date" /></th>
                <th className="px-4 py-3"><T k="purchasing.paymentMethod" fallback="Payment Method" /></th>
                <th className="px-4 py-3"><T k="field.account" fallback="Account" /></th>
                <th className="px-4 py-3"><T k="Reference" /></th>
                <th className="px-4 py-3 text-right"><T k="field.amount" fallback="Amount" /></th>
                <th className="px-4 py-3 text-right"><T k="report.allocated" fallback="Allocated" /></th>
                <th className="px-4 py-3 text-right"><T k="action.actions" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {payments.map((payment) => (
                <ClickableTableRow key={payment.id} href={`/admin/purchasing/payments/${payment.id}`}>
                  <td className="px-4 py-3.5">
                    <Link href={`/admin/purchasing/payments/${payment.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
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
                    {displayPaymentMoney(payment.amountMinor, payment.currencyCode)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-xs text-primary font-semibold">
                    {displayPaymentMoney(payment.allocatedAmountMinor, payment.currencyCode)}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <ButtonLink href={`/admin/purchasing/payments/${payment.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                      <T k="action.details" fallback="Details" />
                    </ButtonLink>
                  </td>
                </ClickableTableRow>
              ))}
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    <T k="purchasing.noPaymentsYet" fallback="No supplier payments recorded yet." />
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
