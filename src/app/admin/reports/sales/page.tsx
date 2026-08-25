import Link from "next/link";

import { EmptyRows, ReportFilters, ReportSummaryCards } from "@/app/admin/reports/report-ui";
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
      <PageHeader eyebrow="Reports" title="Sales Report" />
      <ReportFilters query={filters.query} dateFrom={filters.dateFrom} dateTo={filters.dateTo} status={filters.status ?? ""} />
      <ReportSummaryCards summary={summary} />
      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
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
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/admin/sales/invoices/${row.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {row.invoiceNo}
                  </Link>
                  {row.orderNo ? <div className="text-xs text-muted-foreground">{row.orderNo}</div> : null}
                </td>
                <td className="px-4 py-3">{row.customerName}</td>
                <td className="px-4 py-3">{row.invoiceDate}</td>
                <td className="px-4 py-3 capitalize">{row.status}</td>
                <td className="px-4 py-3 capitalize">{row.paymentStatus.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">{row.locationCode ?? "-"}</td>
                <td className="px-4 py-3 text-right">{displayReportMoney(row.untaxedAmountMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right">{displayReportMoney(row.taxAmountMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right">{displayReportMoney(row.totalMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right">{displayReportMoney(row.paidAmountMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right">{displayReportMoney(row.residualAmountMinor, row.currencyCode)}</td>
              </tr>
            ))}
            {rows.length === 0 ? <EmptyRows colSpan={11} /> : null}
          </tbody>
        </table>
      </section>
    </PageShell>
  );
}
