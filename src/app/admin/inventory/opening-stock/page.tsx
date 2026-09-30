import { OpeningStockImporter } from "@/app/admin/inventory/opening-stock/opening-stock-importer";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { T } from "@/components/ui/t";
import { requirePermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function OpeningStockPage() {
  await requirePermission("inventory.receive");

  return (
    <PageShell>
      <PageHeader
        eyebrow={<T k="header.eyebrow.inventoryWorkspace" fallback="Inventory Workspace" />}
        title={<T k="header.title.openingStockImport" fallback="Opening Stock Import" />}
        description={
          <T
            k="header.description.openingStockImport"
            fallback="Bootstrap starting warehouse inventory balances and initial landed cost valuations."
          />
        }
      />

      <OpeningStockImporter />
    </PageShell>
  );
}
