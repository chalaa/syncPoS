import Link from "next/link";

import { EmptyRows, ReportFilters, ReportNavTabs, SummaryCard } from "@/app/admin/reports/report-ui";
import { StatusBadge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { displayReportMoney, getPaymentReport, normalizeReportFilters } from "@/server/reports/reports";

export const dynamic = "force-dynamic";

type PaymentReportPageProps = {
  searchParams: Promise<{
    q?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    paymentType?: string;
    paymentAccountId?: string;
  }>;
};

function paymentHref(paymentId: string, paymentType: string) {
  return paymentType === "inbound"
    ? `/admin/sales/payments/${paymentId}`
    : `/admin/purchasing/payments/${paymentId}`;
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default async function PaymentReportPage({ searchParams }: PaymentReportPageProps) {
  await requirePermission("report.profit.view");

  const params = await searchParams;
  const filters = normalizeReportFilters(params);
  const rows = await getPaymentReport(filters);
  const currencyCode = rows[0]?.currencyCode ?? "ETB";
  const inboundMinor = rows
    .filter((row) => row.paymentType === "inbound")
    .reduce((total, row) => total + Number(row.amountMinor), 0);
  const outboundMinor = rows
    .filter((row) => row.paymentType === "outbound")
    .reduce((total, row) => total + Number(row.amountMinor), 0);
  const allocatedMinor = rows.reduce((total, row) => total + Number(row.allocatedAmountMinor), 0);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Financial Reports"
        title="Payments Ledger"
        description="Comprehensive audit of all inbound customer collections, outbound supplier disbursements, and allocations."
      />
      <ReportNavTabs current="payments" />
      <ReportFilters
        query={filters.query}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        status={filters.status ?? ""}
        paymentType={filters.paymentType ?? ""}
      />
      <div className="mb-4 grid gap-3.5 sm:grid-cols-2 md:grid-cols-4">
        <SummaryCard label="Total Payments" value={String(rows.length)} border="border-l-slate-400" />
        <SummaryCard
          label="Total Inbound"
          value={displayReportMoney(inboundMinor, currencyCode)}
          border="border-l-emerald-600"
          highlight="text-emerald-700 dark:text-emerald-400 font-bold"
        />
        <SummaryCard
          label="Total Outbound"
          value={displayReportMoney(outboundMinor, currencyCode)}
          border="border-l-rose-500"
          highlight="text-rose-700 dark:text-rose-400 font-bold"
        />
        <SummaryCard
          label="Net Cash Position"
          value={displayReportMoney(inboundMinor - outboundMinor, currencyCode)}
          border="border-l-primary"
          highlight="text-primary font-bold"
        />
      </div>
      <div className="mb-6 grid gap-3.5 sm:grid-cols-2">
        <SummaryCard
          label="Allocated to Invoices/Bills"
          value={displayReportMoney(allocatedMinor, currencyCode)}
          border="border-l-teal-600"
        />
        <SummaryCard
          label="Unallocated / Floating Advance"
          value={displayReportMoney(inboundMinor + outboundMinor - allocatedMinor, currencyCode)}
          border="border-l-accent"
          highlight="text-amber-700 dark:text-amber-400 font-bold"
        />
      </div>

      <section className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Partner</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Account / Bank</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Allocated</th>
              <th className="px-4 py-3 text-right">Signed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <Link
                    href={paymentHref(row.id, row.paymentType)}
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
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.sourceDocuments ?? "-"}</div>
                  {row.sourceTypes ? <div className="text-xs text-muted-foreground">{row.sourceTypes}</div> : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.paymentMethodName}</td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.paymentAccountName}</div>
                  {row.institutionName ? <div className="text-xs text-muted-foreground">{row.institutionName}</div> : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.reference ?? "-"}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">{displayReportMoney(Number(row.amountMinor), row.currencyCode)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{displayReportMoney(Number(row.allocatedAmountMinor), row.currencyCode)}</td>
                <td className="px-4 py-3 text-right font-medium">{displayReportMoney(Number(row.signedAmountMinor), row.currencyCode)}</td>
              </tr>
            ))}
            {rows.length === 0 ? <EmptyRows colSpan={12} /> : null}
          </tbody>
        </table>
      </section>
    </PageShell>
  );
}
