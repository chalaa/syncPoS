import { createInternalTransferOperation } from "@/app/admin/inventory/operations/actions";
import { InventoryInternalTransferForm } from "@/app/admin/inventory/operations/adjustment-lines-editor";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { requirePermission } from "@/server/auth/session";
import { getInventoryAdjustmentFormOptions } from "@/server/inventory/stock";

export const dynamic = "force-dynamic";

type NewInternalTransferPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewInternalTransferPage({ searchParams }: NewInternalTransferPageProps) {
  await requirePermission("inventory.receive");

  const [query, options] = await Promise.all([searchParams, getInventoryAdjustmentFormOptions()]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Inventory / Internal Transfer"
        title="New Internal Transfer"
        actions={<ButtonLink href="/admin/inventory/operations?view=transfers" variant="outline">Back to transfers</ButtonLink>}
      />

      {query.error ? <Alert kind="error">{query.error}</Alert> : null}

      <InventoryInternalTransferForm action={createInternalTransferOperation} owners={options.owners} locations={options.locations} products={options.products} balances={options.balances} />
    </PageShell>
  );
}
