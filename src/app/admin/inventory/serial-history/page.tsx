import {
  SerialHistoryFilters,
  SerialHistoryTable,
} from "@/app/admin/inventory/movement-table";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
import { requirePermission } from "@/server/auth/session";
import { getSerialHistory, parseAsOfDate } from "@/server/inventory/stock";

export const dynamic = "force-dynamic";

type SerialHistoryPageProps = {
  searchParams: Promise<{
    serial?: string;
    asOfDate?: string;
  }>;
};

export default async function SerialHistoryPage({ searchParams }: SerialHistoryPageProps) {
  await requirePermission("inventory.view");

  const params = await searchParams;
  const serialQuery = params.serial ?? "";
  const asOfDate = params.asOfDate ?? "";
  const rows = await getSerialHistory({
    serialQuery,
    asOfDate: parseAsOfDate(asOfDate),
  });

  return (
    <PageShell>
      <PageHeader
        eyebrow={<T k="header.eyebrow.inventoryWorkspace" fallback="Inventory Workspace" />}
        title={<T k="inventory.serialHistoryTitle" fallback="Serial & Lot Movement History" />}
        description={
          <T
            k="inventory.serialHistoryDesc"
            fallback="End-to-end provenance, receipts, transfers, deliveries, and returns for specific machine serial numbers."
          />
        }
      />

      <section className="rounded-xl border border-border bg-card shadow-xs">
        <SerialHistoryFilters serialQuery={serialQuery} asOfDate={asOfDate} />
        <SerialHistoryTable rows={rows} />
      </section>
    </PageShell>
  );
}
