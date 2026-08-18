import { OpeningStockImporter } from "@/app/admin/inventory/opening-stock/opening-stock-importer";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function OpeningStockPage() {
  await requirePermission("inventory.receive");

  return (
    <PageShell>
      <PageHeader eyebrow="Inventory" title="Opening Stock Import" />
      <OpeningStockImporter />
    </PageShell>
  );
}
