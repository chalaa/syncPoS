import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { ButtonLink } from "@/components/ui/button";
import { requirePermission } from "@/server/auth/session";
import { StockByLocationTable, StockFilters } from "@/app/admin/inventory/stock-table";
import {
  getInventoryFilterOptions,
  getStockByLocation,
  parseAsOfDate,
  parseStockStatus,
} from "@/server/inventory/stock";

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
        eyebrow="Inventory"
        title="Stock Workspace"
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/inventory/stock-card">Stock card</ButtonLink>
            <ButtonLink href="/admin/inventory/operations">Operations</ButtonLink>
            <ButtonLink href="/admin/inventory/serial-history">Serial history</ButtonLink>
            <ButtonLink href="/admin/inventory/locations">Locations</ButtonLink>
            <ButtonLink href="/admin/inventory/opening-stock">Opening stock</ButtonLink>
          </div>
        }
      />
      <section className="rounded-lg border border-border bg-card">
        {asOfDate ? (
          <div className="border-b border-border px-4 py-3 text-sm text-muted-foreground">
            As-of report foundation: quantities are calculated from posted movement
            lines up to the selected date. Reservations remain current-state only
            until reservation history is implemented.
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
