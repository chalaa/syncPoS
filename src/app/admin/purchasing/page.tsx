import Link from "next/link";
import type { ReactNode } from "react";

import { TableFilterBar } from "@/components/ui/table-filter-bar";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { TablePagination } from "@/components/ui/table-pagination";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
import { cn } from "@/lib/utils";
import { paginateRows, type PaginationMeta } from "@/lib/pagination";
import { requirePermission, getUserPermissionCodes } from "@/server/auth/session";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";
import {
  displayPurchaseMoney,
  getPurchaseFormOptions,
  getPurchaseLandedCostList,
  getPurchaseOrderList,
  getPurchaseReceiptList,
} from "@/server/purchasing/purchasing";
import { NewPurchaseOrderModal } from "./new-purchase-order-modal";
import { PurchasingKpiCards } from "./purchasing-kpi-cards";
import {
  displayPaymentMoney,
  getPaymentList,
} from "@/server/payments/payments";
import { displayReturnMoney, getSupplierReturnList } from "@/server/returns/returns";
import type {
  PurchaseLandedCostListRow,
  PurchaseOrderListRow,
  PurchaseReceiptListRow,
} from "@/server/purchasing/types";
import type { PaymentListRow } from "@/server/payments/types";
import type { SupplierReturnListRow } from "@/server/returns/types";

export const dynamic = "force-dynamic";

