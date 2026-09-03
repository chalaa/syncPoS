import { createInventoryAdjustment } from "@/app/admin/inventory/operations/actions";
import { InventoryAdjustmentForm } from "@/app/admin/inventory/operations/adjustment-lines-editor";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getInventoryAdjustmentFormOptions } from "@/server/inventory/stock";

export const dynamic = "force-dynamic";

type NewAdjustmentPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewAdjustmentPage({ searchParams }: NewAdjustmentPageProps) {
  await requirePermission("inventory.receive");

  const [query, options] = await Promise.all([searchParams, getInventoryAdjustmentFormOptions()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory / Adjustment"
        title="New Adjustment"
        actions={<ButtonLink href="/admin/inventory/operations?view=adjustments" variant="outline">Back to adjustments</ButtonLink>}
      />

      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <InventoryAdjustmentForm action={createInventoryAdjustment} owners={options.owners} locations={options.locations} products={options.products} balances={options.balances} />
    </PageShell>
  );
}
