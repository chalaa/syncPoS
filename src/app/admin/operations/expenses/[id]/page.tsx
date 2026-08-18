import Link from "next/link";
import { notFound } from "next/navigation";

import { cancelExpense, registerExpensePayment } from "@/app/admin/operations/expenses/actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { displayExpenseMoney, getExpenseDetail } from "@/server/expenses/expenses";
import { getActivePaymentAccounts, getPaymentList } from "@/server/payments/payments";

export const dynamic = "force-dynamic";

type ExpenseDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

function minorToInputValue(value: number) {
  return (value / 100).toFixed(2);
}

export default async function ExpenseDetailPage({ params, searchParams }: ExpenseDetailPageProps) {
  await requirePermission("company.manage");

  const [{ id }, query, outboundAccounts] = await Promise.all([
    params,
    searchParams,
    getActivePaymentAccounts("outbound"),
  ]);
  const [expense, payments] = await Promise.all([
    getExpenseDetail(id),
    getPaymentList({ expenseId: id }),
  ]);

  if (!expense) {
    notFound();
  }

  const canPay = expense.status !== "cancelled" && expense.residualAmountMinor > 0;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations / Expense"
        title={expense.expenseNo}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/operations/expenses" variant="outline">Back to expenses</ButtonLink>
            {payments.length > 0 ? (
              <ButtonLink href={`/admin/operations/expenses/${expense.id}#payments`} variant="outline">
                Payments {payments.length}
              </ButtonLink>
            ) : null}
            {expense.status !== "cancelled" ? (
              <form action={cancelExpense}>
                <input type="hidden" name="id" value={expense.id} />
                <input type="hidden" name="returnPath" value={`/admin/operations/expenses/${expense.id}`} />
                <Button variant="danger">Cancel</Button>
              </form>
            ) : null}
          </div>
        }
      />

      {query.notice ? <Alert kind="success">{query.notice}</Alert> : null}
      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <Info label="Status" value={statusLabel(expense.status)} />
          <Info label="Payment Status" value={statusLabel(expense.paymentStatus)} />
          <Info label="Expense Date" value={expense.expenseDate} />
          <Info label="Category" value={expense.categoryName} />
          <Info label="Employee" value={expense.employeeName ?? "-"} />
          <Info label="Vendor" value={expense.vendorName ?? "-"} />
          <Info label="Location" value={expense.locationName ?? "-"} />
          <Info label="Amount" value={displayExpenseMoney(expense.amountMinor, expense.currencyCode)} />
          <Info label="Paid" value={displayExpenseMoney(expense.paidAmountMinor, expense.currencyCode)} />
          <Info label="Residual" value={displayExpenseMoney(expense.residualAmountMinor, expense.currencyCode)} />
          <Info label="Description" value={expense.description ?? "-"} />
        </div>

        <div className="border-t border-border pt-4">
          <h2 className="mb-3 text-base font-semibold">Attachments</h2>
          {expense.attachments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2 text-right">Size</th>
                    <th className="px-3 py-2">Object Key</th>
                  </tr>
                </thead>
                <tbody>
                  {expense.attachments.map((attachment) => (
                    <tr key={attachment.id} className="border-b border-border/70">
                      <td className="px-3 py-3 font-medium">{attachment.fileName}</td>
                      <td className="px-3 py-3">{attachment.mimeType}</td>
                      <td className="px-3 py-3 text-right">{attachment.sizeBytes}</td>
                      <td className="px-3 py-3 text-muted-foreground">{attachment.objectKey}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No attachments linked.</p>
          )}
        </div>
      </section>

      {canPay ? (
        <section className="mt-5 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Register Expense Payment</h2>
          <form action={registerExpensePayment} className="grid gap-4">
            <input type="hidden" name="expenseId" value={expense.id} />
            <div className="grid gap-4 md:grid-cols-4">
              <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
                Payment Account
                <select name="paymentAccountId" required className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Select account</option>
                  {outboundAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} / {account.name} / {account.currencyCode}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Amount
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  defaultValue={minorToInputValue(expense.residualAmountMinor)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Reference
                <input name="reference" className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium md:col-span-4">
                Notes
                <textarea name="notes" className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </label>
            </div>
            <div className="flex justify-end">
              <Button disabled={outboundAccounts.length === 0}>Register Payment</Button>
            </div>
          </form>
        </section>
      ) : null}

      <section id="payments" className="mt-5 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-4 text-lg font-semibold">Payment Documents</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-b border-border/70">
                  <td className="px-3 py-3">
                    <Link href={`/admin/purchasing/payments/${payment.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      {payment.paymentNo}
                    </Link>
                  </td>
                  <td className="px-3 py-3">{payment.paymentDate}</td>
                  <td className="px-3 py-3 capitalize">{statusLabel(payment.status)}</td>
                  <td className="px-3 py-3">{payment.paymentAccountName}</td>
                  <td className="px-3 py-3 text-right">{displayExpenseMoney(payment.amountMinor, payment.currencyCode)}</td>
                </tr>
              ))}
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    No payments registered.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium capitalize">{value}</p>
    </div>
  );
}
