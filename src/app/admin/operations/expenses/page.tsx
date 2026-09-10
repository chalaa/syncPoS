import { BanknoteIcon, FolderIcon, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";

import { cancelExpense } from "@/app/admin/operations/expenses/actions";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { displayExpenseMoney, getExpenseList } from "@/server/expenses/expenses";
import type { ExpenseListRow } from "@/server/expenses/types";

export const dynamic = "force-dynamic";

type ExpensesPageProps = {
  searchParams: Promise<{ q?: string; show?: string; notice?: string; error?: string }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  await requirePermission("company.manage");

  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const showCancelled = params.show === "cancelled";
  const expenses = await getExpenseList({ query, showCancelled });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations"
        title="Expenses"
        description="Record and track miscellaneous operating expenses, supplier payments, and team reimbursements."
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/operations/expenses/categories" variant="outline">
              <FolderIcon data-icon="inline-start" />
              Categories
            </ButtonLink>
            <ButtonLink href="/admin/operations/expenses/new">
              <PlusIcon data-icon="inline-start" />
              New expense
            </ButtonLink>
          </div>
        }
      />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <form className="flex min-w-0 flex-1 gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search expense, category, or description"
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {showCancelled ? <input type="hidden" name="show" value="cancelled" /> : null}
            <Button variant="outline" className="h-9">
              <SearchIcon data-icon="inline-start" />
              Search
            </Button>
          </form>
          <div className="flex rounded-lg border border-border bg-muted/40 p-1 text-sm">
            <Button asChild variant={!showCancelled ? "secondary" : "ghost"} size="sm">
              <Link href="/admin/operations/expenses">Normal</Link>
            </Button>
            <Button asChild variant={showCancelled ? "secondary" : "ghost"} size="sm">
              <Link href="/admin/operations/expenses?show=cancelled">Cancelled</Link>
            </Button>
          </div>
        </div>

        <ExpenseTable rows={expenses} showCancelled={showCancelled} />
      </section>
    </PageShell>
  );
}

function ExpenseTable({ rows, showCancelled }: { rows: ExpenseListRow[]; showCancelled: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1040px] text-left text-sm">
        <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-4 py-3">Expense</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Employee / Vendor</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-right">Residual</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((expense) => (
            <tr key={expense.id} className="border-t border-border transition-colors hover:bg-secondary/30">
              <td className="px-4 py-3">
                <Link href={`/admin/operations/expenses/${expense.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                  {expense.expenseNo}
                </Link>
                {expense.description ? <div className="text-xs text-muted-foreground">{expense.description}</div> : null}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{expense.expenseDate}</td>
              <td className="px-4 py-3 font-medium text-foreground">{expense.categoryName}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">{expense.employeeName ?? "-"}</div>
                {expense.vendorName ? <div className="text-xs text-muted-foreground">{expense.vendorName}</div> : null}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{expense.locationName ?? "-"}</td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1 items-start">
                  <StatusBadge status={expense.paymentStatus} size="sm" />
                  {expense.status === "cancelled" ? (
                    <StatusBadge status="cancelled" size="sm" />
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-foreground">{displayExpenseMoney(expense.amountMinor, expense.currencyCode)}</td>
              <td className="px-4 py-3 text-right font-medium text-amber-600 dark:text-amber-400">{displayExpenseMoney(expense.residualAmountMinor, expense.currencyCode)}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <ButtonLink href={`/admin/operations/expenses/${expense.id}`} size="sm" variant="outline">
                    <BanknoteIcon data-icon="inline-start" />
                    Details
                  </ButtonLink>
                  {!showCancelled && expense.status !== "cancelled" && expense.paymentStatus !== "paid" ? (
                    <form action={cancelExpense}>
                      <input type="hidden" name="id" value={expense.id} />
                      <input type="hidden" name="returnPath" value="/admin/operations/expenses" />
                      <Button variant="danger" size="sm">Cancel</Button>
                    </form>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                <p className="font-medium text-foreground">No expenses found</p>
                <p className="mt-1 text-xs text-muted-foreground">Try adjusting your search keywords.</p>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
