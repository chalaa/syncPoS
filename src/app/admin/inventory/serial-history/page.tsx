import {
  SerialHistoryFilters,
  SerialHistoryTable,
} from "@/app/admin/inventory/movement-table";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
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
      <PageHeader eyebrow="Inventory" title="Serial History" />
      <section className="rounded-lg border border-border bg-card">
        <SerialHistoryFilters serialQuery={serialQuery} asOfDate={asOfDate} />
        <SerialHistoryTable rows={rows} />
      </section>
    </PageShell>
  );
}
