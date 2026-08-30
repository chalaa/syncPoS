import { createExpense } from "@/app/admin/operations/expenses/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getExpenseFormOptions } from "@/server/expenses/expenses";

export const dynamic = "force-dynamic";

type NewExpensePageProps = {
  searchParams: Promise<{ notice?: string; error?: string }>;
};

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";
const textareaClass = "min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export default async function NewExpensePage({ searchParams }: NewExpensePageProps) {
  await requirePermission("company.manage");

  const [params, options] = await Promise.all([
    searchParams,
    getExpenseFormOptions(),
  ]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations / Expense"
        title="New Expense"
        actions={<ButtonLink href="/admin/operations/expenses" variant="outline">Back to expenses</ButtonLink>}
      />

      {params.notice ? <Alert kind="success">{params.notice}</Alert> : null}
      {params.error ? <Alert kind="error">{params.error}</Alert> : null}

      <form action={createExpense} className="rounded-lg border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
            Category
            <select name="categoryId" required className={inputClass}>
              <option value="">Select category</option>
              {options.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.code} / {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Expense Date
            <input name="expenseDate" type="date" required defaultValue={todayInputValue()} className={inputClass} />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Amount
            <input name="amount" type="number" min="0.01" step="0.01" required className={inputClass} />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Payment Status
            <input value="Unpaid" readOnly className={`${inputClass} text-muted-foreground`} />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Employee
            <select name="employeeId" className={inputClass}>
              <option value="">No employee</option>
              {options.employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.code ? `${employee.code} / ` : ""}{employee.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium md:col-span-4">
            Description
            <textarea name="description" className={textareaClass} />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <ButtonLink href="/admin/operations/expenses" variant="outline">Cancel</ButtonLink>
          <Button disabled={options.categories.length === 0}>Create Expense</Button>
        </div>
      </form>
    </PageShell>
  );
}
