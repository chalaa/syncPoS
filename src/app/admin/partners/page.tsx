import Link from "next/link";
import { redirect } from "next/navigation";

import { NewPartnerModal } from "@/app/admin/partners/new-partner-modal";
import { Alert } from "@/components/ui/alert";
import { TableFilterBar } from "@/components/ui/table-filter-bar";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TableSortSelect, type TableSortOption } from "@/components/ui/table-sort-select";
import { TablePagination } from "@/components/ui/table-pagination";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
import { paginateRows } from "@/lib/pagination";
import {
  getPartnerFormOptions,
  getPartnerList,
} from "@/server/partners/partners";
import { requirePermission, getUserPermissionCodes } from "@/server/auth/session";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";
import { PartnerListTable } from "./partner-list-table";

export const dynamic = "force-dynamic";

type PartnersPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    role?: string;
    view?: string;
    notice?: string;
    error?: string;
    status?: string;
    paymentTerm?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const partnerSortOptions: TableSortOption[] = [
  { value: "displayName:asc", label: "sort.nameAsc" },
  { value: "displayName:desc", label: "sort.nameDesc" },
  { value: "code:asc", label: "sort.skuAsc" },
  { value: "code:desc", label: "sort.skuDesc" },
  { value: "creditLimitMinor:asc", label: "sort.amountAsc" },
  { value: "creditLimitMinor:desc", label: "sort.amountDesc" },
];

export default async function PartnersPage({ searchParams }: PartnersPageProps) {
  const user = await requirePermission(PERMISSIONS.PARTNERS.VIEW);
  const userPerms = await getUserPermissionCodes(user.id);
  const canManage = userHasPermission(userPerms, PERMISSIONS.PARTNERS.MANAGE);

  const params = await searchParams;

  if (params.view === "payment-terms") {
    redirect("/admin/partners/payment-terms");
  }

  const showDeleted = params.show === "deleted";
  const role = params.role === "customer" || params.role === "supplier" ? params.role : undefined;
  const query = params.q ?? "";
  const status = params.status ?? "";
  const paymentTermId = params.paymentTerm ?? "";

  const [partners, formOptions] = await Promise.all([
    getPartnerList({ query, showDeleted, role, status, paymentTermId }),
    getPartnerFormOptions(),
  ]);

  const statusOptions = [
    { value: "active", label: "Active" },
    { value: "blocked", label: "Blocked" },
    { value: "inactive", label: "Inactive" },
  ];

  const paymentTermOptions = (formOptions?.paymentTerms ?? []).map((pt) => ({
    value: pt.id,
    label: `${pt.code} (${pt.name})`,
  }));
  const partnerPage = paginateRows(partners, params);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Commercial Directory"
        title="Partners & Accounts"
        description="Manage customer profiles, supplier accounts, credit allowances, and primary contacts."
        actions={
          canManage && formOptions ? (
            <NewPartnerModal paymentTerms={formOptions.paymentTerms} />
          ) : undefined
        }
      />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <div className="grid gap-5">
        <section className="rounded-xl border border-border bg-card shadow-xs">
          <TableFilterBar
            searchPlaceholder="Search code, name, legal name, TIN..."
            filterParamNames={["status", "paymentTerm"]}
            storageKey="partners"
          >
            <TableFilterSelect
              paramName="status"
              label="Status"
              options={statusOptions}
              allLabel="All Statuses"
            />
            <TableFilterSelect
              paramName="paymentTerm"
              label="Payment Term"
              options={paymentTermOptions}
              allLabel="All Terms"
            />
            <TableSortSelect options={partnerSortOptions} />
          </TableFilterBar>

          <div className="flex gap-2 border-b border-border px-4 py-2.5 text-sm">
            <Link
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                !role ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
              href="/admin/partners"
            >
              <T k="All Partners" />
            </Link>
            <Link
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                role === "customer" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
              href="/admin/partners?role=customer"
            >
              <T k="Customers" />
            </Link>
            <Link
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                role === "supplier" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              }`}
              href="/admin/partners?role=supplier"
            >
              <T k="Suppliers" />
            </Link>
          </div>

          <PartnerListTable
            partners={partnerPage.rows}
            showDeleted={showDeleted}
          />
          <TablePagination pagination={partnerPage.pagination} />
        </section>
      </div>
    </PageShell>
  );
}
