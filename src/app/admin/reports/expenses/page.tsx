import Link from "next/link";

import { EmptyRows, ReportFilters, ReportNavTabs, ReportSummaryCards } from "@/app/admin/reports/report-ui";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginateRows } from "@/lib/pagination";
import { requirePermission } from "@/server/auth/session";
import { displayReportMoney } from "@/lib/report-formatters";
import { getExpenseReport, normalizeReportFilters, summarizeMoney } from "@/server/reports/reports";

export const dynamic = "force-dynamic";

type ExpenseReportPageProps = {
  searchParams: Promise<{ q?: string; dateFrom?: string; dateTo?: string; status?: string; page?: string; pageSize?: string }>;
};

export default async function ExpenseReportPage({ searchParams }: ExpenseReportPageProps) {
  await requirePermission("report.profit.view");

  const params = await searchParams;
  const filters = normalizeReportFilters(params);
  const rows = await getExpenseReport(filters);
  const summary = summarizeMoney(rows);
  const reportPage = paginateRows(rows, params);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Financial Reports"
        title="Expense Report"
        description="Monitor operational expenditures, supplier payouts, employee reimbursements, and categorized costs."
      />
      <ReportNavTabs current="expenses" />
      <ReportFilters query={filters.query} dateFrom={filters.dateFrom} dateTo={filters.dateTo} status={filters.status ?? ""} />
      <ReportSummaryCards summary={summary} />
      <section className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Expense</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Vendor/Employee</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Residual</th>
            </tr>
          </thead>
          <tbody>
            {reportPage.rows.map((row) => (
              <tr key={row.id} className="border-t border-border transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/operations/expenses/${row.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {row.expenseNo}
                  </Link>
                  {row.description ? <div className="text-xs text-muted-foreground">{row.description}</div> : null}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{row.categoryName}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.expenseDate}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.paymentStatus} size="sm" />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.vendorName ?? row.employeeName ?? "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.locationName ?? "-"}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">{displayReportMoney(row.amountMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">{displayReportMoney(row.paidAmountMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right font-medium text-amber-600 dark:text-amber-400">{displayReportMoney(row.residualAmountMinor, row.currencyCode)}</td>
              </tr>
            ))}
            {reportPage.rows.length === 0 ? <EmptyRows colSpan={10} /> : null}
          </tbody>
        </table>
      </section>
      <TablePagination pagination={reportPage.pagination} />
    </PageShell>
  );
}
