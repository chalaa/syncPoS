import { BanknoteIcon, FolderIcon } from "lucide-react";
import Link from "next/link";

import { NewExpenseModal } from "@/app/admin/operations/expenses/new-expense-modal";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button";
import { TableFilterBar } from "@/components/ui/table-filter-bar";
import { TableFilterSelect } from "@/components/ui/table-filter-select";
import { TablePagination } from "@/components/ui/table-pagination";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
import { paginateRows } from "@/lib/pagination";
import { requirePermission, getUserPermissionCodes } from "@/server/auth/session";
import { getExpenseFormOptions, getExpenseList } from "@/server/expenses/expenses";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";
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
    page?: string;
    pageSize?: string;
  }>;
};

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
  const query = params.q?.trim() ?? "";
  const showCancelled = params.show === "cancelled";
  const categoryId = params.category ?? "";
  const paymentStatus = params.paymentStatus ?? "";

  const [expenses, options] = await Promise.all([
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
  ]);

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
            {canCreateExpense ? <NewExpenseModal options={options} /> : null}
          </div>
        }
      />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <TableFilterBar
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
          <div className="flex rounded-lg border border-border bg-muted/40 p-1 text-sm">
            <Button asChild variant={!showCancelled ? "secondary" : "ghost"} size="sm">
              <Link href="/admin/operations/expenses"><T k="common.normal" fallback="Normal" /></Link>
            </Button>
            <Button asChild variant={showCancelled ? "secondary" : "ghost"} size="sm">
              <Link href="/admin/operations/expenses?show=cancelled"><T k="status.cancelled" fallback="Cancelled" /></Link>
            </Button>
          </div>
        </TableFilterBar>

        <ExpenseTable rows={expensePage.rows} showCancelled={showCancelled} />
        <TablePagination pagination={expensePage.pagination} />
      </section>
    </PageShell>
  );
}
