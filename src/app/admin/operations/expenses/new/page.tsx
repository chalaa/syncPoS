import { createExpense } from "@/app/admin/operations/expenses/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getExpenseFormOptions } from "@/server/expenses/expenses";
import { getActivePaymentAccounts } from "@/server/payments/payments";

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

  const [params, options, outboundAccounts] = await Promise.all([
    searchParams,
    getExpenseFormOptions(),
    getActivePaymentAccounts("outbound"),
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
            <select name="paymentStatus" required defaultValue="unpaid" className={inputClass}>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid now</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium md:col-span-3">
            Payment Account
            <select name="paymentAccountId" className={inputClass}>
              <option value="">Select account when paid now</option>
              {outboundAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} / {account.name} / {account.currencyCode}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Payment Reference
            <input name="paymentReference" maxLength={120} className={inputClass} />
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

          <label className="flex flex-col gap-1 text-sm font-medium">
            Vendor
            <select name="vendorId" className={inputClass}>
              <option value="">No vendor</option>
              {options.vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.code} / {vendor.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Location
            <select name="locationId" className={inputClass}>
              <option value="">No location</option>
              {options.locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.code} / {location.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
            Attachment Object Key
            <input name="attachmentObjectKey" placeholder="uploads/expenses/receipt.pdf" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
            Attachment File Name
            <input name="attachmentFileName" placeholder="receipt.pdf" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            MIME Type
            <input name="attachmentMimeType" placeholder="application/pdf" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Size Bytes
            <input name="attachmentSizeBytes" type="number" min="0" className={inputClass} />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
            SHA256 Hash
            <input name="attachmentSha256Hash" maxLength={64} className={inputClass} />
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
