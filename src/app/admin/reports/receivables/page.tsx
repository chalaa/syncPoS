import Link from "next/link";

import { EmptyRows, ReportFilters, ReportNavTabs, ReportSummaryCards } from "@/app/admin/reports/report-ui";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginateRows } from "@/lib/pagination";
import { requirePermission } from "@/server/auth/session";
import { displayReportMoney } from "@/lib/report-formatters";
import { getReceivablesReport, normalizeReportFilters, summarizeMoney } from "@/server/reports/reports";

export const dynamic = "force-dynamic";

type ReceivablesReportPageProps = {
  searchParams: Promise<{ q?: string; dateFrom?: string; dateTo?: string; page?: string; pageSize?: string }>;
};

export default async function ReceivablesReportPage({ searchParams }: ReceivablesReportPageProps) {
  await requirePermission("report.profit.view");

  const params = await searchParams;
  const filters = normalizeReportFilters(params);
  const rows = await getReceivablesReport(filters);
  const summary = summarizeMoney(rows);
  const reportPage = paginateRows(rows, params);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Financial Reports"
        title="Customer Receivables"
        description="Track pending customer invoices, payment due dates, and outstanding aging balances."
      />
      <ReportNavTabs current="receivables" />
      <ReportFilters query={filters.query} dateFrom={filters.dateFrom} dateTo={filters.dateTo} />
      <ReportSummaryCards summary={summary} />
      <section className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Invoice Date</th>
              <th className="px-4 py-3">Due Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Residual</th>
            </tr>
          </thead>
          <tbody>
            {reportPage.rows.map((row) => (
              <tr key={row.id} className="border-t border-border transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/sales/invoices/${row.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {row.invoiceNo}
                  </Link>
                  {row.orderNo ? <div className="text-xs text-muted-foreground">{row.orderNo}</div> : null}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{row.customerName}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.invoiceDate}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.dueDate ?? "-"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} size="sm" />
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">{displayReportMoney(row.totalMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">{displayReportMoney(row.paidAmountMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right font-medium text-amber-600 dark:text-amber-400">{displayReportMoney(row.residualAmountMinor, row.currencyCode)}</td>
              </tr>
            ))}
            {reportPage.rows.length === 0 ? <EmptyRows colSpan={8} /> : null}
          </tbody>
        </table>
      </section>
      <TablePagination pagination={reportPage.pagination} />
    </PageShell>
  );
}
