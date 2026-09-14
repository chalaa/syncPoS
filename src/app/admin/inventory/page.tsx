import Link from "next/link";
import { ArrowLeftRight, Sliders, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { StockByLocationTable, StockFilters } from "@/app/admin/inventory/stock-table";
import {
  getInventoryAdjustmentFormOptions,
  getInventoryFilterOptions,
  getInventorySummaryMetrics,
  getStockByLocation,
  parseAsOfDate,
  parseStockStatus,
} from "@/server/inventory/stock";

import { InventoryKpiCards } from "@/app/admin/inventory/inventory-kpi-cards";
import { NewInventoryOperationModal } from "@/app/admin/inventory/operations/new-operation-modal";

export const dynamic = "force-dynamic";

type InventoryPageProps = {
  searchParams: Promise<{
    q?: string;
    locationId?: string;
    status?: string;
    asOfDate?: string;
  }>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  await requirePermission("inventory.view");

  const params = await searchParams;
  const query = params.q ?? "";
  const locationId = params.locationId ?? "";
  const status = parseStockStatus(params.status);
  const asOfDate = params.asOfDate ?? "";

  const [options, rows, metrics, formOptions] = await Promise.all([
    getInventoryFilterOptions(),
    getStockByLocation({
      query,
      locationId: locationId || undefined,
      status,
      asOfDate: parseAsOfDate(asOfDate),
    }),
    getInventorySummaryMetrics(),
    getInventoryAdjustmentFormOptions(),
  ]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory Workspace"
        title="Stock & Balance Management"
        description="Unified warehouse stock command center, continuous valuation, and inventory control."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <NewInventoryOperationModal
              defaultType="transfer"
              owners={formOptions.owners}
              locations={formOptions.locations}
              products={formOptions.products}
              balances={formOptions.balances}
              returnPath="/admin/inventory"
              trigger={
                <Button className="gap-1.5 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-sm shadow-[#0B5D4B]/20 hover:brightness-110">
                  <ArrowLeftRight className="size-3.5 text-emerald-200" />
                  New Transfer
                </Button>
              }
            />

            <NewInventoryOperationModal
              defaultType="adjustment"
              owners={formOptions.owners}
              locations={formOptions.locations}
              products={formOptions.products}
              balances={formOptions.balances}
              returnPath="/admin/inventory"
              trigger={
                <Button variant="outline" className="gap-1.5 font-semibold text-foreground">
                  <Sliders className="size-3.5 text-amber-600" />
                  Stock Adjustment
                </Button>
              }
            />

            <NewInventoryOperationModal
              defaultType="scrap"
              owners={formOptions.owners}
              locations={formOptions.locations}
              products={formOptions.products}
              balances={formOptions.balances}
              returnPath="/admin/inventory"
              trigger={
                <Button variant="outline" className="gap-1.5 font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="size-3.5 text-destructive" />
                  Scrap
                </Button>
              }
            />
          </div>
        }
      />

      {/* KPI Cards */}
      <InventoryKpiCards metrics={metrics} activeStatus={status} />

      {/* Main Stock Table Section */}
      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
        {asOfDate && (
          <div className="border-b border-border/80 bg-gold/10 px-4 py-2.5 text-xs font-semibold text-dark flex items-center justify-between">
            <span>Historical As-Of Report: Quantities calculated from posted movements up to {asOfDate}.</span>
            <Link href="/admin/inventory" className="underline font-bold text-xs hover:text-primary">
              Clear date
            </Link>
          </div>
        )}
        <StockFilters
          query={query}
          locationId={locationId}
          status={status}
          asOfDate={asOfDate}
          locations={options.locations}
        />
        <StockByLocationTable rows={rows} formOptions={formOptions} />
      </section>
    </PageShell>
  );
}
