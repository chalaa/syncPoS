import Link from "next/link";

import { EmptyRows, ReportFilters, SummaryCard } from "@/app/admin/reports/report-ui";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { displayQuantity } from "@/server/inventory/stock";
import { displayReportMoney, getStockReport, normalizeReportFilters } from "@/server/reports/reports";

export const dynamic = "force-dynamic";

type StockReportPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function StockReportPage({ searchParams }: StockReportPageProps) {
  await requirePermission("report.profit.view");

  const params = await searchParams;
  const filters = normalizeReportFilters(params);
  const rows = await getStockReport(filters);
  const currencyCode = rows[0]?.currencyCode ?? "ETB";
  const stockValueMinor = rows.reduce((total, row) => total + row.stockValueMinor, 0);

  return (
    <PageShell>
      <PageHeader eyebrow="Reports" title="Stock Report" />
      <ReportFilters query={filters.query} />
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <SummaryCard label="Rows" value={String(rows.length)} />
        <SummaryCard label="Stock Value" value={displayReportMoney(stockValueMinor, currencyCode)} />
        <SummaryCard label="Tracked Rows" value={String(rows.filter((row) => row.serialNo || row.lotNo).length)} />
      </div>
      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Tracking</th>
              <th className="px-4 py-3">Serial/Lot</th>
              <th className="px-4 py-3 text-right">On Hand</th>
              <th className="px-4 py-3 text-right">Reserved</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3 text-right">Avg Cost</th>
              <th className="px-4 py-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.locationId}-${row.productId}-${row.productSerialId ?? row.productLotId ?? "bulk"}`} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/admin/products/${row.productId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                    {row.productName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{row.sku}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{row.locationCode}</div>
                  <div className="text-xs text-muted-foreground">{row.locationName}</div>
                </td>
                <td className="px-4 py-3 capitalize">{row.trackingMode}</td>
                <td className="px-4 py-3">{row.serialNo ?? row.lotNo ?? "Bulk"}</td>
                <td className="px-4 py-3 text-right">{displayQuantity(row.quantityOnHand)}</td>
                <td className="px-4 py-3 text-right">{displayQuantity(row.quantityReserved)}</td>
                <td className="px-4 py-3 text-right">{displayQuantity(row.quantityAvailable)}</td>
                <td className="px-4 py-3 text-right">{displayReportMoney(row.averageCostMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right">{displayReportMoney(row.stockValueMinor, row.currencyCode)}</td>
              </tr>
            ))}
            {rows.length === 0 ? <EmptyRows colSpan={9} /> : null}
          </tbody>
        </table>
      </section>
    </PageShell>
  );
}
