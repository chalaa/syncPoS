import Link from "next/link";

import { EmptyRows, ReportFilters, ReportNavTabs, SummaryCard } from "@/app/admin/reports/report-ui";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginateRows } from "@/lib/pagination";
import { requirePermission } from "@/server/auth/session";
import { displayReportMoney } from "@/lib/report-formatters";
import { getPaymentAccountStatement, normalizeReportFilters } from "@/server/reports/reports";

export const dynamic = "force-dynamic";

type PaymentAccountReportPageProps = {
  searchParams: Promise<{ q?: string; dateFrom?: string; dateTo?: string; paymentType?: string; paymentAccountId?: string; page?: string; pageSize?: string }>;
};

export default async function PaymentAccountReportPage({ searchParams }: PaymentAccountReportPageProps) {
  await requirePermission("report.profit.view");

  const params = await searchParams;
  const filters = normalizeReportFilters(params);
  const rows = await getPaymentAccountStatement(filters);
  const currencyCode = rows[0]?.currencyCode ?? "ETB";
  const inboundMinor = rows.filter((row) => row.paymentType === "inbound").reduce((total, row) => total + row.amountMinor, 0);
  const outboundMinor = rows.filter((row) => row.paymentType === "outbound").reduce((total, row) => total + row.amountMinor, 0);
  const netMinor = inboundMinor - outboundMinor;
  const reportPage = paginateRows(rows, params);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Financial Reports"
        title="Payment Account Statement"
        description="Audit inflow and outflow ledger activity across corporate cash boxes, banks, and digital accounts."
      />
      <ReportNavTabs current="payment-accounts" />
      <ReportFilters query={filters.query} dateFrom={filters.dateFrom} dateTo={filters.dateTo} paymentType={filters.paymentType ?? ""} />
      <div className="mb-6 grid gap-3.5 sm:grid-cols-2 md:grid-cols-4">
        <SummaryCard label="Transaction Lines" value={String(rows.length)} border="border-l-slate-400" />
        <SummaryCard
          label="Total Credits (Inbound)"
          value={displayReportMoney(inboundMinor, currencyCode)}
          border="border-l-emerald-600"
          highlight="text-emerald-700 dark:text-emerald-400 font-bold"
        />
        <SummaryCard
          label="Total Debits (Outbound)"
          value={displayReportMoney(outboundMinor, currencyCode)}
          border="border-l-rose-500"
          highlight="text-rose-700 dark:text-rose-400 font-bold"
        />
        <SummaryCard
          label="Net Flow"
          value={displayReportMoney(netMinor, currencyCode)}
          border="border-l-primary"
          highlight="text-primary font-bold"
        />
      </div>
      <section className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Partner</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Account / Bank</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Signed</th>
            </tr>
          </thead>
          <tbody>
            {reportPage.rows.map((row) => (
              <tr key={row.id} className="border-t border-border transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <Link
                    href={row.paymentType === "inbound" ? `/admin/sales/payments/${row.id}` : `/admin/purchasing/payments/${row.id}`}
                    className="font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {row.paymentNo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.paymentDate}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                    row.paymentType === "inbound"
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                  }`}>
                    {row.paymentType}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} size="sm" />
                </td>
                <td className="px-4 py-3 font-medium text-foreground">{row.partnerName ?? "-"}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.paymentMethodName}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.paymentAccountName}</div>
                  {row.institutionName ? <div className="text-xs text-muted-foreground">{row.institutionName}</div> : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.reference ?? "-"}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">{displayReportMoney(row.amountMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right font-medium">{displayReportMoney(row.signedAmountMinor, row.currencyCode)}</td>
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
