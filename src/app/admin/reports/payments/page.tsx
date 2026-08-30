import Link from "next/link";

import { EmptyRows, ReportFilters, SummaryCard } from "@/app/admin/reports/report-ui";
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
      <PageHeader eyebrow="Reports" title="Payment Report" />
      <ReportFilters
        query={filters.query}
        dateFrom={filters.dateFrom}
        dateTo={filters.dateTo}
        status={filters.status ?? ""}
        paymentType={filters.paymentType ?? ""}
      />
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <SummaryCard label="Payments" value={String(rows.length)} />
        <SummaryCard label="Inbound" value={displayReportMoney(inboundMinor, currencyCode)} />
        <SummaryCard label="Outbound" value={displayReportMoney(outboundMinor, currencyCode)} />
        <SummaryCard label="Net Cash Flow" value={displayReportMoney(inboundMinor - outboundMinor, currencyCode)} />
      </div>
      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <SummaryCard label="Allocated" value={displayReportMoney(allocatedMinor, currencyCode)} />
        <SummaryCard label="Unallocated" value={displayReportMoney(inboundMinor + outboundMinor - allocatedMinor, currencyCode)} />
      </div>

      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
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
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link
                    href={paymentHref(row.id, row.paymentType)}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {row.paymentNo}
                  </Link>
                </td>
                <td className="px-4 py-3">{row.paymentDate}</td>
                <td className="px-4 py-3 capitalize">{row.paymentType}</td>
                <td className="px-4 py-3 capitalize">{statusLabel(row.status)}</td>
                <td className="px-4 py-3">{row.partnerName ?? "-"}</td>
                <td className="px-4 py-3">
                  <div>{row.sourceDocuments ?? "-"}</div>
                  {row.sourceTypes ? <div className="text-xs text-muted-foreground">{row.sourceTypes}</div> : null}
                </td>
                <td className="px-4 py-3">{row.paymentMethodName}</td>
                <td className="px-4 py-3">
                  <div>{row.paymentAccountName}</div>
                  {row.institutionName ? <div className="text-xs text-muted-foreground">{row.institutionName}</div> : null}
                </td>
                <td className="px-4 py-3">{row.reference ?? "-"}</td>
                <td className="px-4 py-3 text-right">{displayReportMoney(Number(row.amountMinor), row.currencyCode)}</td>
                <td className="px-4 py-3 text-right">{displayReportMoney(Number(row.allocatedAmountMinor), row.currencyCode)}</td>
                <td className="px-4 py-3 text-right">{displayReportMoney(Number(row.signedAmountMinor), row.currencyCode)}</td>
              </tr>
            ))}
            {rows.length === 0 ? <EmptyRows colSpan={12} /> : null}
          </tbody>
        </table>
      </section>
    </PageShell>
  );
}
