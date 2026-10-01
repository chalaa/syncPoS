import Link from "next/link";
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
import { getPaymentList } from "@/server/payments/payments";
import type { PaymentListRow } from "@/server/payments/types";
import { displayReturnMoney, getCustomerReturnList } from "@/server/returns/returns";
import type { CustomerReturnListRow } from "@/server/returns/types";
import { NewSalesOrderModal } from "@/app/admin/sales/new-sales-order-modal";
import { SalesKpiCards } from "@/app/admin/sales/sales-kpi-cards";
import { displaySalesMoney, getCustomerInvoiceList, getDeliveryList, getSalesFormOptions, getSalesOrderList } from "@/server/sales/sales";
import type { CustomerInvoiceListRow, DeliveryListRow, SalesOrderListRow } from "@/server/sales/types";

import {
  CustomerInvoiceList,
  CustomerPaymentList,
  CustomerReturnList,
  DeliveryList,
  SalesOrderList,
} from "./sales-list-views";

export const dynamic = "force-dynamic";

type SalesPageProps = {
  searchParams: Promise<{
    view?: string;
    salesOrderId?: string;
    customerInvoiceId?: string;
    directVendorSaleId?: string;
    partnerId?: string;
    notice?: string;
    error?: string;
    new?: string;
    q?: string;
    status?: string;
    paymentTerm?: string;
    paymentStatus?: string;
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

export default async function SalesPage({ searchParams }: SalesPageProps) {
  const user = await requirePermission(PERMISSIONS.SALES.ORDERS_VIEW);
  const userPerms = await getUserPermissionCodes(user.id);
  const canCreate = userHasPermission(userPerms, PERMISSIONS.SALES.CREATE);
  const canManageReturns = userHasPermission(userPerms, PERMISSIONS.SALES.RETURNS_MANAGE);

  const params = await searchParams;
  const view = params.view ?? "orders";
  const query = params.q ?? "";
  const status = params.status ?? "";
  const paymentTerm = params.paymentTerm ?? "";
  const paymentStatus = params.paymentStatus ?? "";

  const allOrders = await getSalesOrderList({ query, status, paymentTerm, paymentStatus });

  if (view === "deliveries") {
    const deliveries = await getDeliveryList({ salesOrderId: params.salesOrderId });
    const page = paginateRows(deliveries, params);

    return (
      <SalesLayout currentView={view} title="Deliveries" orders={allOrders} notice={params.notice} error={params.error} pagination={page.pagination}>
        <DeliveryList deliveries={page.rows} />
      </SalesLayout>
    );
  }

  if (view === "invoices") {
    const invoices = await getCustomerInvoiceList({
      salesOrderId: params.salesOrderId,
      customerInvoiceId: params.customerInvoiceId,
      customerId: params.partnerId,
      paymentStatus: params.paymentStatus,
    });
    const page = paginateRows(invoices, params);

    return (
      <SalesLayout currentView={view} title="Customer Invoices" orders={allOrders} notice={params.notice} error={params.error} pagination={page.pagination}>
        <CustomerInvoiceList invoices={page.rows} />
      </SalesLayout>
    );
  }

  if (view === "payments") {
    const payments = await getPaymentList({
      paymentType: "inbound",
      salesOrderId: params.salesOrderId,
      customerInvoiceId: params.customerInvoiceId,
      directVendorSaleId: params.directVendorSaleId,
    });
    const page = paginateRows(payments, params);

    return (
      <SalesLayout currentView={view} title="Customer Payments" orders={allOrders} notice={params.notice} error={params.error} pagination={page.pagination}>
        <CustomerPaymentList payments={page.rows} />
      </SalesLayout>
    );
  }

  if (view === "returns") {
    const returns = await getCustomerReturnList(params.salesOrderId);
    const page = paginateRows(returns, params);

    return (
      <SalesLayout
        currentView={view}
        title="Returns"
        orders={allOrders}
        notice={params.notice}
        error={params.error}
        pagination={page.pagination}
        actions={canManageReturns ? <ButtonLink href="/admin/sales/returns/new">New Return</ButtonLink> : undefined}
      >
        <CustomerReturnList returns={page.rows} />
      </SalesLayout>
    );
  }

  const formOptions = await getSalesFormOptions();
  const orderPage = paginateRows(allOrders, params);

  return (
    <SalesLayout
      currentView={view}
      title="Quotations / Orders"
      orders={allOrders}
      notice={params.notice}
      error={params.error}
      pagination={orderPage.pagination}
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
      <SalesOrderList orders={orderPage.rows} locations={formOptions.locations} />
    </SalesLayout>
  );
}

function SalesLayout({
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
  orders: SalesOrderListRow[];
  notice?: string;
  error?: string;
  actions?: React.ReactNode;
  pagination: PaginationMeta;
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
      <TablePagination pagination={pagination} />
    </PageShell>
  );
}
