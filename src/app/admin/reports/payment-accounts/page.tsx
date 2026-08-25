import Link from "next/link";

import { EmptyRows, ReportFilters, SummaryCard } from "@/app/admin/reports/report-ui";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { displayReportMoney, getPaymentAccountStatement, normalizeReportFilters } from "@/server/reports/reports";

export const dynamic = "force-dynamic";

type PaymentAccountReportPageProps = {
  searchParams: Promise<{ q?: string; dateFrom?: string; dateTo?: string; paymentType?: string; paymentAccountId?: string }>;
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

  return (
    <PageShell>
      <PageHeader eyebrow="Reports" title="Payment Account Statement" />
      <ReportFilters query={filters.query} dateFrom={filters.dateFrom} dateTo={filters.dateTo} paymentType={filters.paymentType ?? ""} />
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <SummaryCard label="Rows" value={String(rows.length)} />
        <SummaryCard label="Inbound" value={displayReportMoney(inboundMinor, currencyCode)} />
        <SummaryCard label="Outbound" value={displayReportMoney(outboundMinor, currencyCode)} />
        <SummaryCard label="Net" value={displayReportMoney(netMinor, currencyCode)} />
      </div>
      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Partner</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Account/Bank</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-right">Signed</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link
                    href={row.paymentType === "inbound" ? `/admin/sales/payments/${row.id}` : `/admin/purchasing/payments/${row.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {row.paymentNo}
                  </Link>
                </td>
                <td className="px-4 py-3">{row.paymentDate}</td>
                <td className="px-4 py-3 capitalize">{row.paymentType}</td>
                <td className="px-4 py-3 capitalize">{row.status}</td>
                <td className="px-4 py-3">{row.partnerName ?? "-"}</td>
                <td className="px-4 py-3">{row.paymentMethodName}</td>
                <td className="px-4 py-3">
                  <div>{row.paymentAccountName}</div>
                  {row.institutionName ? <div className="text-xs text-muted-foreground">{row.institutionName}</div> : null}
                </td>
                <td className="px-4 py-3">{row.reference ?? "-"}</td>
                <td className="px-4 py-3 text-right">{displayReportMoney(row.amountMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right">{displayReportMoney(row.signedAmountMinor, row.currencyCode)}</td>
              </tr>
            ))}
            {rows.length === 0 ? <EmptyRows colSpan={10} /> : null}
          </tbody>
        </table>
      </section>
    </PageShell>
  );
}
