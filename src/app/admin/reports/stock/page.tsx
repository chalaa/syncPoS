import Link from "next/link";

import { EmptyRows, ReportFilters, ReportNavTabs, SummaryCard } from "@/app/admin/reports/report-ui";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TablePagination } from "@/components/ui/table-pagination";
import { paginateRows } from "@/lib/pagination";
import { requirePermission } from "@/server/auth/session";
import { displayQuantity } from "@/server/inventory/stock";
import { displayReportMoney } from "@/lib/report-formatters";
import { getStockReport, normalizeReportFilters } from "@/server/reports/reports";

export const dynamic = "force-dynamic";

type StockReportPageProps = {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
};

export default async function StockReportPage({ searchParams }: StockReportPageProps) {
  await requirePermission("report.profit.view");

  const params = await searchParams;
  const filters = normalizeReportFilters(params);
  const rows = await getStockReport(filters);
  const currencyCode = rows[0]?.currencyCode ?? "ETB";
  const stockValueMinor = rows.reduce((total, row) => total + row.stockValueMinor, 0);
  const reportPage = paginateRows(rows, params);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory Intelligence"
        title="Stock Valuation Report"
        description="Real-time stock on hand, inventory reservations, serialized tracking, and asset valuations."
      />
      <ReportNavTabs current="stock" />
      <ReportFilters query={filters.query} />
      <div className="mb-6 grid gap-3.5 sm:grid-cols-3">
        <SummaryCard label="SKU / Batch Records" value={String(rows.length)} border="border-l-slate-400" />
        <SummaryCard
          label="Total Inventory Valuation"
          value={displayReportMoney(stockValueMinor, currencyCode)}
          border="border-l-primary"
          highlight="text-primary font-bold"
        />
        <SummaryCard
          label="Tracked Units (Serial / Lot)"
          value={String(rows.filter((row) => row.serialNo || row.lotNo).length)}
          border="border-l-accent"
          highlight="text-amber-700 dark:text-amber-400 font-bold"
        />
      </div>
      <section className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-secondary/40 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Tracking</th>
              <th className="px-4 py-3">Serial / Lot</th>
              <th className="px-4 py-3 text-right">On Hand</th>
              <th className="px-4 py-3 text-right">Reserved</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3 text-right">Avg Cost</th>
              <th className="px-4 py-3 text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {reportPage.rows.map((row) => (
              <tr key={`${row.locationId}-${row.productId}-${row.productSerialId ?? row.productLotId ?? "bulk"}`} className="border-t border-border transition-colors hover:bg-secondary/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/products/${row.productId}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                    {row.productName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{row.sku}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{row.locationCode}</div>
                  <div className="text-xs text-muted-foreground">{row.locationName}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={row.trackingMode === "serial" ? "primary" : row.trackingMode === "lot" ? "accent" : "outline"} className="capitalize">
                    {row.trackingMode}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{row.serialNo ?? row.lotNo ?? <span className="text-muted-foreground">Bulk</span>}</td>
                <td className="px-4 py-3 text-right font-medium">{displayQuantity(row.quantityOnHand)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{displayQuantity(row.quantityReserved)}</td>
                <td className="px-4 py-3 text-right font-semibold text-primary">{displayQuantity(row.quantityAvailable)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{displayReportMoney(row.averageCostMinor, row.currencyCode)}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">{displayReportMoney(row.stockValueMinor, row.currencyCode)}</td>
              </tr>
            ))}
            {reportPage.rows.length === 0 ? <EmptyRows colSpan={9} /> : null}
          </tbody>
        </table>
      </section>
      <TablePagination pagination={reportPage.pagination} />
    </PageShell>
  );
}
