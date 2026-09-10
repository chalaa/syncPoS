import Link from "next/link";

import { EmptyRows, ReportFilters, ReportNavTabs, ReportSummaryCards } from "@/app/admin/reports/report-ui";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { displayReportMoney, getSalesReport, normalizeReportFilters, summarizeMoney } from "@/server/reports/reports";

export const dynamic = "force-dynamic";

type SalesReportPageProps = {
  searchParams: Promise<{ q?: string; dateFrom?: string; dateTo?: string; status?: string }>;
};

export default async function SalesReportPage({ searchParams }: SalesReportPageProps) {
  await requirePermission("report.profit.view");

  const params = await searchParams;
  const filters = normalizeReportFilters(params);
  const rows = await getSalesReport(filters);
  const summary = summarizeMoney(rows);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Financial Reports"
        title="Sales Report"
        description="Comprehensive analysis of customer invoices, taxes, settlements, and outstanding balances."
      />
      <ReportNavTabs current="sales" />
      <ReportFilters query={filters.query} dateFrom={filters.dateFrom} dateTo={filters.dateTo} status={filters.status ?? ""} />
      <ReportSummaryCards summary={summary} />
      <section className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3 text-right">Untaxed</th>
              <th className="px-4 py-3 text-right">Tax</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Residual</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/sales/invoices/${row.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {row.invoiceNo}
                  </Link>
                  {row.orderNo ? <div className="text-xs text-muted-foreground">{row.orderNo}</div> : null}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{row.customerName}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.invoiceDate}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} size="sm" />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.paymentStatus} size="sm" />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.locationCode ?? "-"}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{displayReportMoney(row.untaxedAmountMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{displayReportMoney(row.taxAmountMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">{displayReportMoney(row.totalMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right font-medium text-emerald-600 dark:text-emerald-400">{displayReportMoney(row.paidAmountMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right font-medium text-amber-600 dark:text-amber-400">{displayReportMoney(row.residualAmountMinor, row.currencyCode)}</td>
              </tr>
            ))}
            {rows.length === 0 ? <EmptyRows colSpan={11} /> : null}
          </tbody>
        </table>
      </section>
    </PageShell>
  );
}