type PurchasingPageProps = {
  searchParams: Promise<{
    view?: string;
    purchaseOrderId?: string;
    vendorBillId?: string;
    directVendorSaleId?: string;
    partnerId?: string;
    notice?: string;
    error?: string;
    new?: string;
    q?: string;
    status?: string;
    paymentTerm?: string;
    paymentStatus?: string;
    locationId?: string;
    costType?: string;
    page?: string;
    pageSize?: string;
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

export default async function PurchasingPage({ searchParams }: PurchasingPageProps) {
  const user = await requirePermission(PERMISSIONS.PURCHASING.ORDERS_VIEW);
  const userPerms = await getUserPermissionCodes(user.id);
  const canCreateOrders = userHasPermission(userPerms, PERMISSIONS.PURCHASING.ORDERS_CREATE);

  const params = await searchParams;
  const view = params.view ?? "orders";
  const query = params.q ?? "";
  const status = params.status ?? "";
  const paymentTerm = params.paymentTerm ?? "";
  const paymentStatus = params.paymentStatus ?? "";
  const locationId = params.locationId ?? "";
  const costType = params.costType ?? "";

  const formOptions = await getPurchaseFormOptions();
  const allOrders = await getPurchaseOrderList({ query, status, paymentTerm, locationId: locationId || undefined, paymentStatus });

  if (view === "receipts") {
    let receipts = await getPurchaseReceiptList(params.purchaseOrderId, locationId || undefined);
    if (query) {
      const q = query.toLowerCase();
      receipts = receipts.filter(
        (r) =>
          r.receiptNo.toLowerCase().includes(q) ||
          (r.orderNo && r.orderNo.toLowerCase().includes(q)) ||
          r.supplierName.toLowerCase().includes(q) ||
          (r.supplierInvoiceNo && r.supplierInvoiceNo.toLowerCase().includes(q))
      );
    }
    if (status) {
      receipts = receipts.filter((r) => r.status === status);
    }
    const page = paginateRows(receipts, params);

    return (
      <PurchasingLayout currentView={view} title="Receipts" orders={allOrders} notice={params.notice} error={params.error} pagination={page.pagination}>
        <ReceiptList receipts={page.rows} locations={formOptions.locations} />
      </PurchasingLayout>
    );
  }

  if (view === "landed-costs") {
    let landedCosts = await getPurchaseLandedCostList(params.purchaseOrderId);
    if (query) {
      const q = query.toLowerCase();
      landedCosts = landedCosts.filter(
        (c) =>
          c.costNo.toLowerCase().includes(q) ||
          (c.orderNo && c.orderNo.toLowerCase().includes(q)) ||
          (c.receiptNo && c.receiptNo.toLowerCase().includes(q)) ||
          (c.vendorName && c.vendorName.toLowerCase().includes(q)) ||
          c.costType.toLowerCase().includes(q)
      );
    }
    if (status) {
      landedCosts = landedCosts.filter((c) => c.status === status);
    }
    if (costType) {
      landedCosts = landedCosts.filter((c) => c.costType === costType);
    }
    const page = paginateRows(landedCosts, params);

    return (
      <PurchasingLayout
        currentView={view}
        title="Landed Costs"
        orders={allOrders}
        notice={params.notice}
        error={params.error}
        pagination={page.pagination}
        actions={<ButtonLink href="/admin/purchasing/landed-costs/new"><T k="purchasing.newLandedCost" fallback="New Landed Cost" /></ButtonLink>}
      >
        <LandedCostList landedCosts={page.rows} />
      </PurchasingLayout>
    );
  }

  if (view === "payments") {
    let payments = await getPaymentList({
      paymentType: "outbound",
      purchaseOrderId: params.purchaseOrderId,
      vendorBillId: params.vendorBillId,
      directVendorSaleId: params.directVendorSaleId,
    });
    if (query) {
      const q = query.toLowerCase();
      payments = payments.filter(
        (p) =>
          p.paymentNo.toLowerCase().includes(q) ||
          (p.partnerName && p.partnerName.toLowerCase().includes(q)) ||
          (p.reference && p.reference.toLowerCase().includes(q)) ||
          p.paymentAccountName.toLowerCase().includes(q)
      );
    }
    if (status) {
      payments = payments.filter((p) => p.status === status);
    }
    const page = paginateRows(payments, params);

    return (
      <PurchasingLayout currentView={view} title="Supplier Payments" orders={allOrders} notice={params.notice} error={params.error} pagination={page.pagination}>
        <PaymentList payments={page.rows} />
      </PurchasingLayout>
    );
  }

  if (view === "returns") {
    let returns = await getSupplierReturnList(params.purchaseOrderId);
    if (query) {
      const q = query.toLowerCase();
      returns = returns.filter(
        (r) =>
          r.returnNo.toLowerCase().includes(q) ||
          r.receiptNo.toLowerCase().includes(q) ||
          r.supplierName.toLowerCase().includes(q)
      );
    }
    if (status) {
      returns = returns.filter((r) => r.status === status);
    }
    const page = paginateRows(returns, params);

    return (
      <PurchasingLayout
        currentView={view}
        title="Supplier Returns"
        orders={allOrders}
        notice={params.notice}
        error={params.error}
        pagination={page.pagination}
        actions={canCreateOrders ? <ButtonLink href="/admin/purchasing/returns/new"><T k="purchasing.newSupplierReturn" fallback="New Supplier Return" /></ButtonLink> : null}
      >
        <SupplierReturnList returns={page.rows} />
      </PurchasingLayout>
    );
  }

  const orderPage = paginateRows(allOrders, params);

  return (
    <PurchasingLayout
      currentView={view}
      title="Purchase Orders"
      orders={allOrders}
      notice={params.notice}
      error={params.error}
      pagination={orderPage.pagination}
      actions={
        canCreateOrders ? (
          <NewPurchaseOrderModal
            suppliers={formOptions.suppliers}
            owners={formOptions.owners}
            products={formOptions.products}
            productCategories={formOptions.productCategories}
            productBrands={formOptions.productBrands}
            productUnits={formOptions.productUnits}
            locations={formOptions.locations}
            taxes={formOptions.taxes}
            initialOpen={params.new === "1" || params.new === "true"}
            defaultDate={todayDate()}
          />
        ) : null
      }
    >
      <PurchaseOrderList orders={orderPage.rows} />
    </PurchasingLayout>
  );
}

const purchasingTabs = [
  { label: "RFQs / Orders", href: "/admin/purchasing", key: "orders" },
  { label: "Receipts", href: "/admin/purchasing?view=receipts", key: "receipts" },
  { label: "Landed Costs", href: "/admin/purchasing?view=landed-costs", key: "landed-costs" },
  { label: "Payments", href: "/admin/purchasing?view=payments", key: "payments" },
  { label: "Returns", href: "/admin/purchasing?view=returns", key: "returns" },
];

function PurchasingLayout({
  title,
  currentView = "orders",
  orders,
  notice,
  error,
  actions,
  pagination,
  children,
}: {
  title: string;
  currentView?: string;
  orders: PurchaseOrderListRow[];
  notice?: string;
  error?: string;
  actions?: ReactNode;
  pagination: PaginationMeta;
  children: ReactNode;
}) {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Purchasing Workspace"
        title={title}
        description="Unified vendor procurement, goods receipt tracking, landed costs, and bill settlements."
        actions={actions}
      />

      <PurchasingKpiCards orders={orders} />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}

      {children}
      <TablePagination pagination={pagination} />
    </PageShell>
  );
}

