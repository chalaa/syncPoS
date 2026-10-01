import { Alert } from "@/components/ui/alert";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginateRows } from "@/lib/pagination";
import { getUserPermissionCodes, requirePermission } from "@/server/auth/session";
import { getDirectVendorSaleFormOptions, getDirectVendorSaleList } from "@/server/direct-vendor-sales/direct-vendor-sales";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";

import { DirectVendorSaleList } from "./direct-vendor-sale-list";
import { NewDirectVendorSaleModal } from "./new-direct-vendor-sale-modal";

export const dynamic = "force-dynamic";

type DirectVendorSalesPageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    notice?: string;
    error?: string;
    new?: string;
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

export default async function DirectVendorSalesPage({ searchParams }: DirectVendorSalesPageProps) {
  const user = await requirePermission(PERMISSIONS.SALES.ORDERS_VIEW);
  const params = await searchParams;
  const [sales, userPerms] = await Promise.all([
    getDirectVendorSaleList({ query: params.q, status: params.status }),
    getUserPermissionCodes(user.id),
  ]);
  const canCreate = userHasPermission(userPerms, PERMISSIONS.SALES.CREATE);
  const formOptions = canCreate ? await getDirectVendorSaleFormOptions() : null;
  const page = paginateRows(sales, params);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Sales Workspace"
        title="Direct Vendor Sales"
        description="Streamlined order management, direct vendor fulfillment, both-way payments, and margin tracking."
        actions={
          canCreate && formOptions ? (
            <NewDirectVendorSaleModal
              {...formOptions}
              initialOpen={params.new === "1" || params.new === "true"}
              defaultDate={todayDate()}
            />
          ) : undefined
        }
      />
      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}
      <DirectVendorSaleList sales={page.rows} />
      <TablePagination pagination={page.pagination} />
    </PageShell>
  );
}
