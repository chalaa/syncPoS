import Link from "next/link";
import type { ReactNode } from "react";

import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { TablePagination } from "@/components/ui/table-pagination";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
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
    partnerId?: string;
    notice?: string;
    error?: string;
    new?: string;
    q?: string;
    status?: string;
    paymentTerm?: string;
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

  const allOrders = await getPurchaseOrderList({ query, status, paymentTerm });

  if (view === "receipts") {
    const receipts = await getPurchaseReceiptList(params.purchaseOrderId);
    const page = paginateRows(receipts, params);

    return (
      <PurchasingLayout currentView={view} title="Receipts" orders={allOrders} notice={params.notice} error={params.error} pagination={page.pagination}>
        <ReceiptList receipts={page.rows} />
      </PurchasingLayout>
    );
  }

  if (view === "landed-costs") {
    const landedCosts = await getPurchaseLandedCostList(params.purchaseOrderId);
    const page = paginateRows(landedCosts, params);

    return (
      <PurchasingLayout
        currentView={view}
        title="Landed Costs"
        orders={allOrders}
        notice={params.notice}
        error={params.error}
        pagination={page.pagination}
        actions={<ButtonLink href="/admin/purchasing/landed-costs/new">New Landed Cost</ButtonLink>}
      >
        <LandedCostList landedCosts={page.rows} />
      </PurchasingLayout>
    );
  }

  if (view === "payments") {
    const payments = await getPaymentList({
      paymentType: "outbound",
      purchaseOrderId: params.purchaseOrderId,
      vendorBillId: params.vendorBillId,
    });
    const page = paginateRows(payments, params);

    return (
      <PurchasingLayout currentView={view} title="Supplier Payments" orders={allOrders} notice={params.notice} error={params.error} pagination={page.pagination}>
        <PaymentList payments={page.rows} />
      </PurchasingLayout>
    );
  }

  if (view === "returns") {
    const returns = await getSupplierReturnList(params.purchaseOrderId);
    const page = paginateRows(returns, params);

    return (
      <PurchasingLayout
        currentView={view}
        title="Supplier Returns"
        orders={allOrders}
        notice={params.notice}
        error={params.error}
        pagination={page.pagination}
        actions={canCreateOrders ? <ButtonLink href="/admin/purchasing/returns/new">New Supplier Return</ButtonLink> : null}
      >
        <SupplierReturnList returns={page.rows} />
      </PurchasingLayout>
    );
  }

  const formOptions = await getPurchaseFormOptions();
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
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Return No</th>
              <th className="px-4 py-3">Receipt Ref</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Vendor Refund</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {returns.map((record) => (
              <tr key={record.id} className="group transition-colors hover:bg-muted/30">
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
                  <ButtonLink href={`/admin/purchasing/returns/${record.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">Details</ButtonLink>
                </td>
              </tr>
            ))}
            {returns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No supplier returns recorded yet.
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
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Cost No</th>
              <th className="px-4 py-3">Cost Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Purchase Order</th>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Allocation</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {landedCosts.map((cost) => (
              <tr key={cost.id} className="group transition-colors hover:bg-muted/30">
                <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground">{cost.costNo}</td>
                <td className="px-4 py-3.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">{cost.costType}</td>
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
                <td className="px-4 py-3.5 text-xs text-muted-foreground capitalize">{cost.allocationMethod}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs">{cost.allocationCount}</td>
                <td className="px-4 py-3.5 text-right font-mono text-xs font-bold text-foreground">
                  {displayPurchaseMoney(cost.amountMinor, cost.currencyCode)}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <ButtonLink href={`/admin/purchasing/landed-costs/${cost.id}`} size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                    Details
                  </ButtonLink>
                </td>
              </tr>
            ))}
            {landedCosts.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No landed costs recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PurchaseOrderList({ orders }: { orders: PurchaseOrderListRow[] }) {
  const statusOptions = [
    { value: "draft", label: "Draft" },
    { value: "confirmed", label: "Confirmed" },
    { value: "partially_received", label: "Partially Received" },
    { value: "received", label: "Received" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const paymentTermOptions = [
    { value: "cash", label: "Cash" },
    { value: "credit", label: "Credit" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <TableSearchInput
            placeholder="Search order #, supplier name, or ref..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Order No</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Order Status</th>
              <th className="px-4 py-3">Order Date</th>
              <th className="px-4 py-3">Payment Settlement</th>
              <th className="px-4 py-3">Deliver To</th>
              <th className="px-4 py-3 text-right">Ordered Qty</th>
              <th className="px-4 py-3 text-right">Received Qty</th>
              <th className="px-4 py-3 text-right">Grand Total</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {orders.map((order) => (
              <tr key={order.id} className="group transition-colors hover:bg-muted/30">
                <td className="px-4 py-3.5">
                  <Link href={`/admin/purchasing/${order.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-xs font-bold text-primary transition-all hover:bg-primary/10 hover:border-primary/40">
                    {order.orderNo}
                  </Link>
                </td>
                <td className="px-4 py-3.5">
                  <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{order.supplierName}</div>
                  {order.vendorReference ? (
                    <div className="text-xs text-muted-foreground">Ref {order.vendorReference}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3.5">
                  <div className="text-xs text-muted-foreground">{order.orderDate}</div>
                  {order.paymentTerm === "credit" ? (
                    <div className="text-[11px] text-muted-foreground">Due {order.paymentDueDate ?? "-"}</div>
                  ) : null}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold capitalize text-foreground">{order.paymentTerm}</span>
                    {Number(order.totalMinor) === 0 || Number(order.residualAmountMinor) === 0 ? (
                      <StatusBadge status="paid" label="Fully Paid" />
                    ) : Number(order.residualAmountMinor) < Number(order.totalMinor) ? (
                      <StatusBadge
                        status="partially_paid"
                        label={`Due ${displayPurchaseMoney(order.residualAmountMinor, order.currencyCode)}`}
                      />
                    ) : (
                      <StatusBadge
                        status="unpaid"
                        label={`Unpaid ${displayPurchaseMoney(order.residualAmountMinor, order.currencyCode)}`}
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
                    Open
                  </ButtonLink>
                </td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No purchase orders recorded yet.{" "}
                  <Link href="/admin/purchasing/new" className="font-semibold text-primary underline-offset-4 hover:underline">
                    Create the first PO →
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

function ReceiptList({ receipts }: { receipts: PurchaseReceiptListRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Receipt No</th>
              <th className="px-4 py-3">PO Ref</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Warehouse</th>
              <th className="px-4 py-3 text-right">Lines</th>
              <th className="px-4 py-3 text-right">Received Qty</th>
              <th className="px-4 py-3 text-right">Total Value</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {receipts.map((receipt) => (
              <tr key={receipt.id} className="group transition-colors hover:bg-muted/30">
                <td className="px-4 py-3.5">
                  <Link href={`/admin/purchasing/receipts/${receipt.id}`} className="font-mono text-xs font-bold text-primary hover:underline">
                    {receipt.receiptNo}
                  </Link>
                  {receipt.supplierInvoiceNo ? (
                    <div className="text-xs text-muted-foreground">Inv: {receipt.supplierInvoiceNo}</div>
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
                    Details
                  </ButtonLink>
                </td>
              </tr>
            ))}
            {receipts.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No goods receipts recorded yet.
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
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Payment No</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Payment Method</th>
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
                    Details
                  </ButtonLink>
                </td>
              </tr>
            ))}
            {payments.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No supplier payments recorded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