function SupplierReturnList({ returns }: { returns: SupplierReturnListRow[] }) {
  const statusOptions = [
    { value: "draft", label: "status.draft" },
    { value: "posted", label: "status.posted" },
    { value: "cancelled", label: "status.cancelled" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder="Search return #, receipt ref, or supplier..."
        filterParamNames={["status"]}
      >
        <TableFilterSelect paramName="status" label="Status" options={statusOptions} allLabel="All Statuses" />
      </TableFilterBar>
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
    </section>
  );
}

function LandedCostList({ landedCosts }: { landedCosts: PurchaseLandedCostListRow[] }) {
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
      >
        <TableFilterSelect paramName="status" label="Status" options={statusOptions} allLabel="All Statuses" />
        <TableFilterSelect paramName="costType" label="Cost Type" options={costTypeOptions} allLabel="All Types" />
      </TableFilterBar>
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
    </section>
  );
}

function PurchaseOrderList({
  orders,
  locations,
}: {
  orders: PurchaseOrderListRow[];
  locations?: { id: string; code: string; name: string }[];
}) {
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

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder="Search order #, supplier name, or ref..."
        filterParamNames={["status", "paymentTerm", "paymentStatus", "locationId"]}
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
      </TableFilterBar>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3"><T k="purchasing.orderNo" fallback="Order No" /></th>
              <th className="px-4 py-3"><T k="Supplier" /></th>
              <th className="px-4 py-3"><T k="purchasing.orderStatus" fallback="Order Status" /></th>
              <th className="px-4 py-3"><T k="purchasing.orderDate" fallback="Order Date" /></th>
              <th className="px-4 py-3"><T k="purchasing.paymentSettlement" fallback="Payment Settlement" /></th>
              <th className="px-4 py-3"><T k="purchasing.deliverTo" fallback="Deliver To" /></th>
              <th className="px-4 py-3 text-right"><T k="purchasing.orderedQty" fallback="Ordered Qty" /></th>
              <th className="px-4 py-3 text-right"><T k="purchasing.receivedQty" fallback="Received Qty" /></th>
              <th className="px-4 py-3 text-right"><T k="purchasing.grandTotal" fallback="Grand Total" /></th>
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
    </section>
  );
}

function ReceiptList({
  receipts,
  locations,
}: {
  receipts: PurchaseReceiptListRow[];
  locations?: { id: string; code: string; name: string }[];
}) {
  const statusOptions = [
    { value: "draft", label: "status.draft" },
    { value: "posted", label: "status.posted" },
    { value: "cancelled", label: "status.cancelled" },
  ];

  const locationOptions = (locations ?? []).map((loc) => ({
    value: loc.id,
    label: `${loc.name} (${loc.code})`,
  }));

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <TableFilterBar
        searchPlaceholder="Search receipt #, PO ref, supplier, or invoice..."
        filterParamNames={["status", "locationId"]}
      >
        <TableFilterSelect paramName="status" label="Status" options={statusOptions} allLabel="All Statuses" />
        {locationOptions.length > 0 ? (
          <TableFilterSelect paramName="locationId" label="status.warehouse" options={locationOptions} allLabel="All Warehouses" />
        ) : null}
      </TableFilterBar>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3"><T k="purchasing.receiptNo" fallback="Receipt No" /></th>
              <th className="px-4 py-3"><T k="purchasing.poRef" fallback="PO Ref" /></th>
              <th className="px-4 py-3"><T k="Supplier" /></th>
              <th className="px-4 py-3"><T k="field.status" /></th>
              <th className="px-4 py-3"><T k="field.date" fallback="Date" /></th>
              <th className="px-4 py-3"><T k="status.warehouse" fallback="Warehouse" /></th>
              <th className="px-4 py-3 text-right"><T k="purchasing.lines" fallback="Lines" /></th>
              <th className="px-4 py-3 text-right"><T k="purchasing.receivedQty" fallback="Received Qty" /></th>
              <th className="px-4 py-3 text-right"><T k="purchasing.totalValue" fallback="Total Value" /></th>
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
    </section>
  );
}

function PaymentList({ payments }: { payments: PaymentListRow[] }) {
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
      >
        <TableFilterSelect paramName="status" label="Status" options={statusOptions} allLabel="All Statuses" />
      </TableFilterBar>
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
    </section>
  );
}
