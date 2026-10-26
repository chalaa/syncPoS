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
import {
  LandedCostList,
  PaymentList,
  PurchaseOrderList,
  ReceiptList,
  SupplierReturnList,
} from "./purchasing-list-views";

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
