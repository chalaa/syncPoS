import { createScrapOperation } from "@/app/admin/inventory/operations/actions";
import { InventoryScrapForm } from "@/app/admin/inventory/operations/adjustment-lines-editor";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getInventoryAdjustmentFormOptions } from "@/server/inventory/stock";

export const dynamic = "force-dynamic";

type NewScrapPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewScrapPage({ searchParams }: NewScrapPageProps) {
  await requirePermission("inventory.receive");

  const [query, options] = await Promise.all([searchParams, getInventoryAdjustmentFormOptions()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory / Scrap"
        title="New Scrap"
        actions={<ButtonLink href="/admin/inventory/operations?view=scrap" variant="outline">Back to scrap</ButtonLink>}
      />

      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <InventoryScrapForm action={createScrapOperation} owners={options.owners} locations={options.locations} products={options.products} balances={options.balances} />
    </PageShell>
  );
}
