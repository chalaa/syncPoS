import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/server/auth/session";
import { StockByLocationTable, StockFilters } from "@/app/admin/inventory/stock-table";
import {
  getInventoryFilterOptions,
  getStockByLocation,
  parseAsOfDate,
  parseStockStatus,
} from "@/server/inventory/stock";

import { InventoryNavTabs } from "@/app/admin/inventory/inventory-nav-tabs";

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
  const [options, rows] = await Promise.all([
    getInventoryFilterOptions(),
    getStockByLocation({
      query,
      locationId: locationId || undefined,
      status,
      asOfDate: parseAsOfDate(asOfDate),
    }),
  ]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory Workspace"
        title="Stock & Balance Management"
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/inventory/operations" variant="default">
              New Transfer / Operation
            </ButtonLink>
          </div>
        }
      />

      <InventoryNavTabs currentHref="/admin/inventory" />

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        {asOfDate ? (
          <div className="border-b border-border bg-gold/10 px-4 py-3 text-xs font-medium text-dark">
            As-of report active: quantities calculated from posted movements up to {asOfDate}.
          </div>
        ) : null}
        <StockFilters
          query={query}
          locationId={locationId}
          status={status}
          asOfDate={asOfDate}
          locations={options.locations}
        />
        <StockByLocationTable rows={rows} />
      </section>
    </PageShell>
  );
}

