import Link from "next/link";
import { notFound } from "next/navigation";

import { cancelExpense, registerExpensePayment } from "@/app/admin/operations/expenses/actions";
import { PaymentFormDialog } from "@/components/app/payment-form-dialog";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { DetailStatCard } from "@/components/ui/detail-stat-card";
import { requirePermission, getUserPermissionCodes } from "@/server/auth/session";
import { displayExpenseMoney, getExpenseDetail } from "@/server/expenses/expenses";
import { getActivePaymentAccounts, getPaymentList } from "@/server/payments/payments";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";

export const dynamic = "force-dynamic";

type ExpenseDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; error?: string }>;
};

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function ExpenseDetailPage({ params, searchParams }: ExpenseDetailPageProps) {
  const user = await requirePermission(PERMISSIONS.EXPENSES.VIEW);
  const userPerms = await getUserPermissionCodes(user.id);
  const canSeeAll = userHasPermission(userPerms, PERMISSIONS.OWNER.ALL);

  const [{ id }, query, outboundAccounts] = await Promise.all([
    params,
    searchParams,
    getActivePaymentAccounts("outbound"),
  ]);
  const [expense, payments] = await Promise.all([
    getExpenseDetail(id, { userId: user.id, employeeId: user.employeeId, canSeeAll }),
    getPaymentList({ expenseId: id }),
  ]);

  if (!expense) {
    notFound();
  }

  const canPay = expense.status !== "cancelled" && expense.residualAmountMinor > 0;
  const canCancel = expense.status !== "cancelled" && expense.paymentStatus !== "paid";

  return (
    <PageShell>
      <PageHeader
        eyebrow="Operations / Expense"
        title={expense.expenseNo}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/operations/expenses" variant="outline">Back to expenses</ButtonLink>
            {canPay ? (
              <PaymentFormDialog
                title="Register Expense Payment"
                description={`Register and post payment for ${expense.expenseNo}.`}
                triggerLabel="Register Payment"
                submitLabel="Post Payment"
                action={registerExpensePayment}
                hiddenFieldName="expenseId"
                hiddenFieldValue={expense.id}
                paymentAccounts={outboundAccounts}
                currencyCode={expense.currencyCode}
                amountMinor={expense.residualAmountMinor}
              />
            ) : null}
            {canCancel ? (
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

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2.5">
          {payments.length > 0 ? (
            <DetailStatCard
              href={`/admin/operations/expenses/${expense.id}#payments`}
              count={payments.length}
              label="Payments"
            />
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge status={expense.status} size="lg" />
          <StatusBadge status={expense.paymentStatus} size="lg" />
        </div>
      </div>

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
            <div className="mt-1">
              <StatusBadge status={expense.status} size="sm" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Payment Status</p>
            <div className="mt-1">
              <StatusBadge status={expense.paymentStatus} size="sm" />
            </div>
          </div>
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
          <PaymentFormDialog
            title="Register Expense Payment"
            description={`Register payment for ${expense.expenseNo}.`}
            triggerLabel="Register Payment"
            submitLabel="Register Payment"
            action={registerExpensePayment}
            hiddenFieldName="expenseId"
            hiddenFieldValue={expense.id}
            paymentAccounts={outboundAccounts}
            currencyCode={expense.currencyCode}
            amountMinor={expense.residualAmountMinor}
          />
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
