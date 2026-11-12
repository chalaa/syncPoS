import { BanknoteIcon, FolderIcon } from "lucide-react";
import { ArchivedModelList } from "@/components/app/archived-model-list";

import { NewExpenseModal } from "@/app/admin/operations/expenses/new-expense-modal";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { TableFilterBar } from "@/components/ui/table-filter-bar";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TableSortSelect, type TableSortOption } from "@/components/ui/table-sort-select";
import { TablePagination } from "@/components/ui/table-pagination";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
import { paginateRows } from "@/lib/pagination";
import { requirePermission, getUserPermissionCodes } from "@/server/auth/session";
import { getExpenseFormOptions, getExpenseList } from "@/server/expenses/expenses";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";
import { getSelectedShopId } from "@/server/locations/shop-options";
import { parseValidLocationId } from "@/server/reports/reports";
import { ExpenseTable } from "./expense-table";

export const dynamic = "force-dynamic";

type ExpensesPageProps = {
  searchParams: Promise<{
    q?: string;
    show?: string;
    notice?: string;
    error?: string;
    category?: string;
    paymentStatus?: string;
    sortBy?: string;
    sortOrder?: string;
    page?: string;
    pageSize?: string;
  }>;
};

const expenseSortOptions: TableSortOption[] = [
  { value: "expenseDate:desc", label: "sort.dateDesc" },
  { value: "expenseDate:asc", label: "sort.dateAsc" },
  { value: "amountMinor:desc", label: "sort.amountDesc" },
  { value: "amountMinor:asc", label: "sort.amountAsc" },
  { value: "expenseNo:asc", label: "sort.skuAsc" },
  { value: "categoryName:asc", label: "sort.nameAsc" },
];

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const user = await requirePermission(PERMISSIONS.EXPENSES.VIEW);
  const userPerms = await getUserPermissionCodes(user.id);
  const canSeeAll = userHasPermission(userPerms, PERMISSIONS.OWNER.ALL);
  const canCreateExpense = userHasPermission(userPerms, PERMISSIONS.EXPENSES.CREATE);
  const canManageCategories = userHasPermission(userPerms, PERMISSIONS.EXPENSES.CATEGORIES_MANAGE);

  const params = await searchParams;
  if (params.show === "deleted") {
    return <ArchivedModelList model="expense" title="Expenses" companyId={user.companyId} params={params} canRestore={canSeeAll} expenseScope={{ userId: user.id, employeeId: user.employeeId, canSeeAll }} />;
  }
  const query = params.q?.trim() ?? "";
  const showCancelled = params.show === "cancelled";
  const categoryId = params.category ?? "";
  const paymentStatus = params.paymentStatus ?? "";

  const [expenses, options, selectedShopId] = await Promise.all([
    getExpenseList({
      query,
      showCancelled,
      userId: user.id,
      employeeId: user.employeeId,
      canSeeAll,
      categoryId,
      paymentStatus,
    }),
    getExpenseFormOptions(),
    getSelectedShopId(),
  ]);
  const defaultLocationId = parseValidLocationId(selectedShopId) ?? "";

  const categoryOptions = options.categories.map((c) => ({ value: c.id, label: c.name }));
  const paymentStatusOptions = [
    { value: "unpaid", label: "Unpaid" },
    { value: "paid", label: "Paid" },
  ];
  const expensePage = paginateRows(expenses, params);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations"
        title="Expenses"
        description="Record and track miscellaneous operating expenses, supplier payments, and team reimbursements."
        actions={
          <div className="flex flex-wrap gap-2">
            {canManageCategories ? (
              <ButtonLink href="/admin/operations/expenses/categories" variant="outline">
                <FolderIcon data-icon="inline-start" />
                <T k="header.title.Expense Categories" fallback="Categories" />
              </ButtonLink>
            ) : null}
            {canCreateExpense ? <NewExpenseModal options={options} defaultLocationId={defaultLocationId} /> : null}
          </div>
        }
      />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <TableFilterBar
          archiveFilter
          archiveFilterCancelled
          searchPlaceholder="Search expense, category, or description..."
          filterParamNames={["category", "paymentStatus"]}
          storageKey="expenses"
        >
          <TableFilterSelect
            paramName="category"
            label="Category"
            options={categoryOptions}
            allLabel="All Categories"
          />
          <TableFilterSelect
            paramName="paymentStatus"
            label="Payment"
            options={paymentStatusOptions}
            allLabel="All Payments"
          />
          <TableSortSelect options={expenseSortOptions} />
        </TableFilterBar>

        <ExpenseTable rows={expensePage.rows} showCancelled={showCancelled} />
        <TablePagination pagination={expensePage.pagination} />
      </section>
    </PageShell>
  );
}
