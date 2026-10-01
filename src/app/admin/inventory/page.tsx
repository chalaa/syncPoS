import Link from "next/link";
import { ArrowLeftRight, Sliders, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { TablePagination } from "@/components/ui/table-pagination";
import { T } from "@/components/ui/t";
import { paginateRows } from "@/lib/pagination";
import { requirePermission, getUserPermissionCodes } from "@/server/auth/session";
import { getSelectedShopId } from "@/server/locations/shop-options";
import { PERMISSIONS, userHasPermission } from "@/server/iam/permissions";
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
    page?: string;
    pageSize?: string;
  }>;
};

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const user = await requirePermission(PERMISSIONS.INVENTORY.VIEW);
  const userPerms = await getUserPermissionCodes(user.id);
  const canTransfer = userHasPermission(userPerms, PERMISSIONS.INVENTORY.TRANSFER_CREATE);
  const canAdjust = userHasPermission(userPerms, PERMISSIONS.INVENTORY.ADJUSTMENTS_CREATE);
  const canScrap = userHasPermission(userPerms, PERMISSIONS.INVENTORY.SCRAP_CREATE);

  const params = await searchParams;
  const query = params.q ?? "";
  const headerShopId = (await getSelectedShopId()) ?? "";

  const rawLocationParam = params.locationId;
  const selectedLocationFilter = rawLocationParam !== undefined 
    ? rawLocationParam 
    : (headerShopId || "all");

  const status = parseStockStatus(params.status);
  const asOfDate = params.asOfDate ?? "";

  const [options, rows, metrics, formOptions] = await Promise.all([
    getInventoryFilterOptions(),
    getStockByLocation({
      query,
      locationId: selectedLocationFilter,
      status,
      asOfDate: parseAsOfDate(asOfDate),
    }),
    getInventorySummaryMetrics({
      query,
      locationId: selectedLocationFilter,
      status,
      asOfDate: parseAsOfDate(asOfDate),
    }),
    getInventoryAdjustmentFormOptions(),
  ]);
  const stockPage = paginateRows(rows, params);

  return (
    <PageShell>
      <PageHeader
        eyebrow={<T k="header.eyebrow.Inventory Workspace">Inventory Workspace</T>}
        title={<T k="header.title.Stock & Balance Management">Stock & Balance Management</T>}
        description={<T k="header.desc.Unified warehouse stock command center">Unified warehouse stock command center, continuous valuation, and inventory control.</T>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canTransfer ? (
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
                    <T k="action.newTransfer">New Transfer</T>
                  </Button>
                }
              />
            ) : null}

            {canAdjust ? (
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
                    <T k="action.stockAdjustment">Stock Adjustment</T>
                  </Button>
                }
              />
            ) : null}

            {canScrap ? (
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
                    <T k="action.scrap">Scrap</T>
                  </Button>
                }
              />
            ) : null}
          </div>
        }
      />

      {/* KPI Cards */}
      <InventoryKpiCards metrics={metrics} activeStatus={status} />

      {/* Main Stock Table Section */}
      <section className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
        {asOfDate && (
          <div className="border-b border-border/80 bg-gold/10 px-4 py-2.5 text-xs font-semibold text-dark flex items-center justify-between">
            <span><T k="inventory.historicalReport">Historical As-Of Report: Quantities calculated from posted movements up to</T> {asOfDate}.</span>
            <Link href="/admin/inventory" className="underline font-bold text-xs hover:text-primary">
              <T k="action.clearDate">Clear date</T>
            </Link>
          </div>
        )}
        <StockFilters
          query={query}
          locationId={selectedLocationFilter}
          status={status}
          asOfDate={asOfDate}
          locations={options.locations}
        />
        <StockByLocationTable rows={stockPage.rows} formOptions={formOptions} />
        <TablePagination pagination={stockPage.pagination} />
      </section>
    </PageShell>
  );
}
